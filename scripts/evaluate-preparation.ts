import nextEnv from '@next/env';
import {mkdir,writeFile} from 'node:fs/promises';
nextEnv.loadEnvConfig(process.cwd(),true);
const {runPreparation,preparationInput}=await import('../src/lib/agent/preparation');
const {preparationModel}=await import('../src/lib/agent/preparation-provider');
const {ask}=await import('../src/lib/knowledge/rag/runtime');
const {default:prisma}=await import('../src/lib/db/prisma');
const cases=[
 {question:'帮我推荐一杯清爽的酒',intent:'recommend'},
 {question:'苏打水能放进密闭摇酒壶摇吗？',intent:'knowledge'},
 {question:'不是糖浆，是蜂蜜。我已经加进去了，现在混不开。',context:'正在做一杯家庭金酒饮品，原配方写糖浆。',intent:'troubleshoot',act:'correction'},
 {question:'容量 300 ml，已有 250 ml，拟加 100 ml。液体会超过杯子容量吗？我已经在做这杯了。',context:'当前杯子接近装满。',calculate:true},
 {question:'300',intent:'unclear'},
 {question:'算了，不做了',cancel:true},
];
const rows=[];
try {
 for(const c of cases.filter(c=>!process.argv.includes('--failed-only')||c.act||c.cancel||c.intent==='unclear')){const start=Date.now();const r=await runPreparation(preparationInput.parse({question:c.question,context:c.context||''}),{model:preparationModel,search:async(q,ctx,s)=>(await ask(q,ctx.slice(0,6000),3,s)).answer});const pass=(!c.intent||r.intent?.intent===c.intent)&&(!c.act||r.intent?.dialogueAct===c.act)&&(!c.calculate||r.calculations.length>0)&&(!c.cancel||r.status==='cancelled')&&!['timeout','unavailable','limit'].includes(r.status);rows.push({input:c,result:r,pass,elapsedMs:Date.now()-start});console.log(JSON.stringify({question:c.question,pass,intent:r.intent,status:r.status,trace:r.trace}));}
 await mkdir('artifacts/evaluations',{recursive:true});await writeFile(process.argv.includes('--failed-only')?'artifacts/evaluations/preparation-agent-recheck.json':'artifacts/evaluations/preparation-agent.json',JSON.stringify({at:new Date().toISOString(),model:process.env.MINIMAX_MODEL,note:'Small live smoke; semantic correctness requires review. Not a held-out benchmark.',rows},null,2));if(rows.some(r=>!r.pass))process.exitCode=1;
}finally{await prisma.$disconnect();}
