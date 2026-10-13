import { z } from 'zod';
import { ingredientKey } from '../agent/workflow-catalog';

export const labActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  z.object({ kind: z.literal('navigate') }),
  z.object({
    kind: z.literal('prefill'),
    materials: z.array(z.object({
      name: z.string().trim().min(1).max(100), amount: z.number().positive().max(350).nullable(),
      source: z.string().min(1).max(100).describe('用户原话中的材料名称（不是整句话），或本轮 get_recipe 返回的真实 recipeId。不能使用你自己提议的配料作为来源。'),
    })).min(1).max(6),
    assumptions: z.array(z.string().max(250)).max(8),
  }),
]);
export const agentResponseSchema = z.object({
  message: z.string().min(1).max(12000).describe('给用户的中文回复，先回答问题，再自然追问。不要在正文写实验室链接，界面根据 lab 显示按钮。'),
  lab: labActionSchema.describe('仅报告酒单缺料时先查候选酒款，用 none；提出具体替代材料、搭配探索、味道讨论和试配材料纠正用 prefill；只有纯导航用 navigate；与试配无关或取消用 none。'),
});
export type LabAction = z.infer<typeof labActionSchema>;
export function validateLabAction(action: LabAction, statements: string[], recipes: { recipeId: string; ingredients: { name: string }[] }[] = []): LabAction {
  if (action.kind !== 'prefill') return action;
  const materials = action.materials.filter(m =>
    (statements.some(s => s.toLowerCase().includes(m.source.toLowerCase())) && ingredientKey(m.source) === ingredientKey(m.name)) ||
    recipes.some(r => r.recipeId === m.source && r.ingredients.some(i => ingredientKey(i.name) === ingredientKey(m.name))));
  return materials.length ? { ...action, materials } : { kind: 'none' };
}
export function labPreview(action: Extract<LabAction, { kind: 'prefill' }>) {
  return { status: 'preview' as const, materials: action.materials.map(m => ({ name: m.name, ...(m.amount === null ? {} : { amount: m.amount }) })), assumptions: action.assumptions, applied: false as const };
}
