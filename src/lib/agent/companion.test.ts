import test from 'node:test';
import assert from 'node:assert/strict';
import { companionInput, companionOutput, type Decision } from './companion-contract';
import { runCompanion, type CompanionDeps } from './companion';
import { recipeContext, matchWorkflow, nearbyWorkflow, namedRecipes, alternativesForMissing, actionHref, verifiedMaterials } from './workflow-catalog';
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
test('nearby recommendations show the missing ingredient without claiming the drink is ready', async () => {
    const materials = ['龙舌兰', '莱姆'];
    assert.equal(matchWorkflow(materials).some(r => r.recipe.id === 'margarita'), false);
    assert.ok(nearbyWorkflow(materials).some(r => r.recipe.id === 'margarita' && r.missing.some(name => name.includes('橙味利口酒'))));
    const r = await runCompanion(input('我有龙舌兰和莱姆，能做什么经典酒？'), deps({ materials, category: 'classic' }).d);
    const margarita = r.recipes.find(recipe => recipe.id === 'margarita');
    assert.ok(margarita);
    assert.ok(margarita.missing.length);
    assert.match(margarita.reason, /还缺/);
    assert.match(r.message, /没有材料齐全|还差一种材料/);
    assert.equal(actionHref(margarita.action), '/inspiration/classic-remix?cocktail=margarita');
});
test('nearby recommendations need two known ingredients and never accept unrelated materials', () => {
    assert.deepEqual(nearbyWorkflow(['砂纸']), []);
    assert.deepEqual(nearbyWorkflow(['龙舌兰']), []);
});
test('recipe names tolerate short variants and one typo, but do not turn unknown names into links', () => {
    assert.ok(namedRecipes('格丽特').some(r => r.id === 'margarita'));
    assert.ok(namedRecipes('玛格丽徳').some(r => r.id === 'margarita'));
    assert.deepEqual(namedRecipes('不存在'), []);
});
test('a misspelled named drink offers a confirmed catalogue route as a suggestion', async () => {
    const r = await runCompanion(input('打开玛格丽徳'), deps({ intent: 'named', recipeName: '玛格丽徳' }).d);
    assert.match(r.message, /可能想找/);
    assert.equal(actionHref(r.actions[0].action), '/inspiration/classic-remix?cocktail=margarita');
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
test('open missing-material request keeps the current drink as a search anchor', async () => {
    const d=deps({ intent: 'change' });
    const r = await runCompanion(input('这杯没有橙味利口酒'), d.d);
    assert.ok(r.recipes.length > 0);
    assert.ok(r.recipes.every(recipe => /龙舌兰|青柠/.test(recipe.reason) && recipe.reason.includes('不需要橙味利口酒') && actionHref(recipe.action)));
    assert.equal(r.pending?.kind, 'alternative');
    assert.deepEqual(r.actions[0].action, { kind: 'locate', target: 'substitute' });
    assert.equal(d.count().models,0);
});
test('open missing drink request offers real alternatives before asking for stock',async()=>{
    const d=deps({intent:'knowledge'});
    d.d.search=async()=>({status:'insufficient_evidence',claims:[],citations:[]});
    const r=await runCompanion(input('我没有西柚了可以换什么饮料啊',{page:recipeContext('convenience','grapefruit-beer')}),d.d);
    assert.equal(d.count().models,0);assert.equal(d.count().searches,0);
    assert.equal(r.status,'answered');assert.equal(r.clarification,'');assert.ok(r.recipes.length>0);assert.equal(r.pending?.kind,'alternative');
});
test('a missing coconut milk also excludes recipes requiring coconut milk drink', () => {
    const choices = alternativesForMissing(recipeContext('convenience', 'coconut-rum'), '椰奶');
    assert.ok(choices.length > 0);
    assert.ok(choices.every(item => item.recipe.ingredients.every(name => !name.includes('椰奶'))));
});
test('a named replacement question searches immediately without asking for all available stock', async () => {
    const d = deps({ intent: 'unclear' });
    let query = '';
    d.d.search = async q => { query = q; return answer; };
    const r = await runCompanion(input('我没有椰奶了，椰汁可以吗', { page: recipeContext('convenience', 'coconut-rum') }), d.d);
    assert.equal(d.count().models, 0);
    assert.equal(r.clarification, '');
    assert.equal(r.knowledge?.status, 'answered');
    assert.match(query, /椰奶/);
    assert.match(query, /椰汁/);
    assert.match(query, /没有确认具体产品或库存/);
    assert.ok(r.actions.some(item => item.action.kind === 'prefill' && item.action.materials.some(m => m.name === '椰汁') && item.action.materials.every(m => !m.name.includes('椰奶'))));
});
test('a short unlisted material continues the previous stock question', async () => {
    const page = recipeContext('convenience', 'coconut-rum');
    const d = deps({ intent: 'unclear' });
    let query = '';
    d.d.search = async q => { query = q; return answer; };
    const r = await runCompanion(input('椰汁', { page, pending: { kind: 'substitution', stage: 'available', question: '我没有椰奶了，怎么办', missingMaterial: '椰奶', materials: [], materialsKnown: false } }), d.d);
    assert.equal(d.count().models, 0);
    assert.equal(r.clarification, '');
    assert.match(query, /椰奶/);
    assert.match(query, /椰汁/);
});
test('the screenshot followup keeps its earlier proposed replacement', async () => {
    const page = recipeContext('convenience', 'coconut-rum');
    const d = deps({ intent: 'unclear' });
    let query = '';
    d.d.search = async q => { query = q; return answer; };
    const r = await runCompanion(input('椰汁', { page, pending: { kind: 'substitution', stage: 'available', question: '我没有椰奶了，椰汁可以吗', missingMaterial: '椰奶', materials: [], materialsKnown: false } }), d.d);
    assert.equal(r.clarification, '');
    assert.match(query, /椰奶/);
    assert.match(query, /椰汁/);
    assert.match(query, /没有确认具体产品或库存/);
});
test('missing mixer offers other real drinks, then accepts a new material for the lab', async () => {
    const page = recipeContext('convenience', 'cv-whisky-yakult');
    const firstDeps = deps({ intent: 'change' });
    const first = await runCompanion(input('养乐多喝完了可以换什么配威士忌', { page }), firstDeps.d);
    assert.equal(firstDeps.count().models, 0);
    assert.equal(firstDeps.count().searches, 0);
    assert.ok(first.recipes.length > 0);
    assert.equal(first.clarification, '');
    assert.equal(first.pending?.kind, 'alternative');

    const secondDeps = deps({ intent: 'change' });
    const second = await runCompanion(input('可乐', { page, history: [
        { role: 'user', content: '养乐多喝完了可以换什么配威士忌' },
        { role: 'assistant', content: first.message },
    ], pending: first.pending }), secondDeps.d);
    assert.equal(second.recipes.length, 0);
    assert.ok(second.actions.some(item => item.action.kind === 'prefill' && item.action.materials.some(m => m.name === '威士忌') && item.action.materials.some(m => m.name === '可乐')));
    assert.equal(secondDeps.count().searches, 0);
});
test('mixer followup uses an existing orange juice recipe and does not invent coconut equivalence', async () => {
    const page = recipeContext('convenience', 'cv-whisky-yakult');
    const d = deps({ intent: 'change', dialogueAct: 'answer' });
    const result = await runCompanion(input('橙汁 椰汁', { page, history: [
        { role: 'user', content: '养乐多喝完了可以换什么配威士忌' },
        { role: 'assistant', content: '酒库里有这些威士忌搭配。你手边有哪些饮料？' },
    ] }), d.d);
    assert.equal(d.count().models, 0);
    assert.equal(d.count().searches, 0);
    assert.ok(result.recipes.some(recipe => recipe.id === 'cv-whisky-orange-juice'));
    assert.ok(result.recipes.every(recipe => recipe.id !== 'cv-whisky-coconut-water'));
});
test('unlisted mixer followup searches for sourced advice', async () => {
    const page = recipeContext('convenience', 'cv-whisky-yakult');
    const d = deps({ intent: 'change', dialogueAct: 'answer' });
    const result = await runCompanion(input('仙草汁', { page, history: [
        { role: 'user', content: '养乐多喝完了可以换什么配威士忌' },
        { role: 'assistant', content: '酒库里有这些威士忌搭配。你手边有哪些饮料？' },
    ] }), d.d);
    assert.equal(d.count().searches, 1);
    assert.equal(result.recipes.length, 0);
    assert.equal(result.knowledge?.citations[0].sources[0].url, 'https://example.com/evidence');
});
test('dietary questions use sourced seed knowledge and ask only for the unknown product label', async () => {
    const page = recipeContext('convenience', 'coconut-rum');
    const d = deps({ intent: 'unclear', question: '你在做哪杯酒？' });
    const lactose = await runCompanion(input('我对乳糖不耐受，我可以喝吗', { page }), d.d);
    assert.match(lactose.message, /椰奶饮料/);
    assert.match(lactose.knowledge?.claims[0].text ?? '', /配料/);
    assert.match(lactose.clarification, /产品的配料表/);
    assert.equal(lactose.knowledge?.citations[0].sources[0].url, 'https://www.niddk.nih.gov/health-information/digestive-diseases/lactose-intolerance/eating-diet-nutrition');
    const allergy = await runCompanion(input('我牛奶过敏，这杯能喝吗', { page }), d.d);
    assert.match(allergy.knowledge?.claims[0].text ?? '', /牛奶蛋白/);
    const pregnancy = await runCompanion(input('怀孕了这杯可以喝吗', { page }), d.d);
    assert.match(pregnancy.knowledge?.claims[0].text ?? '', /没有已知安全的饮酒量/);
    assert.equal(d.count().models, 0);
    assert.equal(d.count().searches, 0);
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
    assert.equal(r.message, '');
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
test('missing ingredient followup offers other drinks after the missing material is named',async()=>{
    const first=await runCompanion(input('这杯材料不齐怎么办'),deps({intent:'operate'}).d);
    assert.equal(first.clarification,'这杯缺少哪一种材料？');
    let searches=0;const d=deps({intent:'change',dialogueAct:'answer'}).d;
    d.search=async()=>{searches++;return answer;};
    const next=await runCompanion(input('橙味利口酒',{history:[{role:'user',content:'这杯材料不齐怎么办'},{role:'assistant',content:first.clarification}]}),d);
    assert.equal(next.clarification,'');assert.ok(next.recipes.length);assert.equal(searches,0);
    assert.equal(next.pending?.kind,'alternative');
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
    assert.ok(r.actions.some(item => item.action.kind === 'prefill' && item.action.materials.length === 2 && item.action.materials.every(material => material.amount === undefined)));
});
test('similar drink clarification retains reference recipe and returns at most three real alternatives',async()=>{
    const r=await runCompanion(input('找一杯类似的酒，我喜欢这个口味'),deps({intent:'recommend'}).d);
    assert.ok(r.pending?.kind === 'category' && r.pending.similarTo);
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

test('precise taste adjustment first gathers actual facts instead of using recipe values', async () => {
    const d = deps({ intent: 'change', question: '杯里现在有多少液体？' });
    const r = await runCompanion(input('太甜了，具体还能加多少苏打水才不溢出来？'), d.d);
    assert.equal(r.clarification, '杯里现在有多少液体？');
    assert.equal(r.pending?.kind, 'rescue');
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
test('known page preparation guide searches without unnecessary quantities', async () => {
    const d = deps({ intent: 'guide', knowledgeQuestion: '玛格丽特怎么做？' });
    const r = await runCompanion(input('这杯怎么做？'), d.d);
    assert.equal(r.clarification, '');
    assert.equal(d.count().searches, 1);
    assert.equal(r.knowledge?.status, 'answered');
});

test('explicit missing ingredient and stock skip both questions, retaining the shortcut and sources', async () => {
    const d = deps({ intent: 'change' });
    let query = '';
    d.d.search = async q => { query = q; return answer; };
    const r = await runCompanion(input('没有青柠，我有柠檬，可以怎么替代？'), d.d);
    assert.equal(r.clarification, '');
    assert.match(query, /缺少青柠/);
    assert.match(query, /手边有柠檬/);
    assert.equal(r.knowledge?.citations[0].sources[0].url, 'https://example.com/evidence');
    assert.ok(r.actions.some(a => a.action.kind === 'locate' && a.action.target === 'substitute'));
});

test('no catalogue or web alternatives offers the finder instead of asking for stock', async () => {
    const page = { kind: 'lab' as const, name: '酒精实验室', ingredients: [{ name: '青柠' }] };
    const d = deps({ intent: 'change' });
    d.d.search = async () => ({ status: 'no_evidence', claims: [], citations: [] });
    const r = await runCompanion(input('没有青柠怎么办？', { page }), d.d);
    assert.equal(r.clarification, '');
    assert.ok(r.actions.some(item => item.action.kind === 'navigate' && item.action.target === 'finder'));
    assert.match(r.message, /选酒页/);
});

test('actual problem asks materials then steps and searches the complete problem', async () => {
    const d = deps({ intent: 'troubleshoot', dialogueAct: 'answer' });
    const first = await runCompanion(input('这杯已经分层了怎么办？'), d.d);
    assert.equal(first.clarification, '这杯实际用了哪些材料？');
    const second = await runCompanion(input('金酒和养乐多', { pending: first.pending }), d.d);
    assert.equal(second.clarification, '你刚才是怎么调这杯的？');
    assert.equal(d.count().searches, 0);
    let query = '', context = '';
    d.d.search = async (q, c) => { query = q; context = c; return answer; };
    const last = await runCompanion(input('一起倒进杯里，搅拌了几下', { pending: second.pending }), d.d);
    assert.equal(last.clarification, '');
    assert.match(query, /分层/); assert.match(query, /金酒和养乐多/); assert.match(query, /搅拌/);
    assert.match(context, /actualMaterials/);
    assert.equal(last.knowledge?.status, 'answered');
    for (const r of [first, second, last]) assert.equal(companionOutput.safeParse(r).success, true);
});

test('actual materials and steps supplied in the initial message skip both questions', async () => {
    const d = deps({ intent: 'troubleshoot' });
    const r = await runCompanion(input('我用了金酒和养乐多，摇了十秒，已经分层了怎么办？'), d.d);
    assert.equal(r.clarification, '');
    assert.equal(d.count().searches, 1);
    assert.equal(r.knowledge?.status, 'answered');
});

test('pouring named ingredients is actual material evidence even without the word used', async () => {
    const d = deps({ intent: 'troubleshoot', question: '你用了多少金酒和养乐多？有没有加冰块？' });
    const r = await runCompanion(input('这杯分层了。我把金酒和养乐多一起倒进杯子，搅了几下'), d.d);
    assert.equal(r.clarification, ''); assert.equal(d.count().searches, 1);
});

test('clear technique questions do not ask the user to restate the cocktail domain', async () => {
    const d = deps({ intent: 'knowledge', question: '你是指鸡尾酒制作中的过滤，还是其他方面的过滤？' });
    const r = await runCompanion(input('能不能解释一下过滤的作用'), d.d);
    assert.equal(r.clarification, ''); assert.equal(d.count().searches, 1);
});

test('missing equipment is classified as preparation instead of a missing recipe ingredient', async () => {
    const d = deps({ intent: 'guide', knowledgeQuestion: '没有量酒器怎么保持比例？' });
    const r = await runCompanion(input('没有量酒器怎么保持比例？'), d.d);
    assert.equal(d.count().models, 1); assert.equal(d.count().searches, 1);
    assert.equal(r.clarification, '');
});

test('new task abandons pending stock and cancellation clears pending actual facts', async () => {
    const first = await runCompanion(input('没有青柠怎么办？'), deps({ intent: 'change' }).d);
    const next = await runCompanion(input('橙汁和伏特加配起来是什么味道？', { pending: first.pending }), deps({ intent: 'explore', materials: ['橙汁', '伏特加'] }).d);
    assert.equal(next.pending, null);
    assert.equal(next.actions[0].action.kind, 'prefill');
    const trouble = await runCompanion(input('这杯太甜了'), deps({ intent: 'troubleshoot' }).d);
    const cancelled = await runCompanion(input('算了', { pending: trouble.pending }), deps({}).d);
    assert.equal(cancelled.status, 'cancelled'); assert.equal(cancelled.pending, null);
});

test('stock supplied before naming the missing ingredient is retained', async () => {
    const d = deps({ intent: 'change' });
    const first = await runCompanion(input('这杯材料不齐，我有柠檬和橙汁'), d.d);
    assert.equal(first.clarification, '这杯缺少哪一种材料？');
    const next = await runCompanion(input('青柠', { pending: first.pending }), d.d);
    assert.equal(next.clarification, ''); assert.equal(d.count().searches, 1);
});

test('correction replaces the missing ingredient before searching', async () => {
    const first = await runCompanion(input('没有青柠怎么办？'), deps({ intent: 'change' }).d);
    const d = deps({ intent: 'change', dialogueAct: 'correction', materials: ['橙汁'], facts: { missingMaterial: '君度', availableMaterialsKnown: true, actualMaterials: '', actualSteps: '' } });
    let query = '';
    d.d.search = async q => { query = q; return answer; };
    const next = await runCompanion(input('说错了，是君度没有，我有橙汁', { pending: first.pending }), d.d);
    assert.equal(next.clarification, '');
    assert.match(query, /缺少君度/);
    assert.equal(next.knowledge?.status, 'answered');
});

test('a short unrelated request is classified instead of being treated as stock', async () => {
    const first = await runCompanion(input('没有青柠怎么办？'), deps({ intent: 'change' }).d);
    const d = deps({ intent: 'out_of_scope', dialogueAct: 'new_task' });
    const next = await runCompanion(input('讲个笑话', { pending: first.pending }), d.d);
    assert.equal(d.count().models, 1); assert.equal(d.count().searches, 0);
    assert.equal(next.status, 'out_of_scope'); assert.equal(next.pending, null);
});

test('failed named substitution search keeps the lab action and supports retry', async () => {
    const question = '没有青柠，柠檬可以吗？';
    const failed = await runCompanion(input(question), deps({ intent: 'change' }, true).d);
    assert.equal(failed.status, 'unavailable');
    assert.ok(failed.actions.some(item => item.action.kind === 'prefill'));
    const next = await runCompanion(input(question), deps({ intent: 'change' }).d);
    assert.equal(next.clarification, ''); assert.equal(next.knowledge?.status, 'answered');
});
