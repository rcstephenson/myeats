import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { lbToKg } from '../../domain/units';
import type { WeighIn } from '../../domain/types';
import { fromDateKey } from '../../lib/dates';
import { weightDomain } from './weightData';

export interface WeightChartProps {
  /** Oldest first. */
  points: readonly WeighIn[];
}

interface Datum {
  t: number;
  lb: number;
  w: WeighIn;
}

const dayFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const fullFmt = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const tick = {
  fill: 'var(--muted)',
  fontSize: 11,
  fontFamily: '"Geist Mono Variable", ui-monospace, monospace',
};

function timeOf(date: string): number {
  return (fromDateKey(date) ?? new Date(0)).getTime();
}

function Tip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload: Datum }>;
}) {
  if (!active || !payload?.length) return null;
  const { t, w } = payload[0].payload;
  return (
    <div className="num max-w-[220px] rounded-btn border border-ink bg-raised p-2.5 text-xs">
      <p className="micro">{fullFmt.format(t)}</p>
      <p className="mt-0.5 text-base font-semibold text-ink">{w.weightLb.toFixed(1)} lb</p>
      <p className="text-muted">{lbToKg(w.weightLb).toFixed(1)} kg</p>
      {w.bodyFatPct !== null ? <p className="text-muted">{w.bodyFatPct}% body fat</p> : null}
    </div>
  );
}

/** Raw weigh-ins as 4px ink dots joined by a 1px ink line at 40% opacity. */
export function WeightChart({ points }: WeightChartProps) {
  const data: Datum[] = points.map((w) => ({ t: timeOf(w.date), lb: w.weightLb, w }));
  const domain = weightDomain(points.map((p) => p.weightLb)) ?? [0, 1];
  return (
    <div
      role="img"
      aria-label={`Weight chart, ${points.length} ${points.length === 1 ? 'weigh-in' : 'weigh-ins'}`}
      data-testid="weight-chart"
      data-points={points.length}
      className="h-60 w-full select-none"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--hairline)" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            padding={{ left: 8, right: 8 }}
            tickFormatter={(t: number) => dayFmt.format(t)}
            tick={tick}
            tickLine={false}
            axisLine={{ stroke: 'var(--hairline)' }}
            minTickGap={32}
          />
          <YAxis
            width={44}
            domain={domain}
            allowDecimals={false}
            tick={tick}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ stroke: 'var(--ink)', strokeWidth: 1, strokeDasharray: '2 3' }}
            content={(p) => (
              <Tip
                active={p.active}
                payload={p.payload as unknown as ReadonlyArray<{ payload: Datum }>}
              />
            )}
          />
          <Line
            type="linear"
            dataKey="lb"
            stroke="var(--ink)"
            strokeOpacity={0.4}
            strokeWidth={1}
            dot={{ r: 2, fill: 'var(--ink)', stroke: 'none' }}
            activeDot={{ r: 4, fill: 'var(--ink)', stroke: 'var(--raised)', strokeWidth: 1 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default WeightChart;
