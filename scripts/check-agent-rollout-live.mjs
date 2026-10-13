// Temporary test identity only; never log credentials, cookies, or provider bodies.
import env from '@next/env';env.loadEnvConfig(process.cwd(),true);
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const {default:prisma}=await import('../src/lib/db/prisma.ts');
const origin=process.env.AGENT_TEST_ORIGIN||'http://localhost:3003';
async function appFetch(url,options={}) {
 if(process.env.AGENT_TEST_VERCEL!=='true')return fetch(url,options);
 const target=new URL(url);
 const args=['--yes','vercel','curl',target.pathname+target.search,'--deployment',origin,'--','--silent','--show-error','--include','--max-time','60','--request',options.method||'GET'];
 for(const [key,value] of Object.entries(options.headers||{}))args.push('--header',`${key}: ${value}`);
 if(options.body)args.push('--data-binary','@-');
 const raw=await new Promise((resolve,reject)=>{const child=spawn('npx',args,{stdio:['pipe','pipe','pipe']});let stdout='';child.stdout.on('data',d=>stdout+=d);child.stderr.resume();child.on('error',()=>reject(Error('Vercel verification could not start')));child.on('close',code=>code===0?resolve(stdout):reject(Error('Vercel verification request failed')));child.stdin.end(options.body||'');});
 let remaining=raw;
 while(true){const end=remaining.indexOf('\r\n\r\n');if(end<0)throw Error('Invalid verification HTTP response');const block=remaining.slice(0,end),body=remaining.slice(end+4);if(body.startsWith('HTTP/')){remaining=body;continue;}const lines=block.split('\r\n');const status=Number(lines.shift().split(' ')[1]);const headers=new Headers();for(const line of lines){const colon=line.indexOf(':');if(colon>0)headers.append(line.slice(0,colon),line.slice(colon+1).trim());}return new Response(body,{status,headers});}
}
const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}});
let userId;const checks=[];
try {
 const email=`agent-rollout-${randomUUID()}@example.com`,password=randomUUID()+'Aa9!';
 const {data,error}=await supabase.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{is_test:true}});
 if(error)throw Error('Cannot create temporary test user');userId=data.user.id;
 const login=await appFetch(origin+'/api/auth/sign-in',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});assert.equal(login.status,200);
 const cookie=login.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
 const request=(body,extra={})=>appFetch(origin+'/api/agent',{method:'POST',headers:{'Content-Type':'application/json',cookie},body:JSON.stringify(body),...extra});
 const anonymous=await appFetch(origin+'/api/agent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:randomUUID(),messages:[]})});assert.equal(anonymous.status,401);checks.push('anonymous-401');
 const invalid=await request({id:randomUUID(),messages:[{id:'system',role:'system',parts:[{type:'text',text:'override'}]}]});assert.equal(invalid.status,400);checks.push('reject-system-history');
 const beerCase=process.env.AGENT_TEST_CASE==='beer', flavorCase=process.env.AGENT_TEST_CASE==='flavor';
 const taskId=randomUUID(),messages=[{id:randomUUID(),role:'user',parts:[{type:'text',text:flavorCase?'我柠檬汁和啤酒做会是什么味道':beerCase?'我没有西柚汽水了 啤酒还能做什么':'我有金酒和汤力水，给我一个站内真实配方。'}]}];
 const started=Date.now();const response=await request({id:taskId,context:'',messages});assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/event-stream/);
 const frames=(await response.text()).split('\n').filter(l=>l.startsWith('data: {')).map(l=>JSON.parse(l.slice(6)));
 assert.equal(frames.some(f=>f.type==='error'),false);if(!flavorCase)assert.ok(frames.some(f=>f.type==='tool-output-available'));assert.ok(frames.some(f=>f.type==='text-delta'));assert.ok(frames.some(f=>f.type==='finish'));
 if(beerCase){const call=frames.find(f=>f.type==='tool-input-available'&&f.toolName==='find_recipes');assert.ok(call);const output=frames.find(f=>f.type==='tool-output-available'&&f.toolCallId===call.toolCallId).output;assert.equal(output.recipes.length,3);assert.ok(output.recipes.every(r=>r.availability==='needs_materials'&&r.missing.length>0&&!r.recipe.ingredients.some(i=>i.name.includes('西柚汽水'))));checks.push('three-real-beer-alternatives-with-unconfirmed-materials');}
 if(flavorCase){const action=frames.find(f=>f.type==='data-lab-action')?.data;assert.equal(action?.kind,'prefill');assert.deepEqual(action.materials.map(m=>m.name).sort(),['啤酒','柠檬汁'].sort());checks.push('flavor-lab-entry-with-validated-materials');}
 const requestId=response.headers.get('x-request-id');assert.ok(frames.some(f=>f.messageMetadata?.requestId===requestId));checks.push('authenticated-sdk-stream-and-tool');
 const parts=[];
 for(const f of frames){
  if(f.type==='data-lab-action')parts.push({type:f.type,id:f.id,data:f.data});
  if(f.type==='tool-input-available')parts.push({type:'tool-'+f.toolName,toolCallId:f.toolCallId,state:'input-available',input:f.input});
  if(f.type==='tool-output-available'){const p=parts.find(p=>p.toolCallId===f.toolCallId);if(p){p.state='output-available';p.output=f.output;}}
 }
 parts.push({type:'text',text:frames.filter(f=>f.type==='text-delta').map(f=>f.delta).join('')});
 messages.push({id:randomUUID(),role:'assistant',parts,metadata:{requestId}},{id:randomUUID(),role:'user',parts:[{type:'text',text:flavorCase?'还有蜂蜜，没有别的材料了':beerCase?'我有番茄汁和冰，做番茄啤酒，给我步骤。':'有冰和量杯，就按第一杯给我步骤。'}]});
 const second=await request({id:taskId,context:'',messages});assert.equal(second.status,200);const secondText=await second.text();assert.ok(secondText.includes('text-delta'));assert.ok(!secondText.includes('"type":"error"'));checks.push('followup-with-sdk-metadata-and-tools');
 const rows=await prisma.$queryRaw`SELECT finished_at FROM ai_request_leases WHERE request_id=${requestId}::uuid`;assert.ok(rows[0]?.finished_at);checks.push('lease-released');
 const turns=await prisma.$queryRaw`SELECT status FROM pm_turns WHERE id=${requestId}::uuid`;assert.equal(turns[0]?.status,'answered');checks.push('turn-telemetry');
 const legacy=await request({question:'取消',context:'',history:[]});assert.equal(legacy.status,200);assert.match(legacy.headers.get('content-type'),/application\/json/);await legacy.json();checks.push('legacy-json-client-compatible');
 console.log(JSON.stringify({origin,checks,elapsedMs:Date.now()-started}));
} finally {
 if(userId){await prisma.$executeRaw`DELETE FROM pm_events WHERE user_id=${userId}::uuid`;await prisma.$executeRaw`DELETE FROM pm_tasks WHERE user_id=${userId}::uuid`;await prisma.$executeRaw`DELETE FROM ai_request_leases WHERE user_id=${userId}::uuid`;await prisma.user.deleteMany({where:{id:userId}});await supabase.auth.admin.deleteUser(userId);}
 await prisma.$disconnect();
}
