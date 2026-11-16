import { useState } from 'react';
import { Dumbbell } from 'lucide-react';
import {
  AddedFooter,
  Button,
  Card,
  CategoryHeader,
  Chip,
  ConfirmDialog,
  EmptyState,
  EntryRow,
  KeyboardActionBar,
  MacroLegend,
  MealGroupHeader,
  Menu,
  Mono,
  NumberField,
  NutrientBar,
  PageHeader,
  RangeChips,
  ResultRow,
  SearchField,
  SectionLabel,
  SegmentedBar,
  Sheet,
  Toast,
} from '../components/ui';
import { applyTheme } from '../lib/theme';

const SWATCHES = [
  ['bg', 'bg-bg'],
  ['surface', 'bg-surface'],
  ['raised', 'bg-raised'],
  ['ink', 'bg-ink'],
  ['muted', 'bg-muted'],
  ['hair', 'bg-hairline'],
  ['hair-strong', 'bg-hairline-strong'],
  ['accent', 'bg-accent'],
  ['accent-ink', 'bg-accent-ink'],
  ['primary', 'bg-primary'],
  ['danger', 'bg-danger'],
  ['kcal', 'bg-kcal'],
  ['protein', 'bg-protein'],
  ['carbs', 'bg-carbs'],
  ['fat', 'bg-fat'],
  ['nutrient', 'bg-nutrient'],
  ['track', 'bg-track'],
] as const;

const RANGES = ['1M', '3M', '1Y', 'All'] as const;

