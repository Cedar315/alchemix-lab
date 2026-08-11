import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(express.json());

// Lazy-initialized Gemini Client
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === "MY_GEMINI_API_KEY" || key.trim() === "") {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries <= 0) {
      throw error;
    }
    const errStr = String(error.message || error);
    const isTransient =
      errStr.includes("503") ||
      errStr.includes("429") ||
      errStr.includes("500") ||
      errStr.includes("UNAVAILABLE") ||
      errStr.includes("RESOURCE_EXHAUSTED");
    if (!isTransient) {
      throw error;
    }

    let currentDelay = delay;
    if (errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED")) {
      // Look for a delay recommended in the error message, e.g., "Please retry in 5.966..." or "retryDelay":"5s"
      const matchRetryIn = errStr.match(/retry in\s+([\d\.]+)\s*s/i);
      if (matchRetryIn) {
        const secs = parseFloat(matchRetryIn[1]);
        if (!isNaN(secs)) {
          currentDelay = Math.ceil(secs * 1000) + 1000; // Add 1000ms safety margin
        }
      } else {
        const matchRetryDelay = errStr.match(/"retryDelay"\s*:\s*"(\d+)s"/);
        if (matchRetryDelay) {
          const secs = parseInt(matchRetryDelay[1], 10);
          if (!isNaN(secs)) {
            currentDelay = secs * 1000 + 1000;
          }
        } else {
          // Default to 6 seconds wait time for rate limits
          currentDelay = 6000;
        }
      }
    }

    console.warn(`Gemini temporary error encountered. Retrying in ${currentDelay}ms... (Remaining retries: ${retries})`);
    await new Promise((resolve) => setTimeout(resolve, currentDelay));
    return retryWithBackoff(fn, retries - 1, currentDelay * 2);
  }
}

// Fallback dynamic responses if Gemini API Key is not set or fails
function getFallbackMixResult(spirit: string, mixer: string, size: string) {
  const list = [
    {
      chineseName: `试剂-${spirit}与${mixer}`,
      name: `AlcheMix-${spirit} & ${mixer}`,
      subtitle: "平衡度极佳的实验室经典配方",
      rating: { sweet: 3, acid: 3, strength: 4 },
      comments: `【化学反应分析】${spirit}的乙醇分子与${mixer}中的有机酸结合，在${size}的水溶液稀释下，有效降低了酒精的刺激性，释放出细腻的酯类香气。这是一种经典的分子级风味平衡组合。`,
      tags: ["平衡", "实验室经典"],
    },
  ];
  return list[0];
}

// Complex multi-ingredient dynamic local estimator for Alcohol Laboratory
interface LabIngredient {
  name: string;
  amount: number;
  category: string;
}

function calculateLocalLabMix(ingredients: LabIngredient[], mixMethod: "Stir" | "Shake") {
  let totalVolume = 0;
  let spiritVolume = 0;
  let sweetVolume = 0;
  let acidVolume = 0;
  let creamyVolume = 0;
  let herbalVolume = 0;
  let bubblyVolume = 0;

  ingredients.forEach(ing => {
    const vol = ing.amount;
    totalVolume += vol;

    const lowerName = ing.name.toLowerCase();
    
    // Categorization rules
    if (ing.category === "基酒" || lowerName.includes("gin") || lowerName.includes("vodka") || lowerName.includes("rum") || lowerName.includes("tequila") || lowerName.includes("whiskey") || lowerName.includes("酒") || lowerName.includes("威士忌") || lowerName.includes("伏特加")) {
      spiritVolume += vol;
    }
    
    if (lowerName.includes("养乐多") || lowerName.includes("yakult") || lowerName.includes("乳酸") || lowerName.includes("奶") || lowerName.includes("cream")) {
      creamyVolume += vol;
      sweetVolume += vol * 0.8;
    }

    if (lowerName.includes("雪碧") || lowerName.includes("sprite") || lowerName.includes("苏打") || lowerName.includes("soda") || lowerName.includes("可乐") || lowerName.includes("cola") || lowerName.includes("气泡") || lowerName.includes("tonic") || lowerName.includes("汤力")) {
      bubblyVolume += vol;
    }

    if (lowerName.includes("柠檬") || lowerName.includes("lemon") || lowerName.includes("lime") || lowerName.includes("酸") || lowerName.includes("西柚") || lowerName.includes("grapefruit") || lowerName.includes("c")) {
      acidVolume += vol;
    }

    if (lowerName.includes("雪碧") || lowerName.includes("sprite") || lowerName.includes("甜") || lowerName.includes("蔓越莓") || lowerName.includes("cranberry") || lowerName.includes("糖") || lowerName.includes("yakult") || lowerName.includes("养乐多")) {
      sweetVolume += vol * 0.5;
    }

    if (lowerName.includes("金酒") || lowerName.includes("gin") || lowerName.includes("茶") || lowerName.includes("tea") || lowerName.includes("草本") || lowerName.includes("herbal") || lowerName.includes("杜松") || lowerName.includes("苦")) {
      herbalVolume += vol;
    }
  });

  if (totalVolume === 0) totalVolume = 1;

  // Compute 8 dimensions (from 1 to 5)
  const strength = Math.min(5, Math.max(1, Math.round((spiritVolume / totalVolume) * 10)));
  const sweet = Math.min(5, Math.max(1, Math.round((sweetVolume / totalVolume) * 5) + 1));
  const acid = Math.min(5, Math.max(1, Math.round((acidVolume / totalVolume) * 5) + 1));
  const creamy = Math.min(5, Math.max(1, Math.round((creamyVolume / totalVolume) * 5) + 1));
  const herbal = Math.min(5, Math.max(1, Math.round((herbalVolume / totalVolume) * 5) + 1));
  
  // If shaken, carbonated drinks might lose some fizz, but general carbonation is dominant
  let bubblyRaw = Math.round((bubblyVolume / totalVolume) * 5) + 1;
  if (mixMethod === "Shake" && bubblyVolume > 0) {
    bubblyRaw = Math.max(1, bubblyRaw - 1); // Shaking degasses carbonation slightly
  }
  const bubbly = Math.min(5, Math.max(1, bubblyRaw));

  const freshness = Math.min(5, Math.max(1, Math.round((totalVolume - spiritVolume - creamyVolume) / totalVolume * 4) + 1));
  const heaviness = Math.min(5, Math.max(1, Math.round((spiritVolume + creamyVolume) / totalVolume * 4) + 1));

  // Determine a scientific-sounding name
  const firstIng = ingredients[0]?.name.split(" ")[0] || "化学";
  const secondIng = ingredients[1]?.name.split(" ")[0] || "试剂";
  const chineseName = `${firstIng}的${secondIng}共振键`;
  const name = `Molecular Resonance of ${firstIng}`;
  const subtitle = mixMethod === "Shake" ? "高速碰撞下的分子聚合" : "重力层析式平稳扩散";

  const commentIngredients = ingredients.map(i => `${i.name}(${i.amount}ml)`).join("、");
  const comments = `【实验室滴定记录】将 ${commentIngredients} 注入反应器，通过 ${mixMethod === "Shake" ? "高速摇晃（Shake）" : "轻柔搅拌（Stir）"} 充分键合。${
    mixMethod === "Shake" 
      ? "高速碰撞使乙醇分子微胞化，锁住了刺鼻的酒精气味，奶香与果酸因子得到了深度融合。" 
      : "慢速搅拌保留了气泡液的碳酸结构，层层递进的密度让酒体展现出极其通透、干净的物理分层。"
  } 整体口感呈现出甜度 ${sweet} 级、酸度 ${acid} 级的微观风味结构。`;

  return {
    chineseName,
    name,
    subtitle,
    rating: { sweet, acid, strength, creamy, herbal, bubbly, freshness, heaviness },
    comments,
    tags: [mixMethod, strength >= 3 ? "烈酒共振" : "柔和缓释", bubbly >= 3 ? "强碳酸键" : "温润静置"],
  };
}

// ==========================================
// ALCHEMIX LAB - INGREDIENT KNOWLEDGE BASE & API
// ==========================================

