export type RecipeIngredientSeed = {
  nameCn: string;
  nameEn: string;
  amount: string;
  unit: string;
  role: "base" | "mixer" | "juice" | "syrup" | "bitter" | "garnish" | "optional";
  substituteNote?: string;
  isOptional?: boolean;
};

export type RecipeSeed = {
  slug: string;
  nameCn: string;
  nameEn: string;
  type: "classic" | "classic_variant" | "convenience" | "beginner" | "flavor" | "knowledge";
  baseSpirit: string;
  description: string;
  story?: string;
  method: string;
  glassware: string;
  ice: string;
  difficulty: number;
  abvLevel: number;
  sweetnessLevel: number;
  acidityLevel: number;
  bitternessLevel: number;
  alcoholIntensity: number;
  freshnessLevel: number;
  fruitinessLevel: number;
  convenienceScore: number;
  beginnerScore: number;
  estimatedCostLevel: number;
  prepTimeMinutes: number;
  ingredients: RecipeIngredientSeed[];
  tags: string[];
};

export type RemixTagSeed = {
  slug: string;
  nameCn: string;
  nameEn: string;
  description: string;
  sortOrder: number;
};

export const REMIX_TAGS: RemixTagSeed[] = [
  ["less-alcohol", "降低酒感", "Less Alcohol", "降低基酒冲击，做成更容易入口的版本"],
  ["less-bitter", "少苦一点", "Less Bitter", "减少药草苦、咖啡苦或汤力苦"],
  ["sweeter", "甜一点", "Sweeter", "增加圆润甜感，包住尖锐酒味"],
  ["more-acid", "酸一点", "More Acid", "增加柑橘或果酸，让口感更明亮"],
  ["fresher", "清爽一点", "Fresher", "用气泡、茶饮或冰块拉轻酒体"],
  ["fruitier", "果香增强", "Fruitier", "增加果汁、果味汽水或水果装饰"],
  ["lighter-body", "酒体更轻", "Lighter Body", "降低厚重感，适合长饮"],
  ["sparkling", "气泡化", "Sparkling", "改成 Spritz、Fizz 或 Highball 方向"],
  ["convenience", "便利店版", "Convenience Version", "尽量使用便利店和超市材料"],
  ["beginner", "适合新手", "Beginner Friendly", "降低失败率，不苦不烈"],
  ["no-shaker", "不用摇壶", "No Shaker", "不需要专业器具"],
  ["low-cost", "低成本", "Low Cost", "控制材料成本"],
  ["tea-forward", "茶感明显", "Tea Forward", "用乌龙、绿茶、红茶做主体"],
  ["milky", "奶香一点", "Milky", "加入乳酸、牛奶、椰奶或奶茶感"],
  ["coffee", "咖啡型", "Coffee Style", "加入咖啡、咖啡利口或烘焙香"],
  ["juice", "果汁型", "Juice Style", "用果汁做主体，降低门槛"],
  ["long-drink", "长饮版", "Long Drink", "容量更大、酒感更低"],
  ["hot-drink", "热饮版", "Hot Drink", "适合热茶、热咖啡或冬季方向"],
].map(([slug, nameCn, nameEn, description], index) => ({ slug, nameCn, nameEn, description, sortOrder: index + 1 }));

