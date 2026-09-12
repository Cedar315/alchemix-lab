import { classify, GuideDrink } from "../lib/recommendations/beginner";
import Image from "next/image";
import React, { useMemo, useState, useEffect } from "react";
import { DrinkLog, DrinkLogRecipeSnapshot, MixTip } from "../types";
import { INSPIRATION_RECIPES, RecipeSeed } from "../lib/data/inspiration-catalog";
import { trackAnalyticsEvent } from "../lib/analytics";
import { DrinkLogButton } from "./DrinkLog";
import { 
  Sparkles, 
  Flame, 
  Compass, 
  Wine, 
  HelpCircle, 
  Info, 
  ArrowRight, 
  TrendingDown, 
  Heart, 
  Smile, 
  Coffee, 
  Store, 
  Database,
  BookOpen,
  Search,
  Sparkle,
  Droplets,
  Zap,
  Activity,
  Maximize2
} from "lucide-react";

type InspirationView = "menu" | "classic-remix" | "convenience-mix" | "flavor" | "beginner" | "knowledge";

interface InspirationScreenProps {
  guided?: boolean;
  onBackGuide?: () => void;
  tips: MixTip[];
  onAddTip: (tip: MixTip) => void;
  onSaveCocktail?: (cocktail: any) => void;
  drinkLogs?: DrinkLog[];
  onSaveDrinkLog?: (log: DrinkLog) => void;
  onLoadToLab?: (ingredients: any[], mixMethod: "Stir" | "Shake") => void;
  initialView?: InspirationView;
  initialCocktailId?: string;
  initialExploreTab?: ExploreTab;
}

interface ClassicCocktailData {
  id: string;
  name: string;
  english: string;
  icon: string;
  desc: string;
  themeColor: string;
  rating: {
    bitter: number;
    alcohol: number;
    fresh: number;
    sweet: number;
  };
  ingredients: {
    name: string;
    amount: number;
    category: string;
    color: string;
  }[];
}

const CLASSIC_DATABASE: Record<string, ClassicCocktailData> = {
  negroni: {
    id: "negroni",
    name: "内格罗尼",
    english: "Negroni",
    icon: "🍷",
    desc: "经典内格罗尼由金酒、金巴利和红味美思等比调制。金巴利（Campari）带来极重草本药苦，伴随金酒的高酒精感，对新手而言像“深红苦药水”。",
    themeColor: "from-red-500/10 to-rose-600/10",
    rating: { bitter: 5, alcohol: 4, fresh: 2, sweet: 2 },
    ingredients: [
      { name: "金酒 Gin", amount: 30, category: "基酒", color: "rgba(148, 163, 184, 0.45)" },
      { name: "金巴利 Campari", amount: 30, category: "辅料", color: "rgba(220, 38, 38, 0.65)" },
      { name: "甜味美思 Sweet Vermouth", amount: 30, category: "辅料", color: "rgba(127, 29, 29, 0.7)" }
    ]
  },
  old_fashioned: {
    id: "old_fashioned",
    name: "古典老式",
    english: "Old Fashioned",
    icon: "🥃",
    desc: "传统威士忌骨架，糖块与苦精点缀。近40度的酒精刺激感及谷物辛辣，新手饮用时容易感觉“喉咙火烧”。",
    themeColor: "from-amber-500/10 to-orange-600/10",
    rating: { bitter: 3, alcohol: 5, fresh: 1, sweet: 2 },
    ingredients: [
      { name: "威士忌 Whiskey", amount: 60, category: "基酒", color: "rgba(217, 119, 6, 0.45)" },
      { name: "白糖块 Sugar", amount: 5, category: "辅料", color: "rgba(255, 255, 255, 0.9)" },
      { name: "安高天娜苦精 Bitters", amount: 2, category: "辅料", color: "rgba(120, 53, 4, 0.8)" }
    ]
  },
  martini: {
    id: "martini",
    name: "经典马丁",
    english: "Martini",
    icon: "🍸",
    desc: "被称为“鸡尾酒之王”，由大量金酒和干味美思调配。口感高冷干烈，毫无甜味，酒精辣感强。",
    themeColor: "from-slate-400/10 to-zinc-500/10",
    rating: { bitter: 2, alcohol: 5, fresh: 2, sweet: 1 },
    ingredients: [
      { name: "金酒 Gin", amount: 60, category: "基酒", color: "rgba(148, 163, 184, 0.4)" },
      { name: "干味美思 Dry Vermouth", amount: 10, category: "辅料", color: "rgba(241, 245, 249, 0.35)" }
    ]
  },
  manhattan: {
    id: "manhattan",
    name: "曼哈顿",
    english: "Manhattan",
    icon: "🍷",
    desc: "黑麦威士忌与红味美思。厚重的威士忌底蕴伴随着药草香和烈性苦甜，口感辛辣偏热，对小白不友好。",
    themeColor: "from-rose-900/10 to-red-950/10",
    rating: { bitter: 4, alcohol: 5, fresh: 1, sweet: 2 },
    ingredients: [
      { name: "黑麦威士忌 Whiskey", amount: 50, category: "基酒", color: "rgba(180, 83, 9, 0.45)" },
      { name: "红味美思 Sweet Vermouth", amount: 20, category: "辅料", color: "rgba(127, 29, 29, 0.65)" },
      { name: "安高天娜苦精 Bitters", amount: 2, category: "辅料", color: "rgba(120, 53, 4, 0.8)" }
    ]
  },
  gin_tonic: {
    id: "gin_tonic",
    name: "经典金汤力",
    english: "Gin Tonic",
    icon: "🍹",
    desc: "经典消暑长饮。汤力水中的奎宁（Quinine）成分带来明显的药本植物涩苦感，搭配酒精让人不悦。",
    themeColor: "from-cyan-400/10 to-blue-500/10",
    rating: { bitter: 4, alcohol: 3, fresh: 4, sweet: 2 },
    ingredients: [
      { name: "金酒 Gin", amount: 45, category: "基酒", color: "rgba(148, 163, 184, 0.45)" },
      { name: "汤力水 Tonic", amount: 120, category: "辅料", color: "rgba(239, 246, 255, 0.3)" }
    ]
  },
  mojito: {
    id: "mojito",
    name: "经典莫吉托",
    english: "Mojito",
    icon: "🌿",
    desc: "清凉的薄荷古巴特调。如果薄荷叶过度捶打会释出浓重草腥和单宁苦；朗姆酒比例不当则酒精感过重。",
    themeColor: "from-emerald-400/10 to-green-500/10",
    rating: { bitter: 2, alcohol: 3, fresh: 5, sweet: 3 },
    ingredients: [
      { name: "白朗姆 Rum", amount: 45, category: "基酒", color: "rgba(180, 83, 9, 0.35)" },
      { name: "青柠汁 Lime Juice", amount: 20, category: "果汁", color: "rgba(132, 204, 22, 0.5)" },
      { name: "白砂糖 Sugar", amount: 15, category: "辅料", color: "rgba(255, 255, 255, 0.9)" },
      { name: "苏打水 Soda", amount: 60, category: "气泡饮料", color: "rgba(224, 242, 254, 0.25)" }
    ]
  },
  margarita: {
    id: "margarita",
    name: "玛格丽特",
    english: "Margarita",
    icon: "🧂",
    desc: "以龙舌兰为基底，搭配青柠汁与橙皮利口酒。龙舌兰特有的野性泥土风味强烈，且盐边容易造成咸酸咸涩冲击。",
    themeColor: "from-lime-400/10 to-yellow-500/10",
    rating: { bitter: 2, alcohol: 4, fresh: 3, sweet: 2 },
    ingredients: [
      { name: "龙舌兰 Tequila", amount: 45, category: "基酒", color: "rgba(217, 119, 6, 0.3)" },
      { name: "橙味利口酒 Triple Sec", amount: 20, category: "辅料", color: "rgba(253, 186, 116, 0.4)" },
      { name: "青柠汁 Lime Juice", amount: 15, category: "果汁", color: "rgba(132, 204, 22, 0.5)" }
    ]
  },
  whisky_sour: {
    id: "whisky_sour",
    name: "威士忌酸",
    english: "Whisky Sour",
    icon: "🍋",
    desc: "传统威士忌酸使用生蛋清通过强烈摇荡（Shake）增加绵密质感，对不吃生蛋或蛋腥敏感者是极大心理障碍。",
    themeColor: "from-yellow-400/10 to-amber-500/10",
    rating: { bitter: 1, alcohol: 3, fresh: 3, sweet: 3 },
    ingredients: [
      { name: "威士忌 Whiskey", amount: 45, category: "基酒", color: "rgba(217, 119, 6, 0.45)" },
      { name: "柠檬汁 Lemon Juice", amount: 30, category: "果汁", color: "rgba(253, 224, 71, 0.55)" },
      { name: "白糖浆 Syrup", amount: 15, category: "辅料", color: "rgba(255, 255, 255, 0.7)" }
    ]
  },
  moscow_mule: {
    id: "moscow_mule",
    name: "莫斯科骡子",
    english: "Moscow Mule",
    icon: "🫚",
    desc: "铜杯清凉解暑饮品。由于姜汁啤酒（Ginger Beer）天然的热辣辛辣生姜味极重，入口像“带气泡的辛辣姜汤”。",
    themeColor: "from-amber-600/10 to-amber-700/10",
    rating: { bitter: 2, alcohol: 3, fresh: 4, sweet: 3 },
    ingredients: [
      { name: "伏特加 Vodka", amount: 45, category: "基酒", color: "rgba(186, 230, 253, 0.35)" },
      { name: "青柠汁 Lime Juice", amount: 15, category: "果汁", color: "rgba(132, 204, 22, 0.5)" },
      { name: "姜汁啤酒 Ginger Beer", amount: 120, category: "辅料", color: "rgba(217, 119, 6, 0.25)" }
    ]
  },
  long_island: {
    id: "long_island",
    name: "长岛冰茶",
    english: "Long Island Iced Tea",
    icon: "🍹",
    desc: "混杂了伏特加、金酒、朗姆、龙舌兰等5种烈性酒，高醇混合。虽甜口，但后劲极强，容易瞬间断片。",
    themeColor: "from-yellow-600/10 to-amber-800/10",
    rating: { bitter: 2, alcohol: 5, fresh: 2, sweet: 3 },
    ingredients: [
      { name: "伏特加 Vodka", amount: 15, category: "基酒", color: "rgba(186, 230, 253, 0.35)" },
      { name: "金酒 Gin", amount: 15, category: "基酒", color: "rgba(148, 163, 184, 0.35)" },
      { name: "白朗姆 Rum", amount: 15, category: "基酒", color: "rgba(180, 83, 9, 0.25)" },
      { name: "龙舌兰 Tequila", amount: 15, category: "基酒", color: "rgba(217, 119, 6, 0.25)" },
      { name: "橙皮酒 Triple Sec", amount: 15, category: "辅料", color: "rgba(253, 186, 116, 0.4)" },
      { name: "可乐 Cola", amount: 60, category: "气泡饮料", color: "rgba(69, 26, 3, 0.6)" }
    ]
  },
  daiquiri: {
    id: "daiquiri",
    name: "戴克里",
    english: "Daiquiri",
    icon: "🍹",
    desc: "极简的古巴水手烈酒。青柠汁强酸与朗姆酒高酒精度直面碰撞，酸烈冲鼻，对新手感官防线极具挑战。",
    themeColor: "from-pink-500/10 to-rose-500/10",
    rating: { bitter: 1, alcohol: 4, fresh: 4, sweet: 2 },
    ingredients: [
      { name: "白朗姆 Rum", amount: 45, category: "基酒", color: "rgba(180, 83, 9, 0.35)" },
      { name: "青柠汁 Lime Juice", amount: 20, category: "果汁", color: "rgba(132, 204, 22, 0.5)" },
      { name: "白糖浆 Syrup", amount: 15, category: "辅料", color: "rgba(255, 255, 255, 0.7)" }
    ]
  },
  bloody_mary: {
    id: "bloody_mary",
    name: "血玛丽",
    english: "Bloody Mary",
    icon: "🍅",
    desc: "伏特加注入厚重番茄汁，加入辣椒酱、黑胡椒等。咸辣微腥、口感稠厚，被吐槽为“液体冷番茄汤配酒精”。",
    themeColor: "from-red-600/10 to-orange-700/10",
    rating: { bitter: 1, alcohol: 3, fresh: 1, sweet: 1 },
    ingredients: [
      { name: "伏特加 Vodka", amount: 45, category: "基酒", color: "rgba(186, 230, 253, 0.35)" },
      { name: "番茄汁 Tomato Juice", amount: 90, category: "果汁", color: "rgba(239, 68, 68, 0.75)" },
      { name: "柠檬汁 Lemon Juice", amount: 15, category: "果汁", color: "rgba(234, 179, 8, 0.7)" },
      { name: "香辛料/辣酱 Spices", amount: 5, category: "辅料", color: "rgba(127, 29, 29, 0.85)" }
    ]
  },
  espresso_martini: {
    id: "espresso_martini",
    name: "浓缩咖啡马天尼",
    english: "Espresso Martini",
    icon: "☕",
    desc: "浓缩咖啡、伏特加与咖啡酒。咖啡的焦涩苦感，与伏特加的高热烈酒精撞击，对非黑咖啡爱好者极不友好。",
    themeColor: "from-amber-950/10 to-stone-900/10",
    rating: { bitter: 4, alcohol: 4, fresh: 1, sweet: 2 },
    ingredients: [
      { name: "伏特加 Vodka", amount: 45, category: "基酒", color: "rgba(186, 230, 253, 0.35)" },
      { name: "浓缩咖啡 Espresso", amount: 30, category: "辅料", color: "rgba(40, 20, 10, 0.85)" },
      { name: "甘露咖啡酒 Kahlúa", amount: 20, category: "辅料", color: "rgba(60, 30, 15, 0.8)" }
    ]
  },
  pina_colada: {
    id: "pina_colada",
    name: "椰林飘香",
    english: "Piña Colada",
    icon: "🥥",
    desc: "甜美热带椰奶凤梨酒。由于加入了重油脂、厚乳感的椰浆及高糖分，很容易甜腻、糊嘴，且酒体十分沉重。",
    themeColor: "from-yellow-100/10 to-orange-200/10",
    rating: { bitter: 1, alcohol: 3, fresh: 2, sweet: 4 },
    ingredients: [
      { name: "白朗姆 Rum", amount: 50, category: "基酒", color: "rgba(180, 83, 9, 0.35)" },
      { name: "椰浆 Coconut Cream", amount: 30, category: "辅料", color: "rgba(255, 255, 255, 0.95)" },
      { name: "凤梨汁 Pineapple Juice", amount: 90, category: "果汁", color: "rgba(253, 224, 71, 0.6)" }
    ]
  },
  singapore_sling: {
    id: "singapore_sling",
    name: "新加坡司令",
    english: "Singapore Sling",
    icon: "🍒",
    desc: "金酒、樱桃利口酒、柠檬与热带果汁组成的经典长饮。果香很丰富，但配料多、甜酸苦和草本感叠加，新手容易觉得味道太杂。",
    themeColor: "from-pink-400/10 to-red-500/10",
    rating: { bitter: 2, alcohol: 3, fresh: 4, sweet: 4 },
    ingredients: [
      { name: "金酒 Gin", amount: 30, category: "基酒", color: "rgba(148, 163, 184, 0.45)" },
      { name: "樱桃利口酒 Cherry Liqueur", amount: 15, category: "辅料", color: "rgba(190, 18, 60, 0.55)" },
      { name: "柠檬汁 Lemon Juice", amount: 15, category: "果汁", color: "rgba(253, 224, 71, 0.55)" },
      { name: "菠萝汁 Pineapple Juice", amount: 60, category: "果汁", color: "rgba(253, 224, 71, 0.45)" }
    ]
  },
  tom_collins: {
    id: "tom_collins",
    name: "汤姆柯林斯",
    english: "Tom Collins",
    icon: "🍋",
    desc: "金酒、柠檬、糖和苏打水组成的经典清爽长饮。酸度和气泡感明显，如果柠檬比例太高会显得尖锐。",
    themeColor: "from-yellow-300/10 to-cyan-400/10",
    rating: { bitter: 2, alcohol: 3, fresh: 5, sweet: 2 },
    ingredients: [
      { name: "金酒 Gin", amount: 45, category: "基酒", color: "rgba(148, 163, 184, 0.45)" },
      { name: "柠檬汁 Lemon Juice", amount: 25, category: "果汁", color: "rgba(253, 224, 71, 0.55)" },
      { name: "糖浆 Syrup", amount: 15, category: "辅料", color: "rgba(255, 255, 255, 0.75)" },
      { name: "苏打水 Soda Water", amount: 90, category: "气泡饮料", color: "rgba(224, 242, 254, 0.25)" }
    ]
  },
  aperol_spritz: {
    id: "aperol_spritz",
    name: "阿佩罗橙光",
    english: "Aperol Spritz",
    icon: "🍊",
    desc: "阿佩罗、起泡酒和苏打水组成的意式开胃长饮。入口橙香、微苦、轻甜，苦橙皮的尾调对怕苦的人会比较明显。",
    themeColor: "from-orange-400/10 to-amber-500/10",
    rating: { bitter: 3, alcohol: 2, fresh: 4, sweet: 3 },
    ingredients: [
      { name: "阿佩罗 Aperol", amount: 60, category: "辅料", color: "rgba(249, 115, 22, 0.65)" },
      { name: "起泡酒 Prosecco", amount: 90, category: "基酒", color: "rgba(254, 240, 138, 0.35)" },
      { name: "苏打水 Soda Water", amount: 30, category: "气泡饮料", color: "rgba(224, 242, 254, 0.25)" }
    ]
  },
  cosmopolitan: {
    id: "cosmopolitan",
    name: "大都会",
    english: "Cosmopolitan",
    icon: "🍸",
    desc: "伏特加、橙味利口酒、蔓越莓和青柠组成。颜色漂亮但酸甜集中，若比例不稳会显得尖酸或酒精味突兀。",
    themeColor: "from-rose-400/10 to-pink-500/10",
    rating: { bitter: 1, alcohol: 4, fresh: 3, sweet: 3 },
    ingredients: [
      { name: "伏特加 Vodka", amount: 40, category: "基酒", color: "rgba(186, 230, 253, 0.35)" },
      { name: "橙味利口酒 Triple Sec", amount: 15, category: "辅料", color: "rgba(253, 186, 116, 0.4)" },
      { name: "蔓越莓汁 Cranberry Juice", amount: 30, category: "果汁", color: "rgba(190, 18, 60, 0.55)" },
      { name: "青柠汁 Lime Juice", amount: 10, category: "果汁", color: "rgba(132, 204, 22, 0.5)" }
    ]
  }
};

const directionOptions = [
  { id: "less_alcohol", label: "降低酒感", icon: "feather", desc: "减少烈酒冲击，入口更轻" },
  { id: "less_bitter", label: "少苦一点", icon: "smile", desc: "降低药草苦、咖啡苦或汤力苦" },
  { id: "sweeter", label: "甜一点", icon: "sparkle", desc: "增加圆润甜感" },
  { id: "more_acid", label: "酸一点", icon: "sparkle", desc: "增加明亮果酸" },
  { id: "fresher", label: "清爽一点", icon: "droplets", desc: "用气泡或茶饮拉轻酒体" },
  { id: "lighter_body", label: "酒体更轻", icon: "droplets", desc: "做成更轻盈的长饮" },
  { id: "convenience", label: "便利店版", icon: "store", desc: "便利店材料优先" },
  { id: "juice", label: "果汁型", icon: "sparkle", desc: "果汁主体，更低门槛" },
];

type ExploreTab = "convenience" | "classic";

type InspirationCocktail = {
  id: string;
  nameZh: string;
  nameEn: string;
  description: string;
  imageUrl: string;
  category: string;
  baseSpirit?: string;
  tags: string[];
  ingredients: string[];
  href: string;
};

type ConvenienceRecipeGuide = {
  glass: string;
  ingredientLines: string[];
  steps: string[];
  beginnerTips: string[];
};

const getCocktailMvpMeta = (cocktail: InspirationCocktail, tab?: ExploreTab) => {
  const text = [
    cocktail.nameZh,
    cocktail.nameEn,
    cocktail.description,
    cocktail.category,
    cocktail.baseSpirit ?? "",
    ...cocktail.tags,
    ...cocktail.ingredients,
  ].join(" ");
  const isConvenience = tab === "convenience" || cocktail.href.includes("convenience-mix");
  const needsShake = /蛋白|奶油|果汁|糖浆|青柠|柠檬|酸酒|Daiquiri|Fizz|Sour|Margarita|shake/i.test(text) && !/苏打|汽水|气泡|啤酒|可乐|汤力/.test(text);
  const highAlcohol = /长岛|僵尸|Vesper|马丁|老式|曼哈顿|内格罗尼|高酒感|多种烈酒|Martini|Old Fashioned|Manhattan|Negroni|Zombie|Long Island/i.test(text);
  const lowAlcohol = /低酒感|啤酒|烧酒|梅酒|起泡|苏打|气泡|Highball|Mimosa|Spritz/i.test(text);
  const beginner = isConvenience || /清爽|果香|酸甜|低酒感|新手|莫吉托|金汤力|含羞草|海风|Mojito|Gin Tonic|Mimosa/i.test(text);

  return {
    difficulty: isConvenience ? 1 : needsShake ? 3 : highAlcohol ? 4 : 2,
    alcohol: highAlcohol ? "酒感强" : lowAlcohol ? "低酒感" : "中酒感",
    availability: isConvenience ? "好买" : beginner ? "较好买" : "材料较专业",
    tool: needsShake ? "需要摇合" : "不用摇壶",
  };
};

const convenienceCategories = ["全部", "金酒", "伏特加", "威士忌", "朗姆", "龙舌兰", "啤酒", "烧酒", "梅酒", "白兰地", "清酒", "利口酒", "苦味酒", "低酒感", "果香", "奶香"];
const classicCategories = ["全部", "金酒", "伏特加", "威士忌", "朗姆", "龙舌兰", "白兰地", "梅斯卡尔", "皮斯科", "卡莎萨", "起泡酒", "利口酒", "苦味酒", "酸甜", "清爽", "果香", "草本"];

const curatedClassicExploreCocktails: InspirationCocktail[] = [
  {
    id: "margarita",
    nameZh: "玛格丽特",
    nameEn: "Margarita",
    description: "龙舌兰、橙味利口酒与青柠组成的经典酸甜鸡尾酒。",
    imageUrl: "/images/cocktails/margarita.svg",
    category: "经典鸡尾酒",
    baseSpirit: "龙舌兰",
    tags: ["酸甜", "龙舌兰"],
    ingredients: ["龙舌兰", "橙味利口酒", "青柠"],
    href: "/inspiration/classic-remix?cocktail=margarita",
  },
  {
    id: "singapore-sling",
    nameZh: "新加坡司令",
    nameEn: "Singapore Sling",
    description: "以金酒、樱桃利口酒和果汁组成的热带果香鸡尾酒。",
    imageUrl: "/images/cocktails/singapore-sling.svg",
    category: "经典鸡尾酒",
    baseSpirit: "金酒",
    tags: ["果香", "草本", "金酒"],
    ingredients: ["金酒", "樱桃利口酒", "果汁"],
    href: "/inspiration/classic-remix?cocktail=singapore-sling",
  },
  {
    id: "strawberry-daiquiri",
    nameZh: "草莓黛克瑞",
    nameEn: "Strawberry Daiquiri",
    description: "朗姆酒、青柠与草莓组成，酸甜柔和、果香突出。",
    imageUrl: "/images/cocktails/strawberry-daiquiri.svg",
    category: "果香",
    baseSpirit: "朗姆",
    tags: ["果香", "酸甜", "朗姆"],
    ingredients: ["朗姆酒", "青柠", "草莓"],
    href: "/inspiration/flavor?flavor=strawberry-daiquiri",
  },
  {
    id: "mojito",
    nameZh: "莫吉托",
    nameEn: "Mojito",
    description: "朗姆酒、青柠、薄荷和苏打水组成，清爽易入口。",
    imageUrl: "/images/cocktails/mojito.svg",
    category: "清爽",
    baseSpirit: "朗姆",
    tags: ["清爽", "草本", "朗姆"],
    ingredients: ["朗姆酒", "青柠", "薄荷", "苏打水"],
    href: "/inspiration/classic-remix?cocktail=mojito",
  },
  {
    id: "gin-tonic",
    nameZh: "金汤力",
    nameEn: "Gin & Tonic",
    description: "金酒配汤力水，带有柑橘和草本香气。",
    imageUrl: "/images/cocktails/gin-tonic.svg",
    category: "经典鸡尾酒",
    baseSpirit: "金酒",
    tags: ["草本", "清爽", "金酒"],
    ingredients: ["金酒", "汤力水", "柑橘"],
    href: "/inspiration/classic-remix?cocktail=gin-tonic",
  },
  {
    id: "negroni",
    nameZh: "内格罗尼",
    nameEn: "Negroni",
    description: "金酒、金巴利与甜味美思等比调制，苦甜草本感很经典。",
    imageUrl: "/images/cocktails/singapore-sling.svg",
    category: "经典鸡尾酒",
    baseSpirit: "金酒",
    tags: ["草本", "金酒"],
    ingredients: ["金酒", "金巴利", "甜味美思"],
    href: "/inspiration/classic-remix?cocktail=negroni",
  },
  {
    id: "old-fashioned",
    nameZh: "古典老式",
    nameEn: "Old Fashioned",
    description: "威士忌、糖和苦精组成，突出桶香、酒体和微甜回甘。",
    imageUrl: "/images/cocktails/coconut-rum.svg",
    category: "经典鸡尾酒",
    baseSpirit: "威士忌",
    tags: ["威士忌", "草本"],
    ingredients: ["威士忌", "糖", "苦精"],
    href: "/inspiration/classic-remix?cocktail=old-fashioned",
  },
  {
    id: "martini",
    nameZh: "马丁尼",
    nameEn: "Martini",
    description: "金酒与干味美思构成的干爽经典，酒感直接、香气克制。",
    imageUrl: "/images/cocktails/gin-tonic.svg",
    category: "经典鸡尾酒",
    baseSpirit: "金酒",
    tags: ["金酒", "草本"],
    ingredients: ["金酒", "干味美思"],
    href: "/inspiration/classic-remix?cocktail=martini",
  },
  {
    id: "whisky-highball",
    nameZh: "威士忌嗨棒",
    nameEn: "Whisky Highball",
    description: "威士忌和苏打水拉成长饮，清爽、低负担，适合入门。",
    imageUrl: "/images/cocktails/lime-soju-soda.svg",
    category: "清爽",
    baseSpirit: "威士忌",
    tags: ["威士忌", "清爽"],
    ingredients: ["威士忌", "苏打水"],
    href: "/inspiration/classic-remix?cocktail=highball",
  },
  {
    id: "whiskey-sour",
    nameZh: "威士忌酸",
    nameEn: "Whiskey Sour",
    description: "威士忌、柠檬和糖浆组成，酸甜平衡，桶香明显。",
    imageUrl: "/images/cocktails/margarita.svg",
    category: "酸甜",
    baseSpirit: "威士忌",
    tags: ["威士忌", "酸甜"],
    ingredients: ["威士忌", "柠檬汁", "糖浆"],
    href: "/inspiration/classic-remix?cocktail=whiskey-sour",
  },
  {
    id: "cosmopolitan",
    nameZh: "大都会",
    nameEn: "Cosmopolitan",
    description: "伏特加、蔓越莓和青柠组成，果酸明亮，颜色漂亮。",
    imageUrl: "/images/cocktails/strawberry-daiquiri.svg",
    category: "酸甜",
    baseSpirit: "伏特加",
    tags: ["伏特加", "酸甜", "果香"],
    ingredients: ["伏特加", "蔓越莓汁", "青柠"],
    href: "/inspiration/classic-remix?cocktail=cosmopolitan",
  },
  {
    id: "moscow-mule",
    nameZh: "莫斯科骡子",
    nameEn: "Moscow Mule",
    description: "伏特加、青柠和姜汁汽水组成，冰凉、辛香、气泡感强。",
    imageUrl: "/images/cocktails/lime-soju-soda.svg",
    category: "清爽",
    baseSpirit: "伏特加",
    tags: ["伏特加", "清爽"],
    ingredients: ["伏特加", "青柠", "姜汁汽水"],
    href: "/inspiration/classic-remix?cocktail=moscow-mule",
  },
  {
    id: "aperol-spritz",
    nameZh: "阿佩罗司普瑞兹",
    nameEn: "Aperol Spritz",
    description: "阿佩罗、起泡酒和苏打水组成，橙香轻苦，适合长饮。",
    imageUrl: "/images/cocktails/grapefruit-beer.svg",
    category: "清爽",
    baseSpirit: "起泡酒",
    tags: ["起泡酒", "清爽", "果香"],
    ingredients: ["阿佩罗", "起泡酒", "苏打水"],
    href: "/inspiration/classic-remix?cocktail=aperol-spritz",
  },
  {
    id: "pina-colada",
    nameZh: "椰林飘香",
    nameEn: "Piña Colada",
    description: "朗姆、菠萝汁和椰奶组成，热带感强，甜润顺滑。",
    imageUrl: "/images/cocktails/coconut-rum.svg",
    category: "果香",
    baseSpirit: "朗姆",
    tags: ["朗姆", "果香", "奶香"],
    ingredients: ["朗姆", "菠萝汁", "椰奶"],
    href: "/inspiration/classic-remix?cocktail=pina-colada",
  },
  {
    id: "tom-collins",
    nameZh: "汤姆柯林斯",
    nameEn: "Tom Collins",
    description: "金酒、柠檬、糖和苏打水组成，明亮清爽，像柠檬汽水升级版。",
    imageUrl: "/images/cocktails/gin-tonic.svg",
    category: "清爽",
    baseSpirit: "金酒",
    tags: ["金酒", "清爽", "酸甜"],
    ingredients: ["金酒", "柠檬", "苏打水"],
    href: "/inspiration/classic-remix?cocktail=tom-collins",
  },
  {
    id: "paloma",
    nameZh: "帕洛玛",
    nameEn: "Paloma",
    description: "龙舌兰和西柚汽水组成，果香、微苦和气泡非常适合夏天。",
    imageUrl: "/images/cocktails/grapefruit-beer.svg",
    category: "清爽",
    baseSpirit: "龙舌兰",
    tags: ["龙舌兰", "清爽", "果香"],
    ingredients: ["龙舌兰", "西柚汽水"],
    href: "/inspiration/classic-remix?cocktail=paloma",
  },
  {
    id: "mai-tai",
    nameZh: "迈泰",
    nameEn: "Mai Tai",
    description: "朗姆、橙味利口酒和青柠组成，坚果与热带果香明显。",
    imageUrl: "/images/cocktails/strawberry-daiquiri.svg",
    category: "果香",
    baseSpirit: "朗姆",
    tags: ["朗姆", "果香", "酸甜"],
    ingredients: ["朗姆", "橙味利口酒", "青柠"],
    href: "/inspiration/classic-remix?cocktail=mai-tai",
  },
];