const OFFICIAL_INGREDIENTS = [
  {
    id: "off-1",
    name: "椰树牌椰汁",
    brand: "椰树",
    category: "椰子饮料 / 奶感饮料",
    abv: 0,
    nutrition: {
      sugar_g_per_100ml: 6.5,
      energy_kj_per_100ml: 205,
      carbohydrate_g_per_100ml: 6.8,
      caffeine_mg_per_100ml: 0,
      fat_g_per_100ml: 2.0,
      protein_g_per_100ml: 0.6
    },
    ingredientsText: "水、鲜椰肉汁、白砂糖、酪蛋白酸钠、单硬脂酸甘油酯",
    flavorProfile: {
      sweetness: 3,
      acidity: 0,
      bitterness: 0,
      carbonation: 0,
      dairy: 4,
      tea: 0,
      fruit: 2,
      body: 3,
      freshness: 2
    },
    sweetness: 3,
    acidity: 0,
    bitterness: 0,
    carbonation: 0,
    body: 3,
    dairyFeeling: 4,
    alcoholFeel: 0,
    flavorTags: ["椰香", "奶醇", "顺滑", "甜口"],
    goodWith: ["白朗姆 Rum", "绝对伏特加 Vodka", "咖啡利口酒 Kahlúa", "浓缩咖啡 Espresso"],
    riskyWith: ["大量柠檬汁", "高酸果汁"],
    notes: "植物蛋白饮料。酸性过高时可能导致植物蛋白变性凝固，尽量避免与极酸材料（如纯青柠汁）大比例混合。",
    dataSource: "ocr",
    confidence: 0.82,
    lastVerifiedAt: "2026-07-06",
    createdAt: "2026-07-06T00:00:00Z"
  },
  {
    id: "off-2",
    name: "三得利无糖乌龙茶",
    brand: "三得利",
    category: "无糖茶饮",
    abv: 0,
    nutrition: {
      sugar_g_per_100ml: 0,
      energy_kj_per_100ml: 0,
      carbohydrate_g_per_100ml: 0,
      caffeine_mg_per_100ml: 12,
      fat_g_per_100ml: 0,
      protein_g_per_100ml: 0
    },
    ingredientsText: "水、乌龙茶叶、乌龙茶粉、维生素C、碳酸氢钠",
    flavorProfile: {
      sweetness: 0,
      acidity: 0,
      bitterness: 2,
      carbonation: 0,
      dairy: 0,
      tea: 4,
      fruit: 0,
      body: 2,
      freshness: 4
    },
    sweetness: 0,
    acidity: 0,
    bitterness: 2,
    carbonation: 0,
    body: 2,
    dairyFeeling: 0,
    alcoholFeel: 0,
    flavorTags: ["茶香", "解腻", "无糖", "回甘"],
    goodWith: ["威士忌 Whisky", "烧酒 Soju", "梅酒 Umeshu", "绝对伏特加 Vodka"],
    riskyWith: ["重奶油", "浓酸奶"],
    notes: "焙火乌龙茶。极佳的酒精非极性中和剂，能极大地拉长酒精体，使口感温和舒缓。",
    dataSource: "brand_site",
    confidence: 0.95,
    lastVerifiedAt: "2026-07-06",
    createdAt: "2026-07-06T00:00:00Z"
  },
  {
    id: "off-3",
    name: "元气森林白桃气泡水",
    brand: "元气森林",
    category: "无糖气泡水",
    abv: 0,
    nutrition: {
      sugar_g_per_100ml: 0,
      energy_kj_per_100ml: 0,
      carbohydrate_g_per_100ml: 3.8,
      caffeine_mg_per_100ml: 0,
      fat_g_per_100ml: 0,
      protein_g_per_100ml: 0
    },
    ingredientsText: "水、赤藓糖醇、二氧化碳、柠檬酸、三氯蔗糖",
    flavorProfile: {
      sweetness: 2,
      acidity: 2,
      bitterness: 0,
      carbonation: 4,
      dairy: 0,
      tea: 0,
      fruit: 3,
      body: 1,
      freshness: 4
    },
    sweetness: 2,
    acidity: 2,
    bitterness: 0,
    carbonation: 4,
    body: 1,
    dairyFeeling: 0,
    alcoholFeel: 0,
    flavorTags: ["白桃", "气泡", "爽口", "代糖甜"],
    goodWith: ["金酒 Gin", "绝对伏特加 Vodka", "白葡萄酒 White Wine"],
    riskyWith: ["浓香型白酒", "厚奶盖"],
    notes: "赤藓糖醇代糖甜味。高碳酸释放能将气味分子迅速送达鼻腔，极其适合制作清凉特调。",
    dataSource: "brand_site",
    confidence: 0.90,
    lastVerifiedAt: "2026-07-06",
    createdAt: "2026-07-06T00:00:00Z"
  },
  {
    id: "off-4",
    name: "水溶C100 (柠檬味)",
    brand: "农夫山泉",
    category: "高酸果汁",
    abv: 0,
    nutrition: {
      sugar_g_per_100ml: 9.5,
      energy_kj_per_100ml: 168,
      carbohydrate_g_per_100ml: 9.8,
      caffeine_mg_per_100ml: 0,
      fat_g_per_100ml: 0,
      protein_g_per_100ml: 0
    },
    ingredientsText: "水、白砂糖、浓缩柠檬汁、柠檬酸、维生素C、柠檬果肉",
    flavorProfile: {
      sweetness: 3,
      acidity: 4,
      bitterness: 0,
      carbonation: 0,
      dairy: 0,
      tea: 0,
      fruit: 4,
      body: 2,
      freshness: 3
    },
    sweetness: 3,
    acidity: 4,
    bitterness: 0,
    carbonation: 0,
    body: 2,
    dairyFeeling: 0,
    alcoholFeel: 0,
    flavorTags: ["极酸", "柠檬", "鲜香", "生津"],
    goodWith: ["绝对伏特加 Vodka", "金酒 Gin", "白龙舌兰 Tequila"],
    riskyWith: ["牛奶", "椰奶", "厚重奶盖"],
    notes: "富含柠檬酸和维生素C。酸度强劲，是极佳的酸味试剂，但与高蛋白质奶制品触碰易形成悬浮颗粒悬析。",
    dataSource: "open_food_facts",
    confidence: 0.92,
    lastVerifiedAt: "2026-07-06",
    createdAt: "2026-07-06T00:00:00Z"
  },
  {
    id: "off-5",
    name: "东方树叶乌龙茶",
    brand: "农夫山泉",
    category: "无糖茶饮",
    abv: 0,
    nutrition: {
      sugar_g_per_100ml: 0,
      energy_kj_per_100ml: 0,
      carbohydrate_g_per_100ml: 0,
      caffeine_mg_per_100ml: 11,
      fat_g_per_100ml: 0,
      protein_g_per_100ml: 0
    },
    ingredientsText: "水、特级乌龙茶叶、维生素C、碳酸氢钠",
    flavorProfile: {
      sweetness: 0,
      acidity: 1,
      bitterness: 1,
      carbonation: 0,
      dairy: 0,
      tea: 4,
      fruit: 0,
      body: 1,
      freshness: 5
    },
    sweetness: 0,
    acidity: 1,
    bitterness: 1,
    carbonation: 0,
    body: 1,
    dairyFeeling: 0,
    alcoholFeel: 0,
    flavorTags: ["淡雅", "清冽", "原茶", "解腻"],
    goodWith: ["梅酒 Umeshu", "威士忌 Whisky", "绝对伏特加 Vodka"],
    riskyWith: ["乳酸饮料", "椰奶"],
    notes: "无添加防腐剂乌龙茶。相比三得利其焙火度略低，兰花香气更幽雅，能调配出极其雅致、低负担的茶酒。",
    dataSource: "brand_site",
    confidence: 0.95,
    lastVerifiedAt: "2026-07-06",
    createdAt: "2026-07-06T00:00:00Z"
  },
  {
    id: "off-6",
    name: "养乐多",
    brand: "养乐多",
    category: "活性乳酸菌饮料",
    abv: 0,
    nutrition: {
      sugar_g_per_100ml: 15.4,
      energy_kj_per_100ml: 290,
      carbohydrate_g_per_100ml: 15.4,
      caffeine_mg_per_100ml: 0,
      fat_g_per_100ml: 0,
      protein_g_per_100ml: 1.2
    },
    ingredientsText: "水、白砂糖、脱脂乳粉、食用香精、干酪乳杆菌代代红株发酵液",
    flavorProfile: {
      sweetness: 4,
      acidity: 3,
      bitterness: 0,
      carbonation: 0,
      dairy: 3,
      tea: 0,
      fruit: 0,
      body: 3,
      freshness: 2
    },
    sweetness: 4,
    acidity: 3,
    bitterness: 0,
    carbonation: 0,
    body: 3,
    dairyFeeling: 3,
    alcoholFeel: 0,
    flavorTags: ["酸甜", "乳酸", "浓醇", "活泼"],
    goodWith: ["烧酒 Soju", "啤酒 Beer", "绝对伏特加 Vodka", "苏打水 Soda"],
    riskyWith: ["高浓度烈酒 (直接饮用)", "过热茶饮"],
    notes: "发酵乳酸。极佳的厚度与酸甜骨架，与清爽烧酒或苏打水混合能调配出极其畅销的微醺乳酸特调。",
    dataSource: "open_food_facts",
    confidence: 0.85,
    lastVerifiedAt: "2026-07-06",
    createdAt: "2026-07-06T00:00:00Z"
  },
  {
    id: "off-7",
    name: "可口可乐 (Coca Cola)",
    brand: "可口可乐",
    category: "碳酸可乐",
    abv: 0,
    nutrition: {
      sugar_g_per_100ml: 10.6,
      energy_kj_per_100ml: 180,
      carbohydrate_g_per_100ml: 10.6,
      caffeine_mg_per_100ml: 9.7,
      fat_g_per_100ml: 0,
      protein_g_per_100ml: 0
    },
    ingredientsText: "水、果葡糖浆、白砂糖、食品添加剂（二氧化碳、焦糖色、磷酸、咖啡因、食用香精）",
    flavorProfile: {
      sweetness: 4,
      acidity: 2,
      bitterness: 1,
      carbonation: 4,
      dairy: 0,
      tea: 0,
      fruit: 1,
      body: 2,
      freshness: 3
    },
    sweetness: 4,
    acidity: 2,
    bitterness: 1,
    carbonation: 4,
    body: 2,
    dairyFeeling: 0,
    alcoholFeel: 0,
    flavorTags: ["经典可乐", "气泡", "强碳酸", "甜香"],
    goodWith: ["百加得白朗姆酒 Rum", "威士忌 Whiskey", "绝对伏特加 Vodka"],
    riskyWith: ["乳酸菌", "大量柠檬汁 (易泛酸)"],
    notes: "经典碳酸可乐。含磷酸及咖啡因，二氧化碳气泡极度饱满，能与朗姆酒发生键合生成经典的‘自由古巴’。",
    dataSource: "open_food_facts",
    confidence: 0.98,
    lastVerifiedAt: "2026-07-06",
    createdAt: "2026-07-06T00:00:00Z"
  },
  {
    id: "off-8",
    name: "屈臣氏汤力水",
    brand: "屈臣氏",
    category: "气泡苏打",
    abv: 0,
    nutrition: {
      sugar_g_per_100ml: 9.0,
      energy_kj_per_100ml: 153,
      carbohydrate_g_per_100ml: 9.0,
      caffeine_mg_per_100ml: 0,
      fat_g_per_100ml: 0,
      protein_g_per_100ml: 0
    },
    ingredientsText: "水、白砂糖、食品添加剂（二氧化碳、柠檬酸、食用香精、奎宁）",
    flavorProfile: {
      sweetness: 3,
      acidity: 2,
      bitterness: 3,
      carbonation: 4,
      dairy: 0,
      tea: 0,
      fruit: 1,
      body: 2,
      freshness: 3
    },
    sweetness: 3,
    acidity: 2,
    bitterness: 3,
    carbonation: 4,
    body: 2,
    dairyFeeling: 0,
    alcoholFeel: 0,
    flavorTags: ["微苦", "奎宁", "气泡感", "爽口"],
    goodWith: ["哥顿金酒 Gin", "绝对伏特加 Vodka", "梅酒 Umeshu"],
    riskyWith: ["厚重奶油", "纯可可利口酒"],
    notes: "奎宁风味气泡水。草本植物的苦涩与甜味在碳酸物理层析下形成坚固的结构，是金酒的最佳伴侣。",
    dataSource: "brand_site",
    confidence: 0.95,
    lastVerifiedAt: "2026-07-06",
    createdAt: "2026-07-06T00:00:00Z"
  },
  {
    id: "off-9",
    name: "雪碧 (Sprite)",
    brand: "可口可乐",
    category: "柠檬味碳酸饮料",
    abv: 0,
    nutrition: {
      sugar_g_per_100ml: 11.0,
      energy_kj_per_100ml: 190,
      carbohydrate_g_per_100ml: 11.0,
      caffeine_mg_per_100ml: 0,
      fat_g_per_100ml: 0,
      protein_g_per_100ml: 0
    },
    ingredientsText: "水、果葡糖浆、二氧化碳、柠檬酸、柠檬酸钠、苯甲酸钠、阿斯巴甜",
    flavorProfile: {
      sweetness: 4,
      acidity: 3,
      bitterness: 0,
      carbonation: 4,
      dairy: 0,
      tea: 0,
      fruit: 2,
      body: 1,
      freshness: 4
    },
    sweetness: 4,
    acidity: 3,
    bitterness: 0,
    carbonation: 4,
    body: 1,
    dairyFeeling: 0,
    alcoholFeel: 0,
    flavorTags: ["柠檬清香", "激爽气泡", "香甜", "夏日感"],
    goodWith: ["白朗姆 Rum", "哥顿金酒 Gin", "绝对伏特加 Vodka", "俏雅梅酒 Umeshu"],
    riskyWith: ["百利甜酒 (蛋白质聚沉)", "重脂质饮料"],
    notes: "柠檬味高碳酸饮料。常用来作为甜度与气泡双重调节剂，极易掩盖劣质杂醇的燥辣味。",
    dataSource: "open_food_facts",
    confidence: 0.98,
    lastVerifiedAt: "2026-07-06",
    createdAt: "2026-07-06T00:00:00Z"
  },
  {
    id: "off-10",
    name: "哥顿金酒",
    brand: "哥顿 Gordon's",
    category: "基酒 / 伦敦干金酒",
    abv: 40,
    nutrition: {
      sugar_g_per_100ml: 0,
      energy_kj_per_100ml: 930,
      carbohydrate_g_per_100ml: 0,
      caffeine_mg_per_100ml: 0,
      fat_g_per_100ml: 0,
      protein_g_per_100ml: 0
    },
    ingredientsText: "水、蒸馏谷物液体、杜松子、芫荽籽、圆当归根、柑橘皮",
    flavorProfile: {
      sweetness: 0,
      acidity: 1,
      bitterness: 2,
      carbonation: 0,
      dairy: 0,
      tea: 0,
      fruit: 1,
      body: 2,
      freshness: 3
    },
    sweetness: 0,
    acidity: 1,
    bitterness: 2,
    carbonation: 0,
    body: 2,
    dairyFeeling: 0,
    alcoholFeel: 4,
    flavorTags: ["杜松子", "松针香", "辛烈", "草本香"],
    goodWith: ["屈臣氏汤力水 Tonic", "雪碧 Sprite", "柠檬汁 Lemon Squeeze", "三得利无糖乌龙茶"],
    riskyWith: ["巧克力饮料", "过稠浓汤"],
    notes: "英式伦敦干金酒。富含杜松子挥发性单萜、倍半萜类风味分子，是金汤力与马天尼等鸡尾酒的不二之魂。",
    dataSource: "brand_site",
    confidence: 0.95,
    lastVerifiedAt: "2026-07-06",
    createdAt: "2026-07-06T00:00:00Z"
  },
  {
    id: "off-11",
    name: "绝对伏特加",
    brand: "绝对伏特加 Absolut",
    category: "基酒 / 伏特加",
    abv: 40,
    nutrition: {
      sugar_g_per_100ml: 0,
      energy_kj_per_100ml: 920,
      carbohydrate_g_per_100ml: 0,
      caffeine_mg_per_100ml: 0,
      fat_g_per_100ml: 0,
      protein_g_per_100ml: 0
    },
    ingredientsText: "纯净水、冬小麦发酵蒸馏液",
    flavorProfile: {
      sweetness: 0,
      acidity: 0,
      bitterness: 1,
      carbonation: 0,
      dairy: 0,
      tea: 0,
      fruit: 0,
      body: 2,
      freshness: 4
    },
    sweetness: 0,
    acidity: 0,
    bitterness: 1,
    carbonation: 0,
    body: 2,
    dairyFeeling: 0,
    alcoholFeel: 4,
    flavorTags: ["极纯净", "辛辣", "高酒精", "无杂香"],
    goodWith: ["养乐多", "水溶C100 (柠檬味)", "元气森林白桃气泡水", "可口可乐 (Coca Cola)"],
    riskyWith: ["极高纯水 (无味易燥辣)"],
    notes: "连续蒸馏的超纯净伏特加。由于没有多余杂酯，是完美的风味‘空白溶剂’，能够完美吸附任何饮料的风味分子。",
    dataSource: "brand_site",
    confidence: 0.95,
    lastVerifiedAt: "2026-07-06",
    createdAt: "2026-07-06T00:00:00Z"
  },
  {
    id: "off-12",
    name: "杰克丹尼威士忌",
    brand: "杰克丹尼 Jack Daniel's",
    category: "基酒 / 威士忌",
    abv: 40,
    nutrition: {
      sugar_g_per_100ml: 0.1,
      energy_kj_per_100ml: 940,
      carbohydrate_g_per_100ml: 0.1,
      caffeine_mg_per_100ml: 0,
      fat_g_per_100ml: 0,
      protein_g_per_100ml: 0
    },
    ingredientsText: "泉水、优质玉米、黑麦、大麦麦芽（枫木活性炭滴滤）",
    flavorProfile: {
      sweetness: 2,
      acidity: 1,
      bitterness: 1,
      carbonation: 0,
      dairy: 0,
      tea: 0,
      fruit: 2,
      body: 3,
      freshness: 2
    },
    sweetness: 2,
    acidity: 1,
    bitterness: 1,
    carbonation: 0,
    body: 3,
    dairyFeeling: 0,
    alcoholFeel: 4,
    flavorTags: ["香草味", "枫木焦糖", "烟熏感", "橡木桶香"],
    goodWith: ["可口可乐 (Coca Cola)", "三得利无糖乌龙茶", "雪碧 (Sprite)"],
    riskyWith: ["酸性果汁 (易夺味)", "椰树椰汁"],
    notes: "田纳西威士忌。经过糖枫木炭逐滴过滤，富含香草、焦糖、成熟橡木香气，极其适合制作经典的杰克丹尼可乐嗨棒。",
    dataSource: "brand_site",
    confidence: 0.95,
    lastVerifiedAt: "2026-07-06",
    createdAt: "2026-07-06T00:00:00Z"
  },
  {
    id: "off-13",
    name: "百加得白朗姆酒",
    brand: "百加得 Bacardi",
    category: "基酒 / 朗姆酒",
    abv: 40,
    nutrition: {
      sugar_g_per_100ml: 0,
      energy_kj_per_100ml: 920,
      carbohydrate_g_per_100ml: 0,
      caffeine_mg_per_100ml: 0,
      fat_g_per_100ml: 0,
      protein_g_per_100ml: 0
    },
    ingredientsText: "水、甘蔗糖蜜发酵蒸馏液（白炭活性炭二次过滤）",
    flavorProfile: {
      sweetness: 1,
      acidity: 0,
      bitterness: 0,
      carbonation: 0,
      dairy: 0,
      tea: 0,
      fruit: 1,
      body: 2,
      freshness: 3
    },
    sweetness: 1,
    acidity: 0,
    bitterness: 0,
    carbonation: 0,
    body: 2,
    dairyFeeling: 0,
    alcoholFeel: 4,
    flavorTags: ["甘蔗香", "微甜", "杏仁香", "顺滑"],
    goodWith: ["可口可乐 (Coca Cola)", "椰树牌椰汁", "雪碧 (Sprite)", "薄荷叶"],
    riskyWith: ["重药本草本饮品", "奎宁汤力水"],
    notes: "白朗姆酒。具有淡淡的杏仁 and 成熟甘蔗甜香，是调制莫吉托（Mojito）与椰林飘香的王牌底基。",
    dataSource: "brand_site",
    confidence: 0.95,
    lastVerifiedAt: "2026-07-06",
    createdAt: "2026-07-06T00:00:00Z"
  },
  {
    id: "off-14",
    name: "俏雅经典梅酒",
    brand: "俏雅 Choya",
    category: "基酒 / 配制梅酒",
    abv: 14.5,
    nutrition: {
      sugar_g_per_100ml: 21.0,
      energy_kj_per_100ml: 650,
      carbohydrate_g_per_100ml: 21.0,
      caffeine_mg_per_100ml: 0,
      fat_g_per_100ml: 0,
      protein_g_per_100ml: 0
    },
    ingredientsText: "青梅、白砂糖、酿造酒精",
    flavorProfile: {
      sweetness: 4,
      acidity: 4,
      bitterness: 1,
      carbonation: 0,
      dairy: 0,
      tea: 0,
      fruit: 5,
      body: 3,
      freshness: 3
    },
    sweetness: 4,
    acidity: 4,
    bitterness: 1,
    carbonation: 0,
    body: 3,
    dairyFeeling: 0,
    alcoholFeel: 2,
    flavorTags: ["酸梅", "青果香", "浓香甜", "生津"],
    goodWith: ["三得利无糖乌龙茶", "东方树叶乌龙茶", "泰象苏打水", "雪碧 (Sprite)"],
    riskyWith: ["椰树牌椰汁 (易导致浑浊)", "百利甜酒"],
    notes: "日本经典梅酒。青梅发酵带来的天然苹果酸和柠檬酸多酚，能将任何辛辣的无糖气泡水转变为高级果香特调。",
    dataSource: "brand_site",
    confidence: 0.95,
    lastVerifiedAt: "2026-07-06",
    createdAt: "2026-07-06T00:00:00Z"
  },
  {
    id: "off-15",
    name: "百利甜酒",
    brand: "百利 Baileys",
    category: "基酒 / 奶油利口酒",
    abv: 17,
    nutrition: {
      sugar_g_per_100ml: 20.0,
      energy_kj_per_100ml: 1368,
      carbohydrate_g_per_100ml: 25.0,
      caffeine_mg_per_100ml: 1.0,
      fat_g_per_100ml: 13.0,
      protein_g_per_100ml: 3.0
    },
    ingredientsText: "爱尔兰奶油、爱尔兰威士忌、白砂糖、可可豆、香草",
    flavorProfile: {
      sweetness: 5,
      acidity: 0,
      bitterness: 1,
      carbonation: 0,
      dairy: 5,
      tea: 0,
      fruit: 0,
      body: 4,
      freshness: 1
    },
    sweetness: 5,
    acidity: 0,
    bitterness: 1,
    carbonation: 0,
    body: 4,
    dairyFeeling: 5,
    alcoholFeel: 2,
    flavorTags: ["奶油甜", "可可香", "浓稠丝滑", "威士忌底"],
    goodWith: ["椰树牌椰汁", "阿萨姆奶茶", "浓缩咖啡 Espresso", "绝对伏特加"],
    riskyWith: ["柠檬汁 (极易凝结成块)", "强酸气泡水"],
    notes: "活性奶油利口酒。含有乳脂悬胶体，具有极高粘稠度，千万不能与高酸柠檬汁接触，会迅速发生酸凝乳结块（curdling）。",
    dataSource: "brand_site",
    confidence: 0.95,
    lastVerifiedAt: "2026-07-06",
    createdAt: "2026-07-06T00:00:00Z"
  }
];

