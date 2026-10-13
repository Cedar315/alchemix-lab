import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAdjustment, readRecipe, createAgentTools, findRecipeCandidates, previewSchema } from './tools';
import { buildReferenceExperiment } from '../mixology/reference-experiment';

test('material-only previews use catalogue defaults while preserving explicitly chosen volumes', () => {
  const preview = previewSchema.parse({ materials: [{ name: '啤酒' }, { name: '柠檬汁', amount: 10 }, { name: '待识别材料' }], assumptions: [] });
  const result = buildReferenceExperiment(preview.materials, name => name === '待识别材料' ? undefined : ({ id: name, name, category: '测试', color: '', amount: 0, recommendedAmount: name === '啤酒' ? 180 : 15 }));
  assert.deepEqual(result.ingredients.map(i => [i.name, i.amount]), [['啤酒', 180], ['柠檬汁', 10]]);
  assert.deepEqual(result.unresolved, [{ name: '待识别材料' }]);
  assert.equal(previewSchema.safeParse({ materials: [{ name: '啤酒', amount: 0 }], assumptions: [] }).success, false);
});

const measurement = (value: number | null, quote: string, certainty: 'exact' | 'estimated' | 'unknown' = 'exact') => ({ value, quote, certainty });
test('unknown actual volume cannot become an exact calculation', () => {
  const result = calculateAdjustment({ currentMl: measurement(null, '', 'unknown'), additionMl: measurement(30, '加30'), capacityMl: measurement(300, '杯子300') }, ['加30，杯子300']);
  assert.equal(result.status, 'needs_input');
});
test('invented quotations and numbers are rejected', () => {
  const result = calculateAdjustment({ currentMl: measurement(200, '已有100'), additionMl: measurement(30, '加30'), capacityMl: measurement(300, '杯子300') }, ['已有100，加30，杯子300']);
  assert.equal(result.status, 'needs_input');
});
test('estimates remain estimates and overflow is deterministic', () => {
  const result = calculateAdjustment({ currentMl: measurement(280, '大概280', 'estimated'), additionMl: measurement(30, '加30'), capacityMl: measurement(300, '杯子300') }, ['大概280，加30，杯子300']);
  assert.equal(result.totalMl, 310);
  assert.equal(result.exceedsCapacity, true);
  assert.equal(result.estimated, true);
});
test('a smaller number cannot be justified by a substring of another quantity', () => {
  const result = calculateAdjustment({ currentMl: measurement(20, '已有120'), additionMl: measurement(30, '加30'), capacityMl: measurement(300, '杯子300') }, ['已有120，加30，杯子300']);
  assert.equal(result.status, 'needs_input');
});
test('recipe identity comes from the existing catalogue', () => {
  assert.equal(readRecipe('classic', 'margarita')?.recipeId, 'margarita');
  assert.equal(readRecipe('classic', 'invented-recipe-id'), null);
});
test('prototype exposes only the six authorized tools', () => {
  assert.deepEqual(Object.keys(createAgentTools({ context: '', userStatements: [], signal: new AbortController().signal })).sort(), ['get_recipe', 'find_recipes', 'search_knowledge', 'search_web', 'calculate_adjustment', 'preview_lab_change'].sort());
});
test('one known beer ingredient yields real alternatives without the unavailable mixer', () => {
  const result = findRecipeCandidates(['啤酒'], null, ['西柚汽水']);
  assert.equal(result.recipes.length, 3);
  for (const item of result.recipes) {
    assert.ok(item.recipe.ingredients.some(i => i.name === '啤酒'));
    assert.ok(item.recipe.ingredients.every(i => !i.name.includes('西柚汽水')));
    assert.ok(item.missing.length > 0);
    assert.equal(item.availability, 'needs_materials');
    assert.ok(readRecipe(item.recipe.kind as 'classic' | 'convenience', item.recipe.recipeId!));
  }
});
test('confirmed matching materials rank first and corrections remove unavailable ingredients', () => {
  const result = findRecipeCandidates(['啤酒', '番茄汁'], null, ['西柚汽水']);
  assert.equal(result.recipes[0].availability, 'materials_matched');
  assert.deepEqual(result.recipes[0].missing, []);
  const corrected = findRecipeCandidates(['啤酒', '番茄汁'], null, ['番茄汁']);
  assert.ok(corrected.recipes.every(r => r.recipe.ingredients.every(i => !i.name.includes('番茄汁'))));
});
test('unknown material and explicit category constraints do not invent or backfill recipes', () => {
  assert.equal(findRecipeCandidates(['不存在的材料'], null, []).recipes.length, 0);
  assert.ok(findRecipeCandidates(['啤酒'], 'classic', ['西柚汽水']).recipes.every(r => r.recipe.kind === 'classic'));
  assert.equal(findRecipeCandidates(['啤酒'], null, ['啤酒']).recipes.length, 0);
});
