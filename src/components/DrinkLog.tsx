import { fetchFavorites,saveFavorite,removeFavorite,snapshotFavorite,FAVORITES_CHANGED } from '../lib/recipes/favorites-client';
import { canonicalRecipeId as stableRecipeId } from '../lib/recipes/canonical';
import CocktailLineArt from "./CocktailLineArt";
import CocktailIllustration from "./CocktailIllustration";
import React, { useState, useEffect, useRef } from "react";
import { DrinkLog, DrinkLogRecipeSnapshot, DrinkLogTasteScores } from "../types";

const defaultTasteScores: DrinkLogTasteScores = {
  sweetness: 0,
  acidity: 0,
  alcohol_intensity: 0,
  bitterness: 0,
  freshness: 0,
  fruitiness: 0,
  smoothness: 0,
};

const tasteScoreFields: { key: keyof DrinkLogTasteScores; label: string }[] = [
  { key: "sweetness", label: "甜度" },
  { key: "acidity", label: "酸度" },
  { key: "alcohol_intensity", label: "酒感" },
  { key: "bitterness", label: "苦味" },
  { key: "freshness", label: "清爽度" },
  { key: "fruitiness", label: "果香" },
  { key: "smoothness", label: "顺口度" },
];

const moodTags = ["放松", "微醺", "清爽", "甜", "酸", "苦", "顺口", "有点烈", "想再喝", "不会再喝", "适合聚会", "适合独饮"];

const todayKey = () => new Date().toISOString().split("T")[0];
const nowTime = () => new Date().toTimeString().slice(0, 5);

interface DrinkLogModalProps {
  recipe: DrinkLogRecipeSnapshot;
  sourcePage: string;
  existingLog?: DrinkLog;
  onClose: () => void;
  onSaved: (log: DrinkLog) => void | Promise<void>;
}

