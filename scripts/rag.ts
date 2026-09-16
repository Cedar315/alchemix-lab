import nextEnv from '@next/env';
import assert from 'node:assert/strict';

nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production');
const { default: prisma } = await import('../src/lib/db/prisma');
const { ingest, ask } = await import('../src/lib/knowledge/rag/runtime');
const { RagError } = await import('../src/lib/knowledge/rag/core');

try {
  const action = process.argv[2];
  if (action === 'status') {
    console.log(JSON.stringify(await prisma.$queryRaw`
      SELECT a.attname, format_type(a.atttypid, a.atttypmod) AS type,
        c.relrowsecurity AS rls
      FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
      WHERE c.oid='public.rag_chunks'::regclass AND a.attnum>0 AND NOT a.attisdropped
    `, null, 2));
    console.log(JSON.stringify(await prisma.$queryRaw`
      SELECT count(*)::int AS count, dataset_version, embedding_profile
      FROM public.rag_chunks GROUP BY dataset_version, embedding_profile
    `, null, 2));
  } else if (action === 'ingest') {
    console.log(JSON.stringify(await ingest(), null, 2));
  } else if (action === 'smoke') {
    const cases = [
      { question: '茶饮里加牛奶后出现絮状分层，可能是什么原因？', context: '', id: 'milk-curdling', status: 'answered' },
      { question: '经典内格罗尼要加柠檬汁和糖浆吗？', context: '', id: 'classic-negroni', status: 'answered' },
      { question: '蜂蜜总是混不匀，怎么办？', context: '', id: 'honey-mixing', status: 'answered' },
      { question: '双重过滤怎么做？', context: '', id: 'double-strain', status: 'answered' },
      { question: '换了糖浆为什么突然太甜？', context: '原配方是1:1糖浆，我用了同体积2:1糖浆。', id: 'syrup-concentration', status: 'answered' },
      { question: '气泡饮料能放进摇酒壶摇吗？', context: '', id: 'carbonated-shaking', status: 'answered' },
      { question: '如何用Python实现快速排序？', context: '', status: 'no_evidence' },
      { question: '请给出1:1糖浆替换成2:1糖浆的精确毫升比例。', context: '', id: 'syrup-concentration', status: 'insufficient_evidence' },
    ];
    let failures = 0;
    for (const test of cases) {
      const started = Date.now();
      try {
        const result = await ask(test.question, test.context, 3);
        console.log(JSON.stringify({ question: test.question, elapsedMs: Date.now() - started,
          hits: result.hits.map(h => ({ id: h.document.id, similarity: h.semanticScore })),
          answer: result.answer }, null, 2));
        assert.equal(result.answer.status, test.status);
        if (test.id) assert.ok(result.hits.some(h => h.document.id === test.id));
        if (test.status === 'answered') assert.ok(result.answer.claims.some(c => c.evidenceIds.includes(test.id!)));
        if (test.id === 'syrup-concentration') assert.ok(result.answer.claims.every(c => !/两倍|二倍|2\s*倍|翻倍/.test(c.text)), 'Syrup answer must not invent a sweetness multiplier');
        if (test.id === 'milk-curdling') assert.ok(result.answer.claims.some(c => c.text.includes('可能')), 'Milk explanation must preserve uncertainty');
        if (test.status === 'no_evidence') assert.equal(result.answer.model, null);
      } catch (error) {
        failures++;
        console.error(JSON.stringify({ question: test.question, error: error instanceof RagError ? error.code : error instanceof assert.AssertionError ? error.message : 'RAG smoke case failed' }));
      }
    }
    assert.equal(failures, 0, `${failures} smoke case(s) failed`);
    console.log(`PASS: ${cases.length} live RAG cases`);
  } else {
    throw new Error('Usage: tsx scripts/rag.ts status|ingest|smoke');
  }
} catch (error) {
  console.error(error instanceof RagError ? `${error.code}: ${error.message}` : error instanceof assert.AssertionError ? error.message : 'RAG command failed; check database connectivity and configuration.');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
