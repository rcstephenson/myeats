import type { Goal } from '../../domain/types';
import { newId } from '../../lib/ids';
import { db } from '../schema';

export type GoalValues = Omit<Goal, 'id' | 'effectiveFrom'>;

/** Newest version first. */
export async function list(): Promise<Goal[]> {
  return (await db.goals.orderBy('effectiveFrom').toArray()).reverse();
}

/** The version in force on a date: greatest effectiveFrom <= date. */
export function forDate(date: string): Promise<Goal | undefined> {
  return db.goals.where('effectiveFrom').belowOrEqual(date).last();
}

/** Writes a version effective from today, replacing today's version if it already exists. */
export async function saveToday(values: GoalValues, today: string): Promise<Goal> {
  return db.transaction('rw', db.goals, async () => {
    const existing = await db.goals.where('effectiveFrom').equals(today).first();
    const goal: Goal = { ...values, id: existing?.id ?? newId(), effectiveFrom: today };
    await db.goals.put(goal);
    return goal;
  });
}
