import { useState } from 'react';
import * as weighIns from '../../db/repositories/weighIns';
import { lbToKg } from '../../domain/units';
import type { WeighIn } from '../../domain/types';
import { fromDateKey } from '../../lib/dates';
import { changesFromPrevious, formatChange } from '../charts/weightData';
import { Button, ConfirmDialog, Sheet } from '../ui';
import { WeighInForm } from './LogTodayCard';

const dateFmt = (key: string) =>
  (fromDateKey(key) ?? new Date(0)).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

/** Newest-first list; tap a row to edit or delete it. */
export function WeighInList({ items }: { items: readonly WeighIn[] }) {
  const [editing, setEditing] = useState<WeighIn | null>(null);
  const [confirming, setConfirming] = useState(false);
  const changes = changesFromPrevious(items);
  return (
    <>
      <ul
        className="overflow-hidden rounded-card border border-hairline bg-surface"
        data-testid="weighin-list"
      >
        {items.map((w) => {
          const delta = changes.get(w.id) ?? null;
          return (
            <li key={w.id} className="border-b border-hairline last:border-b-0">
              <button
                type="button"
                data-testid="weighin-row"
                onClick={() => setEditing(w)}
                className="flex min-h-touch w-full items-center gap-3 px-4 py-2 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{dateFmt(w.date)}</span>
                  {w.bodyFatPct !== null ? (
                    <span className="num block text-xs text-muted">{w.bodyFatPct}% body fat</span>
                  ) : null}
                </span>
                <span className="text-right">
                  <span className="num block text-sm font-semibold text-ink">
                    {w.weightLb.toFixed(1)} lb
                  </span>
                  <span className="num block text-xs text-muted">
                    {lbToKg(w.weightLb).toFixed(1)} kg
                  </span>
                </span>
                <span className="num w-12 text-right text-xs text-muted">
                  {delta === null ? '' : formatChange(delta)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <Sheet
        open={editing !== null && !confirming}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${dateFmt(editing.date)}` : 'Edit weigh-in'}
      >
        {editing ? (
          <div className="flex flex-col gap-3">
            <WeighInForm
              key={editing.id}
              initial={editing}
              submitLabel="Save"
              onSubmit={async (v) => {
                await weighIns.update(editing.id, v.weightLb, v.bodyFatPct);
                setEditing(null);
              }}
            />
            <Button variant="danger" fullWidth onClick={() => setConfirming(true)}>
              Delete
            </Button>
          </div>
        ) : null}
      </Sheet>
      <ConfirmDialog
        open={editing !== null && confirming}
        title="Delete weigh-in?"
        message={
          editing ? `${dateFmt(editing.date)}, ${editing.weightLb.toFixed(1)} lb` : undefined
        }
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (editing) await weighIns.remove(editing.id);
          setConfirming(false);
          setEditing(null);
        }}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
