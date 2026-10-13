'use client';
import { useEffect,useState } from 'react';
import TaskFeedback from './TaskFeedback';
const evaluated=new Set<string>();
export default function DeferredTaskFeedback({requestId,taskId,status,draft,busy,closed=false}:{requestId:string;taskId:string;status:string;draft:string;busy:boolean;closed?:boolean}){
 const [visible,setVisible]=useState(false),[done,setDone]=useState(evaluated.has(taskId));
 useEffect(()=>{setVisible(false);if(done||evaluated.has(taskId)||busy||draft.trim()||!['answered','handoff'].includes(status))return;const timer=setTimeout(()=>setVisible(true),closed?0:60000);return()=>clearTimeout(timer);},[requestId,taskId,status,draft,busy,closed,done]);
 if(!visible||done||busy||draft.trim())return null;
 return <TaskFeedback requestId={requestId} onRated={complete=>{evaluated.add(taskId);if(evaluated.size>1000)evaluated.delete(evaluated.values().next().value!);setDone(complete);}}/>;
}
