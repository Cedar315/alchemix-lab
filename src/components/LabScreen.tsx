import React, { useState, useEffect } from "react";
import { Cocktail, DrinkLog, DrinkLogRecipeSnapshot, SavedCocktail, Ingredient } from "../types";
import { CONVENIENCE_DRINK_INGREDIENTS, ConvenienceDrinkSeed } from "../lib/data/convenience-drink-ingredients";
import { JUICE_INGREDIENTS, JuiceIngredientSeed } from "../lib/data/juice-ingredients";
import { analyzeMixologyRecipe } from "../lib/mixology/engine";
import { AnalyticsEventInput } from "../lib/analytics";
import { DrinkLogButton } from "./DrinkLog";
import { 
  Beaker, 
  Sparkles, 
  Plus, 
  Trash2, 
  RotateCcw, 
  Camera, 
  Check, 
  HelpCircle, 
  Activity, 
  X, 
  ArrowRight,
  Bookmark,
  ChevronRight,
  Info,
  Search,
  Database
} from "lucide-react";

interface LabScreenProps {
  onSaveCocktail: (cocktail: SavedCocktail) => void;
  drinkLogs?: DrinkLog[];
  onSaveDrinkLog?: (log: DrinkLog) => void;
  initialIngredients?: { name: string; amount: number; category: string; color: string; isBubbly?: boolean }[];
  initialMixMethod?: "Stir" | "Shake";
  onClearInitial?: () => void;
  onTrackEvent?: (event: AnalyticsEventInput) => void;
}

interface LabIngredient {
  id: string;
  name: string;
  amount: number; // in ml
  category: string;
  color: string;
  isBubbly?: boolean;
  abv?: number;
  sweetness?: number;
  acidity?: number;
  bitterness?: number;
  carbonation?: number;
  viscosity?: number;
  dairy?: number;
  tea?: number;
  fruit?: number;
  freshness?: number;
  sugarGPer100ml?: number | null;
  caffeineMgPer100ml?: number | null;
  caffeine?: boolean | null;
  flavorTags?: string[];
  mainComponents?: string[];
  goodWith?: string[];
  riskyWith?: string[];
}

type LibraryMode = "alcohol" | "nonAlcohol";
type AbvRange = "0-10" | "10-20" | "20-40" | "40+";

interface LibraryIngredient extends Ingredient {
  englishName: string;
  type: string;
  recommendedAmount: number;
  availability: string;
  mainComponents: string[];
  pairingGood: string[];
  pairingRisky: string[];
  libraryMode: LibraryMode;
  abvRange?: AbvRange;
  libraryCategory: string;
  color: string;
  juiceData?: JuiceIngredientSeed;
  aliases?: string[];
  convenienceData?: ConvenienceDrinkSeed;
}

const abvRangeLabel: Record<AbvRange, string> = {
  "0-10": "0-10%",
  "10-20": "10-20%",
  "20-40": "20-40%",
  "40+": "40%+",
};

