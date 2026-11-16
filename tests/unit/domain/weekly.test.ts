import { describe, expect, it } from 'vitest';
import {
  dailySeries,
  dayTotals,
  totalsByDate,
  weekStartKey,
  weeklySummaries,
} from '../../../src/domain/weekly';
import { entry, goal, nut } from './factories';

// 2026-11-16 is a Monday.
const e = (
  date: string,
  kcal: number,
  extra: Partial<Parameters<typeof nut>[0]> = {},
  id = date + kcal,
) =>
  entry({
    id,
    date,
    nutrients: nut({ kcal, protein: 10, carbs: 30, fiber: 5, fat: 10, ...extra }),
  });

describe('weekStartKey', () => {
  it('returns the Monday', () => {
    expect(weekStartKey('2026-11-16')).toBe('2026-11-16');
    expect(weekStartKey('2026-11-22')).toBe('2026-11-16'); // Sunday
    expect(weekStartKey('2026-11-23')).toBe('2026-11-23');
    expect(weekStartKey('2027-01-01')).toBe('2026-12-28'); // across the year
    expect(weekStartKey('nope')).toBeNull();
  });
});

describe('dayTotals', () => {
  it('sums nutrients and per-entry net carbs', () => {
    const d = dayTotals('2026-11-16', [
      e('2026-11-16', 100, { carbs: 5, fiber: 9 }), // net 0 (fiber > carbs)
      e('2026-11-16', 200, { carbs: 30, fiber: 5 }), // net 25
    ]);
    expect(d.totals.kcal).toBe(300);
    expect(d.netCarbs).toBe(25);
    expect(d.entryCount).toBe(2);
  });
  it('groups by date', () => {
    const m = totalsByDate([e('2026-11-16', 1), e('2026-11-17', 2), e('2026-11-16', 3)]);
    expect(m.get('2026-11-16')?.totals.kcal).toBe(4);
    expect(m.size).toBe(2);
  });
});

describe('weeklySummaries', () => {
  const goals = [goal({ effectiveFrom: '2026-01-01', kcal: 2000, netCarbs: 100, fat: 50 })];
  const entries = [
    e('2026-11-16', 1800), // Mon this week
    e('2026-11-16', 400), // second entry same day
    e('2026-11-18', 2400),
    e('2026-11-09', 1000), // previous week
  ];
  const weeks = weeklySummaries(entries, goals, 3, '2026-11-20');

  it('returns newest first, Mon-Sun', () => {
    expect(weeks.map((w) => w.weekStart)).toEqual(['2026-11-16', '2026-11-09', '2026-11-02']);
    expect(weeks[0]?.weekEnd).toBe('2026-11-22');
  });
  it('averages over logged days only', () => {
    const w = weeks[0]!;
    expect(w.daysLogged).toBe(2);
    expect(w.averages?.kcal).toBe((2200 + 2400) / 2);
    expect(w.averages?.protein).toBe((20 + 10) / 2);
    expect(w.averages?.netCarbs).toBe((50 + 25) / 2);
    expect(w.averages?.fiber).toBe((10 + 5) / 2);
  });
  it('has null averages for an empty week', () => {
    expect(weeks[2]).toMatchObject({ daysLogged: 0, averages: null });
    expect(weeks[2]?.overGoal.kcal).toBe(false);
  });
  it('flags target nutrients over goal, never min nutrients', () => {
    expect(weeks[0]?.overGoal).toMatchObject({
      kcal: true,
      fat: false,
      protein: false,
      fiber: false,
    });
    expect(weeks[0]?.overGoal.netCarbs).toBe(false); // 37.5 < 100
    expect(weeks[1]?.overGoal.kcal).toBe(false);
  });
  it('flags fat and net carbs over goal', () => {
    const w = weeklySummaries(
      [e('2026-11-16', 100, { fat: 80, carbs: 200, fiber: 0 })],
      goals,
      1,
      '2026-11-16',
    )[0];
    expect(w?.overGoal).toMatchObject({ fat: true, netCarbs: true, kcal: false });
  });
  it('does not flag without a goal', () => {
    expect(weeklySummaries(entries, [], 1, '2026-11-20')[0]?.overGoal.kcal).toBe(false);
  });
  it('averages equal to the goal are not over', () => {
    expect(weeklySummaries([e('2026-11-16', 2000)], goals, 1, '2026-11-16')[0]?.overGoal.kcal).toBe(
      false,
    );
  });
  it('returns [] for a malformed today', () => {
    expect(weeklySummaries(entries, goals, 2, 'x')).toEqual([]);
  });
});

describe('dailySeries', () => {
  const goals = [
    goal({ id: 'a', effectiveFrom: '2026-01-01', kcal: 2000 }),
    goal({ id: 'b', effectiveFrom: '2026-11-18', kcal: 2200 }),
  ];
  const series = dailySeries([e('2026-11-17', 1500)], goals, '2026-11-16', '2026-11-19');
  it('has one point per day with gaps as null', () => {
    expect(series.map((p) => p.date)).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
    ]);
    expect(series[0]).toMatchObject({ logged: false, kcal: null, protein: null });
    expect(series[1]).toMatchObject({
      logged: true,
      kcal: 1500,
      protein: 10,
      netCarbs: 25,
      fat: 10,
      fiber: 5,
    });
  });
  it('carries the goal in effect each day (stepped)', () => {
    expect(series.map((p) => p.goal?.kcal)).toEqual([2000, 2000, 2200, 2200]);
  });
  it('gives a null goal before any goal exists', () => {
    expect(dailySeries([], [], '2026-11-16', '2026-11-16')[0]?.goal).toBeNull();
  });
  it('is empty when from > to', () => {
    expect(dailySeries([], goals, '2026-11-19', '2026-11-16')).toEqual([]);
  });
});
