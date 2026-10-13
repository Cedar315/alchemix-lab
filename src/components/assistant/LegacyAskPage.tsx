'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import DeferredTaskFeedback from '@/components/assistant/DeferredTaskFeedback';
import { ArrowLeft, Send } from 'lucide-react';
import type { KnowledgeAnswer, Trace } from '@/lib/agent/core';
type History = { role: 'user' | 'assistant'; content: string; result?: Result }[];
type Result = { calculations?: {text:string}[]; handoff?: {label:string;href:string}|null; intent?: {intent:string;dialogueAct:string}|null; clarification?: string; status: string; message: string; recipes: never[]; knowledge: KnowledgeAnswer | null; trace: Trace[]; requestId: string };
const draftKey = 'alchemix_preparation_draft_v1';
export default function AskPage() {
  const [question,setQuestion] = useState(''), [context,setContext] = useState('');
  const [history,setHistory] = useState<History>([]), [answer,setAnswer] = useState<KnowledgeAnswer | null>(null), [result,setResult] = useState<Result | null>(null);
  const [busy,setBusy] = useState(false), [error,setError] = useState(''), [auth,setAuth] = useState<'checking'|'yes'|'no'|'error'>('checking'), [loaded,setLoaded] = useState(false), [submitted,setSubmitted] = useState('');
  const initialized = useRef(false);
  const taskId=useRef('');
  const conversationEnd = useRef<HTMLDivElement>(null);
  useEffect(() => { conversationEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [history, busy, error]);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    try {
      const draft = JSON.parse(sessionStorage.getItem(draftKey) || 'null');
      if (draft) { setQuestion(draft.question || ''); setContext(draft.context || ''); setHistory(draft.history || []); }
      const params = new URLSearchParams(window.location.search);
      if (params.has('recipe')) { setContext(sessionStorage.getItem('alchemix_ask_context') || ''); setHistory([]); }
      window.history.replaceState(null,'','/ask');
    } catch { /* storage may be unavailable */ }
    setLoaded(true);
    fetch('/api/auth/me').then(r => { if (!r.ok) throw Error(); return r.json(); }).then(d => setAuth(d.user ? 'yes' : 'no')).catch(() => setAuth('error'));
  },[]);
  useEffect(() => { if (loaded) try { sessionStorage.setItem(draftKey,JSON.stringify({ question, context, history })); } catch {} },[loaded,question,context,history]);
  async function send() {
    if (busy || !question.trim() || auth !== 'yes') return;
    if(!taskId.current)taskId.current=crypto.randomUUID();
    setError('');
    setBusy(true); setSubmitted(question.trim()); setQuestion(''); setAnswer(null); setResult(null);
    try {
      const body = {question,context,history:history.slice(-12).map(({role,content})=>({role,content}))};
      const response = await fetch('/api/agent', { method: 'POST', headers: { 'Content-Type':'application/json','x-task-id':taskId.current }, body: JSON.stringify(body), signal: AbortSignal.timeout(55000) });
      const data = await response.json();
      if (!response.ok) { if (response.status === 401) setAuth('no'); throw Error(data.error || '请求失败，请重试。'); }
      if (['timeout','unavailable','limit'].includes(data.status) && !data.knowledge && !data.calculations?.length) throw Error(`${data.message}（编号：${data.requestId}）`);
      const knowledge = data.knowledge;
      setAnswer(knowledge); setResult(data);
      const content = [data.message, data.clarification, ...(data.calculations || []).map((c:{text:string})=>c.text), ...(knowledge?.claims || []).map((c: {text:string}) => c.text)].filter(Boolean).join('\n').slice(0,2000) || '资料不足，请补充信息。';
      setHistory(h => [...(data.status==='cancelled'?[]:h),{ role:'user' as const,content:question.slice(0,2000) },{ role:'assistant' as const,content, result: data }]);
    } catch (e) { setQuestion(question); setError(e instanceof Error && e.name !== 'TimeoutError' ? e.message : '等待超时，请稍后重试。'); }
    finally { setBusy(false); }
  }
  const field = 'w-full min-w-0 rounded-xl border border-neutral-200 bg-white p-3 text-base';
  return <div className="flex min-h-dvh justify-center bg-[#e7e5e0] font-sans text-neutral-950 md:px-6 md:py-6">
    <div className="relative flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-[#f6f5f1] shadow-none md:h-[calc(100dvh-48px)] md:rounded-[2rem] md:border md:border-[#d5d3cd]">
      <header className="flex shrink-0 items-center gap-3 border-b border-black/5 bg-white px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))]">
        <Link href="/" aria-label="返回首页" className="flex size-11 items-center justify-center rounded-full border border-neutral-200"><ArrowLeft size={20}/></Link>
        <div className="flex-1"><h1 className="text-base font-semibold">调酒助手</h1><p className="mt-0.5 text-xs text-neutral-500">陪你解决这一杯的制作问题</p></div>
        <button disabled={busy} className="min-h-11 px-2 text-xs text-neutral-500" onClick={()=>{taskId.current=crypto.randomUUID();setHistory([]); setContext('');setAnswer(null);setResult(null);setSubmitted('');setQuestion('');setError('');}}>新对话</button>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 [overflow-wrap:anywhere]">
    {!result && history.length===0 && <div className="mb-5 rounded-2xl border border-black/5 bg-white p-4"><p className="font-medium">这杯做到哪一步了？</p><p className="mt-2 text-sm leading-6 text-neutral-500">说说当前配方、已经做过的步骤和遇到的问题。知识问题也可以直接问。</p></div>}
    <Link href="/?tab=ASSISTANT" className="mb-4 block rounded-xl border border-neutral-200 bg-white p-3 text-sm">还没选好？去首页按材料和口味选酒 →</Link>
    {auth !== 'yes' && <p className="mb-4 rounded-xl border bg-white p-4 text-sm">{auth==='checking'?'正在确认登录状态…':auth==='error'?'暂时无法确认登录状态，请刷新重试。':<>登录后可以提问，当前输入会在本标签页保留。<Link href="/?auth=required&next=%2Fask" className="ml-2 underline">去登录</Link></>}</p>}
    <details className="mb-4 rounded-2xl border border-neutral-200 bg-white p-3"><summary className="min-h-8 cursor-pointer text-sm text-neutral-500">当前配方与实际操作（选填）</summary><form id="ask-form" onSubmit={e=>{e.preventDefault();void send().catch(e=>setError(e.message));}} className="space-y-4">
      <fieldset disabled={busy} className="space-y-4">
      <details open={!!context}><summary className="cursor-pointer text-sm">当前配方 / 操作背景{context?'（已携带）':''}</summary><textarea aria-label="配方上下文" className={field+' mt-2'} value={context} onChange={e=>setContext(e.target.value)} maxLength={2000} placeholder="酒名、材料用量、制作步骤，或你刚才做了什么"/></details>
      </fieldset>
    </form></details>
    <div className="my-4 flex flex-wrap gap-2">{['苏打水能放进摇酒壶摇吗？','茶饮加牛奶为什么会分层？','我换了糖浆，现在太甜了'].map(q=><button disabled={busy} className="min-h-11 rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-xs" key={q} onClick={()=>{setQuestion(q);}}>{q}</button>)}</div>
    <div role="log" aria-label="与调酒助手的对话" aria-live="polite" className="space-y-4">
      {history.map((message,messageIndex)=>{
        const result=message.result;
        const answer=result?.knowledge;
        return <div key={messageIndex} className={`flex ${message.role==='user'?'justify-end':'justify-start'}`}>
          <div className={`max-w-[92%] min-w-0 space-y-3 rounded-2xl px-4 py-3 text-sm leading-7 ${message.role==='user'?'rounded-br-sm bg-[#191918] text-white':'rounded-bl-sm bg-white text-neutral-900'}`}>
            <p className="text-[10px] opacity-60">{message.role==='user'?'你':'调酒助手'}</p>
            {!result && <p className="whitespace-pre-wrap">{message.content}</p>}
            {result && answer?.claims.length && answer.status!=='answered' ? <p className="text-neutral-500">资料只能支持下面这部分，其余内容暂时无法确认。</p> : null}
            {result && !result.clarification && (!answer?.claims.length || result.handoff) && <p>{result.message}</p>}
        {answer?.claims.map((c,i)=><p key={i} className="text-sm leading-7">{c.text} {c.evidenceIds.map(id=>{const n=answer.citations.findIndex(v=>v.id===id);return n<0?null:<a key={id} href={`#source-${messageIndex}-${id}`} aria-label={`参考来源 ${n+1}`} className="ml-1 text-[#191918] underline">[{n+1}]</a>;})}</p>)}
            {result?.calculations?.map((c,i)=><p key={i} className="rounded-xl border p-3">{c.text}</p>)}
            {result?.handoff&&<Link className="block rounded-xl border p-3 underline" href={result.handoff.href} onClick={()=>{try{sessionStorage.setItem('alchemix_workflow_request',history[messageIndex-1]?.content || '');}catch{}}}>{result.handoff.label} →</Link>}
            {!!result?.trace.length&&<details className="text-xs text-neutral-500"><summary>查看本次处理记录</summary>{result.trace.map((t,i)=><p key={i}>{({read_recipe:'读取当前配方',search_knowledge:'查阅资料',check_capacity:'核对容量'} as Record<string,string>)[t.tool]||t.tool} · {t.status}</p>)}</details>}
            {result?.clarification && <p>{result.clarification}</p>}
        {!!answer?.citations.length&&<div className="border-t pt-3"><h2 className="text-sm font-medium">参考来源</h2>{answer.citations.map((c,i)=><div id={`source-${messageIndex}-${c.id}`} key={c.id} className="mt-3 text-xs"><p>[{i+1}] {c.title}</p>{c.sources.map(s=><a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="mt-2 block text-[#191918] underline">{s.title}</a>)}</div>)}</div>}
          </div>
        </div>;
      })}
      {busy && <><div className="flex justify-end"><p className="max-w-[92%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-[#191918] px-4 py-3 text-sm leading-7 text-white">{submitted}</p></div><p role="status" className="w-fit animate-pulse rounded-2xl bg-white px-4 py-3 text-sm text-neutral-500">正在想一想…</p></>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error} 输入已保留，可以再次发送。</p>}
      {result?.requestId && !busy && <DeferredTaskFeedback taskId={taskId.current} requestId={result.requestId} status={result.status} draft={question} busy={busy}/>}
    <div ref={conversationEnd}/>
    </div>
      </main>
      <div className="shrink-0 border-t border-black/5 bg-white px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <label htmlFor="ask-question" className="mb-2 block text-xs text-neutral-500">{busy?'助手正在回复…':'聊一聊'}</label>
        <div className="flex items-end gap-2 rounded-2xl border border-neutral-200 bg-[#f6f5f1] p-2">
          <textarea id="ask-question" form="ask-form" disabled={busy} className="max-h-32 min-h-12 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-[#191918] rounded-lg" rows={2} value={question} onChange={e=>setQuestion(e.target.value)} maxLength={1000} placeholder="例如：这杯太甜了，而且杯子快满了"/>
          <button form="ask-form" type="submit" disabled={busy||auth!=='yes'||!question.trim()} className="flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-xl bg-neutral-950 px-3 text-sm text-white disabled:opacity-40"><Send size={16} aria-hidden="true"/>{busy?'处理中':'发送'}</button>
        </div>
      </div>
    </div>
  </div>;
}
