import { useLiveQuery } from 'dexie-react-hooks';
import * as goals from '../db/repositories/goals';
import type { Goal } from '../domain/types';

/** Goal version in force on a date. `undefined` while loading or when none exists. */
export function useGoalFor(date: string): Goal | undefined {
  return useLiveQuery(() => goals.forDate(date), [date]);
}
