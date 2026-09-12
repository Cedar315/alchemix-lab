import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, GlassWater, Leaf, RotateCcw, Sparkles } from "lucide-react";
import { BEGINNER_CATALOG } from "./InspirationScreen";
import { Answers, emptyAnswers, matchDrinks, replaceDrink, repairSlots, mixerOptions } from "../lib/recommendations/beginner";

type Field = keyof Answers;
type Question = { field: Field; title: string; hint: string; options: [string, string][]; multi?: boolean };
const questions: Question[] = [
  { field: "kind", title: "这次，你想怎么调？", hint: "选一个方向。不确定也没关系。", options: [["easy", "简单好喝就行"], ["classic", "想学一杯经典"], ["any", "还没想好，帮我选"]] },
  { field: "tastes", title: "想喝什么味道？", hint: "可以选 1～2 项，也可以交给我。", multi: true, options: [["fresh", "清爽带气泡"], ["fruit", "酸甜、有果香"], ["tea", "茶香、清淡一点"], ["milk", "奶香或咖啡香"], ["any", "没有偏好"]] },
  { field: "strength", title: "酒味想要多明显？", hint: "这里说的是入口感受，不代表酒精度。", options: [["light", "轻一点 · 尽量喝不出酒味"], ["medium", "适中 · 能喝出酒香"], ["strong", "明显一点 · 喜欢酒本身的味道"], ["any", "不确定，帮我选"]] },
  { field: "avoid", title: "有没有不喜欢的味道？", hint: "可多选。这是口味偏好，不是过敏信息。", multi: true, options: [["bitter", "苦味"], ["sour", "明显酸味"], ["sweet", "很甜"], ["milk", "奶味"], ["any", "没有不喜欢的"]] },
  { field: "spirit", title: "有没有想试的酒？", hint: "不认识这些酒也没关系，选“帮我选”即可。", options: [["any", "帮我选"], ["金酒", "金酒 · 草本香"], ["伏特加", "伏特加 · 味道较中性"], ["朗姆", "朗姆 · 甘蔗香"], ["威士忌", "威士忌 · 谷物与木香"], ["龙舌兰", "龙舌兰 · 植物香"], ["梅酒", "梅酒 · 酸甜梅香"], ["啤酒", "啤酒 · 麦香与气泡"], ["烧酒", "烧酒"], ["白兰地", "白兰地"], ["清酒", "清酒"], ["利口酒", "利口酒"]] },
  { field: "tools", title: "愿意准备摇酒壶吗？", hint: "摇酒壶用于把材料和冰块一起摇匀、冰镇。没有也可以调酒；量取用量仍需要有刻度的工具。", options: [["simple", "暂时不准备 · 用杯子和勺子"], ["any", "有，或者愿意准备"]] },
  { field: "mixers", title: "这些饮料，你想用哪些？", hint: "选手边有的，或者愿意准备的，可多选。这里只列出前面匹配配方用到的饮料。", multi: true, options: [["any", "都可以，帮我选"]] },
];
const key = "alchemix_beginner_v2";
const button = "min-h-12 w-full rounded-full bg-neutral-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-30";
// Keep downstream answers only while they remain compatible with the changed path.
function reconcile(a: Answers, field: Field): Answers {
  const index = questions.findIndex(q => q.field === field);
  const result = { ...a };
  if (result.kind === "easy") result.tools = "any";
  for (let i = index + 1; i < questions.length; i++) {
    const prefix = { ...emptyAnswers };
    for (let j = 0; j <= i; j++) Object.assign(prefix, { [questions[j].field]: result[questions[j].field] });
    if (!matchDrinks(BEGINNER_CATALOG, prefix).length) Object.assign(result, { [questions[i].field]: emptyAnswers[questions[i].field] });
  }
  if (field !== "mixers") {
    const allowed = mixerOptions(BEGINNER_CATALOG, result);
    result.mixers = result.mixers.filter(name => allowed.includes(name));
  }
  return result;
}

