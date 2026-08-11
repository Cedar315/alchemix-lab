export type MixMethod = "Stir" | "Shake";

export type MixologyIngredient = {
  name: string;
  amount: number;
  category: string;
  abv?: number;
  sweetness?: number;
  acidity?: number;
  bitterness?: number;
  carbonation?: number;
  viscosity?: number;
  dairy?: number;
  tea?: number;
  fruit?: number;
  freshness?: number;
  sugarGPer100ml?: number | null;
  caffeineMgPer100ml?: number | null;
  caffeine?: boolean | null;
  flavorTags?: string[];
  mainComponents?: string[];
  goodWith?: string[];
  riskyWith?: string[];
};

export type MixologyAnalysis = {
  chineseName: string;
  name: string;
  subtitle: string;
  rating: {
    sweet: number;
    acid: number;
    strength: number;
    creamy: number;
    herbal: number;
    bubbly: number;
    freshness: number;
    heaviness: number;
  };
  metrics: {
    totalVolumeMl: number;
    estimatedAbv: number;
    sugarG: number;
    sugarGPer100ml: number;
    acidLoad: number;
    bitternessLoad: number;
    carbonationLoad: number;
    viscosityLoad: number;
  };
  reactions: Array<{
    key: string;
    title: string;
    description: string;
    severity: "info" | "warning";
  }>;
  comments: string;
  adviceSections: Array<{
    title: string;
    body: string;
  }>;
  tags: string[];
};

const clampScore = (value: number) => Math.min(5, Math.max(1, Math.round(value)));
const weightedAverage = (ingredients: MixologyIngredient[], pick: (item: MixologyIngredient) => number | undefined) => {
  const total = ingredients.reduce((sum, item) => sum + safeAmount(item), 0) || 1;
  return ingredients.reduce((sum, item) => sum + safeAmount(item) * (pick(item) ?? 0), 0) / total;
};
const safeAmount = (item: MixologyIngredient) => Math.max(0, Number(item.amount || 0));
const hasText = (item: MixologyIngredient, patterns: string[]) => {
  const text = [
    item.name,
    item.category,
    ...(item.flavorTags ?? []),
    ...(item.mainComponents ?? []),
  ].join(" ").toLowerCase();
  return patterns.some((pattern) => text.includes(pattern.toLowerCase()));
};

const inferName = (ingredients: MixologyIngredient[], method: MixMethod, rating: MixologyAnalysis["rating"]) => {
  const hasAlcohol = ingredients.some((item) => (item.abv ?? 0) > 0 || item.category.includes("酒"));
  const hasTea = ingredients.some((item) => hasText(item, ["茶", "tea", "oolong", "jasmine"]));
  const hasCitrus = ingredients.some((item) => hasText(item, ["柠檬", "青柠", "西柚", "橙", "lemon", "lime", "grapefruit", "orange"]));
  const hasDairy = ingredients.some((item) => (item.dairy ?? 0) >= 3 || hasText(item, ["奶", "乳", "milk", "yogurt"]));
  const hasBubbly = rating.bubbly >= 4;

  if (hasAlcohol && hasBubbly && hasCitrus) return "便利店柑橘高球";
  if (hasAlcohol && hasTea) return "茶感便利店高球";
  if (hasAlcohol && hasDairy) return "奶感微醺调饮";
  if (!hasAlcohol && hasBubbly) return "无酒精气泡特调";
  return method === "Shake" ? "摇和便利店特调" : "便利店顺口特调";
};

const describeBalance = (rating: MixologyAnalysis["rating"]) => {
  if (rating.strength >= 4 && rating.sweet <= 2) return "这杯酒感会比较直接，入口可能偏冲，新手喝起来容易觉得辣或烧喉。";
  if (rating.sweet >= 4 && rating.acid <= 2) return "这杯会偏甜、偏圆润，入口轻松，但后段可能有点腻。";
  if (rating.acid >= 4 && rating.sweet <= 2) return "这杯酸感会比较突出，适合喜欢清爽口的人，但如果冰不够会显得尖。";
  if (rating.bubbly >= 4) return "这杯主要靠气泡带出清爽感，适合做成高球或大杯长饮。";
  if (rating.creamy >= 4) return "这杯口感会更厚、更像奶饮，酒感会被包住，但也更容易显得饱。";
  return "这杯整体比较均衡，不会特别甜、特别酸或特别烈，适合作为第一次试配的方向。";
};

