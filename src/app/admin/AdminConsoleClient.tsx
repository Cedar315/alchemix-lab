"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Database,
  Eye,
  FlaskConical,
  LayoutDashboard,
  ListFilter,
  LogOut,
  Pencil,
  Plus,
  Search,
  ClipboardCheck,
  ShieldCheck,
  Sparkles,
  Tags,
  X,
} from "lucide-react";
import { CONVENIENCE_DRINK_INGREDIENTS } from "@/lib/data/convenience-drink-ingredients";
import { JUICE_INGREDIENTS } from "@/lib/data/juice-ingredients";
import { INSPIRATION_RECIPES } from "@/lib/data/inspiration-catalog";
import { AnalyticsEventRecord, readAnalyticsEvents } from "@/lib/analytics";
import { DrinkLog } from "@/types";

type AdminTab = "mvp" | "overview" | "ingredients" | "cocktails" | "problems" | "data-review";
type AdminDraftKind = "配料" | "酒单" | "问题";
type AdminDetail = {
  eyebrow: string;
  title: string;
  subtitle: string;
  description?: string;
  rows: Array<{ label: string; value: string | number }>;
  tags: string[];
};

const tabs: Array<{ id: AdminTab; label: string; icon: React.ElementType }> = [
  { id: "mvp", label: "MVP 看板", icon: BarChart3 },
  { id: "overview", label: "数据总览", icon: LayoutDashboard },
  { id: "ingredients", label: "配料", icon: FlaskConical },
  { id: "cocktails", label: "酒单", icon: Tags },
  { id: "problems", label: "问题库", icon: ShieldCheck },
  { id: "data-review", label: "数据审核", icon: ClipboardCheck },
];

const adminProblemGroups = [
  { category: "味道失衡", count: 38, examples: ["太甜怎么办", "太酸怎么办", "酒味太冲怎么办"] },
  { category: "材料冲突", count: 29, examples: ["奶类遇高酸结块", "气泡饮料不能摇", "咖啡和果酸冲突"] },
  { category: "操作失误", count: 32, examples: ["摇太久太稀", "冰块不够冷", "层次混在一起"] },
  { category: "新手替换", count: 27, examples: ["没有摇壶怎么做", "没有利口酒怎么替代", "便利店低成本版本"] },
  { category: "安全提醒", count: 37, examples: ["咖啡因叠加", "高度酒叠加", "低酒感不等于低酒精"] },
];

const dataReviewQueue = [
  {
    nameZh: "椰树牌椰汁",
    nameEn: "Coconut Milk Drink",
    source: "用户搜索未命中",
    status: "待确认",
    suggestion: "建议合并到椰汁 / 椰奶饮料别名，不新建重复项。",
  },
  {
    nameZh: "三得利无糖乌龙茶",
    nameEn: "Suntory Sugar-Free Oolong Tea",
    source: "待补全资料",
    status: "待补字段",
    suggestion: "需要确认咖啡因、苦味、便利店可获得性。",
  },
  {
    nameZh: "新款果味气泡水",
    nameEn: "Fruit Sparkling Water",
    source: "用户手动录入",
    status: "待审核",
    suggestion: "确认品牌和糖分后进入气泡饮料分类。",
  },
];

const normalize = (value: string) => value.trim().toLowerCase();

