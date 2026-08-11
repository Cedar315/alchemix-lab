import { Ingredient } from '@/types';

type LabIngredientRecord = {
  id: bigint;
  slug: string;
  name: string;
  category: string;
  isAlcoholic: boolean;
  createdAt: Date;
  flavorProfile?: {
    sweetness: number;
    sourness: number;
    bitterness: number;
    alcoholStrength: number;
    freshness: number;
    fruitiness: number;
    teaLevel: number;
    dairyLevel: number;
    body: number;
    aromaTags: unknown;
    flavorTags: unknown;
  } | null;
  products?: Array<{
    product?: {
      brand: string;
      abv: number;
      carbonationLevel: number;
      sugarContentPer100ml?: number | null;
      caffeineContentPer100ml?: number | null;
      ingredientListText?: string | null;
    };
  }>;
};

const displayNames: Record<string, string> = {
  vodka: '伏特加 Vodka',
  gin: '金酒 Gin',
  whisky: '威士忌 Whisky',
  rum: '朗姆酒 Rum',
  tequila: '龙舌兰 Tequila',
  jagermeister: '野格 Jägermeister',
  baijiu: '白酒 Baijiu',
  beer: '啤酒 Beer',
  soju: '烧酒 Soju',
  sprite: '雪碧 Sprite',
  'coca-cola': '可口可乐 Coca-Cola',
  'tonic-water': '汤力水 Tonic',
  'soda-water': '苏打水 Soda',
  yakult: '养乐多 Yakult',
  'red-bull': '红牛 Red Bull',
  'oolong-tea': '乌龙茶 Oolong Tea',
  lemon: '柠檬 Lemon',
  lime: '青柠 Lime',
  mint: '薄荷 Mint',
  ice: '冰块 Ice',
};

const categoryMap: Record<string, string> = {
  spirit: '基酒',
  soda: '气泡饮料',
  mixer: '气泡饮料',
  juice: '果汁',
  tea: '茶饮',
  dairy: '乳酸饮料',
  'dairy-like': '乳酸饮料',
  coffee: '茶饮',
  fruit: '辅料',
  addition: '辅料',
  energy: '气泡饮料',
};

const normalizeTags = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
};

export const keywordToSlug = (query: string) => {
  const normalized = query.toLowerCase();
  const pairs: Array<[string, string]> = [
    ['伏特加', 'vodka'],
    ['vodka', 'vodka'],
    ['金酒', 'gin'],
    ['gin', 'gin'],
    ['威士忌', 'whisky'],
    ['whisky', 'whisky'],
    ['whiskey', 'whisky'],
    ['朗姆', 'rum'],
    ['rum', 'rum'],
    ['野格', 'jagermeister'],
    ['jager', 'jagermeister'],
    ['雪碧', 'sprite'],
    ['sprite', 'sprite'],
    ['可乐', 'coca-cola'],
    ['cola', 'coca-cola'],
    ['汤力', 'tonic-water'],
    ['tonic', 'tonic-water'],
    ['苏打', 'soda-water'],
    ['soda', 'soda-water'],
    ['养乐多', 'yakult'],
    ['yakult', 'yakult'],
    ['红牛', 'red-bull'],
    ['red bull', 'red-bull'],
    ['乌龙', 'oolong-tea'],
    ['oolong', 'oolong-tea'],
    ['柠檬', 'lemon'],
    ['lemon', 'lemon'],
    ['青柠', 'lime'],
    ['lime', 'lime'],
    ['薄荷', 'mint'],
    ['mint', 'mint'],
    ['冰', 'ice'],
    ['ice', 'ice'],
  ];

  return pairs.find(([keyword]) => normalized.includes(keyword))?.[1];
};

