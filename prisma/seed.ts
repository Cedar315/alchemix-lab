import { PrismaClient } from '@prisma/client';
import { CONVENIENCE_DRINK_INGREDIENTS } from '../src/lib/data/convenience-drink-ingredients';
import { CLASSIC_RECIPE_SEEDS, INSPIRATION_RECIPES, REMIX_TAGS, RecipeSeed } from '../src/lib/data/inspiration-catalog';
import { JUICE_INGREDIENTS } from '../src/lib/data/juice-ingredients';

const prisma = new PrismaClient();

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const abvRangeFor = (abv: number) => {
  if (abv < 10) return '0-10';
  if (abv < 20) return '10-20';
  if (abv < 40) return '20-40';
  return '40+';
};

const coreIngredient = (item: {
  slug: string;
  nameZh: string;
  nameEn: string;
  type: string;
  category: string;
  subCategory?: string;
  brand?: string;
  aliases?: string[];
  abv?: number;
  sweetness?: number;
  acidity?: number;
  bitterness?: number;
  carbonation?: number;
  viscosity?: number;
  alcoholIntensity?: number;
  sugarGPer100ml?: number | null;
  caffeine?: boolean | null;
  ingredients?: string[];
  flavorTags?: string[];
  suitableWith?: string[];
  avoidWith?: string[];
  recommendedVolumeMl?: number[];
  convenienceStoreAvailability?: number;
  sourceNote?: string;
  confidence?: string;
}) => {
  const abv = item.abv ?? 0;
  return {
    slug: item.slug,
    name: `${item.nameZh} / ${item.nameEn}`,
    nameZh: item.nameZh,
    nameEn: item.nameEn,
    brand: item.brand ?? null,
    aliases: item.aliases ?? [item.nameZh, item.nameEn],
    type: item.type,
    category: item.category,
    subCategory: item.subCategory ?? null,
    abv,
    abvRange: abvRangeFor(abv),
    sweetness: item.sweetness ?? 1,
    acidity: item.acidity ?? 1,
    bitterness: item.bitterness ?? 1,
    carbonation: item.carbonation ?? 0,
    viscosity: item.viscosity ?? 1,
    alcoholIntensity: item.alcoholIntensity ?? Math.min(5, Math.round(abv / 10)),
    sugarGPer100ml: item.sugarGPer100ml ?? null,
    caffeine: item.caffeine ?? false,
    ingredients: item.ingredients ?? [],
    flavorTags: item.flavorTags ?? [],
    suitableWith: item.suitableWith ?? [],
    avoidWith: item.avoidWith ?? [],
    recommendedVolumeMl: item.recommendedVolumeMl ?? (abv > 0 ? [15, 30, 45] : [60, 90, 120]),
    convenienceStoreAvailability: item.convenienceStoreAvailability ?? 3,
    sourceType: 'local_database',
    confidence: item.confidence ?? 'medium',
    isTemporary: false,
    sourceNote: item.sourceNote ?? 'Local AlcheMix seed data.',
    isAlcoholic: abv > 0,
    profiles: {
      sweetness: Math.round(item.sweetness ?? 1),
      sourness: Math.round(item.acidity ?? 1),
      bitterness: Math.round(item.bitterness ?? 1),
      alcoholStrength: Math.round(item.alcoholIntensity ?? Math.min(5, abv / 10)),
      freshness: Math.round((item.carbonation ?? 0) > 0 ? 4 : item.acidity ?? 2),
      fruitiness: item.category === '果汁' ? 5 : 1,
      teaLevel: item.category === '茶饮' ? 4 : 0,
      dairyLevel: item.category === '奶类' || item.category === '乳酸饮料' ? 4 : 0,
      body: Math.round(item.viscosity ?? 1),
      aromaTags: item.flavorTags ?? [],
      flavorTags: item.flavorTags ?? [],
    },
  };
};

const dataSources = [
  {
    name: 'Local Curation',
    type: 'manual',
    url: 'https://alchemix.lab',
    reliabilityScore: 1.0,
  },
  {
    name: 'Open Food Facts',
    type: 'api',
    url: 'https://world.openfoodfacts.org',
    reliabilityScore: 0.9,
  },
  {
    name: 'TheCocktailDB',
    type: 'api',
    url: 'https://www.thecocktaildb.com',
    reliabilityScore: 0.95,
  },
  {
    name: 'USDA FoodData Central',
    type: 'reference',
    url: 'https://fdc.nal.usda.gov',
    reliabilityScore: 0.95,
  },
  {
    name: 'Clemson pH Values',
    type: 'reference',
    url: 'https://www.clemson.edu/extension/food/food2market/',
    reliabilityScore: 0.85,
  },
];

