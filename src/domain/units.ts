import type { BaseUnit, Serving, UnitRef } from './types';

export const KG_PER_LB = 0.45359237;

const same = (a: UnitRef, b: UnitRef): boolean =>
  a.kind === 'base' ? b.kind === 'base' : b.kind === 'serving' && a.servingId === b.servingId;

/** Amount in base units for `amount` of `unit`, or null when the serving no longer exists. */
export function toBaseAmount(
  amount: number,
  unit: UnitRef,
  servings: readonly Serving[],
): number | null {
  if (unit.kind === 'base') return amount;
  const s = servings.find((x) => x.id === unit.servingId);
  return s ? amount * s.amount : null;
}

/** Inverse of `toBaseAmount`; null when the serving is unknown or has no size. */
export function fromBaseAmount(
  baseAmount: number,
  unit: UnitRef,
  servings: readonly Serving[],
): number | null {
  if (unit.kind === 'base') return baseAmount;
  const s = servings.find((x) => x.id === unit.servingId);
  return s && s.amount > 0 ? baseAmount / s.amount : null;
}

/** Round for display/storage: integers for base units, 2 decimals for servings (SPEC 6.4). */
export function roundForUnit(amount: number, unit: UnitRef): number {
  return unit.kind === 'base' ? Math.round(amount) : Math.round(amount * 100) / 100;
}

/** Convert an amount to another unit keeping the same quantity; null if either unit is unknown. */
export function convertAmount(
  amount: number,
  from: UnitRef,
  to: UnitRef,
  servings: readonly Serving[],
): number | null {
  if (same(from, to)) return amount;
  const base = toBaseAmount(amount, from, servings);
  if (base === null) return null;
  const out = fromBaseAmount(base, to, servings);
  return out === null ? null : roundForUnit(out, to);
}

/** Label of a unit as stored on an entry: "g", "ml" or the serving label ("1 scoop"). */
export function unitLabel(
  unit: UnitRef,
  baseUnit: BaseUnit,
  servings: readonly Serving[],
): string | null {
  if (unit.kind === 'base') return baseUnit;
  return servings.find((s) => s.id === unit.servingId)?.label ?? null;
}

/**
 * Amount as displayed: "80 g", "1 scoop", "1.5 serving". A serving label that starts with a count
 * ("1 scoop", "2 tbsp") has that count multiplied by the amount ("2 scoop" for 2 x "1 scoop").
 */
export function amountLabel(amount: number, label: string): string {
  if (label === 'g' || label === 'ml') return `${formatNumber(amount)} ${label}`;
  const m = /^(\d+(?:\.\d+)?)\s+(.+)$/.exec(label);
  if (m) {
    return `${formatNumber(Math.round(amount * Number(m[1]) * 100) / 100)} ${m[2]}`;
  }
  return `${formatNumber(amount)} ${label}`;
}

export type UnitOption = { unit: UnitRef; label: string };

/**
 * Units offered in the Amount panel: the default serving first, then the other servings in order,
 * then the base unit last (a food with servings is usually logged by serving; "g" is always there).
 */
export function unitOptions(food: {
  baseUnit: BaseUnit;
  servings: readonly Serving[];
  defaultServingId: string | null;
}): UnitOption[] {
  const servingOpts: UnitOption[] = food.servings.map((s) => ({
    unit: { kind: 'serving', servingId: s.id },
    label: s.label,
  }));
  const di = food.servings.findIndex((s) => s.id === food.defaultServingId);
  if (di > 0) servingOpts.unshift(...servingOpts.splice(di, 1));
  return [...servingOpts, { unit: { kind: 'base' }, label: food.baseUnit }];
}

/** Default unit for a food: its default serving when set, else the base unit. */
export function defaultUnit(food: {
  servings: readonly Serving[];
  defaultServingId: string | null;
}): UnitRef {
  const s = food.servings.find((x) => x.id === food.defaultServingId);
  return s ? { kind: 'serving', servingId: s.id } : { kind: 'base' };
}

export function lbToKg(lb: number): number {
  return Math.round(lb * KG_PER_LB * 10) / 10;
}

export function kgToLb(kg: number): number {
  return Math.round((kg / KG_PER_LB) * 10) / 10;
}

// --- number formatting (SPEC 4.4) ---

/** Plain number, up to 2 decimals, no trailing zeros. */
export function formatNumber(n: number): string {
  const r = Math.round(n * 100) / 100;
  return String(Object.is(r, -0) ? 0 : r);
}

/** kcal: integer with thousands separators. */
export function formatKcal(n: number): string {
  const r = Math.round(n);
  return (Object.is(r, -0) ? 0 : r).toLocaleString('en-US');
}

/** Grams: one decimal below 10, integer from 10. */
export function formatGrams(n: number): string {
  if (Math.abs(n) < 10) {
    const r = Math.round(n * 10) / 10;
    return (Object.is(r, -0) ? 0 : r).toFixed(1);
  }
  return String(Math.round(n));
}

/** Sodium in mg: integer. */
export function formatSodium(n: number): string {
  return formatKcal(n);
}

/** Percentage from a 0..1 fraction: integer, no % sign. */
export function formatPercent(fraction: number): string {
  return String(Math.round(fraction * 100));
}

/**
 * Parse a user-typed decimal. Accepts "," as the decimal separator. Returns null for empty,
 * negative, non-numeric or ambiguous input ("1.2.3", "1,000.5", "1e3").
 */
export function parseDecimal(input: string): number | null {
  const s = input.trim().replace(',', '.');
  if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
