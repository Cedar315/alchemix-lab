import type { ReactNode } from "react";

export default function LegalDocument({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f6f5f1] px-4 py-8 text-neutral-900">
      <article className="mx-auto max-w-2xl rounded-3xl border border-[#E8E8E8] bg-white p-6 shadow-none sm:p-9">
        <a href="/" className="text-sm font-medium text-neutral-500 hover:text-neutral-950">← 返回 AlcheMix Lab</a>
        <h1 className="mt-6 text-3xl font-semibold">{title}</h1>
        <p className="mt-2 text-xs text-neutral-500">更新日期：{updated} · 当前为公开测试版说明</p>
        <div className="mt-8 space-y-6 text-sm leading-7 text-neutral-700">{children}</div>
      </article>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return <section><h2 className="text-lg font-semibold text-neutral-950">{title}</h2><div className="mt-2 space-y-2">{children}</div></section>;
}
