import { AssistantSurface } from "./assistant/AssistantProvider";
import { recipeContext } from "../lib/agent/workflow-catalog";
import { classify, GuideDrink } from "../lib/recommendations/beginner";
import CocktailIllustration from "./CocktailIllustration";
import React, { useMemo, useState, useEffect } from "react";
import { DrinkLog, DrinkLogRecipeSnapshot, MixTip } from "../types";
import { INSPIRATION_RECIPES, RecipeSeed } from "../lib/data/inspiration-catalog";
import { trackAnalyticsEvent } from "../lib/analytics";
import { DrinkLogButton } from "./DrinkLog";
import { 
  Sparkles, 
  Flame, 
  Compass, 
  Wine, 
  HelpCircle, 
  Info, 
  ArrowRight, 
  TrendingDown, 
  Heart, 
  Smile, 
  Coffee, 
  Store, 
  Database,
  BookOpen,
  Search,
  Sparkle,
  Droplets,
  Zap,
  Activity,
  Maximize2
} from "lucide-react";

type InspirationView = "menu" | "classic-remix" | "convenience-mix" | "flavor" | "beginner" | "knowledge";

interface InspirationScreenProps {
  guided?: boolean;
  onBackGuide?: () => void;
  tips: MixTip[];
  onAddTip: (tip: MixTip) => void;
  onSaveCocktail?: (cocktail: any) => Promise<void>;
  drinkLogs?: DrinkLog[];
  onSaveDrinkLog?: (log: DrinkLog) => void | Promise<void>;
  onLoadToLab?: (ingredients: any[], mixMethod: "Stir" | "Shake") => void;
  initialView?: InspirationView;
  initialCocktailId?: string;
  initialExploreTab?: ExploreTab;
}

import { canonicalConvenienceId, ClassicCocktailData, CLASSIC_DATABASE, directionOptions, ExploreTab, InspirationCocktail, ConvenienceRecipeGuide, getCocktailMvpMeta, convenienceCategories, classicCategories, curatedClassicExploreCocktails, curatedConvenienceExploreCocktails, convenienceRecipeGuides, exploreImagePool, simpleSlug, normalizeClassicCocktailId, dedupeCocktails, actualClassicSeeds, classicTemplateBases, classicTemplateStyles, generatedClassicCocktails, actualClassicCocktails, classicExploreCocktails, convenienceSpiritOptions, convenienceMixerOptions, generatedConvenienceCocktails, convenienceExploreCocktails, BEGINNER_CATALOG, getConvenienceRecipeGuide } from "../lib/data/explore-catalog";
export { BEGINNER_CATALOG } from "../lib/data/explore-catalog";

function CocktailImage({ cocktail }: { cocktail: InspirationCocktail }) {
  return <div className="cocktail-plate"><CocktailIllustration id={cocktail.id} name={`${cocktail.nameZh} ${cocktail.nameEn}`} /><span className="eyebrow" aria-hidden="true">ALCHEMIX / RECIPE</span></div>;
}

const exploreCocktailToDrinkLogSnapshot = (cocktail: InspirationCocktail): DrinkLogRecipeSnapshot => ({
  id: cocktail.id,
  nameZh: cocktail.nameZh,
  nameEn: cocktail.nameEn,
  description: cocktail.description,
  imageUrl: cocktail.imageUrl,
  tags: [cocktail.category, ...cocktail.tags],
  sourcePage: cocktail.href.includes("convenience-mix") ? "convenience_mix" : cocktail.href.includes("classic-remix") ? "classic_remix" : "flavor",
});

const inspirationRecipeToDrinkLogSnapshot = (recipe: any): DrinkLogRecipeSnapshot => {
  const ingredients = recipe.ingredients ?? [];
  return {
    id: String(recipe.slug ?? recipe.id ?? recipe.titleEn ?? recipe.nameEn),
    nameZh: recipe.nameCn ?? recipe.titleCn ?? "未命名配方",
    nameEn: recipe.nameEn ?? recipe.titleEn,
    description: recipe.description,
    tags: recipe.tags?.map((item: any) => item.tag?.nameCn ?? item).filter(Boolean) ?? [],
    ingredients: ingredients.map((item: any) => ({
      name: item.ingredientNameCn ?? item.nameCn ?? item.nameSnapshot ?? item.name ?? "材料",
      amount: item.amount ?? item.amountMl,
      unit: item.unit ?? "ml",
    })),
    method: recipe.method,
  };
};

const hasDrinkLogForExploreCocktail = (cocktail: InspirationCocktail, drinkLogs: DrinkLog[]) => {
  const possibleRecipeIds = new Set([
    cocktail.id,
    `classic-original-${cocktail.id}`,
    `classic-remix-${cocktail.id}-custom`,
  ]);
  const nameZh = cocktail.nameZh.trim().toLowerCase();
  const nameEn = cocktail.nameEn.trim().toLowerCase();

  return drinkLogs.some((log) => {
    const snapshot = log.recipeSnapshot;
    return (
      possibleRecipeIds.has(log.recipeId) ||
      possibleRecipeIds.has(snapshot?.id ?? "") ||
      log.recipeName.trim().toLowerCase() === nameZh ||
      snapshot?.nameZh?.trim().toLowerCase() === nameZh ||
      snapshot?.nameEn?.trim().toLowerCase() === nameEn
    );
  });
};