const curatedConvenienceExploreCocktails: InspirationCocktail[] = [
  {
    id: "grapefruit-beer",
    nameZh: "西柚啤酒",
    nameEn: "Grapefruit Beer",
    description: "啤酒搭配西柚汽水，清爽、果香明显，适合新手。",
    imageUrl: "/images/cocktails/grapefruit-beer.svg",
    category: "便利店特调",
    baseSpirit: "啤酒",
    tags: ["啤酒", "清爽", "果香"],
    ingredients: ["啤酒", "西柚汽水"],
    href: "/inspiration/convenience-mix?cocktail=grapefruit-beer",
  },
  {
    id: "coconut-rum",
    nameZh: "椰香朗姆",
    nameEn: "Coconut Rum Mix",
    description: "朗姆酒搭配椰奶饮料，顺滑、香甜，适合低门槛调制。",
    imageUrl: "/images/cocktails/coconut-rum.svg",
    category: "便利店特调",
    baseSpirit: "朗姆",
    tags: ["朗姆", "奶香", "果香"],
    ingredients: ["朗姆酒", "椰奶饮料"],
    href: "/inspiration/convenience-mix?cocktail=coconut-rum",
  },
  {
    id: "lime-soju-soda",
    nameZh: "青柠气泡烧酒",
    nameEn: "Lime Soju Soda",
    description: "烧酒搭配青柠与苏打水，酒感轻、气泡感明显。",
    imageUrl: "/images/cocktails/lime-soju-soda.svg",
    category: "低酒感",
    baseSpirit: "烧酒",
    tags: ["烧酒", "低酒感", "清爽"],
    ingredients: ["烧酒", "青柠", "苏打水"],
    href: "/inspiration/convenience-mix?cocktail=lime-soju-soda",
  },
  {
    id: "gin-lemon-tea",
    nameZh: "金酒柠檬茶",
    nameEn: "Gin Lemon Tea",
    description: "金酒搭配柠檬茶，茶感和柑橘香明显，做法很简单。",
    imageUrl: "/images/cocktails/gin-tonic.svg",
    category: "便利店特调",
    baseSpirit: "金酒",
    tags: ["金酒", "清爽", "草本"],
    ingredients: ["金酒", "柠檬茶"],
    href: "/inspiration/convenience-mix?cocktail=gin-lemon-tea",
  },
  {
    id: "gin-grapefruit-soda",
    nameZh: "金酒西柚汽水",
    nameEn: "Gin Grapefruit Soda",
    description: "金酒配西柚汽水，柑橘、微苦和气泡一起把酒感拉轻。",
    imageUrl: "/images/cocktails/grapefruit-beer.svg",
    category: "便利店特调",
    baseSpirit: "金酒",
    tags: ["金酒", "果香", "清爽"],
    ingredients: ["金酒", "西柚汽水"],
    href: "/inspiration/convenience-mix?cocktail=gin-grapefruit-soda",
  },
  {
    id: "vodka-orange",
    nameZh: "伏特加橙汁",
    nameEn: "Vodka Orange",
    description: "伏特加加橙汁，果香直接，酸甜好入口，是便利店低门槛组合。",
    imageUrl: "/images/cocktails/margarita.svg",
    category: "便利店特调",
    baseSpirit: "伏特加",
    tags: ["伏特加", "果香", "酸甜"],
    ingredients: ["伏特加", "橙汁"],
    href: "/inspiration/convenience-mix?cocktail=vodka-orange",
  },
  {
    id: "vodka-cranberry",
    nameZh: "伏特加蔓越莓",
    nameEn: "Vodka Cranberry",
    description: "伏特加搭配蔓越莓汁，颜色清亮，酸甜明显，酒感不突兀。",
    imageUrl: "/images/cocktails/strawberry-daiquiri.svg",
    category: "便利店特调",
    baseSpirit: "伏特加",
    tags: ["伏特加", "酸甜", "果香"],
    ingredients: ["伏特加", "蔓越莓汁"],
    href: "/inspiration/convenience-mix?cocktail=vodka-cranberry",
  },
  {
    id: "whisky-oolong",
    nameZh: "威士忌乌龙",
    nameEn: "Whisky Oolong",
    description: "威士忌配无糖乌龙，茶香能压住甜腻，适合喜欢干净口感的人。",
    imageUrl: "/images/cocktails/coconut-rum.svg",
    category: "便利店特调",
    baseSpirit: "威士忌",
    tags: ["威士忌", "草本", "低酒感"],
    ingredients: ["威士忌", "乌龙茶"],
    href: "/inspiration/convenience-mix?cocktail=whisky-oolong",
  },
  {
    id: "whisky-cola",
    nameZh: "威士忌可乐",
    nameEn: "Whisky Cola",
    description: "威士忌搭配可乐，焦糖甜感明显，适合聚会和第一杯尝试。",
    imageUrl: "/images/cocktails/grapefruit-beer.svg",
    category: "便利店特调",
    baseSpirit: "威士忌",
    tags: ["威士忌", "低酒感"],
    ingredients: ["威士忌", "可乐"],
    href: "/inspiration/convenience-mix?cocktail=whisky-cola",
  },
  {
    id: "rum-cola",
    nameZh: "朗姆可乐",
    nameEn: "Rum Cola",
    description: "朗姆酒和可乐是稳定组合，甘蔗香、焦糖感和气泡都很友好。",
    imageUrl: "/images/cocktails/coconut-rum.svg",
    category: "便利店特调",
    baseSpirit: "朗姆",
    tags: ["朗姆", "低酒感"],
    ingredients: ["朗姆", "可乐"],
    href: "/inspiration/convenience-mix?cocktail=rum-cola",
  },
  {
    id: "rum-pineapple",
    nameZh: "朗姆菠萝汁",
    nameEn: "Rum Pineapple",
    description: "朗姆酒搭配菠萝汁，热带果香明显，酸甜度很适合新手。",
    imageUrl: "/images/cocktails/strawberry-daiquiri.svg",
    category: "便利店特调",
    baseSpirit: "朗姆",
    tags: ["朗姆", "果香", "酸甜"],
    ingredients: ["朗姆", "菠萝汁"],
    href: "/inspiration/convenience-mix?cocktail=rum-pineapple",
  },
  {
    id: "tequila-grapefruit",
    nameZh: "龙舌兰西柚",
    nameEn: "Tequila Grapefruit",
    description: "龙舌兰加西柚汽水，酸、苦、气泡一起让酒体更清爽。",
    imageUrl: "/images/cocktails/grapefruit-beer.svg",
    category: "便利店特调",
    baseSpirit: "龙舌兰",
    tags: ["龙舌兰", "清爽", "果香"],
    ingredients: ["龙舌兰", "西柚汽水"],
    href: "/inspiration/convenience-mix?cocktail=tequila-grapefruit",
  },
  {
    id: "tequila-orange",
    nameZh: "龙舌兰橙汁",
    nameEn: "Tequila Orange",
    description: "龙舌兰搭配橙汁，果香明亮，适合想要酸甜口的人。",
    imageUrl: "/images/cocktails/margarita.svg",
    category: "便利店特调",
    baseSpirit: "龙舌兰",
    tags: ["龙舌兰", "酸甜", "果香"],
    ingredients: ["龙舌兰", "橙汁"],
    href: "/inspiration/convenience-mix?cocktail=tequila-orange",
  },
  {
    id: "beer-tomato",
    nameZh: "番茄啤酒",
    nameEn: "Tomato Beer",
    description: "啤酒加番茄汁，咸鲜清爽，适合搭配小吃和油炸食物。",
    imageUrl: "/images/cocktails/grapefruit-beer.svg",
    category: "便利店特调",
    baseSpirit: "啤酒",
    tags: ["啤酒", "低酒感"],
    ingredients: ["啤酒", "番茄汁"],
    href: "/inspiration/convenience-mix?cocktail=tomato-beer",
  },
  {
    id: "soju-yakult",
    nameZh: "烧酒养乐多",
    nameEn: "Soju Yakult",
    description: "烧酒和养乐多是低门槛组合，酸甜乳酸感能很好地包住酒味。",
    imageUrl: "/images/cocktails/lime-soju-soda.svg",
    category: "低酒感",
    baseSpirit: "烧酒",
    tags: ["烧酒", "低酒感", "奶香"],
    ingredients: ["烧酒", "养乐多"],
    href: "/inspiration/convenience-mix?cocktail=soju-yakult",
  },
  {
    id: "umeshu-soda",
    nameZh: "梅酒苏打",
    nameEn: "Umeshu Soda",
    description: "梅酒加苏打水，甜酸梅香被气泡拉开，轻松、清爽、不厚重。",
    imageUrl: "/images/cocktails/lime-soju-soda.svg",
    category: "便利店特调",
    baseSpirit: "梅酒",
    tags: ["梅酒", "清爽", "低酒感"],
    ingredients: ["梅酒", "苏打水"],
    href: "/inspiration/convenience-mix?cocktail=umeshu-soda",
  },
];

const convenienceRecipeGuides: Record<string, ConvenienceRecipeGuide> = {
  "grapefruit-beer": {
    glass: "高杯 / 冰镇啤酒杯",
    ingredientLines: ["啤酒 Beer 180ml", "西柚汽水 Grapefruit Soda 90ml", "冰块 Ice 适量", "西柚片 Grapefruit Slice 可选"],
    steps: ["杯子提前冰一下，加入半杯冰块。", "先倒入西柚汽水，再沿杯壁慢慢倒入啤酒。", "轻轻搅 1 圈即可，不要猛烈搅拌，避免泡沫冲出来。"],
    beginnerTips: ["如果怕苦，选小麦啤酒或清爽型拉格，不要选 IPA。", "西柚汽水越多越像果味气泡饮，啤酒越多越保留麦香。", "第一次做可以从啤酒 2 : 西柚汽水 1 开始。"],
  },
  "coconut-rum": {
    glass: "矮杯 / 高杯",
    ingredientLines: ["白朗姆 Rum 30ml", "椰奶饮料 Coconut Milk Drink 120ml", "冰块 Ice 适量", "菠萝汁 Pineapple Juice 30ml 可选"],
    steps: ["杯中加满冰块。", "倒入朗姆酒和椰奶饮料。", "轻轻搅匀，想要更热带可以补一点菠萝汁。"],
    beginnerTips: ["椰奶饮料本身偏甜，朗姆不要一开始倒太多。", "如果觉得腻，加 20-30ml 苏打水会更轻。"],
  },
  "lime-soju-soda": {
    glass: "高杯",
    ingredientLines: ["烧酒 Soju 45ml", "苏打水 Soda Water 120ml", "青柠汁 Lime Juice 10ml", "冰块 Ice 适量"],
    steps: ["杯中加冰，倒入烧酒和青柠汁。", "补满苏打水。", "从下往上轻轻提拉搅拌 2 次。"],
    beginnerTips: ["烧酒酒感轻但后劲存在，别按饮料速度喝。", "喜欢甜口可以换成青柠味气泡水或加 10ml 糖浆。"],
  },
  "gin-lemon-tea": {
    glass: "高杯",
    ingredientLines: ["金酒 Gin 30ml", "柠檬茶 Lemon Tea 150ml", "冰块 Ice 适量", "柠檬片 Lemon Slice 可选"],
    steps: ["杯中加满冰。", "倒入金酒，再倒柠檬茶。", "轻搅后放一片柠檬。"],
    beginnerTips: ["柠檬茶甜度能压住金酒的草本味，很适合第一杯。", "如果用无糖茶，需要额外加 10-15ml 糖浆。"],
  },
  "gin-grapefruit-soda": {
    glass: "高杯",
    ingredientLines: ["金酒 Gin 30ml", "西柚汽水 Grapefruit Soda 150ml", "冰块 Ice 适量", "西柚片 Grapefruit Slice 可选"],
    steps: ["杯中加冰，倒入金酒。", "补入西柚汽水。", "轻轻搅拌，保留气泡。"],
    beginnerTips: ["金酒和西柚都有微苦感，怕苦就选甜一点的西柚汽水。", "想更清爽可以加 15ml 苏打水。"],
  },
  "vodka-orange": {
    glass: "高杯",
    ingredientLines: ["伏特加 Vodka 30ml", "橙汁 Orange Juice 150ml", "冰块 Ice 适量"],
    steps: ["杯中加冰。", "倒入伏特加和橙汁。", "搅匀即可。"],
    beginnerTips: ["伏特加味道很干净，橙汁品质决定整杯好不好喝。", "酸一点的橙汁更像鸡尾酒，太甜会像果汁兑酒。"],
  },
  "vodka-cranberry": {
    glass: "高杯",
    ingredientLines: ["伏特加 Vodka 30ml", "蔓越莓汁 Cranberry Juice 150ml", "青柠汁 Lime Juice 5ml 可选", "冰块 Ice 适量"],
    steps: ["杯中加冰，倒入伏特加。", "加入蔓越莓汁。", "喜欢更亮的酸味可以挤一点青柠。"],
    beginnerTips: ["蔓越莓汁酸甜明显，很适合掩盖酒精锐感。", "如果果汁很酸，伏特加减到 20ml 更稳。"],
  },
  "whisky-oolong": {
    glass: "高杯",
    ingredientLines: ["威士忌 Whisky 30ml", "无糖乌龙茶 Oolong Tea 150ml", "冰块 Ice 适量"],
    steps: ["杯中加满冰块。", "倒入威士忌。", "补入乌龙茶，轻搅。"],
    beginnerTips: ["无糖乌龙会让口感更干净，但也会放大威士忌的烟熏和木桶味。", "怕烈可以把威士忌降到 20ml，茶加到 180ml。"],
  },
  "whisky-cola": {
    glass: "高杯",
    ingredientLines: ["威士忌 Whisky 30ml", "可乐 Cola 150ml", "冰块 Ice 适量", "柠檬片 Lemon Slice 可选"],
    steps: ["杯中加冰。", "倒入威士忌。", "慢慢加入可乐，轻搅 1 圈。"],
    beginnerTips: ["可乐甜感强，最容易入口，但也容易喝快。", "加柠檬能减少甜腻，让香气更清楚。"],
  },
  "rum-cola": {
    glass: "高杯",
    ingredientLines: ["朗姆 Rum 30ml", "可乐 Cola 150ml", "青柠汁 Lime Juice 5ml 可选", "冰块 Ice 适量"],
    steps: ["杯中加冰，倒入朗姆。", "补可乐。", "挤一点青柠会更像 Cuba Libre。"],
    beginnerTips: ["白朗姆更清爽，黑朗姆更像焦糖可乐。", "可乐已经很甜，糖浆不用加。"],
  },
  "rum-pineapple": {
    glass: "高杯",
    ingredientLines: ["朗姆 Rum 30ml", "菠萝汁 Pineapple Juice 150ml", "冰块 Ice 适量", "苏打水 Soda Water 30ml 可选"],
    steps: ["杯中加冰。", "倒入朗姆和菠萝汁。", "想更轻盈就最后补一点苏打水。"],
    beginnerTips: ["菠萝汁酸甜强，很适合朗姆。", "如果觉得糊嘴，用苏打水把口感拉开。"],
  },
  "tequila-grapefruit": {
    glass: "高杯",
    ingredientLines: ["龙舌兰 Tequila 30ml", "西柚汽水 Grapefruit Soda 150ml", "青柠汁 Lime Juice 5ml 可选", "冰块 Ice 适量"],
    steps: ["杯中加冰，倒入龙舌兰。", "加入西柚汽水。", "可加一点青柠让酸味更清楚。"],
    beginnerTips: ["这是 Paloma 的便利店版本。", "龙舌兰有植物和泥土感，西柚汽水能把它变清爽。"],
  },
  "tequila-orange": {
    glass: "高杯",
    ingredientLines: ["龙舌兰 Tequila 30ml", "橙汁 Orange Juice 150ml", "冰块 Ice 适量", "石榴糖浆 Grenadine 5ml 可选"],
    steps: ["杯中加冰。", "倒入龙舌兰和橙汁。", "如果有石榴糖浆，可以最后沿杯壁倒入形成渐层。"],
    beginnerTips: ["没有石榴糖浆也可以喝，核心是龙舌兰和橙汁。", "橙汁越新鲜，酒精感越不突兀。"],
  },
  "tomato-beer": {
    glass: "啤酒杯",
    ingredientLines: ["啤酒 Beer 180ml", "番茄汁 Tomato Juice 90ml", "黑胡椒 Black Pepper 少量可选", "冰块 Ice 可选"],
    steps: ["杯中先倒番茄汁。", "慢慢加入冰啤酒。", "喜欢咸鲜口可以撒一点黑胡椒。"],
    beginnerTips: ["这杯偏咸鲜，不是甜口饮料。", "适合配炸鸡、薯片、烧烤一类重口小吃。"],
  },
  "soju-yakult": {
    glass: "高杯",
    ingredientLines: ["烧酒 Soju 45ml", "养乐多 Yakult 100ml", "苏打水 Soda Water 60ml", "冰块 Ice 适量"],
    steps: ["杯中加冰。", "倒入烧酒和养乐多。", "补苏打水后轻搅。"],
    beginnerTips: ["养乐多会让酒感变得非常低，注意别喝太快。", "不想太甜就增加苏打水，不要增加烧酒。"],
  },
  "umeshu-soda": {
    glass: "高杯",
    ingredientLines: ["梅酒 Umeshu 45ml", "苏打水 Soda Water 120ml", "冰块 Ice 适量", "柠檬片 Lemon Slice 可选"],
    steps: ["杯中加满冰。", "倒入梅酒。", "补苏打水，轻轻搅拌。"],
    beginnerTips: ["梅酒本身甜，苏打水负责拉轻。", "如果觉得太甜，增加苏打水，不要加果汁。"],
  },
};

const exploreImagePool = [
  "/images/cocktails/margarita.svg",
  "/images/cocktails/grapefruit-beer.svg",
  "/images/cocktails/singapore-sling.svg",
  "/images/cocktails/strawberry-daiquiri.svg",
  "/images/cocktails/mojito.svg",
  "/images/cocktails/gin-tonic.svg",
  "/images/cocktails/coconut-rum.svg",
  "/images/cocktails/lime-soju-soda.svg",
];

const simpleSlug = (value: string) => value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const normalizeClassicCocktailId = (value: string) => {
  const normalized = value.replace(/-/g, "_");
  const aliases: Record<string, string> = {
    old_fashioned: "old_fashioned",
    gin_tonic: "gin_tonic",
    whiskey_sour: "whisky_sour",
    whisky_sour: "whisky_sour",
    moscow_mule: "moscow_mule",
    pina_colada: "pina_colada",
    tom_collins: "tom_collins",
    singapore_sling: "singapore_sling",
    strawberry_daiquiri: "daiquiri",
    mai_tai: "daiquiri",
    paloma: "margarita",
    aperol_spritz: "aperol_spritz",
    cosmopolitan: "cosmopolitan",
  };
  return aliases[normalized] ?? normalized;
};

