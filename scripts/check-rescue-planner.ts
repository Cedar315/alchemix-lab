import nextEnv from '@next/env';
import { mkdir, writeFile } from 'node:fs/promises';
import { runCompanion, companionPrompt } from '../src/lib/agent/companion';
import { companionToolModel, modelJSON } from '../src/lib/agent/preparation-provider';
import { companionInput, type CompanionInput } from '../src/lib/agent/companion-contract';
import { recipeContext } from '../src/lib/agent/workflow-catalog';
nextEnv.loadEnvConfig(process.cwd());
// Default: real planner with fixture search. --live includes retrieval; no knowledge collection writes.
const scenarios = [
 ['我的烧酒倒多了怎么办', '已经混好了，烧酒大概60毫升', '其他材料的量不记得了'],
 ['糖浆加多了，已经混好了', '不是糖浆，是青柠汁，量不记得了'],
 ['烧酒倒多了，总共60毫升，苏打水90毫升，青柠汁10毫升，已经混好了，怎么办'],
];
const live = process.argv.includes('--live');
const { searchAndCollect, webEvidence } = await import('../src/lib/knowledge/review/search');
const {ask,retrieve} = await import('../src/lib/knowledge/rag/runtime');
const {generate} = await import('../src/lib/knowledge/rag/providers');
const report: unknown[] = [];
for (const questions of (live ? scenarios.slice(0,1) : scenarios)) {
 let pending: CompanionInput['pending'] = null;
 const history: CompanionInput['history'] = [];
 const taskId = crypto.randomUUID();
 for (const question of questions) {
  const searches: string[] = [];
  const result = await runCompanion(companionInput.parse({version:2, taskId, contextVersion:0, question, page:recipeContext('convenience','lime-soju-soda'),history,pending}), {
   followup:modelJSON, reviewRescue:modelJSON,
   model:(state,signal)=>companionToolModel(companionPrompt,state,signal),
   search:async(q,context,signal)=>{searches.push(q);return live ? searchAndCollect(q,context,signal,{rag:ask,retrieve,web:webEvidence,generate,collect:async()=> 'release-test-skipped'}) : {status:'no_evidence',claims:[],citations:[]};},
  });
  report.push({question,status:result.status,clarification:result.clarification,searches,knowledge:result.knowledge,message:result.message,trace:result.trace});
  pending=result.pending;
  history.push({role:'user',content:question},{role:'assistant',content:[result.message,result.clarification].filter(Boolean).join('\n')});
  console.log(JSON.stringify(report.at(-1)));
 }
}
await mkdir('artifacts/evaluations',{recursive:true});
await writeFile(`artifacts/evaluations/rescue-planner-${new Date().toISOString().replace(/[:.]/g,'-')}.json`,JSON.stringify({scope:live?'real planner and retrieval; collection skipped; semantic review required':'real planner; fixture search; semantic review required',report},null,2));
if(report.some(row=>['unavailable','timeout'].includes((row as {status:string}).status)))process.exitCode=1;

if (live) { const {default:prisma} = await import('../src/lib/db/prisma'); await prisma.$disconnect(); }
