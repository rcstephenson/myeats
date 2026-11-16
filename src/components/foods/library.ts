import type { Food } from '../../domain/types';

/** Favourites first, then by name. */
export const byFavouriteThenName = (
  a: { favoriteAt: string | null; nameLower: string },
  b: { favoriteAt: string | null; nameLower: string },
): number =>
  Number(b.favoriteAt !== null) - Number(a.favoriteAt !== null) ||
  a.nameLower.localeCompare(b.nameLower);

/** Foods to list: remote originals replaced by a live override are hidden. */
export function visibleFoods(all: readonly Food[]): Food[] {
  const overridden = new Set<string>();
  for (const f of all) if (f.overrides) overridden.add(f.overrides);
  return all
    .filter((f) => f.source === 'custom' || !overridden.has(`${f.source}:${f.sourceId}`))
    .sort(byFavouriteThenName);
}
