import { describe, expect, it } from 'vitest';
import {
  categoryKcal,
  groupBlocks,
  macroShares,
  planCopy,
  shiftDate,
  shortDateLabel,
  visibleCategories,
} from '../../../src/components/diary/model';
import { quickPreviewKcal } from '../../../src/components/add/QuickAddPanel';
import { DEFAULT_CATEGORIES, category, entry, nut } from '../domain/factories';

const e = (id: string, order: number, p: Parameters<typeof entry>[0] = {}) =>
  entry({ id, order, nutrients: nut({ kcal: 100 }), ...p });

describe('groupBlocks', () => {
  it('orders by entry order and gathers a meal log under its first entry', () => {
    const blocks = groupBlocks([
      e('c', 3),
      e('a', 1, { mealLogId: 'm1', mealName: 'Usual' }),
      e('b', 2),
      e('d', 4, { mealLogId: 'm1', mealName: 'Usual' }),
    ]);
    expect(blocks.map((b) => (b.type === 'entry' ? b.entry.id : `group:${b.entries.map((x) => x.id)}`))).toEqual([
      'group:a,d',
      'b',
      'c',
    ]);
    const g = blocks[0];
    expect(g?.type === 'group' && g.kcal).toBe(200);
    expect(g?.type === 'group' && g.name).toBe('Usual');
  });
});

describe('visibleCategories', () => {
  const archived = category({ id: 'old', name: 'Old', order: 0, archivedAt: '2026-01-01T00:00:00Z' });
  const all = [...DEFAULT_CATEGORIES, archived];
  it('hides archived categories without entries', () => {
    expect(visibleCategories(all, []).map((c) => c.id)).not.toContain('old');
  });
  it('keeps an archived category that has entries, in order', () => {
    const ids = visibleCategories(all, [entry({ categoryId: 'old' })]).map((c) => c.id);
    expect(ids[0]).toBe('old');
    expect(ids).toHaveLength(DEFAULT_CATEGORIES.length + 1);
  });
});

describe('planCopy', () => {
  it('clones with new ids, target date/category, consecutive orders and shared new meal log ids', () => {
    let n = 0;
    const out = planCopy(
      [
        e('x', 5, { date: '2026-11-15', categoryId: 'cat-lunch', mealLogId: 'old', mealName: 'M' }),
        e('y', 2, { date: '2026-11-15', categoryId: 'cat-lunch' }),
        e('z', 7, { date: '2026-11-15', categoryId: 'cat-lunch', mealLogId: 'old', mealName: 'M' }),
      ],
      { date: '2026-11-16', categoryId: 'cat-dinner', startOrder: 10, now: '2026-11-16T10:00:00Z' },
      () => `id${++n}`,
    );
    expect(out.map((o) => o.order)).toEqual([10, 11, 12]);
    expect(out.every((o) => o.date === '2026-11-16' && o.categoryId === 'cat-dinner')).toBe(true);
    expect(new Set(out.map((o) => o.id)).size).toBe(3);
    // y (order 2) first, then x and z which share one NEW log id.
    expect(out[0]?.mealLogId).toBeNull();
    expect(out[1]?.mealLogId).toBe(out[2]?.mealLogId);
    expect(out[1]?.mealLogId).not.toBe('old');
    expect(out[1]?.mealName).toBe('M');
  });
});

describe('helpers', () => {
  it('categoryKcal sums entries', () => {
    expect(categoryKcal([e('a', 1), e('b', 2)])).toBe(200);
  });

  it('macroShares uses 4/4/9 over calories eaten', () => {
    expect(macroShares(1000, 100, 100, 50)).toEqual({ protein: 40, carbs: 40, fat: 45 });
    expect(macroShares(0, 10, 10, 10)).toEqual({ protein: 0, carbs: 0, fat: 0 });
  });

  it('date labels and shifting', () => {
    expect(shortDateLabel('2026-11-16')).toBe('MON 16 NOV');
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('quick add derives kcal only when it is blank and a macro is given', () => {
    const base = { kcal: null, protein: null, netCarbs: null, fat: null };
    expect(quickPreviewKcal(base)).toBeNull();
    expect(quickPreviewKcal({ ...base, protein: 20, netCarbs: 10, fat: 5 })).toBe(165);
    expect(quickPreviewKcal({ ...base, kcal: 250, protein: 20 })).toBe(250);
  });
});
