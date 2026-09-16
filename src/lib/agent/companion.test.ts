import test from 'node:test';
import assert from 'node:assert/strict';
import { companionInput, companionOutput, type Decision } from './companion-contract';
import { runCompanion, type CompanionDeps } from './companion';
import { recipeContext, matchWorkflow, actionHref, verifiedMaterials } from './workflow-catalog';
import { createTask, acceptsResult, sessionSchema } from './companion-session';
const input = (question: string, extra: Record<string, unknown> = {}) => companionInput.parse({ version: 2, taskId: crypto.randomUUID(), contextVersion: 0, question, page: recipeContext('classic', 'margarita'), history: [], ...extra });
const base: Decision = { intent: 'recommend', dialogueAct: 'new_task', materials: [], recipeName: '', category: 'any', capability: 'none', question: '', knowledgeQuestion: '' };
const answer = { status: 'answered', claims: [{ text: '按适用资料核对制作方法。', evidenceIds: ['one'] }], citations: [{ id: 'one', title: '制作方法', sources: [{ title: '来源', url: 'https://example.com/evidence' }] }] };
function deps(decision: Partial<Decision>, fail = false) { let models = 0, searches = 0; const d: CompanionDeps = { model: async () => { models++; return { value: { ...base, ...decision }, model: 'fixture', usage: null }; }, search: async () => { searches++; if (fail)
        throw Error('offline'); return answer; } }; return { d, count: () => ({ models, searches }) }; }
