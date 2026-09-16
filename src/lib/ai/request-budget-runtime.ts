import prisma from '@/lib/db/prisma';
export class BudgetError extends Error {}
function limit(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > 10000) throw new Error('Invalid AI quota configuration');
  return value;
}
// Shared Postgres transaction prevents concurrent instances from overspending the same quota.
// Attempts count even on provider errors; expired leases recover after process termination.
export async function acquireBudget(userId: string, requestId: string) {
  const minute = limit('AI_REQUESTS_PER_MINUTE', 6), daily = limit('AI_REQUESTS_PER_DAY', 60), concurrent = limit('AI_CONCURRENT_REQUESTS', 1);
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 731))::text`;
    await tx.$executeRaw`DELETE FROM public.ai_request_leases WHERE user_id=${userId}::uuid AND started_at < now() - interval '2 days'`;
    const [row] = await tx.$queryRaw<Array<{ minute: bigint; daily: bigint; active: bigint }>>`
      SELECT count(*) FILTER (WHERE started_at > now()-interval '1 minute') AS minute,
      count(*) FILTER (WHERE started_at > now()-interval '24 hours') AS daily,
      count(*) FILTER (WHERE finished_at IS NULL AND lease_until > now()) AS active
      FROM public.ai_request_leases WHERE user_id=${userId}::uuid`;
    if (Number(row.minute) >= minute || Number(row.daily) >= daily || Number(row.active) >= concurrent) throw new BudgetError();
    await tx.$executeRaw`INSERT INTO public.ai_request_leases(request_id,user_id,lease_until) VALUES(${requestId}::uuid,${userId}::uuid,now()+interval '70 seconds')`;
  });
}
export async function releaseBudget(requestId: string) {
  await prisma.$executeRaw`UPDATE public.ai_request_leases SET finished_at=now() WHERE request_id=${requestId}::uuid`;
}
