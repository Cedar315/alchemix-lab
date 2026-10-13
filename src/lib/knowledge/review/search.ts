import { diagnostic, diagnosticText, timed } from '../../agent/diagnostics';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { deepseekSearch } from './deepseek-search';
import { ask, retrieve } from '../rag/runtime';
import { answerFromHits, applicableHits, type Hit } from '../rag/core';
import { generate } from '../rag/providers';
import { collect } from './store';
import { redact, sourceSchema } from './contract';
import type { KnowledgeAnswer } from '@/lib/agent/core';
const trustedDomains=['iba-world.com','diffordsguide.com','liquor.com','house.suntory.com','suntory.com','suntory.co.jp','cointreau.com'];
export function trustedSource(url:string) {
  if(!sourceSchema.shape.url.safeParse(url).success) return false;
  const host=new URL(url).hostname;
  return trustedDomains.some(d=>host===d||host.endsWith('.'+d));
}
export async function webEvidence(question:string,signal:AbortSignal):Promise<Hit[]> {
  const provider=process.env.KNOWLEDGE_SEARCH_PROVIDER||'deepseek';
  if(provider==='deepseek') {
    const results=await deepseekSearch(question,trustedDomains,signal);
    return evidenceHits(results.map(r=>({...r,raw_content:r.content})),40,'搜索命中来源的网页正文提取，可能包含导航或评论。只使用适用正文，不把网友评论当作专业建议。');
  }
  if(provider!=='tavily') throw Error('SEARCH_NOT_CONFIGURED');
  if(!process.env.TAVILY_API_KEY) throw Error('SEARCH_NOT_CONFIGURED');
  const response=await fetch('https://api.tavily.com/search',{method:'POST',redirect:'error',headers:{Authorization:`Bearer ${process.env.TAVILY_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({query:question,search_depth:'advanced',max_results:5,include_answer:false,include_raw_content:'text',include_domains:trustedDomains}),signal:AbortSignal.any([signal,AbortSignal.timeout(12000)]),cache:'no-store'});
  if(!response.ok) throw Error('SEARCH_UNAVAILABLE');
  const payload=z.object({results:z.array(z.object({title:z.string(),url:z.string(),raw_content:z.string().nullable().optional(),content:z.string().optional()})).max(20)}).parse(await response.json());
  return evidenceHits(payload.results,150,'网页正文');
}
function evidenceHits(results:{title:string;url:string;raw_content?:string|null}[],minimum:number,kind:string):Hit[] {
  const seen=new Set<string>();
  let kept=0;
  const accepted=results.filter(r=>{
    let host='invalid'; try { host=new URL(r.url).hostname; } catch {}
    const reason=!sourceSchema.shape.url.safeParse(r.url).success?'invalid_url':!trustedSource(r.url)?'untrusted_domain':!r.raw_content?'missing_content':r.raw_content.length<=minimum?'short_content':seen.has(r.url)?'duplicate':kept>=5?'result_limit':'kept';
    diagnostic('web_filter', { domain: host, contentLength: r.raw_content?.length ?? 0, minimumExclusive: minimum, reason });
    if(reason!=='kept') return false;
    seen.add(r.url); kept++; return true;
  });
  diagnostic('web_filter_summary', { rawCount: results.length, keptCount: accepted.length });
  return accepted.map(r=>({semanticScore:1,keywordScore:0,score:1,document:{id:'source-'+createHash('sha256').update(r.url).digest('hex').slice(0,16),title:r.title.slice(0,300),aliases:[],category:'联网资料',answer:r.raw_content!.slice(0,10000),scope:kind+' 联网来源尚未人工审核。仅回答正文明确支持的结论，保留差异、限制和不确定性。',checkedAt:new Date().toISOString().slice(0,10),reviewStatus:'source_checked_initial' as const,evidenceType:'direct' as const,sources:[{title:r.title.slice(0,300),url:r.url}]}}));
}
export type SearchDeps={rag:typeof ask;retrieve?:typeof retrieve;web:typeof webEvidence;generate:typeof generate;collect:typeof collect};
export async function searchWebAnswer(question:string,context:string,signal:AbortSignal,deps:Pick<SearchDeps,'web'|'generate'>={web:webEvidence,generate}):Promise<KnowledgeAnswer> {
  const query=redact(question);
  const hits=await timed('web_search',()=>deps.web(query,signal));
  return timed('web_answer',()=>answerFromHits(query,context,hits,(q,c,h)=>deps.generate(q,c,h,signal)));
}
export async function searchAndCollect(question:string,context:string,signal:AbortSignal,deps:SearchDeps={rag:ask,retrieve,web:webEvidence,generate,collect}):Promise<KnowledgeAnswer> {
  // Infrastructure failures are not knowledge gaps: let the caller expose a retry.
  diagnostic('knowledge_input', { question: diagnosticText(question) });
  let localAnswer:KnowledgeAnswer={status:'no_evidence',claims:[],citations:[]};
  if(deps.retrieve) {
    const local=await timed('local_retrieval', () => deps.retrieve!(question,3,context,signal));
    diagnostic('local_hits', { threshold: local.threshold, hits: local.hits.map(h => ({ id: h.document.id, score: h.score, semanticScore: h.semanticScore, keywordScore: h.keywordScore })) });
    // Weak semantic neighbours used to trigger a full model call before the web fallback.
    // Only generate from local evidence when an alias matches or similarity is clearly strong.
    const applicable=applicableHits(local.hits,context);
    diagnostic('local_scope_filter', { excludedIds: local.hits.filter(h=>!applicable.includes(h)).map(h=>h.document.id) });
    const strongHits=applicable.filter(h=>h.keywordScore===1||(h.keywordScore===0.5&&h.semanticScore>=local.threshold)||h.semanticScore>=0.68);
    if(strongHits.length) {
      localAnswer=await timed('local_answer', () => answerFromHits(question,context,strongHits,(q,c,h)=>deps.generate(q,c,h,signal)));
      diagnostic('local_result', { status: localAnswer.status, claims: localAnswer.claims.length });
      if(localAnswer.status==='answered'&&localAnswer.claims.length) return localAnswer;
    } else diagnostic('local_result', { status: 'skipped_weak_evidence', claims: 0 });
  } else {
    const local=await timed('local_knowledge', () => deps.rag(question,context,3,signal));
    localAnswer=local.answer;
    diagnostic('local_result', { status: localAnswer.status, claims: localAnswer.claims.length });
    if(localAnswer.status==='answered'&&localAnswer.claims.length) return localAnswer;
  }
  const query=redact(question);
  let recipeName='调酒知识';
  try { const page=JSON.parse(context).recipeRequirements; recipeName=page?.kind==='lab'?'实验室调酒':redact(page?.name??recipeName); } catch {}
  let searchError:unknown;
  let hits:Hit[]=[],answer:KnowledgeAnswer=localAnswer,reason='未找到可回答问题的可靠正文';
  try {
    hits=await timed('web_search', () => deps.web(query,signal));
    const found=await timed('web_answer', () => answerFromHits(query,context,hits,(q,c,h)=>deps.generate(q,c,h,signal)));
    diagnostic('web_result', { evidenceCount: hits.length, status: found.status, claims: found.claims.length });
    answer=found;
    reason=found.status==='answered'?'联网回答待人工核实，发布前请检查适用条件及来源冲突':'来源不足或存在无法解决的冲突';
  } catch(e) { searchError=e; reason=e instanceof Error&&e.message==='SEARCH_NOT_CONFIGURED'?'搜索服务尚未配置':'联网查询或回答生成未完成'; }
  const citations=answer.claims.length?answer.citations:[];
  const sources=[...new Map(citations.flatMap(c=>c.sources).map(s=>[s.url,s])).values()];
  try {
    await timed('knowledge_collection', () => deps.collect(query,recipeName,{title:query.slice(0,300),aliases:[],category:'调酒问答',answer:answer.claims.map(c=>c.text).join('\n'),scope:`适用场景：${recipeName}。待审核者核实完整适用条件、替换限制及资料差异。`,sources},hits.map(h=>({title:h.document.title,url:h.document.sources[0].url,excerpt:h.document.answer.slice(0,1200)})),reason));
  } catch { console.warn(JSON.stringify({event:'knowledge_collection_failed'})); }
  console.info(JSON.stringify({event:'knowledge_search',provider:process.env.KNOWLEDGE_SEARCH_PROVIDER||'deepseek',sourceCount:hits.length,status:searchError?'error':answer.status,errorCode:searchError instanceof Error && /^SEARCH_[A-Z_]+$/.test(searchError.message)?searchError.message:undefined}));
  if(searchError) throw searchError;
  return answer.claims.length ? {...answer,claims:answer.claims.map((c,i)=>({...c,text:(i===0?'根据联网资料：':'')+c.text}))} : answer;
}
