import prisma from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ingredients = await prisma.ingredient.findMany({
      orderBy: { id: 'asc' },
    });

    const serializedIngredients = ingredients.map((ingredient) => ({
      ...ingredient,
      id: ingredient.id.toString(),
    }));

    return new Response(JSON.stringify({ success: true, ingredients: serializedIngredients }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('GET /api/lab/ingredients error', error);
    return new Response(JSON.stringify({ success: false, error: 'Database read failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
