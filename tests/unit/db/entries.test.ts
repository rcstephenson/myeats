import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../../src/db/schema';
import { ensureSeeded } from '../../../src/db/seed';
import { entries, foods, meals, recipes } from '../../../src/db/repositories';
import { makeEntry, makeFood, resetDb } from './helpers';

beforeEach(async () => {
  await resetDb();
  await ensureSeeded();
});

describe('entries', () => {
  it('add writes entries and updates usage in one transaction', async () => {
    await foods.save(makeFood());
    await foods.save(makeFood({ id: 'f2', name: 'Milk' }));
    await db.recipes.put({
      id: 'r1', name: 'R', nameLower: 'r', ingredients: [], servingsPerBatch: 1, cookedWeightG: null,
      lastAmount: null, useCount: 0, lastUsedAt: null, favoriteAt: null, deletedAt: null,
      createdAt: 'x', updatedAt: 'x',
    });
    await db.meals.put({
      id: 'm1', name: 'M', nameLower: 'm', items: [], defaultCategoryId: null, useCount: 2,
      lastUsedAt: null, favoriteAt: null, deletedAt: null, createdAt: 'x', updatedAt: 'x',
    });
    const la = { amount: 50, unit: { kind: 'base' } as const };
    const rec = await entries.add([makeEntry(), makeEntry({ id: 'e2' })], {
      foods: [
        { id: 'f1', lastAmount: la },
        { id: 'f2', lastAmount: null },
      ],
      recipes: [{ id: 'r1', lastAmount: la }],
      mealId: 'm1',
    });
    expect(rec).toEqual({ kind: 'added', ids: ['e1', 'e2'] });
    expect(await db.entries.count()).toBe(2);
    const f1 = (await foods.get('f1'))!;
    expect(f1.useCount).toBe(1);
    expect(f1.lastUsedAt).not.toBeNull();
    expect(f1.lastAmount).toEqual(la);
    const f2 = (await foods.get('f2'))!;
    expect(f2.useCount).toBe(1);
    expect(f2.lastAmount).toBeNull();
    expect((await recipes.get('r1'))!.useCount).toBe(1);
    const m = (await meals.get('m1'))!;
    expect(m.useCount).toBe(3);
    expect(m.lastUsedAt).not.toBeNull();
  });

  it('add rolls back entries when a usage update fails', async () => {
    await foods.save(makeFood());
    const orig = db.foods.update.bind(db.foods);
    db.foods.update = (() => Promise.reject(new Error('boom'))) as unknown as typeof db.foods.update;
    try {
      await expect(
        entries.add([makeEntry()], { foods: [{ id: 'f1', lastAmount: null }] }),
      ).rejects.toThrow();
    } finally {
      db.foods.update = orig;
    }
    expect(await db.entries.count()).toBe(0);
  });

  it('undoes add, remove and clear', async () => {
    const added = await entries.add([makeEntry(), makeEntry({ id: 'e2', order: 2 })]);
    await entries.undo(added);
    expect(await db.entries.count()).toBe(0);

    await entries.add([makeEntry(), makeEntry({ id: 'e2', order: 2 })]);
    const removed = await entries.remove(['e1']);
    expect(removed.kind).toBe('removed');
    expect(await db.entries.count()).toBe(1);
    await entries.undo(removed);
    expect(await db.entries.count()).toBe(2);

    const cleared = await entries.clearCategory('2026-03-01', 'cat-breakfast');
    expect(cleared.kind).toBe('cleared');
    expect(await db.entries.count()).toBe(0);
    await entries.undo(cleared);
    expect(await db.entries.count()).toBe(2);
  });

  it('clearCategory only touches that date and category', async () => {
    await entries.add([
      makeEntry(),
      makeEntry({ id: 'e2', categoryId: 'cat-lunch' }),
      makeEntry({ id: 'e3', date: '2026-03-02' }),
    ]);
    await entries.clearCategory('2026-03-01', 'cat-breakfast');
    expect((await db.entries.toArray()).map((e) => e.id).sort()).toEqual(['e2', 'e3']);
  });

  it('forDay sorts by category order then entry order', async () => {
    await entries.add([
      makeEntry({ id: 'a', categoryId: 'cat-dinner', order: 1 }),
      makeEntry({ id: 'b', categoryId: 'cat-breakfast', order: 2 }),
      makeEntry({ id: 'c', categoryId: 'cat-breakfast', order: 1 }),
      makeEntry({ id: 'd', date: '2026-03-02' }),
    ]);
    expect((await entries.forDay('2026-03-01')).map((e) => e.id)).toEqual(['c', 'b', 'a']);
  });

  it('forRange is inclusive and nextOrder increments', async () => {
    await entries.add([
      makeEntry({ id: 'a', date: '2026-03-01' }),
      makeEntry({ id: 'b', date: '2026-03-03', order: 4 }),
      makeEntry({ id: 'c', date: '2026-03-05' }),
    ]);
    expect((await entries.forRange('2026-03-01', '2026-03-03')).map((e) => e.id).sort()).toEqual([
      'a',
      'b',
    ]);
    expect(await entries.nextOrder('2026-03-03', 'cat-breakfast')).toBe(5);
    expect(await entries.nextOrder('2026-03-04', 'cat-breakfast')).toBe(1);
  });

  it('update replaces the entry', async () => {
    await entries.add([makeEntry()]);
    await entries.update(makeEntry({ amount: 80 }));
    expect((await db.entries.get('e1'))!.amount).toBe(80);
  });
});
