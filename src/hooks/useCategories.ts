import { useLiveQuery } from 'dexie-react-hooks';
import * as categories from '../db/repositories/categories';
import type { Category } from '../domain/types';

export function useCategories(opts: { includeArchived?: boolean } = {}): Category[] | undefined {
  const includeArchived = opts.includeArchived ?? false;
  return useLiveQuery(() => categories.list({ includeArchived }), [includeArchived]);
}