const ingredients: Array<any> = [
  { slug: 'vodka', name: 'Vodka', category: 'spirit', isAlcoholic: true, profiles: { alcoholStrength: 5, body: 1, flavorTags: ['clean', 'neutral', 'strong'] } },
  { slug: 'gin', name: 'Gin', category: 'spirit', isAlcoholic: true, profiles: { alcoholStrength: 5, herbalLevel: 4, body: 1, aromaTags: ['juniper', 'pine', 'citrus'], flavorTags: ['herbal', 'aromatic', 'dry'] } },
  { slug: 'whisky', name: 'Whisky', category: 'spirit', isAlcoholic: true, profiles: { alcoholStrength: 5, sweetness: 1, spiceLevel: 2, body: 2, aromaTags: ['oak', 'smoky', 'vanilla'], flavorTags: ['woody', 'smoky', 'warm'] } },
  { slug: 'rum', name: 'Rum', category: 'spirit', isAlcoholic: true, profiles: { alcoholStrength: 5, sweetness: 2, body: 1, aromaTags: ['molasses', 'sugarcane'], flavorTags: ['sweet', 'clean'] } },
  { slug: 'tequila', name: 'Tequila', category: 'spirit', isAlcoholic: true, profiles: { alcoholStrength: 5, herbalLevel: 2, body: 1, aromaTags: ['agave', 'earthy'], flavorTags: ['earthy', 'peppery', 'sharp'] } },
  { slug: 'jagermeister', name: 'Jägermeister', category: 'spirit', isAlcoholic: true, profiles: { sweetness: 4, bitterness: 3, alcoholStrength: 4, herbalLevel: 5, body: 3, aromaTags: ['licorice', 'anise', 'clove'], flavorTags: ['herbal', 'bitter-sweet', 'spiced'] } },
  { slug: 'baijiu', name: 'Baijiu', category: 'spirit', isAlcoholic: true, profiles: { alcoholStrength: 5, spiceLevel: 3, body: 2, aromaTags: ['sorghum', 'fermented'], flavorTags: ['sharp', 'funky', 'fiery'] } },
  { slug: 'beer', name: 'Beer', category: 'spirit', isAlcoholic: true, profiles: { bitterness: 2, alcoholStrength: 1, freshness: 3, body: 2, aromaTags: ['hops', 'malt', 'yeast'], flavorTags: ['crisp', 'bready', 'refreshing'] } },
  { slug: 'soju', name: 'Soju', category: 'spirit', isAlcoholic: true, profiles: { alcoholStrength: 2, sweetness: 1, body: 1, aromaTags: ['rice', 'sweet-potato'], flavorTags: ['clean', 'neutral', 'mild'] } },
  { slug: 'rtd-cocktail', name: 'RIO / RTD Cocktail', category: 'spirit', isAlcoholic: true, profiles: { sweetness: 4, sourness: 1, alcoholStrength: 1, freshness: 3, fruitiness: 3, body: 1, aromaTags: ['grape', 'peach', 'citrus'], flavorTags: ['sweet', 'fruity', 'fizzy'] } },
  { slug: 'sprite', name: 'Sprite', category: 'soda', isAlcoholic: false, profiles: { sweetness: 4, sourness: 2, freshness: 5, body: 1, aromaTags: ['lemon', 'lime'], flavorTags: ['sweet', 'fizzy', 'refreshing'] } },
  { slug: 'coca-cola', name: 'Coca-Cola', category: 'soda', isAlcoholic: false, profiles: { sweetness: 4, bitterness: 1, freshness: 5, body: 1, aromaTags: ['cola', 'caramel', 'vanilla'], flavorTags: ['sweet', 'fizzy', 'spiced'] } },
  { slug: 'fanta-orange', name: 'Fanta Orange', category: 'soda', isAlcoholic: false, profiles: { sweetness: 4, sourness: 2, freshness: 4, fruitiness: 3, body: 1, aromaTags: ['orange', 'citrus'], flavorTags: ['sweet', 'fizzy', 'fruity'] } },
  { slug: 'tonic-water', name: 'Tonic Water', category: 'soda', isAlcoholic: false, profiles: { sweetness: 2, bitterness: 3, freshness: 5, body: 1, aromaTags: ['quinine', 'citrus'], flavorTags: ['bitter', 'fizzy', 'dry'] } },
  { slug: 'soda-water', name: 'Soda Water', category: 'soda', isAlcoholic: false, profiles: { freshness: 5, body: 1, flavorTags: ['neutral', 'fizzy', 'clean'] } },
  { slug: 'yakult', name: 'Yakult', category: 'dairy', isAlcoholic: false, profiles: { sweetness: 4, sourness: 3, dairyLevel: 4, body: 3, aromaTags: ['yogurt', 'vanilla'], flavorTags: ['creamy', 'sour-sweet', 'milky'] } },
  { slug: 'red-bull', name: 'Red Bull', category: 'soda', isAlcoholic: false, profiles: { sweetness: 4, sourness: 2, freshness: 3, body: 1, aromaTags: ['energy', 'mixed-berry'], flavorTags: ['sweet', 'caffeinated', 'acidic'] } },
  { slug: 'oolong-tea', name: 'Oolong Tea', category: 'tea', isAlcoholic: false, profiles: { bitterness: 1, teaLevel: 4, body: 1, aromaTags: ['tea', 'roasted'], flavorTags: ['earthy', 'clean', 'sugar-free'] } },
  { slug: 'lemon-tea', name: 'Lemon Tea', category: 'tea', isAlcoholic: false, profiles: { sweetness: 4, sourness: 3, teaLevel: 3, body: 1, aromaTags: ['lemon', 'black-tea'], flavorTags: ['sour-sweet', 'tannic', 'fruity'] } },
  { slug: 'peach-sparkling-water', name: 'Peach Sparkling Water', category: 'soda', isAlcoholic: false, profiles: { sweetness: 2, freshness: 4, fruitiness: 3, body: 1, aromaTags: ['peach'], flavorTags: ['sweet', 'fizzy', 'fruity'] } },
  { slug: 'orange-juice', name: 'Orange Juice', category: 'juice', isAlcoholic: false, profiles: { sweetness: 3, sourness: 3, fruitiness: 4, body: 2, aromaTags: ['orange', 'citrus'], flavorTags: ['fruity', 'tart', 'natural'] } },
  { slug: 'apple-juice', name: 'Apple Juice', category: 'juice', isAlcoholic: false, profiles: { sweetness: 4, sourness: 1, fruitiness: 4, body: 2, aromaTags: ['apple'], flavorTags: ['sweet', 'fruity'] } },
  { slug: 'milk-tea', name: 'Milk Tea', category: 'dairy', isAlcoholic: false, profiles: { sweetness: 3, teaLevel: 2, dairyLevel: 3, body: 3, aromaTags: ['tea', 'milk'], flavorTags: ['creamy', 'sweet', 'rich'] } },
  { slug: 'coffee-drink', name: 'Coffee Drink', category: 'tea', isAlcoholic: false, profiles: { sweetness: 2, bitterness: 3, body: 2, aromaTags: ['coffee', 'roasted'], flavorTags: ['bitter', 'roasted', 'caffeinated'] } },
  { slug: 'coconut-water', name: 'Coconut Water', category: 'juice', isAlcoholic: false, profiles: { sweetness: 2, body: 1, aromaTags: ['coconut'], flavorTags: ['sweet', 'hydrating', 'subtle'] } },
  { slug: 'ice', name: 'Ice', category: 'addition', isAlcoholic: false, profiles: { body: 1, flavorTags: ['cooling', 'dilution'] } },
  { slug: 'lemon', name: 'Lemon', category: 'fruit', isAlcoholic: false, profiles: { sourness: 5, fruitiness: 2, body: 1, aromaTags: ['lemon', 'citrus'], flavorTags: ['sour', 'zesty'] } },
  { slug: 'lime', name: 'Lime', category: 'fruit', isAlcoholic: false, profiles: { sourness: 5, bitterness: 1, fruitiness: 2, body: 1, aromaTags: ['lime', 'citrus'], flavorTags: ['sour', 'sharp', 'zesty'] } },
  { slug: 'mint', name: 'Mint', category: 'addition', isAlcoholic: false, profiles: { freshness: 3, herbalLevel: 3, body: 1, aromaTags: ['mint', 'menthol'], flavorTags: ['cooling', 'herbal', 'fresh'] } },
  { slug: 'salt', name: 'Salt', category: 'addition', isAlcoholic: false, profiles: { body: 1, flavorTags: ['salty', 'flavor-enhancer'] } },
  { slug: 'sugar', name: 'Sugar', category: 'addition', isAlcoholic: false, profiles: { sweetness: 5, body: 1, flavorTags: ['sweet'] } },
  { slug: 'honey', name: 'Honey', category: 'addition', isAlcoholic: false, profiles: { sweetness: 5, body: 3, aromaTags: ['floral'], flavorTags: ['sweet', 'thick', 'rich'] } },
];

ingredients.push(
  ...JUICE_INGREDIENTS.map((item) => ({
    slug: item.id,
    name: `${item.nameZh} / ${item.nameEn}`,
    nameZh: item.nameZh,
    nameEn: item.nameEn,
    brand: null,
    aliases: item.aliases,
    type: item.type,
    category: item.category,
    subCategory: item.subCategory,
    abv: item.abv,
    abvRange: '0-10',
    sweetness: item.sweetness,
    acidity: item.acidity,
    bitterness: item.bitterness,
    carbonation: item.carbonation,
    viscosity: item.viscosity,
    alcoholIntensity: 0,
    sugarGPer100ml: item.sugarGPer100ml,
    caffeine: false,
    pHRange: item.pHRange,
    ingredients: item.ingredients,
    flavorTags: item.flavorTags,
    suitableWith: item.suitableWith,
    avoidWith: item.avoidWith,
    recommendedVolumeMl: item.recommendedVolumeMl,
    convenienceStoreAvailability: item.convenienceStoreAvailability,
    sourceType: 'local_database',
    confidence: item.confidence,
    isTemporary: false,
    sourceNote: item.sourceNote,
    isAlcoholic: false,
    profiles: {
      sweetness: Math.round(item.sweetness),
      sourness: Math.round(item.acidity),
      bitterness: item.bitterness,
      freshness: item.acidity >= 4 || item.carbonation > 0 ? 5 : 3,
      fruitiness: 5,
      body: item.viscosity,
      aromaTags: item.flavorTags,
      flavorTags: [...item.flavorTags, item.subCategory, item.confidence],
    },
  })),
);

const coreAlcohols = [
  ['vodka', '伏特加', 'Vodka', 40, ['干净', '中性', '高酒精']],
  ['gin', '金酒', 'Gin', 42, ['杜松', '草本', '柑橘']],
  ['whisky', '威士忌', 'Whisky', 43, ['橡木', '麦芽', '暖香料']],
  ['rum', '朗姆', 'Rum', 40, ['甘蔗', '焦糖', '热带']],
  ['tequila', '龙舌兰', 'Tequila', 40, ['龙舌兰', '植物', '矿物']],
  ['baijiu', '白酒', 'Baijiu', 52, ['粮香', '酯香', '高酒精']],
  ['beer', '啤酒', 'Beer', 5, ['麦芽', '啤酒花', '气泡']],
  ['soju', '烧酒', 'Soju', 16, ['干净', '微甜', '轻酒感']],
  ['white-rum', '白朗姆', 'White Rum', 40, ['甘蔗', '清爽', '热带']],
  ['dark-rum', '黑朗姆', 'Dark Rum', 40, ['焦糖', '橡木', '甘蔗']],
  ['bourbon', '波本', 'Bourbon', 45, ['香草', '焦糖', '橡木']],
  ['scotch', '苏格兰威士忌', 'Scotch Whisky', 43, ['麦芽', '烟熏', '橡木']],
  ['brandy', '白兰地', 'Brandy', 40, ['葡萄干', '橡木', '暖香料']],
  ['cognac', '干邑', 'Cognac', 40, ['葡萄', '花香', '橡木']],
  ['sake', '清酒', 'Sake', 15, ['米香', '柔和', '鲜味']],
  ['umeshu', '梅酒', 'Umeshu', 12, ['梅子', '甜酸', '圆润']],
  ['vermouth-sweet', '甜味美思', 'Sweet Vermouth', 16, ['草本', '甜香', '葡萄酒']],
  ['vermouth-dry', '干味美思', 'Dry Vermouth', 18, ['草本', '干爽', '葡萄酒']],
  ['campari', '金巴利', 'Campari', 25, ['苦橙', '草本', '红色苦味']],
  ['aperol', '阿佩罗', 'Aperol', 11, ['橙子', '轻苦', '开胃']],
  ['amaro', '阿玛罗', 'Amaro', 28, ['草本', '苦甜', '深色香料']],
  ['kahlua', '咖啡利口酒', 'Kahlua', 20, ['咖啡', '甜', '香草']],
  ['baileys', '百利甜', 'Baileys', 17, ['奶油', '可可', '甜']],
  ['malibu', '椰子朗姆', 'Malibu', 21, ['椰子', '甜', '热带']],
  ['midori', '蜜瓜利口酒', 'Midori', 20, ['蜜瓜', '高甜', '果香']],
  ['cider', '苹果酒', 'Cider', 5, ['苹果', '气泡', '清甜']],
  ['wine-red', '红葡萄酒', 'Red Wine', 13, ['红果', '单宁', '葡萄']],
  ['wine-white', '白葡萄酒', 'White Wine', 12, ['白果', '酸感', '清爽']],
  ['sparkling-wine', '起泡酒', 'Sparkling Wine', 12, ['气泡', '苹果', '酵母']],
  ['hard-seltzer', '酒精气泡水', 'Hard Seltzer', 5, ['低甜', '气泡', '轻盈']],
  ['rye-whiskey', '黑麦威士忌', 'Rye Whiskey', 45, ['辛香', '谷物', '橡木']],
  ['orange-liqueur', '橙味利口酒', 'Orange Liqueur', 40, ['橙皮', '甜', '柑橘']],
  ['absinthe', '苦艾酒', 'Absinthe', 60, ['茴香', '草本', '高酒精']],
  ['cachaca', '卡莎萨', 'Cachaça', 40, ['甘蔗', '青草', '热带']],
] as const;

