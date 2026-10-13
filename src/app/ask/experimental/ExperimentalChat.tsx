'use client';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isToolUIPart, getToolName } from 'ai';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LAB_TRANSFER_KEY, labHasDraft, transferSchema } from '@/lib/agent/companion-session';
import { z } from 'zod';

const preview = z.object({ status: z.literal('preview'), materials: transferSchema.shape.materials, assumptions: z.array(z.string()), applied: z.literal(false) });
const recipeCard = z.object({ name: z.string(), recipeId: z.string(), href: z.string().refine(v => v.startsWith('/inspiration/') && !v.includes('\\')), ingredients: z.array(z.object({ name: z.string(), amount: z.number().optional() })) });
function RecipeResults({ output }: { output: unknown }) {
  const result = z.object({ recipes: z.array(z.unknown()) }).safeParse(output);
  if (!result.success) return null;
  return <>{result.data.recipes.map((row, i) => {
    const item = row && typeof row === 'object' && 'recipe' in row ? row.recipe : row;
    const parsed = recipeCard.safeParse(item);
    if (!parsed.success) return null;
    return <Link key={i} href={parsed.data.href} className="mt-2 block rounded-xl border bg-[#f6f5f1] p-3"><strong>{parsed.data.name}</strong><p className="mt-1 text-xs">{parsed.data.ingredients.map(m => `${m.name}${m.amount ? ` ${m.amount} ml` : ''}`).join(' · ')}</p><span className="text-xs underline">查看真实配方 →</span></Link>;
  })}</>;
}
const labels: Record<string, string> = { get_recipe: '读取配方', find_recipes: '查找配方', search_knowledge: '查阅站内资料', search_web: '联网查证', calculate_adjustment: '核对用量', preview_lab_change: '准备实验室预览' };
const transport = new DefaultChatTransport({ api: '/api/agent/experimental' });

