import test from 'node:test';
import assert from 'node:assert/strict';
import { searchAndCollect,searchWebAnswer,trustedSource,type SearchDeps } from './search';
import { draftSchema,reviewInput,normalizedQuestion,redact } from './contract';
import { minimaxResults } from './minimax-search';

test('MiniMax generated URLs and client tool requests are not search evidence',()=>{
  for(const content of [[{type:'text',text:'https://iba-world.com/'}],[{type:'tool_use',name:'web_search',id:'a'}]]) {
    assert.throws(()=>minimaxResults({content}),/SEARCH_NOT_EXECUTED/);
  }
});
test('MiniMax accepts only results linked to a real server search call',()=>{
  const result={type:'web_search_result',title:'IBA',url:'https://iba-world.com/',content:'Source excerpt'};
  assert.deepEqual(minimaxResults({content:[
    {type:'server_tool_use',name:'web_search',id:'a'},
    {type:'web_search_tool_result',tool_use_id:'unrelated',content:[result]},
    {type:'web_search_tool_result',tool_use_id:'a',content:[result,{type:'text',text:'unsupported'}]},
  ]}),[result]);
  assert.throws(()=>minimaxResults({base_resp:{status_code:1004},content:[]}),/SEARCH_UNAVAILABLE/);
});
const hit={semanticScore:1,keywordScore:0,score:1,document:{id:'web-test',title:'test',aliases:[],category:'调酒',answer:'原文证据',scope:'适用限制',checkedAt:'2026-09-15',reviewStatus:'source_checked_initial' as const,evidenceType:'direct' as const,sources:[{title:'IBA',url:'https://iba-world.com/iba-cocktail/paloma/'}]}};
function fixture(status='no_evidence') {
  let web=0,collections:any[]=[];
  const deps:SearchDeps={rag:async()=>({answer:{status,claims:status==='answered'?[{text:'已有知识',evidenceIds:['seed']}]:[],citations:[]}} as any),web:async()=>{web++;return [hit];},generate:async()=>({value:{status:'answered',claims:[{text:'按来源核实替代限制',evidenceIds:['web-test']}]},usage:null,model:'fixture'}),collect:async(...args)=>{collections.push(args);return 'id';}};
  return {deps,state:()=>({web,collections})};
}
test('existing RAG evidence never invokes internet or creates drafts',async()=>{
  const f=fixture('answered');const result=await searchAndCollect('问题','',AbortSignal.timeout(5000),f.deps);
  assert.equal(result.claims[0].text,'已有知识');assert.equal(f.state().web,0);assert.equal(f.state().collections.length,0);
});
test('companion web answer returns source links without running collection',async()=>{
  const f=fixture();
  const result=await searchWebAnswer('威士忌搭配什么','',AbortSignal.timeout(5000),f.deps);
  assert.equal(f.state().web,1);
  assert.equal(f.state().collections.length,0);
  assert.equal(result.citations[0].sources[0].url,hit.document.sources[0].url);
});
test('weak local retrieval skips its generation pass before web fallback',async()=>{
  const f=fixture('insufficient_evidence');let generations=0;
  f.deps.retrieve=async()=>({hits:[{...hit,semanticScore:.53,score:.45}],threshold:.5} as any);
  f.deps.generate=async()=>{generations++;return {value:{status:'answered',claims:[{text:'联网结论',evidenceIds:['web-test']}]},usage:null,model:'fixture'};};
  const result=await searchAndCollect('西柚替代','',AbortSignal.timeout(5000),f.deps);
  assert.equal(result.status,'answered');assert.equal(generations,1);
});
test('RAG infrastructure failure does not masquerade as a knowledge gap',async()=>{
  const f=fixture();f.deps.rag=async()=>{throw Error('INDEX_NOT_READY');};
  await assert.rejects(searchAndCollect('问题','',AbortSignal.timeout(5000),f.deps));assert.equal(f.state().web,0);
});
test('insufficient RAG evidence searches web and collects a sourced unpublished draft',async()=>{
  const f=fixture('insufficient_evidence');const result=await searchAndCollect('如何替代','',AbortSignal.timeout(5000),f.deps);
  assert.match(result.claims[0].text,/联网资料/);assert.equal(f.state().collections.length,1);
  const draft=f.state().collections[0][2];assert.equal(draftSchema.safeParse(draft).success,true);assert.equal(draft.sources[0].url,hit.document.sources[0].url);
});
test('fabricated citation is rejected; gap is collected without invented answer',async()=>{
  const f=fixture();f.deps.generate=async()=>({value:{status:'answered',claims:[{text:'invented',evidenceIds:['nonexistent']}]},usage:null,model:'fixture'});
  await assert.rejects(searchAndCollect('问题','',AbortSignal.timeout(5000),f.deps));assert.equal(f.state().collections[0][2].answer,'');
});
test('search failure records a gap and does not present unsupported web text',async()=>{
  const f=fixture();f.deps.web=async()=>{throw Error('SEARCH_NOT_CONFIGURED');};
  await assert.rejects(searchAndCollect('问题','',AbortSignal.timeout(5000),f.deps),/SEARCH_NOT_CONFIGURED/);assert.equal(f.state().collections[0][4],'搜索服务尚未配置');
});
test('collection failure does not discard an otherwise supported answer',async()=>{
  const f=fixture();f.deps.collect=async()=>{throw Error('DB unavailable');};
  assert.equal((await searchAndCollect('问题','',AbortSignal.timeout(5000),f.deps)).claims.length,1);
});
test('source allowlist prevents lookalike domains and untrusted links',()=>{
  assert.ok(trustedSource('https://www.diffordsguide.com/cocktails'));
  for(const url of ['https://iba-world.com.evil.test/a','http://iba-world.com/a','https://user:pass@iba-world.com/a','https://127.0.0.1/a','https://example.com/a'])assert.equal(trustedSource(url),false);
});
test('collection removes common identifiers and normalizes duplicate questions',()=>{
  assert.equal(normalizedQuestion('怎么替代？'),'怎么替代');assert.ok(!redact('联系 me@example.com 电话 13812345678').includes('me@example.com'));
});
test('review mutations require a known action, candidate ID and optimistic revision',()=>{
  assert.equal(reviewInput.safeParse({id:'not-real',revision:1,action:'publish'}).success,false);
  assert.equal(reviewInput.safeParse({id:'web-'+'a'.repeat(32),action:'publish'}).success,false);
  assert.equal(reviewInput.safeParse({id:'web-'+'a'.repeat(32),revision:1,action:'auto_publish'}).success,false);
});

