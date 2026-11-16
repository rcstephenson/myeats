// Pure Diary helpers: grouping, copy planning, labels. No React, no Dexie.
import { activeCategories } from '../../domain/categories';
import { cloneEntry } from '../../domain/entries';
import { sumNutrients } from '../../domain/nutrients';
import type { Category, Entry } from '../../domain/types';
import { fromDateKey, toDateKey } from '../../lib/dates';

export type Block =
  | { type: 'entry'; entry: Entry }
  | { type: 'group'; mealLogId: string; name: string; entries: Entry[]; kcal: number };

/**
 * Entries of one category in display order. Entries logged together from a saved meal
 * (same mealLogId) are gathered under one group at the position of the first of them.
 */
export function groupBlocks(entries: readonly Entry[]): Block[] {
  const sorted = [...entries].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const groups = new Map<string, Extract<Block, { type: 'group' }>>();
  const out: Block[] = [];
  for (const e of sorted) {
    if (e.mealLogId === null) {
      out.push({ type: 'entry', entry: e });
      continue;
    }
    let g = groups.get(e.mealLogId);
    if (!g) {
      g = { type: 'group', mealLogId: e.mealLogId, name: e.mealName ?? 'Meal', entries: [], kcal: 0 };
      groups.set(e.mealLogId, g);
      out.push(g);
    }
    g.entries.push(e);
    g.kcal += e.nutrients.kcal ?? 0;
  }
  return out;
}

/** Active categories; plus archived ones that have entries on the day (their entries stay visible). */
export function visibleCategories(all: readonly Category[], entries: readonly Entry[]): Category[] {
  const used = new Set(entries.map((e) => e.categoryId));
  const archived = all
    .filter((c) => c.archivedAt !== null && used.has(c.id))
    .sort((a, b) => a.order - b.order);
  return [...activeCategories(all), ...archived].sort((a, b) => a.order - b.order);
}

export function categoryKcal(entries: readonly Entry[]): number {
  return sumNutrients(entries.map((e) => e.nutrients)).kcal;
}

/**
 * Clone entries into a target category/day with new ids, original snapshots and consecutive
 * orders from `startOrder`. Entries that shared a meal log keep sharing one (new) id.
 */
export function planCopy(
  source: readonly Entry[],
  target: { date: string; categoryId: string; startOrder: number; now: string },
  newId: () => string,
): Entry[] {
  const logIds = new Map<string, string>();
  return [...source]
    .sort((a, b) => a.order - b.order)
    .map((e, i) => {
      let mealLogId: string | null = null;
      if (e.mealLogId !== null) {
        mealLogId = logIds.get(e.mealLogId) ?? newId();
        logIds.set(e.mealLogId, mealLogId);
      }
      return cloneEntry(e, {
        id: newId(),
        date: target.date,
        categoryId: target.categoryId,
        order: target.startOrder + i,
        now: target.now,
        mealLogId,
      });
    });
}

/** Each macro's share of calories eaten (P/C 4 kcal per g, F 9), as whole-number percentages. */
export function macroShares(
  kcal: number,
  protein: number,
  netCarbs: number,
  fat: number,
): { protein: number; carbs: number; fat: number } {
  if (!(kcal > 0)) return { protein: 0, carbs: 0, fat: 0 };
  const pct = (kcalFromMacro: number) => Math.round((kcalFromMacro / kcal) * 100);
  return { protein: pct(protein * 4), carbs: pct(netCarbs * 4), fat: pct(fat * 9) };
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;

/** "MON 16 NOV" for a date key; the key itself when malformed. */
export function shortDateLabel(date: string): string {
  const d = fromDateKey(date);
  if (!d) return date;
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Date key `n` days from `date` (negative for earlier). */
export function shiftDate(date: string, n: number): string {
  const d = fromDateKey(date);
  if (!d) return date;
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}
