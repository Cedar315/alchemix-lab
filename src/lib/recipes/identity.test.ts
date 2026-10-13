import test from 'node:test';
import assert from 'node:assert/strict';
import { coreIngredientKey, dedupeRecipes, favoriteIdentity, databaseRecipeKey } from './identity';
import { canonicalConvenienceId,convenienceExploreCocktails } from '../data/explore-catalog';
test('bilingual aliases share a core identity without conflating juice and fruit',()=>{
 assert.equal(coreIngredientKey(['Vodka','Orange Juice']),coreIngredientKey(['橙汁','伏特加','冰块']));
 assert.notEqual(coreIngredientKey(['柠檬汁']),coreIngredientKey(['柠檬茶']));
});
test('duplicate formulas collapse; ratios and methods remain distinct',()=>{
 const a={id:'a',type:'convenience',method:'Stir',ingredients:[{nameCn:'伏特加',amount:30,unit:'ml'},{nameCn:'橙汁',amount:120,unit:'ml'}]};
 const b={...a,id:'b',ingredients:[{nameCn:'Vodka',amount:30,unit:'ml'},{nameCn:'Orange Juice',amount:120,unit:'ml'}]};
 assert.equal(dedupeRecipes([a,b]).length,1);
 assert.equal(databaseRecipeKey(a),databaseRecipeKey(b));
 assert.equal(dedupeRecipes([a,{...b,method:'Shake'}]).length,2);
 assert.equal(dedupeRecipes([a,{...b,ingredients:[{nameCn:'伏特加',amount:60,unit:'ml'},{nameCn:'橙汁',amount:120,unit:'ml'}]}]).length,2);
});
test('old convenience URL resolves to retained recipe and favorite key',()=>{
 assert.equal(canonicalConvenienceId('cv-vodka-orange-juice'),'vodka-orange');
 assert.equal(convenienceExploreCocktails.filter(r=>coreIngredientKey(r.ingredients)===coreIngredientKey(['伏特加','橙汁'])).length,1);
 assert.equal(favoriteIdentity({recipeId:'cv-vodka-orange-juice'}),favoriteIdentity({recipeId:'vodka-orange'}));
});
test('generated remix save uses measured formula rather than timestamp',()=>{
 const ingredients=[{name:'伏特加',amount:30,unit:'ml'},{name:'橙汁',amount:120,unit:'ml'}];
 assert.equal(favoriteIdentity({id:'saved-improved-1',ingredients}),favoriteIdentity({id:'saved-improved-2',ingredients}));
 assert.throws(()=>favoriteIdentity({name:'伏特加橙汁'}),/RECIPE_ID_REQUIRED/);
});
