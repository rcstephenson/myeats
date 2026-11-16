import { useLiveQuery } from 'dexie-react-hooks';
import * as entries from '../db/repositories/entries';
import type { Entry } from '../domain/types';

/** Live entries for a date, in category then entry order. `undefined` while loading. */
export function useDay(date: string): Entry[] | undefined {
  return useLiveQuery(() => entries.forDay(date), [date]);
}
