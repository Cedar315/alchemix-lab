import { BEGINNER_CATALOG, CLASSIC_DATABASE, classicExploreCocktails, convenienceExploreCocktails, getConvenienceRecipeGuide, normalizeClassicCocktailId } from '../data/explore-catalog';
import { emptyAnswers, matchDrinks } from '../recommendations/beginner';
import type { PageContext, PageAction } from './companion-contract';
export function ingredientKey(name: string): string {
    return name.toLowerCase().split(/\s+[a-z]/i)[0].replace(/\s+/g, '').replace(/朗姆酒/g, '朗姆').replace(/青柠汁/g, '青柠').replace(/柠檬汁/g, '柠檬').replace(/君度|triple\s*sec|cointreau/gi, '橙味利口酒').replace(/白朗姆/g, '朗姆');
}
export function findRecipe(category: 'classic' | 'convenience', id: string) {
    return (category === 'classic' ? classicExploreCocktails : convenienceExploreCocktails).find(r => r.id === id || (category === 'classic' && normalizeClassicCocktailId(r.id) === normalizeClassicCocktailId(id)));
}
export function recipeContext(category: 'classic' | 'convenience', id: string): PageContext {
    const recipe = findRecipe(category, id), classic = category === 'classic' ? CLASSIC_DATABASE[normalizeClassicCocktailId(id)] : null;
    return { kind: category, recipeId: recipe?.id ?? id, name: classic?.name ?? recipe?.nameZh ?? '当前酒款', ingredients: (classic?.ingredients ?? recipe?.ingredients.map(name => ({ name })) ?? []).map(i => ({ name: i.name, ...('amount' in i && typeof i.amount === 'number' && !/糖块|苦精|蛋白|薄荷/.test(i.name) ? { amount: i.amount } : {}) })), note: classic?.methodNote ? classic.methodNote : category === 'convenience' && recipe ? getConvenienceRecipeGuide(recipe).ingredientLines.join('；') : '原配方要求不代表实际已倒入量；涉及用量需按资料核对。' };
}
export function namedRecipes(name: string) {
    const key = name.trim().toLowerCase();
    if (!key)
        return [];
    const matched = [...classicExploreCocktails.map(r => ({ ...r, kind: 'classic' as const })), ...convenienceExploreCocktails.map(r => ({ ...r, kind: 'convenience' as const }))].filter(r => [r.nameZh, r.nameEn, r.id].some(v => v.toLowerCase() === key)).map(r => ({...findRecipe(r.kind,r.id)!,kind:r.kind}));
    return [...new Map(matched.map(r=>[`${r.kind}:${r.id}`,r])).values()];
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
        const aliases = n === '橙味利口酒' ? ['橙味利口酒', '君度', 'cointreau', 'triple sec'] : [n];
        const quoted = aliases.some(v => text.includes(v.toLowerCase()));
        const excluded = aliases.some(v => { const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); return new RegExp(`(?:没有|没了|缺少|缺|不用|不是)\\s*${escaped}|${escaped}\\s*(?:没有|没了|用完了)`, 'i').test(input.question); });
        return quoted && !excluded;
    });
}
// Literal catalogue names are a deterministic aid, not a replacement for free-text intent recognition.
export function mentionedMaterials(text: string): string[] {
    const names = [...new Set([...BEGINNER_CATALOG.flatMap(r => r.ingredients), ...Object.values(CLASSIC_DATABASE).flatMap(r => r.ingredients.map(i => i.name.split(/\s+[a-z]/i)[0]))])].sort((a, b) => b.length - a.length);
    let remaining = text;
    const found: string[] = [];
    for (const name of names) {
        if (remaining.includes(name)) {
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
