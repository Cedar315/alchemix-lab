import React, { useState } from 'react';
import { clearTaste, defaultTaste, flavorOptions, resetRecommendations, type Level, type TasteSettings } from '../lib/preferences/taste';

const card = 'rounded-3xl border border-[#e8e8e8] bg-white p-5 space-y-4';
const action = 'min-h-11 rounded-xl border border-neutral-200 px-4 py-2 text-sm text-left';
export default function ProfileSettings({ settings, onSave, onBack, onLogout }: { settings: TasteSettings; onSave: (s: TasteSettings) => boolean; onBack: () => void; onLogout: () => Promise<void> }) {
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  function save(next: TasteSettings, message = '设置已保存') { setNotice(onSave(next) ? message : '保存失败，请检查浏览器存储设置后重试。'); }
  function reset(kind: 'taste' | 'history' | 'all') {
    const message = kind === 'taste' ? '清空手动设置的口味偏好？历史推荐依据会保留。' : kind === 'history' ? '重置推荐记录？此前的酒记不再影响推荐，手动口味偏好会保留。' : '重新了解你的口味？清空口味偏好，并让此前的酒记不再影响推荐。';
    if (!window.confirm(`${message}\n收藏和调饮笔记都会保留。`)) return;
    save(kind === 'taste' ? clearTaste(settings) : resetRecommendations(kind === 'all' ? clearTaste(settings) : settings), '已重置，收藏和调饮笔记已保留');
  }
  return <div className="mx-auto max-w-2xl space-y-5 pb-8">
    <button className={action} onClick={onBack}>← 返回我的</button>
    <div><h2 className="text-2xl font-medium">设置</h2><p className="mt-2 text-xs leading-5 text-neutral-500">口味和推荐设置仅保存在当前浏览器，暂不跨设备同步。</p></div>
    <section className={card} aria-labelledby="taste-title"><h3 id="taste-title" className="font-medium">我的口味</h3>
      {([{ key: 'sweetness', label: '甜度', options: ['少甜', '适中', '偏甜'] }, { key: 'acidity', label: '酸度', options: ['少酸', '适中', '偏酸'] }, { key: 'strength', label: '酒感', options: ['轻', '适中', '浓'] }] as const).map(field => <fieldset key={field.key}><legend className="mb-2 text-sm">{field.label}</legend><div className="grid grid-cols-4 gap-2">{['不限', ...field.options].map((label,i) => { const value = (['any','low','medium','high'] as Level[])[i]; return <button key={value} aria-pressed={settings[field.key] === value} onClick={() => save({ ...settings, [field.key]: value })} className={`min-h-11 rounded-xl border text-sm ${settings[field.key] === value ? 'bg-neutral-950 text-white border-neutral-950' : 'border-neutral-200'}`}>{label}</button>; })}</div></fieldset>)}
      <p className="text-xs text-neutral-500">酒感是入口感受，不代表实际酒精含量。</p>
      <fieldset><legend className="mb-2 text-sm">喜欢的风味 · 可多选</legend><div className="flex flex-wrap gap-2">{flavorOptions.map(flavor => <button key={flavor} aria-pressed={settings.flavors.includes(flavor)} onClick={() => save({ ...settings, flavors: settings.flavors.includes(flavor) ? settings.flavors.filter(f => f !== flavor) : [...settings.flavors, flavor] })} className={`${action} ${settings.flavors.includes(flavor) ? 'bg-neutral-950 text-white' : ''}`}>{flavor}</button>)}</div><p className="mt-2 text-xs text-neutral-500">不选即不限；本次选酒时的明确要求优先。</p></fieldset>
      <button className={action} onClick={() => reset('taste')}>清空口味偏好</button>
    </section>
    <section className={card}><h3 className="font-medium">个性化推荐</h3>
      <label className="flex min-h-11 items-center justify-between gap-4 text-sm">根据历史行为推荐<input type="checkbox" className="h-5 w-5 accent-neutral-950" checked={settings.useHistory} onChange={e => save({ ...settings, useHistory: e.target.checked })}/></label>
      <p className="text-xs leading-6 text-neutral-500">开启后参考最近 90 天评分 4 星及以上的酒记，较早记录影响更小。关闭后只参考手动口味、本次要求和材料。</p>
      <div className="flex flex-col gap-2"><button className={action} onClick={() => reset('history')}>重置推荐记录</button><button className="min-h-12 rounded-xl bg-neutral-950 px-4 text-sm text-white" onClick={() => reset('all')}>重新了解我的口味</button></div>
      <p className="text-xs leading-5 text-neutral-500">重新了解会清空口味并重置历史推荐依据，保留收藏和调饮笔记。</p>
    </section>
    <section className={card}><h3 className="font-medium">隐私与权限</h3><p className="text-sm leading-6 text-neutral-600">这些偏好在当前浏览器内用于「帮我选一杯」的推荐排序，不会修改经典配方。相机、通知和定位目前无需授权。</p><a className="inline-flex min-h-11 items-center text-sm underline" href="/privacy">隐私政策</a></section>
    <section className={card}><h3 className="font-medium">账号与数据</h3><p className="text-xs leading-6 text-neutral-500">收藏和酒记由账号管理。下方操作仅清除当前浏览器的口味设置与推荐依据，不删除账号、收藏或酒记。</p><button className={`${action} w-full text-red-700`} onClick={() => { if (window.confirm('清除本浏览器的口味设置并关闭历史推荐？收藏和酒记会保留。')) save(resetRecommendations({ ...defaultTaste }), '本浏览器口味设置已清除，历史推荐已关闭'); }}>清除本浏览器口味设置</button><button disabled={busy} className={`${action} w-full disabled:opacity-50`} onClick={async () => { setBusy(true); try { await onLogout(); onBack(); } catch { setNotice('退出失败，请重试'); } finally { setBusy(false); } }}>退出登录</button></section>
    <p role="status" className="sticky bottom-0 rounded-xl bg-[#f6f5f1] p-3 text-sm empty:hidden">{notice}</p>
  </div>;
}
