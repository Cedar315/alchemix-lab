import nextEnv from '@next/env';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
nextEnv.loadEnvConfig(process.cwd(),true);
const { ask } = await import('../src/lib/knowledge/rag/runtime');
const { datasetVersion } = await import('../src/lib/knowledge/rag/core');
const { ragCases } = await import('../src/lib/evaluation/cases');
const { runAgent,inputSchema } = await import('../src/lib/agent/core');
const { agentRecipes } = await import('../src/lib/agent/catalog');
const { decide } = await import('../src/lib/agent/provider');
const { default: prisma } = await import('../src/lib/db/prisma');
const kind=process.argv[2], split=process.argv[3]??'test';
if (!['rag','agent'].includes(kind)||!['dev','test'].includes(split)) throw Error('Usage: evaluate.ts rag|agent [dev|test]');
const rows: Record<string,unknown>[]=[];
const started=new Date().toISOString();
const implementationVersion=createHash('sha256').update((await Promise.all(['src/lib/agent/core.ts','src/lib/agent/provider.ts','src/lib/knowledge/rag/core.ts','src/lib/knowledge/rag/providers.ts','src/lib/knowledge/rag/runtime.ts'].map(p=>readFile(p,'utf8')))).join('\n')).digest('hex');
try {
  if(kind==='rag') for(const [index,c] of ragCases.filter(c=>c.split===split).entries()) {
    const start=Date.now();
    try {
      const r=await ask(c.question,'',3,AbortSignal.timeout(45000));
      const retrieved=r.hits.map(h=>h.document.id), cited=r.answer.citations.map(c=>c.id);
      const recall=c.ids.length?c.ids.filter(id=>retrieved.includes(id)).length/c.ids.length:null;
      const rank=retrieved.findIndex(id=>c.ids.includes(id));
      const pass=r.answer.status===c.status&&(recall===null||recall===1)&&(c.status!=='answered'||c.ids.every(id=>cited.includes(id)));
      rows.push({case:index+1,...c,elapsedMs:Date.now()-start,pass,recallAt3:recall,reciprocalRank:c.ids.length?(rank<0?0:1/(rank+1)):null,falseHit:!c.ids.length&&retrieved.length>0,retrieved,answer:r.answer,embeddingUsage:r.embeddingUsage,
        humanReview:{faithful:null,useful:null,notes:''}});
      console.log(JSON.stringify({case:index+1,pass,status:r.answer.status,elapsedMs:Date.now()-start}));
    } catch { rows.push({case:index+1,...c,pass:false,error:'request_failed',elapsedMs:Date.now()-start});console.log(JSON.stringify({case:index+1,pass:false})); }
  }
  else {
    const base={question:'请只推荐一杯清爽不甜的酒。',inventory:[{name:'伏特加',amount:100,unit:'ml'},{name:'苏打水',amount:300,unit:'ml'}],ice:true,iceEnough:true,tools:['杯子','量杯','搅拌勺']};
    const cases=[
      {name:'one-ready',input:base,expected:'ready'},
      {name:'unknown-quantity',input:{...base,inventory:base.inventory.map(i=>({...i,amount:null}))},expected:'needs_info'},
      {name:'no-ice',input:{...base,ice:false},expected:'needs_info'},
      {name:'knowledge-only',input:{question:'苏打水可以放进密闭摇壶吗？'},expected:'answered'},
    ];
    for(const c of cases) {
      const start=Date.now();
      const r=await runAgent(inputSchema.parse(c.input),{decide,search:async(q,ctx,s)=>(await ask(q,ctx,3,s)).answer});
      const pass=r.status===c.expected&&(c.expected==='ready'?r.recipes.length===1&&r.recipes[0].id==='house-vodka-soda':r.recipes.length===0)&&(c.expected!=='answered'||r.knowledge?.status==='answered');
      rows.push({name:c.name,input:c.input,expected:c.expected,elapsedMs:Date.now()-start,pass,...r,humanReview:{faithful:null,useful:null,notes:''}});
      console.log(JSON.stringify({case:c.name,status:r.status,pass,tools:r.trace}));
    }
  }
  const mean=(key:string)=>{const values=rows.map(r=>r[key]).filter((v):v is number=>typeof v==='number');return values.length?values.reduce((a,b)=>a+b,0)/values.length:null;};
  const times=rows.map(r=>Number(r.elapsedMs)).sort((a,b)=>a-b);
  const report={implementationVersion,kind,split:kind==='rag'?split:'smoke',started,datasetVersion,catalogVersion:createHash('sha256').update(JSON.stringify(agentRecipes)).digest('hex'),caseVersion:createHash('sha256').update(JSON.stringify(ragCases)).digest('hex'),model:process.env.MINIMAX_MODEL,embeddingModel:process.env.RAG_EMBEDDING_MODEL,threshold:process.env.RAG_MIN_SIMILARITY??'0.5',sampleCount:rows.length,passed:rows.filter(r=>r.pass).length,recallAt3:mean('recallAt3'),mrr:mean('reciprocalRank'),p50Ms:times[Math.floor((times.length-1)*.5)],p95Ms:times[Math.ceil((times.length-1)*.95)],note:'Automatic contract/retrieval checks only. Human faithfulness review pending; live smoke is not an independent Agent benchmark.',rows};
  await mkdir('artifacts/evaluations',{recursive:true});
  const path=`artifacts/evaluations/${kind}-${started.replace(/[:.]/g,'-')}.json`;
  await writeFile(path,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({report:path,passed:report.passed,total:rows.length,recallAt3:report.recallAt3,mrr:report.mrr,p50Ms:report.p50Ms,p95Ms:report.p95Ms}));
  if(report.passed!==rows.length)process.exitCode=1;
} finally { await prisma.$disconnect(); }
