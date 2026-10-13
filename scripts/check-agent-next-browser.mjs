import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const origin = process.env.BROWSER_TEST_ORIGIN || 'http://localhost:3003';
const target = await fetch('http://localhost:9233/json/new?' + encodeURIComponent(origin), {method:'PUT'}).then(r=>r.json());
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let sequence=0, sent; const pending=new Map(), errors=[];
function call(method,params={}) { return new Promise((resolve,reject)=>{ const id=++sequence; const timer=setTimeout(()=>reject(Error(method)),15000); pending.set(id,{resolve:r=>{clearTimeout(timer);resolve(r)},reject});ws.send(JSON.stringify({id,method,params})); }); }
const chunks=[
 {type:'start',messageId:'assistant-test'},
 {type:'tool-input-available',toolCallId:'recipe-test',toolName:'get_recipe',input:{query:'margarita'}},
 {type:'tool-output-available',toolCallId:'recipe-test',output:{status:'found',recipes:[{name:'玛格丽特',recipeId:'margarita',href:'/inspiration/classic-remix?cocktail=margarita',ingredients:[{name:'龙舌兰',amount:50}]}]}},
 {type:'text-start',id:'text-test'}, {type:'text-delta',id:'text-test',delta:'这是流式对话测试。'}, {type:'text-end',id:'text-test'},
 {type:'tool-input-available',toolCallId:'preview-test',toolName:'preview_lab_change',input:{materials:[{name:'金酒',amount:30}],assumptions:['仅供预览']}},
 {type:'tool-output-available',toolCallId:'preview-test',output:{status:'preview',materials:[{name:'金酒',amount:30}],assumptions:['仅供预览'],applied:false}},
 {type:'finish',finishReason:'stop'}
];
ws.addEventListener('message',async event=>{const m=JSON.parse(event.data); if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(Error(m.error.message)):p?.resolve(m.result);return;}
 if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);
 if(m.method!=='Fetch.requestPaused')return;
 const {requestId,request}=m.params;
 if(request.url.endsWith('/api/auth/me'))await call('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify({user:{id:'test-owner'}})).toString('base64')});
 else if(request.url.endsWith('/api/agent/experimental')) { sent=JSON.parse(request.postData); await call('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/event-stream'},{name:'x-vercel-ai-ui-message-stream',value:'v1'}],body:Buffer.from(chunks.map(c=>'data: '+JSON.stringify(c)+'\n\n').join('')+'data: [DONE]\n\n').toString('base64')}); }
 else await call('Fetch.continueRequest',{requestId});
});
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;}
async function until(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error(expression);}
try {
 await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await call('Fetch.enable',{patterns:[{urlPattern:'*/api/auth/me'},{urlPattern:'*/api/agent/experimental'}]});
 await call('Page.navigate',{url:origin+'/ask/experimental'});
 await until(`document.querySelector('textarea[aria-label="消息"]') !== null`);
 await until(`!document.body.innerText.includes('请先登录后提问')`);
 await evaluate(`(()=>{const e=document.querySelector('textarea[aria-label="消息"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'测试配方与预览');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await until(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='发送'&&!b.disabled)`);
 await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='发送').click()`);
 await until(`document.body.innerText.includes('这是流式对话测试。') && document.body.innerText.includes('确认并带入实验室')`);
 assert.equal(sent.messages.at(-1).parts[0].text,'测试配方与预览');
 assert.equal(await evaluate(`!!document.querySelector('a[href="/inspiration/classic-remix?cocktail=margarita"]')`),true);
 assert.equal(await evaluate(`sessionStorage.getItem('alchemix_lab_transfer_v1')`),null);
 assert.equal(await evaluate(`document.documentElement.scrollWidth <= window.innerWidth`),true);
 await mkdir('artifacts/agent-next',{recursive:true});
 const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile('artifacts/agent-next/mobile.png',Buffer.from(shot.data,'base64'));
 await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='新对话').click()`);
 await until(`!document.body.innerText.includes('这是流式对话测试。')`);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:['sdk-ui-stream','tool-results','real-recipe-link','preview-requires-confirmation','mobile-width','new-conversation'],mockedProvider:true}));
} finally {ws.close();await fetch('http://localhost:9233/json/close/'+target.id);}
