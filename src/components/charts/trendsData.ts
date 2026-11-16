import { fromDateKey, toDateKey } from '../../lib/dates';
import { startOfWeek } from '../../lib/dates';

export const TREND_RANGES = ['4W', '12W', '26W'] as const;
export type TrendRange = (typeof TREND_RANGES)[number];

export function weeksFor(range: TrendRange): number {
  return range === '4W' ? 4 : range === '12W' ? 12 : 26;
}

/** Inclusive date-key window: Monday of the oldest week through `today`. */
export function trendWindow(range: TrendRange, today: string): { from: string; to: string } {
  const d = fromDateKey(today) ?? new Date();
  const monday = startOfWeek(d);
  monday.setDate(monday.getDate() - 7 * (weeksFor(range) - 1));
  return { from: toDateKey(monday), to: toDateKey(d) };
}

const monthDay = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** `Nov 10–16`, or `Oct 27–Nov 2` across months. */
export function weekLabel(weekStart: string, weekEnd: string): string {
  const s = fromDateKey(weekStart);
  const e = fromDateKey(weekEnd);
  if (!s || !e) return weekStart;
  const end = s.getMonth() === e.getMonth() ? String(e.getDate()) : monthDay(e);
  return `${monthDay(s)}–${end}`;
}
