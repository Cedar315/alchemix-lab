'use client';
import { useEffect, useRef, useState } from 'react';
import { lookupResponse, type IngredientLookup } from '../lib/ingredients/lookup-contract';

export function IngredientWebLookup({ query, onComplete }: { query: string; onComplete: () => void }) {
  const [result, setResult] = useState<IngredientLookup | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    controller.current?.abort();
    setResult(null); setError(''); setLoading(false);
    return () => { controller.current?.abort(); };
  }, [query]);

  async function lookup() {
    if (loading || !query.trim()) return;
    const request = new AbortController();
    controller.current = request;
    setLoading(true); setError(''); setResult(null);
    try {
      const response = await fetch('/api/ingredients/ai-lookup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }), signal: AbortSignal.any([request.signal, AbortSignal.timeout(35000)]),
      });
      const body = await response.json();
      if (!response.ok) throw Error(response.status === 401 ? '登录后可以联网查资料；也可以直接按包装配料表补全。' : typeof body.error === 'string' ? body.error : '联网查询失败，请稍后重试。');
      const data = lookupResponse.parse(body);
      if (!request.signal.aborted && controller.current === request) setResult(data);
    } catch (cause) {
      if (!request.signal.aborted && controller.current === request) setError(cause instanceof Error && cause.name === 'Error' ? cause.message : '这次查询没有完成，请重试或按包装补全。');
    } finally {
      if (!request.signal.aborted && controller.current === request) setLoading(false);
    }
  }

  return <>
    <button type="button" onClick={lookup} disabled={loading || !query.trim()}
      className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-[11px] font-medium text-amber-800 disabled:opacity-50 active:scale-[0.98]">
      {loading ? '正在联网查询…' : '联网查资料'}
    </button>
    <div className="col-span-2 space-y-2" aria-live="polite" aria-busy={loading}>
      {loading && <p className="text-[11px] text-amber-800">正在查找“{query}”的产品资料，通常需要十几秒。</p>}
      {error && <p role="alert" className="text-[11px] text-red-700">{error}</p>}
      {result?.status === 'no_results' && <p className="text-[11px] text-amber-800">暂未找到“{result.query}”的相关资料。可补充品牌和口味后重试，或直接填写包装配料表。</p>}
      {result?.status === 'found' && <>
        <p className="text-[11px] text-amber-900">找到相关资料。请先核对是否为同一品牌、口味和规格。</p>
        <p className="text-[10px] text-amber-800">以下为网页搜索摘要，尚未审核；不代表已确认完整配料或营养值。</p>
        {result.sources.map(source => <details key={source.url} className="rounded-lg border border-amber-200 bg-white p-2">
          <summary className="cursor-pointer text-[11px]">{source.title}</summary>
          <p className="mt-2 whitespace-pre-wrap break-words text-[11px] text-slate-600">{source.excerpt}</p>
          <a href={source.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[11px] underline">查看来源</a>
        </details>)}
        <button type="button" onClick={onComplete} className="w-full rounded-lg bg-neutral-950 px-3 py-2 text-[11px] text-white">按包装确认并补全材料</button>
      </>}
    </div>
  </>;
}
