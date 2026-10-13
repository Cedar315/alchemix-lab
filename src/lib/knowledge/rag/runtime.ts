import { diagnostic, timed } from '../../agent/diagnostics';
// Server runtime shared by the administrator route and local maintenance CLI.
import prisma from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { datasetVersion, documents, embeddingText, documentSchema, RagError, rankHits, answerFromHits } from './core';
import { embed, embeddingConfig, generate, dimensions } from './providers';

export async function ingest() {
  const config = embeddingConfig();
  // Complete all provider work before the atomic replacement; failures retain the old index.
  const reviewed = await prisma.$queryRaw<Array<{id:string;document:unknown}>>`SELECT id,document FROM public.rag_chunks WHERE dataset_version='web-reviewed-v1' ORDER BY id`;
  const allDocuments = [...documents,...reviewed.map(r=>documentSchema.parse(r.document))];
  const vectors: number[][] = [];
  const usage: unknown[] = [];
  for (let start = 0; start < allDocuments.length; start += 10) {
    const batch = await embed(allDocuments.slice(start, start + 10).map(embeddingText), config);
    vectors.push(...batch.vectors); usage.push(batch.usage);
  }
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(9141201)::text`;
    const current = await tx.$queryRaw<Array<{id:string;document:unknown}>>`SELECT id,document FROM public.rag_chunks WHERE dataset_version='web-reviewed-v1' ORDER BY id`;
    if(JSON.stringify(current)!==JSON.stringify(reviewed)) throw new RagError('INDEX_CHANGED','审核知识在入库期间发生变化，请重新更新索引。',409);
    await tx.$executeRaw`DELETE FROM public.rag_chunks WHERE dataset_version <> 'web-reviewed-v1'`;
    for (const [i, d] of allDocuments.entries()) {
      if(i>=documents.length) {
        await tx.$executeRaw`UPDATE public.rag_chunks SET embedding_profile=${config.profile},embedding=${JSON.stringify(vectors[i])}::extensions.vector,updated_at=now() WHERE id=${d.id} AND dataset_version='web-reviewed-v1'`;
        continue;
      }
      await tx.$executeRaw`INSERT INTO public.rag_chunks (id,dataset_version,embedding_profile,document,embedding)
        VALUES (${d.id},${datasetVersion},${config.profile},${JSON.stringify(d)}::jsonb,${JSON.stringify(vectors[i])}::extensions.vector)`;
    }
  }, { timeout: 20000 });
  return { status: 'indexed', count: allDocuments.length, seedCount: documents.length, reviewedCount: reviewed.length, datasetVersion, embeddingModel: config.model, dimensions, usage };
}
export async function retrieve(question: string, topK: number, context = "", signal?: AbortSignal) {
  const config = embeddingConfig();
  const current = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) AS count FROM public.rag_chunks WHERE dataset_version=${datasetVersion} AND embedding_profile=${config.profile}`;
  if (Number(current[0]?.count ?? 0) !== documents.length) throw new RagError('INDEX_NOT_READY', '知识尚未入库，或知识/向量配置已变更。请先重新入库。', 409);
  const query = await embed([context ? `${question}\n当前配方上下文：${context}` : question], config, signal);
  const rows = await prisma.$queryRaw<Array<{ document: unknown; similarity: number }>>(Prisma.sql`
    SELECT document, 1 - (embedding OPERATOR(extensions.<=>) ${JSON.stringify(query.vectors[0])}::extensions.vector) AS similarity
    FROM public.rag_chunks WHERE (dataset_version=${datasetVersion} OR dataset_version='web-reviewed-v1') AND embedding_profile=${config.profile}
    ORDER BY similarity DESC LIMIT 100`);
  const threshold = Number(process.env.RAG_MIN_SIMILARITY ?? '0.5');
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new RagError('NOT_CONFIGURED', 'RAG_MIN_SIMILARITY 必须在 0 到 1 之间');
  const hits = rankHits(question, rows.map(r => ({ document: documentSchema.parse(r.document), semanticScore: Number(r.similarity) })), topK, threshold);
  return { hits, datasetVersion, embeddingModel: config.model, dimensions, threshold, embeddingUsage: query.usage };
}
export async function ask(question: string, context: string, topK: number, signal?: AbortSignal) {
  const result = await timed('local_retrieval', () => retrieve(question, topK, context, signal));
  diagnostic('local_hits', { threshold: result.threshold, hits: result.hits.map(h => ({ id: h.document.id, title: h.document.title, excerpt: h.document.answer.slice(0,1200), scope: h.document.scope, datasetVersion, score: h.score, semanticScore: h.semanticScore, keywordScore: h.keywordScore })) });
  return { ...result, answer: await timed('local_answer', () => answerFromHits(question, context, result.hits, (q,c,h) => generate(q,c,h,signal))) };
}
