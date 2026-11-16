import { useLiveQuery } from 'dexie-react-hooks';
import * as weighIns from '../db/repositories/weighIns';
import type { WeighIn } from '../domain/types';

/** All weigh-ins, newest first. */
export function useWeighIns(): WeighIn[] | undefined {
  return useLiveQuery(() => weighIns.list(), []);
}
