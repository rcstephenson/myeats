import type { MetricKey, WeekSummary } from '../../domain/weekly';
import { formatGrams, formatKcal } from '../../domain/units';
import { weekLabel } from '../charts/trendsData';

const COLUMNS: { key: MetricKey; label: string; fmt: (n: number) => string }[] = [
  { key: 'kcal', label: 'kcal', fmt: formatKcal },
  { key: 'protein', label: 'Protein', fmt: formatGrams },
  { key: 'netCarbs', label: 'Net carbs', fmt: formatGrams },
  { key: 'fat', label: 'Fat', fmt: formatGrams },
  { key: 'fiber', label: 'Fiber', fmt: formatGrams },
];

/** Weekly averages (logged days only). An over-goal value carries a tick plus hidden text. */
export function WeeklyTable({ weeks }: { weeks: readonly WeekSummary[] }) {
  return (
    <div
      className="overflow-x-auto rounded-card border border-hairline bg-surface"
      data-testid="weekly-table-wrap"
    >
      <table
        className="num w-full min-w-[460px] border-collapse text-sm"
        data-testid="weekly-table"
      >
        <caption className="sr-only">Weekly averages over logged days</caption>
        <thead>
          <tr className="border-b border-hairline text-left">
            <th scope="col" className="micro px-3 py-2 font-medium">
              Week
            </th>
            <th scope="col" className="micro px-2 py-2 text-right font-medium">
              Days
            </th>
            {COLUMNS.map((c) => (
              <th key={c.key} scope="col" className="micro px-2 py-2 text-right font-medium">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.weekStart} className="border-b border-hairline last:border-b-0">
              <th
                scope="row"
                className="whitespace-nowrap px-3 py-2 text-left font-normal text-ink"
              >
                {weekLabel(w.weekStart, w.weekEnd)}
              </th>
              <td className="px-2 py-2 text-right text-muted">{w.daysLogged}/7</td>
              {COLUMNS.map((c) => {
                const avg = w.averages?.[c.key];
                if (avg === undefined) {
                  return (
                    <td key={c.key} className="px-2 py-2 text-right text-muted">
                      {'–'}
                    </td>
                  );
                }
                const over = w.overGoal[c.key];
                return (
                  <td key={c.key} className="px-2 py-2 text-right text-ink">
                    {over ? (
                      <>
                        <span
                          aria-hidden="true"
                          className="mr-1 text-danger"
                          data-testid="over-tick"
                        >
                          {'▲'}
                        </span>
                        <span className="sr-only">over goal: </span>
                      </>
                    ) : null}
                    {c.fmt(avg)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
