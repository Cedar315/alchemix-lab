import seed from '../knowledge/mixing-techniques.json';
import { documentSchema } from '../knowledge/rag/core';
import type { KnowledgeAnswer } from './core';
const document = documentSchema.parse(seed.entries[0]);

export function techniqueKnowledgeFor(question: string): KnowledgeAnswer | null {
    if (!/摇|shake/i.test(question) || !/多久|几秒/.test(question)) return null;
    // Carbonated and special techniques need their own retrieved instructions.
    if (/苏打|气泡|汽水|可乐|啤酒|干摇|蛋白|分层|结块|絮|混不开|混不匀|蜂蜜|实际操作|实际使用/.test(question)) return null;
    return {
        status: 'answered',
        claims: [{ text: document.answer, evidenceIds: [document.id] }],
        citations: [{ id: document.id, title: document.title, sources: document.sources }],
    };
}
