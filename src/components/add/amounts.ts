import { scaleNutrients, withDerivedKcal } from '../../domain/nutrients';
import { recipeServings, recipeSnapshot } from '../../domain/recipes';
import { amountLabel, defaultUnit, toBaseAmount, unitLabel } from '../../domain/units';
import type {
  BaseUnit,
  Food,
  LastAmount,
  Nutrients,
  Recipe,
  Serving,
  UnitRef,
} from '../../domain/types';

/** What nutrition maths needs: a food, a recipe snapshot or an entry snapshot. */
export type Snap = { baseUnit: BaseUnit; per100: Nutrients; servings: readonly Serving[] };

export type Preview = { nutrients: Nutrients; kcalDerived: boolean };

export function foodSnap(food: Food): Snap {
  return { baseUnit: food.baseUnit, per100: food.per100, servings: food.servings };
}

/** Recipe snapshot, or null when the recipe cannot be computed (bad yield). */
export function recipeSnap(recipe: Recipe, foods: ReadonlyMap<string, Food>): Snap | null {
  try {
    return recipeSnapshot(recipe, foods);
  } catch {
    return null;
  }
}

function unitExists(unit: UnitRef, servings: readonly Serving[]): boolean {
  return unit.kind === 'base' || servings.some((s) => s.id === unit.servingId);
}

/**
 * Amount panel prefill (SPEC 3.2): the last amount used, else 1 of the default serving, else
 * 100 of the base unit when the food has no default serving.
 */
export function defaultFoodAmount(food: Food): LastAmount {
  if (food.lastAmount && unitExists(food.lastAmount.unit, food.servings)) return food.lastAmount;
  const unit = defaultUnit(food);
  return unit.kind === 'serving' ? { amount: 1, unit } : { amount: 100, unit };
}

/** Recipes log by serving (1/yield); grams only when a cooked weight is set. */
export function defaultRecipeAmount(recipe: Recipe): LastAmount {
  const last = recipe.lastAmount;
  const hasWeight = recipe.cookedWeightG !== null && recipe.cookedWeightG > 0;
  if (last && (last.unit.kind === 'serving' || hasWeight)) return last;
  return { amount: 1, unit: { kind: 'serving', servingId: recipeServings(recipe)[0]?.id ?? 'serving' } };
}

/** Nutrition for `amount` of `unit`; null when the unit is unknown for this item. */
export function previewNutrients(snap: Snap, amount: number, unit: UnitRef): Preview | null {
  const base = toBaseAmount(amount, unit, snap.servings);
  if (base === null) return null;
  const { nutrients, kcalDerived } = withDerivedKcal(scaleNutrients(snap.per100, base));
  return { nutrients, kcalDerived };
}

/** "80 g", "1.5 serving"; null when the unit is unknown. */
export function describeAmount(snap: Snap, a: LastAmount): string | null {
  const label = unitLabel(a.unit, snap.baseUnit, snap.servings);
  return label === null ? null : amountLabel(a.amount, label);
}

/** String form of a unit for a native select value. */
export function unitKey(unit: UnitRef): string {
  return unit.kind === 'base' ? 'base' : `s:${unit.servingId}`;
}

export function unitFromKey(key: string): UnitRef {
  return key === 'base' ? { kind: 'base' } : { kind: 'serving', servingId: key.slice(2) };
}
