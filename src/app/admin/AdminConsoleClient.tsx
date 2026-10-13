'use client';
import { useEffect,useRef,useState } from 'react';
import Link from 'next/link';
import { z } from 'zod';
import { findRecipe } from '@/lib/agent/workflow-catalog';
import { ArrowUpRight,RefreshCw,ChevronRight,X,Play,CheckCircle,Clock,Users,MessageSquare,GlassWater,Activity } from 'lucide-react';
import { evaluationCases } from '@/lib/admin/evaluation-cases';
type Row=Record<string,any>;
const names:Record<string,string>={overview:'产品总览',users:'用户与行为',agent:'Agent',rag:'RAG 与知识',evaluations:'测试与评估',operations:'运行与成本',content:'内容管理'};
const labels:Record<string,string>={answered:'已返回回答',needs_info:'需要追问',handoff:'提供操作入口',cancelled:'已取消',out_of_scope:'超出范围',unavailable:'不可用',timeout:'超时',limited:'限额',error:'错误',no_results:'无结果',no_evidence:'无证据',insufficient_evidence:'证据不足',knowledge:'知识问答',operate:'操作',recommend:'推荐',troubleshoot:'故障排查',change:'调整',guide:'指导',unclear:'意图不明',explore:'探索',named:'指定酒款',solved:'解决了',unsolved:'没解决',unreviewed:'待复核',investigating:'处理中',fixed:'待复测',verified:'已验证',direct_or_unknown:'直接 / 未知',lab:'实验室 / 首页',inspiration:'灵感',finder:'助手 / 选酒',pending:'待人工评价',pass:'人工通过',fail:'人工不通过',retrieved:'检索完成',running:'运行中'};
const display=(x:unknown)=>x===null||x===undefined?'—':String(x);
const date=(x:string)=>new Date(x).toLocaleString('zh-CN',{timeZone:'UTC',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
async function api(url:string,body?:unknown){const r=await fetch(url,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'请求失败');return d;}
function Empty({children='这个时间范围还没有记录。'}:{children?:React.ReactNode}){return <div className="pm-empty">{children}</div>;}
function Panel({title,note,children,action}:{title:string;note?:string;children:React.ReactNode;action?:React.ReactNode}){return <section className="pm-panel"><div className="pm-panel-head"><div><h2>{title}</h2>{note&&<p className="pm-note">{note}</p>}</div>{action}</div>{children}</section>;}
function Bars({rows}:{rows:Row[]}){const max=Math.max(1,...rows.map(r=>r.value));return rows.length?<div className="pm-bars">{rows.map((r,i)=><div key={i} className="pm-bar-row"><span title={r.label}>{labels[r.label]||r.label}</span><div className="pm-bar-track"><div className="pm-bar-fill" style={{width:`${r.value/max*100}%`}}/></div><span>{r.value}</span></div>)}</div>:<Empty/>;}
function Card({title,value,note,previous,icon:Icon=Activity,onClick}:{title:string;value:unknown;note:string;previous?:number;icon?:typeof Activity;onClick?:()=>void}){return <button className="pm-card" onClick={onClick} disabled={!onClick}><span className="pm-card-title">{title}<Icon size={16}/></span><strong className="pm-number">{display(value)}</strong>{previous!==undefined&&<div className="pm-delta">上期 {previous} · 变化 {typeof value==='number'?`${value-previous>=0?'+':''}${value-previous}`:'—'}</div>}<span className="pm-note">{note}</span></button>;}
function Table({columns,rows,onRow}:{columns:Array<[string,string]>;rows:Row[];onRow?:(row:Row)=>void}){return !rows.length?<Empty/>:<div className="pm-table-wrap"><table className="pm-table"><thead><tr>{columns.map(([k,l])=><th key={k}>{l}</th>)}{onRow&&<th>详情</th>}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.id||i}>{columns.map(([k])=><td key={k} title={display(r[k])}>{k==='created_at'?date(r[k]):labels[r[k]]||display(r[k])}</td>)}{onRow&&<td><button className="pm-btn small" onClick={()=>onRow(r)}>查看 <ChevronRight size={12}/></button></td>}</tr>)}</tbody></table></div>;}
export default function AdminConsoleClient({section='overview'}:{section?:string}){
 const [days,setDays]=useState('7'),[population,setPopulation]=useState('production'),[start,setStart]=useState(''),[end,setEnd]=useState(''),[data,setData]=useState<Row|null>(null),[rows,setRows]=useState<Row[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[refresh,setRefresh]=useState(0),[page,setPage]=useState(0),[filter,setFilter]=useState(section==='rag'?'rag':'all'),[kind,setKind]=useState('ingredients'),[query,setQuery]=useState('');
 const [detail,setDetail]=useState<Row[]|null>(null),[selected,setSelected]=useState<Row|null>(null),[note,setNote]=useState(''),[review,setReview]=useState('unreviewed'),[pinned,setPinned]=useState(false),[saving,setSaving]=useState(false),[notice,setNotice]=useState('');
 const drawerRef=useRef<HTMLDivElement>(null),previousFocus=useRef<HTMLElement|null>(null);
 useEffect(()=>{const f=new URLSearchParams(location.search).get('filter');if(f&&['issues','pinned','rag'].includes(f))setFilter(f);},[]);
 const params=new URLSearchParams({days,population,page:String(page),filter,kind,q:query});if(days==='custom'&&start&&end){params.set('start',start);params.set('end',end);}
 const key=params.toString();
 useEffect(()=>{setPage(0);},[days,population,start,end,filter,kind,query]);
 useEffect(()=>{
 let active=true;setLoading(true);setError('');setData(null);setRows([]);
 if(days==='custom'&&(!start||!end)){setLoading(false);return;}
 Promise.all([api(`/api/admin/console?view=overview&${key}`),['agent','rag'].includes(section)?api(`/api/admin/console?view=turns&${key}`):section==='content'?api(`/api/admin/console?view=content&${key}`):section==='operations'?api('/api/admin/console?view=audit'):Promise.resolve({rows:[]})]).then(([d,r])=>{if(active){setData(d);setRows(r.rows);}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};
 },[key,section,refresh,days,start,end]);
 useEffect(()=>{if(!selected)return;previousFocus.current=document.activeElement as HTMLElement;drawerRef.current?.focus();return()=>previousFocus.current?.focus();},[selected]);
 async function open(row:Row){setSelected(row);setDetail(null);setNote(row.review_note||'');setReview(row.review_status||'unreviewed');setPinned(Boolean(row.pinned));setNotice('');try{if(section==='content')setDetail([row]);else{const d=await api(`/api/admin/console?view=detail&id=${row.id}`);setDetail(d.rows);const current=d.rows.find((r:Row)=>r.id===row.id);setNote(current?.review_note||'');}}catch(e){setNotice(e instanceof Error?e.message:'加载失败');}}
 async function saveReview(){if(!selected)return;setSaving(true);try{await api('/api/admin/console',{action:'review',id:selected.id,pinned,status:review,note});setNotice('已保存');setRefresh(v=>v+1);}catch(e){setNotice(e instanceof Error?e.message:'保存失败');}finally{setSaving(false);}}
 const s=data?.current||{},p=data?.previousComplete?data.previous:{};
 const go=(view:string)=>{location.href=`/admin/${view}?`;};
 return <main className="pm-main"><div className="pm-heading"><div><h1>{names[section]}</h1><p>{section==='overview'?'了解用户获得的价值，找到下一件值得改进的事。':section==='evaluations'?'运行真实服务测试，保留证据，人工判断质量。':'从汇总进入具体记录，按证据处理问题。'}</p></div><div className="pm-controls"><select aria-label="数据范围" value={population} onChange={e=>setPopulation(e.target.value)}><option value="production">正式用户</option><option value="internal">内部使用</option></select><select aria-label="时间范围" value={days} onChange={e=>setDays(e.target.value)}><option value="1">今天</option><option value="7">最近 7 天</option><option value="30">最近 30 天</option><option value="custom">自定义</option></select><button className="pm-btn" aria-label="刷新" onClick={()=>setRefresh(v=>v+1)}><RefreshCw size={15}/></button></div></div>
 {days==='custom'&&<div className="pm-controls"><label>开始 <input aria-label="开始日期" type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label>结束 <input aria-label="结束日期" type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label></div>}
 {error&&<div className="pm-error" role="alert">{error}<button className="pm-btn small" onClick={()=>setRefresh(v=>v+1)}>重试</button></div>}
 {loading&&<Empty>正在读取服务端数据…</Empty>}
 {!loading&&data&&<>
 <div className="pm-banner">{population==='production'?'已排除管理员与已标记测试账号':'仅管理员与已标记测试账号'} · {data.coverage?`行为采集始于 ${date(data.coverage)} UTC`:'行为数据尚未开始积累'} · {!data.previousComplete&&'上期采集不完整，暂不比较。'}未反馈不算解决。</div>
 {section==='overview'&&<>
 <div className="pm-cards"><Card title="活跃用户" value={s.active} previous={p.active} note="期间有服务端行为记录的登录用户" icon={Users} onClick={()=>go('users')}/><Card title="反馈已解决" value={s.solved} previous={p.solved} note={`有反馈 ${s.solved+s.unsolved}/${s.tasks} 个任务 · 覆盖率 ${s.feedbackRate===null?'—':s.feedbackRate+'%'}`} icon={CheckCircle} onClick={()=>go('agent')}/><Card title="实际制作用户" value={s.makers} previous={p.makers} note={`用户自报完成 · ${s.drinks} 杯记录`} icon={GlassWater} onClick={()=>go('users')}/><Card title="AI 使用用户" value={s.ai_users} previous={p.ai_users} note={`${s.tasks} 个页面任务 · ${s.requests} 次请求`} icon={MessageSquare} onClick={()=>go('agent')}/></div>
 <div className="pm-grid"><Panel title="活跃用户趋势" note="按 UTC 日期去重；只显示已采集日期"><Trend rows={data.trend}/></Panel><Panel title="需要关注" note="从异常进入任务明细"><Queue title="用户反馈未解决" count={s.unsolved} href="/admin/agent?filter=issues" note="复盘用户意图和实际结果"/><Queue title="RAG 证据不足" count={s.insufficient} href="/admin/rag?filter=issues" note="区分知识缺口与检索适用性"/><Queue title="请求异常与限额" count={s.failures} href="/admin/operations" note="查看错误、超时和限制"/><Queue title="已标记案例" count={data.queues.reduce((n:number,r:Row)=>n+r.count,0)} href="/admin/agent?filter=pinned" note="跟踪处理中、待复测与已验证"/></Panel></div>
 <div className="pm-grid"><Panel title="用户需求分布" note="按请求的意图分类"><Bars rows={data.intents}/></Panel><Panel title="服务体验" note="系统执行结果与用户解决反馈分开统计"><Bars rows={data.statuses}/><p className="pm-footnote">中位耗时 {s.p50===null?'—':(s.p50/1000).toFixed(1)+' 秒'} · P95 {s.p95===null?'—':(s.p95/1000).toFixed(1)+' 秒'} · 费用待接入完整计费数据</p></Panel></div>
 </>}
 {section==='users'&&<>
 <div className="pm-cards"><Card title="注册用户总数" value={data.users.total} note="来自认证用户表，按账号去重"/><Card title="新增注册用户" value={data.users.new} previous={data.previousComplete?data.users.previous:undefined} note="按账号注册时间"/><Card title="回访用户" value={s.returning} previous={p.returning} note="本期活跃，且本期之前有行为记录"/><Card title="匿名访客标识" value={s.visitors} previous={p.visitors} note="按浏览器标识去重，不等同自然人数"/></div>
 <Panel title="使用与制作" note="这些是阶段人数，不是严格因果漏斗；开始制作按显式按钮记录"><Bars rows={[{label:'活跃用户',value:s.active},{label:'使用 AI',value:s.ai_users},{label:'AI 后有制作记录',value:s.ai_makers},{label:'全部制作用户',value:s.makers}]}/><p className="pm-footnote">AI 后有制作记录：本期创建任务后、期末前提交了酒记；不代表制作的是 AI 推荐的同一杯。开始制作意向共 {s.starts} 次。</p></Panel>
 <div className="pm-grid"><Panel title="访问来源" note="按浏览器标识去重；直接或无法识别来源单列"><Bars rows={data.sources}/></Panel><Panel title="功能访问" note="已接入的页面浏览事件"><Bars rows={data.behaviors}/></Panel></div>
 <Panel title="首次观测用户留存" note="按首次服务端行为日期分组；D1 / D7 为对应 UTC 自然日再次活跃，未成熟显示 —"><Table columns={[["day","首次观测日期"],["users","用户数"],["d1","D1 回访人数"],["d7","D7 回访人数"]]} rows={data.cohorts}/></Panel>
 </>}
 {['agent','rag'].includes(section)&&<>
 <div className="pm-cards"><Card title={section==='rag'?'涉及 RAG 的请求':'请求次数'} value={section==='rag'?s.rag:s.requests} note="按请求计数"/><Card title="证据不足" value={s.insufficient} note={`RAG 请求 ${s.rag} 次；不等同检索失败`}/><Card title="反馈解决率" value={s.solvedRate===null?'—':`${s.solvedRate}%`} note={`${s.solved}/${s.solved+s.unsolved} 个有反馈任务；未知 ${s.tasks-s.solved-s.unsolved}`}/><Card title="需要追问" value={s.clarifications} note="信息不足时的正常追问，不直接算失败"/></div>
 {section==='rag'&&<div className="pm-tabs"><Link href="/admin/knowledge">知识审核与发布 <ArrowUpRight size={12}/></Link><Link href="/admin/rag/test">检索调试与索引维护</Link><Link href="/admin/evaluations">运行评估</Link></div>}
 <div className="pm-grid"><Panel title={section==='rag'?'知识问答执行情况':'用户意图'}><Bars rows={section==='rag'?[{label:'返回有引用回答',value:s.rag-s.insufficient},{label:'证据不足',value:s.insufficient}]:data.intents}/></Panel><Panel title="没解决的原因" note="原因选填；未填单独统计"><Bars rows={data.reasons}/></Panel></div>
 <Panel title="任务请求记录" note="每页 25 条；点开后按需加载同一页面任务的多轮记录" action={<select className="pm-input" aria-label="记录筛选" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">全部请求</option><option value="issues">异常 / 未解决</option><option value="pinned">已标记案例</option><option value="rag">涉及 RAG</option></select>}><Table rows={rows.slice(0,25)} columns={[["created_at","时间 UTC"],["surface","入口"],["intent","意图"],["status","执行状态"],["feedback","任务反馈"],["elapsed_ms","耗时 ms"],["review_status","处理状态"]]} onRow={r=>void open(r)}/><Pagination page={page} more={rows.length>25} setPage={setPage}/></Panel>
 {section==='agent'&&<Panel title="工具调用" note="非 ok/success/answered 状态需结合工具语义复核，不能直接当失败"><Table rows={data.tools} columns={[["label","工具"],["value","调用次数"],["non_ok","其他状态"]]}/></Panel>}
 </>}
 {section==='operations'&&<>
 <div className="pm-cards"><Card title="请求量" value={s.requests} previous={p.requests} note="已接入 Agent 请求"/><Card title="错误 / 超时 / 限额" value={s.failures} previous={p.failures} note="计入业务不可用；不把证据不足算错误"/><Card title="P95 耗时" value={s.p95===null?'—':`${(s.p95/1000).toFixed(1)}s`} note="95% 已记录请求不超过此时长" icon={Clock}/><Card title="实际费用" value="待采集" note="模型规划、嵌入、生成、核对和搜索未统一计费；不以局部用量推算总价"/></div>
 <Panel title="模型与版本" note="用量只展示记录覆盖情况；嵌套服务调用可能不完整"><Table rows={data.models} columns={[["model","模型"],["version","版本"],["requests","请求次数"],["avg_ms","平均耗时 ms"],["usage_recorded","有用量记录的请求"]]}/></Panel>
 <Panel title="数据保留" note="普通对话详情 30 天后不再可读；标记案例保留。汇总元数据长期保存"><button className="pm-btn" onClick={async()=>{try{await api('/api/admin/console',{action:'purge'});setNotice('已清理过期详情');}catch(e){setNotice(e instanceof Error?e.message:'清理失败');}}}>立即执行过期清理</button>{notice&&<p role="status">{notice}</p>}</Panel>
 <Panel title="管理员操作记录" note="最近 100 条；操作人显示账号 ID"><Table rows={rows} columns={[["created_at","时间 UTC"],["actor","操作人"],["action","操作"],["target","对象"]]}/></Panel>
 </>}
 {section==='content'&&<Panel title="内容查询" note="直接读取数据库；当前版本仅查询"><div className="pm-controls"><select aria-label="内容类型" value={kind} onChange={e=>setKind(e.target.value)}><option value="ingredients">配料</option><option value="recipes">酒单</option></select><input aria-label="搜索内容" placeholder="搜索中文 / 英文名称" value={query} onChange={e=>setQuery(e.target.value)}/></div><Table rows={rows.slice(0,25)} columns={kind==='ingredients'?[["nameZh","配料"],["nameEn","英文名"],["category","分类"],["sourceType","来源类型"],["confidence","可信度"]]:[["nameCn","酒单"],["nameEn","英文名"],["type","类型"],["isPublished","已发布"]]} onRow={r=>void open(r)}/><Pagination page={page} more={rows.length>25} setPage={setPage}/></Panel>}
 </>}
 {section==='evaluations'&&<EvaluationWorkspace/>}
 <p className="pm-footnote">数据来源：服务端产品事件、任务记录、产品用户表 · UTC 时间 · {data?`更新于 ${date(data.asOf)} · 版本 ${data.version}`:'等待服务端数据'}<br/>页面任务以一次页面对话为单位，可能包含多个用户意图；用户反馈以该任务最新一轮为准。尚未采集的历史数据不参与对比解释。</p>
 {selected&&<div className="pm-overlay" onClick={()=>setSelected(null)}><div ref={drawerRef} tabIndex={-1} className="pm-drawer" role="dialog" aria-modal="true" aria-label="记录详情" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape')setSelected(null);if(e.key==='Tab'){const nodes=drawerRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,textarea,a[href]');const first=nodes?.[0],last=nodes?.[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}><div className="pm-panel-head"><h2>{section==='content'?'内容详情':'任务复盘'}</h2><button className="pm-btn" aria-label="关闭详情" onClick={()=>setSelected(null)}><X size={18}/></button></div>{notice&&<p role="status">{notice}</p>}{!detail?<Empty>正在读取详情…</Empty>:section==='content'?<pre>{JSON.stringify(detail[0],null,2)}</pre>:<>
 <div className="pm-note">已自动遮盖常见邮箱、电话与凭据；自由文本仍需谨慎处理。最多显示 100 轮。</div>
 {detail.map(r=><article className="pm-turn" key={r.id}><div className="pm-note">{date(r.created_at)} UTC · {labels[r.status]||r.status} · {r.elapsed_ms}ms · {r.version}</div>{r.payload?<><h3 className="mt-3 font-semibold">用户问题</h3><p>{r.payload.question}</p><button className="pm-btn small" onClick={()=>{sessionStorage.setItem('pm-retest',JSON.stringify({question:r.payload.question}));location.assign('/admin/evaluations');}}>带入单条测试</button><h3 className="font-semibold">最终回复</h3><p>{r.payload.message}{r.payload.clarification&&'\n'+r.payload.clarification}</p>{r.payload.knowledge?.claims?.map((c:Row,i:number)=><p key={i}>{c.text}</p>)}<details><summary>页面背景、工具与检索证据</summary><pre>{JSON.stringify({context:r.payload.context,actions:r.payload.actions,trace:r.tool_summary,knowledge:r.payload.knowledge,diagnostics:r.payload.diagnostics,usage:r.usage},null,2)}</pre></details></>:<Empty>详情已过期或未采集，汇总记录仍保留。</Empty>}</article>)}
 <section className="pm-turn"><h3>标记所选请求</h3><p className="pm-note">{selected.id}</p><label><input type="checkbox" checked={pinned} onChange={e=>setPinned(e.target.checked)}/> 保留为问题案例（取消后恢复 30 天规则）</label><select aria-label="处理状态" className="pm-input" value={review} onChange={e=>setReview(e.target.value)}>{['unreviewed','investigating','fixed','verified'].map(v=><option key={v} value={v}>{labels[v]}</option>)}</select><textarea className="pm-input" aria-label="复盘说明" maxLength={2000} placeholder="问题、证据、修复说明与复测结论" value={note} onChange={e=>setNote(e.target.value)}/><button className="pm-btn primary" disabled={saving} onClick={()=>void saveReview()}>保存处理记录</button></section></>}</div></div>}
 </main>;
}
function Queue({title,count,href,note}:{title:string;count:number;href:string;note:string}){return <Link href={href} className="pm-queue-item"><div><strong>{title}</strong><p>{note}</p></div><span>{count} <ChevronRight size={13} className="inline"/></span></Link>;}
function Pagination({page,more,setPage}:{page:number;more:boolean;setPage:(n:number)=>void}){return <div className="pm-pagination"><button className="pm-btn small" disabled={!page} onClick={()=>setPage(page-1)}>上一页</button><span>第 {page+1} 页</span><button className="pm-btn small" disabled={!more} onClick={()=>setPage(page+1)}>下一页</button></div>;}
function Trend({rows}:{rows:Row[]}){const max=Math.max(1,...rows.map(r=>r.active));return rows.length?<div className="pm-trend" aria-label="每日活跃用户">{rows.map(r=><div key={r.day} className="pm-trend-column" title={`${r.day}：${r.active} 人`}><span>{r.active}</span><i style={{height:`${r.active/max*130}px`}}/><small>{r.day.slice(5)}</small></div>)}</div>:<Empty>开始产生行为后，这里显示每日活跃趋势。</Empty>;}
function evaluationDuration(row:Row){
 const ms=row.elapsedMs??row.elapsed_ms;
 return row.status==='running'?'运行中':typeof ms==='number'&&Number.isFinite(ms)&&ms>=0?`${(ms/1000).toFixed(2)} 秒`:'—';
}
function EvaluationWorkspace(){
 const [mode,setMode]=useState('agent'),[question,setQuestion]=useState('苏打水能放进密闭摇酒壶摇吗？'),[context,setContext]=useState(''),[checked,setChecked]=useState<string[]>(['carbonation']),[busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState(''),[rows,setRows]=useState<Row[]>([]),[result,setResult]=useState<Row|null>(null),[compare,setCompare]=useState<string[]>([]),[comparison,setComparison]=useState<Row[]>([]),[note,setNote]=useState('');
 const stop=useRef(false);
 async function load(){try{const d=await api('/api/admin/console?view=evaluations');setRows(d.rows);}catch(e){setError(e instanceof Error?e.message:'读取失败');}}
 useEffect(()=>{void load();try{const v=JSON.parse(sessionStorage.getItem('pm-retest')||'null');if(v?.question)setQuestion(v.question);sessionStorage.removeItem('pm-retest');}catch{}},[]);
 async function run(batch:boolean){setBusy(true);setError('');stop.current=false;const cases=batch?evaluationCases.filter(c=>checked.includes(c.id)):[{id:'custom',question,title:'自定义',expected:'请人工评价'}];try{for(let i=0;i<cases.length;i++){if(stop.current)break;const c=cases[i];setProgress(`${i+1}/${cases.length} · ${c.title}`);try{const d=await api('/api/admin/evaluate',{mode,question:c.question,context,caseKey:c.id});setResult(d);setNote('');}catch(e){setError(e instanceof Error?e.message:'测试失败');}await load();}}finally{setBusy(false);setProgress(stop.current?'已停止后续测试':'运行结束');}}
 async function inspect(row:Row){try{const d=await api(`/api/admin/console?view=evaluation&id=${row.id}`);setResult(d.rows[0]);setNote(d.rows[0]?.note||'');}catch(e){setError(e instanceof Error?e.message:'读取失败');}}
 return <>
 <Panel title="运行测试" note="真实模型调用会计费，使用管理员额度；后台测试不会写入正式用户指标或知识候选队列。"><div className="pm-controls"><select className="pm-input" aria-label="测试模式" disabled={busy} value={mode} onChange={e=>setMode(e.target.value)}><option value="agent">Agent 完整流程（当前新版）</option><option value="rag">RAG 检索并回答</option><option value="retrieve">仅检索</option></select><span className="pm-note">批量串行执行；不自动重试失败请求</span></div><label>测试问题<textarea className="pm-input pm-test-area" value={question} onChange={e=>setQuestion(e.target.value)} maxLength={1000}/></label><label>页面 / RAG 背景（可选，不填则无背景）<input className="pm-input w-full" value={context} onChange={e=>setContext(e.target.value)} maxLength={2000}/></label><div className="pm-checks">{evaluationCases.map(c=><label key={c.id} title={c.expected}><input type="checkbox" disabled={busy} checked={checked.includes(c.id)} onChange={e=>setChecked(s=>e.target.checked?[...s,c.id]:s.filter(id=>id!==c.id))}/> {c.title}</label>)}</div><div className="pm-controls"><button className="pm-btn primary" disabled={busy||!question.trim()} onClick={()=>void run(false)}><Play size={14}/>运行单条</button><button className="pm-btn" disabled={busy||!checked.length} onClick={()=>void run(true)}>运行选定 {checked.length} 条</button>{busy&&<button className="pm-btn" onClick={()=>{stop.current=true;}}>本条结束后停止</button>}<span role="status" className="pm-note">{progress}</span></div>{error&&<div role="alert" className="pm-error">{error}</div>}</Panel>
 {result&&<Panel title="测试证据与人工评价" note={`记录 ${result.id} · ${labels[result.status]||result.status}`}><p className="pm-note">预期：{evaluationCases.find(c=>c.id===result.case_key)?.expected||'请对照问题、证据与适用范围评价；运行成功不等于回答正确。'}</p><p className="pm-note" title="服务端从收到测试请求到结果准备保存的耗时，包含鉴权和工具调用；不含浏览器传输时间。"><Clock size={14} className="inline"/> 响应时长：<strong>{evaluationDuration(result)}</strong></p><EvaluationAnswer key={result.id} payload={result.payload}/><input className="pm-input w-full" aria-label="评价说明" placeholder="填写依据、问题或回归结果" maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/><div className="pm-controls mt-3">{[['pass','人工通过'],['fail','人工不通过'],['pending','保持待审']].map(([grade,label])=><button key={grade} className="pm-btn" disabled={busy} onClick={async()=>{try{await api('/api/admin/console',{action:'grade',id:result.id,grade,note});await load();setProgress('人工评价已保存');}catch(e){setError(e instanceof Error?e.message:'保存失败');}}}>{label}</button>)}</div></Panel>}
 <Panel title="历史运行与版本对比" note="最近 100 条；选择同一案例、同一模式的两条运行，核对输入一致后比较"><div className="pm-table-wrap"><table className="pm-table"><thead><tr><th>对比</th><th>时间 UTC</th><th>案例</th><th>版本</th><th>模式</th><th>结果</th><th>响应时长</th><th>人工评价</th><th>详情</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><input type="checkbox" aria-label={`选择运行 ${r.id}`} checked={compare.includes(r.id)} disabled={!compare.includes(r.id)&&compare.length===2} onChange={e=>setCompare(v=>e.target.checked?[...v,r.id]:v.filter(x=>x!==r.id))}/></td><td>{date(r.created_at)}</td><td>{r.case_key}</td><td>{r.version}</td><td>{r.mode==='agent-next'?'Agent 当前新版':r.mode==='agent'?'Agent 旧版':r.mode}</td><td>{labels[r.status]||r.status}</td><td>{evaluationDuration(r)}</td><td>{labels[r.grade]}</td><td><button className="pm-btn small" onClick={()=>void inspect(r)}>查看</button></td></tr>)}</tbody></table></div>{!rows.length&&<Empty>还没有测试运行，选择案例开始。</Empty>}<button className="pm-btn mt-4" disabled={compare.length!==2} onClick={async()=>{try{const chosen=rows.filter(r=>compare.includes(r.id));if(chosen[0].case_key!==chosen[1].case_key||chosen[0].mode!==chosen[1].mode)throw Error('请选择同一案例、同一模式');const d=await Promise.all(compare.map(id=>api(`/api/admin/console?view=evaluation&id=${id}`)));const pair=d.map(x=>x.rows[0]);if(pair[0].payload?.question!==pair[1].payload?.question||pair[0].payload?.context!==pair[1].payload?.context||JSON.stringify(pair[0].payload?.history||[])!==JSON.stringify(pair[1].payload?.history||[]))throw Error('两次运行的输入不同，请选择输入一致的记录');setComparison(pair);}catch(e){setError(e instanceof Error?e.message:'对比失败');}}}>并排比较选中运行</button></Panel>
 {!!comparison.length&&<div className="pm-grid">{comparison.map(r=><Panel key={r.id} title={r.version} note={`${r.model} · 响应时长 ${evaluationDuration(r)} · ${labels[r.grade]}`}><EvaluationAnswer payload={r.payload}/></Panel>)}</div>}
 </>;
}

function EvaluationAnswer({payload}:{payload?:Row}){
 const result=payload?.result;
 const answer=result?.answer||result?.knowledge;
 const texts=[result?.message,result?.clarification,answer?.message,
  ...(Array.isArray(answer?.claims)?answer.claims.map((c:Row)=>c.text):[])]
  .filter((text):text is string=>typeof text==='string'&&Boolean(text.trim()));
 const hits=Array.isArray(result?.hits)?result.hits:[];
 return <div className="pm-evaluation-answer">
  <EvaluationRecipes tools={result?.tools}/>
  {texts.length?<div className="pm-answer-text">{[...new Set(texts)].join('\n\n')}</div>
   :hits.length?<div className="pm-answer-text">检索到 {hits.length} 条知识：{hits.map((hit:Row,i:number)=><p key={i}>{i+1}. {hit.document?.title||hit.document?.id||'知识片段'}</p>)}</div>
   :<p className="pm-note">{Array.isArray(result?.hits)?'未检索到匹配知识。':'本次没有可展示的答案，请查看运行状态或详细记录。'}</p>}
  <details className="pm-answer-details"><summary>查看详细记录（工具调用 / JSON）</summary><pre className="pm-json">{JSON.stringify(payload,null,2)}</pre></details>
 </div>;
}

const evaluationRecipeSchema=z.object({recipeId:z.string(),kind:z.enum(['classic','convenience'])});
function EvaluationRecipes({tools}:{tools:unknown}){
 const parsed=z.array(z.object({tool:z.string(),output:z.unknown()})).safeParse(tools);
 if(!parsed.success)return null;
 const cards=new Map<string,{entry:NonNullable<ReturnType<typeof findRecipe>>;missing:string[]}>();
 for(const tool of parsed.data){
  if(!['get_recipe','find_recipes'].includes(tool.tool))continue;
  const output=z.object({recipes:z.array(z.unknown())}).safeParse(tool.output);
  if(!output.success)continue;
  for(const row of output.data.recipes){
   const raw=row&&typeof row==='object'&&'recipe' in row?row.recipe:row;
   const recipe=evaluationRecipeSchema.safeParse(raw);
   if(!recipe.success)continue;
   const entry=findRecipe(recipe.data.kind,recipe.data.recipeId);
   if(!entry)continue;
   const missing=z.object({missing:z.array(z.string())}).safeParse(row);
   const key=`${recipe.data.kind}:${entry.id}`;
   const prior=cards.get(key);
   cards.set(key,{entry,missing:missing.success?missing.data.missing:prior?.missing||[]});
  }
 }
 if(!cards.size)return null;
 return <section className="pm-evaluation-recipes" aria-label="本次查到的酒单"><h3>本次查到的酒单</h3>
  {[...cards].map(([key,{entry,missing}])=><article className="pm-evaluation-recipe" key={key}>
   <strong>{entry.nameZh}</strong><span className="pm-note">{entry.nameEn}</span>
   <p>{entry.description}</p>
   {!!missing.length&&<p className="pm-note">还需准备或确认：{missing.join('、')}</p>}
   <a className="pm-btn" href={entry.href} target="_blank" rel="noopener noreferrer">查看{entry.nameZh}酒单 <ArrowUpRight size={14}/><span className="pm-note">新标签页</span></a>
  </article>)}
 </section>;
}
