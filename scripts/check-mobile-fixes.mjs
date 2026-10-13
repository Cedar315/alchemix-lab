import assert from 'node:assert/strict';
const origin='http://127.0.0.1:3011';
const target=await fetch('http://localhost:9223/json/new?about:blank',{method:'PUT'}).then(r=>r.json());
const ws=new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
let n=0,lastInput;const requests=new Map(),checks=[],errors=[];let favorites=[];
function call(method,params={}){return new Promise((resolve,reject)=>{const id=++n;const timer=setTimeout(()=>reject(Error(method+' timeout')),15000);requests.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject});ws.send(JSON.stringify({id,method,params}));});}
ws.addEventListener('message',async e=>{const m=JSON.parse(e.data);if(m.id){const p=requests.get(m.id);requests.delete(m.id);m.error?p?.reject(Error(m.error.message)):p?.resolve(m.result);return;}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);if(m.method!=='Fetch.requestPaused')return;
 const {requestId,request}=m.params;const path=new URL(request.url).pathname;let body;
 if(path==='/api/auth/me')body={user:{id:'test',email:'test@example.com'}};
 else if(path==='/api/drink-logs')body={drink_logs:[]};
 else if(path==='/api/feedback')body={success:true};
 else if(path==='/api/saved-cocktails'){
  if(request.method==='POST'){const c=JSON.parse(request.postData);const saved={...c,id:'fixture-output'};favorites=[saved];body={cocktail:saved};}else body={cocktails:favorites};
 }else if(path.startsWith('/api/saved-cocktails/')){favorites=[];body={success:true};}
 else if(path==='/api/agent'){
  lastInput=JSON.parse(request.postData);
  body={status:'answered',message:'已结合当前配方和你的操作处理。',clarification:'',actions:[],recipes:[],knowledge:null,pending:null,taskId:lastInput.taskId,contextVersion:lastInput.contextVersion,trace:[],model:'fixture',requestId:crypto.randomUUID()};
  if(lastInput.question==='这杯口感不对'){body.status='needs_info';body.clarification='你刚才是怎么操作的？';body.pending={kind:'clarification',intent:'knowledge',question:lastInput.question,clarification:body.clarification,awaitingField:'actualSteps',slots:{},recipeKey:lastInput.page.kind+':'+lastInput.page.recipeId};}
 }else if(path.startsWith('/api/analytics/'))body={success:true};
 try{await call(body?'Fetch.fulfillRequest':'Fetch.continueRequest',body?{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(body)).toString('base64')}:{requestId});}catch{}
});
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function until(expression){for(let i=0;i<100;i++){if(await evaluate(`Boolean(${expression})`))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out '+expression);}
const click=text=>evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim().endsWith(${JSON.stringify(text)}))?.click()`);
async function fill(value){await evaluate(`(()=>{const e=document.querySelector('#companion-question');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);}
async function send(q){await fill(q);await evaluate(`document.querySelector('[aria-label="发送问题"]').click()`);await until(`!document.querySelector('.assistant-message[role="status"]') && document.querySelectorAll('.assistant-message').length>=2`);}
async function open(){await until(`document.querySelector('[aria-label="打开调酒助手"]')`);await evaluate(`document.querySelector('[aria-label="打开调酒助手"]').click()`);await until(`document.querySelector('#companion-question')`);}
try{
 await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await call('Fetch.enable',{patterns:[{urlPattern:'*/api/*'}]});
 await call('Page.addScriptToEvaluateOnNewDocument',{source:`window.__idle=[];const original=window.setTimeout;window.setTimeout=function(fn,ms,...args){if(ms===60000){const id=original(()=>{},3600000);window.__idle.push({id,fn:()=>fn(...args)});return id;}return original(fn,ms,...args)};const clear=window.clearTimeout;window.clearTimeout=function(id){window.__idle=window.__idle.filter(t=>t.id!==id);clear(id)};window.__fireIdle=()=>{const timers=window.__idle.splice(0);timers.forEach(t=>t.fn());};`});
 await call('Page.navigate',{url:origin+'/inspiration/convenience-mix?cocktail=cv-vodka-orange-juice'});await open();
 await send('这杯口感不对');await until(`document.body.innerText.includes('你刚才是怎么操作的？')`);
 assert.equal(await evaluate(`!!document.querySelector('[aria-label="问题解决反馈"]')`),false);
 await evaluate(`document.querySelector('[aria-label="收起助手"]').click()`);await open();await send('搅拌');
 assert.equal(lastInput.pending?.kind,'clarification');assert.equal(lastInput.pending?.question,'这杯口感不对');checks.push('same-page close/reopen retains pending');
 assert.equal(lastInput.page.recipeId,'vodka-orange');assert.ok(lastInput.page.ingredients.length>0);assert.ok(lastInput.page.method);checks.push('old link and assistant canonical recipe context');
 assert.equal(await evaluate(`!!document.querySelector('[aria-label="问题解决反馈"]')`),false);await evaluate('window.__fireIdle()');await until(`document.querySelector('[aria-label="问题解决反馈"]')`);checks.push('feedback appears only after idle timeout');
 await fill('继续问');await until(`!document.querySelector('[aria-label="问题解决反馈"]')`);await fill('');await evaluate('window.__fireIdle()');await until(`document.querySelector('[aria-label="问题解决反馈"]')`);await click('解决了');await until(`!document.querySelector('[aria-label="问题解决反馈"]')`);await send('另一个问题');await evaluate('window.__fireIdle()');assert.equal(await evaluate(`!!document.querySelector('[aria-label="问题解决反馈"]')`),false);checks.push('typing hides feedback and rated task does not repeat');
 await call('Page.reload');await open();await until(`document.body.innerText.includes('页面已刷新，已开始新对话')`);assert.equal(await evaluate(`document.querySelectorAll('.assistant-message').length`),0);checks.push('refresh starts explicit fresh session');
 await evaluate(`document.querySelector('[aria-label="收起助手"]').click()`);await click('记录这一杯');await until(`document.body.innerText.includes('收藏这杯')`);await click('收藏这杯');await until(`document.body.innerText.includes('已收藏')`);assert.equal(favorites.length,1);checks.push('modal favorite invokes API independently of log save');
 await evaluate(`document.querySelector('[aria-label="取消记录"]').click()`);await click('记录这一杯');await until(`document.body.innerText.includes('已收藏')`);await click('已收藏');await until(`document.body.innerText.includes('收藏这杯')`);assert.equal(favorites.length,0);checks.push('reopen restores saved status and unfavorite calls API');
 assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+2'),false);assert.deepEqual(errors,[]);console.log(JSON.stringify({checks,passed:checks.length,backend:'mocked HTTP; real persistence validated separately in local PostgreSQL'},null,2));
}finally{ws.close();await fetch('http://localhost:9223/json/close/'+target.id);}
