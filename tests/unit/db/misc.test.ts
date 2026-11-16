import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../../src/db/schema';
import { ensureSeeded } from '../../../src/db/seed';
import { categories, goals, searchCache, weighIns } from '../../../src/db/repositories';
import { makeRemote, resetDb } from './helpers';

beforeEach(async () => {
  await resetDb();
  await ensureSeeded();
});

describe('categories', () => {
  it('lists ordered, hides archived unless asked', async () => {
    expect((await categories.list()).map((c) => c.id)).toEqual([
      'cat-breakfast', 'cat-lunch', 'cat-meal3', 'cat-dinner', 'cat-snacks',
    ]);
    await categories.archive('cat-lunch');
    expect(await categories.list()).toHaveLength(4);
    expect(await categories.list({ includeArchived: true })).toHaveLength(5);
  });

  it('renames, sets start time, adds and reorders', async () => {
    await categories.rename('cat-lunch', 'Midday');
    await categories.setStartsAt('cat-lunch', null);
    const added = await categories.add('Late', '22:00');
    expect(added.order).toBe(6);
    await categories.reorder(['cat-snacks', 'cat-breakfast']);
    const list = await categories.list();
    expect(list.map((c) => c.id).slice(0, 3)).toEqual(['cat-snacks', 'cat-breakfast', 'cat-lunch']);
    expect(list.map((c) => c.order)).toEqual([1, 2, 3, 4, 5, 6]);
    const lunch = list.find((c) => c.id === 'cat-lunch')!;
    expect(lunch.name).toBe('Midday');
    expect(lunch.startsAt).toBeNull();
  });

  it('refuses to archive the last active category', async () => {
    for (const id of ['cat-lunch', 'cat-meal3', 'cat-dinner', 'cat-snacks']) {
      await categories.archive(id);
    }
    await expect(categories.archive('cat-breakfast')).rejects.toThrow();
    expect((await categories.list()).map((c) => c.id)).toEqual(['cat-breakfast']);
    await categories.unarchive('cat-lunch');
    await categories.archive('cat-breakfast');
    expect((await categories.list()).map((c) => c.id)).toEqual(['cat-lunch']);
  });
});

describe('goals', () => {
  const v = { kcal: 2000, protein: 150, netCarbs: 100, fat: 70, fiber: null, sugar: null, satFat: null, sodium: null };

  it('writes versions, replaces today, resolves by date', async () => {
    const a = await goals.saveToday(v, '2026-03-01');
    const a2 = await goals.saveToday({ ...v, kcal: 1900 }, '2026-03-01');
    expect(a2.id).toBe(a.id);
    await goals.saveToday({ ...v, kcal: 1800 }, '2026-03-10');
    expect(await db.goals.count()).toBe(2);
    expect((await goals.list()).map((g) => g.kcal)).toEqual([1800, 1900]);
    expect((await goals.forDate('2026-03-05'))!.kcal).toBe(1900);
    expect((await goals.forDate('2026-03-10'))!.kcal).toBe(1800);
    expect(await goals.forDate('2026-02-01')).toBeUndefined();
  });
});

describe('weighIns', () => {
  it('replaces today, updates values only, lists newest first, removes', async () => {
    const a = await weighIns.saveToday(180, null, '2026-03-01');
    const b = await weighIns.saveToday(179, 20, '2026-03-01');
    expect(b.id).toBe(a.id);
    expect(b.createdAt).toBe(a.createdAt);
    await weighIns.saveToday(178, null, '2026-03-02');
    expect(await db.weighIns.count()).toBe(2);
    expect((await weighIns.list()).map((w) => w.date)).toEqual(['2026-03-02', '2026-03-01']);
    expect((await weighIns.forDate('2026-03-01'))!.weightLb).toBe(179);
    await weighIns.update(a.id, 177, 19);
    const u = (await weighIns.forDate('2026-03-01'))!;
    expect([u.weightLb, u.bodyFatPct, u.date]).toEqual([177, 19, '2026-03-01']);
    await weighIns.remove(a.id);
    expect(await weighIns.forDate('2026-03-01')).toBeUndefined();
  });
});

describe('searchCache', () => {
  it('gets, replaces and caps at the newest 300', async () => {
    const t = (i: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString();
    for (let i = 0; i < 305; i++) {
      await searchCache.put(`usda:q${i}`, [makeRemote()], t(i));
    }
    expect(await db.searchCache.count()).toBe(300);
    expect(await searchCache.get('usda:q0')).toBeUndefined();
    expect(await searchCache.get('usda:q4')).toBeUndefined();
    expect((await searchCache.get('usda:q5'))!.results).toHaveLength(1);
    await searchCache.put('usda:q304', [], t(400));
    expect((await searchCache.get('usda:q304'))!.results).toEqual([]);
    expect(await db.searchCache.count()).toBe(300);
  });
});
