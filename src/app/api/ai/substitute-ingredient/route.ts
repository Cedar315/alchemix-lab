import { SubstituteIngredientRequest } from '@/lib/ai/schemas/ai-request.schema';
import { callAIMock } from '@/lib/ai/services/ai-client';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = SubstituteIngredientRequest.parse(body);

    // TODO: replace with DB lookups and AI scoring
    await callAIMock('substitute-ingredient');

    const mock = {
      success: true,
      substitutes: [
        {
          name: 'Fanta Orange',
          ratio_adjustment: 'Increase orange to compensate sweetness',
          flavor_matching_score: 4,
          store_availability: '5/5',
          explanation: 'Fanta provides citrus sweetness similar to orange liqueur.',
        },
      ],
    };

    return new Response(JSON.stringify(mock), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('substitute-ingredient error', err);
    return new Response(JSON.stringify({ success: false, error: 'Invalid substitution request' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
}
