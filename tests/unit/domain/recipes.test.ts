import { describe, expect, it } from 'vitest';
import {
  batchNutrients,
  isValidServingsPerBatch,
  per100gNutrients,
  perServingNutrients,
  recipeServings,
  recipeSnapshot,
  recipeUnitOptions,
} from '../../../src/domain/recipes';
import { food, nut, recipe } from './factories';

const oats = food({ id: 'f1' });
const foods = new Map([['f1', oats]]);

describe('recipe nutrition', () => {
  it('totals the batch from ingredients', () => {
    const { nutrients, missingFoodIds } = batchNutrients(recipe(), foods);
    expect(nutrients.kcal).toBe(380);
    expect(nutrients.protein).toBe(13);
    expect(missingFoodIds).toEqual([]);
  });
  it('supports serving units for ingredients', () => {
    const r = recipe({
      ingredients: [{ foodId: 'f1', amount: 2, unit: { kind: 'serving', servingId: 's1' } }],
    });
    expect(batchNutrients(r, foods).nutrients.kcal).toBe(304); // 80 g
  });
  it('sums several ingredients', () => {
    const milk = food({
      id: 'f2',
      per100: nut({ kcal: 50, protein: 3, carbs: 5, fat: 2 }),
      servings: [],
    });
    const r = recipe({
      ingredients: [
        { foodId: 'f1', amount: 100, unit: { kind: 'base' } },
        { foodId: 'f2', amount: 200, unit: { kind: 'base' } },
      ],
    });
    const n = batchNutrients(r, new Map([...foods, ['f2', milk]])).nutrients;
    expect(n.kcal).toBe(480);
    expect(n.fat).toBe(11);
    expect(n.fiber).toBe(10); // milk fiber unknown: optional keys stay known if any ingredient knows them
  });
  it('divides by servingsPerBatch', () => {
    expect(perServingNutrients(recipe(), foods).kcal).toBe(190);
    expect(perServingNutrients(recipe({ servingsPerBatch: 4 }), foods).protein).toBe(3.25);
  });
  it('per 100 g uses the cooked weight, null without one', () => {
    expect(per100gNutrients(recipe({ cookedWeightG: 400 }), foods)?.kcal).toBe(95);
    expect(per100gNutrients(recipe(), foods)).toBeNull();
    expect(per100gNutrients(recipe({ cookedWeightG: 0 }), foods)).toBeNull();
  });
  it('rejects servingsPerBatch < 1', () => {
    expect(isValidServingsPerBatch(0)).toBe(false);
    expect(isValidServingsPerBatch(0.5)).toBe(false);
    expect(isValidServingsPerBatch(NaN)).toBe(false);
    expect(isValidServingsPerBatch(1)).toBe(true);
    expect(() => perServingNutrients(recipe({ servingsPerBatch: 0 }), foods)).toThrow(RangeError);
    expect(() => recipeSnapshot(recipe({ servingsPerBatch: 0.5 }), foods)).toThrow(RangeError);
  });
  it('skips ingredients whose food is missing and reports them', () => {
    const r = recipe({
      ingredients: [
        { foodId: 'f1', amount: 100, unit: { kind: 'base' } },
        { foodId: 'gone', amount: 50, unit: { kind: 'base' } },
        { foodId: 'f1', amount: 1, unit: { kind: 'serving', servingId: 'nope' } },
      ],
    });
    const { nutrients, missingFoodIds } = batchNutrients(r, foods);
    expect(nutrients.kcal).toBe(380);
    expect(missingFoodIds).toEqual(['gone', 'f1']);
  });
  it('an empty recipe is all-unknown', () => {
    expect(batchNutrients(recipe({ ingredients: [] }), foods).nutrients.kcal).toBeNull();
  });
  it('an ingredient with unknown core values makes the batch core value unknown', () => {
    const bad = food({
      id: 'f2',
      per100: nut({ kcal: 100, protein: null, carbs: 10, fat: 1 }),
      servings: [],
    });
    const r = recipe({
      ingredients: [
        { foodId: 'f1', amount: 100, unit: { kind: 'base' } },
        { foodId: 'f2', amount: 100, unit: { kind: 'base' } },
      ],
    });
    const n = batchNutrients(r, new Map([...foods, ['f2', bad]])).nutrients;
    expect(n.protein).toBeNull();
    expect(n.kcal).toBe(480);
  });
  it('derives kcal for an ingredient with only macros', () => {
    const noKcal = food({
      id: 'f2',
      per100: nut({ protein: 10, carbs: 10, fat: 10 }),
      servings: [],
    });
    const r = recipe({ ingredients: [{ foodId: 'f2', amount: 100, unit: { kind: 'base' } }] });
    expect(batchNutrients(r, new Map([['f2', noKcal]])).nutrients.kcal).toBe(170);
  });
});

describe('recipeSnapshot', () => {
  it('without a cooked weight: per-serving x 100 with a unit-less serving of 1', () => {
    const s = recipeSnapshot(recipe(), foods);
    expect(s.baseUnit).toBe('g');
    expect(s.servings).toEqual([{ id: 'serving', label: 'serving', amount: 1 }]);
    expect(s.per100.kcal).toBe(19000); // 190 per serving x 100, so 1 unit scales to 190
  });
  it('with a cooked weight: per-100 g and a serving of cookedWeight / yield grams', () => {
    const s = recipeSnapshot(recipe({ cookedWeightG: 400 }), foods);
    expect(s.per100.kcal).toBe(95);
    expect(s.servings).toEqual([{ id: 'serving', label: 'serving', amount: 200 }]);
  });
  it('is detached from later food edits', () => {
    const s = recipeSnapshot(recipe(), foods);
    oats.per100 = { ...oats.per100, kcal: 1 };
    expect(s.per100.kcal).toBe(19000);
    oats.per100 = { ...oats.per100, kcal: 380 };
  });
});

describe('recipe units', () => {
  it('offers serving only, or serving + g with a cooked weight', () => {
    expect(recipeUnitOptions(recipe()).map((o) => o.label)).toEqual(['serving']);
    expect(recipeUnitOptions(recipe({ cookedWeightG: 400 })).map((o) => o.label)).toEqual([
      'serving',
      'g',
    ]);
  });
  it('recipeServings matches the snapshot serving', () => {
    expect(recipeServings(recipe())).toEqual([{ id: 'serving', label: 'serving', amount: 1 }]);
    expect(recipeServings(recipe({ cookedWeightG: 300 }))[0]?.amount).toBe(150);
  });
});
