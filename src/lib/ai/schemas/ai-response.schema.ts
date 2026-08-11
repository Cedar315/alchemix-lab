import { AICocktailRecipeSchema } from './recipe.schema';
import { z } from 'zod';

export const GenerateRecipeResponse = z.object({
  success: z.boolean(),
  recipes: z.array(AICocktailRecipeSchema),
});

export default GenerateRecipeResponse;
