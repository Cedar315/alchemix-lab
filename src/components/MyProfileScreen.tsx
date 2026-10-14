import { tasteSummary, type TasteSettings } from "../lib/preferences/taste";
import CocktailLineArt from "./CocktailLineArt";
import CocktailIllustration from "./CocktailIllustration";
import { safeReturnPath } from "@/lib/auth/return-path";
import React, { useEffect, useMemo, useState } from "react";
import { DrinkLog, SavedCocktail } from "../types";

interface MyProfileScreenProps {
  settings: TasteSettings;
  onOpenSettings: () => void;
  savedCocktails: SavedCocktail[];
  drinkLogs: DrinkLog[];
  onRemoveCocktail: (id: string) => void;
  onNavigateToLab: () => void;
  onAuthChanged: (signedIn: boolean) => void;
}

type AccountProfile = {
  id: string;
  nickname: string;
  email: string;
  createdAt: string;
};

type ProfileView = "home" | "drink-list" | "favorite-list";
type ListCategory = "all" | "lab" | "convenience" | "classic";

export default function MyProfileScreen({
  settings,
  onOpenSettings,
  savedCocktails,
  drinkLogs,
  onRemoveCocktail,
  onNavigateToLab,
  onAuthChanged,
}: MyProfileScreenProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [accountProfile, setAccountProfile] = useState<AccountProfile | null>(null);
  const [showAccountSheet, setShowAccountSheet] = useState(false);
  const [accountMode, setAccountMode] = useState<"login" | "register" | "profile">("login");
  const [accountNickname, setAccountNickname] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [confirmationEmailSent, setConfirmationEmailSent] = useState(false);
  const [profileView, setProfileView] = useState<ProfileView>("home");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("auth") === "required") {
      setAccountMode("login");
      setShowAccountSheet(true);
    }
  }, []);
  const [activeListCategory, setActiveListCategory] = useState<ListCategory>("all");
  const [accountError, setAccountError] = useState("");
  const [accountNotice, setAccountNotice] = useState("");
  const [accountPending, setAccountPending] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!data?.user) return;
        const profile = { id: data.user.id, nickname: data.user.nickname || data.user.email.split("@")[0], email: data.user.email, createdAt: new Date().toISOString() };
        setAccountProfile(profile);
        setAccountNickname(profile.nickname);
        setAccountEmail(profile.email);
      })
      .catch(() => setAccountError("暂时无法读取账号状态"));
  }, []);

  const openAccountSheet = (mode: "login" | "register" | "profile") => {
    setAccountMode(mode);
    setAccountNickname(accountProfile?.nickname ?? "");
    setAccountEmail(accountProfile?.email ?? "");
    setAccountPassword("");
    setAcceptedPolicies(false);
    setConfirmationEmailSent(false);
    setAccountError("");
    setAccountNotice("");
    setShowAccountSheet(true);
  };

  const saveAccountProfile = async () => {
    const email = accountEmail.trim();
    const nickname = accountMode === "register" || accountMode === "profile"
      ? accountNickname.trim() || "Dr. Mix"
      : accountProfile?.nickname || email.split("@")[0] || "Dr. Mix";
    if (accountMode === "profile" ? !nickname : !email || !accountPassword) return;
    setAccountPending(true);
    setAccountError("");
    setAccountNotice("");
    try {
      if (accountMode === "profile") {
        const response = await fetch("/api/auth/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nickname }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "更新档案失败");
        setAccountProfile((current) => current ? { ...current, nickname: data.user.nickname } : current);
        setShowAccountSheet(false);
        return;
      }
      const endpoint = accountMode === "register" ? "/api/auth/sign-up" : "/api/auth/sign-in";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: accountPassword, nickname, acceptedPolicies }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "账号操作失败");
      if (data.requiresEmailConfirmation) {
        setConfirmationEmailSent(true);
        setAccountError("");
        return;
      }
      const user = data.user;
      if (user) {
        setAccountProfile({ id: user.id, nickname: user.nickname || nickname, email: user.email, createdAt: new Date().toISOString() });
        setShowAccountSheet(false);
        onAuthChanged(true);
        if (accountMode === "login" && new URLSearchParams(window.location.search).get("auth") === "required") {
          const next = new URLSearchParams(window.location.search).get("next");
          window.location.assign(safeReturnPath(next));
        }
      }
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "账号操作失败");
    } finally {
      setAccountPending(false);
    }
  };

  const requestPasswordReset = async () => {
    const email = accountEmail.trim();
    if (!email) return setAccountError("请先填写邮箱");
    setAccountPending(true);
    const response = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const data = await response.json().catch(() => ({}));
    setAccountPending(false);
    if (response.ok) setAccountNotice(data.message || "如果账号存在，重置邮件已经发送。");
    else setAccountError(data.error || "暂时无法发送重置邮件");
  };

  const resendConfirmationEmail = async () => {
    const email = accountEmail.trim();
    if (!email) return setAccountError("请先填写邮箱");
    setAccountPending(true);
    setAccountError("");
    setAccountNotice("");
    const response = await fetch("/api/auth/resend-confirmation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await response.json().catch(() => ({}));
    setAccountPending(false);
    if (response.ok) setAccountNotice(data.message || "如果账号已注册，验证邮件已经重新发送。");
    else setAccountError(data.error || "暂时无法重新发送验证邮件");
  };

  const getRatingValue = (log: DrinkLog) => log.rating ?? 0;

  const formatDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatDisplayDate = (dateKey: string) => {
    const [year, month, day] = dateKey.split("-");
    return `${year}.${month}.${day}`;
  };

  const isFeaturedRecord = (log: DrinkLog) => log.isStarred || getRatingValue(log) >= 4.5;

  const recordsByDate = useMemo(() => {
    const grouped: Record<string, DrinkLog[]> = {};
    drinkLogs.forEach((log, index) => {
      const fallbackDate = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), Math.min(index + 1, 28));
      const key = log.drinkDate || formatDateKey(fallbackDate);
      grouped[key] = [...(grouped[key] || []), log];
    });
    return grouped;
  }, [drinkLogs, visibleMonth]);

  const calendarDays = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - startOffset);
    const todayKey = formatDateKey(new Date());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const key = formatDateKey(date);
      const records = recordsByDate[key] || [];
      return {
        key,
        date,
        day: date.getDate(),
        current: date.getMonth() === month,
        isToday: key === todayKey,
        records,
        hasFeatured: records.some(isFeaturedRecord),
      };
    });
  }, [recordsByDate, visibleMonth]);

  const currentMonthRecords = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    return drinkLogs.filter((log) => {
      const date = new Date(log.drinkDate || formatDateKey(visibleMonth));
      return date.getFullYear() === year && date.getMonth() === month;
    });
  }, [drinkLogs, visibleMonth]);

  const monthBestRecord = currentMonthRecords
    .slice()
    .sort((a, b) => getRatingValue(b) - getRatingValue(a))[0];
  const monthBestRating = monthBestRecord ? getRatingValue(monthBestRecord).toFixed(1) : "-";
  const selectedRecords = selectedDateKey ? recordsByDate[selectedDateKey] || [] : [];
  const selectedBestRating = selectedRecords.length
    ? Math.max(...selectedRecords.map(getRatingValue)).toFixed(1)
    : null;
  const highRatedDrinkLogs = useMemo(
    () => drinkLogs
      .filter((log) => getRatingValue(log) > 0)
      .slice()
      .sort((a, b) => getRatingValue(b) - getRatingValue(a) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [drinkLogs],
  );

  const changeMonth = (delta: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
    setSelectedDateKey(null);
  };

  const renderStars = (rating: number) => {
    const rounded = Math.round(rating);
    return "★★★★★".split("").map((star, index) => (
      <span key={index} className={index < rounded ? "text-neutral-950" : "text-neutral-300"}>
        {star}
      </span>
    ));
  };

  const listCategories: Array<{ id: ListCategory; label: string; icon: string }> = [
    { id: "all", label: "全部", icon: "view_list" },
    { id: "lab", label: "Lab", icon: "science" },
    { id: "convenience", label: "便利店", icon: "storefront" },
    { id: "classic", label: "经典酒", icon: "local_bar" },
  ];

  const getLogSourceType = (log: DrinkLog): ListCategory => {
    const source = `${log.sourcePage} ${log.recipeSnapshot?.sourcePage ?? ""}`.toLowerCase();
    if (source.includes("lab")) return "lab";
    if (source.includes("convenience")) return "convenience";
    if (source.includes("classic") || source.includes("flavor") || source.includes("inspiration")) return "classic";
    return "lab";
  };

  const getSavedSourceType = (cocktail: SavedCocktail): ListCategory => {
    const source = `${cocktail.sourcePage ?? ""} ${cocktail.id} ${cocktail.subtitle ?? ""} ${(cocktail.tags ?? []).join(" ")}`.toLowerCase();
    if (source.includes("lab")) return "lab";
    if (source.includes("convenience") || source.includes("便利店")) return "convenience";
    if (source.includes("classic") || source.includes("inspiration") || source.includes("经典") || source.includes("assistant") || source.includes("mood")) return "classic";
    return cocktail.ingredients?.length || cocktail.mixMethod ? "lab" : "classic";
  };

  const labDrinkLogs = drinkLogs.filter((log) => getLogSourceType(log) === "lab");
  const convenienceDrinkLogs = drinkLogs.filter((log) => getLogSourceType(log) === "convenience");
  const classicDrinkLogs = drinkLogs.filter((log) => getLogSourceType(log) === "classic");
  const drinkLogGroups: Record<ListCategory, DrinkLog[]> = {
    all: drinkLogs,
    lab: labDrinkLogs,
    convenience: convenienceDrinkLogs,
    classic: classicDrinkLogs,
  };
  const savedCocktailGroups: Record<ListCategory, SavedCocktail[]> = {
    all: savedCocktails,
    lab: savedCocktails.filter((cocktail) => getSavedSourceType(cocktail) === "lab"),
    convenience: savedCocktails.filter((cocktail) => getSavedSourceType(cocktail) === "convenience"),
    classic: savedCocktails.filter((cocktail) => getSavedSourceType(cocktail) === "classic"),
  };

  const renderCategoryTabs = (counts: Record<ListCategory, number>) => (
    <div className="grid grid-cols-4 gap-2">
      {listCategories.map((category) => {
        const active = activeListCategory === category.id;
        return (
          <button
            type="button"
            key={category.id}
            onClick={() => setActiveListCategory(category.id)}
            className={`min-h-[64px] cursor-pointer rounded-2xl border p-2 text-center active:scale-[0.98] ${
              active ? "border-neutral-950 bg-neutral-950 text-white" : "border-[#E8E8E8] bg-white text-neutral-600"
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">{category.icon}</span>
            <p className="mt-0.5 text-xs font-medium">{category.label}</p>
            <p className={`text-[10px] font-medium ${active ? "text-white/55" : "text-neutral-400"}`}>{counts[category.id]} 杯</p>
          </button>
        );
      })}
    </div>
  );

  const renderDrinkLogCard = (log: DrinkLog) => {
    const snapshot = log.recipeSnapshot;
    const rating = getRatingValue(log);
    const tags = (log.moodTags?.length ? log.moodTags : snapshot.tags ?? []).slice(0, 4);
    return (
      <article key={log.id} className="rounded-3xl border border-[#E8E8E8] bg-white p-4 shadow-none">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#E8E8E8] bg-[#f6f5f1]">
            {getLogSourceType(log) === "lab"
              ? <CocktailLineArt name={log.recipeName} className="h-full w-full" />
              : <CocktailIllustration id={snapshot.id || log.recipeId} name={log.recipeName} className="h-full w-full" sizes="48px" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h4 className="truncate text-base font-medium text-neutral-950">{log.recipeName}</h4>
                <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                  {snapshot.nameEn || log.sourcePage}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-[#f6f5f1] px-2.5 py-1 text-xs font-medium text-neutral-800">
                ★ {rating.toFixed(1)}
              </span>
            </div>
            <p className="mt-1 text-[11px] font-semibold text-neutral-500">
              {log.drinkDate} {log.drinkTime ? `· ${log.drinkTime}` : ""} · {log.isFinished ? "已喝完" : "没喝完"}
            </p>
          </div>
        </div>

        {log.note && (
          <div className="mt-3 rounded-2xl border border-[#ECECEC] bg-[#FCFCFB] p-3">
            <p className="text-[11px] font-medium text-neutral-400">心得</p>
            <p className="mt-1 text-sm leading-6 text-neutral-700">{log.note}</p>
          </div>
        )}

        {snapshot.ingredients?.length ? (
          <div className="mt-3 space-y-1.5 rounded-2xl bg-[#f6f5f1] p-3">
            {snapshot.ingredients.slice(0, 4).map((ingredient, index) => (
              <div key={`${ingredient.name}-${index}`} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-semibold text-neutral-600">{ingredient.name}</span>
                <span className="shrink-0 font-mono text-neutral-400">
                  {ingredient.amount}{ingredient.unit}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span key={tag} className="rounded-full border border-[#E8E8E8] bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-600">
                {tag}
              </span>
            ))}
          </div>
        )}
      </article>
    );
  };

  const renderSavedCocktailCard = (cocktail: SavedCocktail) => (
    <article key={cocktail.id} className="rounded-3xl border border-[#E8E8E8] bg-white p-4 shadow-none">
      {getSavedSourceType(cocktail) !== "lab" && <div className="mb-3 flex h-40 justify-center bg-[#fff]">
        <CocktailIllustration id={cocktail.recipeId || cocktail.id} name={cocktail.chineseName} className="h-full w-full" sizes="160px" />
      </div>}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-base font-medium text-neutral-950">{cocktail.chineseName}</h4>
          <p className="mt-0.5 truncate text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{cocktail.name}</p>
          {cocktail.subtitle && <p className="mt-2 line-clamp-2 text-xs leading-5 text-neutral-500">{cocktail.subtitle}</p>}
        </div>
        <span className="shrink-0 rounded-full bg-[#f6f5f1] px-2.5 py-1 text-xs font-medium text-neutral-800">
          ★ {(cocktail.ratingValue ?? 0).toFixed(1)}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-[#f6f5f1] p-3">
          <p className="text-[10px] font-medium text-neutral-400">基酒</p>
          <p className="mt-1 line-clamp-2 text-xs font-medium text-neutral-700">{cocktail.spirit}</p>
        </div>
        <div className="rounded-2xl bg-[#f6f5f1] p-3">
          <p className="text-[10px] font-medium text-neutral-400">搭配</p>
          <p className="mt-1 line-clamp-2 text-xs font-medium text-neutral-700">{cocktail.mixer}</p>
        </div>
      </div>

      {cocktail.comments && (
        <p className="mt-3 rounded-2xl border border-[#ECECEC] bg-[#FCFCFB] p-3 text-xs leading-5 text-neutral-600">
          {cocktail.comments}
        </p>
      )}

      {(cocktail.tags ?? []).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(cocktail.tags ?? []).slice(0, 4).map((tag) => (
            <span key={tag} className="rounded-full border border-[#E8E8E8] bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-600">
              {tag}
            </span>
          ))}
        </div>
      )}
    </article>
  );

  if (profileView === "drink-list" || profileView === "favorite-list") {
    const isDrinkList = profileView === "drink-list";
    const activeDrinkLogs = drinkLogGroups[activeListCategory];
    const activeSavedCocktails = savedCocktailGroups[activeListCategory];
    const counts = isDrinkList
      ? {
          all: drinkLogs.length,
          lab: drinkLogGroups.lab.length,
          convenience: drinkLogGroups.convenience.length,
          classic: drinkLogGroups.classic.length,
        }
      : {
          all: savedCocktails.length,
          lab: savedCocktailGroups.lab.length,
          convenience: savedCocktailGroups.convenience.length,
          classic: savedCocktailGroups.classic.length,
        };

    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-12">
        <div className="sticky top-0 z-20 -mx-5 border-b border-[#E8E8E8] bg-[#f6f5f1]/95 px-5 py-3 backdrop-blur">
          <button
            type="button"
            onClick={() => setProfileView("home")}
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-2xl border border-[#E8E8E8] bg-white px-3 text-sm font-medium text-neutral-700 active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            返回档案
          </button>
          <div className="mt-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-400">
              {isDrinkList ? "Drink List" : "Favorite List"}
            </p>
            <h2 className="mt-1 text-3xl font-serif text-neutral-950">{isDrinkList ? "我喝过的酒单" : "收藏酒单"}</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              {isDrinkList ? "按来源整理每一次记录，方便复盘哪类酒最适合你。" : "收藏过的配方会按来源归类，方便下次直接复刻。"}
            </p>
          </div>
        </div>

        {renderCategoryTabs(counts)}

        {isDrinkList ? (
          activeDrinkLogs.length > 0 ? (
            <div className="space-y-3">{activeDrinkLogs.map(renderDrinkLogCard)}</div>
          ) : (
            <div className="rounded-3xl border border-dashed border-[#DADAD6] bg-white p-6 text-center">
              <span className="material-symbols-outlined text-4xl text-neutral-300">local_bar</span>
              <p className="mt-2 text-sm font-medium text-neutral-700">这个类别还没有喝过记录。</p>
            </div>
          )
        ) : activeSavedCocktails.length > 0 ? (
          <div className="space-y-3">{activeSavedCocktails.map(renderSavedCocktailCard)}</div>
        ) : (
          <div className="rounded-3xl border border-dashed border-[#DADAD6] bg-white p-6 text-center">
            <span className="material-symbols-outlined text-4xl text-neutral-300">favorite</span>
            <p className="mt-2 text-sm font-medium text-neutral-700">这个类别还没有收藏。</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto pb-12">
      {/* Top Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-outline tracking-widest uppercase bg-surface-container px-2.5 py-1 rounded-sm">
            USER RECORDS
          </span>
          <div className="h-[1px] flex-grow bg-outline-variant/30"></div>
        </div>
        <h2 className="text-3xl font-serif text-primary">My 档案中心</h2>
      </div>

      {/* Account / User Info Segment */}
      <section className="relative overflow-hidden rounded-[24px] border border-[#E8E8E8] bg-white p-5 shadow-none">
        <div className="absolute inset-0 notebook-grid opacity-[0.025] pointer-events-none"></div>
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#E8E8E8] bg-[#f6f5f1]">
              {accountProfile ? (
                <span className="text-2xl font-medium text-neutral-950">{accountProfile.nickname.slice(0, 1).toUpperCase()}</span>
              ) : (
                <span className="material-symbols-outlined text-3xl text-neutral-500">person</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-400">账号档案</p>
              <h3 className="mt-1 truncate text-xl font-medium text-neutral-950">
                {accountProfile ? accountProfile.nickname : "登录后同步酒记"}
              </h3>
              <p className="mt-1 truncate text-xs font-semibold text-neutral-500">
                {accountProfile ? accountProfile.email : "保存你的调酒日记、收藏和评分"}
              </p>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-3xl font-medium text-neutral-950">{drinkLogs.length}</p>
            <p className="text-[10px] font-medium text-neutral-400">已喝记录</p>
          </div>
        </div>

        <div className="relative z-10 mt-4 grid grid-cols-2 gap-2.5">
          {accountProfile ? (
            <>
              <button
                onClick={() => openAccountSheet("profile")}
                className="h-11 cursor-pointer rounded-2xl border border-[#E8E8E8] bg-white text-sm font-medium text-neutral-700 hover:bg-[#f6f5f1] active:scale-[0.98]"
              >
                设置档案
              </button>
              <button
                onClick={onOpenSettings}
                className="h-11 cursor-pointer rounded-2xl bg-neutral-950 text-sm font-medium text-white hover:bg-neutral-800 active:scale-[0.98]"
              >
                设置
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => openAccountSheet("login")}
                className="h-11 cursor-pointer rounded-2xl border border-[#E8E8E8] bg-white text-sm font-medium text-neutral-700 hover:bg-[#f6f5f1] active:scale-[0.98]"
              >
                登录
              </button>
              <button
                onClick={() => openAccountSheet("register")}
                className="h-11 cursor-pointer rounded-2xl bg-neutral-950 text-sm font-medium text-white hover:bg-neutral-800 active:scale-[0.98]"
              >
                注册
              </button>
            </>
          )}
        </div>
      </section>

      {/* Membership slot reserved; enable only when real benefits and checkout exist. */}
      <section data-membership-slot hidden aria-hidden="true" />
      <button onClick={onOpenSettings} className="rounded-3xl border border-[#E8E8E8] bg-white p-5 text-left">
        <div className="flex items-center justify-between"><h3 className="text-base font-medium">我的口味</h3><span className="text-xs text-neutral-500">编辑 →</span></div>
        <p className="mt-3 text-sm leading-6 text-neutral-700">{tasteSummary(settings)}</p>
        <p className="mt-2 text-xs text-neutral-500">历史推荐{settings.useHistory ? '已开启' : '已关闭'} · 仅保存在当前浏览器</p>
      </button>

      {showAccountSheet && (
        <div className="fixed inset-0 z-[150] flex items-end justify-center px-3">
          <button
            className="absolute inset-0 cursor-pointer bg-black/30 backdrop-blur-[2px]"
            onClick={() => setShowAccountSheet(false)}
            aria-label="关闭账号设置"
          ></button>

          <div className="relative z-10 max-h-[calc(100dvh-1rem)] w-full max-w-[430px] overflow-y-auto rounded-t-[28px] border border-[#E8E8E8] bg-[#f6f5f1] shadow-none animate-in slide-in-from-bottom-8 fade-in duration-300">
            <div className="border-b border-[#E8E8E8] bg-white px-4 pb-4 pt-3">
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-neutral-300"></div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-400">Account Card</p>
                  <h3 className="mt-1 text-xl font-medium text-neutral-950">
                    {accountMode === "login" ? "登录 AlcheMix Lab" : accountMode === "profile" ? "设置账号档案" : "注册 AlcheMix Lab"}
                  </h3>
                  <p className="mt-1 text-sm leading-5 text-neutral-500">
                    像调酒日记一样，把你的酒记、收藏和评分留在自己的档案里。
                  </p>
                </div>
                <button
                  onClick={() => setShowAccountSheet(false)}
                  className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#E8E8E8] bg-white text-neutral-500"
                  title="关闭"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
            </div>

            <div className="space-y-4 px-4 py-4">
              <div className="rounded-3xl border border-[#E8E8E8] bg-white p-4 shadow-none">
                {accountMode !== "profile" && <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#f6f5f1] p-1">
                  <button
                    onClick={() => { setAccountMode("login"); setConfirmationEmailSent(false); setAccountError(""); }}
                    className={`h-10 cursor-pointer rounded-xl text-sm font-medium transition-all ${
                      accountMode === "login" ? "bg-white text-neutral-950 shadow-none" : "text-neutral-500"
                    }`}
                  >
                    登录
                  </button>
                  <button
                    onClick={() => { setAccountMode("register"); setConfirmationEmailSent(false); setAccountError(""); }}
                    className={`h-10 cursor-pointer rounded-xl text-sm font-medium transition-all ${
                      accountMode === "register" ? "bg-white text-neutral-950 shadow-none" : "text-neutral-500"
                    }`}
                  >
                    注册
                  </button>
                </div>}

                <div className="mt-4 space-y-3">
                  {(accountMode === "register" || accountMode === "profile") && (
                    <label className="block">
                      <span className="text-xs font-medium text-neutral-500">昵称</span>
                      <input
                        value={accountNickname}
                        onChange={(event) => setAccountNickname(event.target.value)}
                        placeholder="比如：Cedar Mix"
                        className="mt-1 h-12 w-full rounded-2xl border border-[#E8E8E8] bg-[#FCFCFB] px-3 text-sm font-semibold text-neutral-900 outline-none focus:border-neutral-950"
                      />
                    </label>
                  )}

                  {accountMode !== "profile" && <label className="block">
                    <span className="text-xs font-medium text-neutral-500">邮箱</span>
                    <input
                      value={accountEmail}
                      onChange={(event) => setAccountEmail(event.target.value)}
                      placeholder="you@example.com"
                      type="email"
                      className="mt-1 h-12 w-full rounded-2xl border border-[#E8E8E8] bg-[#FCFCFB] px-3 text-sm font-semibold text-neutral-900 outline-none focus:border-neutral-950"
                    />
                  </label>}
                  {accountMode === "login" && <button type="button" onClick={requestPasswordReset} disabled={accountPending} className="text-left text-xs font-medium text-neutral-500 underline underline-offset-4">忘记密码？发送重置邮件</button>}

                  {accountMode !== "profile" && <label className="block">
                    <span className="text-xs font-medium text-neutral-500">密码</span>
                    <input
                      value={accountPassword}
                      onChange={(event) => setAccountPassword(event.target.value)}
                      placeholder={accountMode === "login" ? "输入密码" : "设置密码"}
                      type="password"
                      className="mt-1 h-12 w-full rounded-2xl border border-[#E8E8E8] bg-[#FCFCFB] px-3 text-sm font-semibold text-neutral-900 outline-none focus:border-neutral-950"
                    />
                  </label>}

                  {accountMode === "register" && (
                    <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl border border-[#E8E8E8] bg-[#FCFCFB] p-3">
                      <input
                        type="checkbox"
                        checked={acceptedPolicies}
                        onChange={(event) => setAcceptedPolicies(event.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-neutral-950"
                      />
                      <span className="text-xs leading-5 text-neutral-600">
                        我已阅读并同意
                        <a href="/terms" target="_blank" rel="noreferrer" className="font-medium text-neutral-950 underline underline-offset-2">《用户协议》</a>
                        <a href="/privacy" target="_blank" rel="noreferrer" className="font-medium text-neutral-950 underline underline-offset-2">《隐私政策》</a>
                        和
                        <a href="/responsible-drinking" target="_blank" rel="noreferrer" className="font-medium text-neutral-950 underline underline-offset-2">《饮酒安全提示》</a>
                      </span>
                    </label>
                  )}
                </div>

                <div className="mt-4 rounded-2xl border border-[#ECECEC] bg-[#f6f5f1] p-3">
                  <p className="text-xs leading-5 text-neutral-500">账号由 Supabase Auth 安全验证。注册后可能需要先完成邮箱验证。</p>
                  {accountNotice && <p className="mt-2 text-xs font-semibold text-emerald-700">{accountNotice}</p>}
                  {confirmationEmailSent && (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
                      <p className="font-medium">验证邮件已发送</p>
                      <p>请打开邮箱中的链接完成验证，也请检查垃圾邮件目录。</p>
                      <button type="button" onClick={resendConfirmationEmail} disabled={accountPending} className="mt-2 font-medium underline underline-offset-4 disabled:opacity-50">
                        {accountPending ? "正在发送…" : "重新发送验证邮件"}
                      </button>
                    </div>
                  )}
                  {accountError && <p className="mt-2 text-xs font-semibold text-red-600">{accountError}</p>}
                </div>
              </div>
            </div>

            <div className="border-t border-[#E8E8E8] bg-white p-4">
              <button
                onClick={confirmationEmailSent ? () => { setAccountMode("login"); setConfirmationEmailSent(false); setAccountPassword(""); setAccountError(""); } : saveAccountProfile}
                disabled={!confirmationEmailSent && (accountMode === "profile" ? !accountNickname.trim() || accountPending : !accountEmail.trim() || !accountPassword || accountPending || (accountMode === "register" && !acceptedPolicies))}
                className={`h-[52px] w-full rounded-2xl text-sm font-medium active:scale-[0.98] ${
                  confirmationEmailSent || ((accountMode === "profile" ? accountNickname.trim() : accountEmail.trim() && accountPassword) && !accountPending && (accountMode !== "register" || acceptedPolicies))
                    ? "cursor-pointer bg-neutral-950 text-white shadow-none"
                    : "cursor-not-allowed bg-neutral-200 text-neutral-400"
                }`}
              >
                {confirmationEmailSent ? "我已完成验证，去登录" : accountPending ? "处理中…" : accountMode === "login" ? "登录并进入档案" : accountMode === "profile" ? "保存档案" : "注册并发送验证邮件"}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="order-2 rounded-3xl border border-[#E8E8E8] bg-white p-4 shadow-none">
        <button
          type="button"
          onClick={() => {
            setActiveListCategory("all");
            setProfileView("favorite-list");
          }}
          className="flex w-full cursor-pointer items-center justify-between gap-3 text-left active:scale-[0.99]"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#E8E8E8] bg-[#FFF8D8] text-yellow-700">
              <span className="material-symbols-outlined text-[24px]">favorite</span>
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-medium text-neutral-950">收藏酒单</h3>
              <p className="mt-1 text-xs leading-5 text-neutral-500">
                收藏过的 Lab、便利店特调、经典鸡尾酒
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full bg-[#f6f5f1] px-2.5 py-1 text-xs font-medium text-neutral-700">{savedCocktails.length} 杯</span>
            <span className="material-symbols-outlined text-[22px] text-neutral-400">chevron_right</span>
          </div>
        </button>
      </section>

      <section className="order-2 rounded-3xl border border-[#E8E8E8] bg-white p-4 shadow-none">
        <button
          type="button"
          onClick={() => {
            setActiveListCategory("all");
            setProfileView("drink-list");
          }}
          className="flex w-full cursor-pointer items-center justify-between gap-3 text-left active:scale-[0.99]"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-neutral-950 text-white">
              <span className="material-symbols-outlined text-[24px]">format_list_bulleted</span>
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-medium text-neutral-950">我喝过的酒单</h3>
              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Lab、便利店特调、经典鸡尾酒分开整理
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full bg-[#f6f5f1] px-2.5 py-1 text-xs font-medium text-neutral-700">{drinkLogs.length} 杯</span>
            <span className="material-symbols-outlined text-[22px] text-neutral-400">chevron_right</span>
          </div>
        </button>
      </section>

      {/* Section 1: 我的高分酒 (Ranked by drink log rating) */}
      <section className="space-y-4 order-2">
        <div className="flex justify-between items-baseline border-b border-outline-variant/20 pb-2">
          <h3 className="text-base font-serif text-on-surface">我的高分酒</h3>
          <span className="text-xs text-outline-variant uppercase">Rating Ranking</span>
        </div>

        {highRatedDrinkLogs.length === 0 ? (
          <div className="bg-surface-container-lowest p-8 rounded-2xl border border-dashed border-outline-variant/50 text-center space-y-3">
            <span className="material-symbols-outlined text-4xl text-outline-variant">local_bar</span>
            <p className="text-sm text-on-surface-variant font-light">
              还没有带评分的喝过记录。
            </p>
            <button
              onClick={onNavigateToLab}
              className="px-5 py-2.5 bg-primary text-on-primary text-xs font-medium uppercase tracking-wider rounded-lg hover:opacity-90"
            >
              去实验室记录一杯
            </button>
          </div>
        ) : (
          <div className="flex overflow-x-auto gap-4 pb-4 no-scrollbar">
            {highRatedDrinkLogs.slice(0, 12).map((log, index) => {
              const snapshot = log.recipeSnapshot;
              const rating = getRatingValue(log);
              const sourceType = getLogSourceType(log);
              const sourceLabel = sourceType === "lab" ? "LAB" : sourceType === "convenience" ? "便利店" : "经典酒";
              return (
              <div
                key={log.id}
                className="bg-white border border-outline-variant/30 rounded-xl p-5 relative flex-shrink-0 w-64 shadow-none flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <span className="text-[10px] font-mono font-medium text-outline-variant">
                    #{String(index + 1).padStart(2, "0")}
                  </span>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-medium text-on-surface line-clamp-1">{log.recipeName}</h4>
                      <div className="flex text-primary items-center">
                        <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>
                          star
                        </span>
                        <span className="text-xs ml-1 font-medium">{rating.toFixed(1)}</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-outline uppercase tracking-wider font-medium">
                      {snapshot.nameEn || sourceLabel}
                    </p>
                  </div>

                  <div className="flex gap-1.5 flex-wrap">
                    {(log.moodTags.length ? log.moodTags : snapshot.tags ?? []).slice(0, 2).map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 border border-outline-variant/30 text-[9px] font-medium uppercase tracking-wider text-on-surface-variant rounded bg-surface-container-low"
                      >
                        {t}
                      </span>
                    ))}
                    <span className="px-2 py-0.5 border border-outline-variant/30 text-[9px] font-medium uppercase tracking-wider text-on-surface-variant rounded bg-surface-container-low">
                      {sourceLabel}
                    </span>
                  </div>

                  <p className="text-xs italic text-on-surface-variant leading-relaxed font-light line-clamp-3 bg-surface-container-low/20 p-2 rounded-lg border border-outline-variant/15">
                    “{log.note || snapshot.description || "这杯还没有写心得。"}”
                  </p>
                </div>

                <div className="pt-4 border-t border-outline-variant/20 mt-4 text-[10px] font-mono text-outline-variant text-right">
                  DRANK ON {log.drinkDate}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Section 2: 调酒日历 (Journal-style calendar) */}
      <section className="space-y-4 order-3">
        <div className="space-y-1 border-b border-outline-variant/20 pb-3">
          <h3 className="text-xl font-medium text-on-surface">调酒日历</h3>
          <p className="text-sm text-on-surface-variant">记录每一杯实验结果。</p>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-2xl border border-[#E8E8E8] bg-white px-3 py-3 shadow-none">
            <p className="text-[10px] font-medium text-neutral-400">本月杯数</p>
            <p className="mt-1 text-lg font-medium text-neutral-950">{currentMonthRecords.length} 杯</p>
          </div>
          <div className="rounded-2xl border border-[#E8E8E8] bg-white px-3 py-3 shadow-none">
            <p className="text-[10px] font-medium text-neutral-400">最高评分</p>
            <p className="mt-1 text-lg font-medium text-neutral-950">{monthBestRating}</p>
          </div>
          <div className="rounded-2xl border border-[#E8E8E8] bg-white px-3 py-3 shadow-none min-w-0">
            <p className="text-[10px] font-medium text-neutral-400">本月最爱</p>
            <p className="mt-1 text-sm font-medium text-neutral-950 truncate">
              {monthBestRecord?.recipeName || "暂无"}
            </p>
          </div>
        </div>

        <div className="rounded-[24px] border border-[#E6E6E6] bg-white p-4 shadow-none relative overflow-hidden">
          <div className="absolute inset-0 notebook-grid opacity-[0.025] pointer-events-none"></div>
          <div className="relative z-10">
            <div className="mb-4 flex items-center justify-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full border border-neutral-300 bg-[#f6f5f1] shadow-inner"></span>
              <span className="h-2.5 w-2.5 rounded-full border border-neutral-300 bg-[#f6f5f1] shadow-inner"></span>
              <span className="h-[1px] flex-1 bg-neutral-100"></span>
            </div>

            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={() => changeMonth(-1)}
                className="h-9 w-9 rounded-full border border-[#E8E8E8] bg-white text-neutral-700 hover:bg-[#f6f5f1] active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                title="上个月"
              >
                <span className="material-symbols-outlined text-lg">chevron_left</span>
              </button>
              <h4 className="text-lg font-medium text-neutral-950">
                {visibleMonth.getFullYear()}年{visibleMonth.getMonth() + 1}月
              </h4>
              <button
                onClick={() => changeMonth(1)}
                className="h-9 w-9 rounded-full border border-[#E8E8E8] bg-white text-neutral-700 hover:bg-[#f6f5f1] active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                title="下个月"
              >
                <span className="material-symbols-outlined text-lg">chevron_right</span>
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1.5 text-center">
              {["一", "二", "三", "四", "五", "六", "日"].map((label) => (
                <span key={label} className="pb-1 text-[11px] font-medium text-neutral-400">
                  {label}
                </span>
              ))}
            </div>

            <div
              key={`${visibleMonth.getFullYear()}-${visibleMonth.getMonth()}`}
              className="grid grid-cols-7 gap-1.5 animate-in fade-in slide-in-from-right-1 duration-200"
            >
              {calendarDays.map((item) => {
                const recordCount = item.records.length;
                const selected = selectedDateKey === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => setSelectedDateKey(item.key)}
                    className={`relative min-h-[58px] rounded-xl border p-1.5 text-left transition-all active:scale-[0.96] cursor-pointer ${
                      selected
                        ? "bg-neutral-950 border-neutral-950 text-white shadow-none"
                        : item.isToday
                          ? "bg-white border-neutral-950 text-neutral-950"
                          : recordCount > 0
                            ? "bg-white border-neutral-300 text-neutral-950 shadow-none"
                            : "bg-[#FCFCFB] border-[#ECECEC] text-neutral-500 hover:border-neutral-300"
                    } ${!item.current ? "opacity-35" : ""}`}
                  >
                    {item.hasFeatured && (
                      <span className={`absolute right-1.5 top-1.5 text-[11px] leading-none ${selected ? "text-yellow-200" : "text-yellow-500"}`}>
                        ★
                      </span>
                    )}
                    <span className="block text-[12px] font-medium leading-none">{item.day}</span>
                    {recordCount > 0 && (
                      <span className={`mt-2 block text-[10px] font-medium ${selected ? "text-white/85" : "text-neutral-600"}`}>
                        {recordCount}杯
                      </span>
                    )}
                    {recordCount > 1 && (
                      <span className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5">
                        {Array.from({ length: Math.min(recordCount, 3) }).map((_, dotIndex) => (
                          <span
                            key={dotIndex}
                            className={`h-1 w-1 rounded-full ${selected ? "bg-white/75" : "bg-neutral-400"}`}
                          ></span>
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {selectedDateKey && (
        <div className="fixed inset-0 z-[130] flex items-end justify-center px-3">
          <button
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px] cursor-pointer"
            onClick={() => setSelectedDateKey(null)}
            aria-label="关闭日历详情"
          ></button>

          <div className="relative z-10 w-full max-w-[430px] max-h-[82vh] overflow-y-auto rounded-t-[28px] border border-[#E8E8E8] bg-[#f6f5f1] p-4 shadow-none animate-in slide-in-from-bottom-8 fade-in duration-300">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-neutral-300"></div>

            <div className="rounded-3xl border border-[#E8E8E8] bg-white p-4 shadow-none">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-xl font-medium text-neutral-950">{formatDisplayDate(selectedDateKey)}</h4>
                  <p className="mt-1 text-sm text-neutral-500">
                    {selectedRecords.length > 0
                      ? `今天记录了 ${selectedRecords.length} 杯实验`
                      : "这天还没有酒记。"}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDateKey(null)}
                  className="h-9 w-9 rounded-full border border-[#E8E8E8] bg-white text-neutral-500 hover:bg-[#f6f5f1] flex items-center justify-center cursor-pointer"
                  title="关闭"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              {selectedRecords.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-[#f6f5f1] border border-[#ECECEC] px-3 py-2">
                    <p className="text-[10px] font-medium text-neutral-400">今日最高分</p>
                    <p className="text-base font-medium text-neutral-950">{selectedBestRating}</p>
                  </div>
                  {selectedRecords.some(isFeaturedRecord) && (
                    <div className="rounded-2xl bg-[#FFF8D8] border border-[#FDE68A] px-3 py-2">
                      <p className="text-[10px] font-medium text-yellow-700">这天有一杯高分实验 ✦</p>
                      <p className="text-xs font-semibold text-neutral-700">值得再复刻一次</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-3 space-y-3">
              {selectedRecords.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-neutral-300 bg-white p-6 text-center shadow-none">
                  <span className="material-symbols-outlined text-4xl text-neutral-300">local_bar</span>
                  <p className="mt-3 text-base font-medium text-neutral-950">这天还没有酒记。</p>
                  <p className="mt-1 text-sm text-neutral-500">要不要记录一杯新的实验结果？</p>
                  <button
                    onClick={() => {
                      setSelectedDateKey(null);
                      onNavigateToLab();
                    }}
                    className="mt-5 h-11 px-5 rounded-2xl bg-neutral-950 text-white text-sm font-medium hover:bg-neutral-800 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    记录一杯
                  </button>
                </div>
              ) : (
                selectedRecords.map((log) => {
                  const rating = getRatingValue(log);
                  const snapshot = log.recipeSnapshot;
                  return (
                    <article
                      key={log.id}
                      className="rounded-3xl border border-[#E8E8E8] bg-white p-4 shadow-none"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-12 w-12 shrink-0 rounded-2xl border border-[#E8E8E8] bg-[#f6f5f1] flex items-center justify-center text-neutral-700">
                          <span className="material-symbols-outlined text-2xl">local_bar</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h5 className="text-base font-medium text-neutral-950 truncate">{log.recipeName}</h5>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400 truncate">
                                {snapshot.nameEn || log.sourcePage}
                              </p>
                            </div>
                            {isFeaturedRecord(log) && (
                              <span className="rounded-full border border-[#FDE68A] bg-[#FFF8D8] px-2 py-1 text-[10px] font-medium text-yellow-700">
                                ★
                              </span>
                            )}
                          </div>

                          <div className="mt-2 flex items-center gap-1 text-xs font-medium">
                            <span className="tracking-[-0.08em]">{renderStars(rating)}</span>
                            <span className="ml-1 text-neutral-800">{rating.toFixed(1)}</span>
                          </div>
                          <p className="mt-1 text-xs font-semibold text-neutral-500">
                            {log.isFinished ? "已喝完" : "没喝完"} · {log.isStarred ? "已星标" : log.isFavorite ? "已收藏" : "未星标"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl border border-[#ECECEC] bg-[#FCFCFB] p-3">
                        <p className="text-[11px] font-medium text-neutral-400">心得：</p>
                        <p className="mt-1 text-sm leading-6 text-neutral-700">
                          {log.note || "这杯还没有写心得。"}
                        </p>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {((log.moodTags?.length ? log.moodTags : snapshot.tags) ?? ["清爽", "低酒感"]).slice(0, 4).map((tag: string) => (
                          <span
                            key={tag}
                            className="rounded-full border border-[#E8E8E8] bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-600"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      <button className="mt-4 h-10 w-full rounded-2xl border border-neutral-900 bg-white text-sm font-medium text-neutral-950 hover:bg-neutral-950 hover:text-white active:scale-[0.98] transition-all cursor-pointer">
                        查看配方
                      </button>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {drinkLogs.length > 0 && (
        <section className="space-y-4 order-2">
          <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
            <h3 className="text-base font-serif text-on-surface">最近喝过</h3>
            <span className="text-[10px] font-mono text-outline-variant uppercase">Drink Logs</span>
          </div>
          <div className="space-y-2.5">
            {drinkLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="rounded-2xl border border-[#E8E8E8] bg-white p-3 shadow-none">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-950">{log.recipeName}</p>
                    <p className="mt-0.5 text-[11px] text-neutral-400">{log.drinkDate} · {log.isFinished ? "已喝完" : "没喝完"}</p>
                  </div>
                  <div className="shrink-0 rounded-full bg-[#f6f5f1] px-2.5 py-1 text-xs font-medium text-neutral-800">
                    ★ {log.rating.toFixed(1)}
                  </div>
                </div>
                {log.note && <p className="mt-2 line-clamp-2 text-xs leading-5 text-neutral-500">{log.note}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {drinkLogs.some((log) => log.isFavorite) && (
        <section className="space-y-4 order-2">
          <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
            <h3 className="text-base font-serif text-on-surface">我的收藏</h3>
            <span className="text-[10px] font-mono text-outline-variant uppercase">Favorites</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
            {drinkLogs.filter((log) => log.isFavorite).slice(0, 8).map((log) => (
              <div key={log.id} className="w-44 shrink-0 rounded-2xl border border-[#E8E8E8] bg-white p-3 shadow-none">
                <p className="line-clamp-2 text-sm font-medium text-neutral-950">{log.recipeName}</p>
                <p className="mt-2 text-xs font-medium text-neutral-500">★ {log.rating.toFixed(1)}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(log.moodTags.length ? log.moodTags : log.recipeSnapshot.tags ?? []).slice(0, 2).map((tag) => (
                    <span key={tag} className="rounded-full bg-[#f6f5f1] px-2 py-0.5 text-[10px] font-medium text-neutral-500">{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}


    </div>
  );
}
