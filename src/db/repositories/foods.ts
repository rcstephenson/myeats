import type { Food, RemoteFood } from '../../domain/types';
import { newId } from '../../lib/ids';
import { nowIso } from '../../lib/dates';
import { db } from '../schema';

export function get(id: string): Promise<Food | undefined> {
  return db.foods.get(id);
}

/** All non-deleted foods (custom, overrides and cached remote). */
export function list(): Promise<Food[]> {
  return db.foods.filter((f) => f.deletedAt === null).toArray();
}

/** Creates or updates a food; sets nameLower and updatedAt. */
export async function save(food: Food): Promise<Food> {
  const next: Food = { ...food, nameLower: food.name.toLowerCase(), updatedAt: nowIso() };
  await db.foods.put(next);
  return next;
}

/**
 * Stores a remote (usda/off) food keyed on source+sourceId. An existing row keeps its id, usage,
 * favourite and last amount; nutrition and descriptive fields are refreshed.
 */
export async function upsertRemote(remote: RemoteFood): Promise<Food> {
  const { dataType: _dataType, ...rest } = remote;
  void _dataType;
  return db.transaction('rw', db.foods, async () => {
    const now = nowIso();
    const existing =
      remote.sourceId === null
        ? undefined
        : await db.foods
            .where('sourceId')
            .equals(remote.sourceId)
            .filter((f) => f.source === remote.source && f.overrides === null)
            .first();
    const next: Food = existing
      ? {
          ...rest,
          id: existing.id,
          nameLower: remote.name.toLowerCase(),
          lastAmount: existing.lastAmount,
          useCount: existing.useCount,
          lastUsedAt: existing.lastUsedAt,
          favoriteAt: existing.favoriteAt,
          deletedAt: existing.deletedAt,
          defaultServingId: existing.defaultServingId ?? remote.defaultServingId,
          createdAt: existing.createdAt,
          updatedAt: now,
        }
      : { ...rest, id: newId(), nameLower: remote.name.toLowerCase(), createdAt: now, updatedAt: now };
    await db.foods.put(next);
    return next;
  });
}

/** Non-deleted food for a barcode: an override first, then any other match. */
export async function byBarcode(gtin: string): Promise<Food | undefined> {
  const matches = await db.foods
    .where('barcode')
    .equals(gtin)
    .filter((f) => f.deletedAt === null)
    .toArray();
  return matches.find((f) => f.overrides !== null) ?? matches[0];
}

/** The live override for a remote food, key "usda:<fdcId>" or "off:<barcode>". */
export function byOverrideKey(key: string): Promise<Food | undefined> {
  return db.foods
    .where('overrides')
    .equals(key)
    .filter((f) => f.deletedAt === null)
    .first();
}

export function overrideKeyOf(original: Pick<Food, 'source' | 'sourceId'>): string | null {
  if (original.source === 'custom' || original.sourceId === null) return null;
  return `${original.source}:${original.sourceId}`;
}

/**
 * Saves edits to a remote food as a custom food that overrides it. Reuses the existing override
 * when there is one. The cached original is never touched.
 */
export async function saveOverride(original: Food, edits: Partial<Food>): Promise<Food> {
  const key = overrideKeyOf(original);
  if (key === null) throw new Error('Only usda/off foods can be overridden');
  return db.transaction('rw', db.foods, async () => {
    const now = nowIso();
    const existing = await byOverrideKey(key);
    const base: Food = existing ?? {
      ...original,
      id: newId(),
      source: 'custom',
      sourceId: null,
      overrides: key,
      fetchedAt: null,
      useCount: 0,
      lastUsedAt: null,
      lastAmount: null,
      favoriteAt: original.favoriteAt,
      deletedAt: null,
      createdAt: now,
    };
    const merged: Food = {
      ...base,
      ...edits,
      id: base.id,
      source: 'custom',
      sourceId: null,
      overrides: key,
      createdAt: base.createdAt,
    };
    const next = { ...merged, nameLower: merged.name.toLowerCase(), updatedAt: now };
    await db.foods.put(next);
    return next;
  });
}

export async function toggleFavorite(id: string): Promise<void> {
  await db.transaction('rw', db.foods, async () => {
    const f = await db.foods.get(id);
    if (!f) return;
    const now = nowIso();
    await db.foods.update(id, { favoriteAt: f.favoriteAt ? null : now, updatedAt: now });
  });
}

export async function softDelete(id: string): Promise<void> {
  const now = nowIso();
  await db.foods.update(id, { deletedAt: now, updatedAt: now });
}
