import { failure } from './errors';
import { z } from 'zod';
import { needsKnowledgeFirst, isIceAmountQuestion, requestsRecommendation } from './intent';
import { agentRecipes, normalizeIngredient, type AgentRecipe } from './catalog';
export const inputSchema = z.object({
  question: z.string().trim().min(1).max(1000),
  inventory: z.array(z.object({ name: z.string().trim().min(1).max(80), amount: z.number().nonnegative().max(100000).nullable(), unit: z.literal('ml') }).strict()).max(40).default([]),
  excluded: z.array(z.string().trim().min(1).max(80)).max(40).default([]),
  unavailable: z.array(z.string().trim().min(1).max(80)).max(40).default([]),
  tools: z.array(z.enum(['杯子', '量杯', '搅拌勺'])).max(3).nullable().default(null),
  ice: z.boolean().nullable().default(null),
  iceEnough: z.boolean().nullable().default(null),
  toolAvailability: z.object({ '杯子': z.boolean().nullable(), '量杯': z.boolean().nullable(), '搅拌勺': z.boolean().nullable() }).strict().optional(),
  recipeId: z.string().max(100).optional(),
  context: z.string().max(2000).default(''),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(2000) }).strict()).max(6).default([]),
}).strict().superRefine((v, c) => { if (new Set(v.inventory.map(i => normalizeIngredient(i.name))).size !== v.inventory.length) c.addIssue({ code: 'custom', path: ['inventory'], message: '材料不能重复，请合并用量' }); });
export type AgentInput = z.infer<typeof inputSchema>;
export function checkRecipe(recipe: AgentRecipe, input: AgentInput) {
  const missing: string[] = [], unknown: string[] = [];
  for (const need of recipe.ingredients) {
    const key = normalizeIngredient(need.name);
    if ([...input.excluded, ...input.unavailable].some(v => normalizeIngredient(v) === key)) { missing.push(`${need.name}在排除项中`); continue; }
    const have = input.inventory.find(i => normalizeIngredient(i.name) === key);
    if (!have) missing.push(`缺少${need.name}`);
    else if (have.amount === null) unknown.push(`请确认${need.name}至少有 ${need.amount} ml`);
    else if (have.amount < need.amount) missing.push(`${need.name}不足 ${need.amount} ml`);
  }
  if (recipe.ice) {
    if (input.ice === false) missing.push('这杯需要冰块，你目前没有冰');
    else if (input.ice === null) unknown.push('你手边有冰块吗？');
    else if (input.iceEnough !== true) (input.iceEnough === false ? missing : unknown).push('这杯配方需要满杯冰块。请先看制作步骤，再确认冰是否够装满所用的杯子；有冰不代表已确认用量。');
  }
  for (const tool of recipe.tools) {
    const state = input.toolAvailability ? input.toolAvailability[tool as keyof NonNullable<AgentInput['toolAvailability']>] : input.tools === null ? null : input.tools.some(t => t === tool);
    if (state !== true) (state === false ? missing : unknown).push(state === false ? `缺少${tool}` : `尚未确认是否有${tool}`);
  }
  return { status: missing.length ? 'fail' as const : unknown.length ? 'needs_info' as const : 'pass' as const, missing, unknown };
}
export function findRecipes(input: AgentInput, query: string, omit: string[]) {
  return agentRecipes.filter(r => !omit.includes(r.id) && !r.ingredients.some(i => [...input.excluded, ...input.unavailable].some(e => normalizeIngredient(e) === normalizeIngredient(i.name))))
    .map(recipe => ({ recipe, check: checkRecipe(recipe, input), score: recipe.tags.filter(t => query.includes(t)).length + recipe.ingredients.filter(i => input.inventory.some(v => normalizeIngredient(v.name) === normalizeIngredient(i.name))).length * 2 }))
    .sort((a,b) => a.check.missing.length - b.check.missing.length || b.score - a.score).slice(0, 4);
}
const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('find_recipes'), query: z.string().max(300), omit: z.array(z.string().max(100)).max(10) }).strict(),
  z.object({ action: z.literal('check_recipe'), recipeId: z.string().max(100) }).strict(),
  z.object({ action: z.literal('search_knowledge'), question: z.string().trim().min(1).max(1000) }).strict(),
  z.object({ action: z.literal('finish'), recipeIds: z.array(z.string().max(100)).max(3), question: z.string().max(500) }).strict(),
]);
export type Trace = { tool: string; status: string; elapsedMs: number; recipeId?: string };
export type KnowledgeAnswer = { status: string; claims: { text: string; evidenceIds: string[] }[]; citations: { id: string; title: string; sources: { title: string; url: string }[] }[] };
export type AgentDependencies = {
  decide: (state: unknown, signal: AbortSignal) => Promise<{ value: unknown; model: string; usage: unknown }>;
  search: (question: string, context: string, signal: AbortSignal) => Promise<KnowledgeAnswer>;
};
export async function runAgent(input: AgentInput, deps: AgentDependencies, signal: AbortSignal = AbortSignal.timeout(45000)) {
  const trace: Trace[] = [], observations: unknown[] = [], checked = new Map<string, ReturnType<typeof checkRecipe>>();
  const discovered = new Set<string>();
  const usage: unknown[] = [];
  const searches = new Set<string>();
  let searchExhausted=false;
  let knowledge: KnowledgeAnswer | null = null, model = '';
  const result = (status: string, message: string, recipes: AgentRecipe[] = [], clarification = '') => ({ status, message, clarification, recipes, knowledge, trace, model, usage });
  async function searchKnowledge(question: string) {
    const key=question.replace(/\s+/g,'').toLowerCase();
    if(searches.has(key) || searches.size>=2) {searchExhausted=true;return knowledge;}
    searches.add(key);
    const start = Date.now();
    try {
      signal.throwIfAborted();
      const recipe = agentRecipes.find(r => r.id === input.recipeId);
      const found = await deps.search(question, JSON.stringify({ recipe, userContext: input.context, history: input.history }), signal);
      observations.push({ tool: 'search_knowledge', question, answer: found });
      trace.push({ tool: 'search_knowledge', status: found.status, elapsedMs: Date.now()-start });
      return found;
    } catch {
      trace.push({ tool: 'search_knowledge', status: 'error', elapsedMs: Date.now()-start });
      observations.push({ tool: 'search_knowledge', error: '检索失败。请围绕当前做法问题追问必要背景或提示重试，不得编造答案。' });
      return null;
    }
  }
  if (input.ice === false && agentRecipes.every(r=>r.ice) && !needsKnowledgeFirst(input.question) && (requestsRecommendation(input.question) || (input.question.length < 30 && input.history.some(h=>h.role==='user' && requestsRecommendation(h.content))))) {
    return result('no_candidates','你目前没有冰，而现有配方都需要冰，暂时没有符合条件的推荐。你方便准备一些冰块吗？');
  }
  // Supplies and form visibility must never prevent looking up a technique question.
  if (needsKnowledgeFirst(input.question)) {
    knowledge = await searchKnowledge(input.question);
    // The RAG answer is already evidence-checked. A pure technique question does
    // not need a second model loop to restate it or repeatedly retrieve it.
    if (!requestsRecommendation(input.question)) {
      if (!knowledge) return result(signal.aborted ? 'timeout' : 'unavailable', '暂时无法查阅资料，请稍后重试。');
      const clarification = knowledge.status === 'answered' ? '' : isIceAmountQuestion(input.question)
        ? input.context || input.recipeId ? '你用的杯子容量大约多少？配方有没有说明加冰方法或用量？' : '你在做哪杯酒，用什么杯子？也可以补充配方和杯子容量。'
        : '请补充你正在做的配方和具体操作，便于核对适用做法。';
      return result(knowledge.status, '已查阅调酒资料。', [], clarification);
    }
  }
  for (let step = 0; step < 7; step++) {
    try {
      signal.throwIfAborted();
      const decision = await deps.decide({ input, observations, remainingTools: 6 - trace.length }, signal);
      model = decision.model; usage.push(decision.usage);
      signal.throwIfAborted();
      const parsedAction = actionSchema.safeParse(decision.value);
      if (!parsedAction.success) {
        if (step < 6) { observations.push({error:'动作格式错误。只返回协议中的一个动作；finish 只允许 action、recipeIds 数组、question 字符串，不添加回答或其他字段。'}); continue; }
        throw parsedAction.error;
      }
      const action = parsedAction.data;
      if (action.action === 'finish') {
        const ids = [...new Set(action.recipeIds)];
        const recipes = ids.map(id => agentRecipes.find(r => r.id === id)).filter((r): r is AgentRecipe => !!r);
        if (ids.length && (recipes.length !== ids.length || recipes.some(r => !discovered.has(r.id) || checked.get(r.id)?.status !== 'pass' || checkRecipe(r,input).status !== 'pass'))) {
          observations.push({ error: '最终配方必须先查询并通过 check_recipe；缺料或未知数量时请追问，不能声称可制作。' }); continue;
        }
        if (!recipes.length && input.ice === false && trace.some(t=>t.tool==='find_recipes') && agentRecipes.every(r=>r.ice)) return result('no_candidates', '你目前没有冰，而现有配方都需要冰，暂时没有符合条件的推荐。你方便准备一些冰块吗？');
        // Recipe instructions and readiness claims are rendered by code, never from model prose.
        return result(recipes.length ? 'ready' : knowledge ? knowledge.status : 'needs_info', recipes.length ? '以下为任选一杯的配方，已通过本次材料、用量和器具检查。' : knowledge ? '已查阅调酒资料。' : action.question || '请补充材料数量、冰和器具，或调整材料条件。', recipes, knowledge ? action.question || (isIceAmountQuestion(input.question) && knowledge.status !== 'answered' ? '你在做哪杯酒，用什么杯子？也可以发一下配方和杯子容量。' : '') : '');
      }
      if (trace.length >= 6) break;
      const start = Date.now();
      try {
        if (action.action === 'find_recipes') {
          const candidates = findRecipes(input, action.query, action.omit);
          candidates.forEach(c => discovered.add(c.recipe.id));
          observations.push({ tool: action.action, candidates });
          trace.push({ tool: action.action, status: candidates.length ? 'ok' : 'empty', elapsedMs: Date.now()-start });
        } else if (action.action === 'check_recipe') {
          const recipe = agentRecipes.find(r => r.id === action.recipeId && discovered.has(r.id));
          if (!recipe) throw new Error('Unknown recipe');
          const check = checkRecipe(recipe,input); checked.set(recipe.id,check);
          observations.push({ tool: action.action, recipeId: recipe.id, ...check });
          trace.push({ tool: action.action, recipeId: recipe.id, status: check.status, elapsedMs: Date.now()-start });
          if (check.status === 'pass' && input.question.includes(recipe.name) && requestsRecommendation(input.question) && !needsKnowledgeFirst(input.question)) {
            return result('ready','这杯已通过材料、用量和器具检查。',[recipe]);
          }
        } else {
          knowledge = await searchKnowledge(action.question);
          if(searchExhausted) return result('insufficient_evidence','现有资料不足，我无法可靠回答这个问题。');
        }
      } catch {
        trace.push({ tool: action.action, status: 'error', elapsedMs: Date.now()-start });
        observations.push({ tool: action.action, error: '工具失败，请改用可靠结果或追问，不得声称成功。' });
      }
    } catch (error) {
      const detail = failure(error, signal.aborted);
      return { ...result(detail.code === 'TIMEOUT' ? 'timeout' : 'unavailable', detail.message), errorCode: detail.code };
    }
  }
  return result('limit', '本次检查已达到执行上限，请缩小问题范围后重试。');
}
