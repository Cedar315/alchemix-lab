'use client';

import { useId, useState } from 'react';
import { ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import type { CompanionResult } from '@/lib/agent/companion-contract';
import { findRecipe } from '@/lib/agent/workflow-catalog';
import { CLASSIC_DATABASE, getConvenienceRecipeGuide, normalizeClassicCocktailId } from '@/lib/data/explore-catalog';

export default function AssistantRecipeCard({ recipe, disabled, onOpen }: {
    recipe: CompanionResult['recipes'][number];
    disabled: boolean;
    onOpen: () => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const detailsId = useId();
    const entry = findRecipe(recipe.category, recipe.id);
    const classic = recipe.category === 'classic' ? CLASSIC_DATABASE[normalizeClassicCocktailId(recipe.id)] : undefined;
    const guide = recipe.category === 'convenience' && entry ? getConvenienceRecipeGuide(entry) : undefined;
    const ingredients = guide?.ingredientLines ?? classic?.ingredients.map(i => i.name) ?? entry?.ingredients ?? [];
    const steps = guide?.steps ?? (classic?.methodNote ? [classic.methodNote] : []);

    return <article className="assistant-recipe-card rounded-2xl border border-[#E1E1DE] bg-white p-4">
        <strong>{recipe.name}</strong>
        {entry && <p>{entry.nameEn}</p>}
        <p>{recipe.reason}</p>
        {recipe.missing.length > 0 && <p>缺少材料：{recipe.missing.join('、')}</p>}
        <button type="button" aria-expanded={expanded} aria-controls={detailsId} disabled={disabled || !entry} onClick={() => setExpanded(v => !v)}>
            {expanded ? '收起酒单' : '展开酒单'}{expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        {expanded && <div id={detailsId} className="assistant-recipe-details">
            <p>{entry?.description}</p>
            <p>{entry?.tags.join(' · ')}</p>
            <strong>需要材料</strong>
            <ul>{ingredients.map((name, i) => <li key={i}>{name}</li>)}</ul>
            {!!steps.length && <><strong>制作步骤</strong><ol>{steps.map((step, i) => <li key={i}>{step}</li>)}</ol></>}
            <button type="button" disabled={disabled} onClick={onOpen}>查看完整酒单<ArrowRight size={15} /></button>
        </div>}
    </article>;
}
