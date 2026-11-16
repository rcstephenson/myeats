import { goalFor } from './goals';
import { netCarbs, sumNutrients, type Totals } from './nutrients';
import { fromDateKey, startOfWeek, toDateKey } from '../lib/dates';
import type { Entry, Goal } from './types';

export type DayTotals = {
  date: string;
  entryCount: number;
  /** Summed entry nutrients (null as 0). */
  totals: Totals;
  /** Sum of per-entry net carbs, so it matches the entry rows. */
  netCarbs: number;
};

export type MetricKey = 'kcal' | 'protein' | 'netCarbs' | 'fat' | 'fiber';
export const WEEKLY_METRICS: readonly MetricKey[] = ['kcal', 'protein', 'netCarbs', 'fat', 'fiber'];

/** Totals for one day's entries. */
export function dayTotals(date: string, entries: readonly Entry[]): DayTotals {
  return {
    date,
    entryCount: entries.length,
    totals: sumNutrients(entries.map((e) => e.nutrients)),
    netCarbs: Math.round(entries.reduce((s, e) => s + netCarbs(e.nutrients), 0) * 1000) / 1000,
  };
}

/** Group entries by date and total each day. Days with no entries are absent. */
export function totalsByDate(entries: readonly Entry[]): Map<string, DayTotals> {
  const groups = new Map<string, Entry[]>();
  for (const e of entries) {
    const g = groups.get(e.date);
    if (g) g.push(e);
    else groups.set(e.date, [e]);
  }
  const out = new Map<string, DayTotals>();
  for (const [date, list] of groups) out.set(date, dayTotals(date, list));
  return out;
}

function metricOf(d: DayTotals, m: MetricKey): number {
  return m === 'netCarbs' ? d.netCarbs : d.totals[m];
}

/** Monday (YYYY-MM-DD) of the ISO week containing the date key; null when malformed. */
export function weekStartKey(dateKey: string): string | null {
  const d = fromDateKey(dateKey);
  return d ? toDateKey(startOfWeek(d)) : null;
}

function addDays(key: string, n: number): string {
  const d = fromDateKey(key);
  if (!d) throw new Error(`Bad date key ${key}`);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

export type WeekSummary = {
  /** Monday, YYYY-MM-DD. */
  weekStart: string;
  /** Sunday, YYYY-MM-DD. */
  weekEnd: string;
  /** Days with at least one entry (shown as `n/7`). */
  daysLogged: number;
  /** Averages over logged days only; null when no day was logged. */
  averages: Record<MetricKey, number> | null;
  /** True for target/max nutrients whose average exceeds the goal in effect (never for min). */
  overGoal: Record<MetricKey, boolean>;
};

const NO_FLAGS: Record<MetricKey, boolean> = {
  kcal: false,
  protein: false,
  netCarbs: false,
  fat: false,
  fiber: false,
};

/**
 * One summary per ISO week (Mon-Sun), newest first, for the `weeks` weeks ending with the week of
 * `today` (a date key). Goal flags use the goal in effect on the last logged day of the week.
 */
export function weeklySummaries(
  entries: readonly Entry[],
  goals: readonly Goal[],
  weeks: number,
  today: string,
): WeekSummary[] {
  const byDate = totalsByDate(entries);
  const thisWeek = weekStartKey(today);
  if (thisWeek === null) return [];
  const out: WeekSummary[] = [];
  for (let i = 0; i < weeks; i++) {
    const weekStart = addDays(thisWeek, -7 * i);
    const logged: DayTotals[] = [];
    for (let d = 0; d < 7; d++) {
      const day = byDate.get(addDays(weekStart, d));
      if (day && day.entryCount > 0) logged.push(day);
    }
    let averages: WeekSummary['averages'] = null;
    const overGoal = { ...NO_FLAGS };
    const last = logged[logged.length - 1];
    if (last) {
      const avg = {} as Record<MetricKey, number>;
      for (const m of WEEKLY_METRICS) {
        avg[m] = logged.reduce((s, day) => s + metricOf(day, m), 0) / logged.length;
      }
      averages = avg;
      const goal = goalFor(last.date, goals);
      if (goal) {
        overGoal.kcal = avg.kcal > goal.kcal;
        overGoal.netCarbs = avg.netCarbs > goal.netCarbs;
        overGoal.fat = avg.fat > goal.fat;
      }
    }
    out.push({
      weekStart,
      weekEnd: addDays(weekStart, 6),
      daysLogged: logged.length,
      averages,
      overGoal,
    });
  }
  return out;
}

export type DaySeriesPoint = {
  date: string;
  logged: boolean;
  /** null on days with no entries (chart gaps). */
  kcal: number | null;
  protein: number | null;
  netCarbs: number | null;
  fat: number | null;
  fiber: number | null;
  /** Goal in effect that day, for stepped goal lines. */
  goal: Goal | null;
};

/** One point per day from `from` to `to` inclusive (date keys). */
export function dailySeries(
  entries: readonly Entry[],
  goals: readonly Goal[],
  from: string,
  to: string,
): DaySeriesPoint[] {
  const byDate = totalsByDate(entries);
  const out: DaySeriesPoint[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const found = byDate.get(date);
    const day = found && found.entryCount > 0 ? found : null;
    out.push({
      date,
      logged: day !== null,
      kcal: day ? metricOf(day, 'kcal') : null,
      protein: day ? metricOf(day, 'protein') : null,
      netCarbs: day ? metricOf(day, 'netCarbs') : null,
      fat: day ? metricOf(day, 'fat') : null,
      fiber: day ? metricOf(day, 'fiber') : null,
      goal: goalFor(date, goals),
    });
  }
  return out;
}
