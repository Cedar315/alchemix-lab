import test from 'node:test';
import assert from 'node:assert/strict';
import { inputSchema, checkRecipe, findRecipes, runAgent, type AgentDependencies } from './core';
import { agentRecipes } from './catalog';
const recipe = agentRecipes[0];
const complete = inputSchema.parse({ question: '一杯清爽的酒', inventory: [{name:'伏特加',amount:100,unit:'ml'},{name:'苏打水',amount:300,unit:'ml'}], ice:true, iceEnough:true, tools:['杯子','量杯','搅拌勺'] });
const actions = (values: unknown[], search?: AgentDependencies['search']): AgentDependencies => ({ decide: async()=>({value:values.shift() ?? {action:'finish',recipeIds:[],question:'请补充信息'},model:'test-double',usage:null}),search:search ?? (async()=>({status:'no_evidence',claims:[],citations:[]})) });
test('exact quantities pass; missing, insufficient and unknown supplies do not',()=>{
  assert.equal(checkRecipe(recipe,complete).status,'pass');
  assert.equal(checkRecipe(recipe,{...complete,inventory:[]}).status,'fail');
  assert.equal(checkRecipe(recipe,{...complete,inventory:complete.inventory.map(i=>({...i,amount:1}))}).status,'fail');
  assert.equal(checkRecipe(recipe,{...complete,inventory:complete.inventory.map(i=>({...i,amount:null}))}).status,'needs_info');
  assert.equal(checkRecipe(recipe,{...complete,ice:null}).status,'needs_info');
  assert.equal(checkRecipe(recipe,{...complete,ice:false}).status,'fail');
  assert.equal(checkRecipe(recipe,{...complete,tools:[]}).status,'fail');
});
test('exclusions cannot be overridden and aliases are exact, not substrings',()=>{
  assert.equal(checkRecipe(recipe,{...complete,excluded:['vodka']}).status,'fail');
  assert.equal(findRecipes({...complete,excluded:['伏特加']},'',[]).some(r=>r.recipe.id===recipe.id),false);
  assert.equal(checkRecipe(recipe,{...complete,inventory:[{name:'伏特加味糖浆',amount:100,unit:'ml'},complete.inventory[1]]}).status,'fail');
  assert.equal(inputSchema.safeParse({...complete,inventory:[...complete.inventory,{name:'vodka',amount:100,unit:'ml'}]}).success,false);
});
test('unknown units, negative quantity and model-controlled user identity rejected',()=>{
  assert.equal(inputSchema.safeParse({...complete,userId:'someone'}).success,false);
  assert.equal(inputSchema.safeParse({...complete,inventory:[{name:'伏特加',amount:-1,unit:'ml'}]}).success,false);
  assert.equal(inputSchema.safeParse({...complete,inventory:[{name:'伏特加',amount:2,unit:'bottle'}]}).success,false);
});
test('real loop executes find, check and knowledge tools before one-recipe result',async()=>{
  const result=await runAgent(complete,actions([
    {action:'find_recipes',query:'清爽',omit:[]}, {action:'check_recipe',recipeId:recipe.id},
    {action:'search_knowledge',question:'苏打水能摇吗'}, {action:'finish',recipeIds:[recipe.id],question:''},
  ]));
  assert.equal(result.status,'ready');assert.equal(result.recipes.length,1);assert.equal(result.trace.length,3);
});
test('forged or unchecked final recipe never renders',async()=>{
  const result=await runAgent(complete,actions([{action:'finish',recipeIds:[recipe.id],question:''},{action:'finish',recipeIds:['fake'],question:''}]));
  assert.equal(result.recipes.length,0);
});
test('missing supplies produce clarification after failed check',async()=>{
  const result=await runAgent({...complete,ice:false},actions([{action:'find_recipes',query:'',omit:[]},{action:'check_recipe',recipeId:recipe.id},{action:'finish',recipeIds:[recipe.id],question:''},{action:'finish',recipeIds:[],question:'能准备冰块吗？'}]));
  assert.equal(result.status,'no_candidates');assert.equal(result.trace[1].status,'fail');assert.equal(result.recipes.length,0);
});
test('failed candidate can be replaced and rechecked',async()=>{
  const result=await runAgent(complete,actions([{action:'find_recipes',query:'',omit:[]},{action:'check_recipe',recipeId:'house-vodka-orange'},{action:'find_recipes',query:'清爽',omit:['house-vodka-orange']},{action:'check_recipe',recipeId:recipe.id},{action:'finish',recipeIds:[recipe.id],question:''}]));
  assert.equal(result.status,'ready');assert.equal(result.trace[1].status,'fail');assert.equal(result.trace[3].status,'pass');
});
test('tool failure is recorded; knowledge-only question does not require recipe tools',async()=>{
  const result=await runAgent(complete,actions([{action:'search_knowledge',question:'为什么'}, {action:'finish',recipeIds:[],question:'请稍后重试'}],async()=>{throw Error('secret');}));
  assert.equal(result.trace[0].status,'error');assert.equal(result.knowledge,null);assert.ok(!JSON.stringify(result).includes('secret'));
});
test('tool execution is bounded and aborted requests stop',async()=>{
  const result=await runAgent(complete,actions(Array.from({length:10},()=>({action:'find_recipes',query:'',omit:[]}))));
  assert.equal(result.status,'limit');assert.equal(result.trace.length,6);
  const controller=new AbortController();controller.abort();
  assert.equal((await runAgent(complete,actions([]),controller.signal)).status,'timeout');
});
test('changed inventory in subsequent turn invalidates former ready recipe',async()=>{
  const result=await runAgent({...complete,inventory:[complete.inventory[0]],history:[{role:'assistant',content:'house-vodka-soda 可以做'}]},actions([{action:'find_recipes',query:'',omit:[]},{action:'check_recipe',recipeId:recipe.id},{action:'finish',recipeIds:[recipe.id],question:''}]));
  assert.equal(result.recipes.length,0);
});

