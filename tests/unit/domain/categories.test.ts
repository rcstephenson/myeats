import { describe, expect, it } from 'vitest';
import {
  activeCategories,
  defaultCategory,
  parseStartsAt,
  sortCategories,
} from '../../../src/domain/categories';
import { category, DEFAULT_CATEGORIES } from './factories';

const at = (h: number, m = 0) => new Date(2026, 10, 16, h, m);
const pick = (d: Date) => defaultCategory(d, DEFAULT_CATEGORIES)?.name;

describe('defaultCategory', () => {
  it('picks the latest start <= now', () => {
    expect(pick(at(9))).toBe('Breakfast');
    expect(pick(at(12))).toBe('Lunch');
    expect(pick(at(15))).toBe('Meal 3');
    expect(pick(at(19))).toBe('Dinner');
    expect(pick(at(22))).toBe('Snacks');
  });
  it('switches exactly on the start minute', () => {
    expect(pick(at(10, 59))).toBe('Breakfast');
    expect(pick(at(11, 0))).toBe('Lunch');
    expect(pick(at(4, 0))).toBe('Breakfast');
  });
  it('wraps to the last timed category before the earliest start (midnight)', () => {
    expect(pick(at(0, 0))).toBe('Snacks');
    expect(pick(at(3, 59))).toBe('Snacks');
  });
  it('ignores archived categories', () => {
    const cats = DEFAULT_CATEGORIES.map((c) => (c.id === 'l' ? { ...c, archivedAt: 'x' } : c));
    expect(defaultCategory(at(12), cats)?.name).toBe('Breakfast');
    const noSnacks = DEFAULT_CATEGORIES.map((c) => (c.id === 's' ? { ...c, archivedAt: 'x' } : c));
    expect(defaultCategory(at(0), noSnacks)?.name).toBe('Dinner');
  });
  it('uses the first active category when none has a start time', () => {
    const cats = [category({ id: 'x', order: 2 }), category({ id: 'y', order: 1 })];
    expect(defaultCategory(at(12), cats)?.id).toBe('y');
  });
  it('returns null with no active categories', () => {
    expect(defaultCategory(at(12), [])).toBeNull();
    expect(defaultCategory(at(12), [category({ archivedAt: 'x' })])).toBeNull();
  });
  it('ignores malformed start times', () => {
    const cats = [
      category({ id: 'x', startsAt: '25:00' }),
      category({ id: 'y', order: 2, startsAt: '10:00' }),
    ];
    expect(defaultCategory(at(12), cats)?.id).toBe('y');
  });
  it('does not depend on array order', () => {
    expect(defaultCategory(at(12), [...DEFAULT_CATEGORIES].reverse())?.name).toBe('Lunch');
  });
});

describe('sorting', () => {
  it('sortCategories orders without mutating', () => {
    const input = [category({ id: 'b', order: 2 }), category({ id: 'a', order: 1 })];
    expect(sortCategories(input).map((c) => c.id)).toEqual(['a', 'b']);
    expect(input[0]?.id).toBe('b');
  });
  it('activeCategories drops archived', () => {
    const cats = [
      category({ id: 'a', order: 1, archivedAt: 'x' }),
      category({ id: 'b', order: 2 }),
    ];
    expect(activeCategories(cats).map((c) => c.id)).toEqual(['b']);
  });
  it('parseStartsAt', () => {
    expect(parseStartsAt('14:30')).toBe(870);
    expect(parseStartsAt('4:00')).toBe(240);
    expect(parseStartsAt(null)).toBeNull();
    expect(parseStartsAt('nope')).toBeNull();
    expect(parseStartsAt('12:60')).toBeNull();
  });
});
