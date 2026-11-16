import { useLiveQuery } from 'dexie-react-hooks';
import * as repo from '../db/repositories/foods';
import type { Food } from '../domain/types';

/** Live non-deleted rows. */
export function useFoods(): Food[] | undefined {
  return useLiveQuery(() => repo.list(), []);
}
