import { z } from 'zod';
import type { KnowledgeAnswer, Trace } from './core';
export const preparationInput = z.object({
  question:z.string().trim().min(1).max(1000), context:z.string().max(2000).default(''),
  history:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().max(2000)}).strict()).max(12).default([]),
}).strict();
export type PreparationInput=z.infer<typeof preparationInput>;
export const intentSchema=z.object({
  intent:z.enum(['recommend','knowledge','guide','troubleshoot','change','operate','out_of_scope','unclear']),
  dialogueAct:z.enum(['new_task','answer','correction','feedback','cancel']),
  taskRelation:z.enum(['new','continue']),
  question:z.string().max(500),
  knowledgeQuestion:z.string().max(1000),
  destination:z.enum(['finder','lab','explore','records','']).nullable().optional(),
}).strict();
export const actionSchema=z.discriminatedUnion('action',[
  z.object({action:z.literal('read_recipe')}).strict(),
  z.object({action:z.literal('search_knowledge'),question:z.string().min(1).max(1000)}).strict(),
  z.object({action:z.literal('check_capacity'),capacity:z.number().positive().max(10000),current:z.number().nonnegative().max(10000),addition:z.number().nonnegative().max(10000),evidence:z.string().min(1).max(1000)}).strict(),
  z.object({action:z.literal('clarify'),question:z.string().min(1).max(500)}).strict(),
  z.object({action:z.literal('finish')}).strict(),
]);
export type PreparationDeps={
  model:(stage:'intent'|'action',state:unknown,signal:AbortSignal)=>Promise<{value:unknown;model:string;usage:unknown}>;
  search:(question:string,context:string,signal:AbortSignal)=>Promise<KnowledgeAnswer>;
};
export const destinations={finder:{label:'去首页选酒',href:'/?tab=ASSISTANT'},lab:{label:'打开调配实验室',href:'/?tab=LAB'},explore:{label:'浏览配方',href:'/?tab=INSPIRATION'},records:{label:'打开我的记录',href:'/?tab=MY'}};
export async function runPreparation(input:PreparationInput,deps:PreparationDeps,signal=AbortSignal.timeout(45000)) {
  const trace:Trace[]=[], usage:unknown[]=[], observations:unknown[]=[], calculations:{text:string;capacity:number;current:number;addition:number}[]=[];
  let knowledge:KnowledgeAnswer|null=null, model='', intent:z.infer<typeof intentSchema>|null=null;
  const result=(status:string,message:string,clarification='',handoff:typeof destinations[keyof typeof destinations]|null=null)=>({status,message,clarification,knowledge,calculations,handoff,trace,model,usage,intent,recipes:[]});
  const call=async(stage:'intent'|'action',state:unknown)=>{signal.throwIfAborted();const r=await deps.model(stage,state,signal);signal.throwIfAborted();usage.push(r.usage);model=r.model;return r.value;};
  const search=async(question:string)=>{
    const start=Date.now();
    try {
      const answer=await deps.search(question,JSON.stringify({recipeContext:input.context,userConversation:input.history,currentQuestion:input.question,calculations}),signal);
      signal.throwIfAborted();
      if(answer.status==='answered'&&(!answer.claims.length||answer.claims.some(c=>!c.evidenceIds.length||c.evidenceIds.some(id=>!answer.citations.some(s=>s.id===id)))))throw Error('Unsupported answer');
      if(answer.status==='answered' && knowledge?.status==='answered') {
        const claims=[...knowledge.claims,...answer.claims].filter((c,i,a)=>a.findIndex(v=>v.text===c.text)===i);
        const citations=[...knowledge.citations,...answer.citations].filter((c,i,a)=>a.findIndex(v=>v.id===c.id)===i);
        knowledge={status:'answered',claims,citations};
      } else if(!knowledge || answer.status==='answered') knowledge=answer;
      trace.push({tool:'search_knowledge',status:answer.status,elapsedMs:Date.now()-start});
      observations.push({tool:'search_knowledge',question,answer});
    } catch {trace.push({tool:'search_knowledge',status:'error',elapsedMs:Date.now()-start});observations.push({tool:'search_knowledge',error:'服务失败，不得声称查询成功；可追问或结束。'});}
  };
  try {
    signal.throwIfAborted();
    if(!input.history.length && !input.context && /^(?:\d+(?:\.\d+)?|是的|有|没有|好了)[。！!]*$/.test(input.question)) {
      intent={intent:'unclear',dialogueAct:'new_task',taskRelation:'new',question:'你指的是哪杯酒、哪项用量或哪一步操作？',knowledgeQuestion:'',destination:''};
      return result('needs_info','',intent.question);
    }
    const firstIntent=await call('intent',input);
    const parsedIntent=intentSchema.safeParse(firstIntent);
    intent=parsedIntent.success?parsedIntent.data:intentSchema.parse(await call('intent',{input,protocolErrors:parsedIntent.error.issues.map(i=>({path:i.path,message:i.message})),instruction:'上次输出不符合协议，请重新识别并返回合法字段。'}));
    if(intent.dialogueAct==='cancel')return result('cancelled','已结束这次制作问题。');
    if(intent.intent==='recommend'||intent.intent==='operate') {
      const target=intent.intent==='recommend'?'finder':intent.destination;
      if(!target)return result('needs_info','','你想打开选酒、调配实验室、配方浏览，还是个人记录？');
      if(intent.knowledgeQuestion)await search(intent.knowledgeQuestion);
      return result('handoff',intent.intent==='recommend'?'选酒继续使用首页的材料和口味筛选；选好后可以带配方来问制作问题。':'请在原有页面完成这项操作。','',destinations[target]);
    }
    if(intent.intent==='out_of_scope')return result('out_of_scope','我可以帮助理解调酒知识、核对制作步骤和排查当前这杯的问题；无法处理这个请求。');
    if(intent.intent==='unclear')return result('needs_info','',intent.question||'你指的是哪杯酒或哪一步操作？');
    if(intent.question && ['knowledge','guide','troubleshoot','change'].includes(intent.intent)) return result('needs_info','',intent.question);
    if(intent.intent==='knowledge') {
      await search(intent.knowledgeQuestion||input.question);
      return result((knowledge as KnowledgeAnswer|null)?.status||'unavailable',(knowledge as KnowledgeAnswer|null)?.status==='answered'?'已根据资料回答。':'现有资料不足以可靠回答。');
    }
    const seen=new Set<string>();
    for(let step=0;step<6;step++) {
      const action=actionSchema.parse(await call('action',{input,intent,observations,remainingTools:6-trace.length}));
      if(action.action==='clarify')return result('needs_info','',action.question);
      if(action.action==='finish')return result((knowledge as KnowledgeAnswer|null)?.status==='answered'||calculations.length?'answered':'insufficient_evidence',knowledge||calculations.length?'已核对本次制作信息。':'现有信息不足以给出可靠的下一步，请补充实际操作和用量。');
      const key=JSON.stringify(action);
      if(seen.has(key)){observations.push({error:'该工具和参数已经执行，不能重复查询；请追问缺失事实或 finish。'});continue;}seen.add(key);
      if(action.action==='read_recipe') {
        observations.push({tool:action.action,recipe:input.context||null,note:'这是页面配方或用户提供的背景，不代表实际已加入的量，不是独立知识证据。'});
        trace.push({tool:action.action,status:input.context?'ok':'missing',elapsedMs:0});
      } else if(action.action==='search_knowledge')await search(action.question);
      else {
        // Only explicit user-authored measurements may enter the calculator.
        // Require all labelled amounts together in a quoted user statement, not model numbers.
        const latestUserText=input.question;
        const measurements=[['容量',action.capacity],['已有',action.current],['拟加',action.addition]] as const;
        const supported=latestUserText.includes(action.evidence)&&measurements.every(([label,n])=>new RegExp(`${label}\\s*[:：]?\\s*${n}(?:\\.0+)?\\s*(?:ml|毫升)(?![\\d.])`,'i').test(action.evidence));
        if(!supported){observations.push({tool:action.action,error:'计算需要用户本轮明确填写：容量 X ml、已有 Y ml、拟加 Z ml。不能使用原配方用量或猜测值。'});trace.push({tool:action.action,status:'needs_info',elapsedMs:0});continue;}
        const total=Math.round((action.current+action.addition)*1000)/1000;
        const text=`按你提供的液体用量，${action.current} + ${action.addition} = ${total} ml，${total>action.capacity?'超过':'未超过'} ${action.capacity} ml 容器容量。未计冰块占用空间；这不代表实际可装下，也不代表该调整的风味或安全性已验证。`;
        calculations.push({text,capacity:action.capacity,current:action.current,addition:action.addition});observations.push({tool:action.action,text});trace.push({tool:action.action,status:'ok',elapsedMs:0});
      }
    }
    return result('limit','本次处理已达到执行上限，请补充新信息后再试。');
  } catch(error) {return {...result(signal.aborted?'timeout':'unavailable','助手暂时未能完成处理，请稍后重试。'),errorCode:error instanceof z.ZodError?'INVALID_PROTOCOL':signal.aborted?'TIMEOUT':'PROVIDER_OR_OUTPUT_ERROR'};}
}
