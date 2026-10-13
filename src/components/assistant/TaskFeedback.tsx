'use client';
import MakingIntent from './MakingIntent';
import { useState } from 'react';
import { feedbackReasons } from '@/lib/admin/metrics';
export default function TaskFeedback({requestId,onRated}:{requestId:string;onRated?:(complete:boolean)=>void}){
 const [value,setValue]=useState(''),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(feedback:string,why?:string){setBusy(true);setError('');try{const r=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId,feedback,reason:why})});const d=await r.json();if(!r.ok)throw Error(d.error);setValue(feedback);setReason(why||'');onRated?.(feedback==='solved'||Boolean(why));}catch(e){setError(e instanceof Error?e.message:'反馈未保存');}finally{setBusy(false);}}
 return <div className="mt-3 border-t border-neutral-200 pt-3 text-xs" aria-label="问题解决反馈"><p className="mb-2 text-neutral-500">这次问题解决了吗？</p><div className="flex gap-2">{[['solved','解决了'],['unsolved','没解决']].map(([v,label])=><button key={v} disabled={busy} aria-pressed={value===v} className={`rounded-full border px-3 py-2 ${value===v?'bg-neutral-900 text-white':'bg-white'}`} onClick={()=>void save(v)}>{label}</button>)}</div>{value==='unsolved'&&<div className="mt-2 flex flex-wrap gap-2">{feedbackReasons.map(r=><button key={r} disabled={busy} aria-pressed={reason===r} className={`rounded border p-2 ${reason===r?'bg-neutral-200':''}`} onClick={()=>void save('unsolved',r)}>{r}</button>)}<p className="w-full text-neutral-500">已保存反馈；原因选填，可直接继续。</p></div>}{value==='solved'&&<p className="mt-2">谢谢，已记录。</p>}<MakingIntent/>{error&&<p role="alert" className="mt-2 text-red-700">{error}</p>}</div>;
}
