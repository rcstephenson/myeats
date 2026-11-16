import { fromDateKey, toDateKey } from '../../lib/dates';
import type { WeighIn } from '../../domain/types';

export const WEIGHT_RANGES = ['1M', '3M', '1Y', 'All'] as const;
export type WeightRange = (typeof WEIGHT_RANGES)[number];

/** First date key (inclusive) shown for a range ending on `today`; null for All. */
export function weightRangeStart(range: WeightRange, today: string): string | null {
  if (range === 'All') return null;
  const d = fromDateKey(today);
  if (!d) return null;
  if (range === '1Y') d.setFullYear(d.getFullYear() - 1);
  else d.setMonth(d.getMonth() - (range === '1M' ? 1 : 3));
  return toDateKey(d);
}

/** Weigh-ins inside the range, oldest first (chart order). Accepts any input order. */
export function filterWeighIns(
  weighIns: readonly WeighIn[],
  range: WeightRange,
  today: string,
): WeighIn[] {
  const start = weightRangeStart(range, today);
  return weighIns
    .filter((w) => (start === null || w.date >= start) && w.date <= today)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Padded [min, max] for the lb axis, rounded outward to whole lb; null with no values. */
export function weightDomain(values: readonly number[]): [number, number] | null {
  if (values.length === 0) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max((hi - lo) * 0.15, 1);
  return [Math.floor(lo - pad), Math.ceil(hi + pad)];
}

/** Change in lb from the previous (older) weigh-in, keyed by id. Null for the oldest. */
export function changesFromPrevious(weighIns: readonly WeighIn[]): Map<string, number | null> {
  const asc = [...weighIns].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const out = new Map<string, number | null>();
  asc.forEach((w, i) => {
    out.set(w.id, i === 0 ? null : Math.round((w.weightLb - asc[i - 1].weightLb) * 10) / 10);
  });
  return out;
}

/** `−0.6`, `+1.2`, `0.0` with a real minus sign. */
export function formatChange(delta: number): string {
  const r = Math.round(delta * 10) / 10;
  if (r === 0) return '0.0';
  return `${r < 0 ? '−' : '+'}${Math.abs(r).toFixed(1)}`;
}
