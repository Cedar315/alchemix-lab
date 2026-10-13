import env from '@next/env';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import type { ModelMessage } from 'ai';
env.loadEnvConfig(process.cwd());
const { startAgent } = await import('../src/lib/agent-next/runtime');
const { validateLabAction } = await import('../src/lib/agent-next/response');
const { namedRecipes, recipeContext } = await import('../src/lib/agent/workflow-catalog');
const current = namedRecipes('啤酒柠檬茶')[0];
assert.ok(current);
const context = JSON.stringify(recipeContext(current.kind, current.id));
const messages: ModelMessage[] = [];
const userStatements: string[] = [];
const rows = [];
for (const question of ['我柠檬汁和啤酒做会是什么味道', '还有蜂蜜，没有别的材料了', '换成金酒和可乐，按1比3试试', '说错了，没有可乐，用苏打水代替，金酒不变', '取消，不试了']) {
  userStatements.push(question);
  messages.push({ role: 'user', content: question });
  const result = startAgent({ messages, context, userStatements, signal: AbortSignal.timeout(45000) });
  for await (const part of result.stream) if (part.type === 'error') throw Error('Provider stream failed');
  const response = await result.output;
  const text = response.message;
  const tools = await result.toolResults;
  const action = validateLabAction(response.lab, userStatements);
  const expected: string[] | undefined = [['啤酒', '柠檬汁'], ['啤酒', '柠檬汁', '蜂蜜'], ['金酒', '可乐'], ['金酒', '苏打水']][rows.length];
  if (expected) {
    assert.equal(action.kind, 'prefill');
    if (action.kind !== 'prefill') throw Error('Missing material action');
    assert.deepEqual(action.materials.map(m => m.name).sort(), expected.sort());
    if (rows.length === 2) assert.equal(action.materials.find(m => m.name === '可乐')!.amount! / action.materials.find(m => m.name === '金酒')!.amount!, 3);
  } else assert.equal(action.kind, 'none');
  messages.push({ role: 'assistant', content: text });
  rows.push({ question, text, tools, action });
  console.log(JSON.stringify(rows.at(-1)));
}
await mkdir('artifacts/evaluations', { recursive: true });
await writeFile('artifacts/evaluations/flavor-followup.json', JSON.stringify(rows, null, 2));
