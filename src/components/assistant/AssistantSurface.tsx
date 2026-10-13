'use client';
import { createContext, useCallback, useContext, useEffect, useId } from 'react';
import type { PageContext } from '@/lib/agent/companion-contract';
export const AssistantContext = createContext<{ setSurface: (owner: string, page: PageContext | null) => void }>({ setSurface: () => {} });
export function AssistantSurface({ context }: { context: PageContext }) {
  const { setSurface } = useContext(AssistantContext);
  const owner = useId(), text = JSON.stringify(context);
  const clear = useCallback(() => setSurface(owner, null), [owner, setSurface]);
  useEffect(() => { setSurface(owner, JSON.parse(text)); }, [owner, setSurface, text]);
  useEffect(() => clear, [clear]);
  return null;
}
