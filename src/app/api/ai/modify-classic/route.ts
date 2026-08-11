import { ModifyClassicRequest } from '@/lib/ai/schemas/ai-request.schema';
import { remixClassicMock } from '@/lib/ai/services/classic-remix';
import { AICocktailRecipeSchema } from '@/lib/ai/schemas/recipe.schema';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = ModifyClassicRequest.parse(body);

    // TODO: replace with real remix service and DB lookups
    const result = await remixClassicMock(parsed);
    const validated = AICocktailRecipeSchema.parse(result);

    return new Response(JSON.stringify({ success: true, recipe: validated }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('modify-classic error', err);
    return new Response(JSON.stringify({ success: false, error: err?.message || 'Invalid request' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
}
