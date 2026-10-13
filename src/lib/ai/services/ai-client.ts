import { chatConfig } from '../provider-config';
// The configured AI provider is only called from Next.js server code. It never receives direct
// database credentials and never writes to Supabase by itself.

export async function callAIMock(prompt: string, timeout = 500) {
  await new Promise((r) => setTimeout(r, timeout));
  return { ok: true, text: 'MOCK_RESPONSE' };
}

export async function callAIJson<T>(messages: Array<{ role: 'system' | 'user'; content: string }>): Promise<T> {
  const {key:apiKey,endpoint,model,options} = chatConfig();

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      ...options,
      messages,
      temperature: 0.3,
      stream: false,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status}`);
  }

  const payload = await response.json();
  const content =
    payload?.choices?.[0]?.message?.content ??
    payload?.reply ??
    payload?.text ??
    payload?.data?.message;

  if (typeof content !== 'string') {
    throw new Error('AI response did not contain JSON text');
  }

  return JSON.parse(content) as T;
}

export default { callAIMock, callAIJson };
