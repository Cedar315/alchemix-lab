import { dedupeRecipes, databaseRecipeKey } from '../src/lib/recipes/identity';
import { PrismaClient } from '@prisma/client';
import { CLASSIC_RECIPE_SEEDS, INSPIRATION_RECIPES, REMIX_TAGS, RecipeSeed } from '../src/lib/data/inspiration-catalog';

const prisma = new PrismaClient();

const REMOVED_TAG_NAMES = ['苦甜平衡', '酸甜平衡', '材料好买', '三步完成', '宿舍友好', '聚会友好', '冰爽型'];
const REMOVED_REMIX_SLUGS = ['bitter-sweet', 'sour-sweet', 'easy-to-buy', 'three-steps', 'dorm-friendly', 'party-friendly', 'ice-cold'];

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const tagSlug = (value: string) => `tag-${slugify(value) || Buffer.from(value).toString('hex').slice(0, 16)}`;
const tagCategory = (tag: string) => {
  if (['gin', 'vodka', 'whisky', 'rum', 'tequila', 'beer', 'wine', 'liqueur', 'brandy', 'mezcal', 'sake', 'soju', 'non_alcoholic'].includes(tag)) return 'base_spirit';
  if (['适合新手', '低酒感', '入门友好'].includes(tag)) return 'beginner';
  if (['不用摇壶', '便利店版'].includes(tag)) return 'convenience';
  return 'flavor';
};

const originalRecipeJson = (recipe: RecipeSeed) => ({
  method: recipe.method,
  glassware: recipe.glassware,
  ice: recipe.ice,
  ingredients: recipe.ingredients.map((ingredient) => ({
    name_cn: ingredient.nameCn,
    name_en: ingredient.nameEn,
    amount: ingredient.amount,
    unit: ingredient.unit,
    role: ingredient.role,
    substitute_note: ingredient.substituteNote ?? null,
  })),
});

