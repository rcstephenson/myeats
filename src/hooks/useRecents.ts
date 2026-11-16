import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import type { Food, Recipe, SavedMeal } from '../domain/types';

export type Recent =
  | { kind: 'food'; item: Food }
  | { kind: 'recipe'; item: Recipe }
  | { kind: 'meal'; item: SavedMeal };

/**
 * Up to `limit` distinct non-deleted foods, recipes and meals, most recently used first. A remote
 * food that has a live override is hidden in favour of the override (SPEC 3.10).
 */
export async function loadRecents(limit = 30): Promise<Recent[]> {
  const overridden = new Set<string>();
  await db.foods
    .filter((f) => f.deletedAt === null && f.overrides !== null)
    .each((f) => {
      if (f.overrides) overridden.add(f.overrides);
    });
  const used = <T extends { lastUsedAt: string | null; deletedAt: string | null }>(r: T) =>
    r.deletedAt === null && r.lastUsedAt !== null;
  const [foods, recipes, meals] = await Promise.all([
    db.foods
      .orderBy('lastUsedAt')
      .reverse()
      .filter((f) => used(f) && !(f.sourceId !== null && overridden.has(`${f.source}:${f.sourceId}`)))
      .limit(limit)
      .toArray(),
    db.recipes.orderBy('lastUsedAt').reverse().filter(used).limit(limit).toArray(),
    db.meals.orderBy('lastUsedAt').reverse().filter(used).limit(limit).toArray(),
  ]);
  const all: Recent[] = [
    ...foods.map((item) => ({ kind: 'food', item }) as const),
    ...recipes.map((item) => ({ kind: 'recipe', item }) as const),
    ...meals.map((item) => ({ kind: 'meal', item }) as const),
  ];
  all.sort((a, b) => (b.item.lastUsedAt ?? '').localeCompare(a.item.lastUsedAt ?? ''));
  return all.slice(0, limit);
}

export function useRecents(limit = 30): Recent[] | undefined {
  return useLiveQuery(() => loadRecents(limit), [limit]);
}
