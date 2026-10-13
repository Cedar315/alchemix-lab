'use client';
import { useState } from 'react';
export default function MakingIntent(){
 const [saved,setSaved]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <div className="mt-3 text-xs"><button type="button" disabled={busy||saved} className="rounded-full border bg-white px-3 py-2 text-neutral-600" onClick={async()=>{setBusy(true);setError('');try{const r=await fetch('/api/analytics/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventName:'making_started',page:'lab',action:'start'})});if(!r.ok)throw Error();setSaved(true);}catch{setError('暂未记录，请重试');}finally{setBusy(false);}}}>{saved?'已记录制作意向':'我准备开始制作'}</button>{saved&&<p className="mt-2 text-neutral-500">做好后可以在「酒记」记录一杯。</p>}{error&&<p role="alert">{error}</p>}</div>;
}
