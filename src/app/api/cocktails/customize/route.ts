import { z } from 'zod';
import prisma from '@/lib/db/prisma';
import { callMiniMaxJson } from '@/lib/ai/services/ai-client';
import { authErrorResponse, requireUser } from '@/lib/auth/current-user';

const CustomizeRequest = z.object({
  slug: z.string().optional(),
  cocktailSlug: z.string().optional(),
  baseCocktailId: z.union([z.string(), z.number()]).optional(),
  selectedGoals: z.array(z.string()).default([]),
  save: z.boolean().default(false),
});

type CustomItem = {
  nameSnapshot: string;
  ingredientSlug?: string;
  amountMl?: number;
  unit?: string;
  note?: string;
};

const buildFallbackRecipe = (cocktail: any, selectedGoals: string[]) => {
  const wantsLowerAlcohol = selectedGoals.some((goal) => /降低酒感|适合新手|便利店版/.test(goal));
  const wantsLessBitter = selectedGoals.some((goal) => /少苦一点|适合新手/.test(goal));
  const wantsFresh = selectedGoals.some((goal) => /清爽一点|便利店版/.test(goal));

  const baseItems = cocktail.ingredients.map((item: any) => ({
    nameSnapshot: item.ingredient.nameZh || item.ingredient.nameEn,
    ingredientSlug: item.ingredient.slug,
    amountMl: Math.max(5, Math.round((item.amountMl ?? 15) * (wantsLowerAlcohol && item.ingredient.abv > 0 ? 0.65 : 1))),
    unit: item.unit,
    note: item.note ?? undefined,
  }));

  const extraItems: CustomItem[] = wantsFresh
    ? [{ nameSnapshot: '苏打水', ingredientSlug: 'soda-water', amountMl: 90, unit: 'ml', note: '按口感调整' }]
    : [];

  return {
    nameZh: `定制版${cocktail.nameZh}`,
    nameEn: `CUSTOMIZED ${cocktail.nameEn.toUpperCase()}`,
    description: `已根据「${selectedGoals.join('、') || '默认'}」重置配比。`,
    aiExplanation: wantsLowerAlcohol
      ? '降低高度酒和苦味材料占比，并用气泡/软饮拉长口感，让入口更轻。'
      : '保留原始结构，仅做轻微便利店化调整。',
    tags: [
      wantsLowerAlcohol ? '#低酒感' : '#经典结构',
      wantsLessBitter ? '#苦味降低' : '#风味保留',
      wantsFresh ? '#清爽气泡' : '#短饮风格',
    ],
    items: [...baseItems, ...extraItems],
    flavorAfter: {
      bitterness: Math.max(0, cocktail.bitterness - (wantsLessBitter ? 1.5 : 0.5)),
      sweetness: Math.min(5, cocktail.sweetness + (selectedGoals.includes('甜一点') ? 1 : 0)),
      acidity: cocktail.acidity,
      alcohol: Math.max(0, cocktail.alcoholIntensity - (wantsLowerAlcohol ? 1.5 : 0.5)),
      freshness: Math.min(5, cocktail.freshness + (wantsFresh ? 1.5 : 0.5)),
    },
  };
};

const safetyFor = (recipe: any, rules: any[]) => {
  const items = recipe.items ?? [];
  const hasCaffeine = items.some((item: CustomItem) => /咖啡|红牛|Monster|茶|coffee|energy/i.test(item.nameSnapshot));
  const hasAlcohol = items.some((item: CustomItem) => !/苏打|果汁|茶|咖啡|牛奶|椰|糖浆|soda|juice|tea|coffee|milk/i.test(item.nameSnapshot));
  const highSugar = items.some((item: CustomItem) => /糖浆|可乐|雪碧|果汁|蜜|syrup|cola|sprite|juice/i.test(item.nameSnapshot));
  const dairyCitrus = items.some((item: CustomItem) => /奶|椰奶|milk|cream/i.test(item.nameSnapshot)) &&
    items.some((item: CustomItem) => /柠檬|青柠|西柚|lemon|lime|grapefruit/i.test(item.nameSnapshot));

  return rules.filter((rule) => {
    if (rule.ruleKey === 'caffeine_alcohol_warning') return hasCaffeine && hasAlcohol;
    if (rule.ruleKey === 'high_sugar_warning') return highSugar;
    if (rule.ruleKey === 'dairy_citrus_warning') return dairyCitrus;
    if (rule.ruleKey === 'beginner_bitter_warning') return recipe.flavorAfter?.bitterness >= 4;
    if (rule.ruleKey === 'high_abv_warning') return recipe.flavorAfter?.alcohol >= 4;
    return false;
  }).map((rule) => ({ key: rule.ruleKey, title: rule.title, description: rule.description, severity: rule.severity }));
};