export default function ExperimentalChat() {
  const router = useRouter();
  const { messages, sendMessage, status, stop, setMessages, error, clearError, regenerate } = useChat({ transport });
  const [input, setInput] = useState(''), [context, setContext] = useState(''), [auth, setAuth] = useState(false), [notice, setNotice] = useState('');
  const [taskId, setTaskId] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const busy = status === 'submitted' || status === 'streaming';
  useEffect(() => { setTaskId(crypto.randomUUID()); fetch('/api/auth/me').then(r => r.json()).then(d => setAuth(Boolean(d.user))).catch(() => setNotice('无法确认登录状态，请刷新重试。')); }, []);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [messages, status]);
  function apply(value: z.infer<typeof preview>) {
    if (labHasDraft() && !window.confirm('实验室已有草稿，确定用这份预览替换吗？')) return;
    try {
      sessionStorage.setItem(LAB_TRANSFER_KEY, JSON.stringify(transferSchema.parse({ taskId, materials: value.materials, reference: 'standard', createdAt: Date.now(), replace: true })));
      router.push('/?tab=LAB');
    } catch { setNotice('无法保存预览，请在实验室手动添加材料。'); }
  }
  return <div className="min-h-dvh bg-[#e7e5e0] text-neutral-950 sm:p-6"><div className="mx-auto flex h-[calc(100dvh-48px)] min-h-[500px] max-w-xl flex-col rounded-3xl bg-[#f6f5f1]">
    <header className="flex items-center justify-between border-b p-4"><div><h1 className="font-semibold">调酒助手 · 试验版</h1><Link href="/ask/legacy" className="text-xs underline">打开原版对比</Link></div><button disabled={busy} onClick={() => { setMessages([]); clearError(); setContext(''); setInput(''); setNotice(''); setTaskId(crypto.randomUUID()); }} className="min-h-11 px-3 text-sm">新对话</button></header>
    <main className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 [overflow-wrap:anywhere]">
      {!auth && <p className="text-sm">请先<Link href="/?auth=required&next=%2Fask%2Fexperimental" className="underline">登录</Link>后提问。</p>}
      <details><summary className="cursor-pointer text-sm text-neutral-500">当前酒款与操作背景（选填）</summary><textarea aria-label="当前背景" maxLength={3000} disabled={busy} value={context} onChange={e => setContext(e.target.value)} className="mt-2 w-full rounded-xl border p-3" /></details>
      {!messages.length && <div className="space-y-2"><p className="text-sm text-neutral-500">可以找一杯酒、比较缺料替换，或继续解决制作中的问题。本次对话刷新后清空。</p>{['我有金酒和汤力水，想找一杯真实配方。', '我在做玛格丽特，没有君度，有橙汁和蜂蜜，怎么选？', '我这杯太甜了，而且杯子快满了。'].map(q => <button key={q} className="block rounded-xl border bg-white p-3 text-left text-sm" onClick={() => setInput(q)}>{q}</button>)}</div>}
      <div role="log" aria-label="试验版对话" className="space-y-4">{messages.map(message => <article key={message.id} className={`rounded-2xl p-4 ${message.role === 'user' ? 'ml-8 bg-neutral-900 text-white' : 'mr-4 bg-white'}`}><p className="mb-2 text-xs opacity-60">{message.role === 'user' ? '你' : '调酒助手'}</p>{message.parts.map((part, i) => {
        if (part.type === 'text') return <p key={i} className="whitespace-pre-wrap text-sm leading-7">{part.text}</p>;
        if (!isToolUIPart(part)) return null;
        const output = part.state === 'output-available' ? part.output : null;
        const draft = preview.safeParse(output);
        return <div key={i} className="my-2 rounded-xl border p-3 text-sm"><p>{labels[getToolName(part)] || '处理请求'} · {part.state === 'output-available' ? '已完成' : part.state === 'output-error' ? '失败' : '进行中'}</p>
          <RecipeResults output={output} />
          {draft.success && <div className="mt-2 space-y-2">{draft.data.materials.map((m, j) => <p key={j}>{m.name} · {m.amount} ml</p>)}{draft.data.assumptions.map((a, j) => <p key={j} className="text-xs text-neutral-500">{a}</p>)}<button disabled={busy} onClick={() => apply(draft.data)} className="min-h-11 rounded-lg bg-neutral-900 px-3 text-white">确认并带入实验室</button></div>}
          {output !== null && <details className="mt-2 text-xs"><summary>查看工具结果与来源</summary><pre className="whitespace-pre-wrap">{JSON.stringify(output, null, 2)}</pre></details>}
        </div>;
      })}</article>)}</div>
      {busy && <p role="status" className="text-sm text-neutral-500">{status === 'submitted' ? '正在连接助手…' : '正在回复…'}</p>}
      {error && <div role="alert" className="text-sm text-red-700"><p>回复未完成，请检查登录状态或稍后重试。</p><button className="min-h-11 underline" onClick={() => void regenerate({ body: { context, id: taskId } })}>重试本轮</button></div>}
      {notice && <p role="alert">{notice}</p>}<div ref={end} />
    </main>
    <form className="flex gap-2 border-t p-4" onSubmit={e => { e.preventDefault(); if (!input.trim() || busy || !auth) return; void sendMessage({ text: input.trim() }, { body: { context, id: taskId } }); setInput(''); }}>
      <textarea aria-label="消息" rows={2} maxLength={2000} disabled={busy} value={input} onChange={e => setInput(e.target.value)} className="min-w-0 flex-1 rounded-xl border bg-white p-3" placeholder="说说你手边的材料或这杯遇到的问题" />
      {busy ? <button type="button" onClick={() => void stop()} className="min-h-11 px-3">停止</button> : <button disabled={!auth || !input.trim()} className="rounded-xl bg-neutral-950 px-4 text-white disabled:opacity-40">发送</button>}
    </form>
  </div></div>;
}
