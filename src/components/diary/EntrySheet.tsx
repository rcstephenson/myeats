import { useState } from 'react';
import { netCarbs } from '../../domain/nutrients';
import { buildQuickEntry, rescaleEntry } from '../../domain/entries';
import {
  convertAmount,
  formatGrams,
  formatKcal,
  formatNumber,
  unitOptions,
  type UnitOption,
} from '../../domain/units';
import type { Category, Entry, UnitRef } from '../../domain/types';
import { nowIso } from '../../lib/dates';
import { Button, InlineSelect, MacroLegend, NumberField } from '../ui';
import { Panel } from '../add/Panel';
import { QuickAddPanel, type QuickValues } from '../add/QuickAddPanel';
import { unitFromKey, unitKey } from '../add/amounts';

export interface EntrySheetProps {
  entry: Entry;
  categories: Category[];
  /** Persist the edited entry. `moved` is true when the category changed (caller picks the order). */
  onSave: (entry: Entry, moved: boolean) => void;
  onDelete: (entry: Entry) => void;
  onClose: () => void;
}

/** Unit options for an entry, from its own snapshot (never the current food). */
function entryUnits(entry: Entry): UnitOption[] {
  const snap = entry.snapshot;
  if (!snap) return [];
  const opts = unitOptions({ baseUnit: snap.baseUnit, servings: snap.servings, defaultServingId: null });
  // A recipe logged per serving without a cooked weight is a pure count: no grams.
  const countOnly =
    entry.kind === 'recipe' &&
    snap.servings.length === 1 &&
    snap.servings[0]?.id === 'serving' &&
    snap.servings[0].amount === 1;
  return countOnly ? opts.filter((o) => o.unit.kind === 'serving') : opts;
}

function currentUnit(entry: Entry, options: UnitOption[]): UnitRef {
  const hit = options.find((o) => o.label === entry.unitLabel);
  return hit?.unit ?? options[0]?.unit ?? { kind: 'base' };
}

/** Entry sheet (SPEC 3.1.2): amount + unit with live preview, category, Delete, Save. */
export function EntrySheet(props: EntrySheetProps) {
  return props.entry.kind === 'quick' ? <QuickEdit {...props} /> : <AmountEdit {...props} />;
}

function CategoryPick({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3 border-t border-hairline pt-3">
      <span className="micro">Category</span>
      <span className="relative rounded-chip border border-hairline bg-surface px-3 py-2 text-sm text-ink">
        <InlineSelect
          label="Category"
          value={value}
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          onChange={onChange}
        />
      </span>
    </div>
  );
}

function AmountEdit({ entry, categories, onSave, onDelete, onClose }: EntrySheetProps) {
  const options = entryUnits(entry);
  const servings = entry.snapshot?.servings ?? [];
  const [unit, setUnit] = useState<UnitRef>(() => currentUnit(entry, options));
  const [amount, setAmount] = useState<number | null>(entry.amount);
  const [seed, setSeed] = useState({ key: 0, text: formatNumber(entry.amount ?? 1) });
  const [categoryId, setCategoryId] = useState(entry.categoryId);

  let preview: Entry | null = null;
  if (amount !== null && amount > 0) {
    try {
      preview = rescaleEntry(entry, amount, unit, nowIso());
    } catch {
      preview = null;
    }
  }
  const n = preview?.nutrients;

  const changeUnit = (key: string) => {
    const next = unitFromKey(key);
    const converted = amount !== null ? convertAmount(amount, unit, next, servings) : null;
    const nextAmount = converted !== null && converted > 0 ? converted : 1;
    setUnit(next);
    setAmount(nextAmount);
    setSeed((s) => ({ key: s.key + 1, text: formatNumber(nextAmount) }));
  };

  const save = () => {
    if (!preview) return;
    onSave({ ...preview, categoryId }, categoryId !== entry.categoryId);
  };

  return (
    <Panel
      open
      onClose={onClose}
      title={entry.name}
      footer={
        <>
          <Button variant="danger" onClick={() => onDelete(entry)}>
            Delete
          </Button>
          <Button fullWidth disabled={!preview} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      {entry.brand ? <p className="-mt-2 mb-2 truncate text-sm text-muted">{entry.brand}</p> : null}
      <form
        className="flex items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <NumberField
          key={seed.key}
          label="Amount"
          large
          autoFocus
          defaultValue={seed.text}
          onFocus={(e) => e.currentTarget.select()}
          onChange={setAmount}
          className="w-32 shrink-0"
        />
        <span className="relative min-h-touch min-w-0 flex-1 text-base leading-[48px] text-ink">
          <InlineSelect
            label="Unit"
            value={unitKey(unit)}
            options={options.map((o) => ({ value: unitKey(o.unit), label: o.label }))}
            onChange={changeUnit}
            disabled={options.length < 2}
          />
        </span>
      </form>
      <div className="mt-4 flex items-end justify-between gap-3" aria-live="polite">
        <p className="num text-xl font-semibold text-ink" data-testid="entry-preview-kcal">
          {n ? `${preview?.kcalDerived ? '≈' : ''}${formatKcal(n.kcal ?? 0)}` : '—'}
          <span className="ml-1 text-sm font-normal text-muted">kcal</span>
        </p>
        <p className="num text-xs text-muted">
          {n
            ? `P ${formatGrams(n.protein ?? 0)} · C ${formatGrams(netCarbs(n))} · F ${formatGrams(n.fat ?? 0)}`
            : ''}
        </p>
      </div>
      <MacroLegend className="mt-2" />
      <CategoryPick categories={categories} value={categoryId} onChange={setCategoryId} />
    </Panel>
  );
}

function QuickEdit({ entry, categories, onSave, onDelete, onClose }: EntrySheetProps) {
  const [categoryId, setCategoryId] = useState(entry.categoryId);
  const n = entry.nutrients;
  const submit = (v: QuickValues) => {
    const rebuilt = buildQuickEntry({
      ...v,
      id: entry.id,
      date: entry.date,
      categoryId,
      order: entry.order,
      now: nowIso(),
    });
    onSave(
      { ...rebuilt, createdAt: entry.createdAt, mealLogId: entry.mealLogId, mealName: entry.mealName },
      categoryId !== entry.categoryId,
    );
  };
  return (
    <QuickAddPanel
      title={entry.name}
      submitLabel="Save"
      initial={{
        label: entry.name === 'Quick add' ? '' : entry.name,
        // A derived kcal stays derived from the macros unless the user types one.
        kcal: entry.kcalDerived ? undefined : (n.kcal ?? undefined),
        protein: n.protein ?? undefined,
        netCarbs: n.carbs === null ? undefined : netCarbs(n),
        fat: n.fat ?? undefined,
      }}
      onSubmit={submit}
      onClose={onClose}
    >
      <CategoryPick categories={categories} value={categoryId} onChange={setCategoryId} />
      <Button variant="danger" fullWidth className="mt-3" onClick={() => onDelete(entry)}>
        Delete
      </Button>
    </QuickAddPanel>
  );
}
