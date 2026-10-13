import { parseActualQuantities } from './adjustment';
import test from 'node:test';
import assert from 'node:assert/strict';
import { companionInput, companionOutput, type CompanionInput, type Decision } from './companion-contract';
import { runCompanion, type CompanionDeps } from './companion';
import { recipeContext } from './workflow-catalog';
import { alternativeAnswer, resolveConsultation, consultationDecision, proposedReplacement } from './consultation';
import { recipeScope } from './recipe-requirements';
import { resolveBeforeL3 } from './intent-funnel';
import { convenienceExploreCocktails, getConvenienceRecipeGuide } from '../data/explore-catalog';
import { JUICE_INGREDIENTS } from '../data/juice-ingredients';
import { CONVENIENCE_DRINK_INGREDIENTS } from '../data/convenience-drink-ingredients';
import { findReferenceIngredient } from '../mixology/material-identity';
import { buildReferenceExperiment, type ReferenceIngredient } from '../mixology/reference-experiment';
import { analyzeMixologyRecipe } from '../mixology/engine';

const beerPage = recipeContext('convenience', 'cv-beer-lemon-tea');
const decision: Decision = { intent: 'change', dialogueAct: 'new_task', materials: [], recipeName: '', category: 'any', capability: 'none', question: '', knowledgeQuestion: '' };
const input = (question: string, extra: Partial<CompanionInput> = {}) => companionInput.parse({
    version: 2, taskId: crypto.randomUUID(), contextVersion: 0, question, page: beerPage, pending: null, history: [], ...extra,
});

test('reported shaking time does not replace ingredient-specific troubleshooting with milk advice', async () => {
    const f = fixture();
    const result = await runCompanion(input('我用了金酒和蜂蜜，摇了10秒还是混不开，怎么办？'), f.deps);
    assert.equal(result.clarification, '');
    assert.equal(f.queries.length, 1);
    assert.match(f.queries[0].question, /蜂蜜/);
    assert.match(f.queries[0].question, /摇了10秒/);
    assert.ok(!result.knowledge?.citations.some(c => c.id === 'shake-time-and-separation'));
});
function fixture() {
    const queries: { question: string; context: string }[] = [];
    const deps: CompanionDeps = {
        model: async () => { throw Error('This scenario must resolve without L3'); },
        search: async (question, context) => { queries.push({ question, context }); return { status: 'no_evidence', claims: [], citations: [] }; },
    };
    return { deps, queries };
}

test('all convenience requirements use the displayed guide, preserving optional and non-volume entries', () => {
    for (const recipe of convenienceExploreCocktails) {
        const page = recipeContext('convenience', recipe.id);
        assert.deepEqual(page.requirements?.map(i => i.display), getConvenienceRecipeGuide(recipe).ingredientLines);
        assert.ok(companionInput.shape.page.safeParse(page).success, recipe.id);
    }
    assert.deepEqual(beerPage.ingredients, [{ name: '啤酒', amount: 180 }, { name: '柠檬茶', amount: 150 }]);
    const ice = beerPage.requirements?.find(i => i.name === '冰块');
    assert.equal(ice?.auxiliary, true);
    assert.equal(ice?.amount, undefined);
    assert.ok(beerPage.requirements?.some(i => i.optional));
});

test('no ice is a stateful preparation question, not missing recipe data or a switch to another drink', async () => {
    for (const question of ['我没有冰块了 口感会有影响吗', '没有冰块怎么办']) {
        const f = fixture();
        const r = await runCompanion(input(question), f.deps);
        assert.equal(r.clarification, '');
        assert.equal(r.recipes.length, 0);
        assert.equal(r.pending?.kind, 'substitution');
        assert.equal(f.queries.length, 1);
        assert.match(f.queries[0].question, /冰块 Ice 适量/);
        assert.match(f.queries[0].question, /口感和制作的影响/);
        assert.equal(r.trace.find(t => t.tool === 'route_layer')?.status, 'L2:start_consultation');
        assert.ok(companionOutput.safeParse(r).success);
    }
});

