// Maps an Open Food Facts product response (SPEC §6.3) to RemoteFood. Pure.
import type { BaseUnit, Nutrients, RemoteFood, Serving } from './types';
import { EMPTY_NUTRIENTS } from './types';
import { normaliseBarcode } from './barcode';

export type OffProduct = {
  code?: string;
  product_name?: string | null;
  brands?: string | null;
  serving_size?: string | null;
  serving_quantity?: number | string | null;
  nutriments?: Record<string, unknown> | null;
};

export type OffResponse = { code?: string; status?: number; product?: OffProduct | null };

const round2 = (n: number): number => Math.round(n * 100) / 100;

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function mapOffNutrients(n: Record<string, unknown> | null | undefined): Nutrients {
  const g = (k: string): number | null => {
    const v = num(n?.[k]);
    return v === null ? null : round2(v);
  };
  const out: Nutrients = { ...EMPTY_NUTRIENTS };
  const kcal = num(n?.['energy-kcal_100g']);
  if (kcal !== null) out.kcal = round2(kcal);
  else {
    // kJ-only products: kcal = kJ / 4.184.
    const kj = num(n?.['energy_100g']) ?? num(n?.['energy-kj_100g']);
    if (kj !== null) out.kcal = Math.round((kj / 4.184) * 10) / 10;
  }
  out.protein = g('proteins_100g');
  out.carbs = g('carbohydrates_100g');
  out.fiber = g('fiber_100g');
  out.sugar = g('sugars_100g');
  out.fat = g('fat_100g');
  out.satFat = g('saturated-fat_100g');
  const sodiumG = num(n?.['sodium_100g']);
  out.sodium = sodiumG === null ? null : round2(sodiumG * 1000);
  return out;
}

const LIQUID = /\d\s*(ml|cl|dl|l|fl\.?\s*oz)\b/i;

/** status 0 / missing product -> null. `now` is injectable for deterministic tests. */
export function mapOffProduct(res: OffResponse, now: string = new Date().toISOString()): RemoteFood | null {
  const p = res.product;
  if (res.status === 0 || !p) return null;
  const rawCode = p.code ?? res.code ?? '';
  const barcode = normaliseBarcode(rawCode);
  const name = p.product_name?.trim() || p.brands?.split(',')[0]?.trim() || rawCode;
  const brand = p.brands?.split(',')[0]?.trim() || null;

  const label = p.serving_size?.trim() ?? '';
  const qty = num(p.serving_quantity);
  const baseUnit: BaseUnit = LIQUID.test(label) ? 'ml' : 'g';
  const servings: Serving[] =
    qty !== null && qty > 0
      ? [{ id: 'off-serving', label: label || `${round2(qty)} ${baseUnit}`, amount: round2(qty) }]
      : [];

  return {
    source: 'off',
    sourceId: barcode ?? (rawCode.replace(/\D/g, '') || null),
    overrides: null,
    name,
    nameLower: name.toLowerCase(),
    brand,
    barcode,
    baseUnit,
    per100: mapOffNutrients(p.nutriments),
    servings,
    defaultServingId: servings[0]?.id ?? null,
    lastAmount: null,
    useCount: 0,
    lastUsedAt: null,
    favoriteAt: null,
    deletedAt: null,
    fetchedAt: now,
    dataType: 'OFF',
  };
}
