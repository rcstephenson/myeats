import { describe, expect, it } from 'vitest';
import {
  changesFromPrevious,
  filterWeighIns,
  formatChange,
  weightDomain,
  weightRangeStart,
} from '../../../src/components/charts/weightData';
import type { WeighIn } from '../../../src/domain/types';

const w = (date: string, weightLb: number): WeighIn => ({
  id: date,
  date,
  weightLb,
  bodyFatPct: null,
  createdAt: '',
  updatedAt: '',
});

describe('weightRangeStart', () => {
  it('computes calendar offsets', () => {
    expect(weightRangeStart('1M', '2026-11-16')).toBe('2026-10-16');
    expect(weightRangeStart('3M', '2026-11-16')).toBe('2026-08-16');
    expect(weightRangeStart('1Y', '2026-11-16')).toBe('2025-11-16');
    expect(weightRangeStart('All', '2026-11-16')).toBeNull();
  });
});

describe('filterWeighIns', () => {
  const all = [
    w('2026-11-10', 180),
    w('2026-09-01', 185),
    w('2026-11-16', 179),
    w('2025-01-01', 190),
  ];
  it('filters to the range and sorts oldest first', () => {
    expect(filterWeighIns(all, '1M', '2026-11-16').map((x) => x.date)).toEqual([
      '2026-11-10',
      '2026-11-16',
    ]);
    expect(filterWeighIns(all, '3M', '2026-11-16')).toHaveLength(3);
    expect(filterWeighIns(all, 'All', '2026-11-16').map((x) => x.date)[0]).toBe('2025-01-01');
  });
});

describe('weightDomain', () => {
  it('pads outward to whole lb', () => {
    expect(weightDomain([180.2, 181.4])).toEqual([179, 183]);
    expect(weightDomain([160, 180])).toEqual([157, 183]);
  });
  it('is null with no values', () => {
    expect(weightDomain([])).toBeNull();
  });
});

describe('changesFromPrevious', () => {
  it('compares each weigh-in with the older one', () => {
    const m = changesFromPrevious([
      w('2026-11-16', 179.4),
      w('2026-11-10', 180),
      w('2026-11-01', 178.8),
    ]);
    expect(m.get('2026-11-01')).toBeNull();
    expect(m.get('2026-11-10')).toBe(1.2);
    expect(m.get('2026-11-16')).toBe(-0.6);
  });
});

describe('formatChange', () => {
  it('uses a real minus sign', () => {
    expect(formatChange(-0.6)).toBe('−0.6');
    expect(formatChange(1.25)).toBe('+1.3');
    expect(formatChange(0)).toBe('0.0');
  });
});
