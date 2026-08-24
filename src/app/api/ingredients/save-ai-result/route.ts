import prisma from '@/lib/db/prisma';
import { IngredientFactSchema, toIngredientCreateData } from '@/lib/ingredients/schema';
import { authErrorResponse, requireAdmin } from '@/lib/auth/current-user';

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json();
    const lookupLogId = body.lookupLogId ? BigInt(String(body.lookupLogId)) : null;
    const parsed = IngredientFactSchema.parse({
      ...(body.ingredient ?? body),
      sourceType: 'ai_web_lookup',
      isTemporary: false,
    });

    const createData = toIngredientCreateData(parsed);
    const ingredient = await prisma.ingredient.upsert({
      where: { slug: createData.slug },
      update: createData,
      create: createData,
    });

    if (lookupLogId) {
      await prisma.ingredientLookupLog.update({
        where: { id: lookupLogId },
        data: {
          matchedIngredientId: ingredient.id,
          savedToIngredient: true,
        },
      }).catch(() => null);
    }

    return Response.json({
      success: true,
      ingredient: {
        ...ingredient,
        id: ingredient.id.toString(),
      },
    });
  } catch (error: any) {
    console.error('POST /api/ingredients/save-ai-result error', error);
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    return Response.json({ success: false, error: 'Save AI result failed' }, { status: 400 });
  }
}