export default function AdminConsoleClient() {
  const [activeTab, setActiveTab] = useState<AdminTab>("mvp");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [detail, setDetail] = useState<AdminDetail | null>(null);
  const [reviewQueue, setReviewQueue] = useState(dataReviewQueue);
  const [draftItems, setDraftItems] = useState<Array<{ id: string; kind: AdminDraftKind; title: string; createdAt: string }>>([]);
  const [analyticsEvents, setAnalyticsEvents] = useState<AnalyticsEventRecord[]>([]);
  const [localDrinkLogs, setLocalDrinkLogs] = useState<DrinkLog[]>([]);
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    try {
      const response = await fetch("/api/auth/sign-out", { method: "POST" });
      if (!response.ok) throw new Error("退出失败");
      window.location.assign("/");
    } catch {
      setToast("退出失败，请稍后重试");
      setSigningOut(false);
    }
  };

  const refreshMvpData = () => {
    setAnalyticsEvents(readAnalyticsEvents());
    try {
      const rawDrinkLogs = window.localStorage.getItem("alchemix_drink_logs");
      setLocalDrinkLogs(rawDrinkLogs ? JSON.parse(rawDrinkLogs) : []);
    } catch {
      setLocalDrinkLogs([]);
    }

    fetch("/api/analytics/events")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!data?.events) return;
        const local = readAnalyticsEvents();
        const merged = [...local, ...data.events].filter(
          (event, index, list) => list.findIndex((item) => item.id === event.id) === index,
        );
        setAnalyticsEvents(merged);
      })
      .catch(() => {
        // 数据库未连接时仍使用 localStorage 的 MVP 指标。
      });
  };

  useEffect(() => {
    refreshMvpData();
  }, []);

  const ingredients = useMemo(
    () => [
      ...CONVENIENCE_DRINK_INGREDIENTS.map((item) => ({
        id: item.slug,
        nameZh: item.nameZh,
        nameEn: item.nameEn,
        category: item.category,
        subCategory: item.subCategory,
        type: item.type,
        sweetness: item.sweetness,
        acidity: item.acidity,
        carbonation: item.carbonation,
        availability: item.convenienceStoreAvailability,
        tags: item.flavorTags,
        source: "convenience",
        confidence: item.confidence,
        sourceNote: item.sourceNote,
        reviewStatus: item.confidence === "estimated" ? "待复核" : "已审核",
      })),
      ...JUICE_INGREDIENTS.map((item) => ({
        id: item.id,
        nameZh: item.nameZh,
        nameEn: item.nameEn,
        category: item.category,
        subCategory: item.subCategory,
        type: item.type,
        sweetness: item.sweetness,
        acidity: item.acidity,
        carbonation: item.carbonation,
        availability: item.convenienceStoreAvailability,
        tags: item.flavorTags,
        source: "juice",
        confidence: item.confidence,
        sourceNote: item.sourceNote,
        reviewStatus: item.confidence === "estimated" ? "待复核" : "已审核",
      })),
    ],
    [],
  );

  const ingredientCategories = useMemo(
    () => Array.from(new Set(ingredients.map((item) => item.category))).sort((a, b) => a.localeCompare(b, "zh-CN")),
    [ingredients],
  );

  const filteredIngredients = useMemo(() => {
    const keyword = normalize(query);
    const categoryMatched = (item: (typeof ingredients)[number]) => selectedCategory === "全部" || item.category === selectedCategory;
    if (!keyword) return ingredients.filter(categoryMatched).slice(0, 48);
    return ingredients
      .filter(
        (item) =>
          categoryMatched(item) &&
          [
            item.nameZh,
            item.nameEn,
            item.category,
            item.subCategory,
            item.type,
            ...item.tags,
          ].some((text) => normalize(String(text)).includes(keyword)),
      )
      .slice(0, 80);
  }, [ingredients, query, selectedCategory]);

  const filteredRecipes = useMemo(() => {
    const keyword = normalize(query);
    const recipes = INSPIRATION_RECIPES;
    if (!keyword) return recipes.slice(0, 64);
    return recipes
      .filter((recipe) =>
        [
          recipe.nameCn,
          recipe.nameEn,
          recipe.type,
          recipe.baseSpirit,
          recipe.description,
          ...recipe.tags,
          ...recipe.ingredients.flatMap((item) => [item.nameCn, item.nameEn, item.role]),
        ].some((text) => normalize(String(text)).includes(keyword)),
      )
      .slice(0, 96);
  }, [query]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  const createDraft = (kind: AdminDraftKind) => {
    const draft = {
      id: `${kind}-${Date.now()}`,
      kind,
      title: `新的${kind}草稿`,
      createdAt: new Date().toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }),
    };
    setDraftItems((items) => [draft, ...items].slice(0, 6));
    setActiveTab(kind === "配料" ? "ingredients" : kind === "酒单" ? "cocktails" : "problems");
    showToast(`${draft.title}已创建。现在是本地草稿，接 Prisma 后会保存到数据库。`);
  };

  const openIngredientDetail = (item: (typeof ingredients)[number]) => {
    setDetail({
      eyebrow: "配料详情",
      title: item.nameZh,
      subtitle: item.nameEn,
      description: "用于搜索、风味匹配、调酒推荐和注入材料配置的本地事实数据。",
      rows: [
        { label: "分类", value: `${item.category} / ${item.subCategory}` },
        { label: "类型", value: item.type },
        { label: "甜度", value: item.sweetness },
        { label: "酸度", value: item.acidity },
        { label: "气泡", value: item.carbonation },
        { label: "便利店可获得性", value: item.availability },
        { label: "可信度", value: item.confidence },
        { label: "审核状态", value: item.reviewStatus },
        { label: "来源说明", value: item.sourceNote },
      ],
      tags: item.tags,
    });
  };

  const openRecipeDetail = (recipe: (typeof INSPIRATION_RECIPES)[number]) => {
    setDetail({
      eyebrow: "酒单详情",
      title: recipe.nameCn,
      subtitle: recipe.nameEn,
      description: recipe.description,
      rows: [
        { label: "类型", value: recipe.type },
        { label: "基酒", value: recipe.baseSpirit },
        { label: "做法", value: recipe.method },
        { label: "杯具", value: recipe.glassware },
        { label: "难度", value: recipe.difficulty },
        { label: "配方", value: recipe.ingredients.map((item) => `${item.nameCn}${item.amount}${item.unit}`).join(" / ") },
      ],
      tags: recipe.tags,
    });
  };

  const openProblemDetail = (group: (typeof adminProblemGroups)[number]) => {
    setDetail({
      eyebrow: "问题库分类",
      title: group.category,
      subtitle: `${group.count} 条调酒疑难问题`,
      description: "这些问题会用于翻车小贴士、Lab 提醒和新手解释。后续接数据库后可以逐条编辑 quick fix、原因和下次建议。",
      rows: group.examples.map((example, index) => ({ label: `示例 ${index + 1}`, value: example })),
      tags: ["小白建议", "规则校验", "可搜索"],
    });
  };

  const markReviewNeedsFields = (nameZh: string) => {
    setReviewQueue((items) => items.map((item) => item.nameZh === nameZh ? { ...item, status: "待补字段" } : item));
    showToast(`${nameZh} 已标记为需要补字段。`);
  };

  const approveReviewItem = (nameZh: string) => {
    setReviewQueue((items) => items.filter((item) => item.nameZh !== nameZh));
    showToast(`${nameZh} 已通过审核，并从待审核队列移除。`);
  };

  const mvpDashboard = useMemo(() => {
    const countEvent = (eventName: string) => analyticsEvents.filter((event) => event.eventName === eventName).length;
    const countSourceLogs = (matcher: (source: string) => boolean) =>
      localDrinkLogs.filter((log) => matcher(log.sourcePage || "")).length;
    const percent = (value: number, base: number) => base > 0 ? Math.round((value / base) * 100) : 0;

    const labViews = countEvent("lab_view");
    const ingredientAdds = countEvent("ingredient_added");
    const labMixStarts = countEvent("lab_mix_start");
    const labResults = countEvent("lab_result_view");
    const labRecords = countSourceLogs((source) => source.includes("lab"));
    const inspirationViews = countEvent("inspiration_view");
    const recipeCardClicks = countEvent("cocktail_card_click");
    const recipeDetailViews = countEvent("recipe_detail_view");
    const inspirationRecords = countSourceLogs((source) => source.includes("inspiration") || source.includes("classic") || source.includes("convenience"));
    const ratedLogs = localDrinkLogs.filter((log) => (log.rating ?? 0) > 0).length;
    const notedLogs = localDrinkLogs.filter((log) => Boolean(log.note?.trim())).length;
    const repeatRecords = localDrinkLogs.length >= 2 ? 1 : 0;

    const ingredientTop = analyticsEvents
      .filter((event) => event.eventName === "ingredient_added" && event.target)
      .reduce<Record<string, number>>((acc, event) => {
        acc[event.target || "未知材料"] = (acc[event.target || "未知材料"] || 0) + 1;
        return acc;
      }, {});

    const recipeTop = localDrinkLogs.reduce<Record<string, number>>((acc, log) => {
      acc[log.recipeName] = (acc[log.recipeName] || 0) + 1;
      return acc;
    }, {});

    const highScoreTop = [...localDrinkLogs]
      .filter((log) => (log.rating ?? 0) > 0)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 5);

    return {
      cards: [
        { label: "有效记录杯数", value: localDrinkLogs.length, note: "来自记录一杯 / 酒记" },
        { label: "Lab 开始实验", value: labMixStarts, note: `${percent(labMixStarts, Math.max(labViews, 1))}% / 进入 Lab` },
        { label: "实验结果记录率", value: `${percent(labRecords, labResults)}%`, note: `${labRecords}/${labResults || 0} 次结果被记录` },
        { label: "酒记数据质量", value: `${percent(ratedLogs + notedLogs, Math.max(localDrinkLogs.length * 2, 1))}%`, note: "评分和心得完整度" },
      ],
      labFunnel: [
        { label: "进入 Lab", value: labViews, rate: 100 },
        { label: "添加材料", value: ingredientAdds, rate: percent(ingredientAdds, labViews) },
        { label: "开始实验", value: labMixStarts, rate: percent(labMixStarts, ingredientAdds) },
        { label: "查看结果", value: labResults, rate: percent(labResults, labMixStarts) },
        { label: "记录一杯", value: labRecords, rate: percent(labRecords, labResults) },
      ],
      exploration: [
        { label: "探索页访问", value: inspirationViews },
        { label: "酒卡点击", value: recipeCardClicks },
        { label: "配方详情", value: recipeDetailViews },
        { label: "探索记录", value: inspirationRecords },
      ],
      quality: [
        { label: "有评分酒记", value: `${ratedLogs}/${localDrinkLogs.length}` },
        { label: "有心得酒记", value: `${notedLogs}/${localDrinkLogs.length}` },
        { label: "二次记录", value: repeatRecords ? "已发生" : "未发生" },
        { label: "本地事件数", value: analyticsEvents.length },
      ],
      ingredientTop: Object.entries(ingredientTop).sort((a, b) => b[1] - a[1]).slice(0, 8),
      recipeTop: Object.entries(recipeTop).sort((a, b) => b[1] - a[1]).slice(0, 8),
      highScoreTop,
    };
  }, [analyticsEvents, localDrinkLogs]);

  const dynamicReviewQueue = useMemo(() => {
    const unmatched = analyticsEvents
      .filter((event) => event.eventName === "ingredient_search_unmatched" && event.target)
      .reduce<Array<{ nameZh: string; nameEn: string; source: string; status: string; suggestion: string }>>((list, event) => {
        if (list.some((item) => item.nameZh === event.target)) return list;
        return [
          ...list,
          {
            nameZh: event.target || "未知饮料",
            nameEn: "Unmatched user query",
            source: "用户搜索未命中",
            status: "待审核",
            suggestion: "先检查是否是简称、错别字或品牌别名；若不是已有条目，再根据用户提供的配料表补成临时材料。",
          },
        ];
      }, []);

    return [...unmatched, ...reviewQueue];
  }, [analyticsEvents, reviewQueue]);

  const stats = [
    { label: "有效记录", value: localDrinkLogs.length, note: "MVP 北极星指标" },
    { label: "本地配料", value: ingredients.length, note: `${ingredientCategories.length} 个分类` },
    { label: "灵感酒单", value: INSPIRATION_RECIPES.length, note: "经典 / 便利店 / 口味" },
    { label: "问题库", value: adminProblemGroups.reduce((sum, group) => sum + group.count, 0), note: "翻车急救与新手建议" },
    { label: "待审核", value: dynamicReviewQueue.length, note: "未命中和待补字段" },
  ];

  return (
    <div className="min-h-screen bg-[#f6f5f1] text-neutral-950">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-[#E8E8E8] pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-4">
              <a href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 transition hover:text-neutral-950">
                <ArrowLeft size={16} />
                返回 AlcheMix Lab
              </a>
              <button
                type="button"
                onClick={signOut}
                disabled={signingOut}
                className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-red-600 transition hover:text-red-700 disabled:cursor-wait disabled:opacity-60"
              >
                <LogOut size={16} />
                {signingOut ? "正在退出…" : "退出登录"}
              </button>
            </div>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E8E8E8] bg-white px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                <Database size={13} />
                Admin Console
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">AlcheMix Console</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
                调酒数据控制台。先管理本地事实库、可信度和审核队列，真正写入数据库前由这里确认。
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-[#E8E8E8] bg-white p-4 shadow-none">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-950 text-white">
                <ShieldCheck size={20} />
              </div>
              <div>
                <p className="text-sm font-medium">数据库优先</p>
                <p className="text-xs leading-5 text-neutral-500">估算资料不直接入库</p>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-3 py-5 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <button
              key={stat.label}
              type="button"
              onClick={() => {
                if (stat.label === "有效记录") setActiveTab("mvp");
                if (stat.label === "本地配料") setActiveTab("ingredients");
                if (stat.label === "灵感酒单") setActiveTab("cocktails");
                if (stat.label === "问题库") setActiveTab("problems");
                if (stat.label === "待审核") setActiveTab("data-review");
              }}
              className="cursor-pointer rounded-3xl border border-[#E8E8E8] bg-white p-4 text-left shadow-none transition hover:border-neutral-300 active:scale-[0.99]"
            >
              <p className="text-xs font-medium text-neutral-500">{stat.label}</p>
              <p className="mt-2 text-3xl font-semibold">{stat.value}</p>
              <p className="mt-1 flex items-center justify-between gap-2 text-xs leading-5 text-neutral-500">
                {stat.note}
                <ChevronRight size={14} />
              </p>
            </button>
          ))}
        </section>

        <div className="sticky top-0 z-20 -mx-4 border-y border-[#E8E8E8] bg-[#f6f5f1]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <nav className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const selected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-2xl border px-4 text-sm font-medium transition active:scale-[0.98] ${
                      selected
                        ? "border-neutral-950 bg-neutral-950 text-white"
                        : "border-[#E8E8E8] bg-white text-neutral-500 hover:text-neutral-950"
                    }`}
                  >
                    <Icon size={16} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>

            <label className="flex h-11 min-w-0 items-center gap-2 rounded-2xl border border-[#E8E8E8] bg-white px-3 text-sm text-neutral-500 lg:w-80">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索名称 / 分类 / 标签..."
                className="min-w-0 flex-1 bg-transparent text-neutral-950 outline-none placeholder:text-neutral-400"
              />
            </label>
          </div>
        </div>

        <main className="flex-1 py-5">
          {activeTab === "mvp" && (
            <section className="space-y-4">
              <div className="flex flex-col gap-3 rounded-[2rem] border border-[#E8E8E8] bg-white p-5 shadow-none sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">MVP 数据看板</h2>
                  <p className="mt-1 text-sm leading-6 text-neutral-500">
                    用真实点击和酒记验证核心路径：Lab 调制、探索找酒、记录一杯、形成口味画像。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    refreshMvpData();
                    showToast("MVP 数据已刷新。");
                  }}
                  className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-4 text-sm font-medium text-white active:scale-[0.98]"
                >
                  <BarChart3 size={16} />
                  刷新数据
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {mvpDashboard.cards.map((card) => (
                  <article key={card.label} className="rounded-3xl border border-[#E8E8E8] bg-white p-4 shadow-none">
                    <p className="text-xs font-medium text-neutral-500">{card.label}</p>
                    <p className="mt-2 text-3xl font-semibold">{card.value}</p>
                    <p className="mt-1 text-xs leading-5 text-neutral-500">{card.note}</p>
                  </article>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                <section className="rounded-[2rem] border border-[#E8E8E8] bg-white p-5 shadow-none">
                  <h3 className="text-lg font-semibold">Lab 核心漏斗</h3>
                  <p className="mt-1 text-sm leading-6 text-neutral-500">进入 Lab → 添加材料 → 开始实验 → 查看结果 → 记录一杯。</p>
                  <div className="mt-5 space-y-3">
                    {mvpDashboard.labFunnel.map((step) => (
                      <div key={step.label} className="rounded-3xl border border-[#E8E8E8] bg-[#f6f5f1] p-3">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-medium text-neutral-800">{step.label}</span>
                          <span className="font-semibold text-neutral-950">{step.value} 次</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                          <div className="h-full rounded-full bg-neutral-950" style={{ width: `${Math.min(100, step.rate)}%` }}></div>
                        </div>
                        <p className="mt-1 text-right text-[11px] font-medium text-neutral-400">转化 {step.rate}%</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-[2rem] border border-[#E8E8E8] bg-white p-5 shadow-none">
                  <h3 className="text-lg font-semibold">探索与酒记质量</h3>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {mvpDashboard.exploration.map((item) => (
                      <Metric key={item.label} label={item.label} value={Number(item.value)} />
                    ))}
                  </div>
                  <div className="mt-4 grid gap-2">
                    {mvpDashboard.quality.map((item) => (
                      <div key={item.label} className="flex items-center justify-between rounded-2xl border border-[#E8E8E8] bg-[#f6f5f1] px-3 py-2 text-sm">
                        <span className="font-semibold text-neutral-500">{item.label}</span>
                        <span className="font-semibold text-neutral-950">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <MvpList title="常用材料 Top" empty="还没有添加材料事件。" rows={mvpDashboard.ingredientTop.map(([name, count]) => ({ name, value: `${count} 次` }))} />
                <MvpList title="常被记录的酒" empty="还没有酒记。" rows={mvpDashboard.recipeTop.map(([name, count]) => ({ name, value: `${count} 杯` }))} />
                <MvpList title="我的高分酒" empty="还没有评分酒记。" rows={mvpDashboard.highScoreTop.map((log) => ({ name: log.recipeName, value: `${log.rating}/5` }))} />
              </div>

              <section className="rounded-[2rem] border border-[#E8E8E8] bg-white p-5 text-sm leading-6 text-neutral-500">
                <h3 className="text-lg font-semibold text-neutral-950">当前验证口径</h3>
                <p className="mt-2">
                  北极星指标使用“有效记录杯数”。Lab 漏斗来自点击事件；酒记质量来自用户保存的评分和心得。
                  本地 demo 会先写入 localStorage，部署 Supabase 后同一批事件会通过 API 写入 `analytics_events` 表。
                </p>
              </section>
            </section>
          )}

          {activeTab === "overview" && (
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <section className="rounded-[2rem] border border-[#E8E8E8] bg-white p-5 shadow-none">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">管理台路线</h2>
                    <p className="mt-1 text-sm leading-6 text-neutral-500">先做事实数据维护，再接 Supabase 写入和权限。</p>
                  </div>
                  <Sparkles className="text-neutral-300" size={24} />
                </div>
                <div className="mt-5 grid gap-3">
                  {[
                    ["1", "整理本地库", "把便利店饮料、果汁、酒类、经典酒单做成可搜索、可编辑、可审核的数据。"],
                    ["2", "估算资料先审核", "本地无结果或来源不完整时，先进入数据审核队列，人工确认后再发布。"],
                    ["3", "接 Prisma API", "新增、编辑、发布都通过 Next.js API Route / Server Action 写入 Supabase。"],
                    ["4", "再加权限", "Vercel 部署后给 /admin 加登录保护，只允许你自己进入。"],
                  ].map(([step, title, body]) => (
                    <article key={step} className="flex gap-3 rounded-3xl border border-[#E8E8E8] bg-[#f6f5f1] p-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-sm font-semibold text-white">{step}</div>
                      <div>
                        <h3 className="font-medium">{title}</h3>
                        <p className="mt-1 text-sm leading-6 text-neutral-500">{body}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="rounded-[2rem] border border-[#E8E8E8] bg-white p-5 shadow-none">
                <h2 className="text-xl font-semibold">快捷操作</h2>
                <div className="mt-5 grid gap-3">
                  {[
                    ["新增配料", "先进入草稿，确认字段后发布到 Ingredient", "配料"],
                    ["新增酒单", "维护经典酒、便利店特调、盲盒和心情酒池", "酒单"],
                    ["导入问题", "批量维护翻车小贴士和调法常识", "问题"],
                  ].map(([title, body, kind]) => (
                    <button
                      key={title}
                      type="button"
                      onClick={() => createDraft(kind as AdminDraftKind)}
                      className="flex cursor-pointer items-center justify-between rounded-3xl border border-[#E8E8E8] bg-[#f6f5f1] p-4 text-left transition hover:border-neutral-300 active:scale-[0.99]"
                    >
                      <span>
                        <span className="block font-medium">{title}</span>
                        <span className="mt-1 block text-sm leading-5 text-neutral-500">{body}</span>
                      </span>
                      <Plus size={18} />
                    </button>
                  ))}
                </div>
                {draftItems.length > 0 && (
                  <div className="mt-5 rounded-3xl border border-[#E8E8E8] bg-[#f6f5f1] p-4">
                    <p className="text-xs font-medium text-neutral-400">本地草稿</p>
                    <div className="mt-3 space-y-2">
                      {draftItems.map((draft) => (
                        <button
                          key={draft.id}
                          type="button"
                          onClick={() => showToast(`${draft.title}：编辑表单会在接数据库时补上。`)}
                          className="flex w-full cursor-pointer items-center justify-between rounded-2xl bg-white px-3 py-2 text-left text-sm font-semibold text-neutral-700"
                        >
                          <span>{draft.title}</span>
                          <span className="text-xs text-neutral-400">{draft.createdAt}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}

          {activeTab === "ingredients" && (
            <section className="space-y-4">
              <PanelTitle title="配料管理" subtitle={`当前展示 ${filteredIngredients.length} 条，本地总计 ${ingredients.length} 条。`} onAdd={() => createDraft("配料")} />
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {["全部", ...ingredientCategories.slice(0, 14)].map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory(category)}
                    className={`h-9 shrink-0 cursor-pointer rounded-full border px-3 text-sm font-semibold transition ${
                      selectedCategory === category
                        ? "border-neutral-950 bg-neutral-950 text-white"
                        : "border-[#E8E8E8] bg-white text-neutral-600 hover:border-neutral-950 hover:text-neutral-950"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredIngredients.map((item) => (
                  <button
                    key={`${item.source}-${item.id}`}
                    type="button"
                    onClick={() => openIngredientDetail(item)}
                    className="cursor-pointer rounded-3xl border border-[#E8E8E8] bg-white p-4 text-left shadow-none transition hover:border-neutral-300 active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold">{item.nameZh}</h3>
                        <p className="text-sm font-semibold text-neutral-500">{item.nameEn}</p>
                      </div>
                      <span className="rounded-full bg-[#f6f5f1] px-2.5 py-1 text-[11px] font-medium text-neutral-500">{item.category}</span>
                    </div>
                    <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
                      <Metric label="甜" value={item.sweetness} />
                      <Metric label="酸" value={item.acidity} />
                      <Metric label="气泡" value={item.carbonation} />
                      <Metric label="好买" value={item.availability} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {item.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="rounded-full bg-[#f6f5f1] px-2 py-1 text-[11px] font-semibold text-neutral-500">{tag}</span>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-[#F1F1F1] pt-3 text-xs font-medium text-neutral-400">
                      查看详情
                      <Eye size={14} />
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {activeTab === "cocktails" && (
            <section className="space-y-4">
              <PanelTitle title="酒单管理" subtitle={`当前展示 ${filteredRecipes.length} 条，本地总计 ${INSPIRATION_RECIPES.length} 条。`} onAdd={() => createDraft("酒单")} />
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredRecipes.map((recipe) => (
                  <button
                    key={recipe.slug}
                    type="button"
                    onClick={() => openRecipeDetail(recipe)}
                    className="cursor-pointer rounded-3xl border border-[#E8E8E8] bg-white p-4 text-left shadow-none transition hover:border-neutral-300 active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold">{recipe.nameCn}</h3>
                        <p className="text-sm font-semibold text-neutral-500">{recipe.nameEn}</p>
                      </div>
                      <span className="rounded-full bg-neutral-950 px-2.5 py-1 text-[11px] font-medium text-white">{recipe.type}</span>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-neutral-500">{recipe.description}</p>
                    <div className="mt-4 rounded-2xl bg-[#f6f5f1] p-3">
                      <p className="text-[11px] font-medium text-neutral-400">配方骨架</p>
                      <p className="mt-1 text-sm font-semibold text-neutral-700">
                        {recipe.ingredients.slice(0, 4).map((item) => item.nameCn).join(" / ")}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-[#F1F1F1] pt-3 text-xs font-medium text-neutral-400">
                      查看配方
                      <Eye size={14} />
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {activeTab === "problems" && (
            <section className="space-y-4">
              <PanelTitle title="问题库管理" subtitle="给翻车小贴士、调法提醒和新手解释用，后续可以接搜索和分类编辑。" onAdd={() => createDraft("问题")} />
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {adminProblemGroups.map((group) => (
                  <button
                    key={group.category}
                    type="button"
                    onClick={() => openProblemDetail(group)}
                    className="cursor-pointer rounded-3xl border border-[#E8E8E8] bg-white p-5 text-left shadow-none transition hover:border-neutral-300 active:scale-[0.99]"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">{group.category}</h3>
                      <span className="rounded-full bg-[#f6f5f1] px-2.5 py-1 text-xs font-medium text-neutral-500">{group.count} 条</span>
                    </div>
                    <div className="mt-4 space-y-2">
                      {group.examples.map((example) => (
                        <div key={example} className="rounded-2xl border border-[#E8E8E8] bg-[#f6f5f1] px-3 py-2 text-sm font-semibold text-neutral-600">
                          {example}
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-[#F1F1F1] pt-3 text-xs font-medium text-neutral-400">
                      查看分类
                      <Eye size={14} />
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {activeTab === "data-review" && (
            <section className="space-y-4">
              <PanelTitle title="待确认数据" subtitle="本地库搜不到、来源不完整或估算字段较多时，先在这里确认后再入库。" onAdd={() => showToast("审核项会从用户未命中搜索、手动录入和待补全资料进入队列。")} />
              <div className="grid gap-3">
                {dynamicReviewQueue.map((item) => (
                  <article key={`${item.source}-${item.nameZh}`} className="rounded-3xl border border-[#E8E8E8] bg-white p-5 shadow-none">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold">{item.nameZh}</h3>
                          <span className="rounded-full bg-[#f6f5f1] px-2.5 py-1 text-[11px] font-medium text-neutral-500">{item.status}</span>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-neutral-500">{item.nameEn}</p>
                        <p className="mt-3 text-sm leading-6 text-neutral-600">{item.suggestion}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => markReviewNeedsFields(item.nameZh)}
                          className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-2xl border border-[#E8E8E8] bg-white px-3 text-sm font-medium text-neutral-600 active:scale-[0.98]"
                        >
                          <ListFilter size={15} />
                          补字段
                        </button>
                        <button
                          type="button"
                          onClick={() => approveReviewItem(item.nameZh)}
                          className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-2xl bg-neutral-950 px-3 text-sm font-medium text-white active:scale-[0.98]"
                        >
                          <CheckCircle2 size={15} />
                          通过
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
                {dynamicReviewQueue.length === 0 && (
                  <div className="rounded-[2rem] border border-dashed border-[#D8D8D8] bg-white p-8 text-center">
                    <CheckCircle2 className="mx-auto text-neutral-300" size={28} />
                    <h3 className="mt-3 text-lg font-semibold">审核队列已清空</h3>
                    <p className="mt-2 text-sm leading-6 text-neutral-500">之后本地库没有命中的搜索、资料不完整项和用户手动录入都会进入这里。</p>
                  </div>
                )}
              </div>
            </section>
          )}
        </main>
      </div>

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 w-[calc(100%-32px)] max-w-md -translate-x-1/2 rounded-2xl border border-[#E8E8E8] bg-white px-4 py-3 text-sm font-semibold text-neutral-700 shadow-none">
          {toast}
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/20 px-3 py-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-xl rounded-[2rem] border border-[#E8E8E8] bg-white p-5 shadow-none">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">{detail.eyebrow}</p>
                <h2 className="mt-2 text-2xl font-semibold text-neutral-950">{detail.title}</h2>
                <p className="mt-1 text-sm font-semibold text-neutral-500">{detail.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#E8E8E8] bg-[#f6f5f1] text-neutral-500 transition hover:text-neutral-950 active:scale-[0.98]"
              >
                <X size={18} />
              </button>
            </div>

            {detail.description && (
              <p className="mt-4 rounded-3xl bg-[#f6f5f1] p-4 text-sm leading-6 text-neutral-600">{detail.description}</p>
            )}

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {detail.rows.map((row) => (
                <div key={row.label} className="rounded-2xl border border-[#E8E8E8] bg-white px-3 py-2">
                  <p className="text-[11px] font-medium text-neutral-400">{row.label}</p>
                  <p className="mt-1 break-words text-sm font-semibold leading-5 text-neutral-800">{row.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {detail.tags.slice(0, 10).map((tag) => (
                <span key={tag} className="rounded-full bg-[#f6f5f1] px-2.5 py-1 text-xs font-medium text-neutral-500">{tag}</span>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => showToast(`${detail.title}：编辑表单会在接数据库时补上。`)}
                className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[#E8E8E8] bg-white text-sm font-medium text-neutral-700 active:scale-[0.98]"
              >
                <Pencil size={15} />
                编辑草稿
              </button>
              <button
                type="button"
                onClick={() => showToast(`${detail.title}：发布动作会通过 API 写入数据库。`)}
                className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-neutral-950 text-sm font-medium text-white active:scale-[0.98]"
              >
                <CheckCircle2 size={15} />
                发布确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PanelTitle({ title, subtitle, onAdd }: { title: string; subtitle: string; onAdd: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-[2rem] border border-[#E8E8E8] bg-white p-5 shadow-none sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-neutral-500">{subtitle}</p>
      </div>
      <button
        type="button"
        className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-4 text-sm font-medium text-white active:scale-[0.98]"
        onClick={onAdd}
      >
        <Plus size={16} />
        新增
      </button>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-[#f6f5f1] px-2 py-2">
      <p className="font-medium text-neutral-950">{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold text-neutral-400">{label}</p>
    </div>
  );
}

function MvpList({ title, empty, rows }: { title: string; empty: string; rows: Array<{ name: string; value: string }> }) {
  return (
    <section className="rounded-[2rem] border border-[#E8E8E8] bg-white p-5 shadow-none">
      <h3 className="text-lg font-semibold">{title}</h3>
      {rows.length > 0 ? (
        <div className="mt-4 space-y-2">
          {rows.map((row, index) => (
            <div key={`${row.name}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl bg-[#f6f5f1] px-3 py-2">
              <span className="min-w-0 truncate text-sm font-medium text-neutral-800">{index + 1}. {row.name}</span>
              <span className="shrink-0 text-xs font-semibold text-neutral-500">{row.value}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-[#D8D8D8] bg-[#f6f5f1] p-4 text-sm leading-6 text-neutral-500">{empty}</p>
      )}
    </section>
  );
}
