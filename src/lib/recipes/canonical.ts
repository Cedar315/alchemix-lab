import { INSPIRATION_RECIPES } from '../data/inspiration-catalog';
import { canonicalConvenienceId } from '../data/explore-catalog';
import { databaseRecipeKey, stableRecipeId } from './identity';
const canonicalByKey = new Map<string,string>();
const aliases = new Map<string,string>();
for (const recipe of INSPIRATION_RECIPES) {
 const key=databaseRecipeKey(recipe);
 if (!key) continue;
 const canonical=canonicalByKey.get(key)||recipe.slug;
 canonicalByKey.set(key,canonical);
 aliases.set(recipe.slug,canonical);
}
export function canonicalRecipeId(id:string) {
 return aliases.get(id)||canonicalConvenienceId(stableRecipeId(id));
}
