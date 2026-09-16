import nextEnv from '@next/env';
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
nextEnv.loadEnvConfig(process.cwd(),process.env.NODE_ENV!=='production');
const {default:prisma}=await import('../src/lib/db/prisma');
const {collect,reviewCandidate}=await import('../src/lib/knowledge/review/store');
const checks:string[]=[];
const query=prisma.$queryRaw,execute=prisma.$executeRaw,transaction=prisma.$transaction;
const rollback='ROLLBACK_KNOWLEDGE_SMOKE';
let id='';
try {
  try {
    await prisma.$transaction(async tx=>{
      // Exercise the real store and provider inside one transaction; test knowledge is never committed.
      prisma.$queryRaw=tx.$queryRaw.bind(tx) as typeof query;
      prisma.$executeRaw=tx.$executeRaw.bind(tx) as typeof execute;
      prisma.$transaction=(async (callback:any)=>callback(tx)) as typeof transaction;
      try {
        const question=`知识审核回滚测试 ${crypto.randomUUID()}`;
        const draft={title:question,aliases:[],category:'测试',answer:'这是一条事务验证条目，不是调酒建议。',scope:'仅供自动化回滚测试。',sources:[{title:'IBA',url:'https://iba-world.com/iba-cocktail/paloma/'}]};
        id=await collect(question,'测试',draft,[],'事务验证');
        const same=await collect(question,'测试',draft,[],'事务验证');assert.equal(id,same);
        const rows=await tx.$queryRaw<Array<{status:string;occurrences:number;revision:number}>>`SELECT status,occurrences,revision FROM public.knowledge_candidates WHERE id=${id}`;
        assert.equal(rows[0].status,'pending');assert.equal(rows[0].occurrences,2);checks.push('collection-and-exact-deduplication');
        const count=async()=>Number((await tx.$queryRaw<Array<{count:bigint}>>`SELECT count(*) FROM public.rag_chunks WHERE id=${id}`)[0].count);
        assert.equal(await count(),0);checks.push('pending-is-not-indexed');
        await reviewCandidate({id,revision:1,action:'publish',note:'仅验证事务机制，整个测试将回滚'},'00000000-0000-0000-0000-000000000001');
        assert.equal(await count(),1);
        const published=await tx.$queryRaw<Array<{status:string}>>`SELECT status FROM public.knowledge_candidates WHERE id=${id}`;
        assert.equal(published[0].status,'published');checks.push('real-embedding-and-atomic-publication');
        await assert.rejects(reviewCandidate({id,revision:1,action:'unpublish',note:''},'00000000-0000-0000-0000-000000000001'),/已更新/);checks.push('stale-revision-rejected');
        await reviewCandidate({id,revision:2,action:'unpublish',note:'回滚测试撤回'},'00000000-0000-0000-0000-000000000001');
        assert.equal(await count(),0);checks.push('withdrawal-removes-vector');
        const audits=await tx.$queryRaw<Array<{count:bigint}>>`SELECT count(*) FROM public.knowledge_reviews WHERE candidate_id=${id}`;
        assert.equal(Number(audits[0].count),2);checks.push('review-audit-recorded');
        throw Error(rollback);
      }finally{prisma.$queryRaw=query;prisma.$executeRaw=execute;prisma.$transaction=transaction;}
    },{timeout:90000});
  }catch(e){if(!(e instanceof Error)||e.message!==rollback)throw e;}
  const remaining=await prisma.$queryRaw<Array<{count:bigint}>>`SELECT count(*) FROM public.knowledge_candidates WHERE id=${id}`;
  assert.equal(Number(remaining[0].count),0);checks.push('test-data-rolled-back');
  await mkdir('artifacts/evaluations',{recursive:true});
  const file=`artifacts/evaluations/knowledge-store-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
  await writeFile(file,JSON.stringify({at:new Date().toISOString(),checks,note:'Real database and embedding provider. All test rows rolled back; no test knowledge published to users.'},null,2));
  console.log(JSON.stringify({checks,report:file}));
}catch(e){console.error(e instanceof assert.AssertionError?e.message:'Knowledge store test failed; inspect database/provider configuration.');process.exitCode=1;}
finally{await prisma.$disconnect();}