test('two matching categories ask once; explicit preference skips clarification', async () => {
    const materials = ['龙舌兰', '橙味利口酒', '青柠', '橙汁'];
    const q = '我有' + materials.join('、');
    const d = deps({ materials });
    const r = await runCompanion(input(q), d.d);
    assert.equal(r.pending?.kind, 'category');
    assert.equal(r.recipes.length, 0);
    const next = await runCompanion(input('经典酒', { history: [{ role: 'user', content: q }], pending: r.pending }), d.d);
    assert.equal(d.count().models, 1);
    assert.ok(next.recipes.some(r => r.id === 'margarita'));
    assert.ok(next.recipes.every(r => r.category === 'classic'));
    assert.equal(next.pending, null);
    const explicit = await runCompanion(input(q+'，想看经典酒'), deps({ materials, category: 'classic' }).d);
    assert.equal(explicit.pending, null);
    assert.ok(explicit.recipes.length);
});
test('one category, maximum three, and workflow ordering are preserved', async () => {
    const materials = ['伏特加', '橙汁', '苹果汁', '可乐', '乌龙茶', '雪碧'];
    const r = await runCompanion(input('有' + materials.join('、')), deps({ materials }).d);
    assert.equal(r.pending, null);
    assert.equal(r.recipes.length, 3);
    assert.deepEqual(r.recipes.map(r => r.id), matchWorkflow(materials).slice(0, 3).map(r => r.recipe.id));
    assert.ok(r.recipes.every(r => actionHref(r.action)?.includes(r.id)));
});
test('missing required ingredient never becomes complete Margarita', async () => {
    assert.equal(matchWorkflow(['龙舌兰', '青柠']).some(r => r.recipe.id === 'margarita'), false);
    const r = await runCompanion(input('我有砂纸'), deps({ materials: ['砂纸'] }).d);
    assert.equal(r.status, 'no_results');
    assert.equal(r.recipes.length, 0);
});
test('unknown stock is not inferred from page or assistant messages', () => {
    const i = input('推荐', { history: [{ role: 'assistant', content: '你有龙舌兰' }] });
    assert.deepEqual(verifiedMaterials(['龙舌兰'], i), []);
});
test('named recipe resolves exact shared route; unknown recipe never gets a link', async () => {
    const r = await runCompanion(input('打开玛格丽特'), deps({ intent: 'named', recipeName: '玛格丽特' }).d);
    assert.equal(actionHref(r.actions[0].action), '/inspiration/classic-remix?cocktail=margarita');
    const bad = await runCompanion(input('打开不存在'), deps({ intent: 'named', recipeName: '不存在' }).d);
    assert.equal(bad.status, 'no_results');
    assert.equal(bad.actions.length, 0);
});
test('exploration proposes materials without fabricated quantities', async () => {
    const r = await runCompanion(input('橙汁和伏特加什么味道'), deps({ intent: 'explore', materials: ['橙汁', '伏特加'] }).d);
    const action=r.actions[0].action;
    assert.equal(action.kind,'prefill');
    if(action.kind==='prefill'){assert.deepEqual(action.materials.map(i=>i.name).sort(),['橙汁','伏特加'].sort());assert.ok(action.materials.every(i=>i.amount===undefined));}
});
test('current drink substitution stays on its workflow', async () => {
    const d=deps({ intent: 'change' });
    const r = await runCompanion(input('这杯没有橙味利口酒'), d.d);
    assert.equal(r.recipes.length, 0);
    assert.deepEqual(r.actions[0].action, { kind: 'locate', target: 'substitute' });
    assert.equal(d.count().models,0);
});
test('clear missing drink request skips intent model and asks for concrete options without slow search',async()=>{
    const d=deps({intent:'knowledge'});
    d.d.search=async()=>({status:'insufficient_evidence',claims:[],citations:[]});
    const r=await runCompanion(input('我没有西柚了可以换什么饮料啊',{page:recipeContext('convenience','grapefruit-beer')}),d.d);
    assert.equal(d.count().models,0);assert.equal(d.count().searches,0);
    assert.equal(r.status,'needs_info');assert.match(r.clarification,/手边有哪些/);assert.doesNotMatch(r.clarification,/现有资料.*不足/);
});
test('ice question clarifies preparation facts, not drink preference', async () => {
    const r = await runCompanion(input('该加多少冰'), deps({ intent: 'guide', question: '你用的是什么杯子？' }).d);
    assert.equal(r.status, 'needs_info');
    assert.equal(r.clarification, '你用的是什么杯子？');
    assert.equal(r.recipes.length, 0);
});
test('mixed request retains matching and knowledge, including failures', async () => {
    const d = deps({ materials: ['伏特加', '橙汁'], knowledgeQuestion: '如何过滤？' });
    const r = await runCompanion(input('我有伏特加和橙汁，还想知道如何过滤'), d.d);
    assert.ok(r.recipes.length);
    assert.ok(r.knowledge);
    assert.equal(d.count().searches, 1);
    const failed = await runCompanion(input('伏特加和橙汁，还想知道如何过滤'), deps({ materials: ['伏特加', '橙汁'], knowledgeQuestion: '如何过滤？' }, true).d);
    assert.ok(failed.recipes.length);
    assert.match(failed.message, /没有完成/);
});
test('cancel bypasses model and clears category clarification', async () => {
    const d = deps({});
    const r = await runCompanion(input('算了', { pending: { kind: 'category', materials: ['橙汁'] } }), d.d);
    assert.equal(r.status, 'cancelled');
    assert.equal(r.pending, null);
    assert.equal(d.count().models, 0);
});
test('knowledge rejects invented citations and surfaces service failure', async () => {
    const d = deps({ intent: 'knowledge' });
    d.d.search = async () => ({ ...answer, claims: [{ text: '虚构', evidenceIds: ['missing'] }] });
    const r = await runCompanion(input('解释过滤'), d.d);
    assert.equal(r.knowledge, null);
    assert.equal(r.status, 'unavailable');
});
test('protocol repair is bounded and unknown commands rejected', async () => {
    const d = deps({});
    d.d.model = async () => ({ value: { intent: 'execute_js' }, model: 'fixture', usage: null });
    const r = await runCompanion(input('操作'), d.d);
    assert.equal(r.status, 'unavailable');
    assert.equal(r.actions.length, 0);
    assert.equal(companionInput.safeParse({ ...input('hi'), execute: 'delete' }).success, false);
});
test('task identity and version reject late results and separate cups', () => {
    const a = createTask(recipeContext('classic', 'margarita'));
    const b = createTask(recipeContext('classic', 'negroni'));
    assert.notEqual(a.id, b.id);
    assert.deepEqual(b.messages, []);
    assert.equal(acceptsResult(b, { taskId: a.id, contextVersion: a.version }), false);
    assert.equal(acceptsResult({ ...a, version: 1 }, { taskId: a.id, contextVersion: 0 }), false);
    assert.equal(sessionSchema.safeParse({ tasks: [], active: null, owner: null }).success, true);
});
test('all successful outputs satisfy the versioned public schema', async () => {
    for (const intent of ['knowledge', 'out_of_scope', 'operate', 'unclear'] as const) {
        const r = await runCompanion(input('测试'), deps({ intent, capability: 'lab' }).d);
        assert.equal(companionOutput.safeParse(r).success, true);
    }
});
test('literal workflow guards repair model drift without generic chat taking over workflows', async () => {
    const named = await runCompanion(input('打开玛格丽特的酒单'), deps({ intent: 'operate', capability: 'recipe' }).d);
    assert.equal(named.actions[0].action.kind, 'recipe');
    const explore = await runCompanion(input('橙汁和伏特加配起来是什么味道？'), deps({ intent: 'knowledge', knowledgeQuestion: '这个搭配是什么味道' }).d);
    assert.equal(explore.actions[0].action.kind, 'prefill');
    assert.equal(explore.knowledge, null);
    const categories = await runCompanion(input('我有龙舌兰、橙味利口酒、青柠、橙汁，这些材料能做什么？'), deps({ intent: 'recommend', category: 'classic', materials: ['龙舌兰'] }).d);
    assert.equal(categories.pending?.kind, 'category');
});
test('explicit missing or corrected ingredients invalidate old available stock', () => {
    const context = input('橙汁没有了，不是伏特加，是金酒', { history: [{ role: 'user', content: '我有橙汁和伏特加' }] });
    assert.deepEqual(verifiedMaterials(['橙汁', '伏特加', '金酒'], context), ['金酒']);
});

