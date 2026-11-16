import { useState } from 'react';
import { Button, Card, PageHeader } from '../components/ui';
import { clearDemoData, seedDemoData } from './demoData';

export default function SeedDemo() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const run = async (task: () => Promise<string>) => {
    setBusy(true);
    setMessage('');
    try {
      setMessage(await task());
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Seed demo" subtitle="Dev only" />
      <div className="flex flex-col gap-4 px-gutter">
        <Card className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            Generates custom foods, a recipe, a saved meal, about 6 weeks of diary entries, a goal
            change and weigh-ins. Earlier demo data is replaced; your own data is never touched.
          </p>
          <Button
            disabled={busy}
            onClick={() =>
              run(async () => {
                const r = await seedDemoData();
                return `Created ${r.foods} foods and ${r.entries} entries.`;
              })
            }
          >
            Generate demo data
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const r = await clearDemoData();
                return `Removed ${r.entries} demo entries.`;
              })
            }
          >
            Clear demo data
          </Button>
          <p role="status" className="min-h-[22px] text-sm text-ink">
            {message}
          </p>
        </Card>
      </div>
    </>
  );
}
