export interface Cocktail {
  id: string;
  name: string;
  chineseName: string;
  subtitle?: string;
  spirit: string;
  mixer: string;
  size: string;
  rating: {
    sweet: number;
    acid: number;
    strength: number;
    creamy?: number;
    herbal?: number;
    bubbly?: number;
    freshness?: number;
    heaviness?: number;
  };
  comments: string;
  imageUrl?: string;
  tags?: string[];
  ingredients?: { name: string; amount: number; category: string }[];
  mixMethod?: string;
  adviceSections?: { title: string; body: string }[];
}

export interface SavedCocktail extends Cocktail {
  recipeId?: string;
  savedAt: string;
  ratingValue?: number; // 1-5 stars for overall rating
  sourcePage?: string;
}

export interface DrinkLogTasteScores {
  sweetness: number;
  acidity: number;
  alcohol_intensity: number;
  bitterness: number;
  freshness: number;
  fruitiness: number;
  smoothness: number;
}

export interface DrinkLogRecipeSnapshot {
  id: string;
  nameZh: string;
  nameEn?: string;
  description?: string;
  imageUrl?: string;
  tags?: string[];
  ingredients?: { name: string; amount?: number | string; unit?: string; category?: string }[];
  method?: string;
  sourcePage?: string;
}

export interface DrinkLog {
  id: string;
  userId: string;
  recipeId: string;
  recipeName: string;
  recipeSnapshot: DrinkLogRecipeSnapshot;
  drinkDate: string;
  drinkTime?: string;
  rating: number;
  tasteScores: DrinkLogTasteScores;
  note: string;
  isFinished: boolean;
  isFavorite: boolean;
  isStarred: boolean;
  moodTags: string[];
  imageUrl?: string;
  sourcePage: string;
  createdAt: string;
  updatedAt: string;
}

export interface MixTip {
  id: string;
  title: string;
  content: string;
  icon: string;
}

export interface Ingredient {
  id: string;
  name: string;              // 椰树牌椰汁
  brand?: string;            // 椰树
  category: string;          // 椰子饮料 / 奶感饮料
  source?: "official" | "ai_generated" | "user_added" | "photo_extracted"; // old compat

  ingredientsText?: string;  // 配料表

  // Layer 1: Objective Data (第一层：客观数据)
  abv?: number;              // 酒精度，饮料为 0
  nutrition?: {
    sugar_g_per_100ml?: number;
    energy_kj_per_100ml?: number;
    carbohydrate_g_per_100ml?: number;
    caffeine_mg_per_100ml?: number;
    fat_g_per_100ml?: number;
    protein_g_per_100ml?: number;
  };

  // Layer 2: Flavor Inference (第二层：风味推断)
  flavorProfile: {
    sweetness: number;       // 0-5
    acidity: number;         // 0-5
    bitterness: number;      // 0-5
    carbonation: number;     // 0-5
    dairy: number;           // 0-5
    tea: number;             // 0-5
    fruit: number;           // 0-5
    body: number;            // 0-5
    freshness: number;       // 0-5
  };

  // Compatibility fields with older versions (so other components don't break)
  sweetness: number;         // 0-5
  acidity: number;           // 0-5
  bitterness: number;        // 0-5
  carbonation: number;       // 0-5
  body: number;              // 0-5
  viscosity?: number;        // 0-5, old lab UI compat
  dairyFeeling?: number;     // 0-5
  alcoholFeel?: number;      // 0-5
  notes?: string;
  nutritionText?: string;    // old compat
  flavorTags: string[];
  dominantCompounds?: string[];
  textureTags?: string[];    // old compat
  aromaTags?: string[];      // old compat

  goodWith: string[];        // 适合搭配
  riskyWith: string[];       // 容易翻车

  dataSource: "preset" | "open_food_facts" | "fooddata_central" | "afcd" | "brand_site" | "ocr" | "user_input" | "ai_estimate";
  confidence: number;        // 0-1
  lastVerifiedAt?: string;

  // Layer 3: User Feedback Corrections (第三层：用户反馈修正)
  userFeedback?: {
    sweetnessAdjust?: "less" | "more" | "perfect";
    acidityAdjust?: "less" | "more" | "perfect";
    bitternessAdjust?: "less" | "more" | "perfect";
    carbonationAdjust?: "less" | "more" | "perfect";
    dairyAdjust?: "less" | "more" | "perfect";
    comments?: string[];
    pairings?: string[];     // User added matches
  };

  createdByUserId?: string;
  createdAt: string;
}

export interface AssistantMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  cocktails?: Cocktail[]; // If Assistant recommends cocktails
}