test('review publication guards and withdrawal transactions',async t=>{
  const {default:prisma}=await import('@/lib/db/prisma');
  const {reviewCandidate}=await import('./store');
  const originalQuery=prisma.$queryRaw,originalTransaction=prisma.$transaction;
  const row={id:'web-'+'a'.repeat(32),revision:2,status:'published',occurrences:1,draft:{title:'知识',aliases:[],category:'调酒',answer:'答案',scope:'范围',sources:[{title:'IBA',url:'https://iba-world.com/a'}]}};
  let lockedRevision=2,writes:string[]=[];
  prisma.$queryRaw=(async()=>[row]) as any;
  prisma.$transaction=(async(callback:any)=>callback({$queryRaw:async(strings:TemplateStringsArray)=>strings.join('').includes('FOR UPDATE')?[{...row,revision:lockedRevision}]:[], $executeRaw:async(strings:TemplateStringsArray)=>{writes.push(strings.join(''));return 1;}})) as any;
  try {
    await t.test('stale browser revision cannot change publication',async()=>{await assert.rejects(reviewCandidate({id:row.id,revision:1,action:'unpublish',note:''},'00000000-0000-0000-0000-000000000001'),/已更新/);assert.equal(writes.length,0);});
    await t.test('publication requires a human review note before embedding',async()=>{await assert.rejects(reviewCandidate({id:row.id,revision:2,action:'publish',note:''},'00000000-0000-0000-0000-000000000001'),/核实说明/);assert.equal(writes.length,0);});
    await t.test('revision changing during preparation prevents transaction writes',async()=>{lockedRevision=3;await assert.rejects(reviewCandidate({id:row.id,revision:2,action:'unpublish',note:''},'00000000-0000-0000-0000-000000000001'),/其他审核/);assert.equal(writes.length,0);lockedRevision=2;});
    await t.test('withdrawal removes vector, updates status and records audit together',async()=>{await reviewCandidate({id:row.id,revision:2,action:'unpublish',note:'来源有误'},'00000000-0000-0000-0000-000000000001');assert.equal(writes.length,3);assert.match(writes[0],/DELETE FROM public.rag_chunks/);assert.match(writes[1],/UPDATE public.knowledge_candidates/);assert.match(writes[2],/INSERT INTO public.knowledge_reviews/);});
  } finally {prisma.$queryRaw=originalQuery;prisma.$transaction=originalTransaction;}
});

test("empty web evidence reports web no_evidence instead of stale local insufficiency",async()=>{
 const f=fixture("insufficient_evidence"); f.deps.web=async()=>[];
 const answer=await searchAndCollect("问题","",AbortSignal.timeout(5000),f.deps);
 assert.equal(answer.status,"no_evidence"); assert.equal(f.state().collections.length,1);
});
