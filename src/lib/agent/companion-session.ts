import { z } from 'zod';
import { pageSchema, companionOutput, companionInput } from './companion-contract';
export const messageSchema = z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(2000), result: companionOutput.optional() });
export const taskSchema = z.object({ id: z.string().uuid(), key: z.string(), name: z.string(), version: z.number().int(), draft: z.string().max(1000), messages: z.array(messageSchema).max(24), pending: companionInput.shape.pending });
export type Task = z.infer<typeof taskSchema>;
export type Message = z.infer<typeof messageSchema>;
export const sessionSchema = z.object({ tasks: z.array(taskSchema).max(8), active: z.string().nullable(), owner: z.string().nullable() });
export type Session = z.infer<typeof sessionSchema>;
export function taskKey(page: z.infer<typeof pageSchema>) { return page.kind === 'lab' ? `lab:${page.name}` : `${page.kind}:${page.recipeId}`; }
export function createTask(page: z.infer<typeof pageSchema>): Task { return { id: crypto.randomUUID(), key: taskKey(page), name: page.name, version: 0, draft: '', messages: [], pending: null }; }
export function acceptsResult(task: Task, result: {
    taskId: string;
    contextVersion: number;
}) { return task.id === result.taskId && task.version === result.contextVersion; }
export const SESSION_KEY = 'alchemix_companion_v2';
export const LAB_DRAFT_KEY = 'alchemix_lab_draft_v1';
export const LAB_TRANSFER_KEY = 'alchemix_lab_transfer_v1';
export const transferSchema = z.object({ taskId: z.string().uuid(), materials: z.array(z.object({ name: z.string().min(1).max(100), amount: z.number().positive().max(350).optional() })).min(1).max(30), createdAt: z.number(), replace: z.boolean() });
export function readTransfer() { try {
    const r = transferSchema.safeParse(JSON.parse(sessionStorage.getItem(LAB_TRANSFER_KEY) || 'null'));
    return r.success && Date.now() - r.data.createdAt < 300000 ? r.data : null;
}
catch {
    return null;
} }
export function labHasDraft() { try {
    const d = JSON.parse(sessionStorage.getItem(LAB_DRAFT_KEY) || 'null');
    return Boolean(d?.ingredients?.length || d?.pending?.length);
}
catch {
    return false;
} }
