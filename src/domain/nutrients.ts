import { NUTRIENT_KEYS, type NutrientKey, type Nutrients } from './types';

/** Nutrient totals where unknown (null) inputs count as 0. */
export type Totals = Record<NutrientKey, number>;

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

/** Scale per-100 values to `baseAmount` base units (g or ml). null stays null. */
export function scaleNutrients(per100: Nutrients, baseAmount: number): Nutrients {
  const out = { ...per100 };
  for (const key of NUTRIENT_KEYS) {
    const v = per100[key];
    out[key] = v === null ? null : round3((v * baseAmount) / 100);
  }
  return out;
}

/** Multiply every known value by `factor` (null stays null). */
export function multiplyNutrients(n: Nutrients, factor: number): Nutrients {
  const out = { ...n };
  for (const key of NUTRIENT_KEYS) {
    const v = n[key];
    out[key] = v === null ? null : round3(v * factor);
  }
  return out;
}

/** Sum nutrients; null counts as 0 (SPEC 4.1). */
export function sumNutrients(list: readonly Nutrients[]): Totals {
  return sumNutrientsWithKnown(list).totals;
}

/**
 * Like `sumNutrients`, but also reports, per key, whether at least one input had a known value.
 * `known[key] === false` means every input was null (so the total of 0 is really "unknown").
 */
export function sumNutrientsWithKnown(list: readonly Nutrients[]): {
  totals: Totals;
  known: Record<NutrientKey, boolean>;
} {
  const totals = {} as Totals;
  const known = {} as Record<NutrientKey, boolean>;
  for (const key of NUTRIENT_KEYS) {
    let sum = 0;
    let any = false;
    for (const n of list) {
      const v = n[key];
      if (v !== null) {
        sum += v;
        any = true;
      }
    }
    totals[key] = round3(sum);
    known[key] = any;
  }
  return { totals, known };
}

/** Net carbs, always derived: max(0, carbs - fiber), null as 0 (SPEC 4.1). Fiber > carbs gives 0. */
export function netCarbs(n: Pick<Nutrients, 'carbs' | 'fiber'>): number {
  return round3(Math.max(0, (n.carbs ?? 0) - (n.fiber ?? 0)));
}

/**
 * kcal from macros: 4*protein + 4*carbs + 9*fat, or null when any of the three is unknown.
 * Uses TOTAL carbs, literally as SPEC 4.1 says (quick add stores net carbs as `carbs` with fiber 0,
 * so the same formula applies there).
 */
export function deriveKcal(n: Pick<Nutrients, 'protein' | 'carbs' | 'fat'>): number | null {
  if (n.protein === null || n.carbs === null || n.fat === null) return null;
  return Math.round(4 * n.protein + 4 * n.carbs + 9 * n.fat);
}

/** Fill a null kcal from the macros when possible. */
export function withDerivedKcal(n: Nutrients): { nutrients: Nutrients; kcalDerived: boolean } {
  if (n.kcal !== null) return { nutrients: n, kcalDerived: false };
  const kcal = deriveKcal(n);
  if (kcal === null) return { nutrients: n, kcalDerived: false };
  return { nutrients: { ...n, kcal }, kcalDerived: true };
}

/** True when kcal, protein, carbs or fat is unknown (shows the `~` mark). */
export function isIncomplete(n: Nutrients): boolean {
  return n.kcal === null || n.protein === null || n.carbs === null || n.fat === null;
}

/** Share of kcal from each macro as a 0..1 fraction (protein/net carbs 4 kcal/g, fat 9). */
export function macroKcalShare(n: Nutrients): { protein: number; carbs: number; fat: number } {
  const kcal = n.kcal ?? 0;
  if (kcal <= 0) return { protein: 0, carbs: 0, fat: 0 };
  return {
    protein: ((n.protein ?? 0) * 4) / kcal,
    carbs: (netCarbs(n) * 4) / kcal,
    fat: ((n.fat ?? 0) * 9) / kcal,
  };
}
