import { useLiveQuery } from 'dexie-react-hooks';
import * as goals from '../db/repositories/goals';
import type { Goal } from '../domain/types';

/** All goal versions, newest first. */
export function useGoals(): Goal[] | undefined {
  return useLiveQuery(() => goals.list(), []);
}
