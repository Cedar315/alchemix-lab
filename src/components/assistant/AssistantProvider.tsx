'use client';
import type { ReactNode } from 'react';
import LegacyAssistantProvider from './LegacyAssistantProvider';
import StreamingAssistantProvider from './StreamingAssistantProvider';
export { AssistantSurface } from './AssistantSurface';
export default function AssistantProvider({ children, legacy = false }: { children: ReactNode; legacy?: boolean }) {
  return legacy ? <LegacyAssistantProvider>{children}</LegacyAssistantProvider> : <StreamingAssistantProvider>{children}</StreamingAssistantProvider>;
}