export default function InspirationScreen({ tips, onAddTip, onSaveCocktail, drinkLogs = [], onSaveDrinkLog, onLoadToLab, initialView, initialCocktailId = "", initialExploreTab, guided = false, onBackGuide }: InspirationScreenProps) {
  const [view, setView] = useState<InspirationView>(initialView ?? "menu");
  const [loadedRecipes, setLoadedRecipes] = useState<RecipeSeed[]>([]);
  const [recipeSource, setRecipeSource] = useState<string>("local");
  const [classicVariantMatches, setClassicVariantMatches] = useState<any[]>([]);
  const [classicVariantSource, setClassicVariantSource] = useState<string>("local");
  const [showCatalogModal, setShowCatalogModal] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [guideActive, setGuideActive] = useState(guided);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    if (initialView && initialView !== "menu") return;
    const saved = sessionStorage.getItem("alchemix_guide_return");
    if (saved === "classic" || saved === "convenience") {
      setGuideActive(true);
      setExploreTab(saved);
      sessionStorage.removeItem("alchemix_guide_return");
    }
  }, [initialView]);
  const [exploreTab, setExploreTab] = useState<ExploreTab>(initialExploreTab ?? "convenience");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [routeCocktailId, setRouteCocktailId] = useState<string>(initialCocktailId);

  // Classic selection states
  const [selectedClassicId, setSelectedClassicId] = useState<string>(
    initialCocktailId ? normalizeClassicCocktailId(initialCocktailId) : "negroni",
  );
  const [selectedDirections, setSelectedDirections] = useState<string[]>([]);
  
  // Real-time calculation and its simulation state
  const [isRecalculating, setIsRecalculating] = useState<boolean>(false);
  const [activeDirections, setActiveDirections] = useState<string[]>([]);
  const isClassicDirectDetail = view === "classic-remix" && Boolean(initialCocktailId);

  const filteredExploreCocktails = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const activeCocktails = exploreTab === "convenience" ? convenienceExploreCocktails : classicExploreCocktails;
    return activeCocktails.filter((cocktail) => {
      const categoryMatched = selectedCategory === "全部"
        || cocktail.category === selectedCategory
        || cocktail.baseSpirit === selectedCategory
        || cocktail.tags.includes(selectedCategory);
      if (!categoryMatched) return false;
      if (!query) return true;

      const text = [
        cocktail.nameZh,
        cocktail.nameEn,
        cocktail.description,
        cocktail.category,
        ...cocktail.tags,
        ...cocktail.ingredients,
      ].join(" ").toLowerCase();
      return text.includes(query);
    });
  }, [exploreTab, searchQuery, selectedCategory]);

  const guidedCocktails = useMemo(() => [...filteredExploreCocktails].sort((a, b) => {
    const aMeta = getCocktailMvpMeta(a, exploreTab);
    const bMeta = getCocktailMvpMeta(b, exploreTab);
    return aMeta.difficulty - bMeta.difficulty || a.ingredients.length - b.ingredients.length;
  }), [filteredExploreCocktails, exploreTab]);
  const visibleCocktails = guideActive && !showAll ? guidedCocktails.slice(0, 3) : filteredExploreCocktails;

  useEffect(() => {
    setSelectedCategory("全部");
    setSearchInput("");
    setSearchQuery("");
  }, [exploreTab]);

  useEffect(() => {
    if (initialCocktailId) { setRouteCocktailId(initialCocktailId); return; }
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setRouteCocktailId(params.get("cocktail") ?? "");
  }, [initialCocktailId]);

  useEffect(() => {
    if (view !== "classic-remix" || !initialCocktailId) return;
    const nextClassicId = normalizeClassicCocktailId(initialCocktailId);
    setSelectedClassicId(nextClassicId);
    setRouteCocktailId(initialCocktailId);
  }, [view, initialCocktailId]);

  const menuItems = [
    {
      id: "classic-remix" as InspirationView,
      title: "经典酒改良器",
      desc: "把经典鸡尾酒改成更清爽、更顺口、更适合新手的版本。",
      path: "/inspiration/classic-remix",
      icon: Wine,
      type: "classic_variant",
    },
    {
      id: "convenience-mix" as InspirationView,
      title: "便利店特调灵感",
      desc: "用便利店能买到的啤酒、果汁、汽水、茶饮做简单好喝的特调。",
      path: "/inspiration/convenience-mix",
      icon: Store,
      type: "convenience",
    },
    {
      id: "flavor" as InspirationView,
      title: "按口味找酒",
      desc: "按酸甜、清爽、果香、低酒感等方向寻找配方。",
      path: "/inspiration/flavor",
      icon: Sparkles,
      type: "flavor",
    },
    {
      id: "beginner" as InspirationView,
      title: "小白入门酒单",
      desc: "低失败率、不苦不烈、材料容易买到的入门酒单。",
      path: "/inspiration/beginner",
      icon: Smile,
      type: "beginner",
    },
    {
      id: "knowledge" as InspirationView,
      title: "经典鸡尾酒知识库",
      desc: "了解经典鸡尾酒的来源、风味结构和基础配方。",
      path: "/inspiration/knowledge",
      icon: Compass,
      type: "classic",
    },
  ];

  const handleViewChange = (nextView: InspirationView) => {
    setView(nextView);
    if (typeof window !== "undefined") {
      const suffix = nextView === "menu" ? "/inspiration" : `/inspiration/${nextView}`;
      window.history.replaceState(null, "", `#${suffix}`);
    }
  };

  const goBackToInspiration = () => {
    if (new URLSearchParams(window.location.search).get("from") === "materials") {
      window.location.href = "/?from=materials";
      return;
    }
    if (sessionStorage.getItem("alchemix_beginner_detail") === "1") {
      sessionStorage.removeItem("alchemix_beginner_detail");
      window.location.href = "/";
      return;
    }
    if (initialView && typeof window !== "undefined") {
      const tab = initialView === "classic-remix" ? "classic" : "convenience";
      window.location.href = `/inspiration?tab=${tab}`;
      return;
    }
    if (view === "classic-remix") {
      setExploreTab("classic");
    }
    handleViewChange("menu");
  };

  useEffect(() => {
    if (initialView) return;
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace("#/inspiration/", "").replace("#/inspiration", "");
    const nextView = hash && ["classic-remix", "convenience-mix", "flavor", "beginner", "knowledge"].includes(hash)
      ? hash as InspirationView
      : "menu";
    setView(nextView);
  }, [initialView]);

  useEffect(() => {
    if (view !== "menu" || typeof window === "undefined") return;
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "classic" || tab === "convenience") {
      setExploreTab(tab);
    }
  }, [view]);

  useEffect(() => {
    if (view === "menu" || view === "classic-remix") return;
    const typeByView: Record<Exclude<InspirationView, "menu" | "classic-remix">, string> = {
      "convenience-mix": "convenience",
      flavor: "convenience",
      beginner: "beginner",
      knowledge: "classic",
    };
    const type = typeByView[view];
    fetch(`/api/inspiration/recipes?type=${type}&limit=36`)
      .then((res) => res.json())
      .then((data) => {
        setRecipeSource(data.source ?? "database");
        setLoadedRecipes(data.recipes ?? []);
      })
      .catch(() => {
        setRecipeSource("local");
        setLoadedRecipes(
          INSPIRATION_RECIPES
            .filter((recipe) => recipe.type === type)
            .slice(0, 36),
        );
      });
  }, [view]);

  useEffect(() => {
    if (view !== "classic-remix" || activeDirections.length === 0) {
      setClassicVariantMatches([]);
      return;
    }
    const classicSlug = selectedClassicId.replace(/_/g, "-");
    const selectedLabels = activeDirections
      .map((id) => directionOptions.find((option) => option.id === id)?.label)
      .filter(Boolean)
      .join(",");
    fetch(`/api/inspiration/classic-remix?classic=${classicSlug}&tags=${encodeURIComponent(selectedLabels)}`)
      .then((res) => res.json())
      .then((data) => {
        setClassicVariantSource(data.source ?? "database");
        setClassicVariantMatches(data.variants ?? []);
      })
      .catch(() => {
        const local = INSPIRATION_RECIPES
          .filter((recipe) => recipe.type === "classic_variant")
          .filter((recipe) => recipe.slug.startsWith(`variant-${classicSlug}-`))
          .slice(0, 3);
        setClassicVariantSource("local");
        setClassicVariantMatches(local);
      });
  }, [view, selectedClassicId, activeDirections]);

  // Set up horizontal bar items
  const classicCocktailsList = [
    { id: "negroni", name: "内格罗尼", english: "Negroni", icon: "🍷" },
    { id: "old_fashioned", name: "古典老式", english: "Old Fashioned", icon: "🥃" },
    { id: "martini", name: "经典马丁", english: "Martini", icon: "🍸" },
    { id: "margarita", name: "玛格丽特", english: "Margarita", icon: "🧂" },
    { id: "gin_tonic", name: "经典金汤力", english: "Gin Tonic", icon: "🍹" },
    { id: "highball", name: "威士忌嗨棒", english: "Highball", icon: "🥃" },
    { id: "mojito", name: "经典莫吉托", english: "Mojito", icon: "🌿" },
    { id: "daiquiri", name: "戴克里", english: "Daiquiri", icon: "🍹" },
    { id: "whisky_sour", name: "威士忌酸", english: "Whisky Sour", icon: "🍋" },
    { id: "moscow_mule", name: "莫斯科骡子", english: "Moscow Mule", icon: "🫚" },
  ];

  // Dynamic selector items
  const quickSelectorList = [...classicCocktailsList];
  if (!quickSelectorList.some((item) => item.id === selectedClassicId)) {
    const match = getClassicCocktailData(selectedClassicId);
    if (match) {
      quickSelectorList.push({
        id: match.id,
        name: match.name,
        english: match.english,
        icon: match.icon
      });
    }
  }

  // Recalculating state with a cool physics simulated feedback when selected directions are updated
  useEffect(() => {
    if (selectedDirections.length === 0) {
      setActiveDirections([]);
      setIsRecalculating(false);
      return;
    }
    setIsRecalculating(true);
    const timer = setTimeout(() => {
      setActiveDirections(selectedDirections);
      setIsRecalculating(false);
    }, 400); // 400ms is satisfyingly realistic!
    return () => clearTimeout(timer);
  }, [selectedClassicId, selectedDirections]);

  // Handle addition/removal of directions
  const handleToggleDirection = (id: string) => {
    if (selectedDirections.includes(id)) {
      setSelectedDirections(selectedDirections.filter((d) => d !== id));
    } else {
      setSelectedDirections([...selectedDirections, id]);
    }
  };

  function getClassicCocktailData(cocktailId: string): ClassicCocktailData {
    const normalizedId = normalizeClassicCocktailId(cocktailId);
    const direct = CLASSIC_DATABASE[normalizedId];
    if (direct) return direct;

    const hyphenId = normalizedId.replace(/_/g, "-");
    const exploreItem = classicExploreCocktails.find((item) => item.id === hyphenId || normalizeClassicCocktailId(item.id) === normalizedId);
    if (!exploreItem) return { id: normalizedId, name: "酒单暂不可用", english: "", icon: "", desc: "未找到对应酒单", themeColor: "", rating: {bitter:0,alcohol:0,fresh:0,sweet:0}, ingredients: [] };

    const fallbackColors = [
      "rgba(148, 163, 184, 0.45)",
      "rgba(253, 224, 71, 0.5)",
      "rgba(132, 204, 22, 0.45)",
      "rgba(224, 242, 254, 0.25)",
    ];
    const fallbackAmounts: number[] = [];

    return {
      id: normalizedId,
      name: exploreItem.nameZh,
      english: exploreItem.nameEn,
      icon: "🍸",
      desc: exploreItem.description,
      themeColor: "from-neutral-200/30 to-neutral-300/30",
      rating: {
        bitter: exploreItem.tags.includes("苦甜") || exploreItem.tags.includes("草本") ? 3 : 2,
        alcohol: exploreItem.baseSpirit === "起泡酒" || exploreItem.tags.includes("低酒感") ? 2 : 3,
        fresh: exploreItem.tags.includes("清爽") || exploreItem.tags.includes("酸甜") ? 4 : 3,
        sweet: exploreItem.tags.includes("甜润") || exploreItem.tags.includes("果香") ? 4 : 2,
      },
      ingredients: exploreItem.ingredients.slice(0, 5).map((ingredient, index) => ({
        name: ingredient,
        amount: 0,
        category: index === 0 ? "基酒" : ingredient.includes("汁") || ingredient.includes("果") ? "果汁" : "辅料",
        color: fallbackColors[index % fallbackColors.length],
      })),
    };
  }

  // Upgraded rules calculation logic for classic cocktails domestication
  const calculateDomestication = (cocktailId: string, directions: string[]) => {
    const classic = getClassicCocktailData(cocktailId);
    
    // Copy ingredients for modification
    let ingredients = classic.ingredients.map(ing => ({
      name: ing.name,
      amount: ing.amount,
      originalAmount: ing.amount,
      category: ing.category,
      color: ing.color,
      changeType: "keep" as "keep" | "increase" | "decrease" | "add" | "replace",
      reason: "保留主风味骨架"
    }));

    let rating = { ...classic.rating };
    let tags = ["小白友好"];
    let commentsList: string[] = [];

    // --- SPECIAL RECALCULATION FOR NEGRONI (AS REQUESTED BY USER) ---
    if (cocktailId === "negroni") {
      let ginAmount = 30;
      let campariAmount = 30;
      let vermouthAmount = 30;
      let extraIngredients: typeof ingredients = [];
      
      let ginReason = "保留原版分量";
      let campariReason = "保留原版分量";
      let vermouthReason = "保留原版分量";
      
      let ginChange: any = "keep";
      let campariChange: any = "keep";
      let vermouthChange: any = "keep";

      if (directions.includes("less_alcohol")) {
        ginAmount = 20;
        ginChange = "decrease";
        ginReason = "【降低酒感】金酒减至 20ml，减弱刺鼻酒精感";
        rating.alcohol = Math.max(1, rating.alcohol - 2);
        commentsList.push("调低烈性金酒，降低酒精侵略性");
      }

      if (directions.includes("less_bitter")) {
        campariAmount = 12; // 10-15ml range
        campariChange = "decrease";
        campariReason = "【少苦一点】下调金巴利至 12ml，克制其药草苦味";
        rating.bitter = Math.max(1, rating.bitter - 2.5);
        commentsList.push("下调金巴利，去除重药草涩苦");
      }

      if (directions.includes("convenience")) {
        vermouthAmount = 18; // 15-20ml range
        vermouthChange = "decrease";
        vermouthReason = "【控甜回甘】红美思减至 18ml，避免过甜粘嘴";
        
        extraIngredients.push({
          name: "橙味气泡水 Orange Soda",
          amount: 100, // 90-120ml range
          originalAmount: 0,
          category: "气泡饮料",
          color: "rgba(249, 115, 22, 0.45)",
          changeType: "add",
          reason: "【便利店版】加入开架橙味气泡水，平替苦橙皮芬芳且拉长酒体"
        });
        extraIngredients.push({
          name: "纯净冰块 Ice Blocks",
          amount: 120,
          originalAmount: 0,
          category: "辅料",
          color: "rgba(255, 255, 255, 0.8)",
          changeType: "add",
          reason: "【极温冷凝】加入大量冰块，物理融水稀释，平滑乙醇冲击"
        });
        extraIngredients.push({
          name: "鲜橙片 Orange Slice (可选)",
          amount: 10,
          originalAmount: 0,
          category: "辅料",
          color: "rgba(251, 146, 60, 0.9)",
          changeType: "add",
          reason: "【香气点缀】点缀一枚鲜橙片，提升感官悦纳度"
        });
        
        rating.fresh = Math.min(5, rating.fresh + 2);
        tags.push("便利店版");
        commentsList.push("添加橙味苏打，将其重塑为清透可口的定制版 Negroni Spritz");
      }

      if (directions.includes("sweeter")) {
        vermouthAmount = Math.round(vermouthAmount * 1.3);
        vermouthChange = "increase";
        vermouthReason = "【甜度加注】提升红美思用量，甜苦平衡";
        rating.sweet = Math.min(5, rating.sweet + 1.5);
      }

      if (directions.includes("fresher") && !directions.includes("convenience")) {
        extraIngredients.push({
          name: "苏打气泡水 Soda Water",
          amount: 90,
          originalAmount: 0,
          category: "气泡饮料",
          color: "rgba(224, 242, 254, 0.25)",
          changeType: "add",
          reason: "【气泡充盈】新增强充气苏打水，激活爆破爽快感"
        });
        rating.fresh = Math.min(5, rating.fresh + 1.5);
      }

      ingredients = [
        {
          name: "金酒 Gin",
          amount: ginAmount,
          originalAmount: 30,
          category: "基酒",
          color: "rgba(148, 163, 184, 0.45)",
          changeType: ginChange,
          reason: ginReason
        },
        {
          name: "金巴利 Campari",
          amount: campariAmount,
          originalAmount: 30,
          category: "辅料",
          color: "rgba(220, 38, 38, 0.65)",
          changeType: campariChange,
          reason: campariReason
        },
        {
          name: "甜味美思 Sweet Vermouth",
          amount: vermouthAmount,
          originalAmount: 30,
          category: "辅料",
          color: "rgba(127, 29, 29, 0.7)",
          changeType: vermouthChange,
          reason: vermouthReason
        },
        ...extraIngredients
      ];
    } 
    // --- GENERAL RECALCULATION FOR OTHER CLASSICS ---
    else {
      // Order matters: Convenience substitutions apply first, so other directions alter replaced ingredients!
      if (directions.includes("convenience")) {
        tags.push("便利店版");
        ingredients = ingredients.map(ing => {
          const lower = ing.name.toLowerCase();
          if (lower.includes("campari")) {
            return {
              name: "西柚苏打汽水 Grapefruit Soda",
              amount: 80,
              originalAmount: ing.amount,
              category: "气泡饮料",
              color: "rgba(244, 63, 94, 0.35)",
              changeType: "replace" as const,
              reason: "【便利平替】西柚汽水平替金巴利，模拟苦橙感且拉长酒体"
            };
          }
          if (lower.includes("sweet vermouth")) {
            return {
              name: "康师傅冰红茶 Black Tea",
              amount: 60,
              originalAmount: ing.amount,
              category: "茶饮",
              color: "rgba(146, 64, 14, 0.4)",
              changeType: "replace" as const,
              reason: "【便利平替】冰红茶平替甜美素，保留红茶多酚和微甜草本感"
            };
          }
          if (lower.includes("dry vermouth")) {
            return {
              name: "三得利苏打汽水 Soda Water",
              amount: 50,
              originalAmount: ing.amount,
              category: "气泡饮料",
              color: "rgba(224, 242, 254, 0.25)",
              changeType: "replace" as const,
              reason: "【便利平替】超市苏打水替代干美思，增加畅爽起泡"
            };
          }
          if (lower.includes("bitters")) {
            return {
              name: "三得利无糖乌龙茶 Oolong",
              amount: 15,
              originalAmount: ing.amount,
              category: "茶饮",
              color: "rgba(120, 53, 4, 0.45)",
              changeType: "replace" as const,
              reason: "【便利平替】乌龙茶单宁苦感平替安高天娜木质苦精"
            };
          }
          if (lower.includes("ginger beer")) {
            return {
              name: "苹果西打 Apple Cider",
              amount: 100,
              originalAmount: ing.amount,
              category: "气泡饮料",
              color: "rgba(253, 186, 116, 0.45)",
              changeType: "replace" as const,
              reason: "【便利平替】苹果西打平替姜汁啤酒，清甜无辛辣姜辣感"
            };
          }
          if (lower.includes("espresso")) {
            return {
              name: "雀巢即饮黑咖啡 Black Coffee",
              amount: 60,
              originalAmount: ing.amount,
              category: "茶饮",
              color: "rgba(68, 64, 60, 0.75)",
              changeType: "replace" as const,
              reason: "【便利平替】即饮黑咖啡瓶替现磨浓缩，柔和不焦苦"
            };
          }
          if (lower.includes("coconut cream")) {
            return {
              name: "椰树牌椰汁 Coconut Milk",
              amount: 80,
              originalAmount: ing.amount,
              category: "乳酸饮料",
              color: "rgba(255, 255, 255, 0.95)",
              changeType: "replace" as const,
              reason: "【便利平替】椰树牌椰汁替代精制浓厚椰浆，清爽丝滑不甜腻"
            };
          }
          if (lower.includes("lime juice") || lower.includes("lemon juice")) {
            return {
              name: "农夫山泉水溶C100 (柠檬味)",
              amount: 35,
              originalAmount: ing.amount,
              category: "果汁",
              color: "rgba(254, 240, 138, 0.5)",
              changeType: "replace" as const,
              reason: "【便利平替】水溶C100替代新鲜酸柠汁，酸甜可口"
            };
          }
          if (lower.includes("triple sec")) {
            return {
              name: "汇源纯橙汁 Orange Juice",
              amount: 40,
              originalAmount: ing.amount,
              category: "果汁",
              color: "rgba(249, 115, 22, 0.45)",
              changeType: "replace" as const,
              reason: "【便利平替】橙汁平替昂贵利口酒，注入天然柑橘果香"
            };
          }
          return ing;
        });
        commentsList.push("使用便利店常见好物完美平替原料");
        rating.alcohol = Math.max(1, rating.alcohol - 1);
        rating.fresh = Math.min(5, rating.fresh + 1);
      }

      // Apply less alcohol / beginner friendly
      if (directions.includes("less_alcohol") || directions.includes("beginner_friendly")) {
        if (directions.includes("less_alcohol")) tags.push("低酒感");
        if (directions.includes("beginner_friendly")) tags.push("入门友好");

        ingredients = ingredients.map(ing => {
          if (ing.category === "基酒" && ing.changeType !== "replace") {
            return {
              ...ing,
              amount: Math.max(15, Math.round(ing.amount * 0.5)),
              changeType: "decrease" as const,
              reason: "【酒感控制】基酒用量减半，抹平高浓度乙醇的辛辣刺喉感"
            };
          }
          return ing;
        });

        // Insert soda carbonated water if total volume is too low or spirit is forward
        const currentVol = ingredients.reduce((sum, i) => sum + i.amount, 0);
        const hasFizz = ingredients.some(i => i.name.includes("气泡") || i.name.includes("Soda") || i.name.includes("Sprite") || i.name.includes("Cider"));
        
        if (currentVol < 150 && !hasFizz) {
          const gasName = "苏打气泡水 Soda Water";
          const gasColor = "rgba(224, 242, 254, 0.25)";
          ingredients.push({
            name: gasName,
            amount: 100,
            originalAmount: 0,
            category: "气泡饮料",
            color: gasColor,
            changeType: "add" as const,
            reason: "【拉长酒体】新增香甜气泡水稀释，将烈酒转化为清爽起泡长饮"
          });
        }
        commentsList.push("大幅稀释多余乙醇浓度，减少酒精辣喉感");
        rating.alcohol = Math.max(1, rating.alcohol - 2);
        rating.fresh = Math.min(5, rating.fresh + 1);
      }

      // Apply less bitter
      if (directions.includes("less_bitter")) {
        tags.push("极低苦度");
        ingredients = ingredients.map(ing => {
          const lower = ing.name.toLowerCase();
          if (lower.includes("campari") || lower.includes("bitters") || lower.includes("tonic") || lower.includes("espresso")) {
            // Cut bitter ingredient
            const decreasedAmt = Math.max(10, Math.round(ing.amount * 0.4));
            return {
              ...ing,
              amount: decreasedAmt,
              changeType: "decrease" as const,
              reason: "【苦味控制】极客制投放，祛除令人不适的浓烈中药感"
            };
          }
          return ing;
        });

        // Special conversion of Gin Tonic to Fizz to bypass bitter Tonic water
        if (cocktailId === "gin_tonic") {
          ingredients = ingredients.map(ing => {
            if (ing.name.includes("Tonic")) {
              return {
                name: "柠檬气泡水 Lemon Soda",
                amount: 110,
                originalAmount: ing.amount,
                category: "气泡饮料",
                color: "rgba(254, 240, 138, 0.35)",
                changeType: "replace" as const,
                reason: "【苦味消除】用酸甜柠檬汽水代替苦涩汤力水，完美根除奎宁苦味"
              };
            }
            return ing;
          });
        }

        commentsList.push("调低奎宁/草本/焦油等生苦药味来源");
        rating.bitter = Math.max(1, rating.bitter - 2);
        rating.sweet = Math.min(5, rating.sweet + 1);
      }

      // Apply sweeter
      if (directions.includes("sweeter")) {
        tags.push("甜度加注");
        let sweetened = false;
        ingredients = ingredients.map(ing => {
          const lower = ing.name.toLowerCase();
          if (lower.includes("sugar") || lower.includes("syrup") || lower.includes("vermouth") || lower.includes("kahlúa") || lower.includes("tea") || lower.includes("sprite")) {
            sweetened = true;
            return {
              ...ing,
              amount: Math.round(ing.amount * 1.5),
              changeType: ing.changeType === "keep" ? "increase" as const : ing.changeType,
              reason: "【甜度调整】提高甜味材料比例，让入口更圆润"
            };
          }
          return ing;
        });

        if (!sweetened) {
          ingredients.push({
            name: "纯蜂蜜水 Honey Water",
            amount: 25,
            originalAmount: 0,
            category: "辅料",
            color: "rgba(251, 191, 36, 0.45)",
            changeType: "add" as const,
            reason: "【甜度平衡】新增纯蜂蜜水挂壁，用天然果糖温和包裹刺激气味"
          });
        }
        commentsList.push("提升天然果糖/糖浆配体比重以柔化酒体");
        rating.sweet = Math.min(5, rating.sweet + 2);
        rating.bitter = Math.max(1, rating.bitter - 1);
      }

      // Apply fresher
      if (directions.includes("fresher")) {
        tags.push("极度清爽");
        let bubblyAdded = false;
        ingredients = ingredients.map(ing => {
          const lower = ing.name.toLowerCase();
          if (lower.includes("soda") || lower.includes("sprite") || lower.includes("cola") || lower.includes("cider") || lower.includes("气泡")) {
            bubblyAdded = true;
            return {
              ...ing,
              amount: Math.round(ing.amount * 1.4),
              changeType: ing.changeType === "keep" ? "increase" : ing.changeType,
              reason: "【气泡扩充】拉高碳酸充气饮料投放量，提升爆破爽快感"
            };
          }
          return ing;
        });

        if (!bubblyAdded) {
          ingredients.push({
            name: "强气泡苏打水 Soda Fizz",
            amount: 90,
            originalAmount: 0,
            category: "气泡饮料",
            color: "rgba(224, 242, 254, 0.25)",
            changeType: "add" as const,
            reason: "【物理起泡】新增二氧化碳气泡介质，拉长酒体，冲刷燥热粘稠"
          });
        }
        commentsList.push("加注高碳酸碳酸释出，让整体口感清透飘逸");
        rating.fresh = Math.min(5, rating.fresh + 2);
        rating.alcohol = Math.max(1, rating.alcohol - 1);
      }
    } // Closes else block

    // Clean duplicate named ingredients
    const seenNames = new Set<string>();
    ingredients = ingredients.filter(ing => {
      if (seenNames.has(ing.name)) return false;
      seenNames.add(ing.name);
      return ing.amount > 0;
    });

    // Make up a customized Chinese name based on cocktail and directions chosen
    let improvedChineseName = `定制版${classic.name}`;
    if (cocktailId === "negroni") {
      improvedChineseName = "定制版内格罗尼";
    } else if (cocktailId === "old_fashioned") {
      if (directions.includes("convenience")) {
        improvedChineseName = "定制版古典老式";
      } else {
        improvedChineseName = "定制版古典老式";
      }
    } else if (cocktailId === "martini") {
      improvedChineseName = "定制版经典马丁";
    } else if (cocktailId === "gin_tonic") {
      improvedChineseName = "定制版经典金汤力";
    }

    // Assemble dynamic explanations
    let customExplanation = `【改良建议】针对经典 ${classic.name} 的劝退点，`;
    if (commentsList.length > 0) {
      customExplanation += `已选择「${directions.map(d => directionOptions.find(o => o.id === d)?.label || d).join("、")}」。这版配方会这样调整：`;
      if (directions.includes("less_bitter")) {
        customExplanation += "减少高苦金巴利/药草成分投放比例；";
      }
      if (directions.includes("less_alcohol")) {
        customExplanation += "下调高烈度基酒用量，消除刺喉乙醇辣感；";
      }
      if (directions.includes("fresher") || directions.includes("less_alcohol")) {
        customExplanation += `加入气泡苏打水/汽水拉长酒体，使原本苦烈偏沉重的烈酒转成长饮 Spritz 起泡方向，变清爽解腻。`;
      }
      if (directions.includes("convenience")) {
        customExplanation += "利用开架气泡水/红茶等饮料中天然的多酚和苦橙酸中和基酒。";
      }
    } else {
      customExplanation += "我们推荐降低烈性基酒，增加无酒精气泡稀释剂，让其更加平易近人。";
    }

    return {
      classic: {
        chineseName: classic.name,
        name: classic.english,
        desc: classic.desc,
        ingredients: classic.ingredients,
        rating: classic.rating
      },
      improved: {
        chineseName: improvedChineseName,
        name: cocktailId === "negroni" ? "CUSTOMIZED NEGRONI" : `CUSTOMIZED ${classic.english.toUpperCase()}`,
        ingredients: ingredients,
        mixMethod: cocktailId === "whisky_sour" || cocktailId === "espresso_martini" || cocktailId === "daiquiri" ? "Shake" : "Stir",
        comments: customExplanation,
        tags: Array.from(new Set(tags)),
        rating: rating
      }
    };
  };

  // Perform calculations reactively based on horizontal selections
  const improvedResult = calculateDomestication(selectedClassicId, activeDirections);

  const handleSaveToFavorites = async () => {
    if (!improvedResult || !onSaveCocktail) return;

    const savedRecord = {
      id: `saved-improved-${Date.now()}`,
      ingredients: improvedResult.improved.ingredients,
      chineseName: improvedResult.improved.chineseName,
      name: improvedResult.improved.name,
      subtitle: `【经典改良】基于经典款「${improvedResult.classic.chineseName}」的好喝进化`,
      spirit: improvedResult.improved.ingredients.filter((i: any) => i.category === "基酒").map((i: any) => i.name).join(" + ") || "改良基酒",
      mixer: improvedResult.improved.ingredients.filter((i: any) => i.category !== "基酒").map((i: any) => i.name).slice(0, 2).join(" + ") || "风味苏打",
      size: `${improvedResult.improved.ingredients.reduce((sum: number, i: any) => sum + i.amount, 0)}ml`,
      rating: {
        sweet: improvedResult.improved.rating.sweet,
        acid: improvedResult.improved.rating.fresh, // Map freshness or standard acidity
        strength: improvedResult.improved.rating.alcohol
      },
      comments: improvedResult.improved.comments,
      tags: improvedResult.improved.tags,
      savedAt: new Date().toISOString().split("T")[0],
      ratingValue: 5,
      sourcePage: "classic_remix",
    };

    try {
      await onSaveCocktail(savedRecord);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) { window.alert(error instanceof Error ? error.message : "收藏失败，请重试"); }
  };

  const renderStars = (val: number, isClassic: boolean) => {
    const dots = [];
    for (let i = 1; i <= 5; i++) {
      if (i <= val) {
        dots.push(
          <span 
            key={i} 
            className={`w-2.5 h-2.5 rounded-full inline-block mr-1 ${
              isClassic ? "bg-red-500" : "bg-green-500 animate-pulse"
            }`}
          />
        );
      } else {
        dots.push(
          <span key={i} className="w-2.5 h-2.5 rounded-full inline-block mr-1 bg-outline-variant/30" />
        );
      }
    }
    return dots;
  };

  const renderPageHeader = (title = "Inspiration Lab", subtitle = "从经典鸡尾酒、便利店特调、口味灵感中，找到适合你的低门槛调酒方案。") => (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-outline tracking-widest uppercase bg-surface-container px-2.5 py-1 rounded-sm">
          LAB INSPIRATION
        </span>
        <div className="h-[1px] flex-grow bg-outline-variant/30"></div>
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <h2 className="text-3xl font-serif text-on-background">{title}</h2>
          <p className="text-sm text-on-surface-variant font-light leading-relaxed">
            {subtitle}
          </p>
        </div>
        {view !== "menu" && (
          <button
            onClick={goBackToInspiration}
            className="shrink-0 rounded-full border border-outline-variant/30 px-3 py-2 text-[11px] font-medium text-on-surface-variant bg-surface-container-low hover:bg-surface-container transition-colors"
          >
            返回菜单
          </button>
        )}
      </div>
    </div>
  );

  const renderMenu = () => (
    <div className="mx-auto w-full max-w-[430px] bg-[#f6f5f1] px-4 pb-24">
      <section className="pt-6 text-center">
        <h2 className="text-[28px] font-medium leading-tight text-neutral-950">找酒谱</h2>
        {guideActive && <><button onClick={() => onBackGuide ? onBackGuide() : window.location.assign("/")} className="mt-3 text-xs text-neutral-500 underline">返回首页引导</button><h3 className="mt-6 text-xl font-medium">{showAll ? "继续找你喜欢的一杯" : "从这三杯开始"}</h3><p className="mt-2 text-xs leading-6 text-neutral-500">{exploreTab === "classic" ? "先认识经典，从操作简单的配方开始。" : "常见材料，简单调配。购买前确认门店有售。"}</p></>}
      </section>

      <section className="mt-6 border-b border-[#dededb]">
        <div className="grid grid-cols-2">
          {[
            { id: "convenience" as ExploreTab, label: "便利店特调", icon: Store },
            { id: "classic" as ExploreTab, label: "经典鸡尾酒", icon: Wine },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = exploreTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setExploreTab(tab.id); setShowAll(false); }}
                className={`relative flex h-[54px] cursor-pointer items-center justify-center gap-2 text-[15px] font-medium transition-colors ${
                  active ? "text-neutral-950" : "text-neutral-400"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" />
                <span>{tab.label}</span>
                {active && <span className="absolute bottom-0 left-0 h-0.5 w-full bg-neutral-950" />}
              </button>
            );
          })}
        </div>
      </section>

      <>
          <form
            className="mt-5 flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setSearchQuery(searchInput);
            }}
          >
            <label className="flex h-[52px] min-w-0 flex-1 items-center gap-2 rounded-full border border-[#E1E1DE] bg-white px-4">
              <Search className="h-5 w-5 shrink-0 text-neutral-400" />
              <input
                value={searchInput}
                onChange={(event) => {
                  setSearchInput(event.target.value);
                  if (!event.target.value.trim()) setSearchQuery("");
                }}
                placeholder={exploreTab === "convenience" ? "搜索便利店特调 / 基酒 / 材料..." : "搜索经典鸡尾酒 / 中英文名 / 材料..."}
                className="min-w-0 flex-1 bg-transparent text-[15px] text-neutral-950 outline-none placeholder:text-neutral-400"
              />
            </label>
            <button
              type="submit"
              className="h-[50px] w-[78px] shrink-0 cursor-pointer rounded-full bg-neutral-950 text-[15px] font-medium text-white active:scale-[0.98]"
            >
              搜索
            </button>
          </form>

          <div className="-mx-4 mt-4 overflow-x-auto px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-2 whitespace-nowrap">
              {(exploreTab === "convenience" ? convenienceCategories : classicCategories).map((category) => {
                const active = selectedCategory === category;
                return (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`h-9 shrink-0 cursor-pointer rounded-full px-3.5 text-sm font-medium transition-colors active:scale-[0.98] ${
                      active ? "bg-neutral-950 text-white" : "bg-[#F2F2F2] text-[#555]"
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>

          {filteredExploreCocktails.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-[#d8d8d4] bg-white px-5 py-8 text-center text-sm leading-6 text-neutral-500">
              暂时没有找到相关鸡尾酒，试试搜索其他名称或材料。
            </div>
          ) : (
            <section className="mt-4 grid grid-cols-2 gap-3 min-[340px]:grid-cols-2 max-[339px]:grid-cols-1">
              {visibleCocktails.map((cocktail, index) => {
                const hasLogged = hasDrinkLogForExploreCocktail(cocktail, drinkLogs);
                const meta = getCocktailMvpMeta(cocktail, exploreTab);
                return (
                  <article
                    role="link"
                    tabIndex={0}
                    onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.click(); }}
                    key={cocktail.id}
                    onClick={() => {
                      trackAnalyticsEvent({
                        eventName: "cocktail_card_click",
                        page: "inspiration",
                        action: "click",
                        target: cocktail.nameZh,
                        recipeId: cocktail.id,
                        source: exploreTab,
                        metadata: {
                          category: cocktail.category,
                          tags: cocktail.tags,
                        },
                      });
                      trackAnalyticsEvent({
                        eventName: "recipe_detail_view",
                        page: "inspiration",
                        action: "view",
                        target: cocktail.nameZh,
                        recipeId: cocktail.id,
                        source: exploreTab,
                      });
                      if (guideActive) sessionStorage.setItem("alchemix_guide_return", exploreTab);
                      window.location.href = cocktail.href;
                    }}
                    className={`relative cursor-pointer overflow-hidden rounded-2xl border border-[#E8E8E8] bg-white shadow-none transition-transform active:scale-[0.98] ${guideActive && !showAll && index === 0 ? "col-span-2 max-[339px]:col-span-1" : ""}`}
                  >
                    {hasLogged && (
                      <div className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/92 px-2 py-1 text-[10px] font-medium text-neutral-950 shadow-none backdrop-blur">
                        <span className="material-symbols-outlined text-[13px]">check_circle</span>
                        <span>喝过</span>
                      </div>
                    )}
                    <CocktailImage cocktail={cocktail} />
                    <div className={`space-y-1.5 p-3 ${index % 3 === 1 ? "pb-5" : ""}`}>
                      <div className="flex flex-wrap gap-1">
                        {[cocktail.category, ...cocktail.tags.filter((tag) => tag !== cocktail.category)].slice(0, 2).map((tag) => (
                          <span key={tag} className="rounded-full bg-[#F2F2F2] px-2 py-0.5 text-[10px] font-medium text-neutral-500">
                            {tag}
                          </span>
                        ))}
                      </div>
                      {guideActive && !showAll && index === 0 && <p className="text-xs font-medium text-neutral-950">推荐先试 · {meta.tool}</p>}
                      <h3 className="text-[17px] font-medium leading-snug text-neutral-950 line-clamp-2">{cocktail.nameZh}</h3>
                      <p className="text-[13px] font-semibold leading-snug text-neutral-500">{cocktail.nameEn}</p>
                      <p className="text-[13px] leading-[1.5] text-neutral-500 line-clamp-3">{cocktail.description}</p>
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        {[
                          `难度 ${meta.difficulty}/5`,
                          meta.alcohol,
                          meta.availability,
                          meta.tool,
                        ].map((label) => (
                          <span key={label} className="rounded-lg border border-[#E8E8E8] bg-[#f6f5f1] px-1.5 py-1 text-center text-[9px] font-medium text-neutral-500">
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          )}
          {guideActive && !showAll && filteredExploreCocktails.length > 3 && <button onClick={() => setShowAll(true)} className="mt-5 min-h-12 w-full rounded-full bg-neutral-950 px-5 py-3 text-sm font-medium text-white">{exploreTab === "classic" ? "查看更多经典酒" : "查看更多便利店特调"}</button>}
        </>
    </div>
  );

  const renderRecipeCard = (recipe: any) => {
    const ingredients = recipe.ingredients ?? [];
    const tags = recipe.tags?.map((item: any) => item.tag?.nameCn ?? item).filter(Boolean) ?? recipe.tags ?? [];
    const titleCn = recipe.nameCn ?? recipe.titleCn;
    const titleEn = recipe.nameEn ?? recipe.titleEn;
    return (
      <div key={recipe.id ?? recipe.slug} className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 space-y-3 shadow-none">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-serif text-base font-medium text-on-surface leading-tight">{titleCn}</h3>
            <span className="text-[10px] font-mono text-outline uppercase">{recipe.baseSpirit}</span>
          </div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-outline">{titleEn}</p>
          <p className="text-xs text-on-surface-variant leading-relaxed">{recipe.description}</p>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            ["甜", recipe.sweetnessLevel],
            ["酸", recipe.acidityLevel],
            ["苦", recipe.bitternessLevel],
            ["酒感", recipe.alcoholIntensity],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-surface-container-low px-2 py-2 border border-outline-variant/10">
              <div className="text-[10px] text-outline">{label}</div>
              <div className="text-sm font-medium text-on-surface">{value}/5</div>
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          {ingredients.slice(0, 4).map((ingredient: any, index: number) => (
            <div key={`${ingredient.ingredientNameCn ?? ingredient.nameCn}-${index}`} className="flex items-center justify-between text-xs">
              <span className="text-on-surface-variant">{ingredient.ingredientNameCn ?? ingredient.nameCn}</span>
              <span className="font-mono text-outline">{ingredient.amount}{ingredient.unit}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {tags.slice(0, 4).map((tag: string) => (
            <span key={tag} className="text-[10px] font-medium px-2 py-0.5 rounded bg-primary/5 text-primary border border-primary/10">
              #{tag}
            </span>
          ))}
        </div>
        {onSaveDrinkLog && (
          <DrinkLogButton
            recipe={inspirationRecipeToDrinkLogSnapshot(recipe)}
            sourcePage={view === "convenience-mix" ? "convenience_mix" : view}
            drinkLogs={drinkLogs}
            onSaveDrinkLog={onSaveDrinkLog}
            variant="text"
            className="w-full"
          />
        )}
      </div>
    );
  };

  const renderConvenienceDetailPage = () => {
    const cocktail = convenienceExploreCocktails.find((item) => item.id === canonicalConvenienceId(routeCocktailId));
    const guide = cocktail ? getConvenienceRecipeGuide(cocktail) : null;

    if (!cocktail || !guide) {
      return (
        <div className="mx-auto w-full max-w-[430px] bg-[#f6f5f1] px-4 pb-24 pt-5">
          <button
            onClick={goBackToInspiration}
            className="mb-5 inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#E1E1DE] bg-white px-3.5 py-2 text-xs font-medium text-neutral-700 active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            返回探索
          </button>
          <div className="rounded-2xl border border-dashed border-[#d8d8d4] bg-white px-5 py-8 text-center text-sm leading-6 text-neutral-500">
            暂时没有找到这杯酒的做法，请回到探索页选择其他配方。
          </div>
        </div>
      );
    }

    const meta = getCocktailMvpMeta(cocktail, "convenience");

    return (
      <div className="mx-auto w-full max-w-[430px] bg-[#f6f5f1] px-4 pb-24 pt-5">
        <AssistantSurface context={recipeContext("convenience", cocktail.id)} />
        <button
          onClick={goBackToInspiration}
          className="mb-5 inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#E1E1DE] bg-white px-3.5 py-2 text-xs font-medium text-neutral-700 shadow-none active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          返回探索
        </button>

        <article className="overflow-hidden rounded-[24px] border border-[#E8E8E8] bg-white shadow-none">
          <CocktailImage cocktail={cocktail} />
          <div className="space-y-5 p-5">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {[...new Set([cocktail.baseSpirit, ...cocktail.tags].filter(Boolean))].slice(0, 3).map((tag) => (
                  <span key={tag} className="rounded-full bg-[#F2F2F2] px-2.5 py-1 text-[11px] font-medium text-neutral-600">
                    {tag}
                  </span>
                ))}
              </div>
              <div>
                <h2 className="text-[28px] font-medium leading-tight text-neutral-950">{cocktail.nameZh}</h2>
                <p className="mt-1 text-[12px] font-medium uppercase tracking-[0.18em] text-neutral-400">{cocktail.nameEn}</p>
              </div>
              <p className="text-sm leading-6 text-neutral-600">{cocktail.description}</p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  ["难度", `${meta.difficulty}/5`],
                  ["酒感", meta.alcohol],
                  ["材料", meta.availability],
                  ["器具", meta.tool],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-[#E8E8E8] bg-[#f6f5f1] px-2 py-2 text-center">
                    <p className="text-[10px] font-medium text-neutral-400">{label}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-neutral-800">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <section className="rounded-2xl bg-[#f6f5f1] p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-medium text-neutral-950">材料与比例</h3>
                <span className="text-[11px] font-medium text-neutral-500">{guide.glass}</span>
              </div>
              <div className="space-y-2">
                {guide.ingredientLines.map((line) => (
                  <div key={line} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm">
                    <span className="font-medium text-neutral-800">{line.replace(/\s+\d.*$/, "")}</span>
                    <span className="shrink-0 text-right font-mono text-xs text-neutral-500">{line.match(/\d.*$/)?.[0] ?? ""}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h3 id="assistant-recipe" tabIndex={-1} className="text-base font-medium text-neutral-950">做法</h3>
              <div className="space-y-2.5">
                {guide.steps.map((step, index) => (
                  <div key={step} className="flex gap-3 rounded-2xl border border-[#E8E8E8] bg-white p-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-medium text-white">
                      {index + 1}
                    </span>
                    <p className="text-sm leading-6 text-neutral-700">{step}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-[#E8E8E8] bg-white p-4">
              <h3 className="mb-3 text-base font-medium text-neutral-950">小白建议</h3>
              <div className="space-y-2">
                {guide.beginnerTips.map((tip) => (
                  <p key={tip} className="text-sm leading-6 text-neutral-600">
                    {tip}
                  </p>
                ))}
              </div>
            </section>

            {onSaveDrinkLog && (
              <DrinkLogButton
                recipe={{
                  ...exploreCocktailToDrinkLogSnapshot(cocktail),
                  ingredients: guide.ingredientLines.map((line) => ({
                    name: line.replace(/\s+\d.*$/, ""),
                    amount: line.match(/\d.*$/)?.[0] ?? "",
                  })),
                  method: guide.steps.join(" "),
                }}
                sourcePage="convenience_mix"
                drinkLogs={drinkLogs}
                onSaveDrinkLog={onSaveDrinkLog}
                variant="text"
                className="w-full"
              />
            )}
          </div>
        </article>
      </div>
    );
  };

  const renderRecipeListPage = () => {
    const config: Record<Exclude<InspirationView, "menu" | "classic-remix">, { title: string; subtitle: string }> = {
      "convenience-mix": {
        title: "便利店特调灵感",
        subtitle: "用便利店能买到的啤酒、果汁、汽水、茶饮做简单好喝的特调。",
      },
      flavor: {
        title: "按口味找酒",
        subtitle: "按酸甜、清爽、果香、低酒感等方向寻找配方。",
      },
      beginner: {
        title: "小白入门酒单",
        subtitle: "低失败率、不苦不烈、材料容易买到的入门酒单。",
      },
      knowledge: {
        title: "经典鸡尾酒知识库",
        subtitle: "了解经典鸡尾酒的来源、风味结构和基础配方。",
      },
    };
    const fallbackType = view === "knowledge" ? "classic" : view === "beginner" ? "beginner" : "convenience";
    const displayRecipes = loadedRecipes.length > 0
      ? loadedRecipes
      : INSPIRATION_RECIPES.filter((recipe) => recipe.type === fallbackType).slice(0, 36);
    const current = config[view as Exclude<InspirationView, "menu" | "classic-remix">];

    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-16 px-4">
        {renderPageHeader(current.title, current.subtitle)}
        <div className="flex items-center justify-between border-b border-outline-variant/30 pb-2">
          <span className="text-xs font-medium text-on-surface">预生成酒单</span>
          <span className="text-[10px] font-mono text-outline uppercase">
            {recipeSource === "database" ? "DATABASE FIRST" : "LOCAL SEED FALLBACK"} · {displayRecipes.length} ITEMS
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {displayRecipes.map(renderRecipeCard)}
        </div>
      </div>
    );
  };

  if (view === "menu") {
    return renderMenu();
  }

  if (view === "convenience-mix" && routeCocktailId) {
    return renderConvenienceDetailPage();
  }

  if (view === "classic-remix" && !CLASSIC_DATABASE[normalizeClassicCocktailId(selectedClassicId)]) {
    const item = classicExploreCocktails.find(r => normalizeClassicCocktailId(r.id) === normalizeClassicCocktailId(selectedClassicId));
    return <section><button onClick={goBackToInspiration}>返回探索</button>{item && <div className="mx-auto mt-5 max-w-sm overflow-hidden rounded-2xl"><CocktailImage cocktail={item} /></div>}<h2 className="mt-6 text-2xl">{item?.nameZh ?? '酒单暂不可用'}</h2><p className="mt-3">{item?.description ?? '没有找到对应酒款，请返回重新选择。'}</p>{item && <><AssistantSurface context={recipeContext('classic',item.id)}/><p className="mt-4">材料：{item.ingredients.join('、')}</p><p className="mt-4">这杯酒的具体用量和制作步骤正在核实，暂不展示未核实的配方。</p></>}</section>;
  }
  if (view !== "classic-remix") {
    return renderRecipeListPage();
  }

  return (
    <div className="space-y-12 max-w-4xl mx-auto pb-16 px-4">
      <AssistantSurface context={recipeContext("classic", selectedClassicId)} />
      {CLASSIC_DATABASE[selectedClassicId]?.methodNote && <div className="mb-4 rounded-2xl border p-4 text-sm"><p>{CLASSIC_DATABASE[selectedClassicId].methodNote}</p>{CLASSIC_DATABASE[selectedClassicId].sources?.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="mt-2 block underline">{source.title}</a>)}</div>}
      <button
        onClick={goBackToInspiration}
        className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#E1E1DE] bg-white px-3.5 py-2 text-xs font-medium text-neutral-700 shadow-none active:scale-[0.98]"
      >
        <span className="material-symbols-outlined text-sm">arrow_back</span>
        返回探索
      </button>

      {!isClassicDirectDetail && (
        <>
          {/* Header text */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-outline tracking-widest uppercase bg-surface-container px-2.5 py-1 rounded-sm">
                LAB INSPIRATION
              </span>
              <div className="h-[1px] flex-grow bg-outline-variant/30"></div>
            </div>
            <h2 className="text-3xl font-serif text-on-background">Inspiration Lab</h2>
            <p className="text-sm text-on-surface-variant font-light tracking-wide">
              觉得经典鸡尾酒太苦、太烈？选择一个经典酒款，再把它调成更适合你的版本。
            </p>
          </div>

          {/* MODULE: 经典酒小白改良 */}
          <section className="space-y-6">
            <div className="flex items-baseline justify-between border-b border-outline-variant/30 pb-2">
              <div className="space-y-1">
                <h3 className="text-lg font-serif text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl">science</span>
                  经典酒改良
                </h3>
                <p className="text-xs text-outline font-light">
                  先选择经典酒款，再选择下方的改良方向。
                </p>
              </div>
            </div>

            {/* Horizontal scroll of classic cocktails */}
            <div className="flex overflow-x-auto gap-3 pb-2 no-scrollbar scroll-smooth items-center">
              {quickSelectorList.map((c) => {
                const isSelected = selectedClassicId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedClassicId(c.id);
                    }}
                    className={`flex-shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl border transition-all text-xs font-medium cursor-pointer ${
                      isSelected
                        ? `bg-black text-white border-black shadow-none scale-105`
                        : "bg-surface-container-lowest border-outline-variant/30 text-on-surface-variant hover:border-outline-variant hover:bg-surface-container-low"
                    }`}
                  >
                    <span className="text-base">{c.icon}</span>
                    <div className="text-left">
                      <div className="font-medium leading-tight">{c.name}</div>
                      <div className={`text-[9px] uppercase tracking-wider ${isSelected ? "text-white/60" : "text-outline"}`}>{c.english}</div>
                    </div>
                  </button>
                );
              })}

              <button
                onClick={() => setShowCatalogModal(true)}
                className="flex-shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-outline-variant/50 text-xs font-medium cursor-pointer bg-surface-container-low/40 text-primary hover:bg-surface-container-low hover:border-primary transition-all"
              >
                <span className="material-symbols-outlined text-sm">grid_view</span>
                <div className="text-left">
                  <div className="font-medium leading-tight">更多经典</div>
                  <div className="text-[9px] uppercase tracking-wider text-outline-variant">Catalog ({CLASSIC_DATABASE ? Object.keys(CLASSIC_DATABASE).length : 14})</div>
                </div>
              </button>
            </div>
          </section>
        </>
      )}

      {isClassicDirectDetail && improvedResult && (
        <div className="space-y-1">
          <div className="mb-5 flex h-64 justify-center rounded-2xl bg-[#fff] p-4">
            <CocktailIllustration id={selectedClassicId} name={improvedResult.classic.chineseName} className="h-full w-full" sizes="224px" />
          </div>
          <h2 className="text-[28px] font-medium leading-tight text-neutral-950">{improvedResult.classic.chineseName}</h2>
          <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-neutral-400">{improvedResult.classic.name}</p>
          <div className="grid grid-cols-4 gap-2 pt-3">
            {(() => {
              const meta = getCocktailMvpMeta({
                id: selectedClassicId,
                nameZh: improvedResult.classic.chineseName,
                nameEn: improvedResult.classic.name,
                description: improvedResult.classic.desc,
                imageUrl: "",
                category: "经典鸡尾酒",
                tags: [],
                ingredients: improvedResult.classic.ingredients.map((ing: any) => ing.name),
                href: "",
              }, "classic");
              return [
                ["难度", `${meta.difficulty}/5`],
                ["酒感", meta.alcohol],
                ["材料", meta.availability],
                ["器具", meta.tool],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-[#E8E8E8] bg-white px-2 py-2 text-center">
                  <p className="text-[10px] font-medium text-neutral-400">{label}</p>
                  <p className="mt-0.5 text-[11px] font-medium text-neutral-800">{value}</p>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      <section className="space-y-6">

        {/* Detailed Reformer Single Column Layout */}
        <div className="space-y-6">
          
          {/* 1. Original recipe */}
          <div id="assistant-recipe" tabIndex={-1} />
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 space-y-5 shadow-none">
            <div className="space-y-4">
              <div className="flex items-center justify-end">
                <span className="text-xs font-mono text-outline">ORIGINAL RECIPE</span>
              </div>

              {improvedResult ? (
                <div className="space-y-3">
                  <h4 className="text-xl font-serif font-medium text-on-surface flex flex-wrap items-baseline gap-2">
                    <span>原始配方：{improvedResult.classic.chineseName}</span>

                    <span className="text-[10px] font-mono uppercase tracking-widest text-outline">/ ORIGINAL RECIPE</span>
                  </h4>
                  <p className="text-xs text-on-surface-variant leading-relaxed font-light bg-surface-container-low/50 p-3 rounded-xl border border-outline-variant/10">
                    {improvedResult.classic.desc}
                  </p>

                  {/* Original Ingredients List */}
                  <div className="space-y-2 pt-1">
                    <h5 className="text-[10px] font-medium text-outline uppercase tracking-wider">原配比公式</h5>
                    <div className="space-y-1.5">
                      {improvedResult.classic.ingredients.map((ing: any, i: number) => (
                        <div key={i} className="flex justify-between items-center text-xs">
                          <span className="font-medium flex items-center gap-1.5 text-on-surface-variant">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ing.color }}></span>
                            {ing.name}
                          </span>
                          <span className="font-mono text-outline">{ing.amount}ml</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {onSaveDrinkLog && (
                    <div className="pt-2">
                      <DrinkLogButton
                        recipe={{
                          id: `classic-original-${selectedClassicId}`,
                          nameZh: improvedResult.classic.chineseName,
                          nameEn: improvedResult.classic.name,
                          description: improvedResult.classic.desc,
                          tags: ["经典鸡尾酒", "原始配方"],
                          ingredients: improvedResult.classic.ingredients.map((ing: any) => ({
                            name: ing.name,
                            amount: ing.amount,
                            unit: "ml",
                          })),
                          method: "按原始配方加冰搅拌或摇合，过滤或倒入适合杯型后饮用。",
                          sourcePage: "classic_remix",
                        }}
                        sourcePage="classic_remix"
                        drinkLogs={drinkLogs}
                        onSaveDrinkLog={onSaveDrinkLog}
                        variant="text"
                        className="w-full"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-2">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs text-outline font-light">正在析出原版数据...</span>
                </div>
              )}
            </div>

            {/* Original Ratings */}
            {improvedResult && (
              <div className="pt-4 border-t border-outline-variant/20 space-y-2">
                <h5 className="text-[10px] font-medium text-outline uppercase tracking-wider flex items-center justify-between">
                  <span>原配方关键缺陷度</span>
                  <span className="font-mono text-red-500 font-medium">药苦重 / 辣口</span>
                </h5>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-on-surface-variant">苦味 Bitter</span>
                    <span className="font-mono">{renderStars(improvedResult.classic.rating.bitter, true)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-on-surface-variant">酒感 Alcohol</span>
                    <span className="font-mono">{renderStars(improvedResult.classic.rating.alcohol, true)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. Selector of directions */}
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 space-y-4 shadow-none">
              <h4 className="text-xs font-medium text-outline uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">tune</span>
                定制改变方向（可多选）
              </h4>
              <div className="flex flex-wrap gap-2">
                {directionOptions.map((opt) => {
                  const isActive = selectedDirections.includes(opt.id);
                  return (
                    <button
                      id={opt.id === "convenience" ? "assistant-substitute" : undefined}
                      key={opt.id}
                      onClick={() => handleToggleDirection(opt.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 border transition-all cursor-pointer ${
                        isActive 
                          ? "bg-primary text-on-primary border-primary shadow-none scale-[1.03]"
                          : "bg-surface-container-low border-outline-variant/20 text-on-surface-variant hover:border-outline-variant/50"
                      }`}
                    >
                      {isActive && <span className="material-symbols-outlined text-xs">check</span>}
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Customized result */}
            {activeDirections.length > 0 && (
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 shadow-none relative overflow-hidden flex flex-col justify-between min-h-[420px]">
              
              {/* Physics Simulated Loader Overlay */}
              {isRecalculating && (
                <div className="absolute inset-0 bg-white/80 dark:bg-black/70 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center space-y-3">
                  <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs font-serif font-medium text-primary animate-pulse">正在重新驯化分子比例...</span>
                </div>
              )}

              {improvedResult ? (
                <div className="space-y-5">
                  
                  {/* Status Indicator Tag */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-[10px] font-medium text-green-700 bg-green-50 dark:bg-green-950/25 px-2.5 py-1 rounded-sm border border-green-200/20 tracking-wider uppercase flex items-center gap-1 animate-bounce">
                      <Sparkles className="w-3 h-3 text-green-600 fill-green-600" />
                      已根据「{activeDirections.map(d => directionOptions.find(o => o.id === d)?.label || d).join("、")}」重置配比
                    </span>
                    <span className="text-xs font-mono text-outline uppercase">CUSTOMIZED RESULT</span>
                  </div>

                  {/* Header Title segment */}
                  <div className="space-y-1">
                    <h3 className="text-2xl font-serif font-medium text-primary flex items-baseline gap-2">
                      结果区：{improvedResult.improved.chineseName}
                    </h3>
                    <p className="text-[10px] uppercase font-mono text-outline tracking-wider">
                      {improvedResult.improved.name}
                    </p>
                  </div>

                  {/* Snazzy modified tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {improvedResult.improved.tags.map((t: string) => (
                      <span key={t} className="text-[10px] font-medium px-2 py-0.5 rounded bg-green-500/10 text-green-600 border border-green-500/20">
                        #{t}
                      </span>
                    ))}
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-surface-container-high text-on-surface border border-outline-variant/20">
                      #冰块 很多
                    </span>
                  </div>

                  {/* FLAVOR COMPARISON SLIDER BLOCK ABOVE RECIPE CARD (Requested!) */}
                  <div className="bg-surface-container-low/30 p-4 rounded-xl border border-outline-variant/15 space-y-3">
                    <h4 className="text-[10px] font-medium text-outline uppercase tracking-wider flex items-center gap-1.5">
                      <Activity className="w-3 h-3 text-primary" />
                      主要风味物理变化对比
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      <div className="flex justify-between items-center bg-white dark:bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-outline-variant/5">
                        <span className="text-on-surface-variant font-medium text-[11px]">苦味 Bitter</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-outline line-through">{improvedResult.classic.rating.bitter}</span>
                          <span className="text-outline-variant">→</span>
                          <span className="font-medium text-green-600 font-mono">{improvedResult.improved.rating.bitter}</span>
                          <span className="text-[10px] font-mono text-green-500">({improvedResult.improved.rating.bitter < improvedResult.classic.rating.bitter ? "↓" : "平"})</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center bg-white dark:bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-outline-variant/5">
                        <span className="text-on-surface-variant font-medium text-[11px]">酒感 Alcohol</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-outline line-through">{improvedResult.classic.rating.alcohol}</span>
                          <span className="text-outline-variant">→</span>
                          <span className="font-medium text-green-600 font-mono">{improvedResult.improved.rating.alcohol}</span>
                          <span className="text-[10px] font-mono text-green-500">({improvedResult.improved.rating.alcohol < improvedResult.classic.rating.alcohol ? "↓" : "平"})</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center bg-white dark:bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-outline-variant/5">
                        <span className="text-on-surface-variant font-medium text-[11px]">清爽 Freshness</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-outline line-through">{improvedResult.classic.rating.fresh}</span>
                          <span className="text-outline-variant">→</span>
                          <span className="font-medium text-green-600 font-mono">{improvedResult.improved.rating.fresh}</span>
                          <span className="text-[10px] font-mono text-green-500">({improvedResult.improved.rating.fresh > improvedResult.classic.rating.fresh ? "↑" : "平"})</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center bg-white dark:bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-outline-variant/5">
                        <span className="text-on-surface-variant font-medium text-[11px]">甜度 Sweetness</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-outline line-through">{improvedResult.classic.rating.sweet}</span>
                          <span className="text-outline-variant">→</span>
                          <span className="font-medium text-green-600 font-mono">{improvedResult.improved.rating.sweet}</span>
                          <span className="text-[10px] font-mono text-green-500">({improvedResult.improved.rating.sweet > improvedResult.classic.rating.sweet ? "↑" : "平"})</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RECIPE INGREDIENTS WITH HIGHLY DESCRIPTIVE TRANSITIONS (Requested!) */}
                  <div className="bg-white dark:bg-zinc-950 p-4 rounded-xl border border-outline-variant/20 space-y-3 shadow-inner">
                    <h4 className="text-[10px] font-medium text-outline uppercase tracking-wider">重置配比公式</h4>
                    <div className="divide-y divide-outline-variant/10 space-y-2.5">
                      {improvedResult.improved.ingredients.map((ing: any, i: number) => {
                        const isAdded = ing.originalAmount === 0 || !ing.originalAmount;
                        const isDecreased = ing.originalAmount && ing.amount < ing.originalAmount;
                        const isIncreased = ing.originalAmount && ing.amount > ing.originalAmount && ing.changeType !== "replace";
                        const isReplaced = ing.changeType === "replace";

                        return (
                          <div key={i} className="pt-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs">
                            {/* Ingredient name */}
                            <span className="font-medium text-on-surface flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ing.color }}></span>
                              {ing.name}
                            </span>

                            {/* Dosage translation and changes */}
                            <div className="flex items-center flex-wrap gap-2 text-[11px]">
                              {/* transition view */}
                              <span className="font-mono bg-surface-container px-2 py-0.5 rounded text-outline-variant">
                                {isAdded ? (
                                  <span className="text-green-600 font-medium">新添 +{ing.amount}ml</span>
                                ) : isReplaced ? (
                                  <span className="text-blue-500 font-medium">平替 {ing.amount}ml (原 {ing.originalAmount}ml)</span>
                                ) : isDecreased ? (
                                  <span className="text-red-500 font-medium">{ing.originalAmount}ml → {ing.amount}ml ↓</span>
                                ) : isIncreased ? (
                                  <span className="text-green-600 font-medium">{ing.originalAmount}ml → {ing.amount}ml ↑</span>
                                ) : (
                                  <span>{ing.amount}ml (恒定)</span>
                                )}
                              </span>

                              {/* explanatory sub-tag */}
                              <span className="text-outline font-light text-[10px]">
                                {ing.reason}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Explainable Logic (为什么这样改) */}
                  <div className="space-y-1.5 bg-yellow-500/5 p-4 rounded-xl border border-yellow-500/10">
                    <h4 className="text-[10px] font-medium text-amber-700 dark:text-amber-500 uppercase tracking-wider flex items-center gap-1">
                      <Sparkle className="w-3.5 h-3.5 fill-amber-600" />
                      为什么这样改：
                    </h4>
                    <p className="text-xs text-on-surface-variant leading-relaxed font-light handwritten">
                      {improvedResult.improved.comments}
                    </p>
                  </div>

                  {/* ACTION BUTTONS */}
                  <div className="pt-4 border-t border-outline-variant/15 flex flex-col sm:flex-row gap-3 justify-end">
                    {onSaveDrinkLog && (
                      <DrinkLogButton
                        recipe={{
                          id: `classic-remix-${selectedClassicId}-${activeDirections.join("-") || "custom"}`,
                          nameZh: improvedResult.improved.name,
                          nameEn: improvedResult.improved.name,
                          description: improvedResult.improved.comments,
                          tags: improvedResult.improved.tags,
                          ingredients: improvedResult.improved.ingredients.map((ing: any) => ({
                            name: ing.name,
                            amount: ing.amount,
                            unit: "ml",
                          })),
                          method: improvedResult.improved.mixMethod === "Shake" ? "加冰摇合后倒入杯中。" : "加冰轻轻搅拌后饮用。",
                          sourcePage: "classic_remix",
                        }}
                        sourcePage="classic_remix"
                        drinkLogs={drinkLogs}
                        onSaveDrinkLog={onSaveDrinkLog}
                        variant="text"
                        className="w-full sm:w-auto"
                      />
                    )}
                    
                    {/* Add to Favorites */}
                    <button
                      onClick={handleSaveToFavorites}
                      className={`rounded-xl py-3 px-5 flex items-center justify-center gap-2 text-xs font-medium active:scale-[0.98] transition-all cursor-pointer border ${
                        saveSuccess 
                          ? "bg-green-600 border-green-600 text-white"
                          : "bg-surface-container-low hover:bg-surface-container border-outline-variant/30 text-on-surface"
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${saveSuccess ? "fill-white text-white animate-ping" : "text-red-500"}`} />
                      <span>{saveSuccess ? "已成功保存到我的档案！" : "保存到我的档案"}</span>
                    </button>

                    {/* Put into Lab */}
                    {onLoadToLab && (
                      <button
                        onClick={() => {
                          if (onLoadToLab && improvedResult.improved.ingredients) {
                            onLoadToLab(
                              improvedResult.improved.ingredients, 
                              improvedResult.improved.mixMethod === "Shake" ? "Shake" : "Stir"
                            );
                          }
                        }}
                        className="bg-black hover:bg-zinc-800 text-white rounded-xl py-3 px-6 flex items-center justify-center gap-2 text-xs font-medium active:scale-[0.98] transition-all cursor-pointer shadow-none"
                      >
                        <span className="material-symbols-outlined text-sm">science</span>
                        <span>放进实验室做真实风味实验</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                </div>
              ) : (
                <div className="py-24 flex flex-col items-center justify-center text-center space-y-2">
                  <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs text-outline font-light">正在计算黄金驯化比...</span>
                </div>
              )}
            </div>
            )}
        </div>
      </section>

      {/* Catalog Modal */}
      {showCatalogModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-on-background/40 backdrop-blur-md"
            onClick={() => setShowCatalogModal(false)}
          ></div>
          
          <div className="relative bg-surface-container-lowest w-full max-w-2xl h-[80vh] rounded-2xl overflow-hidden shadow-none border border-outline-variant/30 flex flex-col animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="p-6 border-b border-outline-variant/30 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-sm tracking-widest uppercase">
                    GRAND ARCHIVE
                  </span>
                  <span className="text-[10px] text-outline font-mono">{CLASSIC_DATABASE ? Object.keys(CLASSIC_DATABASE).length : 14} CLASSICS</span>
                </div>
                <h3 className="text-xl font-serif font-medium text-on-surface">全部经典调酒图鉴</h3>
                <p className="text-xs text-on-surface-variant font-light">
                  选择你想要改良驯化的经典酒款，定制更合口风味的低烈度高良率方案。
                </p>
              </div>
              <button
                onClick={() => setShowCatalogModal(false)}
                className="p-1.5 rounded-full hover:bg-surface-container-low text-outline hover:text-on-surface transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              {/* Category groupings */}
              {[
                {
                  category: "烈性干冽 Spirit-Forward",
                  description: "高酒感、纯粹、药本草本香，不加糖或极少糖，是经典鸡尾酒殿堂的坚实骨架。",
                  items: ["negroni", "old_fashioned", "martini", "manhattan"]
                },
                {
                  category: "酸甜清爽 Sour, Sweet & Fizz",
                  description: "果酸、甜感与清脆二氧化碳气泡的化学重组，清凉解暑，最容易进行好喝改良。",
                  items: ["gin_tonic", "mojito", "margarita", "whisky_sour", "moscow_mule", "daiquiri", "long_island"]
                },
                {
                  category: "风味醇厚 Rich, Creamy & Coffee",
                  description: "浓郁的烘焙咖啡油脂、热带椰奶乳香或者咸辣咸鲜番茄汁的特色交响乐。",
                  items: ["espresso_martini", "pina_colada", "bloody_mary"]
                }
              ].map((category) => (
                <div key={category.category} className="space-y-4">
                  <div className="space-y-1">
                    <h4 className="text-xs font-medium font-mono text-primary uppercase tracking-widest flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                      {category.category}
                    </h4>
                    <p className="text-[11px] text-outline font-light">{category.description}</p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {category.items.map((id) => {
                      const item = CLASSIC_DATABASE[id];
                      if (!item) return null;
                      const isSelected = selectedClassicId === item.id;
                      return (
                        <button
                          key={item.id}
                            onClick={() => {
                              setSelectedClassicId(item.id);
                              setShowCatalogModal(false);
                            }}
                          className={`p-4 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                            isSelected
                              ? "bg-black text-white border-black shadow-none scale-[1.02]"
                              : "bg-surface-container-low/50 border-outline-variant/20 hover:border-outline-variant hover:bg-surface-container-low"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl p-2 bg-surface-container-high rounded-lg">{item.icon}</span>
                            <div>
                              <div className="text-xs font-medium leading-tight">{item.name}</div>
                              <div className={`text-[10px] uppercase tracking-wider font-mono ${isSelected ? "text-white/60" : "text-outline"}`}>
                                {item.english}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            {isSelected ? (
                              <span className="text-[10px] font-medium bg-white/20 text-white px-2 py-0.5 rounded uppercase">
                                已选 ACTIVE
                              </span>
                            ) : (
                              <span className="material-symbols-outlined text-outline text-sm group-hover:translate-x-1 transition-transform">
                                arrow_forward
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Footer */}
            <div className="p-4 bg-surface-container-low/40 border-t border-outline-variant/20 text-center">
              <p className="text-[10px] text-outline font-light">
                如果你发现其他不好入口的经典酒，可以点击助手气泡询问补救建议。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
