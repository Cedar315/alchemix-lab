import { audit } from '@/lib/admin/telemetry';
import { randomUUID } from 'node:crypto';
import { requireAdmin, authErrorResponse } from '@/lib/auth/current-user';
import { inputSchema, RagError } from '@/lib/knowledge/rag/core';
import { ingest, retrieve, ask } from '@/lib/knowledge/rag/service';

export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  const requestId = randomUUID();
  const start = Date.now();
  try {
    const {user}=await requireAdmin();
    if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'来源不匹配'},{status:403});
    if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "仅接受 application/json", requestId }, { status: 415 });
    const text = await request.text();
    if (text.length > 16000) return Response.json({ error: '请求过长', requestId }, { status: 413 });
    let body: unknown;
    try { body = JSON.parse(text); } catch { return Response.json({ error: '无效 JSON', requestId }, { status: 400 }); }
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) return Response.json({ error: '请求参数无效', details: parsed.error.flatten(), requestId }, { status: 400 });
    const { action, question, context, topK } = parsed.data;
    await audit(user.id,'attempt_rag_'+action,requestId);
    const result = action === 'ingest' ? await ingest() : action === 'retrieve' ? await retrieve(question!, topK, context) : await ask(question!, context, topK);
    return Response.json({ ...result, requestId, elapsedMs: Date.now() - start }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    if (error instanceof RagError) return Response.json({ error: error.message, code: error.code, requestId }, { status: error.status });
    // Avoid returning credentials, database connection details, or raw provider errors.
    console.error('RAG request failed', { requestId, type: error instanceof Error ? error.name : 'unknown' });
    return Response.json({ error: 'RAG 后台暂不可用。请检查数据库迁移和服务端日志。', code: 'BACKEND_UNAVAILABLE', requestId }, { status: 503 });
  }
}