const classicNames = [
  ["negroni", "内格罗尼", "Negroni", "gin"],
  ["old-fashioned", "古典老式", "Old Fashioned", "whisky"],
  ["martini", "经典马丁尼", "Martini", "gin"],
  ["margarita", "玛格丽特", "Margarita", "tequila"],
  ["gin-tonic", "金汤力", "Gin Tonic", "gin"],
  ["highball", "威士忌嗨棒", "Whisky Highball", "whisky"],
  ["mojito", "莫吉托", "Mojito", "rum"],
  ["daiquiri", "戴克里", "Daiquiri", "rum"],
  ["cosmopolitan", "大都会", "Cosmopolitan", "vodka"],
  ["espresso-martini", "浓缩马天尼", "Espresso Martini", "vodka"],
  ["moscow-mule", "莫斯科骡子", "Moscow Mule", "vodka"],
  ["bloody-mary", "血腥玛丽", "Bloody Mary", "vodka"],
  ["manhattan", "曼哈顿", "Manhattan", "whisky"],
  ["whiskey-sour", "威士忌酸", "Whiskey Sour", "whisky"],
  ["tom-collins", "汤姆柯林斯", "Tom Collins", "gin"],
  ["aperol-spritz", "阿佩罗司普瑞兹", "Aperol Spritz", "liqueur"],
  ["french-75", "法国 75", "French 75", "gin"],
  ["pina-colada", "椰林飘香", "Piña Colada", "rum"],
  ["mai-tai", "迈泰", "Mai Tai", "rum"],
  ["paloma", "帕洛玛", "Paloma", "tequila"],
  ["tequila-sunrise", "龙舌兰日出", "Tequila Sunrise", "tequila"],
  ["cuba-libre", "自由古巴", "Cuba Libre", "rum"],
  ["americano", "美式鸡尾酒", "Americano", "liqueur"],
  ["boulevardier", "布尔瓦迪耶", "Boulevardier", "whisky"],
  ["sazerac", "萨泽拉克", "Sazerac", "whisky"],
  ["sidecar", "边车", "Sidecar", "brandy"],
  ["mint-julep", "薄荷朱莉普", "Mint Julep", "whisky"],
  ["dark-n-stormy", "黑暗风暴", "Dark n Stormy", "rum"],
  ["bellini", "贝里尼", "Bellini", "wine"],
  ["mimosa", "含羞草", "Mimosa", "wine"],
  ["irish-coffee", "爱尔兰咖啡", "Irish Coffee", "whisky"],
  ["white-russian", "白俄罗斯", "White Russian", "vodka"],
  ["black-russian", "黑俄罗斯", "Black Russian", "vodka"],
  ["sea-breeze", "海风", "Sea Breeze", "vodka"],
  ["caipirinha", "凯匹林纳", "Caipirinha", "rum"],
  ["pisco-sour", "皮斯科酸", "Pisco Sour", "brandy"],
  ["aviation", "航空", "Aviation", "gin"],
  ["last-word", "最后一言", "Last Word", "gin"],
  ["corpse-reviver-no-2", "亡者复苏 2 号", "Corpse Reviver No.2", "gin"],
  ["gimlet", "琴蕾", "Gimlet", "gin"],
  ["clover-club", "三叶草俱乐部", "Clover Club", "gin"],
  ["bramble", "荆棘", "Bramble", "gin"],
  ["bees-knees", "蜜蜂膝盖", "Bee's Knees", "gin"],
  ["southside", "南城", "Southside", "gin"],
  ["singapore-sling", "新加坡司令", "Singapore Sling", "gin"],
  ["ramos-gin-fizz", "拉莫斯金菲士", "Ramos Gin Fizz", "gin"],
  ["penicillin", "盘尼西林", "Penicillin", "whisky"],
  ["gold-rush", "淘金热", "Gold Rush", "whisky"],
  ["paper-plane", "纸飞机", "Paper Plane", "whisky"],
  ["rob-roy", "罗布罗伊", "Rob Roy", "whisky"],
  ["rusty-nail", "锈钉", "Rusty Nail", "whisky"],
  ["vieux-carre", "老广场", "Vieux Carré", "whisky"],
  ["jungle-bird", "丛林鸟", "Jungle Bird", "rum"],
  ["painkiller", "止痛药", "Painkiller", "rum"],
  ["hurricane", "飓风", "Hurricane", "rum"],
  ["planters-punch", "种植者潘趣", "Planter's Punch", "rum"],
  ["tommys-margarita", "汤米玛格丽特", "Tommy's Margarita", "tequila"],
  ["ranch-water", "牧场水", "Ranch Water", "tequila"],
  ["batanga", "巴坦加", "Batanga", "tequila"],
  ["oaxaca-old-fashioned", "瓦哈卡老式", "Oaxaca Old Fashioned", "mezcal"],
  ["mezcal-negroni", "梅斯卡尔内格罗尼", "Mezcal Negroni", "mezcal"],
  ["lemon-drop-martini", "柠檬滴马天尼", "Lemon Drop Martini", "vodka"],
  ["harvey-wallbanger", "哈维撞墙", "Harvey Wallbanger", "vodka"],
  ["screwdriver", "螺丝起子", "Screwdriver", "vodka"],
  ["cape-codder", "科德角", "Cape Codder", "vodka"],
  ["french-connection", "法国连接", "French Connection", "brandy"],
  ["stinger", "毒刺", "Stinger", "brandy"],
  ["brandy-alexander", "白兰地亚历山大", "Brandy Alexander", "brandy"],
  ["kir-royale", "皇家基尔", "Kir Royale", "wine"],
  ["champagne-cocktail", "香槟鸡尾酒", "Champagne Cocktail", "wine"],
  ["hugo-spritz", "雨果司普瑞兹", "Hugo Spritz", "wine"],
  ["garibaldi", "加里波第", "Garibaldi", "liqueur"],
  ["sherry-cobbler", "雪莉考伯勒", "Sherry Cobbler", "wine"],
  ["bamboo", "竹子", "Bamboo", "wine"],
  ["adonis", "阿多尼斯", "Adonis", "wine"],
  ["vermouth-tonic", "美思汤力", "Vermouth Tonic", "wine"],
  ["campari-soda", "金巴利苏打", "Campari Soda", "liqueur"],
  ["spritz-veneziano", "威尼斯司普瑞兹", "Spritz Veneziano", "wine"],
  ["greyhound", "灰狗", "Greyhound", "vodka"],
  ["salty-dog", "咸狗", "Salty Dog", "vodka"],
  ["godfather", "教父", "Godfather", "whisky"],
] as const;

