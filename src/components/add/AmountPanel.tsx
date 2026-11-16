import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { convertAmount, formatGrams, formatKcal, formatNumber } from '../../domain/units';
import { netCarbs } from '../../domain/nutrients';
import type { LastAmount, UnitRef } from '../../domain/types';
import type { UnitOption } from '../../domain/units';
import { Button, IconButton, InlineSelect, MacroLegend, NumberField } from '../ui';
import { Panel } from './Panel';
import { previewNutrients, unitFromKey, unitKey, type Snap } from './amounts';

export interface AmountPanelProps {
  title: string;
  brand?: string | null;
  /** null when the item cannot be computed (e.g. a recipe with a missing ingredient). */
  snap: Snap | null;
  options: UnitOption[];
  initial: LastAmount;
  favorite: boolean;
  onToggleFavorite: () => void;
  /** Route of the editor for this item. */
  editHref: string | null;
  onAdd: (amount: number, unit: UnitRef) => void;
  onClose: () => void;
}

/** The Amount panel (SPEC 3.2): amount, unit, live preview, favourite, Edit food, Add. */
export function AmountPanel({
  title,
  brand,
  snap,
  options,
  initial,
  favorite,
  onToggleFavorite,
  editHref,
  onAdd,
  onClose,
}: AmountPanelProps) {
  const [unit, setUnit] = useState<UnitRef>(initial.unit);
  const [amount, setAmount] = useState<number | null>(initial.amount);
  // The amount field is uncontrolled; bumping the key re-seeds it after a unit conversion.
  const [seed, setSeed] = useState({ key: 0, text: formatNumber(initial.amount) });

  const valid = amount !== null && amount > 0 && snap !== null;
  const preview = snap && valid ? previewNutrients(snap, amount, unit) : null;
  const n = preview?.nutrients;

  const submit = () => {
    if (valid && preview) onAdd(amount, unit);
  };

  const changeUnit = (key: string) => {
    const next = unitFromKey(key);
    const converted =
      snap && amount !== null ? convertAmount(amount, unit, next, snap.servings) : null;
    const nextAmount = converted !== null && converted > 0 ? converted : 1;
    setUnit(next);
    setAmount(nextAmount);
    setSeed((s) => ({ key: s.key + 1, text: formatNumber(nextAmount) }));
  };

  return (
    <Panel
      open
      onClose={onClose}
      title={title}
      footer={
        <Button fullWidth disabled={!valid || !preview} onClick={submit}>
          Add
        </Button>
      }
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm text-muted">{brand ?? ''}</p>
        <div className="-mt-2 flex shrink-0 items-center">
          <IconButton
            aria-label={favorite ? 'Remove favourite' : 'Add favourite'}
            aria-pressed={favorite}
            onClick={onToggleFavorite}
          >
            <Star size={20} aria-hidden="true" fill={favorite ? 'currentColor' : 'none'} />
          </IconButton>
          {editHref ? (
            <Link
              to={editHref}
              className="inline-flex min-h-touch items-center px-2 text-sm font-semibold text-accent"
            >
              Edit food
            </Link>
          ) : null}
        </div>
      </div>

      <form
        className="mt-1 flex items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <NumberField
          key={seed.key}
          label="Amount"
          large
          autoFocus
          defaultValue={seed.text}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(v) => setAmount(v)}
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
        <p className="num text-xl font-semibold text-ink" data-testid="preview-kcal">
          {n ? `${preview?.kcalDerived ? '≈' : ''}${formatKcal(n.kcal ?? 0)}` : '—'}
          <span className="ml-1 text-sm font-normal text-muted">kcal</span>
        </p>
        <p className="num text-xs text-muted" data-testid="preview-macros">
          {n
            ? `P ${formatGrams(n.protein ?? 0)} · C ${formatGrams(netCarbs(n))} · F ${formatGrams(n.fat ?? 0)}`
            : ''}
        </p>
      </div>
      <MacroLegend className="mt-2" />
    </Panel>
  );
}
