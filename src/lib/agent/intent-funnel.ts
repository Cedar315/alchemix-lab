import { isAdjustmentRequest, isRescueConversation } from './adjustment';
import type { CompanionInput, Decision, PageContext } from './companion-contract';
import { actualProblem, alternativeAnswer, consultationDecision, proposedReplacement } from './consultation';
import { mentionedMaterials, mentionedRecipe } from './workflow-catalog';

export type FunnelResolution = {
    layer: 'L1' | 'L2';
    rule: string;
    decision: Decision;
};

const empty = (): Decision => ({
    intent: 'unclear', dialogueAct: 'new_task', materials: [], recipeName: '', category: 'any',
    capability: 'none', question: '', knowledgeQuestion: '',
});
const resolved = (layer: FunnelResolution['layer'], rule: string, decision: Partial<Decision>): FunnelResolution => ({
    layer, rule, decision: { ...empty(), ...decision },
});
const categoryFrom = (text: string): Decision['category'] => text.includes('经典') ? 'classic' : text.includes('便利店') ? 'convenience' : 'any';
// A single fast-path decision cannot extract an additional knowledge task reliably.
export const hasAdditionalRequest = (text: string) => /另外|同时|顺便|以及|还想|也想/.test(text);
export function additionalKnowledgeRequest(text: string) {
    const match = /另外|同时|顺便|以及|还想|也想/.exec(text);
    if (!match) return null;
    const question = text.slice(match.index + match[0].length).replace(/^[，,\s]+/, '');
    return /解释|为什么|怎么|如何|能否|能不能|可以|什么|多久|几秒|区别/.test(question)
        ? { primary: text.slice(0, match.index), question } : null;
}

/**
 * L1 is intentionally small. Order is part of the product contract: cancellation,
 * real-world faults, explicit catalogue work, exploration, then navigation.
 */
export function resolveL1(input: CompanionInput, page: PageContext = input.page): FunnelResolution | null {
    const text = input.question.trim();
    if (/^(算了|取消|先不改了|先不改|停止|不用了)[。！!]*$/.test(text))
        return resolved('L1', 'cancel', { dialogueAct: 'cancel' });

    if (hasAdditionalRequest(text)) return null;

    if (isAdjustmentRequest(text)) return null;

    if (actualProblem(text))
        return resolved('L1', 'actual_problem', { intent: 'troubleshoot', knowledgeQuestion: text });

    // Stateful corrections and replacements must not be intercepted by generic flavor rules.
    if (proposedReplacement(text) || /有说|有写|写着|不是|说错|其实/.test(text)) return null;

    const materials = mentionedMaterials(text);
    const recipe = mentionedRecipe(text);
    if (recipe && /打开|查看|看看|酒单/.test(text) && !/怎么|如何|为什么|缺|没有|改良/.test(text))
        return resolved('L1', 'named_recipe', { intent: 'named', recipeName: recipe.nameZh, category: categoryFrom(text) });

    if (/(?:我有|手边有|材料是|材料有)/.test(text) && /能做什么|能调什么|可以做什么|能做哪|推荐.*酒/.test(text))
        return resolved('L1', 'available_materials_recipe_search', { intent: 'recommend', materials, category: categoryFrom(text) });

    if (materials.length >= 2 && /什么味|什么风味|配起来|搭配.*(?:味|风)|混合.*味/.test(text)
        && !/已经|分层|失败|没有|不能|不可以/.test(text))
        return resolved('L1', 'material_flavor_exploration', { intent: 'explore', materials });

    if (/降低酒感|酒感太/.test(text))
        return resolved('L1', 'lower_alcohol', { intent: 'change', knowledgeQuestion: text });

    if (page.kind !== 'lab' && /(?:制作步骤|做法|材料表|配方).*(?:在哪|哪里|怎么看|打开)/.test(text))
        return resolved('L1', 'current_recipe_details', { intent: 'operate', capability: 'recipe' });

    if (/哪里|在哪|怎么(?:打开|找到)|打开|进入|带我去|^去.+|入口/.test(text)) {
        const capability: Decision['capability'] = /记录|收藏/.test(text) ? 'records'
            : /便利店|改良|替换/.test(text) ? 'substitute'
            : /实验室|试调|搭配/.test(text) ? 'lab'
            : /选酒|筛选|推荐/.test(text) ? 'finder'
            : /酒单|配方|步骤/.test(text) && page.kind !== 'lab' ? 'recipe' : 'none';
        if (capability !== 'none') return resolved('L1', 'registered_capability', { intent: 'operate', capability });
    }
    return null;
}

/** L2 resolves stateful continuations; it does not perform open-ended intent classification. */
export function resolveL2(input: CompanionInput, page: PageContext = input.page): FunnelResolution | null {
    const clarification=input.pending?.kind==='clarification'?input.pending:null;
    if(clarification && clarification.recipeKey===page.kind+':'+(page.recipeId||page.name) && input.question.length<=160 && !/另外|打开|帮我|推荐|为什么|怎么办|如何|能不能|是什么|取消|不用了|谢谢|换个话题/.test(input.question)) {
        const slots={...clarification.slots,[clarification.awaitingField]:input.question};
        return resolved('L2','clarification_answer',{intent:clarification.intent==='unclear'?'knowledge':clarification.intent,dialogueAct:/不是|说错|其实/.test(input.question)?'correction':'answer',materials:mentionedMaterials(input.question),category:clarification.slots.category==='classic'?'classic':clarification.slots.category==='convenience'?'convenience':'any',recipeName:clarification.intent==='named'?input.question:clarification.slots.recipeName||'',knowledgeQuestion:`${clarification.question}。上一问：${clarification.clarification}；用户补充：${input.question}。已知信息：${JSON.stringify(slots)}`,facts:{missingMaterial:'',availableMaterialsKnown:false,actualMaterials:slots.actualMaterials||'',actualSteps:slots.actualSteps||''}});
    }
    const categoryPending = input.pending?.kind === 'category' ? input.pending : null;
    if (categoryPending && /^(经典酒?|便利店(?:调酒)?)[。！!]*$/.test(input.question.trim()))
        return resolved('L2', 'category_answer', {
            intent: categoryPending.recipeName ? 'named' : 'recommend', dialogueAct: 'answer',
            materials: categoryPending.materials, recipeName: categoryPending.recipeName ?? '', category: categoryFrom(input.question),
        });

    const alternativePending = input.pending?.kind === 'alternative' ? input.pending : null;
    const newMaterials = alternativePending ? alternativeAnswer(input.question) : [];
    if (alternativePending && newMaterials.length)
        return resolved('L2', 'alternative_material_answer', { intent: 'explore', dialogueAct: 'answer', materials: newMaterials });

    const consultation = consultationDecision({ ...input, page });
    if (consultation)
        return resolved('L2', input.pending ? 'continue_pending_consultation' : 'start_consultation', consultation);
    return null;
}

export function resolveBeforeL3(input: CompanionInput, page: PageContext = input.page) {
    if (hasAdditionalRequest(input.question)) return null;
    const first=resolveL1(input,page);
    if(first?.decision.dialogueAct==='cancel'||first?.decision.intent==='operate'||first?.decision.intent==='named') return first;
    if (isRescueConversation(input)) return null;
    return (input.pending ? resolveL2(input,page) : null) ?? first ?? resolveL2(input,page);
}
