import nextEnv from '@next/env';
import { mkdir, writeFile } from 'node:fs/promises';
nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production');
const { runCompanion, companionPrompt } = await import('../src/lib/agent/companion');
const { companionInput } = await import('../src/lib/agent/companion-contract');
const { companionToolModel } = await import('../src/lib/agent/preparation-provider');
const { recipeContext } = await import('../src/lib/agent/workflow-catalog');
const { ask } = await import('../src/lib/knowledge/rag/runtime');
const { default: prisma } = await import('../src/lib/db/prisma');
const cases = [
    { name: 'named-detail', question: '打开玛格丽特的酒单', expected: 'named' },
    { name: 'lab-exploration', question: '橙汁和伏特加配起来是什么味道？', expected: 'explore' },
    { name: 'two-categories', question: '我有龙舌兰、橙味利口酒、青柠、橙汁，这些材料能做什么酒？', expected: 'recommend' },
    { name: 'missing-current-ingredient', question: '我就想做当前这杯，但是没有橙味利口酒，怎么办？', expected: 'change' },
    { name: 'highball-detail', question: '打开威士忌嗨棒的酒单', expected: 'named' },
    { name: 'paloma-detail', question: '打开帕洛玛的酒单', expected: 'named' },
    { name: 'knowledge', question: '气泡饮料能放进摇酒壶摇吗？', expected: 'knowledge' },
];
const rows = [];
try {
    for (const c of cases) {
        const start = Date.now();
        const result = await runCompanion(companionInput.parse({ version: 2, taskId: crypto.randomUUID(), contextVersion: 0, question: c.question, page: recipeContext('classic', 'margarita'), history: [] }), { model: (state, s) => companionToolModel(companionPrompt, state, s), search: async (q, ctx, s) => (await ask(q, ctx.slice(0, 6000), 3, s)).answer });
        const intent = result.trace.find(t => t.tool === 'recognize_intent')?.status;
        const pass = intent === c.expected && !['unavailable', 'timeout'].includes(result.status) && (c.expected !== 'named' || result.actions.some(a => a.action.kind === 'recipe' && a.action.id === (c.name==='highball-detail'?'whisky-highball':c.name==='paloma-detail'?'paloma':'margarita'))) && (c.expected !== 'explore' || result.actions.some(a => a.action.kind === 'prefill' && a.action.materials.every(m => m.amount === undefined))) && (c.name !== 'two-categories' || result.pending?.kind === 'category') && (c.expected !== 'change' || result.recipes.length === 0) && (c.expected !== 'knowledge' || result.knowledge?.status === 'answered');
        rows.push({ name: c.name, input: c.question, pass, elapsedMs: Date.now() - start, result });
        console.log(JSON.stringify({ name: c.name, intent, status: result.status, pass }));
    }
    await mkdir('artifacts/evaluations', { recursive: true });
    const file = 'artifacts/evaluations/companion-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
    await writeFile(file, JSON.stringify({ at: new Date().toISOString(), implementation: 'companion-v2', note: 'Seven live integration smoke cases, not an independent benchmark or human faithfulness audit.', rows }, null, 2));
    console.log(file);
    if (rows.some(r => !r.pass))
        process.exitCode = 1;
}
finally {
    await prisma.$disconnect();
}
