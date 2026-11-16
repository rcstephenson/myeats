import { describe, expect, it } from 'vitest';
import {
  buildFoodEntry,
  buildQuickEntry,
  buildRecipeEntry,
  cloneEntry,
  rescaleEntry,
} from '../../../src/domain/entries';
import { isIncomplete } from '../../../src/domain/nutrients';
import type { UnitRef } from '../../../src/domain/types';
import { food, nut, NOW, recipe } from './factories';

const common = { date: '2026-11-16', categoryId: 'b', order: 2, now: NOW, id: 'e1' };
const g: UnitRef = { kind: 'base' };
const scoop: UnitRef = { kind: 'serving', servingId: 's1' };

describe('buildFoodEntry', () => {
  it('scales nutrients and snapshots the food', () => {
    const f = food({ brand: 'Acme' });
    const e = buildFoodEntry({ ...common, food: f, amount: 80, unit: g });
    expect(e).toMatchObject({
      kind: 'food',
      refId: 'f1',
      name: 'Oats',
      brand: 'Acme',
      amount: 80,
      unitLabel: 'g',
      baseAmount: 80,
      kcalDerived: false,
      mealLogId: null,
      mealName: null,
      createdAt: NOW,
      updatedAt: NOW,
      date: '2026-11-16',
      categoryId: 'b',
      order: 2,
    });
    expect(e.nutrients.kcal).toBe(304);
    expect(e.snapshot?.per100.kcal).toBe(380);
    expect(e.snapshot?.servings).toEqual(f.servings);
  });
  it('handles serving units', () => {
    const e = buildFoodEntry({ ...common, food: food(), amount: 1.5, unit: scoop });
    expect(e.baseAmount).toBe(60);
    expect(e.unitLabel).toBe('1 scoop');
    expect(e.nutrients.kcal).toBe(228);
  });
  it('derives kcal when it is null but macros are known', () => {
    const f = food({ per100: nut({ kcal: null, protein: 10, carbs: 20, fat: 5 }) });
    const e = buildFoodEntry({ ...common, food: f, amount: 100, unit: g });
    expect(e.nutrients.kcal).toBe(165);
    expect(e.kcalDerived).toBe(true);
  });
  it('keeps unknown nutrients null and marks the entry incomplete', () => {
    const f = food({ per100: nut({ kcal: 100, protein: 5 }) });
    const e = buildFoodEntry({ ...common, food: f, amount: 100, unit: g });
    expect(e.nutrients.fat).toBeNull();
    expect(isIncomplete(e.nutrients)).toBe(true);
    expect(e.kcalDerived).toBe(false);
  });
  it('links to a saved meal', () => {
    const e = buildFoodEntry({
      ...common,
      food: food(),
      amount: 1,
      unit: g,
      mealLogId: 'ml',
      mealName: 'Usual',
    });
    expect(e).toMatchObject({ mealLogId: 'ml', mealName: 'Usual' });
  });
  it('rejects bad amounts and unknown servings', () => {
    expect(() => buildFoodEntry({ ...common, food: food(), amount: 0, unit: g })).toThrow();
    expect(() => buildFoodEntry({ ...common, food: food(), amount: NaN, unit: g })).toThrow();
    expect(() =>
      buildFoodEntry({
        ...common,
        food: food(),
        amount: 1,
        unit: { kind: 'serving', servingId: 'x' },
      }),
    ).toThrow();
  });
  it('changing the food after logging does not change the logged entry', () => {
    const f = food();
    const e = buildFoodEntry({ ...common, food: f, amount: 80, unit: g });
    const before = JSON.stringify(e);
    f.per100.kcal = 9999;
    f.servings[0]!.amount = 1;
    f.name = 'Renamed';
    expect(JSON.stringify(e)).toBe(before);
  });
});

describe('rescaleEntry', () => {
  it('recomputes from the snapshot, not the current food', () => {
    const f = food();
    const e = buildFoodEntry({ ...common, food: f, amount: 80, unit: g });
    f.per100.kcal = 1000;
    const r = rescaleEntry(e, 2, scoop, '2026-11-16T13:00:00.000Z');
    expect(r.nutrients.kcal).toBe(304); // 80 g from the old 380/100g
    expect(r).toMatchObject({
      amount: 2,
      unitLabel: '1 scoop',
      baseAmount: 80,
      updatedAt: '2026-11-16T13:00:00.000Z',
    });
    expect(r.createdAt).toBe(NOW);
    expect(rescaleEntry(e, 40, g, NOW).nutrients.kcal).toBe(152);
  });
  it('does not mutate the original', () => {
    const e = buildFoodEntry({ ...common, food: food(), amount: 80, unit: g });
    rescaleEntry(e, 10, g, NOW);
    expect(e.amount).toBe(80);
  });
  it('rejects quick entries', () => {
    const q = buildQuickEntry({
      ...common,
      label: null,
      kcal: 100,
      protein: null,
      netCarbs: null,
      fat: null,
    });
    expect(() => rescaleEntry(q, 1, g, NOW)).toThrow();
  });
});

