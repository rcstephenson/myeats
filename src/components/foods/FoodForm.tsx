import { Suspense, useState } from 'react';
import { Plus, ScanBarcode, Star, Trash2 } from 'lucide-react';
import { foods } from '../../db/repositories';
import { normaliseBarcode } from '../../domain/barcode';
import { formatNumber } from '../../domain/units';
import type { Food, NutrientKey } from '../../domain/types';
import { nowIso } from '../../lib/dates';
import { prefetchScanner, ScannerView } from '../../scanner';
import { newId } from '../../lib/ids';
import { Button, Card, IconButton, NumberField } from '../ui';
import { Field, Segmented, TextField } from './fields';
import {
  NUTRITION_KEY,
  buildFoodFields,
  draftFromFood,
  emptyDraft,
  netCarbsOf,
  newDraftServing,
  type DraftErrors,
  type FoodDraft,
} from './foodDraft';

export interface FoodFormProps {
  initial?: Food;
  prefill?: { barcode?: string; name?: string };
  onSaved(food: Food): void;
  onCancel(): void;
}

const NUTRIENT_FIELDS: { key: NutrientKey; label: string; unit: string }[] = [
  { key: 'kcal', label: 'Calories (required)', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Total carbs', unit: 'g' },
  { key: 'fiber', label: 'Fiber', unit: 'g' },
  { key: 'sugar', label: 'Sugar', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'satFat', label: 'Sat fat', unit: 'g' },
  { key: 'sodium', label: 'Sodium', unit: 'mg' },
];

function raw(n: number | null): string {
  return n === null ? '' : String(n);
}

/**
 * Create or edit a food (SPEC 3.5). Saving a remote (usda/off) food never edits it: the edits go
 * to a custom override via `foods.saveOverride`.
 */
export function FoodForm({ initial, prefill, onSaved, onCancel }: FoodFormProps) {
  const [draft, setDraft] = useState<FoodDraft>(() =>
    initial ? draftFromFood(initial) : emptyDraft(prefill),
  );
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const patch = (p: Partial<FoodDraft>) => setDraft((d) => ({ ...d, ...p }));
  const isRemote = initial !== undefined && initial.source !== 'custom';
  const unit = draft.baseUnit;
  const perLabel =
    draft.mode === 'serving' ? `per ${draft.nutLabel.trim() || 'serving'}` : `per 100 ${unit}`;

  const save = async () => {
    const res = buildFoodFields(draft);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const favoriteAt = draft.favorite ? (initial?.favoriteAt ?? nowIso()) : null;
      const f = res.fields;
      const lastAmount =
        initial?.lastAmount &&
        (initial.lastAmount.unit.kind === 'base' ||
          f.servings.some(
            (s) =>
              initial.lastAmount?.unit.kind === 'serving' &&
              s.id === initial.lastAmount.unit.servingId,
          ))
          ? initial.lastAmount
          : null;
      let saved: Food;
      if (initial && isRemote) {
        saved = await foods.saveOverride(initial, { ...f, favoriteAt });
      } else if (initial) {
        saved = await foods.save({ ...initial, ...f, favoriteAt, lastAmount });
      } else {
        const now = nowIso();
        saved = await foods.save({
          ...f,
          id: newId(),
          source: 'custom',
          sourceId: null,
          overrides: null,
          lastAmount: null,
          useCount: 0,
          lastUsedAt: null,
          favoriteAt,
          deletedAt: null,
          fetchedAt: null,
          createdAt: now,
          updatedAt: now,
        });
      }
      onSaved(saved);
    } finally {
      setSaving(false);
    }
  };

  const defaultKey = draft.defaultKey ?? (draft.mode === 'serving' ? NUTRITION_KEY : null);

  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {isRemote ? (
        <p className="rounded-card border border-hairline bg-surface p-3 text-sm text-muted">
          This food comes from {initial.source === 'usda' ? 'USDA' : 'Open Food Facts'}. Saving
          creates your own version and leaves the original untouched.
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <TextField
          label="Name"
          value={draft.name}
          onChange={(name) => patch({ name })}
          error={errors.name}
          autoComplete="off"
        />
        <TextField
          label="Brand"
          value={draft.brand}
          onChange={(brand) => patch({ brand })}
          autoComplete="off"
        />
        <div className="flex items-start gap-2">
          <TextField
            className="min-w-0 flex-1"
            label="Barcode"
            value={draft.barcode}
            inputMode="numeric"
            onChange={(barcode) => patch({ barcode })}
            onBlur={() => {
              const n = normaliseBarcode(draft.barcode.trim());
              if (n) patch({ barcode: n });
            }}
            error={errors.barcode}
            autoComplete="off"
          />
          <IconButton
            aria-label="Scan barcode"
            className="mt-5 rounded-card border border-hairline-strong bg-raised"
            onPointerEnter={prefetchScanner}
            onClick={() => setScanning(true)}
          >
            <ScanBarcode size={20} aria-hidden="true" />
          </IconButton>
        </div>
        {scanning ? (
          <Suspense fallback={null}>
            <ScannerView
              onClose={() => setScanning(false)}
              onDetected={(code) => {
                setScanning(false);
                patch({ barcode: normaliseBarcode(code) ?? code });
              }}
            />
          </Suspense>
        ) : null}
        <Field label="Base unit">
          <Segmented
            label="Base unit"
            value={draft.baseUnit}
            options={[
              { value: 'g', label: 'Grams (g)' },
              { value: 'ml', label: 'Millilitres (ml)' },
            ]}
            onChange={(baseUnit) => patch({ baseUnit })}
          />
        </Field>
      </div>

      <section aria-label="Nutrition" className="flex flex-col gap-3">
        <Field label="Nutrition per">
          <Segmented
            label="Nutrition per"
            value={draft.mode}
            options={[
              { value: 'serving', label: 'One serving' },
              { value: 'per100', label: `100 ${unit}` },
            ]}
            onChange={(mode) => patch({ mode })}
          />
        </Field>

        {draft.mode === 'serving' ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-end gap-2">
              <TextField
                label="Serving label"
                className="flex-[2]"
                value={draft.nutLabel}
                onChange={(nutLabel) => patch({ nutLabel })}
                placeholder="1 bar"
                autoComplete="off"
              />
              <div className="flex-1">
                <span className="micro mb-1 block">Amount ({unit})</span>
                <NumberField
                  label="Serving amount"
                  defaultValue={raw(draft.nutAmount)}
                  onChange={(nutAmount) => patch({ nutAmount })}
                />
              </div>
            </div>
            {errors.nutServing ? (
              <p role="alert" className="text-xs text-danger">
                {errors.nutServing}
              </p>
            ) : (
              <p className="text-xs text-muted">
                e.g. 1 bar = 45 {unit}. Values below are for one serving.
              </p>
            )}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          {NUTRIENT_FIELDS.map((n) => (
            <div key={n.key}>
              <span className="micro mb-1 block">
                {n.label} ({n.unit})
              </span>
              <NumberField
                label={`${n.label.replace(' (required)', '')} ${perLabel}`}
                defaultValue={raw(draft.values[n.key])}
                onChange={(v) => setDraft((d) => ({ ...d, values: { ...d.values, [n.key]: v } }))}
                aria-invalid={n.key === 'kcal' && errors.kcal ? true : undefined}
              />
              {n.key === 'kcal' && errors.kcal ? (
                <p role="alert" className="mt-1 text-xs text-danger">
                  {errors.kcal}
                </p>
              ) : null}
            </div>
          ))}
        </div>
        <p className="num text-sm text-ink" data-testid="net-carbs">
          Net carbs = {formatNumber(netCarbsOf(draft.values))} g{' '}
          <span className="text-muted">(total carbs − fiber)</span>
        </p>
        <p className="text-xs text-muted">
          Leave a field blank if the label does not say; blank is not the same as 0. On EU labels
          carbohydrate already excludes fiber, so net carbs come out too low: enter total carbs as
          carbs plus fiber, or fix the product here after importing it.
        </p>
      </section>

      <section aria-label="Servings" className="flex flex-col gap-3">
        <h2 className="micro">Servings</h2>
        {draft.mode === 'serving' ? (
          <Card tone="raised" className="flex items-center gap-2 p-3">
            <span className="min-w-0 flex-1 truncate text-sm text-ink">
              {draft.nutLabel.trim() || 'serving'} ={' '}
              <span className="num">
                {draft.nutAmount === null ? '?' : formatNumber(draft.nutAmount)} {unit}
              </span>
            </span>
            <DefaultRadio
              checked={defaultKey === NUTRITION_KEY}
              label="Default serving: nutrition serving"
              onSelect={() => patch({ defaultKey: NUTRITION_KEY })}
            />
          </Card>
        ) : null}
        {draft.servings.map((s) => (
          <div key={s.key} className="flex items-center gap-2">
            <input
              type="text"
              aria-label="Serving label"
              placeholder="1 scoop"
              value={s.label}
              onChange={(e) =>
                patch({
                  servings: draft.servings.map((x) =>
                    x.key === s.key ? { ...x, label: e.target.value } : x,
                  ),
                })
              }
              className="h-12 min-w-0 flex-[2] rounded-card border border-hairline-strong bg-raised px-3 text-ink"
              style={{ fontSize: 16 }}
            />
            <NumberField
              className="min-w-0 flex-1"
              label={`Amount in ${unit} of ${s.label || 'serving'}`}
              defaultValue={raw(s.amount)}
              suffix={unit}
              onChange={(amount) =>
                setDraft((d) => ({
                  ...d,
                  servings: d.servings.map((x) => (x.key === s.key ? { ...x, amount } : x)),
                }))
              }
            />
            <DefaultRadio
              checked={defaultKey === s.key}
              label={`Default serving: ${s.label || 'new serving'}`}
              onSelect={() => patch({ defaultKey: s.key })}
            />
            <button
              type="button"
              aria-label={`Remove serving ${s.label || ''}`.trim()}
              onClick={() =>
                patch({
                  servings: draft.servings.filter((x) => x.key !== s.key),
                  defaultKey: draft.defaultKey === s.key ? null : draft.defaultKey,
                })
              }
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-btn text-muted"
            >
              <Trash2 size={20} aria-hidden="true" />
            </button>
          </div>
        ))}
        {errors.servings ? (
          <p role="alert" className="text-xs text-danger">
            {errors.servings}
          </p>
        ) : null}
        <Button
          variant="secondary"
          onClick={() => patch({ servings: [...draft.servings, newDraftServing()] })}
          className="self-start"
        >
          <Plus size={16} aria-hidden="true" />
          Add serving
        </Button>
      </section>

      <button
        type="button"
        aria-pressed={draft.favorite}
        onClick={() => patch({ favorite: !draft.favorite })}
        className="flex min-h-touch items-center gap-2 self-start rounded-btn text-sm text-ink"
      >
        <Star
          size={22}
          aria-hidden="true"
          className={draft.favorite ? 'fill-current text-accent' : 'text-muted'}
        />
        Favourite
      </button>

      <div className="flex gap-2">
        <Button variant="secondary" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={saving} className="flex-[2]">
          {isRemote ? 'Save my version' : 'Save food'}
        </Button>
      </div>
    </form>
  );
}

function DefaultRadio({
  checked,
  label,
  onSelect,
}: {
  checked: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <label className="flex h-12 w-12 shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5">
      <input
        type="radio"
        name="default-serving"
        aria-label={label}
        checked={checked}
        onChange={onSelect}
        className="h-5 w-5 accent-[var(--accent-ink)]"
      />
      <span className="micro text-[9px]" aria-hidden="true">
        Default
      </span>
    </label>
  );
}