function generateLocalIngredientProfile(name: string, categorySuggestion?: string): any {
  let category = categorySuggestion || "风味饮品";
  const lowerName = name.toLowerCase();
  if (lowerName.includes("茶") || lowerName.includes("tea") || lowerName.includes("乌龙") || lowerName.includes("绿") || lowerName.includes("红")) category = "风味茶饮";
  else if (lowerName.includes("可乐") || lowerName.includes("汽泡") || lowerName.includes("气泡") || lowerName.includes("苏打") || lowerName.includes("sprite") || lowerName.includes("雪碧") || lowerName.includes("soda") || lowerName.includes("coke")) category = "碳酸气泡水";
  else if (lowerName.includes("椰") || lowerName.includes("奶") || lowerName.includes("拿铁") || lowerName.includes("牛奶") || lowerName.includes("咖啡") || lowerName.includes("yakult") || lowerName.includes("乳") || lowerName.includes("milk") || lowerName.includes("cream") || lowerName.includes("latte")) category = "植物蛋白/乳酸菌";
  else if (lowerName.includes("汁") || lowerName.includes("柠") || lowerName.includes("桃") || lowerName.includes("果") || lowerName.includes("橙") || lowerName.includes("juice") || lowerName.includes("lemon") || lowerName.includes("lime")) category = "风味果汁";
  else if (lowerName.includes("金酒") || lowerName.includes("伏特加") || lowerName.includes("威士忌") || lowerName.includes("朗姆") || lowerName.includes("梅酒") || lowerName.includes("烈酒") || lowerName.includes("rum") || lowerName.includes("gin") || lowerName.includes("vodka") || lowerName.includes("whiskey") || lowerName.includes("tequila") || lowerName.includes("酒")) category = "基酒";

  let sweetness = 3;
  let acidity = 1;
  let bitterness = 0;
  let carbonation = 0;
  let dairy = 0;
  let tea = 0;
  let fruit = 0;
  let body = 2;
  let freshness = 3;
  let abv = 0;

  if (category === "基酒") {
    abv = lowerName.includes("梅酒") ? 14.5 : lowerName.includes("百利") ? 17 : 40;
    sweetness = lowerName.includes("梅酒") || lowerName.includes("百利") ? 4 : 0;
    bitterness = lowerName.includes("金酒") ? 2 : 1;
    freshness = lowerName.includes("伏特加") ? 4 : 2;
    body = lowerName.includes("百利") ? 4 : lowerName.includes("梅酒") ? 3 : 2;
    dairy = lowerName.includes("百利") ? 5 : 0;
  } else {
    if (lowerName.includes("无糖") || lowerName.includes("sugar free") || lowerName.includes("zero") || lowerName.includes("苏打") || lowerName.includes("原叶")) sweetness = 0;
    else if (lowerName.includes("半糖") || lowerName.includes("微甜") || lowerName.includes("low sugar")) sweetness = 2;
    
    if (lowerName.includes("柠檬") || lowerName.includes("酸") || lowerName.includes("西柚") || lowerName.includes("醋") || lowerName.includes("lemon") || lowerName.includes("acid") || lowerName.includes("lime")) {
      acidity = 4;
      fruit = 4;
      sweetness = Math.max(1, sweetness - 1);
    }
    if (lowerName.includes("茶") || lowerName.includes("tea") || lowerName.includes("乌龙")) {
      tea = 4;
      bitterness = 1;
    }
    if (lowerName.includes("果") || lowerName.includes("汁") || lowerName.includes("juice") || lowerName.includes("桃") || lowerName.includes("橙")) {
      fruit = 3;
    }
    if (lowerName.includes("汽水") || lowerName.includes("气泡") || lowerName.includes("苏打") || lowerName.includes("可乐") || lowerName.includes("雪碧") || lowerName.includes("soda") || lowerName.includes("bubbly") || lowerName.includes("fizz")) {
      carbonation = 4;
      body = 1;
    }
    if (lowerName.includes("奶") || lowerName.includes("乳") || lowerName.includes("椰") || lowerName.includes("拿铁") || lowerName.includes("milk") || lowerName.includes("cream") || lowerName.includes("yakult") || lowerName.includes("发酵")) {
      dairy = 3;
      body = 3;
    }
  }

  const flavorTags = [name.slice(0, 4) + "风味"];
  if (sweetness >= 3) flavorTags.push("清甜");
  if (acidity >= 3) flavorTags.push("酸爽");
  if (carbonation >= 3) flavorTags.push("起泡");
  if (dairy >= 3) flavorTags.push("厚醇");
  if (sweetness === 0) flavorTags.push("无糖低卡");

  const sugarVal = sweetness === 0 ? 0 : sweetness * 3 + (category === "基酒" ? 0 : 2);
  const energyVal = abv > 0 ? abv * 20 : (sugarVal * 17);

  return {
    id: `local-gen-${Date.now()}`,
    name,
    brand: name.slice(0, 2),
    category,
    abv,
    nutrition: {
      sugar_g_per_100ml: sugarVal,
      energy_kj_per_100ml: Math.round(energyVal),
      carbohydrate_g_per_100ml: sugarVal + 0.5,
      caffeine_mg_per_100ml: lowerName.includes("茶") || lowerName.includes("咖啡") || lowerName.includes("可乐") ? 15 : 0,
      fat_g_per_100ml: dairy > 0 ? (dairy * 0.8) : 0,
      protein_g_per_100ml: dairy > 0 ? (dairy * 0.3) : 0
    },
    ingredientsText: category === "风味茶饮" ? "水、茶叶、维生素C" : "水、白糖、食品添加剂（食用香精等）",
    flavorProfile: {
      sweetness,
      acidity,
      bitterness,
      carbonation,
      dairy,
      tea,
      fruit,
      body,
      freshness
    },
    // Compatibility fields
    sweetness,
    acidity,
    bitterness,
    carbonation,
    body,
    flavorTags,
    goodWith: category === "基酒" ? ["苏打水 Soda", "雪碧 Sprite", "柠檬汁 Lemon Squeeze"] : ["伏特加 Vodka", "金酒 Gin", "苏打水 Soda"],
    riskyWith: category === "基酒" ? ["过量糖浆"] : ["高浓度香醋"],
    dataSource: "ai_estimate",
    confidence: 0.72,
    createdAt: new Date().toISOString()
  };
}

