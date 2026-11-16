import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { formatNumber, lbToKg } from '../../domain/units';
import type { WeighIn } from '../../domain/types';
import { Button, NumberField } from '../ui';
import { Panel } from '../add/Panel';

export interface WeighInRowProps {
  weighIn: WeighIn | undefined;
  /** Past days only show an existing weigh-in; there is nothing to log. */
  canLog: boolean;
  onSave: (weightLb: number, bodyFatPct: number | null) => void;
}

const oneDecimal = (n: number): string => (Math.round(n * 10) / 10).toFixed(1);

/** Weigh-in row (SPEC 3.1.4) with its inline sheet. */
export function WeighInRow({ weighIn, canLog, onSave }: WeighInRowProps) {
  const [open, setOpen] = useState(false);
  const [lb, setLb] = useState<number | null>(null);
  const [bf, setBf] = useState<number | null>(null);

  const row = 'mt-4 flex min-h-touch items-center justify-between border-y border-hairline px-gutter';
  const valid = lb !== null && lb > 0 && (bf === null || bf <= 100);

  return (
    <>
      {weighIn ? (
        <Link to="/weight" className={`${row} active:bg-surface`} aria-label="Weigh-in, open Weight">
          <span className="micro">Weigh-in</span>
          <span className="num text-sm text-ink">
            {oneDecimal(weighIn.weightLb)} lb · {oneDecimal(lbToKg(weighIn.weightLb))} kg
            {weighIn.bodyFatPct !== null ? ` · ${formatNumber(weighIn.bodyFatPct)}%` : ''}
          </span>
        </Link>
      ) : canLog ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`${row} w-full text-left active:bg-surface`}
        >
          <span className="micro">Weigh-in</span>
          <span className="flex items-center gap-1 text-sm font-semibold text-accent">
            Log weight <Plus size={16} aria-hidden="true" />
          </span>
        </button>
      ) : null}
      {open ? (
        <Panel
          open
          onClose={() => setOpen(false)}
          title="Log weight"
          footer={
            <Button
              fullWidth
              disabled={!valid}
              onClick={() => {
                if (valid) {
                  onSave(lb, bf);
                  setOpen(false);
                }
              }}
            >
              Save
            </Button>
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Weight lb
              <NumberField label="Weight" autoFocus onChange={setLb} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Body fat % (optional)
              <NumberField label="Body fat" onChange={setBf} />
            </label>
          </div>
          <p className="num mt-2 text-xs text-muted">
            {lb !== null && lb > 0 ? `= ${oneDecimal(lbToKg(lb))} kg` : ' '}
          </p>
        </Panel>
      ) : null}
    </>
  );
}
