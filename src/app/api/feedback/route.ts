import { z } from 'zod';
import prisma from '@/lib/db/prisma';
import { requireUser, authErrorResponse } from '@/lib/auth/current-user';
import { feedbackReasons } from '@/lib/admin/metrics';
const schema=z.object({requestId:z.string().uuid(),feedback:z.enum(['solved','unsolved']),reason:z.enum(feedbackReasons).optional()}).strict();
export async function POST(request:Request){
 try {
 const {user}=await requireUser();
 if(request.headers.get('origin') && request.headers.get('origin')!==new URL(request.url).origin) return Response.json({error:'来源不匹配'},{status:403});
 const raw=await request.text();if(raw.length>1000)return Response.json({error:'内容过长'},{status:413});
 const parsed=schema.safeParse(JSON.parse(raw));if(!parsed.success)return Response.json({error:'反馈格式无效'},{status:400});
 const b=parsed.data;
 const n=await prisma.$executeRaw`UPDATE pm_tasks t SET feedback=${b.feedback},reason=${b.feedback==='unsolved'?b.reason||null:null} WHERE t.user_id=${user.id}::uuid AND t.id=(SELECT task_id FROM pm_turns WHERE id=${b.requestId}::uuid) AND NOT EXISTS(SELECT 1 FROM pm_turns newer WHERE newer.task_id=t.id AND newer.created_at>(SELECT created_at FROM pm_turns WHERE id=${b.requestId}::uuid))`;
 return Response.json(n?{ok:true}:{error:'此任务已有新回复，请评价最新回复'},{status:n?200:409});
 }catch(e){return authErrorResponse(e)||Response.json({error:'反馈未保存，请稍后重试'},{status:503});}
}
