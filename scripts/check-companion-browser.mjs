import { mkdir,writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin=process.env.BROWSER_TEST_ORIGIN||'http://localhost:3003';
const target=await fetch('http://localhost:9222/json/new?'+encodeURIComponent(origin),{method:'PUT'}).then(r=>r.json());
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
let sequence=0,lastInput;const pending=new Map(),errors=[],checks=[];
function call(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>reject(Error('Timeout '+method)),20000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject});ws.send(JSON.stringify({id,method,params}));});}
ws.addEventListener('message',async event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(Error(m.error.message)):p?.resolve(m.result);return;}
if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
if(m.method!=='Fetch.requestPaused')return;
const {requestId,request}=m.params;let body;
if(request.url.endsWith('/api/auth/me'))body={user:{id:'companion-test-owner'}};
else if(request.url.endsWith('/api/drink-logs'))body={drink_logs:[]};
else if(request.url.endsWith('/api/saved-cocktails'))body={cocktails:[]};
else if(request.url.includes('/api/inspiration/'))body={recipes:[],variants:[]};
else if(request.url.endsWith('/api/agent')){
 lastInput=JSON.parse(request.postData);
 body={status:'answered',message:'',clarification:'',recipes:[],actions:[],knowledge:null,pending:null,taskId:lastInput.taskId,contextVersion:lastInput.contextVersion,trace:[],model:'browser-fixture'};
 if(lastInput.question.includes('能做什么')){body.status='needs_info';body.clarification='想看经典酒还是便利店调酒？';body.pending={kind:'category',materials:['龙舌兰','橙味利口酒','青柠','橙汁']};}
 else if(lastInput.question==='经典酒'){body.recipes=[{id:'margarita',name:'玛格丽特',category:'classic',reason:'材料齐全，冰块和器具请确认。',missing:[],action:{kind:'recipe',category:'classic',id:'margarita'}}];}
 else if(lastInput.question.includes('搭配'))body.actions=[{label:'到实验室查看搭配',action:{kind:'prefill',materials:[{name:'橙汁'},{name:'伏特加'}]}}];
 else if(lastInput.question.includes('改良'))body.actions=[{label:'查看便利店改良选项',action:{kind:'locate',target:'substitute'}}];
 else if(lastInput.question.includes('故意失效'))body.actions=[{label:'无效酒单',action:{kind:'recipe',category:'classic',id:'not-real'}}];
 else if(lastInput.question.includes('故意失败')){body.status='unavailable';body.message='这次资料查询没有完成，你可以重试。';}
 else {body.knowledge={status:'answered',claims:[{text:'这是一条界面测试说明。',evidenceIds:['test']}],citations:[{id:'test',title:'测试条目',sources:[{title:'测试来源',url:'https://example.com/evidence'}]}]};}
}
try{if(body&&request.url.endsWith('/api/agent'))await new Promise(r=>setTimeout(r,300));if(body)await call('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});else await call('Fetch.continueRequest',{requestId});}catch{}
});
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function until(expression){for(let i=0;i<100;i++){if(await evaluate(`Boolean(${expression})`))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+expression);}
const click=label=>evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(label)})?.click()`);
async function fill(text){await evaluate(`(()=>{const el=document.querySelector('#companion-question');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,${JSON.stringify(text)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);}
async function send(text){await fill(text);await evaluate(`document.querySelector('button[aria-label="发送问题"]').click()`);await until(`document.querySelector('#companion-question')?.value === ''`);await until(`!document.querySelector('.assistant-message[role="status"]')`);}
async function open(){await until(`document.querySelector('[aria-label="打开调酒助手"]')`);await evaluate(`document.querySelector('[aria-label="打开调酒助手"]').click()`);await until(`document.querySelector('#companion-question')`);}
async function navigate(path){await call('Page.navigate',{url:origin+path});await until(`document.readyState!=='loading'`);}
try{
await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
await call('Fetch.enable',{patterns:[{urlPattern:'*/api/auth/me'},{urlPattern:'*/api/agent'},{urlPattern:'*/api/drink-logs'},{urlPattern:'*/api/saved-cocktails'},{urlPattern:'*/api/inspiration/*'}]});
await navigate('/');await evaluate(`['alchemix_companion_v2','alchemix_lab_draft_v1','alchemix_lab_transfer_v1','alchemix_companion_handoff'].forEach(k=>sessionStorage.removeItem(k))`);await navigate('/');await until(`document.body.innerText.includes('帮我选一杯')`);assert.equal(await evaluate(`!!document.querySelector('[aria-label="打开调酒助手"]')`),false);checks.push('no-home-entry');
await navigate('/inspiration');await until(`document.body.innerText.includes('找酒谱')`);assert.equal(await evaluate(`!!document.querySelector('[aria-label="打开调酒助手"]')`),false);checks.push('no-list-entry');
await navigate('/inspiration/classic-remix?cocktail=margarita');await open();assert.equal(await evaluate(`document.querySelectorAll('.assistant-choices').length`),0);assert.equal(await evaluate(`document.querySelectorAll('.assistant-message').length`),0);checks.push('classic-entry-free-input-no-menu');
await fill('这杯缺料怎么办');await evaluate(`document.querySelector('[aria-label="发送问题"]').click()`);await until(`document.querySelector('.assistant-message.user')`);assert.equal(await evaluate(`document.querySelector('#companion-question').value`),'');assert.equal(await evaluate(`document.querySelector('.assistant-message.user').innerText`),'这杯缺料怎么办');await until(`!document.querySelector('.assistant-message[role="status"]')`);checks.push('message-visible-before-answer-input-cleared');

assert.equal(await evaluate(`document.querySelector('.assistant-panel').getBoundingClientRect().height<844*.75`),true);checks.push('mobile-drawer-height');
await evaluate(`document.querySelector('[aria-label="展开窗口"]').click()`);await until(`document.querySelector('.assistant-panel').classList.contains('is-expanded')`);await evaluate(`document.querySelector('[aria-label="缩小窗口"]').click()`);await until(`!document.querySelector('.assistant-panel').classList.contains('is-expanded')`);checks.push('expand-collapse-controls');
await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});await until(`document.activeElement?.getAttribute('aria-label')==='打开调酒助手'`);checks.push('escape-restores-focus');await open();
const handle=await evaluate(`(()=>{const r=document.querySelector('.assistant-handle').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:handle.x,y:handle.y}]});await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:handle.x,y:handle.y-80}]});await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await until(`document.querySelector('.assistant-panel').classList.contains('is-expanded')`);checks.push('drag-expands-drawer');await evaluate(`document.querySelector('[aria-label="缩小窗口"]').click()`);

await fill('尚未发送的问题');await evaluate(`document.querySelector('[aria-label="收起助手"]').click()`);await open();assert.equal(await evaluate(`document.querySelector('#companion-question').value`),'尚未发送的问题');checks.push('collapse-preserves-draft');
await send('龙舌兰橙味利口酒青柠橙汁能做什么');await until(`document.querySelector('.assistant-choices')`);await click('经典酒');await until(`document.querySelector('.assistant-recipe-card')`);assert.equal(lastInput.pending.kind,'category');assert.equal(await evaluate(`document.querySelectorAll('.assistant-recipe-card').length`),1);checks.push('category-then-real-card');
await send('这杯怎么改良');await until(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='查看便利店改良选项')`);await click('查看便利店改良选项');await until(`document.querySelector('#assistant-substitute')?.classList.contains('assistant-highlight')`);assert.equal(await evaluate(`!!document.querySelector('.assistant-panel')`),false);checks.push('same-page-highlight');
await open();await send('橙汁伏特加搭配');await until(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='到实验室查看搭配')`);await click('到实验室查看搭配');await until(`document.querySelector('[aria-label="待确认的材料"]')`);assert.equal(await evaluate(`document.querySelector('[aria-label="待确认的材料"]').innerText.includes('橙汁')`),true);assert.equal(await evaluate(`JSON.parse(sessionStorage.getItem('alchemix_lab_draft_v1')).ingredients.length`),0);checks.push('lab-prefill-no-invented-amount');
await open();assert.equal(await evaluate(`document.querySelectorAll('.assistant-message').length`),0);checks.push('lab-navigation-starts-new-conversation');
await send('再次搭配橙汁伏特加');await until(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='到实验室查看搭配'&&!b.disabled)`);await evaluate(`Array.from(document.querySelectorAll('button')).findLast(b=>b.textContent.trim()==='到实验室查看搭配').click()`);await until(`document.querySelector('.assistant-confirm')`);const draft=await evaluate(`sessionStorage.getItem('alchemix_lab_draft_v1')`);await click('保留当前内容');assert.equal(await evaluate(`sessionStorage.getItem('alchemix_lab_draft_v1')`),draft);checks.push('keep-prevents-overwrite');
await evaluate(`Array.from(document.querySelectorAll('button')).findLast(b=>b.textContent.trim()==='到实验室查看搭配').click()`);await until(`document.querySelector('.assistant-confirm')`);await click('替换内容');await until(`!document.querySelector('.assistant-panel')`);checks.push('explicit-replacement-only');
await click('选择用量');await until(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='确认注入烧杯')`);assert.equal(await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='确认注入烧杯').disabled`),true);checks.push('unknown-amount-blocks-injection');
await click('30ml');await click('确认注入烧杯');await until(`JSON.parse(sessionStorage.getItem('alchemix_lab_draft_v1')).ingredients.length===1`);assert.equal(await evaluate(`JSON.parse(sessionStorage.getItem('alchemix_lab_draft_v1')).ingredients[0].amount`),30);checks.push('user-confirms-actual-editor-amount');

