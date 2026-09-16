import { classify, type GuideDrink } from "../recommendations/beginner";
export interface ClassicCocktailData {
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
  sources?: { title: string; url: string }[];
  methodNote?: string;
  ingredients: {
    name: string;
    amount: number;
    category: string;
    color: string;
  }[];
}

export const CLASSIC_DATABASE: Record<string, ClassicCocktailData> = {
  whisky_highball: {
    id: "whisky_highball", name: "威士忌嗨棒", english: "Whisky Highball", icon: "🥃",
    desc: "威士忌与冰镇苏打水组成的清爽长饮。这里采用 1:3 的示例配比。",
    themeColor: "from-amber-200/20 to-neutral-100/20", rating: { bitter: 1, alcohol: 2, fresh: 4, sweet: 1 },
    ingredients: [
      { name: "威士忌 Whisky", amount: 30, category: "基酒", color: "rgba(217,119,6,.4)" },
      { name: "苏打水 Soda", amount: 90, category: "辅料", color: "rgba(224,242,254,.3)" }
    ],
    methodNote: "杯中加冰，加入威士忌并冷却，再加入冰镇苏打水，轻轻搅拌。此处 30ml 与 90ml 是按来源 1:3 比例设置的示例份量。",
    sources: [{title:"Suntory Highball",url:"https://house.suntory.com/cocktails/whisky-highball"}]
  },
  paloma: {
    id: "paloma", name: "帕洛玛", english: "Paloma", icon: "🍊",
    desc: "龙舌兰、青柠和粉红葡萄柚汽水组成的长饮，带少许盐。",
    themeColor: "from-pink-200/20 to-neutral-100/20", rating: { bitter: 2, alcohol: 2, fresh: 4, sweet: 2 },
    ingredients: [
      { name: "龙舌兰 Tequila", amount: 50, category: "基酒", color: "rgba(217,119,6,.2)" },
      { name: "青柠汁 Lime", amount: 5, category: "果汁", color: "rgba(132,204,22,.4)" },
      { name: "粉红葡萄柚汽水", amount: 100, category: "辅料", color: "rgba(251,113,133,.3)" }
    ],
    methodNote: "杯中加入龙舌兰和青柠汁，加入冰块及一小撮盐，补入粉红葡萄柚汽水，轻轻搅拌。以青柠片装饰。盐为非液体辅料，不计入毫升配方。",
    sources: [{title:"IBA Paloma",url:"https://iba-world.com/iba-cocktail/paloma/"}]
  },

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

export const directionOptions = [
  { id: "less_alcohol", label: "降低酒感", icon: "feather", desc: "减少烈酒冲击，入口更轻" },
  { id: "less_bitter", label: "少苦一点", icon: "smile", desc: "降低药草苦、咖啡苦或汤力苦" },
  { id: "sweeter", label: "甜一点", icon: "sparkle", desc: "增加圆润甜感" },
  { id: "more_acid", label: "酸一点", icon: "sparkle", desc: "增加明亮果酸" },
  { id: "fresher", label: "清爽一点", icon: "droplets", desc: "用气泡或茶饮拉轻酒体" },
  { id: "lighter_body", label: "酒体更轻", icon: "droplets", desc: "做成更轻盈的长饮" },
  { id: "convenience", label: "便利店版", icon: "store", desc: "便利店材料优先" },
  { id: "juice", label: "果汁型", icon: "sparkle", desc: "果汁主体，更低门槛" },
];

export type ExploreTab = "convenience" | "classic";

export type InspirationCocktail = {
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

export type ConvenienceRecipeGuide = {
  glass: string;
  ingredientLines: string[];
  steps: string[];
  beginnerTips: string[];
};

export const getCocktailMvpMeta = (cocktail: InspirationCocktail, tab?: ExploreTab) => {
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

export const convenienceCategories = ["全部", "金酒", "伏特加", "威士忌", "朗姆", "龙舌兰", "啤酒", "烧酒", "梅酒", "白兰地", "清酒", "利口酒", "苦味酒", "低酒感", "果香", "奶香"];
export const classicCategories = ["全部", "金酒", "伏特加", "威士忌", "朗姆", "龙舌兰", "白兰地", "梅斯卡尔", "皮斯科", "卡莎萨", "起泡酒", "利口酒", "苦味酒", "酸甜", "清爽", "果香", "草本"];

export const curatedClassicExploreCocktails: InspirationCocktail[] = [
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
    ingredients: ["龙舌兰", "青柠汁", "粉红葡萄柚汽水", "盐"],
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

export const curatedConvenienceExploreCocktails: InspirationCocktail[] = [
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

export const convenienceRecipeGuides: Record<string, ConvenienceRecipeGuide> = {
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

export const exploreImagePool = [
  "/images/cocktails/margarita.svg",
  "/images/cocktails/grapefruit-beer.svg",
  "/images/cocktails/singapore-sling.svg",
  "/images/cocktails/strawberry-daiquiri.svg",
  "/images/cocktails/mojito.svg",
  "/images/cocktails/gin-tonic.svg",
  "/images/cocktails/coconut-rum.svg",
  "/images/cocktails/lime-soju-soda.svg",
];

export const simpleSlug = (value: string) => value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const normalizeClassicCocktailId = (value: string) => {
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
    highball: "whisky_highball",
    whiskey_highball: "whisky_highball",
    classic_whiskey_highball: "whisky_highball",
    aperol_spritz: "aperol_spritz",
    cosmopolitan: "cosmopolitan",
  };
  return aliases[normalized] ?? normalized;
};

export const dedupeCocktails = (items: InspirationCocktail[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

export const actualClassicSeeds: Array<Omit<InspirationCocktail, "imageUrl" | "href">> = [
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

export const classicTemplateBases = [
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

export const classicTemplateStyles = [
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

export const generatedClassicCocktails: InspirationCocktail[] = classicTemplateBases.flatMap((base, baseIndex) =>
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

export const actualClassicCocktails: InspirationCocktail[] = actualClassicSeeds.map((item, index) => ({
  ...item,
  imageUrl: exploreImagePool[index % exploreImagePool.length],
  href: `/inspiration/classic-remix?cocktail=${item.id}`,
}));

export const classicExploreCocktails: InspirationCocktail[] = dedupeCocktails([
  ...curatedClassicExploreCocktails,
  ...actualClassicCocktails,
  ...generatedClassicCocktails,
]);

export const convenienceSpiritOptions = [
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

export const convenienceMixerOptions = [
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

export const generatedConvenienceCocktails: InspirationCocktail[] = convenienceSpiritOptions.flatMap((spirit, spiritIndex) =>
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

export const convenienceExploreCocktails: InspirationCocktail[] = dedupeCocktails([
  ...curatedConvenienceExploreCocktails,
  ...generatedConvenienceCocktails,
]);

export const BEGINNER_CATALOG: GuideDrink[] = [
  ...classicExploreCocktails.map(d => classify(d, "classic")),
  ...convenienceExploreCocktails.map(d => classify(d, "easy")),
].filter((d): d is GuideDrink => d !== null);

export const getConvenienceRecipeGuide = (cocktail: InspirationCocktail): ConvenienceRecipeGuide => {
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