export const toIngredientCard = (record: LabIngredientRecord): Ingredient => {
  const profile = record.flavorProfile;
  const product = record.products?.[0]?.product;
  const aromaTags = normalizeTags(profile?.aromaTags);
  const flavorTags = normalizeTags(profile?.flavorTags);
  const carbonation = product?.carbonationLevel ?? (record.category === 'soda' ? 3 : 0);
  const sugar = product?.sugarContentPer100ml ?? undefined;

  return {
    id: record.id.toString(),
    name: displayNames[record.slug] ?? record.name,
    brand: product?.brand ?? 'AlcheMix Lab',
    category: categoryMap[record.category] ?? record.category,
    source: 'official',
    ingredientsText: product?.ingredientListText ?? undefined,
    abv: product?.abv ?? (record.isAlcoholic ? 40 : 0),
    nutrition: {
      sugar_g_per_100ml: sugar,
      caffeine_mg_per_100ml: product?.caffeineContentPer100ml ?? undefined,
    },
    flavorProfile: {
      sweetness: profile?.sweetness ?? 1,
      acidity: profile?.sourness ?? 1,
      bitterness: profile?.bitterness ?? 1,
      carbonation,
      dairy: profile?.dairyLevel ?? 0,
      tea: profile?.teaLevel ?? 0,
      fruit: profile?.fruitiness ?? 0,
      body: profile?.body ?? 1,
      freshness: profile?.freshness ?? 1,
    },
    sweetness: profile?.sweetness ?? 1,
    acidity: profile?.sourness ?? 1,
    bitterness: profile?.bitterness ?? 1,
    carbonation,
    body: profile?.body ?? 1,
    viscosity: profile?.body ?? 1,
    dairyFeeling: profile?.dairyLevel ?? 0,
    alcoholFeel: profile?.alcoholStrength ?? 0,
    notes: flavorTags.join(', '),
    nutritionText: sugar === undefined ? undefined : `Sugar ${sugar}g / 100ml`,
    flavorTags,
    aromaTags,
    textureTags: carbonation >= 3 ? ['bubbly'] : [],
    dominantCompounds: [...aromaTags, ...flavorTags].slice(0, 5),
    goodWith: [],
    riskyWith: [],
    dataSource: 'preset',
    confidence: 0.92,
    lastVerifiedAt: new Date().toISOString().slice(0, 10),
    createdAt: record.createdAt.toISOString(),
  };
};

export const createSyntheticIngredientCard = (input: {
  name: string;
  category?: string;
  description?: string;
  ingredientsText?: string;
}): Ingredient => {
  const text = `${input.name} ${input.category ?? ''} ${input.description ?? ''} ${input.ingredientsText ?? ''}`.toLowerCase();
  const isAlcohol = text.includes('酒') || text.includes('gin') || text.includes('vodka') || text.includes('whisky');
  const isBubbly = text.includes('气泡') || text.includes('碳酸') || text.includes('sprite') || text.includes('soda');
  const isTea = text.includes('茶') || text.includes('tea') || text.includes('coffee');
  const isDairy = text.includes('乳') || text.includes('奶') || text.includes('椰');
  const isSour = text.includes('酸') || text.includes('柠檬') || text.includes('青柠');
  const isSweet = text.includes('甜') || text.includes('糖') || text.includes('果汁') || text.includes('蜜桃');

  const category = input.category ?? (isAlcohol ? '基酒' : isBubbly ? '气泡饮料' : isTea ? '茶饮' : isDairy ? '乳酸饮料' : '果汁');

  return {
    id: `synthetic-${Date.now()}`,
    name: input.name,
    brand: 'AI拟合',
    category,
    source: 'ai_generated',
    ingredientsText: input.ingredientsText ?? input.description,
    abv: isAlcohol ? 35 : 0,
    nutrition: {
      sugar_g_per_100ml: isSweet ? 8 : 1,
      caffeine_mg_per_100ml: isTea ? 20 : undefined,
    },
    flavorProfile: {
      sweetness: isSweet ? 4 : 2,
      acidity: isSour ? 4 : 1,
      bitterness: isTea || isAlcohol ? 2 : 1,
      carbonation: isBubbly ? 4 : 0,
      dairy: isDairy ? 4 : 0,
      tea: isTea ? 4 : 0,
      fruit: text.includes('果') || text.includes('蜜桃') ? 4 : 1,
      body: isDairy ? 4 : 2,
      freshness: isBubbly || isSour ? 4 : 2,
    },
    sweetness: isSweet ? 4 : 2,
    acidity: isSour ? 4 : 1,
    bitterness: isTea || isAlcohol ? 2 : 1,
    carbonation: isBubbly ? 4 : 0,
    body: isDairy ? 4 : 2,
    viscosity: isDairy ? 4 : 2,
    dairyFeeling: isDairy ? 4 : 0,
    alcoholFeel: isAlcohol ? 4 : 0,
    notes: input.description,
    flavorTags: [isSweet ? 'sweet' : 'balanced', isBubbly ? 'bubbly' : 'still', isSour ? 'acidic' : 'soft'],
    textureTags: isBubbly ? ['bubbly'] : [],
    aromaTags: isTea ? ['tea'] : isDairy ? ['creamy'] : ['fresh'],
    dominantCompounds: [isSour ? 'citric acid' : 'aroma ester', isSweet ? 'sucrose' : 'light mineral', isBubbly ? 'CO2' : 'water'],
    goodWith: [],
    riskyWith: isDairy && isSour ? ['high acid citrus'] : [],
    dataSource: 'ai_estimate',
    confidence: 0.72,
    createdAt: new Date().toISOString(),
  };
};
