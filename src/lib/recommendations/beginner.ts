export type CatalogDrink = { id: string; nameZh: string; nameEn: string; description: string; imageUrl: string; baseSpirit?: string; ingredients: string[]; tags: string[]; href: string };
export type Profile = { tastes: string[]; strength: string; avoid: string[]; shaker: boolean };
export type GuideDrink = CatalogDrink & Profile & { kind: "classic" | "easy" };
export type Answers = { kind: string; tastes: string[]; strength: string; avoid: string[]; spirit: string; tools: string; mixers: string[] };
export const emptyAnswers: Answers = { kind: "any", tastes: [], strength: "any", avoid: [], spirit: "any", tools: "any", mixers: [] };
// Explicit profiles for the existing classic recipes. Sensory levels describe taste, not ABV.
const classics: Record<string, [string[], string, string[], boolean]> = {
  "margarita": [["fruit"], "medium", ["sour"], true],
  "singapore-sling": [["fruit"], "medium", ["sweet", "sour"], true],
  "mojito": [["fresh", "fruit"], "light", ["sour"], false],
  "gin-tonic": [["fresh"], "medium", ["bitter"], false],
  "negroni": [[], "strong", ["bitter"], false],
  "old-fashioned": [[], "strong", [], false],
  "martini": [[], "strong", [], false],
  "whisky-highball": [["fresh"], "medium", [], false],
  "whiskey-sour": [["fruit"], "medium", ["sour"], true],
  "cosmopolitan": [["fruit"], "medium", ["sour"], true],
  "moscow-mule": [["fresh", "fruit"], "medium", ["sour"], false],
  "aperol-spritz": [["fresh", "fruit"], "light", ["bitter"], false],
  "pina-colada": [["milk", "fruit"], "light", ["milk", "sweet"], true],
  "tom-collins": [["fresh", "fruit"], "medium", ["sour"], true],
  "paloma": [["fresh", "fruit"], "medium", ["bitter", "sour"], false],
  "mai-tai": [["fruit"], "strong", ["sour"], true],
};
export function classify(drink: CatalogDrink, kind: "classic" | "easy"): GuideDrink | null {
  if (kind === "classic") {
    const p = classics[drink.id];
    return p ? { ...drink, kind, tastes: p[0], strength: p[1], avoid: p[2], shaker: p[3] } : null;
  }
  const ingredients = drink.ingredients.join(" ");
  const milk = /奶|乳|养乐多|可尔必思|酸奶/.test(ingredients);
  const tea = /茶/.test(ingredients);
  const coffee = /咖啡/.test(ingredients);
  const fresh = /汽水|苏打|汤力|雪碧|可乐|啤酒|气泡/.test(ingredients);
  const fruit = /汁|柠檬|青柠|西柚|梅酒/.test(ingredients);
  const bitter = /苦味酒|汤力|西柚|咖啡|啤酒/.test(ingredients);
  const sour = /柠檬|青柠|蔓越莓|西柚|酸奶|可尔必思/.test(ingredients);
  const sweet = /可乐|雪碧|奶|乳|养乐多|可尔必思|芒果|葡萄汁|苹果汁|利口酒/.test(ingredients);
  // Only classify supported mixer families; no silent guesses for unknown recipes.
  if (!milk && !tea && !coffee && !fresh && !fruit && !/椰子水/.test(ingredients)) return null;
  return { ...drink, kind, tastes: [...(fresh ? ["fresh"] : []), ...(fruit ? ["fruit"] : []), ...(tea ? ["tea"] : []), ...(milk || coffee ? ["milk"] : [])], strength: /威士忌|金酒|龙舌兰|白兰地|苦味酒/.test(drink.baseSpirit ?? "") && /苏打水|汤力水|茶/.test(ingredients) ? "medium" : "light", avoid: [...(milk ? ["milk"] : []), ...(bitter ? ["bitter"] : []), ...(sour ? ["sour"] : []), ...(sweet ? ["sweet"] : [])], shaker: false };
}
const ingredientKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, "").replace(/朗姆酒/g, "朗姆").replace(/青柠汁/g, "青柠").replace(/柠檬汁/g, "柠檬");
export function usesExcluded(drink: GuideDrink, excluded: string[]): boolean {
  return drink.ingredients.some(name => excluded.some(item => ingredientKey(item) === ingredientKey(name)));
}
export function repairSlots(pool: GuideDrink[], slots: string[], seen: string[]): string[] {
  const eligible = new Set(pool.map(d => d.href));
  const kept = slots.filter(id => eligible.has(id));
  const candidates = pool.filter(d => !kept.includes(d.href)).sort((a, b) => Number(seen.includes(a.href)) - Number(seen.includes(b.href)));
  const next = slots.map(id => eligible.has(id) ? id : candidates.shift()?.href).filter((id): id is string => Boolean(id));
  while (next.length < 3 && candidates.length) next.push(candidates.shift()!.href);
  return next;
}
export function recipeMixers(drink: CatalogDrink): string[] {
  return [...new Set(drink.ingredients.filter(name => !/酒|利口|苦精|糖浆/.test(name) && /汁|汽水|苏打|汤力|可乐|雪碧|茶|奶|乳|咖啡|养乐多|可尔必思|椰子水|气泡水/.test(name)))];
}
export function mixerOptions(catalog: GuideDrink[], a: Answers, excluded: string[] = []): string[] {
  return [...new Set(matchDrinks(catalog, { ...a, mixers: [] }, excluded).flatMap(recipeMixers))];
}
export function matchDrinks(catalog: GuideDrink[], a: Answers, excluded: string[] = []): GuideDrink[] {
  return catalog.filter(d => !usesExcluded(d, excluded) && (a.kind === "any" || d.kind === a.kind)
    && (!a.mixers?.length || (recipeMixers(d).length > 0 && recipeMixers(d).every(name => a.mixers.includes(name))))
    && (!a.tastes.length || a.tastes.some(t => d.tastes.includes(t)))
    && (a.strength === "any" || d.strength === a.strength)
    && !a.avoid.some(t => d.avoid.includes(t))
    && (a.spirit === "any" || d.baseSpirit === a.spirit)
    && (!(a.kind === "easy" || a.tools === "simple") || !d.shaker))
    .sort((a, b) => {
      const strength = (d: GuideDrink) => d.strength === "light" ? 0 : d.strength === "medium" ? 1 : 2;
      return Number(a.shaker) - Number(b.shaker) || strength(a) - strength(b) || a.ingredients.length - b.ingredients.length;
    });
}
export function replaceDrink(pool: GuideDrink[], slots: string[], seen: string[], index: number): string | undefined {
  return pool.find(d => !slots.includes(d.href) && !seen.includes(d.href))?.href;
}