describe('buildQuickEntry', () => {
  it('stores net carbs as carbs with fiber 0, no snapshot or amount', () => {
    const e = buildQuickEntry({
      ...common,
      label: ' Cake ',
      kcal: 400,
      protein: 5,
      netCarbs: 50,
      fat: 20,
    });
    expect(e).toMatchObject({
      kind: 'quick',
      name: 'Cake',
      refId: null,
      amount: null,
      unitLabel: null,
      baseAmount: null,
      snapshot: null,
      kcalDerived: false,
    });
    expect(e.nutrients).toMatchObject({ kcal: 400, protein: 5, carbs: 50, fiber: 0, fat: 20 });
  });
  it('defaults the label to "Quick add"', () => {
    expect(
      buildQuickEntry({ ...common, label: '  ', kcal: 1, protein: null, netCarbs: null, fat: null })
        .name,
    ).toBe('Quick add');
  });
  it('derives kcal at 4/4/9 when blank', () => {
    const e = buildQuickEntry({
      ...common,
      label: null,
      kcal: null,
      protein: 10,
      netCarbs: 20,
      fat: 5,
    });
    expect(e.nutrients.kcal).toBe(165);
    expect(e.kcalDerived).toBe(true);
  });
  it('derives from the macros given, blank counting as 0', () => {
    expect(
      buildQuickEntry({
        ...common,
        label: null,
        kcal: null,
        protein: 10,
        netCarbs: null,
        fat: null,
      }).nutrients.kcal,
    ).toBe(40);
  });
  it('leaves kcal null with nothing entered', () => {
    const e = buildQuickEntry({
      ...common,
      label: null,
      kcal: null,
      protein: null,
      netCarbs: null,
      fat: null,
    });
    expect(e.nutrients.kcal).toBeNull();
    expect(e.kcalDerived).toBe(false);
  });
});

describe('buildRecipeEntry', () => {
  const oats = food({ id: 'f1' });
  const foods = new Map([['f1', oats]]);
  const serving: UnitRef = { kind: 'serving', servingId: 'serving' };

  it('logs servings of a recipe without cooked weight', () => {
    const e = buildRecipeEntry({ ...common, recipe: recipe(), foods, amount: 1.5, unit: serving });
    expect(e).toMatchObject({
      kind: 'recipe',
      refId: 'r1',
      name: 'Porridge',
      brand: null,
      unitLabel: 'serving',
      baseAmount: 1.5,
    });
    expect(e.nutrients.kcal).toBe(285); // 190 x 1.5
  });
  it('logs grams when a cooked weight is set', () => {
    const r = recipe({ cookedWeightG: 400 });
    const e = buildRecipeEntry({ ...common, recipe: r, foods, amount: 100, unit: g });
    expect(e.nutrients.kcal).toBe(95);
    expect(
      buildRecipeEntry({ ...common, recipe: r, foods, amount: 1, unit: serving }).nutrients.kcal,
    ).toBe(190);
  });
  it('rejects grams without a cooked weight and zero-yield recipes', () => {
    expect(() =>
      buildRecipeEntry({ ...common, recipe: recipe(), foods, amount: 100, unit: g }),
    ).toThrow();
    expect(() =>
      buildRecipeEntry({
        ...common,
        recipe: recipe({ servingsPerBatch: 0 }),
        foods,
        amount: 1,
        unit: serving,
      }),
    ).toThrow();
  });
  it('is unaffected by later ingredient edits', () => {
    const e = buildRecipeEntry({ ...common, recipe: recipe(), foods, amount: 1, unit: serving });
    oats.per100 = { ...oats.per100, kcal: 1 };
    expect(rescaleEntry(e, 2, serving, NOW).nutrients.kcal).toBe(380);
    oats.per100 = { ...oats.per100, kcal: 380 };
  });
  it('links to a saved meal', () => {
    const e = buildRecipeEntry({
      ...common,
      recipe: recipe(),
      foods,
      amount: 1,
      unit: serving,
      mealLogId: 'x',
      mealName: 'M',
    });
    expect(e.mealLogId).toBe('x');
  });
});

describe('cloneEntry', () => {
  it('copies with new identity and keeps the original snapshot and nutrients', () => {
    const e = buildFoodEntry({
      ...common,
      food: food(),
      amount: 80,
      unit: g,
      mealLogId: 'ml',
      mealName: 'Usual',
    });
    const c = cloneEntry(e, {
      id: 'e2',
      date: '2026-11-17',
      categoryId: 'l',
      order: 0,
      now: '2026-11-17T08:00:00.000Z',
    });
    expect(c).toMatchObject({
      id: 'e2',
      date: '2026-11-17',
      categoryId: 'l',
      order: 0,
      createdAt: '2026-11-17T08:00:00.000Z',
      updatedAt: '2026-11-17T08:00:00.000Z',
      mealLogId: null,
      mealName: null,
      amount: 80,
    });
    expect(c.nutrients).toEqual(e.nutrients);
    expect(c.snapshot).toEqual(e.snapshot);
    expect(c.snapshot).not.toBe(e.snapshot);
    expect(c.nutrients).not.toBe(e.nutrients);
  });
  it('keeps the meal name when a mealLogId is supplied', () => {
    const e = buildFoodEntry({
      ...common,
      food: food(),
      amount: 1,
      unit: g,
      mealLogId: 'ml',
      mealName: 'Usual',
    });
    const c = cloneEntry(e, {
      id: 'e2',
      date: 'd',
      categoryId: 'c',
      order: 0,
      now: NOW,
      mealLogId: 'new',
    });
    expect(c).toMatchObject({ mealLogId: 'new', mealName: 'Usual' });
  });
  it('clones quick entries (no snapshot)', () => {
    const q = buildQuickEntry({
      ...common,
      label: null,
      kcal: 100,
      protein: null,
      netCarbs: null,
      fat: null,
    });
    expect(
      cloneEntry(q, { id: 'q2', date: 'd', categoryId: 'c', order: 0, now: NOW }).snapshot,
    ).toBeNull();
  });
});