async function main() {
  console.log('Seeding Inspiration catalog only...');

  await prisma.classicCocktailVariantTag.deleteMany({
    where: { tag: { OR: [{ nameCn: { in: REMOVED_TAG_NAMES } }, { slug: { in: REMOVED_REMIX_SLUGS } }] } },
  });
  await prisma.recipeTag.deleteMany({
    where: { tag: { nameCn: { in: REMOVED_TAG_NAMES } } },
  });
  await prisma.remixTag.deleteMany({
    where: { OR: [{ nameCn: { in: REMOVED_TAG_NAMES } }, { slug: { in: REMOVED_REMIX_SLUGS } }] },
  });
  await prisma.tag.deleteMany({
    where: { nameCn: { in: REMOVED_TAG_NAMES } },
  });

  await prisma.remixTag.createMany({
    data: REMIX_TAGS.map((tag) => ({
      slug: tag.slug,
      nameCn: tag.nameCn,
      nameEn: tag.nameEn,
      description: tag.description,
      sortOrder: tag.sortOrder,
      isActive: true,
    })),
    skipDuplicates: true,
  });

  const uniqueRecipeTags = Array.from(new Set(INSPIRATION_RECIPES.flatMap((recipe) => recipe.tags)));
  await prisma.tag.createMany({
    data: uniqueRecipeTags.map((tag, index) => ({
      slug: tagSlug(tag),
      nameCn: tag,
      nameEn: tag,
      category: tagCategory(tag),
      sortOrder: index + 1,
      isActive: true,
    })),
    skipDuplicates: true,
  });

  await prisma.classicCocktail.createMany({
    data: CLASSIC_RECIPE_SEEDS.map((classic) => ({
      slug: classic.slug,
      nameCn: classic.nameCn,
      nameEn: classic.nameEn,
      description: classic.description,
      baseSpirit: classic.baseSpirit,
      originalRecipe: originalRecipeJson(classic),
      flavorProfile: {
        sweetness: classic.sweetnessLevel,
        acidity: classic.acidityLevel,
        bitterness: classic.bitternessLevel,
        alcohol: classic.alcoholIntensity,
        freshness: classic.freshnessLevel,
        fruitiness: classic.fruitinessLevel,
      },
      difficulty: classic.difficulty,
      isActive: true,
    })),
    skipDuplicates: true,
  });

  const canonicalRecipes = dedupeRecipes(INSPIRATION_RECIPES);
  for (const recipe of canonicalRecipes) {
    const data = {
      canonicalKey: databaseRecipeKey(recipe),
      slug: recipe.slug,
      nameCn: recipe.nameCn,
      nameEn: recipe.nameEn,
      type: recipe.type,
      baseSpirit: recipe.baseSpirit,
      description: recipe.description,
      story: recipe.story ?? null,
      method: recipe.method,
      glassware: recipe.glassware,
      ice: recipe.ice,
      difficulty: recipe.difficulty,
      abvLevel: recipe.abvLevel,
      sweetnessLevel: recipe.sweetnessLevel,
      acidityLevel: recipe.acidityLevel,
      bitternessLevel: recipe.bitternessLevel,
      alcoholIntensity: recipe.alcoholIntensity,
      freshnessLevel: recipe.freshnessLevel,
      fruitinessLevel: recipe.fruitinessLevel,
      convenienceScore: recipe.convenienceScore,
      beginnerScore: recipe.beginnerScore,
      estimatedCostLevel: recipe.estimatedCostLevel,
      prepTimeMinutes: recipe.prepTimeMinutes,
      isPublished: true,
      aiGenerated: false,
    };
    const canonical = data.canonicalKey ? await prisma.recipe.findUnique({where:{canonicalKey:data.canonicalKey}}) : null;
    await prisma.recipe.upsert({where:{slug:canonical?.slug ?? recipe.slug},create:data,update:{...data,slug:canonical?.slug ?? recipe.slug}});
  }

  const recipes = await prisma.recipe.findMany({
    where: { slug: { in: canonicalRecipes.map((recipe) => recipe.slug) } },
    select: { id: true, slug: true },
  });
  const recipeIdBySlug = new Map(recipes.map((recipe) => [recipe.slug, recipe.id]));
  const recipeIds = recipes.map((recipe) => recipe.id);

  await prisma.recipeIngredient.deleteMany({ where: { recipeId: { in: recipeIds } } });
  await prisma.recipeTag.deleteMany({ where: { recipeId: { in: recipeIds } } });

  await prisma.recipeIngredient.createMany({
    data: canonicalRecipes.flatMap((recipe) => {
      const recipeId = recipeIdBySlug.get(recipe.slug);
      if (!recipeId) return [];
      return recipe.ingredients.map((ingredient, index) => ({
        recipeId,
        ingredientNameCn: ingredient.nameCn,
        ingredientNameEn: ingredient.nameEn,
        amount: ingredient.amount,
        unit: ingredient.unit,
        role: ingredient.role,
        isOptional: ingredient.isOptional ?? false,
        substituteNote: ingredient.substituteNote ?? null,
        sortOrder: index + 1,
      }));
    }),
  });

  const tags = await prisma.tag.findMany({
    where: { slug: { in: uniqueRecipeTags.map(tagSlug) } },
    select: { id: true, nameCn: true },
  });
  const tagIdByName = new Map(tags.map((tag) => [tag.nameCn, tag.id]));
  await prisma.recipeTag.createMany({
    data: canonicalRecipes.flatMap((recipe) => {
      const recipeId = recipeIdBySlug.get(recipe.slug);
      if (!recipeId) return [];
      return recipe.tags.flatMap((tag) => {
        const tagId = tagIdByName.get(tag);
        return tagId ? [{ recipeId, tagId }] : [];
      });
    }),
    skipDuplicates: true,
  });

  const classics = await prisma.classicCocktail.findMany({
    where: { slug: { in: CLASSIC_RECIPE_SEEDS.map((recipe) => recipe.slug) } },
    select: { id: true, slug: true },
  });
  const classicIdBySlug = new Map(classics.map((classic) => [classic.slug, classic.id]));
  await prisma.classicCocktailVariant.deleteMany({ where: { cocktailId: { in: classics.map((classic) => classic.id) } } });

  const directionSuffixes = REMIX_TAGS.slice(0, 12).map((tag) => tag.slug);
  const originalSlugForVariant = (slug: string) => {
    const withoutPrefix = slug.replace(/^variant-/, '');
    const suffix = directionSuffixes.find((item) => withoutPrefix.endsWith(`-${item}`));
    return suffix ? withoutPrefix.slice(0, -suffix.length - 1) : withoutPrefix;
  };

  const variantRecords: Array<{ recipe: RecipeSeed; cocktailId: bigint }> = [];
  for (const recipe of INSPIRATION_RECIPES.filter((item) => item.type === 'classic_variant')) {
    const cocktailId = classicIdBySlug.get(originalSlugForVariant(recipe.slug));
    if (cocktailId) variantRecords.push({ recipe, cocktailId });
  }

  await prisma.classicCocktailVariant.createMany({
    data: variantRecords.map(({ recipe, cocktailId }) => ({
      cocktailId,
      titleCn: recipe.nameCn,
      titleEn: recipe.nameEn,
      description: recipe.description,
      formulaNote: recipe.story ?? null,
      method: recipe.method,
      glassware: recipe.glassware,
      ice: recipe.ice,
      abvLevel: recipe.abvLevel,
      sweetnessLevel: recipe.sweetnessLevel,
      acidityLevel: recipe.acidityLevel,
      bitternessLevel: recipe.bitternessLevel,
      alcoholIntensity: recipe.alcoholIntensity,
      convenienceScore: recipe.convenienceScore,
      beginnerScore: recipe.beginnerScore,
      aiGenerated: false,
      isPublished: true,
    })),
  });

  const variants = await prisma.classicCocktailVariant.findMany({
    where: { cocktailId: { in: classics.map((classic) => classic.id) } },
    select: { id: true, titleCn: true },
  });
  const variantIdByTitle = new Map(variants.map((variant) => [variant.titleCn, variant.id]));
  const remixTags = await prisma.remixTag.findMany({ select: { id: true, nameCn: true } });
  const remixTagIdByName = new Map(remixTags.map((tag) => [tag.nameCn, tag.id]));

  await prisma.variantIngredient.createMany({
    data: variantRecords.flatMap(({ recipe }) => {
      const variantId = variantIdByTitle.get(recipe.nameCn);
      if (!variantId) return [];
      return recipe.ingredients.map((ingredient, index) => ({
        variantId,
        ingredientNameCn: ingredient.nameCn,
        ingredientNameEn: ingredient.nameEn,
        amount: ingredient.amount,
        unit: ingredient.unit,
        role: ingredient.role,
        isOptional: ingredient.isOptional ?? false,
        substituteNote: ingredient.substituteNote ?? null,
        sortOrder: index + 1,
      }));
    }),
  });

  await prisma.classicCocktailVariantTag.createMany({
    data: variantRecords.flatMap(({ recipe }) => {
      const variantId = variantIdByTitle.get(recipe.nameCn);
      if (!variantId) return [];
      return recipe.tags.flatMap((tag) => {
        const tagId = remixTagIdByName.get(tag);
        return tagId ? [{ variantId, tagId }] : [];
      });
    }),
    skipDuplicates: true,
  });

  await prisma.classicRecipeVariant.deleteMany({
    where: { originalRecipeId: { in: CLASSIC_RECIPE_SEEDS.flatMap((recipe) => recipeIdBySlug.get(recipe.slug) ?? []) } },
  });
  await prisma.classicRecipeVariant.createMany({
    data: variantRecords.flatMap(({ recipe }) => {
      const originalRecipeId = recipeIdBySlug.get(originalSlugForVariant(recipe.slug));
      const variantRecipeId = recipeIdBySlug.get(recipe.slug);
      if (!originalRecipeId || !variantRecipeId) return [];
      return [{
        originalRecipeId,
        variantRecipeId,
        remixDirection: recipe.tags.slice(0, 2).join(', '),
        changeSummary: recipe.description,
      }];
    }),
    skipDuplicates: true,
  });

  console.log('Inspiration seed completed.');
  console.log(`recipes: ${INSPIRATION_RECIPES.length}`);
  console.log(`classic recipes: ${CLASSIC_RECIPE_SEEDS.length}`);
  console.log(`classic variants: ${variantRecords.length}`);
  console.log(`remix tags: ${REMIX_TAGS.length}`);
}

main()
  .catch((error) => {
    console.error('Inspiration seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
