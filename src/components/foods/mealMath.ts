import { withDerivedKcal, scaleNutrients, sumNutrients, type Totals } from '../../domain/nutrients';
import { recipeSnapshot, RECIPE_SERVING_ID } from '../../domain/recipes';
import { toBaseAmount } from '../../domain/units';
import type { Entry, Food, MealItem, Nutrients, Recipe, UnitRef } from '../../domain/types';

/** Nutrients for one meal item, or null when its food/recipe or serving no longer exists. */
export function mealItemNutrients(
  item: MealItem,
  foods: ReadonlyMap<string, Food>,
  recipes: ReadonlyMap<string, Recipe>,
): Nutrients | null {
  if (item.kind === 'food') {
    const food = foods.get(item.refId);
    if (!food) return null;
    const base = toBaseAmount(item.amount, item.unit, food.servings);
    return base === null ? null : withDerivedKcal(scaleNutrients(food.per100, base)).nutrients;
  }
  const recipe = recipes.get(item.refId);
  if (!recipe || !(recipe.servingsPerBatch >= 1)) return null;
  const snap = recipeSnapshot(recipe, foods);
  const base = toBaseAmount(item.amount, item.unit, snap.servings);
  return base === null ? null : withDerivedKcal(scaleNutrients(snap.per100, base)).nutrients;
}

/** Combined totals of a meal; items whose source is missing count as 0. */
export function mealTotals(
  items: readonly MealItem[],
  foods: ReadonlyMap<string, Food>,
  recipes: ReadonlyMap<string, Recipe>,
): Totals {
  const parts = items
    .map((i) => mealItemNutrients(i, foods, recipes))
    .filter((n): n is Nutrients => n !== null);
  return sumNutrients(parts);
}

export type EntryMapping = { items: MealItem[]; skippedQuick: number };

/**
 * Maps a day's entries in one category back to meal items (SPEC 3.6 "Save as meal").
 * Quick-add entries (and any entry without a reference) are skipped and counted. The unit is
 * recovered from the entry snapshot: the base unit label gives a base amount, a serving label that
 * matches gives that serving, anything else falls back to the stored base amount.
 * `servingExists` lets the caller drop serving refs the current food/recipe no longer has.
 */
export function itemsFromEntries(
  entries: readonly Entry[],
  categoryId: string,
  servingExists: (kind: 'food' | 'recipe', refId: string, servingId: string) => boolean = () =>
    true,
): EntryMapping {
  const items: MealItem[] = [];
  let skippedQuick = 0;
  const inCategory = entries
    .filter((e) => e.categoryId === categoryId)
    .sort((a, b) => a.order - b.order);
  for (const e of inCategory) {
    if (e.kind === 'quick' || e.refId === null) {
      skippedQuick += 1;
      continue;
    }
    const kind = e.kind;
    const snap = e.snapshot;
    let unit: UnitRef = { kind: 'base' };
    let amount = e.baseAmount ?? e.amount ?? 0;
    if (e.amount !== null && e.unitLabel !== null) {
      // A recipe snapshot only has a real base unit (grams) when a cooked weight is set, which
      // shows as a serving weight other than 1.
      const realBase = kind === 'food' || (snap?.servings[0]?.amount ?? 1) !== 1;
      if (snap && e.unitLabel === snap.baseUnit && realBase) {
        amount = e.amount;
      } else {
        const s = snap?.servings.find((x) => x.label === e.unitLabel);
        if (s && servingExists(kind, e.refId, s.id)) {
          unit = { kind: 'serving', servingId: s.id };
          amount = e.amount;
        } else if (kind === 'recipe') {
          // A recipe's base amount is meaningless without a cooked weight: use servings.
          const per = snap?.servings.find((x) => x.id === RECIPE_SERVING_ID)?.amount ?? 1;
          unit = { kind: 'serving', servingId: RECIPE_SERVING_ID };
          amount = Math.round(((e.baseAmount ?? 0) / (per || 1)) * 100) / 100;
        }
      }
    }
    items.push({ kind, refId: e.refId, amount, unit });
  }
  return { items, skippedQuick };
}
