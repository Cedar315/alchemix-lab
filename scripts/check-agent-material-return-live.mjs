// Real browser + authenticated API + DeepSeek. Test identity is removed in finally.
import env from '@next/env'; env.loadEnvConfig(process.cwd(), true);
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { default: prisma } = await import('../src/lib/db/prisma.ts');
const origin = process.env.AGENT_TEST_ORIGIN || 'http://localhost:3003';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
let userId, ws, target;
try {
  const email = `agent-return-${randomUUID()}@example.com`, password = randomUUID() + 'Aa9!';
  const created = await supabase.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { is_test: true } });
  if (created.error) throw Error('Temporary identity unavailable');
  userId = created.data.user.id;
  const login = await fetch(origin + '/api/auth/sign-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  assert.equal(login.status, 200);
  target = await fetch('http://localhost:9233/json/new?about:blank', { method: 'PUT' }).then(r => r.json());
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  let sequence = 0; const pending = new Map(), errors = [];
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence, timer = setTimeout(() => reject(Error(method)), 60000);
    pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject }); ws.send(JSON.stringify({ id, method, params }));
  });
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p?.reject(Error(m.error.message)) : p?.resolve(m.result); } if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text); });
  const evaluate = async expression => { const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(r.exceptionDetails.text); return r.result.value; };
  const until = async expression => { for (let i = 0; i < 300; i++) { if (await evaluate(expression)) return; await new Promise(r => setTimeout(r, 200)); } throw Error(expression); };
  await call('Network.enable'); await call('Runtime.enable'); await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  const cookies = login.headers.getSetCookie().map(raw => { const pair = raw.split(';')[0], at = pair.indexOf('='); return { name: pair.slice(0, at), value: pair.slice(at + 1), url: origin, path: '/', httpOnly: /httponly/i.test(raw), secure: origin.startsWith('https:') }; });
  await call('Network.setCookies', { cookies });
  await call('Page.navigate', { url: origin + '/inspiration/convenience-mix?cocktail=gin-grapefruit-soda' });
  await until(`document.querySelector('[aria-label="打开调酒助手"]')!==null`);
  await evaluate(`document.querySelector('[aria-label="打开调酒助手"]').click()`);
  await until(`document.querySelector('#companion-question') && !document.body.innerText.includes('正在确认登录状态')`);
  async function draft(value) { await evaluate(`(()=>{const e=document.querySelector('#companion-question');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`); }
  await draft('金酒配可乐是什么味道');
  await until(`!document.querySelector('[aria-label="发送问题"]').disabled`);
  await evaluate(`document.querySelector('[aria-label="发送问题"]').click()`);
  await until(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='带入材料，进入我的酒精实验室'&&!b.disabled)`);
  const suggestion = await evaluate(`Array.from(document.querySelectorAll('[aria-label="实验室试配材料"] p')).map(e=>e.textContent)`);
  const expected = suggestion.map(s => s.match(/^(.*?) · ([\d.]+) ml$/)).filter(Boolean).map(m => ({ name: m[1], amount: Number(m[2]) }));
  assert.deepEqual(expected.map(m => m.name).sort(), ['可乐', '金酒'].sort());
  await draft('我还想调整甜度');
  await until(`document.querySelector('#companion-question').value==='我还想调整甜度'`);
  await evaluate(`document.querySelector('.assistant-messages').scrollTop=20`);
  const beforeScroll = await evaluate(`document.querySelector('.assistant-messages').scrollTop`);
  await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='带入材料，进入我的酒精实验室').click()`);
  await until(`location.search.includes('tab=LAB') && document.querySelector('.assistant-return')!==null && document.body.innerText.includes('当前材料')`);
  await until(`JSON.parse(sessionStorage.getItem('alchemix_lab_draft_v1')||'null')?.ingredients?.length===2`);
  const filled = await evaluate(`JSON.parse(sessionStorage.getItem('alchemix_lab_draft_v1')).ingredients.map(({name,amount})=>({name,amount}))`);
  assert.deepEqual(filled, expected);
  const visible = await evaluate(`document.body.innerText`);
  for (const m of filled) { assert.ok(visible.includes(m.name)); assert.equal(await evaluate(`document.querySelector('[aria-label="${m.name}用量（ml）"]').value`),String(m.amount)); }
  await mkdir('artifacts/agent-next', { recursive: true });
  const screenshot = await call('Page.captureScreenshot', { format: 'png' });
  await writeFile('artifacts/agent-next/material-return-live.png', Buffer.from(screenshot.data, 'base64'));
  await evaluate(`(()=>{const e=document.querySelector('[aria-label="金酒用量（ml）"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'35');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await until(`JSON.parse(sessionStorage.getItem('alchemix_lab_draft_v1')).ingredients.some(i=>i.name==='金酒'&&i.amount===35)`);
  filled.find(m=>m.name==='金酒').amount=35;
  await evaluate(`document.querySelector('.assistant-return').click()`);
  await until(`document.body.innerText.includes('金酒配可乐是什么味道') && document.querySelector('#companion-question').value==='我还想调整甜度'`);
  assert.ok(Math.abs(await evaluate(`document.querySelector('.assistant-messages').scrollTop`) - beforeScroll) < 2);
  assert.deepEqual(await evaluate(`JSON.parse(sessionStorage.getItem('alchemix_lab_draft_v1')).ingredients.map(({name,amount})=>({name,amount}))`), filled);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ origin, realProvider: true, expected, checks: ['screenshot-question-action', 'concrete-amounts', 'visible-prefilled-materials', 'return-button', 'chat-draft-scroll-preserved', 'lab-preserved'] }));
} finally {
  ws?.close(); if (target) await fetch('http://localhost:9233/json/close/' + target.id).catch(() => {});
  if (userId) { await prisma.$executeRaw`DELETE FROM pm_events WHERE user_id=${userId}::uuid`; await prisma.$executeRaw`DELETE FROM pm_tasks WHERE user_id=${userId}::uuid`; await prisma.$executeRaw`DELETE FROM ai_request_leases WHERE user_id=${userId}::uuid`; await prisma.user.deleteMany({ where: { id: userId } }); await supabase.auth.admin.deleteUser(userId); }
  await prisma.$disconnect();
}
