import type { Recipe } from '../../domain/types';
import { nowIso } from '../../lib/dates';
import { db } from '../schema';

export function get(id: string): Promise<Recipe | undefined> {
  return db.recipes.get(id);
}

/** All non-deleted rows. */
export function list(): Promise<Recipe[]> {
  return db.recipes.filter((r) => r.deletedAt === null).toArray();
}

/** Creates or updates; sets nameLower and updatedAt. */
export async function save(item: Recipe): Promise<Recipe> {
  const next: Recipe = { ...item, nameLower: item.name.toLowerCase(), updatedAt: nowIso() };
  await db.recipes.put(next);
  return next;
}

export async function toggleFavorite(id: string): Promise<void> {
  await db.transaction('rw', db.recipes, async () => {
    const r = await db.recipes.get(id);
    if (!r) return;
    const now = nowIso();
    await db.recipes.update(id, { favoriteAt: r.favoriteAt ? null : now, updatedAt: now });
  });
}

export async function softDelete(id: string): Promise<void> {
  const now = nowIso();
  await db.recipes.update(id, { deletedAt: now, updatedAt: now });
}
