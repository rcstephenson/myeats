import { useState, type ReactNode } from 'react';
import { formatKcal } from '../../domain/units';
import { Button, NumberField } from '../ui';
import { Panel } from './Panel';

export type QuickValues = {
  label: string | null;
  kcal: number | null;
  protein: number | null;
  netCarbs: number | null;
  fat: number | null;
};

export interface QuickAddPanelProps {
  title?: string;
  submitLabel?: string;
  initial?: Partial<{ label: string; kcal: number; protein: number; netCarbs: number; fat: number }>;
  onSubmit: (v: QuickValues) => void;
  onClose: () => void;
  /** Extra controls under the fields (e.g. category picker, delete). */
  children?: ReactNode;
}

const text = (n: number | undefined): string => (n === undefined ? '' : String(n));

/** Derived kcal at 4/4/9 when kcal is blank (SPEC 3.2); null when nothing to derive from. */
export function quickPreviewKcal(v: Omit<QuickValues, 'label'>): number | null {
  if (v.kcal !== null) return v.kcal;
  if (v.protein === null && v.netCarbs === null && v.fat === null) return null;
  return Math.round(4 * (v.protein ?? 0) + 4 * (v.netCarbs ?? 0) + 9 * (v.fat ?? 0));
}

/** Quick add sheet (SPEC 3.2): optional label, kcal, protein, net carbs, fat. Only kcal is required. */
export function QuickAddPanel({
  title = 'Quick add',
  submitLabel = 'Add',
  initial,
  onSubmit,
  onClose,
  children,
}: QuickAddPanelProps) {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [v, setV] = useState({
    kcal: initial?.kcal ?? null,
    protein: initial?.protein ?? null,
    netCarbs: initial?.netCarbs ?? null,
    fat: initial?.fat ?? null,
  } as Omit<QuickValues, 'label'>);
  const derived = quickPreviewKcal(v);
  const ok = derived !== null && derived >= 0;
  const set = (k: keyof typeof v) => (n: number | null) => setV((s) => ({ ...s, [k]: n }));
  const submit = () => {
    if (ok) onSubmit({ ...v, label: label.trim() || null });
  };

  return (
    <Panel
      open
      onClose={onClose}
      title={title}
      footer={
        <Button fullWidth disabled={!ok} onClick={submit}>
          {submitLabel}
        </Button>
      }
    >
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="col-span-2 flex flex-col gap-1 text-xs text-muted">
          Label (optional)
          <input
            type="text"
            aria-label="Label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            enterKeyHint="next"
            autoComplete="off"
            className="h-12 rounded-card border border-hairline-strong bg-raised px-3 text-ink"
            style={{ fontSize: 16 }}
            placeholder="Quick add"
          />
        </label>
        <Field label="kcal">
          <NumberField
            label="kcal"
            autoFocus
            defaultValue={text(initial?.kcal)}
            onChange={set('kcal')}
            placeholder={derived !== null && v.kcal === null ? `≈${formatKcal(derived)}` : ''}
          />
        </Field>
        <Field label="Protein g">
          <NumberField label="Protein" defaultValue={text(initial?.protein)} onChange={set('protein')} />
        </Field>
        <Field label="Net carbs g">
          <NumberField
            label="Net carbs"
            defaultValue={text(initial?.netCarbs)}
            onChange={set('netCarbs')}
          />
        </Field>
        <Field label="Fat g">
          <NumberField label="Fat" defaultValue={text(initial?.fat)} onChange={set('fat')} />
        </Field>
      </form>
      {children}
    </Panel>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 text-xs text-muted">
      <span>{label}</span>
      {children}
    </div>
  );
}
