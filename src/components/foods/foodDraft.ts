import { normaliseBarcode } from '../../domain/barcode';
import {
  EMPTY_NUTRIENTS,
  NUTRIENT_KEYS,
  type BaseUnit,
  type Food,
  type Nutrients,
  type Serving,
} from '../../domain/types';
import { newId } from '../../lib/ids';

export type NutritionMode = 'serving' | 'per100';

/** `defaultKey` value that marks the "Nutrition per" serving as the default one. */
export const NUTRITION_KEY = 'nutrition';

export type DraftServing = { key: string; id: string; label: string; amount: number | null };

export type FoodDraft = {
  name: string;
  brand: string;
  barcode: string;
  baseUnit: BaseUnit;
  mode: NutritionMode;
  nutLabel: string;
  nutAmount: number | null;
  /** As typed: per serving in `serving` mode, per 100 base units in `per100` mode. */
  values: Nutrients;
  servings: DraftServing[];
  /** `NUTRITION_KEY`, a DraftServing key, or null (first serving wins). */
  defaultKey: string | null;
  favorite: boolean;
};

export type DraftErrors = Partial<
  Record<'name' | 'kcal' | 'barcode' | 'nutServing' | 'servings', string>
>;

export type FoodFields = Pick<
  Food,
  | 'name'
  | 'nameLower'
  | 'brand'
  | 'barcode'
  | 'baseUnit'
  | 'per100'
  | 'servings'
  | 'defaultServingId'
>;

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

/**
 * Converts typed values to per-100-base-unit values. In `per100` mode the values pass through;
 * in `serving` mode each is scaled by 100 / servingAmount. Blank (null) stays null.
 * Returns null when serving mode has no usable serving amount.
 */
export function toPer100(
  values: Nutrients,
  mode: NutritionMode,
  servingAmount: number | null,
): Nutrients | null {
  if (mode === 'per100') return { ...values };
  if (servingAmount === null || !(servingAmount > 0)) return null;
  const out = { ...EMPTY_NUTRIENTS };
  for (const key of NUTRIENT_KEYS) {
    const v = values[key];
    out[key] = v === null ? null : round3((v * 100) / servingAmount);
  }
  return out;
}

export function emptyDraft(prefill: { barcode?: string; name?: string } = {}): FoodDraft {
  return {
    name: prefill.name ?? '',
    brand: '',
    barcode: prefill.barcode ?? '',
    baseUnit: 'g',
    mode: 'per100',
    nutLabel: '1 serving',
    nutAmount: null,
    values: { ...EMPTY_NUTRIENTS },
    servings: [],
    defaultKey: null,
    favorite: false,
  };
}

export function draftFromFood(food: Food): FoodDraft {
  const servings: DraftServing[] = food.servings.map((s) => ({
    key: s.id,
    id: s.id,
    label: s.label,
    amount: s.amount,
  }));
  return {
    name: food.name,
    brand: food.brand ?? '',
    barcode: food.barcode ?? '',
    baseUnit: food.baseUnit,
    mode: 'per100',
    nutLabel: '1 serving',
    nutAmount: null,
    values: { ...food.per100 },
    servings,
    defaultKey: servings.find((s) => s.id === food.defaultServingId)?.key ?? null,
    favorite: food.favoriteAt !== null,
  };
}

export function newDraftServing(): DraftServing {
  const id = newId();
  return { key: id, id, label: '', amount: null };
}

/** Net carbs read-out for the form: total carbs minus fiber, never below 0. */
export function netCarbsOf(values: Pick<Nutrients, 'carbs' | 'fiber'>): number {
  return round3(Math.max(0, (values.carbs ?? 0) - (values.fiber ?? 0)));
}

const sameLabel = (a: string, b: string): boolean =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/** Validates the draft and builds the food fields (per-100 values, servings, default). */
export function buildFoodFields(
  draft: FoodDraft,
): { ok: true; fields: FoodFields } | { ok: false; errors: DraftErrors } {
  const errors: DraftErrors = {};
  const name = draft.name.trim();
  if (!name) errors.name = 'Name is required';
  if (draft.values.kcal === null) errors.kcal = 'Calories are required';

  let barcode: string | null = null;
  if (draft.barcode.trim()) {
    barcode = normaliseBarcode(draft.barcode.trim());
    if (barcode === null) errors.barcode = 'Not a valid barcode (EAN-8, UPC-A or EAN-13)';
  }

  const nutLabel = draft.nutLabel.trim();
  if (draft.mode === 'serving') {
    if (!nutLabel || draft.nutAmount === null || !(draft.nutAmount > 0)) {
      errors.nutServing = 'Enter the serving label and an amount above 0';
    }
  }

  // Rows left completely blank are ignored; half-filled rows are an error.
  const rows = draft.servings.filter((s) => s.label.trim() !== '' || s.amount !== null);
  if (rows.some((s) => s.label.trim() === '' || s.amount === null || !(s.amount > 0))) {
    errors.servings = 'Each serving needs a label and an amount above 0';
  }

  const per100 = toPer100(draft.values, draft.mode, draft.nutAmount);
  if (Object.keys(errors).length > 0 || per100 === null) return { ok: false, errors };

  const servings: Serving[] = [];
  let nutritionId: string | null = null;
  if (draft.mode === 'serving' && draft.nutAmount !== null) {
    const dup = rows.find((r) => sameLabel(r.label, nutLabel) && r.amount === draft.nutAmount);
    nutritionId = dup ? dup.id : newId();
    servings.push({ id: nutritionId, label: nutLabel, amount: draft.nutAmount });
  }
  for (const r of rows) {
    if (servings.some((s) => s.id === r.id)) continue;
    servings.push({ id: r.id, label: r.label.trim(), amount: r.amount as number });
  }

  let defaultServingId: string | null = null;
  if (draft.defaultKey === NUTRITION_KEY) defaultServingId = nutritionId;
  else if (draft.defaultKey !== null) {
    const row = rows.find((r) => r.key === draft.defaultKey);
    defaultServingId = row && servings.some((s) => s.id === row.id) ? row.id : null;
  }
  if (defaultServingId === null && draft.mode === 'serving') defaultServingId = nutritionId;
  if (defaultServingId === null && servings.length > 0) defaultServingId = servings[0].id;

  return {
    ok: true,
    fields: {
      name,
      nameLower: name.toLowerCase(),
      brand: draft.brand.trim() || null,
      barcode,
      baseUnit: draft.baseUnit,
      per100,
      servings,
      defaultServingId,
    },
  };
}
