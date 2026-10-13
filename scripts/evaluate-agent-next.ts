import nextEnv from '@next/env';
import { mkdir, writeFile } from 'node:fs/promises';
import type { ModelMessage } from 'ai';
nextEnv.loadEnvConfig(process.cwd());
const { startAgent } = await import('../src/lib/agent-next/runtime');
const { runCompanion, companionPrompt } = await import('../src/lib/agent/companion');
const { companionToolModel, modelJSON } = await import('../src/lib/agent/preparation-provider');
const { searchAndCollect } = await import('../src/lib/knowledge/review/search');
const { recipeContext } = await import('../src/lib/agent/workflow-catalog');
const cases = [
  { id: 'find-real-recipe', turns: ['我有金酒和汤力水，想找一杯真实配方。', '有冰和量杯，就按第一杯给我步骤。'] },
  { id: 'compare-substitutions', turns: ['我在做玛格丽特，没有君度，手边有橙汁和蜂蜜，比较一下怎么选。', '我选橙汁，还没开始倒，给我一个试做建议。'] },
  { id: 'correct-while-making', turns: ['我这杯太甜了，而且杯子快满了。', '我加了烧酒60ml、雪碧120ml，杯子容量300ml，冰块大概占一半。', '更正，烧酒实际是30ml，不是60ml。现在不想加更多液体。'] },
];
const rows: unknown[] = [];
for (const scenario of cases) {
  const page = scenario.id === 'compare-substitutions' ? recipeContext('classic', 'margarita') : { kind: 'lab' as const, name: '试验对话', ingredients: [] };
  const messages: ModelMessage[] = [], statements: string[] = [];
  for (const question of scenario.turns) {
    messages.push({ role: 'user', content: question }); statements.push(question);
    const started = Date.now(); let firstTokenMs: number | null = null;
    try {
      const result = startAgent({ messages, context: JSON.stringify(page), userStatements: statements, signal: AbortSignal.timeout(45000) });
      let streamError = false;
      for await (const part of result.stream) {
        if (part.type === 'text-delta' && firstTokenMs === null) firstTokenMs = Date.now() - started;
        if (part.type === 'error') streamError = true;
      }
      const text = (await result.output).message;
      const row = { engine: 'next', case: scenario.id, question, status: streamError ? 'error' : 'completed', text, elapsedMs: Date.now() - started, firstTokenMs, usage: await result.usage, tools: await result.toolResults };
      rows.push(row); console.log(JSON.stringify({ ...row, tools: row.tools.map(t => t.toolName), usage: undefined }));
      // Match the HTTP prototype's untrusted-history policy: retain conversational text, re-fetch evidence.
      if (text) messages.push({ role: 'assistant', content: text });
    } catch (e) { rows.push({ engine: 'next', case: scenario.id, question, status: 'error', error: e instanceof Error ? e.name : 'Unknown', elapsedMs: Date.now() - started }); }
  }
  if (process.argv.includes('--compare')) {
    const taskId = crypto.randomUUID(); const history: { role: 'user' | 'assistant'; content: string }[] = [];
    let pending: Parameters<typeof runCompanion>[0]['pending'] = null;
    for (const question of scenario.turns) {
      const started = Date.now();
      const result = await runCompanion({ version: 2, taskId, contextVersion: 0, question, page, history, pending }, { model: (state, signal) => companionToolModel(companionPrompt, state, signal), followup: modelJSON, reviewRescue: modelJSON, search: (q, c, s) => searchAndCollect(q, c, s) }, AbortSignal.timeout(45000));
      rows.push({ engine: 'legacy', case: scenario.id, question, elapsedMs: Date.now() - started, result });
      pending = result.pending;
      const content = [result.message, result.clarification, ...(result.knowledge?.claims.map(c => c.text) || [])].filter(Boolean).join('\n');
      history.push({ role: 'user', content: question }, { role: 'assistant', content: content.slice(0, 2000) });
      console.log(JSON.stringify({ engine: 'legacy', case: scenario.id, status: result.status, text: content, elapsedMs: Date.now() - started }));
    }
  }
}
await mkdir('artifacts/evaluations', { recursive: true });
const path = `artifacts/evaluations/agent-next-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
await writeFile(path, JSON.stringify({ createdAt: new Date().toISOString(), model: process.env.DEEPSEEK_MODEL || 'deepseek-flash', cases, rows, review: '人工按任务推进、重复追问、事实正确性和耗时评估；不按固定措辞打分。' }, null, 2));
console.log(path);
if (rows.some(r => (r as { status?: string }).status === 'error')) process.exitCode = 1;