// Endpoint 1: Search materials (Local lookup first, then Gemini AI)
app.post("/api/ingredients/search", async (req, res) => {
  const { query } = req.body;
  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "Search query is required." });
  }

  const normalizedQuery = query.trim().toLowerCase();

  // 1. Try local exact or fuzzy match
  const matched = OFFICIAL_INGREDIENTS.find(
    (item) =>
      item.name.toLowerCase().includes(normalizedQuery) ||
      (item.brand && item.brand.toLowerCase().includes(normalizedQuery))
  );

  if (matched) {
    console.log(`Local match found for query "${query}": ${matched.name}`);
    return res.json(matched);
  }

  // 2. If not found, try Gemini Client
  const ai = getGeminiClient();
  if (!ai) {
    console.log(`No GEMINI_API_KEY. Using dynamic local flavor rules for: "${query}"`);
    return res.json(generateLocalIngredientProfile(query));
  }

  try {
    const prompt = `You are the chief molecular flavor cataloger at AlcheMix Lab.
The user wants to analyze and generate a high-fidelity flavor profile for the beverage: "${query}".

Analyze this drink scientifically. Categorize its flavor properties and identify its characteristics. 
If the query refers to a known Chinese or international beverage/brand (e.g., "东方树叶", "可口可乐", "旺仔牛奶", "王老吉", "维他柠檬茶", "星巴克拿铁"), use your extensive knowledge database to generate the actual precise profile.
If it is a generic drink (e.g., "苹果汁", "西柚苏打"), generate the standard profile for that drink.

Provide a JSON object conforming exactly to this structure:
{
  "name": "Exact full brand name or item name",
  "brand": "The brand name if applicable (e.g., '农夫山泉', '三得利', '可口可乐'), otherwise empty string",
  "category": "Short descriptive category (e.g., '无糖茶饮', '苏打气泡水', '植物蛋白饮料', '果汁', '乳酸饮料')",
  "source": "ai_generated",
  "ingredientsText": "Simulated/actual ingredient list of this beverage (e.g., '水, 椰子汁, 白砂糖...')",
  "nutritionText": "Simulated/actual nutrition info per 100ml (e.g., '能量: 140kJ, 碳水化合物: 8.2g')",
  "flavorTags": ["Vivid flavor descriptor 1", "Descriptor 2", "Descriptor 3"],
  "textureTags": ["Texture 1 (e.g., 顺滑, 轻盈, 气泡感)", "Texture 2"],
  "aromaTags": ["Aroma 1", "Aroma 2"],
  "sweetness": 0 to 5,
  "acidity": 0 to 5,
  "bitterness": 0 to 5,
  "alcoholFeel": 0 to 5 (0 if non-alcoholic),
  "dairyFeeling": 0 to 5,
  "carbonation": 0 to 5,
  "body": 1 to 5 (1 is thin as water, 5 is viscous as thick syrup),
  "goodWith": ["Pairs beautifully with 1 (e.g., 伏特加 Vodka)", "Pairs beautifully with 2"],
  "riskyWith": ["Risky partner 1", "Risky partner 2"],
  "notes": "A friendly 2-sentence molecular chemistry note explaining the drink's flavor interaction warnings or synergy. Keep it scientific, encouraging, and helpful!",
  "confidence": 0.8 to 1.0
}

Response MUST be valid JSON only. Keep values in Chinese for tags, goodWith, riskyWith, notes, brand, category, ingredientsText, and nutritionText. Keep ratings realistic (e.g., unsweetened oolong oolong tea has sweetness 0, coke has sweetness 4).`;

    const response = await retryWithBackoff(() => ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            brand: { type: Type.STRING },
            category: { type: Type.STRING },
            source: { type: Type.STRING },
            ingredientsText: { type: Type.STRING },
            nutritionText: { type: Type.STRING },
            flavorTags: { type: Type.ARRAY, items: { type: Type.STRING } },
            textureTags: { type: Type.ARRAY, items: { type: Type.STRING } },
            aromaTags: { type: Type.ARRAY, items: { type: Type.STRING } },
            sweetness: { type: Type.INTEGER },
            acidity: { type: Type.INTEGER },
            bitterness: { type: Type.INTEGER },
            alcoholFeel: { type: Type.INTEGER },
            dairyFeeling: { type: Type.INTEGER },
            carbonation: { type: Type.INTEGER },
            body: { type: Type.INTEGER },
            goodWith: { type: Type.ARRAY, items: { type: Type.STRING } },
            riskyWith: { type: Type.ARRAY, items: { type: Type.STRING } },
            notes: { type: Type.STRING },
            confidence: { type: Type.NUMBER }
          },
          required: [
            "name", "brand", "category", "source", "flavorTags", "textureTags", "aromaTags",
            "sweetness", "acidity", "bitterness", "alcoholFeel", "dairyFeeling", "carbonation", "body",
            "goodWith", "riskyWith", "notes", "confidence"
          ]
        }
      }
    }));

    const result = JSON.parse(response.text?.trim() || "{}");
    result.id = `ai-gen-${Date.now()}`;
    return res.json(result);
  } catch (error: any) {
    console.error("Gemini Ingredient Search Error:", error);
    return res.json(generateLocalIngredientProfile(query));
  }
});

// Endpoint 2: Photo OCR / simulated visual analyzer
app.post("/api/ingredients/ocr", async (req, res) => {
  const { imageBase64, text, nameHint = "未命名材料" } = req.body;

  const ai = getGeminiClient();
  if (!ai) {
    console.log("No GEMINI_API_KEY configured for OCR. Generating mock flavor profile from text.");
    const sampleText = text || "水、椰浆、白砂糖、酪蛋白酸钠";
    const derivedName = nameHint || "扫描所得材料";
    const mockProfile = generateLocalIngredientProfile(derivedName);
    mockProfile.source = "photo_extracted";
    mockProfile.ingredientsText = sampleText;
    return res.json(mockProfile);
  }

  try {
    let contents: any[] = [];
    let textPrompt = `You are an expert OCR chemical analyst at AlcheMix Lab.
Analyze the following text or image containing a drink's ingredient table or bottle labels. 
Determine the name of the beverage, extract its full ingredients list, and compile a scientifically precise flavor profile conforming to the JSON schema.`;

    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      contents.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: cleanBase64
        }
      });
      textPrompt += `\nExtrapolate all data from the attached image of the drink label. If you cannot extract clear text, generate a highly plausible profile based on the visible product identity.`;
    }

    if (text) {
      textPrompt += `\nRaw Scanned Text / Ingredients: "${text}"`;
    }

    contents.push({ text: textPrompt });

    const response = await retryWithBackoff(() => ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: contents },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            brand: { type: Type.STRING },
            category: { type: Type.STRING },
            source: { type: Type.STRING },
            ingredientsText: { type: Type.STRING },
            nutritionText: { type: Type.STRING },
            flavorTags: { type: Type.ARRAY, items: { type: Type.STRING } },
            textureTags: { type: Type.ARRAY, items: { type: Type.STRING } },
            aromaTags: { type: Type.ARRAY, items: { type: Type.STRING } },
            sweetness: { type: Type.INTEGER },
            acidity: { type: Type.INTEGER },
            bitterness: { type: Type.INTEGER },
            alcoholFeel: { type: Type.INTEGER },
            dairyFeeling: { type: Type.INTEGER },
            carbonation: { type: Type.INTEGER },
            body: { type: Type.INTEGER },
            goodWith: { type: Type.ARRAY, items: { type: Type.STRING } },
            riskyWith: { type: Type.ARRAY, items: { type: Type.STRING } },
            notes: { type: Type.STRING },
            confidence: { type: Type.NUMBER }
          },
          required: [
            "name", "brand", "category", "flavorTags", "textureTags", "aromaTags",
            "sweetness", "acidity", "bitterness", "alcoholFeel", "dairyFeeling", "carbonation", "body",
            "goodWith", "riskyWith", "notes", "confidence"
          ]
        }
      }
    }));

    const result = JSON.parse(response.text?.trim() || "{}");
    result.id = `ocr-gen-${Date.now()}`;
    result.source = "photo_extracted";
    return res.json(result);
  } catch (error: any) {
    console.error("Gemini Ingredient OCR Error:", error);
    const mock = generateLocalIngredientProfile(nameHint || "扫描饮料");
    mock.source = "photo_extracted";
    if (text) mock.ingredientsText = text;
    return res.json(mock);
  }
});

// Endpoint 3: Manual addition generator
app.post("/api/ingredients/generate-similar", async (req, res) => {
  const { name, category, description } = req.body;
  if (!name) {
    return res.status(400).json({ error: "Name is required for manual generation." });
  }

  const ai = getGeminiClient();
  if (!ai) {
    console.log("No GEMINI_API_KEY. Using local generation rules for manual add.");
    const mock = generateLocalIngredientProfile(name, category);
    mock.notes = `基于手动录入(${description || "无描述"})生成的本地估算档案。`;
    mock.source = "user_added";
    return res.json(mock);
  }

  try {
    const prompt = `You are a molecular cocktail mixologist. A user manually wants to add an ingredient:
- Name: "${name}"
- Suggested Category: "${category || "风味配料"}"
- User Taste/Ingredients description: "${description || "无"}"

Generate a complete molecular flavor profile for this custom ingredient, taking into account their description. Conform exactly to the JSON schema.`;

    const response = await retryWithBackoff(() => ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            brand: { type: Type.STRING },
            category: { type: Type.STRING },
            source: { type: Type.STRING },
            ingredientsText: { type: Type.STRING },
            nutritionText: { type: Type.STRING },
            flavorTags: { type: Type.ARRAY, items: { type: Type.STRING } },
            textureTags: { type: Type.ARRAY, items: { type: Type.STRING } },
            aromaTags: { type: Type.ARRAY, items: { type: Type.STRING } },
            sweetness: { type: Type.INTEGER },
            acidity: { type: Type.INTEGER },
            bitterness: { type: Type.INTEGER },
            alcoholFeel: { type: Type.INTEGER },
            dairyFeeling: { type: Type.INTEGER },
            carbonation: { type: Type.INTEGER },
            body: { type: Type.INTEGER },
            goodWith: { type: Type.ARRAY, items: { type: Type.STRING } },
            riskyWith: { type: Type.ARRAY, items: { type: Type.STRING } },
            notes: { type: Type.STRING },
            confidence: { type: Type.NUMBER }
          },
          required: [
            "name", "brand", "category", "flavorTags", "textureTags", "aromaTags",
            "sweetness", "acidity", "bitterness", "alcoholFeel", "dairyFeeling", "carbonation", "body",
            "goodWith", "riskyWith", "notes", "confidence"
          ]
        }
      }
    }));

    const result = JSON.parse(response.text?.trim() || "{}");
    result.id = `user-gen-${Date.now()}`;
    result.source = "user_added";
    return res.json(result);
  } catch (error: any) {
    console.error("Gemini Manual Generate Error:", error);
    const mock = generateLocalIngredientProfile(name, category);
    mock.source = "user_added";
    return res.json(mock);
  }
});

// 1. POST /api/mix - Reaction Mixer (legacy compat)
app.post("/api/mix", async (req, res) => {
  const { spirit, mixer, size } = req.body;

  if (!spirit || !mixer || !size) {
    return res.status(400).json({ error: "Missing spirit, mixer, or size." });
  }

  const ai = getGeminiClient();
  if (!ai) {
    // Return fallback preset
    console.log("No GEMINI_API_KEY configured. Returning fallback local formula.");
    return res.json(getFallbackMixResult(spirit, mixer, size));
  }

  try {
    const prompt = `You are a master of molecular mixology and alchemist cocktail formulation. 
The user has mixed "${spirit}" (Spirit Base) with "${mixer}" (Mixer Reagent) in a "${size}" vessel.
Your task is to analyze this combination and evaluate its properties.

Generate a JSON object containing:
- chineseName: A creative, scientific-sounding Chinese name for this specific drink (e.g., "薄荷冰川特调", "金酒量子苏打")
- name: A stylish English translation/name
- subtitle: A cool scientific tag line / subtitle in Chinese
- rating: An object with integer values (from 1 to 5) for:
  - sweet: level of sweetness
  - acid: level of acidity
  - strength: level of alcohol strength
- comments: 2-3 sentences in Chinese written in the style of an whimsical alchemist's lab notebook entry, explaining how the molecules, esters, or carbonation interact to create the flavor experience. Keep it highly engaging and "sciency"!
- tags: 2-3 short descriptive tag strings in Chinese (e.g., ["强酸性", "微酸", "强气泡", "草本香"])

Your response MUST be strict valid JSON matching these fields. Do not include markdown code block syntax around the JSON, just the JSON string.`;

    const response = await retryWithBackoff(() => ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            chineseName: { type: Type.STRING },
            name: { type: Type.STRING },
            subtitle: { type: Type.STRING },
            rating: {
              type: Type.OBJECT,
              properties: {
                sweet: { type: Type.INTEGER },
                acid: { type: Type.INTEGER },
                strength: { type: Type.INTEGER },
              },
              required: ["sweet", "acid", "strength"],
            },
            comments: { type: Type.STRING },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ["chineseName", "name", "subtitle", "rating", "comments", "tags"],
        },
      },
    }));

    const jsonText = response.text?.trim() || "";
    const result = JSON.parse(jsonText);
    res.json(result);
  } catch (error: any) {
    console.error("Gemini Mix Error:", error);
    res.json(getFallbackMixResult(spirit, mixer, size));
  }
});