ingredients.push(
  ...coreAlcohols.map(([slug, nameZh, nameEn, abv, tags]) => {
    const tagList = [...tags] as string[];
    return coreIngredient({
    slug,
    nameZh,
    nameEn,
    type: 'alcohol',
    category: '基酒',
    subCategory: abv >= 35 ? '烈酒' : '低度酒',
    abv,
    sweetness: tagList.includes('甜') || tagList.includes('高甜') ? 4 : 2,
    acidity: 1,
    bitterness: tagList.includes('苦甜') || tagList.includes('轻苦') || tagList.includes('红色苦味') ? 4 : 2,
    viscosity: abv >= 35 ? 2 : 1,
    alcoholIntensity: Math.min(5, Math.max(1, Math.round(abv / 10))),
    flavorTags: tagList,
    suitableWith: ['苏打水', '柑橘', '果汁'],
    avoidWith: ['大量奶类', '过量糖浆'],
    recommendedVolumeMl: abv >= 35 ? [15, 30, 45] : [45, 60, 90],
    convenienceStoreAvailability: abv <= 15 ? 4 : 3,
  });
  }),
);

const convenienceMixers = [
  ['yakult', '养乐多', 'Yakult', '乳酸饮料', '乳酸菌饮料', 15.3, false, ['乳酸', '甜酸', '奶感']],
  ['lactic-acid-drink', '乳酸菌饮料', 'Lactic Acid Drink', '乳酸饮料', '乳酸菌饮料', 12, false, ['乳酸', '甜', '酸奶感']],
  ['yogurt-drink', '酸奶饮品', 'Yogurt Drink', '乳酸饮料', '酸奶饮品', 11, false, ['酸奶', '奶感', '甜酸']],
  ['sprite', '雪碧', 'Sprite', '气泡饮料', '柠檬汽水', 10, false, ['柠檬', '气泡', '甜']],
  ['cola', '可乐', 'Cola', '气泡饮料', '可乐', 10.6, true, ['焦糖', '香料', '气泡']],
  ['soda-water', '苏打水', 'Soda Water', '气泡饮料', '无糖苏打', 0, false, ['气泡', '干净', '稀释']],
  ['tonic-water', '汤力水', 'Tonic Water', '气泡饮料', '汤力水', 8, false, ['奎宁', '苦甜', '气泡']],
  ['sparkling-water', '气泡水', 'Sparkling Water', '气泡饮料', '无糖气泡水', 0, false, ['气泡', '清爽', '无糖']],
  ['oolong-tea', '乌龙茶', 'Oolong Tea', '茶饮', '无糖茶', 0, true, ['茶香', '焙火', '清爽']],
  ['green-tea', '绿茶', 'Green Tea', '茶饮', '无糖茶', 0, true, ['绿茶', '清香', '微苦']],
  ['black-tea', '红茶', 'Black Tea', '茶饮', '无糖茶', 0, true, ['红茶', '单宁', '茶香']],
  ['jasmine-tea', '茉莉茶', 'Jasmine Tea', '茶饮', '花茶', 0, true, ['茉莉', '花香', '清爽']],
  ['peach-oolong', '蜜桃乌龙', 'Peach Oolong Tea', '茶饮', '调味茶', 5, true, ['蜜桃', '乌龙', '轻甜']],
  ['oriental-leaf-tea', '东方树叶通用品类', 'Oriental Leaf Tea', '茶饮', '无糖茶', 0, true, ['茶香', '无糖', '便利店']],
  ['suntory-oolong', '三得利乌龙茶通用品类', 'Suntory Oolong Tea', '茶饮', '无糖茶', 0, true, ['乌龙', '焙火', '无糖']],
  ['red-bull', '红牛', 'Red Bull', '功能饮料', '能量饮料', 11, true, ['能量饮料', '甜酸', '咖啡因']],
  ['monster', 'Monster', 'Monster Energy', '功能饮料', '能量饮料', 11, true, ['能量饮料', '高甜', '咖啡因']],
  ['mizone', '脉动', 'Mizone Vitamin Drink', '功能饮料', '维生素饮料', 5, false, ['维生素', '低酸', '清甜']],
  ['pocari-sweat', '宝矿力', 'Pocari Sweat', '功能饮料', '电解质饮料', 6, false, ['电解质', '清爽', '微酸']],
  ['americano', '美式咖啡', 'Americano', '咖啡', '黑咖啡', 0, true, ['咖啡', '烘焙', '苦味']],
  ['cold-brew', '冷萃咖啡', 'Cold Brew Coffee', '咖啡', '黑咖啡', 0, true, ['咖啡', '低酸', '顺滑']],
  ['latte', '拿铁', 'Latte', '咖啡', '奶咖', 5, true, ['咖啡', '奶感', '顺滑']],
  ['coffee-milk', '咖啡牛奶', 'Coffee Milk', '咖啡', '奶咖', 9, true, ['咖啡', '甜', '奶感']],
  ['milk', '牛奶', 'Milk', '奶类', '牛奶', 5, false, ['奶香', '顺滑', '脂肪']],
  ['coconut-milk', '椰奶', 'Coconut Milk', '奶类', '植物奶', 6, false, ['椰香', '厚重', '植物奶']],
  ['soy-milk', '豆奶', 'Soy Milk', '奶类', '植物奶', 5, false, ['豆香', '顺滑', '植物奶']],
  ['oat-milk', '燕麦奶', 'Oat Milk', '奶类', '植物奶', 6, false, ['燕麦', '顺滑', '谷物']],
  ['ginger-ale', '姜汁汽水', 'Ginger Ale', '气泡饮料', '姜味汽水', 9, false, ['姜', '气泡', '甜辣']],
  ['ginger-beer', '姜汁啤酒', 'Ginger Beer', '气泡饮料', '姜味汽水', 10, false, ['姜辣', '气泡', '浓郁']],
  ['tomato-juice', '番茄汁', 'Tomato Juice', '果蔬汁', '蔬菜汁', 3, false, ['番茄', '咸鲜', '低甜']],
  ['barley-tea', '大麦茶', 'Barley Tea', '茶饮', '无糖茶', 0, false, ['麦香', '烘焙', '无糖']],
  ['genmaicha', '玄米茶', 'Genmaicha', '茶饮', '无糖茶', 0, true, ['玄米', '绿茶', '烘焙']],
  ['coconut-water-general', '通用椰子水', 'Coconut Water General', '果汁', '热带果汁', 2.6, false, ['椰子', '低糖', '清爽']],
  ['grape-soda', '葡萄汽水', 'Grape Soda', '气泡饮料', '果味汽水', 12, false, ['葡萄', '气泡', '高甜']],
  ['orange-soda', '橙味汽水', 'Orange Soda', '气泡饮料', '果味汽水', 12, false, ['橙子', '气泡', '甜']],
] as const;

ingredients.push(
  ...convenienceMixers.map(([slug, nameZh, nameEn, category, subCategory, sugar, caffeine, tags]) => coreIngredient({
    slug,
    nameZh,
    nameEn,
    type: category === '茶饮' || category === '咖啡' || category === '奶类' || category === '乳酸饮料' ? 'mixer' : 'mixer',
    category,
    subCategory,
    aliases: [nameZh, nameEn, slug.replace(/-/g, ' ')],
    abv: 0,
    sugarGPer100ml: sugar,
    caffeine,
    sweetness: sugar <= 3 ? 1 : sugar <= 7 ? 2 : sugar <= 10 ? 3 : sugar <= 13 ? 4 : 5,
    acidity: category === '乳酸饮料' || category === '功能饮料' ? 3 : 1,
    bitterness: category === '咖啡' ? 4 : category === '茶饮' ? 2 : 1,
    carbonation: category === '气泡饮料' || category === '功能饮料' ? 4 : 0,
    viscosity: category === '奶类' || category === '乳酸饮料' ? 3 : 1,
    flavorTags: [...tags],
    ingredients: ['水', sugar > 0 ? '糖' : '无糖', ...tags.slice(0, 1)],
    suitableWith: ['伏特加', '金酒', '威士忌', '朗姆'],
    avoidWith: category === '奶类' || category === '乳酸饮料' ? ['高酸柠檬汁', '青柠浓缩汁'] : ['过量糖浆'],
    recommendedVolumeMl: [60, 90, 120],
    convenienceStoreAvailability: 5,
  })),
);

