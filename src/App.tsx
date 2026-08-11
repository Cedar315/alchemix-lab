"use client";

import React, { useState, useEffect } from "react";
import { DrinkLog, SavedCocktail, MixTip } from "./types";
import LabScreen from "./components/LabScreen";
import AssistantScreen from "./components/AssistantScreen";
import InspirationScreen from "./components/InspirationScreen";
import MyProfileScreen from "./components/MyProfileScreen";
import { trackAnalyticsEvent } from "./lib/analytics";

export default function App() {
  // Navigation State: "ASSISTANT" | "LAB" | "INSPIRATION" | "MY"
  const [activeTab, setActiveTab] = useState<string>("LAB");

  // Saved cocktails state (persisted in localStorage)
  const [savedCocktails, setSavedCocktails] = useState<SavedCocktail[]>([]);
  const [drinkLogs, setDrinkLogs] = useState<DrinkLog[]>([]);
  const [drinkLogSuccess, setDrinkLogSuccess] = useState<{ recipeName: string; todayCount: number } | null>(null);

  // Alchemist rescue tips (persisted in localStorage)
  const [tips, setTips] = useState<MixTip[]>([]);

  // Lab Preset Ingredients for cross-screen integration
  const [labPresetIngredients, setLabPresetIngredients] = useState<any[]>([]);
  const [labPresetMixMethod, setLabPresetMixMethod] = useState<"Stir" | "Shake">("Stir");

  // 1. Initial State Loading & Synchronization with localStorage
  useEffect(() => {
    const requestedTab = localStorage.getItem("alchemix_open_tab");
    if (requestedTab && ["ASSISTANT", "LAB", "INSPIRATION", "MY"].includes(requestedTab)) {
      setActiveTab(requestedTab);
      localStorage.removeItem("alchemix_open_tab");
    }

    // Saved Cocktails
    const localCocktails = localStorage.getItem("alchemix_saved_cocktails");
    if (localCocktails) {
      setSavedCocktails(JSON.parse(localCocktails));
    } else {
      // Default high fidelity cocktail records to populate Dr. Mix's profile initially
      const defaultCocktails: SavedCocktail[] = [
        {
          id: "saved-preset-1",
          chineseName: "薄荷实验室",
          name: "Mint Lab Frost",
          subtitle: "第二次加入液氮后的口感简直完美",
          spirit: "金酒 Gin",
          mixer: "苏打水 Soda",
          size: "250ml",
          rating: { sweet: 2, acid: 4, strength: 3 },
          comments: "使用经典干金酒作为碳骨架，注入苏打气泡进行高速撞击，液氮深度冷凝使薄荷脑酯类分子结晶释出，是夏日特配的极致低温试剂。",
          tags: ["清爽", "微醺"],
          savedAt: new Date().toISOString().split("T")[0],
          ratingValue: 5,
        },
        {
          id: "saved-preset-2",
          chineseName: "午夜试剂",
          name: "Midnight Reagent",
          subtitle: "金酒的比例可以再提高5ml",
          spirit: "金酒 Gin",
          mixer: "蔓越莓 Cranberry",
          size: "150ml",
          rating: { sweet: 4, acid: 3, strength: 5 },
          comments: "高浓度单宁的蔓越莓果汁分子中和了金酒极高的酒感。此组合能激活中枢受体，带来极其深邃的草本酸甜层次。",
          tags: ["深邃", "苦甜"],
          savedAt: new Date().toISOString().split("T")[0],
          ratingValue: 5,
        },
      ];
      setSavedCocktails(defaultCocktails);
      localStorage.setItem("alchemix_saved_cocktails", JSON.stringify(defaultCocktails));
    }

    const localDrinkLogs = localStorage.getItem("alchemix_drink_logs");
    if (localDrinkLogs) {
      setDrinkLogs(JSON.parse(localDrinkLogs));
    }

    // Emergency rescue tips
    const localTips = localStorage.getItem("alchemix_tips");
    if (localTips) {
      setTips(JSON.parse(localTips));
    } else {
      const defaultTips: MixTip[] = [
        {
          id: "tip-preset-1",
          title: "太甜了怎么救",
          content: "试剂糖分过多时，加适量新鲜柠檬汁（ citric acid ）或高酸碳酸苏打水，进行分子浓度的稀释和中和。",
          icon: "science",
        },
        {
          id: "tip-preset-2",
          title: "酒味太冲怎么办",
          content: "多加纯净大冰块，利用冰块溶化释水稀释乙醇（ ethanol ）浓度，并加高果汁和甜味试剂的比例。",
          icon: "water_drop",
        },
        {
          id: "tip-preset-3",
          title: "没有青柠怎么办",
          content: "青柠中关键的苹果酸可被黄柠檬、高酸度白醋或少量酸味西柚汁分子链完美替代。",
          icon: "warning",
        },
      ];
      setTips(defaultTips);
      localStorage.setItem("alchemix_tips", JSON.stringify(defaultTips));
    }
  }, []);

  useEffect(() => {
    const page = activeTab === "LAB" ? "lab" : activeTab === "INSPIRATION" ? "inspiration" : activeTab === "MY" ? "my" : "finder";
    trackAnalyticsEvent({
      eventName: `${page}_view`,
      page,
      action: "view",
      target: activeTab,
    });
  }, [activeTab]);

  // 2. Helpers to update states & sync with localStorage
  const handleSaveCocktail = (cocktail: SavedCocktail) => {
    const updated = [cocktail, ...savedCocktails];
    setSavedCocktails(updated);
    localStorage.setItem("alchemix_saved_cocktails", JSON.stringify(updated));
  };

  const handleRemoveCocktail = (id: string) => {
    const updated = savedCocktails.filter((c) => c.id !== id);
    setSavedCocktails(updated);
    localStorage.setItem("alchemix_saved_cocktails", JSON.stringify(updated));
  };

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
    trackAnalyticsEvent({
      eventName: "drink_log_create",
      page: (log.sourcePage?.includes("lab") ? "lab" : log.sourcePage?.includes("inspiration") || log.sourcePage?.includes("classic") || log.sourcePage?.includes("convenience") ? "inspiration" : "finder"),
      action: "create",
      target: log.recipeName,
      recipeId: log.recipeId,
      source: log.sourcePage,
      metadata: {
        rating: log.rating,
        hasNote: Boolean(log.note?.trim()),
        isFavorite: log.isFavorite,
      },
    });
  };

  const handleAddTip = (tip: MixTip) => {
    const updated = [...tips, tip];
    setTips(updated);
    localStorage.setItem("alchemix_tips", JSON.stringify(updated));
  };

  // Render current selected tab screen
  const renderScreen = () => {
    switch (activeTab) {
      case "ASSISTANT":
        return (
          <AssistantScreen
            onSaveCocktail={handleSaveCocktail}
            drinkLogs={drinkLogs}
            onSaveDrinkLog={handleSaveDrinkLog}
          />
        );
      case "LAB":
        return (
          <LabScreen 
            onSaveCocktail={handleSaveCocktail} 
            drinkLogs={drinkLogs}
            onSaveDrinkLog={handleSaveDrinkLog}
            initialIngredients={labPresetIngredients}
            initialMixMethod={labPresetMixMethod}
            onClearInitial={() => {
              setLabPresetIngredients([]);
              setLabPresetMixMethod("Stir");
            }}
            onTrackEvent={trackAnalyticsEvent}
          />
        );
      case "INSPIRATION":
        return (
          <InspirationScreen 
            tips={tips} 
            onAddTip={handleAddTip} 
            onSaveCocktail={handleSaveCocktail}
            drinkLogs={drinkLogs}
            onSaveDrinkLog={handleSaveDrinkLog}
            onLoadToLab={(ingredients, mixMethod) => {
              setLabPresetIngredients(ingredients);
              setLabPresetMixMethod(mixMethod);
              setActiveTab("LAB");
            }}
          />
        );
      case "MY":
        return (
          <MyProfileScreen
            savedCocktails={savedCocktails}
            drinkLogs={drinkLogs}
            onRemoveCocktail={handleRemoveCocktail}
            onNavigateToLab={() => setActiveTab("LAB")}
          />
        );
      default:
        return <LabScreen onSaveCocktail={handleSaveCocktail} drinkLogs={drinkLogs} onSaveDrinkLog={handleSaveDrinkLog} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#dfe3e6] text-on-surface flex justify-center font-sans select-none selection:bg-black/10 md:px-6 md:py-6">
      <div className="relative flex h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-surface shadow-2xl md:h-[calc(100dvh-48px)] md:rounded-[2rem] md:border md:border-white/70">
      {/* Top Clinical Navigation Bar */}
      <header className="bg-surface/90 backdrop-blur-md border-b border-outline-variant/10 z-40 flex shrink-0 justify-between items-center px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-2xl">science</span>
          <h1 className="text-xl font-bold font-serif text-primary tracking-tight">AlcheMix Lab</h1>
        </div>
        
        {/* Dynamic Context Header action buttons */}
        {activeTab === "LAB" && (
          <button 
            onClick={() => {
              alert("🧪 [化学滴定实验日志] 正在汇总您所有的混合化学键能变化。您可以点击底部 'MY' 档案中心，深度查阅您已保存的高分化学特调结果。");
            }}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container transition-colors active:scale-95 duration-150 text-on-surface-variant"
            title="历史混合分析"
          >
            <span className="material-symbols-outlined">history</span>
          </button>
        )}
        
        {activeTab === "MY" && (
          <button 
            onClick={() => {
              const confirmReset = window.confirm("🔄 确定要重置当前实验室的所有特调日志和本地档案吗？这将会清空您的本地缓存记录。");
              if (confirmReset) {
                localStorage.clear();
                window.location.reload();
              }
            }}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container transition-colors active:scale-95 duration-150 text-on-surface-variant"
            title="重置实验室档案"
          >
            <span className="material-symbols-outlined">settings</span>
          </button>
        )}

        {activeTab === "ASSISTANT" && (
          <button 
            onClick={() => {
              setActiveTab("MY");
            }}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container transition-colors active:scale-95 duration-150 text-on-surface-variant"
            title="查看收藏"
          >
            <span className="material-symbols-outlined">bookmark_border</span>
          </button>
        )}

        {activeTab === "INSPIRATION" && (
          <button 
            onClick={() => {
              alert("📖 [灵感手记说明] 包含基础酒类科普、经典便利店微醺配方比例、翻车急救方法。遇到调酒疑问时，可以先在本地问题库里搜索对应建议。");
            }}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container transition-colors active:scale-95 duration-150 text-on-surface-variant"
            title="帮助说明"
          >
            <span className="material-symbols-outlined">help_outline</span>
          </button>
        )}
      </header>

      {/* Main Canvas Segment */}
      <main className="flex-grow overflow-y-auto px-5 py-6">
        {renderScreen()}
      </main>

      {/* Fixed Bottom Navigation Bar (Mobile & Desktop fluid footer) */}
      <nav className="z-40 bg-white/95 backdrop-blur-md border-t border-outline-variant/15 flex shrink-0 justify-around items-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_30px_rgba(15,23,42,0.08)]">
        {/* Finder */}
        <button
          onClick={() => {
            trackAnalyticsEvent({ eventName: "tab_click", page: "finder", action: "click", target: "Finder" });
            setActiveTab("ASSISTANT");
          }}
          className={`flex flex-col items-center justify-center p-1.5 transition-all w-16 duration-200 ${
            activeTab === "ASSISTANT" ? "text-primary scale-105" : "text-outline-variant hover:text-outline"
          }`}
        >
          <span 
            className="material-symbols-outlined text-2xl"
            style={activeTab === "ASSISTANT" ? { fontVariationSettings: "'FILL' 1" } : {}}
          >
            search
          </span>
          <span className="text-[10px] font-bold uppercase tracking-tighter mt-1">Finder</span>
        </button>

        {/* Lab */}
        <button
          onClick={() => {
            trackAnalyticsEvent({ eventName: "tab_click", page: "lab", action: "click", target: "Lab" });
            setActiveTab("LAB");
          }}
          className={`flex flex-col items-center justify-center p-1.5 transition-all w-16 duration-200 ${
            activeTab === "LAB" ? "text-primary scale-105" : "text-outline-variant hover:text-outline"
          }`}
        >
          <span 
            className="material-symbols-outlined text-2xl"
            style={activeTab === "LAB" ? { fontVariationSettings: "'FILL' 1" } : {}}
          >
            science
          </span>
          <span className="text-[10px] font-bold uppercase tracking-tighter mt-1">Lab</span>
        </button>

        {/* Inspiration */}
        <button
          onClick={() => {
            trackAnalyticsEvent({ eventName: "tab_click", page: "inspiration", action: "click", target: "Inspiration" });
            setActiveTab("INSPIRATION");
          }}
          className={`flex flex-col items-center justify-center p-1.5 transition-all w-16 duration-200 ${
            activeTab === "INSPIRATION" ? "text-primary scale-105" : "text-outline-variant hover:text-outline"
          }`}
        >
          <span 
            className="material-symbols-outlined text-2xl"
            style={activeTab === "INSPIRATION" ? { fontVariationSettings: "'FILL' 1" } : {}}
          >
            menu_book
          </span>
          <span className="text-[10px] font-bold uppercase tracking-tighter mt-1">Inspiration</span>
        </button>

        {/* My */}
        <button
          onClick={() => {
            trackAnalyticsEvent({ eventName: "tab_click", page: "my", action: "click", target: "My" });
            setActiveTab("MY");
          }}
          className={`flex flex-col items-center justify-center p-1.5 transition-all w-16 duration-200 ${
            activeTab === "MY" ? "text-primary scale-105" : "text-outline-variant hover:text-outline"
          }`}
        >
          <span 
            className="material-symbols-outlined text-2xl"
            style={activeTab === "MY" ? { fontVariationSettings: "'FILL' 1" } : {}}
          >
            person
          </span>
          <span className="text-[10px] font-bold uppercase tracking-tighter mt-1">My</span>
        </button>
      </nav>

      {drinkLogSuccess && (
        <div className="absolute inset-0 z-[180] flex items-center justify-center px-5">
          <button
            type="button"
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
            onClick={() => setDrinkLogSuccess(null)}
            aria-label="关闭保存成功提示"
          ></button>

          <div className="relative z-10 w-full max-w-[360px] overflow-hidden rounded-[28px] border border-[#E8E8E8] bg-white p-5 text-center shadow-[0_24px_60px_rgba(15,23,42,0.22)] animate-in fade-in zoom-in-95 duration-200">
            <div className="absolute inset-0 notebook-grid opacity-[0.025] pointer-events-none"></div>
            <div className="relative z-10">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#E8E8E8] bg-[#F7F7F5] text-neutral-950">
                <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  check_circle
                </span>
              </div>
              <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">Drink Log Saved</p>
              <h3 className="mt-1 text-xl font-bold text-neutral-950">成功添加了一杯酒</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                {drinkLogSuccess.recipeName} 已存入酒记。今天已经喝了{" "}
                <span className="font-bold text-neutral-950">{drinkLogSuccess.todayCount}</span> 杯。
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2.5">
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
                    setActiveTab("MY");
                  }}
                  className="h-11 cursor-pointer rounded-2xl bg-neutral-950 text-sm font-bold text-white shadow-[0_10px_24px_rgba(15,23,42,0.14)] active:scale-[0.98]"
                >
                  查看酒记
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
