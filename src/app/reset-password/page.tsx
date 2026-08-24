"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setPending(true);
    const response = await fetch("/api/auth/update-password", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    const data = await response.json();
    setPending(false);
    if (!response.ok) return setMessage(data.error || "密码更新失败");
    setMessage("密码已更新，正在返回应用…");
    window.setTimeout(() => router.push("/"), 800);
  };

  return <main className="flex min-h-screen items-center justify-center bg-[#F7F7F5] px-4">
    <section className="w-full max-w-sm rounded-3xl border border-neutral-200 bg-white p-6 shadow-xl">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">AlcheMix Account</p>
      <h1 className="mt-2 text-2xl font-bold text-neutral-950">设置新密码</h1>
      <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={8} placeholder="至少 8 位新密码" className="mt-5 h-12 w-full rounded-2xl border border-neutral-200 px-3 outline-none focus:border-neutral-950" />
      {message && <p className="mt-3 text-sm text-neutral-600">{message}</p>}
      <button type="button" onClick={submit} disabled={pending || password.length < 8} className="mt-4 h-12 w-full rounded-2xl bg-neutral-950 font-bold text-white disabled:bg-neutral-300">{pending ? "更新中…" : "更新密码"}</button>
    </section>
  </main>;
}
