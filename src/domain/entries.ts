import { scaleNutrients, withDerivedKcal } from './nutrients';
import { recipeSnapshot } from './recipes';
import { toBaseAmount, unitLabel } from './units';
import type { Entry, EntrySnapshot, Food, Nutrients, Recipe, UnitRef } from './types';

type Common = {
  date: string;
  categoryId: string;
  order: number;
  now: string;
  id: string;
};

type MealLink = { mealLogId?: string | null; mealName?: string | null };

function cloneSnapshot(s: EntrySnapshot): EntrySnapshot {
  return {
    baseUnit: s.baseUnit,
    per100: { ...s.per100 },
    servings: s.servings.map((x) => ({ ...x })),
  };
}

/** Compute everything that depends on (snapshot, amount, unit). Throws if the unit is unknown. */
function compute(
  snapshot: EntrySnapshot,
  amount: number,
  unit: UnitRef,
): { baseAmount: number; unitLabel: string; nutrients: Nutrients; kcalDerived: boolean } {
  const baseAmount = toBaseAmount(amount, unit, snapshot.servings);
  const label = unitLabel(unit, snapshot.baseUnit, snapshot.servings);
  if (baseAmount === null || label === null) throw new Error('Unknown unit for this item');
  const { nutrients, kcalDerived } = withDerivedKcal(scaleNutrients(snapshot.per100, baseAmount));
  return { baseAmount, unitLabel: label, nutrients, kcalDerived };
}

function assertAmount(amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) throw new RangeError('Amount must be > 0');
}

export function buildFoodEntry(
  args: { food: Food; amount: number; unit: UnitRef } & Common & MealLink,
): Entry {
  const { food, amount, unit } = args;
  assertAmount(amount);
  const snapshot = cloneSnapshot({
    baseUnit: food.baseUnit,
    per100: food.per100,
    servings: food.servings,
  });
  const c = compute(snapshot, amount, unit);
  return {
    id: args.id,
    date: args.date,
    categoryId: args.categoryId,
    order: args.order,
    kind: 'food',
    refId: food.id,
    name: food.name,
    brand: food.brand,
    amount,
    unitLabel: c.unitLabel,
    baseAmount: c.baseAmount,
    snapshot,
    nutrients: c.nutrients,
    kcalDerived: c.kcalDerived,
    mealLogId: args.mealLogId ?? null,
    mealName: args.mealName ?? null,
    createdAt: args.now,
    updatedAt: args.now,
  };
}

export function buildRecipeEntry(
  args: {
    recipe: Recipe;
    foods: ReadonlyMap<string, Food>;
    amount: number;
    unit: UnitRef;
  } & Common &
    MealLink,
): Entry {
  const { recipe, foods, amount, unit } = args;
  assertAmount(amount);
  if (unit.kind === 'base' && !(recipe.cookedWeightG !== null && recipe.cookedWeightG > 0)) {
    throw new Error('Recipe has no cooked weight, so it cannot be logged in grams');
  }
  const snapshot = recipeSnapshot(recipe, foods);
  const c = compute(snapshot, amount, unit);
  return {
    id: args.id,
    date: args.date,
    categoryId: args.categoryId,
    order: args.order,
    kind: 'recipe',
    refId: recipe.id,
    name: recipe.name,
    brand: null,
    amount,
    unitLabel: c.unitLabel,
    baseAmount: c.baseAmount,
    snapshot,
    nutrients: c.nutrients,
    kcalDerived: c.kcalDerived,
    mealLogId: args.mealLogId ?? null,
    mealName: args.mealName ?? null,
    createdAt: args.now,
    updatedAt: args.now,
  };
}

/**
 * Quick add: stores net carbs as `carbs` with fiber 0. Blank kcal with at least one macro entered
 * is derived at 4/4/9 (blank macros count as 0 for that) and flagged `kcalDerived`.
 */
export function buildQuickEntry(
  args: {
    label: string | null;
    kcal: number | null;
    protein: number | null;
    netCarbs: number | null;
    fat: number | null;
  } & Common,
): Entry {
  let kcal = args.kcal;
  let kcalDerived = false;
  const anyMacro = args.protein !== null || args.netCarbs !== null || args.fat !== null;
  if (kcal === null && anyMacro) {
    kcal = Math.round(4 * (args.protein ?? 0) + 4 * (args.netCarbs ?? 0) + 9 * (args.fat ?? 0));
    kcalDerived = true;
  }
  const label = args.label?.trim();
  return {
    id: args.id,
    date: args.date,
    categoryId: args.categoryId,
    order: args.order,
    kind: 'quick',
    refId: null,
    name: label ? label : 'Quick add',
    brand: null,
    amount: null,
    unitLabel: null,
    baseAmount: null,
    snapshot: null,
    nutrients: {
      kcal,
      protein: args.protein,
      carbs: args.netCarbs,
      fiber: 0,
      sugar: null,
      fat: args.fat,
      satFat: null,
      sodium: null,
    },
    kcalDerived,
    mealLogId: null,
    mealName: null,
    createdAt: args.now,
    updatedAt: args.now,
  };
}

/** Change amount/unit, recomputing from the entry's own snapshot (never the current food). */
export function rescaleEntry(entry: Entry, amount: number, unit: UnitRef, now: string): Entry {
  if (entry.snapshot === null) throw new Error('Quick-add entries have no amount to rescale');
  assertAmount(amount);
  const c = compute(entry.snapshot, amount, unit);
  return {
    ...entry,
    amount,
    unitLabel: c.unitLabel,
    baseAmount: c.baseAmount,
    nutrients: c.nutrients,
    kcalDerived: c.kcalDerived,
    updatedAt: now,
  };
}

/** Copy to another day/category with the original snapshot and a new id (SPEC 4.3). */
export function cloneEntry(
  entry: Entry,
  args: {
    id: string;
    date: string;
    categoryId: string;
    order: number;
    now: string;
    mealLogId?: string | null;
  },
): Entry {
  const mealLogId = args.mealLogId ?? null;
  return {
    ...entry,
    id: args.id,
    date: args.date,
    categoryId: args.categoryId,
    order: args.order,
    snapshot: entry.snapshot ? cloneSnapshot(entry.snapshot) : null,
    nutrients: { ...entry.nutrients },
    mealLogId,
    mealName: mealLogId === null ? null : entry.mealName,
    createdAt: args.now,
    updatedAt: args.now,
  };
}
