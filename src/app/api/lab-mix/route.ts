import { analyzeMixologyRecipe, MixologyIngredient } from '@/lib/mixology/engine';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const ingredients = (body.ingredients ?? []) as MixologyIngredient[];
    const mixMethod = body.mixMethod === 'Shake' ? 'Shake' : 'Stir';

    if (!Array.isArray(ingredients) || ingredients.length < 2) {
      return Response.json({ error: 'at least two ingredients are required' }, { status: 400 });
    }

    return Response.json(analyzeMixologyRecipe(ingredients, mixMethod));
  } catch (error: any) {
    console.error('POST /api/lab-mix error', error);
    return Response.json({ error: error?.message ?? 'Lab mix failed' }, { status: 500 });
  }
}
