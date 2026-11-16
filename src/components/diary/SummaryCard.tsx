import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { GOAL_DIRECTIONS } from '../../domain/goals';
import { formatAmount } from '../ui/format';
import type { DayTotals } from '../../domain/weekly';
import type { Goal } from '../../domain/types';
import { NutrientBar } from '../ui';
import { macroShares } from './model';

export interface SummaryCardProps {
  totals: DayTotals;
  /** The goal in effect on the viewed date, or null when none. */
  goal: Goal | null;
  moreOpen: boolean;
  onToggleMore: () => void;
}

const MORE = [
  { key: 'fiber', label: 'Fiber', unit: 'g' },
  { key: 'sugar', label: 'Sugar', unit: 'g' },
  { key: 'satFat', label: 'Sat fat', unit: 'g' },
  { key: 'sodium', label: 'Sodium', unit: 'mg' },
] as const;

/** Summary card (SPEC 3.1.1): calories, three macro bars, collapsible secondary nutrients. */
export function SummaryCard({ totals, goal, moreOpen, onToggleMore }: SummaryCardProps) {
  const t = totals.totals;
  const shares = macroShares(t.kcal, t.protein, totals.netCarbs, t.fat);
  const inline = MORE.map((m) => {
    const g = goal?.[m.key] ?? null;
    return `${m.label.toUpperCase()} ${formatAmount(t[m.key], m.unit)}${g !== null ? `/${formatAmount(g, m.unit)}` : ''}`;
  }).join(' · ');

  return (
    <section
      aria-label="Summary"
      className="mx-gutter flex flex-col gap-3 rounded-card border border-hairline bg-surface p-gutter"
    >
      <NutrientBar
        label="Calories"
        eaten={t.kcal}
        goal={goal?.kcal ?? null}
        unit="kcal"
        direction="target"
        color="kcal"
        size="lg"
      />
      <NutrientBar
        label="Protein"
        eaten={t.protein}
        goal={goal?.protein ?? null}
        unit="g"
        direction="min"
        color="protein"
        share={goal ? shares.protein : undefined}
      />
      <NutrientBar
        label="Net carbs"
        eaten={totals.netCarbs}
        goal={goal?.netCarbs ?? null}
        unit="g"
        direction="target"
        color="carbs"
        share={goal ? shares.carbs : undefined}
      />
      <NutrientBar
        label="Fat"
        eaten={t.fat}
        goal={goal?.fat ?? null}
        unit="g"
        direction="target"
        color="fat"
        share={goal ? shares.fat : undefined}
      />
      {goal ? null : (
        <Link to="/settings/goals" className="text-sm font-semibold text-accent">
          Set daily goal
        </Link>
      )}
      <button
        type="button"
        onClick={onToggleMore}
        aria-expanded={moreOpen}
        className="micro flex min-h-touch items-center gap-2 border-t border-hairline pt-2 text-left"
      >
        <ChevronRight
          size={14}
          aria-hidden="true"
          className={moreOpen ? 'rotate-90 transition-transform' : 'transition-transform'}
        />
        <span className="shrink-0 text-ink">More</span>
        {moreOpen ? null : <span className="num truncate normal-case">{inline}</span>}
      </button>
      {moreOpen
        ? MORE.map((m) => (
            <NutrientBar
              key={m.key}
              label={m.label}
              eaten={t[m.key]}
              goal={goal?.[m.key] ?? null}
              unit={m.unit}
              direction={GOAL_DIRECTIONS[m.key]}
              color="nutrient"
            />
          ))
        : null}
    </section>
  );
}
