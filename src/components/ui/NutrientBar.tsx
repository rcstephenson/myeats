import { formatAmount, unitWord, type Unit } from './format';

export type NutrientColor = 'kcal' | 'protein' | 'carbs' | 'fat' | 'nutrient';
export type NutrientDirection = 'target' | 'min' | 'max';

export interface NutrientBarProps {
  label: string;
  eaten: number;
  goal: number | null;
  unit: Unit;
  direction: NutrientDirection;
  color: NutrientColor;
  /** The "% kcal" text, e.g. 24. */
  share?: number;
  size?: 'lg' | 'md';
}

const FILL: Record<NutrientColor, string> = {
  kcal: 'bg-kcal',
  protein: 'bg-protein',
  carbs: 'bg-carbs',
  fat: 'bg-fat',
  nutrient: 'bg-nutrient',
};

export function NutrientBar({
  label,
  eaten,
  goal,
  unit,
  direction,
  color,
  share,
  size = 'md',
}: NutrientBarProps) {
  const lg = size === 'lg';
  const eatenText = formatAmount(eaten, unit);
  const unitSuffix = unit === 'kcal' ? '' : unit;
  const valueClass = lg ? 'text-xl font-semibold' : 'text-sm';

  if (goal === null) {
    return (
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-ink">{label}</span>
        <span className={`num text-ink ${valueClass}`}>
          {eatenText}
          {unitSuffix}
        </span>
      </div>
    );
  }

  const over = eaten > goal;
  const diffText = formatAmount(Math.abs(goal - eaten), unit);
  const pct = goal > 0 ? Math.min(100, Math.max(0, (eaten / goal) * 100)) : over ? 100 : 0;
  const showDanger = over && direction !== 'min';

  let status: string;
  let statusText: string;
  let statusClass = 'text-muted';
  if (over && direction === 'min') {
    status = `${diffText} past goal`;
    statusText = `+${diffText}`;
  } else if (over) {
    status = `${diffText} over`;
    statusText = `${diffText} over`;
    statusClass = 'text-danger';
  } else {
    status = `${diffText} left`;
    statusText = `${diffText} left`;
  }

  const aria = `${label} ${eatenText} of ${formatAmount(goal, unit)} ${unitWord(unit)}, ${status}`;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-baseline gap-2 text-sm text-ink">
          {label}
          {share !== undefined ? (
            <span className="num text-xs text-muted">{Math.round(share)}%</span>
          ) : null}
        </span>
        <span className="num flex items-baseline gap-2 text-xs">
          <span className={`text-ink ${valueClass}`}>
            {eatenText}
            <span className="text-muted"> / {formatAmount(goal, unit)}</span>
            {unitSuffix}
          </span>
          <span className={statusClass}>{statusText}</span>
        </span>
      </div>
      <div
        role="meter"
        aria-label={aria}
        aria-valuenow={Math.round(eaten * 10) / 10}
        aria-valuemin={0}
        aria-valuemax={goal}
        className={`relative w-full overflow-hidden rounded-[2px] bg-track ${lg ? 'h-2' : 'h-1.5'}`}
      >
        <div
          data-testid="nutrient-fill"
          className={`h-full rounded-[2px] ${FILL[color]}`}
          style={{ width: `${pct}%` }}
        />
        {showDanger ? (
          <div
            data-testid="over-tick"
            className="absolute inset-y-0 right-0 w-0.5 bg-danger"
            aria-hidden="true"
          />
        ) : null}
      </div>
    </div>
  );
}