const baseLabel: Record<string, [string, string]> = {
  gin: ["金酒", "Gin"],
  vodka: ["伏特加", "Vodka"],
  whisky: ["威士忌", "Whisky"],
  rum: ["朗姆", "Rum"],
  tequila: ["龙舌兰", "Tequila"],
  beer: ["啤酒", "Beer"],
  wine: ["葡萄酒/起泡酒", "Wine"],
  liqueur: ["利口酒/苦味酒", "Liqueur"],
  brandy: ["白兰地", "Brandy"],
  mezcal: ["梅斯卡尔", "Mezcal"],
  sake: ["清酒", "Sake"],
  soju: ["烧酒", "Soju"],
  non_alcoholic: ["无酒精基底", "Non Alcoholic"],
};

const modifierForBase = (baseSpirit: string): RecipeIngredientSeed[] => {
  if (["gin", "vodka", "rum", "tequila", "whisky", "mezcal", "brandy"].includes(baseSpirit)) {
    return [
      { nameCn: "柠檬汁", nameEn: "Lemon Juice", amount: "15", unit: "ml", role: "juice", substituteNote: "可用水溶C、柠檬茶或青柠汁替代" },
      { nameCn: "糖浆", nameEn: "Simple Syrup", amount: "10", unit: "ml", role: "syrup", substituteNote: "可用蜂蜜水或甜味汽水少量替代" },
    ];
  }
  return [
    { nameCn: "苏打水", nameEn: "Soda Water", amount: "90", unit: "ml", role: "mixer", substituteNote: "可用气泡水、雪碧或无糖气泡饮替代" },
  ];
};

export const CLASSIC_RECIPE_SEEDS: RecipeSeed[] = classicNames.map(([slug, nameCn, nameEn, baseSpirit], index) => {
  const [baseCn, baseEn] = baseLabel[baseSpirit] ?? baseLabel.gin;
  const isLong = ["highball", "gin-tonic", "mojito", "aperol-spritz", "tom-collins", "paloma"].includes(slug);
  return {
    slug,
    nameCn,
    nameEn,
    type: "classic",
    baseSpirit,
    description: `${nameCn} 是经典鸡尾酒中的代表款，核心是 ${baseCn} 与酸、甜、苦或气泡之间的平衡。`,
    story: `这是一条适合知识库展示的经典配方，可用于理解 ${nameEn} 的基础风味结构和后续改良方向。`,
    method: isLong ? "在高杯中加满冰块，倒入材料后轻轻搅拌。" : "加冰搅拌或摇和至充分冰镇，倒入杯中。",
    glassware: isLong ? "Highball" : "Cocktail / Rocks",
    ice: isLong ? "满杯冰块" : "搅拌冰或摇和冰",
    difficulty: index % 5 === 0 ? 3 : index % 3 === 0 ? 2 : 1,
    abvLevel: ["wine", "beer"].includes(baseSpirit) ? 2 : 3,
    sweetnessLevel: index % 4 === 0 ? 4 : 2,
    acidityLevel: index % 3 === 0 ? 4 : 3,
    bitternessLevel: ["liqueur", "gin"].includes(baseSpirit) ? 3 : 1,
    alcoholIntensity: ["wine", "beer"].includes(baseSpirit) ? 2 : 3,
    freshnessLevel: isLong ? 5 : 3,
    fruitinessLevel: ["rum", "tequila", "vodka"].includes(baseSpirit) ? 4 : 2,
    convenienceScore: isLong ? 5 : 3,
    beginnerScore: isLong ? 4 : 2,
    estimatedCostLevel: index % 4 === 0 ? 3 : 2,
    prepTimeMinutes: isLong ? 3 : 5,
    ingredients: [
      { nameCn: baseCn, nameEn: baseEn, amount: ["wine", "beer"].includes(baseSpirit) ? "90" : "45", unit: "ml", role: "base" },
      ...modifierForBase(baseSpirit),
      { nameCn: "装饰", nameEn: "Garnish", amount: "1", unit: "份", role: "garnish", isOptional: true, substituteNote: "可用柠檬片、橙皮、薄荷或盐边" },
    ],
    tags: ["classic", baseSpirit, isLong ? "清爽一点" : "经典", "知识库"],
  };
});

