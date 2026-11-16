import Dexie, { type EntityTable } from 'dexie';
import dexieCloud from 'dexie-cloud-addon';
import { CLOUD_URL, UNSYNCED_TABLES } from '../lib/cloud';
import type {
  Category,
  Entry,
  Food,
  Goal,
  Recipe,
  SavedMeal,
  SearchCacheRow,
  Settings,
  WeighIn,
} from '../domain/types';

/** The single settings row, keyed by `app`. */
export type StoredSettings = Partial<Settings> & { key: 'app' };

export class MyEatsDB extends Dexie {
  foods!: EntityTable<Food, 'id'>;
  recipes!: EntityTable<Recipe, 'id'>;
  meals!: EntityTable<SavedMeal, 'id'>;
  entries!: EntityTable<Entry, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  goals!: EntityTable<Goal, 'id'>;
  weighIns!: EntityTable<WeighIn, 'id'>;
  settings!: EntityTable<StoredSettings, 'key'>;
  searchCache!: EntityTable<SearchCacheRow, 'key'>;

  constructor(name = 'myeats', cloudUrl: string | null = CLOUD_URL) {
    // The addon is only attached when a database URL is configured; otherwise `db.cloud` does
    // not exist and nothing touches the network.
    super(name, cloudUrl ? { addons: [dexieCloud] } : undefined);
    // Never edit a released version in place: add version(2) with an upgrade instead.
    // IndexedDB cannot index booleans: favourites and deletes are nullable timestamps.
    this.version(1).stores({
      foods: 'id, source, sourceId, barcode, overrides, nameLower, lastUsedAt, favoriteAt, deletedAt',
      recipes: 'id, nameLower, lastUsedAt, favoriteAt, deletedAt',
      meals: 'id, nameLower, lastUsedAt, favoriteAt, deletedAt',
      entries: 'id, date, [date+categoryId], refId, mealLogId',
      categories: 'id, order',
      goals: 'id, &effectiveFrom',
      weighIns: 'id, &date',
      settings: 'key',
      searchCache: 'key, fetchedAt',
    });

    if (cloudUrl) {
      this.cloud.configure({
        databaseUrl: cloudUrl,
        // Local-first: the app works signed out; sign-in is opt-in from Settings.
        requireAuth: false,
        // Keep the IndexedDB name 'myeats' (the addon would otherwise rename it).
        nameSuffix: false,
        unsyncedTables: UNSYNCED_TABLES,
        tryUseServiceWorker: false,
      });
    }
  }
}

export const db = new MyEatsDB();
