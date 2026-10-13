import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
const origin = process.env.BROWSER_TEST_ORIGIN || 'http://localhost:3003';
const target = await fetch('http://localhost:9233/json/new?' + encodeURIComponent(origin), {method:'PUT'}).then(r=>r.json());
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let sequence=0, sent, responseMode='ok'; const pending=new Map(), errors=[];
function call(method,params={}) { return new Promise((resolve,reject)=>{ const id=++sequence; const timer=setTimeout(()=>reject(Error(method)),15000); pending.set(id,{resolve:r=>{clearTimeout(timer);resolve(r)},reject});ws.send(JSON.stringify({id,method,params})); }); }
const chunks=[
 {type:'start',messageId:'assistant-test'},
 {type:'tool-input-available',toolCallId:'recipe-test',toolName:'get_recipe',input:{query:'margarita'}},
 {type:'tool-output-available',toolCallId:'recipe-test',output:{status:'found',recipes:[{name:'玛格丽特',kind:'classic',recipeId:'margarita',href:'/inspiration/classic-remix?cocktail=margarita',ingredients:[{name:'龙舌兰',amount:50}]}]}},
 {type:'text-start',id:'text-test'}, {type:'text-delta',id:'text-test',delta:'这是**流式对话**测试。\n\n还有哪些材料？\n\n[去调配实验室](/?tab=LAB)\n\n[不可信入口](https://example.com/redirect)'}, {type:'text-end',id:'text-test'},
 {type:'data-lab-action',id:'lab-action',data:{kind:'prefill',materials:[{name:'金酒',amount:30,source:'金酒'},{name:'可乐',amount:90,source:'可乐'}],assumptions:['金酒与可乐按1:3试配，可调整']}},
 {type:'finish',finishReason:'stop'}
];
if(process.env.BEER_ALTERNATIVES==='true') {
 const runs=JSON.parse(await readFile('artifacts/evaluations/beer-alternatives.json','utf8'));
 const result=runs[0].tools.find(t=>t.toolName==='find_recipes');
 chunks[1].toolName='find_recipes';chunks[1].input=result.input;chunks[2].output=result.output;
}
ws.addEventListener('message',async event=>{const m=JSON.parse(event.data); if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(Error(m.error.message)):p?.resolve(m.result);return;}
 if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);
 if(m.method!=='Fetch.requestPaused')return;
 const {requestId,request}=m.params;
 try {
 if(request.url.endsWith('/api/auth/me'))await call('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify({user:{id:'test-owner'}})).toString('base64')});
 else if(request.url.endsWith('/api/agent')) {
   sent=JSON.parse(request.postData);
   const mode=responseMode; responseMode='ok';
   if(mode==='error'){await call('Fetch.fulfillRequest',{requestId,responseCode:429,body:Buffer.from('{}').toString('base64')});return;}
   if(mode==='delay')await new Promise(r=>setTimeout(r,1200));
   await call('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/event-stream'},{name:'x-vercel-ai-ui-message-stream',value:'v1'}],body:Buffer.from(chunks.map(c=>'data: '+JSON.stringify(c)+'\n\n').join('')+'data: [DONE]\n\n').toString('base64')}).catch(()=>{});
 }
 else await call('Fetch.continueRequest',{requestId});
 } catch(e) { if(!/Invalid InterceptionId/.test(e.message)) errors.push(e.message); }
});
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;}
async function until(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error(expression);}
async function send(text){await evaluate(`(()=>{const e=document.querySelector('#companion-question');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,${JSON.stringify(text)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await until(`!document.querySelector('[aria-label="发送问题"]').disabled`);await evaluate(`document.querySelector('[aria-label="发送问题"]').click()`);}
try {
 await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await call('Fetch.enable',{patterns:[{urlPattern:'*/api/auth/me'},{urlPattern:'*/api/agent'}]});
 await call('Page.navigate',{url:origin+'/inspiration/classic-remix?cocktail=negroni'});
 await until(`document.querySelector('[aria-label="打开调酒助手"]') !== null`);
 await evaluate(`document.querySelector('[aria-label="打开调酒助手"]').click()`);
 await until(`document.querySelector('#companion-question') !== null`);
 await until(`!document.body.innerText.includes('正在确认登录状态')`);
 await evaluate(`(()=>{const e=document.querySelector('#companion-question');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'测试配方与预览');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await until(`!document.querySelector('[aria-label="发送问题"]').disabled`);
 await evaluate(`document.querySelector('[aria-label="发送问题"]').click()`);
 await until(`document.body.innerText.includes('这是流式对话测试。') && document.body.innerText.includes('带入材料，进入我的酒精实验室')`);
 assert.equal(sent.messages.at(-1).parts[0].text,'测试配方与预览');
 assert.equal(await evaluate(`!!document.querySelector('.assistant-recipe-card')`),true);
 if(process.env.BEER_ALTERNATIVES==='true') {
   assert.equal(await evaluate(`document.querySelectorAll('.assistant-recipe-card').length`),3);
   assert.equal(await evaluate(`Array.from(document.querySelectorAll('.assistant-recipe-card')).every(e=>e.innerText.includes('还需准备或确认'))`),true);
 }
 assert.equal(await evaluate(`!!document.querySelector('.assistant-prose strong')`),true);
 assert.equal(JSON.parse(sent.context).recipeId,'negroni');
 assert.equal(await evaluate(`document.querySelector('.assistant-return')===null`),true);
 await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('展开酒单')).click()`);
 await evaluate(`(()=>{const e=document.querySelector('#companion-question');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'未发送的草稿');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await until(`document.querySelector('#companion-question').value==='未发送的草稿'`);
 await evaluate(`document.querySelector('.assistant-messages').scrollTop=30`);
 const beforeScroll=await evaluate(`document.querySelector('.assistant-messages').scrollTop`);
 await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('查看完整酒单')).click()`);
 await until(`new URLSearchParams(location.search).get('cocktail')==='margarita' && document.querySelector('.assistant-return')!==null`);
 await evaluate(`document.querySelector('.assistant-return').click()`);
 await until(`document.body.innerText.includes('这是流式对话测试。')`);
 assert.equal(await evaluate(`document.querySelector('#companion-question').value`),'未发送的草稿');
 const scrollAfter=await evaluate(`({top:document.querySelector('.assistant-messages').scrollTop,height:document.querySelector('.assistant-messages').scrollHeight,client:document.querySelector('.assistant-messages').clientHeight})`);
 assert.ok(Math.abs(scrollAfter.top-beforeScroll)<2,JSON.stringify({beforeScroll,scrollAfter}));

 await evaluate(`document.querySelector('[aria-label="收起助手"]').click()`);
 await evaluate(`document.querySelector('[aria-label="打开调酒助手"]').click()`);
 assert.equal(await evaluate(`document.body.innerText.includes('这是流式对话测试。')`),true);
 assert.equal(await evaluate(`sessionStorage.getItem('alchemix_lab_transfer_v1')`),null);
 assert.equal(await evaluate(`document.documentElement.scrollWidth <= window.innerWidth`),true);
 await mkdir('artifacts/agent-next',{recursive:true});
 const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile('artifacts/agent-next/production-floating-mobile.png',Buffer.from(shot.data,'base64'));
 await evaluate(`sessionStorage.setItem('alchemix_lab_draft_v1',JSON.stringify({ingredients:[{name:'原草稿'}]}))`);
 await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='带入材料，进入我的酒精实验室').click()`);
 await until(`document.querySelector('[aria-label="确认替换实验室内容"]') !== null`);
 assert.equal(await evaluate(`sessionStorage.getItem('alchemix_lab_transfer_v1')`),null);
 await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='保留当前内容').click()`);
 await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='新对话').click()`);
 await until(`!document.body.innerText.includes('这是流式对话测试。')`);
 responseMode='error';await send('测试重试');await until(`document.body.innerText.includes('重试这条消息')`);
 await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='重试这条消息').click()`);
 await until(`document.body.innerText.includes('这是流式对话测试。')`);
 assert.equal(sent.messages.filter(m=>m.role==='user').length,1);
 await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='新对话').click()`);
 responseMode='delay';await send('测试停止');await until(`document.querySelector('.assistant-message[role="status"]') !== null`);
 await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='停止').click()`);
 await new Promise(r=>setTimeout(r,1500));
 assert.equal(await evaluate(`document.body.innerText.includes('这是流式对话测试。')`),false);
 responseMode='delay';await send('测试页面切换');
 await call('Page.navigate',{url:origin+'/ask'});await until(`document.querySelector('#companion-question') !== null`);
 await until(`!document.body.innerText.includes('正在确认登录状态')`);
 await new Promise(r=>setTimeout(r,1500));
 assert.equal(await evaluate(`document.body.innerText.includes('这是流式对话测试。')`),false);
 await send('完整聊天页');await until(`document.body.innerText.includes('这是流式对话测试。')`);
 assert.equal(await evaluate(`document.querySelectorAll('.assistant-prose a').length`),0);
 const draftBefore=await evaluate(`sessionStorage.getItem('alchemix_lab_draft_v1')`);
 await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='带入材料，进入我的酒精实验室').click()`);
 await until(`document.querySelector('[aria-label="确认替换实验室内容"]') !== null`);
 assert.equal(await evaluate(`sessionStorage.getItem('alchemix_lab_draft_v1')`),draftBefore);
 await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='替换内容').click()`);
 await until(`location.pathname==='/' && new URLSearchParams(location.search).get('tab')==='LAB'`);
 await until(`(()=>{const d=JSON.parse(sessionStorage.getItem('alchemix_lab_draft_v1')||'null');return d?.ingredients?.length===2 && d.ingredients.every(i=>i.amount>0);})()`);
 const filled=await evaluate(`JSON.parse(sessionStorage.getItem('alchemix_lab_draft_v1')).ingredients`);
 assert.deepEqual(filled.map(i=>i.name).sort(),['金酒','可乐'].sort());
 assert.equal(await evaluate(`sessionStorage.getItem('alchemix_lab_transfer_v1')`),null);
 assert.equal(filled.find(i=>i.name==='金酒').amount,30);
 assert.equal(filled.find(i=>i.name==='可乐').amount,90);
 await until(`document.body.innerText.includes('当前材料') && document.body.innerText.includes('金酒') && document.body.innerText.includes('可乐')`);
 await until(`document.querySelector('.assistant-return') !== null`);
 const labBeforeReturn=await evaluate(`sessionStorage.getItem('alchemix_lab_draft_v1')`);
 await evaluate(`document.querySelector('.assistant-return').click()`);
 await until(`location.pathname==='/ask' && document.body.innerText.includes('这是流式对话测试。')`);
 assert.equal(await evaluate(`sessionStorage.getItem('alchemix_lab_draft_v1')`),labBeforeReturn);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:['sdk-ui-stream','tool-results','real-recipe-card','preview-requires-confirmation','mobile-width','new-conversation','page-context','collapse-preserves-chat','markdown','draft-overwrite-confirmation','429-retry-no-duplicate','stop-no-late-answer','navigation-no-late-answer','full-chat-page','lab-entry-confirms-replacement-and-loads-ratio','recipe-return-preserves-draft-and-scroll','full-page-chat-return-preserves-lab'],mockedProvider:true}));
} finally {ws.close();await fetch('http://localhost:9233/json/close/'+target.id);}
