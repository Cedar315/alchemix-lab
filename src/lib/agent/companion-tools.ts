import { tool } from '@langchain/core/tools';
import { convertToOpenAITool } from '@langchain/core/utils/function_calling';
import { z } from 'zod';
import { decisionSchema, type Decision } from './companion-contract';

const dialogueAct = z.enum(['new_task', 'answer', 'correction', 'feedback', 'cancel']);
const category = z.enum(['classic', 'convenience', 'any']);
const intent = decisionSchema.shape.intent;
const materialList = z.array(z.string().trim().min(1).max(100)).max(30);
const facts = z.object({
    missing_material: z.string().max(100).optional(),
    available_materials_known: z.boolean().optional(),
    actual_materials: z.string().max(1000).optional(),
    actual_steps: z.string().max(1000).optional(),
}).strict().optional();
const common = {
    dialogue_act: dialogueAct.optional(),
    clarification: z.string().max(500).optional().describe('Only one necessary follow-up question; empty when no clarification is needed.'),
    knowledge_question: z.string().max(1000).optional().describe('A self-contained knowledge question, including the mixed knowledge part when present.'),
};

const schemas = {
    find_recipes: z.object({
        materials: materialList,
        category: category.optional(),
        ...common,
    }).strict(),
    open_recipe: z.object({
        recipe_name: z.string().trim().min(1).max(120),
        category: category.optional(),
        ...common,
    }).strict(),
    explore_materials: z.object({
        materials: materialList,
        ...common,
    }).strict(),
    locate_feature: z.object({
        capability: z.enum(['recipe', 'substitute', 'lab', 'finder', 'records']),
        ...common,
    }).strict(),
    change_recipe: z.object({
        materials: materialList.optional(),
        facts,
        ...common,
    }).strict(),
    guide_recipe: z.object({ facts, ...common }).strict(),
    troubleshoot_recipe: z.object({ facts, ...common }).strict(),
    answer_knowledge: z.object({ facts, ...common }).strict(),
    clarify_request: z.object({
        intent: intent.optional(),
        clarification: z.string().trim().min(1).max(500),
        dialogue_act: dialogueAct.optional(),
    }).strict(),
    reject_out_of_scope: z.object({ dialogue_act: dialogueAct.optional() }).strict(),
};

type ToolName = keyof typeof schemas;
type RawToolCall = { name?: unknown; args?: unknown; function?: { name?: unknown; arguments?: unknown } };

const definitions = [
    ['find_recipes', 'Find real recipes from the reviewed catalogue using materials the user explicitly says are available. Do not use for flavor-only exploration.'],
    ['open_recipe', 'Open a specifically named real cocktail recipe.'],
    ['explore_materials', 'Send explicitly named materials to the lab for flavor exploration; do not invent amounts.'],
    ['locate_feature', 'Locate one registered product capability such as recipe steps, substitutions, lab, finder, or records.'],
    ['change_recipe', 'Handle a missing ingredient, substitution, or requested change to the current drink.'],
    ['guide_recipe', 'Answer how to prepare the current drink or use a mixing technique.'],
    ['troubleshoot_recipe', 'Diagnose a drink the user has already made or started making; actual materials and steps matter.'],
    ['answer_knowledge', 'Answer a cocktail-domain knowledge question that does not require selecting a drink.'],
    ['clarify_request', 'Ask exactly one necessary question when the object, task, or required real-world fact is ambiguous.'],
    ['reject_out_of_scope', 'Reject a request that is clearly outside cocktail selection, preparation, knowledge, or product navigation.'],
] as const satisfies readonly (readonly [ToolName, string])[];

export const companionRoutingTools = definitions.map(([name, description]) => tool(
    async (args: unknown) => args,
    { name, description, schema: schemas[name] },
));

export const companionRoutingToolDefinitions = companionRoutingTools.map(item => convertToOpenAITool(item));

function base(intentValue: Decision['intent'], args: Record<string, unknown>): Decision {
    const rawFacts = args.facts as z.infer<NonNullable<typeof facts>> | undefined;
    return {
        intent: intentValue,
        dialogueAct: dialogueAct.catch('new_task').parse(args.dialogue_act),
        materials: materialList.catch([]).parse(args.materials),
        recipeName: typeof args.recipe_name === 'string' ? args.recipe_name : '',
        category: category.catch('any').parse(args.category),
        capability: z.enum(['recipe', 'substitute', 'lab', 'finder', 'records', 'none']).catch('none').parse(args.capability),
        question: typeof args.clarification === 'string' ? args.clarification : '',
        knowledgeQuestion: typeof args.knowledge_question === 'string' ? args.knowledge_question : '',
        facts: rawFacts ? {
            missingMaterial: rawFacts.missing_material ?? '',
            availableMaterialsKnown: rawFacts.available_materials_known ?? false,
            actualMaterials: rawFacts.actual_materials ?? '',
            actualSteps: rawFacts.actual_steps ?? '',
        } : undefined,
    };
}

export function decisionFromToolCall(call: RawToolCall): Decision {
    const name = (call.name ?? call.function?.name) as ToolName;
    if (!(name in schemas)) throw new Error('UNKNOWN_TOOL_CALL');
    const raw = call.args ?? call.function?.arguments;
    let args: unknown = raw;
    if (typeof raw === 'string') {
        try { args = JSON.parse(raw); }
        catch { throw new Error('INVALID_TOOL_ARGUMENTS'); }
    }
    const parsed = schemas[name].safeParse(args);
    if (!parsed.success) throw new Error('INVALID_TOOL_ARGUMENTS');
    const value = parsed.data as Record<string, unknown>;
    const mapped: Record<ToolName, Decision['intent']> = {
        find_recipes: 'recommend', open_recipe: 'named', explore_materials: 'explore', locate_feature: 'operate',
        change_recipe: 'change', guide_recipe: 'guide', troubleshoot_recipe: 'troubleshoot', answer_knowledge: 'knowledge',
        clarify_request: (value.intent as Decision['intent'] | undefined) ?? 'unclear', reject_out_of_scope: 'out_of_scope',
    };
    return decisionSchema.parse(base(mapped[name], value));
}

export function decisionFromToolCalls(calls: unknown): Decision {
    if (!Array.isArray(calls) || calls.length !== 1) throw new Error('EXPECTED_ONE_TOOL_CALL');
    return decisionFromToolCall(calls[0] as RawToolCall);
}