const conveniencePairs = [
  ["啤酒", "Beer", "beer", ["西柚汽水", "柠檬汽水", "乌龙茶", "绿茶", "可尔必思", "养乐多", "番茄汁", "姜汁汽水", "雪碧", "梅子饮料", "菠萝汁", "橙汁"]],
  ["威士忌", "Whisky", "whisky", ["可乐", "苏打水", "乌龙茶", "绿茶", "苹果汁", "姜汁汽水", "蜂蜜柠檬", "冰红茶", "椰子水", "奶茶"]],
  ["金酒", "Gin", "gin", ["汤力水", "苏打水", "西柚汽水", "柠檬茶", "青瓜苏打", "乌龙茶", "葡萄汁", "苹果苏打", "橙汁", "养乐多"]],
  ["伏特加", "Vodka", "vodka", ["橙汁", "蔓越莓汁", "雪碧", "苏打水", "西柚饮料", "养乐多", "可尔必思", "冰红茶", "葡萄汁", "柠檬汽水"]],
  ["朗姆", "Rum", "rum", ["可乐", "雪碧", "椰汁", "菠萝汁", "橙汁", "冰红茶", "姜汁汽水", "芒果汁", "椰子水", "奶茶"]],
  ["龙舌兰", "Tequila", "tequila", ["西柚汽水", "橙汁", "雪碧", "苏打水", "柠檬茶", "菠萝汁", "番茄汁", "青柠苏打"]],
  ["梅酒", "Umeshu", "liqueur", ["苏打水", "绿茶", "乌龙茶", "橙汁", "柠檬汽水", "苹果汁"]],
  ["烧酒", "Soju", "soju", ["果汁", "乳酸菌饮料", "西瓜汁", "水蜜桃饮料", "苏打水", "乌龙茶"]],
  ["清酒", "Sake", "sake", ["苏打水", "柚子汁", "绿茶", "白葡萄汁", "梅子饮料"]],
] as const;

const mixerEn = (mixer: string) => mixer.replace("汽水", " Soda").replace("汁", " Juice").replace("茶", " Tea");

export const generateConvenienceRecipes = (count = 210): RecipeSeed[] => {
  const recipes: RecipeSeed[] = [];
  let round = 0;
  while (recipes.length < count) {
    for (const [baseCn, baseEn, baseSpirit, mixers] of conveniencePairs) {
      for (const mixer of mixers) {
        const nameCn = round === 0 ? `${baseCn}${mixer}特调` : `${baseCn}${mixer}${round === 1 ? "冰爽版" : "轻盈版"}`;
        recipes.push({
          slug: `convenience-${baseSpirit}-${slugPart(mixer)}-${round}`,
          nameCn,
          nameEn: `${baseEn} ${mixerEn(mixer)} Mix`,
          type: "convenience",
          baseSpirit,
          description: `用 ${baseCn} 和 ${mixer} 做的一杯便利店特调，材料容易买，适合先从小比例试味。`,
          story: "适合便利店、超市和宿舍场景。先加冰，再倒基酒，最后补饮料，轻轻搅拌即可。",
          method: "杯中加满冰块，倒入基酒，再加入饮料，轻搅 3-5 秒。",
          glassware: "Highball",
          ice: "满杯冰块",
          difficulty: 1,
          abvLevel: baseSpirit === "beer" ? 1 : baseSpirit === "soju" || baseSpirit === "sake" ? 2 : 3,
          sweetnessLevel: /雪碧|果汁|养乐多|可尔必思|奶茶|梅子|蜂蜜/.test(mixer) ? 4 : 2,
          acidityLevel: /柠檬|西柚|青柠|橙|菠萝|番茄/.test(mixer) ? 4 : 2,
          bitternessLevel: /乌龙|绿茶|汤力|咖啡/.test(mixer) ? 2 : 1,
          alcoholIntensity: baseSpirit === "beer" ? 1 : baseSpirit === "soju" || baseSpirit === "sake" ? 2 : 3,
          freshnessLevel: /苏打|汽水|雪碧|西柚/.test(mixer) ? 5 : 3,
          fruitinessLevel: /果|橙|菠萝|苹果|葡萄|桃|西瓜|柚/.test(mixer) ? 4 : 2,
          convenienceScore: 5,
          beginnerScore: /汤力|番茄|乌龙|绿茶/.test(mixer) ? 3 : 5,
          estimatedCostLevel: 2,
          prepTimeMinutes: 3,
          ingredients: [
            { nameCn: baseCn, nameEn: baseEn, amount: baseSpirit === "beer" ? "120" : "30", unit: "ml", role: "base" },
            { nameCn: mixer, nameEn: mixerEn(mixer), amount: baseSpirit === "beer" ? "90" : "120", unit: "ml", role: /汁/.test(mixer) ? "juice" : "mixer", substituteNote: "可替换为同类型便利店饮料，先少量试味" },
            { nameCn: "冰块", nameEn: "Ice", amount: "满杯", unit: "", role: "optional", isOptional: true },
          ],
          tags: ["便利店版", "不用摇壶", baseSpirit, /汽水|苏打|雪碧/.test(mixer) ? "清爽一点" : "低成本"],
        });
        if (recipes.length >= count) return recipes;
      }
    }
    round += 1;
  }
  return recipes;
};