test('a disputed requirement survives, is rechecked after correction, and keeps the original missing item', async () => {
    const incomplete = { ...beerPage, requirements: undefined };
    const first = resolveConsultation(input('没有冰块怎么办', { page: incomplete }), decision, incomplete)!;
    assert.equal(first.pending?.kind, 'substitution');
    assert.ok(first.pending?.kind === 'substitution' && first.pending.stage === 'verify_recipe');
    assert.ok(companionInput.shape.pending.safeParse(first.pending).success);
    const f = fixture();
    const corrected = await runCompanion(input('有说冰块适量啊', { pending: first.pending }), f.deps);
    assert.equal(corrected.clarification, '');
    assert.match(corrected.message, /确实列有.*冰块 Ice 适量/);
    assert.equal(corrected.pending?.kind, 'substitution');
    assert.ok(corrected.pending?.kind === 'substitution' && corrected.pending.reportedRequirement === '有说冰块适量啊');
    const last = await runCompanion(input('冰块 Ice 适量', { pending: corrected.pending }), f.deps);
    assert.equal(last.clarification, '');
    assert.match(f.queries.at(-1)!.question, /没有冰块怎么办/);
    assert.ok(companionOutput.safeParse(last).success);
});

test('legacy mismatch history can be corrected without persisted pending data', async () => {
    const f = fixture();
    const r = await runCompanion(input('有说冰块适量啊', { history: [
        { role: 'user', content: '没有冰块怎么办' },
        { role: 'assistant', content: '当前啤酒柠檬茶的配方里没有列出“冰块”。你是在调整这杯，还是指另一份配方？' },
    ] }), f.deps);
    assert.equal(r.clarification, '');
    assert.match(r.message, /确实列有/);
});

test('unverified corrections remain user reports, not authoritative recipe facts', () => {
    const first = resolveConsultation(input('没有咖啡怎么办'), decision, beerPage)!;
    const nextInput = input('有说咖啡适量啊', { pending: first.pending });
    const next = resolveConsultation(nextInput, consultationDecision(nextInput)!, beerPage)!;
    assert.match(next.clarification, /重新核对.*仍未找到/);
    assert.notEqual(next.clarification, first.clarification);
    assert.ok(next.pending?.kind === 'substitution' && next.pending.reportedRequirement === '有说咖啡适量啊');
    assert.equal(next.proposedReplacement, undefined);
});

test('recipe disputes do not carry into a different recipe and new tasks still route normally', async () => {
    const pending = resolveConsultation(input('没有咖啡怎么办'), decision, beerPage)!.pending;
    const other = input('有说咖啡适量啊', { pending, page: recipeContext('classic', 'margarita') });
    assert.equal(consultationDecision(other), null);
    assert.equal(resolveBeforeL3(input('为什么要过滤', { pending })), null);
    assert.equal(pending?.kind === 'substitution' && pending.recipeKey, recipeScope(beerPage));
    const cancelled = await runCompanion(input('取消', { pending }), fixture().deps);
    assert.equal(cancelled.pending, null);
});

test('replacement noun extraction handles a question but refuses negation and mixed alternatives', () => {
    assert.deepEqual(alternativeAnswer('换柠檬汁是什么口感'), ['柠檬汁']);
    assert.equal(proposedReplacement('把柠檬茶换成柠檬汁是什么味道？'), '柠檬汁');
    assert.equal(proposedReplacement('换成柠檬汁'), '柠檬汁');
    assert.equal(proposedReplacement('换成伏特加'), '伏特加');
    for (const q of ['不要换柠檬汁', '换成柠檬汁还是橙汁', '换成柠檬汁，另外再加糖', '换一杯玛格丽特', '换个别的酒']) assert.equal(proposedReplacement(q), '');
    assert.deepEqual(alternativeAnswer('柠檬汁是什么口感'), []);
    assert.deepEqual(alternativeAnswer('柠檬汁很酸'), []);
});

test('a replacement with an ambiguous target keeps its new material while asking one question', async () => {
    const page = recipeContext('convenience', 'cv-beer-lemon-tea');
    const lab = { ...page, kind: 'lab' as const, recipeId: undefined, ingredients: [...page.ingredients, { name: '橙汁', amount: 30 }], requirements: undefined };
    const f = fixture();
    const first = await runCompanion(input('换成柠檬汁', { page: lab }), f.deps);
    assert.equal(first.clarification, '你想用柠檬汁替换哪一种材料？');
    const next = await runCompanion(input('柠檬茶', { page: lab, pending: first.pending }), f.deps);
    const action = next.actions.find(a => a.action.kind === 'prefill')?.action;
    assert.ok(action?.kind === 'prefill');
    assert.deepEqual(action.materials.map(i => i.name), ['啤酒', '橙汁', '柠檬汁']);
});

