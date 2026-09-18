'use client';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { MessageCircle, X, Send, ChevronUp, ChevronDown, ArrowRight } from 'lucide-react';
import { companionOutput, type PageContext, type PageAction, type CompanionResult, capabilityTargets, navigationTargets } from '@/lib/agent/companion-contract';
import { actionHref } from '@/lib/agent/workflow-catalog';
import AssistantRecipeCard from './AssistantRecipeCard';
import { type Session, SESSION_KEY, createTask, taskKey, acceptsResult, labHasDraft, LAB_TRANSFER_KEY } from '@/lib/agent/companion-session';
const Context = createContext<{
    setSurface: (owner: string, page: PageContext | null) => void;
}>({ setSurface: () => { } });
export function AssistantSurface({ context }: {
    context: PageContext;
}) {
    const { setSurface } = useContext(Context);
    const owner = useRef(React.useId());
    const text = JSON.stringify(context);
    useEffect(() => { setSurface(owner.current, JSON.parse(text)); }, [setSurface, text]);
    useEffect(() => () => setSurface(owner.current, null), [setSurface]);
    return null;
}
const empty: Session = { tasks: [], active: null, owner: null };
export default function AssistantProvider({ children }: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [surface, setPage] = useState<{
        owner: string;
        page: PageContext;
    } | null>(null);
    const [host, setHost] = useState<HTMLElement | null>(null);
    const [retry, setRetry] = useState('');
    const [session, setSession] = useState<Session>(empty);
    const sessionRef = useRef(session);
    const pageRef = useRef(surface);
    pageRef.current = surface;
    const [ready, setReady] = useState(false), [open, setOpen] = useState(false), [expanded, setExpanded] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [login, setLogin] = useState(false);
    const [confirm, setConfirm] = useState<{
        action: PageAction;
        taskId: string;
        version: number;
    } | null>(null);
    const abort = useRef<AbortController | null>(null), panel = useRef<HTMLDivElement>(null), input = useRef<HTMLTextAreaElement>(null), launcher = useRef<HTMLButtonElement>(null), end = useRef<HTMLDivElement>(null), dragY = useRef(0), dragged = useRef(false), previousPage = useRef('');
    const update = useCallback((fn: (s: Session) => Session) => { const next = fn(sessionRef.current); sessionRef.current = next; setSession(next); try {
        sessionStorage.removeItem(SESSION_KEY);
    }
    catch { } }, []);
    const setSurface = useCallback((owner: string, page: PageContext | null) => { setPage(prev => page ? { owner, page } : prev?.owner === owner ? null : prev); }, []);
    useEffect(() => { try { sessionStorage.removeItem(SESSION_KEY); } catch {} setReady(true); }, []);
    const pageText = surface ? JSON.stringify(surface.page) : '';
    useEffect(() => {
        if (!ready) return;
        setHost(document.querySelector<HTMLElement>('[data-app-shell]'));
        abort.current?.abort();
        setBusy(false); setError(''); setRetry(''); setConfirm(null);
        if (!surface) {
            setOpen(false); previousPage.current = '';
            update(s => ({ ...s, tasks: [], active: null }));
            return;
        }
        const key = taskKey(surface.page);
        const same = previousPage.current === key;
        previousPage.current = key;
        update(s => {
            const current = s.tasks.find(t => t.id === s.active);
            if (same && current?.key === key)
                return { ...s, tasks: [{ ...current, name: surface.page.name, version: current.version + 1, pending: null }] };
            const next = createTask(surface.page);
            return { ...s, active: next.id, tasks: [next] };
        });
        if (!same) setOpen(false);
    }, [pageText, ready, update]);
    const task = session.tasks.find(t => t.id === session.active);
    useEffect(() => { if (open) {
        input.current?.focus();
        const controller = new AbortController();
        fetch('/api/auth/me', { signal: controller.signal }).then(r => r.ok ? r.json() : null).then(data => { if (controller.signal.aborted)
            return; const owner = data?.user?.id ?? null; setLogin(!owner); if (sessionRef.current.owner && sessionRef.current.owner !== owner) {
            abort.current?.abort();
            setBusy(false);
            const page = pageRef.current?.page;
            update(() => { const next = page ? createTask(page) : null; return { owner, active: next?.id ?? null, tasks: next ? [next] : [] }; });
        }
        else
            update(s => ({ ...s, owner })); }).catch(() => { });
        return () => controller.abort();
    } }, [open, update]);
    useEffect(() => { if (open)
        end.current?.scrollIntoView({ block: 'nearest' }); }, [task?.messages.length, busy, open]);
    const close = () => { setOpen(false); setConfirm(null); setTimeout(() => launcher.current?.focus(), 0); };
    const edit = (value: string) => update(s => ({ ...s, tasks: s.tasks.map(t => t.id === s.active ? { ...t, draft: value } : t) }));
    async function send(value?: string) {
        const stored = sessionRef.current.tasks.find(t => t.id === sessionRef.current.active), page = pageRef.current?.page;
        const current = stored ? { ...stored, version: stored.version + 1 } : undefined;
        const question = (value ?? current?.draft ?? '').trim();
        if (!current || !page || !question || busy)
            return;
        const controller = new AbortController();
        abort.current = controller;
        setBusy(true);
        setError('');
        setRetry('');
        setConfirm(null);
        update(s => ({ ...s, tasks: s.tasks.map(t => t.id === current.id ? { ...t, draft: '', version: current.version, messages: [...t.messages, { role: 'user' as const, content: question }].slice(-24) } : t) }));
        try {
            const response = await fetch('/api/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60000)]), body: JSON.stringify({ version: 2, taskId: current.id, contextVersion: current.version, question, page, history: current.messages.slice(current.messages.reduce((n, m, i) => m.result?.status === 'cancelled' || m.content === '好的，先不继续处理。' ? i + 1 : n, 0)).slice(-12).map(({ role, content }) => ({ role, content })), pending: current.pending }) });
            if (!response.ok) {
                if (response.status === 401)
                    setLogin(true);
                throw Error(response.status === 401 ? '登录后可以使用助手。' : response.status === 429 ? '提问较频繁或已有问题处理中，请稍后再试。' : '这次请求没有完成，请重试。');
            }
            const parsedResult = companionOutput.safeParse(await response.json());
            if (!parsedResult.success)
                throw Error("助手返回内容暂时无法展示，请重试。");
            const result = parsedResult.data;
            if (controller.signal.aborted)
                return;
            const active = sessionRef.current.tasks.find(t => t.id === sessionRef.current.active);
            if (!active || !acceptsResult(active, result))
                return;
            if (['unavailable','timeout'].includes(result.status)) { setRetry(question); setError('本次回复未完成，可以重试。'); }
            const content = [result.message, result.clarification, ...(result.knowledge?.claims.map(c => c.text) ?? [])].filter(Boolean).join('\n').slice(0, 2000);
            update(s => ({ ...s, tasks: s.tasks.map(t => t.id === current.id ? { ...t, draft: t.draft, pending: result.pending, messages: [...t.messages, { role: 'assistant' as const, content, result }].slice(-24) } : t) }));
        }
        catch (e) {
            if (!controller.signal.aborted) { setRetry(question); setError(e instanceof Error ? e.message : '请求失败，请重试。'); }
        }
        finally {
            if (abort.current === controller) {
                setBusy(false);
                abort.current = null;
            }
        }
    }
    function validAction(result: CompanionResult) { const t = sessionRef.current.tasks.find(t => t.id === sessionRef.current.active); return Boolean(t && acceptsResult(t, result)); }
    function execute(action: PageAction, result: CompanionResult, replace = false) {
        if (!validAction(result)) {
            setError('页面背景已变化，请重新描述你的需求。');
            return;
        }
        if (action.kind === 'locate') {
            const node = document.getElementById(capabilityTargets[action.target]);
            if (!node) {
                setError('这个操作入口暂时不可用。');
                return;
            }
            close();
            requestAnimationFrame(() => { node.scrollIntoView({ behavior: 'smooth', block: 'center' }); node.focus({ preventScroll: true }); node.classList.add('assistant-highlight'); setTimeout(() => node.classList.remove('assistant-highlight'), 2200); });
            return;
        }
        if (action.kind === 'prefill') {
            if (!replace && labHasDraft()) {
                setConfirm({ action, taskId: result.taskId, version: result.contextVersion });
                return;
            }
            try {

                sessionStorage.setItem(LAB_TRANSFER_KEY, JSON.stringify({ taskId: result.taskId, materials: action.materials, createdAt: Date.now(), replace }));
            }
            catch {
                setError('浏览器暂时无法保留材料，请在实验室手动添加。');
                return;
            }
            close();
            if (pageRef.current?.page.kind === 'lab')
                window.dispatchEvent(new Event('alchemix-lab-transfer'));
            else
                router.push(navigationTargets.lab);
            return;
        }
        const href = action.kind === 'recipe' ? actionHref(action) : navigationTargets[action.target];
        if (!href) {
            setError('这个酒单入口暂时不可用。');
            return;
        }
        close();
        router.push(href);
    }
    function stop() { abort.current?.abort(); abort.current = null; setBusy(false); setConfirm(null); update(s => ({ ...s, tasks: s.tasks.map(t => t.id === s.active ? { ...t, version: t.version + 1, pending: null, messages: [...t.messages, { role: 'assistant' as const, content: '好的，先不继续处理。' }].slice(-24) } : t) })); }
    return <Context.Provider value={{ setSurface }}>{children}{ready && surface && task && host && createPortal(<div className="assistant-root">
 {!open && <button ref={launcher} type="button" aria-label="打开调酒助手" className="assistant-launcher" onClick={() => { setOpen(true); }}><MessageCircle size={23}/></button>}
 {open && <><button className="assistant-backdrop" aria-label="收起调酒助手" onClick={close}/><div ref={panel} role="dialog" aria-modal="true" aria-label="调酒助手" className={`assistant-panel ${expanded ? 'is-expanded' : ''}`} onKeyDown={e => {
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        close();
                    }
                    if (e.key === 'Tab') {
                        const nodes = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea, a[href], input') ?? []);
                        const first = nodes[0], last = nodes.at(-1);
                        if (e.shiftKey && document.activeElement === first) {
                            e.preventDefault();
                            last?.focus();
                        }
                        else if (!e.shiftKey && document.activeElement === last) {
                            e.preventDefault();
                            first?.focus();
                        }
                    }
                }}>
 <button className="assistant-handle" aria-label={expanded ? '缩小对话窗口' : '展开对话窗口'} onClick={() => { if (dragged.current) {
                dragged.current = false;
                return;
            } setExpanded(v => !v); }} onPointerDown={e => { dragged.current = false; dragY.current = e.clientY; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerUp={e => { const delta = e.clientY - dragY.current; if (Math.abs(delta) > 35) {
                dragged.current = true;
                setExpanded(delta < 0);
            } }}><span /></button>
 <header className="assistant-header"><div><strong>调酒助手</strong><p>正在聊：{surface.page.name}</p></div><button aria-label={expanded ? '缩小窗口' : '展开窗口'} onClick={() => setExpanded(v => !v)}>{expanded ? <ChevronDown size={18}/> : <ChevronUp size={18}/>}</button><button aria-label="收起助手" onClick={close}><X size={20}/></button></header>
 <div className="assistant-messages" role="log" aria-label="与调酒助手的对话" aria-live="polite">
 {task.messages.map((m, i) => <div key={i} className={`assistant-message ${m.role}`}>
 {!m.result ? <p>{m.content}</p> : <><p>{m.result.message}</p>{m.result.knowledge?.claims.map((c, j) => <p key={j}>{c.text}</p>)}{m.result.clarification && <p>{m.result.clarification}</p>}
 {m.result.recipes.map(r => <AssistantRecipeCard key={`${r.category}:${r.id}`} recipe={r} disabled={!validAction(m.result!)} onOpen={() => execute(r.action, m.result!)} />)}
 {m.result.actions.map((a, j) => <button key={j} className="assistant-action" disabled={!validAction(m.result!)} onClick={() => execute(a.action, m.result!)}>{a.label}<ArrowRight size={15}/></button>)}
 {m.result.pending?.kind === 'category' && i === task.messages.length - 1 && <div className="assistant-choices"><button disabled={busy} onClick={() => void send('经典酒')}>经典酒</button><button disabled={busy} onClick={() => void send('便利店调酒')}>便利店调酒</button></div>}
 {!!m.result.knowledge?.citations.length && <div className="assistant-sources"><strong>资料链接</strong>{m.result.knowledge.citations.map(c => <div key={c.id}>{c.sources.map(s => <a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.title}</a>)}</div>)}</div>}
 </>}
 </div>)}
 {busy && <div role="status" className="assistant-message assistant"><p>正在输入…</p><button onClick={stop}>停止</button></div>}
 {error && <div role="alert" className="assistant-error">{error}{retry && <button className="assistant-action" onClick={() => { update(s => ({...s,tasks:s.tasks.map(t => t.id !== s.active ? t : {...t,messages:t.messages.slice(0,t.messages.at(-1)?.role === "user" ? -1 : -2)})})); void send(retry); }}>重试这条消息</button>}</div>}
 {login && <a className="assistant-action" href={`/?auth=required&next=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/')}`}>登录后继续提问</a>}
 {confirm && <section className="assistant-confirm" role="group" aria-label="确认替换实验室内容"><p>实验室里已有调配内容，要保留当前内容，还是替换为这次选择的材料？</p><div className="assistant-choices"><button onClick={() => setConfirm(null)}>保留当前内容</button><button onClick={() => { execute(confirm.action, { taskId: confirm.taskId, contextVersion: confirm.version } as CompanionResult, true); setConfirm(null); }}>替换内容</button></div></section>}
 <div ref={end}/></div>
 <form className="assistant-composer" onSubmit={e => { e.preventDefault(); void send(); }}><label className="sr-only" htmlFor="companion-question">你的问题</label><textarea id="companion-question" ref={input} rows={2} value={task.draft} maxLength={1000} onChange={e => edit(e.target.value)} placeholder="输入你的问题…"/><button type="submit" disabled={busy || !task.draft.trim()} aria-label="发送问题"><Send size={18}/></button></form>
 </div></>}
 </div>, host)}</Context.Provider>;
}
