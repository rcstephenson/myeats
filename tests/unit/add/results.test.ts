import { describe, expect, it } from 'vitest';
import {
  defaultFoodAmount,
  defaultRecipeAmount,
  previewNutrients,
  unitFromKey,
  unitKey,
} from '../../../src/components/add/amounts';
import {
  dedupeRemote,
  refsForChip,
  remoteRow,
  resolveMeal,
  rowFor,
  toMap,
} from '../../../src/components/add/results';
import { STALE_MS, isFresh } from '../../../src/components/add/useUsdaSearch';
import { buildIndex, search } from '../../../src/domain/search';
import type { RemoteFood } from '../../../src/domain/types';
import { food, meal, nut, recipe } from '../domain/factories';

const remote = (p: Partial<RemoteFood> = {}): RemoteFood => {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = food({ source: 'usda', sourceId: '111' });
  void _id;
  void _c;
  void _u;
  return { ...rest, dataType: 'SR Legacy', ...p };
};

describe('default amounts', () => {
  it('prefills the last amount used', () => {
    const f = food({ lastAmount: { amount: 80, unit: { kind: 'base' } } });
    expect(defaultFoodAmount(f)).toEqual({ amount: 80, unit: { kind: 'base' } });
  });

  it('falls back to 1 default serving, then 100 base units', () => {
    expect(defaultFoodAmount(food({ defaultServingId: 's1' }))).toEqual({
      amount: 1,
      unit: { kind: 'serving', servingId: 's1' },
    });
    expect(defaultFoodAmount(food({ defaultServingId: null }))).toEqual({
      amount: 100,
      unit: { kind: 'base' },
    });
  });

  it('ignores a last amount whose serving no longer exists', () => {
    const f = food({
      defaultServingId: 's1',
      lastAmount: { amount: 2, unit: { kind: 'serving', servingId: 'gone' } },
    });
    expect(defaultFoodAmount(f).unit).toEqual({ kind: 'serving', servingId: 's1' });
  });

  it('recipes default to one serving; grams only with a cooked weight', () => {
    const grams = { amount: 200, unit: { kind: 'base' as const } };
    expect(defaultRecipeAmount(recipe({ lastAmount: grams, cookedWeightG: null })).unit.kind).toBe('serving');
    expect(defaultRecipeAmount(recipe({ lastAmount: grams, cookedWeightG: 400 }))).toEqual(grams);
  });
});

describe('previewNutrients', () => {
  const f = food();
  it('scales per-100 values by the chosen amount and unit', () => {
    const snap = { baseUnit: f.baseUnit, per100: f.per100, servings: f.servings };
    expect(previewNutrients(snap, 2, { kind: 'serving', servingId: 's1' })?.nutrients.kcal).toBeCloseTo(304);
    expect(previewNutrients(snap, 50, { kind: 'base' })?.nutrients.kcal).toBeCloseTo(190);
  });
  it('is null for an unknown serving and derives kcal when missing', () => {
    const snap = { baseUnit: 'g' as const, per100: nut({ protein: 10, carbs: 10, fat: 10 }), servings: [] };
    expect(previewNutrients(snap, 1, { kind: 'serving', servingId: 'x' })).toBeNull();
    const p = previewNutrients(snap, 100, { kind: 'base' });
    expect(p?.kcalDerived).toBe(true);
    expect(p?.nutrients.kcal).toBe(170);
  });
  it('round-trips unit keys', () => {
    expect(unitFromKey(unitKey({ kind: 'base' }))).toEqual({ kind: 'base' });
    expect(unitFromKey(unitKey({ kind: 'serving', servingId: 'a:b' }))).toEqual({ kind: 'serving', servingId: 'a:b' });
  });
});

describe('dedupeRemote', () => {
  const lookups = { foods: new Map(), recipes: new Map() };
  void lookups;
  it('hides remote foods that are already stored (same source and sourceId)', () => {
    const local = [food({ id: 'l1', source: 'usda', sourceId: '111' })];
    const out = dedupeRemote([remote({ sourceId: '111' }), remote({ sourceId: '222' })], local);
    expect(out.map((r) => r.sourceId)).toEqual(['222']);
  });
  it('hides remote foods replaced by a custom override', () => {
    const local = [food({ id: 'c1', source: 'custom', overrides: 'usda:333' })];
    expect(dedupeRemote([remote({ sourceId: '333' }), remote({ sourceId: '444' })], local)).toHaveLength(1);
  });
  it('does not confuse sources with the same id', () => {
    const local = [food({ id: 'o1', source: 'off', sourceId: '111' })];
    expect(dedupeRemote([remote({ sourceId: '111' })], local)).toHaveLength(1);
  });
});

