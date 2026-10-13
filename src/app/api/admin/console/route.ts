import { z } from 'zod';
import prisma from '@/lib/db/prisma';
import { requireAdmin,authErrorResponse } from '@/lib/auth/current-user';
import { overview,listTurns,turnDetail } from '@/lib/admin/queries';
import { audit,purgeDetails } from '@/lib/admin/telemetry';
import { scrub } from '@/lib/admin/metrics';
const json=(v:unknown)=>new Response(JSON.stringify(v,(_,x)=>typeof x==='bigint'?Number(x):x),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export async function GET(request:Request){try{
 const {user}=await requireAdmin();const s=new URL(request.url).searchParams;
 const view=s.get('view')||'overview';
 if(view==='overview')return json(await overview(s));
 if(view==='turns')return json({rows:await listTurns(s)});
 if(view==='detail'){const id=z.string().uuid().parse(s.get('id'));const rows=await turnDetail(id);await audit(user.id,'view_conversation',id);return json({rows});}
 if(view==='content'){
 const query=(s.get('q')||'').slice(0,100),page=Math.max(0,Math.min(10000,Number(s.get('page'))||0));
 const kind=s.get('kind')||'ingredients';
 if(kind==='ingredients')return json({rows:await prisma.ingredient.findMany({where:{OR:[{nameZh:{contains:query,mode:'insensitive'}},{nameEn:{contains:query,mode:'insensitive'}}]},take:26,skip:page*25,orderBy:{id:'asc'}})});
 return json({rows:await prisma.recipe.findMany({where:{OR:[{nameCn:{contains:query,mode:'insensitive'}},{nameEn:{contains:query,mode:'insensitive'}}]},include:{ingredients:true},take:26,skip:page*25,orderBy:{id:'asc'}})});
 }
 if(view==='evaluations')return json({rows:await prisma.$queryRaw`SELECT id,actor,created_at,mode,case_key,version,model,status,elapsed_ms,grade,note FROM pm_evaluations ORDER BY created_at DESC LIMIT 100`});
 if(view==='evaluation'){const id=z.string().uuid().parse(s.get('id'));return json({rows:await prisma.$queryRaw`SELECT * FROM pm_evaluations WHERE id=${id}::uuid`});}
 if(view==='audit')return json({rows:await prisma.$queryRaw`SELECT * FROM pm_audit ORDER BY created_at DESC LIMIT 100`});
 return Response.json({error:'未知查询'},{status:400});
 }catch(e){if(e instanceof z.ZodError)return Response.json({error:'参数无效'},{status:400});return authErrorResponse(e)||Response.json({error:'管理数据暂不可用，请确认数据库迁移已部署。'},{status:503});}}
const action=z.discriminatedUnion('action',[
 z.object({action:z.literal('review'),id:z.string().uuid(),pinned:z.boolean(),status:z.enum(['unreviewed','investigating','fixed','verified']),note:z.string().max(2000)}),
 z.object({action:z.literal('grade'),id:z.string().uuid(),grade:z.enum(['pass','fail','pending']),note:z.string().max(2000)}),
 z.object({action:z.literal('purge')})]);
export async function POST(request:Request){try{
 const {user}=await requireAdmin();
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'来源不匹配'},{status:403});
 const raw=await request.text();if(raw.length>6000)return Response.json({error:'内容过长'},{status:413});const b=action.parse(JSON.parse(raw));
 if(b.action==='purge'){await purgeDetails();await audit(user.id,'purge_expired','pm_details');return json({ok:true});}
 await prisma.$transaction(async tx=>{
 if(b.action==='review')await tx.$executeRaw`UPDATE pm_turns SET pinned=${b.pinned},review_status=${b.status},review_note=${String(scrub(b.note))},reviewer=${user.id}::uuid,reviewed_at=now() WHERE id=${b.id}::uuid`;
 else await tx.$executeRaw`UPDATE pm_evaluations SET grade=${b.grade},note=${String(scrub(b.note))} WHERE id=${b.id}::uuid`;
 await tx.$executeRaw`INSERT INTO pm_audit(actor,action,target) VALUES (${user.id}::uuid,${b.action},${b.id})`;
 });return json({ok:true});
 }catch(e){return authErrorResponse(e)||Response.json({error:e instanceof z.ZodError?'参数无效':'操作未保存，请重试'},{status:e instanceof z.ZodError?400:503});}}
