import type { PageContext } from './companion-contract';

export function requirementFromLine(display: string) {
    const name = display.split(/\s+[a-z]|\s+\d|\s+(?:适量|少量|可选)/i)[0].trim();
    const ml = display.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*ml\b/i);
    return { name, ...(ml ? { amount: Number(ml[1]) } : {}), display,
        optional: /可选/.test(display), auxiliary: !ml };
}

export const allRequirements = (page: PageContext) => page.requirements ?? page.ingredients.map(i => ({ ...i, display: i.name, optional: false, auxiliary: false }));
export const recipeScope = (page: PageContext) => `${page.kind}:${page.recipeId ?? page.name}`;
