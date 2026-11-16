// Dev-only demo data generator. Entirely synthetic: no personal data. Every row's id starts with
// DEMO_PREFIX so `clearDemoData` can remove exactly what `seedDemoData` added.
import { db } from '../db/schema';
import { ensureSeeded } from '../db/seed';
import { buildFoodEntry, buildRecipeEntry } from '../domain/entries';
import {
  EMPTY_NUTRIENTS,
  type Entry,
  type Food,
  type Goal,
  type Nutrients,
  type Recipe,
  type SavedMeal,
  type WeighIn,
} from '../domain/types';
import { toDateKey } from '../lib/dates';

export const DEMO_PREFIX = 'demo-';
export const DEMO_DAYS = 42;

/** Small deterministic PRNG so demo data is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const n = (kcal: number, protein: number, carbs: number, fat: number, fiber = 0): Nutrients => ({
  ...EMPTY_NUTRIENTS,
  kcal,
  protein,
  carbs,
  fiber,
  sugar: Math.round(carbs * 0.2),
  fat,
  satFat: Math.round(fat * 0.3),
  sodium: Math.round(kcal * 0.8),
});

export interface DemoData {
  foods: Food[];
  recipes: Recipe[];
  meals: SavedMeal[];
  entries: Entry[];
  goals: Goal[];
  weighIns: WeighIn[];
}

function food(
  slug: string,
  name: string,
  per100: Nutrients,
  servings: { label: string; amount: number }[],
  now: string,
): Food {
  return {
    id: `${DEMO_PREFIX}food-${slug}`,
    source: 'custom',
    sourceId: null,
    overrides: null,
    name,
    nameLower: name.toLowerCase(),
    brand: null,
    barcode: null,
    baseUnit: 'g',
    per100,
    servings: servings.map((s, i) => ({ id: `s${i + 1}`, label: s.label, amount: s.amount })),
    defaultServingId: servings.length ? 's1' : null,
    lastAmount: null,
    useCount: 0,
    lastUsedAt: null,
    favoriteAt: null,
    deletedAt: null,
    fetchedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** Pure: builds the demo rows for the 6 weeks ending on `today`. */
