import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { describeKeyTestError } from '../../../src/components/settings/SettingsSections';
import { db } from '../../../src/db/schema';
import { ensureSeeded } from '../../../src/db/seed';
import { buildDemoData, clearDemoData, seedDemoData } from '../../../src/dev/demoData';
import { OfflineError, RateLimitError, SourceError } from '../../../src/sources/errors';
import { resetDb } from '../db/helpers';

beforeEach(async () => {
  await resetDb();
  await ensureSeeded();
});

describe('describeKeyTestError', () => {
  it('explains rate limits, offline and rejected keys', () => {
    expect(describeKeyTestError(new RateLimitError())).toMatch(/429/);
    expect(describeKeyTestError(new OfflineError())).toMatch(/offline/i);
    expect(describeKeyTestError(new SourceError('x', 403))).toMatch(/rejected/);
    expect(describeKeyTestError(new SourceError('boom'))).toContain('boom');
  });
});

describe('demo data', () => {
  it('is deterministic, plausible and has no duplicate ids', () => {
    const a = buildDemoData(new Date(2026, 5, 15));
    const b = buildDemoData(new Date(2026, 5, 15));
    expect(a.entries.map((e) => e.id)).toEqual(b.entries.map((e) => e.id));
    expect(new Set(a.entries.map((e) => e.id)).size).toBe(a.entries.length);
    expect(a.goals).toHaveLength(2);
    expect(a.recipes).toHaveLength(1);
    expect(a.meals).toHaveLength(1);
    expect(a.weighIns.length).toBeGreaterThan(10);
  });

  it('seeds and clears only demo rows', async () => {
    await seedDemoData();
    await seedDemoData();
    expect(await db.goals.count()).toBe(2);
    expect(await db.entries.count()).toBeGreaterThan(50);
    await clearDemoData();
    expect(await db.entries.count()).toBe(0);
    expect(await db.foods.count()).toBe(0);
  });
});
