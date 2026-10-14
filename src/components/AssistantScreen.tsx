import { dedupeRecipes } from '../lib/recipes/identity';
import Link from "next/link";
import { convenienceExploreCocktails, getConvenienceRecipeGuide } from "../lib/data/explore-catalog";
import React, { useEffect, useMemo, useState } from "react";
import { DrinkLog, DrinkLogRecipeSnapshot, SavedCocktail } from "../types";
import { CONVENIENCE_DRINK_INGREDIENTS } from "../lib/data/convenience-drink-ingredients";
import { INSPIRATION_RECIPES, RecipeSeed } from "../lib/data/inspiration-catalog";
import { DrinkLogButton } from "./DrinkLog";

interface AssistantScreenProps {
  initialPage?: "home" | "material-picker";
  onBackHome?: () => void;
  onSaveCocktail: (cocktail: SavedCocktail) => Promise<void>;
  drinkLogs: DrinkLog[];
  onSaveDrinkLog: (log: DrinkLog) => void | Promise<void>;
}

type RecommendationResult = {
  recipe: RecipeSeed;
  matched: string[];
  missing: string[];
  score: number;
};

type MoodOption = {
  slug: string;
  label: string;
  icon: string;
  profile: string;
  tags: string[];
  reason: string;
};

type BlindBox = {
  slug: string;
  name: string;
  subtitle: string;
  icon: string;
  tags: string[];
};

const spiritSeeds = [
  { nameZh: "金酒", nameEn: "Gin", aliases: ["gin", "金酒"], category: "基酒", suitableWith: ["汤力水", "苏打水", "柠檬", "西柚汁"] },
  { nameZh: "伏特加", nameEn: "Vodka", aliases: ["vodka", "伏特加"], category: "基酒", suitableWith: ["橙汁", "蔓越莓汁", "苏打水", "水溶C"] },
  { nameZh: "威士忌", nameEn: "Whisky", aliases: ["whisky", "whiskey", "威士忌"], category: "基酒", suitableWith: ["可乐", "苏打水", "乌龙茶", "咖啡"] },
  { nameZh: "朗姆", nameEn: "Rum", aliases: ["rum", "朗姆"], category: "基酒", suitableWith: ["可乐", "菠萝汁", "椰奶饮料", "青柠"] },
  { nameZh: "龙舌兰", nameEn: "Tequila", aliases: ["tequila", "龙舌兰"], category: "基酒", suitableWith: ["西柚汁", "橙汁", "青柠", "苏打水"] },
  { nameZh: "烧酒", nameEn: "Soju", aliases: ["soju", "烧酒"], category: "基酒", suitableWith: ["养乐多", "苏打水", "水溶C", "果汁"] },
  { nameZh: "梅酒", nameEn: "Umeshu", aliases: ["umeshu", "梅酒"], category: "基酒", suitableWith: ["苏打水", "绿茶", "冰块"] },
  { nameZh: "啤酒", nameEn: "Beer", aliases: ["beer", "啤酒"], category: "基酒", suitableWith: ["西柚汁", "番茄汁", "柠檬"] },
];

const labIngredientLibrary = [
  ...spiritSeeds.map((item) => ({
    id: `spirit-${item.nameEn.toLowerCase()}`,
    nameZh: item.nameZh,
    nameEn: item.nameEn,
    aliases: item.aliases,
    category: item.category,
    subCategory: "常见基酒",
    flavorTags: ["基酒"],
    suitableWith: item.suitableWith,
    avoidWith: [],
    recommendedVolumeMl: [20, 30, 45],
    convenienceStoreAvailability: 3,
  })),
  ...CONVENIENCE_DRINK_INGREDIENTS.map((item) => ({
    id: item.slug,
    nameZh: item.nameZh,
    nameEn: item.nameEn,
    aliases: item.aliases,
    category: item.category,
    subCategory: item.subCategory,
    flavorTags: item.flavorTags,
    suitableWith: item.suitableWith,
    avoidWith: item.avoidWith,
    recommendedVolumeMl: item.recommendedVolumeMl,
    convenienceStoreAvailability: item.convenienceStoreAvailability,
  })),
];

const popularQuickIngredients = [
  "金酒",
  "伏特加",
  "威士忌",
  "朗姆",
  "烧酒",
  "啤酒",
  "苏打水",
  "汤力水",
  "可乐",
  "雪碧",
  "水溶C",
  "养乐多",
  "乌龙茶",
  "橙汁",
  "西柚汁",
  "椰奶饮料",
];

