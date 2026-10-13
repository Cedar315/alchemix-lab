import { isMaterialName } from '../mixology/material-identity';
import type { CompanionInput } from './companion-contract';

export function isAdjustmentRequest(text:string){
 return /倒多|加多|太甜.*(?:怎么办|补救|加)|(?:稀释|淡一点|溢出).*(?:加|多少|补救|溢出)/.test(text);
}

// Accept both “我加了烧酒60ml” and “我加了60ml烧酒”.
// Unnamed quantities must trigger clarification, never become ingredient names.
export function parseActualQuantities(text: string): Array<{name:string;amount:number}> {
    const quantities: Array<{name:string;amount:number}> = [];
    for (const clause of text.split(/[，,、。；;\n]|以及|然后|和|还有/)) {
        const cleaned = clause.trim().replace(/大概|大约|差不多|左右|估计|约|总共|一共|总量|额外|多加了?|多倒了?/g,'').replace(/^(?:我)?(?:实际)?(?:已经)?(?:用的是|用了|倒入了?|倒了|加入了?|加了|现在有|有)\s*/, '');
        const before = cleaned.match(/^([^\d]+?)\s*(\d+(?:\.\d+)?)\s*(?:ml|毫升)(?:了)?$/i);
        const after = cleaned.match(/^(\d+(?:\.\d+)?)\s*(?:ml|毫升)\s*(?:的)?([^\d]+?)(?:了)?$/i);
        const name = (before?.[1] ?? after?.[2] ?? '').trim();
        const amount = Number(before?.[2] ?? after?.[1]);
        if (!isMaterialName(name) || /^(?:我|加了|倒了|用了|酒|一些|这个|那个)$|总共|一共|总量|总计/.test(name)
            || !(amount > 0 && amount <= 350)) continue;
        quantities.push({name,amount});
    }
    return quantities;
}

// Old adjustment sessions migrate to model-led consultation on their next turn.
export function isRescueConversation(input: CompanionInput) {
 return isAdjustmentRequest(input.question) || input.pending?.kind === 'rescue' || input.pending?.kind === 'adjustment';
}
