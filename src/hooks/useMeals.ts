import { useLiveQuery } from 'dexie-react-hooks';
import * as repo from '../db/repositories/meals';
import type { SavedMeal } from '../domain/types';

/** Live non-deleted rows. */
export function useMeals(): SavedMeal[] | undefined {
  return useLiveQuery(() => repo.list(), []);
}
