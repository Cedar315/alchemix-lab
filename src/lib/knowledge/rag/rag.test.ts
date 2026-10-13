import test from 'node:test';
import assert from 'node:assert/strict';
import { documents, embeddingText, inputSchema, keywordScore, rankHits, applicableHits, validateAnswer, answerFromHits, RagError } from './core';
import { embed, generate, dimensions } from './providers';
const doc = documents.find(d => d.id === 'syrup-concentration')!;
const hits = rankHits('糖浆比例', [{ document: doc, semanticScore: 0.8 }], 3, 0.5);

test('knowledge keeps sources and scope together and has unique IDs', () => {
  assert.equal(documents.length,50);
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
test('separated material and symptom aliases recover evidence without bypassing the semantic floor', () => {
  const milk = documents.find(d => d.id === 'milk-curdling')!;
  const honey = documents.find(d => d.id === 'honey-mixing')!;
  assert.equal(keywordScore('我这杯分层了，实际用了金酒、牛奶和柠檬汁', milk), 0.5);
  assert.equal(keywordScore('我用了金酒和蜂蜜，摇了10秒还是混不开', honey), 0.5);
  assert.equal(keywordScore('这杯用了牛奶，怎样量取用量？', milk), 0);
  assert.equal(rankHits('牛奶喝完了，彩虹酒分层失败', [{ document: milk, semanticScore: 0.1 }], 3, 0.5).length, 0);
  assert.equal(rankHits('我这杯分层了，用了牛奶', [{ document: milk, semanticScore: 0.64 }], 3, 0.5).length, 1);
});
test('deliberate layering advice is excluded from confirmed dairy faults, not from layered recipes', () => {
  const candidates = documents.filter(d => ['milk-curdling', 'layer-failure'].includes(d.id)).map(document => ({ document, semanticScore: 0.8, keywordScore: 0, score: 0.68 }));
  const context = (question: string, actualMaterials = '牛奶、柠檬汁和金酒') => JSON.stringify({ consultation: { kind: 'troubleshoot', question, actualMaterials } });
  assert.deepEqual(applicableHits(candidates, context('混好了却分层了怎么办')).map(h => h.document.id), ['milk-curdling']);
  assert.equal(applicableHits(candidates, context('我想做分层酒，但混在一起了')).length, 2);
  assert.equal(applicableHits(candidates, context('分层了怎么办', '金酒和橙汁')).length, 2);
  assert.equal(applicableHits(candidates, JSON.stringify({ recipeRequirements: { ingredients: [{ name: '牛奶' }] } })).length, 2);
  assert.equal(applicableHits(candidates, '不是JSON').length, 2);
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
test('possible mechanisms retain uncertainty even when the generation or reviewer misses it', () => {
  const milk = documents.find(d => d.id === 'milk-curdling')!;
  const evidence = rankHits('牛奶结块', [{ document: milk, semanticScore: 0.8 }], 3, 0.5);
  const value = (text: string) => ({ status: 'answered', claims: [{ text, evidenceIds: [milk.id] }] });
  const corrected = validateAnswer(value('柠檬汁中的酸性成分使牛奶中的酪蛋白聚集，从而形成絮状物，与金酒加入顺序无关'), evidence);
  const scoped = `${milk.answer.split('。')[0]}。${milk.scope}`;
  assert.equal(corrected.claims[0].text, scoped);
  assert.doesNotMatch(corrected.claims[0].text, /顺序无关/);
  assert.equal(validateAnswer(value('酸性材料可能使牛奶凝结'), evidence).claims[0].text, scoped);
  assert.throws(() => validateAnswer(value('肯定是酸性材料导致结块'), evidence), /可能机制/);
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
test('Provider errors are not treated as answers; raw provider secrets never appear', async()=> {
  const original=globalThis.fetch;
  const previous={key:process.env.DEEPSEEK_API_KEY,url:process.env.DEEPSEEK_API_URL,model:process.env.DEEPSEEK_MODEL};
  process.env.DEEPSEEK_API_KEY='test';process.env.DEEPSEEK_API_URL='https://example.test/chat';process.env.DEEPSEEK_MODEL='test';
  try {
    globalThis.fetch=async()=>Response.json({base_resp:{status_code:1004,status_msg:'secret'}});
    await assert.rejects(generate('test','',hits),/业务错误/);
    globalThis.fetch=async()=>new Response('secret provider body',{status:401});
    await assert.rejects(generate('test','',hits),(e:unknown)=>e instanceof RagError && !e.message.includes('secret'));
  } finally {
    globalThis.fetch=original;
    for (const [k,v] of Object.entries({DEEPSEEK_API_KEY:previous.key,DEEPSEEK_API_URL:previous.url,DEEPSEEK_MODEL:previous.model})) {if(v===undefined)delete process.env[k];else process.env[k]=v;}
  }
});

test('generation requires a separate successful grounding review before exposing claims', async () => {
  const original = globalThis.fetch;
  const names = ['DEEPSEEK_API_KEY', 'DEEPSEEK_API_URL', 'DEEPSEEK_MODEL'] as const;
  const previous = names.map(name => process.env[name]);
  process.env.DEEPSEEK_API_KEY = 'test'; process.env.DEEPSEEK_API_URL = 'https://example.test/chat'; process.env.DEEPSEEK_MODEL = 'test';
  const milk = documents.find(d => d.id === 'milk-curdling')!;
  const evidence = rankHits('牛奶结块', [{ document: milk, semanticScore: 0.9 }], 3, 0.5);
  const proposed = { status: 'answered', claims: [{ text: '改用植物奶并改变混合顺序就能解决结块。', evidenceIds: [milk.id] }] };
  try {
    for (const verdict of [{ supported: false, relevant: true }, { supported: true, relevant: false }]) {
      let calls = 0;
      globalThis.fetch = async (_url, options) => {
        calls++;
        const body = JSON.parse(String(options?.body));
        if (calls === 2) {
          const reviewInput = JSON.parse(body.messages.at(-1).content);
          assert.equal(reviewInput.claims[0].text, proposed.claims[0].text);
          assert.equal(reviewInput.claims[0].evidence[0].answer, milk.answer);
          assert.ok(!reviewInput.claims[0].evidence[0].answer.includes('植物奶'));
        }
        return Response.json({ choices: [{ message: { content: JSON.stringify(calls === 1 ? proposed : verdict) } }] });
      };
      assert.deepEqual((await generate('牛奶结块怎么办', '', evidence)).value, { status: 'insufficient_evidence', claims: [] });
      assert.equal(calls, 2);
    }
    let calls = 0;
    globalThis.fetch = async () => Response.json({ choices: [{ message: { content: JSON.stringify(++calls === 1 ? proposed : { supported: true }) } }] });
    await assert.rejects(generate('牛奶结块怎么办', '', evidence), /证据核对格式/);
    calls = 0;
    const supported = { status: 'answered', claims: [{ text: milk.answer, evidenceIds: [milk.id] }] };
    globalThis.fetch = async () => Response.json({ choices: [{ message: { content: JSON.stringify(++calls === 1 ? supported : { supported: true, relevant: true }) } }], usage: { total_tokens: 20 } });
    const result = await generate('牛奶结块怎么办', '', evidence);
    assert.deepEqual(result.value, { status: 'answered', claims: [{ text: `${milk.answer.split('。')[0]}。${milk.scope}`, evidenceIds: [milk.id] }] });
    assert.deepEqual(result.usage, { generation: { total_tokens: 20 }, verification: { total_tokens: 20 } });
  } finally {
    globalThis.fetch = original;
    names.forEach((name, index) => { if (previous[index] === undefined) delete process.env[name]; else process.env[name] = previous[index]; });
  }
});
