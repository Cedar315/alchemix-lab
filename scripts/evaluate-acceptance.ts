import nextEnv from '@next/env';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { acceptanceCases, type AcceptanceTurn } from './fixtures/companion-acceptance';
import type { CompanionInput, CompanionResult } from '../src/lib/agent/companion-contract';
import type { Hit } from '../src/lib/knowledge/rag/core';
nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production');
const { runCompanion, companionPrompt } = await import('../src/lib/agent/companion');
const { companionInput, companionOutput } = await import('../src/lib/agent/companion-contract');
const { companionToolModel } = await import('../src/lib/agent/preparation-provider');
const { recipeContext } = await import('../src/lib/agent/workflow-catalog');
const { withAgentDiagnostics } = await import('../src/lib/agent/diagnostics');
const { searchAndCollect, webEvidence } = await import('../src/lib/knowledge/review/search');
const { ask, retrieve } = await import('../src/lib/knowledge/rag/runtime');
const { generate, embeddingConfig } = await import('../src/lib/knowledge/rag/providers');
const { documents, datasetVersion, RagError } = await import('../src/lib/knowledge/rag/core');
const { default: prisma } = await import('../src/lib/db/prisma');
const selected = process.argv.slice(2);
if (selected.some(id => !acceptanceCases.some(c => c.id === id))) throw Error('Use case IDs A01 through A26');
const cases = selected.length ? acceptanceCases.filter(c => selected.includes(c.id)) : acceptanceCases;
type Failure = { category: string; reason: string };
type Retrieval = { question: string; hits: Hit[] };
const errorCode = (error: unknown) => error instanceof RagError ? `${error.code}: ${error.message}`
    : error instanceof Error && /^[A-Z][A-Z_]+$/.test(error.message) ? error.message : 'SERVICE_ERROR';
function check(t: AcceptanceTurn, r: CompanionResult, searches: string[], retrievals: Retrieval[]): Failure[] {
    const failures: Failure[] = [];
    const fail = (category: string, reason: string) => failures.push({ category, reason });
    if (!companionOutput.safeParse(r).success) fail('contract', '输出不符合助手协议');
    if (['timeout', 'unavailable'].includes(r.status) || r.trace.some(t => t.status === 'error')) { fail('service', r.status === 'answered' ? '业务结果已保留，但知识查询失败' : r.status); return failures; }
    const text = [r.message, r.clarification, ...r.knowledge?.claims.map(c => c.text) ?? []].join('\n');
    if (t.outcome === 'clarify' && (r.status !== 'needs_info' || !r.clarification)) fail('routing_context', '必要追问缺失');
    if (t.clarification && !r.clarification.includes(t.clarification)) fail('routing_context', '追问对象不符合当前缺失事实');
    if (t.outcome === 'answer' && !r.knowledge?.claims.length) {
        const expectedInSeed = t.evidence?.some(id => documents.some(d => d.id === id));
        const expectedRetrieved = retrievals.some(item => item.hits.some(h => t.evidence?.includes(h.document.id)));
        fail(!searches.length ? 'routing_context' : expectedInSeed && !expectedRetrieved ? 'retrieval' : expectedRetrieved ? 'generation' : 'knowledge_gap', '未回答知识问题');
    }
    if (t.outcome === 'limited' && r.knowledge?.claims.length) {
        // Limitations can be supported answers; semantic assessment stays explicitly pending.
        if (!/不能|无法|不足|不确定|不等|不同|不保证|不能保证|没有.*(?:依据|资料)/.test(text)) fail('grounding', '缺少知识限制说明');
    }
    if (t.outcome === 'limited' && !r.knowledge) fail('routing_context', '明确的知识边界问题未检索，也未说明证据限制');
    if (t.outcome === 'action' && !r.actions.length && !r.recipes.length) fail('routing_context', '缺少业务操作结果');
    if (t.outcome === 'cancel' && (r.status !== 'cancelled' || r.pending)) fail('routing_context', '取消后仍保留任务');
    if (t.outcome === 'out_of_scope' && r.status !== 'out_of_scope') fail('routing_context', '未拒绝超出职责请求');
    if (t.noSearch && searches.length) fail('routing_context', '不需要知识检索的任务触发了检索');
    if (t.action && !r.actions.some(({ action: a }) => [a.kind, a.kind === 'recipe' ? `${a.kind}:${a.id}` : a.kind === 'locate' ? `${a.kind}:${a.target}` : ''].includes(t.action!))) fail('routing_context', '缺少预期操作 ' + t.action);
    if (t.queryIncludes?.some(s => !searches.some(q => q.includes(s)))) fail('routing_context', '检索问题遗漏已确认事实');
    if (t.evidence && r.knowledge?.claims.length && !r.knowledge.citations.some(c => t.evidence!.includes(c.id))) fail('evidence_review', '未引用预期本地条目；需核对替代来源');
    if (t.forbidden && new RegExp(t.forbidden, 'i').test(text)) fail('grounding', '命中场景禁止的确定性或无关结论');
    if (r.knowledge?.citations.some(c => t.forbiddenEvidence?.includes(c.id))) fail('grounding', '用不适用的材料或配方条目支持当前结论');
    if (t.requireUncertainty && r.knowledge?.claims.some(c => /导致|造成|引起|原因|使.+(?:聚集|凝|结)|形成絮/.test(c.text) && !/可能|或许|也许|无法确定|不能确定|不一定/.test(c.text))) fail('grounding', '可能机制被写成确定因果');
    if (t.question.includes('我有伏特加和橙汁') && r.recipes.some(c => /苏打/.test(c.name) && !c.missing.length)) fail('routing_context', '把知识问题中提及的苏打水当成库存');
    for (const claim of r.knowledge?.claims ?? []) if (!claim.evidenceIds.length || claim.evidenceIds.some(id => !r.knowledge?.citations.some(c => c.id === id))) fail('grounding', '引用不合法');
    return failures;
}
const started = new Date().toISOString();
const file = `artifacts/evaluations/acceptance-${started.replace(/[:.]/g, '-')}.json`;
const rows: unknown[] = [];
const originalInfo = console.info;
let events: unknown[] = [];
console.info = (...args: unknown[]) => { if (typeof args[0] === 'string') { try { events.push(JSON.parse(args[0])); } catch {} } };
const metadata = { started, completed: false, caseVersion: createHash('sha256').update(JSON.stringify(acceptanceCases)).digest('hex'), datasetVersion, cases: cases.length,
    note: 'Authored realistic scenarios; live Agent routing, retrieval, generation and web fallback. No HTTP authentication/budget/UI coverage. Candidate collection skipped to avoid publishing test traffic. Automatic checks are not a semantic faithfulness audit; humanReview remains pending.',
    model: process.env.MINIMAX_MODEL, embeddingModel: embeddingConfig().model, rows };
