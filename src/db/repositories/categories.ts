import type { Category } from '../../domain/types';
import { newId } from '../../lib/ids';
import { db } from '../schema';

/** Categories by order; archived ones only when asked. */
export async function list(opts: { includeArchived?: boolean } = {}): Promise<Category[]> {
  const all = await db.categories.orderBy('order').toArray();
  return opts.includeArchived ? all : all.filter((c) => c.archivedAt === null);
}

export async function rename(id: string, name: string): Promise<void> {
  await db.categories.update(id, { name });
}

/** Sets order 1..n following the given ids; ids not listed keep their place after them. */
export async function reorder(ids: string[]): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    const all = await db.categories.orderBy('order').toArray();
    const rest = all.filter((c) => !ids.includes(c.id)).map((c) => c.id);
    const full = [...ids, ...rest];
    await Promise.all(full.map((id, i) => db.categories.update(id, { order: i + 1 })));
  });
}

export async function add(name: string, startsAt: string | null = null): Promise<Category> {
  return db.transaction('rw', db.categories, async () => {
    const all = await db.categories.toArray();
    const cat: Category = {
      id: newId(),
      name,
      order: all.reduce((m, c) => Math.max(m, c.order), 0) + 1,
      startsAt,
      archivedAt: null,
    };
    await db.categories.add(cat);
    return cat;
  });
}

/** Archives a category. Refuses when it would leave no active category. */
export async function archive(id: string): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    const all = await db.categories.toArray();
    const others = all.filter((c) => c.id !== id && c.archivedAt === null);
    if (others.length === 0) throw new Error('At least one category must stay active');
    await db.categories.update(id, { archivedAt: new Date().toISOString() });
  });
}

export async function unarchive(id: string): Promise<void> {
  await db.categories.update(id, { archivedAt: null });
}

export async function setStartsAt(id: string, startsAt: string | null): Promise<void> {
  await db.categories.update(id, { startsAt });
}
