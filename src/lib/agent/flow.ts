import { agentRecipes, normalizeIngredient } from './catalog';
import { runAgent as runTools, findRecipes, type AgentInput, type AgentDependencies, type KnowledgeAnswer, type Trace } from './core';
import { needsKnowledgeFirst, requestsRecommendation, isIceAmountQuestion } from './intent';
import { failure } from './errors';

// A supply reply continues the previous task; a new question is routed on its own.
export function isRecommendation(input: AgentInput) {
  if (requestsRecommendation(input.question) || /(?:想喝|想做|调一杯|一杯.*酒)/.test(input.question)) return true;
  if (needsKnowledgeFirst(input.question) || /[?？]|怎么|为什么|如何|能否|多少|是什么/.test(input.question)) return false;
  const last = input.history.at(-1);
  if (last?.role === 'assistant' && /^你还有.+吗[？?]$/.test(last.content) && /^(?:没有|没有了|没了|有|有的|有了|(?:我)?(?:现在)?(?:没有|有).+|.+(?:没有了|用完了|买到了))[。！!]*$/.test(input.question) && !/[?？]|怎么|为什么|如何/.test(input.question)) return true;
  const previous=input.history.filter(h=>h.role==='user').some(h=>requestsRecommendation(h.content) || /想喝|调一杯/.test(h.content));
  return previous && /金酒|伏特加|朗姆|威士忌|苏打|汤力|冰|毫升|ml|杯|量|有|没有|经典|清爽|甜|苦|^\d+$|^够了$|^是的$|^不够$/.test(input.question);
}

export async function runAgent(input: AgentInput, deps: AgentDependencies, signal: AbortSignal = AbortSignal.timeout(45000)) {
  const trace: Trace[]=[];
  const finish=(status:string,message:string,knowledge:KnowledgeAnswer|null=null,clarification='')=>({status,message,knowledge,clarification,recipes:[],trace,model:'',usage:[] as unknown[]});
  if(signal.aborted){const detail=failure(null,true);return {...finish('timeout',detail.message),errorCode:detail.code};}
  if(!isRecommendation(input)) {
    // search is the DB retrieval + evidence-only generation service. No free-form fallback.
    try {
      const start=Date.now();
      const knowledge=await deps.search(input.question,JSON.stringify({userContext:input.context,history:input.history,recipeId:input.recipeId}),signal);
      trace.push({tool:'search_knowledge',status:knowledge.status,elapsedMs:Date.now()-start});
      const supported=knowledge.claims.every(c=>c.evidenceIds.length>0 && c.evidenceIds.every(id=>knowledge.citations.some(s=>s.id===id)));
      if(!supported) return finish('insufficient_evidence','检索资料不足以支持这次回答，我无法可靠回答这个问题。');
      if(knowledge.status==='answered' && knowledge.claims.length) return finish('answered','已根据检索资料回答。',knowledge);
      if(isIceAmountQuestion(input.question) && !input.context && !input.recipeId) return finish('needs_info','',knowledge,'你正在做哪一杯酒？');
      return finish(knowledge.status==='no_evidence'?'no_evidence':'insufficient_evidence','现有资料不足，我无法可靠回答这个问题。',knowledge);
    } catch(error) {
      const detail=failure(error,signal.aborted);
      trace.push({tool:'search_knowledge',status:'error',elapsedMs:0});
      return {...finish(detail.code==='TIMEOUT'?'timeout':'unavailable',detail.message),errorCode:detail.code};
    }
  }
  // Query the reviewed recipe catalogue before any model decision.
  const start=Date.now();
  const candidates=findRecipes(input,input.question,[]);
  trace.push({tool:'find_recipes',status:candidates.length?'ok':'empty',elapsedMs:Date.now()-start});
  if(!candidates.length) return finish('no_candidates','当前配方库里没有符合这些条件的配方。');
  if(input.ice===false && agentRecipes.every(r=>r.ice)) return finish('no_candidates','当前配方库里的配方都需要冰。你目前没有冰，因此没有符合条件的配方；出杯不带冰也不等于制作时不需要冰。');
  if(!input.inventory.length) return finish('needs_info','',null,'你手边有哪些酒或饮料？');
  const named=agentRecipes.find(r=>input.question.includes(r.name));
  const eligible=named ? candidates.filter(c=>c.recipe.id===named.id) : candidates;
  if(!eligible.length) return finish('no_candidates','当前条件不满足这杯配方，不能把它推荐为可制作。');
  const compatible=eligible.filter(c=>c.check.missing.length===0);
  if(!compatible.length) {
    const candidate=eligible[0];
    // Unlisted ingredients have not necessarily been denied. Ask about just one.
    const missing=candidate.recipe.ingredients.find(i=>!input.inventory.some(v=>normalizeIngredient(v.name)===normalizeIngredient(i.name)) && !input.excluded.some(e=>normalizeIngredient(e)===normalizeIngredient(i.name)));
    if(missing && !/只有|仅有|就这些/.test([input.question,...input.history.filter(h=>h.role==='user').map(h=>h.content)].join(' '))) return finish('needs_info','',null,`你还有${missing.name}吗？`);
    return finish('no_candidates','当前配方库里没有符合已确认材料和制作条件的配方。');
  }
  if(!compatible.some(c=>c.check.status==='pass')) return finish('needs_info','',null,compatible[0].check.unknown[0]);
  // The model may select among checked candidates, but cannot invent a recipe.
  const result=await runTools(input,deps,signal);
  return {...result,trace:[...trace,...result.trace]};
}
