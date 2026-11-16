// Pure assembly of the Add overlay's result lists (no React, no Dexie).
import type { Recent } from '../../hooks/useRecents';
import type { SearchHit } from '../../domain/search';
import { sumNutrients } from '../../domain/nutrients';
import { formatKcal } from '../../domain/units';
import type { Food, MealItem, Nutrients, Recipe, RemoteFood, SavedMeal } from '../../domain/types';
import type { SourceTag } from '../ui/ResultRow';
import {
  defaultFoodAmount,
  defaultRecipeAmount,
  describeAmount,
  foodSnap,
  previewNutrients,
  recipeSnap,
  type Snap,
} from './amounts';

export type ResultRef =
  | { kind: 'food'; item: Food }
  | { kind: 'recipe'; item: Recipe }
  | { kind: 'meal'; item: SavedMeal };

export type RowModel = {
  key: string;
  ref: ResultRef;
  name: string;
  brand?: string;
  tag?: SourceTag;
  amount: string;
  kcal: string;
};

export type Lookups = {
  foods: ReadonlyMap<string, Food>;
  recipes: ReadonlyMap<string, Recipe>;
};

export function toMap<T extends { id: string }>(list: readonly T[]): Map<string, T> {
  return new Map(list.map((x) => [x.id, x]));
}

const kcalText = (n: number | null): string => `${formatKcal(n ?? 0)} kcal`;

export type MealLine = {
  item: MealItem;
  name: string;
  snap: Snap;
  /** Units are fixed for a meal log; only the amount is editable. */
  unitText: string;
};

/** Resolve a meal's items against current foods and recipes; missing ones are reported. */
export function resolveMeal(
  meal: SavedMeal,
  lookups: Lookups,
): { lines: MealLine[]; missing: number } {
  const lines: MealLine[] = [];
  let missing = 0;
  for (const item of meal.items) {
    let name: string;
    let snap: Snap | null;
    if (item.kind === 'food') {
      const food = lookups.foods.get(item.refId);
      name = food?.name ?? '';
      snap = food && food.deletedAt === null ? foodSnap(food) : null;
    } else {
      const recipe = lookups.recipes.get(item.refId);
      name = recipe?.name ?? '';
      snap = recipe && recipe.deletedAt === null ? recipeSnap(recipe, lookups.foods) : null;
    }
    const text = snap ? describeAmount(snap, { amount: 1, unit: item.unit }) : null;
    if (!snap || text === null) {
      missing += 1;
      continue;
    }
    // "1 scoop" -> "scoop": the unit text without the amount.
    lines.push({ item, name, snap, unitText: text.replace(/^[\d.]+\s+/, '') });
  }
  return { lines, missing };
}

export function mealTotal(meal: SavedMeal, lookups: Lookups): Nutrients | null {
  const { lines } = resolveMeal(meal, lookups);
  if (lines.length === 0) return null;
  const parts = lines.flatMap((l) => {
    const p = previewNutrients(l.snap, l.item.amount, l.item.unit);
    return p ? [p.nutrients] : [];
  });
  return sumNutrients(parts);
}

export function rowFor(ref: ResultRef, lookups: Lookups): RowModel {
  if (ref.kind === 'food') {
    const f = ref.item;
    const snap = foodSnap(f);
    const a = defaultFoodAmount(f);
    const preview = previewNutrients(snap, a.amount, a.unit);
    const tag: SourceTag | undefined =
      f.source === 'usda' ? 'USDA' : f.source === 'off' ? 'OFF' : undefined;
    return {
      key: `food:${f.id}`,
      ref,
      name: f.name,
      brand: f.brand ?? undefined,
      tag,
      amount: describeAmount(snap, a) ?? '',
      kcal: kcalText(preview?.nutrients.kcal ?? null),
    };
  }
  if (ref.kind === 'recipe') {
    const r = ref.item;
    const snap = recipeSnap(r, lookups.foods);
    const a = defaultRecipeAmount(r);
    const preview = snap ? previewNutrients(snap, a.amount, a.unit) : null;
    return {
      key: `recipe:${r.id}`,
      ref,
      name: r.name,
      tag: 'RECIPE',
      amount: snap ? (describeAmount(snap, a) ?? '') : '',
      kcal: kcalText(preview?.nutrients.kcal ?? null),
    };
  }
  const m = ref.item;
  const total = mealTotal(m, lookups);
  return {
    key: `meal:${m.id}`,
    ref,
    name: m.name,
    tag: 'MEAL',
    amount: `${m.items.length} ${m.items.length === 1 ? 'item' : 'items'}`,
    kcal: kcalText(total?.kcal ?? null),
  };
}

