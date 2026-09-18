import { BEGINNER_CATALOG, CLASSIC_DATABASE, classicExploreCocktails, convenienceExploreCocktails, getConvenienceRecipeGuide, normalizeClassicCocktailId } from '../data/explore-catalog';
import { emptyAnswers, matchDrinks } from '../recommendations/beginner';
import type { PageContext, PageAction } from './companion-contract';
export function ingredientKey(name: string): string {
    const raw = name.trim().toLowerCase().replace(/\s+/g, '');
    if (ingredientAliases[raw]) return ingredientAliases[raw];
    const key = name.trim().toLowerCase().split(/\s+[a-z]/i)[0].replace(/\s+/g, '').replace(/朗姆酒/g, '朗姆').replace(/青柠汁/g, '青柠').replace(/柠檬汁/g, '柠檬').replace(/白朗姆/g, '朗姆');
    return ingredientAliases[key] ?? key;
}
export function sameIngredientFamily(name: string, other: string) {
    const a = ingredientKey(name), b = ingredientKey(other);
    return a === b || a.startsWith(b) || b.startsWith(a);
}
const ingredientAliases: Record<string, string> = {
    君度: '橙味利口酒', cointreau: '橙味利口酒', triplesec: '橙味利口酒',
    莱姆: '青柠', 莱姆汁: '青柠', lime: '青柠',
    lemon: '柠檬',
    伏特加酒: '伏特加', vodka: '伏特加', gin: '金酒', tequila: '龙舌兰',
    威士忌酒: '威士忌', whisky: '威士忌', whiskey: '威士忌',
    rum: '朗姆', 苏打: '苏打水', soda: '苏打水', tonic: '汤力水',
};
const recipeNameKey = (name: string) => name.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '').replace(/^(经典|便利店)/, '').replace(/(鸡尾酒|调酒)$/, '');
export const exactRecipeName = (name: string, recipe: { nameZh: string; nameEn: string; id: string }) =>
    [recipe.nameZh, recipe.nameEn, recipe.id].some(value => recipeNameKey(value) === recipeNameKey(name));
