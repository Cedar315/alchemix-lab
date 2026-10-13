import { AsyncLocalStorage } from 'node:async_hooks';
import { redact } from '../knowledge/review/contract';
const scope = new AsyncLocalStorage<{ requestId: string; entries: Array<{stage:string;data:Record<string,unknown>}> }>();
export const withAgentDiagnostics = <T>(requestId: string, run: () => T): T => scope.run({ requestId, entries: [] }, run);
export const diagnosticText = (text: string) => redact(text).replace(/(?:Bearer\s+|sk-|api[_-]?key\s*[:=]\s*)[^\s,;]+/gi, '[凭据已移除]');
export const diagnosticEntries = () => scope.getStore()?.entries || [];
export function diagnostic(stage: string, data: Record<string, unknown>) {
  const current = scope.getStore();
  if (current && current.entries.length < 40) current.entries.push({stage,data});
  if (current) console.info(JSON.stringify({ event: 'agent_diagnostic', requestId: current.requestId, stage, ...data }));
}
export async function timed<T>(stage: string, run: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try { const value = await run(); diagnostic(stage, { status: 'ok', elapsedMs: Date.now() - start }); return value; }
  catch (error) { diagnosticError(stage,error); diagnostic(stage, { status: 'error', elapsedMs: Date.now() - start, errorType: error instanceof Error ? error.name : 'UnknownError' }); throw error; }
}

export function diagnosticError(stage:string,error:unknown) {
 const e=error as {name?:string;message?:string;code?:string;cause?:{code?:string;message?:string}};
 const fields={type:e?.name||typeof error,code:e?.code,message:diagnosticText(e?.message||String(error)),cause:e?.cause?diagnosticText(e.cause.message||e.cause.code||''):undefined};
 diagnostic(stage,{status:'error',...fields});
 if(!scope.getStore()) console.warn(JSON.stringify({event:'agent_error',stage,...fields}));
}
