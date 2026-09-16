import nextEnv from '@next/env';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
nextEnv.loadEnvConfig(process.cwd(),true);
const {inputSchema}=await import('../src/lib/agent/core');
const {runAgent}=await import('../src/lib/agent/flow');
const {mergeSupplies,suppliesSchema}=await import('../src/lib/agent/conversation');
const {extractSupplies,decide}=await import('../src/lib/agent/provider');
const {ask}=await import('../src/lib/knowledge/rag/runtime');
const {default:prisma}=await import('../src/lib/db/prisma');
const rows:unknown[]=[];
let state=inputSchema.parse({question:'我现在没有冰块可以做什么酒'});
try {
 for(const question of ['我现在没有冰块可以做什么酒','经典的酒','金酒','现在有冰了，我有伏特加100毫升、苏打水300毫升，有杯子、量杯、搅拌勺。冰已确认够装满杯子。只推荐一杯伏特加苏打。']) {
  const signal=AbortSignal.timeout(45000);
  state=inputSchema.parse({...state,question});
  const extracted=await extractSupplies(state,signal);
  state=mergeSupplies(state,extracted.value);
  const result=await runAgent(state,{decide,search:async(q,c,s)=>(await ask(q,c,3,s)).answer},signal);
  rows.push({question,supplies:suppliesSchema.strip().parse(state),result});
  console.log(JSON.stringify({question,status:result.status,ice:state.ice,inventory:state.inventory}));
  assert.ok(!['unavailable','timeout','limit'].includes(result.status));
  if(question==='经典的酒') assert.equal(state.inventory.length,0);
  if(question==='金酒'){assert.equal(state.ice,false);assert.equal(state.inventory.find(i=>i.name==='金酒')?.amount,null);assert.equal(result.recipes.length,0);}
  if(question.startsWith('现在有冰')){assert.equal(result.status,'ready');assert.equal(result.recipes[0]?.id,'house-vodka-soda');}
  state=inputSchema.parse({...state,history:[...state.history,{role:'user',content:question},{role:'assistant',content:[result.message,result.clarification].filter(Boolean).join('\n')}].slice(-6)});
 }
} finally {
 await mkdir('artifacts/evaluations',{recursive:true});
 await writeFile('artifacts/evaluations/conversation-regression.json',JSON.stringify({at:new Date().toISOString(),rows},null,2));
 await prisma.$disconnect();
}