function withinOneEdit(a: string, b: string) {
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
        if (a[i] === b[j]) { i++; j++; continue; }
        if (++edits > 1) return false;
        if (a.length >= b.length) i++;
        if (b.length >= a.length) j++;
    }
    return edits + Number(i < a.length || j < b.length) <= 1;
}
export function findRecipe(category: 'classic' | 'convenience', id: string) {
    return (category === 'classic' ? classicExploreCocktails : convenienceExploreCocktails).find(r => r.id === id || (category === 'classic' && normalizeClassicCocktailId(r.id) === normalizeClassicCocktailId(id)));
}
export function recipeContext(category: 'classic' | 'convenience', id: string): PageContext {
    const recipe = findRecipe(category, id), classic = category === 'classic' ? CLASSIC_DATABASE[normalizeClassicCocktailId(id)] : null;
    return { kind: category, recipeId: recipe?.id ?? id, name: classic?.name ?? recipe?.nameZh ?? '当前酒款', ingredients: (classic?.ingredients ?? recipe?.ingredients.map(name => ({ name })) ?? []).map(i => ({ name: i.name, ...('amount' in i && typeof i.amount === 'number' && !/糖块|苦精|蛋白|薄荷/.test(i.name) ? { amount: i.amount } : {}) })), note: classic?.methodNote ? classic.methodNote : category === 'convenience' && recipe ? getConvenienceRecipeGuide(recipe).ingredientLines.join('；') : '原配方要求不代表实际已倒入量；涉及用量需按资料核对。' };
}
export function namedRecipes(name: string) {
    const key = recipeNameKey(name);
    if (!key)
        return [];
    const all = [...classicExploreCocktails.map(r => ({ ...r, kind: 'classic' as const })), ...convenienceExploreCocktails.map(r => ({ ...r, kind: 'convenience' as const }))];
    const names = (r: typeof all[number]) => [r.nameZh, r.nameEn, r.id].map(recipeNameKey);
    const exact = all.filter(r => exactRecipeName(name, r));
    const matched = (exact.length ? exact : all.filter(r => names(r).some(v =>
        (key.length >= 3 && v.includes(key)) || (key.length >= 4 && v.length >= 4 && withinOneEdit(key, v))
    ))).map(r => ({...findRecipe(r.kind,r.id)!,kind:r.kind}));
    return [...new Map(matched.map(r=>[`${r.kind}:${r.id}`,r])).values()];
}
export function spiritMixerRecipes(spirit: string) {
    const all = [
        ...classicExploreCocktails.map(recipe => ({ ...recipe, kind: 'classic' as const })),
        ...convenienceExploreCocktails.map(recipe => ({ ...recipe, kind: 'convenience' as const })),
    ];
    const seen = new Set<string>();
    return all.filter(recipe => {
        const key = `${recipe.kind}:${recipe.ingredients.map(ingredientKey).sort().join('|')}`;
        if (seen.has(key) || !recipe.ingredients.some(name => ingredientKey(name) === ingredientKey(spirit))) return false;
        seen.add(key);
        return recipe.kind === 'convenience' || Boolean(CLASSIC_DATABASE[normalizeClassicCocktailId(recipe.id)]);
    });
}
const spiritNames = ['威士忌', '金酒', '伏特加', '朗姆', '龙舌兰', '白兰地', '烧酒', '梅酒', '啤酒'];
export function alternativesForMissing(page: PageContext, missing: string) {
    const isMissing = (name: string) => sameIngredientFamily(name, missing);
    const remaining = page.ingredients.filter(i => !isMissing(i.name)).map(i => ingredientKey(i.name));
    const anchor = remaining.find(key => spiritNames.includes(key)) ?? remaining[0];
    if (!anchor) return [];
    const current = page.kind === 'lab' ? null : findRecipe(page.kind, page.recipeId ?? '');
    const unique = new Map<string, ReturnType<typeof matchDrinks>[number]>();
    for (const recipe of matchDrinks(BEGINNER_CATALOG, emptyAnswers)) {
        if (recipe.href === current?.href || (recipe.kind === 'classic' && !CLASSIC_DATABASE[normalizeClassicCocktailId(recipe.id)])) continue;
        const required = recipe.kind === 'classic' ? CLASSIC_DATABASE[normalizeClassicCocktailId(recipe.id)].ingredients.map(i => i.name) : recipe.ingredients;
        if (!required.some(name => ingredientKey(name) === anchor) || required.some(isMissing)) continue;
        const key = `${recipe.kind}:${recipe.kind === 'classic' ? normalizeClassicCocktailId(recipe.id) : recipe.id}`;
        if (!unique.has(key)) unique.set(key, recipe);
    }
    return [...unique.values()].slice(0, 3).map(recipe => ({ recipe, anchor }));
}
// A catalogue combination is a different recipe, not evidence of equal-flavour replacement.
export function substitutionRecipes(page: PageContext, missing: string, available: string[]) {
    if (page.kind !== 'convenience' || !available.length) return [];
    const original = new Set(page.ingredients.map(i => ingredientKey(i.name)));
    const stock = new Set(available.map(ingredientKey));
    const gone = ingredientKey(missing);
    const spirit = ['威士忌', '金酒', '伏特加', '朗姆', '龙舌兰', '白兰地', '烧酒', '梅酒', '啤酒']
        .find(name => original.has(ingredientKey(name)) && ingredientKey(name) !== gone);
    if (!spirit) return [];
    return spiritMixerRecipes(spirit).filter(r => r.id !== page.recipeId && r.kind === 'convenience'
        && !r.ingredients.some(name => ingredientKey(name) === gone)
        && r.ingredients.some(name => !original.has(ingredientKey(name)) && stock.has(ingredientKey(name)))
        && r.ingredients.every(name => original.has(ingredientKey(name)) || stock.has(ingredientKey(name))))
        .slice(0, 3).map(r => ({
            id: r.id, name: r.nameZh, category: r.kind,
            reason: `配方材料：${r.ingredients.join('、')}。酒库风味：${r.tags.join('、')}。${r.description}`,
            missing: r.ingredients.filter(name => !stock.has(ingredientKey(name))),
            action: { kind: 'recipe' as const, category: r.kind, id: r.id },
        }));
}
export function matchWorkflow(materials: string[]) {
    const keys = new Set(materials.map(ingredientKey));
    // Same catalogue and ordering as the homepage. Unknown template quantities are excluded.
    const matched = matchDrinks(BEGINNER_CATALOG, emptyAnswers).filter(r => r.kind === 'easy' || Boolean(CLASSIC_DATABASE[normalizeClassicCocktailId(r.id)]))
        .map(r => {
        const requirements = r.kind === 'classic' ? CLASSIC_DATABASE[normalizeClassicCocktailId(r.id)].ingredients.map(i => i.name) : r.ingredients;
        const missing = requirements.filter(n => !keys.has(ingredientKey(n)));
        return { recipe: r, missing };
    }).filter(r => r.missing.length === 0);
    const unique = new Map<string,typeof matched[number]>();
    for(const m of matched) { const key=`${m.recipe.kind}:${m.recipe.kind==='classic'?normalizeClassicCocktailId(m.recipe.id):m.recipe.id}`; if(!unique.has(key)) unique.set(key,m); }
    return [...unique.values()];
}
export function nearbyWorkflow(materials: string[]) {
    const keys = new Set(materials.map(ingredientKey));
    if (keys.size < 2) return [];
    const complete = new Set(matchWorkflow(materials).map(m => `${m.recipe.kind}:${m.recipe.id}`));
    const ranked = matchDrinks(BEGINNER_CATALOG, emptyAnswers)
        .filter(r => (r.kind === 'easy' || Boolean(CLASSIC_DATABASE[normalizeClassicCocktailId(r.id)])) && !complete.has(`${r.kind}:${r.id}`))
        .map(recipe => {
            const requirements = recipe.kind === 'classic' ? CLASSIC_DATABASE[normalizeClassicCocktailId(recipe.id)].ingredients.map(i => i.name) : recipe.ingredients;
            const missing = requirements.filter(name => !keys.has(ingredientKey(name)));
            const matchedCount = requirements.length - missing.length;
            return { recipe, missing, matchedCount };
        })
        .filter(item => item.missing.length === 1 && item.matchedCount >= 2)
        .sort((a, b) => b.matchedCount - a.matchedCount);
    const unique = new Map<string, typeof ranked[number]>();
    for (const item of ranked) {
        const key = `${item.recipe.kind}:${item.recipe.kind === 'classic' ? normalizeClassicCocktailId(item.recipe.id) : item.recipe.id}`;
        if (!unique.has(key)) unique.set(key, item);
    }
    return [...unique.values()];
}
export function actionHref(action: PageAction): string | null {
    if (action.kind !== 'recipe')
        return null;
    return findRecipe(action.category, action.id)?.href ?? null;
}
export function verifiedMaterials(names: string[], input: {
    question: string;
    history: {
        role: string;
        content: string;
    }[];
    page: PageContext;
}): string[] {
    const text = [input.question, ...input.history.filter(h => h.role === 'user').map(h => h.content), ...(input.page.kind === 'lab' ? input.page.ingredients.map(i => i.name) : [])].join(' ').toLowerCase();
    return [...new Set(names)].filter(n => {
        const key = ingredientKey(n);
        const aliases = [n, ...Object.entries(ingredientAliases).filter(([, canonical]) => canonical === key).map(([alias]) => alias)];
        const quoted = aliases.some(v => text.includes(v.toLowerCase()));
        const excluded = aliases.some(v => { const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); return new RegExp(`(?:没有|没了|缺少|缺|不用|不是)\\s*${escaped}|${escaped}\\s*(?:没有|没了|用完了)`, 'i').test(input.question); });
        return quoted && !excluded;
    });
}
// Literal catalogue names are a deterministic aid, not a replacement for free-text intent recognition.
export function mentionedMaterials(text: string): string[] {
    const names = [...new Set([...BEGINNER_CATALOG.flatMap(r => r.ingredients), ...Object.values(CLASSIC_DATABASE).flatMap(r => r.ingredients.map(i => i.name.split(/\s+[a-z]/i)[0])), ...Object.keys(ingredientAliases).filter(a => /[\u3400-\u9fff]/.test(a))])].sort((a, b) => b.length - a.length);
    let remaining = text;
    const found: string[] = [];
    for (const name of names) {
        if (remaining.toLowerCase().includes(name.toLowerCase())) {
            found.push(name);
            remaining = remaining.split(name).join(' ');
        }
    }
    return found;
}
export function mentionedRecipe(text: string) {
    const matches = [...classicExploreCocktails, ...convenienceExploreCocktails].filter(r => text.includes(r.nameZh) || text.toLowerCase().includes(r.nameEn.toLowerCase()));
    return matches.sort((a, b) => b.nameZh.length - a.nameZh.length)[0];
}

