import { useState } from 'react';
import * as weighIns from '../../db/repositories/weighIns';
import { lbToKg } from '../../domain/units';
import type { WeighIn } from '../../domain/types';
import { Button, Card, NumberField } from '../ui';

export const MAX_LB = 1500;

/** Validated, 1 dp weight and optional body fat; null when the weight is unusable. */
export function readWeighInInput(
  lb: number | null,
  fat: number | null,
  fatRaw: string,
): { weightLb: number; bodyFatPct: number | null } | null {
  if (lb === null || lb <= 0 || lb > MAX_LB) return null;
  let bodyFatPct: number | null = null;
  if (fatRaw.trim() !== '') {
    if (fat === null || fat <= 0 || fat >= 100) return null;
    bodyFatPct = Math.round(fat * 10) / 10;
  }
  return { weightLb: Math.round(lb * 10) / 10, bodyFatPct };
}

export interface WeighInFormProps {
  initial?: WeighIn;
  submitLabel: string;
  onSubmit: (v: { weightLb: number; bodyFatPct: number | null }) => void | Promise<void>;
}

/** Weight (lb) with a live kg read-out, optional body fat %, and a submit button. */
export function WeighInForm({ initial, submitLabel, onSubmit }: WeighInFormProps) {
  const [lb, setLb] = useState<number | null>(initial ? initial.weightLb : null);
  const [fat, setFat] = useState<number | null>(initial?.bodyFatPct ?? null);
  const [fatRaw, setFatRaw] = useState(
    initial?.bodyFatPct != null ? String(initial.bodyFatPct) : '',
  );
  const parsed = readWeighInInput(lb, fat, fatRaw);
  const kg = lb !== null && lb > 0 && lb <= MAX_LB ? lbToKg(Math.round(lb * 10) / 10) : null;
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (parsed) void onSubmit(parsed);
      }}
    >
      <div>
        <NumberField
          label="Weight in lb"
          suffix="lb"
          large
          defaultValue={initial ? initial.weightLb.toFixed(1) : ''}
          placeholder="0.0"
          onChange={(v) => setLb(v)}
        />
        <p className="num mt-1 min-h-[22px] text-sm text-muted" data-testid="kg-readout">
          {kg !== null ? `= ${kg.toFixed(1)} kg` : ''}
        </p>
      </div>
      <NumberField
        label="Body fat %"
        suffix="% body fat"
        defaultValue={initial?.bodyFatPct != null ? String(initial.bodyFatPct) : ''}
        placeholder="Optional"
        onChange={(v, raw) => {
          setFat(v);
          setFatRaw(raw);
        }}
      />
      <Button type="submit" fullWidth disabled={!parsed}>
        {submitLabel}
      </Button>
    </form>
  );
}

/** Today's card: logs a weigh-in, or edits today's when it exists. */
export function LogTodayCard({ today, existing }: { today: string; existing?: WeighIn }) {
  return (
    <Card tone="raised" data-testid="log-today">
      <h2 className="micro mb-3">{existing ? 'Today (edit)' : 'Log today'}</h2>
      <WeighInForm
        key={existing ? `${existing.id}:${existing.updatedAt}` : 'new'}
        initial={existing}
        submitLabel={existing ? 'Update' : 'Save'}
        onSubmit={async (v) => {
          await weighIns.saveToday(v.weightLb, v.bodyFatPct, today);
        }}
      />
    </Card>
  );
}
