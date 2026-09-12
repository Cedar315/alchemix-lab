import 'server-only';
import prisma from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { datasetVersion, documents, embeddingText, documentSchema, RagError, rankHits, answerFromHits } from './core';
import { embed, embeddingConfig, generate, dimensions } from './providers';

export async function ingest() {
  const config = embeddingConfig();
  // Complete all provider work before the atomic replacement; failures retain the old index.
  const vectors: number[][] = [];
  const usage: unknown[] = [];
  for (let start = 0; start < documents.length; start += 10) {
    const batch = await embed(documents.slice(start, start + 10).map(embeddingText), config);
    vectors.push(...batch.vectors); usage.push(batch.usage);
  }
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(9141201)::text`;
    await tx.$executeRaw`DELETE FROM public.rag_chunks`;
    for (const [i, d] of documents.entries()) {
      await tx.$executeRaw`INSERT INTO public.rag_chunks (id,dataset_version,embedding_profile,document,embedding)
        VALUES (${d.id},${datasetVersion},${config.profile},${JSON.stringify(d)}::jsonb,${JSON.stringify(vectors[i])}::extensions.vector)`;
    }
  }, { timeout: 20000 });
  return { status: 'indexed', count: documents.length, datasetVersion, embeddingModel: config.model, dimensions, usage };
}
export async function retrieve(question: string, topK: number, context = "") {
  const config = embeddingConfig();
  const current = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) AS count FROM public.rag_chunks WHERE dataset_version=${datasetVersion} AND embedding_profile=${config.profile}`;
  if (Number(current[0]?.count ?? 0) !== documents.length) throw new RagError('INDEX_NOT_READY', '知识尚未入库，或知识/向量配置已变更。请先重新入库。', 409);
  const query = await embed([context ? `${question}\n当前配方上下文：${context}` : question], config);
  const rows = await prisma.$queryRaw<Array<{ document: unknown; similarity: number }>>(Prisma.sql`
    SELECT document, 1 - (embedding OPERATOR(extensions.<=>) ${JSON.stringify(query.vectors[0])}::extensions.vector) AS similarity
    FROM public.rag_chunks WHERE dataset_version=${datasetVersion} AND embedding_profile=${config.profile}
    ORDER BY similarity DESC LIMIT 100`);
  const threshold = Number(process.env.RAG_MIN_SIMILARITY ?? '0.5');
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new RagError('NOT_CONFIGURED', 'RAG_MIN_SIMILARITY 必须在 0 到 1 之间');
  const hits = rankHits(question, rows.map(r => ({ document: documentSchema.parse(r.document), semanticScore: Number(r.similarity) })), topK, threshold);
  return { hits, datasetVersion, embeddingModel: config.model, dimensions, threshold, embeddingUsage: query.usage };
}
export async function ask(question: string, context: string, topK: number) {
  const result = await retrieve(question, topK, context);
  return { ...result, answer: await answerFromHits(question, context, result.hits, generate) };
}
