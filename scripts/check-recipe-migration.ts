import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const url=process.env.LOCAL_TEST_DATABASE_URL;
if (!url || new URL(url).hostname!=='127.0.0.1' || new URL(url).port!=='55439') throw Error('LOCAL_TEST_DATABASE_URL must target isolated local port 55439');
const { PrismaClient }=await import('@prisma/client');
const { databaseRecipeKey }=await import('../src/lib/recipes/identity');
const db=new PrismaClient({datasources:{db:{url}}});
const rollback=new Error('ROLLBACK_CHECK');
try {
 await db.$transaction(async tx=>{
 const sql=await readFile('prisma/migrations/20260923130000_recipe_favorite_identity/migration.sql','utf8');
 for(const statement of sql.replace(/--[^\n]*/g,'').split(';').map(s=>s.trim()).filter(s=>s && !['BEGIN','COMMIT'].includes(s))) await tx.$executeRawUnsafe(statement);
 const rows=await tx.recipe.findMany({include:{ingredients:true}});
 let canonical=0,merged=0;
 for(const row of rows){
   if(row.canonicalRecipeId!==null&&row.canonicalRecipeId!==row.id){merged++;assert.equal(row.isPublished,false);}
   else if(row.canonicalKey){canonical++;assert.equal(row.canonicalKey,databaseRecipeKey(row),row.slug);}
 }
 console.log(JSON.stringify({check:'migration_dry_run',canonical,merged,aliases:await tx.recipeAlias.count(),saved:await tx.userSavedRecipe.count(),rolledBack:true}));
 throw rollback;
 },{timeout:60000});
}catch(e){if(e!==rollback)throw e;}finally{await db.$disconnect();}
