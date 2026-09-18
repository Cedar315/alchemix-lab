import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { companionInput } from '../src/lib/agent/companion-contract.ts';
import { runCompanion } from '../src/lib/agent/companion.ts';
import { mentionedMaterials } from '../src/lib/agent/workflow-catalog.ts';

const origin = process.env.BROWSER_TEST_ORIGIN || 'http://127.0.0.1:3003';
const debugOrigin = process.env.BROWSER_DEBUG_ORIGIN || 'http://127.0.0.1:9222';
const target = await fetch(`${debugOrigin}/json/new?${encodeURIComponent(origin)}`, { method: 'PUT' }).then(r => r.json());
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
const requests = new Map(), errors = [], checks = [];
let sequence = 0, lastInput, searches = 0, failNextSearch = false;
function call(method, params = {}) {
    return new Promise((resolve, reject) => {
        const id = ++sequence;
        const timeout = setTimeout(() => { requests.delete(id); reject(Error(`Timeout: ${method}`)); }, 15000);
        requests.set(id, { resolve: result => { clearTimeout(timeout); resolve(result); }, reject });
        ws.send(JSON.stringify({ id, method, params }));
    });
}
const dependencies = {
    model: async state => {
        const q = state.question;
        return { model: 'browser-fixture', usage: null, value: {
            intent: /能做什么/.test(q) ? 'recommend' : /搭配|什么味/.test(q) ? 'explore' : /太甜|分层/.test(q) ? 'troubleshoot' : 'knowledge',
            dialogueAct: 'new_task', materials: mentionedMaterials(q), recipeName: '', category: 'any', capability: 'none', question: '', knowledgeQuestion: '',
        } };
    },
    search: async () => {
        searches++;
        if (failNextSearch) { failNextSearch = false; throw Error('fixture query failure'); }
        return { status: 'answered', claims: [{ text: '界面测试：这里展示有来源的建议。', evidenceIds: ['fixture'] }], citations: [{ id: 'fixture', title: '测试资料', sources: [{ title: '测试来源链接', url: 'https://example.com/evidence' }] }] };
    },
};
ws.addEventListener('message', async event => {
    const message = JSON.parse(event.data);
    if (message.id) {
        const pending = requests.get(message.id); requests.delete(message.id);
        if (message.error) pending?.reject(Error(message.error.message)); else pending?.resolve(message.result);
        return;
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method !== 'Fetch.requestPaused') return;
    const { requestId, request } = message.params;
    try {
        let body;
        if (request.url.endsWith('/api/auth/me')) body = { user: { id: 'response-browser-owner' } };
        else if (request.url.endsWith('/api/drink-logs')) body = { drink_logs: [] };
        else if (request.url.endsWith('/api/saved-cocktails')) body = { cocktails: [] };
        else if (request.url.includes('/api/inspiration/')) body = { recipes: [], variants: [] };
        else if (request.url.endsWith('/api/agent')) {
            lastInput = companionInput.parse(JSON.parse(request.postData));
            body = await runCompanion(lastInput, dependencies);
        }
        if (body) await call('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(body)).toString('base64') });
        else await call('Fetch.continueRequest', { requestId });
    } catch (error) { errors.push(String(error)); await call('Fetch.failRequest', { requestId, errorReason: 'Failed' }).catch(() => {}); }
});
async function evaluate(expression) {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.text);
    return result.result.value;
}
async function until(expression) {
    for (let i = 0; i < 100; i++) { if (await evaluate(`Boolean(${expression})`)) return; await new Promise(resolve => setTimeout(resolve, 100)); }
    throw Error(`Timed out: ${expression}`);
}
const click = label => evaluate(`Array.from(document.querySelectorAll('.assistant-panel button')).findLast(b => b.textContent.trim() === ${JSON.stringify(label)})?.click()`);
async function send(text) {
    const count = await evaluate(`document.querySelectorAll('.assistant-message.assistant').length`);
    await evaluate(`(()=>{const el=document.querySelector('#companion-question');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,${JSON.stringify(text)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await until(`!document.querySelector('[aria-label="发送问题"]').disabled`);
    await evaluate(`document.querySelector('[aria-label="发送问题"]').click()`);
    await until(`document.querySelectorAll('.assistant-message.assistant:not([role="status"])').length > ${count}`);
}
const lastText = () => evaluate(`Array.from(document.querySelectorAll('.assistant-message.assistant')).at(-1).innerText`);
try {
    await call('Runtime.enable'); await call('Page.enable');
    await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await call('Fetch.enable', { patterns: ['/api/auth/me', '/api/agent', '/api/drink-logs', '/api/saved-cocktails', '/api/inspiration/*'].map(path => ({ urlPattern: '*' + path })) });
    await call('Page.navigate', { url: origin + '/inspiration/classic-remix?cocktail=margarita' });
    await until(`document.querySelector('[aria-label="打开调酒助手"]')`);
    await evaluate(`document.querySelector('[aria-label="打开调酒助手"]').click()`);
    await until(`document.querySelector('#companion-question')`);

    await send('这杯材料不齐怎么办？');
    assert.match(await lastText(), /缺少哪一种材料/);
    assert.equal(await evaluate(`document.querySelectorAll('.assistant-choices').length`), 0);
    assert.equal(searches, 0); checks.push('missing-first-no-category-buttons');
    await send('青柠');
    assert.equal(lastInput.pending.kind, 'substitution');
    assert.match(await lastText(), /手边有哪些/); assert.equal(searches, 0); checks.push('missing-followup-asks-stock');
    await send('柠檬');
    assert.equal(lastInput.pending.stage, 'available');
    assert.match(await lastText(), /有来源的建议/); assert.equal(searches, 1);
    assert.equal(await evaluate(`document.querySelector('.assistant-sources a')?.href`), 'https://example.com/evidence');
    assert.match(await lastText(), /查看便利店改良选项/); checks.push('stock-followup-answer-sources-shortcut');

    await send('没有青柠怎么办？');
    assert.match(await lastText(), /手边有哪些/);
    failNextSearch = true;
    await send('柠檬');
    await until(`document.querySelector('.assistant-error')`);
    assert.match(await lastText(), /查询没有完成/);
    const beforeRetry = await evaluate(`document.querySelectorAll('.assistant-message.user').length`);
    await click('重试这条消息');
    await until(`!document.querySelector('.assistant-error') && !document.querySelector('.assistant-message[role="status"]')`);
    assert.match(await lastText(), /有来源的建议/);
    assert.equal(lastInput.pending.stage, 'available');
    assert.equal(await evaluate(`document.querySelectorAll('.assistant-message.user').length`), beforeRetry);
    assert.equal(searches, 3); checks.push('retry-preserves-stock-pending-without-duplicate-message');

    await send('这杯太甜了');
    assert.match(await lastText(), /实际用了哪些材料/);
    await send('金酒和养乐多'); assert.match(await lastText(), /怎么调这杯/);
    assert.equal(searches, 3);
    await send('一起倒进杯里，搅拌了几下');
    assert.equal(lastInput.pending.kind, 'troubleshoot'); assert.equal(lastInput.pending.stage, 'steps');
    assert.match(await lastText(), /有来源的建议/); assert.equal(searches, 4); checks.push('actual-materials-then-steps-then-advice');

    await send('橙汁和伏特加配起来是什么味道？');
    assert.match(await lastText(), /到实验室查看搭配/); assert.equal(searches, 4); checks.push('flavour-handoff-without-search');
    await send('我有伏特加和橙汁，能做什么酒？');
    await until(`document.querySelector('.assistant-recipe-card button[aria-expanded="false"]:not(:disabled)')`);
    const before = await evaluate('location.href');
    await click('展开酒单');
    await until(`document.querySelector('.assistant-recipe-details')`);
    assert.match(await evaluate(`document.querySelector('.assistant-recipe-details').innerText`), /需要材料/);
    assert.equal(await evaluate('location.href'), before); checks.push('recipe-expands-without-navigation');
    await click('收起酒单'); assert.equal(await evaluate(`!!document.querySelector('.assistant-recipe-details')`), false);
    await click('展开酒单'); checks.push('recipe-collapse-and-reopen');
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= 390`), true); checks.push('mobile-no-overflow');

    await mkdir('artifacts/browser', { recursive: true });
    const screenshot = await call('Page.captureScreenshot', { format: 'png' });
    await writeFile('artifacts/browser/agent-responses-mobile.png', Buffer.from(screenshot.data, 'base64'));
    await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    assert.equal(await evaluate(`(()=>{const panel=document.querySelector('.assistant-panel').getBoundingClientRect(), shell=document.querySelector('[data-app-shell]').getBoundingClientRect();return panel.left>=shell.left && panel.right<=shell.right;})()`), true);
    checks.push('desktop-within-app-shell');
    await click('查看完整酒单');
    await until(`location.pathname.includes('convenience-mix')`);
    assert.equal(await evaluate(`!!document.querySelector('.assistant-panel')`), false); checks.push('full-recipe-link-opens-detail');
    assert.deepEqual(errors, []); checks.push('no-browser-exceptions');
    const report = { at: new Date().toISOString(), note: 'Real UI and runCompanion; model, knowledge, authentication and account APIs use fixtures. No external writes.', checks, errors };
    await writeFile('artifacts/browser/agent-responses-checks.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
} catch (error) {
    console.error(error); console.error(JSON.stringify({ checks, errors, lastInput, body: await evaluate('document.body.innerText.slice(-3500)') }));
    process.exitCode = 1;
} finally { ws.close(); await fetch(`${debugOrigin}/json/close/${target.id}`).catch(() => {}); }
