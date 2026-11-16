import { describe, expect, it } from 'vitest';
import {
  amountLabel,
  convertAmount,
  defaultUnit,
  formatGrams,
  formatKcal,
  formatNumber,
  formatPercent,
  formatSodium,
  fromBaseAmount,
  kgToLb,
  lbToKg,
  parseDecimal,
  toBaseAmount,
  unitLabel,
  unitOptions,
} from '../../../src/domain/units';
import type { Serving, UnitRef } from '../../../src/domain/types';

const servings: Serving[] = [
  { id: 'a', label: 'bar', amount: 45 },
  { id: 'b', label: '1 scoop', amount: 32 },
];
const g: UnitRef = { kind: 'base' };
const scoop: UnitRef = { kind: 'serving', servingId: 'b' };

describe('base amount conversion', () => {
  it('converts servings to base units', () => {
    expect(toBaseAmount(2, scoop, servings)).toBe(64);
    expect(toBaseAmount(80, g, servings)).toBe(80);
  });
  it('returns null for an unknown serving', () => {
    expect(toBaseAmount(1, { kind: 'serving', servingId: 'zz' }, servings)).toBeNull();
    expect(fromBaseAmount(10, { kind: 'serving', servingId: 'zz' }, servings)).toBeNull();
  });
  it('guards zero-size servings', () => {
    expect(fromBaseAmount(10, scoop, [{ id: 'b', label: 'x', amount: 0 }])).toBeNull();
  });
});

describe('convertAmount', () => {
  it('keeps the quantity: 80 g -> 2.5 scoops', () => {
    expect(convertAmount(80, g, scoop, servings)).toBe(2.5);
  });
  it('rounds grams to integers and servings to 2 dp', () => {
    expect(convertAmount(1.5, scoop, g, servings)).toBe(48);
    expect(convertAmount(1, { kind: 'serving', servingId: 'a' }, g, servings)).toBe(45);
    expect(convertAmount(100, g, { kind: 'serving', servingId: 'a' }, servings)).toBe(2.22);
    expect(convertAmount(1, scoop, { kind: 'serving', servingId: 'a' }, servings)).toBe(0.71);
  });
  it('is the identity for the same unit', () => {
    expect(convertAmount(1.234, scoop, scoop, servings)).toBe(1.234);
  });
  it('returns null when a unit is unknown', () => {
    expect(convertAmount(1, g, { kind: 'serving', servingId: 'x' }, servings)).toBeNull();
  });
});

describe('labels', () => {
  it('unitLabel', () => {
    expect(unitLabel(g, 'ml', servings)).toBe('ml');
    expect(unitLabel(scoop, 'g', servings)).toBe('1 scoop');
    expect(unitLabel({ kind: 'serving', servingId: 'x' }, 'g', servings)).toBeNull();
  });
  it('amountLabel', () => {
    expect(amountLabel(80, 'g')).toBe('80 g');
    expect(amountLabel(1.5, 'serving')).toBe('1.5 serving');
    expect(amountLabel(1, '1 scoop')).toBe('1 scoop');
    expect(amountLabel(2, '1 scoop')).toBe('2 scoop');
    expect(amountLabel(1.5, '2 tbsp')).toBe('3 tbsp');
  });
});

describe('unitOptions', () => {
  it('puts the default serving first, other servings next, base last', () => {
    const opts = unitOptions({ baseUnit: 'g', servings, defaultServingId: 'b' });
    expect(opts.map((o) => o.label)).toEqual(['1 scoop', 'bar', 'g']);
  });
  it('offers only the base unit without servings', () => {
    expect(unitOptions({ baseUnit: 'ml', servings: [], defaultServingId: null })).toEqual([
      { unit: { kind: 'base' }, label: 'ml' },
    ]);
  });
  it('defaultUnit falls back to base', () => {
    expect(defaultUnit({ servings, defaultServingId: 'b' })).toEqual(scoop);
    expect(defaultUnit({ servings, defaultServingId: null })).toEqual(g);
    expect(defaultUnit({ servings, defaultServingId: 'gone' })).toEqual(g);
  });
});

describe('weight', () => {
  it('lb to kg, 1 dp', () => {
    expect(lbToKg(182.4)).toBe(82.7);
    expect(lbToKg(0)).toBe(0);
  });
  it('kg to lb, 1 dp', () => expect(kgToLb(82.7)).toBe(182.3));
});

describe('formatting', () => {
  it('kcal has thousands separators', () => {
    expect(formatKcal(1620.4)).toBe('1,620');
    expect(formatKcal(12)).toBe('12');
    expect(formatKcal(-0.2)).toBe('0');
  });
  it('grams: 1 dp below 10, integer from 10', () => {
    expect(formatGrams(9.94)).toBe('9.9');
    expect(formatGrams(3)).toBe('3.0');
    expect(formatGrams(10)).toBe('10');
    expect(formatGrams(52.6)).toBe('53');
  });
  it('sodium and percent are integers', () => {
    expect(formatSodium(1234.6)).toBe('1,235');
    expect(formatPercent(0.304)).toBe('30');
  });
  it('formatNumber trims', () => {
    expect(formatNumber(1.5)).toBe('1.5');
    expect(formatNumber(2)).toBe('2');
    expect(formatNumber(1.005 * 100)).toBe('100.5');
  });
});

describe('parseDecimal', () => {
  it.each([
    ['12', 12],
    ['1.5', 1.5],
    ['1,5', 1.5],
    [' 0,25 ', 0.25],
    ['.5', 0.5],
    ['5.', 5],
  ])('parses %s', (s, n) => expect(parseDecimal(s)).toBe(n));
  it.each(['', ' ', 'abc', '-1', '1.2.3', '1,000.5', '1e3', '--', ','])('rejects "%s"', (s) => {
    expect(parseDecimal(s)).toBeNull();
  });
});