describe('result rows', () => {
  const oats = food({ id: 'f1', name: 'Rolled oats', lastAmount: { amount: 80, unit: { kind: 'base' } } });
  const lookups = { foods: toMap([oats]), recipes: toMap([]) };

  it('a food row shows the last amount and its kcal; own foods have no tag', () => {
    const row = rowFor({ kind: 'food', item: oats }, lookups);
    expect(row.amount).toBe('80 g');
    expect(row.kcal).toBe('304 kcal');
    expect(row.tag).toBeUndefined();
  });

  it('remote foods are tagged, and CACHED wins when served from the cache', () => {
    expect(rowFor({ kind: 'food', item: food({ source: 'usda', sourceId: '1' }) }, lookups).tag).toBe('USDA');
    expect(remoteRow(remote(), false).tag).toBe('USDA');
    expect(remoteRow(remote(), true).tag).toBe('CACHED');
    expect(remoteRow(remote({ source: 'off', dataType: 'OFF' }), false).tag).toBe('OFF');
  });

  it('a meal row totals its items; items that vanished are counted as missing', () => {
    const m = meal({
      items: [
        { kind: 'food', refId: 'f1', amount: 50, unit: { kind: 'base' } },
        { kind: 'food', refId: 'gone', amount: 1, unit: { kind: 'base' } },
      ],
    });
    expect(resolveMeal(m, lookups)).toMatchObject({ missing: 1 });
    const row = rowFor({ kind: 'meal', item: m }, lookups);
    expect(row.tag).toBe('MEAL');
    expect(row.kcal).toBe('190 kcal');
  });
});

describe('chips and search', () => {
  const a = food({ id: 'a', name: 'Apple', favoriteAt: '2026-01-01T00:00:00Z' });
  const b = food({ id: 'b', name: 'Bread' });
  const gone = food({ id: 'g', name: 'Gone', favoriteAt: '2026-01-01T00:00:00Z', deletedAt: '2026-02-01T00:00:00Z' });
  const overridden = food({ id: 'u', source: 'usda', sourceId: '9', name: 'Original', favoriteAt: '2026-01-01T00:00:00Z' });
  const custom = food({ id: 'c', name: 'Mine', overrides: 'usda:9', favoriteAt: '2026-01-01T00:00:00Z' });
  const data = {
    foods: [b, a, gone, overridden, custom],
    recipes: [recipe({ id: 'r', name: 'Zed', favoriteAt: '2026-01-01T00:00:00Z' })],
    meals: [meal({ id: 'm', name: 'Usual' })],
  };

  it('favourites: sorted by name, no deleted or overridden originals', () => {
    expect(refsForChip('favourites', data).map((r) => r.item.name)).toEqual(['Apple', 'Mine', 'Zed']);
  });
  it('meals and recipes chips list only their kind', () => {
    expect(refsForChip('meals', data).map((r) => r.kind)).toEqual(['meal']);
    expect(refsForChip('recipes', data).map((r) => r.kind)).toEqual(['recipe']);
  });
  it('typing finds local foods, recipes and meals together', () => {
    const idx = buildIndex(data.foods, data.recipes, data.meals, new Date('2026-11-16T12:00:00Z'));
    expect(search(idx, 'us').map((h) => h.kind)).toEqual(['meal']);
    expect(search(idx, 'ap').map((h) => h.id)).toEqual(['a']);
  });
});

describe('usda cache freshness', () => {
  it('is fresh for under 7 days', () => {
    const now = Date.parse('2026-11-16T12:00:00Z');
    expect(isFresh(new Date(now - STALE_MS + 60_000).toISOString(), now)).toBe(true);
    expect(isFresh(new Date(now - STALE_MS - 60_000).toISOString(), now)).toBe(false);
    expect(isFresh('not a date', now)).toBe(false);
  });
});
