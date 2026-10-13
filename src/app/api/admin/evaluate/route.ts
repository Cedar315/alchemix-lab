import { z } from 'zod';
import prisma from '@/lib/db/prisma';
import { requireAdmin,authErrorResponse } from '@/lib/auth/current-user';
import { evaluateCurrentAgent } from '@/lib/admin/evaluate-agent';
import { companionInput } from '@/lib/agent/companion-contract';
import { ask,retrieve } from '@/lib/knowledge/rag/runtime';
import { withAgentDiagnostics,diagnosticEntries } from '@/lib/agent/diagnostics';
import { scrub } from '@/lib/admin/metrics';
import { releaseVersion } from '@/lib/admin/telemetry';
import { acquireBudget,releaseBudget,BudgetError } from '@/lib/ai/request-budget';
export const maxDuration=60;
const schema=z.object({mode:z.enum(['agent','rag','retrieve']),question:z.string().trim().min(1).max(1000),caseKey:z.string().max(100),context:z.string().max(2000).default(''),page:companionInput.shape.page.optional(),history:companionInput.shape.history.optional()}).strict();
export async function POST(request:Request){
 const id=crypto.randomUUID(),start=Date.now();let acquired=false;
 try{
 const {user}=await requireAdmin();
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'来源不匹配'},{status:403});
 const raw=await request.text();if(raw.length>24000)return Response.json({error:'内容过长'},{status:413});const b=schema.parse(JSON.parse(raw));
 const mode=b.mode==='agent'?'agent-next':b.mode;
 const context=b.context || (b.page ? JSON.stringify(b.page) : '');
 const input={question:b.question,context,history:b.history||[],runtime:mode};
 await acquireBudget(user.id,id);acquired=true;
 // Persist a running record before provider calls, so interrupted jobs are visible.
 await prisma.$transaction(async tx=>{
 await tx.$executeRaw`INSERT INTO pm_evaluations(id,actor,mode,case_key,version,model,status,elapsed_ms,payload) VALUES (${id}::uuid,${user.id}::uuid,${mode},${b.caseKey},${releaseVersion()},${process.env.DEEPSEEK_MODEL||'unknown'},'running',0,${JSON.stringify(scrub(input))}::jsonb)`;
 await tx.$executeRaw`INSERT INTO pm_audit(actor,action,target) VALUES (${user.id}::uuid,'run_evaluation',${id})`;
 });
 const signal=AbortSignal.any([request.signal,AbortSignal.timeout(45000)]);
 return await withAgentDiagnostics(id,async()=>{
 try{
 const result=b.mode==='agent'?await evaluateCurrentAgent({id,question:b.question,context,history:b.history||[],signal}):b.mode==='rag'?await ask(b.question,context,3,signal):await retrieve(b.question,3,context,signal);
 const safe=scrub({...input,result,diagnostics:diagnosticEntries()});
 const status='status' in result?String(result.status):'answer' in result?(result.answer as {status:string}).status:'retrieved';
 const actualModel='model' in result ? String(result.model) : 'answer' in result ? String((result.answer as {model?:string}).model||'unknown') : process.env.RAG_EMBEDDING_MODEL||'embedding';
 const elapsedMs=Date.now()-start;
 await prisma.$executeRaw`UPDATE pm_evaluations SET model=${actualModel},status=${status},elapsed_ms=${elapsedMs},payload=${JSON.stringify(safe)}::jsonb WHERE id=${id}::uuid`;
 return Response.json({id,case_key:b.caseKey,mode,status,elapsedMs,payload:safe},{headers:{'Cache-Control':'no-store'}});
 }catch{
 await prisma.$executeRaw`UPDATE pm_evaluations SET status='error',elapsed_ms=${Date.now()-start} WHERE id=${id}::uuid`;
 return Response.json({error:'测试未完成，失败已记录',id},{status:503});
 }
 });
 }catch(e){return authErrorResponse(e)||Response.json({error:e instanceof BudgetError?'测试额度或并发已达上限，请稍后重试':e instanceof z.ZodError?'测试参数无效':'测试服务暂不可用'},{status:e instanceof BudgetError?429:e instanceof z.ZodError?400:503});}
 finally{if(acquired)await releaseBudget(id).catch(()=>{});}
}