const variantDirections = REMIX_TAGS.slice(0, 12);

export const generateClassicVariants = (countPerClassic = 8): RecipeSeed[] =>
  CLASSIC_RECIPE_SEEDS.slice(0, 50).flatMap((classic) =>
    variantDirections.slice(0, countPerClassic).map((tag, index) => ({
      ...classic,
      slug: `variant-${classic.slug}-${tag.slug}`,
      nameCn: `${classic.nameCn}${tag.nameCn}版`,
      nameEn: `${classic.nameEn} ${tag.nameEn} Remix`,
      type: "classic_variant" as const,
      description: `把 ${classic.nameCn} 改成「${tag.nameCn}」方向：更低门槛、更好入口，同时保留原版的核心香气。`,
      story: `变化重点：${tag.description}。保留 ${classic.nameCn} 的主风味骨架，降低新手不适感。`,
      method: tag.slug === "sparkling" || tag.slug === "fresher" ? "杯中加冰，先倒非气泡材料，最后补气泡并轻搅。" : "杯中加冰，按比例倒入材料，轻轻搅拌均匀。",
      glassware: tag.slug === "sparkling" || tag.slug === "long-drink" ? "Highball" : classic.glassware,
      ice: "满杯冰块",
      difficulty: 1,
      abvLevel: Math.max(1, classic.abvLevel - (tag.slug === "less-alcohol" || tag.slug === "lighter-body" ? 1 : 0)),
      sweetnessLevel: Math.min(5, classic.sweetnessLevel + (tag.slug === "sweeter" ? 1 : 0)),
      acidityLevel: Math.min(5, classic.acidityLevel + (tag.slug === "more-acid" ? 1 : 0)),
      bitternessLevel: Math.max(1, classic.bitternessLevel - (tag.slug === "less-bitter" || tag.slug === "beginner" ? 1 : 0)),
      alcoholIntensity: Math.max(1, classic.alcoholIntensity - (tag.slug === "less-alcohol" || tag.slug === "beginner" ? 1 : 0)),
      freshnessLevel: Math.min(5, classic.freshnessLevel + (tag.slug === "fresher" || tag.slug === "sparkling" ? 2 : 1)),
      fruitinessLevel: Math.min(5, classic.fruitinessLevel + (tag.slug === "fruitier" || tag.slug === "juice" ? 2 : 0)),
      convenienceScore: tag.slug === "convenience" ? 5 : 4,
      beginnerScore: tag.slug === "beginner" || tag.slug === "less-alcohol" ? 5 : 4,
      prepTimeMinutes: 3,
      ingredients: [
        ...classic.ingredients.slice(0, 1).map((item) => ({ ...item, amount: index % 3 === 0 ? "25" : item.amount, substituteNote: "想低酒感可以减量 5-10ml" })),
        { nameCn: tag.slug === "sparkling" ? "苏打水" : tag.slug === "fruitier" ? "橙汁" : "冰块", nameEn: tag.slug === "fruitier" ? "Orange Juice" : "Soda / Ice", amount: tag.slug === "sparkling" ? "90" : tag.slug === "fruitier" ? "60" : "满杯", unit: tag.slug === "sparkling" || tag.slug === "fruitier" ? "ml" : "", role: tag.slug === "fruitier" ? "juice" : "mixer", substituteNote: "可用便利店同类型饮料替代" },
        { nameCn: "柠檬片", nameEn: "Lemon Slice", amount: "1", unit: "片", role: "garnish", isOptional: true },
      ],
      tags: [tag.nameCn, "经典酒改良", "适合新手", "低成本", classic.baseSpirit],
    })),
  );

