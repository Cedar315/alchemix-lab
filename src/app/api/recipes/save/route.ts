import { z } from 'zod';
import prisma from '@/lib/db/prisma';
import { authErrorResponse, requireUser } from '@/lib/auth/current-user';

const SaveRecipeRequest = z.object({
  baseCocktailId: z.union([z.string(), z.number()]).optional(),
  cocktailSlug: z.string().optional(),
  nameZh: z.string().min(1),
  nameEn: z.string().min(1),
  selectedGoals: z.array(z.string()).default([]),
  description: z.string().default(''),
  aiExplanation: z.string().optional(),
  flavorBefore: z.object({
    bitterness: z.number().default(0),
    sweetness: z.number().default(0),
    acidity: z.number().default(0),
    alcohol: z.number().default(0),
    freshness: z.number().default(0),
  }).optional(),
  flavorAfter: z.object({
    bitterness: z.number().default(0),
    sweetness: z.number().default(0),
    acidity: z.number().default(0),
    alcohol: z.number().default(0),
    freshness: z.number().default(0),
  }).optional(),
  items: z.array(z.object({
    ingredientId: z.union([z.string(), z.number()]).optional(),
    ingredientSlug: z.string().optional(),
    nameSnapshot: z.string().min(1),
    amountMl: z.number().optional(),
    unit: z.string().default('ml'),
    note: z.string().optional(),
  })).min(1),
});

export async function POST(req: Request) {
  try {
    const body = SaveRecipeRequest.parse(await req.json());
    const { user } = await requireUser();
    const baseCocktail = body.baseCocktailId
      ? await prisma.cocktail.findUnique({ where: { id: BigInt(String(body.baseCocktailId)) } })
      : body.cocktailSlug
        ? await prisma.cocktail.findUnique({ where: { slug: body.cocktailSlug } })
        : null;

    const recipe = await prisma.$transaction(async (tx) => {
      const created = await tx.customizedRecipe.create({ data: {
        baseCocktailId: baseCocktail?.id ?? null,
        userId: user.id,
        nameZh: body.nameZh,
        nameEn: body.nameEn,
        selectedGoals: body.selectedGoals,
        description: body.description,
        aiExplanation: body.aiExplanation ?? null,
        bitternessBefore: body.flavorBefore?.bitterness ?? 0,
        bitternessAfter: body.flavorAfter?.bitterness ?? 0,
        sweetnessBefore: body.flavorBefore?.sweetness ?? 0,
        sweetnessAfter: body.flavorAfter?.sweetness ?? 0,
        acidityBefore: body.flavorBefore?.acidity ?? 0,
        acidityAfter: body.flavorAfter?.acidity ?? 0,
        alcoholBefore: body.flavorBefore?.alcohol ?? 0,
        alcoholAfter: body.flavorAfter?.alcohol ?? 0,
        freshnessBefore: body.flavorBefore?.freshness ?? 0,
        freshnessAfter: body.flavorAfter?.freshness ?? 0,
        sourceType: 'ai_generated',
      } });

    for (const [index, item] of body.items.entries()) {
      const ingredient = item.ingredientId
        ? await tx.ingredient.findUnique({ where: { id: BigInt(String(item.ingredientId)) } })
        : item.ingredientSlug
          ? await tx.ingredient.findUnique({ where: { slug: item.ingredientSlug } })
          : null;

      await tx.customizedRecipeItem.create({
        data: {
          recipeId: created.id,
          ingredientId: ingredient?.id ?? null,
          nameSnapshot: item.nameSnapshot,
          amountMl: item.amountMl ?? null,
          unit: item.unit,
          note: item.note ?? null,
          order: index + 1,
        },
      });
    }
      return created;
    });

    return Response.json({ success: true, recipeId: recipe.id.toString() });
  } catch (error: any) {
    console.error('POST /api/recipes/save error', error);
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    return Response.json({ success: false, error: error instanceof z.ZodError ? 'Invalid recipe data' : 'Save recipe failed' }, { status: error instanceof z.ZodError ? 400 : 500 });
  }
}
