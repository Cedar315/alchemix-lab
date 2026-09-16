import nextEnv from '@next/env';
import assert from 'node:assert/strict';
nextEnv.loadEnvConfig(process.cwd(),true);
const {default:prisma}=await import('../src/lib/db/prisma');
const {acquireBudget,releaseBudget,BudgetError}=await import('../src/lib/ai/request-budget-runtime');
const userId=crypto.randomUUID();
const ids=Array.from({length:3},()=>crypto.randomUUID());
let created=false;
try {
  const [table]=await prisma.$queryRaw<Array<{rls:boolean}>>`SELECT relrowsecurity AS rls FROM pg_class WHERE oid='public.ai_request_leases'::regclass`;
  assert.equal(table.rls,true);
  await prisma.user.create({data:{id:userId,email:`quota-check-${userId}@example.invalid`}});created=true;
  process.env.AI_CONCURRENT_REQUESTS='1';process.env.AI_REQUESTS_PER_MINUTE='2';process.env.AI_REQUESTS_PER_DAY='3';
  const concurrent=await Promise.allSettled(ids.slice(0,2).map(id=>acquireBudget(userId,id)));
  assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);
  assert.ok(concurrent.some(r=>r.status==='rejected'&&r.reason instanceof BudgetError));
  const winner=ids[concurrent.findIndex(r=>r.status==='fulfilled')];
  await releaseBudget(winner);
  await acquireBudget(userId,ids[2]);await releaseBudget(ids[2]);
  await assert.rejects(acquireBudget(userId,crypto.randomUUID()),BudgetError);
  await prisma.$executeRaw`UPDATE public.ai_request_leases SET started_at=now()-interval '2 minutes' WHERE user_id=${userId}::uuid`;
  const third=crypto.randomUUID();await acquireBudget(userId,third);await releaseBudget(third);
  await assert.rejects(acquireBudget(userId,crypto.randomUUID()),BudgetError);
  console.log('PASS: RLS, concurrent admission, release, minute quota and rolling daily quota');
} finally {
  if(created)await prisma.user.delete({where:{id:userId}});
  await prisma.$disconnect();
}