const buildBeginnerAdvice = (
  ingredients: MixologyIngredient[],
  mixMethod: MixMethod,
  rating: MixologyAnalysis["rating"],
  estimatedAbv: number,
  sugarGPer100ml: number,
  reactions: MixologyAnalysis["reactions"],
) => {
  const balanceTip = describeBalance(rating);
  const servingTip = rating.strength >= 4
    ? "建议用高杯、多加冰，把每口的酒精冲击降下来；如果还是觉得烈，优先补 30-60ml 苏打水、茶饮或低糖果汁。"
    : rating.strength <= 2
      ? "酒感不重，可以当低度长饮处理；如果想更像鸡尾酒，可以少量增加 10-15ml 基酒，不要一次加太多。"
      : "酒感属于比较好入口的范围，适合先小口试味，再决定要不要继续加酸或加气泡。";

  const sweetnessTip = sugarGPer100ml >= 10
    ? "甜度已经比较高，不建议再加糖浆、果蜜或甜奶茶；想变清爽就加冰、苏打水、乌龙茶或一点柠檬。"
    : sugarGPer100ml <= 4 && rating.acid >= 3
      ? "甜度偏低，酸味可能会显得更明显；新手可以补一点蜂蜜水、雪碧或甜味果汁，让入口更圆。"
      : "甜度在比较容易接受的区间，不需要急着加糖，先靠冰块稀释会更稳。";

  const methodTip = mixMethod === "Shake"
    ? rating.bubbly >= 3
      ? "这杯如果有气泡材料，不要把气泡一起摇。先摇酒和非气泡饮料，倒入杯中后最后补气泡，轻轻搅一下就好。"
      : "摇和会让口感更冷、更融合，适合果汁、乳酸饮料和酸甜材料；摇完最好过滤到有冰的杯子里。"
    : rating.bubbly >= 3
      ? "搅拌适合保留气泡。倒入顺序建议是冰块、基酒、非气泡材料，最后沿杯壁加气泡饮料。"
      : "搅拌适合茶饮、苏打水、清爽果汁这类材料，动作轻一点，避免把香气搅散。";

  const riskTip = reactions.length
    ? `需要注意：${reactions.map((rule) => rule.description).join(" ")}`
    : "目前没有明显容易翻车的组合，但第一次做仍建议先做小杯，确认味道后再放大比例。";

  const garnishTip = ingredients.some((item) => hasText(item, ["柠檬", "青柠", "西柚", "orange", "lemon", "lime", "grapefruit"]))
    ? "装饰上可以用一片柠檬、橙皮或一点盐边，能让香气更明显。"
    : "如果手边有柠檬片、薄荷、橙皮或盐，可以少量加入，能让便利店饮料喝起来更像正式调酒。";

  return { balanceTip, servingTip, sweetnessTip, methodTip, riskTip, garnishTip };
};

