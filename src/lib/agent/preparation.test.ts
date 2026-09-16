import test from 'node:test';
import assert from 'node:assert/strict';
import {runPreparation,preparationInput,type PreparationDeps} from './preparation';
const answer={status:'answered',claims:[{text:'核对糖浆浓度。',evidenceIds:['syrup']}],citations:[{id:'syrup',title:'糖浆',sources:[{title:'source',url:'https://example.com'}]}]};
function deps(intent:string,actions:unknown[]=[],extra:Record<string,unknown>={}) {
 let calls=0,searches=0;
 const dependencies:PreparationDeps={model:async(stage)=>{calls++;return {value:stage==='intent'?{intent,dialogueAct:'new_task',taskRelation:'new',question:intent==='unclear'?'你指的是哪一步？':'',knowledgeQuestion:'',destination:'finder',...extra}:actions.shift(),model:'test-double',usage:null};},search:async()=>{searches++;return answer;}};
 return {dependencies,count:()=>({calls,searches})};
}
test('recommendation hands off without recipe or supply tools',async()=>{const d=deps('recommend');const r=await runPreparation(preparationInput.parse({question:'帮我选酒'}),d.dependencies);assert.equal(r.status,'handoff');assert.equal(r.handoff?.href,'/?tab=ASSISTANT');assert.equal(r.recipes.length,0);assert.deepEqual(d.count(),{calls:1,searches:0});});
test('mixed request retains knowledge while handing off recommendation',async()=>{const d=deps('recommend',[],{knowledgeQuestion:'苏打水能摇吗'});const r=await runPreparation(preparationInput.parse({question:'选一杯，并解释苏打水能不能摇'}),d.dependencies);assert.ok(r.handoff);assert.ok(r.knowledge);});
test('knowledge does not enter the troubleshooting loop',async()=>{const d=deps('knowledge');const r=await runPreparation(preparationInput.parse({question:'糖浆是什么'}),d.dependencies);assert.equal(r.status,'answered');assert.equal(d.count().calls,1);});
test('troubleshooting reads recipe, retrieves, then clarifies without suppressing evidence',async()=>{const d=deps('troubleshoot',[{action:'read_recipe'},{action:'search_knowledge',question:'换糖浆为什么甜'},{action:'clarify',question:'你实际加了多少糖浆？'}]);const r=await runPreparation(preparationInput.parse({question:'太甜了',context:'原配方糖浆10ml'}),d.dependencies);assert.deepEqual(r.trace.map(t=>t.tool),['read_recipe','search_knowledge']);assert.ok(r.knowledge);assert.equal(r.clarification,'你实际加了多少糖浆？');});
test('capacity calculation requires actual user measurements and never certifies ice fit',async()=>{const q='容量 300 ml，已有 250 ml，拟加 100 ml';const d=deps('troubleshoot',[{action:'check_capacity',capacity:300,current:250,addition:100,evidence:q},{action:'finish'}]);const r=await runPreparation(preparationInput.parse({question:q}),d.dependencies);assert.match(r.calculations[0].text,/超过/);assert.match(r.calculations[0].text,/未计冰块/);});
test('recipe and assistant values cannot become actual poured quantities',async()=>{const q='容量 300 ml，已有 250 ml，拟加 100 ml';const d=deps('troubleshoot',[{action:'check_capacity',capacity:300,current:250,addition:100,evidence:q},{action:'finish'}]);const r=await runPreparation(preparationInput.parse({question:'帮我算一下',context:q,history:[{role:'assistant',content:q}]}),d.dependencies);assert.equal(r.calculations.length,0);assert.equal(r.trace[0].status,'needs_info');});
test('cancel ends task without tools and ambiguous answer asks one question',async()=>{const d=deps('troubleshoot',[],{dialogueAct:'cancel'});assert.equal((await runPreparation(preparationInput.parse({question:'不做了'}),d.dependencies)).status,'cancelled');const a=deps('unclear');assert.equal((await runPreparation(preparationInput.parse({question:'300'}),a.dependencies)).status,'needs_info');});
test('repeated tool actions are bounded and only execute once',async()=>{const d=deps('troubleshoot',Array.from({length:6},()=>({action:'read_recipe'})));const r=await runPreparation(preparationInput.parse({question:'太甜'}),d.dependencies);assert.equal(r.status,'limit');assert.equal(r.trace.length,1);});
test('failed retrieval and invalid citations are not presented as supported',async()=>{const d=deps('knowledge');d.dependencies.search=async()=>({...answer,claims:[{text:'fake',evidenceIds:['fake']}]});const r=await runPreparation(preparationInput.parse({question:'问题'}),d.dependencies);assert.equal(r.knowledge,null);assert.equal(r.trace[0].status,'error');});
test('unknown actions cannot execute and cancellation aborts before model call',async()=>{const d=deps('troubleshoot',[{action:'write_inventory'}]);assert.equal((await runPreparation(preparationInput.parse({question:'太甜'}),d.dependencies)).status,'unavailable');const c=new AbortController();c.abort();assert.equal((await runPreparation(preparationInput.parse({question:'太甜'}),d.dependencies,c.signal)).status,'timeout');});

test('cancel accepts no destination and no tools execute',async()=>{const d=deps('unclear',[],{dialogueAct:'cancel',destination:''});const r=await runPreparation(preparationInput.parse({question:'不做了'}),d.dependencies);assert.equal(r.status,'cancelled');assert.equal(r.trace.length,0);});

test('bare number without context never becomes recommendation or consumes a model call',async()=>{const d=deps('recommend');const r=await runPreparation(preparationInput.parse({question:'300'}),d.dependencies);assert.equal(r.status,'needs_info');assert.equal(r.intent?.intent,'unclear');assert.equal(d.count().calls,0);});

test('intent clarification asks before invoking preparation tools', async () => {
 const d=deps('guide',[],{question:'杯里现在有多少液体？'});
 const r=await runPreparation(preparationInput.parse({question:'还能加多少才不溢出？'}),d.dependencies);
 assert.equal(r.status,'needs_info');
 assert.equal(r.clarification,'杯里现在有多少液体？');
 assert.deepEqual(d.count(),{calls:1,searches:0});
});
