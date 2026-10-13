import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCurrentAgent } from './evaluate-agent';

const input = { id: 'test', question: '金酒可以吗？', context: '当前在实验室', history: [{ role: 'user' as const, content: '我有可乐' }], signal: new AbortController().signal };
type Runner = NonNullable<Parameters<typeof evaluateCurrentAgent>[1]>;
function fixture(invalid = false): ReturnType<Runner> {
  const output = { message: '可以试配。', lab: { kind: 'prefill', materials: [
    { name: '金酒', source: '金酒', amount: 30 },
    { name: '牛奶', source: '牛奶', amount: 90 },
  ], assumptions: [] } };
  return {
    stream: new ReadableStream({ start(c) { c.enqueue({ type: 'start' }); c.close(); } }),
    partialOutputStream: (async function* () { yield { message: output.message }; })(),
    get output() { return invalid ? Promise.reject(Error('invalid output')) : Promise.resolve(output); },
    toolResults: Promise.resolve([]),
    steps: Promise.resolve([{ reasoning: 'private', toolResults: [{ toolName: 'search_knowledge', input: { query: '金酒' }, output: { status: 'empty' } }] }]),
    usage: Promise.resolve({ totalTokens: 100 }),
  } as unknown as ReturnType<Runner>;
}
test('current Agent evaluation forwards context/history, validates actions and saves only tool evidence', async () => {
  const row = await evaluateCurrentAgent(input, options => {
    assert.equal(options.context, input.context);
    assert.deepEqual(options.userStatements, ['我有可乐', '金酒可以吗？']);
    assert.equal(options.messages.length, 2);
    return fixture();
  });
  assert.equal(row.runtime, 'agent-next');
  assert.equal(row.status, 'answered');
  assert.equal(row.message, '可以试配。');
  assert.equal(row.lab.kind, 'prefill');
  if (row.lab.kind === 'prefill') assert.deepEqual(row.lab.materials.map(m => m.name), ['金酒']);
  assert.equal(row.tools[0].tool, 'search_knowledge');
  assert.ok(!JSON.stringify(row).includes('private'));
});
test('invalid model output fails evaluation rather than recording an answered result', async () => {
  await assert.rejects(evaluateCurrentAgent(input, () => fixture(true)), /Agent evaluation failed/);
});
test('aborted evaluations cannot be recorded as answered', async () => {
  await assert.rejects(evaluateCurrentAgent({ ...input, signal: AbortSignal.abort() }, () => fixture()));
});
