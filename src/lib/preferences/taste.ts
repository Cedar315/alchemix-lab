import type { DrinkLog } from '../../types';
import type { Answers, GuideDrink } from '../recommendations/beginner';

export const TASTE_KEY = 'alchemix_taste_settings_v1';
export const flavorOptions = ['果香', '清爽', '茶香', '咖啡', '奶香', '苦味'] as const;
export type Level = 'any' | 'low' | 'medium' | 'high';
export type TasteSettings = {
  sweetness: Level; acidity: Level; strength: Level; flavors: string[];
  useHistory: boolean; historySince: number; revision: number;
};
export const defaultTaste: TasteSettings = { sweetness: 'any', acidity: 'any', strength: 'any', flavors: [], useHistory: false, historySince: 0, revision: 0 };
export function parseTaste(value: unknown): TasteSettings {
  const v = value && typeof value === 'object' ? value as Partial<TasteSettings> : {};
  const level = (x: unknown): Level => ['any', 'low', 'medium', 'high'].includes(String(x)) ? x as Level : 'any';
  return { sweetness: level(v.sweetness), acidity: level(v.acidity), strength: level(v.strength), flavors: Array.isArray(v.flavors) ? [...new Set(v.flavors.filter(x => flavorOptions.includes(x as typeof flavorOptions[number])))] : [], useHistory: v.useHistory === true, historySince: Number.isFinite(v.historySince) && v.historySince! >= 0 ? v.historySince! : 0, revision: Number.isFinite(v.revision) ? v.revision! : 0 };
}
export function clearTaste(s: TasteSettings): TasteSettings {
  return { ...s, sweetness: 'any', acidity: 'any', strength: 'any', flavors: [] };
}
export function resetRecommendations(s: TasteSettings, now = Date.now()): TasteSettings {
  return { ...s, historySince: now, revision: now };
}
export function tasteSummary(s: TasteSettings): string {
  const parts = [s.sweetness === 'any' ? '' : ({ low: '少甜', medium: '甜度适中', high: '偏甜' })[s.sweetness], s.acidity === 'any' ? '' : ({ low: '少酸', medium: '酸度适中', high: '偏酸' })[s.acidity], s.strength === 'any' ? '' : ({ low: '酒感轻', medium: '酒感适中', high: '酒感浓' })[s.strength], ...s.flavors].filter(Boolean);
  return parts.join(' · ') || '不限口味，随时发现新的喜欢';
}
// Rank only the already eligible pool: explicit answers/material restrictions always win.
export function rankByTaste(pool: GuideDrink[], settings: TasteSettings, logs: DrinkLog[], answers: Answers, now = Date.now()): GuideDrink[] {
  const recent = settings.useHistory ? logs.filter(log => {
    const time = Date.parse(log.createdAt);
    return log.rating >= 4 && Number.isFinite(time) && time > settings.historySince && time <= now && now - time < 90 * 86400000;
  }) : [];
  function score(d: GuideDrink) {
    const text = d.ingredients.join(' ');
    let n = 0;
    for (const [level, tag] of [[settings.sweetness, 'sweet'], [settings.acidity, 'sour']] as const) {
      if (level === 'low') n += d.avoid.includes(tag) ? -2 : 2;
      if (level === 'high') n += d.avoid.includes(tag) ? 2 : 0;
      if (level === 'medium') n += d.avoid.includes(tag) ? 0 : 1;
    }
    if (answers.strength === 'any' && settings.strength !== 'any') n += d.strength === ({ low: 'light', medium: 'medium', high: 'strong' })[settings.strength] ? 3 : 0;
    if (!answers.tastes.length) for (const f of settings.flavors) {
      const matched = f === '咖啡' ? /咖啡/.test(text) : f === '奶香' ? /奶|乳|椰浆/.test(text) : f === '苦味' ? d.avoid.includes('bitter') : d.tastes.includes(({ 果香: 'fruit', 清爽: 'fresh', 茶香: 'tea' } as Record<string,string>)[f]);
      if (matched) n += 2;
    }
    // Capped and decayed history is weaker than an explicit saved preference.
    n += Math.min(1, recent.reduce((sum, log) => {
      const same = log.recipeId === d.id || log.recipeSnapshot?.id === d.id || log.recipeName === d.nameZh;
      return sum + (same ? (1 - (now - Date.parse(log.createdAt)) / (90 * 86400000)) : 0);
    }, 0));
    return n;
  }
  return pool.map((drink, index) => ({ drink, index, score: score(drink) })).sort((a,b) => b.score - a.score || a.index - b.index).map(row => row.drink);
}
