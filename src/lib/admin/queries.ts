import { Prisma } from '@prisma/client';
import prisma from '@/lib/db/prisma';
import { dateWindow,rate } from './metrics';
import { releaseVersion } from './telemetry';
const q=<T=Record<string,any>>(sql:Prisma.Sql)=>prisma.$queryRaw<T[]>(sql);
export async function overview(search:URLSearchParams){
 const {start,end,previous}=dateWindow(search);const internal=search.get('population')==='internal';
 const windowStats=async(a:Date,b:Date)=>{
 const [s]=await q(Prisma.sql`WITH events AS (SELECT * FROM pm_events WHERE created_at>=${a} AND created_at<${b} AND internal=${internal}), tasks AS (SELECT * FROM pm_tasks WHERE created_at>=${a} AND created_at<${b} AND internal=${internal}), turns AS (SELECT r.* FROM pm_turns r JOIN pm_tasks t ON t.id=r.task_id WHERE r.created_at>=${a} AND r.created_at<${b} AND t.internal=${internal}) SELECT
 (SELECT count(DISTINCT user_id)::int FROM events WHERE user_id IS NOT NULL) AS active,
 (SELECT count(DISTINCT visitor_id)::int FROM events WHERE user_id IS NULL) AS visitors,
 (SELECT count(*)::int FROM tasks) AS tasks,
 (SELECT count(DISTINCT user_id)::int FROM tasks) AS ai_users,
 (SELECT count(*)::int FROM tasks WHERE feedback='solved') AS solved,
 (SELECT count(*)::int FROM tasks WHERE feedback='unsolved') AS unsolved,
 (SELECT count(*)::int FROM events WHERE name='drink_recorded') AS drinks,
 (SELECT count(DISTINCT user_id)::int FROM events WHERE name='drink_recorded') AS makers,
 (SELECT count(*)::int FROM events WHERE name='making_started') AS starts,
 (SELECT count(*)::int FROM turns) AS requests,
 (SELECT count(*)::int FROM turns WHERE status IN ('error','unavailable','timeout','limited')) AS failures,
 (SELECT count(*)::int FROM turns WHERE status='needs_info') AS clarifications,
 (SELECT count(*)::int FROM turns WHERE rag_status IS NOT NULL) AS rag,
 (SELECT count(*)::int FROM turns WHERE rag_status IN ('no_evidence','insufficient_evidence')) AS insufficient,
 (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY elapsed_ms) FROM turns) AS p50,
 (SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY elapsed_ms) FROM turns) AS p95,
 (SELECT count(DISTINCT e.user_id)::int FROM events e WHERE e.user_id IS NOT NULL AND EXISTS (SELECT 1 FROM pm_events old WHERE old.user_id=e.user_id AND old.internal=${internal} AND old.created_at<${a})) AS returning,
 (SELECT count(DISTINCT t.user_id)::int FROM tasks t WHERE EXISTS(SELECT 1 FROM pm_events e WHERE e.user_id=t.user_id AND e.name='drink_recorded' AND e.created_at>=t.created_at AND e.created_at<${b})) AS ai_makers`);
 return {...s,solvedRate:rate(s.solved,s.solved+s.unsolved),feedbackRate:rate(s.solved+s.unsolved,s.tasks)};
 };
 const [current,prior,trend,intents,statuses,reasons,tools,models,cohorts,newUsers,coverage,queues,sources,behaviors]=await Promise.all([
 windowStats(start,end),windowStats(previous,start),
 q(Prisma.sql`SELECT to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD') AS day_label,count(DISTINCT user_id)::int active,count(*) FILTER(WHERE name='drink_recorded')::int drinks FROM pm_events WHERE created_at>=${start} AND created_at<${end} AND internal=${internal} GROUP BY 1 ORDER BY 1`),
 q(Prisma.sql`SELECT coalesce(r.intent,'未分类') label,count(*)::int value FROM pm_turns r JOIN pm_tasks t ON t.id=r.task_id WHERE r.created_at>=${start} AND r.created_at<${end} AND t.internal=${internal} GROUP BY 1 ORDER BY 2 DESC`),
 q(Prisma.sql`SELECT r.status label,count(*)::int value FROM pm_turns r JOIN pm_tasks t ON t.id=r.task_id WHERE r.created_at>=${start} AND r.created_at<${end} AND t.internal=${internal} GROUP BY 1 ORDER BY 2 DESC`),
 q(Prisma.sql`SELECT coalesce(reason,'未填写原因') label,count(*)::int value FROM pm_tasks WHERE created_at>=${start} AND created_at<${end} AND internal=${internal} AND feedback='unsolved' GROUP BY 1 ORDER BY 2 DESC`),
 q(Prisma.sql`SELECT item->>'tool' label,count(*)::int value,count(*) FILTER(WHERE item->>'status' NOT IN ('ok','success','answered'))::int non_ok FROM pm_turns r JOIN pm_tasks t ON t.id=r.task_id CROSS JOIN LATERAL jsonb_array_elements(r.tool_summary) item WHERE r.created_at>=${start} AND r.created_at<${end} AND t.internal=${internal} GROUP BY 1 ORDER BY 2 DESC`),
 q(Prisma.sql`SELECT r.model,r.version,count(*)::int requests,round(avg(r.elapsed_ms))::int avg_ms,count(*) FILTER(WHERE r.usage IS NOT NULL AND r.usage<>'null'::jsonb)::int usage_recorded FROM pm_turns r JOIN pm_tasks t ON t.id=r.task_id WHERE r.created_at>=${start} AND r.created_at<${end} AND t.internal=${internal} GROUP BY 1,2 ORDER BY 3 DESC`),
 q(Prisma.sql`WITH firsts AS(SELECT user_id,min(created_at)::date first_day FROM pm_events WHERE user_id IS NOT NULL AND internal=${internal} GROUP BY user_id) SELECT first_day::text AS day_label,count(*)::int users,CASE WHEN first_day+1<CURRENT_DATE THEN count(*) FILTER(WHERE EXISTS(SELECT 1 FROM pm_events e WHERE e.user_id=f.user_id AND e.internal=${internal} AND e.created_at::date=f.first_day+1))::int END d1,CASE WHEN first_day+7<CURRENT_DATE THEN count(*) FILTER(WHERE EXISTS(SELECT 1 FROM pm_events e WHERE e.user_id=f.user_id AND e.internal=${internal} AND e.created_at::date=f.first_day+7))::int END d7 FROM firsts f WHERE first_day>=${start}::date AND first_day<${end} GROUP BY first_day ORDER BY first_day`),
 q(Prisma.sql`SELECT count(*)::int total,count(*) FILTER(WHERE u.created_at>=${start} AND u.created_at<${end})::int new,count(*) FILTER(WHERE u.created_at>=${previous} AND u.created_at<${start})::int previous FROM auth.users u JOIN auth.users a ON a.id=u.id WHERE (coalesce(a.raw_app_meta_data->>'role','')='admin' OR coalesce(a.raw_app_meta_data->>'is_test','false')='true' OR lower(u.email)=ANY(${((process.env.ADMIN_EMAILS||'')+','+(process.env.TEST_EMAILS||'')).split(',').map(x=>x.trim().toLowerCase())}::text[]))=${internal}`),
 q(Prisma.sql`SELECT min(created_at) since FROM pm_events`),
 q(Prisma.sql`SELECT review_status,count(*)::int count FROM pm_turns r JOIN pm_tasks t ON t.id=r.task_id WHERE r.created_at>=${start} AND r.created_at<${end} AND t.internal=${internal} AND r.pinned GROUP BY review_status`),
 q(Prisma.sql`SELECT source label,count(DISTINCT visitor_id)::int value FROM pm_events WHERE created_at>=${start} AND created_at<${end} AND internal=${internal} AND name='page_view' GROUP BY source ORDER BY 2 DESC LIMIT 12`),
 q(Prisma.sql`SELECT page label,count(*)::int value FROM pm_events WHERE created_at>=${start} AND created_at<${end} AND internal=${internal} AND name='page_view' GROUP BY page ORDER BY 2 DESC`)
 ]);
 return {current,previous:prior,trend:trend.map(r=>({...r,day:r.day_label})),intents,statuses,reasons,tools,models,cohorts:cohorts.map(r=>({...r,day:r.day_label})),users:newUsers[0],coverage:coverage[0]?.since,queues,sources,behaviors,previousComplete:Boolean(coverage[0]?.since && new Date(coverage[0].since)<=previous),version:releaseVersion(),start,end,population:internal?'internal':'production',asOf:new Date()};
}
export async function listTurns(search:URLSearchParams){
 const {start,end}=dateWindow(search),internal=search.get('population')==='internal';
 const page=Math.max(0,Math.min(10000,Number(search.get('page'))||0));
 const filter=search.get('filter');
 const extra=filter==='issues'?Prisma.sql`AND (r.status IN ('error','timeout','unavailable','limited') OR t.feedback='unsolved' OR r.rag_status IN ('no_evidence','insufficient_evidence'))`:filter==='pinned'?Prisma.sql`AND r.pinned`:filter==='rag'?Prisma.sql`AND r.rag_status IS NOT NULL`:Prisma.empty;
 return q(Prisma.sql`SELECT r.id,r.task_id,r.created_at,r.status,r.intent,r.model,r.version,r.elapsed_ms,r.rag_status,r.pinned,r.review_status,t.surface,t.feedback,EXISTS(SELECT 1 FROM pm_details d WHERE d.turn_id=r.id AND (d.expires_at>now() OR r.pinned)) details_available FROM pm_turns r JOIN pm_tasks t ON t.id=r.task_id WHERE r.created_at>=${start} AND r.created_at<${end} AND t.internal=${internal} ${extra} ORDER BY r.created_at DESC,r.id DESC LIMIT 26 OFFSET ${page*25}`);
}
export async function turnDetail(id:string){
 return q(Prisma.sql`SELECT r.*,t.surface,t.feedback,t.reason,d.payload FROM pm_turns r JOIN pm_tasks t ON t.id=r.task_id LEFT JOIN pm_details d ON d.turn_id=r.id AND (d.expires_at>now() OR r.pinned) WHERE r.task_id=(SELECT task_id FROM pm_turns WHERE id=${id}::uuid) ORDER BY r.created_at LIMIT 100`);
}