// 1.5. POST /api/lab-mix - Scientific Multi-Ingredient Laboratory Evaluation
app.post("/api/lab-mix", async (req, res) => {
  const { ingredients = [], mixMethod = "Stir" } = req.body;

  if (!ingredients || ingredients.length === 0) {
    return res.status(400).json({ error: "At least one ingredient is required." });
  }

  const ai = getGeminiClient();
  if (!ai) {
    console.log("No GEMINI_API_KEY configured for Lab. Returning local rule-based flavor evaluation.");
    return res.json(calculateLocalLabMix(ingredients, mixMethod));
  }

  try {
    const ingredientsDescription = ingredients.map((i: any) => `- ${i.name}: ${i.amount}ml (Category: ${i.category})`).join("\n");
    const prompt = `You are the Lead Clinical Alchemist and chief molecular flavor diagnostician at "AlcheMix Lab".
A researcher has formulated a custom drink in a beaker by combining the following precise ingredients:
${ingredientsDescription}

The ingredients were mixed using the "${mixMethod}" method (either "Stir" for gentle stirring, or "Shake" for intense shaking).

Analyze this combination's molecular interactions, flavor compounds, density bonding, and alcohol-to-dilution ratios.
Generate a JSON object containing:
- chineseName: A creative, highly imaginative scientific/alchemical-sounding Chinese name (e.g., "量子乌龙共振键", "蔓越莓重力层析液", "伏特加乳酸聚合物")
- name: A stylish, elegant English name
- subtitle: A cool scientific tagline or caption in Chinese (e.g., "重结晶物理缓释特调")
- rating: An object containing integer values (from 1 to 5) for these 8 dimensions:
  - sweet: Sweetness level
  - acid: Acidity/sourness level
  - strength: Alcohol/ethanol intensity level
  - creamy: Milkiness, creaminess, or lactobacillus mouthfeel level
  - herbal: Botanical, herbal, tea, or juniper complexity level
  - bubbly: Effervescence, fizz, carbon dioxide bubbles level
  - freshness: Clean, light, hydrating, crisp level
  - heaviness: Body, viscosity, alcohol density, rich flavor density level
- comments: 3-4 sentences in Chinese, written in the style of a whimsical alchemist's clinical laboratory notebook entry. Scientifically explain how these specific ingredients (mentioning names like Sprite, Yakult, Oolong, Gin, etc., as appropriate) interact at a molecular level, and how the chosen mixing method (${mixMethod}) altered or enhanced the flavor synergy. Keep it extremely engaging, whimsical, precise, and highly "sciency"!
- tags: 2-3 short descriptive chemical/mixological tags in Chinese (e.g., ["强酸析出", "顺滑胶体", "低阈值微醺"])

Your response MUST be strict valid JSON matching this schema exactly.`;

    const response = await retryWithBackoff(() => ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            chineseName: { type: Type.STRING },
            name: { type: Type.STRING },
            subtitle: { type: Type.STRING },
            rating: {
              type: Type.OBJECT,
              properties: {
                sweet: { type: Type.INTEGER },
                acid: { type: Type.INTEGER },
                strength: { type: Type.INTEGER },
                creamy: { type: Type.INTEGER },
                herbal: { type: Type.INTEGER },
                bubbly: { type: Type.INTEGER },
                freshness: { type: Type.INTEGER },
                heaviness: { type: Type.INTEGER },
              },
              required: ["sweet", "acid", "strength", "creamy", "herbal", "bubbly", "freshness", "heaviness"],
            },
            comments: { type: Type.STRING },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ["chineseName", "name", "subtitle", "rating", "comments", "tags"],
        },
      },
    }));

    const jsonText = response.text?.trim() || "";
    const result = JSON.parse(jsonText);
    res.json(result);
  } catch (error: any) {
    console.error("Gemini Lab Mix Error:", error);
    res.json(calculateLocalLabMix(ingredients, mixMethod));
  }
});

// 2. POST /api/assistant - AI Assistant Chat
app.post("/api/assistant", async (req, res) => {
  const { query, history = [] } = req.body;

  if (!query) {
    return res.status(400).json({ error: "Query is required" });
  }

  const ai = getGeminiClient();
  if (!ai) {
    return res.json({
      text: "👋 你好！我是 AlcheMix Lab 的首席 AI 调配师。检测到当前未配置 AI 密钥，但我仍能为你服务！你可以体验 **Lab 实验室**、**Inspiration 灵感手记** 以及 **My 档案中心**。如果你想进行分子级智能问答，请在设置中配置你的 `GEMINI_API_KEY`！",
      cocktails: [
        {
          id: "assistant-preset-1",
          chineseName: "柠檬苏打伏特加",
          name: "Citrus Vodka Fizz",
          subtitle: "极简清爽的微醺公式",
          spirit: "伏特加 Vodka",
          mixer: "苏打水 Soda",
          size: "250ml",
          rating: { sweet: 2, acid: 4, strength: 3 },
          comments: "伏特加的纯净配上苏打气泡的物理撞击，柠檬汁的弱酸分子起到了画龙点睛的增香作用。",
          tags: ["清爽", "解腻"],
        },
      ],
    });
  }

  try {
    const formattedHistory = history.map((h: any) => ({
      role: h.sender === "user" ? "user" : "model",
      parts: [{ text: h.text }],
    }));

    const systemInstruction = `You are the Lead Clinical Alchemist and AI Bartending Assistant at "AlcheMix Lab". 
You help users explore the scientific principles of cocktail blending, suggest recipes based on ingredients they have at home, and solve mixing disasters.
Your personality is smart, professional, scientifically meticulous, but charming and playful.
Always write in friendly Chinese. Use markdown where helpful for recipes, key highlights, or steps.

If the user is asking "what can I make with my ingredients", "suggest a recipe", or has ingredient suggestions, formulate 1 or 2 elegant, custom cocktail recipes.
If you formulate recipes, return them in the 'cocktails' array conforming to the specified schema.
If the query is a general question (e.g., explaining acidity in drinks, why ice matters), return a descriptive text answer and keep 'cocktails' as an empty array.

Your response MUST match the JSON schema with:
- text: your verbal reply (Markdown supported)
- cocktails: list of recommended custom recipes (optional or empty if not creating recipes).`;

    const response = await retryWithBackoff(() => ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        ...formattedHistory,
        { role: "user", parts: [{ text: query }] }
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            cocktails: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  chineseName: { type: Type.STRING },
                  name: { type: Type.STRING },
                  subtitle: { type: Type.STRING },
                  spirit: { type: Type.STRING },
                  mixer: { type: Type.STRING },
                  size: { type: Type.STRING },
                  rating: {
                    type: Type.OBJECT,
                    properties: {
                      sweet: { type: Type.INTEGER },
                      acid: { type: Type.INTEGER },
                      strength: { type: Type.INTEGER },
                    },
                    required: ["sweet", "acid", "strength"],
                  },
                  comments: { type: Type.STRING },
                  tags: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: ["chineseName", "name", "subtitle", "spirit", "mixer", "size", "rating", "comments", "tags"],
              },
            },
          },
          required: ["text", "cocktails"],
        },
      },
    }));

    const jsonText = response.text?.trim() || "";
    const result = JSON.parse(jsonText);
    res.json(result);
  } catch (error: any) {
    console.error("Gemini Assistant Error:", error);
    res.json({
      text: "抱歉，我的分子反应炉出了一点小偏差。不过建议你可以尝试以下经典公式：",
      cocktails: [
        {
          id: "err-fallback-1",
          chineseName: "金汤力经典",
          name: "Gin & Tonic",
          subtitle: "永恒的实验室平衡",
          spirit: "金酒 Gin",
          mixer: "汤力水 Tonic",
          size: "250ml",
          rating: { sweet: 3, acid: 3, strength: 3 },
          comments: "杜松子和奎宁的完美键合，这是现代酒吧最稳固的基石之一。",
          tags: ["微苦", "药本草香"],
        },
      ],
    });
  }
});

