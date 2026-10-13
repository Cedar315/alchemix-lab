import type { MixologyIngredient } from './engine';
import { isMaterialName } from './material-identity';

export type ReferenceMaterial = { name: string; amount?: number };
export type ReferenceMode = 'standard' | 'lower_alcohol' | 'dilute';
export type ReferenceIngredient = MixologyIngredient & { id: string; color: string; isBubbly?: boolean; recommendedAmount?: number };

// Suggested quantities are an editable starting point, never a claim about what was poured.
export function buildReferenceExperiment(
    materials: ReferenceMaterial[],
    resolve: (name: string) => ReferenceIngredient | undefined,
    mode: ReferenceMode = 'standard',
) {
    const unresolved: ReferenceMaterial[] = [];
    const ingredients: ReferenceIngredient[] = [];
    for (const material of materials) {
        const profile = isMaterialName(material.name) ? resolve(material.name) : undefined;
        if (!profile) { unresolved.push(material); continue; }
        let amount = material.amount ?? profile.recommendedAmount ?? ((profile.abv ?? 0) > 20 ? 30 : 90);
        if (material.amount === undefined && mode === 'lower_alcohol' && (profile.abv ?? 0) > 0) amount *= 0.5;
        ingredients.push({ ...profile, name: material.name, amount: Math.round(amount * 10) / 10 });
    }
    // Scale suggested volumes only. Actual poured quantities must remain intact.
    const fixed = ingredients.filter((_, i) => materials.filter(m => !unresolved.includes(m))[i]?.amount !== undefined);
    const fixedVolume = fixed.reduce((sum, item) => sum + item.amount, 0);
    const suggested = ingredients.filter(item => !fixed.includes(item));
    const suggestedVolume = suggested.reduce((sum, item) => sum + item.amount, 0);
    if (fixedVolume + suggestedVolume > 300 && suggestedVolume > 0 && mode !== 'dilute') {
        const scale = Math.max(0, 300 - fixedVolume) / suggestedVolume;
        if (scale > 0) suggested.forEach(item => { item.amount = Math.max(1, Math.floor(item.amount * scale)); });
    }
    return { ingredients, unresolved };
}
