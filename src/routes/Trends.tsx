import { useState } from 'react';
import { DailyBarsChart } from '../components/charts/DailyBarsChart';
import { TREND_RANGES, type TrendRange } from '../components/charts/trendsData';
import { useTrends } from '../components/trends/useTrends';
import { WeeklyTable } from '../components/trends/WeeklyTable';
import { Card, EmptyState, PageHeader, RangeChips, SectionLabel } from '../components/ui';

export default function Trends() {
  const [range, setRange] = useState<TrendRange>('12W');
  const data = useTrends(range);

  return (
    <div>
      <PageHeader title="Trends" />
      <div className="flex flex-col gap-4 px-gutter pb-6">
        <RangeChips options={TREND_RANGES} value={range} onChange={setRange} />
        {data === undefined ? null : !data.hasEntries ? (
          <EmptyState
            title="No entries"
            description="Log food in the Diary to see weekly trends."
          />
        ) : (
          <>
            <section>
              <SectionLabel className="mb-2">Weekly averages</SectionLabel>
              <WeeklyTable weeks={data.weeks} />
              <p className="micro mt-2 normal-case">
                Averages over logged days. {'▲'} marks an average over goal.
              </p>
            </section>
            <section>
              <SectionLabel className="mb-2">Calories</SectionLabel>
              <Card>
                <DailyBarsChart
                  series={data.series}
                  metric="kcal"
                  label="Calories"
                  unit="kcal"
                  color="var(--kcal)"
                  testId="kcal-chart"
                />
              </Card>
            </section>
            <section>
              <SectionLabel className="mb-2">Protein</SectionLabel>
              <Card>
                <DailyBarsChart
                  series={data.series}
                  metric="protein"
                  label="Protein"
                  unit="g"
                  color="var(--protein)"
                  testId="protein-chart"
                />
              </Card>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
