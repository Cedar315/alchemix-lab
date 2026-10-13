import env from '@next/env';
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
env.loadEnvConfig(process.cwd());
const { startAgent } = await import('../src/lib/agent-next/runtime');
const { namedRecipes, recipeContext } = await import('../src/lib/agent/workflow-catalog');
const current = namedRecipes('西柚啤酒')[0];
const context = current ? JSON.stringify(recipeContext(current.kind, current.id)) : '';
const question = '我没有西柚汽水了 啤酒还能做什么';
const rows = [];
for (let i = 0; i < 3; i++) {
 const started=Date.now();
 const result=startAgent({messages:[{role:'user',content:question}],context:i===2?'':context,userStatements:[question],signal:AbortSignal.timeout(45000)});
 for await(const part of result.stream) if(part.type==='error')throw Error('Provider stream failed');
 const tools=await result.toolResults;
 const found=tools.find(t=>t.toolName==='find_recipes');
 assert.ok(found,'Must look up real recipes before asking for all inventory');
 const output=found.output as {recipes:{recipe:{name:string;recipeId:string;ingredients:{name:string}[]};missing:string[];availability:string}[]};
 assert.ok(output.recipes.length>=2);
 assert.ok(output.recipes.every(r=>r.missing.length>0 && r.availability==='needs_materials' && !r.recipe.ingredients.some(i=>i.name.includes('西柚汽水'))));
 const row={context:i===2?'none':'grapefruit-beer',text:(await result.output).message,tools,elapsedMs:Date.now()-started};rows.push(row);
 console.log(JSON.stringify({iteration:i+1,recipes:output.recipes.map(r=>r.recipe.name),text:row.text,elapsedMs:row.elapsedMs}));
}
await mkdir('artifacts/evaluations',{recursive:true});
await writeFile('artifacts/evaluations/beer-alternatives.json',JSON.stringify(rows,null,2));
