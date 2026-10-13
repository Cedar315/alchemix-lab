import test from 'node:test';
import assert from 'node:assert/strict';
import { agentUIStream } from './ui-stream';
import { findRecipeCandidates, readRecipe } from './tools';
import { ingredientKey, namedRecipes } from '../agent/workflow-catalog';

function fixture(invalid = false) {
  const output = { message: '金酒与可乐可以试配。', lab: { kind: 'prefill', materials: [{ name: '金酒', source: '金酒', amount: 30 }, { name: '可乐', source: '可乐', amount: 90 }], assumptions: [] } };
  return {
    stream: new ReadableStream({ start(controller) { controller.enqueue({ type: 'start' }); controller.close(); } }),
    partialOutputStream: (async function* () { yield { message: '金酒与可乐' }; yield { message: output.message }; })(),
    get output() { return invalid ? Promise.reject(Error('Invalid provider JSON')) : Promise.resolve(output); },
    toolResults: Promise.resolve([]),
  } as unknown as Parameters<typeof agentUIStream>[0];
}
test('SDK stream sends plain answer and validated action without needing a tool call', async () => {
  let finished = false;
  const reader = agentUIStream(fixture(), 'test-request', ['金酒配可乐'], async (failed) => { assert.equal(failed, false); finished = true; }).getReader();
  const chunks = [];
  while (true) { const { value, done } = await reader.read(); if (done) break; chunks.push(value); }
  assert.equal(chunks.filter(c => c.type === 'text-delta').map(c => c.delta).join(''), '金酒与可乐可以试配。');
  assert.ok(chunks.some(c => c.type === 'data-lab-action'));
  assert.ok(chunks.some(c => c.type === 'start' && c.messageMetadata));
  assert.equal(finished, true);
});
test('invalid model output produces a retryable error and no executable lab action', async () => {
  let failed = false;
  const reader = agentUIStream(fixture(true), 'test-request', ['金酒配可乐'], async value => { failed = value; }).getReader();
  const chunks = [];
  while (true) { const { value, done } = await reader.read(); if (done) break; chunks.push(value); }
  assert.ok(chunks.some(c => c.type === 'error'));
  assert.ok(!chunks.some(c => c.type === 'data-lab-action'));
  assert.equal(failed, true);
});

test('missing mixer offers recipe cards, then Yakult follow-up preserves the original spirit for the lab', async () => {
  const current = namedRecipes('金酒西柚汽水')[0];
  assert.ok(current);
  const original = readRecipe(current.kind, current.id)!;
  const candidates = findRecipeCandidates(['金酒'], null, ['西柚汽水']);
  assert.ok(candidates.recipes.length > 0);
  for (const candidate of candidates.recipes) {
    assert.ok(candidate.recipe.ingredients.every(i => !i.name.includes('西柚汽水')));
    assert.equal(candidate.availability, 'needs_materials');
    assert.ok(candidate.missing.length > 0);
  }

  const turns = [
    { toolName: 'find_recipes', input: { materials: ['金酒'], category: null, excluded: ['西柚汽水'] },
      toolOutput: candidates, output: { message: '先看看这些酒款，卡片列出了还需准备的材料。', lab: { kind: 'none' } } },
    { toolName: 'get_recipe', input: { query: current.nameZh }, toolOutput: { status: 'found', recipes: [original] },
      output: { message: '可以试试金酒搭配养乐多，带入实验室后可调整用量。', lab: { kind: 'prefill', materials: [
        { name: '金酒', source: current.id, amount: null }, { name: '养乐多', source: '养乐多', amount: null },
      ], assumptions: [] } } },
  ];
  for (const [index, turn] of turns.entries()) {
    const toolCallId = `call-${index}`;
    const result = {
      stream: new ReadableStream({ start(controller) {
        controller.enqueue({ type: 'start' });
        controller.enqueue({ type: 'tool-call', toolCallId, toolName: turn.toolName, input: turn.input });
        controller.enqueue({ type: 'tool-result', toolCallId, toolName: turn.toolName, input: turn.input, output: turn.toolOutput });
        controller.close();
      } }),
      partialOutputStream: (async function* () { yield { message: turn.output.message }; })(),
      output: Promise.resolve(turn.output),
      toolResults: Promise.resolve([{ toolName: turn.toolName, output: turn.toolOutput }]),
    } as unknown as Parameters<typeof agentUIStream>[0];
    const reader = agentUIStream(result, `request-${index}`, ['没有西柚汽水了', ...(index ? ['养乐多可以吗'] : [])], async failed => { assert.equal(failed, false); }).getReader();
    const chunks = [];
    while (true) { const { value, done } = await reader.read(); if (done) break; chunks.push(value); }
    assert.ok(chunks.some(c => c.type === 'tool-output-available' && c.toolCallId === toolCallId));
    const action = chunks.find(c => c.type === 'data-lab-action');
    assert.ok(action && action.type === 'data-lab-action');
    assert.deepEqual(action.data, turn.output.lab);
    if (index) assert.deepEqual(turn.output.lab.materials!.map(m => ingredientKey(m.name)).sort(), ['金酒', '养乐多'].map(ingredientKey).sort());
  }
});
