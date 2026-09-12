'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { Hit } from '@/lib/knowledge/rag/core';
type Result = { error?: string; code?: string; count?: number; hits?: Hit[]; elapsedMs?: number; requestId?: string; datasetVersion?: string; answer?: { status: string; message?: string; claims: { text: string; evidenceIds: string[] }[]; citations: { id: string; title: string; sources: { title: string; url: string }[] }[] } };
export default function RagTestClient() {
  const [question, setQuestion] = useState('换了糖浆为什么突然太甜？');
  const [context, setContext] = useState('');
  const [action, setAction] = useState('retrieve');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  async function run(operation: string) {
    setBusy(true); setResult(null);
    try {
      const response = await fetch('/api/admin/rag', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(operation === 'ingest' ? { action: operation } : { action: operation, question, context, topK: 3 }), signal: AbortSignal.timeout(65000) });
      const data = await response.json();
      setResult(response.ok ? data : { ...data, error: data.error || '请求失败' });
    } catch { setResult({ error: '网络连接失败或请求超时。入库是否完成，请用检索确认后再重试。' }); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-3xl space-y-5 p-6 text-neutral-950">
    <Link href="/admin" className="text-sm underline">返回管理后台</Link>
    <h1 className="text-2xl font-semibold">RAG 测试台</h1>
    <p className="text-sm leading-6 text-neutral-500">先完成数据库迁移和模型配置，再入库。检索会调用向量服务，回答还会调用 MiniMax，按服务商规则计费。当前为 12 条初始知识，尚未完成真实问答质量评估。</p>
    <button disabled={busy} onClick={() => run('ingest')} className="rounded-full border bg-white px-5 py-3 text-sm disabled:opacity-40">将当前知识入库 / 更新索引</button>
    <label className="block text-sm">测试问题<textarea value={question} maxLength={1000} onChange={e => setQuestion(e.target.value)} className="mt-2 block min-h-24 w-full rounded-xl border bg-white p-3" /></label>
    <label className="block text-sm">配方上下文（可选）<textarea value={context} maxLength={2000} onChange={e => setContext(e.target.value)} className="mt-2 block w-full rounded-xl border bg-white p-3" /></label>
    <div className="flex flex-wrap gap-3"><select aria-label="测试模式" value={action} onChange={e => setAction(e.target.value)} className="rounded-full border bg-white px-4 py-3"><option value="retrieve">只测试检索</option><option value="ask">检索并回答</option></select><button disabled={busy || !question.trim()} onClick={() => run(action)} className="rounded-full bg-black px-6 py-3 text-white disabled:opacity-40">{busy ? '运行中…' : '开始测试'}</button></div>
    <div aria-live="polite">
      {result?.error && <p role="alert" className="rounded-xl border p-4 text-sm">{result.error} {result.code && `（${result.code}）`}</p>}
      {result?.count !== undefined && <p>已入库 {result.count} 条知识。</p>}
      {result?.hits && <section className="mt-4 space-y-3"><h2 className="text-lg font-semibold">检索结果（{result.hits.length}）</h2>{!result.hits.length && <p className="text-sm">没有足够相关的知识，未调用回答模型。</p>}{result.hits.map(h => <article key={h.document.id} className="rounded-xl border bg-white p-4"><h3 className="font-medium">{h.document.title}</h3><p className="mt-2 text-xs text-neutral-500">向量相似度 {h.semanticScore.toFixed(3)} · 排序分数 {h.score.toFixed(3)}（不是正确概率）</p><p className="mt-2 text-sm leading-6">{h.document.answer}</p><p className="mt-2 text-xs leading-5 text-neutral-500">适用条件：{h.document.scope}</p>{h.document.sources.map(s => <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="mt-2 block text-xs underline">{s.title}</a>)}</article>)}</section>}
      {result?.answer && <section className="mt-5 space-y-3"><h2 className="text-lg font-semibold">回答</h2>{result.answer.status !== 'answered' && <p className="text-sm">{result.answer.message || '当前证据不足以回答，请补充配方或问题。'}</p>}{result.answer.claims.map((c, i) => <p key={i} className="text-sm leading-6">{c.text}<span className="ml-2 text-xs text-neutral-500">[{c.evidenceIds.join(', ')}]</span></p>)}{result.answer.citations.map(c => <div key={c.id} className="text-xs">{c.id}：{c.sources.map(s => <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="mr-3 underline">{s.title}</a>)}</div>)}</section>}
      {result && !result.error && <details className="mt-5 text-xs"><summary className="cursor-pointer">运行信息（耗时、模型用量、版本）</summary><pre className="mt-2 overflow-auto whitespace-pre-wrap rounded-xl bg-neutral-100 p-3">{JSON.stringify(result, null, 2)}</pre></details>}
    </div>
  </main>;
}