test('knowledge with no evidence is not labeled answered',async()=>{
  const result=await runAgent(complete,actions([{action:'search_knowledge',question:'无关问题'},{action:'finish',recipeIds:[],question:''}]));
  assert.equal(result.status,'no_evidence');assert.equal(result.recipes.length,0);
});

test('having ice does not certify the recipe ice quantity',()=>{
  const check=checkRecipe(recipe,{...complete,ice:true,iceEnough:null});
  assert.equal(check.status,'needs_info');assert.ok(check.unknown.some(s=>s.includes('有冰不代表')));
});
test('each tool distinguishes unconfirmed from explicitly missing',()=>{
  const availability={杯子:null,量杯:true,搅拌勺:null};
  const check=checkRecipe(recipe,{...complete,tools:null,toolAvailability:availability});
  assert.equal(check.status,'needs_info');assert.equal(check.missing.length,0);
  assert.ok(check.unknown.some(s=>s.includes('杯子')));
  assert.equal(checkRecipe(recipe,{...complete,toolAvailability:{...availability,杯子:false}}).status,'fail');
});
test('ice question retrieves first despite incomplete supplies and preserves relevant follow-up',async()=>{
  let lookedUp=false;
  const input=inputSchema.parse({question:'我不知道该加多少冰',ice:true,toolAvailability:{杯子:null,量杯:true,搅拌勺:null}});
  const result=await runAgent(input,{
    search:async(q)=>{assert.equal(q,input.question);lookedUp=true;return {status:'insufficient_evidence',claims:[],citations:[]};},
    decide:async()=>{assert.equal(lookedUp,true);return {value:{action:'finish',recipeIds:[],question:'你在做哪杯酒，用什么杯子？'},model:'test-double',usage:null};},
  });
  assert.equal(result.trace[0].tool,'search_knowledge');assert.equal(result.trace.length,1);
  assert.match(result.clarification,/你在做哪杯酒，用什么杯子/);assert.equal(result.recipes.length,0);
});
test('an unanswered ice question still has a recipe-specific clarification',async()=>{
  const result=await runAgent(inputSchema.parse({question:'冰要加多少？'}),actions([{action:'finish',recipeIds:[],question:''}]));
  assert.match(result.clarification,/哪杯酒.*杯子/);
});

