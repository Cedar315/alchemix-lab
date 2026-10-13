export const feedbackReasons = ['没理解我的问题', '回答不准确', '建议做不了', '操作失败', '其他'] as const;
export function rate(n: number, d: number): number | null { return d ? Math.round(n / d * 1000) / 10 : null; }
export function dateWindow(search: URLSearchParams, now = new Date()) {
 const days = search.get('days') === '1' ? 1 : search.get('days') === '30' ? 30 : 7;
 let end = now, start = new Date(now.getTime() - days * 86400000);
 if (search.get('start') || search.get('end')) {
  start = new Date(`${search.get('start')}T00:00:00.000Z`); end = new Date(`${search.get('end')}T00:00:00.000Z`);
  end = new Date(end.getTime() + 86400000);
  if (!Number.isFinite(+start) || !Number.isFinite(+end) || end <= start || end.getTime() - start.getTime() > 366 * 86400000) throw Error('请选择有效日期，最长 366 天');
  if (end > now) end = now;
 } else if (days === 1) start = new Date(now.toISOString().slice(0,10)+'T00:00:00Z');
 if(start>=end) throw Error('开始日期必须早于现在');
 return { start, end, previous: new Date(+start - (+end - +start)) };
}
export function scrub(value: unknown, depth = 0): unknown {
 if(depth>8) return '[内容过深]';
 if(typeof value==='string') return value.slice(0,6000).replace(/https?:\/\/[^\s"<>]+/g,u=>{try{const x=new URL(u);x.username='';x.password='';x.search='';x.hash='';return x.toString();}catch{return '[链接]';}}).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[邮箱]').replace(/\b1[3-9]\d{9}\b/g,'[电话]').replace(/(?:Bearer\s+|sk-|api[_-]?key\s*[:=]\s*)[^\s,;"}]+/gi,'[凭据]');
 if(Array.isArray(value)) return value.slice(0,50).map(x=>scrub(x,depth+1));
 if(value&&typeof value==='object') return Object.fromEntries(Object.entries(value).filter(([k])=>!/(password|secret|authorization|cookie|api.?key|reasoning|thinking)/i.test(k)).slice(0,50).map(([k,v])=>[k,scrub(v,depth+1)]));
 return value;
}
export function isInternalIdentity(email: string, metadata: Record<string, unknown> = {}) {
 const admins=(process.env.ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase());
 const tests=(process.env.TEST_EMAILS||'').split(',').map(x=>x.trim().toLowerCase());
 return metadata.role==='admin'||metadata.is_test===true||admins.includes(email.toLowerCase())||tests.includes(email.toLowerCase());
}
