import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import * as entriesRepo from '../../db/repositories/entries';
import { dailySeries, weeklySummaries } from '../../domain/weekly';
import { useGoals } from '../../hooks/useGoals';
import { useToday } from '../../hooks/useToday';
import { trendWindow, weeksFor, type TrendRange } from '../charts/trendsData';

/** Entries for the range plus derived weekly summaries and daily series; undefined while loading. */
export function useTrends(range: TrendRange) {
  const today = useToday();
  const goals = useGoals();
  const { from, to } = useMemo(() => trendWindow(range, today), [range, today]);
  const entries = useLiveQuery(() => entriesRepo.forRange(from, to), [from, to]);
  return useMemo(() => {
    if (!entries || !goals) return undefined;
    return {
      weeks: weeklySummaries(entries, goals, weeksFor(range), today),
      series: dailySeries(entries, goals, from, to),
      hasEntries: entries.length > 0,
    };
  }, [entries, goals, range, today, from, to]);
}
