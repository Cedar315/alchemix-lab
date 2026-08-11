// MiniMax is only called from Next.js server code. It never receives direct
// database credentials and never writes to Supabase by itself.

export async function callAIMock(prompt: string, timeout = 500) {
  await new Promise((r) => setTimeout(r, timeout));
  return { ok: true, text: 'MOCK_RESPONSE' };
}

export async function callMiniMaxJson<T>(messages: Array<{ role: 'system' | 'user'; content: string }>): Promise<T> {
  const apiKey = process.env.MINIMAX_API_KEY;
  const endpoint = process.env.MINIMAX_API_URL ?? 'https://api.minimax.chat/v1/text/chatcompletion_v2';
  const model = process.env.MINIMAX_MODEL ?? 'abab6.5s-chat';

  if (!apiKey) {
    throw new Error('MINIMAX_API_KEY is not configured');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      stream: false,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`MiniMax request failed: ${response.status}`);
  }

  const payload = await response.json();
  const content =
    payload?.choices?.[0]?.message?.content ??
    payload?.reply ??
    payload?.text ??
    payload?.data?.message;

  if (typeof content !== 'string') {
    throw new Error('MiniMax response did not contain JSON text');
  }

  return JSON.parse(content) as T;
}

export default { callAIMock, callMiniMaxJson };
