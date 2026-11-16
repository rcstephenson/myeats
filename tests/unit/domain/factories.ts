import {
  EMPTY_NUTRIENTS,
  type Category,
  type Entry,
  type Food,
  type Goal,
  type Nutrients,
  type Recipe,
  type SavedMeal,
} from '../../../src/domain/types';

export const NOW = '2026-11-16T12:00:00.000Z';

export function nut(p: Partial<Nutrients> = {}): Nutrients {
  return { ...EMPTY_NUTRIENTS, ...p };
}

export function food(p: Partial<Food> = {}): Food {
  const name = p.name ?? 'Oats';
  return {
    id: 'f1',
    source: 'custom',
    sourceId: null,
    overrides: null,
    name,
    nameLower: name.toLowerCase(),
    brand: null,
    barcode: null,
    baseUnit: 'g',
    per100: nut({
      kcal: 380,
      protein: 13,
      carbs: 67,
      fiber: 10,
      sugar: 1,
      fat: 7,
      satFat: 1.2,
      sodium: 5,
    }),
    servings: [{ id: 's1', label: '1 scoop', amount: 40 }],
    defaultServingId: 's1',
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

export function recipe(p: Partial<Recipe> = {}): Recipe {
  return {
    id: 'r1',
    name: 'Porridge',
    nameLower: 'porridge',
    ingredients: [{ foodId: 'f1', amount: 100, unit: { kind: 'base' } }],
    servingsPerBatch: 2,
    cookedWeightG: null,
    lastAmount: null,
    useCount: 0,
    lastUsedAt: null,
    favoriteAt: null,
    deletedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...p,
  };
}

export function meal(p: Partial<SavedMeal> = {}): SavedMeal {
  return {
    id: 'm1',
    name: 'Usual breakfast',
    nameLower: 'usual breakfast',
    items: [],
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

export function goal(p: Partial<Goal> = {}): Goal {
  return {
    id: 'g1',
    effectiveFrom: '2026-01-01',
    kcal: 2400,
    protein: 180,
    netCarbs: 220,
    fat: 80,
    fiber: 35,
    sugar: null,
    satFat: null,
    sodium: null,
    ...p,
  };
}

export function category(p: Partial<Category> = {}): Category {
  return { id: 'c1', name: 'Breakfast', order: 1, startsAt: null, archivedAt: null, ...p };
}

export const DEFAULT_CATEGORIES: Category[] = [
  category({ id: 'b', name: 'Breakfast', order: 1, startsAt: '04:00' }),
  category({ id: 'l', name: 'Lunch', order: 2, startsAt: '11:00' }),
  category({ id: 'm3', name: 'Meal 3', order: 3, startsAt: '14:30' }),
  category({ id: 'd', name: 'Dinner', order: 4, startsAt: '17:30' }),
  category({ id: 's', name: 'Snacks', order: 5, startsAt: '20:30' }),
];

export function entry(p: Partial<Entry> = {}): Entry {
  return {
    id: 'e1',
    date: '2026-11-16',
    categoryId: 'b',
    order: 0,
    kind: 'quick',
    refId: null,
    name: 'Quick add',
    brand: null,
    amount: null,
    unitLabel: null,
    baseAmount: null,
    snapshot: null,
    nutrients: nut({ kcal: 500, protein: 30, carbs: 50, fiber: 5, fat: 20 }),
    kcalDerived: false,
    mealLogId: null,
    mealName: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...p,
  };
}