const legacyConvenienceDrinkNames = [
  ['jagermeister', '野格利口酒', 'Jägermeister', 'alcohol', '便利店酒饮', '草本利口酒', 35, 4, 1, 3, 0, 3, true, ['水', '酒精', '糖', '草本浸提物'], ['草本', '苦甜', '香料'], ['红牛', '可乐', '姜汁汽水'], ['高咖啡因过量', '高糖饮料过量'], [15, 30, 45]],
  ['rtd-cocktail', '预调鸡尾酒', 'RTD Cocktail', 'alcohol', '便利店酒饮', '预调鸡尾酒', 3, 4, 2, 0, 2, 1, false, ['水', '糖', '食用酒精', '果味香料'], ['低酒精', '果味', '便利店'], ['冰块', '苏打水', '果汁'], ['高度酒叠加'], [120, 150, 200]],
  ['coca-cola', '可口可乐', 'Coca-Cola', 'mixer', '气泡饮料', '可乐', 0, 4, 2, 1, 4, 1, true, ['水', '糖', '二氧化碳', '焦糖色', '咖啡因', '香料'], ['可乐', '焦糖', '气泡'], ['朗姆', '威士忌', '白兰地'], ['高酸乳饮'], [90, 120, 150]],
  ['lemon-tea', '柠檬茶', 'Lemon Tea', 'mixer', '茶饮', '含糖茶', 0, 4, 3, 1, 0, 1, true, ['水', '糖', '红茶', '柠檬汁', '柠檬酸'], ['柠檬', '红茶', '甜酸'], ['威士忌', '伏特加', '金酒'], ['奶类高比例'], [90, 120, 150]],
  ['peach-sparkling-water', '蜜桃气泡水', 'Peach Sparkling Water', 'mixer', '气泡饮料', '果味气泡水', 0, 2, 2, 0, 4, 1, false, ['水', '二氧化碳', '蜜桃香气', '甜味剂'], ['蜜桃', '气泡', '清甜'], ['伏特加', '金酒', '烧酒'], ['厚奶'], [90, 120, 150]],
  ['orange-juice', '橙汁', 'Orange Juice', 'mixer', '果汁', '单一果汁', 0, 3, 3, 1, 0, 2, false, ['橙汁'], ['柑橘', '甜酸', '明亮'], ['伏特加', '金酒', '龙舌兰'], ['奶类'], [60, 90, 120]],
  ['apple-juice', '苹果汁', 'Apple Juice', 'mixer', '果汁', '单一果汁', 0, 4, 3, 0, 0, 2, false, ['苹果汁', '维生素C'], ['苹果', '清甜', '圆润'], ['威士忌', '白兰地', '伏特加'], ['重苦草本酒'], [60, 90, 120]],
  ['milk-tea', '奶茶', 'Milk Tea', 'mixer', '奶茶', '瓶装奶茶', 0, 4, 1, 1, 0, 3, true, ['水', '糖', '奶粉', '红茶'], ['奶茶', '红茶', '甜'], ['威士忌', '咖啡利口酒'], ['柠檬汁', '青柠汁'], [60, 90, 120]],
  ['coffee-drink', '咖啡饮料', 'Coffee Drink', 'mixer', '咖啡', '即饮咖啡', 0, 2, 1, 3, 0, 2, true, ['水', '咖啡', '糖/奶成分'], ['咖啡', '烘焙', '咖啡因'], ['威士忌', '伏特加', '咖啡利口酒'], ['清淡果汁'], [30, 60, 90]],
  ['coconut-water', '椰子水', 'Coconut Water', 'mixer', '果汁', '热带果汁', 0, 1, 1, 0, 0, 1, false, ['椰子水'], ['椰子', '低糖', '清爽'], ['朗姆', '伏特加', '龙舌兰'], ['强苦味酒'], [90, 120, 150]],
] as const;

ingredients.push(
  ...legacyConvenienceDrinkNames.map(([slug, nameZh, nameEn, type, category, subCategory, abv, sweetness, acidity, bitterness, carbonation, viscosity, caffeine, baseIngredients, tags, suitableWith, avoidWith, recommendedVolumeMl]) => coreIngredient({
    slug,
    nameZh,
    nameEn,
    type,
    category,
    subCategory,
    abv,
    sweetness,
    acidity,
    bitterness,
    carbonation,
    viscosity,
    caffeine,
    ingredients: [...baseIngredients],
    flavorTags: [...tags],
    suitableWith: [...suitableWith],
    avoidWith: [...avoidWith],
    recommendedVolumeMl: [...recommendedVolumeMl],
    convenienceStoreAvailability: 5,
  })),
);

const syrupAndGarnish = [
  ['simple-syrup', '糖浆', 'Simple Syrup', 'syrup', '糖浆', ['糖', '水'], ['甜', '增甜']],
  ['honey-syrup', '蜂蜜糖浆', 'Honey Syrup', 'syrup', '糖浆', ['蜂蜜', '水'], ['蜂蜜', '花香']],
  ['grenadine', '红石榴糖浆', 'Grenadine', 'syrup', '糖浆', ['石榴', '糖'], ['红果', '甜']],
  ['orgeat', '杏仁糖浆', 'Orgeat', 'syrup', '糖浆', ['杏仁', '糖'], ['坚果', '甜']],
  ['angostura-bitters', '安格斯图拉苦精', 'Angostura Bitters', 'bitter', '苦精', ['草本', '香料'], ['苦味', '香料']],
  ['orange-bitters', '橙味苦精', 'Orange Bitters', 'bitter', '苦精', ['橙皮', '草本'], ['橙皮', '苦味']],
  ['mint-leaves', '薄荷叶', 'Mint Leaves', 'garnish', '装饰物', ['薄荷'], ['清凉', '草本']],
  ['orange-peel', '橙皮', 'Orange Peel', 'garnish', '装饰物', ['橙皮'], ['柑橘油', '芳香']],
  ['lemon-twist', '柠檬皮卷', 'Lemon Twist', 'garnish', '装饰物', ['柠檬皮'], ['柠檬油', '芳香']],
  ['olive', '橄榄', 'Olive', 'garnish', '装饰物', ['橄榄', '盐水'], ['咸鲜', '油脂']],
  ['sugar-cube', '方糖', 'Sugar Cube', 'syrup', '糖', ['糖'], ['甜', '溶解']],
  ['cream-of-coconut', '椰浆', 'Cream of Coconut', 'syrup', '椰子配料', ['椰浆', '糖'], ['椰香', '厚甜']],
  ['salt', '盐', 'Salt', 'garnish', '盐边', ['食盐'], ['咸味', '提味']],
] as const;

ingredients.push(
  ...syrupAndGarnish.map(([slug, nameZh, nameEn, type, subCategory, baseIngredients, tags]) => coreIngredient({
    slug,
    nameZh,
    nameEn,
    type,
    category: type === 'garnish' ? '装饰物' : type === 'bitter' ? '苦精' : '糖浆',
    subCategory,
    aliases: [nameZh, nameEn],
    abv: type === 'bitter' ? 44 : 0,
    sweetness: type === 'syrup' ? 5 : 1,
    acidity: 1,
    bitterness: type === 'bitter' ? 5 : 1,
    viscosity: type === 'syrup' ? 4 : 1,
    ingredients: [...baseIngredients],
    flavorTags: [...tags],
    suitableWith: ['经典鸡尾酒', '便利店调酒'],
    avoidWith: ['过量使用'],
    recommendedVolumeMl: type === 'bitter' ? [1, 2, 3] : type === 'garnish' ? [1] : [5, 10, 15],
    convenienceStoreAvailability: type === 'garnish' ? 4 : 2,
  })),
);

ingredients.push(
  ...CONVENIENCE_DRINK_INGREDIENTS.map((item) => coreIngredient({
    slug: item.slug,
    nameZh: item.nameZh,
    nameEn: item.nameEn,
    brand: item.brand,
    aliases: item.aliases,
    type: item.type,
    category: item.category,
    subCategory: item.subCategory,
    abv: item.abv ?? 0,
    sweetness: item.sweetness,
    acidity: item.acidity,
    bitterness: item.bitterness,
    carbonation: item.carbonation,
    viscosity: item.viscosity,
    alcoholIntensity: item.alcoholIntensity,
    sugarGPer100ml: item.sugarGPer100ml,
    caffeine: item.caffeine,
    ingredients: item.ingredients,
    flavorTags: item.flavorTags,
    suitableWith: item.suitableWith,
    avoidWith: item.avoidWith,
    recommendedVolumeMl: item.recommendedVolumeMl,
    convenienceStoreAvailability: item.convenienceStoreAvailability,
    sourceNote: item.sourceNote,
    confidence: item.confidence,
  })),
);