export function similarRecipes(page: PageContext) {
    const current = page.kind === 'lab' ? null : findRecipe(page.kind, page.recipeId ?? '');
    const tags = current?.tags ?? [];
    const ingredients = new Set(page.ingredients.map(i => ingredientKey(i.name)));
    const all = [...classicExploreCocktails.map(r => ({...r, kind:'classic' as const})), ...convenienceExploreCocktails.map(r => ({...r,kind:'convenience' as const}))].map(r=>({...findRecipe(r.kind,r.id)!,kind:r.kind}));
    return [...new Map(all.map(r=>[`${r.kind}:${r.id}`,r])).values()]
      .filter(r => r.href !== current?.href && (r.kind !== 'classic' || Boolean(CLASSIC_DATABASE[normalizeClassicCocktailId(r.id)])))
      .map(r => {
        const sharedTags = r.tags.filter(t => tags.includes(t));
        const sharedMaterials = r.ingredients.filter(n => ingredients.has(ingredientKey(n)));
        return {recipe:r,score:sharedTags.length*3+sharedMaterials.length,reason:sharedTags.length ? `同样带有${sharedTags.join('、')}的口味特点。` : `同样使用${sharedMaterials.join('、')}，可以作为相近材料组合参考，具体口味会有差异。`};
      }).filter(r => r.score>0).sort((a,b)=>b.score-a.score);
}
