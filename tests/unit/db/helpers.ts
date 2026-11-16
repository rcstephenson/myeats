import type { Entry, Food, Nutrients, RemoteFood } from '../../../src/domain/types';
import { EMPTY_NUTRIENTS } from '../../../src/domain/types';
import { db } from '../../../src/db/schema';

export const N: Nutrients = { ...EMPTY_NUTRIENTS, kcal: 100 };

export function makeFood(over: Partial<Food> = {}): Food {
  return {
    id: 'f1',
    source: 'custom',
    sourceId: null,
    overrides: null,
    name: 'Oats',
    nameLower: 'oats',
    brand: null,
    barcode: null,
    baseUnit: 'g',
    per100: N,
    servings: [],
    defaultServingId: null,
    lastAmount: null,
    useCount: 0,
    lastUsedAt: null,
    favoriteAt: null,
    deletedAt: null,
    fetchedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

export function makeRemote(over: Partial<RemoteFood> = {}): RemoteFood {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = makeFood({
    source: 'usda',
    sourceId: '123',
    name: 'Apple',
    fetchedAt: '2026-01-01T00:00:00.000Z',
  });
  void _id;
  void _c;
  void _u;
  return { ...rest, dataType: 'Foundation', ...over };
}

export function makeEntry(over: Partial<Entry> = {}): Entry {
  return {
    id: 'e1',
    date: '2026-03-01',
    categoryId: 'cat-breakfast',
    order: 1,
    kind: 'food',
    refId: 'f1',
    name: 'Oats',
    brand: null,
    amount: 50,
    unitLabel: 'g',
    baseAmount: 50,
    snapshot: null,
    nutrients: N,
    kcalDerived: false,
    mealLogId: null,
    mealName: null,
    createdAt: '2026-03-01T08:00:00.000Z',
    updatedAt: '2026-03-01T08:00:00.000Z',
    ...over,
  };
}

export async function resetDb(): Promise<void> {
  await Promise.all(db.tables.map((t) => t.clear()));
}
