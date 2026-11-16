import type { WeighIn } from '../../domain/types';
import { newId } from '../../lib/ids';
import { nowIso } from '../../lib/dates';
import { db } from '../schema';

/** Newest date first. */
export async function list(): Promise<WeighIn[]> {
  return (await db.weighIns.orderBy('date').toArray()).reverse();
}

export function forDate(date: string): Promise<WeighIn | undefined> {
  return db.weighIns.where('date').equals(date).first();
}

/** One weigh-in per date: replaces today's when present. */
export async function saveToday(
  weightLb: number,
  bodyFatPct: number | null,
  today: string,
): Promise<WeighIn> {
  return db.transaction('rw', db.weighIns, async () => {
    const now = nowIso();
    const existing = await db.weighIns.where('date').equals(today).first();
    const row: WeighIn = existing
      ? { ...existing, weightLb, bodyFatPct, updatedAt: now }
      : { id: newId(), date: today, weightLb, bodyFatPct, createdAt: now, updatedAt: now };
    await db.weighIns.put(row);
    return row;
  });
}

/** Edits the values of a weigh-in; its date never changes. */
export async function update(id: string, weightLb: number, bodyFatPct: number | null): Promise<void> {
  await db.weighIns.update(id, { weightLb, bodyFatPct, updatedAt: nowIso() });
}

export async function remove(id: string): Promise<void> {
  await db.weighIns.delete(id);
}
