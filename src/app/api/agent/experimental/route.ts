import { handleAgentChat } from '@/lib/agent-next/route-handler';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  if (process.env.AGENT_EXPERIMENT_ENABLED !== 'true') return Response.json({ error: '试验入口尚未开启' }, { status: 404 });
  return handleAgentChat(request, 'agent-experimental');
}