await navigate('/inspiration/convenience-mix?cocktail=cv-vodka-orange-juice');await open();assert.equal(await evaluate(`document.querySelectorAll('.assistant-message').length`),0);await send('解释制作步骤');await until(`document.querySelector('.assistant-sources')`);assert.equal(lastInput.history.length,0);checks.push('new-drink-isolates-facts','convenience-entry','sources-visible');
await mkdir('artifacts/browser',{recursive:true});const screenshot=await call('Page.captureScreenshot',{format:'png'});await writeFile('artifacts/browser/companion-mobile.png',Buffer.from(screenshot.data,'base64'));
assert.equal(await evaluate(`!!document.querySelector('[aria-label="查看历史任务"]')`),false);checks.push('no-cross-drink-history');
await send('故意失效');await until(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='无效酒单')`);await click('无效酒单');await until(`document.querySelector('[role="alert"]')`);checks.push('invalid-recipe-action-rejected');
await send('故意失败');await until(`document.querySelector('.assistant-messages').innerText.includes('查询没有完成')`);assert.equal(await evaluate(`document.querySelector('#companion-question').value`),'');assert.equal(await evaluate(`document.querySelector('.assistant-message.user:last-of-type')?.innerText.includes('故意失败') || document.querySelector('.assistant-messages').innerText.includes('故意失败')`),true);checks.push('failure-preserves-message-and-retry');
assert.equal(await evaluate(`document.documentElement.scrollWidth<=390`),true);checks.push('no-horizontal-overflow');

await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});assert.equal(await evaluate(`(()=>{const p=document.querySelector('.assistant-panel').getBoundingClientRect(),h=document.querySelector('[data-app-shell]').getBoundingClientRect();return p.left>=h.left && p.right<=h.right && p.bottom<=h.bottom && p.width<431})()`),true);checks.push('desktop-panel-inside-phone');
await navigate('/');await until(`document.body.innerText.includes('从一杯开始')`);
await evaluate(`sessionStorage.setItem('alchemix_beginner_v2',JSON.stringify({version:2,answers:{kind:'any',tastes:[],strength:'any',avoid:[],spirit:'any',tools:'any',mixers:[]},answered:[],excluded:[],slots:['/inspiration/classic-remix?cocktail=highball','/inspiration/classic-remix?cocktail=paloma','/inspiration/classic-remix?cocktail=margarita'],seen:[],undo:{},screen:'results',scroll:200}))`);
await navigate('/');await until(`document.body.innerText.includes('继续看上次选出的酒')`);assert.equal(await evaluate(`document.body.innerText.includes('从一杯开始')`),true);checks.push('home-does-not-restore-results');
for(const [name,id] of [['威士忌嗨棒','highball'],['帕洛玛','paloma']]) {
 await until(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='继续看上次选出的酒')`);await click('继续看上次选出的酒');await until(`document.querySelector('.beginner-guide article')`);
 await evaluate(`Array.from(document.querySelectorAll('.beginner-guide article')).find(a=>a.querySelector('h3')?.textContent===${JSON.stringify(name)})?.querySelector('button:not([aria-label])')?.click()`);
 await until(`location.search.includes(${JSON.stringify('cocktail='+id)})`);await open();assert.equal(await evaluate(`document.querySelector('.assistant-header').innerText.includes(${JSON.stringify(name)})`),true);assert.equal(await evaluate(`document.querySelector('h2').textContent`),name);
 await evaluate(`document.querySelector('[aria-label="收起助手"]').click()`);await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim().endsWith('返回探索'))?.click()`);await until(`document.body.innerText.includes('从一杯开始')`);assert.equal(await evaluate(`!!document.querySelector('.beginner-guide article')`),false);
 checks.push(id+'-card-detail-context-and-return-home');
}
for(const label of ['自由调配','找酒谱','我的']) {await until(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='继续看上次选出的酒')`);await evaluate(`Array.from(document.querySelectorAll('nav button')).find(b=>b.textContent.includes(${JSON.stringify(label)}))?.click()`);await until(`!document.body.innerText.includes('从一杯开始')`);await evaluate(`Array.from(document.querySelectorAll('nav button')).find(b=>b.textContent.includes('首页'))?.click()`);await until(`document.body.innerText.includes('从一杯开始')`);checks.push('home-after-'+label);}
const unauthorized=await fetch(origin+'/api/agent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:2})});assert.equal(unauthorized.status,401);checks.push('real-route-authentication');
assert.deepEqual(errors,[]);checks.push('no-browser-exceptions');
console.log(JSON.stringify({checks,errors},null,2));await writeFile('artifacts/browser/companion-checks.json',JSON.stringify({at:new Date().toISOString(),note:'Browser API answers are fixtures; route anonymous auth checked against real server.',checks,errors},null,2));
}catch(e){console.error(e);console.error(JSON.stringify({checks,errors,lastInput,body:await evaluate('document.body.innerText.slice(0,2000)'),url:await evaluate('location.href')}));process.exitCode=1;}finally{ws.close();}
