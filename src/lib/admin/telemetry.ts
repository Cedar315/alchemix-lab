import { createHash } from 'node:crypto';
import prisma from '@/lib/db/prisma';
import { scrub } from './metrics';
import { datasetVersion } from '@/lib/knowledge/rag/core';
export const releaseVersion = () => `${process.env.VERCEL_URL ? createHash('sha256').update(process.env.VERCEL_URL).digest('hex').slice(0,8) : process.env.APP_RELEASE || 'local'}:${datasetVersion.slice(0,8)}`;
export async function audit(actor: string, action: string, target: string) {
 await prisma.$executeRaw`INSERT INTO pm_audit(actor,action,target) VALUES (${actor}::uuid,${action},${target})`;
}
export async function purgeDetails() { return prisma.$queryRaw`SELECT public.pm_purge_details()`; }
export async function recordTurn(input: { id:string; userId:string; clientId:string; internal:boolean; surface:string; question:string; context?:unknown; result:unknown; elapsed:number; diagnostics?:Array<{stage:string;data:Record<string,unknown>}> }) {
 // Deliberately allowlisted metadata; no raw provider body or internal reasoning.
 const r=input.result as Record<string, any>;
 const ds=input.diagnostics||[];
 const intent=ds.find(d=>d.stage==='intent')?.data.intent||r.intent?.intent||null;
 const payload=scrub({question:input.question,context:input.context,message:r.message,clarification:r.clarification,knowledge:r.knowledge,actions:r.actions,recipes:r.recipes,diagnostics:ds});
 try {
 await recordEvent({userId:input.userId,visitorId:input.userId,internal:input.internal,name:'ai_request',page:input.surface});
 await prisma.$transaction(async tx=>{
 const [task]=await tx.$queryRaw<Array<{id:string}>>`INSERT INTO pm_tasks(user_id,client_id,internal,surface) VALUES (${input.userId}::uuid,${input.clientId},${input.internal},${input.surface}) ON CONFLICT(user_id,client_id) DO UPDATE SET updated_at=now(),feedback=NULL,reason=NULL RETURNING id`;
 await tx.$executeRaw`INSERT INTO pm_turns(id,task_id,status,intent,model,version,elapsed_ms,rag_status,tool_summary,usage) VALUES (${input.id}::uuid,${task.id}::uuid,${r.status||'error'},${intent},${r.model||'unknown'},${releaseVersion()},${input.elapsed},${r.knowledge?.status||null},${JSON.stringify(scrub(r.trace||[]))}::jsonb,${JSON.stringify(scrub(r.usage||null))}::jsonb)`;
 await tx.$executeRaw`INSERT INTO pm_details(turn_id,payload) VALUES (${input.id}::uuid,${JSON.stringify(payload)}::jsonb)`;
 });
 } catch { console.warn(JSON.stringify({event:'pm_telemetry_failed',requestId:input.id})); }
}
export async function recordEvent(input:{userId:string|null;visitorId:string;internal:boolean;name:string;page:string;source?:string}) {
 try { await prisma.$executeRaw`INSERT INTO pm_events(user_id,visitor_id,internal,name,page,source) VALUES (${input.userId}::uuid,${input.visitorId},${input.internal},${input.name},${input.page},${input.source||''})`; }
 catch {console.warn('pm_event_write_failed');}
}
