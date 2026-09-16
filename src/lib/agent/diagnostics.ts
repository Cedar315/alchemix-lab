import { AsyncLocalStorage } from 'node:async_hooks';
import { redact } from '../knowledge/review/contract';
const scope = new AsyncLocalStorage<{ requestId: string }>();
export const withAgentDiagnostics = <T>(requestId: string, run: () => T): T => scope.run({ requestId }, run);
export const diagnosticText = (text: string) => redact(text).replace(/(?:Bearer\s+|sk-|api[_-]?key\s*[:=]\s*)[^\s,;]+/gi, '[凭据已移除]');
export function diagnostic(stage: string, data: Record<string, unknown>) {
  const current = scope.getStore();
  if (current) console.info(JSON.stringify({ event: 'agent_diagnostic', requestId: current.requestId, stage, ...data }));
}
export async function timed<T>(stage: string, run: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try { const value = await run(); diagnostic(stage, { status: 'ok', elapsedMs: Date.now() - start }); return value; }
  catch (error) { diagnostic(stage, { status: 'error', elapsedMs: Date.now() - start, errorType: error instanceof Error ? error.name : 'UnknownError' }); throw error; }
}
