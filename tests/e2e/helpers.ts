import { readFileSync } from 'node:fs';
import { expect, type Locator, type Page } from '@playwright/test';
import { buildFoodEntry } from '../../src/domain/entries';
import { EMPTY_NUTRIENTS } from '../../src/domain/types';
import type {
  Entry,
  Food,
  Goal,
  Nutrients,
  SavedMeal,
  Settings,
  UnitRef,
  WeighIn,
} from '../../src/domain/types';
import { toDateKey } from '../../src/lib/dates';

export const fixture = (path: string): string =>
  readFileSync(new URL(`../fixtures/${path}`, import.meta.url), 'utf8');

export function dateKey(daysAgo = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return toDateKey(d);
}

const NOW = new Date().toISOString();

export function nut(p: Partial<Nutrients> = {}): Nutrients {
  return { ...EMPTY_NUTRIENTS, ...p };
}

/** A custom food. Default: oats, 380 kcal / 100 g, "1 scoop" = 40 g. */
export function makeFood(p: Partial<Food> = {}): Food {
  const name = p.name ?? 'Rolled oats';
  return {
    id: `food-${name.toLowerCase().replace(/\W+/g, '-')}`,
    source: 'custom',
    sourceId: null,
    overrides: null,
    name,
    nameLower: name.toLowerCase(),
    brand: null,
    barcode: null,
    baseUnit: 'g',
    per100: nut({ kcal: 380, protein: 13, carbs: 67, fiber: 10, sugar: 1, fat: 7, satFat: 1.2, sodium: 5 }),
    servings: [{ id: 'sv1', label: '1 scoop', amount: 40 }],
    defaultServingId: null,
    lastAmount: null,
    useCount: 0,
    lastUsedAt: null,
    favoriteAt: null,
    deletedAt: null,
    fetchedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...p,
  };
}

export function makeGoal(p: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-1',
    effectiveFrom: '2020-01-01',
    kcal: 2000,
    protein: 150,
    netCarbs: 150,
    fat: 70,
    fiber: null,
    sugar: null,
    satFat: null,
    sodium: null,
    ...p,
  };
}

let seq = 0;
export function makeEntry(
  food: Food,
  p: { amount?: number; unit?: UnitRef; date?: string; categoryId?: string; order?: number } = {},
): Entry {
  seq += 1;
  return buildFoodEntry({
    food,
    amount: p.amount ?? 80,
    unit: p.unit ?? { kind: 'base' },
    date: p.date ?? dateKey(0),
    categoryId: p.categoryId ?? 'cat-breakfast',
    order: p.order ?? seq,
    now: NOW,
    id: `entry-${seq}-${food.id}`,
  });
}

export function makeMeal(p: Partial<SavedMeal> & Pick<SavedMeal, 'name' | 'items'>): SavedMeal {
  return {
    id: `meal-${p.name.toLowerCase().replace(/\W+/g, '-')}`,
    nameLower: p.name.toLowerCase(),
    defaultCategoryId: null,
    useCount: 0,
    lastUsedAt: null,
    favoriteAt: null,
    deletedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...p,
  };
}

export type Seed = {
  foods?: Food[];
  meals?: SavedMeal[];
  entries?: Entry[];
  goals?: Goal[];
  weighIns?: WeighIn[];
  settings?: Partial<Settings>;
};

// Regexes, not globs: **/openfoodfacts.org/** would not match world.openfoodfacts.org.
export const USDA_URL = /api\.nal\.usda\.gov/;
export const OFF_URL = /openfoodfacts\.org/;

/** Never hit the real APIs: aborts every USDA and Open Food Facts request unless a test routes it. */
export async function blockNetwork(page: Page): Promise<void> {
  await page.route(USDA_URL, (r) => r.abort());
  await page.route(OFF_URL, (r) => r.abort());
}

/**
 * Opens the app with the network blocked, the e2e test hook on and optional seed data written
 * straight into IndexedDB (raw writes are invisible to live queries, so it reloads afterwards).
 */
export async function openApp(page: Page, seed: Seed = {}, path = '/'): Promise<void> {
  await blockNetwork(page);
  await page.addInitScript(() => localStorage.setItem('myeats:e2e', '1'));
  await page.goto(path);
  await expect(page.getByRole('region', { name: 'Breakfast' }).first()).toBeVisible();
  const rows: Record<string, unknown[]> = {
    foods: seed.foods ?? [],
    meals: seed.meals ?? [],
    entries: seed.entries ?? [],
    goals: seed.goals ?? [],
    weighIns: seed.weighIns ?? [],
  };
  if (seed.settings) rows.settings = [{ key: 'app', theme: 'system', usdaApiKey: null, summaryMoreOpen: false, ...seed.settings }];
  if (Object.values(rows).every((r) => r.length === 0)) return;
  await page.evaluate(async (data) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('myeats');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    for (const [store, list] of Object.entries(data)) {
      if (list.length === 0) continue;
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        for (const row of list) tx.objectStore(store).put(row);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
    db.close();
  }, rows);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Breakfast' }).first()).toBeVisible();
}

export const searchBox = (page: Page): Locator => page.getByRole('searchbox', { name: 'Search foods' });
export const overlay = (page: Page): Locator => page.getByTestId('add-overlay');
export const section = (page: Page, name: string): Locator => page.getByRole('region', { name, exact: true });
export const plus = (page: Page, category: string): Locator =>
  page.getByRole('button', { name: `Add to ${category}` });
export const addButton = (page: Page): Locator => page.getByRole('button', { name: 'Add', exact: true });
