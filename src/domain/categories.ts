import type { Category } from './types';

/** Sorted by `order` (stable); does not mutate the input. */
export function sortCategories(categories: readonly Category[]): Category[] {
  return [...categories].sort((a, b) => a.order - b.order);
}

/** Non-archived categories in display order. */
export function activeCategories(categories: readonly Category[]): Category[] {
  return sortCategories(categories.filter((c) => c.archivedAt === null));
}

/** Minutes after midnight for "HH:MM"; null when malformed. */
export function parseStartsAt(s: string | null): number | null {
  if (s === null) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/**
 * SPEC 4.6: the active category with the latest `startsAt` <= now (local time). Before the earliest
 * start (e.g. midnight), the last category (by order) with a start time. No start times: the first
 * active category. null only when there are no active categories.
 */
export function defaultCategory(now: Date, categories: readonly Category[]): Category | null {
  const active = activeCategories(categories);
  if (active.length === 0) return null;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const timed = active.flatMap((c) => {
    const at = parseStartsAt(c.startsAt);
    return at === null ? [] : [{ c, at }];
  });
  if (timed.length === 0) return active[0] ?? null;
  let best: { c: Category; at: number } | null = null;
  for (const t of timed) {
    if (t.at <= minutes && (best === null || t.at >= best.at)) best = t;
  }
  if (best) return best.c;
  return timed[timed.length - 1]?.c ?? null;
}