export function buildDemoData(today: Date = new Date()): DemoData {
  const rand = mulberry32(20260101);
  const now = new Date().toISOString();

  const foods: Food[] = [
    food('oats', 'Rolled oats', n(379, 13, 67, 7, 10), [{ label: '1/2 cup', amount: 40 }], now),
    food('egg', 'Eggs, whole', n(143, 12.6, 0.7, 9.5), [{ label: '1 large', amount: 50 }], now),
    food(
      'yogurt',
      'Greek yogurt, plain',
      n(59, 10, 3.6, 0.4),
      [{ label: '1 cup', amount: 227 }],
      now,
    ),
    food(
      'chicken',
      'Chicken breast, cooked',
      n(165, 31, 0, 3.6),
      [{ label: '1 breast', amount: 172 }],
      now,
    ),
    food(
      'rice',
      'White rice, cooked',
      n(130, 2.7, 28, 0.3, 0.4),
      [{ label: '1 cup', amount: 158 }],
      now,
    ),
    food(
      'broccoli',
      'Broccoli, steamed',
      n(35, 2.4, 7.2, 0.4, 3.3),
      [{ label: '1 cup', amount: 156 }],
      now,
    ),
    food('almonds', 'Almonds', n(579, 21, 22, 50, 12.5), [{ label: '1 handful', amount: 28 }], now),
    food('banana', 'Banana', n(89, 1.1, 23, 0.3, 2.6), [{ label: '1 medium', amount: 118 }], now),
    food(
      'salmon',
      'Salmon fillet, baked',
      n(206, 22, 0, 12),
      [{ label: '1 fillet', amount: 154 }],
      now,
    ),
    food('olive-oil', 'Olive oil', n(884, 0, 0, 100), [{ label: '1 tbsp', amount: 14 }], now),
    food(
      'dark-choc',
      'Dark chocolate',
      n(598, 7.8, 46, 43, 11),
      [{ label: '1 square', amount: 10 }],
      now,
    ),
  ];
  const byId = new Map(foods.map((f) => [f.id, f]));
  const fid = (slug: string) => `${DEMO_PREFIX}food-${slug}`;

  const recipe: Recipe = {
    id: `${DEMO_PREFIX}recipe-bowl`,
    name: 'Chicken rice bowl',
    nameLower: 'chicken rice bowl',
    ingredients: [
      { foodId: fid('chicken'), amount: 344, unit: { kind: 'base' } },
      { foodId: fid('rice'), amount: 316, unit: { kind: 'base' } },
      { foodId: fid('broccoli'), amount: 312, unit: { kind: 'base' } },
      { foodId: fid('olive-oil'), amount: 14, unit: { kind: 'base' } },
    ],
    servingsPerBatch: 4,
    cookedWeightG: null,
    lastAmount: null,
    useCount: 0,
    lastUsedAt: null,
    favoriteAt: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const meal: SavedMeal = {
    id: `${DEMO_PREFIX}meal-breakfast`,
    name: 'Usual breakfast',
    nameLower: 'usual breakfast',
    items: [
      { kind: 'food', refId: fid('oats'), amount: 60, unit: { kind: 'base' } },
      { kind: 'food', refId: fid('banana'), amount: 1, unit: { kind: 'serving', servingId: 's1' } },
      { kind: 'food', refId: fid('almonds'), amount: 14, unit: { kind: 'base' } },
    ],
    defaultCategoryId: 'cat-breakfast',
    useCount: 0,
    lastUsedAt: null,
    favoriteAt: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const entries: Entry[] = [];
  const weighIns: WeighIn[] = [];
  let seq = 0;
  const day0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  for (let back = DEMO_DAYS - 1; back >= 0; back--) {
    const d = new Date(day0);
    d.setDate(day0.getDate() - back);
    const date = toDateKey(d);
    const stamp = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).toISOString();
    // A couple of unlogged days make the history look real.
    if (rand() < 0.06 && back > 0) continue;
    const orders: Record<string, number> = {};
    const base = (categoryId: string) => {
      orders[categoryId] = (orders[categoryId] ?? 0) + 1;
      seq += 1;
      return {
        id: `${DEMO_PREFIX}entry-${String(seq).padStart(5, '0')}`,
        date,
        categoryId,
        order: orders[categoryId],
        now: stamp,
      };
    };
    const g = (slug: string, categoryId: string, amount: number) =>
      entries.push(
        buildFoodEntry({
          food: byId.get(fid(slug))!,
          amount,
          unit: { kind: 'base' },
          ...base(categoryId),
        }),
      );
    const jitter = (v: number) => Math.round(v * (0.85 + rand() * 0.3));

    // Breakfast
    if (rand() < 0.5) {
      g('oats', 'cat-breakfast', jitter(60));
      g('banana', 'cat-breakfast', 118);
      g('almonds', 'cat-breakfast', jitter(14));
    } else {
      g('egg', 'cat-breakfast', jitter(150));
      g('yogurt', 'cat-breakfast', jitter(170));
    }
    // Lunch and dinner
    g('chicken', 'cat-lunch', jitter(150));
    g('rice', 'cat-lunch', jitter(150));
    g('broccoli', 'cat-lunch', jitter(120));
    if (rand() < 0.4) {
      entries.push(
        buildRecipeEntry({
          recipe,
          foods: byId,
          amount: 1,
          unit: { kind: 'serving', servingId: 'serving' },
          ...base('cat-dinner'),
        }),
      );
    } else {
      g('salmon', 'cat-dinner', jitter(150));
      g('broccoli', 'cat-dinner', jitter(150));
      g('olive-oil', 'cat-dinner', jitter(10));
    }
    // Snacks
    if (rand() < 0.7) g('dark-choc', 'cat-snacks', jitter(20));
    if (rand() < 0.5) g('almonds', 'cat-meal3', jitter(28));

    // Weigh in every third day, a gentle downward drift with noise.
    if (back % 3 === 0) {
      weighIns.push({
        id: `${DEMO_PREFIX}weigh-${date}`,
        date,
        weightLb:
          Math.round((178 - ((DEMO_DAYS - back) / DEMO_DAYS) * 4 + (rand() - 0.5) * 1.6) * 10) / 10,
        bodyFatPct: rand() < 0.5 ? Math.round((19 + (rand() - 0.5) * 1.5) * 10) / 10 : null,
        createdAt: stamp,
        updatedAt: stamp,
      });
    }
  }

  const goalDay = (back: number) => {
    const d = new Date(day0);
    d.setDate(day0.getDate() - back);
    return toDateKey(d);
  };
  const goals: Goal[] = [
    {
      id: `${DEMO_PREFIX}goal-1`,
      effectiveFrom: goalDay(DEMO_DAYS),
      kcal: 2200,
      protein: 150,
      netCarbs: 220,
      fat: 80,
      fiber: 30,
      sugar: null,
      satFat: null,
      sodium: 2300,
    },
    {
      id: `${DEMO_PREFIX}goal-2`,
      effectiveFrom: goalDay(DEMO_DAYS / 2),
      kcal: 2000,
      protein: 160,
      netCarbs: 160,
      fat: 80,
      fiber: 30,
      sugar: 50,
      satFat: 22,
      sodium: 2300,
    },
  ];

  return { foods, recipes: [recipe], meals: [meal], entries, goals, weighIns };
}

const isDemo = (id: string) => id.startsWith(DEMO_PREFIX);

/** Removes every demo row (and only those). Returns the number of entries removed. */
export async function clearDemoData(): Promise<{ entries: number }> {
  return db.transaction(
    'rw',
    [db.foods, db.recipes, db.meals, db.entries, db.goals, db.weighIns],
    async () => {
      const entryIds = (await db.entries.toCollection().primaryKeys()).filter(isDemo);
      await db.entries.bulkDelete(entryIds);
      for (const t of [db.foods, db.recipes, db.meals, db.goals, db.weighIns]) {
        const ids = (await t.toCollection().primaryKeys()).filter(isDemo);
        await t.bulkDelete(ids);
      }
      return { entries: entryIds.length };
    },
  );
}

/** Replaces any earlier demo data with a fresh set. Your own rows are never modified. */
export async function seedDemoData(): Promise<{ entries: number; foods: number }> {
  await ensureSeeded();
  await clearDemoData();
  const data = buildDemoData();
  await db.transaction(
    'rw',
    [db.foods, db.recipes, db.meals, db.entries, db.goals, db.weighIns],
    async () => {
      // goals.effectiveFrom and weighIns.date are unique: demo rows win a clash on those days.
      for (const g of data.goals)
        await db.goals.where('effectiveFrom').equals(g.effectiveFrom).delete();
      for (const w of data.weighIns) await db.weighIns.where('date').equals(w.date).delete();
      await db.foods.bulkPut(data.foods);
      await db.recipes.bulkPut(data.recipes);
      await db.meals.bulkPut(data.meals);
      await db.entries.bulkPut(data.entries);
      await db.goals.bulkPut(data.goals);
      await db.weighIns.bulkPut(data.weighIns);
    },
  );
  return { entries: data.entries.length, foods: data.foods.length };
}
