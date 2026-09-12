import test from 'node:test';
import assert from 'node:assert/strict';
import { documents, embeddingText, inputSchema, rankHits, validateAnswer, answerFromHits, RagError } from './core';
import { embed, generate, dimensions } from './providers';
const doc = documents.find(d => d.id === 'syrup-concentration')!;
const hits = rankHits('糖浆比例', [{ document: doc, semanticScore: 0.8 }], 3, 0.5);

test('knowledge keeps sources and scope together and has unique IDs', () => {
  assert.equal(documents.length,12);
  assert.equal(new Set(documents.map(d=>d.id)).size,documents.length);
  assert.ok(embeddingText(doc).includes(doc.scope));
});
test('input rejects blank questions, unexpected actions and large topK', () => {
  assert.equal(inputSchema.safeParse({action:'ask'}).success,false);
  assert.equal(inputSchema.safeParse({action:'ask',question:'  '}).success,false);
  assert.equal(inputSchema.safeParse({action:'delete'}).success,false);
  assert.equal(inputSchema.safeParse({action:'retrieve',question:'test',topK:99}).success,false);
  assert.equal(inputSchema.safeParse({action:'ingest'}).success,true);
});
test('irrelevant low similarity is excluded, exact aliases can recall a document', () => {
  assert.equal(rankHits('股票价格', [{document:doc,semanticScore:0.1}],3,0.5).length,0);
  assert.equal(rankHits('请问糖浆比例怎么换', [{document:doc,semanticScore:0.1}],3,0.5).length,1);
});
test('no hits do not call generation', async () => {
  let calls=0;
  const result=await answerFromHits('unknown','',[],async()=>{calls++;throw Error('must not call');});
  assert.equal(calls,0); assert.equal(result.status,'no_evidence');
});
test('citations resolve only to retrieved documents, not model-supplied URLs', () => {
  const value={status:'answered',claims:[{text:'先核对糖浆浓度。',evidenceIds:[doc.id]}]};
  assert.equal(validateAnswer(value,hits).citations[0].sources[0].url,doc.sources[0].url);
  assert.throws(()=>validateAnswer({...value,claims:[{text:'test',evidenceIds:['made-up']}]},hits),RagError);
  assert.throws(()=>validateAnswer({...value,claims:[{text:'https://madeup.test',evidenceIds:[doc.id]}]},hits),RagError);
  assert.throws(()=>validateAnswer({status:'answered',claims:[]},hits),RagError);
  assert.equal(validateAnswer({status:'insufficient_evidence',claims:[]},hits).claims.length,0);
});
test('answer generation receives retrieved evidence and recipe context', async()=> {
  const result=await answerFromHits('为何太甜','用了2:1糖浆',hits,async(q,c,h)=>{
    assert.equal(c,'用了2:1糖浆');assert.equal(h[0].document.id,doc.id);
    return {value:{status:'answered',claims:[{text:'检查糖浆浓度。',evidenceIds:[doc.id]}]},usage:{total_tokens:20},model:'test-double'};
  });
  assert.equal(result.status,'answered');
});
test('embedding HTTP contract sorts by index and rejects invalid dimensions', async()=> {
  const original=globalThis.fetch;
  const config={endpoint:'https://example.test/embeddings',key:'test-key',model:'test',profile:'test'};
  try {
    globalThis.fetch=async(_url,options)=>{
      const body=JSON.parse(String(options?.body));assert.equal(body.dimensions,1024);assert.equal(body.input.length,2);
      return Response.json({data:[{index:1,embedding:Array(dimensions).fill(2)},{index:0,embedding:Array(dimensions).fill(1)}]});
    };
    assert.equal((await embed(['a','b'],config)).vectors[0][0],1);
    globalThis.fetch=async()=>Response.json({data:[{index:0,embedding:[1]}]});
    await assert.rejects(embed(['a'],config),/维度/);
    globalThis.fetch=async()=>Response.json({data:[{index:0,embedding:Array(dimensions).fill(0)}]});
    await assert.rejects(embed(['a'],config),/为空/);
  } finally {globalThis.fetch=original;}
});
test('MiniMax errors are not treated as answers; raw provider secrets never appear', async()=> {
  const original=globalThis.fetch;
  const previous={key:process.env.MINIMAX_API_KEY,url:process.env.MINIMAX_API_URL,model:process.env.MINIMAX_MODEL};
  process.env.MINIMAX_API_KEY='test';process.env.MINIMAX_API_URL='https://example.test/chat';process.env.MINIMAX_MODEL='test';
  try {
    globalThis.fetch=async()=>Response.json({base_resp:{status_code:1004,status_msg:'secret'}});
    await assert.rejects(generate('test','',hits),/业务错误/);
    globalThis.fetch=async()=>new Response('secret provider body',{status:401});
    await assert.rejects(generate('test','',hits),(e:unknown)=>e instanceof RagError && !e.message.includes('secret'));
  } finally {
    globalThis.fetch=original;
    for (const [k,v] of Object.entries({MINIMAX_API_KEY:previous.key,MINIMAX_API_URL:previous.url,MINIMAX_MODEL:previous.model})) {if(v===undefined)delete process.env[k];else process.env[k]=v;}
  }
});
