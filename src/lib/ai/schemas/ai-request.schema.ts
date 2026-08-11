import { z } from 'zod';

export const GenerateRecipeRequest = z.object({
  ingredient_ids: z.array(z.union([z.number(), z.string()])).min(1),
  preferences: z.object({
    strength: z.number().int().min(1).max(5),
    sweetness: z.number().int().min(1).max(5),
    sourness: z.number().int().min(1).max(5),
    freshness: z.number().int().min(1).max(5),
  }),
  disliked_categories: z.array(z.string()).optional(),
  scene: z.string().optional(),
});

export const ModifyClassicRequest = z.object({
  classic_template_id: z.union([z.number(), z.string()]),
  remix_direction: z.object({
    lower_alcohol: z.boolean().optional(),
    reduce_bitterness: z.boolean().optional(),
    make_sweeter: z.boolean().optional(),
    make_fresher: z.boolean().optional(),
    make_fruity: z.boolean().optional(),
    convenience_store_avail: z.boolean().optional(),
  }),
});

export const ExplainTasteRequest = z.object({
  recipe_name: z.string(),
  ingredients: z.array(z.string()).min(1),
});

export const SubstituteIngredientRequest = z.object({
  target_ingredient: z.string(),
  context_recipe: z.string().optional(),
});

export const NameRecipeRequest = z.object({
  custom_ingredients: z.array(z.string()).min(1),
  overall_tasting_note: z.string().optional(),
});

export type GenerateRecipeRequestType = z.infer<typeof GenerateRecipeRequest>;

export default {
  GenerateRecipeRequest,
  ModifyClassicRequest,
  ExplainTasteRequest,
  SubstituteIngredientRequest,
  NameRecipeRequest,
};
