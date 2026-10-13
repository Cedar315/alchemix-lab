'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import StreamingConversation from './StreamingConversation';
export default function StreamingAskPage() {
  const [context, setContext] = useState(''), [background, setBackground] = useState('');
  useEffect(() => { try { if (new URLSearchParams(window.location.search).has('recipe')) { const value = sessionStorage.getItem('alchemix_ask_context') || ''; setContext(value); setBackground(value); } } catch {} }, []);
  return <div className="flex min-h-dvh justify-center bg-[#e7e5e0] text-neutral-950 md:p-6"><div className="flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-[#f6f5f1] md:h-[calc(100dvh-48px)] md:rounded-[2rem]">
    <header className="flex items-center gap-4 border-b bg-white p-4"><Link href="/" className="flex min-h-11 items-center text-sm">返回首页</Link><div><h1 className="font-semibold">调酒助手</h1><p className="text-xs text-neutral-500">陪你解决这一杯的制作问题</p></div></header>
    <details className="shrink-0 px-4 py-2 text-sm"><summary>当前配方与操作背景（选填）</summary><textarea aria-label="配方上下文" value={background} maxLength={3000} onChange={e => setBackground(e.target.value)} className="mt-2 w-full rounded-xl border bg-white p-3" /><button disabled={background === context} onClick={() => setContext(background)} className="min-h-11 text-xs underline disabled:opacity-40">更新背景</button></details>
    <StreamingConversation context={context} />
  </div></div>;
}
