'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3,Users,Bot,BookOpen,FlaskConical,Activity,Database,ArrowUpRight,LogOut } from 'lucide-react';
const links=[['','产品总览',BarChart3],['users','用户与行为',Users],['agent','Agent',Bot],['rag','RAG 与知识',BookOpen],['evaluations','测试与评估',FlaskConical],['operations','运行与成本',Activity],['content','内容管理',Database]] as const;
export default function AdminShell({children}:{children:React.ReactNode}){
 const path=usePathname();
 return <div className="pm-shell"><aside className="pm-sidebar"><Link href="/admin" className="pm-brand"><span> A<span className="pm-brand-dot">.</span></span><div>AlcheMix<small>产品管理台</small></div></Link><div className="pm-nav-label">工作空间</div><nav>{links.map(([slug,label,Icon])=><Link key={slug} href={`/admin${slug?'/'+slug:''}`} className={path===`/admin${slug?'/'+slug:''}`||slug==='rag'&&(path==='/admin/knowledge'||path.startsWith('/admin/rag/'))?'active':''}><Icon size={18}/>{label}</Link>)}</nav><div className="pm-sidebar-bottom"><span className="pm-live-dot"/> 管理员工作空间<Link href="/">打开产品 <ArrowUpRight size={15}/></Link><button onClick={async()=>{const r=await fetch('/api/auth/sign-out',{method:'POST'});if(r.ok)location.assign('/');else alert('退出失败，请重试');}}><LogOut size={15}/>退出登录</button></div></aside><div className="pm-workspace"><header className="pm-topbar"><span>AlcheMix Lab <span className="pm-muted"> / 管理后台</span></span><span className="pm-admin-badge">管理员</span></header>{children}</div></div>;
}
