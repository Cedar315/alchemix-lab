import { withAgentDiagnostics, timed } from '@/lib/agent/diagnostics';
import { companionInput } from '@/lib/agent/companion-contract';
import { runCompanion, companionPrompt } from '@/lib/agent/companion';
import { modelJSON } from '@/lib/agent/preparation-provider';
import { requireUser, authErrorResponse } from '@/lib/auth/current-user';
import { preparationInput, runPreparation } from '@/lib/agent/preparation';
import { preparationModel } from '@/lib/agent/preparation-provider';
import { searchAndCollect } from '@/lib/knowledge/review/search';
import { ask } from '@/lib/knowledge/rag/service';
import { acquireBudget, releaseBudget, BudgetError } from '@/lib/ai/request-budget';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  const requestId = crypto.randomUUID(), started = Date.now();
  return withAgentDiagnostics(requestId, async () => {
  let acquired = false;
  try {
    const { user } = await timed('auth', () => requireUser());
    if (!request.headers.get('content-type')?.includes('application/json')) return Response.json({ error: '请使用 JSON 格式' }, { status: 415 });
    const text = await request.text();
    if (text.length > 24000) return Response.json({ error: '请求过长' }, { status: 413 });
    let value: unknown; try { value = JSON.parse(text); } catch { return Response.json({ error: '请求格式不正确' }, { status: 400 }); }
    const isCompanion = typeof value === "object" && value !== null && "version" in value && value.version === 2;
    const parsed = isCompanion ? companionInput.safeParse(value) : preparationInput.safeParse(value);
    if (!parsed.success) return Response.json({ error: '请检查问题长度和当前页面信息。' }, { status: 400 });
    await timed('budget', () => acquireBudget(user.id, requestId)); acquired = true;
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(45000)]);
    const result = isCompanion ? await runCompanion(companionInput.parse(parsed.data), { model: (state,s) => modelJSON(companionPrompt,state,s), search: async(q,c,s) => searchAndCollect(q,c.slice(0,6000),s) },signal) : await runPreparation(preparationInput.parse(parsed.data), { model: preparationModel, search: async (q,c,s) => (await ask(q,c.slice(0,6000),3,s)).answer }, signal);
    console.info(JSON.stringify({ event: 'agent_request', requestId, elapsedMs: Date.now()-started, status: result.status, errorCode: 'errorCode' in result ? result.errorCode : undefined, model: result.model, usage: result.usage, trace: result.trace }));
    return Response.json({ ...result, usage: undefined, requestId }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const auth = authErrorResponse(error); if (auth) return auth;
    console.warn(JSON.stringify({ event: 'agent_request', requestId, elapsedMs: Date.now()-started, status: error instanceof BudgetError ? 'limited' : 'error' }));
    return Response.json({ error: error instanceof BudgetError ? '提问较频繁或已有问题处理中，请稍后再试。每日额度在滚动 24 小时内恢复。' : '助手暂时不可用，请稍后重试。', requestId }, { status: error instanceof BudgetError ? 429 : 503 });
  } finally { if (acquired) await releaseBudget(requestId).catch(() => console.warn(JSON.stringify({ event: 'lease_release_failed', requestId }))); }
  });
}