export default function BeginnerHome({ onMaterials }: { onMaterials: () => void; onExplore?: (tab: "classic" | "convenience") => void }) {
  const [screen, setScreen] = useState<"home" | "quiz" | "results" | "edit">("home");
  const [answers, setAnswers] = useState<Answers>(emptyAnswers);
  const [draft, setDraft] = useState<Answers>(emptyAnswers);
  const [answered, setAnswered] = useState<Field[]>([]);
  const [draftAnswered, setDraftAnswered] = useState<Field[]>([]);
  const [step, setStep] = useState(0);
  const [slots, setSlots] = useState<string[]>([]);
  const [seen, setSeen] = useState<string[]>([]);
  const [undo, setUndo] = useState<Record<number, string>>({});
  const [excluded, setExcluded] = useState<string[]>([]);
  const [pendingIngredient, setPendingIngredient] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const root = useRef<HTMLElement>(null);
  const scroller = () => root.current?.closest("main");
  useEffect(() => {
    try {
      const value = JSON.parse(sessionStorage.getItem(key) ?? "null");
      if (value?.version === 2 && value.answers && Array.isArray(value.answers.tastes) && Array.isArray(value.answers.avoid) && Array.isArray(value.slots)) {
        value.answers.mixers ??= [];
        const valid = questions.every(q => { const v = value.answers[q.field]; if (q.field === "mixers") return Array.isArray(v) && v.every((x: unknown) => typeof x === "string" && mixerOptions(BEGINNER_CATALOG, value.answers).includes(x)); return Array.isArray(v) ? v.every((x: string) => q.options.some(([id]) => id === x)) : q.options.some(([id]) => id === v); });
        if (valid) {
          setAnswers(value.answers); setDraft(value.answers);
          setAnswered(Array.isArray(value.answered) ? value.answered : questions.map(q => q.field));
          const restoredExcluded = Array.isArray(value.excluded) ? value.excluded.filter((x: unknown): x is string => typeof x === "string") : [];
          setExcluded(restoredExcluded);
          const pool = matchDrinks(BEGINNER_CATALOG, value.answers, restoredExcluded);
          setSlots([...new Set<string>(value.slots)].filter(id => pool.some(d => d.href === id)).slice(0, 3));
          setSeen(Array.isArray(value.seen) ? value.seen : []);
          setUndo(value.undo && typeof value.undo === "object" ? Object.fromEntries(Object.entries(value.undo).filter(([, id]) => pool.some(d => d.href === id))) as Record<number, string> : {});
          setScreen(value.screen === "results" || new URLSearchParams(location.search).has("beginner") ? "results" : "home");
          requestAnimationFrame(() => { const el = scroller(); if (el) el.scrollTop = Number(value.scroll) || 0; });
        }
      }
    } catch { /* An outdated or unavailable browser session can safely start fresh. */ }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { sessionStorage.setItem(key, JSON.stringify({ version: 2, answers, answered, excluded, slots, seen, undo, screen, scroll: scroller()?.scrollTop ?? 0 })); } catch { /* Browsing still works without session storage. */ }
  }, [ready, answers, answered, excluded, slots, seen, undo, screen]);
  const active = screen === "edit" ? draft : answers;
  const drinkOptions = mixerOptions(BEGINNER_CATALOG, active, excluded);
  const steps = questions.filter(q => (q.field !== "tools" || active.kind !== "easy") && (q.field !== "mixers" || drinkOptions.length > 0)).map(q => q.field === "mixers" ? { ...q, options: [...drinkOptions.map(name => [name, name] as [string, string]), ["any", "都可以，帮我选"] as [string, string]] } : q);
  const q = steps[Math.min(step, steps.length - 1)];
  const pool = matchDrinks(BEGINNER_CATALOG, answers, excluded);
  const top = () => scroller()?.scrollTo({ top: 0 });
  function choose(field: Field, id: string, multi?: boolean) {
    const before = active[field];
    let value: string | string[] = id;
    if (multi && Array.isArray(before)) value = id === "any" ? [] : before.includes(id) ? before.filter(v => v !== id) : [...before, id].slice(field === "tastes" ? -2 : field === "avoid" ? -4 : 0);
    const next = reconcile({ ...active, [field]: value }, field);
    const changed = questions.filter(q => q.field !== field && JSON.stringify(next[q.field]) !== JSON.stringify(active[q.field])).map(q => q.field);
    const marks = [...new Set([...(screen === "edit" ? draftAnswered : answered).filter(f => !changed.includes(f)), field])];
    if (screen === "edit") { setDraft(next); setDraftAnswered(marks); } else { setAnswers(next); setAnswered(marks); }
    const cleared = questions.filter(q => q.field !== field && JSON.stringify(next[q.field]) !== JSON.stringify(active[q.field])).map(q => q.title);
    setNotice(cleared.length ? "与新选择冲突的后续偏好已重置为“帮我选”，请继续确认。" : "");
  }
  function available(question: Question, id: string) {
    if (id === "any" || question.field === "mixers") return true;
    const prefix = { ...emptyAnswers };
    for (const item of questions) { if (item.field === question.field) break; Object.assign(prefix, { [item.field]: active[item.field] }); }
    const current = active[question.field];
    Object.assign(prefix, { [question.field]: question.multi ? (question.field === "avoid" && Array.isArray(current) ? [...new Set([...current, id])] : [id]) : id });
    return matchDrinks(BEGINNER_CATALOG, prefix).length > 0;
  }
  function results(a: Answers) {
    const ids = matchDrinks(BEGINNER_CATALOG, a, excluded).slice(0, 3).map(d => d.href);
    setAnswers(a); setSlots(ids); setSeen(ids); setUndo({}); setNotice(""); setScreen("results"); top();
  }
  function change(index: number) {
    const next = replaceDrink(pool, slots, seen, index);
    if (!next) { setNotice("符合条件的新酒已经看完了。可以撤销更换、重新浏览，或修改偏好。"); return; }
    setUndo({ ...undo, [index]: slots[index] });
    setSlots(slots.map((id, i) => i === index ? next : id)); setSeen([...seen, next]); setNotice("");
  }
  function updateExcluded(nextExcluded: string[]) {
    const nextPool = matchDrinks(BEGINNER_CATALOG, answers, nextExcluded);
    const nextSlots = repairSlots(nextPool, slots, seen);
    const nextUndo: Record<number, string> = {};
    nextSlots.forEach((id, index) => {
      const oldIndex = slots.indexOf(id);
      const old = undo[oldIndex];
      if (old && nextPool.some(d => d.href === old) && !nextSlots.includes(old)) nextUndo[index] = old;
    });
    setExcluded(nextExcluded); setSlots(nextSlots); setUndo(nextUndo);
    setSeen([...new Set([...seen, ...nextSlots])]); setPendingIngredient(null);
    setNotice(nextSlots.length < 3 ? "符合全部条件的酒不足三杯。可以取消材料排除，或修改偏好。" : "");
  }
  function detail(href: string) {
    try { sessionStorage.setItem(key, JSON.stringify({ version: 2, answers, answered, excluded, slots, seen, undo, screen: "results", scroll: scroller()?.scrollTop ?? 0 })); sessionStorage.setItem("alchemix_beginner_detail", "1"); } catch { }
    window.location.href = href;
  }
  const options = (question: Question) => <div className="mt-4 space-y-2">{question.options.map(([id, label]) => {
    const v = active[question.field];
    const selected = (screen === "edit" ? draftAnswered : answered).includes(question.field) && (Array.isArray(v) ? id === "any" ? v.length === 0 : v.includes(id) : v === id);
    const enabled = selected || available(question, id);
    return <button key={id} disabled={!enabled} aria-pressed={selected} onClick={() => choose(question.field, id, question.multi)} className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition disabled:opacity-35 ${selected ? "border-neutral-950 bg-neutral-950 text-white" : "border-[#E1E1DE] bg-white"}`}><span>{label}{!enabled && <span className="mt-1 block text-[10px]">当前条件下暂无匹配</span>}</span><span aria-hidden="true">{selected ? "✓" : "+"}</span></button>;
  })}</div>;

  return <section ref={root} className="beginner-guide pb-6 text-neutral-950">
    {screen === "home" && <>
      <div className="pt-4 text-center"><span className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] text-neutral-500"><Leaf size={13} /> START / YOUR FIRST DRINK</span><h2 className="mt-5 text-[28px] font-semibold tracking-wide">你的调酒助手</h2><p className="mt-3 text-sm leading-6 text-neutral-500">不知道喝什么，也不懂怎么调？<br />一起找到适合你的第一杯。</p></div>
      <div className="mx-auto mt-7 h-8 w-px bg-neutral-300" /><p className="mx-auto w-fit rounded-full border border-[#E1E1DE] px-5 py-2 text-xs">你现在是哪种情况？</p>
      <div className="ml-3 space-y-4 border-l border-neutral-300 py-5 pl-5">{[{ title: "完全没头绪，带我开始", text: "回答几个小问题，找到适合你的三杯酒。", icon: Sparkles, action: () => { setAnswers(emptyAnswers); setAnswered([]); setExcluded([]); setPendingIngredient(null); setSlots([]); setSeen([]); setUndo({}); setNotice(""); setStep(0); setScreen("quiz"); top(); } }, { title: "手边已经有些材料", text: "有什么就用什么，只看现在能做的酒。", icon: GlassWater, action: onMaterials }].map(({ title, text, icon: Icon, action }) => <div key={title} className="relative"><span className="absolute -left-5 top-1/2 h-px w-5 bg-neutral-300" /><button onClick={action} className="w-full rounded-2xl border border-[#E1E1DE] bg-white p-5 text-left"><Icon size={23} /><span className="mt-4 flex items-center justify-between font-medium">{title}<ArrowRight size={17} /></span><span className="mt-2 block text-xs leading-6 text-neutral-500">{text}</span></button></div>)}</div>
      {slots.length > 0 && <button className="mt-3 w-full text-xs underline" onClick={() => setScreen("results")}>继续看上次选出的酒</button>}
    </>}
    {screen === "quiz" && <>
      <button className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 text-xs text-neutral-700" onClick={() => { if (step) setStep(step - 1); else setScreen("home"); top(); }}><ArrowLeft size={14} />{step ? "返回上一题" : "返回首页"}</button>
      <p className="font-mono text-[10px] tracking-widest text-neutral-400">QUESTION {step + 1} / {steps.length}</p><div className="mt-3 flex gap-1">{steps.map((item, i) => <span key={item.field} className={`h-px flex-1 ${i <= step ? "bg-black" : "bg-neutral-200"}`} />)}</div>
      <h2 className="mt-7 text-[26px] font-semibold">{q.title}</h2><p className="mt-3 text-xs leading-6 text-neutral-500">{q.hint}</p>{options(q)}
      {notice && <p role="status" className="mt-3 text-xs leading-6 text-neutral-500">{notice}</p>}
      <button disabled={!answered.includes(q.field)} className={`${button} mt-6`} onClick={() => { if (step === steps.length - 1) results(answers); else { setStep(step + 1); top(); } }}>{step === steps.length - 1 ? "看看适合我的酒" : "继续"}</button>
    </>}
    {screen === "edit" && <>
      <h2 className="text-2xl font-semibold">修改我的选择</h2><p className="mt-3 text-xs leading-6 text-neutral-500">展开要修改的一项。与新选择冲突的后续答案会恢复为“帮我选”，应用前请确认。</p>
      {steps.map(question => <details key={question.field} className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4"><summary className="cursor-pointer text-sm font-medium">{question.title}<span className="mt-2 block text-xs font-normal text-neutral-500">{question.options.filter(([id]) => { const v = active[question.field]; return Array.isArray(v) ? v.length ? v.includes(id) : id === "any" : v === id; }).map(([, label]) => label).join("、")}</span></summary>{options(question)}</details>)}
      {notice && <p role="status" className="mt-3 text-xs leading-6 text-neutral-500">{notice}</p>}
      <button className={`${button} mt-6`} disabled={!steps.every(q => draftAnswered.includes(q.field))} onClick={() => { setAnswered(draftAnswered); results(draft); }}>按新偏好找酒</button><button className="mt-4 w-full text-sm" onClick={() => { setScreen("results"); top(); }}>取消，保留原来的三杯</button>
    </>}
    {screen === "results" && <>
      <button className="mb-5 flex items-center gap-2 text-xs text-neutral-500" onClick={() => { setScreen("home"); top(); }}><ArrowLeft size={14} /> 返回首页</button>
      <h2 className="text-[24px] font-semibold">{slots.length === 3 ? "这三杯，你想试哪杯？" : `找到 ${slots.length} 杯适合你的酒`}</h2>
      <button className="mt-2 text-xs underline" onClick={() => { setDraftAnswered([...answered]); setDraft({ ...answers, tastes: [...answers.tastes], avoid: [...answers.avoid] }); setScreen("edit"); top(); }}>修改我的选择</button>
      <p className="mt-2 text-[11px] text-neutral-500">买不到哪样？点一下酒卡里的材料。</p>
      {excluded.length > 0 && <div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-[11px] text-neutral-500">本次不使用</span>{excluded.map(name => <button key={name} aria-label={`取消排除${name}`} onClick={() => updateExcluded(excluded.filter(n => n !== name))} className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs">{name} ×</button>)}</div>}
      {pendingIngredient && <div role="region" aria-label="确认排除材料" className="mt-3 rounded-2xl border border-neutral-300 bg-white p-4"><p className="text-sm font-medium">这次买不到{pendingIngredient}？</p><p className="mt-2 text-xs leading-5 text-neutral-500">只更换需要它的酒，保留你的口味偏好。之后换酒也会排除它。</p><div className="mt-3 flex gap-2"><button onClick={() => updateExcluded([...new Set([...excluded, pendingIngredient])])} className="min-h-10 flex-1 rounded-full border border-neutral-300 bg-white px-3 text-xs">排除并换酒</button><button onClick={() => setPendingIngredient(null)} className="min-h-10 rounded-full border border-neutral-200 px-4 text-xs">取消</button></div></div>}
      {slots.length < 3 && <p className="mt-4 rounded-xl bg-neutral-100 p-3 text-xs leading-6">目前只有这些配方符合全部条件，不会加入不匹配的酒。你可以修改偏好。</p>}
      <div className="mt-4 space-y-3">{slots.map((id, index) => {
        const drink = BEGINNER_CATALOG.find(d => d.href === id); if (!drink) return null;
        return <article key={index} className="overflow-hidden rounded-2xl border border-[#E1E1DE] bg-white px-4 py-3">
          <div className="flex items-center justify-between gap-2"><h3 className="text-[17px] font-medium leading-6">{drink.nameZh}</h3><span className="shrink-0 text-[10px] text-neutral-400">{drink.kind === "classic" ? "经典" : "简单调配"}</span></div>
          <p className="mt-1 text-[11px] leading-5 text-neutral-500">{{ light: "酒味轻", medium: "酒味适中", strong: "酒香明显" }[drink.strength]} · {drink.shaker ? "需要摇酒壶" : "杯中调配"}</p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">{[...new Set(drink.ingredients)].map(name => <button key={name} aria-label={`${name}买不到`} onClick={() => setPendingIngredient(name)} className="min-h-7 text-xs text-neutral-600 underline decoration-neutral-300 underline-offset-4">{name}</button>)}</div>
          <div className="mt-2 flex gap-2"><button className="min-h-10 flex-1 rounded-full border border-neutral-200 bg-white px-4 text-xs text-neutral-950" onClick={() => detail(drink.href)}>查看做法</button><button aria-label={`更换${drink.nameZh}`} className="flex min-h-10 items-center gap-1 rounded-full border border-neutral-200 px-4 text-xs" onClick={() => change(index)}><RotateCcw size={13} />换一杯</button></div>
          {undo[index] && <button className="mt-2 text-xs underline" onClick={() => { setSlots(slots.map((v, i) => i === index ? undo[index] : v)); const next = { ...undo }; delete next[index]; setUndo(next); setNotice(""); }}>撤销更换</button>}
        </article>;
      })}</div>
      {notice && <div role="status" className="mt-4 rounded-xl bg-neutral-100 p-4 text-xs leading-6">{notice}<button className="mt-2 block underline" onClick={() => { setSeen([...slots, ...Object.values(undo)]); setNotice("已准备好重新浏览。点击任意一杯的更换按钮继续。"); }}>重新浏览符合条件的酒</button></div>}
    </>}
  </section>;
}