const products: Array<any> = [
  {
    barcode: '5010103937126',
    brand: 'Absolut',
    name: 'Absolut Vodka 750ml',
    subCategory: 'Vodka',
    abv: 40.0,
    priceRange: 2,
    commonStoreType: ['Lawson', '7-11', 'Supermarket'],
    ingredientListText: 'Water, grain distillate',
    sugarContentPer100ml: 0.0,
    carbonationLevel: 0,
    sourceName: 'Local Curation',
    ingredientSlugs: ['vodka'],
  },
  {
    barcode: '6901209374029',
    brand: 'Suntory',
    name: 'Suntory Oolong Tea 500ml',
    subCategory: 'Oolong Tea',
    abv: 0.0,
    priceRange: 1,
    commonStoreType: ['Lawson', '7-11', 'FamilyMart', 'Supermarket'],
    ingredientListText: 'Water, oolong tea leaves, vitamin C',
    sugarContentPer100ml: 0.0,
    carbonationLevel: 0,
    sourceName: 'Local Curation',
    ingredientSlugs: ['oolong-tea'],
  },
  {
    barcode: '4004771382401',
    brand: 'Jägermeister',
    name: 'Jägermeister 350ml',
    subCategory: 'Herbal Liqueur',
    abv: 35.0,
    priceRange: 2,
    commonStoreType: ['7-11', 'FamilyMart', 'Supermarket'],
    ingredientListText: 'Water, alcohol, sugar, herbal extract, caramel color',
    sugarContentPer100ml: 13.0,
    carbonationLevel: 0,
    sourceName: 'Local Curation',
    ingredientSlugs: ['jagermeister'],
  },
  {
    barcode: '6900290192801',
    brand: 'Coca-Cola',
    name: 'Sprite Lemon-Lime Soda 500ml',
    subCategory: 'Sprite',
    abv: 0.0,
    priceRange: 1,
    commonStoreType: ['7-11', 'Lawson', 'FamilyMart', 'Supermarket'],
    ingredientListText: 'Water, glucose syrup, carbon dioxide, citric acid, flavoring',
    sugarContentPer100ml: 4.6,
    carbonationLevel: 2,
    sourceName: 'Open Food Facts',
    ingredientSlugs: ['sprite'],
  },
  {
    barcode: '4903080110789',
    brand: 'Yakult',
    name: 'Yakult 100ml',
    subCategory: 'Yakult',
    abv: 0.0,
    priceRange: 1,
    commonStoreType: ['7-11', 'Lawson', 'FamilyMart', 'Supermarket'],
    ingredientListText: 'Water, sugar, skimmed milk powder, glucose, flavoring, L. casei Shirota',
    sugarContentPer100ml: 15.3,
    carbonationLevel: 0,
    sourceName: 'Open Food Facts',
    ingredientSlugs: ['yakult'],
  },
  {
    barcode: '9002490100070',
    brand: 'Red Bull',
    name: 'Red Bull Energy Drink 250ml',
    subCategory: 'Red Bull',
    abv: 0.0,
    priceRange: 2,
    commonStoreType: ['7-11', 'Lawson', 'FamilyMart', 'Supermarket'],
    ingredientListText: 'Water, sucrose, glucose, citric acid, taurine, caffeine, vitamins',
    sugarContentPer100ml: 11.0,
    caffeineContentPer100ml: 32.0,
    carbonationLevel: 1,
    sourceName: 'Local Curation',
    ingredientSlugs: ['red-bull'],
  },
];

products.push(
  ...JUICE_INGREDIENTS.map((item) => ({
    barcode: `local-${item.id}`,
    brand: 'AlcheMix Juice Seed',
    name: `${item.nameZh} / ${item.nameEn}`,
    subCategory: item.subCategory,
    abv: item.abv,
    priceRange: Math.max(1, Math.min(3, 6 - item.convenienceStoreAvailability)),
    commonStoreType: item.convenienceStoreAvailability >= 4
      ? ['7-11', 'Lawson', 'FamilyMart', 'Supermarket']
      : ['Supermarket', 'Specialty Store'],
    ingredientListText: item.ingredients.join(', '),
    sugarContentPer100ml: item.sugarGPer100ml,
    carbonationLevel: item.carbonation,
    sourceName: item.confidence === 'high' ? 'USDA FoodData Central' : 'Local Curation',
    ingredientSlugs: [item.id],
  })),
);

const pairingRules = [
  {
    targetSlugA: 'yakult',
    targetSlugB: 'lemon',
    ruleType: 'conflict',
    description: 'Yakult can curdle with high-acid citrus juice when proportions are high.',
    recommendedRatio: 'avoid or dilute heavily',
    mixingNotes: 'Dilute lemon with soda water or ice first, then add Yakult gently and avoid hard shaking.',
  },
  {
    targetSlugA: 'red-bull',
    targetSlugB: 'jagermeister',
    ruleType: 'warning',
    description: 'Caffeine can mask alcohol effects and may encourage overconsumption.',
    recommendedRatio: '1:4 (40ml Jägermeister : 160ml Red Bull)',
    mixingNotes: 'Limit serving size, add plenty of ice, and show a caution note.',
  },
  {
    targetSlugA: 'gin',
    targetSlugB: 'tonic-water',
    ruleType: 'synergy',
    description: 'Tonic bitterness and gin botanicals make a classic aromatic pairing.',
    recommendedRatio: '1:3 (45ml gin : 135ml tonic water)',
    mixingNotes: 'Build over full ice and stir gently to preserve carbonation.',
  },
];

const cocktailTemplates = [
  {
    name: 'Mojito',
    description: 'A refreshing Cuban highball built around mint, lime, sugar, rum, soda, and crushed ice.',
    originalRecipe: {
      base_spirit: 'white-rum',
      base_volume: '50ml',
      acid: 'fresh-lime-juice (20ml)',
      sweet: 'white-sugar (2 teaspoons)',
      aromatic: 'fresh-mint-leaves (8-10)',
      filler: 'soda-water (top-up)',
      ice: 'crushed-ice',
    },
    remixLogicHints: {
      spirit_replacements: {
        spirit: 'vodka',
        reason: 'Vodka gives a clean alcohol backbone when rum is unavailable.',
      },
      sweet_acid_replacements: {
        soda: 'sprite',
        reason: 'Sprite contributes sweetness, citrus acidity, and bubbles.',
      },
    },
  },
  {
    name: 'Negroni',
    description: 'A bitter-sweet Italian classic traditionally made with equal parts gin, Campari, and sweet vermouth.',
    originalRecipe: {
      base_spirit: 'gin (30ml)',
      bitter: 'campari (30ml)',
      sweet_vermouth: 'red-vermouth (30ml)',
      garnish: 'orange-peel',
    },
    remixLogicHints: {
      remix_directions: [
        {
          target: 'lower-bitterness-and-store-buyable',
          method: 'Use Jägermeister for herbal bitterness, orange soda for sweetness and citrus, and tonic water for a dry bitter finish.',
        },
      ],
    },
  },
];