function MixingActionAnimation({ method }: { method: "Stir" | "Shake" }) {
  if (method === "Shake") {
    return (
      <div className="mixing-action mixing-action--shake" aria-hidden="true">
        <div className="load-drops">
          <span className="drop drop-a"></span>
          <span className="drop drop-b"></span>
          <span className="drop drop-c"></span>
        </div>
        <div className="shake-lines shake-lines-left">
          <span></span>
          <span></span>
        </div>
        <div className="shake-lines shake-lines-right">
          <span></span>
          <span></span>
        </div>
        <div className="cartoon-hand cartoon-hand-left">
          <span className="thumb"></span>
          <span className="finger finger-one"></span>
          <span className="finger finger-two"></span>
        </div>
        <div className="cartoon-hand cartoon-hand-right">
          <span className="thumb"></span>
          <span className="finger finger-one"></span>
          <span className="finger finger-two"></span>
        </div>
        <div className="shaker">
          <div className="shaker-cap"></div>
          <div className="shaker-body">
            <span className="shaker-shine"></span>
            <span className="shaker-liquid"></span>
          </div>
          <div className="shaker-base"></div>
        </div>
        <style jsx>{`
          .mixing-action {
            position: relative;
            width: 118px;
            height: 136px;
            transform: scale(0.92);
          }
          .shaker {
            position: absolute;
            left: 39px;
            top: 31px;
            width: 42px;
            height: 82px;
            transform-origin: center;
            animation: shaker-swing 0.7s ease-in-out infinite;
            z-index: 3;
          }
          .shaker-cap {
            width: 28px;
            height: 16px;
            margin: 0 auto -2px;
            border: 2px solid rgba(38, 38, 38, 0.7);
            border-bottom: 0;
            border-radius: 12px 12px 5px 5px;
            background: linear-gradient(180deg, #ffffff, #d9f0ff);
          }
          .shaker-body {
            position: relative;
            width: 42px;
            height: 58px;
            border: 2px solid rgba(38, 38, 38, 0.72);
            border-radius: 14px 14px 18px 18px;
            overflow: hidden;
            background: linear-gradient(115deg, #f8fbff 0%, #dff4ff 48%, #ffffff 100%);
            box-shadow: inset -8px 0 12px rgba(14, 165, 233, 0.12);
          }
          .shaker-liquid {
            position: absolute;
            left: 3px;
            right: 3px;
            bottom: 4px;
            height: 23px;
            border-radius: 10px 10px 15px 15px;
            background: linear-gradient(90deg, #facc15, #fb7185, #38bdf8);
            opacity: 0.82;
            animation: liquid-tilt 0.7s ease-in-out infinite;
          }
          .shaker-shine {
            position: absolute;
            left: 8px;
            top: 9px;
            width: 5px;
            height: 33px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.72);
            z-index: 2;
          }
          .shaker-base {
            width: 32px;
            height: 9px;
            margin: -1px auto 0;
            border: 2px solid rgba(38, 38, 38, 0.65);
            border-top: 0;
            border-radius: 0 0 14px 14px;
            background: #e0f2fe;
          }
          .cartoon-hand {
            position: absolute;
            top: 65px;
            width: 39px;
            height: 24px;
            border: 2px solid rgba(38, 38, 38, 0.7);
            background: #ffd9bd;
            box-shadow: inset -4px -3px 0 rgba(251, 146, 60, 0.15);
            z-index: 4;
            animation: hand-shake 0.7s ease-in-out infinite;
          }
          .cartoon-hand-left {
            left: 8px;
            border-radius: 16px 9px 9px 16px;
          }
          .cartoon-hand-right {
            right: 8px;
            border-radius: 9px 16px 16px 9px;
            animation-delay: -0.06s;
          }
          .thumb,
          .finger {
            position: absolute;
            display: block;
            background: #ffd9bd;
            border: 2px solid rgba(38, 38, 38, 0.62);
          }
          .cartoon-hand-left .thumb {
            right: -6px;
            top: -7px;
            width: 14px;
            height: 14px;
            border-radius: 9px;
            transform: rotate(35deg);
          }
          .cartoon-hand-right .thumb {
            left: -6px;
            top: -7px;
            width: 14px;
            height: 14px;
            border-radius: 9px;
            transform: rotate(-35deg);
          }
          .finger {
            width: 12px;
            height: 9px;
            border-radius: 999px;
            border-top: 0;
          }
          .cartoon-hand-left .finger-one {
            right: -6px;
            bottom: 3px;
          }
          .cartoon-hand-left .finger-two {
            right: -5px;
            bottom: 12px;
          }
          .cartoon-hand-right .finger-one {
            left: -6px;
            bottom: 3px;
          }
          .cartoon-hand-right .finger-two {
            left: -5px;
            bottom: 12px;
          }
          .load-drops span {
            position: absolute;
            top: 5px;
            width: 9px;
            height: 9px;
            border-radius: 999px 999px 999px 2px;
            transform: rotate(-45deg);
            opacity: 0;
            z-index: 2;
            animation: load-drop 1.4s ease-in-out infinite;
          }
          .drop-a {
            left: 44px;
            background: #facc15;
          }
          .drop-b {
            left: 58px;
            background: #fb7185;
            animation-delay: 0.18s !important;
          }
          .drop-c {
            left: 72px;
            background: #38bdf8;
            animation-delay: 0.34s !important;
          }
          .shake-lines {
            position: absolute;
            top: 43px;
            width: 20px;
            height: 48px;
            z-index: 1;
            opacity: 0.75;
          }
          .shake-lines-left {
            left: 0;
          }
          .shake-lines-right {
            right: 0;
          }
          .shake-lines span {
            display: block;
            height: 3px;
            margin: 12px 0;
            border-radius: 999px;
            background: rgba(38, 38, 38, 0.45);
            animation: shake-line 0.7s ease-in-out infinite;
          }
          .shake-lines span:nth-child(2) {
            width: 13px;
            animation-delay: -0.18s;
          }
          @keyframes shaker-swing {
            0%,
            100% {
              transform: translateX(-2px) rotate(-13deg);
            }
            50% {
              transform: translateX(2px) rotate(13deg);
            }
          }
          @keyframes hand-shake {
            0%,
            100% {
              transform: translateX(-2px) translateY(1px);
            }
            50% {
              transform: translateX(2px) translateY(-1px);
            }
          }
          @keyframes liquid-tilt {
            0%,
            100% {
              transform: rotate(8deg) translateY(1px);
            }
            50% {
              transform: rotate(-8deg) translateY(-1px);
            }
          }
          @keyframes load-drop {
            0% {
              opacity: 0;
              transform: translateY(-12px) rotate(-45deg) scale(0.7);
            }
            18% {
              opacity: 1;
            }
            42% {
              opacity: 1;
              transform: translateY(27px) rotate(-45deg) scale(1);
            }
            58%,
            100% {
              opacity: 0;
              transform: translateY(36px) rotate(-45deg) scale(0.75);
            }
          }
          @keyframes shake-line {
            0%,
            100% {
              width: 18px;
              transform: translateX(0);
            }
            50% {
              width: 10px;
              transform: translateX(5px);
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="mixing-action mixing-action--stir" aria-hidden="true">
      <div className="stir-glow"></div>
      <div className="stir-tool">
        <div className="stir-stick"></div>
        <div className="stir-hand">
          <span className="sleeve"></span>
          <span className="palm"></span>
          <span className="finger finger-one"></span>
          <span className="finger finger-two"></span>
          <span className="finger finger-three"></span>
        </div>
      </div>
      <div className="mini-beaker">
        <div className="mini-liquid">
          <span className="swirl swirl-one"></span>
          <span className="swirl swirl-two"></span>
          <span className="bubble bubble-one"></span>
          <span className="bubble bubble-two"></span>
        </div>
      </div>
      <style jsx>{`
        .mixing-action {
          position: relative;
          width: 118px;
          height: 136px;
          transform: scale(0.9);
        }
        .stir-glow {
          position: absolute;
          left: 16px;
          right: 16px;
          bottom: 8px;
          height: 48px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(250, 204, 21, 0.18), transparent 68%);
        }
        .mini-beaker {
          position: absolute;
          left: 30px;
          bottom: 17px;
          width: 58px;
          height: 74px;
          border: 2px solid rgba(38, 38, 38, 0.65);
          border-top: 0;
          border-radius: 0 0 22px 22px;
          background: rgba(255, 255, 255, 0.48);
          overflow: hidden;
          z-index: 2;
          box-shadow: inset 0 -8px 14px rgba(255, 255, 255, 0.45);
        }
        .mini-beaker:before {
          content: "";
          position: absolute;
          left: 7px;
          right: 7px;
          top: -4px;
          height: 10px;
          border: 2px solid rgba(38, 38, 38, 0.45);
          border-radius: 999px;
          background: white;
        }
        .mini-liquid {
          position: absolute;
          left: 5px;
          right: 5px;
          bottom: 5px;
          height: 43px;
          border-radius: 10px 10px 18px 18px;
          background: linear-gradient(135deg, rgba(251, 191, 36, 0.92), rgba(251, 113, 133, 0.82), rgba(56, 189, 248, 0.72));
          overflow: hidden;
          animation: stir-liquid 1.05s ease-in-out infinite;
        }
        .swirl {
          position: absolute;
          left: 9px;
          top: 12px;
          width: 33px;
          height: 13px;
          border: 3px solid rgba(255, 255, 255, 0.55);
          border-left-color: transparent;
          border-right-color: transparent;
          border-radius: 999px;
          animation: swirl-spin 0.9s linear infinite;
        }
        .swirl-two {
          left: 16px;
          top: 22px;
          width: 20px;
          height: 8px;
          opacity: 0.75;
          animation-direction: reverse;
        }
        .bubble {
          position: absolute;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.58);
          animation: bubble-rise 1.3s ease-in infinite;
        }
        .bubble-one {
          left: 14px;
          bottom: 4px;
          width: 6px;
          height: 6px;
        }
        .bubble-two {
          right: 13px;
          bottom: 10px;
          width: 4px;
          height: 4px;
          animation-delay: 0.45s;
        }
        .stir-tool {
          position: absolute;
          left: 43px;
          top: 19px;
          width: 48px;
          height: 88px;
          z-index: 6;
          transform-origin: 16px 80px;
          animation: stir-tool 0.82s ease-in-out infinite;
        }
        .stir-stick {
          position: absolute;
          left: 14px;
          top: 0;
          width: 5px;
          height: 88px;
          border-radius: 999px;
          background: linear-gradient(180deg, #4b5563, #9ca3af);
          z-index: 5;
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.35);
        }
        .stir-hand {
          position: absolute;
          left: 3px;
          top: 6px;
          width: 44px;
          height: 34px;
          z-index: 7;
        }
        .sleeve {
          position: absolute;
          top: 7px;
          width: 18px;
          height: 20px;
          border-radius: 999px;
          background: #dbeafe;
          border: 2px solid rgba(38, 38, 38, 0.56);
        }
        .stir-hand .sleeve {
          right: -2px;
        }
        .palm,
        .finger {
          position: absolute;
          display: block;
          background: #ffd9bd;
          border: 2px solid rgba(38, 38, 38, 0.62);
          box-shadow: inset -3px -2px 0 rgba(251, 146, 60, 0.14);
        }
        .palm {
          top: 5px;
          width: 30px;
          height: 25px;
          border-radius: 15px 11px 13px 15px;
        }
        .stir-hand .palm {
          right: 11px;
          transform: rotate(-11deg);
        }
        .finger {
          width: 18px;
          height: 8px;
          border-radius: 999px;
          z-index: 8;
        }
        .stir-hand .finger-one {
          left: 4px;
          top: 8px;
          transform: rotate(-8deg);
        }
        .stir-hand .finger-two {
          left: 3px;
          top: 17px;
          transform: rotate(2deg);
        }
        .stir-hand .finger-three {
          left: 6px;
          top: 25px;
          width: 15px;
          transform: rotate(8deg);
        }
        @keyframes stir-tool {
          0%,
          100% {
            transform: rotate(-15deg) translateX(-1px);
          }
          50% {
            transform: rotate(16deg) translateX(1px);
          }
        }
        @keyframes stir-liquid {
          0%,
          100% {
            transform: skewX(-5deg);
          }
          50% {
            transform: skewX(5deg) translateY(1px);
          }
        }
        @keyframes swirl-spin {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes bubble-rise {
          0% {
            opacity: 0;
            transform: translateY(8px) scale(0.7);
          }
          25% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateY(-24px) scale(1.1);
          }
        }
      `}</style>
    </div>
  );
}

const createLibraryIngredient = (item: {
  id: string;
  name: string;
  englishName: string;
  type: string;
  libraryMode: LibraryMode;
  libraryCategory: string;
  abv?: number;
  abvRange?: AbvRange;
  recommendedAmount: number;
  availability: string;
  mainComponents: string[];
  flavorTags: string[];
  pairingGood: string[];
  pairingRisky: string[];
  color: string;
  sweetness?: number;
  acidity?: number;
  bitterness?: number;
  carbonation?: number;
  body?: number;
  dairy?: number;
  tea?: number;
  fruit?: number;
  freshness?: number;
}): LibraryIngredient => {
  const sweetness = item.sweetness ?? 1;
  const acidity = item.acidity ?? 1;
  const bitterness = item.bitterness ?? 1;
  const carbonation = item.carbonation ?? 0;
  const body = item.body ?? 2;
  const dairy = item.dairy ?? 0;
  const tea = item.tea ?? 0;
  const fruit = item.fruit ?? 0;
  const freshness = item.freshness ?? 2;

  return {
    id: item.id,
    name: item.name,
    englishName: item.englishName,
    brand: "",
    category: item.type,
    type: item.type,
    libraryMode: item.libraryMode,
    libraryCategory: item.libraryCategory,
    abv: item.abv ?? 0,
    abvRange: item.abvRange,
    recommendedAmount: item.recommendedAmount,
    availability: item.availability,
    mainComponents: item.mainComponents,
    pairingGood: item.pairingGood,
    pairingRisky: item.pairingRisky,
    color: item.color,
    ingredientsText: item.mainComponents.join("、"),
    flavorProfile: {
      sweetness,
      acidity,
      bitterness,
      carbonation,
      dairy,
      tea,
      fruit,
      body,
      freshness,
    },
    sweetness,
    acidity,
    bitterness,
    carbonation,
    body,
    viscosity: body,
    dairyFeeling: dairy,
    alcoholFeel: Math.min(5, Math.round(((item.abv ?? 0) / 45) * 5)),
    notes: `${item.name} / ${item.englishName}`,
    nutritionText: "本地原型数据库估算",
    flavorTags: item.flavorTags,
    dominantCompounds: item.mainComponents,
    textureTags: carbonation >= 3 ? ["气泡"] : body >= 4 ? ["厚重"] : ["轻盈"],
    aromaTags: item.flavorTags,
    goodWith: item.pairingGood,
    riskyWith: item.pairingRisky,
    dataSource: "preset",
    confidence: 0.92,
    createdAt: "2026-07-07",
  };
};

const juiceToLibraryIngredient = (item: JuiceIngredientSeed): LibraryIngredient => ({
  id: item.id,
  name: `${item.nameZh} ${item.nameEn}`,
  englishName: item.nameEn,
  brand: "",
  category: item.category,
  type: item.subCategory,
  libraryMode: "nonAlcohol",
  libraryCategory: "果汁",
  abv: item.abv,
  recommendedAmount: item.recommendedVolumeMl[1] ?? item.recommendedVolumeMl[0] ?? 60,
  availability: `${item.convenienceStoreAvailability}/5`,
  mainComponents: item.ingredients,
  pairingGood: item.suitableWith,
  pairingRisky: item.avoidWith,
  color: item.carbonation > 0
    ? "rgba(224, 242, 254, 0.34)"
    : item.acidity >= 4.5
      ? "rgba(234, 179, 8, 0.58)"
      : item.sweetness >= 4
        ? "rgba(251, 191, 36, 0.48)"
        : "rgba(253, 224, 71, 0.42)",
  source: item.confidence === "estimated" ? "ai_generated" : "official",
  ingredientsText: item.ingredients.join("、"),
  nutrition: {
    sugar_g_per_100ml: item.sugarGPer100ml ?? undefined,
  },
  flavorProfile: {
    sweetness: item.sweetness,
    acidity: item.acidity,
    bitterness: item.bitterness,
    carbonation: item.carbonation,
    dairy: item.flavorTags.some((tag) => tag.includes("奶")) ? 3 : 0,
    tea: item.flavorTags.some((tag) => tag.includes("茶")) ? 3 : 0,
    fruit: 5,
    body: item.viscosity,
    freshness: item.acidity >= 4 || item.carbonation > 0 ? 5 : 3,
  },
  sweetness: item.sweetness,
  acidity: item.acidity,
  bitterness: item.bitterness,
  carbonation: item.carbonation,
  body: item.viscosity,
  viscosity: item.viscosity,
  dairyFeeling: item.flavorTags.some((tag) => tag.includes("奶")) ? 3 : 0,
  alcoholFeel: 0,
  notes: item.sourceNote,
  nutritionText: item.sugarGPer100ml === null
    ? `Sugar reference unavailable; ${item.confidence}`
    : `Sugar ${item.sugarGPer100ml}g / 100ml · pH ${item.pHRange ?? "n/a"}`,
  flavorTags: item.flavorTags,
  dominantCompounds: item.dominantCompounds,
  textureTags: item.carbonation >= 2 ? ["气泡"] : item.viscosity >= 4 ? ["厚重"] : ["果汁"],
  aromaTags: item.flavorTags,
  goodWith: item.suitableWith,
  riskyWith: item.avoidWith,
  dataSource: item.confidence === "estimated" ? "ai_estimate" : "preset",
  confidence: item.confidence === "high" ? 0.95 : item.confidence === "medium" ? 0.82 : 0.68,
  createdAt: "2026-07-07",
  juiceData: item,
});

const colorForDrinkCategory = (category: string, carbonation: number, sweetness: number) => {
  if (category.includes("茶")) return "rgba(146, 64, 14, 0.42)";
  if (category.includes("咖啡")) return "rgba(87, 83, 78, 0.56)";
  if (category.includes("乳") || category.includes("奶")) return "rgba(244, 219, 214, 0.82)";
  if (category.includes("功能")) return "rgba(250, 204, 21, 0.48)";
  if (category.includes("酒")) return "rgba(248, 113, 113, 0.42)";
  if (carbonation >= 3) return "rgba(186, 230, 253, 0.34)";
  if (sweetness >= 4) return "rgba(251, 191, 36, 0.45)";
  return "rgba(224, 242, 254, 0.32)";
};

const convenienceDrinkToLibraryIngredient = (item: ConvenienceDrinkSeed): LibraryIngredient => ({
  id: `cv-${item.slug}`,
  name: `${item.nameZh} ${item.nameEn}`,
  englishName: item.nameEn,
  brand: item.brand ?? "",
  category: item.category,
  type: item.subCategory,
  libraryMode: item.type === "alcohol" || (item.abv ?? 0) > 0 ? "alcohol" : "nonAlcohol",
  libraryCategory: item.category,
  abv: item.abv ?? 0,
  abvRange: (item.abv ?? 0) < 10 ? "0-10" : (item.abv ?? 0) < 20 ? "10-20" : (item.abv ?? 0) < 40 ? "20-40" : "40+",
  recommendedAmount: item.recommendedVolumeMl[1] ?? item.recommendedVolumeMl[0] ?? 90,
  availability: `${item.convenienceStoreAvailability}/5`,
  mainComponents: item.ingredients,
  pairingGood: item.suitableWith,
  pairingRisky: item.avoidWith,
  color: colorForDrinkCategory(item.category, item.carbonation, item.sweetness),
  source: item.confidence === "estimated" ? "ai_generated" : "official",
  ingredientsText: item.ingredients.join("、"),
  nutrition: {
    sugar_g_per_100ml: item.sugarGPer100ml ?? undefined,
    caffeine_mg_per_100ml: item.caffeine ? 20 : undefined,
  },
  flavorProfile: {
    sweetness: item.sweetness,
    acidity: item.acidity,
    bitterness: item.bitterness,
    carbonation: item.carbonation,
    dairy: item.category.includes("乳") || item.category.includes("奶") ? 4 : 0,
    tea: item.category.includes("茶") ? 4 : 0,
    fruit: item.flavorTags.some((tag) => ["果", "柠檬", "橙", "蜜桃", "西柚"].some((word) => tag.includes(word))) ? 4 : 1,
    body: item.viscosity,
    freshness: item.carbonation >= 3 || item.acidity >= 3 ? 4 : 2,
  },
  sweetness: item.sweetness,
  acidity: item.acidity,
  bitterness: item.bitterness,
  carbonation: item.carbonation,
  body: item.viscosity,
  viscosity: item.viscosity,
  dairyFeeling: item.category.includes("乳") || item.category.includes("奶") ? 4 : 0,
  alcoholFeel: Math.min(5, Math.round(((item.abv ?? 0) / 45) * 5)),
  notes: item.sourceNote,
  nutritionText: item.sugarGPer100ml === null || item.sugarGPer100ml === undefined
    ? `${item.confidence} · 请以包装配料表为准`
    : `Sugar ${item.sugarGPer100ml}g / 100ml · ${item.caffeine ? "含咖啡因" : "无咖啡因"}`,
  flavorTags: item.flavorTags,
  dominantCompounds: item.ingredients,
  textureTags: item.carbonation >= 2 ? ["气泡"] : item.viscosity >= 3 ? ["厚重"] : ["便利店饮料"],
  aromaTags: item.flavorTags,
  goodWith: item.suitableWith,
  riskyWith: item.avoidWith,
  dataSource: item.confidence === "estimated" ? "ai_estimate" : "preset",
  confidence: item.confidence === "high" ? 0.95 : item.confidence === "medium" ? 0.82 : 0.68,
  createdAt: "2026-07-08",
  aliases: item.aliases,
  convenienceData: item,
});

const alcoholLibrary: LibraryIngredient[] = [
  createLibraryIngredient({ id: "alc-beer", name: "啤酒", englishName: "Beer", type: "低度发酵酒", libraryMode: "alcohol", libraryCategory: "Beer", abv: 5, abvRange: "0-10", recommendedAmount: 120, availability: "高：便利店/超市常见", mainComponents: ["麦芽", "啤酒花", "酵母", "水"], flavorTags: ["麦芽", "气泡", "微苦"], pairingGood: ["柑橘", "番茄汁", "姜汁汽水"], pairingRisky: ["厚奶", "高糖乳饮"], color: "rgba(245, 158, 11, 0.45)", sweetness: 1, bitterness: 3, carbonation: 4, body: 2 }),
  createLibraryIngredient({ id: "alc-cider", name: "苹果酒", englishName: "Cider", type: "果酒", libraryMode: "alcohol", libraryCategory: "Cider", abv: 5, abvRange: "0-10", recommendedAmount: 120, availability: "中：大型便利店/酒类货架", mainComponents: ["苹果汁", "酵母", "糖分", "二氧化碳"], flavorTags: ["苹果", "清甜", "气泡"], pairingGood: ["肉桂", "柠檬", "苏打水"], pairingRisky: ["浓咖啡", "草本苦味"], color: "rgba(251, 191, 36, 0.42)", sweetness: 3, acidity: 2, carbonation: 4, fruit: 4, freshness: 4 }),
  createLibraryIngredient({ id: "alc-hard-seltzer", name: "酒精气泡水", englishName: "Hard Seltzer", type: "低度气泡酒饮", libraryMode: "alcohol", libraryCategory: "Hard Seltzer", abv: 5, abvRange: "0-10", recommendedAmount: 120, availability: "中：便利店逐渐常见", mainComponents: ["酒精", "气泡水", "天然香精"], flavorTags: ["轻盈", "气泡", "低甜"], pairingGood: ["西柚", "青柠", "莓果"], pairingRisky: ["高脂奶类", "浓糖浆"], color: "rgba(224, 242, 254, 0.38)", sweetness: 1, acidity: 1, carbonation: 5, freshness: 5 }),
  createLibraryIngredient({ id: "alc-wine", name: "葡萄酒", englishName: "Wine", type: "葡萄发酵酒", libraryMode: "alcohol", libraryCategory: "Wine", abv: 13, abvRange: "10-20", recommendedAmount: 90, availability: "中高：超市/酒类货架", mainComponents: ["葡萄汁", "酵母", "单宁", "有机酸"], flavorTags: ["果香", "单宁", "酸感"], pairingGood: ["苏打水", "柑橘", "莓果"], pairingRisky: ["乳酸饮料", "重咖啡"], color: "rgba(190, 24, 74, 0.5)", sweetness: 2, acidity: 3, bitterness: 2, fruit: 4, body: 3 }),
  createLibraryIngredient({ id: "alc-sake", name: "清酒", englishName: "Sake", type: "米酿造酒", libraryMode: "alcohol", libraryCategory: "Sake", abv: 15, abvRange: "10-20", recommendedAmount: 60, availability: "中：日式便利店/酒铺", mainComponents: ["米", "米曲", "水", "酵母"], flavorTags: ["米香", "柔和", "鲜味"], pairingGood: ["柚子", "乌龙茶", "苏打水"], pairingRisky: ["高酸果醋", "重苦草本"], color: "rgba(241, 245, 249, 0.55)", sweetness: 2, acidity: 1, body: 3 }),
  createLibraryIngredient({ id: "alc-soju", name: "烧酒", englishName: "Soju", type: "亚洲蒸馏酒", libraryMode: "alcohol", libraryCategory: "Soju", abv: 16, abvRange: "10-20", recommendedAmount: 60, availability: "中高：韩式便利店/超市", mainComponents: ["蒸馏酒精", "水", "甜味剂"], flavorTags: ["干净", "微甜", "轻酒感"], pairingGood: ["养乐多", "西瓜汁", "苏打水"], pairingRisky: ["高苦味利口", "厚奶油"], color: "rgba(186, 230, 253, 0.36)", sweetness: 2, freshness: 3 }),
  createLibraryIngredient({ id: "alc-umeshu", name: "梅酒", englishName: "Umeshu", type: "果味浸泡酒", libraryMode: "alcohol", libraryCategory: "Umeshu", abv: 12, abvRange: "10-20", recommendedAmount: 45, availability: "中：日式货架/酒铺", mainComponents: ["青梅", "糖", "烧酒", "有机酸"], flavorTags: ["梅子", "甜酸", "圆润"], pairingGood: ["苏打水", "乌龙茶", "柠檬"], pairingRisky: ["甜糖浆", "厚乳饮"], color: "rgba(245, 158, 11, 0.44)", sweetness: 4, acidity: 3, fruit: 4, body: 3 }),
  createLibraryIngredient({ id: "alc-vermouth", name: "威末酒", englishName: "Vermouth", type: "加香葡萄酒", libraryMode: "alcohol", libraryCategory: "Vermouth", abv: 16, abvRange: "10-20", recommendedAmount: 30, availability: "中低：酒铺/大型超市", mainComponents: ["葡萄酒", "草本", "糖", "苦味植物"], flavorTags: ["草本", "酒香", "微苦"], pairingGood: ["金酒", "苏打水", "橙皮"], pairingRisky: ["乳酸饮料", "热带高甜果汁"], color: "rgba(180, 83, 9, 0.34)", sweetness: 2, bitterness: 3, body: 3 }),
  createLibraryIngredient({ id: "alc-liqueur", name: "利口酒", englishName: "Liqueur", type: "甜味调味酒", libraryMode: "alcohol", libraryCategory: "Liqueur", abv: 25, abvRange: "20-40", recommendedAmount: 15, availability: "中低：酒铺常见", mainComponents: ["蒸馏酒", "糖", "水果/香草浸泡物"], flavorTags: ["甜", "香气强", "调味"], pairingGood: ["咖啡", "奶类", "烈酒"], pairingRisky: ["高甜饮料", "低酸果汁"], color: "rgba(217, 119, 6, 0.46)", sweetness: 5, body: 4 }),
  createLibraryIngredient({ id: "alc-aperol", name: "阿佩罗 / 金巴利 / 阿玛罗", englishName: "Aperol / Campari / Amaro", type: "苦味开胃酒", libraryMode: "alcohol", libraryCategory: "Aperol / Campari / Amaro", abv: 24, abvRange: "20-40", recommendedAmount: 30, availability: "中低：酒铺/部分超市", mainComponents: ["苦橙", "龙胆", "草本", "糖"], flavorTags: ["苦橙", "草本", "开胃"], pairingGood: ["苏打水", "葡萄柚", "起泡酒"], pairingRisky: ["乳酸饮料", "奶茶"], color: "rgba(249, 115, 22, 0.55)", sweetness: 3, bitterness: 5, acidity: 2 }),
  createLibraryIngredient({ id: "alc-vodka", name: "伏特加", englishName: "Vodka", type: "中性烈酒", libraryMode: "alcohol", libraryCategory: "Vodka", abv: 40, abvRange: "40+", recommendedAmount: 30, availability: "高：酒铺/超市常见", mainComponents: ["谷物/马铃薯酒精", "水"], flavorTags: ["干净", "高酒精", "中性"], pairingGood: ["蔓越莓", "橙汁", "苏打水"], pairingRisky: ["过量苦味", "低酸高糖"], color: "rgba(186, 230, 253, 0.3)", freshness: 3 }),
  createLibraryIngredient({ id: "alc-gin", name: "金酒", englishName: "Gin", type: "杜松子烈酒", libraryMode: "alcohol", libraryCategory: "Gin", abv: 42, abvRange: "40+", recommendedAmount: 30, availability: "高：酒铺/大型超市", mainComponents: ["中性酒精", "杜松子", "柑橘皮", "香料"], flavorTags: ["杜松", "草本", "柑橘"], pairingGood: ["汤力水", "黄瓜", "柠檬"], pairingRisky: ["厚奶", "重咖啡"], color: "rgba(148, 163, 184, 0.45)", bitterness: 2, freshness: 4 }),
  createLibraryIngredient({ id: "alc-rum", name: "朗姆", englishName: "Rum", type: "甘蔗烈酒", libraryMode: "alcohol", libraryCategory: "Rum", abv: 40, abvRange: "40+", recommendedAmount: 30, availability: "中高：酒铺常见", mainComponents: ["甘蔗糖蜜", "酵母", "橡木桶风味"], flavorTags: ["甘蔗", "焦糖", "热带"], pairingGood: ["可乐", "菠萝", "椰奶"], pairingRisky: ["强茶涩", "高苦味草本"], color: "rgba(180, 83, 9, 0.4)", sweetness: 2, body: 3 }),
  createLibraryIngredient({ id: "alc-whisky", name: "威士忌", englishName: "Whisky", type: "谷物桶陈烈酒", libraryMode: "alcohol", libraryCategory: "Whisky", abv: 43, abvRange: "40+", recommendedAmount: 30, availability: "高：酒铺/超市常见", mainComponents: ["麦芽/谷物", "橡木桶内酯", "焦糖化风味"], flavorTags: ["橡木", "烟熏", "麦芽"], pairingGood: ["苏打水", "姜汁汽水", "乌龙茶"], pairingRisky: ["高酸乳饮", "过甜果汁"], color: "rgba(217, 119, 6, 0.48)", bitterness: 2, body: 4 }),
  createLibraryIngredient({ id: "alc-tequila", name: "龙舌兰", englishName: "Tequila", type: "龙舌兰烈酒", libraryMode: "alcohol", libraryCategory: "Tequila", abv: 40, abvRange: "40+", recommendedAmount: 30, availability: "中：酒铺常见", mainComponents: ["蓝色龙舌兰", "发酵糖", "矿物风味"], flavorTags: ["植物", "胡椒", "矿物"], pairingGood: ["青柠", "西柚", "苏打水"], pairingRisky: ["厚乳饮", "深烘咖啡"], color: "rgba(250, 204, 21, 0.35)", acidity: 1, freshness: 4 }),
  createLibraryIngredient({ id: "alc-mezcal", name: "梅斯卡尔", englishName: "Mezcal", type: "烟熏龙舌兰烈酒", libraryMode: "alcohol", libraryCategory: "Mezcal", abv: 43, abvRange: "40+", recommendedAmount: 20, availability: "低：专业酒铺", mainComponents: ["龙舌兰", "烟熏酚类", "矿物风味"], flavorTags: ["烟熏", "矿物", "植物"], pairingGood: ["西柚", "菠萝", "辣椒盐"], pairingRisky: ["奶类", "精致花香茶"], color: "rgba(120, 113, 108, 0.42)", bitterness: 2, body: 3 }),
  createLibraryIngredient({ id: "alc-brandy", name: "白兰地 / 干邑", englishName: "Brandy / Cognac", type: "葡萄蒸馏烈酒", libraryMode: "alcohol", libraryCategory: "Brandy / Cognac", abv: 40, abvRange: "40+", recommendedAmount: 30, availability: "中：酒铺常见", mainComponents: ["葡萄蒸馏酒", "橡木桶", "酯类果香"], flavorTags: ["葡萄干", "橡木", "暖香料"], pairingGood: ["咖啡", "苹果汁", "姜汁汽水"], pairingRisky: ["高酸乳饮", "草本苦酒过量"], color: "rgba(146, 64, 14, 0.45)", sweetness: 2, body: 4 }),
  createLibraryIngredient({ id: "alc-baijiu", name: "白酒", englishName: "Baijiu", type: "中国蒸馏烈酒", libraryMode: "alcohol", libraryCategory: "Baijiu", abv: 52, abvRange: "40+", recommendedAmount: 15, availability: "中高：中式超市/酒铺", mainComponents: ["高粱/粮谷", "酒曲", "酯类香气"], flavorTags: ["酱香/浓香", "高酒精", "穿透"], pairingGood: ["酸梅汤", "乌龙茶", "柑橘"], pairingRisky: ["奶类", "轻花果汁"], color: "rgba(241, 245, 249, 0.42)", bitterness: 2, body: 4 }),
  createLibraryIngredient({ id: "alc-cachaca", name: "卡莎萨", englishName: "Cachaça", type: "巴西甘蔗烈酒", libraryMode: "alcohol", libraryCategory: "Cachaça", abv: 40, abvRange: "40+", recommendedAmount: 30, availability: "低：专业酒铺", mainComponents: ["新鲜甘蔗汁", "酵母", "青草香"], flavorTags: ["青草", "甘蔗", "热带"], pairingGood: ["青柠", "蔗糖", "菠萝"], pairingRisky: ["浓茶涩味", "厚奶"], color: "rgba(250, 204, 21, 0.32)", sweetness: 2, freshness: 4 }),
  createLibraryIngredient({ id: "alc-absinthe", name: "苦艾酒", englishName: "Absinthe", type: "高酒精草本酒", libraryMode: "alcohol", libraryCategory: "Absinthe", abv: 68, abvRange: "40+", recommendedAmount: 5, availability: "低：专业酒铺", mainComponents: ["苦艾", "茴香", "小茴香", "高酒精"], flavorTags: ["茴香", "草本", "高强度"], pairingGood: ["冰水", "糖", "柑橘皮"], pairingRisky: ["奶类", "低香气果汁"], color: "rgba(163, 230, 53, 0.38)", bitterness: 4, body: 3 }),
];

const nonAlcoholLibrary: LibraryIngredient[] = [
  createLibraryIngredient({ id: "na-yogurt", name: "乳酸饮料", englishName: "Yogurt Drink", type: "乳酸饮料", libraryMode: "nonAlcohol", libraryCategory: "乳酸饮料", recommendedAmount: 60, availability: "高：便利店冷柜常见", mainComponents: ["水", "乳粉/乳酸菌发酵液", "糖", "酸度调节剂"], flavorTags: ["乳酸", "甜酸", "柔和"], pairingGood: ["烧酒", "伏特加", "莓果"], pairingRisky: ["强苦味草本", "高单宁红酒"], color: "rgba(244, 219, 214, 0.85)", sweetness: 4, acidity: 3, dairy: 3, body: 3 }),
  createLibraryIngredient({ id: "na-soda", name: "苏打水", englishName: "Soda Water", type: "气泡饮料", libraryMode: "nonAlcohol", libraryCategory: "气泡饮料", recommendedAmount: 120, availability: "高：便利店/超市常见", mainComponents: ["水", "二氧化碳", "矿物盐"], flavorTags: ["气泡", "清爽", "低甜"], pairingGood: ["金酒", "威士忌", "梅酒"], pairingRisky: ["厚乳饮", "低香气甜酒"], color: "rgba(224, 242, 254, 0.28)", carbonation: 5, freshness: 5 }),
  ...JUICE_INGREDIENTS.map(juiceToLibraryIngredient),
  createLibraryIngredient({ id: "na-tea", name: "乌龙茶", englishName: "Oolong Tea", type: "茶饮", libraryMode: "nonAlcohol", libraryCategory: "茶饮", recommendedAmount: 120, availability: "高：便利店茶饮货架", mainComponents: ["水", "茶叶萃取物", "茶多酚"], flavorTags: ["茶香", "微涩", "清爽"], pairingGood: ["威士忌", "梅酒", "白酒"], pairingRisky: ["高酸乳酸饮料", "厚椰奶"], color: "rgba(146, 64, 14, 0.45)", bitterness: 2, tea: 5, freshness: 4 }),
  createLibraryIngredient({ id: "na-coffee", name: "咖啡", englishName: "Coffee", type: "咖啡", libraryMode: "nonAlcohol", libraryCategory: "咖啡", recommendedAmount: 45, availability: "高：便利店/咖啡机常见", mainComponents: ["咖啡萃取液", "咖啡因", "烘焙苦味物质"], flavorTags: ["烘焙", "苦味", "坚果"], pairingGood: ["威士忌", "白兰地", "利口酒"], pairingRisky: ["清酒", "花果茶"], color: "rgba(87, 83, 78, 0.55)", bitterness: 4, body: 4 }),
  createLibraryIngredient({ id: "na-milk", name: "奶类", englishName: "Milk / Cream", type: "奶类", libraryMode: "nonAlcohol", libraryCategory: "奶类", recommendedAmount: 45, availability: "高：便利店冷柜常见", mainComponents: ["乳蛋白", "乳脂", "乳糖", "水"], flavorTags: ["奶香", "厚重", "柔滑"], pairingGood: ["咖啡利口酒", "朗姆", "白兰地"], pairingRisky: ["柑橘高酸", "汤力水"], color: "rgba(248, 250, 252, 0.9)", sweetness: 2, dairy: 5, body: 5 }),
  createLibraryIngredient({ id: "na-energy", name: "功能饮料", englishName: "Energy Drink", type: "功能饮料", libraryMode: "nonAlcohol", libraryCategory: "功能饮料", recommendedAmount: 90, availability: "高：便利店常见", mainComponents: ["咖啡因", "牛磺酸", "糖/代糖", "酸度调节剂"], flavorTags: ["高甜", "酸感", "提神"], pairingGood: ["伏特加", "朗姆", "龙舌兰"], pairingRisky: ["咖啡", "高酒精大量混合"], color: "rgba(250, 204, 21, 0.48)", sweetness: 4, acidity: 3, carbonation: 2, freshness: 3 }),
  createLibraryIngredient({ id: "na-sweet", name: "糖浆 / 蜂蜜", englishName: "Syrup / Honey", type: "甜味配料", libraryMode: "nonAlcohol", libraryCategory: "甜味配料", recommendedAmount: 10, availability: "中高：便利店/超市可得", mainComponents: ["蔗糖", "葡萄糖", "果糖", "水"], flavorTags: ["甜", "增稠", "圆润"], pairingGood: ["酸味配料", "烈酒", "咖啡"], pairingRisky: ["甜利口酒", "甜型果汁"], color: "rgba(251, 191, 36, 0.6)", sweetness: 5, body: 4 }),
  createLibraryIngredient({ id: "na-sour", name: "柠檬 / 青柠汁", englishName: "Lemon / Lime Juice", type: "酸味配料", libraryMode: "nonAlcohol", libraryCategory: "酸味配料", recommendedAmount: 15, availability: "中高：便利店/超市可得", mainComponents: ["柠檬酸", "苹果酸", "柑橘精油", "水"], flavorTags: ["高酸", "柑橘", "提亮"], pairingGood: ["金酒", "龙舌兰", "朗姆"], pairingRisky: ["奶类", "低酸甜酒过量"], color: "rgba(234, 179, 8, 0.62)", acidity: 5, fruit: 3, freshness: 5 }),
  createLibraryIngredient({ id: "na-bitter", name: "苦味 / 草本配料", englishName: "Bitter / Herbal", type: "苦味 / 草本", libraryMode: "nonAlcohol", libraryCategory: "苦味 / 草本", recommendedAmount: 5, availability: "低：酒铺/调酒用品店", mainComponents: ["龙胆", "苦橙皮", "香草浸提物"], flavorTags: ["苦味", "草本", "复杂"], pairingGood: ["威士忌", "金酒", "苏打水"], pairingRisky: ["乳酸饮料", "低香气淡酒"], color: "rgba(74, 222, 128, 0.34)", bitterness: 5, body: 2 }),
];

const convenienceDrinkLibrary = CONVENIENCE_DRINK_INGREDIENTS.map(convenienceDrinkToLibraryIngredient);
const convenienceAlcoholLibrary = convenienceDrinkLibrary.filter((item) => item.libraryMode === "alcohol");
const convenienceNonAlcoholLibrary = convenienceDrinkLibrary.filter((item) => item.libraryMode === "nonAlcohol");
const allAlcoholLibrary = [...alcoholLibrary, ...convenienceAlcoholLibrary];
const allNonAlcoholLibrary = [...convenienceNonAlcoholLibrary, ...nonAlcoholLibrary];
const fullIngredientLibrary = [...allAlcoholLibrary, ...allNonAlcoholLibrary];

const querySynonyms: Array<[RegExp, string[]]> = [
  [/水溶\s*c|水溶c100|shui\s*rong\s*c|src100|维\s*c/i, ["水溶C100", "Vitamin C", "维C"]],
  [/养乐多|yakult|益力多/i, ["养乐多", "Yakult", "乳酸饮料"]],
  [/可尔必思|calpis|calpico/i, ["可尔必思", "Calpis", "乳酸饮料"]],
  [/椰树|椰汁|椰奶|coconut\s*(milk|cream|drink)/i, ["椰树牌椰汁", "椰汁", "椰奶饮料", "Coconut Milk Drink"]],
  [/椰子水|椰青|coconut\s*water/i, ["椰子水", "Coconut Water"]],
  [/芬达|fanta|橙味汽水|orange\s*soda/i, ["芬达橙味", "Fanta Orange", "橙味汽水"]],
  [/雪碧|sprite/i, ["雪碧", "Sprite", "柠檬汽水"]],
  [/可乐|coke|coca|cola/i, ["可口可乐", "Coca-Cola", "可乐"]],
  [/东方树叶|茶π|茶派|冰红茶|乌龙|绿茶/i, ["茶饮", "乌龙茶", "绿茶", "柠檬茶"]],
  [/红牛|魔爪|energy|monster|red\s*bull/i, ["功能饮料", "Energy Drink", "红牛", "魔爪"]],
];

const normalizeIngredientQuery = (value: string) =>
  value
    .toLowerCase()
    .replace(/[牌味型版]/g, "")
    .replace(/[\s·.。,_\-\/\\()[\]（）【】"'’‘“”]/g, "")
    .trim();

const hasNonAlcoholDrinkIntent = (query: string) =>
  /果汁|汁|饮料|饮品|汽水|苏打|气泡水|茶|奶|乳|咖啡|可乐|雪碧|水溶|维c|juice|drink|soda|tea|milk|coffee|cola|sprite|fanta|yakult|calpis/i.test(query);

const hasExplicitAlcoholIntent = (query: string) =>
  /啤酒|苹果酒|葡萄酒|清酒|烧酒|梅酒|威末|味美思|利口酒|金酒|伏特加|威士忌|朗姆|龙舌兰|梅斯卡尔|白兰地|干邑|白酒|苦艾|酒精|beer|cider|wine|sake|soju|umeshu|vermouth|liqueur|gin|vodka|whisk|rum|tequila|mezcal|brandy|cognac|baijiu|absinthe|alcohol/i.test(query);

const isAlcoholLibraryItem = (item: Ingredient) => {
  const libraryItem = item as Partial<LibraryIngredient>;
  return libraryItem.libraryMode === "alcohol" || (item.abv ?? 0) > 0 || item.category === "基酒" || /酒类|基酒|烈酒|发酵酒|蒸馏酒/.test(item.category);
};

const uniqueTerms = (terms: string[]) => Array.from(new Set(terms.filter(Boolean)));

const buildExpandedQueryTerms = (query: string) => {
  const expanded = querySynonyms
    .filter(([pattern]) => pattern.test(query))
    .flatMap(([, terms]) => terms);
  return uniqueTerms([query, normalizeIngredientQuery(query), ...expanded, ...expanded.map(normalizeIngredientQuery)]);
};

const collectIngredientSearchTerms = (item: Ingredient) => {
  const libraryItem = item as Partial<LibraryIngredient>;
  const terms = [
    item.name,
    item.category,
    ...(item.flavorTags ?? []),
    libraryItem.englishName,
    libraryItem.brand,
    libraryItem.type,
    libraryItem.libraryCategory,
    ...(libraryItem.aliases ?? []),
    ...(libraryItem.mainComponents ?? []),
    libraryItem.convenienceData?.nameZh,
    libraryItem.convenienceData?.nameEn,
    ...(libraryItem.convenienceData?.aliases ?? []),
    ...(libraryItem.convenienceData?.ingredients ?? []),
    libraryItem.juiceData?.nameZh,
    libraryItem.juiceData?.nameEn,
    ...(libraryItem.juiceData?.aliases ?? []),
    ...(libraryItem.juiceData?.ingredients ?? []),
  ].filter(Boolean).map(String);

  return uniqueTerms([...terms, ...terms.map(normalizeIngredientQuery)]);
};

const fuzzyIngredientScore = (item: Ingredient, query: string) => {
  const queryTerms = buildExpandedQueryTerms(query);
  const itemTerms = collectIngredientSearchTerms(item);
  const nonAlcoholIntent = hasNonAlcoholDrinkIntent(query) && !hasExplicitAlcoholIntent(query);
  let score = 0;

  queryTerms.forEach((queryTerm) => {
    if (!queryTerm || queryTerm.length < 2) return;
    itemTerms.forEach((term) => {
      if (!term) return;
      const normalizedTerm = normalizeIngredientQuery(term);
      if (normalizedTerm === queryTerm) score += 120;
      else if (normalizedTerm.includes(queryTerm) || queryTerm.includes(normalizedTerm)) score += 72;
      else {
        const queryChars = Array.from(new Set(queryTerm.split("")));
        const overlap = queryChars.filter((char) => normalizedTerm.includes(char)).length;
        const ratio = overlap / Math.max(queryChars.length, 1);
        if (queryTerm.length >= 3 && ratio >= 0.72) score += Math.round(ratio * 36);
      }
    });
  });

  const libraryItem = item as Partial<LibraryIngredient>;
  if (nonAlcoholIntent && isAlcoholLibraryItem(item)) score -= 180;
  if (libraryItem.availability?.includes("高")) score += 4;
  return score;
};

const findLocalIngredientMatches = (query: string, candidates: Ingredient[]) => {
  const queryTerms = buildExpandedQueryTerms(query);
  const nonAlcoholIntent = hasNonAlcoholDrinkIntent(query) && !hasExplicitAlcoholIntent(query);
  const scopedCandidates = nonAlcoholIntent
    ? candidates.filter((item) => !isAlcoholLibraryItem(item))
    : candidates;

  return scopedCandidates
    .map((item) => ({ item, score: fuzzyIngredientScore(item, query) }))
    .filter(({ item, score }) => score >= 48 || queryTerms.some((term) => term.length >= 2 && collectIngredientSearchTerms(item).some((candidate) => normalizeIngredientQuery(candidate).includes(term))))
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
};

const mixerCategoryFrequency = [
  "气泡饮料",
  "茶饮",
  "果汁",
  "乳酸饮料",
  "酸味配料",
  "奶类",
  "咖啡",
  "功能饮料",
  "甜味配料",
  "苦味 / 草本",
];

const mixerUsageKeywords: Array<[RegExp, number]> = [
  [/苏打|soda|气泡水|sparkling/i, 100],
  [/汤力|tonic/i, 96],
  [/可乐|cola/i, 94],
  [/雪碧|sprite|lemon.?lime/i, 92],
  [/西柚|葡萄柚|grapefruit/i, 90],
  [/柠檬茶|lemon tea/i, 88],
  [/乌龙|oolong/i, 86],
  [/绿茶|green tea/i, 82],
  [/养乐多|yakult/i, 80],
  [/可尔必思|calpis|calpico/i, 78],
  [/橙汁|orange/i, 76],
  [/蔓越莓|cranberry/i, 74],
  [/菠萝|凤梨|pineapple/i, 72],
  [/苹果汁|apple/i, 70],
  [/水溶c|维c|vitamin c/i, 68],
  [/椰子水|coconut water/i, 66],
  [/椰奶|椰汁|coconut milk/i, 64],
  [/酸梅|sour plum/i, 62],
  [/姜汁|ginger/i, 60],
  [/咖啡|coffee/i, 58],
  [/奶茶|milk tea/i, 56],
  [/功能|energy|红牛|monster/i, 54],
  [/柠檬|青柠|lime|lemon/i, 52],
  [/糖浆|蜂蜜|syrup|honey/i, 50],
  [/苦味|草本|bitter|herbal/i, 40],
];

const mixerUsageScore = (item: LibraryIngredient) => {
  const categoryIndex = mixerCategoryFrequency.indexOf(item.libraryCategory);
  const categoryScore = categoryIndex === -1 ? 0 : 40 - categoryIndex * 2;
  const text = [
    item.name,
    item.englishName,
    item.type,
    item.libraryCategory,
    ...(item.aliases ?? []),
    ...item.flavorTags,
    ...item.mainComponents,
    ...(item.convenienceData?.aliases ?? []),
    ...(item.convenienceData?.ingredients ?? []),
    ...(item.juiceData?.aliases ?? []),
    ...(item.juiceData?.ingredients ?? []),
  ].join(" ");
  const keywordScore = mixerUsageKeywords.find(([pattern]) => pattern.test(text))?.[1] ?? 0;
  return keywordScore + categoryScore + (item.availability.includes("高") ? 6 : 0);
};

const sortMixersByConvenienceUse = (items: LibraryIngredient[]) =>
  [...items].sort((a, b) => mixerUsageScore(b) - mixerUsageScore(a) || a.name.localeCompare(b.name, "zh-CN"));

const alcoholPurchasePriority: Array<[RegExp, number]> = [
  [/金酒|gin/i, 120],
  [/威士忌|whisky|whiskey|bourbon|scotch/i, 116],
  [/伏特加|vodka/i, 112],
  [/朗姆|rum/i, 106],
  [/龙舌兰|tequila/i, 102],
  [/白兰地|干邑|brandy|cognac/i, 98],
  [/利口|liqueur|baileys|cointreau/i, 90],
  [/阿佩罗|金巴利|阿玛罗|aperol|campari|amaro/i, 86],
  [/白酒|baijiu/i, 82],
  [/烧酒|soju/i, 78],
  [/清酒|sake/i, 74],
  [/葡萄酒|wine|vermouth|威末/i, 70],
  [/啤酒|beer|lager/i, 66],
  [/预调|微醺|rio|rtd|chu-hi|hard seltzer|气泡酒/i, 62],
  [/梅酒|umeshu/i, 58],
  [/苹果酒|cider/i, 54],
  [/梅斯卡尔|mezcal/i, 50],
  [/卡莎萨|cacha/i, 46],
  [/苦艾|absinthe/i, 42],
];

const alcoholPurchaseScore = (item: LibraryIngredient) => {
  const text = [
    item.name,
    item.englishName,
    item.type,
    item.libraryCategory,
    ...(item.aliases ?? []),
    ...(item.flavorTags ?? []),
    ...(item.mainComponents ?? []),
    item.convenienceData?.brand ?? "",
    item.convenienceData?.nameZh ?? "",
    item.convenienceData?.nameEn ?? "",
    ...(item.convenienceData?.aliases ?? []),
  ].join(" ");
  const priorityScore = alcoholPurchasePriority.find(([pattern]) => pattern.test(text))?.[1] ?? 0;
  const availabilityScore = item.availability.includes("高") ? 8 : item.availability.includes("中高") ? 6 : item.availability.includes("中") ? 3 : 0;
  return priorityScore + availabilityScore;
};

const sortAlcoholByPurchaseUse = (items: LibraryIngredient[], selectedRange: AbvRange | "all") =>
  [...items].sort((a, b) => {
    if (selectedRange === "all") {
      return alcoholPurchaseScore(b) - alcoholPurchaseScore(a) || (b.abv ?? 0) - (a.abv ?? 0) || a.name.localeCompare(b.name, "zh-CN");
    }
    return (b.abv ?? 0) - (a.abv ?? 0) || alcoholPurchaseScore(b) - alcoholPurchaseScore(a) || a.name.localeCompare(b.name, "zh-CN");
  });

type MixMethodAdvice = {
  tone: "warning" | "tip";
  title: string;
  message: string;
};

type MixMethodRecommendation = {
  method: "Stir" | "Shake";
  tone: "warning" | "tip" | "ok";
  title: string;
  message: string;
};

type LabDecision = {
  level: "ok" | "caution" | "avoid";
  title: string;
  reason: string;
  suggestion: string;
};

const ingredientSearchText = (item: LabIngredient) =>
  [
    item.name,
    item.category,
    ...(item.flavorTags ?? []),
    ...(item.mainComponents ?? []),
    ...(item.goodWith ?? []),
    ...(item.riskyWith ?? []),
  ].join(" ").toLowerCase();

const ingredientIdentityText = (item: LabIngredient) =>
  [
    item.name,
    item.category,
    ...(item.flavorTags ?? []),
    ...(item.mainComponents ?? []),
  ].join(" ").toLowerCase();

const isCarbonatedIngredient = (item: LabIngredient) => {
  const text = ingredientIdentityText(item);
  return (
    item.isBubbly === true ||
    (item.carbonation ?? 0) >= 3 ||
    /气泡|汽水|碳酸|苏打|汤力|可乐|雪碧|啤酒|气泡水|sparkling|carbonated|soda|tonic|cola|beer|lager|ale|fizz/.test(text)
  );
};

const isDairyIngredient = (item: LabIngredient) => {
  const text = ingredientIdentityText(item);
  return (
    (item.dairy ?? 0) >= 2 ||
    /奶|乳|酸奶|乳酸|养乐多|可尔必思|椰奶|椰汁|牛奶|奶油|milk|cream|dairy|yakult|calpis|yogurt/.test(text)
  );
};

const isJuiceSyrupOrCitrusIngredient = (item: LabIngredient) => {
  const text = ingredientIdentityText(item);
  return (
    /果汁|果泥|果浆|糖浆|蜂蜜|柠檬|青柠|橙汁|蔓越莓|菠萝|芒果|juice|puree|syrup|honey|lemon|lime|citrus/.test(text)
  );
};

const isShakeFriendlyIngredient = (item: LabIngredient) => {
  return (
    isDairyIngredient(item) ||
    isJuiceSyrupOrCitrusIngredient(item) ||
    (item.viscosity ?? 0) >= 4
  );
};

const isHighAcidIngredient = (item: LabIngredient) => {
  const text = ingredientIdentityText(item);
  return (item.acidity ?? 0) >= 4 || /柠檬|青柠|酸橙|西柚|葡萄柚|酸梅|山楂|醋|lemon|lime|grapefruit|citrus|sour/.test(text);
};

const isSpiritForwardIngredient = (item: LabIngredient) => {
  const text = ingredientIdentityText(item);
  return (
    (item.abv ?? 0) >= 10 ||
    /金酒|伏特加|威士忌|朗姆|龙舌兰|梅斯卡尔|白兰地|干邑|白酒|烧酒|清酒|利口|味美思|威末|金巴利|阿佩罗|苦味酒|gin|vodka|whisky|whiskey|rum|tequila|mezcal|brandy|cognac|baijiu|soju|sake|liqueur|vermouth|campari|aperol|amaro|bitters/.test(text)
  );
};

const buildMixMethodAdvice = (items: LabIngredient[], method: "Stir" | "Shake"): MixMethodAdvice[] => {
  if (items.length < 2) return [];

  const hasCarbonation = items.some(isCarbonatedIngredient);
  const hasShakeFriendly = items.some((item) => isShakeFriendlyIngredient(item) && !isCarbonatedIngredient(item));
  const hasDairy = items.some(isDairyIngredient);
  const hasJuiceSyrupOrCitrus = items.some((item) => isJuiceSyrupOrCitrusIngredient(item) && !isDairyIngredient(item));
  const hasDenseMixer = items.some((item) => (item.viscosity ?? 0) >= 4 && !isDairyIngredient(item) && !isCarbonatedIngredient(item));
  const hasHighAcid = items.some(isHighAcidIngredient);
  const spiritForwardOnly = items.every(isSpiritForwardIngredient) && !hasShakeFriendly && !hasCarbonation;

  const advice: MixMethodAdvice[] = [];

  if (method === "Shake" && hasCarbonation) {
    advice.push({
      tone: "warning",
      title: "气泡材料不要 Shake",
      message: "汽水、苏打水、汤力水、可乐、啤酒这类材料进摇壶容易喷出来，也会把气泡摇没。建议先摇其他材料，最后倒入气泡饮料后轻轻搅 1-2 下。",
    });
  }

  if (method === "Stir" && hasShakeFriendly) {
    if (hasDairy) {
      advice.push({
        tone: "tip",
        title: "含奶感材料，更适合 Shake",
        message: "奶类、乳酸饮料、椰奶这类材料只靠搅拌容易不均匀。用 Shake 会更冷、更顺滑，口感也更融合。",
      });
    } else if (hasJuiceSyrupOrCitrus || hasDenseMixer) {
      advice.push({
        tone: "tip",
        title: "这杯更适合 Shake",
        message: "果汁、柠檬/青柠、糖浆或浓稠果泥靠搅拌不容易完全融合。Shake 会让酸甜更均匀，入口更像鸡尾酒。",
      });
    }
  }

  if (method === "Shake" && spiritForwardOnly) {
    advice.push({
      tone: "tip",
      title: "纯酒感经典通常 Stir",
      message: "如果主要是基酒、味美思、利口酒或苦味酒，Stir 会更清澈顺滑；Shake 会让酒体变浑浊，稀释和起泡也更明显。",
    });
  }

  if (hasDairy && hasHighAcid) {
    advice.push({
      tone: "warning",
      title: "奶类遇高酸要小心",
      message: "奶、乳酸饮料和大量柠檬/青柠一起用时可能出现轻微结块。新手可以先减少酸汁，或把酸味换成果香汽水、茶饮来降低翻车概率。",
    });
  }

  return advice;
};

const buildMixMethodRecommendation = (items: LabIngredient[]): MixMethodRecommendation | null => {
  if (items.length < 2) return null;

  const hasCarbonation = items.some(isCarbonatedIngredient);
  const hasDairy = items.some(isDairyIngredient);
  const hasJuiceSyrupOrCitrus = items.some((item) => isJuiceSyrupOrCitrusIngredient(item) && !isCarbonatedIngredient(item));
  const hasDenseMixer = items.some((item) => (item.viscosity ?? 0) >= 4 && !isCarbonatedIngredient(item));
  const spiritForwardOnly = items.every(isSpiritForwardIngredient) && !hasCarbonation && !hasDairy && !hasJuiceSyrupOrCitrus && !hasDenseMixer;

  if (hasCarbonation && hasDairy) {
    return {
      method: "Stir",
      tone: "warning",
      title: "这杯有气泡，也有奶感材料",
      message: "不建议把气泡一起 Shake。可以先把奶感材料和非气泡材料摇匀，倒入杯中后最后加气泡，轻轻 Stir。",
    };
  }

  if (hasCarbonation) {
    return {
      method: "Stir",
      tone: "ok",
      title: "当前材料含气泡，建议 Stir",
      message: "汽水、苏打水、汤力水、可乐、啤酒这类气泡材料最后加，轻轻搅拌就好，不要放进摇壶。",
    };
  }

  if (hasDairy) {
    return {
      method: "Shake",
      tone: "ok",
      title: "当前材料含奶感，建议 Shake",
      message: "牛奶、乳酸饮料、椰奶、奶油这类材料需要充分降温和融合，Shake 会更顺滑，也更适合新手。",
    };
  }

  if (hasJuiceSyrupOrCitrus || hasDenseMixer) {
    return {
      method: "Shake",
      tone: "tip",
      title: "当前材料偏果汁/糖浆，建议 Shake",
      message: "果汁、柠檬、青柠、糖浆或浓稠材料摇合后更均匀，酸甜平衡会更稳定。",
    };
  }

  if (spiritForwardOnly) {
    return {
      method: "Stir",
      tone: "tip",
      title: "当前材料偏纯酒型，建议 Stir",
      message: "基酒、味美思、利口酒这类清澈材料轻搅会更顺滑，也能保持酒体清澈。",
    };
  }

  return {
    method: "Stir",
    tone: "tip",
    title: "当前材料建议先 Stir",
    message: "如果没有奶、果汁、糖浆或气泡冲突，先加冰轻搅更稳；尝一口后再决定是否调整比例。",
  };
};

const buildLabDecision = (items: LabIngredient[], method: "Stir" | "Shake"): LabDecision => {
  const hasCarbonation = items.some(isCarbonatedIngredient);
  const hasDairy = items.some(isDairyIngredient);
  const hasHighAcid = items.some(isHighAcidIngredient);
  const hasHighCaffeine = items.some((item) => item.caffeine === true || (item.caffeineMgPer100ml ?? 0) > 0 || /咖啡|功能饮料|红牛|魔爪|energy|coffee|caffeine/.test(ingredientSearchText(item)));
  const spiritVolume = items.filter((item) => (item.abv ?? 0) >= 20).reduce((sum, item) => sum + item.amount, 0);
  const totalAbvWeighted = items.reduce((sum, item) => sum + ((item.abv ?? 0) * item.amount), 0);
  const totalVolume = items.reduce((sum, item) => sum + item.amount, 0) || 1;
  const estimatedAbv = totalAbvWeighted / totalVolume;

  if (method === "Shake" && hasCarbonation) {
    return {
      level: "avoid",
      title: "气泡饮料最后加，改用轻搅",
      reason: "当前材料里有气泡饮料或啤酒，直接 Shake 容易喷出，也会让气泡流失。",
      suggestion: "先把不含气泡的材料加冰摇匀，倒入杯中后最后加入气泡饮料，轻轻搅 1-2 下。",
    };
  }

  if (hasDairy && hasHighAcid) {
    return {
      level: "caution",
      title: "减少高酸材料，避免奶感结块",
      reason: "奶类、乳酸饮料和高酸果汁同杯时，可能出现分层、结块或酸奶状口感。",
      suggestion: "新手先减少柠檬、青柠、西柚这类高酸材料，或改用茶饮、咖啡、朗姆方向搭配奶感。",
    };
  }

  if (hasHighCaffeine && estimatedAbv >= 6) {
    return {
      level: "caution",
      title: "降低酒精量，避免咖啡因叠加",
      reason: "这杯同时有咖啡因和一定酒精度，容易让人低估酒感和饮用速度。",
      suggestion: "建议小杯慢喝，不要再叠加高度酒；如果只是想清爽，可以加冰或苏打水拉长。",
    };
  }

  if (spiritVolume >= 60 || estimatedAbv >= 12) {
    return {
      level: "caution",
      title: "酒感偏强，建议加长饮料稀释",
      reason: "烈酒用量或估算酒精度偏高，新手可能会觉得酒感冲、后劲强。",
      suggestion: "把烈酒控制在 30-45ml，补足冰块和无糖茶、苏打水或果汁，让入口更稳。",
    };
  }

  return {
    level: "ok",
    title: "先做小杯，尝味后微调",
    reason: "当前材料没有明显高风险冲突，适合按推荐比例先做小杯测试。",
    suggestion: method === "Shake"
      ? "加足冰块 Shake 后尽快倒出；如果入口太厚，可以补一点苏打水或茶饮。"
      : "杯中加冰后轻轻 Stir，先少量尝味，再根据甜酸和酒感微调。",
  };
};

export default function LabScreen({ 
  onSaveCocktail,
  drinkLogs = [],
  onSaveDrinkLog,
  initialIngredients,
  initialMixMethod,
  onClearInitial,
  onTrackEvent,
}: LabScreenProps) {
  // --- STATE SYSTEM ---
  // Laboratory core states
  const [addedIngredients, setAddedIngredients] = useState<LabIngredient[]>([]);
  const [mixMethod, setMixMethod] = useState<"Stir" | "Shake">("Stir");

  // Load preset cocktail ingredients from other screens (e.g., Inspiration)
  useEffect(() => {
    if (initialIngredients && initialIngredients.length > 0) {
      const mapped = initialIngredients.map((ing, idx) => ({
        id: `preset-${ing.name}-${idx}-${Date.now()}`,
        name: ing.name,
        amount: ing.amount,
        category: ing.category,
        color: ing.color || "rgba(148, 163, 184, 0.45)",
        isBubbly: ing.isBubbly
      }));
      setAddedIngredients(mapped);
      if (initialMixMethod) {
        setMixMethod(initialMixMethod);
      }
      setShowResults(false);
      setLabResult(null);
      if (onClearInitial) {
        onClearInitial();
      }
    }
  }, [initialIngredients, initialMixMethod, onClearInitial]);

  const [isReacting, setIsReacting] = useState<boolean>(false);
  const [reactionStage, setReactionStage] = useState<string>("");
  
  // --- SELECTION & ALCHEMIX LAB 2.0 ADVANCED STATES ---
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<"search" | "scan" | "manual">("search");
  const [customIngredients, setCustomIngredients] = useState<Ingredient[]>([]);

  // Search states
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showFailGuide, setShowFailGuide] = useState<boolean>(false);
  const [fuzzyMatches, setFuzzyMatches] = useState<Ingredient[]>([]);
  const [pendingUnmatchedQuery, setPendingUnmatchedQuery] = useState<string>("");
  const [selectedLibraryMode, setSelectedLibraryMode] = useState<LibraryMode | null>(null);
  const [selectedAbvRange, setSelectedAbvRange] = useState<AbvRange | "all">("all");
  const [selectedDrinkCategory, setSelectedDrinkCategory] = useState<string>("全部");

  // OCR/Scan states
  const [isOcrScanning, setIsOcrScanning] = useState<boolean>(false);
  const [customOcrText, setCustomOcrText] = useState<string>("");
  const [scanNameHint, setScanNameHint] = useState<string>("");

  // Manual generation states
  const [manualName, setManualName] = useState<string>("");
  const [manualCategory, setManualCategory] = useState<string>("气泡饮料");
  const [manualDescription, setManualDescription] = useState<string>("");
  const [manualIngredientText, setManualIngredientText] = useState<string>("");
  const [isManualGenerating, setIsManualGenerating] = useState<boolean>(false);

  // Active staged flavor card view
  const [activeStagedIngredient, setActiveStagedIngredient] = useState<Ingredient | null>(null);
  const [amountToInject, setAmountToInject] = useState<number>(30);
  const [autoSaveToLibrary, setAutoSaveToLibrary] = useState<boolean>(true);

  // Rules info panel modal
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  
  // Results view states
  const [showResults, setShowResults] = useState<boolean>(false);
  const [labResult, setLabResult] = useState<Cocktail | null>(null);
  const [hasSavedResult, setHasSavedResult] = useState<boolean>(false);
  const [showDecisionGuide, setShowDecisionGuide] = useState<boolean>(false);

  // Load custom ingredients from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("alchemix_custom_ingredients");
    if (stored) {
      try {
        setCustomIngredients(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse local custom ingredients library", e);
      }
    }
  }, []);

  // Constants
  const MAX_BEAKER_VOLUME = 350; // Maximum ml for visualization

  const amountOptions = [5, 10, 15, 30, 45, 60, 90, 120, 150];

  // OCR visual simulation templates
  const bottleTemplates = [
    {
      name: "椰奶饮料",
      text: "配料: 水、鲜椰肉汁、白砂糖、酪蛋白酸钠、单硬脂酸甘油酯",
      brand: "",
      category: "乳酸/椰奶饮料",
      color: "rgba(244, 219, 214, 0.85)"
    },
    {
      name: "三得利无糖乌龙茶",
      text: "配料: 水、乌龙茶叶、乌龙茶粉、维生素C、碳酸氢钠",
      brand: "三得利",
      category: "无糖茶饮",
      color: "rgba(146, 64, 14, 0.5)"
    },
    {
      name: "元气森林白桃气泡水",
      text: "配料: 水、赤藓糖醇、二氧化碳、柠檬酸、三氯蔗糖",
      brand: "元气森林",
      category: "无糖气泡水",
      color: "rgba(186, 230, 253, 0.35)"
    },
    {
      name: "水溶C100 (柠檬味)",
      text: "配料: 水、白砂糖、浓缩柠檬汁、柠檬酸、维生素C",
      brand: "农夫山泉",
      category: "高酸果汁饮料",
      color: "rgba(253, 224, 71, 0.55)"
    }
  ];

  // Quick failure recovery fast choices
  const fastFailedAlternatives = [
    { name: "蜜桃果汁气泡水", category: "无糖气泡水", desc: "蜜桃成熟果香，赤藓糖醇清凉代糖甜，高二氧化碳气泡感，质地极轻盈" },
    { name: "手作青柠气泡汁", category: "风味果汁", desc: "鲜榨青柠檬强酸骨架，轻微柠檬精油香气，气泡爽口生津" },
    { name: "厚椰乳植物蛋白饮料", category: "乳酸/椰奶饮料", desc: "新鲜椰子肉原汁榨取，含有脂肪油脂，口感丝滑极其醇厚，奶香饱满" },
    { name: "焙火高山大红袍茶", category: "风味茶饮", desc: "特级大红袍，岩骨花香，中等茶多酚微涩感，无糖，拉长酒精体极佳" }
  ];

  // --- CORE SYSTEM HANDLERS ---

  const stageLibraryIngredient = (ingredient: Ingredient) => {
    const recommendedAmount = (ingredient as Partial<LibraryIngredient>).recommendedAmount;
    setActiveStagedIngredient(ingredient);
    if (typeof recommendedAmount === "number") {
      setAmountToInject(recommendedAmount);
    }
  };

  // 1. Unified Search Action
  const handleSearchIngredient = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    setSearchError(null);
    setShowFailGuide(false);
    setFuzzyMatches([]);
    setPendingUnmatchedQuery("");

    const nonAlcoholIntent = hasNonAlcoholDrinkIntent(query) && !hasExplicitAlcoholIntent(query);
    const candidates = nonAlcoholIntent
      ? [...allNonAlcoholLibrary, ...customIngredients.filter((item) => !isAlcoholLibraryItem(item))]
      : [...fullIngredientLibrary, ...customIngredients];
    const matches = findLocalIngredientMatches(query, candidates).slice(0, 8);
    const topScore = matches[0] ? fuzzyIngredientScore(matches[0], query) : 0;

    if (matches.length > 0 && topScore >= 108) {
      stageLibraryIngredient(matches[0]);
    } else if (matches.length > 0) {
      setFuzzyMatches(matches);
      setSearchError("没有找到完全匹配，但本地库里有相似饮料。");
      setShowFailGuide(true);
      setPendingUnmatchedQuery(query);
      onTrackEvent?.({
        eventName: "ingredient_search_fuzzy_match",
        page: "lab",
        action: "search",
        target: query,
        metadata: {
          candidateCount: matches.length,
          candidates: matches.slice(0, 4).map((item) => item.name),
        },
      });
    } else {
      setSearchError("本地数据库暂未确认这个饮料。");
      setShowFailGuide(true);
      setPendingUnmatchedQuery(query);
      setManualName(query);
      onTrackEvent?.({
        eventName: "ingredient_search_unmatched",
        page: "lab",
        action: "search",
        target: query,
        metadata: {
          reviewStatus: "pending_review",
          reason: "local_database_no_match",
        },
      });
    }

    setIsSearching(false);
  };

  // 2. Click Classic preset chip or quick selection
  const handleSelectPresetChip = (ingredient: LibraryIngredient) => {
    setSearchError(null);
    setShowFailGuide(false);
    setFuzzyMatches([]);
    setPendingUnmatchedQuery("");
    stageLibraryIngredient(ingredient);
  };

  // 3. Simulated bottle scan trigger
  const handleScanTemplateOCR = async (template: typeof bottleTemplates[0]) => {
    setIsOcrScanning(true);
    setSearchError(null);
    try {
      const res = await fetch("/api/ingredients/generate-similar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: template.name,
          category: "饮料",
          description: `配料表：${template.text}`
        })
      });

      if (!res.ok) throw new Error("Ingredient text parse failed");
      const data = await res.json();
      setActiveStagedIngredient(data);
    } catch (err) {
      console.error(err);
      alert("配料表整理失败，请稍后重试。");
    } finally {
      setIsOcrScanning(false);
    }
  };

  // 4. Custom manual text scanning
  const handleCustomOcrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customOcrText.trim()) return;

    setIsOcrScanning(true);
    try {
      const res = await fetch("/api/ingredients/generate-similar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: scanNameHint.trim() || pendingUnmatchedQuery || "自建配料",
          category: "饮料",
          description: `配料表：${customOcrText.trim()}`
        })
      });

      if (!res.ok) throw new Error();
      const data = await res.json();
      setActiveStagedIngredient(data);
      setCustomOcrText("");
      setScanNameHint("");
    } catch (err) {
      console.error(err);
      alert("配料表整理失败，请确认输入的配料内容。");
    } finally {
      setIsOcrScanning(false);
    }
  };

  // 5. Manual add with full dynamic synthesis
  const handleManualGenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) return;

    setIsManualGenerating(true);
    try {
      const res = await fetch("/api/ingredients/generate-similar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: manualName.trim(),
          category: manualCategory,
          description: [
            manualIngredientText.trim() ? `配料表：${manualIngredientText.trim()}` : "",
            manualDescription.trim() ? `备注：${manualDescription.trim()}` : "",
          ].filter(Boolean).join("\n")
        })
      });

      if (!res.ok) throw new Error();
      const data = await res.json();
      setActiveStagedIngredient(data);
      setManualName("");
      setManualDescription("");
      setManualIngredientText("");
      setPendingUnmatchedQuery("");
      setFuzzyMatches([]);
      setShowFailGuide(false);
    } catch (err) {
      console.error(err);
      alert("暂时无法根据该特征生成本地草稿，请稍后重试。");
    } finally {
      setIsManualGenerating(false);
    }
  };

  // 6. Fast failure alternative picker
  const handleFastAlternativeSelect = async (alt: typeof fastFailedAlternatives[0]) => {
    setIsSearching(true);
    try {
      const res = await fetch("/api/ingredients/generate-similar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: alt.name,
          category: alt.category,
          description: alt.desc
        })
      });

      if (!res.ok) throw new Error();
      const data = await res.json();
      setActiveStagedIngredient(data);
      setShowFailGuide(false);
    } catch (err) {
      console.error(err);
      alert("暂时无法生成该配料草稿。");
    } finally {
      setIsSearching(false);
    }
  };

  // 7. Inject to Beaker and save to personal library
  const handleConfirmAdd = () => {
    if (!activeStagedIngredient) return;

    const totalCurrent = addedIngredients.reduce((sum, item) => sum + item.amount, 0);
    if (totalCurrent + amountToInject > MAX_BEAKER_VOLUME) {
      alert(`⚠️ 注入超限！当前刻度杯最大容量为 ${MAX_BEAKER_VOLUME}ml。只能再加入最多 ${MAX_BEAKER_VOLUME - totalCurrent}ml。`);
      return;
    }

    // Dynamic coloring based on ingredient category / name
    let finalColor = (activeStagedIngredient as Partial<LibraryIngredient>).color || "rgba(148, 163, 184, 0.45)";
    const cat = activeStagedIngredient.category || "";
    const nameLower = activeStagedIngredient.name.toLowerCase();
    
    if (cat.includes("茶") || nameLower.includes("茶")) {
      finalColor = "rgba(146, 64, 14, 0.45)"; // Deep Tea brown
    } else if (cat.includes("乳") || cat.includes("奶") || cat.includes("椰") || nameLower.includes("奶") || nameLower.includes("椰")) {
      finalColor = "rgba(244, 219, 214, 0.85)"; // Milky Peach-White
    } else if (cat.includes("果汁") || cat.includes("果味") || nameLower.includes("汁") || nameLower.includes("柠檬") || nameLower.includes("酸")) {
      finalColor = "rgba(253, 224, 71, 0.55)"; // Lemon juice yellow
    } else if (cat.includes("气泡") || cat.includes("碳酸") || cat.includes("苏打") || nameLower.includes("汽水") || nameLower.includes("soda") || nameLower.includes("fizz")) {
      finalColor = "rgba(224, 242, 254, 0.25)"; // Translucent bubbly blue
    } else if (cat.includes("基酒") || cat.includes("烈酒") || nameLower.includes("rum") || nameLower.includes("gin") || nameLower.includes("whiskey") || nameLower.includes("酒")) {
      finalColor = "rgba(186, 230, 253, 0.35)"; // Blue tinted alcohol
    }

    const profile = activeStagedIngredient.flavorProfile;
    const libraryDetails = activeStagedIngredient as Partial<LibraryIngredient>;
    const convenienceData = libraryDetails.convenienceData;
    const juiceData = libraryDetails.juiceData;

    const newIng: LabIngredient = {
      id: `ing-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: activeStagedIngredient.name,
      category: activeStagedIngredient.category,
      color: finalColor,
      isBubbly: activeStagedIngredient.carbonation >= 3,
      amount: amountToInject,
      abv: activeStagedIngredient.abv ?? 0,
      sweetness: activeStagedIngredient.sweetness ?? profile?.sweetness ?? 1,
      acidity: activeStagedIngredient.acidity ?? profile?.acidity ?? 1,
      bitterness: activeStagedIngredient.bitterness ?? profile?.bitterness ?? 1,
      carbonation: activeStagedIngredient.carbonation ?? profile?.carbonation ?? 0,
      viscosity: activeStagedIngredient.viscosity ?? activeStagedIngredient.body ?? profile?.body ?? 1,
      dairy: activeStagedIngredient.dairyFeeling ?? profile?.dairy ?? 0,
      tea: profile?.tea ?? 0,
      fruit: profile?.fruit ?? 0,
      freshness: profile?.freshness ?? 2,
      sugarGPer100ml: activeStagedIngredient.nutrition?.sugar_g_per_100ml ?? convenienceData?.sugarGPer100ml ?? juiceData?.sugarGPer100ml ?? null,
      caffeineMgPer100ml: activeStagedIngredient.nutrition?.caffeine_mg_per_100ml,
      caffeine: Boolean(activeStagedIngredient.nutrition?.caffeine_mg_per_100ml) || Boolean(convenienceData?.caffeine),
      flavorTags: activeStagedIngredient.flavorTags,
      mainComponents: libraryDetails.mainComponents ?? activeStagedIngredient.dominantCompounds ?? [],
      goodWith: libraryDetails.pairingGood ?? activeStagedIngredient.goodWith ?? [],
      riskyWith: libraryDetails.pairingRisky ?? activeStagedIngredient.riskyWith ?? [],
    };

    // Save to user's custom personal library if requested
    if (autoSaveToLibrary) {
      const alreadyExists = customIngredients.some(x => x.name === activeStagedIngredient.name);
      if (!alreadyExists) {
        const updated = [activeStagedIngredient, ...customIngredients];
        setCustomIngredients(updated);
        localStorage.setItem("alchemix_custom_ingredients", JSON.stringify(updated));
      }
    }

    setAddedIngredients(prev => [...prev, newIng]);
    onTrackEvent?.({
      eventName: "ingredient_added",
      page: "lab",
      action: "add",
      target: newIng.name,
      ingredientIds: [newIng.id],
      metadata: {
        category: newIng.category,
        amount: newIng.amount,
        abv: newIng.abv,
        carbonation: newIng.carbonation,
        dairy: newIng.dairy,
      },
    });
    setActiveStagedIngredient(null);
    setShowAddModal(false);
  };

  const handleRemoveIngredient = (id: string) => {
    setAddedIngredients(prev => prev.filter(item => item.id !== id));
  };

  const handleClearBeaker = () => {
    if (confirm("🧪 确定要洗涤当前烧杯，清空所有已加试剂吗？")) {
      setAddedIngredients([]);
    }
  };

  // --- REACTION SEQUENCE ---
  const handleInitiateReaction = async () => {
    if (addedIngredients.length < 2) return;
    onTrackEvent?.({
      eventName: "lab_mix_start",
      page: "lab",
      action: "start",
      target: mixMethod,
      ingredientIds: addedIngredients.map((item) => item.id),
      metadata: {
        ingredientCount: addedIngredients.length,
        totalVolume: addedIngredients.reduce((sum, item) => sum + item.amount, 0),
      },
    });
    
    setIsReacting(true);
    setReactionStage("【注入】稳定分子键合中...");

    // Staggered clinical stages
    setTimeout(() => {
      setReactionStage("【扩散】层析梯度分析中...");
    }, 1000);

    setTimeout(() => {
      setReactionStage(mixMethod === "Shake" ? "【高频激荡】分子发生激烈碰撞融合..." : "【滴定搅拌】进行常温扩散物理共振...");
    }, 2000);

    try {
      const response = await fetch("/api/lab-mix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients: addedIngredients.map(item => ({
            name: item.name,
            amount: item.amount,
            category: item.category,
            abv: item.abv,
            sweetness: item.sweetness,
            acidity: item.acidity,
            bitterness: item.bitterness,
            carbonation: item.carbonation,
            viscosity: item.viscosity,
            dairy: item.dairy,
            tea: item.tea,
            fruit: item.fruit,
            freshness: item.freshness,
            sugarGPer100ml: item.sugarGPer100ml,
            caffeineMgPer100ml: item.caffeineMgPer100ml,
            caffeine: item.caffeine,
            flavorTags: item.flavorTags,
            mainComponents: item.mainComponents,
            goodWith: item.goodWith,
            riskyWith: item.riskyWith,
          })),
          mixMethod
        })
      });

      if (!response.ok) {
        throw new Error("Reaction failed");
      }

      const data = await response.json();
      
      setTimeout(() => {
        setLabResult({
          id: `lab-${Date.now()}`,
          chineseName: data.chineseName,
          name: data.name,
          subtitle: data.subtitle,
          spirit: addedIngredients.filter(i => (i.abv ?? 0) > 0 || i.category.includes("酒") || i.category === "基酒").map(i => i.name).join("+") || "无基酒特调",
          mixer: addedIngredients.filter(i => !((i.abv ?? 0) > 0 || i.category.includes("酒") || i.category === "基酒")).map(i => i.name).join("+") || "纯液体共振",
          size: `${data.metrics?.totalVolumeMl ?? addedIngredients.reduce((sum, item) => sum + item.amount, 0)}ml`,
          rating: data.rating,
          comments: data.comments,
          adviceSections: data.adviceSections,
          tags: data.tags,
          ingredients: addedIngredients,
          mixMethod: mixMethod
        });
        onTrackEvent?.({
          eventName: "lab_result_view",
          page: "lab",
          action: "view",
          target: data.chineseName,
          ingredientIds: addedIngredients.map((item) => item.id),
          metadata: {
            mixMethod,
            rating: data.rating,
          },
        });
        setIsReacting(false);
        setReactionStage("");
        setShowResults(true);
        setHasSavedResult(false);
      }, 3200);

    } catch (err) {
      console.error(err);
      // Failover calculated locally
      setTimeout(() => {
        const localAnalysis = analyzeMixologyRecipe(addedIngredients, mixMethod);

        setLabResult({
          id: `lab-${Date.now()}`,
          chineseName: localAnalysis.chineseName,
          name: localAnalysis.name,
          subtitle: localAnalysis.subtitle,
          spirit: addedIngredients.filter(i => (i.abv ?? 0) > 0 || i.category.includes("酒") || i.category === "基酒").map(i => i.name).join("+") || "无基酒特调",
          mixer: addedIngredients.filter(i => !((i.abv ?? 0) > 0 || i.category.includes("酒") || i.category === "基酒")).map(i => i.name).join("+") || "纯液体共振",
          size: `${localAnalysis.metrics.totalVolumeMl}ml`,
          rating: localAnalysis.rating,
          comments: localAnalysis.comments,
          adviceSections: localAnalysis.adviceSections,
          tags: localAnalysis.tags,
          ingredients: addedIngredients,
          mixMethod: mixMethod
        });
        onTrackEvent?.({
          eventName: "lab_result_view",
          page: "lab",
          action: "view",
          target: localAnalysis.chineseName,
          ingredientIds: addedIngredients.map((item) => item.id),
          metadata: {
            mixMethod,
            rating: localAnalysis.rating,
            fallback: true,
          },
        });
        setIsReacting(false);
        setReactionStage("");
        setShowResults(true);
        setHasSavedResult(false);
      }, 3200);
    }
  };

  const handleSaveToNotebook = () => {
    if (labResult) {
      onSaveCocktail({
        ...labResult,
        savedAt: new Date().toISOString().split("T")[0],
        ratingValue: 5,
        sourcePage: "lab",
      });
      setHasSavedResult(true);
    }
  };

  // --- VISUAL COMPUTATIONS ---
  const totalVolume = addedIngredients.reduce((sum, item) => sum + item.amount, 0);
  const totalHeightPercent = Math.min(92, (totalVolume / MAX_BEAKER_VOLUME) * 90);
  const drinkCategories = [
    "全部",
    ...mixerCategoryFrequency.filter((category) => allNonAlcoholLibrary.some((item) => item.libraryCategory === category)),
    ...Array.from(new Set(allNonAlcoholLibrary.map((item) => item.libraryCategory))).filter((category) => !mixerCategoryFrequency.includes(category)),
  ];
  const activeLibraryItems = selectedLibraryMode === "alcohol"
    ? sortAlcoholByPurchaseUse(
        allAlcoholLibrary.filter((item) => selectedAbvRange === "all" || item.abvRange === selectedAbvRange),
        selectedAbvRange,
      )
    : selectedLibraryMode === "nonAlcohol"
      ? sortMixersByConvenienceUse(
          allNonAlcoholLibrary.filter((item) => selectedDrinkCategory === "全部" || item.libraryCategory === selectedDrinkCategory),
        )
      : [];
  const searchSuggestions = searchQuery.trim()
    ? findLocalIngredientMatches(
        searchQuery.trim(),
        hasNonAlcoholDrinkIntent(searchQuery) && !hasExplicitAlcoholIntent(searchQuery)
          ? allNonAlcoholLibrary
          : fullIngredientLibrary,
      ).slice(0, 12) as LibraryIngredient[]
    : [];
  const activeLibraryDetails = activeStagedIngredient as Partial<LibraryIngredient> | null;
  const mixMethodAdvice = buildMixMethodAdvice(addedIngredients, mixMethod);
  const mixMethodRecommendation = buildMixMethodRecommendation(addedIngredients);
  const labDecision = labResult?.ingredients?.length
    ? buildLabDecision(labResult.ingredients as LabIngredient[], (labResult.mixMethod === "Shake" ? "Shake" : "Stir"))
    : null;
  const labAdviceSections = labResult?.adviceSections?.length
    ? labResult.adviceSections
    : labResult?.comments
      ? [{ title: "新手调酒建议", body: labResult.comments }]
      : [];

  return (
    <div className="space-y-4 pb-6">
      {/* Top Header */}
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-neutral-500 border border-[#E8E8E8]">
              Molecular Dispenser
            </span>
          </div>
          <h2 className="text-[28px] font-bold leading-tight text-neutral-950">酒精实验室</h2>
          <p className="text-[13px] leading-5 text-neutral-500">
            把喜欢的酒和饮料加进来，调一杯属于你的便利店特调。
          </p>
        </div>
        
        {/* Help Rule Button */}
        <button
          onClick={() => setShowRulesModal(true)}
          className="w-10 h-10 border border-[#E8E8E8] bg-white rounded-full flex items-center justify-center hover:bg-neutral-50 transition-all text-neutral-500"
          title="实验室规则"
        >
          <HelpCircle size={18} />
        </button>
      </div>

      {!showResults ? (
        <>
          {/* TOP ACTION: Ingredient selection trigger */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-950">添加材料</h3>
              <span className="text-[11px] font-medium text-neutral-400">Ingredient Dispenser</span>
            </div>

            <button
              onClick={() => {
                setActiveStagedIngredient(null);
                setShowAddModal(true);
              }}
              className="w-full py-3.5 border border-[#E8E8E8] bg-white hover:border-neutral-300 hover:bg-neutral-50 rounded-2xl flex items-center justify-center gap-3 transition-all group shadow-[0_1px_8px_rgba(15,23,42,0.04)] active:scale-[0.99]"
            >
              <div className="w-8 h-8 rounded-full bg-[#F7F7F5] border border-[#E8E8E8] flex items-center justify-center group-hover:bg-neutral-950 group-hover:text-white group-hover:border-neutral-950 transition-all">
                <Plus size={16} />
              </div>
              <div className="text-left">
                <span className="block text-sm font-bold text-neutral-900">添加实验材料</span>
                <p className="text-[11px] leading-4 text-neutral-400">从酒类、饮料和配料库中选择</p>
              </div>
            </button>
          </section>

          {/* MIDDLE AREA: Compact beaker and recipe list */}
          <section className="grid grid-cols-[0.9fr_1.1fr] gap-3 items-stretch bg-white p-3 rounded-2xl border border-[#E8E8E8] shadow-[0_1px_10px_rgba(15,23,42,0.04)] relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_10%,rgba(251,191,36,0.10),transparent_26%),radial-gradient(circle_at_75%_20%,rgba(56,189,248,0.10),transparent_24%)] pointer-events-none"></div>

            {/* A. Dynamic Beaker Visual Container */}
            <div className="flex flex-col items-center justify-center p-2 relative z-10">
              <div className="relative w-32 h-40 border-x-[3px] border-b-[3px] border-neutral-300/80 rounded-b-[2rem] overflow-hidden flex flex-col justify-end bg-white/60 shadow-inner">
                {/* Lip details */}
                <div className="absolute -top-0.5 left-1/2 h-2 w-[78%] -translate-x-1/2 rounded-full border border-neutral-300 bg-white"></div>
                <div className="absolute left-3 right-3 top-3 z-20 flex justify-between pointer-events-none">
                  <span className="h-2 w-2 rounded-full bg-white/80 border border-neutral-200"></span>
                  <span className="h-1.5 w-1.5 rounded-full bg-white/70 border border-neutral-200"></span>
                </div>

                {/* Beaker Calibration Graduations */}
                <div className="absolute left-0 top-0 bottom-0 w-full flex flex-col justify-between py-5 pl-2 z-20 pointer-events-none select-none">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-[1.5px] bg-neutral-300"></div>
                    <span className="text-[8px] font-bold text-neutral-400">{MAX_BEAKER_VOLUME}ml</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-[1px] bg-neutral-200"></div>
                    <span className="text-[7px] text-neutral-300">300</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-[1px] bg-neutral-200"></div>
                    <span className="text-[7px] text-neutral-300">200</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-[1px] bg-neutral-200"></div>
                    <span className="text-[7px] text-neutral-300">100</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-[1.5px] bg-neutral-300"></div>
                    <span className="text-[8px] font-bold text-neutral-400">50</span>
                  </div>
                </div>

                {/* Stacked Liquids Layer Logic */}
                <div 
                  className="w-full transition-all duration-500 ease-out flex flex-col-reverse justify-start overflow-hidden relative"
                  style={{ height: `${totalHeightPercent}%` }}
                >
                  {addedIngredients.map((item, idx) => {
                    const itemHeightPercent = (item.amount / totalVolume) * 100;
                    return (
                      <div
                        key={item.id}
                        className="w-full relative transition-all duration-300 border-t border-white/30 flex items-center justify-center overflow-hidden"
                        style={{ 
                          height: `${itemHeightPercent}%`,
                          backgroundColor: item.color,
                        }}
                      >
                        {/* If carbonated/bubbly, render floaters */}
                        {item.isBubbly && (
                          <div className="absolute inset-0 pointer-events-none">
                            <span className="absolute w-1 h-1 bg-white/50 rounded-full left-1/4 bottom-1 animate-ping"></span>
                            <span className="absolute w-1.5 h-1.5 bg-white/40 rounded-full left-2/3 bottom-3 animate-pulse"></span>
                            <span className="absolute w-0.5 h-0.5 bg-white/30 rounded-full left-1/2 bottom-2 animate-ping"></span>
                          </div>
                        )}
                        <span className="text-[9px] font-bold text-neutral-900/40 truncate px-2 relative z-10">
                          {item.name.split(" ")[0]}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Mixing action animation during reaction */}
                {isReacting && (
                  <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/55 backdrop-blur-[1px]">
                    <MixingActionAnimation method={mixMethod} />
                  </div>
                )}
              </div>

              {/* Total volume feedback */}
              <div className="mt-2 text-center space-y-0.5">
                <p className="text-[9px] uppercase font-bold text-neutral-400 tracking-widest">CURRENT TOTAL</p>
                <p className="text-2xl text-neutral-950 font-bold">{totalVolume} <span className="text-xs font-medium text-neutral-400">ml</span></p>
              </div>
            </div>

            {/* B. Active Ingredients Notebook Sheet */}
            <div className="flex flex-col h-full justify-between space-y-2 py-1 relative z-10 min-w-0">
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-[#E8E8E8] pb-1.5">
                  <h3 className="text-xs font-bold text-neutral-900">当前材料</h3>
                  {addedIngredients.length > 0 && (
                    <button 
                      onClick={handleClearBeaker}
                      className="text-[10px] text-red-500 font-bold hover:opacity-80 flex items-center gap-1"
                    >
                      <RotateCcw size={10} />
                      清空烧杯
                    </button>
                  )}
                </div>

                {addedIngredients.length === 0 ? (
                  <div className="py-5 px-3 text-center text-neutral-400 space-y-2 border border-dashed border-[#E8E8E8] rounded-2xl bg-[#F7F7F5]/70">
                    <Beaker className="mx-auto text-neutral-300 stroke-[1.5]" size={26} />
                    <p className="text-[11px] leading-relaxed">先点击上方添加材料，再确认注入烧杯。</p>
                  </div>
                ) : (
                  <div className="max-h-[118px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                    {addedIngredients.map((item) => (
                      <div 
                        key={item.id} 
                        className="flex items-center justify-between p-2 rounded-xl border border-[#E8E8E8] bg-[#F7F7F5]/70 hover:border-neutral-300 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ backgroundColor: item.color }}></div>
                          <div>
                            <p className="text-xs font-semibold text-neutral-900">{item.name}</p>
                            <span className="text-[9px] font-medium text-neutral-400 bg-white px-1.5 py-0.5 rounded-full border border-[#E8E8E8]">{item.category}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-neutral-700">{item.amount}ml</span>
                          <button
                            onClick={() => handleRemoveIngredient(item.id)}
                            className="text-neutral-300 hover:text-red-500 transition-colors"
                            title="洗去该材料"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Status checklist metrics */}
              <div className="bg-[#F7F7F5] p-2 rounded-2xl border border-[#E8E8E8] text-[10px] text-neutral-500 space-y-1">
                <div className="flex justify-between">
                  <span>材料数量:</span>
                  <span className="font-bold text-neutral-800">{addedIngredients.length} / 6 种</span>
                </div>
                <div className="flex justify-between">
                  <span>当前状态:</span>
                  <span className="font-bold text-neutral-800">
                    {addedIngredients.length === 0 ? "空杯" : addedIngredients.length === 1 ? "单一材料" : "已混合"}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {mixMethodRecommendation && (
            <section
              className={`rounded-2xl border p-2.5 shadow-[0_4px_14px_rgba(15,23,42,0.025)] animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                mixMethodRecommendation.tone === "warning"
                  ? "border-amber-200 bg-amber-50/85"
                  : mixMethodRecommendation.method === "Shake"
                    ? "border-sky-100 bg-sky-50/70"
                    : "border-emerald-100 bg-emerald-50/60"
              }`}
            >
              <div className="flex items-start gap-2">
                <div
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-white ${
                    mixMethodRecommendation.tone === "warning"
                      ? "border-amber-200 text-amber-700"
                      : mixMethodRecommendation.method === "Shake"
                        ? "border-sky-100 text-sky-700"
                        : "border-emerald-100 text-emerald-700"
                  }`}
                >
                  {mixMethodRecommendation.method === "Shake" ? <Sparkles size={13} /> : <Activity size={13} />}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-bold text-neutral-950">{mixMethodRecommendation.title}</p>
                    <p className="text-[10px] leading-4 text-neutral-600">{mixMethodRecommendation.message}</p>
                  </div>

                  {mixMethod !== mixMethodRecommendation.method && (
                    <button
                      onClick={() => setMixMethod(mixMethodRecommendation.method)}
                      className="inline-flex h-7 items-center gap-1.5 rounded-full border border-neutral-900 bg-neutral-950 px-2.5 text-[10px] font-bold text-white transition-all active:scale-[0.98] cursor-pointer"
                    >
                      使用 {mixMethodRecommendation.method === "Shake" ? "Shake 摇合" : "Stir 轻搅"}
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* INTERACTION AREA: Stir / Shake */}
          {addedIngredients.length >= 2 && (
            <section className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-neutral-950">混合方式</h3>
                <span className="text-[11px] font-medium text-neutral-400">Mixing Method</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {/* Stir Button */}
                <button
                  onClick={() => setMixMethod("Stir")}
                  className={`relative overflow-hidden p-3 rounded-[1.25rem] border text-left transition-all active:scale-[0.98] cursor-pointer ${
                    mixMethod === "Stir"
                      ? "border-neutral-950 bg-white shadow-[0_8px_22px_rgba(15,23,42,0.08)]"
                      : "border-[#E8E8E8] bg-white/80 hover:bg-white hover:border-neutral-300"
                  }`}
                >
                  <div className={`absolute inset-x-0 top-0 h-1 ${mixMethod === "Stir" ? "bg-[#FACC15]" : "bg-transparent"}`}></div>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-8 h-8 shrink-0 rounded-2xl flex items-center justify-center border ${
                      mixMethod === "Stir"
                        ? "bg-[#FFF7D6] border-[#FDE68A] text-neutral-950"
                        : "bg-[#F7F7F5] border-[#E8E8E8] text-neutral-500"
                    }`}>
                      <Activity size={15} />
                    </div>
                    <div className="min-w-0 flex items-center gap-1.5">
                      <div className="flex items-center gap-1">
                        <h4 className="text-xs font-bold text-neutral-950">Stir</h4>
                        {mixMethod === "Stir" && (
                          <span className="h-1.5 w-1.5 rounded-full bg-neutral-950"></span>
                        )}
                      </div>
                      <p className="text-[11px] font-semibold text-neutral-500 whitespace-nowrap">慢搅拌</p>
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-neutral-500">
                    保留气泡感，适合茶饮、苏打和清爽长饮。
                  </p>
                </button>

                {/* Shake Button */}
                <button
                  onClick={() => setMixMethod("Shake")}
                  className={`relative overflow-hidden p-3 rounded-[1.25rem] border text-left transition-all active:scale-[0.98] cursor-pointer ${
                    mixMethod === "Shake"
                      ? "border-neutral-950 bg-white shadow-[0_8px_22px_rgba(15,23,42,0.08)]"
                      : "border-[#E8E8E8] bg-white/80 hover:bg-white hover:border-neutral-300"
                  }`}
                >
                  <div className={`absolute inset-x-0 top-0 h-1 ${mixMethod === "Shake" ? "bg-[#7DD3FC]" : "bg-transparent"}`}></div>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-8 h-8 shrink-0 rounded-2xl flex items-center justify-center border ${
                      mixMethod === "Shake"
                        ? "bg-[#E0F2FE] border-[#BAE6FD] text-neutral-950"
                        : "bg-[#F7F7F5] border-[#E8E8E8] text-neutral-500"
                    }`}>
                      <Sparkles size={15} />
                    </div>
                    <div className="min-w-0 flex items-center gap-1.5">
                      <div className="flex items-center gap-1">
                        <h4 className="text-xs font-bold text-neutral-950">Shake</h4>
                        {mixMethod === "Shake" && (
                          <span className="h-1.5 w-1.5 rounded-full bg-neutral-950"></span>
                        )}
                      </div>
                      <p className="text-[11px] font-semibold text-neutral-500 whitespace-nowrap">摇一摇</p>
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-neutral-500">
                    口感更绵密，适合果汁、乳酸饮料和奶类。
                  </p>
                </button>
              </div>

              <div className="rounded-[1.25rem] border border-[#E8E8E8] bg-white/90 p-3 shadow-[0_6px_18px_rgba(15,23,42,0.03)]">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#E8E8E8] bg-[#F7F7F5] text-neutral-700">
                    <Info size={14} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-neutral-950">调法小常识</p>
                    <p className="text-[11px] leading-relaxed text-neutral-500">
                      气泡饮料和啤酒最后加，不进摇壶；奶类、乳酸饮料通常 Shake 更顺滑；果汁、柠檬和糖浆摇合后更均匀；纯酒型更适合 Stir。
                    </p>
                  </div>
                </div>
              </div>

              {mixMethodAdvice.length > 0 && (
                <div className="space-y-2">
                  {mixMethodAdvice.map((advice) => (
                    <div
                      key={`${advice.title}-${advice.message}`}
                      className={`rounded-[1.25rem] border p-3 ${
                        advice.tone === "warning"
                          ? "border-amber-200 bg-amber-50/80 text-amber-950"
                          : "border-sky-100 bg-sky-50/70 text-slate-900"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-white ${
                            advice.tone === "warning"
                              ? "border-amber-200 text-amber-700"
                              : "border-sky-100 text-sky-700"
                          }`}
                        >
                          <HelpCircle size={14} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-bold">{advice.title}</p>
                          <p className="text-[11px] leading-relaxed opacity-80">{advice.message}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* BOTTOM MAIN BUTTON */}
          <section className="pt-4">
            <button
              onClick={handleInitiateReaction}
              disabled={addedIngredients.length < 2 || isReacting}
              className={`w-full py-4 px-6 rounded-2xl text-base font-bold transition-all flex flex-col items-center justify-center gap-1 ${
                addedIngredients.length >= 2 
                  ? isReacting
                    ? "bg-neutral-800 text-neutral-200 cursor-not-allowed"
                    : "bg-neutral-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)] hover:bg-black active:scale-[0.99]"
                  : "bg-[#F2F2F2] text-neutral-400 cursor-not-allowed border border-[#E8E8E8]"
              }`}
            >
              {isReacting ? (
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined animate-spin text-xl">autorenew</span>
                  <span>{reactionStage}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Beaker size={18} className="animate-pulse" />
                  <span>开始实验</span>
                </div>
              )}
              <span className="text-[10px] font-medium opacity-70">
                {addedIngredients.length >= 2 ? "生成这杯的风味建议" : "至少加入 2 种材料"}
              </span>
            </button>
          </section>
        </>
      ) : (
        /* RESULTS SCREEN (实验结果页) */
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 md:p-8 shadow-sm space-y-8 animate-in fade-in zoom-in-95 duration-300 relative">
          <div className="absolute inset-0 notebook-grid opacity-[0.03] pointer-events-none"></div>

          {/* 1. Header & Creative Cocktail Visual Display */}
          <div className="flex flex-col items-center text-center space-y-4">
            {/* Visual Glass Representation Cup based on ingredients */}
            <div className="relative w-28 h-28 border border-slate-200 rounded-full flex items-center justify-center bg-slate-50 shadow-inner">
              <span className="material-symbols-outlined text-5xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                local_bar
              </span>

              {/* Dynamic floating feedback sparkles */}
              <div className="absolute -top-1 -right-1 bg-primary/10 p-1.5 rounded-full text-primary">
                <Sparkles size={14} />
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-mono text-primary font-bold bg-primary/5 px-3 py-1 rounded-full uppercase tracking-widest">
                MIX RESULT
              </span>
              <h3 className="text-2xl font-serif font-bold text-slate-900 mt-2">
                {labResult?.chineseName}
              </h3>
              <p className="text-xs font-mono text-slate-400 uppercase tracking-widest">{labResult?.name}</p>
              <blockquote className="text-xs text-slate-500 italic font-light">
                “{labResult?.subtitle}”
              </blockquote>
            </div>
          </div>

          {labDecision && (
            <section
              className={`rounded-2xl border px-3 py-2.5 ${
                labDecision.level === "avoid"
                  ? "border-red-200 bg-red-50/80"
                  : labDecision.level === "caution"
                    ? "border-amber-200 bg-amber-50/80"
                    : "border-emerald-200 bg-emerald-50/70"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white ${
                    labDecision.level === "avoid"
                      ? "text-red-600"
                      : labDecision.level === "caution"
                        ? "text-amber-700"
                        : "text-emerald-700"
                  }`}
                >
                  <Info size={13} />
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-neutral-950">建议</h4>
                    <button
                      type="button"
                      onClick={() => setShowDecisionGuide(true)}
                      className="shrink-0 rounded-full border border-white/70 bg-white/80 px-2 py-1 text-[10px] font-bold text-neutral-600 active:scale-[0.98]"
                    >
                      说明
                    </button>
                  </div>
                  <p className="line-clamp-2 text-[11px] leading-4 text-neutral-700">{labDecision.reason}</p>
                </div>
              </div>
            </section>
          )}

          {/* 2. Recipe Recap Section */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
            <h4 className="text-[11px] font-bold text-slate-400 tracking-wider uppercase flex items-center gap-1.5">
              <Info size={11} />
              配方回顾
            </h4>
            <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-xs font-mono">
              <div className="text-slate-500">混合方式:</div>
              <div className="text-slate-800 text-right font-bold">{labResult?.mixMethod === "Shake" ? "Shake 摇合" : "Stir 轻搅"}</div>
              
              <div className="text-slate-500">成品总体积:</div>
              <div className="text-slate-800 text-right font-bold">{labResult?.size}</div>
            </div>

            <div className="pt-2 border-t border-slate-200/60 mt-2 space-y-1">
              <p className="text-[10px] text-slate-400 font-bold uppercase">加注成分细目:</p>
              <div className="flex flex-wrap gap-1.5">
                {labResult?.ingredients?.map((ing: any) => (
                  <span key={ing.id} className="text-[10px] bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-mono">
                    {ing.name} <span className="font-bold text-slate-900">{ing.amount}ml</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 3. FLAVOR CHART - 8-Dimensions (风味表) */}
          <div className="space-y-4">
            <div className="flex justify-between items-baseline border-b border-slate-200 pb-1.5">
              <h4 className="text-xs font-bold text-slate-700 tracking-wider uppercase">参考风味指标</h4>
              <span className="text-[9px] font-mono text-slate-400 uppercase">0-5 Reference</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5">
              {/* Sweetness */}
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-500">甜度 SWEET</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((dot) => (
                    <span 
                      key={dot} 
                      className={`w-3 h-3 rounded-full ${dot <= (labResult?.rating?.sweet || 1) ? "bg-primary" : "bg-slate-100 border border-slate-200/50"}`}
                    ></span>
                  ))}
                </div>
              </div>

              {/* Acidity */}
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-500">酸度 ACID</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((dot) => (
                    <span 
                      key={dot} 
                      className={`w-3 h-3 rounded-full ${dot <= (labResult?.rating?.acid || 1) ? "bg-primary" : "bg-slate-100 border border-slate-200/50"}`}
                    ></span>
                  ))}
                </div>
              </div>

              {/* Strength */}
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-500">酒感 STRENGTH</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((dot) => (
                    <span 
                      key={dot} 
                      className={`w-3 h-3 rounded-full ${dot <= (labResult?.rating?.strength || 1) ? "bg-primary" : "bg-slate-100 border border-slate-200/50"}`}
                    ></span>
                  ))}
                </div>
              </div>

              {/* Creamy */}
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-500">奶香/乳酸 CREAMY</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((dot) => (
                    <span 
                      key={dot} 
                      className={`w-3 h-3 rounded-full ${dot <= (labResult?.rating?.creamy || 1) ? "bg-primary" : "bg-slate-100 border border-slate-200/50"}`}
                    ></span>
                  ))}
                </div>
              </div>

              {/* Herbal */}
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-500">草本/茶香 HERBAL</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((dot) => (
                    <span 
                      key={dot} 
                      className={`w-3 h-3 rounded-full ${dot <= (labResult?.rating?.herbal || 1) ? "bg-primary" : "bg-slate-100 border border-slate-200/50"}`}
                    ></span>
                  ))}
                </div>
              </div>

              {/* Bubbly */}
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-500">二氧化碳气泡 BUBBLY</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((dot) => (
                    <span 
                      key={dot} 
                      className={`w-3 h-3 rounded-full ${dot <= (labResult?.rating?.bubbly || 1) ? "bg-primary" : "bg-slate-100 border border-slate-200/50"}`}
                    ></span>
                  ))}
                </div>
              </div>

              {/* Freshness */}
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-500">清爽度 FRESHNESS</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((dot) => (
                    <span 
                      key={dot} 
                      className={`w-3 h-3 rounded-full ${dot <= (labResult?.rating?.freshness || 1) ? "bg-primary" : "bg-slate-100 border border-slate-200/50"}`}
                    ></span>
                  ))}
                </div>
              </div>

              {/* Heaviness */}
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-500">厚重感/黏度 HEAVINESS</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((dot) => (
                    <span 
                      key={dot} 
                      className={`w-3 h-3 rounded-full ${dot <= (labResult?.rating?.heaviness || 1) ? "bg-primary" : "bg-slate-100 border border-slate-200/50"}`}
                    ></span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#E8E8E8] bg-[#F7F7F5] p-3 text-[11px] leading-5 text-neutral-500">
            风味数值为基于公开资料、常见营养数据和调酒规则的参考估算，不代表实验室检测结果。实际口感会受品牌、冰量、温度和倒入比例影响。
          </div>

          {/* 4. Lab notebook comments */}
          <div className="bg-slate-50 p-4 border border-slate-200/60 rounded-xl space-y-3">
            <h4 className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <Beaker size={12} />
              新手调酒建议
            </h4>
            <div className="space-y-2">
              {labAdviceSections.map((section, index) => (
                <article key={`${section.title}-${index}`} className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-[10px] font-bold text-white">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <h5 className="text-xs font-bold text-slate-900">{section.title}</h5>
                      <p className="mt-1 text-[12px] leading-5 text-slate-600">{section.body}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="flex gap-1.5 flex-wrap pt-2">
              {labResult?.tags?.map((t) => (
                <span key={t} className="text-[9px] font-mono bg-white text-slate-500 border border-slate-200 px-2 py-0.5 rounded">
                  #{t}
                </span>
              ))}
            </div>
          </div>

          {/* 5. Results Action Buttons */}
          <div className="space-y-2.5 pt-2">
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => {
                  setAddedIngredients([]);
                  setShowResults(false);
                }}
                className="h-12 rounded-2xl border border-[#E5E7EB] bg-white text-[13px] font-bold text-neutral-700 hover:bg-[#F7F7F5] hover:border-neutral-300 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_1px_6px_rgba(15,23,42,0.03)]"
              >
                <RotateCcw size={15} strokeWidth={2.2} />
                再调一杯
              </button>
              
              <button
                onClick={() => {
                  setShowResults(false);
                }}
                className="h-12 rounded-2xl border border-[#E5E7EB] bg-white text-[13px] font-bold text-neutral-700 hover:bg-[#F7F7F5] hover:border-neutral-300 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_1px_6px_rgba(15,23,42,0.03)]"
              >
                <Beaker size={15} strokeWidth={2.2} />
                调整配方
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowDecisionGuide(true)}
              className="h-11 w-full rounded-2xl border border-[#E5E7EB] bg-white text-[12px] font-bold text-neutral-700 hover:bg-[#F7F7F5] hover:border-neutral-300 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_1px_6px_rgba(15,23,42,0.03)]"
            >
              <Info size={14} strokeWidth={2.2} />
              查看建议说明
            </button>

            {labResult && onSaveDrinkLog && (
              <DrinkLogButton
                recipe={{
                  id: labResult.id || `lab-${labResult.name || labResult.chineseName}`,
                  nameZh: labResult.chineseName || labResult.name,
                  nameEn: labResult.name,
                  description: labResult.subtitle || labResult.comments,
                  tags: labResult.tags,
                  ingredients: labResult.ingredients?.map((item: any) => ({
                    name: item.name,
                    amount: item.amount,
                    unit: "ml",
                    category: item.category,
                  })),
                  method: labResult.mixMethod === "Shake" ? "加入摇壶，加冰后充分摇合，再倒入杯中。" : "加入杯中，加冰后轻轻搅拌均匀。",
                  sourcePage: "lab",
                } satisfies DrinkLogRecipeSnapshot}
                sourcePage="lab"
                drinkLogs={drinkLogs}
                onSaveDrinkLog={onSaveDrinkLog}
                variant="text"
                className="h-[52px] w-full rounded-2xl"
              />
            )}

            <button
              onClick={handleSaveToNotebook}
              disabled={hasSavedResult}
              className={`h-[52px] w-full rounded-2xl text-[14px] font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${
                hasSavedResult 
                  ? "bg-neutral-200 text-neutral-500 cursor-default" 
                  : "bg-neutral-950 text-white hover:bg-neutral-800 shadow-[0_10px_24px_rgba(15,23,42,0.14)]"
              }`}
            >
              {hasSavedResult ? <Check size={16} strokeWidth={2.3} /> : <Bookmark size={16} strokeWidth={2.3} />}
              {hasSavedResult ? "已存入酒记" : "存入酒记"}
            </button>
          </div>
        </div>
      )}

      {showDecisionGuide && (
        <div className="fixed inset-0 z-[160] flex items-end justify-center bg-black/30 px-4 pb-4 backdrop-blur-[2px] sm:items-center sm:pb-0">
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => setShowDecisionGuide(false)}
            aria-label="关闭判断说明"
          ></button>

          <div className="relative z-10 w-full max-w-[390px] rounded-[28px] border border-[#E8E8E8] bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.22)] animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-400">Mix Guide</p>
                <h3 className="mt-1 text-xl font-bold text-neutral-950">为什么这样建议</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDecisionGuide(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E8E8E8] bg-[#F7F7F5] text-neutral-500 active:scale-[0.98]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              {[
                {
                  title: "没有明显冲突时",
                  tone: "border-emerald-200 bg-emerald-50/70",
                  body: "系统会建议先按当前比例小杯试调。比如金酒+汤力水选 Stir、伏特加+橙汁选 Shake，重点是先尝一口再微调。",
                },
                {
                  title: "有口感翻车风险时",
                  tone: "border-amber-200 bg-amber-50/80",
                  body: "系统会提醒减少高风险材料或加冰稀释。常见于奶类/乳酸遇高酸、咖啡因饮料加酒、或高度酒比例偏高。",
                },
                {
                  title: "有明确操作风险时",
                  tone: "border-red-200 bg-red-50/80",
                  body: "系统会建议换做法。最常见是含气泡材料却选择 Shake，容易喷出，也会把气泡摇没；气泡饮料应该最后加并轻轻 Stir。",
                },
              ].map((item) => (
                <article key={item.title} className={`rounded-2xl border p-3 ${item.tone}`}>
                  <h4 className="text-sm font-bold text-neutral-950">{item.title}</h4>
                  <p className="mt-1 text-xs leading-5 text-neutral-600">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 1: ADD INGREDIENTS DIALECTIC DRAWER --- */}
      {showAddModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowAddModal(false)}
          ></div>
          
          <div className="relative bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-base font-serif font-bold text-slate-900">选择并配置加注材料</h3>
                <p className="text-[10px] text-slate-400">从本地原型配料数据库选择酒类、饮料或调味配料</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            {/* If there is an active staged ingredient, show the clinical pouring/configuration view */}
            {activeStagedIngredient ? (
              <div className="p-5 overflow-y-auto space-y-5 flex-grow">
                <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-xl p-5 border border-slate-800 shadow-xl space-y-4 relative overflow-hidden">
                  <div className="absolute inset-0 notebook-grid opacity-[0.03] pointer-events-none"></div>
                  
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[9px] font-mono tracking-widest text-slate-300 font-bold bg-white/10 px-2 py-0.5 rounded border border-white/10">
                        DATABASE ITEM
                      </span>
                      <h4 className="text-lg font-serif font-bold text-white mt-1">
                        {activeStagedIngredient.name}
                      </h4>
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                        {activeLibraryDetails?.englishName || activeStagedIngredient.notes || "Ingredient profile"}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono font-bold bg-slate-800 px-2.5 py-1 rounded-md text-slate-300">
                        ABV {activeStagedIngredient.abv || 0}%
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-slate-800">
                    <div className="rounded-lg bg-slate-800/70 border border-slate-700/60 p-2">
                      <p className="text-[8px] font-mono text-slate-500 uppercase">类型</p>
                      <p className="text-[11px] font-bold text-slate-200 mt-0.5">{activeLibraryDetails?.type || activeStagedIngredient.category}</p>
                    </div>
                    <div className="rounded-lg bg-slate-800/70 border border-slate-700/60 p-2">
                      <p className="text-[8px] font-mono text-slate-500 uppercase">推荐量</p>
                      <p className="text-[11px] font-bold text-slate-200 mt-0.5">{activeLibraryDetails?.recommendedAmount || amountToInject}ml</p>
                    </div>
                    <div className="rounded-lg bg-slate-800/70 border border-slate-700/60 p-2">
                      <p className="text-[8px] font-mono text-slate-500 uppercase">可获得性</p>
                      <p className="text-[11px] font-bold text-slate-200 mt-0.5 line-clamp-2">{activeLibraryDetails?.availability || "本地保存"}</p>
                    </div>
                  </div>

                  <div className="bg-white text-slate-900 rounded-xl border border-slate-700 overflow-hidden">
                    <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                      <p className="text-[10px] font-mono font-bold uppercase tracking-widest">配料表 / Ingredient Table</p>
                      <Database size={13} className="text-slate-400" />
                    </div>
                    <div className="divide-y divide-slate-100 text-xs">
                      {activeLibraryDetails?.juiceData && (
                        <>
                          <div className="grid grid-cols-[88px_1fr] gap-2 px-3 py-2.5">
                            <span className="text-[10px] font-bold text-slate-400">常见配料</span>
                            <div className="flex flex-wrap gap-1">
                              {activeLibraryDetails.juiceData.ingredients.map((value) => (
                                <span key={value} className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-medium text-slate-700">
                                  {value}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-[88px_1fr] gap-2 px-3 py-2.5">
                            <span className="text-[10px] font-bold text-slate-400">糖分参考</span>
                            <span className="text-[10px] font-mono font-bold text-slate-700">
                              {activeLibraryDetails.juiceData.sugarGPer100ml === null ? "暂无精确值" : `${activeLibraryDetails.juiceData.sugarGPer100ml}g / 100ml`}
                            </span>
                          </div>
                          <div className="grid grid-cols-[88px_1fr] gap-2 px-3 py-2.5">
                            <span className="text-[10px] font-bold text-slate-400">pH / 酸度参考</span>
                            <span className="text-[10px] font-mono font-bold text-slate-700">
                              pH {activeLibraryDetails.juiceData.pHRange ?? "暂无"} · 酸度 {activeLibraryDetails.juiceData.acidity}/5
                            </span>
                          </div>
                        </>
                      )}
                      {[
                        ["主要成分", activeLibraryDetails?.mainComponents || activeStagedIngredient.dominantCompounds || []],
                        ["风味标签", activeStagedIngredient.flavorTags || []],
                        ["适合搭配", activeLibraryDetails?.pairingGood || activeStagedIngredient.goodWith || []],
                        ["不适合搭配", activeLibraryDetails?.pairingRisky || activeStagedIngredient.riskyWith || []],
                      ].map(([label, values]) => (
                        <div key={label as string} className="grid grid-cols-[88px_1fr] gap-2 px-3 py-2.5">
                          <span className="text-[10px] font-bold text-slate-400">{label as string}</span>
                          <div className="flex flex-wrap gap-1">
                            {(values as string[]).length > 0 ? (
                              (values as string[]).map((value) => (
                                <span key={value} className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-medium text-slate-700">
                                  {value}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-slate-400">暂无数据</span>
                            )}
                          </div>
                        </div>
                      ))}
                      <div className="grid grid-cols-[88px_1fr] gap-2 px-3 py-2.5">
                        <span className="text-[10px] font-bold text-slate-400">推荐注入量</span>
                        <span className="text-[10px] font-mono font-bold text-slate-700">{activeLibraryDetails?.recommendedAmount || amountToInject}ml</span>
                      </div>
                      <div className="grid grid-cols-[88px_1fr] gap-2 px-3 py-2.5">
                        <span className="text-[10px] font-bold text-slate-400">ABV</span>
                        <span className="text-[10px] font-mono font-bold text-slate-700">{activeStagedIngredient.abv || 0}%</span>
                      </div>
                      <div className="grid grid-cols-[88px_1fr] gap-2 px-3 py-2.5">
                        <span className="text-[10px] font-bold text-slate-400">便利店可获得性</span>
                        <span className="text-[10px] font-medium text-slate-700">{activeLibraryDetails?.availability || "本地自定义条目"}</span>
                      </div>
                      <div className="grid grid-cols-[88px_1fr] gap-2 px-3 py-2.5">
                        <span className="text-[10px] font-bold text-slate-400">数据可信度</span>
                        <span className="text-[10px] font-medium text-slate-700">
                          {Math.round((activeStagedIngredient.confidence ?? 0.72) * 100)}% · {activeStagedIngredient.dataSource === "ai_estimate" ? "估算参考" : "本地库"}
                        </span>
                      </div>
                      <div className="grid grid-cols-[88px_1fr] gap-2 px-3 py-2.5">
                        <span className="text-[10px] font-bold text-slate-400">来源说明</span>
                        <span className="text-[10px] leading-4 text-slate-600 line-clamp-3">
                          {activeStagedIngredient.notes || activeStagedIngredient.nutritionText || "本地 seed 数据；实际请以包装标签为准。"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Level selection & saving controls */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline">
                      <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">注入剂量 (VOLUME LEVEL)</label>
                      <span className="text-xs font-mono font-bold text-primary">{amountToInject}ml</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {amountOptions.map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setAmountToInject(amt)}
                          className={`py-2 text-xs font-mono font-bold rounded-lg border transition-all ${
                            amountToInject === amt
                              ? "bg-primary text-white border-primary"
                              : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          {amt}ml
                        </button>
                      ))}
                    </div>
                    <p className="text-[9px] text-slate-400 pt-1 leading-relaxed">
                      * 滴定提示: <span className="font-bold text-slate-600">5ml/15ml</span> 适合作料，<span className="font-bold text-slate-600">30ml/45ml</span> 适合烈酒骨架，<span className="font-bold text-slate-600">50ml/100ml</span> 适合长饮饮料释析。
                    </p>
                  </div>

                  {/* Save to library checkbox */}
                  <div className="flex items-center gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <input 
                      type="checkbox"
                      id="autosave"
                      checked={autoSaveToLibrary}
                      onChange={(e) => setAutoSaveToLibrary(e.target.checked)}
                      className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary accent-primary"
                    />
                    <label htmlFor="autosave" className="text-xs font-light text-slate-600 select-none cursor-pointer">
                      自动保存该原料到我的 <strong className="font-semibold text-slate-800">“人人配料图谱库”</strong> (本地永久化保存)
                    </label>
                  </div>

                  {/* Active Buttons */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setActiveStagedIngredient(null)}
                      className="flex-1 py-3.5 border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      重新选择
                    </button>
                    <button
                      onClick={handleConfirmAdd}
                      className="flex-1 py-3.5 bg-primary text-white hover:bg-black/90 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 shadow"
                    >
                      确认注入烧杯
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database size={14} className="text-slate-500" />
                    <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">
                      Local ingredient database
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-slate-400">Local first</span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 border-b border-slate-200 bg-white px-5 py-3">
                  {[
                    ["search", "本地搜索", "先查库"],
                    ["scan", "配料表", "贴文本"],
                    ["manual", "手动补全", "临时项"],
                  ].map(([tab, label, hint]) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => {
                        setModalTab(tab as "search" | "scan" | "manual");
                        if (tab === "manual" && pendingUnmatchedQuery && !manualName) {
                          setManualName(pendingUnmatchedQuery);
                        }
                        if (tab === "scan" && pendingUnmatchedQuery && !scanNameHint) {
                          setScanNameHint(pendingUnmatchedQuery);
                        }
                      }}
                      className={`rounded-xl border px-2 py-2 text-center transition-all active:scale-[0.98] ${
                        modalTab === tab
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-500"
                      }`}
                    >
                      <span className="block text-[11px] font-bold">{label}</span>
                      <span className={`mt-0.5 block text-[9px] ${modalTab === tab ? "text-slate-300" : "text-slate-400"}`}>{hint}</span>
                    </button>
                  ))}
                </div>

                {/* Scrollable content pane */}
                <div className="p-5 overflow-y-auto space-y-5 flex-grow max-h-[55vh]">
                  
                  {/* METHOD 1: DYNAMIC SEARCH */}
                  {modalTab === "search" && (
                    <div className="space-y-4">
                      {/* Search Form */}
                      <form onSubmit={handleSearchIngredient} className="flex gap-2">
                        <div className="relative flex-grow">
                          <input
                            type="text"
                            placeholder="搜索酒类、饮料或配料，例如：威士忌、养乐多、苏打水、乌龙茶"
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-primary transition-all bg-slate-50/50"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                          />
                          <Search className="absolute left-3 top-3 text-slate-400" size={14} />
                        </div>
                        <button
                          type="submit"
                          disabled={isSearching}
                          className="px-4 bg-primary text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all flex items-center gap-1 shadow-sm"
                        >
                          {isSearching ? (
                            <span className="material-symbols-outlined animate-spin text-sm">autorenew</span>
                          ) : (
                            "检索"
                          )}
                        </button>
                      </form>

                      {searchSuggestions.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">Search matches</p>
                          <div className="space-y-2">
                            {searchSuggestions.map((item) => {
                              const displayZh = item.convenienceData?.nameZh || item.juiceData?.nameZh || item.name;
                              const displayEn = item.convenienceData?.nameEn || item.juiceData?.nameEn || item.englishName;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => handleSelectPresetChip(item)}
                                  className="w-full p-3 rounded-xl border border-slate-200 hover:border-primary/40 hover:bg-slate-50 text-left transition-all bg-white"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-2.5">
                                      <div className="w-3 h-3 rounded-full border border-black/10 mt-1" style={{ backgroundColor: item.color }}></div>
                                      <div>
                                        <p className="text-xs font-bold text-slate-900">{displayZh}</p>
                                        <p className="text-[10px] font-mono font-medium text-slate-400">{displayEn}</p>
                                        <p className="text-[10px] text-slate-500 mt-0.5">{item.type} · ABV {item.abv || 0}% · 推荐 {item.recommendedAmount}ml</p>
                                        {(item.juiceData || item.convenienceData) && (
                                          <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                                            酸度 {item.acidity}/5 · 甜度 {item.sweetness}/5 · 搭配 {item.goodWith.slice(0, 3).join(" / ")}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <ChevronRight size={13} className="text-slate-300 mt-0.5" />
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Failure Recovery Guide (Alternatives) */}
                      {showFailGuide && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-3 animate-in fade-in duration-200">
                          <p className="font-semibold flex items-center gap-1.5">
                            <Info size={13} />
                            {searchError || "未在公共配料图谱中精确匹配到该饮料。"}
                          </p>

                          {fuzzyMatches.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-[10px] font-bold text-amber-800">你是不是在找这些？先确认本地相似项，避免重复补全。</p>
                              <div className="space-y-1.5">
                                {fuzzyMatches.slice(0, 4).map((item) => {
                                  const libraryItem = item as Partial<LibraryIngredient>;
                                  const displayZh = libraryItem.convenienceData?.nameZh || libraryItem.juiceData?.nameZh || item.name;
                                  const displayEn = libraryItem.convenienceData?.nameEn || libraryItem.juiceData?.nameEn || libraryItem.englishName || item.category;
                                  return (
                                    <button
                                      key={item.id}
                                      type="button"
                                      onClick={() => {
                                        setSearchError(null);
                                        setShowFailGuide(false);
                                        setFuzzyMatches([]);
                                        setPendingUnmatchedQuery("");
                                        stageLibraryIngredient(item);
                                      }}
                                      className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white/80 px-3 py-2 text-left transition active:scale-[0.99]"
                                    >
                                      <span className="min-w-0">
                                        <span className="block truncate text-xs font-bold text-slate-900">{displayZh}</span>
                                        <span className="block truncate text-[10px] font-medium text-slate-500">{displayEn}</span>
                                      </span>
                                      <span className="text-[10px] font-bold text-amber-700">选择</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <div className="rounded-xl border border-amber-200 bg-white/65 p-3">
                            <p className="text-[10px] font-bold text-amber-800">
                              {fuzzyMatches.length > 0 ? "都不是？继续补全" : "本地没有确认结果，可以这样补全"}
                            </p>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setManualName(pendingUnmatchedQuery || searchQuery);
                                  setModalTab("manual");
                                }}
                                className="rounded-xl bg-neutral-950 px-3 py-2 text-[11px] font-bold text-white active:scale-[0.98]"
                              >
                                手动输入配料表
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  alert("联网补全会在后续接入：只有本地无匹配、你确认不是相似项，并且当天未超调用额度时才会触发。当前 MVP 先使用手动配料表和本地审核。");
                                }}
                                className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-[11px] font-bold text-amber-800 active:scale-[0.98]"
                              >
                                联网补全资料
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Structured local database */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-baseline border-b border-slate-100 pb-1">
                          <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">本地配料数据库 (INGREDIENT DATABASE)</p>
                          <span className="text-[9px] text-slate-400 font-mono">No default brand</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedLibraryMode("alcohol");
                              setSelectedAbvRange("all");
                            }}
                            className={`p-4 rounded-2xl border text-left transition-all ${
                              selectedLibraryMode === "alcohol"
                                ? "border-primary bg-slate-950 text-white shadow-md"
                                : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                            }`}
                          >
                            <p className="text-sm font-serif font-bold">基酒 / 酒类</p>
                            <p className={`text-[10px] mt-1 ${selectedLibraryMode === "alcohol" ? "text-slate-300" : "text-slate-400"}`}>
                              Beer, Wine, Spirits
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedLibraryMode("nonAlcohol");
                              setSelectedDrinkCategory("全部");
                            }}
                            className={`p-4 rounded-2xl border text-left transition-all ${
                              selectedLibraryMode === "nonAlcohol"
                                ? "border-primary bg-slate-950 text-white shadow-md"
                                : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                            }`}
                          >
                            <p className="text-sm font-serif font-bold">饮料 / 非酒精配料</p>
                            <p className={`text-[10px] mt-1 ${selectedLibraryMode === "nonAlcohol" ? "text-slate-300" : "text-slate-400"}`}>
                              Mixers, acids, bitters
                            </p>
                          </button>
                        </div>

                        {selectedLibraryMode === "alcohol" && (
                          <div className="space-y-3">
                            <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
                              {(["all", "40+", "20-40", "10-20", "0-10"] as const).map((range) => (
                                <button
                                  key={range}
                                  type="button"
                                  onClick={() => setSelectedAbvRange(range)}
                                  className={`px-3 py-1.5 text-[10px] font-bold rounded-full border transition-all whitespace-nowrap ${
                                    selectedAbvRange === range
                                      ? "bg-primary text-white border-primary"
                                      : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                                  }`}
                                >
                                  {range === "all" ? "全部 ABV" : abvRangeLabel[range]}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedLibraryMode === "nonAlcohol" && (
                          <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
                            {drinkCategories.map((cat) => (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => setSelectedDrinkCategory(cat)}
                                className={`px-3 py-1.5 text-[10px] font-bold rounded-full border transition-all whitespace-nowrap ${
                                  selectedDrinkCategory === cat
                                    ? "bg-primary text-white border-primary"
                                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                                }`}
                              >
                                {cat}
                              </button>
                            ))}
                          </div>
                        )}

                        {selectedLibraryMode ? (
                          <div className="space-y-2">
                            {activeLibraryItems.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => handleSelectPresetChip(item)}
                                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-primary/40 hover:bg-slate-50/70 transition-all"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-2.5 min-w-0">
                                    <div className="w-3.5 h-3.5 rounded-full border border-black/10 mt-1 flex-shrink-0" style={{ backgroundColor: item.color }}></div>
                                    <div className="min-w-0">
                                      <div className="flex items-baseline gap-1.5 flex-wrap">
                                        <p className="text-sm font-bold text-slate-900">{item.name}</p>
                                        <p className="text-[10px] font-mono text-slate-400">{item.englishName}</p>
                                      </div>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[9px] font-bold text-slate-600">ABV {item.abv || 0}%</span>
                                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[9px] font-bold text-slate-600">{item.type}</span>
                                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[9px] font-bold text-slate-600">推荐 {item.recommendedAmount}ml</span>
                                        {item.juiceData && (
                                          <>
                                            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-[9px] font-bold text-amber-700 border border-amber-100">甜度 {item.juiceData.sweetness}/5</span>
                                            <span className="px-1.5 py-0.5 rounded bg-lime-50 text-[9px] font-bold text-lime-700 border border-lime-100">酸度 {item.juiceData.acidity}/5</span>
                                          </>
                                        )}
                                      </div>
                                      {item.juiceData && (
                                        <div className="mt-2 space-y-1 text-[10px] text-slate-500 leading-relaxed">
                                          <p>推荐搭配：{item.juiceData.suitableWith.slice(0, 4).join(" / ")}</p>
                                          <p>主要配料：{item.juiceData.ingredients.slice(0, 4).join("、")}</p>
                                          <p>推荐注入量：{item.juiceData.recommendedVolumeMl.join(" / ")}ml</p>
                                        </div>
                                      )}
                                      <div className="flex flex-wrap gap-1 mt-2">
                                        {item.flavorTags.slice(0, 4).map((tag) => (
                                          <span key={tag} className="px-1.5 py-0.5 rounded-md border border-slate-200 text-[9px] text-slate-500">
                                            {tag}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                  <ChevronRight size={13} className="text-slate-300 mt-1 flex-shrink-0" />
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-center">
                            <p className="text-xs font-light text-slate-400">请选择上方一种配料库类型开始浏览。</p>
                          </div>
                        )}
                      </div>

                      {/* Custom User Personal Library Items */}
                      {customIngredients.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-slate-100">
                          <div className="flex justify-between items-baseline">
                            <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">我的人人配谱库 (MY LIBRARY)</p>
                            <span className="text-[9px] text-slate-400 font-mono">{customIngredients.length} items</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {customIngredients.slice(0, 6).map((item) => (
                              <button
                                key={item.id || item.name}
                                type="button"
                                onClick={() => setActiveStagedIngredient(item)}
                                className="p-2.5 rounded-xl border border-slate-200 hover:border-primary/40 hover:bg-slate-50/50 text-left flex items-center justify-between transition-all bg-slate-50/50"
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  <div className="w-2.5 h-2.5 rounded-full bg-slate-400 flex-shrink-0"></div>
                                  <span className="text-xs font-semibold text-slate-700 truncate">{item.name}</span>
                                </div>
                                <ChevronRight size={12} className="text-slate-300" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* METHOD 2: INGREDIENT TEXT PARSE */}
                  {modalTab === "scan" && (
                    <div className="space-y-4">
                      <div className="relative aspect-video rounded-xl bg-slate-950 overflow-hidden flex flex-col items-center justify-center text-white border border-slate-800">
                        {isOcrScanning && (
                          <div className="absolute inset-x-0 h-1 bg-red-500/80 shadow-md shadow-red-500 animate-bounce top-1/2 pointer-events-none"></div>
                        )}
                        
                        <div className="text-center p-4 space-y-2 relative z-10">
                          <Camera className={`mx-auto text-primary stroke-[1.2] ${isOcrScanning ? "animate-pulse" : ""}`} size={32} />
                          <p className="text-xs font-bold tracking-wider">配料表文本整理</p>
                          <p className="text-[9px] text-slate-400 font-light max-w-xs mx-auto">
                            {isOcrScanning ? "正在整理配料表..." : "1.0 先不做拍照识别。请选择测试模板，或在下方粘贴瓶身配料表。"}
                          </p>
                        </div>
                        <div className="absolute inset-2 border border-white/5 pointer-events-none rounded-lg"></div>
                      </div>

                      {/* Mock template scanners */}
                      <div className="space-y-2">
                        <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">快捷瓶身配料测试 (TEST TEMPLATES)</p>
                        <div className="grid grid-cols-2 gap-2">
                          {bottleTemplates.map((item) => (
                            <button
                              key={item.name}
                              type="button"
                              onClick={() => handleScanTemplateOCR(item)}
                              className="p-2.5 rounded-xl border border-slate-200 hover:border-primary/40 text-left bg-white transition-all hover:bg-slate-50 flex flex-col justify-between h-20"
                            >
                              <div className="font-bold text-xs text-slate-800 truncate w-full">{item.name}</div>
                              <div className="text-[9px] text-slate-400 truncate w-full mt-0.5">{item.text}</div>
                              <span className="text-[8px] mt-1 font-mono text-primary font-bold bg-primary/5 px-1.5 py-0.5 rounded self-start">一键整理</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Paste area for customized scanning */}
                      <form onSubmit={handleCustomOcrSubmit} className="space-y-2.5 pt-2 border-t border-slate-100">
                        <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">自定义配料表文本</p>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="饮料名/品牌，如：水溶C 柠檬味"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs outline-none focus:border-primary transition-all bg-slate-50/50"
                            value={scanNameHint}
                            onChange={(e) => setScanNameHint(e.target.value)}
                          />
                          <button
                            type="submit"
                            disabled={isOcrScanning || !customOcrText.trim()}
                            className="w-full py-2 bg-primary text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 disabled:opacity-50"
                          >
                            生成临时材料
                          </button>
                        </div>

                        <textarea
                          placeholder="在此处粘贴瓶身配料文字。系统会按本地规则整理成酸甜、气泡、奶感等参考维度。"
                          className="w-full h-16 p-2.5 rounded-lg border border-slate-200 text-[10px] outline-none focus:border-primary transition-all bg-slate-50/50 resize-none font-sans"
                          value={customOcrText}
                          onChange={(e) => setCustomOcrText(e.target.value)}
                        />
                      </form>
                    </div>
                  )}

                  {/* METHOD 3: HIGH-PRECISION MANUAL SYNTHESIS */}
                  {modalTab === "manual" && (
                    <form onSubmit={handleManualGenerateSubmit} className="space-y-4">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">原料名称 (MATERIAL NAME)</label>
                          <input
                            type="text"
                            placeholder="如：水溶C100 柠檬味、椰树牌椰汁、茉莉花茶..."
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-primary transition-all bg-slate-50/50 animate-pulse-once"
                            value={manualName}
                            onChange={(e) => setManualName(e.target.value)}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">成分分类 (CATEGORY)</label>
                          <select
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50/50 outline-none focus:border-primary"
                            value={manualCategory}
                            onChange={(e) => setManualCategory(e.target.value)}
                          >
                            <option value="基酒">基酒 (Spirits)</option>
                            <option value="气泡饮料">汽水/气泡饮料 (Carbonated)</option>
                            <option value="果汁">果汁 (Fruit Juice)</option>
                            <option value="茶饮">茶饮 (Tea Brew)</option>
                            <option value="乳酸饮料">乳酸/椰奶饮料 (Dairy/Plant Milk)</option>
                            <option value="辅料">风味佐料 (Adjuncts)</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">瓶身配料表 (INGREDIENT LIST)</label>
                          <textarea
                            placeholder="直接抄瓶身配料表，例如：水、白砂糖、浓缩柠檬汁、柠檬酸、维生素C..."
                            className="w-full h-20 p-2.5 rounded-xl border border-slate-200 text-[10px] outline-none focus:border-primary transition-all bg-slate-50/50 resize-none font-sans"
                            value={manualIngredientText}
                            onChange={(e) => setManualIngredientText(e.target.value)}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">补充信息 (OPTIONAL NOTES)</label>
                          <textarea
                            placeholder="可选：是否有气泡、是否含奶、是否含咖啡因、甜酸感如何。例：有气泡，橙味，比较甜。"
                            className="w-full h-16 p-2.5 rounded-xl border border-slate-200 text-[10px] outline-none focus:border-primary transition-all bg-slate-50/50 resize-none font-sans"
                            value={manualDescription}
                            onChange={(e) => setManualDescription(e.target.value)}
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isManualGenerating || !manualName.trim()}
                        className="w-full py-3.5 bg-primary text-white hover:bg-black/90 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                      >
                        {isManualGenerating ? (
                          <>
                            <span className="material-symbols-outlined animate-spin text-sm">autorenew</span>
                            <span>正在生成临时材料...</span>
                          </>
                        ) : (
                          <>
                            <span>生成临时材料</span>
                            <ArrowRight size={13} />
                          </>
                        )}
                      </button>
                      <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[10px] leading-relaxed text-slate-500">
                        这个条目只作为本次实验的临时材料，默认会进入本地草稿。正式入库前需要在管理页审核，避免因为简称或错别字生成重复饮料。
                      </p>
                    </form>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* --- MODAL 2: HELP RULES MODAL --- */}
      {showRulesModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowRulesModal(false)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-xl overflow-hidden shadow-2xl p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-serif font-bold text-slate-900 mb-2">酒精实验室科学守则</h3>
            <div className="text-xs text-slate-600 space-y-3.5 leading-relaxed font-light">
              <p>欢迎来到分子微醺共振实验室！本模拟系统遵循以下精确物理混合守则：</p>
              
              <ul className="list-decimal pl-4 space-y-1.5 font-sans">
                <li>
                  <strong className="font-bold text-slate-800">最大加注：</strong>杯身额定容量为 <strong className="font-semibold text-slate-800">350ml</strong>，最多容纳 <strong className="font-semibold text-slate-800">6 种</strong> 不同的物理成分。
                </li>
                <li>
                  <strong className="font-bold text-slate-800">动力剪切：</strong>至少加注 <strong className="font-semibold text-slate-800">2 种</strong> 液体后，可以选择 <strong className="font-semibold text-slate-800">Stir（慢搅拌）</strong> 或 <strong className="font-semibold text-slate-800">Shake（高频激荡）</strong>，这会改变酒精分子胶体细腻度。
                </li>
                <li>
                  <strong className="font-bold text-slate-800">8维风味：</strong>实验会精密诊断出 甜、酸、酒感、奶香、草本、气泡、清爽、黏度 8 大维度色谱。
                </li>
                <li>
                  <strong className="font-bold text-slate-800">科学包容：</strong>化学公式是千变万化的，系统预测分子客观表现，不保证好喝，请以探索精神对待！
                </li>
              </ul>
            </div>
            
            <button
              onClick={() => setShowRulesModal(false)}
              className="w-full mt-6 py-3.5 bg-primary text-white rounded-xl text-xs font-bold uppercase tracking-wider text-center"
            >
              遵守守则，开始实验
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
