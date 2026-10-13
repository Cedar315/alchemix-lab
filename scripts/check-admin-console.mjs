// Temporary Supabase users are removed in finally. No credentials are logged.
import env from '@next/env';env.loadEnvConfig(process.cwd(),true);
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {default:prisma}=await import('../src/lib/db/prisma.ts');
const {recordTurn,purgeDetails}=await import('../src/lib/admin/telemetry.ts');
const origin=process.env.ADMIN_TEST_ORIGIN||'http://localhost:3003';
const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}});
const users=[];let ws;const checks=[];
async function user(role){const email=`pm-${randomUUID()}@example.com`,password=randomUUID()+'Aa9!';const {data,error}=await supabase.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{role,is_test:true}});if(error)throw Error('Cannot create test identity');users.push(data.user.id);const r=await fetch(origin+'/api/auth/sign-in',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});assert.equal(r.status,200);const cookies=r.headers.getSetCookie().map(c=>c.split(';')[0]);return {id:data.user.id,cookies,cookie:cookies.join('; ')};}
async function req(path,u,body){const r=await fetch(origin+path,{headers:{cookie:u?.cookie||'','Content-Type':'application/json',origin},...(body?{method:'POST',body:JSON.stringify(body)}:{})});let d;try{d=await r.json();}catch{}return {status:r.status,data:d};}
try{
 const admin=await user('admin'),regular=await user('user');
 assert.equal((await req('/api/admin/console',null)).status,401);assert.equal((await req('/api/admin/console',regular)).status,403);checks.push('administrator authorization');
 const turn=randomUUID(),client=randomUUID();
 await recordTurn({id:turn,userId:regular.id,clientId:client,internal:true,surface:'lab',question:'测试 foo@example.com 13812345678',result:{status:'answered',message:'测试回复',knowledge:{status:'answered',claims:[{text:'测试说明',evidenceIds:['test']}],citations:[]},trace:[],model:'fixture'},elapsed:123});
 assert.equal((await req('/api/feedback',admin,{requestId:turn,feedback:'solved'})).status,409);
 assert.equal((await req('/api/feedback',regular,{requestId:turn,feedback:'solved'})).status,200);
 let d=await req('/api/admin/console?view=detail&id='+turn,admin);assert.equal(d.status,200);assert.ok(!JSON.stringify(d.data).includes('foo@example.com'));assert.equal(d.data.rows[0].feedback,'solved');checks.push('owner-only feedback and redacted details');
 const next=randomUUID();await recordTurn({id:next,userId:regular.id,clientId:client,internal:true,surface:'lab',question:'继续追问',result:{status:'needs_info',model:'fixture'},elapsed:23});
 assert.equal((await req('/api/feedback',regular,{requestId:turn,feedback:'unsolved'})).status,409);
 d=await req('/api/admin/console?view=detail&id='+next,admin);assert.equal(d.data.rows[0].feedback,null);checks.push('new turn invalidates stale feedback');
 await prisma.$executeRaw`UPDATE pm_details SET expires_at=now()-interval '1 day' WHERE turn_id=${turn}::uuid`;
 d=await req('/api/admin/console?view=detail&id='+turn,admin);assert.equal(d.data.rows.find(r=>r.id===turn).payload,null);
 await purgeDetails();assert.equal((await prisma.$queryRaw`SELECT count(*)::int n FROM pm_details WHERE turn_id=${turn}::uuid`)[0].n,0);
 await req('/api/admin/console',admin,{action:'review',id:next,pinned:true,status:'investigating',note:'浏览器测试临时案例'});
 await prisma.$executeRaw`UPDATE pm_details SET expires_at=now()-interval '1 day' WHERE turn_id=${next}::uuid`;await purgeDetails();assert.equal((await prisma.$queryRaw`SELECT count(*)::int n FROM pm_details WHERE turn_id=${next}::uuid`)[0].n,1);checks.push('30-day expiration and pinned exception');
 for(const population of ['production','internal']){d=await req('/api/admin/console?population='+population,admin);assert.equal(d.status,200);if(population==='internal')assert.ok(d.data.current.requests>=2);}
 checks.push('real database aggregates');
 const ev=await req('/api/admin/evaluate',admin,{mode:'agent',question:'打开我的记录',caseKey:'navigation-integration',context:''});assert.equal(ev.status,200,JSON.stringify(ev.data));assert.ok(ev.data.payload.result.actions.some(a=>a.action.target==='records'));
 assert.equal((await req('/api/admin/console',admin,{action:'grade',id:ev.data.id,grade:'pass',note:'规则导航接口验证'})).status,200);checks.push('evaluation execution and grading');
 // CDP uses a separate browser profile.
 const target=await fetch('http://localhost:9223/json/new?'+encodeURIComponent('about:blank'),{method:'PUT'}).then(r=>r.json());ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 let n=0;const pending=new Map(),errors=[];
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++n;const timer=setTimeout(()=>reject(Error('CDP timeout '+method)),30000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject});ws.send(JSON.stringify({id,method,params}));});
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(Error(m.error.message)):p?.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);});
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await call('Network.enable');await call('Runtime.enable');await call('Page.enable');
 for(const c of admin.cookies){const i=c.indexOf('=');await call('Network.setCookie',{name:c.slice(0,i),value:c.slice(i+1),url:origin});}
 const evaluate=async(expression)=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;};
 const wait=async(text)=>{for(let i=0;i<80;i++){if(await evaluate(`Boolean(document.body?.innerText.includes(${JSON.stringify(text)}))`))return;await new Promise(r=>setTimeout(r,250));}throw Error('UI not ready: '+text);};
 await mkdir('artifacts/admin-console',{recursive:true});
 for(const path of ['/admin','/admin/users','/admin/agent','/admin/rag','/admin/evaluations','/admin/operations','/admin/content','/admin/knowledge']){
 await call('Page.navigate',{url:origin+path});await wait(path==='/admin/knowledge'?'问答知识审核':path==='/admin/evaluations'?'运行测试':'数据来源：');
 for(let i=0;i<80;i++){if(!(await evaluate("document.body.innerText.includes('正在读取服务端数据')")))break;await new Promise(r=>setTimeout(r,250));}
 assert.equal(await evaluate("document.body.innerText.includes('管理数据暂不可用')"),false,path);
 assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+2'),false,path+' overflow');
 if(path==='/admin/agent'){await evaluate("(()=>{const s=document.querySelector('select[aria-label=\"数据范围\"]');s.value='internal';s.dispatchEvent(new Event('change',{bubbles:true}));})()");for(let attempt=0;attempt<100;attempt++){if(await evaluate("Array.from(document.querySelectorAll('button')).some(b=>b.textContent.includes('查看'))"))break;await new Promise(r=>setTimeout(r,300));}assert.ok(await evaluate("Array.from(document.querySelectorAll('button')).some(b=>b.textContent.includes('查看'))"),'internal task list loaded');await evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('查看')).click()");await wait('任务复盘');assert.ok(await evaluate("document.querySelector('[role=dialog]')!==null"));await evaluate("document.querySelector('[aria-label=\"关闭详情\"]').click()");checks.push('task drawer');}
 if(path==='/admin'||path==='/admin/content'){const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(`artifacts/admin-console/${path==='/admin'?'overview':'content'}.png`,Buffer.from(shot.data,'base64'));}
 checks.push('browser '+path);console.log('verified',path);
 }
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await call('Page.navigate',{url:origin+'/admin'});await wait('已排除管理员');assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+2'),false,'mobile overflow');const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile('artifacts/admin-console/mobile.png',Buffer.from(shot.data,'base64'));checks.push('mobile 390px');
 const visitor=await evaluate("localStorage.getItem('alchemix_session_id')");if(visitor){await prisma.$executeRaw`DELETE FROM pm_events WHERE visitor_id=${visitor}`;await prisma.analyticsEvent.deleteMany({where:{sessionId:visitor}});}
 assert.equal(errors.length,0,JSON.stringify(errors));
 console.log(JSON.stringify({checks,passed:checks.length},null,2));
}finally{
 ws?.close();for(const id of users){await prisma.$executeRaw`DELETE FROM pm_events WHERE user_id=${id}::uuid`;await prisma.$executeRaw`DELETE FROM pm_audit WHERE actor=${id}::uuid`;await prisma.$executeRaw`DELETE FROM pm_evaluations WHERE actor=${id}::uuid`;await prisma.user.deleteMany({where:{id}});await supabase.auth.admin.deleteUser(id);}await prisma.$disconnect();
}
