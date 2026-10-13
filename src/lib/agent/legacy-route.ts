import { recordTurn } from '@/lib/admin/telemetry';
import { isInternalIdentity } from '@/lib/admin/metrics';
import { withAgentDiagnostics, timed, diagnosticEntries } from '@/lib/agent/diagnostics';
import { companionInput } from '@/lib/agent/companion-contract';
import { runCompanion, companionPrompt } from '@/lib/agent/companion';
import { companionToolModel } from '@/lib/agent/preparation-provider';
import { requireUser, authErrorResponse } from '@/lib/auth/current-user';
import { preparationInput, runPreparation } from '@/lib/agent/preparation';
import { preparationModel, modelJSON } from '@/lib/agent/preparation-provider';
import { searchAndCollect } from '@/lib/knowledge/review/search';
import { ask } from '@/lib/knowledge/rag/service';
import { acquireBudget, releaseBudget, BudgetError } from '@/lib/ai/request-budget';
export async function POST(request: Request) {
  const requestId = crypto.randomUUID(), started = Date.now();
  return withAgentDiagnostics(requestId, async () => {
  let acquired = false;
  let capture: {userId:string;clientId:string;internal:boolean;surface:string;question:string;context?:unknown}|null=null;
  try {
    const { user, authUser } = await timed('auth', () => requireUser());
    if (!request.headers.get('content-type')?.includes('application/json')) return Response.json({ error: '请使用 JSON 格式' }, { status: 415 });
    const text = await request.text();
    if (text.length > 24000) return Response.json({ error: '请求过长' }, { status: 413 });
    let value: unknown; try { value = JSON.parse(text); } catch { return Response.json({ error: '请求格式不正确' }, { status: 400 }); }
    const isCompanion = typeof value === "object" && value !== null && "version" in value && value.version === 2;
    const parsed = isCompanion ? companionInput.safeParse(value) : preparationInput.safeParse(value);
    if (!parsed.success) return Response.json({ error: '请检查问题长度和当前页面信息。' }, { status: 400 });
    const v = parsed.data;
    const clientId = isCompanion ? companionInput.parse(v).taskId : request.headers.get('x-task-id')?.slice(0,100) || requestId;
    capture={userId:user.id,clientId,internal:isInternalIdentity(user.email,authUser.app_metadata),surface:isCompanion ? companionInput.parse(v).page.kind : 'ask',question:v.question,context:'page' in v ? v.page : 'context' in v ? v.context : undefined};
    await timed('budget', () => acquireBudget(user.id, requestId)); acquired = true;
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(45000)]);
    const result = isCompanion ? await runCompanion(companionInput.parse(parsed.data), { model: (state,s) => companionToolModel(companionPrompt,state,s), followup:modelJSON, reviewRescue:modelJSON, search: async(q,c,s) => searchAndCollect(q,c.slice(0,6000),s) },signal) : await runPreparation(preparationInput.parse(parsed.data), { model: preparationModel, search: async (q,c,s) => (await ask(q,c.slice(0,6000),3,s)).answer }, signal);
    console.info(JSON.stringify({ event: 'agent_request', requestId, elapsedMs: Date.now()-started, status: result.status, errorCode: 'errorCode' in result ? result.errorCode : undefined, model: result.model, usage: result.usage, trace: result.trace }));
    await recordTurn({ ...capture, id:requestId, result, elapsed:Date.now()-started, diagnostics:diagnosticEntries() });
    return Response.json({ ...result, usage: undefined, requestId }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const auth = authErrorResponse(error); if (auth) return auth;
    if(capture) await recordTurn({...capture,id:requestId,result:{status:error instanceof BudgetError?'limited':'error'},elapsed:Date.now()-started,diagnostics:diagnosticEntries()});
    console.warn(JSON.stringify({ event: 'agent_request', requestId, elapsedMs: Date.now()-started, status: error instanceof BudgetError ? 'limited' : 'error' }));
    return Response.json({ error: error instanceof BudgetError ? '提问较频繁或已有问题处理中，请稍后再试。每日额度在滚动 24 小时内恢复。' : '助手暂时不可用，请稍后重试。', requestId }, { status: error instanceof BudgetError ? 429 : 503 });
  } finally { if (acquired) await releaseBudget(requestId).catch(() => console.warn(JSON.stringify({ event: 'lease_release_failed', requestId }))); }
  });
}
