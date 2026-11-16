import type { SavedMeal } from '../../domain/types';
import { nowIso } from '../../lib/dates';
import { db } from '../schema';

export function get(id: string): Promise<SavedMeal | undefined> {
  return db.meals.get(id);
}

/** All non-deleted rows. */
export function list(): Promise<SavedMeal[]> {
  return db.meals.filter((r) => r.deletedAt === null).toArray();
}

/** Creates or updates; sets nameLower and updatedAt. */
export async function save(item: SavedMeal): Promise<SavedMeal> {
  const next: SavedMeal = { ...item, nameLower: item.name.toLowerCase(), updatedAt: nowIso() };
  await db.meals.put(next);
  return next;
}

export async function toggleFavorite(id: string): Promise<void> {
  await db.transaction('rw', db.meals, async () => {
    const r = await db.meals.get(id);
    if (!r) return;
    const now = nowIso();
    await db.meals.update(id, { favoriteAt: r.favoriteAt ? null : now, updatedAt: now });
  });
}

export async function softDelete(id: string): Promise<void> {
  const now = nowIso();
  await db.meals.update(id, { deletedAt: now, updatedAt: now });
}
