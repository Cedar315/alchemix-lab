import { z } from 'zod';
import prisma from '@/lib/db/prisma';

const SaveRecipeRequest = z.object({
  baseCocktailId: z.union([z.string(), z.number()]).optional(),
  cocktailSlug: z.string().optional(),
  userId: z.string().optional(),
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
    const baseCocktail = body.baseCocktailId
      ? await prisma.cocktail.findUnique({ where: { id: BigInt(String(body.baseCocktailId)) } })
      : body.cocktailSlug
        ? await prisma.cocktail.findUnique({ where: { slug: body.cocktailSlug } })
        : null;

    const recipe = await prisma.customizedRecipe.create({
      data: {
        baseCocktailId: baseCocktail?.id ?? null,
        userId: body.userId ?? null,
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
      },
    });

    for (const [index, item] of body.items.entries()) {
      const ingredient = item.ingredientId
        ? await prisma.ingredient.findUnique({ where: { id: BigInt(String(item.ingredientId)) } })
        : item.ingredientSlug
          ? await prisma.ingredient.findUnique({ where: { slug: item.ingredientSlug } })
          : null;

      await prisma.customizedRecipeItem.create({
        data: {
          recipeId: recipe.id,
          ingredientId: ingredient?.id ?? null,
          nameSnapshot: item.nameSnapshot,
          amountMl: item.amountMl ?? null,
          unit: item.unit,
          note: item.note ?? null,
          order: index + 1,
        },
      });
    }

    return Response.json({ success: true, recipeId: recipe.id.toString() });
  } catch (error: any) {
    console.error('POST /api/recipes/save error', error);
    return Response.json({ success: false, error: error?.message ?? 'Save recipe failed' }, { status: 400 });
  }
}
