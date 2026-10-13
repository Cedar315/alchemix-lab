import test from 'node:test';
import assert from 'node:assert/strict';
import { chatConfig } from './provider-config';
import { companionToolModel } from '../agent/preparation-provider';

test('DeepSeek credentials and tool requests are isolated from MiniMax',async()=>{
 const saved={...process.env}, originalFetch=globalThis.fetch;
 try {
  process.env.AI_PROVIDER='deepseek';process.env.DEEPSEEK_API_KEY='deepseek-test';
  delete process.env.DEEPSEEK_API_URL;delete process.env.DEEPSEEK_MODEL;
  process.env.MINIMAX_API_KEY='minimax-test';process.env.MINIMAX_TOOL_API_URL='https://wrong.test';
  const config=chatConfig(true);
  assert.equal(config.endpoint,'https://api.deepseek.com/chat/completions');assert.equal(config.model,'deepseek-flash');
  globalThis.fetch=async(url,init)=>{
   assert.equal(url,config.endpoint);assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer deepseek-test');
   const body=JSON.parse(String(init?.body));assert.equal(body.thinking.type,'disabled');assert.equal(body.tool_choice,'required');assert.ok(body.tools.length);
   return Response.json({choices:[{message:{tool_calls:[{function:{name:'troubleshoot_recipe',arguments:JSON.stringify({clarification:'已经混合了吗？'})}}]},finish_reason:'tool_calls'}]});
  };
  const r=await companionToolModel('test',{},AbortSignal.timeout(1000));assert.equal(r.value.intent,'troubleshoot');
  delete process.env.DEEPSEEK_API_KEY;assert.throws(()=>chatConfig(),/DEEPSEEK_API_KEY/);
  process.env.DEEPSEEK_API_KEY='deepseek-test';
  process.env.AI_PROVIDER='minimax';assert.equal(chatConfig(true).endpoint,'https://api.deepseek.com/chat/completions');
 } finally {
  globalThis.fetch=originalFetch;
  for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];
  Object.assign(process.env,saved);
 }
});