test('correction changes the disputed item rather than persisting the stale missing material', () => {
    const first = resolveConsultation(input('没有咖啡怎么办'), decision, beerPage)!;
    const corrected = input('不是咖啡，是冰块', { pending: first.pending });
    const d = consultationDecision(corrected)!;
    assert.equal(d.dialogueAct, 'correction');
    const next = resolveConsultation(corrected, d, beerPage)!;
    assert.equal(next.missingMaterial, '冰块');
    assert.equal(next.clarification, '');
    assert.doesNotMatch(next.question, /咖啡/);
});

test('alternative followup and direct replacement both transfer only the new material and retained beer', async () => {
    const pending: CompanionInput['pending'] = { kind: 'alternative', anchor: '啤酒', missingMaterial: '柠檬茶' };
    for (const state of [pending, null]) {
        const f = fixture();
        const r = await runCompanion(input('换柠檬汁是什么口感', { pending: state }), f.deps);
        assert.equal(r.clarification, '');
        const action = r.actions.find(a => a.action.kind === 'prefill')?.action;
        assert.ok(action?.kind === 'prefill');
        assert.deepEqual(action.materials, [{ name: '啤酒', amount: 180 }, { name: '柠檬汁' }]);
        assert.ok(companionOutput.safeParse(r).success);
    }
});

test('explicit replacement retains other materials and never interprets old tea as an added material', async () => {
    const r = await runCompanion(input('把柠檬茶换成柠檬汁是什么味道？'), fixture().deps);
    const action = r.actions.find(a => a.action.kind === 'prefill')?.action;
    assert.ok(action?.kind === 'prefill');
    assert.deepEqual(action.materials.map(i => i.name), ['啤酒', '柠檬汁']);
});

test('juice is distinct from tea even when both share a fruit name', async () => {
    const missing = resolveConsultation(input('没有柠檬汁怎么办'), decision, beerPage)!;
    assert.match(missing.clarification, /没有列出/);
    const lab = { kind: 'lab' as const, name: '自定义调配', ingredients: [{ name: '啤酒', amount: 180 }, { name: '柠檬茶', amount: 50 }, { name: '柠檬汁', amount: 10 }] };
    const r = await runCompanion(input('把柠檬汁换成橙汁', { page: lab }), fixture().deps);
    const action = r.actions.find(a => a.action.kind === 'prefill')?.action;
    assert.ok(action?.kind === 'prefill');
    assert.deepEqual(action.materials.map(i => i.name), ['啤酒', '柠檬茶', '橙汁']);
    const absent = await runCompanion(input('把咖啡换成柠檬汁'), fixture().deps);
    assert.match(absent.clarification, /咖啡/);
    assert.ok(!absent.actions.some(a => a.action.kind === 'prefill'));
});

// Use real ingredient seed identities, including drinks containing juice but not themselves juice.
const juice = JUICE_INGREDIENTS.find(i => i.id === 'juice-lemon')!;
const lemon: ReferenceIngredient & { juiceData: typeof juice } = {
    id: juice.id, name: `${juice.nameZh} ${juice.nameEn}`, category: juice.category, color: '', amount: 0,
    recommendedAmount: juice.recommendedVolumeMl[1], acidity: juice.acidity, sweetness: juice.sweetness,
    sugarGPer100ml: juice.sugarGPer100ml, flavorTags: juice.flavorTags, mainComponents: juice.ingredients,
    tea: 0, abv: 0, juiceData: juice,
};
const beer: ReferenceIngredient = { id: 'beer', name: '啤酒', category: '酒', color: '', amount: 0, recommendedAmount: 120, abv: 5, carbonation: 4, mainComponents: ['麦芽', '啤酒花'] };
const otherDrinks = CONVENIENCE_DRINK_INGREDIENTS.map(i => ({
    id: i.slug, name: `${i.nameZh} ${i.nameEn}`, category: i.category, color: '', amount: 0,
    recommendedAmount: i.recommendedVolumeMl[1], convenienceData: i, mainComponents: i.ingredients,
}));
const library = [beer, lemon, ...otherDrinks];

