import { describe, expect, it } from 'vitest';
import { trendWindow, weekLabel, weeksFor } from '../../../src/components/charts/trendsData';

describe('trendWindow', () => {
  it('starts on the Monday of the oldest week and ends today', () => {
    // 2026-11-16 is a Monday.
    expect(trendWindow('4W', '2026-11-16')).toEqual({ from: '2026-10-26', to: '2026-11-16' });
    // Wednesday: the week still starts Monday 11-16.
    expect(trendWindow('4W', '2026-11-18')).toEqual({ from: '2026-10-26', to: '2026-11-18' });
  });
  it('maps ranges to weeks', () => {
    expect([weeksFor('4W'), weeksFor('12W'), weeksFor('26W')]).toEqual([4, 12, 26]);
  });
});

describe('weekLabel', () => {
  it('collapses the month when shared', () => {
    expect(weekLabel('2026-11-09', '2026-11-15')).toBe('Nov 9–15');
    expect(weekLabel('2026-10-26', '2026-11-01')).toBe('Oct 26–Nov 1');
  });
});
