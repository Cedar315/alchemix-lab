'use client';
import { useEffect,useState } from 'react';
import Link from 'next/link';
import type { Candidate,Draft } from '@/lib/knowledge/review/contract';
type Row=Candidate&{related:Array<{id:string;title:string;answer:string;scope:string;sources:Draft['sources']}>};
export default function ReviewClient() {
  const [rows,setRows]=useState<Row[]>([]),[selected,setSelected]=useState<Row|null>(null),[draft,setDraft]=useState<Draft|null>(null),[note,setNote]=useState(''),[target,setTarget]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[filter,setFilter]=useState('all');
  async function load(){try{const r=await fetch('/api/admin/knowledge',{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error);setRows(d.candidates);}catch(e){setError(e instanceof Error?e.message:'加载失败');}}
  useEffect(()=>{void load();},[]);
  async function act(action:string) {
    if(!selected||!draft)return;setBusy(true);setError('');
    try{const r=await fetch('/api/admin/knowledge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:selected.id,revision:selected.revision,action,draft,note,...(action==='merge'?{mergeTarget:target}:{})})});const d=await r.json();if(!r.ok)throw Error(d.error);setSelected(null);setDraft(null);await load();}
    catch(e){setError(e instanceof Error?e.message:'操作失败');}finally{setBusy(false);}
  }
  const labels:Record<string,string>={pending:'待审核',gap:'知识缺口',published:'已发布',rejected:'已驳回',merged:'已合并'};
  return <main className="mx-auto max-w-6xl p-6 text-neutral-900"><Link href="/admin/rag" className="underline">返回 RAG 后台</Link><h1 className="my-4 text-2xl">问答知识审核</h1><p>联网检索自动收集。仅审核发布的知识参与 RAG；用户收藏配方不进入这里。</p>{error&&<p role="alert" className="my-4 text-red-700">{error}</p>}<button className="my-3 underline" onClick={()=>void load()}>刷新列表</button><select aria-label="审核状态" value={filter} onChange={e=>setFilter(e.target.value)} className="ml-4 border p-2"><option value="all">全部状态</option>{Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
  <div className="grid gap-6 md:grid-cols-[280px_1fr]"><aside>{rows.filter(r=>filter==='all'||r.status===filter).map(r=><button className="mb-2 block w-full rounded-xl border p-3 text-left" key={r.id} onClick={()=>{setSelected(r);setDraft(structuredClone(r.draft));setNote('');setTarget('');setError('');}}><strong>{r.draft.title}</strong><p>{labels[r.status]} · {r.occurrences} 次</p><small>{r.recipe_name} · {new Date(r.updated_at).toLocaleString()}</small></button>)}{!rows.length&&<p>暂时没有待审核记录。</p>}</aside>
  {selected&&draft&&<section className="space-y-4 rounded-xl border bg-white p-5"><p>{selected.reason}</p><p className="text-sm">记录 ID：{selected.id}</p>
  <label className="block">知识标题<input className="mt-1 block w-full border p-2" value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
  <label className="block">相似问法（每行一个）<textarea className="block w-full border p-2" value={draft.aliases.join('\n')} onChange={e=>setDraft({...draft,aliases:e.target.value.split('\n')})}/></label>
  <label className="block">分类<input className="block w-full border p-2" value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value})}/></label>
  <label className="block">答案<textarea rows={8} className="block w-full border p-2" value={draft.answer} onChange={e=>setDraft({...draft,answer:e.target.value})}/></label>
  <label className="block">适用条件、限制及差异<textarea rows={4} className="block w-full border p-2" value={draft.scope} onChange={e=>setDraft({...draft,scope:e.target.value})}/></label>
  <div>发布来源{draft.sources.map((s,i)=><div key={i} className="my-2 flex flex-wrap gap-2"><input aria-label="来源标题" className="border p-2" value={s.title} onChange={e=>setDraft({...draft,sources:draft.sources.map((v,j)=>j===i?{...v,title:e.target.value}:v)})}/><input aria-label="来源网址" className="min-w-0 flex-1 border p-2" value={s.url} onChange={e=>setDraft({...draft,sources:draft.sources.map((v,j)=>j===i?{...v,url:e.target.value}:v)})}/><button onClick={()=>setDraft({...draft,sources:draft.sources.filter((_,j)=>j!==i)})}>移除</button></div>)}<button className="underline" onClick={()=>setDraft({...draft,sources:[...draft.sources,{title:'',url:''}]})}>添加来源</button></div>
  <details><summary>联网原始依据与获取时间</summary><p>{new Date(selected.created_at).toLocaleString()}</p>{selected.evidence.map(e=><article key={e.url} className="my-3"><a href={e.url} target="_blank" rel="noreferrer" className="underline">{e.title}</a><p className="whitespace-pre-wrap text-sm">{e.excerpt}</p></article>)}</details>
  <details><summary>检查可能重复或冲突的现有知识（需人工核实）</summary>{selected.related.map(r=><article key={r.id}><h3>{r.title}</h3><p>{r.answer}</p><p>{r.scope}</p></article>)}<p className="mt-2">其他已发布条目</p>{rows.filter(r=>r.status==='published'&&r.id!==selected.id).map(r=><details key={r.id}><summary>{r.draft.title}</summary><p>{r.draft.answer}</p><p>{r.draft.scope}</p></details>)}</details>
  <label className="block">审核说明（发布必填，说明已核实的依据及限制）<textarea className="block w-full border p-2" value={note} onChange={e=>setNote(e.target.value)}/></label>
  <div className="flex flex-wrap gap-3">{[['save','保存草稿'],['publish','审核通过并发布'],['reject','驳回'],['unpublish','撤回发布']].map(([action,label])=><button key={action} disabled={busy||(action==='save'&&selected.status==='published')||(action==='unpublish'&&selected.status!=='published')} className="rounded-lg border px-3 py-2 disabled:opacity-40" onClick={()=>void act(action)}>{label}</button>)}</div>
  <div><p>重复条目：先核对目标知识是否完整，再合并记录。此操作不会自动拼接答案。</p><select aria-label="合并目标" className="border p-2" value={target} onChange={e=>setTarget(e.target.value)}><option value="">选择已发布目标</option>{rows.filter(r=>r.status==='published'&&r.id!==selected.id).map(r=><option key={r.id} value={r.id}>{r.draft.title}</option>)}</select><button disabled={busy||!target} onClick={()=>void act('merge')} className="ml-2 underline disabled:opacity-40">合并重复记录</button></div>
  </section>}</div></main>;
}
