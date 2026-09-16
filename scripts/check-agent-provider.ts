import dotenv from 'dotenv';
import { extractSupplies } from '../src/lib/agent/provider';
import { inputSchema } from '../src/lib/agent/core';
import { mergeSupplies } from '../src/lib/agent/conversation';
dotenv.config({path:'.env.local',quiet:true});
const started=Date.now();
try {
 const input=inputSchema.parse({question:'金酒',history:[{role:'user',content:'推荐一杯酒'},{role:'assistant',content:'你手边有哪些酒或饮料？'}]});
 const result=await extractSupplies(input,AbortSignal.timeout(45000));
 const merged=mergeSupplies(input,result.value);
 console.log(JSON.stringify({ok:true,elapsedMs:Date.now()-started,model:result.model,inventory:merged.inventory,usage:result.usage}));
} catch(e){console.log(JSON.stringify({ok:false,elapsedMs:Date.now()-started,error:e instanceof Error?e.name:'unknown',code:(e as {code?:string}).code}));process.exitCode=1;}
