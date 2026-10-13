import { taskStateSchema } from './task-state';
import { z } from 'zod';
export const materialSchema = z.object({ name: z.string().trim().min(1).max(100), amount: z.number().finite().positive().max(10000).optional() }).strict();
export const requirementSchema = materialSchema.extend({ display: z.string().max(250), optional: z.boolean(), auxiliary: z.boolean() });
export const pageSchema = z.object({ kind: z.enum(['classic', 'convenience', 'lab']), recipeId: z.string().max(100).optional(), name: z.string().max(120), ingredients: z.array(materialSchema).max(30), requirements: z.array(requirementSchema).max(30).optional(), method:z.string().max(1500).optional(), note: z.string().max(1500).optional() }).strict();
export type PageContext = z.infer<typeof pageSchema>;
export const pendingSchema = z.discriminatedUnion('kind', [
    z.object({ kind:z.literal('rescue'), question:z.string().max(1000), recipeKey:z.string().max(250), conversation:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().max(2000)}).strict()).max(24) }).extend({taskState:taskStateSchema.optional()}).strict(),
    z.object({ kind:z.literal('clarification'), intent:z.enum(['unclear','knowledge','guide','change','troubleshoot','recommend','explore','named','operate']), question:z.string().max(1000), clarification:z.string().max(500), awaitingField:z.enum(['actualMaterials','actualSteps','detail']), slots:z.record(z.string().max(2000)), recipeKey:z.string().max(250) }).extend({taskState:taskStateSchema.optional()}).strict(),
    z.object({ kind: z.literal('adjustment'), additive: z.string().max(100), question: z.string().max(1000) }).extend({taskState:taskStateSchema.optional()}).strict(),
    z.object({ kind: z.literal('category'), materials: z.array(z.string().max(100)).max(30), similarTo: pageSchema.optional(), recipeName: z.string().max(120).optional() }).extend({taskState:taskStateSchema.optional()}).strict(),
    z.object({ kind: z.literal('alternative'), anchor: z.string().max(100), missingMaterial: z.string().max(100) }).extend({taskState:taskStateSchema.optional()}).strict(),
    z.object({ kind: z.literal('substitution'), stage: z.enum(['missing', 'available', 'verify_recipe', 'advising']), question: z.string().max(1000), missingMaterial: z.string().max(100), materials: z.array(z.string().max(100)).max(30), materialsKnown: z.boolean(), recipeKey: z.string().max(250).optional(), reportedRequirement: z.string().max(1000).optional(), replacementMaterial: z.string().max(100).optional() }).extend({taskState:taskStateSchema.optional()}).strict(),
    z.object({ kind: z.literal('troubleshoot'), stage: z.enum(['materials', 'steps']), question: z.string().max(1000), actualMaterials: z.string().max(1000), actualSteps: z.string().max(1000) }).extend({taskState:taskStateSchema.optional()}).strict(),
]);
export const companionInput = z.object({ version: z.literal(2), taskId: z.string().uuid(), contextVersion: z.number().int().nonnegative(), question: z.string().trim().min(1).max(1000), page: pageSchema, history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(2000) }).strict()).max(12), pending: pendingSchema.nullable().default(null) }).strict();
export type CompanionInput = z.infer<typeof companionInput>;
export const decisionSchema = z.object({ intent: z.enum(['operate', 'explore', 'recommend', 'named', 'change', 'guide', 'troubleshoot', 'knowledge', 'out_of_scope', 'unclear']), dialogueAct: z.enum(['new_task', 'answer', 'correction', 'feedback', 'cancel']), materials: z.array(z.string().max(100)).max(30), recipeName: z.string().max(120), category: z.enum(['classic', 'convenience', 'any']), capability: z.enum(['recipe', 'substitute', 'lab', 'finder', 'records', 'none']), question: z.string().max(500), knowledgeQuestion: z.string().max(1000), facts: z.object({ missingMaterial: z.string().max(100), availableMaterialsKnown: z.boolean(), actualMaterials: z.string().max(1000), actualSteps: z.string().max(1000) }).strict().optional() }).strict();
export type Decision = z.infer<typeof decisionSchema>;
export type PageAction = {
    kind: 'navigate';
    target: 'finder' | 'lab' | 'records' | 'explore';
} | {
    kind: 'recipe';
    category: 'classic' | 'convenience';
    id: string;
} | {
    kind: 'locate';
    target: 'recipe' | 'substitute' | 'lab';
} | {
    kind: 'prefill';
    reference?: 'standard' | 'lower_alcohol' | 'dilute';
    materials: {
        name: string;
        amount?: number;
    }[];
};
export type LabeledAction = {
    label: string;
    action: PageAction;
};
export const knowledgeSchema = z.object({ status: z.enum(['answered', 'insufficient_evidence', 'no_evidence']), claims: z.array(z.object({ text: z.string(), evidenceIds: z.array(z.string()) })), citations: z.array(z.object({ id: z.string(), title: z.string(), sources: z.array(z.object({ title: z.string(), url: z.string().url().refine(v => v.startsWith('https://')) })) })) });
const pageActionSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('navigate'), target: z.enum(['finder', 'lab', 'records', 'explore']) }).strict(),
    z.object({ kind: z.literal('recipe'), category: z.enum(['classic', 'convenience']), id: z.string().max(100) }).strict(),
    z.object({ kind: z.literal('locate'), target: z.enum(['recipe', 'substitute', 'lab']) }).strict(),
    z.object({ kind: z.literal('prefill'), reference: z.enum(['standard', 'lower_alcohol', 'dilute']).optional(), materials: z.array(materialSchema).min(1).max(30) }).strict(),
]);
export const companionOutput = z.object({ status: z.enum(['answered', 'needs_info', 'handoff', 'no_results', 'cancelled', 'out_of_scope', 'unavailable', 'timeout']), message: z.string(), clarification: z.string(), actions: z.array(z.object({ label: z.string(), action: pageActionSchema })), recipes: z.array(z.object({ id: z.string(), name: z.string(), category: z.enum(['classic', 'convenience']), reason: z.string(), missing: z.array(z.string()), action: pageActionSchema })).max(3), knowledge: knowledgeSchema.nullable(), pending: companionInput.shape.pending, taskId: z.string(), contextVersion: z.number(), trace: z.array(z.object({ tool: z.string(), status: z.string(), elapsedMs: z.number() })), model: z.string(), requestId: z.string().optional(), usage: z.unknown().optional() });
export type CompanionResult = z.infer<typeof companionOutput>;
export const navigationTargets = { finder: '/?tab=ASSISTANT', lab: '/?tab=LAB', records: '/?tab=MY', explore: '/inspiration' };
export const capabilityTargets = { recipe: 'assistant-recipe', substitute: 'assistant-substitute', lab: 'assistant-lab' };
