import { describe, expect, it } from 'vitest';
import { mapOffProduct, type OffResponse } from '../../../src/domain/offMapper';
import nutella from '../../fixtures/off/3017620422003.json';
import coke from '../../fixtures/off/5449000000996.json';
import notFound from '../../fixtures/off/not-found.json';
import kjOnly from '../../fixtures/off/kj-only.json';

const NOW = '2026-01-01T00:00:00.000Z';

describe('mapOffProduct', () => {
  it('maps a real product (sodium g -> mg, zero fiber kept)', () => {
    const f = mapOffProduct(nutella as OffResponse, NOW);
    expect(f).toMatchObject({
      source: 'off',
      sourceId: '3017620422003',
      barcode: '3017620422003',
      name: 'Nutella',
      brand: 'Ferrero',
      baseUnit: 'g',
      dataType: 'OFF',
      servings: [],
      defaultServingId: null,
      fetchedAt: NOW,
    });
    expect(f?.per100).toEqual({
      kcal: 539, protein: 6.3, carbs: 57.5, fiber: 0, sugar: 56.3, fat: 30.9, satFat: 10.6, sodium: 42.8,
    });
  });

  it('builds a serving from serving_quantity + serving_size and detects ml', () => {
    const f = mapOffProduct(coke as OffResponse, NOW);
    expect(f?.baseUnit).toBe('ml');
    expect(f?.servings).toEqual([{ id: 'off-serving', label: '1 portion (330 ml)', amount: 330 }]);
    expect(f?.defaultServingId).toBe('off-serving');
    expect(f?.per100.kcal).toBe(44);
    expect(f?.per100.sodium).toBe(0);
  });

  it('falls back to kJ / 4.184 when kcal is missing, and reads string serving_quantity', () => {
    const f = mapOffProduct(kjOnly as OffResponse, NOW);
    expect(f?.per100.kcal).toBe(538.2);
    expect(f?.servings).toEqual([{ id: 'off-serving', label: '15 g', amount: 15 }]);
  });

  it('returns null for status 0 or a missing product', () => {
    expect(mapOffProduct(notFound as OffResponse, NOW)).toBeNull();
    expect(mapOffProduct({ status: 1 }, NOW)).toBeNull();
  });

  it('gives nulls for absent nutriments', () => {
    const f = mapOffProduct({ status: 1, product: { code: '3017620422003', product_name: 'X', nutriments: {} } }, NOW);
    expect(Object.values(f!.per100).every((v) => v === null)).toBe(true);
  });

  it('keeps the OFF code as sourceId digits when it is not a valid GTIN', () => {
    const f = mapOffProduct({ status: 1, product: { code: '12345', product_name: 'Odd' } }, NOW);
    expect(f?.barcode).toBeNull();
    expect(f?.sourceId).toBe('12345');
  });
});