test('pure technique questions do not start a redundant decision/retrieval loop',async()=>{
  let decisions=0, searches=0;
  const result=await runAgent(inputSchema.parse({question:'我不知道该加多少冰'}),{
    search:async()=>{searches++;return {status:'insufficient_evidence',claims:[],citations:[]};},
    decide:async()=>{decisions++;throw Error('must not call');},
  });
  assert.equal(searches,1);assert.equal(decisions,0);assert.equal(result.status,'insufficient_evidence');
});
test('knowledge and model clarification can appear in the same reply',async()=>{
  const result=await runAgent(complete,actions([{action:'search_knowledge',question:'如何操作'},{action:'finish',recipeIds:[],question:'你使用什么杯型？'}]));
  assert.equal(result.clarification,'你使用什么杯型？');
});


test('chat supplies retain no ice and unknown gin amount; later correction is checked',async()=>{
  const {mergeSupplies,suppliesSchema}=await import('./conversation');
  const input=inputSchema.parse({question:'金酒',history:[{role:'user',content:'我没有冰'},{role:'assistant',content:'你手边有哪些酒？'}]});
  const updated=mergeSupplies(input,{inventory:[{name:'金酒',amount:null,unit:'ml'}],ice:false});
  assert.equal('question' in suppliesSchema.strip().parse(updated),false);
  assert.equal(updated.ice,false);assert.equal(updated.inventory[0].amount,null);
  assert.equal(checkRecipe(agentRecipes[2],updated).status,'fail');
  assert.throws(()=>mergeSupplies(input,{inventory:[{name:'金酒',amount:20,unit:'瓶'}]}));
  assert.throws(()=>mergeSupplies(input,{userId:'other'}));
  assert.throws(()=>mergeSupplies(input,{inventory:[{name:'金酒',amount:20,unit:'ml'},{name:'gin',amount:20,unit:'ml'}]}));
});
test('failures distinguish format, timeout and provider without leaking error text',async()=>{
  const {RagError}=await import('../knowledge/rag/core');
  for(const [error,expected] of [[new SyntaxError('private payload'),'INVALID_MODEL_OUTPUT'],[new DOMException('private endpoint','TimeoutError'),'TIMEOUT'],[new RagError('PROVIDER_ERROR','secret key'),'PROVIDER_ERROR']] as const){
    const result=await runAgent(complete,{decide:async()=>{throw error},search:actions([]).search});
    assert.equal('errorCode' in result && result.errorCode,expected);
    assert.ok(!JSON.stringify(result).includes('private'));assert.ok(!JSON.stringify(result).includes('secret'));
  }
});
test('no-ice recommendation stops before model calls and preserves knowledge questions',async()=>{
  const result=await runAgent(inputSchema.parse({question:'我现在没有冰块可以做什么酒',ice:false}),{decide:async()=>{throw Error('must not call')},search:actions([]).search});
  assert.equal(result.status,'no_candidates');assert.equal(result.recipes.length,0);
  const knowledge=await runAgent(inputSchema.parse({question:'苏打水能摇吗',ice:false}),actions([]));
  assert.equal(knowledge.trace[0]?.tool,'search_knowledge');
});
test('invalid action can be corrected without bypassing recipe checks',async()=>{
  const result=await runAgent(complete,actions([{action:'finish',answer:'fake recipe'},{action:'finish',recipeIds:[],question:'你喜欢什么口味？'}]));
  assert.equal(result.status,'needs_info');assert.equal(result.recipes.length,0);
});
test('explicit named recipe returns after a successful check without an extra decision',async()=>{
  const result=await runAgent({...complete,question:'只推荐一杯伏特加苏打'},actions([{action:'find_recipes',query:'清爽',omit:[]},{action:'check_recipe',recipeId:recipe.id}]));
  assert.equal(result.status,'ready');assert.equal(result.recipes[0].id,recipe.id);assert.equal(result.trace.length,2);
});
test('classic preference and assistant examples cannot create ingredient ownership',async()=>{
 const {mergeSupplies}=await import('./conversation');
 const input=inputSchema.parse({question:'经典的酒',history:[{role:'assistant',content:'例如金酒、朗姆？'}]});
 const updated=mergeSupplies(input,{inventory:[{name:'金酒',amount:null,unit:'ml'}]});
 assert.deepEqual(updated.inventory,[]);
});

