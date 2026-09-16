import { z } from 'zod';
export const sourceSchema = z.object({title:z.string().trim().min(1).max(300),url:z.string().url().max(2000).refine(value=>{
  const u=new URL(value); return u.protocol==='https:' && !u.username && !u.password && !u.port && u.hostname.includes('.') && !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname) && !u.hostname.endsWith('.local');
})});
export const draftSchema=z.object({title:z.string().trim().min(1).max(300),aliases:z.array(z.string().max(300)).max(12),category:z.string().max(100),answer:z.string().max(6000),scope:z.string().max(1500),sources:z.array(sourceSchema).max(8)}).strict();
export const reviewInput=z.object({id:z.string().regex(/^web-[a-f0-9]{32}$/),revision:z.number().int().positive(),action:z.enum(['save','publish','reject','unpublish','merge']),draft:draftSchema.optional(),note:z.string().trim().max(1500).default(''),mergeTarget:z.string().regex(/^web-[a-f0-9]{32}$/).optional()}).strict();
export type Draft=z.infer<typeof draftSchema>;
export type Candidate={id:string;question:string;recipe_name:string;status:string;draft:Draft;evidence:Array<{title:string;url:string;excerpt:string}>;reason:string;occurrences:number;revision:number;created_at:string;updated_at:string;merged_into:string|null};
export function redact(value:string) {
  return value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[邮箱已移除]').replace(/(?:\+?\d[\d ()-]{7,}\d)/g,'[号码已移除]').replace(/https?:\/\/\S+/g,'[链接已移除]').slice(0,1000);
}
export function normalizedQuestion(value:string) { return redact(value).toLowerCase().replace(/[\s，。！？!?、：:；;]/g,''); }
