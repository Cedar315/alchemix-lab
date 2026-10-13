"use client";

import { fetchFavorites,saveFavorite,removeFavorite,FAVORITES_CHANGED } from './lib/recipes/favorites-client';
import { useSearchParams } from "next/navigation";
import React, { useState, useEffect, useRef } from "react";
import { DrinkLog, SavedCocktail, MixTip } from "./types";
import LabScreen from "./components/LabScreen";
import AssistantScreen from "./components/AssistantScreen";
import BeginnerHome from "./components/BeginnerHome";
import InspirationScreen from "./components/InspirationScreen";
import MyProfileScreen from "./components/MyProfileScreen";
import { trackAnalyticsEvent } from "./lib/analytics";

export default function App() {
  const searchParams = useSearchParams();
  useEffect(() => { const tab=searchParams.get("tab"); if(tab && ["ASSISTANT","LAB","INSPIRATION","MY"].includes(tab))setActiveTab(tab); }, [searchParams]);
  // Navigation State: "ASSISTANT" | "LAB" | "INSPIRATION" | "MY"
  const [homeVisit, setHomeVisit] = useState(0);
  const [guideTab, setGuideTab] = useState<"classic" | "convenience" | undefined>();
  const [activeTab, setActiveTab] = useState<string>("ASSISTANT");

  useEffect(() => {
    const authState = new URLSearchParams(window.location.search).get("auth");
    if (authState === "required" || authState === "forbidden") setActiveTab("MY");
  }, []);

  // Favorites use the authenticated database as their source of truth.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("from") === "materials") setActiveTab("MATERIALS");
  }, []);
  const [savedCocktails, setSavedCocktails] = useState<SavedCocktail[]>([]);
  const [drinkLogs, setDrinkLogs] = useState<DrinkLog[]>([]);
  const [drinkLogSuccess, setDrinkLogSuccess] = useState<{ recipeName: string; todayCount: number } | null>(null);

  // Alchemist rescue tips (persisted in localStorage)
  const [tips, setTips] = useState<MixTip[]>([]);

  // Lab Preset Ingredients for cross-screen integration
  const [labPresetIngredients, setLabPresetIngredients] = useState<any[]>([]);
  const [labPresetMixMethod, setLabPresetMixMethod] = useState<"Stir" | "Shake">("Stir");

  const syncAuthenticatedDrinkLogs = () => {
    fetch("/api/drink-logs")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!data?.drink_logs) return;
        const local = JSON.parse(localStorage.getItem("alchemix_drink_logs") ?? "[]") as DrinkLog[];
        if (data.drink_logs.length === 0 && local.length > 0) {
          Promise.all(local.map((log) => fetch("/api/drink-logs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(log) })))
            .then(() => syncAuthenticatedDrinkLogs()).catch(() => null);
          return;
        }
        setDrinkLogs(data.drink_logs);
        localStorage.setItem("alchemix_drink_logs", JSON.stringify(data.drink_logs));
      })
      .catch(() => null);
  };

  const favoriteSyncVersion=useRef(0);
  const syncAuthenticatedCocktails = () => {
    const version=++favoriteSyncVersion.current;
    fetchFavorites().then(rows=>{if(version!==favoriteSyncVersion.current)return;setSavedCocktails(rows);}).catch(()=>{});
  };
  useEffect(()=>{const refresh=()=>syncAuthenticatedCocktails();window.addEventListener(FAVORITES_CHANGED,refresh);window.addEventListener('focus',refresh);return()=>{window.removeEventListener(FAVORITES_CHANGED,refresh);window.removeEventListener('focus',refresh);};},[]);
  const syncAuthenticatedData = () => {
    syncAuthenticatedDrinkLogs();
    syncAuthenticatedCocktails();
  };

  const handleAuthChanged = (signedIn: boolean) => {
    if (signedIn) return syncAuthenticatedData();
    setDrinkLogs([]);
    favoriteSyncVersion.current++;
    setSavedCocktails([]);
    localStorage.removeItem("alchemix_drink_logs");
    localStorage.removeItem("alchemix_saved_cocktails");
  };

  // 1. Initial State Loading & Synchronization with localStorage
  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("tab") || localStorage.getItem("alchemix_open_tab");
    if (requestedTab && ["ASSISTANT", "LAB", "INSPIRATION", "MY"].includes(requestedTab)) {
      setActiveTab(requestedTab);
      localStorage.removeItem("alchemix_open_tab");
    }

    const localDrinkLogs = localStorage.getItem("alchemix_drink_logs");
    if (localDrinkLogs) {
      setDrinkLogs(JSON.parse(localDrinkLogs));
    }
    syncAuthenticatedDrinkLogs();
    syncAuthenticatedCocktails();

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
  const handleSaveCocktail = async (cocktail: SavedCocktail) => {
    const saved=await saveFavorite(cocktail);
    setSavedCocktails(current=>[saved,...current.filter(c=>c.id!==saved.id)]);
  };
  const handleRemoveCocktail = async (id: string) => {
    try{await removeFavorite(id);setSavedCocktails(current=>current.filter(c=>c.id!==id));}catch(e){alert(e instanceof Error?e.message:'取消收藏失败');}
  };

  const handleSaveDrinkLog = (log: DrinkLog) => {
    const updated = [
      log,
      ...drinkLogs.filter((item) => item.id !== log.id),
    ];
    setDrinkLogs(updated);
    localStorage.setItem("alchemix_drink_logs", JSON.stringify(updated));
    fetch(log.id && /^\d+$/.test(String(log.id)) ? `/api/drink-logs/${log.id}` : "/api/drink-logs", {
      method: log.id && /^\d+$/.test(String(log.id)) ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(log),
    }).then((response) => response.ok ? response.json() : null).then((data) => {
      if (!data?.drink_log) return;
      setDrinkLogs((current) => [data.drink_log, ...current.filter((item) => item.id !== log.id)]);
    }).catch(() => null);
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
        return <BeginnerHome key={homeVisit} onMaterials={() => setActiveTab("MATERIALS")} onExplore={(tab) => { sessionStorage.removeItem("alchemix_guide_return"); setGuideTab(tab); setActiveTab("INSPIRATION"); }} />;
      case "MATERIALS":
        return (
          <AssistantScreen
            initialPage="material-picker"
            onBackHome={() => setActiveTab("ASSISTANT")}
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
            key={guideTab ?? "browse"}
            initialExploreTab={guideTab}
            guided={Boolean(guideTab)}
            onBackGuide={() => setActiveTab("ASSISTANT")}
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
            onAuthChanged={handleAuthChanged}
          />
        );
      default:
        return <LabScreen onSaveCocktail={handleSaveCocktail} drinkLogs={drinkLogs} onSaveDrinkLog={handleSaveDrinkLog} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#e7e5e0] text-on-surface flex justify-center font-sans select-none selection:bg-black/10 md:px-6 md:py-6">
      <div data-app-shell className="relative flex h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-surface shadow-none md:h-[calc(100dvh-48px)] md:rounded-[2rem] md:border md:border-[#d5d3cd]">
      {/* Top Clinical Navigation Bar */}
      <header className="bg-surface/90 backdrop-blur-md border-b border-outline-variant/10 z-40 flex shrink-0 justify-between items-center px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-2xl">science</span>
          <h1 className="text-[12px] font-mono font-normal text-primary tracking-[0.16em]">AlcheMix Lab</h1>
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
              alert("📖 [灵感手记说明] 包含基础酒类科普、经典便利店微醺配方比例、翻车急救方法。遇到调酒疑问时，点击助手气泡进行问答。");
            }}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container transition-colors active:scale-95 duration-150 text-on-surface-variant"
            title="帮助说明"
          >
            <span className="material-symbols-outlined">help_outline</span>
          </button>
        )}
      </header>

      {/* Main Canvas Segment */}
      <main className={`flex-grow overflow-y-auto px-5 py-6 ${activeTab === "ASSISTANT" ? "bg-[#f6f5f1]" : ""}`}>
        {renderScreen()}
      </main>

      {/* Fixed Bottom Navigation Bar (Mobile & Desktop fluid footer) */}
      <nav className="z-40 bg-surface/95 backdrop-blur-md border-t border-outline-variant/15 flex shrink-0 justify-around items-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-none">
        {/* Finder */}
        <button
          onClick={() => {
            trackAnalyticsEvent({ eventName: "tab_click", page: "finder", action: "click", target: "Finder" });
            setHomeVisit(v => v + 1);
            setActiveTab("ASSISTANT");
          }}
          className={`flex flex-col items-center justify-center p-1.5 transition-all w-16 duration-200 ${
            (activeTab === "ASSISTANT" || activeTab === "MATERIALS") ? "text-primary scale-105" : "text-outline-variant hover:text-outline"
          }`}
        >
          <span 
            className="material-symbols-outlined text-2xl"
            style={(activeTab === "ASSISTANT" || activeTab === "MATERIALS") ? { fontVariationSettings: "'FILL' 1" } : {}}
          >
            home
          </span>
          <span className="text-[10px] font-medium uppercase tracking-tighter mt-1">首页</span>
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
          <span className="text-[10px] font-medium uppercase tracking-tighter mt-1">自由调配</span>
        </button>

        {/* Inspiration */}
        <button
          onClick={() => {
            trackAnalyticsEvent({ eventName: "tab_click", page: "inspiration", action: "click", target: "Inspiration" });
            sessionStorage.removeItem("alchemix_guide_return");
            setGuideTab(undefined);
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
          <span className="text-[10px] font-medium uppercase tracking-tighter mt-1">找酒谱</span>
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
          <span className="text-[10px] font-medium uppercase tracking-tighter mt-1">我的</span>
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

          <div className="relative z-10 w-full max-w-[360px] overflow-hidden rounded-[28px] border border-[#E8E8E8] bg-white p-5 text-center shadow-none animate-in fade-in zoom-in-95 duration-200">
            <div className="absolute inset-0 notebook-grid opacity-[0.025] pointer-events-none"></div>
            <div className="relative z-10">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#E8E8E8] bg-[#f6f5f1] text-neutral-950">
                <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  check_circle
                </span>
              </div>
              <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-400">Drink Log Saved</p>
              <h3 className="mt-1 text-xl font-medium text-neutral-950">成功添加了一杯酒</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                {drinkLogSuccess.recipeName} 已存入酒记。今天已经喝了{" "}
                <span className="font-medium text-neutral-950">{drinkLogSuccess.todayCount}</span> 杯。
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setDrinkLogSuccess(null)}
                  className="h-11 cursor-pointer rounded-2xl border border-[#E8E8E8] bg-white text-sm font-medium text-neutral-600 active:scale-[0.98]"
                >
                  继续看看
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDrinkLogSuccess(null);
                    setActiveTab("MY");
                  }}
                  className="h-11 cursor-pointer rounded-2xl bg-neutral-950 text-sm font-medium text-white shadow-none active:scale-[0.98]"
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