test('exact ingredient identity uses pure lemon juice volume and never tea attributes', () => {
    const resolved = findReferenceIngredient('柠檬汁', library);
    assert.equal(resolved?.id, 'juice-lemon');
    assert.equal(findReferenceIngredient('鲜榨柠檬汁', library)?.id, 'juice-lemon');
    assert.equal(findReferenceIngredient('换柠檬汁是什么口感', library), undefined);
    assert.equal(findReferenceIngredient('不知名柠檬汁饮料', library), undefined);
    const reference = buildReferenceExperiment([{ name: '啤酒', amount: 180 }, { name: '柠檬汁' }], name => findReferenceIngredient(name, library));
    assert.deepEqual(reference.unresolved, []);
    assert.deepEqual(reference.ingredients.map(i => [i.name, i.amount]), [['啤酒', 180], ['柠檬汁', 15]]);
    const analysis = analyzeMixologyRecipe(reference.ingredients, 'Stir');
    assert.equal(analysis.metrics.totalVolumeMl, 195);
    assert.doesNotMatch(analysis.chineseName, /茶/);
    assert.ok(reference.ingredients.every(i => !i.tea && !i.mainComponents?.some(c => /茶/.test(c))));
});

test('ambiguous aliases and malformed transferred material names never generate an automatic recipe', () => {
    assert.equal(findReferenceIngredient('果汁', [{ name: 'A', aliases: ['果汁'] }, { name: 'B', aliases: ['果汁'] }]), undefined);
    let calls = 0;
    const r = buildReferenceExperiment([{ name: '换柠檬汁是什么口感' }], () => { calls++; return lemon; });
    assert.equal(calls, 0);
    assert.equal(r.ingredients.length, 0);
    assert.equal(r.unresolved.length, 1);
    const explicit = buildReferenceExperiment([{ name: '柠檬汁', amount: 20 }], () => lemon);
    assert.equal(explicit.ingredients[0].amount, 20);
});

test('a partial ingredient mention in the steps reply retains the complete actual inventory', async () => {
    const f = fixture();
    const r = await runCompanion(input('先把牛奶和柠檬汁混合，再倒入金酒搅拌', { pending: {
        kind: 'troubleshoot', stage: 'steps', question: '这杯分层了怎么办？', actualMaterials: '金酒、牛奶、柠檬汁', actualSteps: '',
    } }), f.deps);
    assert.equal(r.clarification, '');
    const context = JSON.parse(f.queries[0].context);
    assert.equal(context.consultation.actualMaterials, '金酒、牛奶、柠檬汁');
    assert.match(f.queries[0].question, /分层/);
    assert.doesNotMatch(f.queries[0].question, /啤酒柠檬茶/);
    assert.equal(r.message, '现有资料里暂时没有找到这个问题的相关依据。');
    assert.doesNotMatch(r.message, /补充|再.*提供/);
});

test('a standalone knowledge question cannot be expanded into unrequested numeric questions', async () => {
    let query = '';
    await runCompanion(input('喝起来像果汁能说明酒精含量低吗？'), {
        model: async () => ({ value: { ...decision, intent: 'knowledge', knowledgeQuestion: '玛格丽特实际酒精含量是多少？' }, model: 'fixture', usage: null }),
        search: async q => { query = q; return { status: 'no_evidence', claims: [], citations: [] }; },
    });
    assert.equal(query, '喝起来像果汁能说明酒精含量低吗？');
});


test('L3 clarification creates pending state and a bare reply reaches the tool with original task', async () => {
    const first = await runCompanion(input('这杯口感不对'), {
        model: async () => ({value:{...decision,intent:'knowledge',question:'你刚才是怎么操作的？'},model:'fixture',usage:null}),
        search: async () => { throw Error('Should ask first'); },
    });
    assert.equal(first.status, 'needs_info');
    assert.equal(first.pending?.kind, 'clarification');
    assert.ok(first.pending?.kind === 'clarification' && first.pending.awaitingField === 'actualSteps');
    const f = fixture();
    const next = await runCompanion(input('搅拌', {pending:first.pending}), f.deps);
    assert.equal(next.trace[0].status, 'L2:clarification_answer');
    assert.match(f.queries[0].question, /这杯口感不对/);
    assert.match(f.queries[0].question, /搅拌/);
    assert.equal(next.pending, null);
});