export function rowsForHits(hits: readonly SearchHit[], lookups: Lookups): RowModel[] {
  return hits.map((h) => rowFor({ kind: h.kind, item: h.item } as ResultRef, lookups));
}

export function rowsForRecents(recents: readonly Recent[], lookups: Lookups): RowModel[] {
  return recents.map((r) => rowFor({ kind: r.kind, item: r.item } as ResultRef, lookups));
}

export type ChipKey = 'recent' | 'favourites' | 'meals' | 'recipes';

const byName = (a: { name: string }, b: { name: string }): number => a.name.localeCompare(b.name);
const byUsed = (a: { lastUsedAt: string | null; name: string }, b: typeof a): number =>
  (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? '') || byName(a, b);

/** Foods hidden because a custom override replaces them (SPEC 4.2). */
function visibleFoods(foods: readonly Food[]): Food[] {
  const overridden = new Set<string>();
  for (const f of foods) if (f.overrides && f.deletedAt === null) overridden.add(f.overrides);
  return foods.filter(
    (f) =>
      f.deletedAt === null &&
      !(f.source !== 'custom' && f.sourceId !== null && overridden.has(`${f.source}:${f.sourceId}`)),
  );
}

/** Refs for the favourites / meals / recipes chips (recents come from useRecents). */
export function refsForChip(
  chip: Exclude<ChipKey, 'recent'>,
  data: { foods: readonly Food[]; recipes: readonly Recipe[]; meals: readonly SavedMeal[] },
): ResultRef[] {
  const meals = data.meals.filter((m) => m.deletedAt === null);
  const recipes = data.recipes.filter((r) => r.deletedAt === null);
  if (chip === 'meals') {
    return [...meals].sort(byUsed).map((item) => ({ kind: 'meal', item }));
  }
  if (chip === 'recipes') {
    return [...recipes].sort(byUsed).map((item) => ({ kind: 'recipe', item }));
  }
  const fav = <T extends { favoriteAt: string | null }>(l: T[]): T[] => l.filter((x) => x.favoriteAt);
  return [
    ...fav(visibleFoods(data.foods)).map((item) => ({ kind: 'food', item }) as ResultRef),
    ...fav(recipes).map((item) => ({ kind: 'recipe', item }) as ResultRef),
    ...fav(meals).map((item) => ({ kind: 'meal', item }) as ResultRef),
  ].sort((a, b) => byName(a.item, b.item));
}

/**
 * Remote results minus the ones already local: same source+sourceId as a stored food, or replaced
 * by an override (SPEC 3.2).
 */
export function dedupeRemote(remote: readonly RemoteFood[], local: readonly Food[]): RemoteFood[] {
  const known = new Set<string>();
  for (const f of local) {
    if (f.source !== 'custom' && f.sourceId !== null) known.add(`${f.source}:${f.sourceId}`);
    if (f.overrides) known.add(f.overrides);
  }
  return remote.filter((r) => r.sourceId === null || !known.has(`${r.source}:${r.sourceId}`));
}

/** Result row for a remote food, with the amount a first log would default to. */
export function remoteRow(remote: RemoteFood, cached: boolean): Omit<RowModel, 'ref' | 'key'> & {
  key: string;
  remote: RemoteFood;
} {
  const snap: Snap = { baseUnit: remote.baseUnit, per100: remote.per100, servings: remote.servings };
  const first = remote.servings.find((s) => s.id === remote.defaultServingId);
  const a = first
    ? { amount: 1, unit: { kind: 'serving', servingId: first.id } as const }
    : { amount: 100, unit: { kind: 'base' } as const };
  const preview = previewNutrients(snap, a.amount, a.unit);
  return {
    key: `remote:${remote.source}:${remote.sourceId ?? remote.name}`,
    remote,
    name: remote.name,
    brand: remote.brand ?? undefined,
    tag: cached ? 'CACHED' : remote.source === 'off' ? 'OFF' : 'USDA',
    amount: describeAmount(snap, a) ?? '',
    kcal: kcalText(preview?.nutrients.kcal ?? null),
  };
}