const moodOptions: MoodOption[] = [
  {
    slug: "happy",
    label: "开心",
    icon: "sentiment_satisfied",
    profile: "明亮、果香、气泡",
    tags: ["果香", "清爽", "气泡", "酸甜", "convenience"],
    reason: "开心的时候适合用果香和气泡放大轻快感，酸甜口也更容易被接受。",
  },
  {
    slug: "sad",
    label: "难过",
    icon: "rainy",
    profile: "甜润、顺滑、低刺激",
    tags: ["甜", "奶香", "低酒感", "新手", "beginner"],
    reason: "低刺激、甜润和顺滑的口感更像安慰型饮品，尽量避开强苦和高酒感。",
  },
  {
    slug: "excited",
    label: "激动",
    icon: "bolt",
    profile: "气泡、柑橘、聚会感",
    tags: ["气泡", "清爽", "酸", "长饮", "convenience"],
    reason: "高唤醒状态适合清爽长饮，气泡和柑橘能让入口更有节奏。",
  },
  {
    slug: "anxious",
    label: "焦虑",
    icon: "spa",
    profile: "低酒感、茶感、少苦",
    tags: ["低酒感", "茶", "清爽", "新手", "beginner"],
    reason: "焦虑时不适合强烈酒精冲击，茶饮、低糖气泡和低酒感更稳。",
  },
  {
    slug: "tired",
    label: "疲惫",
    icon: "bedtime",
    profile: "柔和、微甜、简单",
    tags: ["甜", "低酒感", "顺滑", "便利店", "convenience"],
    reason: "疲惫时推荐步骤少、甜度适中、酒感低的配方，减少负担。",
  },
  {
    slug: "romantic",
    label: "心动",
    icon: "favorite",
    profile: "莓果、甜香、漂亮颜色",
    tags: ["果香", "甜", "酸甜", "classic"],
    reason: "积极亲密的情绪常和甜感、香气、颜色联想在一起，适合漂亮的果香酒卡。",
  },
  {
    slug: "angry",
    label: "烦躁",
    icon: "local_fire_department",
    profile: "冰爽、强稀释、低甜",
    tags: ["清爽", "苏打", "低酒感", "酸", "长饮"],
    reason: "烦躁时先用冰块、气泡和低甜度拉开刺激感，避免越喝越腻。",
  },
  {
    slug: "curious",
    label: "好奇",
    icon: "travel_explore",
    profile: "草本、微苦、经典",
    tags: ["草本", "苦甜", "classic", "经典鸡尾酒"],
    reason: "想探索新味道时，可以试一点草本或微苦，但推荐从平衡款开始。",
  },
];

const blindBoxConfig: BlindBox = {
  slug: "all-random",
  name: "随机一杯盲盒",
  subtitle: "从全部酒单随机装入 12 张隐藏酒卡",
  icon: "casino",
  tags: [],
};

const recipePool = dedupeRecipes(INSPIRATION_RECIPES)
  .filter((recipe) => recipe.difficulty <= 4 && recipe.alcoholIntensity <= 4)
  .slice(0, 520);

const normalize = (value: string) => value.trim().toLowerCase();

const unique = <T,>(items: T[]) => Array.from(new Set(items));

const sampleRecipes = (items: RecipeSeed[], count: number, excludeSlug?: string) => {
  const pool = items.filter((item) => item.slug !== excludeSlug);
  return [...pool].sort(() => Math.random() - 0.5).slice(0, count);
};

const todaySeedKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
};

const seededHash = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const dailySampleRecipes = (items: RecipeSeed[], count: number, seedKey = todaySeedKey()) =>
  [...items]
    .sort((a, b) => seededHash(`${seedKey}-${a.slug}`) - seededHash(`${seedKey}-${b.slug}`))
    .slice(0, count);

const recipeTerms = (recipe: RecipeSeed) =>
  [
    recipe.slug,
    recipe.nameCn,
    recipe.nameEn,
    recipe.baseSpirit,
    recipe.description,
    recipe.type,
    ...recipe.tags,
    ...recipe.ingredients.flatMap((item) => [item.nameCn, item.nameEn]),
  ]
    .filter(Boolean)
    .map((item) => normalize(String(item)));

const ingredientTerms = (ingredient: typeof labIngredientLibrary[number]) =>
  [ingredient.nameZh, ingredient.nameEn, ingredient.category, ingredient.subCategory, ...ingredient.aliases, ...ingredient.flavorTags]
    .filter(Boolean)
    .map((item) => normalize(String(item)));

const ingredientMatches = (query: string, terms: string[]) => {
  const normalizedQuery = normalize(query);
  return Boolean(normalizedQuery) && terms.some((term) => term.includes(normalizedQuery) || normalizedQuery.includes(term));
};

