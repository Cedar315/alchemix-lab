// Exact material aliases only: juice, fruit, soda and tea remain different materials.
const aliases:Record<string,string>={伏特加:'vodka',伏特加酒:'vodka',vodka:'vodka',橙汁:'orange_juice',orangejuice:'orange_juice',橙juice:'orange_juice',金酒:'gin',gin:'gin',烧酒:'soju',soju:'soju',威士忌:'whisky',whiskey:'whisky',whisky:'whisky',苏打水:'soda_water',sodawater:'soda_water',青柠汁:'lime_juice',limejuice:'lime_juice',柠檬汁:'lemon_juice',lemonjuice:'lemon_juice'};
export function materialIdentity(name:string){const n=name.trim().toLowerCase().replace(/[\s_-]+/g,'');return aliases[n]||n;}
export function coreIngredientKey(names:string[]){return [...new Set(names.filter(n=>!['冰块','冰','ice','ice cubes'].includes(n.trim().toLowerCase())).map(materialIdentity))].sort().join('|');}
export function stableRecipeId(id:string){return recipeAliases[id]||id;}
// Explicit aliases are retained for old links, saved recipes and conversation contexts.
const recipeAliases:Record<string,string>={'cv-vodka-orange-juice':'vodka-orange'};
export function dedupeRecipes<T extends {id?:string|bigint;slug?:string;type?:string;method?:string;ingredients:Array<any>}>(rows:T[]):T[]{
 const seen=new Set<string>();return rows.filter(r=>{
 const items=r.ingredients.filter(i=>typeof i==='string'||(!i.isOptional&&!['garnish','optional'].includes(i.role)));
 const key=coreIngredientKey(items.map(i=>typeof i==='string'?i:i.nameCn||i.ingredientNameCn||i.name||i.nameEn||''));
 // RecipeSeed/database entries include proportions/method: don't collapse distinct variants.
 const formula=items.every(i=>typeof i==='string')?'':items.map(i=>`${materialIdentity(i.nameCn||i.ingredientNameCn||i.name||i.nameEn||'')}:${i.amount||''}:${i.unit||''}`).sort().join('|')+':'+(r.method||'');
 const identity=key?`${r.type||''}:${key}:${formula}`:'id:'+stableRecipeId(String(r.slug||r.id));
 if(seen.has(identity))return false;seen.add(identity);return true;
 });
}
export function favoriteIdentity(c:Record<string,any>){
 const raw=c.recipeId||c.recipeSnapshot?.id||c.id;
 const id=typeof raw==='string'?raw.replace(/^assistant-recipe-(.+)-\d+$/,'$1'):raw;
 if(typeof id==='string'&&id&&!/^(?:saved(?:-improved)?|cocktail|drink-log)-\d/.test(id))return 'recipe:'+stableRecipeId(id);
 const items=c.ingredients||c.recipeSnapshot?.ingredients;
 if(Array.isArray(items)&&items.length)return 'formula:'+items.map((i:any)=>`${materialIdentity(i.name||i.nameCn||'')}:${i.amount??''}:${i.unit||'ml'}`).sort().join('|')+':'+(c.mixMethod||c.method||'');
 throw Error('RECIPE_ID_REQUIRED');
}

// Same representation as the migration: keep measured variants separate.
export function databaseRecipeKey(recipe: {type:string;method:string;ingredients:Array<any>}) {
 const parts=recipe.ingredients.filter(i=>!i.isOptional&&!['garnish','optional'].includes(i.role)&&!['冰','冰块','ice','ice cubes'].includes((i.nameCn||i.ingredientNameCn||'').toLowerCase())).map(i=>`${materialIdentity(i.nameCn||i.ingredientNameCn||i.name||'')}:${/^\d+(?:\.\d+)?$/.test(String(i.amount).trim())?Number(i.amount):String(i.amount).trim()}:${i.unit}`);
 return parts.length ? `${recipe.type}:${recipe.method}:${parts.sort().join('|')}` : null;
}
