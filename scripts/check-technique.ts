import nextEnv from '@next/env';
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
nextEnv.loadEnvConfig(process.cwd(),true);
const {inputSchema,runAgent}=await import('../src/lib/agent/core');
const {decide}=await import('../src/lib/agent/provider');
const {ask}=await import('../src/lib/knowledge/rag/runtime');
const {default:prisma}=await import('../src/lib/db/prisma');
const rows=[];
try {
  for(const question of ['我不知道该加多少冰','苏打水能放进摇酒壶摇吗？']) {
    const input=inputSchema.parse({question,ice:true,iceEnough:null,toolAvailability:{杯子:null,量杯:true,搅拌勺:null},history:[{role:'user',content:'帮我选一杯酒'}]});
    const result=await runAgent(input,{decide,search:async(q,c,s)=>(await ask(q,c,3,s)).answer});
    rows.push({question,result});
    assert.equal(result.trace[0]?.tool,'search_knowledge');
    assert.ok(!result.trace.some(t=>t.tool==='find_recipes'));
    assert.equal(result.recipes.length,0);
    if(question.includes('多少冰')) {
      assert.match(result.clarification,/配方|杯子|杯型|容量|哪杯/);
      assert.doesNotMatch(result.clarification,/想喝什么类型|经典鸡尾酒.*威士忌/);
    } else {
      assert.equal(result.knowledge?.status,'answered');
      assert.ok(result.knowledge.citations.some(c=>c.id==='carbonated-shaking'));
    }
    console.log(JSON.stringify({question,status:result.status,clarification:result.clarification,trace:result.trace}));
  }
} finally {
  await mkdir('artifacts/evaluations',{recursive:true});
  await writeFile('artifacts/evaluations/technique-regression.json',JSON.stringify({at:new Date().toISOString(),model:process.env.MINIMAX_MODEL,rows},null,2));
  await prisma.$disconnect();
}
