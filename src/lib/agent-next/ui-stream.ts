import { createUIMessageStream, toUIMessageStream } from 'ai';
import { z } from 'zod';
import type { startAgent } from './runtime';
import { validateLabAction } from './response';

// Keep the SDK wire protocol; project only the answer field, never raw JSON.
export function agentUIStream(result: ReturnType<typeof startAgent>, requestId: string, statements: string[], onEnd: (failed: boolean, cancelled: boolean) => Promise<void>) {
  let failed = false;
  return createUIMessageStream({
    onError: () => { failed = true; return `助手暂时无法完成回复，请重试（${requestId}）`; },
    onEnd: ({ isAborted, isCancelled }) => onEnd(failed, !!(isAborted || isCancelled)),
    execute: async ({ writer }) => {
      writer.write({ type: 'start', messageMetadata: { requestId } });
      let text = '', textId = 'answer', segment = 0;
      writer.write({ type: 'text-start', id: textId });
      const append = (next: string) => {
        if (!next.startsWith(text)) {
          writer.write({ type: 'text-end', id: textId });
          textId = `answer-${++segment}`; text = '';
          writer.write({ type: 'text-start', id: textId });
        }
        if (next.length > text.length) writer.write({ type: 'text-delta', id: textId, delta: next.slice(text.length) });
        text = next;
      };
      const forward = async () => {
        const reader = toUIMessageStream({ stream: result.stream, sendStart: false, sendFinish: false, sendReasoning: false }).getReader();
        try {
          while (true) {
            const { done, value } = await reader.read(); if (done) break;
            if (value.type === 'error') { failed = true; throw Error('Agent stream failed'); }
            if (!['text-start', 'text-delta', 'text-end', 'start-step', 'finish-step'].includes(value.type)) writer.write(value);
          }
        } finally { reader.releaseLock(); }
      };
      const project = async () => { for await (const partial of result.partialOutputStream) if (partial.message) append(partial.message); };
      await Promise.all([forward(), project()]);
      const output = await result.output;
      append(output.message);
      writer.write({ type: 'text-end', id: textId });
      const recipes = (await result.toolResults).filter(t => t.toolName === 'get_recipe').flatMap(t => {
        const parsed = z.object({ recipes: z.array(z.object({ recipeId: z.string(), ingredients: z.array(z.object({ name: z.string() })) })) }).safeParse(t.output);
        return parsed.success ? parsed.data.recipes : [];
      });
      writer.write({ type: 'data-lab-action', id: 'lab-action', data: validateLabAction(output.lab, statements, recipes) });
      writer.write({ type: 'finish', finishReason: 'stop' });
      writer.setOutcome({ status: 'completed' });
    },
  });
}
