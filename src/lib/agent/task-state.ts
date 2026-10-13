import { z } from 'zod';
export const factSchema = z.object({value:z.string().max(1000),certainty:z.enum(['exact','estimated','unknown']),source:z.literal('user')});
export const taskStateSchema = z.object({goal:z.string().max(1000),recipeKey:z.string().max(250),awaitingField:z.string().max(100),facts:z.record(factSchema).refine(v=>Object.keys(v).length<=60),lastAct:z.enum(['answer','correction','unknown','new_task'])});
export type TaskState=z.infer<typeof taskStateSchema>;
export const startsNewTask=(text:string)=>/另外|换个话题|打开|帮我推荐|为什么|能不能|如何|是什么/.test(text);
export function mergeTaskState(previous:TaskState|undefined,goal:string,recipeKey:string,awaitingField:string,text:string):TaskState {
 const compatible=previous?.recipeKey===recipeKey&&!startsNewTask(text);
 const facts={...(compatible?previous.facts:{})};
 const field=compatible?previous.awaitingField:awaitingField;
 const unknown=/^(?:我)?(?:也|还|都)?(?:不知道|不记得(?:了)?|不确定|不清楚)[。！!]*$/.test(text.trim());
 const correction=/不是|说错|其实/.test(text);
 const estimated=/大概|大约|约|差不多|左右|估计/.test(text);
 // Semantic fields require their domain validator; arbitrary text is not a resolved enum.
 if(field && (unknown || !['amountMeaning','mixingStage'].includes(field)))facts[field]={value:unknown?'':text.slice(0,1000),certainty:unknown?'unknown':estimated?'estimated':'exact',source:'user'};
 return {goal:compatible?previous.goal:goal,recipeKey,awaitingField:field,facts,lastAct:unknown?'unknown':correction?'correction':compatible?'answer':'new_task'};
}
export function knownFacts(state:TaskState){return Object.entries(state.facts).filter(([,f])=>f.certainty!=='unknown').map(([key,f])=>`${({actualMaterials:'实际材料',actualSteps:'实际操作',availableMaterials:'手边材料',missingMaterial:'缺少材料',category:'酒谱类别',detail:'补充信息'} as Record<string,string>)[key]||'已知信息'}：${f.value}${f.certainty==='estimated'?'（估计）':''}`).join('；');}
