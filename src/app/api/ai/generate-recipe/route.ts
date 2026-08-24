import { GenerateRecipeRequest } from '@/lib/ai/schemas/ai-request.schema';
import { AICocktailRecipeSchema } from '@/lib/ai/schemas/recipe.schema';
import { generateRecipeFromLabDatabase } from '@/lib/ai/services/recipe-generator';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = GenerateRecipeRequest.parse(body);

    const recipes = await generateRecipeFromLabDatabase(parsed);

    // Validate response structure
    const validated = recipes.map((r) => AICocktailRecipeSchema.parse(r));

    return new Response(JSON.stringify({ success: true, recipes: validated }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('generate-recipe error', err);
    return new Response(JSON.stringify({ success: false, error: 'Invalid recipe request' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
}
