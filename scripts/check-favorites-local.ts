import { PrismaClient } from '@prisma/client';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { INSPIRATION_RECIPES } from '../src/lib/data/inspiration-catalog';
import { databaseRecipeKey } from '../src/lib/recipes/identity';
import { persistFavorite } from '../src/lib/recipes/favorites-store';
const url=process.env.LOCAL_TEST_DATABASE_URL;
if (!url || new URL(url).hostname!=='127.0.0.1' || new URL(url).port!=='55439') throw Error('Use isolated local port 55439');
const db=new PrismaClient({datasources:{db:{url}}});
try {
 // Populate old schema with catalog seeds and synthetic account data, never production data.
 for(const recipe of INSPIRATION_RECIPES){
  const {ingredients,tags,...data}=recipe;
  const row=await db.recipe.create({data,select:{id:true}});
  await db.recipeIngredient.createMany({data:ingredients.map((i,index)=>({recipeId:row.id,ingredientNameCn:i.nameCn,ingredientNameEn:i.nameEn,amount:i.amount,unit:i.unit,role:i.role,isOptional:i.isOptional||false,sortOrder:index}))});
 }
 const user=await db.user.create({data:{id:crypto.randomUUID(),email:'fixture@example.com'}});
 const a='convenience-vodka-橙汁-0',b='convenience-vodka-橙汁-1';
 for(const id of [a,b]){
  const output=await db.recipeOutput.create({data:{inputParams:{},recipeJson:{id,chineseName:'测试',name:'test'}}});
  await db.$executeRaw`INSERT INTO user_saved_recipes(user_id,recipe_output_id) VALUES(${user.id}::uuid,${output.id}::uuid)`;
 }
 await db.drinkLog.create({data:{userId:user.id,recipeId:b,recipeName:'历史快照',recipeSnapshot:{id:b}}});
 const sql=await readFile('prisma/migrations/20260923130000_recipe_favorite_identity/migration.sql','utf8');
 await db.$transaction(async tx=>{for(const s of sql.replace(/--[^\n]*/g,'').split(';').map(s=>s.trim()).filter(s=>s && !['BEGIN','COMMIT'].includes(s)))await tx.$executeRawUnsafe(s);},{timeout:30000});
 const rows=await db.recipe.findMany({include:{ingredients:true}});
 for(const row of rows) if(row.canonicalKey)assert.equal(row.canonicalKey,databaseRecipeKey(row),row.slug);
 assert.equal(await db.userSavedRecipe.count(),1);
 assert.equal((await db.drinkLog.findFirst())!.recipeId,a);
 assert.equal((await db.drinkLog.findFirst())!.recipeSnapshot && ((await db.drinkLog.findFirst())!.recipeSnapshot as any).id,b);
 const payload={id:'cv-vodka-orange-juice',chineseName:'伏特加橙汁',name:'Vodka Orange'};
 const saved=await Promise.all(Array.from({length:5},()=>persistFavorite(db,user.id,payload)));
 assert.equal(new Set(saved.map(s=>s.id)).size,1,'concurrent saves must share one output');
 assert.equal(await db.userSavedRecipe.count({where:{userId:user.id,recipeKey:'recipe:vodka-orange'}}),1);
 assert.equal(await db.drinkLog.count(),1,'favorite does not save a drink log');
 await db.$disconnect();
 assert.equal(await db.userSavedRecipe.count({where:{userId:user.id,recipeOutputId:saved[0].id}}),1,'survives reconnection');
 const stranger=await db.user.create({data:{id:crypto.randomUUID(),email:'stranger@example.com'}});
 assert.equal((await db.userSavedRecipe.deleteMany({where:{userId:stranger.id,recipeOutputId:saved[0].id}})).count,0);
 assert.equal((await db.userSavedRecipe.deleteMany({where:{userId:user.id,recipeOutputId:saved[0].id}})).count,1);
 assert.equal(await db.userSavedRecipe.count({where:{userId:user.id,recipeKey:'recipe:vodka-orange'}}),0);
 console.log(JSON.stringify({passed:true,recipes:rows.length,canonical:rows.filter(r=>r.canonicalKey).length,aliases:await db.recipeAlias.count(),checks:['migration signatures','favorite references merged','history reference migrated and snapshot retained','concurrent saves','independent of logs','reconnection persistence','owner isolation','unfavorite']},null,2));
}finally{await db.$disconnect();}
