import { startAgent } from '../agent-next/runtime';
import { agentUIStream } from '../agent-next/ui-stream';
import type { LabAction } from '../agent-next/response';

// Consume the same validated output as the user-facing route, without product telemetry.
export async function evaluateCurrentAgent(input: {
  id: string; question: string; context: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  signal: AbortSignal;
}, run = startAgent) {
  const messages = [...input.history, { role: 'user' as const, content: input.question }];
  const statements = messages.filter(m => m.role === 'user').map(m => m.content);
  const result = run({ messages, context: input.context, userStatements: statements, signal: input.signal });
  let failed = false;
  let lab: LabAction = { kind: 'none' };
  const reader = agentUIStream(result, input.id, statements, async (error, cancelled) => {
    failed ||= error || cancelled;
  }).getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.type === 'error') failed = true;
      if (value.type === 'data-lab-action') lab = value.data as LabAction;
    }
  } finally { reader.releaseLock(); }
  input.signal.throwIfAborted();
  if (failed) throw Error('Agent evaluation failed');
  const output = await result.output;
  const steps = await result.steps;
  return {
    status: 'answered', runtime: 'agent-next', message: output.message, lab,
    model: process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-flash',
    usage: await result.usage,
    // Do not persist provider responses or internal reasoning.
    tools: steps.flatMap(s => s.toolResults.map(t => ({
      tool: t.toolName, input: t.input, output: t.output,
    }))),
  };
}
