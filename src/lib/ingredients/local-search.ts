import prisma from '@/lib/db/prisma';

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

export const ingredientHaystack = (ingredient: {
  nameZh?: string | null;
  nameEn?: string | null;
  name?: string | null;
  brand?: string | null;
  category?: string | null;
  subCategory?: string | null;
  aliases?: unknown;
  ingredients?: unknown;
}) => [
  ingredient.nameZh,
  ingredient.nameEn,
  ingredient.name,
  ingredient.brand,
  ingredient.category,
  ingredient.subCategory,
  ...asStringArray(ingredient.aliases),
  ...asStringArray(ingredient.ingredients),
].filter(Boolean).join(' ').toLowerCase();

export async function findLocalIngredientMatches(query: string, take = 20) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const candidates = await prisma.ingredient.findMany({
    where: {
      OR: [
        { nameZh: { contains: query, mode: 'insensitive' } },
        { nameEn: { contains: query, mode: 'insensitive' } },
        { name: { contains: query, mode: 'insensitive' } },
        { brand: { contains: query, mode: 'insensitive' } },
        { slug: { contains: normalized, mode: 'insensitive' } },
        { category: { contains: query, mode: 'insensitive' } },
        { subCategory: { contains: query, mode: 'insensitive' } },
      ],
    },
    orderBy: [{ isTemporary: 'asc' }, { convenienceStoreAvailability: 'desc' }, { id: 'asc' }],
    take,
  });

  const aliasCandidates = candidates.length > 0
    ? candidates
    : await prisma.ingredient.findMany({
        orderBy: [{ convenienceStoreAvailability: 'desc' }, { id: 'asc' }],
        take: 700,
      });

  return aliasCandidates
    .filter((ingredient) => ingredientHaystack(ingredient).includes(normalized))
    .slice(0, take);
}

export function serializeIngredient(ingredient: any) {
  return {
    id: ingredient.id.toString(),
    slug: ingredient.slug,
    nameZh: ingredient.nameZh,
    nameEn: ingredient.nameEn,
    brand: ingredient.brand,
    aliases: asStringArray(ingredient.aliases),
    type: ingredient.type,
    category: ingredient.category,
    subCategory: ingredient.subCategory,
    abv: ingredient.abv,
    abvRange: ingredient.abvRange,
    sweetness: ingredient.sweetness,
    acidity: ingredient.acidity,
    bitterness: ingredient.bitterness,
    carbonation: ingredient.carbonation,
    viscosity: ingredient.viscosity,
    alcoholIntensity: ingredient.alcoholIntensity,
    sugarGPer100ml: ingredient.sugarGPer100ml,
    caffeine: ingredient.caffeine,
    ingredients: asStringArray(ingredient.ingredients),
    flavorTags: asStringArray(ingredient.flavorTags),
    suitableWith: asStringArray(ingredient.suitableWith),
    avoidWith: asStringArray(ingredient.avoidWith),
    recommendedVolumeMl: Array.isArray(ingredient.recommendedVolumeMl) ? ingredient.recommendedVolumeMl : [],
    convenienceStoreAvailability: ingredient.convenienceStoreAvailability,
    sourceType: ingredient.sourceType,
    confidence: ingredient.confidence,
    isTemporary: ingredient.isTemporary,
    sourceNote: ingredient.sourceNote,
  };
}