test('Highball and Paloma resolve to their own recipes and assistant names', () => {
    const highball=recipeContext('classic','highball'),paloma=recipeContext('classic','paloma');
    assert.equal(highball.name,'威士忌嗨棒');assert.equal(paloma.name,'帕洛玛');
    assert.ok(highball.ingredients.some(i=>i.name.includes('威士忌')));
    assert.ok(!paloma.ingredients.some(i=>i.name.includes('橙味利口酒')));
    assert.equal(actionHref({kind:'recipe',category:'classic',id:'paloma'}),'/inspiration/classic-remix?cocktail=paloma');
});
test('missing ingredient followup keeps the current drink and searches contextual knowledge',async()=>{
    const first=await runCompanion(input('这杯材料不齐怎么办'),deps({intent:'operate'}).d);
    assert.equal(first.clarification,'这杯缺少哪一种材料？');
    let question='',context='';const d=deps({intent:'change',dialogueAct:'answer'}).d;
    d.search=async(q,c)=>{question=q;context=c;return answer;};
    const next=await runCompanion(input('橙味利口酒',{history:[{role:'user',content:'这杯材料不齐怎么办'},{role:'assistant',content:first.clarification}]}),d);
    assert.equal(next.clarification,'');assert.ok(question.includes('玛格丽特'));assert.ok(context.includes('橙味利口酒'));assert.equal(next.knowledge?.status,'answered');
});
test('missing ingredient outside current recipe asks about mismatch instead of inventing replacement',async()=>{
    const d=deps({intent:'change',dialogueAct:'answer'});
    const r=await runCompanion(input('橙味利口酒',{page:recipeContext('classic','highball'),history:[{role:'assistant',content:'这杯缺少哪一种材料？'}]}),d.d);
    assert.match(r.clarification,/没有列出/);assert.equal(d.count().searches,0);
});
test('lower alcohol intensity is recipe adjustment, not an operation menu',async()=>{
    const d=deps({intent:'operate',capability:'none'});
    const r=await runCompanion(input('我想降低酒感应该加点什么',{page:{kind:'lab',name:'便利店顺口特调',ingredients:[{name:'伏特加',amount:30},{name:'橙汁',amount:90}]}}),d.d);
    assert.equal(r.clarification,'');assert.equal(d.count().searches,1);
});
test('similar drink clarification retains reference recipe and returns at most three real alternatives',async()=>{
    const r=await runCompanion(input('找一杯类似的酒，我喜欢这个口味'),deps({intent:'recommend'}).d);
    assert.ok(r.pending?.similarTo);
    const next=await runCompanion(input('经典酒',{pending:r.pending}),deps({intent:'recommend'}).d);
    assert.ok(next.recipes.length>0&&next.recipes.length<=3);
    assert.ok(next.recipes.every(r=>r.id!=='margarita'&&actionHref(r.action)&&r.reason));
});


