import { ExplainTasteRequest } from '@/lib/ai/schemas/ai-request.schema';
import { explainTasteSystemPrompt } from '@/lib/ai/prompts/explain-taste.prompt';
import { callAIMock } from '@/lib/ai/services/ai-client';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = ExplainTasteRequest.parse(body);

    // TODO: replace with real AI call using explainTasteSystemPrompt
    await callAIMock('explain-taste');

    const mock = {
      success: true,
      explanation: `This combination balances sweet and acid using ${parsed.ingredients.join(', ')}.`,
      highlights: ['Sweetness enhanced', 'Easy to drink'],
    };

    return new Response(JSON.stringify(mock), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('explain-taste error', err);
    return new Response(JSON.stringify({ success: false, error: 'Invalid explain-taste request' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
}
