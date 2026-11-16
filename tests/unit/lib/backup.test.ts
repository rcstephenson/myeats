import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../../src/db/schema';
import { ensureSeeded } from '../../../src/db/seed';
import { DEFAULT_CATEGORIES } from '../../../src/db/seed';
import { settings } from '../../../src/db/repositories';
import {
  backupFileName,
  clearAllData,
  exportBackup,
  importBackup,
  parseBackup,
} from '../../../src/lib/backup';
import { buildDemoData, seedDemoData } from '../../../src/dev/demoData';
import { makeFood, resetDb } from '../db/helpers';

beforeEach(async () => {
  await resetDb();
  await ensureSeeded();
});

async function counts() {
  return {
    foods: await db.foods.count(),
    recipes: await db.recipes.count(),
    meals: await db.meals.count(),
    entries: await db.entries.count(),
    categories: await db.categories.count(),
    goals: await db.goals.count(),
    weighIns: await db.weighIns.count(),
  };
}

describe('backup', () => {
  it('names the file by date', () => {
    expect(backupFileName(new Date(2026, 2, 5))).toBe('myeats-backup-2026-03-05.json');
  });

  it('round-trips demo data through export, replace import and back', async () => {
    await seedDemoData();
    await settings.update({ theme: 'dark', usdaApiKey: 'secret' });
    const before = await counts();
    expect(before.entries).toBeGreaterThan(50);

    const backup = await exportBackup();
    expect(backup).toMatchObject({ app: 'myeats', backupVersion: 1 });
    expect(Object.keys(backup.data).sort()).toEqual([
      'categories',
      'entries',
      'foods',
      'goals',
      'meals',
      'recipes',
      'weighIns',
    ]);
    // Settings and the search cache are never exported.
    expect(JSON.stringify(backup)).not.toContain('secret');

    const text = JSON.stringify(backup);
    await clearAllData();
    expect((await counts()).entries).toBe(0);
    await importBackup(JSON.parse(text), 'replace');
    expect(await counts()).toEqual(before);
    expect(await db.entries.toArray()).toEqual(
      [...backup.data.entries].sort((a, b) => a.id.localeCompare(b.id)),
    );
  });

  it('merge upserts by id and keeps local rows; replace removes them', async () => {
    await seedDemoData();
    const backup = await exportBackup();
    await db.foods.put(makeFood({ id: 'local-only', name: 'Local' }));
    await db.foods.update('demo-food-oats', { name: 'Edited locally' });

    await importBackup(backup, 'merge');
    expect(await db.foods.get('local-only')).toBeDefined();
    expect((await db.foods.get('demo-food-oats'))?.name).toBe('Rolled oats');

    await importBackup(backup, 'replace');
    expect(await db.foods.get('local-only')).toBeUndefined();
    expect(await db.entries.count()).toBe(backup.data.entries.length);
  });

  it('merge tolerates a different goal id on an existing effective date', async () => {
    await seedDemoData();
    const backup = await exportBackup();
    const g = backup.data.goals[0];
    backup.data.goals[0] = { ...g, id: 'other-id' };
    await importBackup(backup, 'merge');
    expect(await db.goals.count()).toBe(backup.data.goals.length);
  });

  it('replace with a file lacking categories still leaves categories', async () => {
    const backup = await exportBackup();
    backup.data.categories = [];
    await importBackup(backup, 'replace');
    expect(await db.categories.count()).toBeGreaterThan(0);
  });

  it('keeps settings on import and re-seeds after clear all data', async () => {
    await settings.update({ theme: 'dark' });
    const backup = await exportBackup();
    await importBackup(backup, 'replace');
    expect((await settings.get()).theme).toBe('dark');

    await seedDemoData();
    await clearAllData();
    expect((await counts()).entries).toBe(0);
    expect((await counts()).categories).toBe(5);
    expect((await settings.get()).theme).toBe('system');
  });

  it('tolerates extra fields on the file and on rows', async () => {
    const backup = await exportBackup();
    const loose = {
      ...backup,
      extra: 1,
      data: {
        ...backup.data,
        futureTable: [],
        categories: backup.data.categories.map((c) => ({ ...c, realmId: 'x' })),
      },
    };
    const parsed = parseBackup(loose);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.backup.data.categories[0]).not.toHaveProperty('realmId');
  });
});

describe('parseBackup rejects garbage', () => {
  const good = () =>
    JSON.parse(
      JSON.stringify({
        app: 'myeats',
        backupVersion: 1,
        exportedAt: 'x',
        data: { ...buildDemoData(), categories: DEFAULT_CATEGORIES },
      }),
    );

  it.each([
    ['not json', '{nope'],
    ['null', null],
    ['an array', []],
    ['a string', '"hello"'],
    ['trakr file', { app: 'trakr', backupVersion: 1 }],
    ['missing app', { backupVersion: 1, data: {} }],
    ['wrong version', { app: 'myeats', backupVersion: 2, exportedAt: 'x', data: {} }],
    ['missing data', { app: 'myeats', backupVersion: 1, exportedAt: 'x' }],
  ])('%s', (_name, value) => {
    const r = parseBackup(value);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThan(0);
  });

  it('reports the path of a bad row', () => {
    const b = good();
    b.data.entries[3].date = 'yesterday';
    const r = parseBackup(b);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toContain('data.entries[3].date');
  });

  it('rejects bad nutrients, times and missing tables', () => {
    const b = good();
    b.data.foods[0].per100.kcal = 'lots';
    expect(parseBackup(b).ok).toBe(false);
    const c = good();
    c.data.categories[0].startsAt = '25:99';
    expect(parseBackup(c).ok).toBe(false);
    const d = good();
    delete d.data.weighIns;
    expect(parseBackup(d).ok).toBe(false);
  });

  it('writes nothing when invalid', async () => {
    const b = good();
    b.data.entries[0].date = 'bad';
    await expect(importBackup(b, 'replace')).rejects.toThrow(/entries\[0\]\.date/);
    expect(await db.categories.count()).toBe(5);
  });

  it('accepts a valid file and summarises it', () => {
    const r = parseBackup(JSON.stringify(good()));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.summary.counts.foods).toBe(11);
      expect(r.summary.dateRange).not.toBeNull();
    }
  });
});