const dedupeCocktails = (items: InspirationCocktail[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

const actualClassicSeeds: Array<Omit<InspirationCocktail, "imageUrl" | "href">> = [
  { id: "alexander", nameZh: "亚历山大", nameEn: "Alexander", description: "白兰地、可可利口酒和奶油组成，口感柔滑甜润。", category: "经典鸡尾酒", baseSpirit: "白兰地", tags: ["奶香", "甜润"], ingredients: ["白兰地", "可可利口酒", "奶油"] },
  { id: "americano", nameZh: "美国佬", nameEn: "Americano", description: "金巴利、甜味美思和苏打水组成，轻苦、草本、开胃。", category: "经典鸡尾酒", baseSpirit: "苦味酒", tags: ["草本", "清爽"], ingredients: ["金巴利", "甜味美思", "苏打水"] },
  { id: "aviation", nameZh: "飞行", nameEn: "Aviation", description: "金酒、黑樱桃利口酒、紫罗兰和柠檬带来花香酸甜。", category: "经典鸡尾酒", baseSpirit: "金酒", tags: ["花香", "酸甜"], ingredients: ["金酒", "黑樱桃利口酒", "紫罗兰利口酒", "柠檬"] },
  { id: "boulevardier", nameZh: "布尔瓦迪耶", nameEn: "Boulevardier", description: "威士忌、金巴利和甜味美思组成，像威士忌版内格罗尼。", category: "经典鸡尾酒", baseSpirit: "威士忌", tags: ["草本", "苦甜"], ingredients: ["威士忌", "金巴利", "甜味美思"] },
  { id: "brandy-crusta", nameZh: "白兰地克拉斯塔", nameEn: "Brandy Crusta", description: "白兰地、橙味利口酒、柠檬和苦精组成，酸甜香气复杂。", category: "酸甜", baseSpirit: "白兰地", tags: ["酸甜", "柑橘"], ingredients: ["白兰地", "橙味利口酒", "柠檬", "苦精"] },
  { id: "casino", nameZh: "赌场", nameEn: "Casino", description: "金酒、黑樱桃利口酒、柠檬和橙味苦精组成。", category: "经典鸡尾酒", baseSpirit: "金酒", tags: ["酸甜", "草本"], ingredients: ["金酒", "黑樱桃利口酒", "柠檬", "橙味苦精"] },
  { id: "clover-club", nameZh: "三叶草俱乐部", nameEn: "Clover Club", description: "金酒、柠檬、覆盆子和蛋白组成，粉色酸甜且绵密。", category: "酸甜", baseSpirit: "金酒", tags: ["果香", "酸甜"], ingredients: ["金酒", "柠檬", "覆盆子糖浆", "蛋白"] },
  { id: "dry-martini", nameZh: "干马丁尼", nameEn: "Dry Martini", description: "金酒和干味美思组成，干爽、冷冽、酒感明显。", category: "经典鸡尾酒", baseSpirit: "金酒", tags: ["草本", "高酒感"], ingredients: ["金酒", "干味美思"] },
  { id: "gin-fizz", nameZh: "金菲士", nameEn: "Gin Fizz", description: "金酒、柠檬、糖和苏打水组成，酸甜清爽。", category: "清爽", baseSpirit: "金酒", tags: ["清爽", "酸甜"], ingredients: ["金酒", "柠檬", "糖浆", "苏打水"] },
  { id: "hanky-panky", nameZh: "汉基潘基", nameEn: "Hanky Panky", description: "金酒、甜味美思和菲奈特组成，草本苦味突出。", category: "经典鸡尾酒", baseSpirit: "金酒", tags: ["草本", "苦甜"], ingredients: ["金酒", "甜味美思", "菲奈特"] },
  { id: "last-word", nameZh: "最后一言", nameEn: "Last Word", description: "金酒、绿查特酒、黑樱桃利口酒和青柠等量调制。", category: "酸甜", baseSpirit: "金酒", tags: ["草本", "酸甜"], ingredients: ["金酒", "绿查特酒", "黑樱桃利口酒", "青柠"] },
  { id: "manhattan", nameZh: "曼哈顿", nameEn: "Manhattan", description: "威士忌、甜味美思和苦精组成，醇厚、辛香、经典。", category: "经典鸡尾酒", baseSpirit: "威士忌", tags: ["威士忌", "草本"], ingredients: ["威士忌", "甜味美思", "苦精"] },
  { id: "martinez", nameZh: "马丁内斯", nameEn: "Martinez", description: "金酒、甜味美思、黑樱桃利口酒和苦精组成。", category: "经典鸡尾酒", baseSpirit: "金酒", tags: ["草本", "苦甜"], ingredients: ["金酒", "甜味美思", "黑樱桃利口酒", "苦精"] },
  { id: "mary-pickford", nameZh: "玛丽皮克福德", nameEn: "Mary Pickford", description: "朗姆、菠萝、石榴糖浆和樱桃利口酒组成，热带甜香。", category: "果香", baseSpirit: "朗姆", tags: ["果香", "酸甜"], ingredients: ["朗姆", "菠萝汁", "石榴糖浆", "樱桃利口酒"] },
  { id: "monkey-gland", nameZh: "猴腺", nameEn: "Monkey Gland", description: "金酒、橙汁、石榴糖浆和少量苦艾带来复古果香。", category: "果香", baseSpirit: "金酒", tags: ["果香", "草本"], ingredients: ["金酒", "橙汁", "石榴糖浆", "苦艾酒"] },
  { id: "ramos-gin-fizz", nameZh: "拉莫斯金菲士", nameEn: "Ramos Gin Fizz", description: "金酒、柠檬、青柠、奶油、蛋白和苏打组成，绵密清爽。", category: "清爽", baseSpirit: "金酒", tags: ["奶香", "清爽"], ingredients: ["金酒", "柠檬", "青柠", "奶油", "蛋白", "苏打水"] },
  { id: "rusty-nail", nameZh: "生锈钉子", nameEn: "Rusty Nail", description: "苏格兰威士忌与蜂蜜草本利口酒组成，甜润而烈。", category: "经典鸡尾酒", baseSpirit: "威士忌", tags: ["威士忌", "甜润"], ingredients: ["威士忌", "杜林标利口酒"] },
  { id: "sazerac", nameZh: "萨泽拉克", nameEn: "Sazerac", description: "黑麦威士忌、糖、苦精和苦艾香气组成，新奥尔良经典。", category: "经典鸡尾酒", baseSpirit: "威士忌", tags: ["威士忌", "草本"], ingredients: ["黑麦威士忌", "糖", "苦精", "苦艾酒"] },
  { id: "sidecar", nameZh: "边车", nameEn: "Sidecar", description: "干邑、橙味利口酒和柠檬组成，明亮酸甜。", category: "酸甜", baseSpirit: "白兰地", tags: ["酸甜", "柑橘"], ingredients: ["干邑", "橙味利口酒", "柠檬"] },
  { id: "vieux-carre", nameZh: "老广场", nameEn: "Vieux Carré", description: "黑麦、干邑、甜味美思、香草利口酒和苦精组成。", category: "经典鸡尾酒", baseSpirit: "威士忌", tags: ["草本", "威士忌"], ingredients: ["黑麦威士忌", "干邑", "甜味美思", "香草利口酒"] },
  { id: "white-lady", nameZh: "白色佳人", nameEn: "White Lady", description: "金酒、橙味利口酒和柠檬组成，清亮酸甜。", category: "酸甜", baseSpirit: "金酒", tags: ["酸甜", "柑橘"], ingredients: ["金酒", "橙味利口酒", "柠檬"] },
  { id: "black-russian", nameZh: "黑俄罗斯", nameEn: "Black Russian", description: "伏特加和咖啡利口酒组成，深色、甜苦、简单直接。", category: "经典鸡尾酒", baseSpirit: "伏特加", tags: ["咖啡", "甜苦"], ingredients: ["伏特加", "咖啡利口酒"] },
  { id: "bloody-mary", nameZh: "血腥玛丽", nameEn: "Bloody Mary", description: "伏特加、番茄汁和香辛料组成，咸鲜辛香。", category: "经典鸡尾酒", baseSpirit: "伏特加", tags: ["辛香", "咸鲜"], ingredients: ["伏特加", "番茄汁", "香辛料", "柠檬"] },
  { id: "caipirinha", nameZh: "凯匹林纳", nameEn: "Caipirinha", description: "卡莎萨、青柠和糖组成，巴西经典酸甜长饮。", category: "酸甜", baseSpirit: "卡莎萨", tags: ["酸甜", "清爽"], ingredients: ["卡莎萨", "青柠", "糖"] },
  { id: "champagne-cocktail", nameZh: "香槟鸡尾酒", nameEn: "Champagne Cocktail", description: "香槟、糖、苦精和少量白兰地组成，复古而轻盈。", category: "清爽", baseSpirit: "起泡酒", tags: ["起泡酒", "清爽"], ingredients: ["香槟", "糖", "苦精", "白兰地"] },
  { id: "corpse-reviver-2", nameZh: "亡者复苏二号", nameEn: "Corpse Reviver No.2", description: "金酒、橙味利口酒、柠檬、味美思和苦艾组成。", category: "酸甜", baseSpirit: "金酒", tags: ["酸甜", "草本"], ingredients: ["金酒", "橙味利口酒", "柠檬", "味美思", "苦艾"] },
  { id: "cuba-libre", nameZh: "自由古巴", nameEn: "Cuba Libre", description: "朗姆、可乐和青柠组成，简单清爽。", category: "清爽", baseSpirit: "朗姆", tags: ["清爽", "低酒感"], ingredients: ["朗姆", "可乐", "青柠"] },
  { id: "french-75", nameZh: "法兰西75", nameEn: "French 75", description: "金酒、柠檬、糖和香槟组成，起泡酸甜。", category: "清爽", baseSpirit: "金酒", tags: ["起泡酒", "酸甜"], ingredients: ["金酒", "柠檬", "糖", "香槟"] },
  { id: "grasshopper", nameZh: "蚱蜢", nameEn: "Grasshopper", description: "薄荷利口酒、可可利口酒和奶油组成，甜香奶感。", category: "经典鸡尾酒", baseSpirit: "利口酒", tags: ["奶香", "甜润"], ingredients: ["薄荷利口酒", "可可利口酒", "奶油"] },
  { id: "hemingway-special", nameZh: "海明威特调", nameEn: "Hemingway Special", description: "朗姆、青柠、葡萄柚和樱桃利口酒组成，干爽酸香。", category: "酸甜", baseSpirit: "朗姆", tags: ["果香", "酸甜"], ingredients: ["朗姆", "青柠", "葡萄柚汁", "樱桃利口酒"] },
  { id: "irish-coffee", nameZh: "爱尔兰咖啡", nameEn: "Irish Coffee", description: "爱尔兰威士忌、热咖啡、糖和奶油组成。", category: "经典鸡尾酒", baseSpirit: "威士忌", tags: ["咖啡", "奶香"], ingredients: ["爱尔兰威士忌", "咖啡", "糖", "奶油"] },
  { id: "lemon-drop", nameZh: "柠檬滴", nameEn: "Lemon Drop", description: "伏特加、柠檬、橙味利口酒和糖组成，酸甜直接。", category: "酸甜", baseSpirit: "伏特加", tags: ["酸甜", "柑橘"], ingredients: ["伏特加", "柠檬", "橙味利口酒", "糖"] },
  { id: "long-island-iced-tea", nameZh: "长岛冰茶", nameEn: "Long Island Iced Tea", description: "多种烈酒、橙味利口酒、柠檬和可乐组成，后劲强。", category: "经典鸡尾酒", baseSpirit: "伏特加", tags: ["高酒感", "清爽"], ingredients: ["伏特加", "金酒", "朗姆", "龙舌兰", "橙味利口酒", "可乐"] },
  { id: "mimosa", nameZh: "含羞草", nameEn: "Mimosa", description: "起泡酒和橙汁组成，早午餐经典低门槛饮品。", category: "清爽", baseSpirit: "起泡酒", tags: ["起泡酒", "果香"], ingredients: ["起泡酒", "橙汁"] },
  { id: "mint-julep", nameZh: "薄荷朱利普", nameEn: "Mint Julep", description: "波本、糖、薄荷和碎冰组成，清凉但酒体厚。", category: "清爽", baseSpirit: "威士忌", tags: ["威士忌", "草本"], ingredients: ["波本", "薄荷", "糖", "碎冰"] },
  { id: "pisco-sour", nameZh: "皮斯科酸", nameEn: "Pisco Sour", description: "皮斯科、柠檬、糖浆、蛋白和苦精组成，酸香绵密。", category: "酸甜", baseSpirit: "皮斯科", tags: ["酸甜", "绵密"], ingredients: ["皮斯科", "柠檬", "糖浆", "蛋白", "苦精"] },
  { id: "sea-breeze", nameZh: "海风", nameEn: "Sea Breeze", description: "伏特加、蔓越莓和西柚汁组成，果酸清爽。", category: "清爽", baseSpirit: "伏特加", tags: ["果香", "清爽"], ingredients: ["伏特加", "蔓越莓汁", "西柚汁"] },
  { id: "sex-on-the-beach", nameZh: "激情海岸", nameEn: "Sex on the Beach", description: "伏特加、桃味利口酒、橙汁和蔓越莓汁组成。", category: "果香", baseSpirit: "伏特加", tags: ["果香", "酸甜"], ingredients: ["伏特加", "桃味利口酒", "橙汁", "蔓越莓汁"] },
  { id: "tequila-sunrise", nameZh: "龙舌兰日出", nameEn: "Tequila Sunrise", description: "龙舌兰、橙汁和石榴糖浆组成，果香明显。", category: "果香", baseSpirit: "龙舌兰", tags: ["果香", "酸甜"], ingredients: ["龙舌兰", "橙汁", "石榴糖浆"] },
  { id: "vesper", nameZh: "维斯帕", nameEn: "Vesper", description: "金酒、伏特加和利莱酒组成，酒感直接而冷冽。", category: "经典鸡尾酒", baseSpirit: "金酒", tags: ["高酒感", "草本"], ingredients: ["金酒", "伏特加", "利莱酒"] },
  { id: "zombie", nameZh: "僵尸", nameEn: "Zombie", description: "多种朗姆、果汁和利口酒组成，热带且后劲强。", category: "果香", baseSpirit: "朗姆", tags: ["果香", "高酒感"], ingredients: ["朗姆", "果汁", "利口酒"] },
  { id: "bees-knees", nameZh: "蜜蜂膝盖", nameEn: "Bee's Knees", description: "金酒、柠檬和蜂蜜组成，酸甜柔和。", category: "酸甜", baseSpirit: "金酒", tags: ["酸甜", "蜂蜜"], ingredients: ["金酒", "柠檬", "蜂蜜"] },
  { id: "bramble", nameZh: "荆棘", nameEn: "Bramble", description: "金酒、柠檬、糖浆和黑莓利口酒组成，莓果酸甜。", category: "果香", baseSpirit: "金酒", tags: ["果香", "酸甜"], ingredients: ["金酒", "柠檬", "糖浆", "黑莓利口酒"] },
  { id: "dark-and-stormy", nameZh: "黑暗风暴", nameEn: "Dark 'n' Stormy", description: "黑朗姆和姜汁啤酒组成，辛香气泡感强。", category: "清爽", baseSpirit: "朗姆", tags: ["清爽", "辛香"], ingredients: ["黑朗姆", "姜汁啤酒", "青柠"] },
  { id: "espresso-martini-classic", nameZh: "浓缩咖啡马丁尼", nameEn: "Espresso Martini", description: "伏特加、咖啡利口酒和浓缩咖啡组成，咖啡香浓。", category: "经典鸡尾酒", baseSpirit: "伏特加", tags: ["咖啡", "甜苦"], ingredients: ["伏特加", "咖啡利口酒", "浓缩咖啡"] },
  { id: "french-martini", nameZh: "法式马丁尼", nameEn: "French Martini", description: "伏特加、黑莓利口酒和菠萝汁组成，果香柔和。", category: "果香", baseSpirit: "伏特加", tags: ["果香", "酸甜"], ingredients: ["伏特加", "黑莓利口酒", "菠萝汁"] },
  { id: "jungle-bird", nameZh: "丛林鸟", nameEn: "Jungle Bird", description: "朗姆、金巴利、菠萝和青柠组成，热带苦甜。", category: "果香", baseSpirit: "朗姆", tags: ["果香", "苦甜"], ingredients: ["朗姆", "金巴利", "菠萝汁", "青柠"] },
  { id: "naked-and-famous", nameZh: "赤裸与成名", nameEn: "Naked and Famous", description: "梅斯卡尔、阿佩罗、黄查特酒和青柠等量调制。", category: "酸甜", baseSpirit: "梅斯卡尔", tags: ["烟熏", "酸甜"], ingredients: ["梅斯卡尔", "阿佩罗", "黄查特酒", "青柠"] },
  { id: "new-york-sour", nameZh: "纽约酸", nameEn: "New York Sour", description: "威士忌酸上漂红酒，酸甜中带葡萄酒香。", category: "酸甜", baseSpirit: "威士忌", tags: ["威士忌", "酸甜"], ingredients: ["威士忌", "柠檬", "糖浆", "红酒"] },
  { id: "paper-plane", nameZh: "纸飞机", nameEn: "Paper Plane", description: "波本、阿佩罗、阿玛罗和柠檬等量，现代苦甜酸香。", category: "酸甜", baseSpirit: "威士忌", tags: ["苦甜", "酸甜"], ingredients: ["波本", "阿佩罗", "阿玛罗", "柠檬"] },
  { id: "penicillin", nameZh: "盘尼西林", nameEn: "Penicillin", description: "威士忌、姜、蜂蜜和柠檬组成，带轻微烟熏。", category: "酸甜", baseSpirit: "威士忌", tags: ["辛香", "酸甜"], ingredients: ["威士忌", "姜", "蜂蜜", "柠檬"] },
  { id: "porn-star-martini", nameZh: "艳星马丁尼", nameEn: "Porn Star Martini", description: "香草伏特加、百香果和起泡酒组成，果香甜酸。", category: "果香", baseSpirit: "伏特加", tags: ["果香", "起泡酒"], ingredients: ["伏特加", "百香果", "起泡酒"] },
  { id: "tommy-margarita", nameZh: "汤米玛格丽特", nameEn: "Tommy's Margarita", description: "龙舌兰、青柠和龙舌兰糖浆组成，简洁酸甜。", category: "酸甜", baseSpirit: "龙舌兰", tags: ["酸甜", "龙舌兰"], ingredients: ["龙舌兰", "青柠", "龙舌兰糖浆"] },
];

const classicTemplateBases = [
  { zh: "金酒", en: "Gin", slug: "gin", image: "/images/cocktails/gin-tonic.svg" },
  { zh: "伏特加", en: "Vodka", slug: "vodka", image: "/images/cocktails/lime-soju-soda.svg" },
  { zh: "朗姆", en: "Rum", slug: "rum", image: "/images/cocktails/coconut-rum.svg" },
  { zh: "威士忌", en: "Whiskey", slug: "whiskey", image: "/images/cocktails/grapefruit-beer.svg" },
  { zh: "龙舌兰", en: "Tequila", slug: "tequila", image: "/images/cocktails/margarita.svg" },
  { zh: "白兰地", en: "Brandy", slug: "brandy", image: "/images/cocktails/singapore-sling.svg" },
  { zh: "梅斯卡尔", en: "Mezcal", slug: "mezcal", image: "/images/cocktails/grapefruit-beer.svg" },
  { zh: "皮斯科", en: "Pisco", slug: "pisco", image: "/images/cocktails/margarita.svg" },
  { zh: "卡莎萨", en: "Cachaça", slug: "cachaca", image: "/images/cocktails/mojito.svg" },
];

const classicTemplateStyles = [
  { zh: "酸酒", en: "Sour", ingredients: ["柠檬汁", "糖浆"], tags: ["酸甜"] },
  { zh: "菲士", en: "Fizz", ingredients: ["柠檬汁", "糖浆", "苏打水"], tags: ["清爽", "酸甜"] },
  { zh: "柯林斯", en: "Collins", ingredients: ["柠檬汁", "糖浆", "苏打水"], tags: ["清爽"] },
  { zh: "雏菊", en: "Daisy", ingredients: ["柠檬汁", "橙味利口酒", "糖浆"], tags: ["酸甜", "柑橘"] },
  { zh: "碎冰司马仕", en: "Smash", ingredients: ["柠檬", "薄荷", "糖浆"], tags: ["草本", "清爽"] },
  { zh: "瑞奇", en: "Rickey", ingredients: ["青柠汁", "苏打水"], tags: ["清爽"] },
  { zh: "巴克", en: "Buck", ingredients: ["姜汁汽水", "青柠"], tags: ["辛香", "清爽"] },
  { zh: "骡子", en: "Mule", ingredients: ["姜汁啤酒", "青柠"], tags: ["辛香", "清爽"] },
  { zh: "嗨棒", en: "Highball", ingredients: ["苏打水"], tags: ["清爽", "低酒感"] },
  { zh: "库勒", en: "Cooler", ingredients: ["柠檬", "糖浆", "苏打水"], tags: ["清爽"] },
  { zh: "考伯勒", en: "Cobbler", ingredients: ["糖浆", "水果", "碎冰"], tags: ["果香"] },
  { zh: "菲克斯", en: "Fix", ingredients: ["柠檬汁", "糖浆", "碎冰"], tags: ["酸甜"] },
  { zh: "克拉斯塔", en: "Crusta", ingredients: ["橙味利口酒", "柠檬", "苦精"], tags: ["酸甜", "柑橘"] },
  { zh: "司令", en: "Sling", ingredients: ["柠檬汁", "糖浆", "苏打水", "苦精"], tags: ["清爽", "草本"] },
  { zh: "潘趣", en: "Punch", ingredients: ["柑橘汁", "糖浆", "香料"], tags: ["果香", "酸甜"] },
  { zh: "朱利普", en: "Julep", ingredients: ["薄荷", "糖", "碎冰"], tags: ["草本", "清爽"] },
  { zh: "翻转", en: "Flip", ingredients: ["蛋黄", "糖", "奶油"], tags: ["奶香", "甜润"] },
  { zh: "热托蒂", en: "Toddy", ingredients: ["蜂蜜", "柠檬", "热水"], tags: ["蜂蜜", "温热"] },
  { zh: "牛奶潘趣", en: "Milk Punch", ingredients: ["牛奶", "糖浆", "香料"], tags: ["奶香", "甜润"] },
  { zh: "古典式", en: "Old Fashioned", ingredients: ["糖", "苦精"], tags: ["草本", "高酒感"] },
  { zh: "马丁尼式", en: "Martini Style", ingredients: ["干味美思", "苦精"], tags: ["草本", "高酒感"] },
  { zh: "内格罗尼式", en: "Negroni Style", ingredients: ["金巴利", "甜味美思"], tags: ["草本", "苦甜"] },
  { zh: "司普瑞兹", en: "Spritz", ingredients: ["起泡酒", "苏打水"], tags: ["起泡酒", "清爽"] },
  { zh: "皇家版", en: "Royale", ingredients: ["起泡酒", "柠檬"], tags: ["起泡酒", "清爽"] },
];

const generatedClassicCocktails: InspirationCocktail[] = classicTemplateBases.flatMap((base, baseIndex) =>
  classicTemplateStyles.map((style, styleIndex) => ({
    id: `classic-${base.slug}-${simpleSlug(style.en)}`,
    nameZh: `${base.zh}${style.zh}`,
    nameEn: `${base.en} ${style.en}`,
    description: `${base.zh}作为基酒，按${style.zh}结构加入${style.ingredients.join("、")}，适合按经典模板理解风味骨架。`,
    imageUrl: base.image,
    category: style.tags.includes("清爽") ? "清爽" : style.tags.includes("果香") ? "果香" : style.tags.includes("酸甜") ? "酸甜" : "经典鸡尾酒",
    baseSpirit: base.zh,
    tags: [base.zh, ...style.tags],
    ingredients: [base.zh, ...style.ingredients],
    href: `/inspiration/classic-remix?cocktail=classic-${base.slug}-${simpleSlug(style.en)}`,
  })),
);

const actualClassicCocktails: InspirationCocktail[] = actualClassicSeeds.map((item, index) => ({
  ...item,
  imageUrl: exploreImagePool[index % exploreImagePool.length],
  href: `/inspiration/classic-remix?cocktail=${item.id}`,
}));

const classicExploreCocktails: InspirationCocktail[] = dedupeCocktails([
  ...curatedClassicExploreCocktails,
  ...actualClassicCocktails,
  ...generatedClassicCocktails,
]);

const convenienceSpiritOptions = [
  { zh: "金酒", en: "Gin", slug: "gin", amount: "30ml", intensity: "草本香明显" },
  { zh: "伏特加", en: "Vodka", slug: "vodka", amount: "30ml", intensity: "酒体干净" },
  { zh: "威士忌", en: "Whisky", slug: "whisky", amount: "30ml", intensity: "桶香和焦糖感明显" },
  { zh: "朗姆", en: "Rum", slug: "rum", amount: "30ml", intensity: "甘蔗甜香明显" },
  { zh: "龙舌兰", en: "Tequila", slug: "tequila", amount: "30ml", intensity: "植物和青柠感适配" },
  { zh: "啤酒", en: "Beer", slug: "beer", amount: "180ml", intensity: "酒精低、麦香明显" },
  { zh: "烧酒", en: "Soju", slug: "soju", amount: "45ml", intensity: "酒感轻但后劲存在" },
  { zh: "梅酒", en: "Umeshu", slug: "umeshu", amount: "45ml", intensity: "酸甜梅香明显" },
  { zh: "白兰地", en: "Brandy", slug: "brandy", amount: "30ml", intensity: "果干和木质香明显" },
  { zh: "清酒", en: "Sake", slug: "sake", amount: "60ml", intensity: "米香柔和" },
  { zh: "利口酒", en: "Liqueur", slug: "liqueur", amount: "30ml", intensity: "甜感较高" },
  { zh: "苦味酒", en: "Aperitif", slug: "aperitif", amount: "30ml", intensity: "苦甜草本感明显" },
];

const convenienceMixerOptions = [
  { zh: "西柚汽水", en: "Grapefruit Soda", slug: "grapefruit-soda", volume: "150ml", tags: ["清爽", "果香"], advice: "怕苦就选甜一点的西柚汽水。" },
  { zh: "柠檬茶", en: "Lemon Tea", slug: "lemon-tea", volume: "150ml", tags: ["清爽", "酸甜"], advice: "茶味能压住酒精锐感。" },
  { zh: "乌龙茶", en: "Oolong Tea", slug: "oolong-tea", volume: "150ml", tags: ["草本", "低酒感"], advice: "无糖乌龙更干净，甜乌龙更适合新手。" },
  { zh: "绿茶", en: "Green Tea", slug: "green-tea", volume: "150ml", tags: ["草本", "清爽"], advice: "绿茶偏清淡，基酒不要倒太多。" },
  { zh: "茉莉花茶", en: "Jasmine Tea", slug: "jasmine-tea", volume: "150ml", tags: ["草本", "花香"], advice: "适合金酒、烧酒和清酒。" },
  { zh: "可乐", en: "Cola", slug: "cola", volume: "150ml", tags: ["低酒感"], advice: "可乐甜感强，容易喝快。" },
  { zh: "雪碧", en: "Lemon Lime Soda", slug: "lemon-lime-soda", volume: "150ml", tags: ["清爽", "酸甜"], advice: "甜度高，不需要再加糖浆。" },
  { zh: "苏打水", en: "Soda Water", slug: "soda-water", volume: "150ml", tags: ["清爽", "低酒感"], advice: "最干净，但最考验基酒味道。" },
  { zh: "汤力水", en: "Tonic Water", slug: "tonic-water", volume: "150ml", tags: ["草本", "清爽"], advice: "汤力水有奎宁苦味，怕苦要少量。" },
  { zh: "姜汁汽水", en: "Ginger Ale", slug: "ginger-ale", volume: "150ml", tags: ["辛香", "清爽"], advice: "姜味能遮住酒味，也会增加刺激感。" },
  { zh: "橙汁", en: "Orange Juice", slug: "orange-juice", volume: "150ml", tags: ["果香", "酸甜"], advice: "酸一点的橙汁更像鸡尾酒。" },
  { zh: "苹果汁", en: "Apple Juice", slug: "apple-juice", volume: "150ml", tags: ["果香", "甜润"], advice: "苹果汁偏甜，适合配苏打水拉轻。" },
  { zh: "菠萝汁", en: "Pineapple Juice", slug: "pineapple-juice", volume: "150ml", tags: ["果香", "酸甜"], advice: "菠萝汁热带感强，和朗姆特别稳。" },
  { zh: "蔓越莓汁", en: "Cranberry Juice", slug: "cranberry-juice", volume: "150ml", tags: ["果香", "酸甜"], advice: "蔓越莓酸甜明显，适合掩盖酒味。" },
  { zh: "葡萄汁", en: "Grape Juice", slug: "grape-juice", volume: "150ml", tags: ["果香", "甜润"], advice: "葡萄汁甜度高，基酒量要保守。" },
  { zh: "芒果汁", en: "Mango Juice", slug: "mango-juice", volume: "150ml", tags: ["果香", "甜润"], advice: "芒果汁浓稠，建议加冰或苏打水。" },
  { zh: "椰奶饮料", en: "Coconut Milk Drink", slug: "coconut-milk-drink", volume: "120ml", tags: ["奶香", "甜润"], advice: "椰奶会变厚重，适合少量基酒。" },
  { zh: "椰子水", en: "Coconut Water", slug: "coconut-water", volume: "150ml", tags: ["清爽", "低酒感"], advice: "椰子水清淡，适合轻酒感。" },
  { zh: "养乐多", en: "Yakult", slug: "yakult", volume: "100ml", tags: ["奶香", "低酒感"], advice: "养乐多很遮酒味，注意别喝太快。" },
  { zh: "可尔必思", en: "Calpis", slug: "calpis", volume: "120ml", tags: ["奶香", "酸甜"], advice: "酸甜乳酸感很新手友好。" },
  { zh: "酸奶饮品", en: "Yogurt Drink", slug: "yogurt-drink", volume: "120ml", tags: ["奶香", "甜润"], advice: "质地偏厚，适合加冰充分稀释。" },
  { zh: "奶茶", en: "Milk Tea", slug: "milk-tea", volume: "150ml", tags: ["奶香", "甜润"], advice: "奶茶甜度高，最好选择茶味重的款。" },
  { zh: "黑咖啡", en: "Black Coffee", slug: "black-coffee", volume: "120ml", tags: ["咖啡", "苦甜"], advice: "咖啡会放大苦味，适合威士忌或伏特加。" },
  { zh: "功能饮料", en: "Energy Drink", slug: "energy-drink", volume: "150ml", tags: ["清爽", "甜润"], advice: "功能饮料甜且刺激，建议小杯慢喝。" },
  { zh: "水溶C", en: "Vitamin C Drink", slug: "vitamin-c-drink", volume: "150ml", tags: ["酸甜", "果香"], advice: "酸甜度稳定，适合做低门槛长饮。" },
  { zh: "蜂蜜柚子茶", en: "Honey Citron Drink", slug: "honey-citron-drink", volume: "150ml", tags: ["果香", "甜润"], advice: "蜂蜜柚子偏甜，适合加苏打水。" },
  { zh: "冰糖雪梨", en: "Pear Drink", slug: "pear-drink", volume: "150ml", tags: ["甜润", "果香"], advice: "梨味柔和，适合白兰地、清酒和伏特加。" },
  { zh: "酸梅汤", en: "Sour Plum Drink", slug: "sour-plum-drink", volume: "150ml", tags: ["酸甜", "草本"], advice: "酸梅汤有烟熏和草本感，适合威士忌或梅酒。" },
];

const generatedConvenienceCocktails: InspirationCocktail[] = convenienceSpiritOptions.flatMap((spirit, spiritIndex) =>
  convenienceMixerOptions.map((mixer, mixerIndex) => {
    const id = `cv-${spirit.slug}-${mixer.slug}`;
    return {
      id,
      nameZh: `${spirit.zh}${mixer.zh}`,
      nameEn: `${spirit.en} ${mixer.en}`,
      description: `${spirit.zh}搭配${mixer.zh}的便利店特调，${spirit.intensity}，${mixer.advice}`,
      imageUrl: exploreImagePool[(spiritIndex + mixerIndex) % exploreImagePool.length],
      category: mixer.tags.includes("低酒感") ? "低酒感" : mixer.tags.includes("奶香") ? "奶香" : mixer.tags.includes("果香") ? "果香" : "便利店特调",
      baseSpirit: spirit.zh,
      tags: [spirit.zh, ...mixer.tags],
      ingredients: [spirit.zh, mixer.zh],
      href: `/inspiration/convenience-mix?cocktail=${id}`,
    };
  }),
);

const convenienceExploreCocktails: InspirationCocktail[] = dedupeCocktails([
  ...curatedConvenienceExploreCocktails,
  ...generatedConvenienceCocktails,
]);

export const BEGINNER_CATALOG: GuideDrink[] = [
  ...classicExploreCocktails.map(d => classify(d, "classic")),
  ...convenienceExploreCocktails.map(d => classify(d, "easy")),
].filter((d): d is GuideDrink => d !== null);

const getConvenienceRecipeGuide = (cocktail: InspirationCocktail): ConvenienceRecipeGuide => {
  const curated = convenienceRecipeGuides[cocktail.id];
  if (curated) return curated;

  const spirit = convenienceSpiritOptions.find((item) => item.zh === cocktail.baseSpirit);
  const mixer = convenienceMixerOptions.find((item) => cocktail.ingredients.includes(item.zh));
  const spiritAmount = spirit?.amount ?? (cocktail.baseSpirit === "啤酒" ? "180ml" : "30ml");
  const mixerVolume = mixer?.volume ?? "150ml";
  const mixerName = mixer?.zh ?? cocktail.ingredients[1] ?? "饮料";

  return {
    glass: cocktail.baseSpirit === "啤酒" ? "冰镇啤酒杯 / 高杯" : "高杯",
    ingredientLines: [
      `${cocktail.baseSpirit ?? cocktail.ingredients[0]} ${spirit?.en ?? ""} ${spiritAmount}`.trim(),
      `${mixerName} ${mixer?.en ?? ""} ${mixerVolume}`.trim(),
      "冰块 Ice 适量",
      "柠檬片 / 青柠角 可选",
    ],
    steps: [
      "杯中先加满冰块，杯子越冷越不容易显酒精冲。",
      `倒入${cocktail.baseSpirit ?? cocktail.ingredients[0]}，再加入${mixerName}。`,
      "用吧勺或普通勺子轻轻搅 2 圈，保留气泡和香气。",
    ],
    beginnerTips: [
      mixer?.advice ?? "第一次做先用小比例，觉得淡再补基酒。",
      "如果入口太烈，优先补冰块、苏打水或茶饮，不要直接加糖。",
      "如果太甜，加一点柠檬汁或无糖气泡水会更清爽。",
    ],
  };
};

function CocktailImage({ cocktail }: { cocktail: InspirationCocktail }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#eeeeec]">
      {!isLoaded && !hasError && <div className="absolute inset-0 animate-pulse bg-[#eeeeec]" />}
      {hasError ? (
        <div className="flex h-full w-full items-center justify-center bg-[#f1f1ef]">
          <span className="material-symbols-outlined text-4xl text-neutral-400">science</span>
        </div>
      ) : (
        <Image
          src={cocktail.imageUrl}
          alt={cocktail.nameZh}
          fill
          sizes="(max-width: 430px) 50vw, 190px"
          className={`object-cover transition-opacity duration-300 ${isLoaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
        />
      )}
    </div>
  );
}

const exploreCocktailToDrinkLogSnapshot = (cocktail: InspirationCocktail): DrinkLogRecipeSnapshot => ({
  id: cocktail.id,
  nameZh: cocktail.nameZh,
  nameEn: cocktail.nameEn,
  description: cocktail.description,
  imageUrl: cocktail.imageUrl,
  tags: [cocktail.category, ...cocktail.tags],
  sourcePage: cocktail.href.includes("convenience-mix") ? "convenience_mix" : cocktail.href.includes("classic-remix") ? "classic_remix" : "flavor",
});

const inspirationRecipeToDrinkLogSnapshot = (recipe: any): DrinkLogRecipeSnapshot => {
  const ingredients = recipe.ingredients ?? [];
  return {
    id: String(recipe.slug ?? recipe.id ?? recipe.titleEn ?? recipe.nameEn),
    nameZh: recipe.nameCn ?? recipe.titleCn ?? "未命名配方",
    nameEn: recipe.nameEn ?? recipe.titleEn,
    description: recipe.description,
    tags: recipe.tags?.map((item: any) => item.tag?.nameCn ?? item).filter(Boolean) ?? [],
    ingredients: ingredients.map((item: any) => ({
      name: item.ingredientNameCn ?? item.nameCn ?? item.nameSnapshot ?? item.name ?? "材料",
      amount: item.amount ?? item.amountMl,
      unit: item.unit ?? "ml",
    })),
    method: recipe.method,
  };
};

const hasDrinkLogForExploreCocktail = (cocktail: InspirationCocktail, drinkLogs: DrinkLog[]) => {
  const possibleRecipeIds = new Set([
    cocktail.id,
    `classic-original-${cocktail.id}`,
    `classic-remix-${cocktail.id}-custom`,
  ]);
  const nameZh = cocktail.nameZh.trim().toLowerCase();
  const nameEn = cocktail.nameEn.trim().toLowerCase();

  return drinkLogs.some((log) => {
    const snapshot = log.recipeSnapshot;
    return (
      possibleRecipeIds.has(log.recipeId) ||
      possibleRecipeIds.has(snapshot?.id ?? "") ||
      log.recipeName.trim().toLowerCase() === nameZh ||
      snapshot?.nameZh?.trim().toLowerCase() === nameZh ||
      snapshot?.nameEn?.trim().toLowerCase() === nameEn
    );
  });
};

type MixProblemCategory = "味道失衡" | "材料反应" | "口感质地" | "气泡与温度" | "便利店替代" | "操作失误";

type MixProblem = {
  id: string;
  category: MixProblemCategory;
  question: string;
  symptoms: string[];
  quickFix: string;
  reason: string;
  nextTime: string;
  tags: string[];
};

const mixProblemCategories: Array<MixProblemCategory | "全部"> = ["全部", "味道失衡", "材料反应", "口感质地", "气泡与温度", "便利店替代", "操作失误"];

const baseMixProblemLibrary: MixProblem[] = [
  {
    id: "too-sour",
    category: "味道失衡",
    question: "调得太酸了怎么办？",
    symptoms: ["柠檬/青柠味冲", "喝完口腔发紧", "果酸盖住酒香"],
    quickFix: "先补 10-15ml 糖浆、蜂蜜水或甜果汁，再加冰搅匀。如果已经很满，用苏打水 30ml 稀释后再调甜度。",
    reason: "酸味来自柠檬酸、苹果酸等有机酸。直接加水会变薄，少量糖分可以把尖锐酸感变圆。",
    nextTime: "酸味材料先从 10ml 开始加，尝过再补。新手做 sour 类配方时，酸和甜尽量成对调整。",
    tags: ["柠檬", "青柠", "酸甜平衡", "糖浆"],
  },
  {
    id: "too-sweet",
    category: "味道失衡",
    question: "喝起来像糖水，太甜了怎么救？",
    symptoms: ["腻", "香精感重", "喝两口就累"],
    quickFix: "加 10ml 柠檬汁或青柠汁，再补 30-60ml 无糖苏打水/乌龙茶。不要继续加果汁。",
    reason: "甜度过高时需要酸度和稀释一起介入；茶多酚或气泡能降低甜腻感。",
    nextTime: "甜饮料用量先减 1/3，甜味利口酒不要和高糖果汁大量叠加。",
    tags: ["高糖", "甜饮料", "苏打水", "乌龙茶"],
  },
  {
    id: "too-bitter",
    category: "味道失衡",
    question: "苦味太重怎么办？",
    symptoms: ["药苦", "草本味压人", "后味发涩"],
    quickFix: "补 20-40ml 橙汁、西柚汽水或甜味美思；如果是 Campari/苦精过量，优先加冰和气泡水拉开浓度。",
    reason: "苦味需要甜感、果香和稀释共同缓冲，单纯加水会让苦味显得更空。",
    nextTime: "苦味酒先按 5-15ml 加，不要一开始就倒到 30ml。",
    tags: ["苦精", "Campari", "金巴利", "草本"],
  },
  {
    id: "too-strong",
    category: "味道失衡",
    question: "酒感太冲、辣嗓子怎么办？",
    symptoms: ["入口辣", "酒精味盖住一切", "喉咙发热"],
    quickFix: "加满冰，补 60-90ml 苏打水、茶饮或果汁。不要再加高度酒，也不要靠糖硬压。",
    reason: "乙醇浓度高会带来灼热感，降 ABV 和降温最直接。",
    nextTime: "烈酒新手杯先用 20-30ml，长饮杯用 1 份酒配 3-4 份饮料更稳。",
    tags: ["烈酒", "ABV", "冰块", "长饮"],
  },
  {
    id: "flat-bubbles",
    category: "气泡与温度",
    question: "气泡感很快没了怎么办？",
    symptoms: ["不清爽", "像甜水", "气泡饮料变平"],
    quickFix: "换冷杯，加大冰块，最后再倒气泡水，轻轻提拉 1-2 下，不要用力搅。",
    reason: "温度高、搅拌过猛、糖分高都会让二氧化碳跑得更快。",
    nextTime: "气泡材料永远最后加；杯子和饮料提前冷藏。",
    tags: ["苏打水", "汤力水", "气泡", "冰"],
  },
  {
    id: "curdled-milk",
    category: "材料反应",
    question: "奶类/椰奶加进去结块了怎么办？",
    symptoms: ["絮状物", "看起来分离", "口感粗糙"],
    quickFix: "这杯不建议硬救。重新做时先把酸性材料减半，奶类最后加，并避免柠檬汁直接撞奶。",
    reason: "高酸会让乳蛋白变性凝结，椰奶/乳饮料也可能因为酸度和酒精出现分离。",
    nextTime: "奶类适合搭配咖啡、朗姆、威士忌、利口酒；尽量避开大量柠檬、青柠、西柚。",
    tags: ["奶", "椰奶", "乳酸", "结块"],
  },
  {
    id: "too-thick",
    category: "口感质地",
    question: "喝起来太厚、太腻怎么办？",
    symptoms: ["黏", "糊口", "奶感过重"],
    quickFix: "补 60ml 冰水、苏打水或无糖茶；如果甜腻明显，再加 5-10ml 柠檬汁。",
    reason: "厚重通常来自奶、椰奶、糖浆或浓稠果汁。稀释和轻微酸度能改善入口。",
    nextTime: "厚材料每杯先控制在 30-60ml，不要和糖浆、甜利口酒同时重手。",
    tags: ["椰奶", "糖浆", "奶茶", "质地"],
  },
  {
    id: "watery",
    category: "口感质地",
    question: "味道很水、没有层次怎么办？",
    symptoms: ["淡", "香气弱", "像冰水"],
    quickFix: "补 5-10ml 柠檬汁或糖浆，再加一小撮盐；如果有苦精，加 1-2 dash 即可。",
    reason: "淡不一定要加酒。少量酸、甜、盐能把风味边缘拉出来。",
    nextTime: "先放大冰，减少碎冰长时间融化；饮料用量分次加入。",
    tags: ["稀释", "冰块", "盐", "层次"],
  },
  {
    id: "tea-astringent",
    category: "材料反应",
    question: "茶饮调出来很涩怎么办？",
    symptoms: ["舌头发干", "茶味苦涩", "酒感变硬"],
    quickFix: "补 10ml 蜂蜜水或 30ml 果汁，必要时加冰稀释。不要再加浓茶。",
    reason: "茶多酚和酒精叠加会让涩感更明显，少量甜感可以柔化单宁感。",
    nextTime: "乌龙茶/绿茶更适合兑威士忌、梅酒、烧酒；茶越浓，酒越要少。",
    tags: ["乌龙茶", "绿茶", "单宁", "涩"],
  },
  {
    id: "coffee-bitter",
    category: "材料反应",
    question: "咖啡调酒太苦怎么办？",
    symptoms: ["焦苦", "后味重", "不顺口"],
    quickFix: "加 15ml 奶或 10ml 糖浆；如果有橙汁/柠檬，先别加，酸和咖啡苦容易打架。",
    reason: "咖啡苦味来自烘焙苦味物质，奶脂和糖能包裹苦感。",
    nextTime: "咖啡更适合配威士忌、朗姆、白兰地、咖啡利口酒，少配高酸果汁。",
    tags: ["咖啡", "苦味", "奶", "糖浆"],
  },
  {
    id: "bad-fruit-spirit",
    category: "便利店替代",
    question: "果汁和基酒不搭怎么办？",
    symptoms: ["香精味", "酒味突出", "果味发闷"],
    quickFix: "补气泡水拉长，或加 5-10ml 柠檬汁提亮。热带果汁可补朗姆，柑橘果汁可补金酒/伏特加。",
    reason: "果汁酸甜比和基酒香气方向不一致时，会显得割裂。",
    nextTime: "金酒配柑橘/西柚，伏特加配橙/蔓越莓，朗姆配菠萝/椰子，威士忌配苹果/茶更稳。",
    tags: ["果汁", "基酒", "搭配", "便利店"],
  },
  {
    id: "no-shaker",
    category: "操作失误",
    question: "没有摇壶怎么办？",
    symptoms: ["想做酸甜酒", "材料混不匀", "没有工具"],
    quickFix: "用带盖杯/保温杯短摇 8-10 秒；没有盖子就改成杯中加冰搅拌，选择长饮比例。",
    reason: "摇合主要用于降温、稀释和混合果汁/糖浆/蛋白。没有工具时可降级成长饮。",
    nextTime: "便利店做法优先选 build in glass：酒 + 冰 + 饮料直接杯中完成。",
    tags: ["工具", "摇壶", "搅拌", "便利店"],
  },
  {
    id: "wrong-order",
    category: "操作失误",
    question: "材料顺序倒错了怎么办？",
    symptoms: ["分层失败", "味道不均匀", "气泡消失"],
    quickFix: "非气泡酒可以重新加冰轻搅；气泡酒不要猛搅，只轻轻提拉几下。",
    reason: "气泡、奶类、糖浆和酸的顺序会影响溶解、起泡和分离。",
    nextTime: "一般顺序：冰块 → 基酒 → 果汁/茶/奶 → 糖/酸微调 → 气泡最后加。",
    tags: ["顺序", "气泡", "分层", "操作"],
  },
  {
    id: "too-warm",
    category: "气泡与温度",
    question: "酒不够冰，喝起来不好喝怎么办？",
    symptoms: ["酒精味重", "甜腻", "不清爽"],
    quickFix: "换满杯大冰块，静置 30 秒再轻搅；气泡饮料和杯子尽量冷藏。",
    reason: "低温会降低酒精刺激感，也会让甜味显得更干净。",
    nextTime: "便利店调酒先买冰杯或大冰块，冰量宁多不少。",
    tags: ["温度", "冰杯", "酒感", "清爽"],
  },
  {
    id: "substitute-lime",
    category: "便利店替代",
    question: "没有青柠怎么替代？",
    symptoms: ["配方需要青柠", "便利店买不到"],
    quickFix: "用黄柠檬汁代替，先按原量 70% 加；也可以用西柚汁加少量柠檬饮料替代清爽酸感。",
    reason: "青柠更尖锐、香气更绿；黄柠檬酸感相近但香气更圆。",
    nextTime: "没有青柠时，不要用甜柠檬茶完全替代，糖分会改变配方结构。",
    tags: ["青柠", "柠檬", "替代", "酸"],
  },
  {
    id: "energy-drink",
    category: "便利店替代",
    question: "功能饮料能不能兑酒？",
    symptoms: ["想用红牛/Monster", "怕太刺激"],
    quickFix: "可以少量搭配伏特加或朗姆，但建议控制酒量，避免和咖啡再叠加。",
    reason: "咖啡因和酒精同饮容易让人低估醉意，也可能增加心悸不适。",
    nextTime: "每杯用 30ml 烈酒以内，功能饮料 90-120ml，慢慢喝。",
    tags: ["功能饮料", "咖啡因", "安全", "伏特加"],
  },
];

type MixProblemSeed = [
  string,
  MixProblemCategory,
  string,
  string[],
  string,
  string,
  string,
  string[],
];

const extraMixProblemSeeds: MixProblemSeed[] = [
  ["gin-tonic-too-bitter", "味道失衡", "金汤力喝起来太苦怎么办？", ["汤力苦", "金酒草本重"], "补 10-20ml 柠檬汽水或苏打水，再加一片柠檬皮提香。", "汤力水里的奎宁苦和金酒杜松草本会叠加。", "先用 1:3 或 1:4 的金酒汤力比例，新手不要用重苦汤力。", ["金酒", "汤力水", "奎宁"]],
  ["gin-tonic-too-perfume", "味道失衡", "金酒味像香水怎么办？", ["花香刺鼻", "草本冲"], "补冰和苏打水拉长，或加 10ml 西柚汁压住香水感。", "部分金酒花香、香料感强，浓度高时容易显得刺鼻。", "选伦敦干金酒或降低金酒到 20ml 起步。", ["金酒", "花香", "西柚"]],
  ["whisky-cola-too-sweet", "味道失衡", "威士忌可乐太甜怎么办？", ["可乐味重", "威士忌消失"], "加 30-60ml 苏打水，挤一点柠檬；不要继续补可乐。", "可乐糖分和焦糖香会盖住威士忌桶味。", "用无糖可乐或威士忌 30ml 配可乐 90ml 起步。", ["威士忌", "可乐", "无糖"]],
  ["whisky-oolong-too-dry", "味道失衡", "威士忌乌龙太干涩怎么办？", ["茶涩", "木味重"], "补 10ml 蜂蜜水或 20ml 苹果汁，再加冰轻搅。", "乌龙茶多酚和威士忌木桶单宁会增强干涩。", "淡乌龙比浓茶更稳，威士忌别超过 30ml。", ["威士忌", "乌龙茶", "蜂蜜"]],
  ["vodka-orange-flat", "味道失衡", "伏特加橙汁喝起来很平怎么办？", ["只有甜橙", "没层次"], "加 5-10ml 柠檬汁和一小撮盐，或补少量苏打水。", "伏特加中性，橙汁如果酸度低会显得单薄。", "橙汁选酸甜明显的，必要时配柠檬。", ["伏特加", "橙汁", "盐"]],
  ["rum-cola-medicinal", "味道失衡", "朗姆可乐有药味怎么办？", ["药感", "香料冲"], "加更多冰和一片柠檬，或补 20ml 苏打水降低浓度。", "深色朗姆的香料、焦糖和可乐香料叠加会发闷。", "用白朗姆更清爽，深色朗姆减到 20ml。", ["朗姆", "可乐", "柠檬"]],
  ["tequila-grapefruit-salty", "味道失衡", "龙舌兰西柚太咸/太苦怎么办？", ["盐味重", "西柚苦"], "补 20-40ml 苏打水和 5ml 糖浆，盐边先擦掉一半。", "盐会放大西柚苦味和龙舌兰矿物感。", "盐边只蘸半圈，西柚汽水优先选低苦款。", ["龙舌兰", "西柚", "盐"]],
  ["soju-yakult-too-sweet", "味道失衡", "烧酒养乐多太甜怎么办？", ["乳酸甜腻", "像饮料"], "加 60ml 苏打水或冰块，想清爽再加 5ml 柠檬汁。", "乳酸饮料糖分高，烧酒本身也可能带甜味。", "烧酒:养乐多:苏打可用 1:1:2。", ["烧酒", "养乐多", "苏打"]],
  ["beer-cocktail-watery", "味道失衡", "啤酒特调像水怎么办？", ["啤酒淡", "果味散"], "加 10ml 柠檬汁或 20ml 浓果汁，不要再加冰水。", "啤酒本身低酒精，果汁过多会稀释麦芽骨架。", "啤酒为主体时，果汁控制在 30-60ml。", ["啤酒", "果汁", "麦芽"]],
  ["wine-spritz-too-sour", "味道失衡", "葡萄酒加气泡后太酸怎么办？", ["酸尖", "涩感"], "补 10ml 糖浆或 30ml 甜橙汁，再加冰稀释。", "葡萄酒酸和碳酸会叠加酸感。", "酸型白葡萄酒做 spritz 时用甜一点的气泡饮。", ["葡萄酒", "气泡", "酸"]],
  ["aperol-spritz-too-bitter", "味道失衡", "Aperol Spritz 还是觉得苦怎么办？", ["苦橙", "草本"], "减少 Aperol，补 30ml 橙汁或甜气泡水。", "开胃酒苦味来自苦橙和草本，低温能缓和但不能消除。", "Aperol 新手比例先从 20ml 开始。", ["Aperol", "苦橙", "气泡"]],
  ["negroni-too-heavy", "味道失衡", "内格罗尼太重口怎么办？", ["苦", "烈", "药感"], "加满冰后补 60-90ml 苏打水，做成长饮版本。", "内格罗尼是三种酒等比，酒精和苦味都集中。", "新手先做 Negroni Spritz，不要直接喝原版。", ["内格罗尼", "金巴利", "苏打"]],
  ["margarita-too-sharp", "味道失衡", "玛格丽特太尖锐怎么办？", ["酸辣", "盐重"], "加 5-10ml 糖浆或橙汁，盐边减少。", "青柠酸、龙舌兰酒精和盐会形成很尖的入口。", "青柠先减 1/3，甜橙利口酒不要省掉。", ["玛格丽特", "青柠", "盐"]],
  ["mojito-muddy", "味道失衡", "莫吉托喝起来像薄荷草水怎么办？", ["薄荷苦", "草味"], "补 10ml 糖浆和 30ml 苏打水，停止继续捣薄荷。", "薄荷捣太碎会释放草腥和苦味。", "薄荷只轻拍或轻压，不要捣成泥。", ["莫吉托", "薄荷", "朗姆"]],
  ["old-fashioned-too-sweet", "味道失衡", "古典老式太甜怎么办？", ["糖浆重", "威士忌弱"], "加冰搅拌稀释，再补 5ml 威士忌或 1 dash 苦精。", "Old Fashioned 需要糖、苦和威士忌平衡，糖多会发腻。", "糖浆从 5ml 开始，边搅边尝。", ["Old Fashioned", "威士忌", "苦精"]],
  ["martini-too-dry", "味道失衡", "马天尼太干太烈怎么办？", ["烈", "干", "刺"], "补 10-15ml 味美思或加冰继续搅拌稀释。", "干马天尼基酒占比高，温度和稀释不足会很硬。", "新手先做湿马天尼，金酒:味美思用 2:1。", ["马天尼", "金酒", "味美思"]],
  ["campari-overdose", "操作失误", "金巴利倒多了怎么救？", ["红色苦味", "药感强"], "把这杯改成长饮：补 90ml 苏打水或橙汁，加满冰。", "金巴利苦味强，少量过量就会主导整杯。", "用量杯，先 15ml 再决定是否补。", ["金巴利", "苦味", "长饮"]],
  ["lime-overdose", "操作失误", "柠檬/青柠倒太多了怎么办？", ["酸到皱眉", "喉咙刺激"], "补糖浆 10ml，再补水或苏打 30-60ml。", "酸过量需要甜度和稀释同时修正。", "酸汁不要直接倒瓶口，用勺或量杯。", ["柠檬", "青柠", "酸"]],
  ["syrup-overdose", "操作失误", "糖浆倒太多了怎么办？", ["黏甜", "发腻"], "加酸 10ml，再补冰和无糖饮料拉长。", "糖浆会增加甜度和黏度，单靠冰不一定救得回来。", "糖浆先 5ml 加，甜饮料里通常不再加糖。", ["糖浆", "甜", "稠"]],
  ["spirit-overpour", "操作失误", "基酒手滑倒多了怎么办？", ["酒很冲", "比例失控"], "直接拆成两杯，各自补饮料和冰。不要试图一杯硬救。", "高度酒过量时总量会超杯，拆杯最稳。", "烈酒先倒进量杯，不要直接进成品杯。", ["基酒", "过量", "拆杯"]],
  ["forgot-ice", "操作失误", "忘记加冰已经调好了怎么办？", ["温", "酒感重"], "加满大冰轻搅 20 秒，必要时过滤到新杯。", "冰不仅降温，也提供必要稀释。", "先放冰再倒酒，是便利店调酒最稳顺序。", ["冰块", "温度", "稀释"]],
  ["over-stirred", "操作失误", "搅拌太久变淡了怎么办？", ["水味", "香气弱"], "补 5ml 基酒或 5ml 糖浆/酸微调，不要再继续搅。", "搅拌过久会让冰融化过多。", "搅拌 10-20 秒足够，碎冰时间更短。", ["搅拌", "稀释", "冰"]],
  ["over-shaken", "操作失误", "摇太久味道散了怎么办？", ["泡沫多", "变薄"], "静置 30 秒后倒出，补少量香气材料如柑橘皮或果汁。", "摇合过久会过度稀释并打入太多空气。", "普通酸甜酒摇 8-12 秒即可。", ["摇合", "稀释", "泡沫"]],
  ["forgot-sweetener", "操作失误", "忘记加糖，酸酒很硬怎么办？", ["酸", "不圆润"], "补 5-10ml 糖浆后再短摇或搅匀。", "酸甜酒需要糖提供圆润感和结构。", "Sour 类配方记住：酒、酸、甜三件套。", ["糖浆", "酸甜", "Sour"]],
  ["wrong-glass-size", "操作失误", "杯子太大显得酒很少怎么办？", ["看起来空", "冰融快"], "加冰填满空间，改成长饮并补气泡水。", "大杯留空会升温快，香气也散。", "小容量短饮用矮杯，大容量长饮用高杯。", ["杯型", "长饮", "冰"]],
  ["no-measure", "操作失误", "没有量杯怎么估算？", ["比例不准", "容易过量"], "用瓶盖或勺子估算：普通汤匙约 15ml，先少加再补。", "调酒最容易翻车的是比例，不是材料。", "建立自己的估算单位，固定同一只勺/盖。", ["量杯", "比例", "新手"]],
  ["layering-failed", "操作失误", "分层失败混在一起怎么办？", ["颜色混浊", "层次没了"], "不要硬分层，改成搅匀杯，补冰和装饰提升观感。", "分层依赖糖度和密度，倒法不稳就会混。", "高糖材料在下，轻的酒在上，用勺背慢倒。", ["分层", "密度", "倒法"]],
  ["salt-rim-too-much", "操作失误", "盐边太多太咸怎么办？", ["咸", "盖味"], "用纸巾擦掉半圈盐边，或换杯。", "盐能放大酸和苦，太多会毁掉平衡。", "盐边只做半圈，方便用户选择喝不喝盐。", ["盐边", "玛格丽特", "咸"]],
  ["mint-crushed", "操作失误", "薄荷捣碎了很苦怎么办？", ["草苦", "绿色碎渣"], "过滤掉薄荷碎，补苏打水和糖浆。", "薄荷叶脉破碎会释放苦味和草腥。", "薄荷只拍醒香气，不要像捣蒜一样捣。", ["薄荷", "苦", "莫吉托"]],
  ["citrus-pith", "操作失误", "柑橘皮发苦怎么办？", ["白瓤苦", "涩"], "把皮取出，补一点糖或果汁。", "白色皮瓤含苦味物质，泡久会苦。", "只取彩色外皮，避免白瓤。", ["橙皮", "柠檬皮", "苦"]],
  ["ice-smell", "材料反应", "冰块有冰箱味怎么办？", ["异味", "塑料味"], "换新冰或用冷藏饮料降温，这杯尽量加柑橘皮遮味。", "冰很容易吸附冰箱异味。", "冰块密封保存，别和熟食放一起。", ["冰块", "异味", "保存"]],
  ["coke-foam-overflow", "气泡与温度", "可乐一倒就大量起泡怎么办？", ["泡沫溢出", "气跑掉"], "等泡沫落下再补，沿杯壁慢倒，别直接冲冰块。", "碳酸撞冰和糖浆会快速放气。", "气泡饮料最后加，杯子倾斜慢倒。", ["可乐", "气泡", "倒法"]],
  ["soda-over-diluted", "气泡与温度", "苏打水加多了没味怎么办？", ["淡", "只有气"], "补 5ml 酸或 10ml 果汁浓缩味道，不要再加苏打。", "苏打水只有气泡和稀释，没有风味主体。", "苏打水分两次加，先 60ml 尝味。", ["苏打水", "淡", "长饮"]],
  ["tonic-too-sweet", "气泡与温度", "汤力水太甜怎么办？", ["甜苦", "腻"], "换一半无糖苏打水，或加 5ml 柠檬汁。", "普通汤力水含糖，甜和苦会一起上来。", "选低糖汤力，或汤力:苏打 1:1。", ["汤力水", "糖", "金酒"]],
  ["warm-beer", "气泡与温度", "啤酒不冰做特调好难喝怎么办？", ["麦味闷", "苦味重"], "加冰杯降温，补柠檬或西柚汽水提高清爽感。", "啤酒升温后麦芽甜和苦味都会变明显。", "啤酒特调必须冷藏，冰杯优先。", ["啤酒", "温度", "西柚"]],
  ["hot-weather-melt", "气泡与温度", "夏天冰化太快怎么办？", ["越喝越淡", "杯壁水"], "用大冰块，减少碎冰；气泡水分次补。", "小冰表面积大，融化速度快。", "便利店买冰杯时选大块冰或多杯分装。", ["夏天", "冰", "稀释"]],
  ["freezer-spirit", "气泡与温度", "烈酒冰过头会没香气吗？", ["香气弱", "入口冷硬"], "可以稍微回温 2-3 分钟，再加配料。", "低温会压低挥发性香气。", "伏特加可冷冻，威士忌/金酒不必冻太狠。", ["冷冻", "香气", "烈酒"]],
  ["shaker-stuck", "气泡与温度", "摇壶打不开怎么办？", ["卡住", "打不开"], "轻拍金属连接处，或用温水冲外层 5 秒。", "低温让金属收缩形成负压。", "摇完先拍开，不要用蛮力拧。", ["摇壶", "低温", "工具"]],
  ["too-much-foam", "气泡与温度", "泡沫太多影响口感怎么办？", ["泡沫厚", "喝不到酒"], "静置 30 秒，用勺子轻轻刮掉多余泡沫。", "摇合含蛋白、奶或气泡材料会产生泡沫。", "气泡材料不要进摇壶，最后倒。", ["泡沫", "摇合", "气泡"]],
  ["milk-with-citrus", "材料反应", "牛奶和柠檬能一起调吗？", ["怕结块", "酸奶状"], "不建议直接混。若要做乳清澄清，需要单独过滤，不适合快速便利店做法。", "酸会让乳蛋白凝结。", "奶类配咖啡、巧克力、朗姆更安全。", ["牛奶", "柠檬", "乳蛋白"]],
  ["yakult-with-citrus", "材料反应", "养乐多再加柠檬会不会太酸？", ["乳酸明显", "酸叠酸"], "可以少量加 3-5ml，主要用来提亮，不要当酸汁主体。", "乳酸饮料本身已有酸甜结构。", "养乐多特调优先用苏打水拉长。", ["养乐多", "乳酸", "柠檬"]],
  ["coconut-separation", "材料反应", "椰奶分层浮油怎么办？", ["油花", "分离"], "先充分摇匀椰奶罐/瓶，再和酒搅拌；已分离可加冰短摇。", "椰脂和水相容易分离。", "椰奶开封前摇匀，避免高酸材料。", ["椰奶", "分层", "朗姆"]],
  ["juice-pulp-settling", "材料反应", "果粒沉底怎么办？", ["果肉沉底", "口感不均"], "喝前轻搅，或用吸管从底部翻动。", "果肉密度高，静置会沉降。", "果粒饮料适合短时间喝完。", ["果粒橙", "果肉", "沉底"]],
  ["tea-milk-curdle", "材料反应", "奶茶加酒后怪怪的怎么办？", ["奶味发酸", "香精重"], "补冰和一点咖啡或可可风味，不要再加柠檬。", "奶茶里奶精、茶多酚、糖和酒精会让口感复杂。", "奶茶更适合少量朗姆/威士忌，不适合高酸果汁。", ["奶茶", "酒精", "茶"]],
  ["protein-drink-alcohol", "材料反应", "蛋白饮料能兑酒吗？", ["粉感", "结块风险"], "不建议。若已混合，补冰稀释后尽快喝，别加酸。", "蛋白质遇酸和酒精可能变性，粉感会更明显。", "想要奶感选牛奶、椰奶或咖啡乳饮。", ["蛋白饮料", "结块", "奶"]],
  ["vinegar-too-much", "材料反应", "果醋加多了怎么办？", ["醋味", "呛鼻"], "补甜果汁和冰，必要时拆成两杯。", "醋酸挥发性强，少量就很明显。", "果醋只用 5-10ml 做提亮，不当果汁用。", ["果醋", "醋酸", "酸"]],
  ["herbal-tea-conflict", "材料反应", "草本茶和金酒打架怎么办？", ["香气乱", "药草味"], "补苏打水拉淡，或加柠檬皮统一香气。", "金酒已有草本结构，草本茶会叠加过多方向。", "金酒优先配清爽茶或柑橘，不要配太复杂花草茶。", ["草本茶", "金酒", "香气"]],
  ["coffee-citrus-clash", "材料反应", "咖啡和橙汁为什么怪？", ["酸苦冲突", "像变质"], "补糖和冰可以缓和，但不建议继续加酒。", "咖啡苦味和柑橘酸容易形成不协调的酸苦。", "咖啡调酒优先配奶、朗姆、威士忌。", ["咖啡", "橙汁", "酸苦"]],
  ["baijiu-fruit-clash", "材料反应", "白酒兑果汁很冲怎么办？", ["酒香穿透", "果汁压不住"], "加茶饮或酸梅汤拉住香气，果汁只做辅助。", "白酒酯类香气强，轻果汁很难盖住。", "白酒新手先用 10-15ml，配乌龙茶/酸梅汤。", ["白酒", "果汁", "酸梅汤"]],
  ["sake-citrus-thin", "材料反应", "清酒加柠檬后变薄怎么办？", ["米香没了", "酸水感"], "补一点糖浆或梅酒，减少柠檬比例。", "清酒米香柔，强酸会切断圆润感。", "清酒适合柚子、苏打、乌龙茶，酸要少。", ["清酒", "柠檬", "米香"]],
  ["umeshu-too-sweet", "材料反应", "梅酒太甜腻怎么办？", ["梅子甜", "黏"], "加苏打水 90ml 和冰，或加乌龙茶 60ml。", "梅酒糖分高，直接喝或加甜饮会腻。", "梅酒优先做梅酒苏打或梅酒乌龙。", ["梅酒", "苏打", "乌龙"]],
  ["liqueur-too-syrupy", "材料反应", "利口酒像糖浆怎么办？", ["甜厚", "香精"], "把利口酒当调味，只留 10-15ml，补基酒和酸。", "利口酒糖分高，单独作为主体会过甜。", "利口酒用来点香，不要当饮料主体。", ["利口酒", "糖", "调味"]],
  ["absinthe-too-strong", "材料反应", "苦艾酒一加就全是茴香怎么办？", ["茴香重", "酒精高"], "苦艾只保留 2-5ml 或洗杯，补冰水稀释。", "苦艾酒精和茴香脑都很强。", "苦艾用于点缀，不适合作为便利店主基酒。", ["苦艾", "茴香", "高酒精"]],
  ["thin-mouthfeel", "口感质地", "入口太薄，没有酒吧那种厚度怎么办？", ["水感", "挂杯弱"], "加 5ml 糖浆或蜂蜜水，提高一点黏度。", "糖分和适度稀释会增加圆润感。", "酸甜酒需要糖提供 body，不是只靠酒。", ["口感", "糖浆", "厚度"]],
  ["sticky-mouthfeel", "口感质地", "喝完嘴巴发黏怎么办？", ["黏口", "甜腻"], "补酸和苏打水，降低糖浓度。", "高糖饮料、糖浆、利口酒叠加会黏口。", "同一杯里高糖材料最多选 1-2 个。", ["黏", "糖", "苏打"]],
  ["grainy-texture", "口感质地", "有粉感/颗粒感怎么办？", ["粉末", "沉淀"], "过滤或静置后倒上层；不要加气泡去冲。", "粉末饮料、可可、蛋白粉不易完全溶解。", "粉类先用少量温水化开，再冷却调酒。", ["粉感", "可可", "蛋白"]],
  ["oily-surface", "口感质地", "表面有油膜怎么办？", ["油花", "视觉差"], "加冰短摇或过滤；味道正常可以喝但观感差。", "椰脂、咖啡油脂、柑橘精油都可能浮在表面。", "油脂类材料用量少一点，避免高酸。", ["油膜", "椰奶", "咖啡"]],
  ["pulp-too-much", "口感质地", "果肉太多影响喝怎么办？", ["堵吸管", "沉淀"], "用滤网过滤或改用宽口杯。", "果粒饮料不是调酒果汁，质地更重。", "需要清爽感时选无果肉果汁。", ["果肉", "过滤", "果汁"]],
  ["jelly-drink", "口感质地", "果冻饮料能不能调酒？", ["太稠", "吸不上来"], "可以做甜品杯，不适合常规鸡尾酒；加苏打会很怪。", "胶体质地和气泡、酒精混合不稳定。", "果冻饮料只少量做装饰或甜点方向。", ["果冻", "质地", "甜品"]],
  ["cream-too-heavy", "口感质地", "奶油/厚乳调出来太撑怎么办？", ["饱腹", "腻"], "加咖啡或冰稀释，不要加柠檬。", "脂肪和糖同时高，入口厚重。", "厚乳每杯 30ml 左右即可。", ["厚乳", "奶油", "咖啡"]],
  ["smoothness-low", "口感质地", "为什么这杯不顺口？", ["割裂", "刺激"], "先确认酸甜平衡，再加冰稀释；最后用一点盐提味。", "不顺口常来自酸、甜、酒精、温度同时失衡。", "每次只改一个变量，别同时猛加多种材料。", ["顺口", "平衡", "盐"]],
  ["aftertaste-bad", "口感质地", "后味难喝怎么处理？", ["苦尾", "香精尾"], "加柑橘皮、薄荷或茶饮拉尾韵。", "后味多来自苦味、人工香精或酒精质量。", "选风味干净的饮料，避免多个香精品牌叠加。", ["后味", "香精", "柑橘皮"]],
  ["smell-too-alcoholic", "口感质地", "闻起来酒味很大怎么办？", ["冲鼻", "乙醇味"], "加冰降温，用柑橘皮或薄荷增加表层香气。", "酒精挥发会先进入鼻腔，温度越高越明显。", "短饮要冷，长饮要有香气遮盖。", ["酒味", "香气", "温度"]],
  ["color-ugly", "口感质地", "颜色变得很丑怎么办？", ["灰褐色", "浑浊"], "不要再追求透明，改成加冰和装饰的混合风格。", "茶、咖啡、红果汁、奶混合常变灰。", "想要好看颜色，最多选一个深色材料。", ["颜色", "浑浊", "装饰"]],
  ["cloudy-drink", "口感质地", "酒变浑浊是坏了吗？", ["白雾", "浑浊"], "如果是柑橘油、果汁或奶导致，通常不是坏；有异味就不要喝。", "酸、油脂、果胶和低温都可能造成浑浊。", "想要清澈就避开果肉、奶和椰子类。", ["浑浊", "果胶", "安全"]],
  ["no-lemon", "便利店替代", "没有柠檬怎么办？", ["缺酸", "便利店买不到"], "用青柠、西柚汁、无糖柠檬气泡水或少量果醋替代。", "核心是补酸和柑橘香，不一定必须鲜柠檬。", "甜柠檬茶不能等量替代柠檬汁。", ["柠檬", "替代", "西柚"]],
  ["no-soda", "便利店替代", "没有苏打水怎么办？", ["想做长饮", "缺气泡"], "用无糖气泡水、汤力水或低糖柠檬气泡水；汤力要注意苦和甜。", "苏打水负责稀释和气泡，不主要提供味道。", "替代时同步调整甜度和苦味。", ["苏打水", "气泡水", "汤力"]],
  ["no-tonic", "便利店替代", "没有汤力水怎么做金汤力？", ["缺汤力", "只有苏打"], "用苏打水加一点柠檬/西柚和少量糖，做清爽金酒长饮。", "汤力的苦来自奎宁，没有时不能完全复刻。", "没有汤力就不要强叫 G&T，做 Gin Soda 更稳。", ["汤力", "金酒", "苏打"]],
  ["no-cranberry", "便利店替代", "没有蔓越莓汁怎么办？", ["想做海风/伏特加蔓越莓"], "用石榴汁、葡萄汁加柠檬，或西柚汁替代酸甜红果感。", "蔓越莓特点是酸涩红果，不只是红色。", "替代时加一点柠檬找回酸度。", ["蔓越莓", "石榴", "伏特加"]],
  ["no-orange-liqueur", "便利店替代", "没有橙味利口酒怎么办？", ["想做玛格丽特", "缺 Cointreau"], "用橙汁 15ml 加少量糖浆替代，但酒体会更轻。", "橙味利口酒同时提供酒精、甜和橙皮香。", "家庭版可以接受替代，但要减少额外糖。", ["橙味利口", "玛格丽特", "替代"]],
  ["no-vermouth", "便利店替代", "没有味美思怎么办？", ["想做马天尼/内格罗尼"], "可以暂时改做金酒苏打或威士忌高球，不建议硬替。", "味美思是加香葡萄酒，风味结构很特殊。", "经典酒缺关键材料时，改配方比硬替更好喝。", ["味美思", "马天尼", "内格罗尼"]],
  ["no-campari", "便利店替代", "没有金巴利怎么做苦甜酒？", ["缺苦味", "想做内格罗尼"], "用 Aperol 或其他苦味开胃酒替代，甜度和苦度会变轻。", "不同苦味酒的草本配方差异很大。", "替代后先少加，再用苏打水拉长。", ["金巴利", "Aperol", "苦味"]],
  ["no-rum", "便利店替代", "没有朗姆怎么做椰香/菠萝酒？", ["缺朗姆", "热带风味"], "用伏特加可做干净版，用威士忌会更厚重但不热带。", "朗姆的甘蔗和焦糖香是热带感来源。", "椰奶菠萝优先配朗姆，替代时降低期待。", ["朗姆", "椰奶", "菠萝"]],
  ["no-gin", "便利店替代", "没有金酒怎么做清爽草本酒？", ["缺金酒", "想要清爽"], "用伏特加加黄瓜/柠檬皮做干净版，草本感会少。", "金酒的杜松子风味难完全替代。", "没有金酒就做 Vodka Soda 或茶饮长饮。", ["金酒", "伏特加", "黄瓜"]],
  ["no-whisky", "便利店替代", "没有威士忌怎么做高球？", ["缺威士忌", "想做 Highball"], "用烧酒或金酒可以做轻爽长饮，但不是威士忌高球。", "威士忌高球核心是桶陈谷物香。", "高球类配方要尊重基酒风味，不要硬替。", ["威士忌", "高球", "替代"]],
  ["no-yakult", "便利店替代", "没有养乐多怎么做乳酸特调？", ["缺乳酸", "想做烧酒养乐多"], "用可尔必思、水语、乳酸菌饮料替代，糖度不同要调苏打水。", "乳酸饮料提供酸甜和奶感。", "先尝替代品甜度，再决定是否加苏打。", ["养乐多", "可尔必思", "乳酸"]],
  ["no-ice", "便利店替代", "没有冰块还能调吗？", ["无冰", "温"], "可以做常温兑饮，但不建议做烈酒短饮；优先买冰杯。", "冰负责降温和稀释，是基础材料。", "便利店调酒把冰当必买材料。", ["冰块", "冰杯", "便利店"]],
  ["cheap-spirit-harsh", "便利店替代", "便宜烈酒很冲怎么办？", ["酒精味", "辣"], "做成长饮，多冰、多饮料、加柑橘；不要做纯饮短饮。", "粗糙酒精需要稀释和香气遮盖。", "预算有限时选伏特加长饮或朗姆可乐更稳。", ["便宜酒", "烈酒", "长饮"]],
  ["rtd-too-sweet", "便利店替代", "预调酒太甜还能改吗？", ["RIO", "微醺", "甜"], "加冰和无糖苏打水稀释，别再加糖和甜果汁。", "预调酒已经完成调味，通常糖分较高。", "把预调酒当 mixer，不要再叠甜。", ["预调酒", "RIO", "苏打"]],
  ["hard-seltzer-too-light", "便利店替代", "酒精气泡水太淡怎么办？", ["没酒感", "味道轻"], "加 15-20ml 伏特加或金酒，或补柠檬提香。", "Hard seltzer 本来就是低糖低风味。", "想要明显酒味，需要加少量基酒。", ["Hard Seltzer", "伏特加", "低糖"]],
  ["lemon-tea-with-whisky", "便利店替代", "柠檬茶兑威士忌会不会太甜？", ["甜茶", "威士忌"], "可以兑，但用量别太大，必要时加冰和无糖茶。", "柠檬茶糖分高，会让威士忌变成甜茶酒。", "威士忌:柠檬茶从 1:3 开始。", ["柠檬茶", "威士忌", "甜"]],
  ["oolong-with-baijiu", "便利店替代", "乌龙茶兑白酒怎么不冲？", ["白酒强", "茶香"], "白酒只用 10-15ml，乌龙茶 120ml，加满冰。", "白酒香气穿透力强，必须降低比例。", "白酒便利店特调先做低酒感。", ["白酒", "乌龙茶", "低酒感"]],
  ["coconut-water-vs-milk", "便利店替代", "椰子水和椰奶怎么选？", ["不知道选哪个", "椰香"], "想清爽选椰子水，想顺滑甜香选椰奶。", "椰子水低脂轻薄，椰奶脂肪和甜感更高。", "朗姆菠萝适合椰奶，金酒清爽杯适合椰子水。", ["椰子水", "椰奶", "朗姆"]],
  ["fruit-tea-mixer", "便利店替代", "水果茶能不能当 mixer？", ["果茶", "茶味"], "可以，但先确认甜度；高糖水果茶需要加苏打水稀释。", "水果茶同时有糖、酸、茶涩，变量较多。", "优先配伏特加、烧酒，不要配复杂草本酒。", ["水果茶", "伏特加", "烧酒"]],
  ["sparkling-water-flavor", "便利店替代", "有味气泡水怎么用？", ["白桃", "西柚", "青柠"], "按它的香气配基酒：柑橘配金酒，莓果配伏特加，热带配朗姆。", "有味气泡水香气轻，适合做长饮骨架。", "选择无糖款更容易控制甜度。", ["气泡水", "香气", "无糖"]],
  ["sour-plum-baijiu", "便利店替代", "酸梅汤兑白酒太怪怎么办？", ["酸梅重", "白酒冲"], "白酒减半，补冰和乌龙茶；酸梅汤不要太浓。", "酸梅烟熏酸甜和白酒酯香都很强。", "白酒酸梅汤要低酒量、多冰、慢慢调。", ["酸梅汤", "白酒", "乌龙"]],
  ["tomato-beer-flat", "便利店替代", "番茄汁啤酒不好喝怎么办？", ["咸酸", "像汤"], "加柠檬和冰，少量辣椒盐可提味；不喜欢咸鲜就别硬救。", "番茄汁是咸鲜方向，不是所有人都适应。", "先用少量番茄汁 30ml 测试。", ["番茄汁", "啤酒", "咸鲜"]],
  ["ginger-ale-too-spicy", "便利店替代", "姜汁汽水太辣怎么办？", ["姜辣", "刺激"], "加苏打水或苹果汁稀释，减少姜汁比例。", "姜辣素和气泡会增加刺激感。", "姜汁汽水适合威士忌/朗姆，但先少量。", ["姜汁汽水", "姜", "威士忌"]],
  ["lychee-too-perfumed", "便利店替代", "荔枝饮料调酒像香精怎么办？", ["香精", "甜"], "加柠檬或苏打水稀释，基酒选伏特加或金酒。", "荔枝香气强，高糖时容易像香精。", "荔枝饮料用 45-60ml 即可。", ["荔枝", "香精", "伏特加"]],
  ["grapefruit-bitter", "便利店替代", "西柚饮料太苦怎么办？", ["果皮苦", "后苦"], "补 5ml 糖浆或橙汁，避免再加苦味酒。", "西柚天然苦味和皮油明显。", "西柚适合配龙舌兰/金酒，但苦味酒要少。", ["西柚", "苦", "龙舌兰"]],
  ["pineapple-foam", "便利店替代", "菠萝汁摇完泡沫很多怎么办？", ["泡沫", "果酶"], "静置后倒出，或轻搅不摇。", "菠萝汁蛋白酶和果肉容易起泡。", "菠萝长饮可以直接杯中搅拌。", ["菠萝", "泡沫", "朗姆"]],
  ["mango-too-thick", "便利店替代", "芒果汁太稠怎么调？", ["稠", "甜"], "加苏打水或椰子水拉开，酸用柠檬少量提亮。", "芒果果泥黏度和糖分都高。", "芒果汁用量减半，做热带长饮更稳。", ["芒果", "热带", "苏打"]],
  ["cranberry-too-tart", "便利店替代", "蔓越莓汁太涩酸怎么办？", ["涩", "酸"], "补橙汁或糖浆，伏特加比例降低。", "蔓越莓有天然酸涩感。", "蔓越莓适合和橙汁混合，单用别太多。", ["蔓越莓", "酸涩", "伏特加"]],
  ["apple-juice-boring", "便利店替代", "苹果汁兑酒很无聊怎么办？", ["甜淡", "没香气"], "加肉桂、柠檬或姜汁汽水；基酒选威士忌/白兰地。", "苹果汁香气柔，需要香料或桶陈酒支撑。", "苹果汁别配太中性的酒做主角。", ["苹果汁", "威士忌", "姜"]],
  ["grape-juice-heavy", "便利店替代", "葡萄汁兑酒很厚很甜怎么办？", ["厚甜", "像饮料"], "加苏打水和柠檬，或换白葡萄汁。", "葡萄汁糖分高，颜色和甜度都重。", "葡萄汁更适合少量调色调味。", ["葡萄汁", "甜", "苏打"]],
  ["vitamin-c-drink", "便利店替代", "水溶C这类维C饮料怎么调？", ["酸甜", "维C味"], "适合伏特加、金酒或烧酒，先用 90ml，加冰和苏打更清爽。", "维C饮料通常有酸度和香精，能遮酒感。", "别和高甜果汁再叠加，容易像糖水。", ["水溶C", "维C", "伏特加"]],
  ["sports-drink", "便利店替代", "运动饮料兑酒好喝吗？", ["电解质味", "甜淡"], "可以配伏特加或烧酒，但建议加柠檬和冰。", "运动饮料甜度中等，风味不强。", "把运动饮料当清淡 mixer，不要期待复杂层次。", ["运动饮料", "伏特加", "烧酒"]],
  ["cola-zero", "便利店替代", "无糖可乐兑酒后味怪怎么办？", ["代糖尾", "药味"], "加柠檬片或少量普通可乐混合。", "代糖后味和酒精会叠加。", "不习惯代糖的人用普通可乐并减少量。", ["无糖可乐", "代糖", "朗姆"]],
  ["milk-tea-baileys", "便利店替代", "奶茶加百利甜太甜怎么办？", ["奶甜", "厚"], "加冰和冷萃咖啡稀释，不要再加糖。", "奶茶和百利甜都是甜奶香结构。", "百利甜用 15-30ml，当调味而非基酒。", ["奶茶", "百利甜", "咖啡"]],
  ["matcha-milk", "便利店替代", "抹茶拿铁调酒发苦怎么办？", ["抹茶苦", "奶厚"], "补 5ml 糖浆或 30ml 牛奶，基酒用伏特加/朗姆更稳。", "抹茶粉苦味和酒精会相互放大。", "抹茶酒饮先低酒量，避免柠檬。", ["抹茶", "奶", "苦"]],
  ["carbonated-milk", "材料反应", "奶类能加气泡水吗？", ["怪", "分离"], "不建议大量混合。已混合就别摇，尽快喝。", "蛋白脂肪和碳酸口感容易冲突。", "奶感饮料用咖啡/朗姆方向更安全。", ["奶", "气泡", "分离"]],
  ["acid-with-baileys", "材料反应", "百利甜遇酸结块怎么办？", ["凝结", "絮状"], "不要硬救，重新做。百利甜避开柠檬、青柠、西柚。", "奶油利口酒遇酸会凝结。", "百利甜配咖啡、牛奶、威士忌更稳。", ["百利甜", "酸", "结块"]],
  ["egg-white-smell", "材料反应", "蛋白酒有腥味怎么办？", ["腥", "泡沫"], "加柠檬皮或苦精遮味；如果不新鲜就不要喝。", "蛋白对新鲜度和摇合要求高。", "便利店场景不推荐用生蛋白。", ["蛋白", "安全", "泡沫"]],
  ["spicy-cocktail", "味道失衡", "辣椒调酒太辣怎么办？", ["辣", "喉咙刺激"], "加糖和冰稀释，必要时加椰奶或果汁缓冲。", "辣椒素不溶于水，靠水稀释效果有限。", "辣椒只擦杯或少量浸泡，不要久泡。", ["辣椒", "辣", "椰奶"]],
  ["salt-not-enough", "味道失衡", "味道散，加一点盐真的有用吗？", ["散", "甜酸不立体"], "可以加一小撮盐或盐水 1-2 滴，不要多。", "低量盐能增强甜感和果香。", "盐是微调，不是咸味来源。", ["盐", "提味", "平衡"]],
  ["sweet-sour-ratio", "味道失衡", "酸甜比例应该怎么调？", ["不知道比例", "忽酸忽甜"], "先用酸:糖浆约 1:1，再按材料甜度调整。", "酸和甜是互相支撑的结构。", "甜饮料参与时，糖浆要减少。", ["酸甜", "比例", "糖浆"]],
  ["long-drink-ratio", "操作失误", "长饮比例怎么不容易翻车？", ["新手", "比例"], "用 30ml 酒 + 90-150ml 饮料 + 满杯冰。", "长饮靠稀释和低温降低失败率。", "第一次做宁愿淡一点，不够再补酒。", ["长饮", "比例", "新手"]],
  ["short-drink-ratio", "操作失误", "短饮为什么很容易烈？", ["酒多", "小杯"], "短饮不适合新手随手倒，先做成长饮。", "短饮总量小、酒精占比高。", "没有量杯时别做 Martini、Negroni 这类短饮。", ["短饮", "烈", "量杯"]],
  ["batch-party", "操作失误", "聚会一次调一大壶怎么控制比例？", ["多人", "一壶"], "先按一杯成功比例乘人数，气泡最后单杯补。", "大壶里冰融化和气泡流失更难控制。", "聚会大壶不提前加气泡。", ["聚会", "批量", "气泡"]],
  ["make-ahead", "操作失误", "能提前调好放冰箱吗？", ["提前做", "保存"], "非气泡、非奶类可以提前混基酒和果汁，气泡和冰最后加。", "气泡会跑，奶类和酸可能分离。", "提前只做基底，喝前完成最后步骤。", ["提前", "保存", "冰箱"]],
  ["leftover-drink", "操作失误", "没喝完的鸡尾酒能放明天吗？", ["剩酒", "隔夜"], "不建议。含果汁、奶、气泡的尤其不要隔夜喝。", "氧化、细菌和气泡流失都会影响安全和风味。", "一次少做，喝完再调。", ["隔夜", "安全", "保存"]],
  ["low-alcohol", "味道失衡", "想低酒感但又不像饮料怎么办？", ["低酒感", "没层次"], "减少基酒，增加茶、气泡和柑橘皮香气。", "香气和苦/酸能提供成人感，不只靠酒精。", "低酒感杯用 15-20ml 酒即可。", ["低酒感", "香气", "茶"]],
  ["non-alcoholic", "便利店替代", "不加酒怎么做像鸡尾酒？", ["无酒精", "想有层次"], "用酸、甜、气泡、苦味四个元素搭结构。", "鸡尾酒感来自平衡和层次，不全靠酒精。", "无酒精也要加冰和装饰。", ["无酒精", "Mocktail", "气泡"]],
  ["caffeine-safety", "便利店替代", "咖啡和酒能不能一起喝？", ["咖啡因", "担心"], "可以少量，但不要和功能饮料叠加，也别喝太快。", "咖啡因可能掩盖困意，让人低估醉意。", "一杯里咖啡因来源控制一个。", ["咖啡", "咖啡因", "安全"]],
  ["strong-zero-safety", "便利店替代", "Strong Zero 还能再加酒吗？", ["9度", "预调酒"], "不建议再加高度酒，最多加冰或苏打水稀释。", "高度预调酒本身酒精已经不低。", "把它当成成品酒，而不是普通汽水。", ["Strong Zero", "安全", "预调"]],
  ["drink-too-fast", "操作失误", "调得太好喝容易喝太快怎么办？", ["入口甜", "没酒感"], "降低酒量，做大杯低 ABV，提醒自己慢喝。", "甜和气泡会遮盖酒精感。", "每杯标记基酒 ml，不要只凭口感判断。", ["安全", "低酒感", "ABV"]],
  ["unknown-abv", "操作失误", "不知道这杯大概多少度怎么办？", ["ABV", "估不准"], "粗算：纯酒精量除以总容量。40度酒 30ml 约含 12ml 酒精。", "ABV 是体积酒精比例，稀释后会下降。", "记录每种材料 ml，别只记名字。", ["ABV", "计算", "安全"]],
  ["two-spirits", "操作失误", "两种烈酒混一起可以吗？", ["混酒", "怕醉"], "可以但不建议新手随意混，先总烈酒控制在 30-45ml。", "问题不是混酒本身，而是总酒精量升高。", "混两种烈酒时 mixer 要更充足。", ["混酒", "烈酒", "总量"]],
  ["medicine-warning", "操作失误", "吃药期间可以喝调酒吗？", ["吃药", "担心"], "不要喝。尤其镇静、止痛、抗过敏、抗生素等用药期间先咨询医生。", "酒精可能和药物相互作用。", "健康和安全优先于配方。", ["安全", "药物", "酒精"]],
  ["stomach-sensitive", "味道失衡", "胃不舒服适合喝什么？", ["胃酸", "刺激"], "不建议喝酒。若只是想喝风味饮料，选无酒精、低酸、常温一点的版本。", "酒精、酸和气泡都可能刺激胃。", "身体不舒服时不要用酒精解决。", ["安全", "低酸", "无酒精"]],
  ["too-many-ingredients", "操作失误", "材料越加越多反而难喝怎么办？", ["复杂", "乱"], "停止加料，加冰稀释；必要时拆杯。", "超过 4-5 个主味道后，新手很难保持平衡。", "一杯先确定：基酒、酸/甜、mixer 三层。", ["复杂", "新手", "拆杯"]],
  ["brand-difference", "便利店替代", "同一种饮料换品牌味道差很多怎么办？", ["品牌差异", "甜度不同"], "先尝饮料本身，再决定是否加酸或苏打。", "不同品牌糖度、酸度、香精都不同。", "配方写比例时注明品牌或甜度。", ["品牌", "甜度", "便利店"]],
  ["diet-drink", "便利店替代", "无糖饮料做出来空怎么办？", ["无糖", "寡淡"], "加柠檬皮、少量糖浆或果汁补 body。", "无糖饮料少了糖带来的圆润口感。", "无糖款适合控甜，但需要香气补强。", ["无糖", "代糖", "口感"]],
  ["sparkling-tea", "便利店替代", "气泡茶适合兑什么酒？", ["气泡茶", "茶香"], "适合金酒、烧酒、伏特加；威士忌也可以但茶别太浓。", "气泡茶同时有茶香和清爽感。", "先按 1:3 调，避免茶涩过强。", ["气泡茶", "金酒", "烧酒"]],
  ["fruit-milk", "材料反应", "果汁和奶能一起加酒吗？", ["酸奶感", "分离"], "低酸水果少量可以，高酸柑橘不建议。", "酸会影响乳蛋白稳定。", "想果奶方向选草莓/香蕉，避开柠檬西柚。", ["果汁", "奶", "分离"]],
  ["banana-drink", "便利店替代", "香蕉牛奶兑酒会不会腻？", ["香蕉", "奶甜"], "适合少量朗姆或咖啡利口酒，加冰稀释。", "香蕉香精和奶甜都厚重。", "香蕉牛奶用量 60ml 左右，不要整瓶倒。", ["香蕉牛奶", "朗姆", "咖啡"]],
  ["sour-plum-too-salty", "便利店替代", "酸梅汤有咸味怎么办？", ["咸", "酸梅"], "配白酒/烧酒时减少盐边和酸味，补冰水稀释。", "酸梅汤可能自带盐和烟熏味。", "先尝品牌味道，咸味明显就别加盐。", ["酸梅汤", "咸", "白酒"]],
  ["herbal-bitter-drink", "便利店替代", "凉茶能不能兑酒？", ["凉茶", "苦"], "可以少量配白酒或金酒，但多数新手不适合。", "凉茶草本苦味很强，容易药感。", "用 30-60ml 做调味，不当主要 mixer。", ["凉茶", "草本", "苦"]],
  ["cola-coffee", "材料反应", "咖啡加可乐兑酒怎么样？", ["咖啡可乐", "刺激"], "不建议再加太多酒；若要做，控制在 15-20ml 朗姆。", "咖啡因、碳酸和糖叠加刺激感强。", "咖啡和可乐二选一更清晰。", ["咖啡", "可乐", "咖啡因"]],
  ["spirit-quality", "味道失衡", "为什么同样配方我的更难喝？", ["复刻失败", "酒质差"], "先检查冰量、温度、比例和饮料甜度，不一定是手法问题。", "同名材料品牌差异很大，尤其基酒和果汁。", "记录品牌、ml、冰量，下一次才好调整。", ["复刻", "品牌", "比例"]],
  ["smoky-whisky", "味道失衡", "烟熏威士忌兑什么都像烟怎么办？", ["烟熏", "泥煤"], "用苹果汁、姜汁汽水或苏打拉长，避免奶和淡果汁。", "泥煤烟熏穿透力强。", "烟熏威士忌少量使用，别当普通威士忌替代。", ["威士忌", "烟熏", "姜汁"]],
  ["mezcal-smoke", "味道失衡", "梅斯卡尔太烟熏怎么办？", ["烟", "矿物"], "配西柚、菠萝或苏打，减少到 15-20ml。", "梅斯卡尔烟熏酚类明显。", "新手用龙舌兰替代更温和。", ["梅斯卡尔", "西柚", "烟熏"]],
  ["brandy-too-warm", "味道失衡", "白兰地调出来很暖很甜怎么办？", ["暖香料", "甜"], "加冰和姜汁汽水，或少量柠檬提亮。", "白兰地桶陈和果干香偏温暖。", "白兰地适合苹果、咖啡、姜，不适合过甜果汁。", ["白兰地", "姜汁", "苹果"]],
  ["cider-too-sweet", "味道失衡", "苹果酒太甜怎么调？", ["甜苹果", "气泡"], "加柠檬和冰，或混无糖苏打水。", "商业苹果酒常有较高残糖。", "甜苹果酒配威士忌时酒量要少。", ["苹果酒", "柠檬", "苏打"]],
  ["sake-too-delicate", "味道失衡", "清酒味道被饮料盖住怎么办？", ["清酒消失", "米香弱"], "减少强香饮料，改用苏打或淡茶。", "清酒风味细腻，不适合强香精 mixer。", "清酒特调用简单材料，不要超过 2 个主味。", ["清酒", "淡茶", "苏打"]],
  ["vermouth-oxidized", "材料反应", "味美思开瓶久了不好喝怎么办？", ["酸败", "没香气"], "如果有明显酸败味就不要用；轻微氧化可做长饮稀释。", "味美思是葡萄酒基底，开瓶后会氧化。", "开瓶后冷藏，尽量数周内用完。", ["味美思", "氧化", "保存"]],
  ["opened-juice", "材料反应", "开封果汁放了几天还能调吗？", ["开封", "安全"], "闻到异味、胀瓶、发酵味就不要用。", "果汁开封后容易微生物繁殖和氧化。", "开封后冷藏并尽快用完。", ["果汁", "保存", "安全"]],
  ["expired-dairy", "材料反应", "快过期奶饮能不能兑酒？", ["奶", "安全"], "不建议。酒精不能让变质奶变安全。", "乳制品变质有食品安全风险。", "奶类调酒只用新鲜冷藏产品。", ["奶", "安全", "变质"]],
  ["plastic-cup", "操作失误", "便利店塑料杯调酒有味怎么办？", ["塑料味", "杯子"], "换冰杯或玻璃杯；已调好可加柑橘皮遮一点。", "部分塑料杯会带材料味，酒精也会放大香气。", "优先用干净无异味杯子。", ["杯子", "塑料味", "便利店"]],
  ["straw-taste", "操作失误", "吸管喝和直接喝味道不一样？", ["香气弱", "入口不同"], "香气型酒建议直接杯口喝；甜长饮可用吸管。", "吸管会减少鼻腔闻香。", "金酒、威士忌类尽量让杯口香气出来。", ["吸管", "香气", "杯型"]],
  ["garnish-missing", "便利店替代", "没有装饰会影响味道吗？", ["没柠檬片", "没薄荷"], "柑橘皮、薄荷会影响香气；没有也能喝，但香气会少。", "很多装饰其实是闻香组件。", "能买到柠檬就用皮轻挤油。", ["装饰", "柠檬皮", "香气"]],
  ["too-many-tags", "操作失误", "想同时清爽、甜、奶、咖啡可以吗？", ["目标太多", "混乱"], "先选一个主方向，其他只做辅助。", "风味目标过多会互相打架。", "每杯只设一个主标签，比如清爽或奶香。", ["风味目标", "新手", "简单"]],
  ["beginner-first-cup", "操作失误", "新手第一杯最不容易翻车做什么？", ["新手", "怕失败"], "选长饮：金酒苏打、威士忌乌龙、烧酒养乐多苏打。", "长饮容错高，容易通过冰和饮料修正。", "第一杯不要做短饮经典。", ["新手", "长饮", "低失败"]],
  ["female-friendly", "味道失衡", "想做低门槛但不幼稚的酒怎么办？", ["顺口", "好看"], "用低酒量、果香、气泡、酸甜平衡，不要只加糖。", "清爽酸度比单纯甜更高级。", "酒量 15-25ml，气泡和柑橘做结构。", ["低门槛", "气泡", "果香"]],
  ["dorm-friendly", "便利店替代", "宿舍没有工具怎么调？", ["无工具", "宿舍"], "用冰杯直接 build：先冰，再酒，再饮料，最后轻搅。", "宿舍场景工具少，长饮最稳。", "避免需要摇壶、过滤、火、刀的配方。", ["宿舍", "无工具", "长饮"]],
  ["party-safe", "操作失误", "聚会怎么避免大家喝太猛？", ["聚会", "安全"], "做低 ABV 大杯，标注有酒和无酒版本。", "甜和气泡会隐藏酒精感。", "准备水和无酒精选项。", ["聚会", "安全", "低酒感"]],
  ["search-no-result", "便利店替代", "本地没有这个饮料怎么找替代？", ["搜不到", "替代"], "按类别找：酸、甜、气泡、奶、茶、咖啡，而不是只看品牌名。", "调酒匹配看功能和风味，不只看商品名。", "给饮料记酸甜、气泡、奶感、咖啡因四个维度。", ["搜索", "替代", "数据库"]],
];

const extraMixProblemLibrary: MixProblem[] = extraMixProblemSeeds.map(([id, category, question, symptoms, quickFix, reason, nextTime, tags]) => ({
  id,
  category,
  question,
  symptoms,
  quickFix,
  reason,
  nextTime,
  tags,
}));

const mixProblemLibrary: MixProblem[] = [...baseMixProblemLibrary, ...extraMixProblemLibrary];

export default function InspirationScreen({ tips, onAddTip, onSaveCocktail, drinkLogs = [], onSaveDrinkLog, onLoadToLab, initialView, initialCocktailId = "", initialExploreTab, guided = false, onBackGuide }: InspirationScreenProps) {
  const [view, setView] = useState<InspirationView>(initialView ?? "menu");
  const [loadedRecipes, setLoadedRecipes] = useState<RecipeSeed[]>([]);
  const [recipeSource, setRecipeSource] = useState<string>("local");
  const [classicVariantMatches, setClassicVariantMatches] = useState<any[]>([]);
  const [classicVariantSource, setClassicVariantSource] = useState<string>("local");
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newProblem, setNewProblem] = useState<string>("");
  const [selectedProblemCategory, setSelectedProblemCategory] = useState<MixProblemCategory | "全部">("全部");
  const [showCatalogModal, setShowCatalogModal] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [guideActive, setGuideActive] = useState(guided);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    if (initialView && initialView !== "menu") return;
    const saved = sessionStorage.getItem("alchemix_guide_return");
    if (saved === "classic" || saved === "convenience") {
      setGuideActive(true);
      setExploreTab(saved);
      sessionStorage.removeItem("alchemix_guide_return");
    }
  }, [initialView]);
  const [exploreTab, setExploreTab] = useState<ExploreTab>(initialExploreTab ?? "convenience");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [routeCocktailId, setRouteCocktailId] = useState<string>(initialCocktailId);

  // Classic selection states
  const [selectedClassicId, setSelectedClassicId] = useState<string>(
    initialCocktailId ? normalizeClassicCocktailId(initialCocktailId) : "negroni",
  );
  const [selectedDirections, setSelectedDirections] = useState<string[]>([]);
  
  // Real-time calculation and its simulation state
  const [isRecalculating, setIsRecalculating] = useState<boolean>(false);
  const [activeDirections, setActiveDirections] = useState<string[]>([]);
  const isClassicDirectDetail = view === "classic-remix" && Boolean(initialCocktailId);

  const filteredExploreCocktails = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const activeCocktails = exploreTab === "convenience" ? convenienceExploreCocktails : classicExploreCocktails;
    return activeCocktails.filter((cocktail) => {
      const categoryMatched = selectedCategory === "全部"
        || cocktail.category === selectedCategory
        || cocktail.baseSpirit === selectedCategory
        || cocktail.tags.includes(selectedCategory);
      if (!categoryMatched) return false;
      if (!query) return true;

      const text = [
        cocktail.nameZh,
        cocktail.nameEn,
        cocktail.description,
        cocktail.category,
        ...cocktail.tags,
        ...cocktail.ingredients,
      ].join(" ").toLowerCase();
      return text.includes(query);
    });
  }, [exploreTab, searchQuery, selectedCategory]);

  const guidedCocktails = useMemo(() => [...filteredExploreCocktails].sort((a, b) => {
    const aMeta = getCocktailMvpMeta(a, exploreTab);
    const bMeta = getCocktailMvpMeta(b, exploreTab);
    return aMeta.difficulty - bMeta.difficulty || a.ingredients.length - b.ingredients.length;
  }), [filteredExploreCocktails, exploreTab]);
  const visibleCocktails = guideActive && !showAll ? guidedCocktails.slice(0, 3) : filteredExploreCocktails;

  useEffect(() => {
    setSelectedCategory("全部");
    setSearchInput("");
    setSearchQuery("");
  }, [exploreTab]);

  useEffect(() => {
    if (initialCocktailId) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setRouteCocktailId(params.get("cocktail") ?? "");
  }, [initialCocktailId]);

  useEffect(() => {
    if (view !== "classic-remix" || !initialCocktailId) return;
    const nextClassicId = normalizeClassicCocktailId(initialCocktailId);
    if (CLASSIC_DATABASE[nextClassicId]) {
      setSelectedClassicId(nextClassicId);
    }
  }, [view, initialCocktailId]);

  const menuItems = [
    {
      id: "classic-remix" as InspirationView,
      title: "经典酒改良器",
      desc: "把经典鸡尾酒改成更清爽、更顺口、更适合新手的版本。",
      path: "/inspiration/classic-remix",
      icon: Wine,
      type: "classic_variant",
    },
    {
      id: "convenience-mix" as InspirationView,
      title: "便利店特调灵感",
      desc: "用便利店能买到的啤酒、果汁、汽水、茶饮做简单好喝的特调。",
      path: "/inspiration/convenience-mix",
      icon: Store,
      type: "convenience",
    },
    {
      id: "flavor" as InspirationView,
      title: "按口味找酒",
      desc: "按酸甜、清爽、果香、低酒感等方向寻找配方。",
      path: "/inspiration/flavor",
      icon: Sparkles,
      type: "flavor",
    },
    {
      id: "beginner" as InspirationView,
      title: "小白入门酒单",
      desc: "低失败率、不苦不烈、材料容易买到的入门酒单。",
      path: "/inspiration/beginner",
      icon: Smile,
      type: "beginner",
    },
    {
      id: "knowledge" as InspirationView,
      title: "经典鸡尾酒知识库",
      desc: "了解经典鸡尾酒的来源、风味结构和基础配方。",
      path: "/inspiration/knowledge",
      icon: Compass,
      type: "classic",
    },
  ];

  const handleViewChange = (nextView: InspirationView) => {
    setView(nextView);
    if (typeof window !== "undefined") {
      const suffix = nextView === "menu" ? "/inspiration" : `/inspiration/${nextView}`;
      window.history.replaceState(null, "", `#${suffix}`);
    }
  };

  const goBackToInspiration = () => {
    if (sessionStorage.getItem("alchemix_beginner_detail") === "1") {
      sessionStorage.removeItem("alchemix_beginner_detail");
      window.location.href = "/?beginner=return";
      return;
    }
    if (initialView && typeof window !== "undefined") {
      const tab = initialView === "classic-remix" ? "classic" : "convenience";
      window.location.href = `/inspiration?tab=${tab}`;
      return;
    }
    if (view === "classic-remix") {
      setExploreTab("classic");
    }
    handleViewChange("menu");
  };

  useEffect(() => {
    if (initialView) return;
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace("#/inspiration/", "").replace("#/inspiration", "");
    const nextView = hash && ["classic-remix", "convenience-mix", "flavor", "beginner", "knowledge"].includes(hash)
      ? hash as InspirationView
      : "menu";
    setView(nextView);
  }, [initialView]);

  useEffect(() => {
    if (view !== "menu" || typeof window === "undefined") return;
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "classic" || tab === "convenience") {
      setExploreTab(tab);
    }
  }, [view]);

  useEffect(() => {
    if (view === "menu" || view === "classic-remix") return;
    const typeByView: Record<Exclude<InspirationView, "menu" | "classic-remix">, string> = {
      "convenience-mix": "convenience",
      flavor: "convenience",
      beginner: "beginner",
      knowledge: "classic",
    };
    const type = typeByView[view];
    fetch(`/api/inspiration/recipes?type=${type}&limit=36`)
      .then((res) => res.json())
      .then((data) => {
        setRecipeSource(data.source ?? "database");
        setLoadedRecipes(data.recipes ?? []);
      })
      .catch(() => {
        setRecipeSource("local");
        setLoadedRecipes(
          INSPIRATION_RECIPES
            .filter((recipe) => recipe.type === type)
            .slice(0, 36),
        );
      });
  }, [view]);

  useEffect(() => {
    if (view !== "classic-remix" || activeDirections.length === 0) {
      setClassicVariantMatches([]);
      return;
    }
    const classicSlug = selectedClassicId.replace(/_/g, "-");
    const selectedLabels = activeDirections
      .map((id) => directionOptions.find((option) => option.id === id)?.label)
      .filter(Boolean)
      .join(",");
    fetch(`/api/inspiration/classic-remix?classic=${classicSlug}&tags=${encodeURIComponent(selectedLabels)}`)
      .then((res) => res.json())
      .then((data) => {
        setClassicVariantSource(data.source ?? "database");
        setClassicVariantMatches(data.variants ?? []);
      })
      .catch(() => {
        const local = INSPIRATION_RECIPES
          .filter((recipe) => recipe.type === "classic_variant")
          .filter((recipe) => recipe.slug.startsWith(`variant-${classicSlug}-`))
          .slice(0, 3);
        setClassicVariantSource("local");
        setClassicVariantMatches(local);
      });
  }, [view, selectedClassicId, activeDirections]);

  // Set up horizontal bar items
  const classicCocktailsList = [
    { id: "negroni", name: "内格罗尼", english: "Negroni", icon: "🍷" },
    { id: "old_fashioned", name: "古典老式", english: "Old Fashioned", icon: "🥃" },
    { id: "martini", name: "经典马丁", english: "Martini", icon: "🍸" },
    { id: "margarita", name: "玛格丽特", english: "Margarita", icon: "🧂" },
    { id: "gin_tonic", name: "经典金汤力", english: "Gin Tonic", icon: "🍹" },
    { id: "highball", name: "威士忌嗨棒", english: "Highball", icon: "🥃" },
    { id: "mojito", name: "经典莫吉托", english: "Mojito", icon: "🌿" },
    { id: "daiquiri", name: "戴克里", english: "Daiquiri", icon: "🍹" },
    { id: "whisky_sour", name: "威士忌酸", english: "Whisky Sour", icon: "🍋" },
    { id: "moscow_mule", name: "莫斯科骡子", english: "Moscow Mule", icon: "🫚" },
  ];

  // Dynamic selector items
  const quickSelectorList = [...classicCocktailsList];
  if (!quickSelectorList.some((item) => item.id === selectedClassicId)) {
    const match = getClassicCocktailData(selectedClassicId);
    if (match) {
      quickSelectorList.push({
        id: match.id,
        name: match.name,
        english: match.english,
        icon: match.icon
      });
    }
  }

  // Recalculating state with a cool physics simulated feedback when selected directions are updated
  useEffect(() => {
    if (selectedDirections.length === 0) {
      setActiveDirections([]);
      setIsRecalculating(false);
      return;
    }
    setIsRecalculating(true);
    const timer = setTimeout(() => {
      setActiveDirections(selectedDirections);
      setIsRecalculating(false);
    }, 400); // 400ms is satisfyingly realistic!
    return () => clearTimeout(timer);
  }, [selectedClassicId, selectedDirections]);

  // Handle addition/removal of directions
  const handleToggleDirection = (id: string) => {
    if (selectedDirections.includes(id)) {
      setSelectedDirections(selectedDirections.filter((d) => d !== id));
    } else {
      setSelectedDirections([...selectedDirections, id]);
    }
  };

  function getClassicCocktailData(cocktailId: string): ClassicCocktailData {
    const normalizedId = normalizeClassicCocktailId(cocktailId);
    const direct = CLASSIC_DATABASE[normalizedId];
    if (direct) return direct;

    const hyphenId = normalizedId.replace(/_/g, "-");
    const exploreItem = classicExploreCocktails.find((item) => item.id === hyphenId || normalizeClassicCocktailId(item.id) === normalizedId);
    if (!exploreItem) return CLASSIC_DATABASE["negroni"];

    const fallbackColors = [
      "rgba(148, 163, 184, 0.45)",
      "rgba(253, 224, 71, 0.5)",
      "rgba(132, 204, 22, 0.45)",
      "rgba(224, 242, 254, 0.25)",
    ];
    const fallbackAmounts = [45, 25, 15, 90];

    return {
      id: normalizedId,
      name: exploreItem.nameZh,
      english: exploreItem.nameEn,
      icon: "🍸",
      desc: exploreItem.description,
      themeColor: "from-neutral-200/30 to-neutral-300/30",
      rating: {
        bitter: exploreItem.tags.includes("苦甜") || exploreItem.tags.includes("草本") ? 3 : 2,
        alcohol: exploreItem.baseSpirit === "起泡酒" || exploreItem.tags.includes("低酒感") ? 2 : 3,
        fresh: exploreItem.tags.includes("清爽") || exploreItem.tags.includes("酸甜") ? 4 : 3,
        sweet: exploreItem.tags.includes("甜润") || exploreItem.tags.includes("果香") ? 4 : 2,
      },
      ingredients: exploreItem.ingredients.slice(0, 5).map((ingredient, index) => ({
        name: ingredient,
        amount: fallbackAmounts[index] ?? 10,
        category: index === 0 ? "基酒" : ingredient.includes("汁") || ingredient.includes("果") ? "果汁" : "辅料",
        color: fallbackColors[index % fallbackColors.length],
      })),
    };
  }

  // Upgraded rules calculation logic for classic cocktails domestication
  const calculateDomestication = (cocktailId: string, directions: string[]) => {
    const classic = getClassicCocktailData(cocktailId);
    
    // Copy ingredients for modification
    let ingredients = classic.ingredients.map(ing => ({
      name: ing.name,
      amount: ing.amount,
      originalAmount: ing.amount,
      category: ing.category,
      color: ing.color,
      changeType: "keep" as "keep" | "increase" | "decrease" | "add" | "replace",
      reason: "保留主风味骨架"
    }));

    let rating = { ...classic.rating };
    let tags = ["小白友好"];
    let commentsList: string[] = [];

    // --- SPECIAL RECALCULATION FOR NEGRONI (AS REQUESTED BY USER) ---
    if (cocktailId === "negroni") {
      let ginAmount = 30;
      let campariAmount = 30;
      let vermouthAmount = 30;
      let extraIngredients: typeof ingredients = [];
      
      let ginReason = "保留原版分量";
      let campariReason = "保留原版分量";
      let vermouthReason = "保留原版分量";
      
      let ginChange: any = "keep";
      let campariChange: any = "keep";
      let vermouthChange: any = "keep";

      if (directions.includes("less_alcohol")) {
        ginAmount = 20;
        ginChange = "decrease";
        ginReason = "【降低酒感】金酒减至 20ml，减弱刺鼻酒精感";
        rating.alcohol = Math.max(1, rating.alcohol - 2);
        commentsList.push("调低烈性金酒，降低酒精侵略性");
      }

      if (directions.includes("less_bitter")) {
        campariAmount = 12; // 10-15ml range
        campariChange = "decrease";
        campariReason = "【少苦一点】下调金巴利至 12ml，克制其药草苦味";
        rating.bitter = Math.max(1, rating.bitter - 2.5);
        commentsList.push("下调金巴利，去除重药草涩苦");
      }

      if (directions.includes("convenience")) {
        vermouthAmount = 18; // 15-20ml range
        vermouthChange = "decrease";
        vermouthReason = "【控甜回甘】红美思减至 18ml，避免过甜粘嘴";
        
        extraIngredients.push({
          name: "橙味气泡水 Orange Soda",
          amount: 100, // 90-120ml range
          originalAmount: 0,
          category: "气泡饮料",
          color: "rgba(249, 115, 22, 0.45)",
          changeType: "add",
          reason: "【便利店版】加入开架橙味气泡水，平替苦橙皮芬芳且拉长酒体"
        });
        extraIngredients.push({
          name: "纯净冰块 Ice Blocks",
          amount: 120,
          originalAmount: 0,
          category: "辅料",
          color: "rgba(255, 255, 255, 0.8)",
          changeType: "add",
          reason: "【极温冷凝】加入大量冰块，物理融水稀释，平滑乙醇冲击"
        });
        extraIngredients.push({
          name: "鲜橙片 Orange Slice (可选)",
          amount: 10,
          originalAmount: 0,
          category: "辅料",
          color: "rgba(251, 146, 60, 0.9)",
          changeType: "add",
          reason: "【香气点缀】点缀一枚鲜橙片，提升感官悦纳度"
        });
        
        rating.fresh = Math.min(5, rating.fresh + 2);
        tags.push("便利店版");
        commentsList.push("添加橙味苏打，将其重塑为清透可口的定制版 Negroni Spritz");
      }

      if (directions.includes("sweeter")) {
        vermouthAmount = Math.round(vermouthAmount * 1.3);
        vermouthChange = "increase";
        vermouthReason = "【甜度加注】提升红美思用量，甜苦平衡";
        rating.sweet = Math.min(5, rating.sweet + 1.5);
      }

      if (directions.includes("fresher") && !directions.includes("convenience")) {
        extraIngredients.push({
          name: "苏打气泡水 Soda Water",
          amount: 90,
          originalAmount: 0,
          category: "气泡饮料",
          color: "rgba(224, 242, 254, 0.25)",
          changeType: "add",
          reason: "【气泡充盈】新增强充气苏打水，激活爆破爽快感"
        });
        rating.fresh = Math.min(5, rating.fresh + 1.5);
      }

      ingredients = [
        {
          name: "金酒 Gin",
          amount: ginAmount,
          originalAmount: 30,
          category: "基酒",
          color: "rgba(148, 163, 184, 0.45)",
          changeType: ginChange,
          reason: ginReason
        },
        {
          name: "金巴利 Campari",
          amount: campariAmount,
          originalAmount: 30,
          category: "辅料",
          color: "rgba(220, 38, 38, 0.65)",
          changeType: campariChange,
          reason: campariReason
        },
        {
          name: "甜味美思 Sweet Vermouth",
          amount: vermouthAmount,
          originalAmount: 30,
          category: "辅料",
          color: "rgba(127, 29, 29, 0.7)",
          changeType: vermouthChange,
          reason: vermouthReason
        },
        ...extraIngredients
      ];
    } 
    // --- GENERAL RECALCULATION FOR OTHER CLASSICS ---
    else {
      // Order matters: Convenience substitutions apply first, so other directions alter replaced ingredients!
      if (directions.includes("convenience")) {
        tags.push("便利店版");
        ingredients = ingredients.map(ing => {
          const lower = ing.name.toLowerCase();
          if (lower.includes("campari")) {
            return {
              name: "西柚苏打汽水 Grapefruit Soda",
              amount: 80,
              originalAmount: ing.amount,
              category: "气泡饮料",
              color: "rgba(244, 63, 94, 0.35)",
              changeType: "replace" as const,
              reason: "【便利平替】西柚汽水平替金巴利，模拟苦橙感且拉长酒体"
            };
          }
          if (lower.includes("sweet vermouth")) {
            return {
              name: "康师傅冰红茶 Black Tea",
              amount: 60,
              originalAmount: ing.amount,
              category: "茶饮",
              color: "rgba(146, 64, 14, 0.4)",
              changeType: "replace" as const,
              reason: "【便利平替】冰红茶平替甜美素，保留红茶多酚和微甜草本感"
            };
          }
          if (lower.includes("dry vermouth")) {
            return {
              name: "三得利苏打汽水 Soda Water",
              amount: 50,
              originalAmount: ing.amount,
              category: "气泡饮料",
              color: "rgba(224, 242, 254, 0.25)",
              changeType: "replace" as const,
              reason: "【便利平替】超市苏打水替代干美思，增加畅爽起泡"
            };
          }
          if (lower.includes("bitters")) {
            return {
              name: "三得利无糖乌龙茶 Oolong",
              amount: 15,
              originalAmount: ing.amount,
              category: "茶饮",
              color: "rgba(120, 53, 4, 0.45)",
              changeType: "replace" as const,
              reason: "【便利平替】乌龙茶单宁苦感平替安高天娜木质苦精"
            };
          }
          if (lower.includes("ginger beer")) {
            return {
              name: "苹果西打 Apple Cider",
              amount: 100,
              originalAmount: ing.amount,
              category: "气泡饮料",
              color: "rgba(253, 186, 116, 0.45)",
              changeType: "replace" as const,
              reason: "【便利平替】苹果西打平替姜汁啤酒，清甜无辛辣姜辣感"
            };
          }
          if (lower.includes("espresso")) {
            return {
              name: "雀巢即饮黑咖啡 Black Coffee",
              amount: 60,
              originalAmount: ing.amount,
              category: "茶饮",
              color: "rgba(68, 64, 60, 0.75)",
              changeType: "replace" as const,
              reason: "【便利平替】即饮黑咖啡瓶替现磨浓缩，柔和不焦苦"
            };
          }
          if (lower.includes("coconut cream")) {
            return {
              name: "椰树牌椰汁 Coconut Milk",
              amount: 80,
              originalAmount: ing.amount,
              category: "乳酸饮料",
              color: "rgba(255, 255, 255, 0.95)",
              changeType: "replace" as const,
              reason: "【便利平替】椰树牌椰汁替代精制浓厚椰浆，清爽丝滑不甜腻"
            };
          }
          if (lower.includes("lime juice") || lower.includes("lemon juice")) {
            return {
              name: "农夫山泉水溶C100 (柠檬味)",
              amount: 35,
              originalAmount: ing.amount,
              category: "果汁",
              color: "rgba(254, 240, 138, 0.5)",
              changeType: "replace" as const,
              reason: "【便利平替】水溶C100替代新鲜酸柠汁，酸甜可口"
            };
          }
          if (lower.includes("triple sec")) {
            return {
              name: "汇源纯橙汁 Orange Juice",
              amount: 40,
              originalAmount: ing.amount,
              category: "果汁",
              color: "rgba(249, 115, 22, 0.45)",
              changeType: "replace" as const,
              reason: "【便利平替】橙汁平替昂贵利口酒，注入天然柑橘果香"
            };
          }
          return ing;
        });
        commentsList.push("使用便利店常见好物完美平替原料");
        rating.alcohol = Math.max(1, rating.alcohol - 1);
        rating.fresh = Math.min(5, rating.fresh + 1);
      }

      // Apply less alcohol / beginner friendly
      if (directions.includes("less_alcohol") || directions.includes("beginner_friendly")) {
        if (directions.includes("less_alcohol")) tags.push("低酒感");
        if (directions.includes("beginner_friendly")) tags.push("入门友好");

        ingredients = ingredients.map(ing => {
          if (ing.category === "基酒" && ing.changeType !== "replace") {
            return {
              ...ing,
              amount: Math.max(15, Math.round(ing.amount * 0.5)),
              changeType: "decrease" as const,
              reason: "【酒感控制】基酒用量减半，抹平高浓度乙醇的辛辣刺喉感"
            };
          }
          return ing;
        });

        // Insert soda carbonated water if total volume is too low or spirit is forward
        const currentVol = ingredients.reduce((sum, i) => sum + i.amount, 0);
        const hasFizz = ingredients.some(i => i.name.includes("气泡") || i.name.includes("Soda") || i.name.includes("Sprite") || i.name.includes("Cider"));
        
        if (currentVol < 150 && !hasFizz) {
          const gasName = "苏打气泡水 Soda Water";
          const gasColor = "rgba(224, 242, 254, 0.25)";
          ingredients.push({
            name: gasName,
            amount: 100,
            originalAmount: 0,
            category: "气泡饮料",
            color: gasColor,
            changeType: "add" as const,
            reason: "【拉长酒体】新增香甜气泡水稀释，将烈酒转化为清爽起泡长饮"
          });
        }
        commentsList.push("大幅稀释多余乙醇浓度，减少酒精辣喉感");
        rating.alcohol = Math.max(1, rating.alcohol - 2);
        rating.fresh = Math.min(5, rating.fresh + 1);
      }

      // Apply less bitter
      if (directions.includes("less_bitter")) {
        tags.push("极低苦度");
        ingredients = ingredients.map(ing => {
          const lower = ing.name.toLowerCase();
          if (lower.includes("campari") || lower.includes("bitters") || lower.includes("tonic") || lower.includes("espresso")) {
            // Cut bitter ingredient
            const decreasedAmt = Math.max(10, Math.round(ing.amount * 0.4));
            return {
              ...ing,
              amount: decreasedAmt,
              changeType: "decrease" as const,
              reason: "【苦味控制】极客制投放，祛除令人不适的浓烈中药感"
            };
          }
          return ing;
        });

        // Special conversion of Gin Tonic to Fizz to bypass bitter Tonic water
        if (cocktailId === "gin_tonic") {
          ingredients = ingredients.map(ing => {
            if (ing.name.includes("Tonic")) {
              return {
                name: "柠檬气泡水 Lemon Soda",
                amount: 110,
                originalAmount: ing.amount,
                category: "气泡饮料",
                color: "rgba(254, 240, 138, 0.35)",
                changeType: "replace" as const,
                reason: "【苦味消除】用酸甜柠檬汽水代替苦涩汤力水，完美根除奎宁苦味"
              };
            }
            return ing;
          });
        }

        commentsList.push("调低奎宁/草本/焦油等生苦药味来源");
        rating.bitter = Math.max(1, rating.bitter - 2);
        rating.sweet = Math.min(5, rating.sweet + 1);
      }

      // Apply sweeter
      if (directions.includes("sweeter")) {
        tags.push("甜度加注");
        let sweetened = false;
        ingredients = ingredients.map(ing => {
          const lower = ing.name.toLowerCase();
          if (lower.includes("sugar") || lower.includes("syrup") || lower.includes("vermouth") || lower.includes("kahlúa") || lower.includes("tea") || lower.includes("sprite")) {
            sweetened = true;
            return {
              ...ing,
              amount: Math.round(ing.amount * 1.5),
              changeType: ing.changeType === "keep" ? "increase" as const : ing.changeType,
              reason: "【甜度调整】提高甜味材料比例，让入口更圆润"
            };
          }
          return ing;
        });

        if (!sweetened) {
          ingredients.push({
            name: "纯蜂蜜水 Honey Water",
            amount: 25,
            originalAmount: 0,
            category: "辅料",
            color: "rgba(251, 191, 36, 0.45)",
            changeType: "add" as const,
            reason: "【甜度平衡】新增纯蜂蜜水挂壁，用天然果糖温和包裹刺激气味"
          });
        }
        commentsList.push("提升天然果糖/糖浆配体比重以柔化酒体");
        rating.sweet = Math.min(5, rating.sweet + 2);
        rating.bitter = Math.max(1, rating.bitter - 1);
      }

      // Apply fresher
      if (directions.includes("fresher")) {
        tags.push("极度清爽");
        let bubblyAdded = false;
        ingredients = ingredients.map(ing => {
          const lower = ing.name.toLowerCase();
          if (lower.includes("soda") || lower.includes("sprite") || lower.includes("cola") || lower.includes("cider") || lower.includes("气泡")) {
            bubblyAdded = true;
            return {
              ...ing,
              amount: Math.round(ing.amount * 1.4),
              changeType: ing.changeType === "keep" ? "increase" : ing.changeType,
              reason: "【气泡扩充】拉高碳酸充气饮料投放量，提升爆破爽快感"
            };
          }
          return ing;
        });

        if (!bubblyAdded) {
          ingredients.push({
            name: "强气泡苏打水 Soda Fizz",
            amount: 90,
            originalAmount: 0,
            category: "气泡饮料",
            color: "rgba(224, 242, 254, 0.25)",
            changeType: "add" as const,
            reason: "【物理起泡】新增二氧化碳气泡介质，拉长酒体，冲刷燥热粘稠"
          });
        }
        commentsList.push("加注高碳酸碳酸释出，让整体口感清透飘逸");
        rating.fresh = Math.min(5, rating.fresh + 2);
        rating.alcohol = Math.max(1, rating.alcohol - 1);
      }
    } // Closes else block

    // Clean duplicate named ingredients
    const seenNames = new Set<string>();
    ingredients = ingredients.filter(ing => {
      if (seenNames.has(ing.name)) return false;
      seenNames.add(ing.name);
      return ing.amount > 0;
    });

    // Make up a customized Chinese name based on cocktail and directions chosen
    let improvedChineseName = `定制版${classic.name}`;
    if (cocktailId === "negroni") {
      improvedChineseName = "定制版内格罗尼";
    } else if (cocktailId === "old_fashioned") {
      if (directions.includes("convenience")) {
        improvedChineseName = "定制版古典老式";
      } else {
        improvedChineseName = "定制版古典老式";
      }
    } else if (cocktailId === "martini") {
      improvedChineseName = "定制版经典马丁";
    } else if (cocktailId === "gin_tonic") {
      improvedChineseName = "定制版经典金汤力";
    }

    // Assemble dynamic explanations
    let customExplanation = `【改良建议】针对经典 ${classic.name} 的劝退点，`;
    if (commentsList.length > 0) {
      customExplanation += `已选择「${directions.map(d => directionOptions.find(o => o.id === d)?.label || d).join("、")}」。这版配方会这样调整：`;
      if (directions.includes("less_bitter")) {
        customExplanation += "减少高苦金巴利/药草成分投放比例；";
      }
      if (directions.includes("less_alcohol")) {
        customExplanation += "下调高烈度基酒用量，消除刺喉乙醇辣感；";
      }
      if (directions.includes("fresher") || directions.includes("less_alcohol")) {
        customExplanation += `加入气泡苏打水/汽水拉长酒体，使原本苦烈偏沉重的烈酒转成长饮 Spritz 起泡方向，变清爽解腻。`;
      }
      if (directions.includes("convenience")) {
        customExplanation += "利用开架气泡水/红茶等饮料中天然的多酚和苦橙酸中和基酒。";
      }
    } else {
      customExplanation += "我们推荐降低烈性基酒，增加无酒精气泡稀释剂，让其更加平易近人。";
    }

    return {
      classic: {
        chineseName: classic.name,
        name: classic.english,
        desc: classic.desc,
        ingredients: classic.ingredients,
        rating: classic.rating
      },
      improved: {
        chineseName: improvedChineseName,
        name: cocktailId === "negroni" ? "CUSTOMIZED NEGRONI" : `CUSTOMIZED ${classic.english.toUpperCase()}`,
        ingredients: ingredients,
        mixMethod: cocktailId === "whisky_sour" || cocktailId === "espresso_martini" || cocktailId === "daiquiri" ? "Shake" : "Stir",
        comments: customExplanation,
        tags: Array.from(new Set(tags)),
        rating: rating
      }
    };
  };

  // Perform calculations reactively based on horizontal selections
  const improvedResult = calculateDomestication(selectedClassicId, activeDirections);

  const handleSaveToFavorites = () => {
    if (!improvedResult || !onSaveCocktail) return;

    const savedRecord = {
      id: `saved-improved-${Date.now()}`,
      chineseName: improvedResult.improved.chineseName,
      name: improvedResult.improved.name,
      subtitle: `【经典改良】基于经典款「${improvedResult.classic.chineseName}」的好喝进化`,
      spirit: improvedResult.improved.ingredients.filter((i: any) => i.category === "基酒").map((i: any) => i.name).join(" + ") || "改良基酒",
      mixer: improvedResult.improved.ingredients.filter((i: any) => i.category !== "基酒").map((i: any) => i.name).slice(0, 2).join(" + ") || "风味苏打",
      size: `${improvedResult.improved.ingredients.reduce((sum: number, i: any) => sum + i.amount, 0)}ml`,
      rating: {
        sweet: improvedResult.improved.rating.sweet,
        acid: improvedResult.improved.rating.fresh, // Map freshness or standard acidity
        strength: improvedResult.improved.rating.alcohol
      },
      comments: improvedResult.improved.comments,
      tags: improvedResult.improved.tags,
      savedAt: new Date().toISOString().split("T")[0],
      ratingValue: 5,
      sourcePage: "classic_remix",
    };

    onSaveCocktail(savedRecord);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const filteredMixProblems = useMemo(() => {
    const query = newProblem.trim().toLowerCase();
    return mixProblemLibrary.filter((problem) => {
      const categoryMatched = selectedProblemCategory === "全部" || problem.category === selectedProblemCategory;
      if (!categoryMatched) return false;
      if (!query) return true;

      const searchableText = [
        problem.question,
        problem.quickFix,
        problem.reason,
        problem.nextTime,
        problem.category,
        ...problem.symptoms,
        ...problem.tags,
      ].join(" ").toLowerCase();
      return searchableText.includes(query);
    });
  }, [newProblem, selectedProblemCategory]);

  const renderStars = (val: number, isClassic: boolean) => {
    const dots = [];
    for (let i = 1; i <= 5; i++) {
      if (i <= val) {
        dots.push(
          <span 
            key={i} 
            className={`w-2.5 h-2.5 rounded-full inline-block mr-1 ${
              isClassic ? "bg-red-500" : "bg-green-500 animate-pulse"
            }`}
          />
        );
      } else {
        dots.push(
          <span key={i} className="w-2.5 h-2.5 rounded-full inline-block mr-1 bg-outline-variant/30" />
        );
      }
    }
    return dots;
  };

  const renderPageHeader = (title = "Inspiration Lab", subtitle = "从经典鸡尾酒、便利店特调、口味灵感中，找到适合你的低门槛调酒方案。") => (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-outline tracking-widest uppercase bg-surface-container px-2.5 py-1 rounded-sm">
          LAB INSPIRATION
        </span>
        <div className="h-[1px] flex-grow bg-outline-variant/30"></div>
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <h2 className="text-3xl font-serif text-on-background">{title}</h2>
          <p className="text-sm text-on-surface-variant font-light leading-relaxed">
            {subtitle}
          </p>
        </div>
        {view !== "menu" && (
          <button
            onClick={goBackToInspiration}
            className="shrink-0 rounded-full border border-outline-variant/30 px-3 py-2 text-[11px] font-bold text-on-surface-variant bg-surface-container-low hover:bg-surface-container transition-colors"
          >
            返回菜单
          </button>
        )}
      </div>
    </div>
  );

  const renderMenu = () => (
    <div className="mx-auto w-full max-w-[430px] bg-[#F7F7F5] px-4 pb-24">
      <section className="pt-6 text-center">
        <h2 className="text-[28px] font-bold leading-tight text-neutral-950">找酒谱</h2>
        {guideActive && <><button onClick={() => onBackGuide ? onBackGuide() : window.location.assign("/")} className="mt-3 text-xs text-neutral-500 underline">返回首页引导</button><h3 className="mt-6 text-xl font-medium">{showAll ? "继续找你喜欢的一杯" : "从这三杯开始"}</h3><p className="mt-2 text-xs leading-6 text-neutral-500">{exploreTab === "classic" ? "先认识经典，从操作简单的配方开始。" : "常见材料，简单调配。购买前确认门店有售。"}</p></>}
      </section>

      <section className="mt-6 border-b border-[#dededb]">
        <div className="grid grid-cols-2">
          {[
            { id: "convenience" as ExploreTab, label: "便利店特调", icon: Store },
            { id: "classic" as ExploreTab, label: "经典鸡尾酒", icon: Wine },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = exploreTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setExploreTab(tab.id); setShowAll(false); }}
                className={`relative flex h-[54px] cursor-pointer items-center justify-center gap-2 text-[15px] font-bold transition-colors ${
                  active ? "text-neutral-950" : "text-neutral-400"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" />
                <span>{tab.label}</span>
                {active && <span className="absolute bottom-0 left-0 h-0.5 w-full bg-neutral-950" />}
              </button>
            );
          })}
        </div>
      </section>

      <>
          <form
            className="mt-5 flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setSearchQuery(searchInput);
            }}
          >
            <label className="flex h-[52px] min-w-0 flex-1 items-center gap-2 rounded-full border border-[#E1E1DE] bg-white px-4">
              <Search className="h-5 w-5 shrink-0 text-neutral-400" />
              <input
                value={searchInput}
                onChange={(event) => {
                  setSearchInput(event.target.value);
                  if (!event.target.value.trim()) setSearchQuery("");
                }}
                placeholder={exploreTab === "convenience" ? "搜索便利店特调 / 基酒 / 材料..." : "搜索经典鸡尾酒 / 中英文名 / 材料..."}
                className="min-w-0 flex-1 bg-transparent text-[15px] text-neutral-950 outline-none placeholder:text-neutral-400"
              />
            </label>
            <button
              type="submit"
              className="h-[50px] w-[78px] shrink-0 cursor-pointer rounded-full bg-neutral-950 text-[15px] font-bold text-white active:scale-[0.98]"
            >
              搜索
            </button>
          </form>

          <div className="-mx-4 mt-4 overflow-x-auto px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-2 whitespace-nowrap">
              {(exploreTab === "convenience" ? convenienceCategories : classicCategories).map((category) => {
                const active = selectedCategory === category;
                return (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`h-9 shrink-0 cursor-pointer rounded-full px-3.5 text-sm font-medium transition-colors active:scale-[0.98] ${
                      active ? "bg-neutral-950 text-white" : "bg-[#F2F2F2] text-[#555]"
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>

          {filteredExploreCocktails.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-[#d8d8d4] bg-white px-5 py-8 text-center text-sm leading-6 text-neutral-500">
              暂时没有找到相关鸡尾酒，试试搜索其他名称或材料。
            </div>
          ) : (
            <section className="mt-4 grid grid-cols-2 gap-3 min-[340px]:grid-cols-2 max-[339px]:grid-cols-1">
              {visibleCocktails.map((cocktail, index) => {
                const hasLogged = hasDrinkLogForExploreCocktail(cocktail, drinkLogs);
                const meta = getCocktailMvpMeta(cocktail, exploreTab);
                return (
                  <article
                    role="link"
                    tabIndex={0}
                    onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.click(); }}
                    key={cocktail.id}
                    onClick={() => {
                      trackAnalyticsEvent({
                        eventName: "cocktail_card_click",
                        page: "inspiration",
                        action: "click",
                        target: cocktail.nameZh,
                        recipeId: cocktail.id,
                        source: exploreTab,
                        metadata: {
                          category: cocktail.category,
                          tags: cocktail.tags,
                        },
                      });
                      trackAnalyticsEvent({
                        eventName: "recipe_detail_view",
                        page: "inspiration",
                        action: "view",
                        target: cocktail.nameZh,
                        recipeId: cocktail.id,
                        source: exploreTab,
                      });
                      if (guideActive) sessionStorage.setItem("alchemix_guide_return", exploreTab);
                      window.location.href = cocktail.href;
                    }}
                    className={`relative cursor-pointer overflow-hidden rounded-2xl border border-[#E8E8E8] bg-white shadow-[0_1px_8px_rgba(15,23,42,0.04)] transition-transform active:scale-[0.98] ${guideActive && !showAll && index === 0 ? "col-span-2 max-[339px]:col-span-1" : ""}`}
                  >
                    {hasLogged && (
                      <div className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/92 px-2 py-1 text-[10px] font-bold text-neutral-950 shadow-[0_4px_14px_rgba(15,23,42,0.12)] backdrop-blur">
                        <span className="material-symbols-outlined text-[13px]">check_circle</span>
                        <span>喝过</span>
                      </div>
                    )}
                    <CocktailImage cocktail={cocktail} />
                    <div className={`space-y-1.5 p-3 ${index % 3 === 1 ? "pb-5" : ""}`}>
                      <div className="flex flex-wrap gap-1">
                        {[cocktail.category, ...cocktail.tags.filter((tag) => tag !== cocktail.category)].slice(0, 2).map((tag) => (
                          <span key={tag} className="rounded-full bg-[#F2F2F2] px-2 py-0.5 text-[10px] font-bold text-neutral-500">
                            {tag}
                          </span>
                        ))}
                      </div>
                      {guideActive && !showAll && index === 0 && <p className="text-xs font-bold text-neutral-950">推荐先试 · {meta.tool}</p>}
                      <h3 className="text-[17px] font-bold leading-snug text-neutral-950 line-clamp-2">{cocktail.nameZh}</h3>
                      <p className="text-[13px] font-semibold leading-snug text-neutral-500">{cocktail.nameEn}</p>
                      <p className="text-[13px] leading-[1.5] text-neutral-500 line-clamp-3">{cocktail.description}</p>
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        {[
                          `难度 ${meta.difficulty}/5`,
                          meta.alcohol,
                          meta.availability,
                          meta.tool,
                        ].map((label) => (
                          <span key={label} className="rounded-lg border border-[#E8E8E8] bg-[#F7F7F5] px-1.5 py-1 text-center text-[9px] font-bold text-neutral-500">
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          )}
          {guideActive && !showAll && filteredExploreCocktails.length > 3 && <button onClick={() => setShowAll(true)} className="mt-5 min-h-12 w-full rounded-full bg-neutral-950 px-5 py-3 text-sm font-medium text-white">{exploreTab === "classic" ? "查看更多经典酒" : "查看更多便利店特调"}</button>}
        </>
    </div>
  );

  const renderRecipeCard = (recipe: any) => {
    const ingredients = recipe.ingredients ?? [];
    const tags = recipe.tags?.map((item: any) => item.tag?.nameCn ?? item).filter(Boolean) ?? recipe.tags ?? [];
    const titleCn = recipe.nameCn ?? recipe.titleCn;
    const titleEn = recipe.nameEn ?? recipe.titleEn;
    return (
      <div key={recipe.id ?? recipe.slug} className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-serif text-base font-bold text-on-surface leading-tight">{titleCn}</h3>
            <span className="text-[10px] font-mono text-outline uppercase">{recipe.baseSpirit}</span>
          </div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-outline">{titleEn}</p>
          <p className="text-xs text-on-surface-variant leading-relaxed">{recipe.description}</p>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            ["甜", recipe.sweetnessLevel],
            ["酸", recipe.acidityLevel],
            ["苦", recipe.bitternessLevel],
            ["酒感", recipe.alcoholIntensity],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-surface-container-low px-2 py-2 border border-outline-variant/10">
              <div className="text-[10px] text-outline">{label}</div>
              <div className="text-sm font-bold text-on-surface">{value}/5</div>
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          {ingredients.slice(0, 4).map((ingredient: any, index: number) => (
            <div key={`${ingredient.ingredientNameCn ?? ingredient.nameCn}-${index}`} className="flex items-center justify-between text-xs">
              <span className="text-on-surface-variant">{ingredient.ingredientNameCn ?? ingredient.nameCn}</span>
              <span className="font-mono text-outline">{ingredient.amount}{ingredient.unit}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {tags.slice(0, 4).map((tag: string) => (
            <span key={tag} className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/5 text-primary border border-primary/10">
              #{tag}
            </span>
          ))}
        </div>
        {onSaveDrinkLog && (
          <DrinkLogButton
            recipe={inspirationRecipeToDrinkLogSnapshot(recipe)}
            sourcePage={view === "convenience-mix" ? "convenience_mix" : view}
            drinkLogs={drinkLogs}
            onSaveDrinkLog={onSaveDrinkLog}
            variant="text"
            className="w-full"
          />
        )}
      </div>
    );
  };

  const renderConvenienceDetailPage = () => {
    const cocktail = convenienceExploreCocktails.find((item) => item.id === routeCocktailId);
    const guide = cocktail ? getConvenienceRecipeGuide(cocktail) : null;

    if (!cocktail || !guide) {
      return (
        <div className="mx-auto w-full max-w-[430px] bg-[#F7F7F5] px-4 pb-24 pt-5">
          <button
            onClick={goBackToInspiration}
            className="mb-5 inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#E1E1DE] bg-white px-3.5 py-2 text-xs font-bold text-neutral-700 active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            返回探索
          </button>
          <div className="rounded-2xl border border-dashed border-[#d8d8d4] bg-white px-5 py-8 text-center text-sm leading-6 text-neutral-500">
            暂时没有找到这杯酒的做法，请回到探索页选择其他配方。
          </div>
        </div>
      );
    }

    const meta = getCocktailMvpMeta(cocktail, "convenience");

    return (
      <div className="mx-auto w-full max-w-[430px] bg-[#F7F7F5] px-4 pb-24 pt-5">
        <button
          onClick={goBackToInspiration}
          className="mb-5 inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#E1E1DE] bg-white px-3.5 py-2 text-xs font-bold text-neutral-700 shadow-sm active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          返回探索
        </button>

        <article className="overflow-hidden rounded-[24px] border border-[#E8E8E8] bg-white shadow-[0_8px_28px_rgba(15,23,42,0.06)]">
          <CocktailImage cocktail={cocktail} />
          <div className="space-y-5 p-5">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {[cocktail.baseSpirit, ...cocktail.tags].filter(Boolean).slice(0, 3).map((tag) => (
                  <span key={tag} className="rounded-full bg-[#F2F2F2] px-2.5 py-1 text-[11px] font-bold text-neutral-600">
                    {tag}
                  </span>
                ))}
              </div>
              <div>
                <h2 className="text-[28px] font-bold leading-tight text-neutral-950">{cocktail.nameZh}</h2>
                <p className="mt-1 text-[12px] font-bold uppercase tracking-[0.18em] text-neutral-400">{cocktail.nameEn}</p>
              </div>
              <p className="text-sm leading-6 text-neutral-600">{cocktail.description}</p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  ["难度", `${meta.difficulty}/5`],
                  ["酒感", meta.alcohol],
                  ["材料", meta.availability],
                  ["器具", meta.tool],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-[#E8E8E8] bg-[#F7F7F5] px-2 py-2 text-center">
                    <p className="text-[10px] font-bold text-neutral-400">{label}</p>
                    <p className="mt-0.5 text-[11px] font-bold text-neutral-800">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <section className="rounded-2xl bg-[#F7F7F5] p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-bold text-neutral-950">材料与比例</h3>
                <span className="text-[11px] font-bold text-neutral-500">{guide.glass}</span>
              </div>
              <div className="space-y-2">
                {guide.ingredientLines.map((line) => (
                  <div key={line} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm">
                    <span className="font-medium text-neutral-800">{line.replace(/\s+\d.*$/, "")}</span>
                    <span className="shrink-0 text-right font-mono text-xs text-neutral-500">{line.match(/\d.*$/)?.[0] ?? ""}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-base font-bold text-neutral-950">做法</h3>
              <div className="space-y-2.5">
                {guide.steps.map((step, index) => (
                  <div key={step} className="flex gap-3 rounded-2xl border border-[#E8E8E8] bg-white p-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-bold text-white">
                      {index + 1}
                    </span>
                    <p className="text-sm leading-6 text-neutral-700">{step}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-[#E8E8E8] bg-white p-4">
              <h3 className="mb-3 text-base font-bold text-neutral-950">小白建议</h3>
              <div className="space-y-2">
                {guide.beginnerTips.map((tip) => (
                  <p key={tip} className="text-sm leading-6 text-neutral-600">
                    {tip}
                  </p>
                ))}
              </div>
            </section>

            {onSaveDrinkLog && (
              <DrinkLogButton
                recipe={{
                  ...exploreCocktailToDrinkLogSnapshot(cocktail),
                  ingredients: guide.ingredientLines.map((line) => ({
                    name: line.replace(/\s+\d.*$/, ""),
                    amount: line.match(/\d.*$/)?.[0] ?? "",
                  })),
                  method: guide.steps.join(" "),
                }}
                sourcePage="convenience_mix"
                drinkLogs={drinkLogs}
                onSaveDrinkLog={onSaveDrinkLog}
                variant="text"
                className="w-full"
              />
            )}
          </div>
        </article>
      </div>
    );
  };

  const renderRecipeListPage = () => {
    const config: Record<Exclude<InspirationView, "menu" | "classic-remix">, { title: string; subtitle: string }> = {
      "convenience-mix": {
        title: "便利店特调灵感",
        subtitle: "用便利店能买到的啤酒、果汁、汽水、茶饮做简单好喝的特调。",
      },
      flavor: {
        title: "按口味找酒",
        subtitle: "按酸甜、清爽、果香、低酒感等方向寻找配方。",
      },
      beginner: {
        title: "小白入门酒单",
        subtitle: "低失败率、不苦不烈、材料容易买到的入门酒单。",
      },
      knowledge: {
        title: "经典鸡尾酒知识库",
        subtitle: "了解经典鸡尾酒的来源、风味结构和基础配方。",
      },
    };
    const fallbackType = view === "knowledge" ? "classic" : view === "beginner" ? "beginner" : "convenience";
    const displayRecipes = loadedRecipes.length > 0
      ? loadedRecipes
      : INSPIRATION_RECIPES.filter((recipe) => recipe.type === fallbackType).slice(0, 36);
    const current = config[view as Exclude<InspirationView, "menu" | "classic-remix">];

    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-16 px-4">
        {renderPageHeader(current.title, current.subtitle)}
        <div className="flex items-center justify-between border-b border-outline-variant/30 pb-2">
          <span className="text-xs font-bold text-on-surface">预生成酒单</span>
          <span className="text-[10px] font-mono text-outline uppercase">
            {recipeSource === "database" ? "DATABASE FIRST" : "LOCAL SEED FALLBACK"} · {displayRecipes.length} ITEMS
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {displayRecipes.map(renderRecipeCard)}
        </div>
      </div>
    );
  };

  if (view === "menu") {
    return renderMenu();
  }

  if (view === "convenience-mix" && routeCocktailId) {
    return renderConvenienceDetailPage();
  }

  if (view !== "classic-remix") {
    return renderRecipeListPage();
  }

  return (
    <div className="space-y-12 max-w-4xl mx-auto pb-16 px-4">
      <button
        onClick={goBackToInspiration}
        className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#E1E1DE] bg-white px-3.5 py-2 text-xs font-bold text-neutral-700 shadow-sm active:scale-[0.98]"
      >
        <span className="material-symbols-outlined text-sm">arrow_back</span>
        返回探索
      </button>

      {!isClassicDirectDetail && (
        <>
          {/* Header text */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-outline tracking-widest uppercase bg-surface-container px-2.5 py-1 rounded-sm">
                LAB INSPIRATION
              </span>
              <div className="h-[1px] flex-grow bg-outline-variant/30"></div>
            </div>
            <h2 className="text-3xl font-serif text-on-background">Inspiration Lab</h2>
            <p className="text-sm text-on-surface-variant font-light tracking-wide">
              觉得经典鸡尾酒太苦、太烈？选择一个经典酒款，再把它调成更适合你的版本。
            </p>
          </div>

          {/* MODULE: 经典酒小白改良 */}
          <section className="space-y-6">
            <div className="flex items-baseline justify-between border-b border-outline-variant/30 pb-2">
              <div className="space-y-1">
                <h3 className="text-lg font-serif text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl">science</span>
                  经典酒改良
                </h3>
                <p className="text-xs text-outline font-light">
                  先选择经典酒款，再选择下方的改良方向。
                </p>
              </div>
            </div>

            {/* Horizontal scroll of classic cocktails */}
            <div className="flex overflow-x-auto gap-3 pb-2 no-scrollbar scroll-smooth items-center">
              {quickSelectorList.map((c) => {
                const isSelected = selectedClassicId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedClassicId(c.id);
                    }}
                    className={`flex-shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl border transition-all text-xs font-medium cursor-pointer ${
                      isSelected
                        ? `bg-black text-white border-black shadow-md scale-105`
                        : "bg-surface-container-lowest border-outline-variant/30 text-on-surface-variant hover:border-outline-variant hover:bg-surface-container-low"
                    }`}
                  >
                    <span className="text-base">{c.icon}</span>
                    <div className="text-left">
                      <div className="font-bold leading-tight">{c.name}</div>
                      <div className={`text-[9px] uppercase tracking-wider ${isSelected ? "text-white/60" : "text-outline"}`}>{c.english}</div>
                    </div>
                  </button>
                );
              })}

              <button
                onClick={() => setShowCatalogModal(true)}
                className="flex-shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-outline-variant/50 text-xs font-medium cursor-pointer bg-surface-container-low/40 text-primary hover:bg-surface-container-low hover:border-primary transition-all"
              >
                <span className="material-symbols-outlined text-sm">grid_view</span>
                <div className="text-left">
                  <div className="font-bold leading-tight">更多经典</div>
                  <div className="text-[9px] uppercase tracking-wider text-outline-variant">Catalog ({CLASSIC_DATABASE ? Object.keys(CLASSIC_DATABASE).length : 14})</div>
                </div>
              </button>
            </div>
          </section>
        </>
      )}

      {isClassicDirectDetail && improvedResult && (
        <div className="space-y-1">
          <h2 className="text-[28px] font-bold leading-tight text-neutral-950">{improvedResult.classic.chineseName}</h2>
          <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-neutral-400">{improvedResult.classic.name}</p>
          <div className="grid grid-cols-4 gap-2 pt-3">
            {(() => {
              const meta = getCocktailMvpMeta({
                id: selectedClassicId,
                nameZh: improvedResult.classic.chineseName,
                nameEn: improvedResult.classic.name,
                description: improvedResult.classic.desc,
                imageUrl: "",
                category: "经典鸡尾酒",
                tags: [],
                ingredients: improvedResult.classic.ingredients.map((ing: any) => ing.name),
                href: "",
              }, "classic");
              return [
                ["难度", `${meta.difficulty}/5`],
                ["酒感", meta.alcohol],
                ["材料", meta.availability],
                ["器具", meta.tool],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-[#E8E8E8] bg-white px-2 py-2 text-center">
                  <p className="text-[10px] font-bold text-neutral-400">{label}</p>
                  <p className="mt-0.5 text-[11px] font-bold text-neutral-800">{value}</p>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      <section className="space-y-6">

        {/* Detailed Reformer Single Column Layout */}
        <div className="space-y-6">
          
          {/* 1. Original recipe */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 space-y-5 shadow-sm">
            <div className="space-y-4">
              <div className="flex items-center justify-end">
                <span className="text-xs font-mono text-outline">ORIGINAL RECIPE</span>
              </div>

              {improvedResult ? (
                <div className="space-y-3">
                  <h4 className="text-xl font-serif font-bold text-on-surface flex flex-wrap items-baseline gap-2">
                    <span>原始配方：{improvedResult.classic.chineseName}</span>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-outline">/ ORIGINAL RECIPE</span>
                  </h4>
                  <p className="text-xs text-on-surface-variant leading-relaxed font-light bg-surface-container-low/50 p-3 rounded-xl border border-outline-variant/10">
                    {improvedResult.classic.desc}
                  </p>

                  {/* Original Ingredients List */}
                  <div className="space-y-2 pt-1">
                    <h5 className="text-[10px] font-bold text-outline uppercase tracking-wider">原配比公式</h5>
                    <div className="space-y-1.5">
                      {improvedResult.classic.ingredients.map((ing: any, i: number) => (
                        <div key={i} className="flex justify-between items-center text-xs">
                          <span className="font-medium flex items-center gap-1.5 text-on-surface-variant">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ing.color }}></span>
                            {ing.name}
                          </span>
                          <span className="font-mono text-outline">{ing.amount}ml</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {onSaveDrinkLog && (
                    <div className="pt-2">
                      <DrinkLogButton
                        recipe={{
                          id: `classic-original-${selectedClassicId}`,
                          nameZh: improvedResult.classic.chineseName,
                          nameEn: improvedResult.classic.name,
                          description: improvedResult.classic.desc,
                          tags: ["经典鸡尾酒", "原始配方"],
                          ingredients: improvedResult.classic.ingredients.map((ing: any) => ({
                            name: ing.name,
                            amount: ing.amount,
                            unit: "ml",
                          })),
                          method: "按原始配方加冰搅拌或摇合，过滤或倒入适合杯型后饮用。",
                          sourcePage: "classic_remix",
                        }}
                        sourcePage="classic_remix"
                        drinkLogs={drinkLogs}
                        onSaveDrinkLog={onSaveDrinkLog}
                        variant="text"
                        className="w-full"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-2">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs text-outline font-light">正在析出原版数据...</span>
                </div>
              )}
            </div>

            {/* Original Ratings */}
            {improvedResult && (
              <div className="pt-4 border-t border-outline-variant/20 space-y-2">
                <h5 className="text-[10px] font-bold text-outline uppercase tracking-wider flex items-center justify-between">
                  <span>原配方关键缺陷度</span>
                  <span className="font-mono text-red-500 font-bold">药苦重 / 辣口</span>
                </h5>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-on-surface-variant">苦味 Bitter</span>
                    <span className="font-mono">{renderStars(improvedResult.classic.rating.bitter, true)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-on-surface-variant">酒感 Alcohol</span>
                    <span className="font-mono">{renderStars(improvedResult.classic.rating.alcohol, true)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. Selector of directions */}
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 space-y-4 shadow-sm">
              <h4 className="text-xs font-bold text-outline uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">tune</span>
                定制改变方向（可多选）
              </h4>
              <div className="flex flex-wrap gap-2">
                {directionOptions.map((opt) => {
                  const isActive = selectedDirections.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleToggleDirection(opt.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 border transition-all cursor-pointer ${
                        isActive 
                          ? "bg-primary text-on-primary border-primary shadow-sm scale-[1.03]" 
                          : "bg-surface-container-low border-outline-variant/20 text-on-surface-variant hover:border-outline-variant/50"
                      }`}
                    >
                      {isActive && <span className="material-symbols-outlined text-xs">check</span>}
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Customized result */}
            {activeDirections.length > 0 && (
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[420px]">
              
              {/* Physics Simulated Loader Overlay */}
              {isRecalculating && (
                <div className="absolute inset-0 bg-white/80 dark:bg-black/70 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center space-y-3">
                  <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs font-serif font-bold text-primary animate-pulse">正在重新驯化分子比例...</span>
                </div>
              )}

              {improvedResult ? (
                <div className="space-y-5">
                  
                  {/* Status Indicator Tag */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-[10px] font-bold text-green-700 bg-green-50 dark:bg-green-950/25 px-2.5 py-1 rounded-sm border border-green-200/20 tracking-wider uppercase flex items-center gap-1 animate-bounce">
                      <Sparkles className="w-3 h-3 text-green-600 fill-green-600" />
                      已根据「{activeDirections.map(d => directionOptions.find(o => o.id === d)?.label || d).join("、")}」重置配比
                    </span>
                    <span className="text-xs font-mono text-outline uppercase">CUSTOMIZED RESULT</span>
                  </div>

                  {/* Header Title segment */}
                  <div className="space-y-1">
                    <h3 className="text-2xl font-serif font-bold text-primary flex items-baseline gap-2">
                      结果区：{improvedResult.improved.chineseName}
                    </h3>
                    <p className="text-[10px] uppercase font-mono text-outline tracking-wider">
                      {improvedResult.improved.name}
                    </p>
                  </div>

                  {/* Snazzy modified tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {improvedResult.improved.tags.map((t: string) => (
                      <span key={t} className="text-[10px] font-bold px-2 py-0.5 rounded bg-green-500/10 text-green-600 border border-green-500/20">
                        #{t}
                      </span>
                    ))}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-container-high text-on-surface border border-outline-variant/20">
                      #冰块 很多
                    </span>
                  </div>

                  {/* FLAVOR COMPARISON SLIDER BLOCK ABOVE RECIPE CARD (Requested!) */}
                  <div className="bg-surface-container-low/30 p-4 rounded-xl border border-outline-variant/15 space-y-3">
                    <h4 className="text-[10px] font-bold text-outline uppercase tracking-wider flex items-center gap-1.5">
                      <Activity className="w-3 h-3 text-primary" />
                      主要风味物理变化对比
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      <div className="flex justify-between items-center bg-white dark:bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-outline-variant/5">
                        <span className="text-on-surface-variant font-medium text-[11px]">苦味 Bitter</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-outline line-through">{improvedResult.classic.rating.bitter}</span>
                          <span className="text-outline-variant">→</span>
                          <span className="font-bold text-green-600 font-mono">{improvedResult.improved.rating.bitter}</span>
                          <span className="text-[10px] font-mono text-green-500">({improvedResult.improved.rating.bitter < improvedResult.classic.rating.bitter ? "↓" : "平"})</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center bg-white dark:bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-outline-variant/5">
                        <span className="text-on-surface-variant font-medium text-[11px]">酒感 Alcohol</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-outline line-through">{improvedResult.classic.rating.alcohol}</span>
                          <span className="text-outline-variant">→</span>
                          <span className="font-bold text-green-600 font-mono">{improvedResult.improved.rating.alcohol}</span>
                          <span className="text-[10px] font-mono text-green-500">({improvedResult.improved.rating.alcohol < improvedResult.classic.rating.alcohol ? "↓" : "平"})</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center bg-white dark:bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-outline-variant/5">
                        <span className="text-on-surface-variant font-medium text-[11px]">清爽 Freshness</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-outline line-through">{improvedResult.classic.rating.fresh}</span>
                          <span className="text-outline-variant">→</span>
                          <span className="font-bold text-green-600 font-mono">{improvedResult.improved.rating.fresh}</span>
                          <span className="text-[10px] font-mono text-green-500">({improvedResult.improved.rating.fresh > improvedResult.classic.rating.fresh ? "↑" : "平"})</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center bg-white dark:bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-outline-variant/5">
                        <span className="text-on-surface-variant font-medium text-[11px]">甜度 Sweetness</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-outline line-through">{improvedResult.classic.rating.sweet}</span>
                          <span className="text-outline-variant">→</span>
                          <span className="font-bold text-green-600 font-mono">{improvedResult.improved.rating.sweet}</span>
                          <span className="text-[10px] font-mono text-green-500">({improvedResult.improved.rating.sweet > improvedResult.classic.rating.sweet ? "↑" : "平"})</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RECIPE INGREDIENTS WITH HIGHLY DESCRIPTIVE TRANSITIONS (Requested!) */}
                  <div className="bg-white dark:bg-zinc-950 p-4 rounded-xl border border-outline-variant/20 space-y-3 shadow-inner">
                    <h4 className="text-[10px] font-bold text-outline uppercase tracking-wider">重置配比公式</h4>
                    <div className="divide-y divide-outline-variant/10 space-y-2.5">
                      {improvedResult.improved.ingredients.map((ing: any, i: number) => {
                        const isAdded = ing.originalAmount === 0 || !ing.originalAmount;
                        const isDecreased = ing.originalAmount && ing.amount < ing.originalAmount;
                        const isIncreased = ing.originalAmount && ing.amount > ing.originalAmount && ing.changeType !== "replace";
                        const isReplaced = ing.changeType === "replace";

                        return (
                          <div key={i} className="pt-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs">
                            {/* Ingredient name */}
                            <span className="font-medium text-on-surface flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ing.color }}></span>
                              {ing.name}
                            </span>

                            {/* Dosage translation and changes */}
                            <div className="flex items-center flex-wrap gap-2 text-[11px]">
                              {/* transition view */}
                              <span className="font-mono bg-surface-container px-2 py-0.5 rounded text-outline-variant">
                                {isAdded ? (
                                  <span className="text-green-600 font-bold">新添 +{ing.amount}ml</span>
                                ) : isReplaced ? (
                                  <span className="text-blue-500 font-bold">平替 {ing.amount}ml (原 {ing.originalAmount}ml)</span>
                                ) : isDecreased ? (
                                  <span className="text-red-500 font-bold">{ing.originalAmount}ml → {ing.amount}ml ↓</span>
                                ) : isIncreased ? (
                                  <span className="text-green-600 font-bold">{ing.originalAmount}ml → {ing.amount}ml ↑</span>
                                ) : (
                                  <span>{ing.amount}ml (恒定)</span>
                                )}
                              </span>

                              {/* explanatory sub-tag */}
                              <span className="text-outline font-light text-[10px]">
                                {ing.reason}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Explainable Logic (为什么这样改) */}
                  <div className="space-y-1.5 bg-yellow-500/5 p-4 rounded-xl border border-yellow-500/10">
                    <h4 className="text-[10px] font-bold text-amber-700 dark:text-amber-500 uppercase tracking-wider flex items-center gap-1">
                      <Sparkle className="w-3.5 h-3.5 fill-amber-600" />
                      为什么这样改：
                    </h4>
                    <p className="text-xs text-on-surface-variant leading-relaxed font-light handwritten">
                      {improvedResult.improved.comments}
                    </p>
                  </div>

                  {/* ACTION BUTTONS */}
                  <div className="pt-4 border-t border-outline-variant/15 flex flex-col sm:flex-row gap-3 justify-end">
                    {onSaveDrinkLog && (
                      <DrinkLogButton
                        recipe={{
                          id: `classic-remix-${selectedClassicId}-${activeDirections.join("-") || "custom"}`,
                          nameZh: improvedResult.improved.name,
                          nameEn: improvedResult.improved.name,
                          description: improvedResult.improved.comments,
                          tags: improvedResult.improved.tags,
                          ingredients: improvedResult.improved.ingredients.map((ing: any) => ({
                            name: ing.name,
                            amount: ing.amount,
                            unit: "ml",
                          })),
                          method: improvedResult.improved.mixMethod === "Shake" ? "加冰摇合后倒入杯中。" : "加冰轻轻搅拌后饮用。",
                          sourcePage: "classic_remix",
                        }}
                        sourcePage="classic_remix"
                        drinkLogs={drinkLogs}
                        onSaveDrinkLog={onSaveDrinkLog}
                        variant="text"
                        className="w-full sm:w-auto"
                      />
                    )}
                    
                    {/* Add to Favorites */}
                    <button
                      onClick={handleSaveToFavorites}
                      className={`rounded-xl py-3 px-5 flex items-center justify-center gap-2 text-xs font-bold active:scale-[0.98] transition-all cursor-pointer border ${
                        saveSuccess 
                          ? "bg-green-600 border-green-600 text-white"
                          : "bg-surface-container-low hover:bg-surface-container border-outline-variant/30 text-on-surface"
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${saveSuccess ? "fill-white text-white animate-ping" : "text-red-500"}`} />
                      <span>{saveSuccess ? "已成功保存到我的档案！" : "保存到我的档案"}</span>
                    </button>

                    {/* Put into Lab */}
                    {onLoadToLab && (
                      <button
                        onClick={() => {
                          if (onLoadToLab && improvedResult.improved.ingredients) {
                            onLoadToLab(
                              improvedResult.improved.ingredients, 
                              improvedResult.improved.mixMethod === "Shake" ? "Shake" : "Stir"
                            );
                          }
                        }}
                        className="bg-black hover:bg-zinc-800 text-white rounded-xl py-3 px-6 flex items-center justify-center gap-2 text-xs font-bold active:scale-[0.98] transition-all cursor-pointer shadow-md"
                      >
                        <span className="material-symbols-outlined text-sm">science</span>
                        <span>放进实验室做真实风味实验</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                </div>
              ) : (
                <div className="py-24 flex flex-col items-center justify-center text-center space-y-2">
                  <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs text-outline font-light">正在计算黄金驯化比...</span>
                </div>
              )}
            </div>
            )}
        </div>
      </section>

      {/* Section 2: 翻车急救小贴士 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-outline-variant/30 pb-2">
          <div className="space-y-1">
            <h3 className="text-base font-serif text-on-surface flex items-center gap-2">
              <Zap className="w-4 h-4 text-outline" />
              翻车急救小贴士
            </h3>
            <p className="text-xs text-outline font-light">
              调酒翻车不要慌，科学中和物理急救指南。
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-xs font-bold text-on-surface active:scale-[0.98]"
          >
            <Search className="h-3.5 w-3.5" />
            问题库
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {tips.map((tip) => (
            <div
              key={tip.id}
              className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 flex gap-4 items-center shadow-sm"
            >
              <div className="w-10 h-10 rounded-full border border-outline-variant/30 flex items-center justify-center flex-shrink-0 bg-surface-container-low">
                <span className="material-symbols-outlined text-primary text-xl">
                  {tip.icon || "science"}
                </span>
              </div>
              <div className="space-y-0.5">
                <h4 className="font-bold text-sm text-on-surface">{tip.title}</h4>
                <p className="text-xs text-on-surface-variant font-light">{tip.content}</p>
              </div>
            </div>
          ))}

        </div>
      </section>

      {/* Dynamic tip generator modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center px-3 sm:items-center sm:px-6">
          <div
            className="absolute inset-0 bg-on-background/30 backdrop-blur-sm"
            onClick={() => setShowAddModal(false)}
          ></div>
          <div className="relative flex max-h-[88vh] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[28px] border border-outline-variant/30 bg-surface-container-lowest shadow-2xl animate-in slide-in-from-bottom-8 fade-in duration-200 sm:rounded-[28px]">
            <div className="shrink-0 border-b border-outline-variant/20 bg-surface-container-lowest px-5 pb-4 pt-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-outline">Rescue Library</p>
                  <h3 className="mt-1 text-xl font-serif font-bold text-on-surface">调酒疑难问题库</h3>
                  <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                    本地收录常见翻车问题，先搜现象，再看快速补救和下次避坑。
                  </p>
                </div>
                <button
                  type="button"
                  className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-outline-variant/30 bg-white text-outline active:scale-[0.98]"
                  onClick={() => setShowAddModal(false)}
                  aria-label="关闭问题库"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              <label className="mt-4 flex h-12 items-center gap-2 rounded-full border border-outline-variant/30 bg-white px-4">
                <Search className="h-4 w-4 shrink-0 text-outline" />
                <input
                  type="text"
                  placeholder="搜索：太酸、结块、没气、酒太烈、没有青柠..."
                  className="min-w-0 flex-1 bg-transparent text-sm text-on-surface outline-none placeholder:text-outline"
                  value={newProblem}
                  onChange={(e) => setNewProblem(e.target.value)}
                />
                {newProblem && (
                  <button
                    type="button"
                    onClick={() => setNewProblem("")}
                    className="cursor-pointer text-outline"
                    aria-label="清空搜索"
                  >
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                )}
              </label>

              <div className="-mx-5 mt-3 overflow-x-auto px-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex gap-2 whitespace-nowrap">
                  {mixProblemCategories.map((category) => {
                    const active = selectedProblemCategory === category;
                    return (
                      <button
                        type="button"
                        key={category}
                        onClick={() => setSelectedProblemCategory(category)}
                        className={`h-9 shrink-0 cursor-pointer rounded-full px-3.5 text-xs font-bold active:scale-[0.98] ${
                          active ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface-variant"
                        }`}
                      >
                        {category}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#F7F7F5] px-4 py-4">
              {filteredMixProblems.length > 0 ? (
                filteredMixProblems.map((problem) => (
                  <article key={problem.id} className="rounded-3xl border border-[#E8E8E8] bg-white p-4 shadow-[0_2px_14px_rgba(15,23,42,0.05)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="rounded-full bg-[#F2F2F2] px-2.5 py-1 text-[10px] font-bold text-neutral-500">
                          {problem.category}
                        </span>
                        <h4 className="mt-2 text-base font-bold leading-snug text-neutral-950">{problem.question}</h4>
                      </div>
                      <span className="material-symbols-outlined shrink-0 text-[22px] text-neutral-300">science</span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {problem.symptoms.map((symptom) => (
                        <span key={symptom} className="rounded-full border border-[#E8E8E8] bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-500">
                          {symptom}
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 space-y-2">
                      <div className="rounded-2xl bg-neutral-950 p-3 text-white">
                        <p className="text-[11px] font-bold text-white/55">快速补救</p>
                        <p className="mt-1 text-sm leading-6">{problem.quickFix}</p>
                      </div>
                      <div className="rounded-2xl border border-[#ECECEC] bg-[#FCFCFB] p-3">
                        <p className="text-[11px] font-bold text-neutral-400">为什么会这样</p>
                        <p className="mt-1 text-xs leading-5 text-neutral-600">{problem.reason}</p>
                      </div>
                      <div className="rounded-2xl border border-[#ECECEC] bg-[#FCFCFB] p-3">
                        <p className="text-[11px] font-bold text-neutral-400">下次怎么避免</p>
                        <p className="mt-1 text-xs leading-5 text-neutral-600">{problem.nextTime}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {problem.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="rounded-full bg-[#F7F7F5] px-2 py-0.5 text-[10px] font-bold text-neutral-500">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-[#DADAD6] bg-white p-6 text-center">
                  <span className="material-symbols-outlined text-4xl text-neutral-300">search_off</span>
                  <p className="mt-2 text-sm font-bold text-neutral-700">本地问题库暂时没有匹配。</p>
                  <p className="mt-1 text-xs leading-5 text-neutral-500">换个关键词试试，比如“太甜”“没气”“奶结块”。</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Catalog Modal */}
      {showCatalogModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-on-background/40 backdrop-blur-md"
            onClick={() => setShowCatalogModal(false)}
          ></div>
          
          <div className="relative bg-surface-container-lowest w-full max-w-2xl h-[80vh] rounded-2xl overflow-hidden shadow-2xl border border-outline-variant/30 flex flex-col animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="p-6 border-b border-outline-variant/30 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-sm tracking-widest uppercase">
                    GRAND ARCHIVE
                  </span>
                  <span className="text-[10px] text-outline font-mono">{CLASSIC_DATABASE ? Object.keys(CLASSIC_DATABASE).length : 14} CLASSICS</span>
                </div>
                <h3 className="text-xl font-serif font-bold text-on-surface">全部经典调酒图鉴</h3>
                <p className="text-xs text-on-surface-variant font-light">
                  选择你想要改良驯化的经典酒款，定制更合口风味的低烈度高良率方案。
                </p>
              </div>
              <button
                onClick={() => setShowCatalogModal(false)}
                className="p-1.5 rounded-full hover:bg-surface-container-low text-outline hover:text-on-surface transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              {/* Category groupings */}
              {[
                {
                  category: "烈性干冽 Spirit-Forward",
                  description: "高酒感、纯粹、药本草本香，不加糖或极少糖，是经典鸡尾酒殿堂的坚实骨架。",
                  items: ["negroni", "old_fashioned", "martini", "manhattan"]
                },
                {
                  category: "酸甜清爽 Sour, Sweet & Fizz",
                  description: "果酸、甜感与清脆二氧化碳气泡的化学重组，清凉解暑，最容易进行好喝改良。",
                  items: ["gin_tonic", "mojito", "margarita", "whisky_sour", "moscow_mule", "daiquiri", "long_island"]
                },
                {
                  category: "风味醇厚 Rich, Creamy & Coffee",
                  description: "浓郁的烘焙咖啡油脂、热带椰奶乳香或者咸辣咸鲜番茄汁的特色交响乐。",
                  items: ["espresso_martini", "pina_colada", "bloody_mary"]
                }
              ].map((category) => (
                <div key={category.category} className="space-y-4">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold font-mono text-primary uppercase tracking-widest flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                      {category.category}
                    </h4>
                    <p className="text-[11px] text-outline font-light">{category.description}</p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {category.items.map((id) => {
                      const item = CLASSIC_DATABASE[id];
                      if (!item) return null;
                      const isSelected = selectedClassicId === item.id;
                      return (
                        <button
                          key={item.id}
                            onClick={() => {
                              setSelectedClassicId(item.id);
                              setShowCatalogModal(false);
                            }}
                          className={`p-4 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                            isSelected
                              ? "bg-black text-white border-black shadow-md scale-[1.02]"
                              : "bg-surface-container-low/50 border-outline-variant/20 hover:border-outline-variant hover:bg-surface-container-low"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl p-2 bg-surface-container-high rounded-lg">{item.icon}</span>
                            <div>
                              <div className="text-xs font-bold leading-tight">{item.name}</div>
                              <div className={`text-[10px] uppercase tracking-wider font-mono ${isSelected ? "text-white/60" : "text-outline"}`}>
                                {item.english}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            {isSelected ? (
                              <span className="text-[10px] font-bold bg-white/20 text-white px-2 py-0.5 rounded uppercase">
                                已选 ACTIVE
                              </span>
                            ) : (
                              <span className="material-symbols-outlined text-outline text-sm group-hover:translate-x-1 transition-transform">
                                arrow_forward
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Footer */}
            <div className="p-4 bg-surface-container-low/40 border-t border-outline-variant/20 text-center">
              <p className="text-[10px] text-outline font-light">
                如果你发现其他不好入口的经典酒，可以先在问题库里找补救建议，或回到探索页选择更低门槛的酒款。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
