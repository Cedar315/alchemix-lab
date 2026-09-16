import { agentRecipes, normalizeIngredient } from './catalog';
import { inputSchema, type AgentInput } from './core';

// Resolve only explicit stock statements and replies to our single-material question.
// Persist absence separately from taste exclusions, even after history is truncated.
export function stockUpdates(input: AgentInput) {
  const names = [...new Set(agentRecipes.flatMap(r => r.ingredients.map(i => normalizeIngredient(i.name))))];
  const updates = new Map<string, boolean>();
  const messages = [...input.history, { role: 'user' as const, content: input.question }];
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (message.role !== 'user') continue;
    const text = message.content.trim().replace(/[。！!]+$/, '');
    const previous = messages[i - 1];
    const asked = previous?.role === 'assistant' ? previous.content.match(/^你还有(.+)吗[？?]$/)?.[1] : undefined;
    if (asked && names.includes(normalizeIngredient(asked)) && /^(没有|没有了|没了|有|有的|有了)$/.test(text)) updates.set(normalizeIngredient(asked), /^有/.test(text));
    for (const clause of text.split(/[,，。；;\n]/)) {
      for (const name of names) {
        if ([`没有${name}`, `${name}没有了`, `${name}用完了`, `我没有${name}`].includes(clause.trim())) updates.set(name, false);
        if ([`有${name}`, `我有${name}`, `现在有${name}`, `买了${name}`, `${name}买到了`].includes(clause.trim())) updates.set(name, true);
      }
    }
  }
  return updates;
}

// Only supplies are model editable; identity, history and recipe validation stay outside.
export const suppliesSchema = inputSchema.innerType().pick({ inventory:true, excluded:true, unavailable:true, ice:true, iceEnough:true, toolAvailability:true, tools:true });
export function mergeSupplies(input: AgentInput, value: unknown): AgentInput {
  const supplies = suppliesSchema.parse(value);
  const unavailable = new Set(input.unavailable.map(normalizeIngredient));
  const updates = stockUpdates(input);
  for (const [name, present] of updates) {
    if (present) unavailable.delete(name); else unavailable.add(name);
  }
  supplies.unavailable = [...unavailable];
  supplies.inventory = supplies.inventory.filter(i => !unavailable.has(normalizeIngredient(i.name)));
  // A short “有” is ownership evidence only for the exact material just asked about.
  for (const [name, present] of updates) if (present && !supplies.inventory.some(i => normalizeIngredient(i.name) === name)) supplies.inventory.push({name, amount:null, unit:'ml'});
  const userText=[...input.history.filter(h=>h.role==='user').map(h=>h.content),input.question].join('\n').toLowerCase();
  // Reject invented ingredients: assistant examples and model guesses are not ownership evidence.
  supplies.inventory=supplies.inventory.filter(item=>{
    const name=normalizeIngredient(item.name);
    return updates.get(name) === true || input.inventory.some(i=>normalizeIngredient(i.name)===name) || userText.includes(name) || userText.split(/[\s,，。；;、]+/).some(word=>normalizeIngredient(word)===name);
  });
  return inputSchema.parse({ ...input, ...supplies });
}
