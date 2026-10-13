'use client';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isToolUIPart, getToolName, type UIMessage } from 'ai';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { z } from 'zod';
import { navigationTargets, type PageContext } from '@/lib/agent/companion-contract';
import { findRecipe } from '@/lib/agent/workflow-catalog';
import { LAB_TRANSFER_KEY, labHasDraft, transferSchema } from '@/lib/agent/companion-session';
import AssistantRecipeCard from './AssistantRecipeCard';
import DeferredTaskFeedback from './DeferredTaskFeedback';
import { useConversationMemory } from './ConversationMemory';
import { labActionSchema, labPreview } from '@/lib/agent-next/response';

const previewSchema = z.object({ status: z.literal('preview'), materials: transferSchema.shape.materials, assumptions: z.array(z.string()), applied: z.literal(false) });
const recipeSchema = z.object({ recipeId: z.string(), kind: z.enum(['classic', 'convenience']) });
const labels: Record<string, string> = { get_recipe: '读取配方', find_recipes: '查找配方', search_knowledge: '查阅资料', search_web: '联网查证', calculate_adjustment: '核对用量', preview_lab_change: '调整预览' };
const metadataSchema = z.object({ requestId: z.string().uuid() });
function sourceLinks(output: unknown) {
  const parsed = z.object({ evidence: z.array(z.unknown()) }).safeParse(output);
  if (!parsed.success) return [];
  const sources = parsed.data.evidence.flatMap(e => {
    const doc = z.object({ sources: z.array(z.object({ title: z.string(), url: z.string().url() })) }).safeParse(e);
    if (doc.success) return doc.data.sources;
    const web = z.object({ title: z.string(), url: z.string().url() }).safeParse(e);
    return web.success ? [web.data] : [];
  }).filter(s => s.url.startsWith('https://'));
  return [...new Map(sources.map(s => [s.url, s])).values()];
}