export function DrinkLogModal({ recipe, sourcePage, existingLog, onClose, onSaved }: DrinkLogModalProps) {
  const [isFinished, setIsFinished] = useState(existingLog?.isFinished ?? true);
  const [rating, setRating] = useState(existingLog?.rating ?? 0);
  const [tasteScores, setTasteScores] = useState<DrinkLogTasteScores>(existingLog?.tasteScores ?? defaultTasteScores);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteId,setFavoriteId]=useState<string|null>(null),[favoriteBusy,setFavoriteBusy]=useState(true),[favoriteError,setFavoriteError]=useState('');
  const favoriteVersion=useRef(0);
  useEffect(()=>{let active=true;setFavoriteBusy(true);const load=()=>{const version=++favoriteVersion.current;fetchFavorites().then(rows=>{if(!active||version!==favoriteVersion.current)return;const found=rows.find(r=>stableRecipeId(r.recipeId||r.id)===stableRecipeId(recipe.id));setFavoriteId(found?.id||null);setIsFavorite(Boolean(found));}).catch(e=>{if(active&&version===favoriteVersion.current)setFavoriteError(e.message);}).finally(()=>{if(active&&version===favoriteVersion.current)setFavoriteBusy(false);});};load();window.addEventListener(FAVORITES_CHANGED,load);return()=>{active=false;window.removeEventListener(FAVORITES_CHANGED,load);};},[recipe.id]);
  async function toggleFavorite(){favoriteVersion.current++;setFavoriteBusy(true);setFavoriteError('');try{if(favoriteId){await removeFavorite(favoriteId);setFavoriteId(null);setIsFavorite(false);}else{const saved=await saveFavorite(snapshotFavorite(recipe,sourcePage));setFavoriteId(saved.id);setIsFavorite(true);}}catch(e){setFavoriteError(e instanceof Error?e.message:'收藏失败');}finally{setFavoriteBusy(false);}}

  const [isStarred, setIsStarred] = useState(existingLog?.isStarred ?? false);
  const [note, setNote] = useState(existingLog?.note ?? "");
  const [selectedMoodTags, setSelectedMoodTags] = useState<string[]>(existingLog?.moodTags ?? []);

  const toggleMood = (tag: string) => {
    setSelectedMoodTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);
  };

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const savingRef = useRef(false);
  const save = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError('');
    const now = new Date().toISOString();
    const log: DrinkLog = {
      id: existingLog?.id ?? `drink-log-${Date.now()}`,
      userId: existingLog?.userId ?? "local-user",
      recipeId: recipe.id,
      recipeName: recipe.nameZh,
      recipeSnapshot: recipe,
      drinkDate: existingLog?.drinkDate ?? todayKey(),
      drinkTime: existingLog?.drinkTime ?? nowTime(),
      rating,
      tasteScores,
      note,
      isFinished,
      isFavorite,
      isStarred,
      moodTags: selectedMoodTags,
      imageUrl: recipe.imageUrl,
      sourcePage,
      createdAt: existingLog?.createdAt ?? now,
      updatedAt: now,
    };
    try { await onSaved(log); }
    catch (error) { setSaveError(error instanceof Error ? error.message : '保存失败，请重试'); }
    finally { savingRef.current = false; setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-end justify-center px-3">
      <button type="button" className="absolute inset-0 cursor-pointer bg-black/35 backdrop-blur-[2px]" disabled={saving} onClick={onClose} aria-label="取消记录" />

      <div className="relative z-10 flex max-h-[88vh] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[28px] border border-[#E8E8E8] bg-white shadow-none animate-in slide-in-from-bottom-8 fade-in duration-300">
        <div className="shrink-0 border-b border-[#EFEFEC] bg-white px-4 pb-3 pt-3">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-neutral-300"></div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-400">实验记录卡</p>
              <h3 className="mt-1 text-xl font-medium text-neutral-950">记录这杯实验</h3>
              <p className="mt-1 text-sm leading-5 text-neutral-500">喝完之后，给这杯酒留下一点真实反馈。</p>
            </div>
            <button type="button" disabled={saving} onClick={onClose} className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#E8E8E8] bg-white text-neutral-500 active:scale-[0.98]">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#f6f5f1] px-4 py-4">
          <section className="rounded-3xl border border-[#E8E8E8] bg-white p-4 shadow-none">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#E8E8E8] bg-[#f6f5f1]">
                {sourcePage.includes("lab")
                  ? <CocktailLineArt name={recipe.nameZh} className="h-full w-full" />
                  : <CocktailIllustration id={recipe.id} name={recipe.nameZh} className="h-full w-full" sizes="56px" />}
              </div>
              <div className="min-w-0">
                <h4 className="truncate text-base font-medium text-neutral-950">{recipe.nameZh}</h4>
                {recipe.nameEn && <p className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">{recipe.nameEn}</p>}
                {recipe.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-500">{recipe.description}</p>}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-[#E8E8E8] bg-white p-4">
            <p className="text-sm font-medium text-neutral-950">是否喝完</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { value: true, label: "喝完了" },
                { value: false, label: "没喝完" },
              ].map((item) => (
                <button
                  type="button"
                  key={item.label}
                  onClick={() => setIsFinished(item.value)}
                  className={`h-10 cursor-pointer rounded-2xl border text-sm font-medium active:scale-[0.98] ${isFinished === item.value ? "border-neutral-950 bg-neutral-950 text-white" : "border-[#E8E8E8] bg-white text-neutral-600"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-[#E8E8E8] bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-neutral-950">总体评分</p>
              <p className="text-sm font-medium text-neutral-700">{rating.toFixed(1)}</p>
            </div>
            <div className="mt-3 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  type="button"
                  key={score}
                  onClick={() => setRating(score)}
                  onDoubleClick={() => setRating(Math.max(0.5, score - 0.5))}
                  className={`cursor-pointer text-3xl leading-none active:scale-90 ${score <= Math.round(rating) ? "text-neutral-950" : "text-neutral-200"}`}
                  title="双击可减半星"
                >
                  ★
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-neutral-400">提示：双击星星可记录半星，例如 4.5。</p>
          </section>

          <section className="rounded-3xl border border-[#E8E8E8] bg-white p-4">
            <p className="text-sm font-medium text-neutral-950">口味打分</p>
            <div className="mt-3 space-y-3">
              {tasteScoreFields.map((field) => (
                <div key={field.key} className="flex items-center justify-between gap-3">
                  <span className="w-16 text-sm font-semibold text-neutral-600">{field.label}</span>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        type="button"
                        key={score}
                        onClick={() => setTasteScores((current) => ({ ...current, [field.key]: score }))}
                        className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border transition-all active:scale-90 ${
                          score <= (tasteScores[field.key] ?? 0)
                            ? "border-neutral-950 bg-neutral-950"
                            : "border-neutral-200 bg-[#f6f5f1] hover:border-neutral-300"
                        }`}
                        aria-label={`${field.label} ${score}分`}
                      >
                        <span className={`h-2.5 w-2.5 rounded-full ${score <= (tasteScores[field.key] ?? 0) ? "bg-white" : "bg-neutral-300"}`}></span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-[#E8E8E8] bg-white p-4">
            {favoriteError&&<p role="alert" className="mb-2 text-xs text-red-700">{favoriteError}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={favoriteBusy}
                onClick={()=>void toggleFavorite()}
                className={`h-11 cursor-pointer rounded-2xl border text-sm font-medium active:scale-[0.98] ${isFavorite ? "border-neutral-950 bg-neutral-950 text-white" : "border-[#E8E8E8] bg-white text-neutral-700"}`}
              >
                {favoriteBusy?"处理中…":isFavorite ? "已收藏" : "收藏这杯"}
              </button>
              <button
                type="button"
                onClick={() => setIsStarred((value) => !value)}
                className={`h-11 cursor-pointer rounded-2xl border text-sm font-medium active:scale-[0.98] ${isStarred ? "border-[#FDE68A] bg-[#FFF8D8] text-yellow-700" : "border-[#E8E8E8] bg-white text-neutral-700"}`}
              >
                设为本日最佳
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-[#E8E8E8] bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <label htmlFor="drink-log-note" className="text-sm font-medium text-neutral-950">喝后心得</label>
                <p className="mt-1 text-[11px] leading-5 text-neutral-400">可以写入口感、酒感、下次想怎么调整。</p>
              </div>
              <span className="material-symbols-outlined text-[20px] text-neutral-300">edit_note</span>
            </div>
            <textarea
              id="drink-log-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="比如：西柚味很明显，酒感不重，但后味有一点苦，下次可以多加一点苏打。"
              className="mt-3 min-h-[128px] w-full resize-none rounded-2xl border border-[#E8E8E8] bg-[#FCFCFB] p-3 text-sm leading-6 text-neutral-800 outline-none placeholder:text-neutral-400 focus:border-neutral-950"
            />
          </section>

          <section className="rounded-3xl border border-[#E8E8E8] bg-white p-4">
            <p className="text-sm font-medium text-neutral-950">心情标签</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {moodTags.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  onClick={() => toggleMood(tag)}
                  className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium active:scale-[0.98] ${selectedMoodTags.includes(tag) ? "border-neutral-950 bg-neutral-950 text-white" : "border-[#E8E8E8] bg-white text-neutral-600"}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="shrink-0 border-t border-[#EFEFEC] bg-white p-4">
          <p role="alert" className="mb-2 text-sm text-red-700 empty:hidden">{saveError}</p>
          <button type="button" disabled={saving} onClick={save} className="h-[52px] w-full cursor-pointer rounded-2xl bg-neutral-950 text-sm font-medium text-white shadow-none active:scale-[0.98]">
            {saving ? "保存中…" : "保存到酒记"}
          </button>
          <button type="button" disabled={saving} onClick={onClose} className="mt-2 h-10 w-full cursor-pointer rounded-2xl text-sm font-medium text-neutral-500 active:scale-[0.98]">
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

interface DrinkLogButtonProps {
  recipe: DrinkLogRecipeSnapshot;
  sourcePage: string;
  drinkLogs: DrinkLog[];
  onSaveDrinkLog: (log: DrinkLog) => void | Promise<void>;
  variant?: "text" | "compact" | "icon";
  className?: string;
}

export function DrinkLogButton({ recipe, sourcePage, drinkLogs, onSaveDrinkLog, variant = "text", className = "" }: DrinkLogButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const handleSaved = async (log: DrinkLog) => {
    await onSaveDrinkLog(log);
    setJustSaved(true);
    setIsOpen(false);
    window.setTimeout(() => setJustSaved(false), 1800);
  };

  const label = justSaved ? "已保存到酒记" : "记录这一杯";
  const icon = justSaved ? "check_circle" : "local_bar";

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`${variant === "icon" ? "h-9 w-9 rounded-full px-0" : variant === "compact" ? "h-9 rounded-full px-3 text-[11px]" : "h-10 rounded-2xl px-4 text-xs"} inline-flex cursor-pointer items-center justify-center gap-1.5 border font-medium active:scale-[0.98] transition-all ${
          justSaved
            ? "border-neutral-950 bg-neutral-950 text-white"
            : "border-[#E8E8E8] bg-white text-neutral-700 hover:border-neutral-300 hover:bg-[#f6f5f1]"
        } ${className}`}
      >
        <span className="material-symbols-outlined text-[16px]">{icon}</span>
        {variant !== "icon" && <span>{label}</span>}
      </button>
      {isOpen && (
        <DrinkLogModal
          recipe={recipe}
          sourcePage={sourcePage}
          onClose={() => setIsOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