test('short troubleshooting answer resumes original issue and inventory without L3', async () => {
    const f = fixture();
    const first = await runCompanion(input('这杯分层了怎么办'), f.deps);
    const second = await runCompanion(input('烧酒、苏打水和青柠汁', {pending:first.pending}), f.deps);
    assert.ok(second.pending?.kind === 'troubleshoot' && second.pending.stage === 'steps');
    await runCompanion(input('搅拌', {pending:second.pending}), f.deps);
    assert.match(f.queries[0].question,/分层/);
    assert.match(f.queries[0].question,/苏打水/);
    assert.match(f.queries[0].question,/搅拌/);
});

test('generic pending never consumes cancellation, navigation, new knowledge questions or another recipe', () => {
    const pending:CompanionInput['pending']={kind:'clarification',intent:'knowledge',question:'原始问题',clarification:'怎么操作的？',awaitingField:'actualSteps',slots:{},recipeKey:`${beerPage.kind}:${beerPage.recipeId}`};
    assert.equal(resolveBeforeL3(input('取消',{pending}))?.decision.dialogueAct,'cancel');
    assert.equal(resolveBeforeL3(input('打开收藏',{pending}))?.decision.intent,'operate');
    assert.equal(resolveBeforeL3(input('为什么要过滤',{pending})),null);
    assert.equal(resolveBeforeL3(input('搅拌',{pending,page:recipeContext('classic','margarita')})),null);
});


test('actual quantity parsing preserves material names on either side of volume',()=>{
 for(const text of ['我加了烧酒60ml','我加了60ml烧酒','加了60毫升的烧酒','我倒了烧酒60毫升'])
  assert.deepEqual(parseActualQuantities(text),[{name:'烧酒',amount:60}],text);
 assert.deepEqual(parseActualQuantities('我加了60ml烧酒，苏打水120ml'),[{name:'烧酒',amount:60},{name:'苏打水',amount:120}]);
 for(const text of ['我加了60ml','60ml','我用了60毫升','总共160ml'])assert.deepEqual(parseActualQuantities(text),[],text);
});

test('unknown steps preserve known materials across common L2 state',async()=>{
 const f=fixture();const a=await runCompanion(input('这杯分层了'),f.deps);
 const b=await runCompanion(input('烧酒、苏打水',{pending:a.pending}),f.deps);
 const c=await runCompanion(input('不记得了',{pending:b.pending}),f.deps);
 assert.equal(c.pending?.taskState?.facts.actualMaterials.value,'烧酒、苏打水');
 assert.equal(c.pending?.taskState?.facts.actualSteps.certainty,'unknown');
 assert.equal(f.queries.length,0);
});



