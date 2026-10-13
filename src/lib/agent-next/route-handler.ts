import { convertToModelMessages, createUIMessageStreamResponse, validateUIMessages } from 'ai';
import { z } from 'zod';
import { requireUser, authErrorResponse } from '@/lib/auth/current-user';
import { acquireBudget, releaseBudget, BudgetError } from '@/lib/ai/request-budget';
import { recordTurn } from '@/lib/admin/telemetry';
import { isInternalIdentity } from '@/lib/admin/metrics';
import { startAgent } from '@/lib/agent-next/runtime';
import { agentUIStream } from './ui-stream';

const bodySchema = z.object({ id: z.string().min(1).max(100), context: z.string().max(16000).default(''), messages: z.array(z.unknown()).min(1).max(40) });

export async function handleAgentChat(request: Request, surface = 'agent') {
  const requestId = crypto.randomUUID(), started = Date.now();
  let acquired = false;
  const release = async () => { if (acquired) { acquired = false; await releaseBudget(requestId).catch(() => console.warn('agent_next_lease_release_failed')); } };
  try {
    const { user, authUser } = await requireUser();
    if (!request.headers.get('content-type')?.includes('application/json')) return Response.json({ error: '请使用 JSON' }, { status: 415 });
    const raw = await request.text();
    if (raw.length > 120000) return Response.json({ error: '对话过长，请新建对话' }, { status: 413 });
    let input: z.infer<typeof bodySchema>;
    let messages;
    try {
      input = bodySchema.parse(JSON.parse(raw));
      messages = await validateUIMessages({ messages: input.messages });
      if (messages.some(m => !['user', 'assistant'].includes(m.role)) || messages.at(-1)?.role !== 'user') throw Error();
      // Client history is untrusted. Never replay client-supplied tool results as server evidence.
      messages = messages.map(m => ({ ...m, parts: m.parts.filter(p => p.type === 'text') })).filter(m => m.role === 'user' || m.parts.length > 0);
      if (messages.some(m => !m.parts.length || m.parts.some(p => p.type === 'text' && p.text.length > 12000))) throw Error();
    } catch { return Response.json({ error: '消息格式无效或过长' }, { status: 400 }); }
    const statements = messages.filter(m => m.role === 'user').map(m => m.parts.flatMap(p => p.type === 'text' ? [p.text] : []).join('\n'));
    await acquireBudget(user.id, requestId); acquired = true;
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(45000)]);
    const result = startAgent({ messages: await convertToModelMessages(messages), context: input.context, userStatements: statements, signal });
    const stream = agentUIStream(result, requestId, statements, async (failed, cancelled) => {
        try {
          const steps = await result.steps;
          await release();
          await recordTurn({ id: requestId, userId: user.id, clientId: input.id, internal: isInternalIdentity(user.email, authUser.app_metadata), surface, question: statements.at(-1) || '', context: input.context, elapsed: Date.now() - started,
            result: { status: cancelled ? 'cancelled' : failed ? 'error' : 'answered', message: await Promise.resolve(result.output).then(o => o.message).catch(() => ''), model: process.env.DEEPSEEK_MODEL || 'deepseek-flash', usage: await result.usage, trace: steps.flatMap(s => s.toolResults.map(t => ({ tool: t.toolName, status: t.output && typeof t.output === 'object' && 'status' in t.output ? t.output.status : 'completed' }))) } });
        } catch { console.warn(JSON.stringify({ event: 'agent_next_finish_failed', requestId })); }
        finally { await release(); }
    });
    // Release on disconnect as well as normal completion; never release at response creation.
    request.signal.addEventListener('abort', () => { void release(); }, { once: true });
    return createUIMessageStreamResponse({ stream, headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId } });
  } catch (error) {
    await release();
    return authErrorResponse(error) || Response.json({ error: error instanceof BudgetError ? '提问较频繁或已有问题处理中，请稍后重试。' : '助手暂时不可用，请稍后重试。', requestId }, { status: error instanceof BudgetError ? 429 : 503 });
  }
}
