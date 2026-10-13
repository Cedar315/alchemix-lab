import { handleAgentChat } from '@/lib/agent-next/route-handler';
import { POST as legacyPost } from '@/lib/agent/legacy-route';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  // Support already-open clients during rollout and rollback.
  const body = await request.clone().text();
  if (body.length > 120000) return Response.json({ error: '对话过长，请新建对话' }, { status: 413 });
  try {
    const value = JSON.parse(body);
    return value && typeof value === 'object' && 'messages' in value ? handleAgentChat(request) : legacyPost(request);
  } catch { return Response.json({ error: '请求格式不正确' }, { status: 400 }); }
}