test('explicit available-material recipe request overrides flavor-exploration drift',async()=>{
  const r=await runCompanion(input('我有龙舌兰、橙味利口酒、青柠、橙汁，这些材料能做什么酒？'),deps({intent:'explore',materials:[]}).d);
  assert.equal(r.pending?.kind,'category');assert.ok(!r.actions.some(a=>a.action.kind==='prefill'));
});
test('duplicate Highball catalogue alias resolves one canonical recipe without category prompt',async()=>{
  const r=await runCompanion(input('打开威士忌嗨棒的酒单'),deps({intent:'named',recipeName:'威士忌嗨棒'}).d);
  assert.equal(r.clarification,'');assert.equal(r.actions.length,1);
  assert.equal(actionHref(r.actions[0].action),'/inspiration/classic-remix?cocktail=highball');
});

test('necessary actual-condition clarification survives taste keyword routing', async () => {
    const d = deps({ intent: 'change', question: '杯里现在有多少液体？' });
    const r = await runCompanion(input('太甜了，具体还能加多少苏打水才不溢出来？'), d.d);
    assert.equal(r.clarification, '杯里现在有多少液体？');
    assert.equal(r.status, 'needs_info');
    assert.equal(d.count().searches, 0);
    assert.equal(r.actions.length, 0);
});
test('knowledge clarification is shown instead of silently skipping search', async () => {
    const d = deps({ intent: 'knowledge', question: '你说的是哪一种材料？' });
    const r = await runCompanion(input('这个为什么会这样？'), d.d);
    assert.equal(r.clarification, '你说的是哪一种材料？');
    assert.equal(d.count().searches, 0);
});
test('new knowledge question does not answer an old missing-ingredient prompt', async () => {
    const d = deps({ intent: 'knowledge', dialogueAct: 'new_task', knowledgeQuestion: '养乐多和金酒为什么会分层？' });
    const r = await runCompanion(input('养乐多和金酒为什么会分层？', {
        history: [{ role: 'assistant', content: '这杯缺少哪一种材料？' }],
    }), d.d);
    assert.equal(r.clarification, '');
    assert.equal(r.knowledge?.status, 'answered');
    assert.equal(d.count().searches, 1);
});
test('known page and clear general adjustment proceed to search without quantities', async () => {
    for (const question of ['这杯怎么做？', '这杯太甜怎么办？', '没有青柠怎么办？']) {
        const d = deps({ intent: question.includes('怎么做') ? 'guide' : 'change', knowledgeQuestion: `玛格丽特：${question}` });
        const r = await runCompanion(input(question), d.d);
        assert.equal(r.clarification, '');
        assert.equal(d.count().searches, 1);
        assert.equal(r.knowledge?.status, 'answered');
    }
});