const classicCocktails = [
  { slug: 'negroni', nameZh: '内格罗尼', nameEn: 'Negroni', description: '等比例金酒、金巴利与甜味美思组成的意大利苦甜经典。', originalFlavorDescription: '苦橙、草本、酒体厚实，入口直接。', beginnerWarning: '苦味和酒感都很突出。', bitterness: 5, sweetness: 3, acidity: 1, alcoholIntensity: 4, freshness: 2, difficulty: 2 },
  { slug: 'old-fashioned', nameZh: '古典老式', nameEn: 'Old Fashioned', description: '威士忌、糖、苦精和橙皮构成的短饮经典。', originalFlavorDescription: '橡木、焦糖、香料和烈酒暖感。', beginnerWarning: '几乎没有软饮稀释，酒感强。', bitterness: 2, sweetness: 2, acidity: 0, alcoholIntensity: 5, freshness: 1, difficulty: 2 },
  { slug: 'martini', nameZh: '马丁尼', nameEn: 'Martini', description: '金酒与干味美思调和的干爽经典。', originalFlavorDescription: '杜松、草本、干爽、酒精感清晰。', beginnerWarning: '干烈且不甜。', bitterness: 2, sweetness: 1, acidity: 0, alcoholIntensity: 5, freshness: 2, difficulty: 3 },
  { slug: 'mojito', nameZh: '莫吉托', nameEn: 'Mojito', description: '朗姆、青柠、薄荷、糖和苏打水组成的清爽长饮。', originalFlavorDescription: '薄荷清凉、青柠酸感、气泡轻盈。', beginnerWarning: '酸甜平衡不好会显得尖锐。', bitterness: 1, sweetness: 3, acidity: 4, alcoholIntensity: 2, freshness: 5, difficulty: 2 },
  { slug: 'margarita', nameZh: '玛格丽特', nameEn: 'Margarita', description: '龙舌兰、橙味利口酒和青柠构成的酸爽经典。', originalFlavorDescription: '青柠尖酸、龙舌兰植物感、橙皮甜香。', beginnerWarning: '酸度和酒感都较直接。', bitterness: 1, sweetness: 2, acidity: 5, alcoholIntensity: 4, freshness: 4, difficulty: 2 },
  { slug: 'gin-tonic', nameZh: '金汤力', nameEn: 'Gin Tonic', description: '金酒与汤力水构成的高球经典。', originalFlavorDescription: '杜松、奎宁苦味、气泡清爽。', beginnerWarning: '汤力苦味对新手可能明显。', bitterness: 3, sweetness: 2, acidity: 2, alcoholIntensity: 2, freshness: 5, difficulty: 1 },
  { slug: 'cuba-libre', nameZh: '自由古巴', nameEn: 'Cuba Libre', description: '朗姆、可乐与青柠组成的简单高球。', originalFlavorDescription: '可乐甜香、青柠提亮、朗姆甘蔗底味。', beginnerWarning: '甜味容易掩盖酒精。', bitterness: 1, sweetness: 4, acidity: 2, alcoholIntensity: 2, freshness: 4, difficulty: 1 },
  { slug: 'whiskey-sour', nameZh: '威士忌酸', nameEn: 'Whiskey Sour', description: '威士忌、柠檬汁和糖浆的酸甜平衡经典。', originalFlavorDescription: '柠檬酸、威士忌桶香、糖浆圆润。', beginnerWarning: '酸度较高。', bitterness: 1, sweetness: 3, acidity: 4, alcoholIntensity: 3, freshness: 4, difficulty: 2 },
  { slug: 'daiquiri', nameZh: '代基里', nameEn: 'Daiquiri', description: '白朗姆、青柠和糖浆构成的短饮酸酒。', originalFlavorDescription: '青柠锐利、朗姆清甜、结构干净。', beginnerWarning: '酸度明显，酒体短而直接。', bitterness: 1, sweetness: 2, acidity: 5, alcoholIntensity: 4, freshness: 4, difficulty: 2 },
  { slug: 'cosmopolitan', nameZh: '大都会', nameEn: 'Cosmopolitan', description: '伏特加、橙味利口酒、蔓越莓与青柠的现代经典。', originalFlavorDescription: '红莓酸甜、柑橘清香、酒感中等。', beginnerWarning: '酸度偏高。', bitterness: 1, sweetness: 3, acidity: 4, alcoholIntensity: 3, freshness: 4, difficulty: 2 },
  { slug: 'moscow-mule', nameZh: '莫斯科骡子', nameEn: 'Moscow Mule', description: '伏特加、青柠和姜汁啤酒组成的辛爽高球。', originalFlavorDescription: '姜辣、青柠、气泡和清爽酒体。', beginnerWarning: '姜辣感可能明显。', bitterness: 1, sweetness: 3, acidity: 3, alcoholIntensity: 2, freshness: 5, difficulty: 1 },
  { slug: 'aperol-spritz', nameZh: '阿佩罗橙光', nameEn: 'Aperol Spritz', description: '阿佩罗、起泡酒和苏打组成的低酒感开胃酒。', originalFlavorDescription: '橙味、轻苦、气泡、清爽。', beginnerWarning: '轻苦味但整体友好。', bitterness: 2, sweetness: 3, acidity: 2, alcoholIntensity: 2, freshness: 5, difficulty: 1 },
  { slug: 'long-island-iced-tea', nameZh: '长岛冰茶', nameEn: 'Long Island Iced Tea', description: '多种烈酒、橙味利口酒、柠檬和可乐混合的强酒感长饮。', originalFlavorDescription: '甜酸可乐外表下有强烈酒精骨架。', beginnerWarning: '酒精强度高且容易低估。', bitterness: 1, sweetness: 4, acidity: 3, alcoholIntensity: 5, freshness: 3, difficulty: 3 },
  { slug: 'bloody-mary', nameZh: '血腥玛丽', nameEn: 'Bloody Mary', description: '伏特加和番茄汁为核心的咸鲜长饮。', originalFlavorDescription: '番茄、咸鲜、辛香、酒感中低。', beginnerWarning: '咸鲜蔬菜感不是所有人都喜欢。', bitterness: 1, sweetness: 1, acidity: 3, alcoholIntensity: 2, freshness: 3, difficulty: 2 },
  { slug: 'espresso-martini', nameZh: '浓缩马天尼', nameEn: 'Espresso Martini', description: '伏特加、咖啡利口酒和咖啡构成的咖啡鸡尾酒。', originalFlavorDescription: '咖啡苦香、甜感、泡沫和酒精支撑。', beginnerWarning: '同时有酒精和咖啡因。', bitterness: 3, sweetness: 3, acidity: 1, alcoholIntensity: 3, freshness: 2, difficulty: 2 },
  { slug: 'pina-colada', nameZh: '椰林飘香', nameEn: 'Pina Colada', description: '朗姆、菠萝和椰子组成的热带甜饮。', originalFlavorDescription: '椰香、菠萝甜酸、厚重顺滑。', beginnerWarning: '甜度和厚重感较高。', bitterness: 0, sweetness: 5, acidity: 2, alcoholIntensity: 2, freshness: 3, difficulty: 2 },
  { slug: 'tom-collins', nameZh: '汤姆柯林斯', nameEn: 'Tom Collins', description: '金酒、柠檬、糖和苏打水组成的清爽长饮。', originalFlavorDescription: '柠檬酸甜、杜松草本、气泡清爽。', beginnerWarning: '酸度明显但容易入口。', bitterness: 1, sweetness: 3, acidity: 4, alcoholIntensity: 2, freshness: 5, difficulty: 1 },
  { slug: 'highball', nameZh: '嗨棒', nameEn: 'Highball', description: '威士忌与苏打水组成的极简高球。', originalFlavorDescription: '威士忌桶香被气泡拉长，清爽干净。', beginnerWarning: '威士忌香气直接。', bitterness: 1, sweetness: 1, acidity: 1, alcoholIntensity: 2, freshness: 5, difficulty: 1 },
  { slug: 'americano', nameZh: '美式鸡尾酒', nameEn: 'Americano', description: '金巴利、甜味美思和苏打组成的低酒精苦甜长饮。', originalFlavorDescription: '苦橙、草本、气泡和甜味美思。', beginnerWarning: '苦味仍然明显。', bitterness: 4, sweetness: 3, acidity: 1, alcoholIntensity: 2, freshness: 4, difficulty: 1 },
  { slug: 'french-75', nameZh: '法国 75', nameEn: 'French 75', description: '金酒、柠檬、糖和起泡酒组成的明亮酸甜气泡酒。', originalFlavorDescription: '柠檬、气泡、杜松和香槟感。', beginnerWarning: '气泡会让酒精更易入口。', bitterness: 1, sweetness: 3, acidity: 4, alcoholIntensity: 3, freshness: 5, difficulty: 2 },
];