const findIngredient = (query: string) => {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return null;

  const scored = labIngredientLibrary
    .map((ingredient) => {
      const terms = ingredientTerms(ingredient);
      const exact = terms.some((term) => term === normalizedQuery);
      const partial = terms.some((term) => term.includes(normalizedQuery) || normalizedQuery.includes(term));
      const score = (exact ? 100 : 0) + (partial ? 40 : 0) + ingredient.convenienceStoreAvailability * 3;
      return { ingredient, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.ingredient ?? null;
};

const searchIngredientSuggestions = (query: string) => {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];
  return labIngredientLibrary
    .filter((ingredient) => ingredientTerms(ingredient).some((term) => term.includes(normalizedQuery) || normalizedQuery.includes(term)))
    .sort((a, b) => b.convenienceStoreAvailability - a.convenienceStoreAvailability)
    .slice(0, 6);
};

const recipeIngredientMatched = (recipeIngredient: string, selectedIngredient: typeof labIngredientLibrary[number]) => {
  const recipeText = normalize(recipeIngredient);
  const terms = ingredientTerms(selectedIngredient);
  return terms.some((term) => recipeText.includes(term) || term.includes(recipeText));
};

const analyzeRecipe = (recipe: RecipeSeed, selectedIngredients: typeof labIngredientLibrary): RecommendationResult => {
  const required = recipe.ingredients.filter((item) => !item.isOptional && Number(item.amount || 0) !== 0);
  const terms = recipeTerms(recipe);
  const matched = selectedIngredients
    .filter((ingredient) => {
      if (terms.some((term) => ingredientTerms(ingredient).some((ingredientTerm) => term.includes(ingredientTerm) || ingredientTerm.includes(term)))) return true;
      return ingredient.suitableWith.some((pairing) => terms.some((term) => term.includes(normalize(pairing))));
    })
    .map((ingredient) => ingredient.nameZh);

  const missing = required
    .filter((item) => !selectedIngredients.some((ingredient) => recipeIngredientMatched(item.nameCn, ingredient) || recipeIngredientMatched(item.nameEn, ingredient)))
    .map((item) => item.nameCn);

  const pairingBonus = selectedIngredients.reduce((sum, ingredient) => {
    const bonus = ingredient.suitableWith.filter((pairing) => terms.some((term) => term.includes(normalize(pairing)))).length;
    return sum + bonus;
  }, 0);

  const score =
    matched.length * 18 -
    missing.length * 8 +
    pairingBonus * 5 +
    recipe.beginnerScore * 2 +
    recipe.convenienceScore * 2 -
    recipe.difficulty * 2;

  return { recipe, matched: unique(matched), missing: unique(missing).slice(0, 4), score };
};

const pickByTags = (tags: string[], excludeSlug?: string, limit = 12) => {
  const normalizedTags = tags.map(normalize);
  const scored = recipePool
    .filter((recipe) => recipe.slug !== excludeSlug)
    .map((recipe) => {
      const terms = recipeTerms(recipe);
      const tagScore = normalizedTags.length === 0 ? 1 : normalizedTags.filter((tag) => terms.some((term) => term.includes(tag))).length;
      return {
        recipe,
        score: tagScore * 12 + recipe.beginnerScore * 2 + recipe.convenienceScore * 2 + recipe.freshnessLevel + recipe.fruitinessLevel - recipe.difficulty,
      };
    })
    .filter((item) => normalizedTags.length === 0 || item.score > 10)
    .sort((a, b) => b.score - a.score);
  return scored.map((item) => item.recipe).slice(0, limit);
};

const moodEncouragement = (mood: MoodOption, recipe?: RecipeSeed) => {
  const name = recipe ? `「${recipe.nameCn}」` : "这杯酒";
  const messages: Record<string, string> = {
    happy: `开心的时候，适合把这份轻快延长一点。${name}会给你一点明亮的香气和气泡感，像把今天的小好事再放大一格。`,
    sad: `难过的时候不用急着变好，先让味道温柔一点。${name}会尽量避开太冲、太苦的刺激，给你一杯慢慢喝也不费力的安慰。`,
    excited: `现在能量很满，就让这杯酒负责接住这种兴奋。${name}的节奏会更清爽直接，适合把开心、期待、热闹感继续推起来。`,
    anxious: `焦虑的时候，别给自己太强的酒精压力。${name}会更轻、更稳，适合慢慢喝，先把呼吸和节奏放下来。`,
    tired: `累的时候不需要复杂配方。${name}会偏简单、柔和、低负担，像给今天收个尾，而不是再增加一个任务。`,
    romantic: `心动的时候，漂亮的颜色和一点甜香会更有记忆点。${name}适合慢慢喝，让气氛轻一点、柔一点。`,
    angry: `烦躁的时候，先别用重酒感硬碰硬。${name}会用冰、气泡或清爽感把情绪降温一点，给你一个好入口的缓冲。`,
    curious: `好奇心在线的时候，可以试一点新的风味边界。${name}不会太难懂，但会有一点草本、酸甜或经典结构，适合探索。`,
  };
  return messages[mood.slug] ?? `${name}会按照你现在的心情，给你一个更好入口的风味方向。`;
};

const recipeToSavedCocktail = (recipe: RecipeSeed): SavedCocktail => ({
  id: recipe.slug,
  recipeId: recipe.slug,
  chineseName: recipe.nameCn,
  name: recipe.nameEn,
  subtitle: recipe.description,
  spirit: recipe.baseSpirit,
  mixer: recipe.ingredients.slice(1, 3).map((item) => item.nameCn).join(" + ") || "按配方加入",
  size: `${recipe.ingredients.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) || 180}ml`,
  rating: {
    sweet: recipe.sweetnessLevel,
    acid: recipe.acidityLevel,
    strength: recipe.alcoholIntensity,
  },
  comments: recipe.method,
  tags: recipe.tags.slice(0, 4),
  savedAt: new Date().toISOString().split("T")[0],
  ratingValue: recipe.beginnerScore,
  sourcePage: "classic_remix",
});

const recipeToDrinkLogSnapshot = (recipe: RecipeSeed): DrinkLogRecipeSnapshot => ({
  id: recipe.slug,
  nameZh: recipe.nameCn,
  nameEn: recipe.nameEn,
  description: recipe.description,
  tags: recipe.tags,
  ingredients: recipe.ingredients.map((item) => ({
    name: item.nameCn,
    amount: item.amount,
    unit: item.unit,
  })),
  method: recipe.method,
});

function RecipeCard({
  recipe,
  matched = [],
  missing = [],
  reason,
  compact = false,
  onSave,
  drinkLogs,
  onSaveDrinkLog,
  sourcePage,
}: {
  recipe: RecipeSeed;
  matched?: string[];
  missing?: string[];
  reason?: string;
  compact?: boolean;
  onSave: (recipe: RecipeSeed) => Promise<void>;
  drinkLogs: DrinkLog[];
  onSaveDrinkLog: (log: DrinkLog) => void | Promise<void>;
  sourcePage: string;
}) {
  const required = recipe.ingredients.filter((item) => !item.isOptional && Number(item.amount || 0) !== 0);
  const [justSaved, setJustSaved] = useState(false);
  const handleFavorite = async () => {
    try {
      await onSave(recipe);
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 1600);
    } catch (error) { window.alert(error instanceof Error ? error.message : "收藏失败，请重试"); }
  };

  return (
    <article className="rounded-2xl border border-[#E8E8E8] bg-white p-4 shadow-none">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-medium leading-tight text-neutral-950">{recipe.nameCn}</h3>
          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">{recipe.nameEn}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <DrinkLogButton
            recipe={recipeToDrinkLogSnapshot(recipe)}
            sourcePage={sourcePage}
            drinkLogs={drinkLogs}
            onSaveDrinkLog={onSaveDrinkLog}
            variant="compact"
          />
          <button
            type="button"
            onClick={handleFavorite}
            className={`cursor-pointer rounded-full border px-3 py-1.5 text-[11px] font-medium active:scale-[0.98] ${
              justSaved ? "border-neutral-950 bg-neutral-950 text-white" : "border-[#E8E8E8] text-neutral-600"
            }`}
          >
            {justSaved ? "已收藏" : "收藏"}
          </button>
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-neutral-600">{reason ?? recipe.description}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {recipe.tags.slice(0, 4).map((tag) => (
          <span key={tag} className="rounded-full bg-[#F2F2F2] px-2.5 py-1 text-[10px] font-medium text-neutral-500">
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-[11px] font-medium text-neutral-400">需要材料</p>
        <div className="flex flex-wrap gap-1.5">
          {required.map((item) => {
            const isMissing = missing.includes(item.nameCn);
            const isMatched = matched.some((name) => ingredientMatches(name, [normalize(item.nameCn), normalize(item.nameEn)]));
            return (
              <span
                key={`${recipe.slug}-${item.nameCn}`}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                  isMissing
                    ? "border-red-100 bg-red-50 text-red-500"
                    : isMatched
                      ? "border-green-100 bg-green-50 text-green-700"
                      : "border-[#E8E8E8] bg-white text-neutral-500"
                }`}
              >
                {item.nameCn} {item.amount}{item.unit}
              </span>
            );
          })}
        </div>
      </div>

      {!compact && (
        <div className="mt-4 rounded-2xl bg-[#f6f5f1] p-3">
          <p className="text-[11px] font-medium text-neutral-400">做法</p>
          <p className="mt-1 text-xs leading-5 text-neutral-600">{recipe.method}</p>
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          ["酒感", recipe.alcoholIntensity],
          ["新手", recipe.beginnerScore],
          ["便利店", recipe.convenienceScore],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-[#f6f5f1] px-2 py-2">
            <p className="text-[10px] text-neutral-400">{label}</p>
            <p className="text-sm font-medium text-neutral-950">{value}/5</p>
          </div>
        ))}
      </div>
    </article>
  );
}

export default function AssistantScreen({ onSaveCocktail, drinkLogs, onSaveDrinkLog, initialPage = "home", onBackHome }: AssistantScreenProps) {
  const [assistantPage, setAssistantPage] = useState<"home" | "material-picker" | "material-results" | "mood-results" | "blind-box">(initialPage);
  const [materialInput, setMaterialInput] = useState("");
  const [materials, setMaterials] = useState<typeof labIngredientLibrary>([]);
  const [hasRecommended, setHasRecommended] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("alchemix_material_results") || "null");
      if (Array.isArray(saved)) {
        setMaterials(labIngredientLibrary.filter(item => saved.includes(item.id)));
        setHasRecommended(true);
        setAssistantPage("material-results");
      }
    } catch { /* Materials can still be selected when storage is unavailable. */ }
  }, []);
  const [selectedMood, setSelectedMood] = useState<MoodOption | null>(null);
  const [moodRecipes, setMoodRecipes] = useState<RecipeSeed[]>([]);
  const [openedBox, setOpenedBox] = useState<BlindBox | null>(null);
  const [blindDeck, setBlindDeck] = useState<RecipeSeed[]>([]);
  const [blindRecipe, setBlindRecipe] = useState<RecipeSeed | null>(null);
  const [selectedBlindIndex, setSelectedBlindIndex] = useState<number | null>(null);
  const [isBlindRevealed, setIsBlindRevealed] = useState(false);
  const [lastDrawSlug, setLastDrawSlug] = useState("");

  const suggestions = useMemo(() => searchIngredientSuggestions(materialInput), [materialInput]);

  const groupedMaterials = useMemo(() => {
    const groups = ["基酒", "便利店酒饮", "气泡饮料", "果汁", "茶饮", "乳酸饮料", "奶类", "功能饮料", "咖啡", "水"];
    return groups
      .map((label) => ({ label, items: materials.filter((item) => item.category === label || item.subCategory.includes(label)) }))
      .filter((group) => group.items.length > 0);
  }, [materials]);

  const recommendations = useMemo(() => {
    if (!hasRecommended || materials.length === 0) return { canMake: [] };
    const canMake = convenienceExploreCocktails.filter((drink) => {
      const required = getConvenienceRecipeGuide(drink).ingredientLines
        .filter(line => !line.includes("可选") && !line.startsWith("冰块"))
        .map(line => line.split(/\s+[A-Za-z0-9]/)[0].trim());
      return required.length > 0 && required.every(name =>
        materials.some(ingredient => [ingredient.nameZh, ingredient.nameEn, ...ingredient.aliases].some(alias => {
          const term = normalize(alias);
          return term.length > 0 && (normalize(name) === term || normalize(name).includes(term) || term.includes(normalize(name)));
        })));
    });
    return { canMake };
  }, [hasRecommended, materials]);

  const addMaterial = (value = materialInput, keepResults = false) => {
    const match = findIngredient(value);
    if (!match || materials.some((item) => item.id === match.id)) {
      setMaterialInput("");
      return;
    }
    setMaterials((prev) => [...prev, match]);
    setMaterialInput("");
    setHasRecommended(keepResults);
  };

  const removeMaterial = (id: string) => {
    setMaterials((prev) => prev.filter((item) => item.id !== id));
    setHasRecommended(false);
  };

  const handleMoodSelect = (mood: MoodOption) => {
    setSelectedMood(mood);
    setMoodRecipes(pickByTags(mood.tags, undefined, 5));
    setAssistantPage("mood-results");
  };

  const handleBlindBoxOpen = () => {
    const nextDeck = sampleRecipes(recipePool, 12, lastDrawSlug);
    setOpenedBox(blindBoxConfig);
    setBlindDeck(nextDeck);
    setBlindRecipe(null);
    setSelectedBlindIndex(null);
    setIsBlindRevealed(false);
    setAssistantPage("blind-box");
  };

  const drawFromBox = (index: number) => {
    if (!openedBox || !blindDeck[index]) return;
    const recipe = blindDeck[index];
    setSelectedBlindIndex(index);
    setBlindRecipe(recipe);
    setLastDrawSlug(recipe.slug);
    setIsBlindRevealed(false);
  };

  const handleSave = async (recipe: RecipeSeed) => {
    await onSaveCocktail(recipeToSavedCocktail(recipe));
  };

  const featured = useMemo(
    () => dailySampleRecipes(
      recipePool.filter((recipe) => recipe.beginnerScore >= 4 && recipe.convenienceScore >= 4),
      3,
    ),
    [],
  );

  const noMaterialResults =
    hasRecommended &&
    materials.length > 0 &&
    recommendations.canMake.length === 0;

  if (assistantPage === "material-picker") {
    return (
      <div className="mx-auto max-w-[430px] space-y-5 pb-8">
        <button
          type="button"
          onClick={() => onBackHome ? onBackHome() : setAssistantPage("home")}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#E1E1DE] bg-white px-3.5 py-2 text-xs font-medium text-neutral-700 shadow-none active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          返回调酒助手
        </button>

        <section className="space-y-2">
          <span className="inline-flex rounded-full border border-[#E8E8E8] bg-white px-3 py-1 text-[11px] font-medium text-neutral-500">Material Match</span>
          <h2 className="text-[28px] font-medium leading-tight text-neutral-950">我的材料</h2>
          <p className="text-sm leading-6 text-neutral-500">选择你手边已有的酒和饮料，看看现在能做什么。</p>
        </section>

        <section className="rounded-2xl border border-[#E8E8E8] bg-white p-4 shadow-none">
          <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); addMaterial(); }}>
            <input
              value={materialInput}
              onChange={(event) => setMaterialInput(event.target.value)}
              placeholder="搜索酒类、饮料或配料"
              className="min-w-0 flex-1 rounded-full border border-[#E1E1DE] bg-[#f6f5f1] px-4 py-3 text-sm outline-none focus:border-neutral-950"
            />
            <button type="submit" className="cursor-pointer rounded-full bg-neutral-950 px-4 text-sm font-medium text-white active:scale-[0.98]">添加</button>
          </form>

          {suggestions.length > 0 && (
            <div className="mt-2 rounded-2xl border border-[#E8E8E8] bg-[#FCFCFA] p-2">
              {suggestions.map((item) => (
                <button type="button" key={item.id} onClick={() => addMaterial(item.nameZh)} className="flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-left active:scale-[0.99]">
                  <span><span className="block text-xs font-medium text-neutral-900">{item.nameZh}</span><span className="block text-[11px] text-neutral-400">{item.nameEn}</span></span>
                  <span className="text-[11px] font-medium text-neutral-400">{item.category}</span>
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {popularQuickIngredients.map((item) => (
              <button type="button" key={item} onClick={() => addMaterial(item)} className="cursor-pointer rounded-full bg-[#F2F2F2] px-3 py-1.5 text-xs font-medium text-neutral-600 active:scale-[0.98]">{item}</button>
            ))}
          </div>

          {materials.length > 0 && (
            <div className="mt-4 space-y-3">
              {groupedMaterials.map((group) => (
                <div key={group.label}>
                  <p className="mb-1.5 text-[11px] font-medium text-neutral-400">{group.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {group.items.map((item) => (
                      <button type="button" key={item.id} onClick={() => removeMaterial(item.id)} className="cursor-pointer rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 active:scale-[0.98]">{item.nameZh} ×</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => { setHasRecommended(true); if (materials.length > 0) setAssistantPage("material-results"); }}
            className="mt-4 w-full cursor-pointer rounded-2xl bg-neutral-950 py-3.5 text-sm font-medium text-white active:scale-[0.99]"
          >
            生成我能做的酒卡
          </button>
          {hasRecommended && materials.length === 0 && <p className="mt-3 rounded-2xl bg-[#f6f5f1] p-3 text-xs leading-5 text-neutral-500">先添加 1–2 个材料，比如金酒、苏打水、养乐多或水溶C。</p>}
        </section>
      </div>
    );
  }

  if (assistantPage === "material-results") {
    return (
      <div className="mx-auto max-w-[430px] space-y-5 pb-8">
        <button
          type="button"
          onClick={() => setAssistantPage("material-picker")}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#E1E1DE] bg-white px-3.5 py-2 text-xs font-medium text-neutral-700 shadow-none active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          返回我的材料
        </button>

        <section className="space-y-2">
          <span className="inline-flex rounded-full border border-[#E8E8E8] bg-white px-3 py-1 text-[11px] font-medium text-neutral-500">
            Material Match
          </span>
          <h2 className="text-[28px] font-medium leading-tight text-neutral-950">你可以做这些酒</h2>
          <p className="text-sm leading-6 text-neutral-500">先选一杯，再查看用量和做法。调制时有疑问，点击详情页的助手气泡。</p>
        </section>

        {materials.length > 0 && (
          <section className="rounded-2xl border border-[#E8E8E8] bg-white p-4">
            <p className="text-[11px] font-medium text-neutral-400">已选材料</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {materials.map((item) => (
                <span key={item.id} className="rounded-full bg-[#F2F2F2] px-3 py-1.5 text-xs font-medium text-neutral-700">
                  {item.nameZh}
                </span>
              ))}
            </div>
          </section>
        )}

        {materials.length === 0 && (
          <section className="rounded-2xl border border-dashed border-[#d8d8d4] bg-white p-5 text-sm leading-6 text-neutral-500">
            还没有材料。返回材料页先添加金酒、苏打水、养乐多、水溶C这类材料。
          </section>
        )}

        {noMaterialResults && (
          <section className="rounded-2xl border border-[#E8E8E8] bg-white p-5 text-sm leading-6 text-neutral-500">
            暂时没有找到能用这些材料完成的配方。返回材料页，检查是否漏选了已有材料。
          </section>
        )}

        {recommendations.canMake.length > 0 && (
          <section className="space-y-3">
            <div>
              <h3 className="text-lg font-medium text-neutral-950">可以直接做</h3>
              <p className="text-xs text-neutral-400">展示所有能用已选材料完成的配方，冰块请另备。</p>
            </div>
            {recommendations.canMake.map((drink) => (
              <article key={drink.id} className="rounded-2xl border border-[#E1E1DE] bg-white p-4">
                <h3 className="text-lg font-medium text-neutral-950">{drink.nameZh}</h3>
                <p className="mt-1 text-xs text-neutral-400">{drink.nameEn}</p>
                <p className="mt-2 text-sm leading-6 text-neutral-600">{drink.description}</p>
                <p className="mt-2 text-xs text-neutral-500">{drink.ingredients.join(" · ")}</p>
                <Link href={`${drink.href}&from=materials`} onClick={() => {
                  try { sessionStorage.setItem("alchemix_material_results", JSON.stringify(materials.map(item => item.id))); } catch {}
                }} className="mt-3 flex min-h-10 items-center justify-center rounded-full border border-neutral-200 text-xs text-neutral-950">查看做法</Link>
              </article>
            ))}
          </section>
        )}

      </div>
    );
  }

  if (assistantPage === "mood-results") {
    return (
      <div className="mx-auto max-w-[430px] space-y-5 pb-8">
        <button
          type="button"
          onClick={() => onBackHome ? onBackHome() : setAssistantPage("home")}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#E1E1DE] bg-white px-3.5 py-2 text-xs font-medium text-neutral-700 shadow-none active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          返回调酒助手
        </button>

        <section className="space-y-2">
          <span className="inline-flex rounded-full border border-[#E8E8E8] bg-white px-3 py-1 text-[11px] font-medium text-neutral-500">
            Mood Match
          </span>
          <h2 className="text-[28px] font-medium leading-tight text-neutral-950">今天是什么心情？</h2>
          <p className="text-sm leading-6 text-neutral-500">选一个心情标签，再生成适合当下状态的酒卡。</p>
        </section>

        <section className="rounded-2xl border border-[#E8E8E8] bg-white p-4">
          <div className="grid grid-cols-2 gap-2">
            {moodOptions.map((mood) => (
              <button
                type="button"
                key={mood.slug}
                onClick={() => handleMoodSelect(mood)}
                className={`cursor-pointer rounded-2xl border p-3 text-left active:scale-[0.98] ${
                  selectedMood?.slug === mood.slug ? "border-neutral-950 bg-neutral-950 text-white" : "border-[#E8E8E8] bg-[#f6f5f1] text-neutral-700"
                }`}
              >
                <span className="material-symbols-outlined text-[21px]">{mood.icon}</span>
                <span className="mt-1 block text-sm font-medium">{mood.label}</span>
              </button>
            ))}
          </div>
        </section>

        {selectedMood && moodRecipes.length > 0 && (
          <section className="rounded-2xl border border-[#E8E8E8] bg-white p-4">
            <p className="text-[11px] font-medium text-neutral-400">给现在的你</p>
            <p className="mt-2 text-sm leading-6 text-neutral-600">{moodEncouragement(selectedMood, moodRecipes[0])}</p>
          </section>
        )}

        {moodRecipes.length > 0 ? (
          <section className="space-y-3">
            <h3 className="text-lg font-medium text-neutral-950">推荐酒卡</h3>
            {moodRecipes.map((recipe, index) => (
              <RecipeCard
                key={recipe.slug}
                recipe={recipe}
                reason={index === 0 && selectedMood ? moodEncouragement(selectedMood, recipe) : undefined}
                onSave={handleSave}
                drinkLogs={drinkLogs}
                onSaveDrinkLog={onSaveDrinkLog}
                sourcePage="mood_lab"
              />
            ))}
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-[#d8d8d4] bg-white p-5 text-sm leading-6 text-neutral-500">
            先选择一个心情标签，就会在这里生成酒卡。
          </section>
        )}
      </div>
    );
  }

  if (assistantPage === "blind-box") {
    return (
      <div className="mx-auto max-w-[430px] space-y-5 pb-8">
        <button
          type="button"
          onClick={() => onBackHome ? onBackHome() : setAssistantPage("home")}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#E1E1DE] bg-white px-3.5 py-2 text-xs font-medium text-neutral-700 shadow-none active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          返回调酒助手
        </button>

        <section className="space-y-2">
          <span className="inline-flex rounded-full border border-[#E8E8E8] bg-white px-3 py-1 text-[11px] font-medium text-neutral-500">
            Blind Box
          </span>
          <h2 className="text-[28px] font-medium leading-tight text-neutral-950">{openedBox?.name ?? "随机一杯盲盒"}</h2>
          <p className="text-sm leading-6 text-neutral-500">{openedBox?.subtitle ?? "从全部酒单随机装入 12 张隐藏酒卡，选一个 BOX 再翻牌。"}</p>
        </section>

        {openedBox ? (
          <section className="overflow-hidden rounded-[22px] border border-[#E8E8E8] bg-[#f6f5f1] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-neutral-950">{openedBox.name}</p>
                <p className="text-[11px] text-neutral-400">本次随机装入 12 张，点击一个盒子后再反转卡片</p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2">
              {blindDeck.map((recipe, index) => (
                <button
                  type="button"
                  key={`${openedBox.slug}-${recipe.slug}-${index}`}
                  onClick={() => drawFromBox(index)}
                  className={`flex min-h-[72px] cursor-pointer flex-col items-center justify-center rounded-2xl border p-2 text-center shadow-none active:scale-[0.98] ${
                    selectedBlindIndex === index ? "border-neutral-950 bg-neutral-950 text-white" : "border-white bg-white text-neutral-800"
                  }`}
                >
                  <p className="text-[10px] font-medium text-neutral-400">BOX</p>
                  <p className={`mt-1 text-[20px] font-medium leading-none ${selectedBlindIndex === index ? "text-white" : "text-neutral-800"}`}>{index + 1}</p>
                  <p className="mt-1 text-[9px] uppercase text-neutral-400">hidden</p>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-[#d8d8d4] bg-white p-5 text-sm leading-6 text-neutral-500">
            返回首页打开随机一杯盲盒。
          </section>
        )}

        {blindRecipe && (
          <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/35 px-4 backdrop-blur-[2px]">
            <section className="w-full max-w-[390px] rounded-[28px] border border-[#E8E8E8] bg-white p-4 shadow-none animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-neutral-950">你抽的是 BOX {selectedBlindIndex !== null ? selectedBlindIndex + 1 : ""}</p>
                  <p className="text-xs text-neutral-400">{isBlindRevealed ? "翻开成功" : "点击反转查看酒名"}</p>
                </div>
                <div className="flex items-center gap-2">
                  {!isBlindRevealed && (
                    <button
                      type="button"
                      onClick={() => setIsBlindRevealed(true)}
                      className="cursor-pointer rounded-full bg-neutral-950 px-4 py-2 text-xs font-medium text-white active:scale-[0.98]"
                    >
                      点击反转
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setBlindRecipe(null);
                      setIsBlindRevealed(false);
                    }}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[#E8E8E8] bg-white text-neutral-500 active:scale-[0.98]"
                    aria-label="关闭盲盒卡片"
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>
              </div>

              <div className="mt-4 [perspective:1000px]">
                <div
                  className={`relative min-h-[430px] transition-transform duration-700 [transform-style:preserve-3d] ${
                    isBlindRevealed ? "[transform:rotateY(180deg)]" : ""
                  }`}
                >
                  <div className="absolute inset-0 flex min-h-[430px] flex-col items-center justify-center rounded-[24px] border border-neutral-900 bg-neutral-950 p-5 text-center text-white [backface-visibility:hidden]">
                    <span className="material-symbols-outlined text-[42px]">style</span>
                    <p className="mt-3 text-xl font-medium">你抽到的是 BOX {selectedBlindIndex !== null ? selectedBlindIndex + 1 : ""}</p>
                    <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">tap reverse</p>
                  </div>

                  <div className="absolute inset-0 min-h-[430px] overflow-y-auto rounded-[24px] border border-[#E8E8E8] bg-[#f6f5f1] p-5 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                    <div className="flex min-h-[390px] flex-col gap-4">
                      <div>
                        <div className="flex flex-wrap gap-1.5">
                          {blindRecipe.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="rounded-full bg-white px-2.5 py-1 text-[10px] font-medium text-neutral-500">
                              #{tag}
                            </span>
                          ))}
                        </div>
                        <h3 className="mt-4 text-2xl font-medium leading-tight text-neutral-950">{blindRecipe.nameCn}</h3>
                        <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">{blindRecipe.nameEn}</p>
                        <p className="mt-3 text-sm leading-6 text-neutral-600">{blindRecipe.description}</p>
                      </div>

                      <div className="rounded-2xl bg-white p-3">
                        <p className="text-[11px] font-medium text-neutral-400">材料</p>
                        <div className="mt-2 space-y-1.5">
                          {blindRecipe.ingredients.slice(0, 4).map((item) => (
                            <div key={`${blindRecipe.slug}-${item.nameCn}`} className="flex items-center justify-between gap-3 text-xs">
                              <span className="text-neutral-600">{item.nameCn}</span>
                              <span className="shrink-0 font-mono text-neutral-400">{item.amount}{item.unit}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl bg-white p-3">
                        <p className="text-[11px] font-medium text-neutral-400">做法</p>
                        <p className="mt-1 text-xs leading-5 text-neutral-600">{blindRecipe.method}</p>
                      </div>

                      <DrinkLogButton
                        recipe={recipeToDrinkLogSnapshot(blindRecipe)}
                        sourcePage="blind_box"
                        drinkLogs={drinkLogs}
                        onSaveDrinkLog={onSaveDrinkLog}
                        variant="text"
                        className="mt-auto w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[430px] space-y-6 pb-8">
      <section className="space-y-2">
        <span className="inline-flex rounded-full border border-[#E8E8E8] bg-white px-3 py-1 text-[11px] font-medium text-neutral-500">
          Drink Finder
        </span>
        <h2 className="text-[30px] font-medium leading-tight text-neutral-950">找一杯</h2>
        <p className="text-sm leading-6 text-neutral-500">按材料、心情或随机盲盒，找到一杯现在能做的酒。</p>
      </section>

      <section className="rounded-2xl border border-[#E8E8E8] bg-white p-4 shadow-none">
        <div className="space-y-1">
          <h3 className="text-lg font-medium text-neutral-950">按材料找一杯</h3>
          <p className="text-xs leading-5 text-neutral-500">进入后选择你手边已有的酒和饮料，生成现在能做的酒卡。</p>
        </div>

        <button
          type="button"
          onClick={() => setAssistantPage("material-picker")}
          className="mt-4 flex min-h-[104px] w-full cursor-pointer items-center gap-3 rounded-2xl border border-[#E8E8E8] bg-[#f6f5f1] p-4 text-left transition-all active:scale-[0.98]"
        >
          <span className="material-symbols-outlined rounded-2xl bg-white p-3 text-[28px] text-neutral-950">liquor</span>
          <span className="min-w-0">
            <span className="block text-base font-medium text-neutral-950">选择我的材料</span>
            <span className="mt-1 block text-xs leading-5 text-neutral-500">{materials.length > 0 ? `已选择 ${materials.length} 种材料，继续编辑或查看推荐。` : "金酒、苏打水、果汁，有什么就从什么开始。"}</span>
          </span>
          <span className="material-symbols-outlined ml-auto text-neutral-400">chevron_right</span>
        </button>

        <div className="hidden" aria-hidden="true">
        <form
          className="mt-4 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            addMaterial();
          }}
        >
          <input
            value={materialInput}
            onChange={(event) => setMaterialInput(event.target.value)}
            placeholder="搜索酒类、饮料或配料，例如：金酒、水溶C、养乐多"
            className="min-w-0 flex-1 rounded-full border border-[#E1E1DE] bg-[#f6f5f1] px-4 py-3 text-sm outline-none focus:border-neutral-950"
          />
          <button type="submit" className="cursor-pointer rounded-full bg-neutral-950 px-4 text-sm font-medium text-white active:scale-[0.98]">
            添加
          </button>
        </form>

        {suggestions.length > 0 && (
          <div className="mt-2 rounded-2xl border border-[#E8E8E8] bg-[#FCFCFA] p-2">
            {suggestions.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => addMaterial(item.nameZh)}
                className="flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-left active:scale-[0.99]"
              >
                <span>
                  <span className="block text-xs font-medium text-neutral-900">{item.nameZh}</span>
                  <span className="block text-[11px] text-neutral-400">{item.nameEn}</span>
                </span>
                <span className="text-[11px] font-medium text-neutral-400">{item.category}</span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {popularQuickIngredients.map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => addMaterial(item)}
              className="cursor-pointer rounded-full bg-[#F2F2F2] px-3 py-1.5 text-xs font-medium text-neutral-600 active:scale-[0.98]"
            >
              {item}
            </button>
          ))}
        </div>

        {materials.length > 0 && (
          <div className="mt-4 space-y-3">
            {groupedMaterials.map((group) => (
              <div key={group.label}>
                <p className="mb-1.5 text-[11px] font-medium text-neutral-400">{group.label}</p>
                <div className="flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => removeMaterial(item.id)}
                      className="cursor-pointer rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 active:scale-[0.98]"
                    >
                      {item.nameZh} ×
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setHasRecommended(true);
            if (materials.length > 0) setAssistantPage("material-results");
          }}
          className="mt-4 w-full cursor-pointer rounded-2xl bg-neutral-950 py-3.5 text-sm font-medium text-white active:scale-[0.99]"
        >
          生成我能做的酒卡
        </button>

        {hasRecommended && materials.length === 0 && (
          <p className="mt-3 rounded-2xl bg-[#f6f5f1] p-3 text-xs leading-5 text-neutral-500">先添加 1-2 个材料，比如金酒、苏打水、养乐多或水溶C。</p>
        )}

        </div>
      </section>

      <section className="rounded-2xl border border-[#E8E8E8] bg-white p-4 shadow-none">
        <div className="space-y-1">
          <h3 className="text-lg font-medium text-neutral-950">心情实验室</h3>
          <p className="text-xs leading-5 text-neutral-500">进入后选择今天的心情标签，系统会生成一张适合当下状态的酒卡。</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSelectedMood(null);
            setMoodRecipes([]);
            setAssistantPage("mood-results");
          }}
          className="mt-4 flex min-h-[104px] w-full cursor-pointer items-center gap-3 rounded-2xl border border-[#E8E8E8] bg-[#f6f5f1] p-4 text-left transition-all active:scale-[0.98]"
        >
          <span className="material-symbols-outlined rounded-2xl bg-white p-3 text-[28px] text-neutral-950">psychology</span>
          <span className="min-w-0">
            <span className="block text-base font-medium text-neutral-950">选择心情生成酒卡</span>
            <span className="mt-1 block text-xs leading-5 text-neutral-500">开心、难过、焦虑、疲惫，都可以先被好好接住。</span>
          </span>
          <span className="material-symbols-outlined ml-auto text-neutral-400">chevron_right</span>
        </button>
      </section>

      <section className="rounded-2xl border border-[#E8E8E8] bg-white p-4 shadow-none">
        <div className="space-y-1">
          <h3 className="text-lg font-medium text-neutral-950">随机一杯盲盒</h3>
          <p className="text-xs leading-5 text-neutral-500">点进去后，从全部酒单随机装入 12 张隐藏酒卡。你只需要选一个 BOX。</p>
        </div>

        <button
          type="button"
          onClick={handleBlindBoxOpen}
          className="mt-4 flex min-h-[104px] w-full cursor-pointer items-center gap-3 rounded-2xl border border-[#E8E8E8] bg-[#f6f5f1] p-4 text-left transition-all active:scale-[0.98]"
        >
          <span className="material-symbols-outlined rounded-2xl bg-white p-3 text-[28px] text-neutral-950">{blindBoxConfig.icon}</span>
          <span className="min-w-0">
            <span className="block text-base font-medium text-neutral-950">{blindBoxConfig.name}</span>
            <span className="mt-1 block text-xs leading-5 text-neutral-500">{blindBoxConfig.subtitle}</span>
          </span>
          <span className="material-symbols-outlined ml-auto text-neutral-400">chevron_right</span>
        </button>

      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-neutral-950">实验室精选</h3>
          <span className="text-[11px] font-medium text-neutral-400">今日推荐酒单</span>
        </div>
        {featured.map((recipe) => (
          <RecipeCard
            key={recipe.slug}
            recipe={recipe}
            compact
            onSave={handleSave}
            drinkLogs={drinkLogs}
            onSaveDrinkLog={onSaveDrinkLog}
            sourcePage="assistant"
          />
        ))}
      </section>
    </div>
  );
}
