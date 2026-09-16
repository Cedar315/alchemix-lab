import { z } from 'zod';
import { requireUser, authErrorResponse } from '@/lib/auth/current-user';
import { ask } from '@/lib/knowledge/rag/service';
import { RagError } from '@/lib/knowledge/rag/core';
import { acquireBudget, releaseBudget, BudgetError } from '@/lib/ai/request-budget';
const schema = z.object({ question: z.string().trim().min(1).max(1000), context: z.string().max(2000).default(''), history: z.array(z.object({ role: z.enum(['user','assistant']), content: z.string().max(2000) }).strict()).max(6).default([]) }).strict();
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  const requestId = crypto.randomUUID(), started = Date.now(); let acquired = false;
  try {
    const { user } = await requireUser();
    if (!request.headers.get('content-type')?.includes('application/json')) return Response.json({ error: '请求格式不正确' }, { status: 415 });
    const text = await request.text();
    if (text.length > 18000) return Response.json({ error: '问题过长，请缩短后再试。' }, { status: 413 });
    let body: unknown; try { body = JSON.parse(text); } catch { return Response.json({ error: '请求格式不正确' }, { status: 400 }); }
    const parsed = schema.safeParse(body);
    if (!parsed.success) return Response.json({ error: '请检查问题和上下文长度。' }, { status: 400 });
    await acquireBudget(user.id,requestId); acquired = true;
    const result = await ask(parsed.data.question, JSON.stringify({ recipeContext: parsed.data.context, history: parsed.data.history }), 3, AbortSignal.any([request.signal, AbortSignal.timeout(45000)]));
    console.info(JSON.stringify({ event: 'rag_request', requestId, elapsedMs: Date.now()-started, status: result.answer.status, model: result.answer.model, usage: result.answer.usage, embeddingUsage: result.embeddingUsage, citations: result.answer.citations.map(c => c.id) }));
    return Response.json({ answer: { status: result.answer.status, claims: result.answer.claims, citations: result.answer.citations }, requestId }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const auth = authErrorResponse(error); if (auth) return auth;
    console.warn(JSON.stringify({ event: 'rag_request', requestId, elapsedMs: Date.now()-started, status: error instanceof BudgetError ? 'limited' : error instanceof RagError ? error.code : 'error' }));
    return Response.json({ error: error instanceof BudgetError ? '提问较频繁或已有问题处理中，请稍后再试。每日额度在滚动 24 小时内恢复。' : error instanceof RagError && error.code === 'INDEX_NOT_READY' ? '知识正在更新，请稍后再试。' : '暂时无法回答，请稍后重试。', requestId }, { status: error instanceof BudgetError ? 429 : 503 });
  } finally { if (acquired) await releaseBudget(requestId).catch(() => console.warn(JSON.stringify({ event: 'lease_release_failed', requestId }))); }
}
