// Maps USDA FoodData Central responses (SPEC §6.2) to the internal RemoteFood shape. Pure.
import type { BaseUnit, Nutrients, RemoteFood, Serving } from './types';
import { EMPTY_NUTRIENTS } from './types';
import { normaliseBarcode } from './barcode';

export type UsdaFoodNutrient = { nutrientId?: number; value?: number | null };

/** The subset of a /foods/search result we read. */
export type UsdaSearchFood = {
  fdcId: number;
  description: string;
  dataType: string;
  gtinUpc?: string | null;
  brandName?: string | null;
  brandOwner?: string | null;
  servingSize?: number | null;
  servingSizeUnit?: string | null;
  householdServingFullText?: string | null;
  foodNutrients?: UsdaFoodNutrient[];
};

export type UsdaSearchResponse = { foods?: UsdaSearchFood[] };

export type UsdaFoodPortion = {
  id?: number;
  gramWeight?: number | null;
  sequenceNumber?: number | null;
  amount?: number | null;
  modifier?: string | null;
  portionDescription?: string | null;
  measureUnit?: { name?: string | null; abbreviation?: string | null } | null;
};

/** The subset of a /food/{fdcId} response we read. */
export type UsdaDetails = { fdcId?: number; foodPortions?: UsdaFoodPortion[] | null };

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Nutrient ids per SPEC §6.2. Energy falls back 1008 -> 2047 -> 2048. */
const IDS = {
  kcal: [1008, 2047, 2048],
  protein: [1003],
  carbs: [1005],
  fiber: [1079],
  sugar: [2000],
  fat: [1004],
  satFat: [1258],
  sodium: [1093],
} as const satisfies Record<keyof Nutrients, readonly number[]>;

export function mapUsdaNutrients(list: UsdaFoodNutrient[] | undefined): Nutrients {
  const byId = new Map<number, number>();
  for (const n of list ?? []) {
    if (typeof n.nutrientId === 'number' && typeof n.value === 'number' && Number.isFinite(n.value)) {
      if (!byId.has(n.nutrientId)) byId.set(n.nutrientId, n.value);
    }
  }
  const out: Nutrients = { ...EMPTY_NUTRIENTS };
  for (const key of Object.keys(IDS) as (keyof Nutrients)[]) {
    for (const id of IDS[key]) {
      const v = byId.get(id);
      if (v !== undefined) {
        out[key] = v;
        break;
      }
    }
  }
  return out;
}

/** USDA brand/branded descriptions are often ALL CAPS; make those readable. Mixed case is kept. */
function tidyCase(s: string): string {
  const t = s.trim();
  if (t === t.toUpperCase() && /[A-Z]/.test(t)) {
    return t.toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase());
  }
  return t;
}

/** Map a USDA serving size unit to our base unit; null when it is neither grams nor millilitres. */
function baseUnitOf(unit: string | null | undefined): BaseUnit | null {
  const u = unit?.trim().toLowerCase();
  if (u === 'g' || u === 'grm') return 'g';
  if (u === 'ml' || u === 'mlt') return 'ml';
  return null;
}

function brandedServing(f: UsdaSearchFood): { baseUnit: BaseUnit; servings: Serving[] } {
  const unit = baseUnitOf(f.servingSizeUnit);
  const size = f.servingSize;
  if (!unit || typeof size !== 'number' || !(size > 0)) return { baseUnit: unit ?? 'g', servings: [] };
  const household = f.householdServingFullText?.trim();
  const sizeText = `${round2(size)} ${unit}`;
  const label = household ? `${household} (${sizeText})` : sizeText;
  return { baseUnit: unit, servings: [{ id: 'usda-serving', label, amount: round2(size) }] };
}

export function mapUsdaSearchFood(f: UsdaSearchFood, now: string = new Date().toISOString()): RemoteFood {
  const branded = f.dataType === 'Branded';
  const { baseUnit, servings } = branded ? brandedServing(f) : { baseUnit: 'g' as BaseUnit, servings: [] };
  const name = branded ? tidyCase(f.description) : f.description.trim();
  const brandRaw = (f.brandName ?? f.brandOwner ?? '').trim();
  return {
    source: 'usda',
    sourceId: String(f.fdcId),
    overrides: null,
    name,
    nameLower: name.toLowerCase(),
    brand: brandRaw ? tidyCase(brandRaw) : null,
    barcode: f.gtinUpc ? normaliseBarcode(f.gtinUpc) : null,
    baseUnit,
    per100: mapUsdaNutrients(f.foodNutrients),
    servings,
    defaultServingId: servings[0]?.id ?? null,
    lastAmount: null,
    useCount: 0,
    lastUsedAt: null,
    favoriteAt: null,
    deletedAt: null,
    fetchedAt: now,
    dataType: f.dataType,
  };
}

export function mapUsdaSearch(res: UsdaSearchResponse, now?: string): RemoteFood[] {
  return (res.foods ?? []).map((f) => mapUsdaSearchFood(f, now));
}

/** Foundation / SR Legacy above Branded; API order is kept within each group (stable). */
export function sortGenericFirst<T extends { dataType: string }>(foods: T[]): T[] {
  const generic = foods.filter((f) => f.dataType !== 'Branded');
  const branded = foods.filter((f) => f.dataType === 'Branded');
  return [...generic, ...branded];
}

function portionLabel(p: UsdaFoodPortion): string | null {
  const desc = p.portionDescription?.trim();
  if (desc && !/^quantity not specified$/i.test(desc)) return desc;
  const unitName = p.measureUnit?.name?.trim();
  const unit = unitName && unitName.toLowerCase() !== 'undetermined' ? unitName : '';
  const modifier = p.modifier?.trim() ?? '';
  const amount = typeof p.amount === 'number' && p.amount > 0 ? String(round2(p.amount)) : '1';
  const parts = [unit, modifier].filter(Boolean);
  if (parts.length === 0) return null;
  return `${amount} ${parts.join(', ')}`;
}

/** Servings from a details response's foodPortions (amount = gram weight). Foundation/SR Legacy only. */
export function mapUsdaPortions(details: UsdaDetails): Serving[] {
  const portions = [...(details.foodPortions ?? [])]
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (a.p.sequenceNumber ?? 999) - (b.p.sequenceNumber ?? 999) || a.i - b.i);
  const out: Serving[] = [];
  const seen = new Set<string>();
  for (const { p, i } of portions) {
    const grams = p.gramWeight;
    if (typeof grams !== 'number' || !(grams > 0)) continue;
    const label = portionLabel(p);
    if (!label) continue;
    const key = `${label}|${round2(grams)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: `usda-portion-${p.id ?? i}`, label, amount: round2(grams) });
  }
  return out;
}
