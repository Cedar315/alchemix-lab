import prisma from '@/lib/db/prisma';
import { findLocalIngredientMatches, serializeIngredient } from '@/lib/ingredients/local-search';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const query = String(body.query ?? '').trim();

    if (!query) {
      return Response.json({ success: true, localMatched: false, ingredients: [] });
    }

    const matches = await findLocalIngredientMatches(query);

    const localMatched = matches.length > 0;
    await prisma.ingredientLookupLog.create({
      data: {
        query,
        localMatched,
        matchedIngredientId: matches[0]?.id ?? null,
        aiUsed: false,
        savedToIngredient: false,
      },
    });

    return Response.json({
      success: true,
      localMatched,
      message: localMatched ? '已从本地配料库匹配' : '本地配料库暂未收录该饮品',
      ingredients: matches.map(serializeIngredient),
    });
  } catch (error: any) {
    console.error('POST /api/ingredients/search error', error);
    return Response.json({ success: false, error: 'Ingredient search failed' }, { status: 500 });
  }
}