function Showcase({ inline }: { inline: boolean }) {
  const [chip, setChip] = useState('All');
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [range, setRange] = useState<(typeof RANGES)[number]>('3M');
  const [q, setQ] = useState('oat');
  const [num, setNum] = useState('1,5');
  const [parsed, setParsed] = useState<number | null>(1.5);

  return (
    <div className="flex flex-col gap-5 px-gutter pb-8">
      <section>
        <SectionLabel index={1}>Tokens</SectionLabel>
        <Card className="mt-2">
          <ul className="grid grid-cols-5 gap-2">
            {SWATCHES.map(([name, cls]) => (
              <li key={name} className="flex flex-col items-start gap-1">
                <span className={`h-8 w-full rounded-chip border border-hairline ${cls}`} />
                <span className="micro w-full break-all leading-3">{name}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section>
        <SectionLabel index={2}>Type</SectionLabel>
        <Card className="mt-2 flex flex-col gap-1">
          <p className="text-display font-semibold tracking-tighter">1,620</p>
          <p className="text-xl font-semibold tracking-tight">Geist 24 / 600</p>
          <p className="text-base">Geist 18, body copy and titles</p>
          <p className="text-sm text-muted">Geist 15 muted, secondary copy</p>
          <p className="micro">Micro label / mono 11</p>
          <p>
            <Mono className="text-base">102.5 x 8 / 12,480 lb</Mono>
          </p>
        </Card>
      </section>

      <section>
        <SectionLabel index={3}>Button</SectionLabel>
        <Card className="mt-2">
          <div className="flex flex-wrap gap-2">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button disabled>Disabled</Button>
          </div>
        </Card>
      </section>

      <section>
        <SectionLabel index={4}>Chip and range</SectionLabel>
        <Card className="mt-2 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {['All', 'Workouts', 'Activities'].map((c) => (
              <Chip key={c} selected={chip === c} onClick={() => setChip(c)}>
                {c}
              </Chip>
            ))}
          </div>
          <RangeChips options={RANGES} value={range} onChange={setRange} />
        </Card>
      </section>

      <section>
        <SectionLabel index={5}>Segmented bar</SectionLabel>
        <Card className="mt-2 flex flex-col gap-4">
          <SegmentedBar value={3} total={5} label="3 of 5 sets logged" />
          <SegmentedBar
            states={['done', 'done', 'rest', 'current', 'off', 'rest', 'off']}
            label="Seven day schedule"
          />
        </Card>
      </section>

      <section>
        <SectionLabel index={6}>Nutrient bars</SectionLabel>
        <Card className="mt-2 flex flex-col gap-4">
          <NutrientBar
            label="Calories"
            eaten={1620}
            goal={2400}
            unit="kcal"
            direction="target"
            color="kcal"
            size="lg"
          />
          <NutrientBar
            label="Calories over"
            eaten={2520}
            goal={2400}
            unit="kcal"
            direction="target"
            color="kcal"
            size="lg"
          />
          <NutrientBar
            label="Protein"
            eaten={120}
            goal={180}
            unit="g"
            direction="min"
            color="protein"
            share={24}
          />
          <NutrientBar
            label="Protein over min"
            eaten={195}
            goal={180}
            unit="g"
            direction="min"
            color="protein"
            share={30}
          />
          <NutrientBar
            label="Carbs"
            eaten={210}
            goal={200}
            unit="g"
            direction="target"
            color="carbs"
            share={40}
          />
          <NutrientBar
            label="Fat"
            eaten={48.4}
            goal={70}
            unit="g"
            direction="max"
            color="fat"
            share={25}
          />
          <NutrientBar
            label="Fiber"
            eaten={12}
            goal={30}
            unit="g"
            direction="min"
            color="nutrient"
          />
          <NutrientBar
            label="Sodium"
            eaten={1840}
            goal={null}
            unit="mg"
            direction="max"
            color="nutrient"
          />
          <MacroLegend />
        </Card>
      </section>

      <section>
        <SectionLabel index={7}>Search and results</SectionLabel>
        <Card className="mt-2 flex flex-col gap-3">
          <SearchField value={q} onChange={setQ} onScan={() => undefined} />
          <div className="-mx-4 -mb-4">
            <ResultRow
              name="Rolled oats"
              tag="USDA"
              brand="Quaker"
              amount="40 g"
              kcal="150 kcal"
              onSelect={() => undefined}
            />
            <ResultRow
              name="Oat milk, unsweetened with a very long name that truncates"
              tag="OFF"
              amount="240 ml"
              kcal="90 kcal"
              onSelect={() => undefined}
            />
            <ResultRow
              name="Overnight oats"
              tag="MEAL"
              amount="1 serving"
              kcal="320 kcal"
              onSelect={() => undefined}
            />
          </div>
        </Card>
      </section>

      <section>
        <SectionLabel index={8}>Diary rows</SectionLabel>
        <Card className="mt-2 overflow-hidden p-0">
          <CategoryHeader
            name="Breakfast"
            kcal="424"
            onAdd={() => undefined}
            menu={
              <Menu
                label="Breakfast options"
                items={[
                  { label: 'Copy from yesterday', onSelect: () => undefined },
                  { label: 'Save as meal', onSelect: () => undefined, disabled: true },
                  { label: 'Clear category', onSelect: () => undefined, danger: true },
                ]}
              />
            }
          />
          <EntryRow
            name="Rolled oats"
            brand="Quaker"
            amount="40 g"
            kcal="150"
            protein="5"
            carbs="27"
            fat="3"
            onSelect={() => undefined}
          />
          <MealGroupHeader name="Protein shake" kcal="274" />
          <EntryRow
            indent
            name="Whey"
            amount="30 g"
            kcal="120"
            protein="24"
            carbs="3"
            fat="1.5"
            incomplete
            onSelect={() => undefined}
          />
          <EntryRow
            name="Read-only entry"
            amount="1 cup"
            kcal="80"
            protein="1"
            carbs="20"
            fat="0"
            disabled
          />
          <CategoryHeader name="Lunch" onAdd={() => undefined} />
        </Card>
      </section>

      <section>
        <SectionLabel index={9}>Number field</SectionLabel>
        <Card className="mt-2 flex flex-col gap-3">
          <NumberField
            label="Amount"
            large
            suffix="g"
            defaultValue={num}
            onChange={(v, raw) => {
              setParsed(v);
              setNum(raw);
            }}
          />
          <p className="text-xs text-muted">
            raw <Mono>{num}</Mono> parsed <Mono>{String(parsed)}</Mono>
          </p>
        </Card>
      </section>

      <section>
        <SectionLabel index={10}>Footer, toast, action bar</SectionLabel>
        <Card className="mt-2 flex flex-col gap-3 overflow-hidden p-0">
          <AddedFooter category="Breakfast" count={2} kcal="424 kcal" onDone={() => undefined} />
        </Card>
        {inline ? (
          <div className="mt-3 flex flex-col gap-3">
            <p className="text-xs text-muted">
              Toast and action bar are fixed-position; shown in the single-theme view.
            </p>
          </div>
        ) : (
          <>
            <Toast
              message="Added Rolled oats"
              actionLabel="Undo"
              onDismiss={() => undefined}
              duration={3_600_000}
              bottom="88px"
            />
            <KeyboardActionBar>
              <Button fullWidth>Add to Breakfast</Button>
            </KeyboardActionBar>
          </>
        )}
      </section>

      <section>
        <SectionLabel index={11}>Sheet and confirm</SectionLabel>
        <Card className="mt-2">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setSheet(true)}>
              Open sheet
            </Button>
            <Button variant="danger" onClick={() => setConfirm(true)}>
              Open confirm
            </Button>
          </div>
        </Card>
      </section>

      <section>
        <SectionLabel index={12}>Empty state</SectionLabel>
        <div className="mt-2">
          <EmptyState
            icon={<Dumbbell size={24} aria-hidden="true" />}
            title="No entries"
            description="Example empty state."
          />
        </div>
      </section>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Example sheet">
        <p className="mb-4 text-sm text-muted">Press Escape or tap the backdrop to close.</p>
        <Button fullWidth onClick={() => setSheet(false)}>
          Done
        </Button>
      </Sheet>
      <ConfirmDialog
        open={confirm}
        title="Delete item?"
        message="This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => setConfirm(false)}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}

export default function UiDemo() {
  const [dark, setDark] = useState(
    () => document.documentElement.getAttribute('data-theme') === 'dark',
  );
  const [both, setBoth] = useState(false);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    applyTheme(next ? 'dark' : 'light');
  };

  return (
    <>
      <PageHeader
        title="UI primitives"
        subtitle="Signal / dev"
        action={
          <Button variant="secondary" onClick={toggle} aria-pressed={dark}>
            {dark ? 'Graphite' : 'Paper'}
          </Button>
        }
      />
      <div className="flex gap-2 px-gutter pb-4">
        <Chip selected={both} onClick={() => setBoth((b) => !b)}>
          Compare both themes
        </Chip>
      </div>
      {both ? (
        <>
          {(['light', 'dark'] as const).map((t) => (
            <div key={t} data-theme={t} className="bg-bg pt-4 text-ink">
              <p className="micro px-gutter pb-3">{t === 'light' ? 'Paper' : 'Graphite'}</p>
              <Showcase inline />
            </div>
          ))}
        </>
      ) : (
        <div className="pb-24">
          <Showcase inline={false} />
        </div>
      )}
    </>
  );
}
