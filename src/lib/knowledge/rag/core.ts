import { createHash } from 'node:crypto';
import { z } from 'zod';
import seed from '../cocktail-pitfalls.json';

export const documentSchema = z.object({
  id: z.string().min(1), title: z.string().min(1), aliases: z.array(z.string()), category: z.string(),
  answer: z.string().min(1), scope: z.string().min(1), checkedAt: z.string(),
  reviewStatus: z.literal('source_checked_initial'), evidenceType: z.enum(['direct', 'synthesis']),
  sources: z.array(z.object({ title: z.string(), url: z.string().url().refine(s => s.startsWith('https://')) })).min(1),
});
export type KnowledgeDocument = z.infer<typeof documentSchema>;
export const documents = z.array(documentSchema).parse(seed.entries);
if (new Set(documents.map(d => d.id)).size !== documents.length) throw new Error('Duplicate knowledge IDs');
export const datasetVersion = createHash('sha256').update(JSON.stringify(documents)).digest('hex');
export function embeddingText(d: KnowledgeDocument) {
  return `${d.title}\n${d.aliases.join('；')}\n${d.category}\n${d.answer}\n适用边界：${d.scope}`;
}
export class RagError extends Error {
  constructor(public code: string, message: string, public status = 503) { super(message); }
}
export const inputSchema = z.object({
  action: z.enum(['retrieve', 'ask', 'ingest']),
  question: z.string().trim().min(1).max(1000).optional(),
  context: z.string().trim().max(2000).default(''),
  topK: z.number().int().min(1).max(5).default(3),
}).strict().superRefine((v, ctx) => { if (v.action !== 'ingest' && !v.question) ctx.addIssue({ code: 'custom', path: ['question'], message: '请输入问题' }); });
export type Hit = { document: KnowledgeDocument; semanticScore: number; keywordScore: number; score: number };
export function applicableHits(hits: Hit[], context: string): Hit[] {
  try {
    const consultation = JSON.parse(context)?.consultation;
    if (consultation?.kind !== 'troubleshoot' || typeof consultation.actualMaterials !== 'string' || typeof consultation.question !== 'string') return hits;
    const dairyFault = /牛奶|酸奶|养乐多|乳饮/.test(consultation.actualMaterials)
      && /分层|絮|结块|凝结/.test(consultation.question);
    const intendedLayers = /分层(?:鸡尾)?酒|分层配方|彩虹酒|想.*分层|做.*分层/.test(consultation.question);
    // This seed's scope is deliberately layered recipes. It cannot explain
    // unexpected separation in a dairy mixture merely because both say 分层.
    return dairyFault && !intendedLayers ? hits.filter(h => h.document.id !== 'layer-failure') : hits;
  } catch { return hits; }
}
const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '').replace(/君度酒/g, '君度');
export function keywordScore(question: string, d: KnowledgeDocument): number {
  const query = normalize(question);
  if ([d.title, ...d.aliases].some(s => normalize(s).length >= 2 && query.includes(normalize(s)))) return 1;
  // In conversational queries, a material and its symptom often occur in
  // separate clauses (e.g. 分层了…用了牛奶). Both alias parts must occur;
  // this weaker match still requires the normal semantic threshold.
  const separatedAlias = d.aliases.some(alias => {
    const text = normalize(alias);
    if (!/^[\u4e00-\u9fff]{4,8}$/.test(text)) return false;
    for (let split = 2; split <= text.length - 2; split++) {
      if (query.includes(text.slice(0, split)) && query.includes(text.slice(split))) return true;
    }
    return false;
  });
  return separatedAlias ? 0.5 : 0;
}
export function rankHits(question: string, rows: Array<{ document: KnowledgeDocument; semanticScore: number }>, topK: number, threshold: number): Hit[] {
  return rows.map(row => {
    const keyword = keywordScore(question, row.document);
    return { ...row, keywordScore: keyword, score: row.semanticScore * 0.85 + keyword * 0.15 };
  }).filter(h => h.semanticScore >= threshold || h.keywordScore === 1)
    .sort((a, b) => b.score - a.score).slice(0, topK);
}
const generatedSchema = z.object({
  status: z.enum(['answered', 'insufficient_evidence']),
  claims: z.array(z.object({ text: z.string().trim().min(1).max(1500), evidenceIds: z.array(z.string()).min(1).max(5) }).strict()).max(6),
}).strict();
export function validateAnswer(value: unknown, hits: Hit[]) {
  const parsed = generatedSchema.safeParse(value);
  if (!parsed.success) throw new RagError('INVALID_MODEL_OUTPUT', '模型返回格式不符合要求', 502);
  const answer = parsed.data;
  if (answer.status === 'insufficient_evidence') return { status: answer.status, claims: [], citations: [] };
  if (!answer.claims.length) throw new RagError('INVALID_MODEL_OUTPUT', '回答缺少证据', 502);
  const byId = new Map(hits.map(h => [h.document.id, h.document]));
  const ids = [...new Set(answer.claims.flatMap(c => c.evidenceIds))];
  if (ids.some(id => !byId.has(id))) throw new RagError('INVALID_CITATION', '回答引用了未检索到的资料', 502);
  if (answer.claims.some(c => /https?:\/\/|www\./i.test(c.text))) throw new RagError('INVALID_CITATION', '回答中包含未经校验的链接', 502);
  for (const claim of answer.claims) {
    const mechanisms = claim.evidenceIds.map(id => byId.get(id)!).filter(source => /可能/.test(source.answer) && /原因|机制|不能.*确定/.test(source.scope));
    const causal = /导致|造成|引起|原因是|因为|使.+(?:聚集|凝|结)|形成絮/.test(claim.text);
    if (mechanisms.length && causal) {
      if (/肯定|必然|一定是|确定是/.test(claim.text)) throw new RagError('INVALID_MODEL_OUTPUT', '回答把可能机制说成确定原因', 502);
      // For uncertain causal explanations, retain the source mechanism and its
      // entire scope instead of allowing extra diagnoses or repair promises.
      claim.text = mechanisms.map(source => `${source.answer.split('。')[0]}。${source.scope}`).join('\n');
      claim.evidenceIds = mechanisms.map(source => source.id);
    }
  }
  return { ...answer, citations: [...new Set(answer.claims.flatMap(c => c.evidenceIds))].map(id => ({ id, title: byId.get(id)!.title, sources: byId.get(id)!.sources })) };
}
export type Generator = (question: string, context: string, hits: Hit[]) => Promise<{ value: unknown; usage: unknown; model: string }>;
export async function answerFromHits(question: string, context: string, hits: Hit[], generate: Generator) {
  if (!hits.length) return { status: 'no_evidence', claims: [], citations: [], message: '知识库暂时没有足够相关的资料。请补充配方、材料或具体问题。', model: null, usage: null };
  const generated = await generate(question, context, hits);
  return { ...validateAnswer(generated.value, hits), model: generated.model, usage: generated.usage };
}
