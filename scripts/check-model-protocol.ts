import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const { companionPrompt } = await import('../src/lib/agent/companion');
const { companionRoutingToolDefinitions } = await import('../src/lib/agent/companion-tools');
const { recipeContext } = await import('../src/lib/agent/workflow-catalog');
const configured = process.env.MINIMAX_API_URL!;
const toolUrl = new URL(process.env.MINIMAX_TOOL_API_URL || configured);
if (!process.env.MINIMAX_TOOL_API_URL) toolUrl.pathname = toolUrl.pathname.replace(/\/v1\/text\/chatcompletion_v2\/?$/, '/v1/chat/completions');
for (const max_tokens of [900, 1600]) {
 const started=Date.now();
 try {
 const r=await fetch(toolUrl,{method:'POST',headers:{Authorization:`Bearer ${process.env.MINIMAX_API_KEY}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(15000),body:JSON.stringify({model:process.env.MINIMAX_MODEL,max_tokens,temperature:0,stream:false,messages:[{role:'system',content:companionPrompt},{role:'user',content:JSON.stringify({question:'我烧酒倒多了怎么办',page:recipeContext('convenience','lime-soju-soda'),history:[],pending:null})}],tools:companionRoutingToolDefinitions,tool_choice:'required'})});
 const d=await r.json();
 console.log(JSON.stringify({max_tokens,http:r.status,model:process.env.MINIMAX_MODEL,elapsedMs:Date.now()-started,code:d.base_resp?.status_code||d.error?.code,finish:d.choices?.[0]?.finish_reason,tools:d.choices?.[0]?.message?.tool_calls?.map((c:any)=>c.function.name),usage:d.usage}));
 }catch(e){console.log(JSON.stringify({max_tokens,error:e instanceof Error?e.name:'Unknown',elapsedMs:Date.now()-started}));}
}
