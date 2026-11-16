import { useState } from 'react';
import { Button, Card, NumberField, PageHeader, SectionLabel, useToast } from '../components/ui';
import { BackToSettings } from '../components/settings/BackToSettings';
import { goals as goalsRepo } from '../db/repositories';
import { macroKcalMismatch, macroShareOfGoal } from '../domain/goals';
import type { Goal } from '../domain/types';
import { formatKcal, formatPercent } from '../domain/units';
import { fromDateKey } from '../lib/dates';
import { useGoals } from '../hooks/useGoals';
import { useToday } from '../hooks/useToday';

type Draft = Record<
  'kcal' | 'protein' | 'netCarbs' | 'fat' | 'fiber' | 'sugar' | 'satFat' | 'sodium',
  number | null
>;

const REQUIRED = [
  { key: 'kcal', label: 'Calories', suffix: 'kcal' },
  { key: 'protein', label: 'Protein', suffix: 'g' },
  { key: 'netCarbs', label: 'Net carbs', suffix: 'g' },
  { key: 'fat', label: 'Fat', suffix: 'g' },
] as const;

const OPTIONAL = [
  { key: 'fiber', label: 'Fiber (min)', suffix: 'g' },
  { key: 'sugar', label: 'Sugar (max)', suffix: 'g' },
  { key: 'satFat', label: 'Saturated fat (max)', suffix: 'g' },
  { key: 'sodium', label: 'Sodium (max)', suffix: 'mg' },
] as const;

const show = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));

const formatDate = (key: string) =>
  (fromDateKey(key) ?? new Date(key)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

function GoalForm({ initial, today }: { initial: Goal | undefined; today: string }) {
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>({
    kcal: initial?.kcal ?? null,
    protein: initial?.protein ?? null,
    netCarbs: initial?.netCarbs ?? null,
    fat: initial?.fat ?? null,
    fiber: initial?.fiber ?? null,
    sugar: initial?.sugar ?? null,
    satFat: initial?.satFat ?? null,
    sodium: initial?.sodium ?? null,
  });
  const set = (key: keyof Draft) => (value: number | null) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const { kcal, protein, netCarbs, fat } = draft;
  const complete =
    kcal !== null && kcal > 0 && protein !== null && netCarbs !== null && fat !== null;
  const macros = complete ? { kcal, protein, netCarbs, fat } : null;
  const share = macros ? macroShareOfGoal(macros) : null;
  const mismatch = macros ? macroKcalMismatch(macros) : null;

  const save = async () => {
    if (!macros) return;
    await goalsRepo.saveToday(
      {
        ...macros,
        fiber: draft.fiber,
        sugar: draft.sugar,
        satFat: draft.satFat,
        sodium: draft.sodium,
      },
      today,
    );
    toast.show({ message: 'Goals saved' });
  };

  return (
    <Card className="flex flex-col gap-3">
      {REQUIRED.map((f) => (
        <label key={f.key} className="flex flex-col gap-1">
          <span className="micro">{f.label}</span>
          <NumberField
            label={f.label}
            suffix={f.suffix}
            defaultValue={show(draft[f.key])}
            onChange={set(f.key)}
          />
        </label>
      ))}
      <p data-testid="macro-share" className="num min-h-[20px] text-sm text-ink">
        {share
          ? `P ${formatPercent(share.protein)}% · C ${formatPercent(share.carbs)}% · F ${formatPercent(share.fat)}%`
          : ''}
      </p>
      {mismatch?.mismatch ? (
        <p data-testid="macro-mismatch" className="num text-xs text-muted">
          Macros add up to {formatKcal(mismatch.macroKcal)} kcal
        </p>
      ) : null}
      <SectionLabel as="p">Optional</SectionLabel>
      {OPTIONAL.map((f) => (
        <label key={f.key} className="flex flex-col gap-1">
          <span className="micro">{f.label}</span>
          <NumberField
            label={f.label}
            suffix={f.suffix}
            defaultValue={show(draft[f.key])}
            onChange={set(f.key)}
          />
        </label>
      ))}
      <Button disabled={!complete} onClick={() => void save()}>
        Save goals
      </Button>
    </Card>
  );
}

export default function Goals() {
  const goals = useGoals();
  const today = useToday();

  return (
    <>
      <PageHeader title="Goals" back={<BackToSettings />} />
      {goals ? (
        <div className="flex flex-col gap-6 px-gutter pb-6">
          <GoalForm
            initial={goals.find((g) => g.effectiveFrom <= today) ?? goals[0]}
            today={today}
          />
          <section aria-label="Goal history">
            <SectionLabel className="mb-2">History</SectionLabel>
            {goals.length === 0 ? (
              <p className="text-sm text-muted">No goals saved yet.</p>
            ) : (
              <ul className="divide-y divide-hairline rounded-card border border-hairline bg-surface">
                {goals.map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <span className="text-sm text-ink">From {formatDate(g.effectiveFrom)}</span>
                    <span className="num text-xs text-muted">
                      {formatKcal(g.kcal)} kcal · P {g.protein} · C {g.netCarbs} · F {g.fat}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
