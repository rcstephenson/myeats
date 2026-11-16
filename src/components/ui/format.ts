/** Tiny display formatters for UI components. Domain code owns the canonical rules. */
export type Unit = 'kcal' | 'g' | 'mg' | 'mcg' | string;

export function formatAmount(value: number, unit: Unit): string {
  if (!Number.isFinite(value)) return '0';
  if (unit === 'g') {
    if (Math.abs(value) < 10) return String(Math.round(value * 10) / 10);
    return Math.round(value).toLocaleString('en-US');
  }
  return Math.round(value).toLocaleString('en-US');
}

const UNIT_WORDS: Record<string, string> = {
  kcal: 'calories',
  g: 'grams',
  mg: 'milligrams',
  mcg: 'micrograms',
};

export function unitWord(unit: Unit): string {
  return UNIT_WORDS[unit] ?? unit;
}