export const generateBeginnerRecipes = (count = 110): RecipeSeed[] => {
  const bases = [["烧酒", "Soju", "soju"], ["梅酒", "Umeshu", "liqueur"], ["啤酒", "Beer", "beer"], ["伏特加", "Vodka", "vodka"], ["朗姆", "Rum", "rum"], ["无酒精气泡水", "Sparkling Water", "non_alcoholic"]] as const;
  const mixers = ["养乐多", "橙汁", "苹果汁", "乌龙茶", "柠檬汽水", "椰子水", "奶茶", "咖啡", "西柚汽水", "葡萄汁", "水蜜桃饮料"];
  const recipes: RecipeSeed[] = [];
  let round = 0;
  while (recipes.length < count) {
    for (const [baseCn, baseEn, baseSpirit] of bases) {
      for (const mixer of mixers) {
        const variantName = round === 0 ? "入门杯" : round === 1 ? "轻盈杯" : "冰爽杯";
      recipes.push({
        slug: `beginner-${baseSpirit}-${slugPart(mixer)}-${round}`,
        nameCn: `${mixer}${baseCn}${variantName}`,
        nameEn: `${mixerEn(mixer)} ${baseEn} Beginner Mix`,
        type: "beginner",
        baseSpirit,
        description: `低失败率入门配方，${mixer} 负责主体风味，${baseCn} 只提供轻微酒感。`,
        story: "适合第一次尝试调酒的人，先做一杯量，觉得烈就继续补冰和饮料。",
        method: "杯中加冰，倒入基底和饮料，轻搅即可。",
        glassware: "Highball",
        ice: "满杯冰块",
        difficulty: 1,
        abvLevel: baseSpirit === "non_alcoholic" ? 0 : 1,
        sweetnessLevel: /奶茶|养乐多|葡萄|蜜桃|橙/.test(mixer) ? 4 : 2,
        acidityLevel: /柠檬|西柚|橙|养乐多/.test(mixer) ? 4 : 2,
        bitternessLevel: /乌龙|咖啡/.test(mixer) ? 2 : 1,
        alcoholIntensity: baseSpirit === "non_alcoholic" ? 0 : 1,
        freshnessLevel: /汽水|椰子水|乌龙/.test(mixer) ? 5 : 3,
        fruitinessLevel: /汁|柚|橙|苹果|葡萄|蜜桃/.test(mixer) ? 5 : 2,
        convenienceScore: 5,
        beginnerScore: 5,
        estimatedCostLevel: 1,
        prepTimeMinutes: 2,
        ingredients: [
          { nameCn: baseCn, nameEn: baseEn, amount: baseSpirit === "non_alcoholic" ? "0" : "20", unit: "ml", role: "base" },
          { nameCn: mixer, nameEn: mixerEn(mixer), amount: "140", unit: "ml", role: /汁/.test(mixer) ? "juice" : "mixer" },
          { nameCn: "冰块", nameEn: "Ice", amount: "满杯", unit: "", role: "optional", isOptional: true },
        ],
        tags: ["适合新手", "低酒感", "低成本", /汽水|乌龙|椰子/.test(mixer) ? "清爽一点" : "果汁型"],
      });
      if (recipes.length >= count) return recipes;
      }
    }
    round += 1;
  }
  return recipes;
};

const slugPart = (value: string) => value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-").replace(/^-|-$/g, "");

const uniqueBySlug = (recipes: RecipeSeed[]) => Array.from(new Map(recipes.map((recipe) => [recipe.slug, recipe])).values());

export const INSPIRATION_RECIPES: RecipeSeed[] = uniqueBySlug([
  ...CLASSIC_RECIPE_SEEDS,
  ...generateConvenienceRecipes(210),
  ...generateClassicVariants(8),
  ...generateBeginnerRecipes(110),
]);
