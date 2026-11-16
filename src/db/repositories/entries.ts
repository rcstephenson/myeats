import type { Entry, LastAmount } from '../../domain/types';
import { nowIso } from '../../lib/dates';
import { db } from '../schema';

/** What `undo` needs to reverse the last add / remove / clear. */
export type UndoRecord =
  | { kind: 'added'; ids: string[] }
  | { kind: 'removed'; entries: Entry[] }
  | { kind: 'cleared'; entries: Entry[] };

export type UsageTouch = {
  foods?: { id: string; lastAmount: LastAmount | null }[];
  recipes?: { id: string; lastAmount: LastAmount | null }[];
  mealId?: string;
};

/** Writes entries and bumps usage on the foods, recipes and meal in one transaction. */
export async function add(entries: Entry[], touch: UsageTouch = {}): Promise<UndoRecord> {
  await db.transaction('rw', [db.entries, db.foods, db.recipes, db.meals], async () => {
    const now = nowIso();
    await db.entries.bulkPut(entries);
    for (const t of touch.foods ?? []) {
      const f = await db.foods.get(t.id);
      if (!f) continue;
      await db.foods.update(t.id, {
        useCount: f.useCount + 1,
        lastUsedAt: now,
        ...(t.lastAmount ? { lastAmount: t.lastAmount } : {}),
      });
    }
    for (const t of touch.recipes ?? []) {
      const r = await db.recipes.get(t.id);
      if (!r) continue;
      await db.recipes.update(t.id, {
        useCount: r.useCount + 1,
        lastUsedAt: now,
        ...(t.lastAmount ? { lastAmount: t.lastAmount } : {}),
      });
    }
    if (touch.mealId) {
      const m = await db.meals.get(touch.mealId);
      if (m) await db.meals.update(m.id, { useCount: m.useCount + 1, lastUsedAt: now });
    }
  });
  return { kind: 'added', ids: entries.map((e) => e.id) };
}

export async function update(entry: Entry): Promise<void> {
  await db.entries.put({ ...entry, updatedAt: nowIso() });
}

export async function remove(ids: string[]): Promise<UndoRecord> {
  return db.transaction('rw', db.entries, async () => {
    const found = (await db.entries.bulkGet(ids)).filter((e): e is Entry => e !== undefined);
    await db.entries.bulkDelete(found.map((e) => e.id));
    return { kind: 'removed', entries: found } as const;
  });
}

export async function clearCategory(date: string, categoryId: string): Promise<UndoRecord> {
  return db.transaction('rw', db.entries, async () => {
    const found = await db.entries.where('[date+categoryId]').equals([date, categoryId]).toArray();
    await db.entries.bulkDelete(found.map((e) => e.id));
    return { kind: 'cleared', entries: found } as const;
  });
}

/** Reverses an add (deletes the entries) or a remove/clear (restores them). */
export async function undo(record: UndoRecord): Promise<void> {
  if (record.kind === 'added') await db.entries.bulkDelete(record.ids);
  else await db.entries.bulkPut(record.entries);
}

/** Entries for a date, by category order (archived included) then entry order. */
export async function forDay(date: string): Promise<Entry[]> {
  const [rows, cats] = await Promise.all([
    db.entries.where('date').equals(date).toArray(),
    db.categories.toArray(),
  ]);
  const catOrder = new Map(cats.map((c) => [c.id, c.order]));
  const rank = (e: Entry) => catOrder.get(e.categoryId) ?? Number.MAX_SAFE_INTEGER;
  return rows.sort((a, b) => rank(a) - rank(b) || a.order - b.order || a.id.localeCompare(b.id));
}

/** Entries with from <= date <= to (inclusive, YYYY-MM-DD). */
export function forRange(from: string, to: string): Promise<Entry[]> {
  return db.entries.where('date').between(from, to, true, true).toArray();
}

/** The next free order within a category for the day. */
export async function nextOrder(date: string, categoryId: string): Promise<number> {
  const rows = await db.entries.where('[date+categoryId]').equals([date, categoryId]).toArray();
  return rows.reduce((max, e) => Math.max(max, e.order), 0) + 1;
}
