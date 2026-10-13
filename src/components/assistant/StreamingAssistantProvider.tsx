'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import { ConversationMemory, type ConversationSnapshot } from './ConversationMemory';
import { MessageCircle, X, ChevronUp, ChevronDown } from 'lucide-react';
import type { PageContext } from '@/lib/agent/companion-contract';
import { AssistantContext } from './AssistantSurface';
import StreamingConversation from './StreamingConversation';

export default function StreamingAssistantProvider({ children }: { children: ReactNode }) {
  const router = useRouter(), pathname = usePathname();
  const snapshot = useRef<ConversationSnapshot | null>(null);
  const [returnTo, setReturnTo] = useState<{ target: string; origin: string; fullPage: boolean } | null>(null);
  const [location, setLocation] = useState('');
  const [surface, setPage] = useState<{ owner: string; page: PageContext } | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null), [open, setOpen] = useState(false), [expanded, setExpanded] = useState(false);
  const panel = useRef<HTMLDivElement>(null), launcher = useRef<HTMLButtonElement>(null), dragY = useRef(0), dragged = useRef(false);
  const setSurface = useCallback((owner: string, page: PageContext | null) => setPage(prev => page ? { owner, page } : prev?.owner === owner ? null : prev), []);
  const context = surface ? JSON.stringify(surface.page) : '';
  useEffect(() => { setHost(document.querySelector<HTMLElement>('[data-app-shell]')); setLocation(window.location.pathname + window.location.search); }, [surface?.owner, pathname, context]);
  useEffect(() => { setOpen(false); }, [surface?.owner, pathname]);
  const canReturn = !!returnTo && returnTo.target === location;
  useEffect(() => { if (!host) return; if (canReturn && !open) host.setAttribute('data-chat-return', 'true'); else host.removeAttribute('data-chat-return'); return () => host.removeAttribute('data-chat-return'); }, [host, canReturn, open]);
  function depart(href: string) { setReturnTo({ target: href, origin: window.location.pathname + window.location.search, fullPage: pathname === '/ask' }); close(); }
  function returnToChat() { if (returnTo?.fullPage) router.push(returnTo.origin); else setOpen(true); }
  function close() { setOpen(false); setTimeout(() => launcher.current?.focus(), 0); }
  return <ConversationMemory.Provider value={{ snapshot, depart, resetReturn: () => setReturnTo(null) }}><AssistantContext.Provider value={{ setSurface }}>{children}{surface && host && createPortal(<div className="assistant-root">
    {canReturn && !open && <button type="button" className="assistant-return" onClick={returnToChat}>← 返回聊天</button>}
    {!open && <button ref={launcher} type="button" aria-label="打开调酒助手" className="assistant-launcher" onClick={() => setOpen(true)}><MessageCircle size={23} /></button>}
    {open && <button className="assistant-backdrop" aria-label="收起调酒助手" onClick={close} />}
    <div hidden={!open} style={!open ? { display: 'none' } : undefined} ref={panel} role="dialog" aria-modal="true" aria-label="调酒助手" className={`assistant-panel ${expanded ? 'is-expanded' : ''}`} onKeyDown={e => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      if (e.key === 'Tab') {
        const nodes = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), a[href], summary') ?? []);
        const first = nodes[0], last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }}>
      <button className="assistant-handle" aria-label={expanded ? '缩小对话窗口' : '展开对话窗口'} onClick={() => { if (dragged.current) { dragged.current = false; return; } setExpanded(v => !v); }} onPointerDown={e => { dragged.current = false; dragY.current = e.clientY; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerUp={e => { const delta = e.clientY - dragY.current; if (Math.abs(delta) > 35) { dragged.current = true; setExpanded(delta < 0); } }}><span /></button>
      <header className="assistant-header"><div><strong>调酒助手</strong><p>当前页面：{surface.page.name}</p></div><button aria-label={expanded ? '缩小窗口' : '展开窗口'} onClick={() => setExpanded(v => !v)}>{expanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}</button><button aria-label="收起助手" onClick={close}><X size={20} /></button></header>
      <StreamingConversation context={context} page={surface.page} active={open} onNavigate={close} />
    </div>
  </div>, host)}</AssistantContext.Provider></ConversationMemory.Provider>;
}
