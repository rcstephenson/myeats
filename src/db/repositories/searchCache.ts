import type { RemoteFood, SearchCacheRow } from '../../domain/types';
import { nowIso } from '../../lib/dates';
import { db } from '../schema';

export const MAX_ROWS = 300;

export function get(key: string): Promise<SearchCacheRow | undefined> {
  return db.searchCache.get(key);
}

/** Stores results for a key and keeps only the newest 300 rows. */
export async function put(
  key: string,
  results: RemoteFood[],
  fetchedAt: string = nowIso(),
): Promise<void> {
  await db.transaction('rw', db.searchCache, async () => {
    await db.searchCache.put({ key, results, fetchedAt });
    const over = (await db.searchCache.count()) - MAX_ROWS;
    if (over > 0) {
      const oldest = await db.searchCache.orderBy('fetchedAt').limit(over).primaryKeys();
      await db.searchCache.bulkDelete(oldest);
    }
  });
}