// 2.5. POST /api/classic-improve - Classic Cocktail Domestication / Improvement Analyzer
app.post("/api/classic-improve", async (req, res) => {
  const { cocktailId, directions = [] } = req.body;

  if (!cocktailId) {
    return res.status(400).json({ error: "Cocktail ID is required." });
  }

  // High fidelity fallback dataset for all 8 classic cocktails
  const classicDatabase: Record<string, any> = {
    negroni: {
      id: "negroni",
      chineseName: "内格罗尼 Negroni",
      name: "Negroni",
      desc: "这杯酒的苦味主要来自金巴利（Campari），草本植物药感和酒精感都极重。新手第一次喝可能会觉得像“深红色苦药水”。",
      ingredients: [
        { name: "金酒 Gin", amount: 30, category: "基酒", color: "rgba(148, 163, 184, 0.45)" },
        { name: "金巴利 Campari", amount: 30, category: "辅料", color: "rgba(220, 38, 38, 0.65)" },
        { name: "甜味美思 Sweet Vermouth", amount: 30, category: "辅料", color: "rgba(127, 29, 29, 0.7)" }
      ],
      rating: { sweet: 2, acid: 2, strength: 4, creamy: 1, herbal: 5, bubbly: 1, freshness: 2, heaviness: 4 },
      defaultImproved: {
        chineseName: "新手版内格罗尼起泡 (Negroni Spritz)",
        name: "Negroni Spritz",
        ingredients: [
          { name: "金酒 Gin", amount: 20, category: "基酒", color: "rgba(148, 163, 184, 0.45)" },
          { name: "金巴利 Campari", amount: 15, category: "辅料", color: "rgba(220, 38, 38, 0.5)" },
          { name: "甜味美思 Sweet Vermouth", amount: 20, category: "辅料", color: "rgba(127, 29, 29, 0.6)" },
          { name: "橙味气泡水 Orange Soda", amount: 90, category: "气泡饮料", color: "rgba(249, 115, 22, 0.4)", isBubbly: true }
        ],
        mixMethod: "Stir",
        comments: "【分子层析】减少金酒与金巴利的比例以降低酒精烈度，加入橙味汽水拉长酒体。气泡中的碳酸将橙子果香与金巴利的草本苦完美交融，既保留了内格罗尼标志性的橙红色彩和灵魂草药香，又完全消除了令人抗拒的重苦感，口感清甜舒爽！",
        tags: ["新手友好", "低苦度", "橙香气泡"],
        rating: { sweet: 4, acid: 3, strength: 2, creamy: 1, herbal: 2, bubbly: 4, freshness: 4, heaviness: 2 }
      }
    },
    old_fashioned: {
      id: "old_fashioned",
      chineseName: "古典老式 Old Fashioned",
      name: "Old Fashioned",
      desc: "配方中几乎全部是高酒精度的威士忌，辣感强、刺激性极大，新手喝起来容易感到嗓子被烧灼，无法品尝出其原有的木桶和焦糖香气。",
      ingredients: [
        { name: "威士忌 Whiskey", amount: 60, category: "基酒", color: "rgba(217, 119, 6, 0.45)" },
        { name: "白糖块 Sugar", amount: 5, category: "辅料", color: "rgba(255, 255, 255, 0.9)" },
        { name: "安高天娜苦精 Bitters", amount: 2, category: "辅料", color: "rgba(120, 53, 4, 0.8)" }
      ],
      rating: { sweet: 2, acid: 1, strength: 5, creamy: 1, herbal: 3, bubbly: 1, freshness: 1, heaviness: 5 },
      defaultImproved: {
        chineseName: "新手蜜桃老式嗨棒 (Old Fashioned Peach Highball)",
        name: "Old Fashioned Peach Highball",
        ingredients: [
          { name: "威士忌 Whiskey", amount: 30, category: "基酒", color: "rgba(217, 119, 6, 0.35)" },
          { name: "冰红茶/蜜桃茶 Peach Tea", amount: 90, category: "茶饮", color: "rgba(194, 65, 12, 0.4)" },
          { name: "苏打气泡水 Soda Water", amount: 45, category: "气泡饮料", color: "rgba(224, 242, 254, 0.25)", isBubbly: true }
        ],
        mixMethod: "Stir",
        comments: "【重力层析】将高浓度烈性威士忌用量减半，注入清爽的蜜桃茶饮，并添加强力苏打气泡。苏打气泡迅速裹挟着威士忌的橡木辛香、茶多酚的细腻单宁，在蜂蜜蜜桃甜味的温和稀释下，在舌尖形成清甜滑溜的触感，完全抹平了酒精的辛辣刺喉感！",
        tags: ["降低烈度", "蜜桃茶香", "极度温和"],
        rating: { sweet: 4, acid: 2, strength: 2, creamy: 1, herbal: 2, bubbly: 3, freshness: 4, heaviness: 2 }
      }
    },
    martini: {
      id: "martini",
      chineseName: "经典马天尼 Martini",
      name: "Martini",
      desc: "马天尼由极高浓度的金酒和味美思调配而成，被称为“鸡尾酒之王”，但其酒感异常干烈，没有甜味，对没有基础的人来说入口非常辛辣、粗糙。",
      ingredients: [
        { name: "金酒 Gin", amount: 60, category: "基酒", color: "rgba(148, 163, 184, 0.4)" },
        { name: "干味美思 Dry Vermouth", amount: 10, category: "辅料", color: "rgba(241, 245, 249, 0.35)" }
      ],
      rating: { sweet: 1, acid: 2, strength: 5, creamy: 1, herbal: 4, bubbly: 1, freshness: 2, heaviness: 4 },
      defaultImproved: {
        chineseName: "青瓜百合冷浸金酒 (Cucumber Gin Cooler)",
        name: "Cucumber Gin Cooler",
        ingredients: [
          { name: "金酒 Gin", amount: 25, category: "基酒", color: "rgba(148, 163, 184, 0.35)" },
          { name: "白葡萄汁 Grape Juice", amount: 45, category: "果汁", color: "rgba(254, 243, 199, 0.4)" },
          { name: "苏打气泡水 Soda Water", amount: 80, category: "气泡饮料", color: "rgba(224, 242, 254, 0.2)", isBubbly: true },
          { name: "薄荷叶 Mint Infusion", amount: 10, category: "辅料", color: "rgba(16, 185, 129, 0.4)" }
        ],
        mixMethod: "Stir",
        comments: "【分子层层析】这杯金酒改良特调，完全去除了干涩感。将金酒高度酒精稀释，注入冰凉沁爽的白葡萄果糖，并用清脆的黄瓜薄荷苏打水拉长酒体。葡萄中的多酚与金酒本身的杜松子草本香结合，产生一种极为清冷、干净、仙气飘飘的草本清凉感，不再燥热辛辣！",
        tags: ["草本清凉", "白葡萄甜", "无痛饮用"],
        rating: { sweet: 3, acid: 3, strength: 2, creamy: 1, herbal: 3, bubbly: 3, freshness: 5, heaviness: 1 }
      }
    },
    gin_tonic: {
      id: "gin_tonic",
      chineseName: "金汤力 Gin Tonic",
      name: "Gin Tonic",
      desc: "汤力水中天然含有的“奎宁”（Quinine）具有非常奇特的药本植物苦涩感，配合酒精的刺激，很多不习惯药本味的小白会觉得它有些难以下咽。",
      ingredients: [
        { name: "金酒 Gin", amount: 45, category: "基酒", color: "rgba(148, 163, 184, 0.45)" },
        { name: "汤力水 Tonic", amount: 120, category: "辅料", color: "rgba(239, 246, 255, 0.3)", isBubbly: true }
      ],
      rating: { sweet: 2, acid: 3, strength: 3, creamy: 1, herbal: 4, bubbly: 4, freshness: 4, heaviness: 2 },
      defaultImproved: {
        chineseName: "柠檬蜂蜜小草本 Fizz (Lemon Gin Honey Fizz)",
        name: "Lemon Gin Honey Fizz",
        ingredients: [
          { name: "金酒 Gin", amount: 30, category: "基酒", color: "rgba(148, 163, 184, 0.4)" },
          { name: "柠檬气泡水 Lemon Soda", amount: 100, category: "气泡饮料", color: "rgba(254, 240, 138, 0.3)", isBubbly: true },
          { name: "茉莉绿茶 Green Tea", amount: 40, category: "茶饮", color: "rgba(163, 230, 53, 0.25)" }
        ],
        mixMethod: "Stir",
        comments: "【配体中和】汤力水的苦涩主要源于奎宁分子。我们用清脆的柠檬气泡水代替汤力水，完美祛除了奎宁苦味；再渗入一丝轻柔舒缓的茉莉茶多酚，不仅保留了金酒（Gin）原本独特的松针、草本及花香精髓，还使得整杯酒变得清香回甘，气泡轻盈，极其好上口！",
        tags: ["消退药苦", "茉莉清茶", "柠檬甜气"],
        rating: { sweet: 3, acid: 3, strength: 2, creamy: 1, herbal: 3, bubbly: 3, freshness: 5, heaviness: 1 }
      }
    },
    mojito: {
      id: "mojito",
      chineseName: "经典莫吉托 Mojito",
      name: "Mojito",
      desc: "莫吉托对捶打新鲜薄荷的力道极为挑剔，一旦薄荷叶被碾碎过度就会释出强烈的苦涩“青草味”；而当比例失调时，浓烈的烈酒感和高浓酸度也容易打乱饮用体验。",
      ingredients: [
        { name: "白朗姆 Rum", amount: 45, category: "基酒", color: "rgba(180, 83, 9, 0.35)" },
        { name: "青柠汁 Lime Juice", amount: 20, category: "果汁", color: "rgba(132, 204, 22, 0.5)" },
        { name: "白砂糖 Sugar", amount: 15, category: "辅料", color: "rgba(255, 255, 255, 0.9)" },
        { name: "苏打水 Soda", amount: 60, category: "气泡饮料", color: "rgba(224, 242, 254, 0.25)", isBubbly: true }
      ],
      rating: { sweet: 3, acid: 4, strength: 3, creamy: 1, herbal: 4, bubbly: 3, freshness: 5, heaviness: 2 },
      defaultImproved: {
        chineseName: "便利店阳光青柠莫吉托 (Sunshine Sprite Mojito)",
        name: "Sunshine Sprite Mojito",
        ingredients: [
          { name: "白朗姆 Rum", amount: 30, category: "基酒", color: "rgba(180, 83, 9, 0.25)" },
          { name: "柠檬汁 Lemon Squeeze", amount: 10, category: "辅料", color: "rgba(234, 179, 8, 0.7)" },
          { name: "雪碧汽水 Sprite", amount: 120, category: "气泡饮料", color: "rgba(209, 250, 229, 0.3)", isBubbly: true }
        ],
        mixMethod: "Stir",
        comments: "【分子配比重置】为了解决比例易失衡、无鲜薄荷的痛点，我们改用配比极其稳定的雪碧汽水作为碳酸糖类骨架。雪碧中天然融合了柠檬与酸甜配体，能完美掩盖廉价朗姆酒的辛辣乙醇气。即便只有冰块和简单柠檬汁，也能复刻极高完整度的冰凉海风清香！",
        tags: ["便利配方", "超高良率", "雪碧拉长"],
        rating: { sweet: 4, acid: 3, strength: 2, creamy: 1, herbal: 2, bubbly: 4, freshness: 5, heaviness: 1 }
      }
    },
    margarita: {
      id: "margarita",
      chineseName: "玛格丽特 Margarita",
      name: "Margarita",
      desc: "由于配方中含有高浓度的龙舌兰（Tequila）并辅以干烈酸 Lime 汁，其杯口的盐边会造成咸、酸、辛、辣等多重冲击，龙舌兰独特的泥土植物风味也非常具有侵略性。",
      ingredients: [
        { name: "龙舌兰 Tequila", amount: 45, category: "基酒", color: "rgba(217, 119, 6, 0.3)" },
        { name: "橙味利口酒 Triple Sec", amount: 20, category: "辅料", color: "rgba(253, 186, 116, 0.4)" },
        { name: "青柠汁 Lime Juice", amount: 15, category: "果汁", color: "rgba(132, 204, 22, 0.5)" }
      ],
      rating: { sweet: 2, acid: 5, strength: 4, creamy: 1, herbal: 3, bubbly: 1, freshness: 3, heaviness: 3 },
      defaultImproved: {
        chineseName: "便利店鲜橙盐苏打玛格 (Orange Salt Margarita)",
        name: "Orange Salt Margarita",
        ingredients: [
          { name: "龙舌兰 Tequila", amount: 25, category: "基酒", color: "rgba(217, 119, 6, 0.25)" },
          { name: "纯橙汁 Orange Juice", amount: 60, category: "果汁", color: "rgba(249, 115, 22, 0.55)" },
          { name: "苏打气泡水 Soda Water", amount: 60, category: "气泡饮料", color: "rgba(224, 242, 254, 0.25)", isBubbly: true },
          { name: "柠檬汁 Lemon Squeeze", amount: 10, category: "辅料", color: "rgba(234, 179, 8, 0.7)" }
        ],
        mixMethod: "Stir",
        comments: "【果酸钝化】龙舌兰狂野的泥土味让许多新手退避三舍。我们通过调低龙舌兰比例，倾入饱满的鲜橙汁和微酸柠檬汁进行有机酸缓释，再加注清爽苏打水。杯口只需抹上极其薄微的细盐，苏打气泡带起的甜橙芬芳能在舌尖温和抚平酒精燥热，咸酸清爽！",
        tags: ["便利搭配", "酸甜鲜橙", "清爽低辣"],
        rating: { sweet: 4, acid: 3, strength: 2, creamy: 1, herbal: 2, bubbly: 3, freshness: 4, heaviness: 2 }
      }
    },
    whisky_sour: {
      id: "whisky_sour",
      chineseName: "经典威士忌酸 Whisky Sour",
      name: "Whisky Sour",
      desc: "正统威士忌酸具有穿透性的高酸度和浓烈的泥煤/谷物酒精气，且传统配方里常加入“生蛋白”进行高频摇荡以产生质感，有些新手对生蛋清抱有生腥恐惧阴影。",
      ingredients: [
        { name: "威士忌 Whiskey", amount: 45, category: "基酒", color: "rgba(217, 119, 6, 0.45)" },
        { name: "柠檬汁 Lemon Juice", amount: 30, category: "果汁", color: "rgba(253, 224, 71, 0.55)" },
        { name: "白糖浆 Syrup", amount: 15, category: "辅料", color: "rgba(255, 255, 255, 0.7)" }
      ],
      rating: { sweet: 3, acid: 4, strength: 3, creamy: 2, herbal: 2, bubbly: 1, freshness: 3, heaviness: 3 },
      defaultImproved: {
        chineseName: "微醺红茶柠檬威士忌 (Tea Whiskey Sour)",
        name: "Tea Whiskey Sour",
        ingredients: [
          { name: "威士忌 Whiskey", amount: 25, category: "基酒", color: "rgba(217, 119, 6, 0.35)" },
          { name: "柠檬冰红茶 Lemon Black Tea", amount: 120, category: "茶饮", color: "rgba(146, 64, 14, 0.4)" },
          { name: "柠檬汁 Lemon Squeeze", amount: 10, category: "辅料", color: "rgba(234, 179, 8, 0.7)" }
        ],
        mixMethod: "Shake",
        comments: "【多酚聚合】我们果断剥离了让人生畏的生蛋白，转而引入冰红茶中的茶多酚。柠檬冰红茶天然融合了茶涩与酸甜糖水分子。高频Shake震荡后，茶多酚和微量皂苷会自发乳化，产生极其细腻的、媲美蛋白的柔和气泡，让威士忌在温润茶香中滑入咽喉！",
        tags: ["红茶乳化", "零生腥感", "温和酸甜"],
        rating: { sweet: 4, acid: 3, strength: 2, creamy: 1, herbal: 2, bubbly: 1, freshness: 4, heaviness: 2 }
      }
    },
    moscow_mule: {
      id: "moscow_mule",
      chineseName: "莫斯科骡子 Moscow Mule",
      name: "Moscow Mule",
      desc: "莫斯科骡子极度依赖带有强烈辛辣、热辣生姜味的“姜汁啤酒（Ginger Beer）”，如果不习惯这股热性的植物辣度，饮用时会觉得像在喝辣喉咙的生姜汤。",
      ingredients: [
        { name: "伏特加 Vodka", amount: 45, category: "基酒", color: "rgba(186, 230, 253, 0.35)" },
        { name: "青柠汁 Lime Juice", amount: 15, category: "果汁", color: "rgba(132, 204, 22, 0.5)" },
        { name: "姜汁啤酒 Ginger Beer", amount: 120, category: "辅料", color: "rgba(217, 119, 6, 0.25)", isBubbly: true }
      ],
      rating: { sweet: 3, acid: 3, strength: 3, creamy: 1, herbal: 3, bubbly: 4, freshness: 4, heaviness: 2 },
      defaultImproved: {
        chineseName: "苹果西打温润骡子 (Apple Cider Mule)",
        name: "Apple Cider Mule",
        ingredients: [
          { name: "伏特加 Vodka", amount: 30, category: "基酒", color: "rgba(186, 230, 253, 0.25)" },
          { name: "苹果西打气泡水 Apple Cider", amount: 120, category: "气泡饮料", color: "rgba(253, 186, 116, 0.45)", isBubbly: true },
          { name: "柠檬汁 Lemon Squeeze", amount: 10, category: "辅料", color: "rgba(234, 179, 8, 0.7)" }
        ],
        mixMethod: "Stir",
        comments: "【基质重组】为了祛除让许多新手难受的辛辣姜气，我们将生姜啤酒完美替换成了甜爽怡人的苹果西打碳酸饮料。西打中清脆饱满的苹果酯类与伏特加的纯净质感，加上柠檬酸味的点缀，在冰块的冰释下带来了活泼、气泡充盈却绝不辛辣的完美果香体验！",
        tags: ["零姜辣感", "苹果西打", "果香气泡"],
        rating: { sweet: 4, acid: 3, strength: 2, creamy: 1, herbal: 1, bubbly: 4, freshness: 5, heaviness: 1 }
      }
    },
    long_island: {
      id: "long_island",
      chineseName: "长岛冰茶 Long Island Iced Tea",
      name: "Long Island Iced Tea",
      desc: "配方中混杂了五种高浓度烈酒，虽然加入了可乐和柠檬汁伪装成红茶色，但其实酒精极重，是著名的“失身酒/小白杀手”，极易让人不知不觉喝醉宿醉。",
      ingredients: [
        { name: "伏特加 Vodka", amount: 15, category: "基酒", color: "rgba(186, 230, 253, 0.35)" },
        { name: "金酒 Gin", amount: 15, category: "基酒", color: "rgba(148, 163, 184, 0.35)" },
        { name: "白朗姆 Rum", amount: 15, category: "基酒", color: "rgba(180, 83, 9, 0.25)" },
        { name: "龙舌兰 Tequila", amount: 15, category: "基酒", color: "rgba(217, 119, 6, 0.25)" },
        { name: "橙皮酒 Triple Sec", amount: 15, category: "辅料", color: "rgba(253, 186, 116, 0.4)" },
        { name: "可乐 Cola", amount: 60, category: "气泡饮料", color: "rgba(69, 26, 3, 0.6)", isBubbly: true }
      ],
      rating: { sweet: 3, acid: 3, strength: 5, creamy: 1, herbal: 2, bubbly: 3, freshness: 2, heaviness: 4 },
      defaultImproved: {
        chineseName: "无痛长岛柠檬冰红茶 (Pain-Free Long Island)",
        name: "Pain-Free Long Island",
        ingredients: [
          { name: "伏特加 Vodka", amount: 15, category: "基酒", color: "rgba(186, 230, 253, 0.25)" },
          { name: "橙皮酒 Triple Sec", amount: 10, category: "辅料", color: "rgba(253, 186, 116, 0.3)" },
          { name: "冰红茶 Black Tea", amount: 90, category: "茶饮", color: "rgba(146, 64, 14, 0.4)" },
          { name: "雪碧 Sprite", amount: 80, category: "气泡饮料", color: "rgba(209, 250, 229, 0.25)", isBubbly: true }
        ],
        mixMethod: "Stir",
        comments: "【分子解聚】我们果断剥离了金酒、龙舌兰和朗姆酒，将杂合的多基烈性物缩减至仅保留纯净温和的伏特加。配合香甜的雪碧和柔和的红茶，创造出真正好入口、绝不头痛的轻盈“冰茶”，风味清甜、温和不辣！",
        tags: ["降低杂醇", "红茶清爽", "安全轻盈"],
        rating: { sweet: 4, acid: 2, strength: 2, creamy: 1, herbal: 1, bubbly: 3, freshness: 5, heaviness: 1 }
      }
    },
    daiquiri: {
      id: "daiquiri",
      chineseName: "戴克里 Daiquiri",
      name: "Daiquiri",
      desc: "纯朗姆酒搭配清酸柠檬汁，没有任何多余辅料。这杯酒极其酸烈干脆，如果基酒品质不高或比例稍有不对，就会产生极其刺鼻、酸涩冲喉的感觉。",
      ingredients: [
        { name: "白朗姆 Rum", amount: 45, category: "基酒", color: "rgba(180, 83, 9, 0.35)" },
        { name: "青柠汁 Lime Juice", amount: 20, category: "果汁", color: "rgba(132, 204, 22, 0.5)" },
        { name: "白糖浆 Syrup", amount: 15, category: "辅料", color: "rgba(255, 255, 255, 0.7)" }
      ],
      rating: { sweet: 2, acid: 5, strength: 4, creamy: 1, herbal: 1, bubbly: 1, freshness: 4, heaviness: 2 },
      defaultImproved: {
        chineseName: "便利店草莓甜心戴克里 (Strawberry Jam Daiquiri)",
        name: "Strawberry Jam Daiquiri",
        ingredients: [
          { name: "白朗姆 Rum", amount: 25, category: "基酒", color: "rgba(180, 83, 9, 0.25)" },
          { name: "草莓乳酸菌/草莓汁 Strawberry Drink", amount: 120, category: "乳酸饮料", color: "rgba(251, 113, 133, 0.5)" },
          { name: "苏打气泡水 Soda Water", amount: 60, category: "气泡饮料", color: "rgba(224, 242, 254, 0.25)", isBubbly: true }
        ],
        mixMethod: "Shake",
        comments: "【糖链络合】原版的尖锐酸感在草莓果酸和乳酸菌的糖类络合下被完全钝化。朗姆酒特有的甘蔗香在草莓乳酸菌的烘托下，形成类似热带甜美奶昔的口感，辅以苏打气泡，爽口清凉，甜美度拉满！",
        tags: ["草莓果香", "酸甜滑顺", "无痛饮用"],
        rating: { sweet: 4, acid: 3, strength: 2, creamy: 3, herbal: 1, bubbly: 2, freshness: 4, heaviness: 2 }
      }
    },
    bloody_mary: {
      id: "bloody_mary",
      chineseName: "血玛丽 Bloody Mary",
      name: "Bloody Mary",
      desc: "加入了番茄汁、胡椒粉、盐、塔巴斯科辣酱甚至芹菜梗。喝起来口感浓稠、咸辣、微腥，被称为“液体冷番茄汤配酒精”，极少有新手能够第一次就接受它。",
      ingredients: [
        { name: "伏特加 Vodka", amount: 45, category: "基酒", color: "rgba(186, 230, 253, 0.35)" },
        { name: "番茄汁 Tomato Juice", amount: 90, category: "果汁", color: "rgba(239, 68, 68, 0.75)" },
        { name: "柠檬汁 Lemon Juice", amount: 15, category: "果汁", color: "rgba(234, 179, 8, 0.7)" },
        { name: "香辛料/辣酱 Spices", amount: 5, category: "辅料", color: "rgba(127, 29, 29, 0.85)" }
      ],
      rating: { sweet: 1, acid: 4, strength: 3, creamy: 1, herbal: 3, bubbly: 1, freshness: 1, heaviness: 5 },
      defaultImproved: {
        chineseName: "番茄海风鲜起泡 (Spiced Tomato Sea Breeze)",
        name: "Spiced Tomato Sea Breeze",
        ingredients: [
          { name: "伏特加 Vodka", amount: 20, category: "基酒", color: "rgba(186, 230, 253, 0.25)" },
          { name: "纯番茄汁 Tomato Juice", amount: 40, category: "果汁", color: "rgba(239, 68, 68, 0.5)" },
          { name: "西柚汁/橙汁 Orange Juice", amount: 60, category: "果汁", color: "rgba(249, 115, 22, 0.6)" },
          { name: "苏打气泡水 Soda Water", amount: 80, category: "气泡饮料", color: "rgba(224, 242, 254, 0.25)", isBubbly: true }
        ],
        mixMethod: "Stir",
        comments: "【感官重塑】我们完全剔除了辛辣的辣椒酱和胡椒，将番茄的生咸腥味用饱满的新新鲜橙汁/西柚汁进行了甜度缓冲。注入了激爽的气泡苏打水，使其从沉重的“汤感”转变为气泡清爽、酸甜可口的海风果香起泡酒，好喝百倍！",
        tags: ["番茄果香", "气泡清凉", "去除咸辣"],
        rating: { sweet: 3, acid: 3, strength: 2, creamy: 1, herbal: 1, bubbly: 3, freshness: 4, heaviness: 2 }
      }
    },
    manhattan: {
      id: "manhattan",
      chineseName: "曼哈顿 Manhattan",
      name: "Manhattan",
      desc: "高酒精度的裸麦威士忌配上药本草本的红美意与重苦的苦精。酒体非常辛辣厚重，带有一股古怪的草药苦甜味，新手入口宛如在喝烈性中药。",
      ingredients: [
        { name: "黑麦威士忌 Whiskey", amount: 50, category: "基酒", color: "rgba(180, 83, 9, 0.45)" },
        { name: "红味美思 Sweet Vermouth", amount: 20, category: "辅料", color: "rgba(127, 29, 29, 0.65)" },
        { name: "安高天娜苦精 Bitters", amount: 2, category: "辅料", color: "rgba(120, 53, 4, 0.8)" }
      ],
      rating: { sweet: 2, acid: 1, strength: 5, creamy: 1, herbal: 4, bubbly: 1, freshness: 1, heaviness: 5 },
      defaultImproved: {
        chineseName: "秋日苹果肉桂曼哈顿 (Apple Cinnamon Manhattan)",
        name: "Apple Cinnamon Manhattan",
        ingredients: [
          { name: "黑麦威士忌 Whiskey", amount: 25, category: "基酒", color: "rgba(180, 83, 9, 0.35)" },
          { name: "苹果西打气泡水 Apple Cider", amount: 100, category: "气泡饮料", color: "rgba(253, 186, 116, 0.45)", isBubbly: true },
          { name: "红茶/柠檬红茶 Black Tea", amount: 40, category: "茶饮", color: "rgba(146, 64, 14, 0.4)" }
        ],
        mixMethod: "Stir",
        comments: "【木质中和】威士忌的辛辣橡木味，与苹果西打中的果香苹果酯极其契合。我们移除了高药理感的味美思，加注苹果西打与红茶，让木质香气与自然苹果酸甜浑然一体，在极低酒感中散发温暖肉桂般的果木醇香！",
        tags: ["苹果醇香", "去药本苦", "温润木质"],
        rating: { sweet: 4, acid: 2, strength: 2, creamy: 1, herbal: 1, bubbly: 3, freshness: 4, heaviness: 2 }
      }
    },
    espresso_martini: {
      id: "espresso_martini",
      chineseName: "浓缩咖啡马天尼 Espresso Martini",
      name: "Espresso Martini",
      desc: "浓缩咖啡本身的重度焦苦，加上纯伏特加与咖啡利口酒的高浓度酒精。整杯酒虽然香气浓烈，但入口的苦涩和浓烈的酒精烈度会让不习惯黑咖啡的新手感到难以下咽。",
      ingredients: [
        { name: "伏特加 Vodka", amount: 45, category: "基酒", color: "rgba(186, 230, 253, 0.35)" },
        { name: "浓缩咖啡 Espresso", amount: 30, category: "辅料", color: "rgba(40, 20, 10, 0.85)" },
        { name: "甘露咖啡酒 Kahlúa", amount: 20, category: "辅料", color: "rgba(60, 30, 15, 0.8)" }
      ],
      rating: { sweet: 2, acid: 2, strength: 4, creamy: 1, herbal: 2, bubbly: 1, freshness: 1, heaviness: 4 },
      defaultImproved: {
        chineseName: "微醺燕麦拿铁马天尼 (Oat Latte Espresso Martini)",
        name: "Oat Latte Espresso Martini",
        ingredients: [
          { name: "甘露咖啡酒 Kahlúa", amount: 20, category: "辅料", color: "rgba(60, 30, 15, 0.6)" },
          { name: "燕麦奶 Oat Milk", amount: 100, category: "乳酸饮料", color: "rgba(245, 245, 244, 0.9)" },
          { name: "伏特加 Vodka", amount: 15, category: "基酒", color: "rgba(186, 230, 253, 0.25)" }
        ],
        mixMethod: "Shake",
        comments: "【脂质悬浮】黑咖啡的焦苦主要来自烘焙酸与单宁分子。我们引入了富含膳食纤维与细腻不饱和脂肪酸的燕麦奶，将苦味分子紧紧包裹，使口感犹如丝绸般滑顺。伏特加的烈性在浓郁的谷物乳香中被温和融解，变为一杯香甜、浓郁的微醺拿铁！",
        tags: ["燕麦乳香", "咖啡醇厚", "零焦苦感"],
        rating: { sweet: 4, acid: 1, strength: 2, creamy: 4, herbal: 1, bubbly: 1, freshness: 3, heaviness: 4 }
      }
    },
    pina_colada: {
      id: "pina_colada",
      chineseName: "椰林飘香 Piña Colada",
      name: "Piña Colada",
      desc: "传统的椰林飘香加入椰浆和浓缩凤梨汁，重油重甜，喝多了会产生极其腻口的感觉，且极易因椰浆油脂析出而破坏平滑度。",
      ingredients: [
        { name: "白朗姆 Rum", amount: 50, category: "基酒", color: "rgba(180, 83, 9, 0.35)" },
        { name: "椰浆 Coconut Cream", amount: 30, category: "辅料", color: "rgba(255, 255, 255, 0.95)" },
        { name: "凤梨汁 Pineapple Juice", amount: 90, category: "果汁", color: "rgba(253, 224, 71, 0.6)" }
      ],
      rating: { sweet: 4, acid: 3, strength: 3, creamy: 4, herbal: 1, bubbly: 1, freshness: 2, heaviness: 4 },
      defaultImproved: {
        chineseName: "清爽椰子气泡椰林飘香 (Light Coconut Breeze)",
        name: "Light Coconut Breeze",
        ingredients: [
          { name: "白朗姆 Rum", amount: 20, category: "基酒", color: "rgba(180, 83, 9, 0.25)" },
          { name: "椰子水 Coconut Water", amount: 100, category: "茶饮", color: "rgba(240, 249, 255, 0.4)" },
          { name: "凤梨果汁 Pineapple Juice", amount: 40, category: "果汁", color: "rgba(253, 224, 71, 0.5)" },
          { name: "苏打气泡水 Soda Water", amount: 40, category: "气泡饮料", color: "rgba(224, 242, 254, 0.25)", isBubbly: true }
        ],
        mixMethod: "Stir",
        comments: "【无脂澄清】我们用清甜低卡的天然“椰子水”彻底替换了重油厚腻的传统“精制椰浆”，保留天然清香的同时消除了沉重油脂。混入酸甜凤梨汁并注入苏打水，极大地拉长了酒体，让整杯酒变得极其清透、气泡充盈、椰香四溢，极其消暑！",
        tags: ["椰子清甜", "零油腻感", "热带起泡"],
        rating: { sweet: 3, acid: 3, strength: 2, creamy: 1, herbal: 1, bubbly: 3, freshness: 5, heaviness: 1 }
      }
    }
  };

  const selectedClassic = classicDatabase[cocktailId];
  if (!selectedClassic) {
    return res.status(404).json({ error: "Classic cocktail not found." });
  }

  const ai = getGeminiClient();
  if (!ai) {
    console.log("No GEMINI_API_KEY configured for Classic Improve. Returning pre-optimized fallback.");
    
    // We can tweak our fallback slightly based on selected directions to make it feel highly responsive!
    let customized = JSON.parse(JSON.stringify(selectedClassic.defaultImproved));
    if (directions.length > 0) {
      if (directions.includes("less_alcohol")) {
        customized.ingredients = customized.ingredients.map((ing: any) => {
          if (ing.category === "基酒") {
            return { ...ing, amount: Math.max(15, Math.round(ing.amount * 0.7)) };
          }
          if (ing.category === "气泡饮料" || ing.category === "果汁" || ing.category === "茶饮") {
            return { ...ing, amount: Math.min(180, ing.amount + 15) };
          }
          return ing;
        });
        customized.rating.strength = Math.max(1, customized.rating.strength - 1);
        customized.rating.freshness = Math.min(5, customized.rating.freshness + 1);
        customized.comments += "（由于您指定了‘降低酒感’，本分子方案已极尽克制地将基酒稀释，提升了气泡非极性溶剂的占比，最大化保障饮用安全和温和感。）";
        customized.tags.push("极低度");
      }
      if (directions.includes("sweeter")) {
        customized.rating.sweet = Math.min(5, customized.rating.sweet + 1);
        customized.comments += "（应您‘甜一点’的需求，配方糖链层析点位经过了额外饱和优化。）";
        customized.tags.push("甜度增强");
      }
      if (directions.includes("fresher")) {
        customized.rating.freshness = Math.min(5, customized.rating.freshness + 1);
        customized.tags.push("加倍沁凉");
      }
    }

    return res.json({
      classic: {
        chineseName: selectedClassic.chineseName,
        name: selectedClassic.name,
        desc: selectedClassic.desc,
        ingredients: selectedClassic.ingredients,
        rating: selectedClassic.rating
      },
      improved: customized
    });
  }

  try {
    const directionsString = directions.length > 0 
      ? directions.map((d: string) => `- ${d}`).join("\n")
      : "- beginner_friendly (适合新手)\n- less_alcohol (低酒感/温和)";

    const prompt = `You are the Lead Flavor Architect at AlcheMix Lab, specializing in "classic cocktail domestication" (经典酒小白驯化). 
The user wants to improve the classic cocktail "${selectedClassic.chineseName}" (${selectedClassic.name}) because it is intimidating or unfriendly.
Here is the original profile:
- Description of why it's harsh: "${selectedClassic.desc}"
- Original ingredients: ${JSON.stringify(selectedClassic.ingredients)}
- Original 8-dimensional flavor rating: ${JSON.stringify(selectedClassic.rating)}

The user selected these improvement directions:
${directionsString}

Your goal is to formulate an improved version that retains the soul of the classic, but modifies it scientifically to make it extremely delicious and accessible for beginners. You can use standard ingredients or convenient supermarket/store ingredients (e.g., Sprite, milk drinks, juice, soda, tea) to dilute or balance the hard elements.

Generate a JSON object containing:
- classic: {
    chineseName: "${selectedClassic.chineseName}",
    name: "${selectedClassic.name}",
    desc: "${selectedClassic.desc}",
    ingredients: ${JSON.stringify(selectedClassic.ingredients)},
    rating: ${JSON.stringify(selectedClassic.rating)}
  }
- improved: {
    chineseName: A smart, creative improved Chinese name (e.g., "新手版内格罗尼 Spritz", "蜜桃古典老式嗨棒")
    name: A stylish improved English name
    ingredients: Array of ingredients, each containing { name: string, amount: number (in ml, usually multiples of 5, sum of ingredients must be <= 350ml), category: string (one of: '基酒', '茶饮', '乳酸饮料', '气泡饮料', '果汁', '辅料'), color: string (rgba or solid), isBubbly: boolean (optional) }
    mixMethod: either "Stir" or "Shake"
    comments: 3-4 sentences in friendly Chinese explaining: (1) what exact modifications you made (e.g. lowering gin, adding soda, replacing bitters), (2) the molecular or flavor synergy reason why this fixes the classic's pain points, (3) why it is beginner-friendly. Keep it engaging and "sciency"!
    tags: Array of 3 snazzy Chinese tag strings (e.g., ["降低苦度", "橙香气泡", "新手上口"])
    rating: An object of 8-dimensional ratings (integer 1 to 5) for this IMPROVED version:
      - sweet: Sweetness level
      - acid: Acidity level
      - strength: Alcohol intensity (should be lower, usually 1 to 3)
      - creamy: Creaminess/dairy/yakult level (1 if none)
      - herbal: Botanical/tea complexity level
      - bubbly: Carbonation/fizz level
      - freshness: Lightness/crispness level
      - heaviness: Richness/viscosity level
  }

Make sure the total improved volume does not exceed 350ml, so it fits perfectly in our lab's 350ml beaker.
Your response MUST be strict valid JSON matching this schema exactly.`;

    const response = await retryWithBackoff(() => ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            classic: {
              type: Type.OBJECT,
              properties: {
                chineseName: { type: Type.STRING },
                name: { type: Type.STRING },
                desc: { type: Type.STRING },
                ingredients: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      amount: { type: Type.INTEGER },
                      category: { type: Type.STRING },
                      color: { type: Type.STRING }
                    },
                    required: ["name", "amount", "category", "color"]
                  }
                },
                rating: {
                  type: Type.OBJECT,
                  properties: {
                    sweet: { type: Type.INTEGER },
                    acid: { type: Type.INTEGER },
                    strength: { type: Type.INTEGER },
                    creamy: { type: Type.INTEGER },
                    herbal: { type: Type.INTEGER },
                    bubbly: { type: Type.INTEGER },
                    freshness: { type: Type.INTEGER },
                    heaviness: { type: Type.INTEGER }
                  },
                  required: ["sweet", "acid", "strength", "creamy", "herbal", "bubbly", "freshness", "heaviness"]
                }
              },
              required: ["chineseName", "name", "desc", "ingredients", "rating"]
            },
            improved: {
              type: Type.OBJECT,
              properties: {
                chineseName: { type: Type.STRING },
                name: { type: Type.STRING },
                ingredients: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      amount: { type: Type.INTEGER },
                      category: { type: Type.STRING },
                      color: { type: Type.STRING },
                      isBubbly: { type: Type.BOOLEAN }
                    },
                    required: ["name", "amount", "category", "color"]
                  }
                },
                mixMethod: { type: Type.STRING },
                comments: { type: Type.STRING },
                tags: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                rating: {
                  type: Type.OBJECT,
                  properties: {
                    sweet: { type: Type.INTEGER },
                    acid: { type: Type.INTEGER },
                    strength: { type: Type.INTEGER },
                    creamy: { type: Type.INTEGER },
                    herbal: { type: Type.INTEGER },
                    bubbly: { type: Type.INTEGER },
                    freshness: { type: Type.INTEGER },
                    heaviness: { type: Type.INTEGER }
                  },
                  required: ["sweet", "acid", "strength", "creamy", "herbal", "bubbly", "freshness", "heaviness"]
                }
              },
              required: ["chineseName", "name", "ingredients", "mixMethod", "comments", "tags", "rating"]
            }
          },
          required: ["classic", "improved"]
        }
      }
    }));

    const jsonText = response.text?.trim() || "";
    const result = JSON.parse(jsonText);
    res.json(result);
  } catch (error: any) {
    console.error("Gemini Classic Improve Error:", error);
    res.json({
      classic: {
        chineseName: selectedClassic.chineseName,
        name: selectedClassic.name,
        desc: selectedClassic.desc,
        ingredients: selectedClassic.ingredients,
        rating: selectedClassic.rating
      },
      improved: selectedClassic.defaultImproved
    });
  }
});

