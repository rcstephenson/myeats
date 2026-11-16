import { useState } from 'react';
import { WeightChart } from '../components/charts/WeightChart';
import { filterWeighIns, WEIGHT_RANGES, type WeightRange } from '../components/charts/weightData';
import { LogTodayCard } from '../components/weight/LogTodayCard';
import { WeighInList } from '../components/weight/WeighInList';
import { Card, EmptyState, PageHeader, RangeChips, SectionLabel } from '../components/ui';
import { useToday } from '../hooks/useToday';
import { useWeighIns } from '../hooks/useWeighIns';

export default function Weight() {
  const today = useToday();
  const all = useWeighIns();
  const [range, setRange] = useState<WeightRange>('3M');

  if (all === undefined) return <PageHeader title="Weight" />;
  const existing = all.find((w) => w.date === today);
  const points = filterWeighIns(all, range, today);

  return (
    <div>
      <PageHeader title="Weight" />
      <div className="flex flex-col gap-4 px-gutter pb-6">
        <LogTodayCard today={today} existing={existing} />
        {all.length === 0 ? (
          <EmptyState title="No weigh-ins" description="Log today's weight to start the chart." />
        ) : (
          <>
            <Card className="flex flex-col gap-3">
              <RangeChips options={WEIGHT_RANGES} value={range} onChange={setRange} />
              {points.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted">No weigh-ins in this range</p>
              ) : (
                <WeightChart points={points} />
              )}
            </Card>
            <section>
              <SectionLabel className="mb-2">History</SectionLabel>
              <WeighInList items={all} />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
