import env from '@next/env';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import type { ModelMessage } from 'ai';

env.loadEnvConfig(process.cwd());
const { startAgent } = await import('../src/lib/agent-next/runtime');
const { validateLabAction } = await import('../src/lib/agent-next/response');
const { namedRecipes, recipeContext, ingredientKey } = await import('../src/lib/agent/workflow-catalog');
const current = namedRecipes('金酒西柚汽水')[0];
assert.ok(current, 'The screenshot recipe must exist');
const context = JSON.stringify(recipeContext(current.kind, current.id));
const rows = [];

for (let run = 0; run < 3; run++) {
  const messages: ModelMessage[] = [];
  const userStatements: string[] = [];
  for (const question of ['没有西柚汽水了', '养乐多可以吗']) {
    messages.push({ role: 'user', content: question });
    userStatements.push(question);
    const result = startAgent({ messages, userStatements, context, signal: AbortSignal.timeout(45000) });
    for await (const part of result.stream) if (part.type === 'error') throw Error('Provider stream failed');
    const response = await result.output;
    const results = await result.toolResults;
    const recipes = results.filter(t => t.toolName === 'get_recipe').flatMap(t => (t.output as { recipes: { recipeId: string; ingredients: { name: string }[] }[] }).recipes);
    const action = validateLabAction(response.lab, userStatements, recipes);
    if (userStatements.length === 1) {
      const found = results.find(t => t.toolName === 'find_recipes');
      assert.ok(found, 'Missing mixer alone must trigger recipe cards');
      const candidates = (found.output as { recipes: { recipe: { ingredients: { name: string }[] }; missing: string[]; availability: string }[] }).recipes;
      assert.ok(candidates.length > 0);
      for (const candidate of candidates) {
        assert.ok(candidate.recipe.ingredients.some(i => ingredientKey(i.name) === ingredientKey('金酒')));
        assert.ok(candidate.recipe.ingredients.every(i => !i.name.includes('西柚汽水')));
        assert.ok(candidate.missing.length > 0);
        assert.equal(candidate.availability, 'needs_materials');
      }
      assert.equal(action.kind, 'none', 'Choose a drink before offering the lab');
      assert.ok(!results.some(t => t.toolName === 'preview_lab_change'));
    } else {
      assert.equal(action.kind, 'prefill');
      if (action.kind !== 'prefill') throw Error('Missing lab action');
      assert.deepEqual(action.materials.map(m => ingredientKey(m.name)).sort(), ['金酒', '养乐多'].map(ingredientKey).sort());
    }
    messages.push({ role: 'assistant', content: response.message });
    rows.push({ run: run + 1, question, response, action, results });
    console.log(JSON.stringify({ run: run + 1, question, response, action }));
  }
}
await mkdir('artifacts/evaluations', { recursive: true });
await writeFile('artifacts/evaluations/missing-mixer.json', JSON.stringify(rows, null, 2));
