import { describe, expect, it } from 'vitest';
import {
  mapUsdaNutrients,
  mapUsdaPortions,
  mapUsdaSearch,
  sortGenericFirst,
  type UsdaDetails,
  type UsdaSearchResponse,
} from '../../../src/domain/usdaMapper';
import banana from '../../fixtures/usda/search-banana.json';
import bars from '../../fixtures/usda/search-protein-bar.json';
import gtin from '../../fixtures/usda/search-gtin-016459200441.json';
import fallbacks from '../../fixtures/usda/search-fallbacks.json';
import details173944 from '../../fixtures/usda/details-173944.json';
import details1105314 from '../../fixtures/usda/details-1105314.json';

const NOW = '2026-01-01T00:00:00.000Z';
const find = (res: UsdaSearchResponse, id: number) => {
  const mapped = mapUsdaSearch(res, NOW).find((f) => f.sourceId === String(id));
  if (!mapped) throw new Error(`fixture missing ${id}`);
  return mapped;
};

describe('mapUsdaSearch', () => {
  it('maps a real SR Legacy food (per 100 g, nulls for missing)', () => {
    const f = find(banana, 173944);
    expect(f).toMatchObject({
      source: 'usda',
      sourceId: '173944',
      name: 'Bananas, raw',
      brand: null,
      barcode: null,
      baseUnit: 'g',
      dataType: 'SR Legacy',
      servings: [],
      defaultServingId: null,
      fetchedAt: NOW,
      overrides: null,
    });
    expect(f.per100).toEqual({
      kcal: 89, protein: 1.09, carbs: 22.8, fiber: 2.6, sugar: 12.2, fat: 0.33, satFat: 0.112, sodium: 1,
    });
  });

  it('leaves unreported nutrients null, not zero', () => {
    const f = find(banana, 1105073); // Foundation: no sugar, sodium or sat fat
    expect(f.per100.kcal).toBe(85);
    expect(f.per100.sugar).toBeNull();
    expect(f.per100.sodium).toBeNull();
    expect(f.per100.satFat).toBeNull();
  });

  it('maps a Branded food with serving, brand and barcode', () => {
    const f = find(banana, 2012128);
    expect(f.dataType).toBe('Branded');
    expect(f.name).toBe('Banana');
    expect(f.brand).toBe("Better'n Peanut Butter");
    expect(f.barcode).toBe('0016459200441');
    expect(f.servings).toEqual([{ id: 'usda-serving', label: '2 Tbsp (32 g)', amount: 32 }]);
    expect(f.defaultServingId).toBe('usda-serving');
    expect(f.per100.kcal).toBe(312);
    expect(f.per100.sodium).toBe(594);
  });

  it('maps protein bar servings and GTIN search fixture', () => {
    const bar = find(bars, 1917719);
    expect(bar.servings[0]).toMatchObject({ label: '1 BAR (34 g)', amount: 34 });
    expect(find(gtin, 2012128).barcode).toBe('0016459200441');
  });

  it('uses ml as base unit when servingSizeUnit is ml', () => {
    const f = find(fallbacks, 900005);
    expect(f.baseUnit).toBe('ml');
    expect(f.servings[0]).toMatchObject({ label: '1 can (355 ml)', amount: 355 });
    expect(f.barcode).toBe('0012345678905');
  });

  it('applies energy fallbacks 1008 -> 2047 -> 2048', () => {
    expect(find(fallbacks, 900001).per100.kcal).toBe(61.5);
    expect(find(fallbacks, 900002).per100.kcal).toBe(58);
  });

  it('maps a food with no nutrients to all nulls and keeps real zeros', () => {
    expect(Object.values(find(fallbacks, 900003).per100).every((v) => v === null)).toBe(true);
    const zero = find(fallbacks, 900004).per100;
    expect(zero.kcal).toBe(0);
    expect(zero.sodium).toBe(0);
    expect(zero.protein).toBeNull();
  });
});

describe('mapUsdaNutrients', () => {
  it('prefers 1008 over fallbacks and ignores non-finite values', () => {
    const n = mapUsdaNutrients([
      { nutrientId: 2047, value: 70 },
      { nutrientId: 1008, value: 80 },
      { nutrientId: 1003, value: Number.NaN },
      { nutrientId: 1004, value: null },
    ]);
    expect(n.kcal).toBe(80);
    expect(n.protein).toBeNull();
    expect(n.fat).toBeNull();
  });
  it('handles undefined', () => {
    expect(mapUsdaNutrients(undefined).kcal).toBeNull();
  });
});

describe('sortGenericFirst', () => {
  it('puts Foundation and SR Legacy above Branded, keeping API order within groups', () => {
    const sorted = sortGenericFirst(mapUsdaSearch(banana, NOW));
    expect(sorted.map((f) => f.sourceId)).toEqual([
      '173945', '173944', '1105073', '1105314', '168849', '167629', '2012128', '2011468',
    ]);
  });
});

describe('mapUsdaPortions', () => {
  it('builds servings from foodPortions, ordered by sequenceNumber, amount = gram weight', () => {
    const s = mapUsdaPortions(details173944 as UsdaDetails);
    expect(s).toHaveLength(8);
    expect(s[0]).toEqual({ id: 'usda-portion-93511', label: '1 cup, mashed', amount: 225 });
    expect(s.find((x) => x.label.startsWith('1 medium'))?.amount).toBe(118);
    expect(new Set(s.map((x) => x.id)).size).toBe(8);
  });

  it('uses measureUnit name plus modifier for Foundation portions', () => {
    const s = mapUsdaPortions(details1105314 as UsdaDetails);
    expect(s[0]).toMatchObject({ label: '1 Banana, Peeled', amount: 115 });
  });

  it('prefers portionDescription and skips zero or missing grams', () => {
    const s = mapUsdaPortions({
      foodPortions: [
        { id: 1, gramWeight: 30, portionDescription: '1 slice', amount: 1 },
        { id: 2, gramWeight: 0, portionDescription: 'broken' },
        { id: 3, portionDescription: 'no grams' },
        { id: 4, gramWeight: 10, portionDescription: 'Quantity not specified' },
      ],
    });
    expect(s).toEqual([{ id: 'usda-portion-1', label: '1 slice', amount: 30 }]);
  });

  it('returns [] when there are no portions', () => {
    expect(mapUsdaPortions({})).toEqual([]);
    expect(mapUsdaPortions({ foodPortions: null })).toEqual([]);
  });
});
