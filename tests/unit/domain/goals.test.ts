import { describe, expect, it } from 'vitest';
import {
  GOAL_DIRECTIONS,
  goalFor,
  macroKcalMismatch,
  macroShareOfGoal,
  progress,
} from '../../../src/domain/goals';
import { formatGrams } from '../../../src/domain/units';
import { goal } from './factories';

describe('goalFor', () => {
  const goals = [
    goal({ id: 'a', effectiveFrom: '2026-03-01', kcal: 2000 }),
    goal({ id: 'c', effectiveFrom: '2026-09-10', kcal: 2400 }),
    goal({ id: 'b', effectiveFrom: '2026-06-01', kcal: 2200 }),
  ];
  it('picks the greatest effectiveFrom <= date, regardless of array order', () => {
    expect(goalFor('2026-07-01', goals)?.id).toBe('b');
  });
  it('includes the boundary day itself and excludes the day before', () => {
    expect(goalFor('2026-09-10', goals)?.id).toBe('c');
    expect(goalFor('2026-09-09', goals)?.id).toBe('b');
  });
  it('is null before the first goal and with no goals', () => {
    expect(goalFor('2026-02-28', goals)).toBeNull();
    expect(goalFor('2026-02-28', [])).toBeNull();
  });
});

describe('GOAL_DIRECTIONS', () => {
  it('matches SPEC 4.5', () => {
    expect(GOAL_DIRECTIONS).toEqual({
      kcal: 'target',
      netCarbs: 'target',
      fat: 'target',
      protein: 'min',
      fiber: 'min',
      sugar: 'max',
      satFat: 'max',
      sodium: 'max',
    });
  });
});

describe('progress', () => {
  it('target under goal', () => {
    expect(progress(1620, 2400, 'target')).toMatchObject({
      left: 780,
      over: 0,
      text: '780 left',
      danger: false,
    });
    expect(progress(1620, 2400, 'target').fraction).toBeCloseTo(0.675);
  });
  it('target over goal clamps the bar and flags danger', () => {
    expect(progress(2520, 2400, 'target')).toMatchObject({
      fraction: 1,
      over: 120,
      text: '120 over',
      danger: true,
    });
  });
  it('min over goal shows +N without danger', () => {
    expect(progress(192, 180, 'min')).toMatchObject({ fraction: 1, text: '+12', danger: false });
  });
  it('min under goal shows N left', () => {
    expect(progress(120, 180, 'min').text).toBe('60 left');
  });
  it('max behaves like target', () => {
    expect(progress(3000, 2300, 'max')).toMatchObject({ text: '700 over', danger: true });
  });
  it('exactly at goal is 0 left, full bar, no danger', () => {
    expect(progress(180, 180, 'target')).toMatchObject({
      fraction: 1,
      text: '0 left',
      danger: false,
    });
  });
  it('handles zero eaten and zero goal', () => {
    expect(progress(0, 2000, 'target').fraction).toBe(0);
    expect(progress(0, 0, 'target').fraction).toBe(0);
    expect(progress(5, 0, 'target').fraction).toBe(1);
  });
  it('uses a custom formatter', () => {
    expect(progress(4.25, 10, 'target', formatGrams).text).toBe('5.8 left');
    expect(progress(1620, 2400, 'target').text).toBe('780 left');
    expect(progress(0, 2400, 'target').text).toBe('2,400 left');
  });
});

describe('macro helpers', () => {
  it('computes shares of the kcal goal', () => {
    const s = macroShareOfGoal(goal({ kcal: 2400, protein: 180, netCarbs: 220, fat: 80 }));
    expect(Math.round(s.protein * 100)).toBe(30);
    expect(Math.round(s.carbs * 100)).toBe(37);
    expect(Math.round(s.fat * 100)).toBe(30);
  });
  it('zero kcal goal gives zero shares', () => {
    expect(macroShareOfGoal(goal({ kcal: 0 }))).toEqual({ protein: 0, carbs: 0, fat: 0 });
  });
  it('flags a mismatch above 5% only', () => {
    expect(macroKcalMismatch(goal({ kcal: 2400, protein: 180, netCarbs: 220, fat: 80 }))).toEqual({
      macroKcal: 2320,
      mismatch: false,
    });
    expect(
      macroKcalMismatch(goal({ kcal: 2000, protein: 180, netCarbs: 220, fat: 80 })).mismatch,
    ).toBe(true);
    // exactly 5% off is not a mismatch (1000 kcal goal, 1050 from macros)
    expect(
      macroKcalMismatch(goal({ kcal: 1000, protein: 100, netCarbs: 0, fat: 650 / 9 })).mismatch,
    ).toBe(false);
  });
});
