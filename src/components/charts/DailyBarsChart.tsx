import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DaySeriesPoint } from '../../domain/weekly';
import { formatKcal } from '../../domain/units';
import { fromDateKey } from '../../lib/dates';

export interface DailyBarsChartProps {
  series: readonly DaySeriesPoint[];
  metric: 'kcal' | 'protein';
  /** Chart name for accessibility and test ids, e.g. "Calories". */
  label: string;
  unit: string;
  /** CSS colour, a token reference such as `var(--protein)`. */
  color: string;
  testId: string;
}

interface Datum {
  date: string;
  value: number | null;
  goal: number | null;
}

const tick = {
  fill: 'var(--muted)',
  fontSize: 11,
  fontFamily: '"Geist Mono Variable", ui-monospace, monospace',
};

const shortFmt = (key: string) =>
  (fromDateKey(key) ?? new Date(0)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** Bars per day with a stepped, dashed goal line that follows goal history. */
export function DailyBarsChart({
  series,
  metric,
  label,
  unit,
  color,
  testId,
}: DailyBarsChartProps) {
  const data: Datum[] = series.map((p) => ({
    date: p.date,
    value: p[metric],
    goal: p.goal ? p.goal[metric] : null,
  }));
  const logged = series.filter((p) => p.logged).length;
  return (
    <div
      role="img"
      aria-label={`${label} chart, ${logged} ${logged === 1 ? 'day' : 'days'} logged`}
      data-testid={testId}
      data-days={logged}
      className="h-52 w-full select-none"
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          barCategoryGap={1}
        >
          <CartesianGrid vertical={false} stroke="var(--hairline)" />
          <XAxis
            dataKey="date"
            tickFormatter={shortFmt}
            tick={tick}
            tickLine={false}
            axisLine={{ stroke: 'var(--hairline)' }}
            minTickGap={36}
          />
          <YAxis
            width={44}
            tick={tick}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => formatKcal(v)}
          />
          <Tooltip
            cursor={{ fill: 'var(--hairline)', fillOpacity: 0.4 }}
            content={(p) => {
              const d = p.payload?.[0]?.payload as Datum | undefined;
              if (!p.active || !d) return null;
              return (
                <div className="num rounded-btn border border-ink bg-raised p-2.5 text-xs">
                  <p className="micro">{shortFmt(d.date)}</p>
                  <p className="text-base font-semibold text-ink">
                    {d.value === null ? 'Not logged' : `${formatKcal(d.value)} ${unit}`}
                  </p>
                  {d.goal !== null ? <p className="text-muted">Goal {formatKcal(d.goal)}</p> : null}
                </div>
              );
            }}
          />
          <Bar
            dataKey="value"
            fill={color}
            isAnimationActive={false}
            shape={(props: unknown) => {
              const p = props as { payload?: Datum };
              return p.payload?.value == null ? <g /> : <Rectangle {...(props as object)} />;
            }}
          />
          <Line
            type="stepAfter"
            dataKey="goal"
            stroke="var(--accent-ink)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            activeDot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default DailyBarsChart;