function rescueFixture(questions: string[]) {
 const states: CompanionInput[] = [], searches: {question:string;context:string}[] = [];
 const deps: CompanionDeps = {
  model:async state=>{states.push(state as CompanionInput);return {value:{...decision,intent:'troubleshoot',dialogueAct:states.length===1?'new_task':'answer',question:questions.shift()||'',knowledgeQuestion:'补救建议'},model:'fixture',usage:null};},
  search:async(question,context)=>{searches.push({question,context});return {status:'no_evidence',claims:[],citations:[]};}
 };
 return {states,searches,deps};
}
test('rescue planner chooses the question and receives numeric answers with the original subject',async()=>{
 const f=rescueFixture(['烧酒总共倒了多少毫升？']);
 const a=await runCompanion(input('我的烧酒倒多了怎么办'),f.deps);
 assert.equal(a.clarification,'烧酒总共倒了多少毫升？');assert.equal(a.pending?.kind,'rescue');
 const b=await runCompanion(input('60毫升',{pending:a.pending}),f.deps);
 assert.equal(f.states.length,2);assert.equal(f.searches.length,1);
 assert.match(f.searches[0].context,/烧酒总共倒了多少毫升/);assert.match(f.searches[0].context,/60毫升/);
 assert.equal(b.actions.length,0);assert.ok(companionOutput.safeParse(b).success);
});
test('rescue keeps estimates and corrections and lets unknown answers reach search',async()=>{
 const f=rescueFixture(['已经混合了吗？','总共倒了多少？','其他材料用了多少？']);
 let pending:CompanionInput['pending']=null;
 for(const q of ['糖浆加多了怎么办','不是糖浆，是烧酒，已经混好了','大概60毫升','不记得了']) {
  const r=await runCompanion(input(q,{pending}),f.deps);pending=r.pending;
 }
 assert.equal(f.states.length,4);assert.equal(f.searches.length,1);
 for(const text of ['糖浆','不是糖浆，是烧酒','大概60毫升','不记得了'])assert.ok(f.searches[0].context.includes(text));
});
test('complete rescue facts can search immediately without mandatory forms or lab handoff',async()=>{
 const f=rescueFixture([]);
 const r=await runCompanion(input('烧酒倒多了，已经和苏打水混好了，烧酒总共60毫升'),f.deps);
 assert.equal(f.states.length,1);assert.equal(f.searches.length,1);assert.equal(r.clarification,'');assert.equal(r.actions.length,0);
});
test('old adjustment sessions migrate and cancellation or another recipe drops rescue context',async()=>{
 const f=rescueFixture(['已经混合了吗？']);
 const a=await runCompanion(input('不记得了',{pending:{kind:'adjustment',question:'烧酒倒多了',additive:'水'}}),f.deps);
 assert.equal(f.states.length,1);assert.equal(a.pending?.kind,'rescue');
 const cancelled=await runCompanion(input('取消',{pending:a.pending}),f.deps);
 assert.equal(cancelled.status,'cancelled');assert.equal(cancelled.pending,null);
 await runCompanion(input('为什么要过滤',{pending:a.pending,page:recipeContext('classic','margarita')}),f.deps);
 assert.equal(f.states[1].pending,null);
});

test('insufficient rescue evidence can lead to a contextual question after search',async()=>{
 const f=rescueFixture([]);let calls=0;
 const r=await runCompanion(input('烧酒加多了怎么办'),{...f.deps,followup:async(_prompt,state)=>{
  calls++;assert.equal(f.searches.length,1);assert.match(JSON.stringify(state),/烧酒加多/);
  return {value:{kind:'clarify',message:'',question:'现在已经和其他材料混合了吗？'}};
 }});
 assert.equal(calls,1);assert.equal(r.status,'needs_info');assert.equal(r.message,'');assert.match(r.clarification,/混合/);
 assert.equal(r.pending?.kind,'rescue');assert.ok(companionOutput.safeParse(r).success);
 if(r.pending?.kind==='rescue')assert.equal(r.pending.conversation.at(-1)?.content,r.clarification);
});
test('general rescue advice is labelled and never turned into evidence or actions',async()=>{
 const f=rescueFixture([]);
 const r=await runCompanion(input('烧酒加多了，具体用量不记得了'),{...f.deps,followup:async()=>({value:{kind:'guidance',message:'如果已经混合，可以考虑分杯处理；具体调整还要看已经加入的材料。',question:''}})});
 assert.match(r.message,/一般调酒建议/);assert.equal(r.knowledge?.claims.length,0);assert.equal(r.actions.length,0);
 assert.equal(r.status,'answered');assert.ok(companionOutput.safeParse(r).success);
});
test('unsupported followup quantities fail closed without inventing evidence',async()=>{
 const f=rescueFixture([]);
 const r=await runCompanion(input('烧酒加多了怎么办'),{...f.deps,followup:async()=>({value:{kind:'guidance',message:'加30毫升水就好了。',question:''}})});
 assert.doesNotMatch(r.message,/30/);assert.match(r.message,/资料不足/);assert.equal(r.actions.length,0);
});
test('sourced answers do not invoke the general rescue fallback',async()=>{
 const f=rescueFixture([]);
 const r=await runCompanion(input('烧酒加多了怎么办'),{...f.deps,
  search:async()=>({status:'answered',claims:[{text:'受证据支持的测试结论',evidenceIds:['fixture']}],citations:[{id:'fixture',title:'fixture',sources:[]}]}),
  followup:async()=>{throw Error('must not run');}
 });
 assert.equal(r.knowledge?.claims.length,1);assert.ok(!r.trace.some(t=>t.tool==='rescue_followup'));
});

