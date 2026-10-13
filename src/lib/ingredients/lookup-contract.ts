import { z } from 'zod';
import { sourceSchema } from '../knowledge/review/contract';
export const lookupRequest = z.object({ query: z.string().trim().min(1).max(100) }).strict();
export const lookupResponse = z.object({
  success: z.literal(true), status: z.enum(['found', 'no_results']), query: z.string(),
  sources: z.array(sourceSchema.extend({ excerpt: z.string().max(1800) })).max(5),
});
export type IngredientLookup = z.infer<typeof lookupResponse>;
