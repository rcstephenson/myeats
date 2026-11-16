import { formatKcal } from './units';
import type { Goal, GoalDirection, GoalKey } from './types';

/** SPEC 4.5. Direction only changes how over-goal is displayed. */
export const GOAL_DIRECTIONS: Record<GoalKey, GoalDirection> = {
  kcal: 'target',
  netCarbs: 'target',
  fat: 'target',
  protein: 'min',
  fiber: 'min',
  sugar: 'max',
  satFat: 'max',
  sodium: 'max',
};

/** The goal with the greatest `effectiveFrom` <= `date` (YYYY-MM-DD), or null. */
export function goalFor(date: string, goals: readonly Goal[]): Goal | null {
  let best: Goal | null = null;
  for (const g of goals) {
    if (g.effectiveFrom <= date && (best === null || g.effectiveFrom > best.effectiveFrom)) {
      best = g;
    }
  }
  return best;
}

export type Progress = {
  /** 0..1, for the bar. */
  fraction: number;
  left: number;
  over: number;
  /** Over a target/max goal: show the danger tick and colour. Never true for 'min'. */
  danger: boolean;
  /** "780 left", "120 over", or "+12" for an exceeded min goal. */
  text: string;
};

export function progress(
  eaten: number,
  goal: number,
  direction: GoalDirection,
  format: (n: number) => string = formatKcal,
): Progress {
  const left = Math.max(0, goal - eaten);
  const over = Math.max(0, eaten - goal);
  const fraction = goal > 0 ? Math.min(1, Math.max(0, eaten / goal)) : eaten > 0 ? 1 : 0;
  let text: string;
  if (over > 0) text = direction === 'min' ? `+${format(over)}` : `${format(over)} over`;
  else text = `${format(left)} left`;
  return { fraction, left, over, danger: over > 0 && direction !== 'min', text };
}

type MacroGoal = Pick<Goal, 'kcal' | 'protein' | 'netCarbs' | 'fat'>;

/** Each macro's share of the kcal goal as a 0..1 fraction (P/C 4 kcal/g, F 9). */
export function macroShareOfGoal(goal: MacroGoal): { protein: number; carbs: number; fat: number } {
  if (goal.kcal <= 0) return { protein: 0, carbs: 0, fat: 0 };
  return {
    protein: (goal.protein * 4) / goal.kcal,
    carbs: (goal.netCarbs * 4) / goal.kcal,
    fat: (goal.fat * 9) / goal.kcal,
  };
}

/** Macro kcal vs the kcal goal; `mismatch` when they differ by more than 5% of the kcal goal. */
export function macroKcalMismatch(goal: MacroGoal): { macroKcal: number; mismatch: boolean } {
  const macroKcal = Math.round(goal.protein * 4 + goal.netCarbs * 4 + goal.fat * 9);
  const mismatch =
    goal.kcal > 0 ? Math.abs(macroKcal - goal.kcal) / goal.kcal > 0.05 : macroKcal > 0;
  return { macroKcal, mismatch };
}