test('general guidance may acknowledge user estimates but may not prescribe the same amount',async()=>{
 const {parseRescueFollowup}=await import('./rescue-followup');
 assert.equal(parseRescueFollowup({kind:'guidance',message:'你说烧酒大概60毫升，其他用量不清楚，可以先确认是否已经混合。',question:''},'烧酒大概60毫升').kind,'guidance');
 assert.throws(()=>parseRescueFollowup({kind:'guidance',message:'可以再加60毫升苏打水。',question:''},'烧酒大概60毫升'));
});

test('rejected quantitative advice preserves an independently valid followup question',async()=>{
 const f=rescueFixture([]);
 const r=await runCompanion(input('烧酒加多了怎么办'),{...f.deps,followup:async()=>({value:{kind:'guidance',message:'建议补加30毫升水。',question:'已经和其他材料混合了吗？'}})});
 assert.equal(r.status,'needs_info');assert.equal(r.message,'');assert.match(r.clarification,/混合/);
});

test('rescue review replaces faulty advice before it is displayed',async()=>{
 const f=rescueFixture([]);let reviewed=false;
 const r=await runCompanion(input('烧酒倒多了，已经混好'),{...f.deps,
 followup:async()=>({value:{kind:'guidance',message:'加苏打水会越喝越烈。',question:''}}),
 reviewRescue:async(_p,state)=>{assert.match(JSON.stringify(state),/越喝越烈/);reviewed=true;return {value:{kind:'guidance',message:'如果手边有苏打水，可以少量加入混合液来降低浓度；这不会减少整杯的酒精总量。',question:''}};}
 });
 assert.ok(reviewed);assert.doesNotMatch(r.message,/越喝越烈/);assert.match(r.message,/不会减少/);
});
test('review also handles planner questions using previous conversation',async()=>{
 const f=rescueFixture(['其他材料各用了多少？']);
 const pending:CompanionInput['pending']={kind:'rescue',question:'烧酒倒多了',recipeKey:beerPage.kind+':'+beerPage.recipeId,conversation:[{role:'user',content:'烧酒倒多了'},{role:'assistant',content:'其他材料各用了多少？'},{role:'user',content:'不记得了'}]};
 const r=await runCompanion(input('不记得了',{pending}),{...f.deps,reviewRescue:async(_p,state)=>{
 assert.match(JSON.stringify(state),/不记得了/);return {value:{kind:'guidance',message:'用量不确定时先不要追求恢复原配方，可以按当前实际状态考虑处理。',question:''}};
 }});
 assert.equal(r.clarification,'');assert.equal(r.status,'answered');assert.equal(f.searches.length,0);
});
test('repeated questions are suppressed without discarding valid advice',async()=>{
 const {removeRepeatedQuestion}=await import('./rescue-followup');
 const history=[{role:'assistant' as const,content:'你现在的杯子还有多少空余空间？'}];
 const r=removeRepeatedQuestion({kind:'guidance',message:'先保留现状。',question:'杯子还有多少空余空间？'},history);
 assert.equal(r.question,'');assert.equal(r.message,'先保留现状。');
});
test('failed semantic review never displays unreviewed general advice',async()=>{
 const f=rescueFixture([]);
 const r=await runCompanion(input('烧酒加多了怎么办'),{...f.deps,
 followup:async()=>({value:{kind:'guidance',message:'加水会更烈。',question:''}}),
 reviewRescue:async()=>{throw Error('review unavailable');}
 });
 assert.doesNotMatch(r.message,/加水会更烈/);assert.match(r.message,/资料不足/);
});

test('rescue advice cannot suggest adding the overpoured material back',async()=>{
 const {respectRescueGoal}=await import('./rescue-followup');
 const r=respectRescueGoal({kind:'guidance',message:'如果有苏打水，可少量补入降低浓度。觉得太酸或太淡，再少量补烧酒或青柠汁。分杯不改变浓度。',question:''},[{role:'user',content:'烧酒加多了怎么办'}]);
 assert.doesNotMatch(r.message,/补烧酒/);assert.match(r.message,/降低浓度/);
});