test('database-first flow retrieves knowledge before any decision and stops without evidence',async()=>{
 const {runAgent:flow}=await import('./flow');let searches=0;
 const result=await flow(inputSchema.parse({question:'1:1糖浆替换2:1糖浆精确多少毫升？'}),{decide:async()=>{throw Error('no unsupported fallback')},search:async()=>{searches++;return {status:'insufficient_evidence',claims:[],citations:[]}}});
 assert.equal(searches,1);assert.equal(result.status,'insufficient_evidence');assert.equal(result.recipes.length,0);
});
test('database-first recipe flow asks one missing condition without model guesses',async()=>{
 const {runAgent:flow}=await import('./flow');
 const deps={decide:async()=>{throw Error('must lookup first')},search:actions([]).search};
 const empty=await flow(inputSchema.parse({question:'推荐一杯酒'}),deps);
 assert.equal(empty.trace[0].tool,'find_recipes');assert.equal(empty.clarification,'你手边有哪些酒或饮料？');
 const unknown=await flow({...complete,question:'推荐一杯酒',inventory:complete.inventory.map(i=>({...i,amount:null}))},deps);
 assert.equal(unknown.status,'needs_info');assert.match(unknown.clarification,/伏特加/);
 const none=await flow({...complete,question:'推荐一杯酒',ice:false},deps);
 assert.equal(none.status,'no_candidates');assert.equal(none.recipes.length,0);
});
test('new unrelated question is not mistaken for a supply reply and service failure is not no-answer',async()=>{
 const {runAgent:flow}=await import('./flow');
 const result=await flow(inputSchema.parse({question:'Python怎么排序？',ice:false,history:[{role:'user',content:'推荐一杯酒'}]}),{decide:actions([]).decide,search:async()=>{throw new DOMException('timeout','TimeoutError')}});
 assert.equal(result.status,'timeout');
});
test('unsupported citation cannot be rendered as an answer',async()=>{
 const {runAgent:flow}=await import('./flow');
 const result=await flow(inputSchema.parse({question:'糖浆怎么替换'}),{decide:actions([]).decide,search:async()=>({status:'answered',claims:[{text:'fake',evidenceIds:['fake']}],citations:[]})});
 assert.equal(result.status,'insufficient_evidence');assert.equal(result.knowledge,null);
});

test('repeated knowledge retrieval stops without a second identical service call',async()=>{
 let count=0;
 const result=await runAgent(complete,actions([{action:'search_knowledge',question:'不确定的问题'},{action:'search_knowledge',question:'不确定的问题'}],async()=>{count++;return {status:'no_evidence',claims:[],citations:[]}}));
 assert.equal(count,1);assert.equal(result.status,'insufficient_evidence');assert.equal(result.recipes.length,0);
});

test('denied tonic persists and recipe flow moves on after short or explicit replies', async () => {
 const { mergeSupplies } = await import('./conversation');
 const { runAgent: flow } = await import('./flow');
 for (const question of ['没有', '没有汤力水']) {
  const input = inputSchema.parse({ question, inventory:[{name:'金酒',amount:null,unit:'ml'}], history:[{role:'assistant',content:'你还有汤力水吗？'}] });
  const merged = mergeSupplies(input, {inventory:input.inventory});
  assert.deepEqual(merged.unavailable, ['汤力水']);
  assert.equal(findRecipes(merged,'',[]).some(c=>c.recipe.ingredients.some(i=>i.name==='汤力水')),false);
  const result = await flow(merged, {decide:actions([]).decide,search:async()=>{throw Error('Must continue recipe flow');}});
  assert.notEqual(result.clarification,'你还有汤力水吗？');
  const later = mergeSupplies({...merged, question:'推荐一杯酒',history:[]},{inventory:input.inventory,unavailable:[]});
  assert.deepEqual(later.unavailable,['汤力水']);
  const restocked = mergeSupplies({...later,question:'现在有汤力水'},{inventory:input.inventory});
  assert.deepEqual(restocked.unavailable,[]);
  assert.equal(restocked.inventory.some(i=>i.name==='汤力水' && i.amount===null),true);
 }
});

test('absence resolution does not invent stock from ambiguous replies or factual questions',async()=>{
 const {mergeSupplies}=await import('./conversation');
 for(const question of ['没有汤力水怎么办？','有']) {
  const input=inputSchema.parse({question,history:[{role:'assistant',content:'你有汤力水或苏打水吗？'}]});
  const merged=mergeSupplies(input,{});
  assert.deepEqual(merged.unavailable,[]);assert.deepEqual(merged.inventory,[]);
 }
});
