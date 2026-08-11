import { z } from 'zod';

export const AICocktailRecipeSchema = z.object({
  name: z.string(),
  description: z.string(),
  ingredients: z.array(z.object({
    name: z.string(),
    amount: z.string().optional(),
    is_required: z.boolean().optional(),
    substitute_suggestions: z.array(z.string()).optional()
  })),
  steps: z.array(z.string()),
  ratio: z.string().optional(),
  flavor_profile: z.object({
    sweetness_level: z.number().int().min(1).max(5),
    sourness_level: z.number().int().min(1).max(5),
    bitterness_level: z.number().int().min(1).max(5),
    freshness_level: z.number().int().min(1).max(5),
    alcohol_strength_level: z.number().int().min(0).max(5).optional(),
  }),
  estimated_abv: z.string().optional(),
  alcohol_level: z.number().int().min(1).max(5).optional(),
  beginner_friendly_score: z.number().int().min(1).max(5).optional(),
  caution_notes: z.array(z.string()).optional(),
  substitute_options: z.array(z.string()).optional(),
  ai_reasoning_summary: z.string().optional(),
});

export type AICocktailRecipe = z.infer<typeof AICocktailRecipeSchema>;

export default AICocktailRecipeSchema;