// 3. POST /api/generate-tip - Dynamic Tip Generator
app.post("/api/generate-tip", async (req, res) => {
  const { problem } = req.body;

  if (!problem) {
    return res.status(400).json({ error: "Problem description is required." });
  }

  const ai = getGeminiClient();
  if (!ai) {
    return res.json({
      title: `${problem} 科学急救`,
      content: "由于缺少 AI 密钥，这里是一条通用建议：试探性加入少量酸味因子（如青柠汁）或高碳酸苏打水，进行分子浓度的稀释和味觉中和。",
      icon: "science",
    });
  }

  try {
    const prompt = `You are a molecular cocktail rescue specialist. The user has a problem: "${problem}" with their drink.
Formulate a scientifically precise yet simple "emergency rescue tip" (翻车急救) in Chinese.
Give it a short, snappy title (e.g., "高浓度糖分稀释法"), and a 1-sentence actionable explanation of the scientific workaround.
Select a Material Design symbol icon name for it from: 'science', 'water_drop', 'warning', 'ac_unit', 'local_fire_department'.

Your output must be JSON with:
- title: Snap Chinese title (e.g., "酸度分子缓冲法")
- content: 1-sentence scientific and easy explanation (in Chinese)
- icon: string (one of the allowed icon names)`;

    const response = await retryWithBackoff(() => ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING },
            icon: { type: Type.STRING },
          },
          required: ["title", "content", "icon"],
        },
      },
    }));

    const result = JSON.parse(response.text?.trim() || "{}");
    res.json(result);
  } catch (e) {
    res.json({
      title: `${problem} 急救指南`,
      content: "加入适量纯净冰块，降低酒体温度可有效钝化舌头对过度甜味或酒精感的敏感度。",
      icon: "ac_unit",
    });
  }
});

// Start Vite / Static serving
async function main() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
  });
}

main();
