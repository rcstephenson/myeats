import { DEFAULT_SETTINGS, type Category } from '../domain/types';
import { db } from './schema';

/** Fresh-install categories (SPEC §3.10.2). Fixed ids so two synced devices seed identical rows. */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-breakfast', name: 'Breakfast', order: 1, startsAt: '04:00', archivedAt: null },
  { id: 'cat-lunch', name: 'Lunch', order: 2, startsAt: '11:00', archivedAt: null },
  { id: 'cat-meal3', name: 'Meal 3', order: 3, startsAt: '14:30', archivedAt: null },
  { id: 'cat-dinner', name: 'Dinner', order: 4, startsAt: '17:30', archivedAt: null },
  { id: 'cat-snacks', name: 'Snacks / Other', order: 5, startsAt: '20:30', archivedAt: null },
];

/**
 * Writes the default categories (when there are none) and default settings (when missing).
 * Idempotent and safe to call concurrently. Returns true if it seeded categories.
 */
export async function ensureSeeded(): Promise<boolean> {
  return db.transaction('rw', db.categories, db.settings, async () => {
    if (!(await db.settings.get('app'))) await db.settings.put({ key: 'app', ...DEFAULT_SETTINGS });
    if ((await db.categories.count()) > 0) return false;
    await db.categories.bulkPut(DEFAULT_CATEGORIES);
    return true;
  });
}

/** Asks the browser not to evict our storage. Failures are ignored. */
export async function requestPersistentStorage(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Not supported or denied: nothing to do.
  }
}
