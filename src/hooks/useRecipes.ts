import { useLiveQuery } from 'dexie-react-hooks';
import * as repo from '../db/repositories/recipes';
import type { Recipe } from '../domain/types';

/** Live non-deleted rows. */
export function useRecipes(): Recipe[] | undefined {
  return useLiveQuery(() => repo.list(), []);
}