await mkdir('artifacts/evaluations', { recursive: true });
try {
    for (const c of cases) {
        let pending: CompanionInput['pending'] = null;
        const history: CompanionInput['history'] = [];
        const taskId = crypto.randomUUID();
        const page = recipeContext(...(c.page ?? ['classic', 'margarita']));
        for (const [turn, expectation] of c.turns.entries()) {
            const input = companionInput.parse({ version: 2, taskId, contextVersion: 0, page, history: history.slice(-12), pending, question: expectation.question });
            const searches: string[] = [], retrievals: Retrieval[] = [], generations: unknown[] = [], errors: string[] = [];
            events = [];
            const start = Date.now();
            const result = await withAgentDiagnostics(crypto.randomUUID(), () => runCompanion(input, {
                model: async (state, signal) => {
                    try { return await companionToolModel(companionPrompt, state, signal); }
                    catch (error) { errors.push(errorCode(error)); throw error; }
                },
                search: async (q, context, signal) => {
                    searches.push(q);
                    try { return await searchAndCollect(q, context.slice(0, 6000), signal, {
                        rag: ask,
                        retrieve: async (...args) => { const value = await retrieve(...args); retrievals.push({ question: args[0], hits: value.hits }); return value; },
                        web: webEvidence,
                        generate: async (...args) => { const value = await generate(...args); generations.push({ question: args[0], evidence: args[2], output: value.value, review: value.review }); return value; },
                        collect: async () => 'acceptance-skipped',
                    }); } catch (error) { errors.push(errorCode(error)); throw error; }
                },
            }, AbortSignal.timeout(45000)));
            const failures = check(expectation, result, searches, retrievals);
            const row = { id: c.id, topic: c.topic, turn: turn + 1, input, expectation, pass: !failures.length, failures, elapsedMs: Date.now() - start, searches, retrievals, generations, errors, events, result, humanReview: { faithful: null, useful: null, notes: '' } };
            rows.push(row);
            await writeFile(file, JSON.stringify(metadata, null, 2));
            console.log(JSON.stringify({ id: c.id, turn: turn + 1, pass: row.pass, status: result.status, failures, elapsedMs: row.elapsedMs }));
            pending = result.pending;
            history.push({ role: 'user', content: expectation.question }, { role: 'assistant', content: [result.message, result.clarification, ...result.knowledge?.claims.map(c => c.text) ?? []].filter(Boolean).join('\n').slice(0, 2000) });
        }
    }
    metadata.completed = true;
    const scored = rows as { id: string; pass: boolean; elapsedMs: number; failures: Failure[] }[];
    const elapsed = scored.map(r => r.elapsedMs).sort((a, b) => a - b);
    const summary = {
        turns: scored.length, passedTurns: scored.filter(r => r.pass).length,
        scenarios: cases.length, passedScenarios: cases.filter(c => scored.filter(r => r.id === c.id).every(r => r.pass)).length,
        p50Ms: elapsed[Math.ceil(elapsed.length * 0.5) - 1], p95Ms: elapsed[Math.ceil(elapsed.length * 0.95) - 1],
        failures: scored.filter(r => !r.pass).map(r => ({ id: r.id, failures: r.failures })),
    };
    await writeFile(file, JSON.stringify({ ...metadata, summary }, null, 2));
    console.log(JSON.stringify(summary));
    if (scored.some(r => !r.pass)) process.exitCode = 1;
} finally { console.info = originalInfo; await prisma.$disconnect(); console.log(file); }