export async function POST(req: Request) {
  try {
    const body = CustomizeRequest.parse(await req.json());
    const slug = body.slug ?? body.cocktailSlug;

    const cocktail = await prisma.cocktail.findFirst({
      where: body.baseCocktailId
        ? { id: BigInt(String(body.baseCocktailId)) }
        : { slug },
      include: {
        ingredients: {
          include: { ingredient: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!cocktail) {
      return Response.json({ success: false, error: 'cocktail not found' }, { status: 404 });
    }

    let generated: any;
    let sourceType = 'minimax';

    try {
      generated = await callMiniMaxJson([
        {
          role: 'system',
          content: 'You customize classic cocktails using only the database context provided. Return JSON only. Do not write to any database.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: 'Generate a customized classic cocktail recipe.',
            cocktail: {
              nameZh: cocktail.nameZh,
              nameEn: cocktail.nameEn,
              bitterness: cocktail.bitterness,
              sweetness: cocktail.sweetness,
              acidity: cocktail.acidity,
              alcoholIntensity: cocktail.alcoholIntensity,
              freshness: cocktail.freshness,
            },
            originalRecipe: cocktail.ingredients.map((item) => ({
              ingredientSlug: item.ingredient.slug,
              nameZh: item.ingredient.nameZh,
              nameEn: item.ingredient.nameEn,
              amountMl: item.amountMl,
              unit: item.unit,
              role: item.role,
            })),
            selectedGoals: body.selectedGoals,
            requiredShape: {
              nameZh: 'string',
              nameEn: 'string',
              description: 'string',
              aiExplanation: 'string',
              tags: ['string'],
              flavorAfter: { bitterness: 'number 0-5', sweetness: 'number 0-5', acidity: 'number 0-5', alcohol: 'number 0-5', freshness: 'number 0-5' },
              items: [{ nameSnapshot: 'string', ingredientSlug: 'string optional', amountMl: 'number optional', unit: 'string', note: 'string optional' }],
            },
          }),
        },
      ]);
    } catch (error) {
      sourceType = 'local_fallback';
      generated = buildFallbackRecipe(cocktail, body.selectedGoals);
    }

    const rules = await prisma.safetyRule.findMany();
    const safetyWarnings = safetyFor(generated, rules);

    let savedRecipeId: string | null = null;
    if (body.save) {
      const { user } = await requireUser();
      const recipe = await prisma.customizedRecipe.create({
        data: {
          baseCocktailId: cocktail.id,
          userId: user.id,
          nameZh: generated.nameZh ?? `定制版${cocktail.nameZh}`,
          nameEn: generated.nameEn ?? `CUSTOMIZED ${cocktail.nameEn.toUpperCase()}`,
          selectedGoals: body.selectedGoals,
          description: generated.description ?? '',
          aiExplanation: generated.aiExplanation ?? null,
          bitternessBefore: cocktail.bitterness,
          bitternessAfter: generated.flavorAfter?.bitterness ?? cocktail.bitterness,
          sweetnessBefore: cocktail.sweetness,
          sweetnessAfter: generated.flavorAfter?.sweetness ?? cocktail.sweetness,
          acidityBefore: cocktail.acidity,
          acidityAfter: generated.flavorAfter?.acidity ?? cocktail.acidity,
          alcoholBefore: cocktail.alcoholIntensity,
          alcoholAfter: generated.flavorAfter?.alcohol ?? cocktail.alcoholIntensity,
          freshnessBefore: cocktail.freshness,
          freshnessAfter: generated.flavorAfter?.freshness ?? cocktail.freshness,
          sourceType,
        },
      });

      for (const [index, item] of ((generated.items ?? []) as CustomItem[]).entries()) {
        const ingredient = item.ingredientSlug
          ? await prisma.ingredient.findUnique({ where: { slug: item.ingredientSlug } })
          : null;
        await prisma.customizedRecipeItem.create({
          data: {
            recipeId: recipe.id,
            ingredientId: ingredient?.id ?? null,
            nameSnapshot: item.nameSnapshot,
            amountMl: item.amountMl ?? null,
            unit: item.unit ?? 'ml',
            note: item.note ?? null,
            order: index + 1,
          },
        });
      }
      savedRecipeId = recipe.id.toString();
    }

    return Response.json({
      success: true,
      sourceType,
      savedRecipeId,
      recipe: {
        ...generated,
        baseCocktail: {
          id: cocktail.id.toString(),
          slug: cocktail.slug,
          nameZh: cocktail.nameZh,
          nameEn: cocktail.nameEn,
        },
        flavorBefore: {
          bitterness: cocktail.bitterness,
          sweetness: cocktail.sweetness,
          acidity: cocktail.acidity,
          alcohol: cocktail.alcoholIntensity,
          freshness: cocktail.freshness,
        },
        safetyWarnings,
      },
    });
  } catch (error: any) {
    console.error('POST /api/cocktails/customize error', error);
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    return Response.json({ success: false, error: error instanceof z.ZodError ? 'Invalid customization request' : 'Customize cocktail failed' }, { status: error instanceof z.ZodError ? 400 : 500 });
  }
}
