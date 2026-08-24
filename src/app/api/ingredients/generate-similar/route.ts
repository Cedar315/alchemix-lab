import { createSyntheticIngredientCard } from '@/lib/frontend/ingredient-card';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body.name ?? '').trim();

    if (!name) {
      return Response.json({ error: 'name is required' }, { status: 400 });
    }

    return Response.json(createSyntheticIngredientCard({
      name,
      category: body.category ? String(body.category) : undefined,
      description: body.description ? String(body.description) : undefined,
    }));
  } catch (error: any) {
    console.error('POST /api/ingredients/generate-similar error', error);
    return Response.json({ error: 'Ingredient generation failed' }, { status: 500 });
  }
}