const classicRecipes: Record<string, Array<{ slug: string; amountMl?: number; unit?: string; role: string; note?: string }>> = {
  negroni: [{ slug: 'gin', amountMl: 30, role: 'base' }, { slug: 'campari', amountMl: 30, role: 'liqueur' }, { slug: 'vermouth-sweet', amountMl: 30, role: 'liqueur' }, { slug: 'orange-peel', unit: 'piece', role: 'garnish' }],
  'old-fashioned': [{ slug: 'bourbon', amountMl: 60, role: 'base' }, { slug: 'sugar-cube', unit: 'piece', role: 'syrup' }, { slug: 'angostura-bitters', amountMl: 2, unit: 'dash', role: 'bitter' }, { slug: 'orange-peel', unit: 'piece', role: 'garnish' }],
  martini: [{ slug: 'gin', amountMl: 60, role: 'base' }, { slug: 'vermouth-dry', amountMl: 10, role: 'liqueur' }, { slug: 'olive', unit: 'piece', role: 'garnish', note: '或 Lemon Twist' }],
  mojito: [{ slug: 'white-rum', amountMl: 50, role: 'base' }, { slug: 'juice-lime', amountMl: 20, role: 'mixer' }, { slug: 'simple-syrup', amountMl: 15, role: 'syrup' }, { slug: 'mint-leaves', unit: 'leaves', role: 'garnish' }, { slug: 'soda-water', amountMl: 90, role: 'mixer' }],
  margarita: [{ slug: 'tequila', amountMl: 50, role: 'base' }, { slug: 'orange-liqueur', amountMl: 20, role: 'liqueur' }, { slug: 'juice-lime', amountMl: 20, role: 'mixer' }, { slug: 'salt', unit: 'rim', role: 'garnish' }],
  'gin-tonic': [{ slug: 'gin', amountMl: 45, role: 'base' }, { slug: 'tonic-water', amountMl: 120, role: 'mixer' }],
  'cuba-libre': [{ slug: 'white-rum', amountMl: 50, role: 'base' }, { slug: 'cola', amountMl: 120, role: 'mixer' }, { slug: 'juice-lime', amountMl: 10, role: 'mixer' }],
  'whiskey-sour': [{ slug: 'bourbon', amountMl: 60, role: 'base' }, { slug: 'juice-lemon', amountMl: 25, role: 'mixer' }, { slug: 'simple-syrup', amountMl: 20, role: 'syrup' }],
  daiquiri: [{ slug: 'white-rum', amountMl: 60, role: 'base' }, { slug: 'juice-lime', amountMl: 25, role: 'mixer' }, { slug: 'simple-syrup', amountMl: 15, role: 'syrup' }],
  cosmopolitan: [{ slug: 'vodka', amountMl: 40, role: 'base' }, { slug: 'orange-liqueur', amountMl: 15, role: 'liqueur' }, { slug: 'juice-cranberry', amountMl: 30, role: 'mixer' }, { slug: 'juice-lime', amountMl: 10, role: 'mixer' }],
  'moscow-mule': [{ slug: 'vodka', amountMl: 45, role: 'base' }, { slug: 'juice-lime', amountMl: 15, role: 'mixer' }, { slug: 'ginger-beer', amountMl: 120, role: 'mixer' }],
  'aperol-spritz': [{ slug: 'aperol', amountMl: 60, role: 'liqueur' }, { slug: 'sparkling-wine', amountMl: 90, role: 'base' }, { slug: 'soda-water', amountMl: 30, role: 'mixer' }],
  'long-island-iced-tea': [{ slug: 'vodka', amountMl: 15, role: 'base' }, { slug: 'gin', amountMl: 15, role: 'base' }, { slug: 'white-rum', amountMl: 15, role: 'base' }, { slug: 'tequila', amountMl: 15, role: 'base' }, { slug: 'orange-liqueur', amountMl: 15, role: 'liqueur' }, { slug: 'juice-lemon', amountMl: 25, role: 'mixer' }, { slug: 'cola', amountMl: 60, role: 'mixer' }],
  'bloody-mary': [{ slug: 'vodka', amountMl: 45, role: 'base' }, { slug: 'tomato-juice', amountMl: 120, role: 'mixer' }, { slug: 'juice-lemon', amountMl: 15, role: 'mixer' }],
  'espresso-martini': [{ slug: 'vodka', amountMl: 40, role: 'base' }, { slug: 'kahlua', amountMl: 20, role: 'liqueur' }, { slug: 'americano', amountMl: 30, role: 'mixer', note: '用浓缩咖啡更经典' }],
  'pina-colada': [{ slug: 'white-rum', amountMl: 50, role: 'base' }, { slug: 'juice-pineapple', amountMl: 90, role: 'mixer' }, { slug: 'cream-of-coconut', amountMl: 30, role: 'syrup' }],
  'tom-collins': [{ slug: 'gin', amountMl: 45, role: 'base' }, { slug: 'juice-lemon', amountMl: 25, role: 'mixer' }, { slug: 'simple-syrup', amountMl: 15, role: 'syrup' }, { slug: 'soda-water', amountMl: 90, role: 'mixer' }],
  highball: [{ slug: 'whisky', amountMl: 45, role: 'base' }, { slug: 'soda-water', amountMl: 120, role: 'mixer' }],
  americano: [{ slug: 'campari', amountMl: 30, role: 'liqueur' }, { slug: 'vermouth-sweet', amountMl: 30, role: 'liqueur' }, { slug: 'soda-water', amountMl: 90, role: 'mixer' }],
  'french-75': [{ slug: 'gin', amountMl: 30, role: 'base' }, { slug: 'juice-lemon', amountMl: 15, role: 'mixer' }, { slug: 'simple-syrup', amountMl: 10, role: 'syrup' }, { slug: 'sparkling-wine', amountMl: 90, role: 'mixer' }],
};

const safetyRules = [
  { ruleKey: 'high_abv_warning', title: '高酒精提醒', description: '该配方酒精度较高，请适量饮用。', conditionJson: { totalAbv: 'high', highAbvShare: 'high' }, severity: 'warning' },
  { ruleKey: 'caffeine_alcohol_warning', title: '酒精与咖啡因提醒', description: '该配方同时含酒精和咖啡因，请注意饮用量。', conditionJson: { containsAlcohol: true, containsCaffeine: true }, severity: 'warning' },
  { ruleKey: 'high_sugar_warning', title: '高糖提醒', description: '该配方含糖量较高。', conditionJson: { sugarShare: 'high', syrupShare: 'high' }, severity: 'info' },
  { ruleKey: 'dairy_citrus_warning', title: '乳制品与高酸提醒', description: '乳制品与高酸材料混合可能出现口感分离或凝结。', conditionJson: { containsDairy: true, highAcidityVolume: 'high' }, severity: 'info' },
  { ruleKey: 'beginner_bitter_warning', title: '新手苦味提醒', description: '该配方苦味较强，可能不适合新手。', conditionJson: { bitternessGte: 4, beginnerFriendly: true }, severity: 'info' },
];

const recipeTagCategory = (tag: string) => {
  if (['gin', 'vodka', 'whisky', 'rum', 'tequila', 'beer', 'wine', 'liqueur', 'brandy', 'mezcal', 'sake', 'soju', 'non_alcoholic'].includes(tag)) return 'base_spirit';
  if (['适合新手', '低酒感', '入门友好'].includes(tag)) return 'beginner';
  if (['不用摇壶', '便利店版'].includes(tag)) return 'convenience';
  if (['清爽一点', '果汁型', '果香增强', '甜一点', '酸一点', '茶感明显', '奶香一点', '咖啡型'].includes(tag)) return 'flavor';
  return 'flavor';
};

const recipeTagSlug = (tag: string) => `tag-${slugify(tag) || Buffer.from(tag).toString('hex').slice(0, 16)}`;

