// Shared data types (SPEC §4). This file is the contract between every layer: change it only
// with care, and never in a way that breaks stored data or backups.

/** Amounts per 100 base units (food) or totals (entry). null = unknown, not zero. */
export type Nutrients = {
  kcal: number | null;
  protein: number | null; // g
  /** g, TOTAL carbohydrate (US label convention, includes fiber). Net carbs are always derived. */
  carbs: number | null;
  fiber: number | null; // g
  sugar: number | null; // g
  fat: number | null; // g
  satFat: number | null; // g
  sodium: number | null; // mg
};

export const NUTRIENT_KEYS = [
  'kcal',
  'protein',
  'carbs',
  'fiber',
  'sugar',
  'fat',
  'satFat',
  'sodium',
] as const satisfies readonly (keyof Nutrients)[];

export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

export const EMPTY_NUTRIENTS: Nutrients = {
  kcal: null,
  protein: null,
  carbs: null,
  fiber: null,
  sugar: null,
  fat: null,
  satFat: null,
  sodium: null,
};

export type BaseUnit = 'g' | 'ml';

export type FoodSource = 'custom' | 'usda' | 'off';

export type Serving = { id: string; label: string; /** in the food's baseUnit */ amount: number };

export type UnitRef = { kind: 'base' } | { kind: 'serving'; servingId: string };

export type LastAmount = { amount: number; unit: UnitRef };

export type Food = {
  id: string;
  source: FoodSource;
  /** fdcId for usda, normalised barcode for off, null for custom. */
  sourceId: string | null;
  /** Custom foods only: "usda:<fdcId>" | "off:<barcode>" when this food replaces a remote one. */
  overrides: string | null;
  name: string;
  nameLower: string;
  brand: string | null;
  /** Normalised GTIN-13 (domain/barcode.ts). */
  barcode: string | null;
  baseUnit: BaseUnit;
  per100: Nutrients;
  servings: Serving[];
  defaultServingId: string | null;
  /** Prefill for the Amount panel. */
  lastAmount: LastAmount | null;
  useCount: number;
  lastUsedAt: string | null;
  favoriteAt: string | null;
  deletedAt: string | null;
  /** Remote foods only. */
  fetchedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RecipeIngredient = { foodId: string; amount: number; unit: UnitRef };

export type Recipe = {
  id: string;
  name: string;
  nameLower: string;
  ingredients: RecipeIngredient[];
  /** >= 1 */
  servingsPerBatch: number;
  cookedWeightG: number | null;
  lastAmount: LastAmount | null;
  useCount: number;
  lastUsedAt: string | null;
  favoriteAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MealItem = { kind: 'food' | 'recipe'; refId: string; amount: number; unit: UnitRef };

export type SavedMeal = {
  id: string;
  name: string;
  nameLower: string;
  items: MealItem[];
  defaultCategoryId: string | null;
  useCount: number;
  lastUsedAt: string | null;
  favoriteAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EntryKind = 'food' | 'recipe' | 'quick';

/** Nutrition frozen at log time, so amount edits and history never depend on the current food. */
export type EntrySnapshot = { baseUnit: BaseUnit; per100: Nutrients; servings: Serving[] };

export type Entry = {
  id: string;
  /** Local YYYY-MM-DD, always "today" at creation. */
  date: string;
  categoryId: string;
  /** Within the category for the day. */
  order: number;
  kind: EntryKind;
  /** Food or recipe id; null for quick add. */
  refId: string | null;
  name: string;
  brand: string | null;
  /** null for quick add. */
  amount: number | null;
  /** "g", "1 scoop", "serving" as displayed. */
  unitLabel: string | null;
  /** Amount in base units. */
  baseAmount: number | null;
  snapshot: EntrySnapshot | null;
  /** Totals for this entry. */
  nutrients: Nutrients;
  kcalDerived: boolean;
  /** Shared by entries logged together from a saved meal. */
  mealLogId: string | null;
  mealName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Category = {
  id: string;
  name: string;
  order: number;
  /** "HH:MM" local, drives the time-of-day default category. */
  startsAt: string | null;
  archivedAt: string | null;
};

export type Goal = {
  id: string;
  /** YYYY-MM-DD, unique. */
  effectiveFrom: string;
  kcal: number;
  protein: number;
  netCarbs: number;
  fat: number;
  fiber: number | null;
  sugar: number | null;
  satFat: number | null;
  sodium: number | null;
};

export type GoalKey = Exclude<keyof Goal, 'id' | 'effectiveFrom'>;

export type GoalDirection = 'target' | 'min' | 'max';

export type WeighIn = {
  id: string;
  /** YYYY-MM-DD, unique: one weigh-in per date. */
  date: string;
  weightLb: number;
  bodyFatPct: number | null;
  createdAt: string;
  updatedAt: string;
};

export type Theme = 'light' | 'dark' | 'system';

export type Settings = {
  key: 'app';
  theme: Theme;
  /** Per-device USDA key; overrides the build key. */
  usdaApiKey: string | null;
  summaryMoreOpen: boolean;
};

export const DEFAULT_SETTINGS: Omit<Settings, 'key'> = {
  theme: 'system',
  usdaApiKey: null,
  summaryMoreOpen: false,
};

/** A remote food search result already mapped to the internal shape (not yet stored). */
export type RemoteFood = Omit<Food, 'id' | 'createdAt' | 'updatedAt'> & {
  /** USDA dataType ("Foundation" | "SR Legacy" | "Branded") or "OFF". */
  dataType: string;
};

export type SearchCacheRow = {
  /** "usda:<normalised query>" */
  key: string;
  results: RemoteFood[];
  fetchedAt: string;
};
