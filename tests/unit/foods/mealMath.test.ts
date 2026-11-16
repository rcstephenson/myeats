import { describe, expect, it } from 'vitest';
import { itemsFromEntries, mealTotals } from '../../../src/components/foods/mealMath';
import { entry, food, nut, recipe } from '../domain/factories';

const snap = (extra = {}) => ({
  baseUnit: 'g' as const,
  per100: nut({ kcal: 380 }),
  servings: [{ id: 's1', label: '1 scoop', amount: 40 }],
  ...extra,
});

describe('itemsFromEntries', () => {
  it('maps base, serving and quick entries, skipping quick ones with a count', () => {
    const entries = [
      entry({
        id: 'a',
        order: 2,
        kind: 'food',
        refId: 'f1',
        amount: 80,
        unitLabel: 'g',
        baseAmount: 80,
        snapshot: snap(),
      }),
      entry({
        id: 'b',
        order: 1,
        kind: 'food',
        refId: 'f1',
        amount: 2,
        unitLabel: '1 scoop',
        baseAmount: 80,
        snapshot: snap(),
      }),
      entry({ id: 'c', order: 0, kind: 'quick' }),
      entry({
        id: 'd',
        categoryId: 'l',
        kind: 'food',
        refId: 'f9',
        amount: 1,
        unitLabel: 'g',
        baseAmount: 1,
        snapshot: snap(),
      }),
    ];
    const r = itemsFromEntries(entries, 'b');
    expect(r.skippedQuick).toBe(1);
    expect(r.items).toEqual([
      { kind: 'food', refId: 'f1', amount: 2, unit: { kind: 'serving', servingId: 's1' } },
      { kind: 'food', refId: 'f1', amount: 80, unit: { kind: 'base' } },
    ]);
  });

  it('falls back to the base amount when the serving label or id no longer matches', () => {
    const e = entry({
      kind: 'food',
      refId: 'f1',
      amount: 2,
      unitLabel: '1 cup',
      baseAmount: 480,
      snapshot: snap(),
    });
    expect(itemsFromEntries([e], 'b').items[0]).toMatchObject({
      amount: 480,
      unit: { kind: 'base' },
    });
    const e2 = entry({
      kind: 'food',
      refId: 'f1',
      amount: 2,
      unitLabel: '1 scoop',
      baseAmount: 80,
      snapshot: snap(),
    });
    expect(itemsFromEntries([e2], 'b', () => false).items[0]).toMatchObject({
      amount: 80,
      unit: { kind: 'base' },
    });
  });

  it('maps recipe servings', () => {
    const e = entry({
      kind: 'recipe',
      refId: 'r1',
      amount: 1.5,
      unitLabel: 'serving',
      baseAmount: 1.5,
      snapshot: snap({ servings: [{ id: 'serving', label: 'serving', amount: 1 }] }),
    });
    expect(itemsFromEntries([e], 'b').items[0]).toEqual({
      kind: 'recipe',
      refId: 'r1',
      amount: 1.5,
      unit: { kind: 'serving', servingId: 'serving' },
    });
  });
});

describe('mealTotals', () => {
  it('sums foods and recipes, ignoring missing refs', () => {
    const f = food({ per100: nut({ kcal: 100, protein: 10 }) });
    const r = recipe({
      servingsPerBatch: 2,
      ingredients: [{ foodId: 'f1', amount: 200, unit: { kind: 'base' } }],
    });
    const t = mealTotals(
      [
        { kind: 'food', refId: 'f1', amount: 50, unit: { kind: 'base' } },
        { kind: 'recipe', refId: 'r1', amount: 1, unit: { kind: 'serving', servingId: 'serving' } },
        { kind: 'food', refId: 'gone', amount: 50, unit: { kind: 'base' } },
      ],
      new Map([['f1', f]]),
      new Map([['r1', r]]),
    );
    expect(t.kcal).toBe(150);
    expect(t.protein).toBe(15);
  });
});
