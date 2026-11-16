import { describe, expect, it } from 'vitest';
import {
  deriveKcal,
  isIncomplete,
  macroKcalShare,
  multiplyNutrients,
  netCarbs,
  scaleNutrients,
  sumNutrients,
  sumNutrientsWithKnown,
  withDerivedKcal,
} from '../../../src/domain/nutrients';
import { nut } from './factories';

describe('scaleNutrients', () => {
  it('scales per-100 values and keeps null as null', () => {
    const out = scaleNutrients(nut({ kcal: 380, protein: 13, fat: null }), 80);
    expect(out.kcal).toBe(304);
    expect(out.protein).toBe(10.4);
    expect(out.fat).toBeNull();
    expect(out.sodium).toBeNull();
  });
  it('zero amount gives zeros for known values', () => {
    expect(scaleNutrients(nut({ kcal: 100 }), 0).kcal).toBe(0);
  });
  it('does not mutate the input', () => {
    const src = nut({ kcal: 100 });
    scaleNutrients(src, 50);
    expect(src.kcal).toBe(100);
  });
  it('multiplyNutrients keeps null', () => {
    expect(multiplyNutrients(nut({ kcal: 10, fat: null }), 0.5)).toMatchObject({
      kcal: 5,
      fat: null,
    });
  });
});

describe('sumNutrients', () => {
  it('treats null as 0', () => {
    const t = sumNutrients([nut({ kcal: 100, fat: 5 }), nut({ kcal: null, fat: 2.5 })]);
    expect(t.kcal).toBe(100);
    expect(t.fat).toBe(7.5);
    expect(t.sodium).toBe(0);
  });
  it('reports which keys had any known input', () => {
    const { known } = sumNutrientsWithKnown([nut({ kcal: 1 }), nut({ kcal: null, fat: 0 })]);
    expect(known.kcal).toBe(true);
    expect(known.fat).toBe(true);
    expect(known.protein).toBe(false);
  });
  it('empty list gives zeros', () => {
    expect(sumNutrients([]).kcal).toBe(0);
  });
  it('avoids float noise', () => {
    expect(sumNutrients([nut({ fat: 0.1 }), nut({ fat: 0.2 })]).fat).toBe(0.3);
  });
});

describe('netCarbs', () => {
  it('is carbs minus fiber', () => expect(netCarbs(nut({ carbs: 30, fiber: 8 }))).toBe(22));
  it('is 0 when fiber exceeds carbs', () => expect(netCarbs(nut({ carbs: 5, fiber: 9 }))).toBe(0));
  it('treats null as 0', () => {
    expect(netCarbs(nut({ carbs: null, fiber: 3 }))).toBe(0);
    expect(netCarbs(nut({ carbs: 12, fiber: null }))).toBe(12);
  });
});

describe('deriveKcal / withDerivedKcal', () => {
  it('uses 4P + 4C + 9F', () => {
    expect(deriveKcal({ protein: 10, carbs: 20, fat: 5 })).toBe(165);
  });
  it('is null when any macro is unknown', () => {
    expect(deriveKcal({ protein: 10, carbs: null, fat: 5 })).toBeNull();
  });
  it('flags derived kcal only when kcal was null', () => {
    expect(withDerivedKcal(nut({ kcal: null, protein: 10, carbs: 20, fat: 5 }))).toMatchObject({
      kcalDerived: true,
      nutrients: { kcal: 165 },
    });
    expect(withDerivedKcal(nut({ kcal: 50, protein: 10, carbs: 20, fat: 5 })).kcalDerived).toBe(
      false,
    );
    expect(withDerivedKcal(nut({ kcal: null, protein: 10 })).kcalDerived).toBe(false);
  });
});

describe('isIncomplete', () => {
  const full = nut({ kcal: 1, protein: 1, carbs: 1, fat: 1 });
  it('is false when the four core values are known', () => expect(isIncomplete(full)).toBe(false));
  it.each(['kcal', 'protein', 'carbs', 'fat'] as const)('is true when %s is null', (k) => {
    expect(isIncomplete({ ...full, [k]: null })).toBe(true);
  });
  it('ignores optional nutrients', () =>
    expect(isIncomplete({ ...full, sodium: null })).toBe(false));
});

describe('macroKcalShare', () => {
  it('uses net carbs and 4/4/9', () => {
    const s = macroKcalShare(nut({ kcal: 1000, protein: 50, carbs: 120, fiber: 20, fat: 50 }));
    expect(s.protein).toBeCloseTo(0.2);
    expect(s.carbs).toBeCloseTo(0.4);
    expect(s.fat).toBeCloseTo(0.45);
  });
  it('is all zero with no kcal', () => {
    expect(macroKcalShare(nut())).toEqual({ protein: 0, carbs: 0, fat: 0 });
  });
});