export function analyzeMixologyRecipe(ingredients: MixologyIngredient[], mixMethod: MixMethod): MixologyAnalysis {
  const totalVolumeMl = ingredients.reduce((sum, item) => sum + safeAmount(item), 0) || 1;
  const alcoholMl = ingredients.reduce((sum, item) => sum + safeAmount(item) * ((item.abv ?? 0) / 100), 0);
  const estimatedAbv = (alcoholMl / totalVolumeMl) * 100;

  const sugarG = ingredients.reduce((sum, item) => {
    const sugar = item.sugarGPer100ml;
    if (typeof sugar === "number") return sum + safeAmount(item) * sugar / 100;
    return sum + safeAmount(item) * ((item.sweetness ?? 0) * 2.2) / 100;
  }, 0);
  const sugarGPer100ml = sugarG / totalVolumeMl * 100;

  const acidLoad = weightedAverage(ingredients, (item) => item.acidity);
  const bitternessLoad = weightedAverage(ingredients, (item) => item.bitterness);
  const carbonationLoad = weightedAverage(ingredients, (item) => item.carbonation);
  const viscosityLoad = weightedAverage(ingredients, (item) => item.viscosity);
  const dairyLoad = weightedAverage(ingredients, (item) => item.dairy);
  const teaLoad = weightedAverage(ingredients, (item) => item.tea);
  const freshnessLoad = weightedAverage(ingredients, (item) => item.freshness);

  const rating = {
    sweet: clampScore(sugarGPer100ml <= 3 ? 1 : sugarGPer100ml <= 7 ? 2 : sugarGPer100ml <= 10 ? 3 : sugarGPer100ml <= 13 ? 4 : 5),
    acid: clampScore(acidLoad),
    strength: clampScore(estimatedAbv <= 2 ? 1 : estimatedAbv <= 5 ? 2 : estimatedAbv <= 9 ? 3 : estimatedAbv <= 15 ? 4 : 5),
    creamy: clampScore(dairyLoad || viscosityLoad),
    herbal: clampScore(Math.max(teaLoad, bitternessLoad)),
    bubbly: clampScore(mixMethod === "Shake" ? carbonationLoad * 0.65 : carbonationLoad),
    freshness: clampScore(Math.max(freshnessLoad, carbonationLoad, acidLoad) - Math.max(0, viscosityLoad - 3) * 0.4),
    heaviness: clampScore(viscosityLoad + estimatedAbv / 8),
  };

  const reactions: MixologyAnalysis["reactions"] = [];
  const hasAlcohol = estimatedAbv > 0.5;
  const hasCaffeine = ingredients.some((item) => item.caffeine || (item.caffeineMgPer100ml ?? 0) > 0 || hasText(item, ["咖啡", "红牛", "monster", "energy", "tea", "茶"]));
  const hasDairy = ingredients.some((item) => (item.dairy ?? 0) >= 3 || hasText(item, ["奶", "乳", "milk", "yogurt", "cream"]));
  const hasHighAcid = ingredients.some((item) => (item.acidity ?? 0) >= 4 || hasText(item, ["柠檬", "青柠", "西柚", "lemon", "lime", "grapefruit"]));
  const hasBitterStack = bitternessLoad >= 3.5 && ingredients.some((item) => hasText(item, ["汤力", "金巴利", "campari", "西柚", "tonic", "grapefruit"]));

  if (estimatedAbv >= 12) {
    reactions.push({ key: "high_abv", title: "酒精度偏高", description: `估算成品 ABV 约 ${estimatedAbv.toFixed(1)}%，建议降低烈酒或增加气泡水/茶饮。`, severity: "warning" });
  }
  if (hasAlcohol && hasCaffeine) {
    reactions.push({ key: "caffeine_alcohol", title: "酒精 + 咖啡因", description: "含酒精与咖啡因饮料，咖啡因可能掩盖酒感，请控制饮用量。", severity: "warning" });
  }
  if (hasDairy && hasHighAcid) {
    reactions.push({ key: "dairy_acid", title: "乳制品遇高酸", description: "奶/乳酸类与柠檬、青柠、西柚等高酸材料大量混合，可能凝结、分层或产生粗糙口感。", severity: "info" });
  }
  if (mixMethod === "Shake" && carbonationLoad >= 2.5) {
    reactions.push({ key: "shake_carbonation", title: "气泡不适合摇和", description: "碳酸材料摇和会损失气泡并有溢出风险，建议先摇非气泡部分，最后补气泡。", severity: "warning" });
  }
  if (hasBitterStack) {
    reactions.push({ key: "bitter_stack", title: "苦味叠加", description: "汤力、西柚、苦味酒等会叠加苦味，新手版本建议加入甜味或苏打稀释。", severity: "info" });
  }
  if (sugarGPer100ml >= 10) {
    reactions.push({ key: "high_sugar", title: "甜度较高", description: `估算糖度约 ${sugarGPer100ml.toFixed(1)}g/100ml，酒感会被遮盖但后段可能发腻。`, severity: "info" });
  }

  const chineseName = inferName(ingredients, mixMethod, rating);
  const names = ingredients.map((item) => `${item.name}(${safeAmount(item)}ml)`).join("、");
  const orderTip = rating.acid >= 4
    ? "建议按基酒、甜味、酸味、气泡的顺序构建，并用冰块稀释尖酸。"
    : rating.bubbly >= 4
      ? "建议先加入非气泡材料，最后沿杯壁补气泡，轻搅即可。"
      : "建议先加入酒精基底，再加入主体饮料，最后用少量酸或甜微调。";
  const beginnerAdvice = buildBeginnerAdvice(ingredients, mixMethod, rating, estimatedAbv, sugarGPer100ml, reactions);
  const adviceSections = [
    {
      title: "这杯大概会是什么味道",
      body: `${beginnerAdvice.balanceTip} 成品大约 ${estimatedAbv.toFixed(1)}% ABV，糖度约 ${sugarGPer100ml.toFixed(1)}g/100ml。`,
    },
    {
      title: "建议怎么调",
      body: `${orderTip}${beginnerAdvice.methodTip}`,
    },
    {
      title: "新手怎么微调",
      body: `${beginnerAdvice.servingTip}${beginnerAdvice.sweetnessTip}`,
    },
    {
      title: "需要注意什么",
      body: beginnerAdvice.riskTip,
    },
    {
      title: "最后怎么变好喝一点",
      body: beginnerAdvice.garnishTip,
    },
  ];

  return {
    chineseName,
    name: mixMethod === "Shake" ? "Shaken Convenience Mix" : "Stirred Convenience Mix",
    subtitle: "口味平衡与新手调配建议",
    rating,
    metrics: {
      totalVolumeMl,
      estimatedAbv,
      sugarG,
      sugarGPer100ml,
      acidLoad,
      bitternessLoad,
      carbonationLoad,
      viscosityLoad,
    },
    reactions,
    comments: `这杯用了 ${names}。${adviceSections.map((section) => section.body).join("")}`,
    adviceSections,
    tags: [
      `${estimatedAbv.toFixed(1)}% ABV`,
      rating.bubbly >= 4 ? "气泡结构" : "静态结构",
      rating.sweet >= 4 ? "偏甜" : rating.acid >= 4 ? "偏酸" : "平衡",
      ...reactions.slice(0, 2).map((rule) => rule.title),
    ],
  };
}
