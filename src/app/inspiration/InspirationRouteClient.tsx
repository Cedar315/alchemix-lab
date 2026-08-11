"use client";

import React, { useEffect, useState } from "react";
import InspirationScreen from "@/components/InspirationScreen";
import { DrinkLog, MixTip } from "@/types";

type InspirationRouteClientProps = {
  initialView?: "menu" | "classic-remix" | "convenience-mix" | "flavor" | "beginner" | "knowledge";
  initialCocktailId?: string;
  initialExploreTab?: "convenience" | "classic";
};

export default function InspirationRouteClient({ initialView = "menu", initialCocktailId = "", initialExploreTab }: InspirationRouteClientProps) {
  const [tips, setTips] = useState<MixTip[]>([
    {
      id: "route-tip-too-sweet",
      title: "太甜了怎么救",
      content: "先加满冰块，再补一点苏打水、乌龙茶或柠檬汁。每次只补 20-30ml，边尝边调。",
      icon: "water_drop",
    },
    {
      id: "route-tip-too-strong",
      title: "酒感太冲怎么办",
      content: "减少基酒，增加茶饮、气泡水或果汁，并用大冰块慢慢稀释。",
      icon: "icecream",
    },
  ]);
  const [drinkLogs, setDrinkLogs] = useState<DrinkLog[]>([]);
  const [drinkLogSuccess, setDrinkLogSuccess] = useState<{ recipeName: string; todayCount: number } | null>(null);
  const isExploreHome = initialView === "menu";

  useEffect(() => {
    const localDrinkLogs = localStorage.getItem("alchemix_drink_logs");
    if (localDrinkLogs) {
      setDrinkLogs(JSON.parse(localDrinkLogs));
    }
  }, []);

  const handleSaveDrinkLog = (log: DrinkLog) => {
    const updated = [
      log,
      ...drinkLogs.filter((item) => item.id !== log.id),
    ];
    setDrinkLogs(updated);
    localStorage.setItem("alchemix_drink_logs", JSON.stringify(updated));
    const today = new Date().toISOString().split("T")[0];
    const todayCount = updated.filter((item) => item.drinkDate === today).length;
    setDrinkLogSuccess({ recipeName: log.recipeName, todayCount });
  };

  const openMainTab = (tab: "ASSISTANT" | "LAB" | "INSPIRATION" | "MY") => {
    if (tab === "INSPIRATION") {
      window.location.href = "/inspiration";
      return;
    }
    localStorage.setItem("alchemix_open_tab", tab);
    window.location.href = "/";
  };

  return (
    <main className="min-h-screen bg-[#dfe3e6] px-0 text-on-surface md:px-4 md:py-6">
      <div className="relative mx-auto flex h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-[#F7F7F5] shadow-2xl md:h-[calc(100dvh-48px)] md:rounded-[2rem] md:border md:border-white/70">
        <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-[#e9e9e6] bg-[#F7F7F5] px-5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[26px] text-neutral-950">science</span>
            <h1 className="font-serif text-[26px] font-bold tracking-tight text-neutral-950">AlcheMix Lab</h1>
          </div>
          <button className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-neutral-500 hover:bg-white">
            <span className="material-symbols-outlined text-[22px]">help_outline</span>
          </button>
        </div>
        <div className={`${isExploreHome ? "px-0 py-0" : "px-5 py-6"} flex-1 overflow-y-auto`}>
          <InspirationScreen
            tips={tips}
            onAddTip={(tip) => setTips((prev) => [...prev, tip])}
            initialView={initialView}
            initialCocktailId={initialCocktailId}
            initialExploreTab={initialExploreTab}
            drinkLogs={drinkLogs}
            onSaveDrinkLog={handleSaveDrinkLog}
          />
        </div>
        {isExploreHome && (
          <nav className="shrink-0 border-t border-[#e5e5e2] bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
            <div className="grid grid-cols-4">
              {[
                ["search", "ASSISTANT", "Finder", "text-neutral-300"],
                ["science", "LAB", "LAB", "text-neutral-300"],
                ["menu_book", "INSPIRATION", "探索", "text-neutral-950"],
                ["person", "MY", "MY", "text-neutral-300"],
              ].map(([icon, label, text, color]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => openMainTab(label as "ASSISTANT" | "LAB" | "INSPIRATION" | "MY")}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-0.5 py-1 active:scale-[0.98] ${color}`}
                >
                  <span className="material-symbols-outlined text-[23px]">{icon}</span>
                  <span className="text-[10px] font-bold tracking-tight">{text}</span>
                </button>
              ))}
            </div>
          </nav>
        )}
        {drinkLogSuccess && (
          <div className="absolute inset-0 z-[180] flex items-center justify-center bg-black/30 px-5 backdrop-blur-[2px]">
            <div className="w-full max-w-[360px] rounded-[28px] border border-[#E8E8E8] bg-white p-5 text-center shadow-[0_22px_60px_rgba(15,23,42,0.22)]">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-950 text-white">
                <span className="material-symbols-outlined text-[24px]">check</span>
              </div>
              <h3 className="mt-4 text-xl font-bold text-neutral-950">成功添加了一杯酒</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                {drinkLogSuccess.recipeName} 已存入酒记。今天已经喝了 {drinkLogSuccess.todayCount} 杯。
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDrinkLogSuccess(null)}
                  className="h-11 cursor-pointer rounded-2xl border border-[#E8E8E8] bg-white text-sm font-bold text-neutral-600 active:scale-[0.98]"
                >
                  继续看看
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDrinkLogSuccess(null);
                    localStorage.setItem("alchemix_open_tab", "MY");
                    window.location.href = "/";
                  }}
                  className="h-11 cursor-pointer rounded-2xl bg-neutral-950 text-sm font-bold text-white active:scale-[0.98]"
                >
                  查看酒记
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
