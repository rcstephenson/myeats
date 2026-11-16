import { deriveKcal, multiplyNutrients, scaleNutrients } from './nutrients';
import { toBaseAmount, type UnitOption } from './units';
import {
  EMPTY_NUTRIENTS,
  NUTRIENT_KEYS,
  type EntrySnapshot,
  type Food,
  type NutrientKey,
  type Nutrients,
  type Recipe,
  type RecipeIngredient,
  type Serving,
} from './types';

/** Id of the synthetic "serving" unit of a recipe (1/yield of the batch). */
export const RECIPE_SERVING_ID = 'serving';

const CORE_KEYS: readonly NutrientKey[] = ['kcal', 'protein', 'carbs', 'fat'];

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

export function isValidServingsPerBatch(n: number): boolean {
  return Number.isFinite(n) && n >= 1;
}

function assertValidYield(recipe: Recipe): void {
  if (!isValidServingsPerBatch(recipe.servingsPerBatch)) {
    throw new RangeError(`Recipe servingsPerBatch must be >= 1 (got ${recipe.servingsPerBatch})`);
  }
}

/** Nutrients for one ingredient, or null when its food or serving is missing. */
export function ingredientNutrients(
  ingredient: RecipeIngredient,
  foods: ReadonlyMap<string, Food>,
): Nutrients | null {
  const food = foods.get(ingredient.foodId);
  if (!food) return null;
  const base = toBaseAmount(ingredient.amount, ingredient.unit, food.servings);
  if (base === null) return null;
  const scaled = scaleNutrients(food.per100, base);
  // An ingredient with unknown kcal but known macros contributes its derived kcal.
  return scaled.kcal === null ? { ...scaled, kcal: deriveKcal(scaled) } : scaled;
}

/**
 * Whole-batch nutrients. Core keys (kcal, protein, carbs, fat) are null when any ingredient is
 * unknown for them (so the logged entry shows the `~` mark); other keys are null only when no
 * ingredient knows them. Ingredients whose food was deleted/missing are skipped and listed.
 */
export function batchNutrients(
  recipe: Recipe,
  foods: ReadonlyMap<string, Food>,
): { nutrients: Nutrients; missingFoodIds: string[] } {
  const missingFoodIds: string[] = [];
  const parts: Nutrients[] = [];
  for (const ing of recipe.ingredients) {
    const n = ingredientNutrients(ing, foods);
    if (n) parts.push(n);
    else missingFoodIds.push(ing.foodId);
  }
  if (parts.length === 0) return { nutrients: { ...EMPTY_NUTRIENTS }, missingFoodIds };
  const out = { ...EMPTY_NUTRIENTS };
  for (const key of NUTRIENT_KEYS) {
    const vals = parts.map((p) => p[key]);
    const known = vals.filter((v): v is number => v !== null);
    const unknownBlocks = CORE_KEYS.includes(key) && known.length < vals.length;
    out[key] =
      known.length === 0 || unknownBlocks ? null : round3(known.reduce((a, b) => a + b, 0));
  }
  return { nutrients: out, missingFoodIds };
}

/** Nutrients for one serving (batch / servingsPerBatch). Throws RangeError when yield < 1. */
export function perServingNutrients(recipe: Recipe, foods: ReadonlyMap<string, Food>): Nutrients {
  assertValidYield(recipe);
  return multiplyNutrients(batchNutrients(recipe, foods).nutrients, 1 / recipe.servingsPerBatch);
}

/** Nutrients per 100 g of cooked weight, or null when no cooked weight is set. */
export function per100gNutrients(
  recipe: Recipe,
  foods: ReadonlyMap<string, Food>,
): Nutrients | null {
  if (recipe.cookedWeightG === null || !(recipe.cookedWeightG > 0)) return null;
  return multiplyNutrients(batchNutrients(recipe, foods).nutrients, 100 / recipe.cookedWeightG);
}

/** Grams in one serving when a cooked weight is set. */
export function servingWeightG(recipe: Recipe): number | null {
  if (recipe.cookedWeightG === null || !(recipe.cookedWeightG > 0)) return null;
  assertValidYield(recipe);
  return recipe.cookedWeightG / recipe.servingsPerBatch;
}

/**
 * Snapshot for logging a portion (SPEC 4.2 "Recipe snapshot").
 * - Cooked weight set: per-100 g nutrients, baseUnit 'g', serving = cookedWeight / yield grams.
 * - Otherwise: baseUnit 'g' treated as a unitless count: one base unit is one serving, so `per100`
 *   holds per-serving values x 100 and `servings = [{ id: 'serving', label: 'serving', amount: 1 }]`.
 */
export function recipeSnapshot(recipe: Recipe, foods: ReadonlyMap<string, Food>): EntrySnapshot {
  assertValidYield(recipe);
  const grams = servingWeightG(recipe);
  const per100g = per100gNutrients(recipe, foods);
  if (per100g !== null && grams !== null) {
    return {
      baseUnit: 'g',
      per100: per100g,
      servings: [{ id: RECIPE_SERVING_ID, label: 'serving', amount: round3(grams) }],
    };
  }
  return {
    baseUnit: 'g',
    per100: multiplyNutrients(perServingNutrients(recipe, foods), 100),
    servings: [{ id: RECIPE_SERVING_ID, label: 'serving', amount: 1 }],
  };
}

/** Units for the Amount panel: `serving` always, plus `g` when a cooked weight is set. */
export function recipeUnitOptions(recipe: Recipe): UnitOption[] {
  const opts: UnitOption[] = [
    { unit: { kind: 'serving', servingId: RECIPE_SERVING_ID }, label: 'serving' },
  ];
  if (recipe.cookedWeightG !== null && recipe.cookedWeightG > 0) {
    opts.push({ unit: { kind: 'base' }, label: 'g' });
  }
  return opts;
}

/** Servings array of a recipe snapshot, for unit conversion in the Amount panel. */
export function recipeServings(recipe: Recipe): Serving[] {
  const grams = servingWeightG(recipe);
  return [{ id: RECIPE_SERVING_ID, label: 'serving', amount: grams === null ? 1 : round3(grams) }];
}
