'use client';
export default function AskRecipeButton({ context }: { context: { name: string; ingredients: { name: string; amount: number }[]; note?: string } }) {
  return <button type="button" className="rounded-xl border border-[#d9d7d0] bg-[#f0efeb] px-4 py-3 text-sm text-[#191918]" onClick={() => {
    try { sessionStorage.setItem('alchemix_ask_context', [context.name, ...context.ingredients.map(i => `${i.name}：${i.amount} ml`), context.note || ''].join('\n').slice(0,2000)); } catch { /* destination offers manual context */ }
    window.location.assign('/ask?recipe=1');
  }}>关于这杯，继续问助手 →</button>;
}
