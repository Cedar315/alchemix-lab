'use client';
import { createContext, useContext, type MutableRefObject } from 'react';
import type { UIMessage } from 'ai';

export type ConversationSnapshot = { messages: UIMessage[]; draft: string; taskId: string; owner: string | null; scroll: number };
export const ConversationMemory = createContext<{
  snapshot: MutableRefObject<ConversationSnapshot | null>;
  depart: (href: string) => void;
  resetReturn: () => void;
} | null>(null);
export const useConversationMemory = () => useContext(ConversationMemory);