export default function StreamingConversation({ context, page, active = true, onNavigate }: { context: string; page?: PageContext; active?: boolean; onNavigate?: () => void }) {
  const memory = useConversationMemory();
  const initial = useRef(memory?.snapshot.current);
  const scroll = useRef(initial.current?.scroll ?? 0), log = useRef<HTMLDivElement>(null);
  const router = useRouter(), inputRef = useRef<HTMLTextAreaElement>(null), end = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(initial.current?.draft ?? ''), [auth, setAuth] = useState<'checking' | 'yes' | 'no' | 'error'>('checking');
  const [notice, setNotice] = useState(''), [taskId, setTaskId] = useState(initial.current?.taskId ?? '');
  const [confirm, setConfirm] = useState<{ value: z.infer<typeof previewSchema>; messageId: string } | null>(null);
  const owner = useRef<string | null>(initial.current?.owner ?? null), latestId = useRef<string | undefined>(undefined);
  const transport = useMemo(() => new DefaultChatTransport({ api: '/api/agent', fetch: async (url, init) => {
    const response = await fetch(url, init);
    if (!response.ok) {
      if (response.status === 401) setAuth('no');
      throw Error(response.status === 401 ? '登录后可以使用助手。' : response.status === 429 ? '提问较频繁或已有问题处理中，请稍后再试。' : response.status === 413 ? '对话较长，请开始新对话。' : '本次回复未完成，请稍后重试。');
    }
    return response;
  } }), []);
  const { messages, sendMessage, status, stop, setMessages, error, clearError, regenerate } = useChat({ transport, messages: initial.current?.messages });
  const stopRef = useRef(stop); stopRef.current = stop;
  const busy = status === 'submitted' || status === 'streaming';
  latestId.current = messages.at(-1)?.id;
  useEffect(() => { setTaskId(id => id || crypto.randomUUID()); return () => { void stopRef.current(); }; }, []);
  useEffect(() => {
    if (!active) return;
    inputRef.current?.focus({ preventScroll: true });
    const abort = new AbortController();
    fetch('/api/auth/me', { signal: abort.signal }).then(r => { if (!r.ok) throw Error(); return r.json(); }).then(data => {
      if (abort.signal.aborted) return;
      const nextOwner = data.user?.id || null;
      if (owner.current && owner.current !== nextOwner) { void stopRef.current(); setMessages([]); setDraft(''); setConfirm(null); setTaskId(crypto.randomUUID()); }
      owner.current = nextOwner; setAuth(nextOwner ? 'yes' : 'no');
    }).catch(() => { if (!abort.signal.aborted) setAuth('error'); });
    return () => abort.abort();
  }, [active, setMessages]);
  useLayoutEffect(() => { if (memory && taskId) memory.snapshot.current = { messages, draft, taskId, owner: owner.current, scroll: scroll.current }; });
  useLayoutEffect(() => { if (active && auth === 'yes' && log.current) log.current.scrollTop = scroll.current; }, [active, auth]);
  const previousMessages = useRef(messages);
  useEffect(() => { if (messages !== previousMessages.current && active) end.current?.scrollIntoView({ block: 'nearest' }); previousMessages.current = messages; }, [messages, active]);
  function navigate(href: string) {
    scroll.current = log.current?.scrollTop ?? scroll.current;
    if (memory) { memory.snapshot.current = { messages, draft, taskId, owner: owner.current, scroll: log.current?.scrollTop ?? scroll.current }; memory.depart(href); }
    onNavigate?.(); router.push(href);
  }
  function reset() { memory?.resetReturn(); scroll.current = 0; void stop(); setMessages([]); clearError(); setDraft(''); setNotice(''); setConfirm(null); setTaskId(crypto.randomUUID()); }
  function apply(value: z.infer<typeof previewSchema>, messageId: string, replace = false) {
    if (busy || latestId.current !== messageId) { setNotice('对话已更新，请重新生成调整预览。'); return; }
    if (!replace && labHasDraft()) { setConfirm({ value, messageId }); return; }
    try {
      sessionStorage.setItem(LAB_TRANSFER_KEY, JSON.stringify(transferSchema.parse({ taskId, materials: value.materials, reference: 'standard', view: 'materials', createdAt: Date.now(), replace })));
      setConfirm(null);
      navigate(navigationTargets.lab);
      if (page?.kind === 'lab') window.dispatchEvent(new Event('alchemix-lab-transfer'));
    } catch { setNotice('无法保存预览，请在实验室手动添加材料。'); }
  }
  function renderTool(part: UIMessage['parts'][number], messageId: string, index: number) {
    if (!isToolUIPart(part)) return null;
    const name = getToolName(part), output = part.state === 'output-available' ? part.output : null;
    const results = z.object({ recipes: z.array(z.unknown()) }).safeParse(output);
    const sources = sourceLinks(output);
    const state = output && typeof output === 'object' && 'status' in output ? output.status : '';
    return <div key={index} className="my-2 space-y-2">
      <p className="text-xs text-neutral-500">{labels[name] || '处理请求'} · {part.state === 'output-error' || state === 'error' ? '暂时失败' : state === 'empty' || state === 'not_found' ? '未找到' : state === 'needs_input' ? '条件不足' : part.state === 'output-available' ? '已完成' : '进行中'}</p>
      {results.success && results.data.recipes.map((row, i) => {
        const raw = row && typeof row === 'object' && 'recipe' in row ? row.recipe : row;
        const parsed = recipeSchema.safeParse(raw);
        if (!parsed.success) return null;
        const entry = findRecipe(parsed.data.kind, parsed.data.recipeId);
        if (!entry) return null;
        const missing = z.object({ missing: z.array(z.string()) }).safeParse(row);
        return <AssistantRecipeCard key={i} missingLabel="还需准备或确认" disabled={busy} recipe={{ id: entry.id, name: entry.nameZh, category: parsed.data.kind, reason: entry.description, missing: missing.success ? missing.data.missing : [], action: { kind: 'recipe', category: parsed.data.kind, id: entry.id } }} onOpen={() => navigate(entry.href)} />;
      })}
      {sources.length > 0 && <div className="assistant-sources"><strong>资料链接</strong>{sources.map(s => <a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.title}</a>)}</div>}
      {name === 'calculate_adjustment' && output !== null && <details className="text-xs"><summary>查看计算依据</summary><pre className="whitespace-pre-wrap">{JSON.stringify(output, null, 2)}</pre></details>}
    </div>;
  }
  return <>
    <div ref={log} onScroll={e => { if (!active) return; scroll.current = e.currentTarget.scrollTop; if (memory?.snapshot.current?.taskId === taskId) memory.snapshot.current.scroll = scroll.current; }} className="assistant-messages" role="log" aria-label="与调酒助手的对话" aria-live="polite">
      <div className="mb-3 flex justify-end"><button type="button" className="min-h-11 px-2 text-xs text-neutral-500" onClick={reset}>新对话</button></div>
      {(auth === 'yes' ? messages : []).map(message => <div key={message.id} className={`assistant-message ${message.role}`}>
        {message.parts.map((part, i) => part.type === 'text' ? <div key={i} className="assistant-prose"><Markdown remarkPlugins={[remarkGfm]} components={{
          a: ({ children }) => <span>{children}</span>,
          img: ({ alt }) => <span>{alt}</span>,
        }}>{part.text}</Markdown></div> : renderTool(part, message.id, i))}
        {message.parts.map((part, i) => {
          if (part.type !== 'data-lab-action') return null;
          const parsed = labActionSchema.safeParse(part.data);
          if (!parsed.success || parsed.data.kind === 'none') return null;
          if (parsed.data.kind === 'navigate') return <button key={i} className="assistant-action" disabled={busy || message.id !== latestId.current} onClick={() => navigate(navigationTargets.lab)}>我的酒精实验室</button>;
          const preview = labPreview(parsed.data);
          return <section key={i} className="assistant-confirm" aria-label="实验室试配材料"><strong>试配参考用量 · 可调整</strong>{preview.materials.map(m => <p key={m.name}>{m.name} · {m.amount === undefined ? '使用材料库默认量' : `${m.amount} ml`}</p>)}{preview.assumptions.map((a, j) => <p key={j} className="text-xs text-neutral-500">{a}</p>)}<button className="assistant-action" disabled={busy || !!error || message.id !== latestId.current} onClick={() => apply(preview, message.id)}>带入材料，进入我的酒精实验室</button></section>;
        })}
        {message.id === latestId.current && !busy && !error && metadataSchema.safeParse(message.metadata).success && <DeferredTaskFeedback taskId={taskId} requestId={metadataSchema.parse(message.metadata).requestId} status="answered" draft={draft} busy={busy} />}
      </div>)}
      {busy && <div role="status" className="assistant-message assistant"><p>{status === 'submitted' ? '正在连接助手…' : '正在回复…'}</p><button onClick={() => void stop()}>停止</button></div>}
      {error && <div role="alert" className="assistant-error">{error.message}<button disabled={busy || auth !== 'yes'} className="assistant-action" onClick={() => { setConfirm(null); void regenerate({ body: { context, id: taskId } }); }}>重试这条消息</button></div>}
      {auth !== 'yes' && <p className="text-sm text-neutral-500">{auth === 'checking' ? '正在确认登录状态…' : auth === 'error' ? '暂时无法确认登录状态，请重新打开助手。' : <a className="assistant-action" href={`/?auth=required&next=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/ask')}`}>登录后继续提问</a>}</p>}
      {notice && <p role="alert" className="assistant-error">{notice}</p>}
      {confirm && <section className="assistant-confirm" aria-label="确认替换实验室内容"><p>实验室已有内容，要替换为这份预览吗？</p><div className="assistant-choices"><button onClick={() => setConfirm(null)}>保留当前内容</button><button onClick={() => apply(confirm.value, confirm.messageId, true)}>替换内容</button></div></section>}
      <div ref={end} />
    </div>
    <form className="assistant-composer" onSubmit={e => { e.preventDefault(); if (!draft.trim() || busy || auth !== 'yes') return; setConfirm(null); setNotice(''); void sendMessage({ text: draft.trim() }, { body: { context, id: taskId } }); setDraft(''); }}>
      <label className="sr-only" htmlFor="companion-question">你的问题</label><textarea id="companion-question" ref={inputRef} rows={2} value={draft} maxLength={2000} onChange={e => setDraft(e.target.value)} placeholder="输入你的问题…" /><button type="submit" disabled={busy || auth !== 'yes' || !draft.trim()} aria-label="发送问题"><Send size={18} /></button>
    </form>
  </>;
}