const toOriginalRecipeJson = (recipe: RecipeSeed) => ({
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

async function seedInspirationCatalog() {
  const tagMap: Record<string, bigint> = {};
  for (const remixTag of REMIX_TAGS) {
    const created = await prisma.remixTag.upsert({
      where: { slug: remixTag.slug },
      update: {
        nameCn: remixTag.nameCn,
        nameEn: remixTag.nameEn,
        description: remixTag.description,
        sortOrder: remixTag.sortOrder,
        isActive: true,
      },
      create: {
        slug: remixTag.slug,
        nameCn: remixTag.nameCn,
        nameEn: remixTag.nameEn,
        description: remixTag.description,
        sortOrder: remixTag.sortOrder,
        isActive: true,
      },
    });
    tagMap[remixTag.nameCn] = created.id;
  }

  for (const recipe of INSPIRATION_RECIPES) {
    const createdRecipe = await prisma.recipe.upsert({
      where: { slug: recipe.slug },
      update: {
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
      },
      create: {
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
      },
    });

    await prisma.recipeIngredient.deleteMany({ where: { recipeId: createdRecipe.id } });
    for (const [index, ingredient] of recipe.ingredients.entries()) {
      await prisma.recipeIngredient.create({
        data: {
          recipeId: createdRecipe.id,
          ingredientNameCn: ingredient.nameCn,
          ingredientNameEn: ingredient.nameEn,
          amount: ingredient.amount,
          unit: ingredient.unit,
          role: ingredient.role,
          isOptional: ingredient.isOptional ?? false,
          substituteNote: ingredient.substituteNote ?? null,
          sortOrder: index + 1,
        },
      });
    }

    for (const tag of recipe.tags) {
      const tagSlug = recipeTagSlug(tag);
      const createdTag = await prisma.tag.upsert({
        where: { slug: tagSlug },
        update: { nameCn: tag, nameEn: tag, category: recipeTagCategory(tag), isActive: true },
        create: { slug: tagSlug, nameCn: tag, nameEn: tag, category: recipeTagCategory(tag), isActive: true },
      });
      await prisma.recipeTag.upsert({
        where: { recipeId_tagId: { recipeId: createdRecipe.id, tagId: createdTag.id } },
        update: {},
        create: { recipeId: createdRecipe.id, tagId: createdTag.id },
      });
    }
  }

  const classicMap: Record<string, bigint> = {};
  for (const classic of CLASSIC_RECIPE_SEEDS) {
    const created = await prisma.classicCocktail.upsert({
      where: { slug: classic.slug },
      update: {
        nameCn: classic.nameCn,
        nameEn: classic.nameEn,
        description: classic.description,
        baseSpirit: classic.baseSpirit,
        originalRecipe: toOriginalRecipeJson(classic),
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
      },
      create: {
        slug: classic.slug,
        nameCn: classic.nameCn,
        nameEn: classic.nameEn,
        description: classic.description,
        baseSpirit: classic.baseSpirit,
        originalRecipe: toOriginalRecipeJson(classic),
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
      },
    });
    classicMap[classic.slug] = created.id;
  }

  const variantRecipes = INSPIRATION_RECIPES.filter((recipe) => recipe.type === 'classic_variant');
  for (const recipe of variantRecipes) {
    const originalSlug = recipe.slug.replace(/^variant-/, '').replace(/-(less-alcohol|less-bitter|sweeter|more-acid|fresher|fruitier|lighter-body|sparkling|convenience|beginner|no-shaker|low-cost|tea-forward|milky|coffee|juice|long-drink|hot-drink)$/, '');
    const cocktailId = classicMap[originalSlug];
    if (!cocktailId) continue;

    await prisma.classicCocktailVariant.deleteMany({
      where: {
        cocktailId,
        titleCn: recipe.nameCn,
      },
    });

    const createdVariant = await prisma.classicCocktailVariant.create({
      data: {
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
      },
    });

    for (const [index, ingredient] of recipe.ingredients.entries()) {
      await prisma.variantIngredient.create({
        data: {
          variantId: createdVariant.id,
          ingredientNameCn: ingredient.nameCn,
          ingredientNameEn: ingredient.nameEn,
          amount: ingredient.amount,
          unit: ingredient.unit,
          role: ingredient.role,
          isOptional: ingredient.isOptional ?? false,
          substituteNote: ingredient.substituteNote ?? null,
          sortOrder: index + 1,
        },
      });
    }

    for (const tag of recipe.tags) {
      const remixTagId = tagMap[tag];
      if (!remixTagId) continue;
      await prisma.classicCocktailVariantTag.upsert({
        where: { variantId_tagId: { variantId: createdVariant.id, tagId: remixTagId } },
        update: {},
        create: { variantId: createdVariant.id, tagId: remixTagId },
      });
    }

    const originalRecipe = await prisma.recipe.findUnique({ where: { slug: originalSlug } });
    const variantRecipe = await prisma.recipe.findUnique({ where: { slug: recipe.slug } });
    if (originalRecipe && variantRecipe) {
      await prisma.classicRecipeVariant.upsert({
        where: {
          originalRecipeId_variantRecipeId: {
            originalRecipeId: originalRecipe.id,
            variantRecipeId: variantRecipe.id,
          },
        },
        update: {
          remixDirection: recipe.tags.slice(0, 2).join(', '),
          changeSummary: recipe.description,
        },
        create: {
          originalRecipeId: originalRecipe.id,
          variantRecipeId: variantRecipe.id,
          remixDirection: recipe.tags.slice(0, 2).join(', '),
          changeSummary: recipe.description,
        },
      });
    }
  }
}

async function main() {
  console.log('Seeding AlcheMix Lab database...');

  const dataSourceMap: Record<string, bigint> = {};
  for (const source of dataSources) {
    const created = await prisma.dataSource.upsert({
      where: { name: source.name },
      update: source,
      create: source,
    });
    dataSourceMap[source.name] = created.id;
  }

  const ingredientMap: Record<string, bigint> = {};
  for (const ingredient of ingredients) {
    const { profiles, ...ingredientData } = ingredient;
    const createdIngredient = await prisma.ingredient.upsert({
      where: { slug: ingredient.slug },
      update: ingredientData,
      create: ingredientData,
    });
    ingredientMap[ingredient.slug] = createdIngredient.id;

    await prisma.flavorProfile.upsert({
      where: { ingredientId: createdIngredient.id },
      update: {
        sweetness: profiles.sweetness ?? 0,
        sourness: profiles.sourness ?? 0,
        bitterness: profiles.bitterness ?? 0,
        alcoholStrength: profiles.alcoholStrength ?? 0,
        freshness: profiles.freshness ?? 0,
        fruitiness: profiles.fruitiness ?? 0,
        teaLevel: profiles.teaLevel ?? 0,
        dairyLevel: profiles.dairyLevel ?? 0,
        herbalLevel: profiles.herbalLevel ?? 0,
        spiceLevel: profiles.spiceLevel ?? 0,
        body: profiles.body ?? 1,
        aromaTags: profiles.aromaTags ?? [],
        flavorTags: profiles.flavorTags ?? [],
      },
      create: {
        ingredientId: createdIngredient.id,
        sweetness: profiles.sweetness ?? 0,
        sourness: profiles.sourness ?? 0,
        bitterness: profiles.bitterness ?? 0,
        alcoholStrength: profiles.alcoholStrength ?? 0,
        freshness: profiles.freshness ?? 0,
        fruitiness: profiles.fruitiness ?? 0,
        teaLevel: profiles.teaLevel ?? 0,
        dairyLevel: profiles.dairyLevel ?? 0,
        herbalLevel: profiles.herbalLevel ?? 0,
        spiceLevel: profiles.spiceLevel ?? 0,
        body: profiles.body ?? 1,
        aromaTags: profiles.aromaTags ?? [],
        flavorTags: profiles.flavorTags ?? [],
      },
    });
  }

  for (const product of products) {
    const { ingredientSlugs, sourceName, ...productData } = product;
    const createdProduct = await prisma.product.upsert({
      where: { barcode: product.barcode },
      update: {
        ...productData,
        caffeineContentPer100ml: product.caffeineContentPer100ml ?? null,
        sourceId: dataSourceMap[sourceName],
      },
      create: {
        ...productData,
        caffeineContentPer100ml: product.caffeineContentPer100ml ?? null,
        sourceId: dataSourceMap[sourceName],
      },
    });

    for (const slug of ingredientSlugs) {
      const ingredientId = ingredientMap[slug];
      if (!ingredientId) continue;

      await prisma.productIngredient.upsert({
        where: {
          productId_ingredientId: {
            productId: createdProduct.id,
            ingredientId,
          },
        },
        update: {},
        create: {
          productId: createdProduct.id,
          ingredientId,
        },
      });
    }
  }

  for (const rule of pairingRules) {
    await prisma.labPairingRule.deleteMany({
      where: {
        targetSlugA: rule.targetSlugA,
        targetSlugB: rule.targetSlugB,
        ruleType: rule.ruleType,
      },
    });

    await prisma.labPairingRule.create({ data: rule });
  }

  for (const template of cocktailTemplates) {
    await prisma.cocktailTemplate.upsert({
      where: { name: template.name },
      update: template,
      create: template,
    });
  }

  const cocktailMap: Record<string, bigint> = {};
  for (const cocktail of classicCocktails) {
    const createdCocktail = await prisma.cocktail.upsert({
      where: { slug: cocktail.slug },
      update: cocktail,
      create: cocktail,
    });
    cocktailMap[cocktail.slug] = createdCocktail.id;
  }

  for (const [cocktailSlug, recipeItems] of Object.entries(classicRecipes)) {
    const cocktailId = cocktailMap[cocktailSlug];
    if (!cocktailId) continue;

    await prisma.cocktailIngredient.deleteMany({ where: { cocktailId } });

    for (const [index, item] of recipeItems.entries()) {
      const ingredientId = ingredientMap[item.slug];
      if (!ingredientId) {
        console.warn(`Missing ingredient for ${cocktailSlug}: ${item.slug}`);
        continue;
      }

      await prisma.cocktailIngredient.create({
        data: {
          cocktailId,
          ingredientId,
          amountMl: item.amountMl ?? null,
          unit: item.unit ?? 'ml',
          role: item.role,
          note: item.note ?? null,
          order: index + 1,
        },
      });
    }
  }

  for (const rule of safetyRules) {
    await prisma.safetyRule.upsert({
      where: { ruleKey: rule.ruleKey },
      update: rule,
      create: rule,
    });
  }

  await seedInspirationCatalog();

  console.log('Seed completed successfully.');
  console.log(`ingredients: ${ingredients.length}`);
  console.log(`products: ${products.length}`);
  console.log(`flavor_profiles: ${ingredients.length}`);
  console.log(`lab_pairing_rules: ${pairingRules.length}`);
  console.log(`cocktail_templates: ${cocktailTemplates.length}`);
  console.log(`cocktails: ${classicCocktails.length}`);
  console.log(`cocktail_ingredients: ${Object.values(classicRecipes).reduce((sum, items) => sum + items.length, 0)}`);
  console.log(`safety_rules: ${safetyRules.length}`);
  console.log(`inspiration_recipes: ${INSPIRATION_RECIPES.length}`);
  console.log(`classic_remix_tags: ${REMIX_TAGS.length}`);
  console.log(`classic_cocktail_variants: ${INSPIRATION_RECIPES.filter((recipe) => recipe.type === 'classic_variant').length}`);
}

main()
  .catch((error) => {
    console.error('Error during seeding:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
