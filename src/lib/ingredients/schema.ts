import { z } from 'zod';

export const IngredientFactSchema = z.object({
  nameZh: z.string().min(1),
  nameEn: z.string().min(1),
  brand: z.string().nullable().optional(),
  aliases: z.array(z.string()).default([]),
  type: z.enum(['alcohol', 'mixer', 'syrup', 'garnish', 'bitter', 'other']).default('mixer'),
  category: z.string().min(1),
  subCategory: z.string().nullable().optional(),
  abv: z.number().min(0).max(100).default(0),
  sweetness: z.number().min(0).max(5).default(1),
  acidity: z.number().min(0).max(5).default(1),
  bitterness: z.number().min(0).max(5).default(1),
  carbonation: z.number().min(0).max(5).default(0),
  viscosity: z.number().min(0).max(5).default(1),
  sugarGPer100ml: z.number().min(0).nullable().optional(),
  caffeine: z.boolean().nullable().optional(),
  ingredients: z.array(z.string()).default([]),
  flavorTags: z.array(z.string()).default([]),
  suitableWith: z.array(z.string()).default([]),
  avoidWith: z.array(z.string()).default([]),
  recommendedVolumeMl: z.array(z.number().positive()).default([60, 90, 120]),
  convenienceStoreAvailability: z.number().int().min(1).max(5).default(3),
  sourceType: z.enum(['local_database', 'ai_web_lookup', 'manual_user_added']).default('ai_web_lookup'),
  confidence: z.enum(['high', 'medium', 'estimated']).default('estimated'),
  isTemporary: z.boolean().default(true),
  sourceNote: z.string().optional(),
});

export type IngredientFact = z.infer<typeof IngredientFactSchema>;

export const slugifyIngredient = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

export const abvRangeFor = (abv: number) => {
  if (abv < 10) return '0-10';
  if (abv < 20) return '10-20';
  if (abv < 40) return '20-40';
  return '40+';
};

export const toIngredientCreateData = (input: IngredientFact) => {
  const parsed = IngredientFactSchema.parse(input);
  const slugBase = parsed.nameEn || parsed.nameZh;

  return {
    slug: slugifyIngredient(`${parsed.brand ?? ''}-${slugBase}`) || slugifyIngredient(parsed.nameZh),
    name: `${parsed.nameZh} / ${parsed.nameEn}`,
    nameZh: parsed.nameZh,
    nameEn: parsed.nameEn,
    brand: parsed.brand ?? null,
    aliases: parsed.aliases,
    type: parsed.type,
    category: parsed.category,
    subCategory: parsed.subCategory ?? null,
    abv: parsed.abv,
    abvRange: abvRangeFor(parsed.abv),
    sweetness: parsed.sweetness,
    acidity: parsed.acidity,
    bitterness: parsed.bitterness,
    carbonation: parsed.carbonation,
    viscosity: parsed.viscosity,
    alcoholIntensity: Math.min(5, Math.round(parsed.abv / 10)),
    sugarGPer100ml: parsed.sugarGPer100ml ?? null,
    caffeine: parsed.caffeine ?? false,
    ingredients: parsed.ingredients,
    flavorTags: parsed.flavorTags,
    suitableWith: parsed.suitableWith,
    avoidWith: parsed.avoidWith,
    recommendedVolumeMl: parsed.recommendedVolumeMl,
    convenienceStoreAvailability: parsed.convenienceStoreAvailability,
    sourceType: parsed.sourceType,
    confidence: parsed.confidence,
    isTemporary: false,
    sourceNote: parsed.sourceNote ?? 'Saved from AI assisted lookup; verify against package label.',
    isAlcoholic: parsed.abv > 0,
  };
};
