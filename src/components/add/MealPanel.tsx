import { useMemo, useState } from 'react';
import { sumNutrients, netCarbs } from '../../domain/nutrients';
import { formatGrams, formatKcal, formatNumber } from '../../domain/units';
import type { SavedMeal } from '../../domain/types';
import { Button, MacroLegend, NumberField } from '../ui';
import { Panel } from './Panel';
import { previewNutrients } from './amounts';
import { resolveMeal, type Lookups, type MealLine } from './results';

export interface MealPanelProps {
  meal: SavedMeal;
  lookups: Lookups;
  /** Lines with the (possibly edited) amount to log. */
  onAddAll: (lines: { line: MealLine; amount: number }[]) => void;
  onClose: () => void;
}

/** Meal panel (SPEC 3.2): per-item amounts for this log only, a total, Add all. */
export function MealPanel({ meal, lookups, onAddAll, onClose }: MealPanelProps) {
  const { lines, missing } = useMemo(() => resolveMeal(meal, lookups), [meal, lookups]);
  const [amounts, setAmounts] = useState<(number | null)[]>(() => lines.map((l) => l.item.amount));

  const parts = lines.map((l, i) => {
    const a = amounts[i] ?? null;
    return a !== null && a > 0 ? previewNutrients(l.snap, a, l.item.unit) : null;
  });
  const total = sumNutrients(parts.flatMap((p) => (p ? [p.nutrients] : [])));
  const allValid = lines.length > 0 && parts.every((p) => p !== null);

  return (
    <Panel
      open
      onClose={onClose}
      title={meal.name}
      footer={
        <Button
          fullWidth
          disabled={!allValid}
          onClick={() =>
            onAddAll(lines.map((line, i) => ({ line, amount: amounts[i] ?? line.item.amount })))
          }
        >
          Add all
        </Button>
      }
    >
      <ul>
        {lines.map((l, i) => (
          <li
            key={`${l.item.refId}:${i}`}
            className="flex min-h-14 items-center gap-2 border-b border-hairline py-1"
          >
            <span className="min-w-0 flex-1 truncate text-sm text-ink">{l.name}</span>
            <NumberField
              label={`${l.name} amount`}
              defaultValue={formatNumber(l.item.amount)}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(v) => setAmounts((a) => a.map((x, j) => (j === i ? v : x)))}
              className="w-24 shrink-0"
            />
            <span className="num w-14 shrink-0 truncate text-xs text-muted">{l.unitText}</span>
            <span className="num w-12 shrink-0 text-right text-xs text-ink">
              {parts[i] ? formatKcal(parts[i]?.nutrients.kcal ?? 0) : '—'}
            </span>
          </li>
        ))}
      </ul>
      {missing > 0 ? (
        <p className="mt-2 text-xs text-muted">
          {missing} {missing === 1 ? 'item is' : 'items are'} no longer available and will be skipped.
        </p>
      ) : null}
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="num text-xl font-semibold text-ink" data-testid="meal-total">
          {formatKcal(total.kcal)}
          <span className="ml-1 text-sm font-normal text-muted">kcal</span>
        </p>
        <p className="num text-xs text-muted">
          {`P ${formatGrams(total.protein)} · C ${formatGrams(netCarbs(total))} · F ${formatGrams(total.fat)}`}
        </p>
      </div>
      <MacroLegend className="mt-2" />
    </Panel>
  );
}
