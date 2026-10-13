import { RagError } from '../knowledge/rag/core';

/** Server-only credentials; never silently fall back to another provider. */
export function chatConfig(tools = false) {
 const provider = 'deepseek';
 const prefix = 'DEEPSEEK';
 const key = process.env.DEEPSEEK_API_KEY?.trim();
 const model = process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-flash';
 const endpoint = process.env.DEEPSEEK_API_URL?.trim() || 'https://api.deepseek.com/chat/completions';
 if (!key) throw new RagError('NOT_CONFIGURED', `请在服务端配置 ${prefix}_API_KEY`);
 try { if (new URL(endpoint).protocol !== 'https:') throw Error(); }
 catch { throw new RagError('NOT_CONFIGURED', `${prefix}_API_URL 必须为 HTTPS 地址`); }
 return { provider, endpoint, key, model, options: provider === 'deepseek' ? { thinking: { type: 'disabled' } } : {} };
}
