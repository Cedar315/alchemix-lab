import nextEnv from '@next/env';
import { mkdir, writeFile } from 'node:fs/promises';
nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production');
const { withAgentDiagnostics } = await import('../src/lib/agent/diagnostics');
const { runCompanion, companionPrompt } = await import('../src/lib/agent/companion');
const { companionInput } = await import('../src/lib/agent/companion-contract');
const { companionToolModel } = await import('../src/lib/agent/preparation-provider');
const { recipeContext } = await import('../src/lib/agent/workflow-catalog');
const { searchAndCollect, webEvidence } = await import('../src/lib/knowledge/review/search');
const { ask, retrieve } = await import('../src/lib/knowledge/rag/runtime');
const { generate } = await import('../src/lib/knowledge/rag/providers');
const { default: prisma } = await import('../src/lib/db/prisma');
const requestId = crypto.randomUUID();
const events: unknown[] = [];
const original = console.info;
console.info = (...args: unknown[]) => {
  original(...args);
  if (typeof args[0] === 'string') { try { const e = JSON.parse(args[0]); if(e.requestId === requestId) events.push(e); } catch {} }
};
const started = Date.now();
try {
  const result = await withAgentDiagnostics(requestId, () => runCompanion(companionInput.parse({
    version: 2, taskId: crypto.randomUUID(), contextVersion: 0,
    question: process.env.DIAGNOSTIC_QUESTION || '我没有西柚了可以换什么饮料啊', page: recipeContext('convenience', process.env.DIAGNOSTIC_RECIPE || 'grapefruit-beer'), history: [],
  }), {
    model: (state, signal) => companionToolModel(companionPrompt, state, signal),
    search: (q,c,s) => searchAndCollect(q,c.slice(0,6000),s, {
      rag: ask, retrieve, web: webEvidence, generate,
      // Diagnostic replay does not add a duplicate knowledge-review candidate.
      collect: async () => 'diagnostic-skipped',
    }),
  }));
  const file = `artifacts/evaluations/agent-diagnostic-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
  await mkdir('artifacts/evaluations', { recursive: true });
  await writeFile(file, JSON.stringify({ requestId, elapsedMs: Date.now()-started, note: 'Live service replay; no HTTP auth/budget timing; candidate collection skipped.', events, result }, null, 2));
  console.log(file);
} finally { console.info = original; await prisma.$disconnect(); }
