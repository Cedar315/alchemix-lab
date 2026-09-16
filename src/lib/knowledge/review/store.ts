import { createHash } from 'node:crypto';
import prisma from '@/lib/db/prisma';
import { documentSchema, embeddingText, RagError, documents } from '../rag/core';
import { embed, embeddingConfig } from '../rag/providers';
import { draftSchema, normalizedQuestion, redact, type Candidate, type Draft, reviewInput } from './contract';
import type { z } from 'zod';
export const REVIEWED_VERSION='web-reviewed-v1';
export async function collect(question:string,recipeName:string,draft:Draft,evidence:Candidate['evidence'],reason:string) {
  const fingerprint=createHash('sha256').update(normalizedQuestion(recipeName)+'|'+normalizedQuestion(question)).digest('hex');
  const id='web-'+fingerprint.slice(0,32),status=draft.answer?'pending':'gap';
  await prisma.$executeRaw`INSERT INTO public.knowledge_candidates(id,fingerprint,question,recipe_name,status,draft,evidence,reason)
    VALUES (${id},${fingerprint},${redact(question)},${redact(recipeName)},${status},${JSON.stringify(draftSchema.parse(draft))}::jsonb,${JSON.stringify(evidence)}::jsonb,${reason})
    ON CONFLICT(fingerprint) DO UPDATE SET occurrences=knowledge_candidates.occurrences+1,updated_at=now(),
      draft=CASE WHEN knowledge_candidates.status='gap' AND knowledge_candidates.revision=1 AND EXCLUDED.status='pending' THEN EXCLUDED.draft ELSE knowledge_candidates.draft END,
      evidence=CASE WHEN knowledge_candidates.status='gap' AND knowledge_candidates.revision=1 AND EXCLUDED.status='pending' THEN EXCLUDED.evidence ELSE knowledge_candidates.evidence END,
      reason=CASE WHEN knowledge_candidates.status='gap' AND knowledge_candidates.revision=1 AND EXCLUDED.status='pending' THEN EXCLUDED.reason ELSE knowledge_candidates.reason END,
      revision=CASE WHEN knowledge_candidates.status='gap' AND knowledge_candidates.revision=1 AND EXCLUDED.status='pending' THEN 2 ELSE knowledge_candidates.revision END,
      status=CASE WHEN knowledge_candidates.status='gap' AND knowledge_candidates.revision=1 AND EXCLUDED.status='pending' THEN 'pending' ELSE knowledge_candidates.status END`;
  return id;
}
export async function listCandidates() {
  return prisma.$queryRaw<Candidate[]>`SELECT * FROM public.knowledge_candidates ORDER BY updated_at DESC LIMIT 100`;
}
export async function reviewCandidate(input:z.infer<typeof reviewInput>,actorId:string) {
  const rows=await prisma.$queryRaw<Candidate[]>`SELECT * FROM public.knowledge_candidates WHERE id=${input.id}`;
  const row=rows[0]; if(!row) throw new RagError('NOT_FOUND','条目不存在',404);
  if(row.revision!==input.revision) throw new RagError('CONFLICT','条目已更新，请刷新后审核。',409);
  if(row.status==='merged') throw new RagError('CONFLICT','此记录已合并，请编辑合并目标。',409);
  if(input.action==='unpublish'&&row.status!=='published') throw new RagError('CONFLICT','只有已发布知识可以撤回。',409);
  const draft=draftSchema.parse(input.draft??row.draft);
  let prepared: {document:unknown;vector:number[];profile:string}|null=null;
  if(input.action==='publish') {
    if(!draft.answer.trim()||!draft.scope.trim()||!draft.sources.length||!input.note) throw new RagError('REVIEW_REQUIRED','发布前请补全答案、适用限制、来源及核实说明。',400);
    const document=documentSchema.parse({...draft,id:input.id,checkedAt:new Date().toISOString().slice(0,10),reviewStatus:'source_checked_initial',evidenceType:'synthesis'});
    const config=embeddingConfig(),{vectors}=await embed([embeddingText(document)],config);
    prepared={document,vector:vectors[0],profile:config.profile};
  }
  await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(9141201)::text`;
    const locked=await tx.$queryRaw<Candidate[]>`SELECT * FROM public.knowledge_candidates WHERE id=${input.id} FOR UPDATE`;
    if(locked[0]?.revision!==input.revision) throw new RagError('CONFLICT','条目已被其他审核操作更新。',409);
    if(input.action==='save'&&row.status==='published') throw new RagError('CONFLICT','已发布条目的修改请重新审核发布，或先撤回。',409);
    let status=input.action==='publish'?'published':input.action==='reject'?'rejected':input.action==='unpublish'?'pending':input.action==='merge'?'merged':draft.answer.trim()?'pending':'gap';
    if(input.action==='merge') {
      if(!input.mergeTarget||input.mergeTarget===row.id) throw new RagError('INVALID_TARGET','请选择另一条已发布知识作为合并目标。',400);
      const targets=await tx.$queryRaw<Candidate[]>`SELECT * FROM public.knowledge_candidates WHERE id=${input.mergeTarget} AND status='published' FOR UPDATE`;
      if(!targets.length) throw new RagError('INVALID_TARGET','合并目标必须是已发布条目。',400);
      await tx.$executeRaw`UPDATE public.knowledge_candidates SET occurrences=occurrences+${row.occurrences},revision=revision+1,updated_at=now() WHERE id=${input.mergeTarget}`;
    }
    if(prepared) {
      await tx.$executeRaw`INSERT INTO public.rag_chunks(id,dataset_version,embedding_profile,document,embedding) VALUES (${row.id},${REVIEWED_VERSION},${prepared.profile},${JSON.stringify(prepared.document)}::jsonb,${JSON.stringify(prepared.vector)}::extensions.vector)
      ON CONFLICT(id) DO UPDATE SET dataset_version=EXCLUDED.dataset_version,embedding_profile=EXCLUDED.embedding_profile,document=EXCLUDED.document,embedding=EXCLUDED.embedding,updated_at=now()`;
    } else if(['reject','unpublish','merge'].includes(input.action)) await tx.$executeRaw`DELETE FROM public.rag_chunks WHERE id=${row.id} AND dataset_version=${REVIEWED_VERSION}`;
    await tx.$executeRaw`UPDATE public.knowledge_candidates SET draft=${JSON.stringify(draft)}::jsonb,status=${status},reason=${input.note},merged_into=${input.action==='merge'?input.mergeTarget!:null},revision=revision+1,updated_at=now() WHERE id=${row.id}`;
    await tx.$executeRaw`INSERT INTO public.knowledge_reviews(candidate_id,actor_id,action,snapshot) VALUES (${row.id},${actorId}::uuid,${input.action},${JSON.stringify({before:row,after:draft,note:input.note,mergeTarget:input.mergeTarget})}::jsonb)`;
  },{timeout:20000});
  return {status:'ok'};
}
export function relatedSeedTitles(candidate:Candidate) {
  return documents.filter(d=>d.title.includes(candidate.draft.title)||candidate.draft.title.includes(d.title)||d.aliases.some(a=>a.length>3&&candidate.question.includes(a))).map(d=>({id:d.id,title:d.title,answer:d.answer,scope:d.scope,sources:d.sources})).slice(0,5);
}
