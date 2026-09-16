import { mkdir,writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin=process.env.BROWSER_TEST_ORIGIN || 'http://localhost:3001';
const target=await fetch('http://localhost:9222/json/new?'+encodeURIComponent(origin+'/ask'),{method:'PUT'}).then(r=>r.json());
const ws=new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
let sequence=0, authenticated=false, lastInput;
const pending=new Map(),errors=[];
ws.addEventListener('message',async event=>{
  const message=JSON.parse(event.data);
  if(message.id){const task=pending.get(message.id);pending.delete(message.id);if(message.error)task?.reject(Error(message.error.message));else task?.resolve(message.result);}
  else if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text);
  else if(message.method==='Fetch.requestPaused'){
    const {requestId,request}=message.params;
    let body;
    if(request.url.endsWith('/api/auth/me'))body={user:authenticated?{id:'browser-fixture',nickname:'测试用户'}:null};
    else if(request.url.endsWith('/api/ask'))body={answer:{status:'answered',claims:[{text:'气泡部分在杯中最后加入。',evidenceIds:['carbonated-shaking']}],citations:[{id:'carbonated-shaking',title:'气泡摇和',sources:[{title:'测试来源',url:'https://example.com/evidence'}]}]}};
    else if(request.url.endsWith('/api/agent')) {
      lastInput=JSON.parse(request.postData);
      if(lastInput.question==='保留这个问题')body={status:'answered',message:'已查阅调酒资料。',recipes:[],knowledge:{status:'answered',claims:[{text:'气泡部分在杯中最后加入。',evidenceIds:['carbonated-shaking']}],citations:[{id:'carbonated-shaking',title:'气泡摇和',sources:[{title:'测试来源',url:'https://example.com/evidence'}]}]},trace:[{tool:'search_knowledge',status:'answered',elapsedMs:1}],requestId:'browser-fixture'};
      else if(lastInput.question.includes('多少冰'))body={status:'insufficient_evidence',message:'已查阅调酒资料。',clarification:'你在做哪杯酒，用什么杯子？',recipes:[],knowledge:{status:'insufficient_evidence',claims:[],citations:[]},trace:[{tool:'search_knowledge',status:'insufficient_evidence',elapsedMs:1}],requestId:'browser-fixture'};
      else if(lastInput.question.includes('推荐'))body={status:'handoff',message:'选酒请使用首页流程。',recipes:[],knowledge:null,trace:[],handoff:{label:'去首页选酒',href:'/?tab=ASSISTANT'},requestId:'fixture'};
      else body={status:'needs_info',message:'请确认材料数量。',recipes:[],knowledge:null,trace:[{tool:'find_recipes',status:'ok',elapsedMs:1}],requestId:'browser-fixture'};
    }
    if(body)await call('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});
    else await call('Fetch.continueRequest',{requestId});
  }
});
function call(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(Error('Browser command timeout: '+method));},20000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;}
async function until(expression){for(let i=0;i<80;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,150));}throw Error('Timed out: '+expression);}
const click=text=>evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent===${JSON.stringify(text)})?.click()`);
const fill=async(selector,value)=>evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
const checks=[];
try{
  await call('Runtime.enable');await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await call('Fetch.enable',{patterns:[{urlPattern:'*/api/auth/me'},{urlPattern:'*/api/ask'},{urlPattern:'*/api/agent'}]});
  await call('Page.navigate',{url:origin+'/ask'});
  await until(`document.body.innerText.includes('去登录')`);
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= 390`),true);checks.push('mobile-no-overflow');
  assert.equal(await evaluate(`document.body.innerText.includes('填写材料 / 选酒')`),false);checks.push('no-duplicate-recommendation-form');
  await fill('#ask-question','保留这个问题');
  await until(`sessionStorage.getItem('alchemix_preparation_draft_v1')?.includes('保留这个问题')`);
  authenticated=true;await call('Page.reload');await until(`!document.querySelector('button[type="submit"]').disabled`);
  assert.equal(await evaluate(`document.querySelector('#ask-question').value`),'保留这个问题');checks.push('draft-restored');
  await evaluate(`document.querySelector('button[type="submit"]').click()`);await until(`document.body.innerText.includes('气泡部分在杯中最后加入')`);
  assert.equal(await evaluate(`document.querySelector('a[href="#source-1-carbonated-shaking"]')!==null`),true);checks.push('citations-visible');
  await fill('#ask-question','我不知道该加多少冰');await evaluate(`document.querySelector('button[type="submit"]').click()`);
  await until(`document.body.innerText.includes('你在做哪杯酒，用什么杯子？')`);assert.deepEqual(Object.keys(lastInput).sort(),['context','history','question']);checks.push('no-supply-extraction-input','clarification-visible');
  await fill('#ask-question','帮我推荐一杯清爽的酒');await evaluate(`document.querySelector('button[type="submit"]').click()`);
  await until(`document.body.innerText.includes('去首页选酒')`);checks.push('recommendation-handoff');
  await mkdir('artifacts/browser',{recursive:true});const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile('artifacts/browser/preparation-mobile.png',Buffer.from(shot.data,'base64'));
  await evaluate(`Array.from(document.querySelectorAll('a')).find(a=>a.textContent.includes('去首页选酒')).click()`);
  await until(`document.body.innerText.includes('刚才的需求：帮我推荐一杯清爽的酒')`);checks.push('original-workflow-receives-request');
  await evaluate(`sessionStorage.setItem('alchemix_ask_context','内格罗尼，原配方每项30ml')`);await call('Page.navigate',{url:origin+'/ask?recipe=1'});
  await until(`document.querySelector('textarea[aria-label="配方上下文"]')?.value.includes('内格罗尼')`);checks.push('recipe-context-restored');
  const unauth=await fetch(origin+'/api/agent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:'test'})});assert.equal(unauth.status,401);checks.push('real-agent-route-rejects-anonymous');
  const retired=await fetch(origin+'/api/assistant',{method:'POST'});assert.equal(retired.status,410);checks.push('retired-route-410');
  assert.equal(errors.length,0);checks.push('no-browser-exceptions');
  await writeFile('artifacts/browser/checks.json',JSON.stringify({at:new Date().toISOString(),checks,note:'Browser auth/answer fixtures; anonymous HTTP and retired route checks use real server. Real model/service evaluation is separate.'},null,2));
  console.log(JSON.stringify({checks,errors}));
}finally{if(process.argv.includes('--close'))await call('Browser.close').catch(()=>{});ws.close();await fetch('http://localhost:9222/json/close/'+target.id).catch(()=>{});}
