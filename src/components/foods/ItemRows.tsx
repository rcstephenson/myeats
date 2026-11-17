import { useState, type ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { buildIndex, search } from '../../domain/search';
import { formatKcal, type UnitOption } from '../../domain/units';
import type { Food, Recipe, RemoteFood, UnitRef } from '../../domain/types';
import { useSettings } from '../../hooks/useSettings';
import { resolveUsdaKey } from '../../sources/usdaKey';
import { saveRemoteFood } from '../add/remoteFood';
import { dedupeRemote, remoteRow } from '../add/results';
import { useUsdaSearch } from '../add/useUsdaSearch';
import { Button, Card, NumberField, SearchField, Sheet } from '../ui';
import { SelectField } from './fields';
import { FoodForm } from './FoodForm';
import { visibleFoods } from './library';

export type DraftItem = {
  key: string;
  kind: 'food' | 'recipe';
  refId: string;
  /** null while the field is blank or invalid. */
  amount: number | null;
  unit: UnitRef;
};

const unitValue = (u: UnitRef): string => (u.kind === 'base' ? 'base' : `s:${u.servingId}`);
const parseUnit = (v: string): UnitRef =>
  v === 'base' ? { kind: 'base' } : { kind: 'serving', servingId: v.slice(2) };

export interface ItemRowProps {
  draft: DraftItem;
  name: string;
  subtitle?: string;
  options: UnitOption[];
  /** null when the food/recipe was deleted. */
  kcal: number | null;
  handle?: ReactNode;
  onChange: (next: DraftItem) => void;
  onRemove: () => void;
}

/** One item of a meal or recipe: name, amount, unit, kcal, remove. */
export function ItemRow({
  draft,
  name,
  subtitle,
  options,
  kcal,
  handle,
  onChange,
  onRemove,
}: ItemRowProps) {
  return (
    <Card tone="raised" className="p-3" role="group" aria-label={name}>
      <div className="flex items-center gap-1">
        {handle}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{name}</p>
          {subtitle ? <p className="truncate text-xs text-muted">{subtitle}</p> : null}
        </div>
        <span className="num shrink-0 text-xs text-muted">
          {kcal === null ? '-' : `${formatKcal(kcal)} kcal`}
        </span>
        <button
          type="button"
          aria-label={`Remove ${name}`}
          onClick={onRemove}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-btn text-muted"
        >
          <Trash2 size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <NumberField
          className="min-w-0 flex-1"
          label={`Amount of ${name}`}
          defaultValue={draft.amount === null ? '' : String(draft.amount)}
          onChange={(amount) => onChange({ ...draft, amount })}
        />
        <SelectField
          label={`Unit for ${name}`}
          className="min-w-0 flex-1"
          value={unitValue(draft.unit)}
          options={options.map((o) => ({ value: unitValue(o.unit), label: o.label }))}
          onChange={(v) => onChange({ ...draft, unit: parseUnit(v) })}
        />
      </div>
    </Card>
  );
}

/** ItemRow with a dnd-kit drag handle. Must be inside a SortableContext. */
export function SortableItemRow(props: Omit<ItemRowProps, 'handle'>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.draft.key });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition,
        position: 'relative',
        zIndex: isDragging ? 10 : undefined,
      }}
    >
      <ItemRow
        {...props}
        handle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            aria-label={`Reorder ${props.name}`}
            className="-ml-2 inline-flex h-12 w-12 shrink-0 touch-none items-center justify-center rounded-btn text-muted"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={22} aria-hidden="true" />
          </button>
        }
      />
    </div>
  );
}

export type Picked = { kind: 'food'; food: Food } | { kind: 'recipe'; recipe: Recipe };

export interface ItemPickerProps {
  open: boolean;
  title: string;
  foods: readonly Food[];
  /** Omit for foods-only (recipes cannot nest). */
  recipes?: readonly Recipe[];
  onPick: (pick: Picked) => void;
  onClose: () => void;
}

/**
 * Picks an item for a meal or recipe: local search over the user's foods (and recipes), USDA
 * results below them, and Create food. A USDA result or a newly created food is saved to the
 * user's foods and handed straight to `onPick`.
 */
export function ItemPicker({ open, title, foods, recipes, onPick, onClose }: ItemPickerProps) {
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const query = q.trim();
  const settings = useSettings();
  const apiKey = resolveUsdaKey(settings?.usdaApiKey ?? null).key;
  const usda = useUsdaSearch(open && !creating ? query : '', apiKey);
  const remoteRows = dedupeRemote(usda.results, foods).map((r) => remoteRow(r, usda.cached));

  const finish = (pick: Picked) => {
    setQ('');
    setCreating(false);
    onPick(pick);
  };
  const pickRemote = async (remote: RemoteFood) => {
    if (saving) return;
    setSaving(true);
    try {
      finish({ kind: 'food', food: await saveRemoteFood(remote, apiKey) });
    } finally {
      setSaving(false);
    }
  };
  const index = buildIndex(visibleFoods(foods), recipes ?? [], [], new Date());
  const hits = query === '' ? [] : search(index, query, 30);
  const idle: Picked[] =
    query === ''
      ? [
          ...visibleFoods(foods)
            .slice(0, 20)
            .map((food): Picked => ({ kind: 'food', food })),
          ...(recipes ?? []).slice(0, 10).map((recipe): Picked => ({ kind: 'recipe', recipe })),
        ]
      : [];
  const rows: Picked[] = [
    ...idle,
    ...hits.flatMap((h): Picked[] =>
      h.kind === 'food'
        ? [{ kind: 'food', food: h.item }]
        : h.kind === 'recipe'
          ? [{ kind: 'recipe', recipe: h.item }]
          : [],
    ),
  ];
  const close = () => {
    setQ('');
    setCreating(false);
    onClose();
  };

  if (creating) {
    return (
      <Sheet open={open} onClose={close} title="Create food">
        <FoodForm
          prefill={query ? { name: query } : undefined}
          onSaved={(food) => finish({ kind: 'food', food })}
          onCancel={() => setCreating(false)}
        />
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onClose={close} title={title}>
      <SearchField value={q} onChange={setQ} placeholder="Search foods" />
      <Button variant="secondary" className="mt-3" onClick={() => setCreating(true)}>
        <Plus size={16} aria-hidden="true" /> Create food
      </Button>
      {query ? <p className="micro mt-4">Your foods</p> : null}
      <ul className="mt-1">
        {rows.map((r) => {
          const id = r.kind === 'food' ? r.food.id : r.recipe.id;
          const name = r.kind === 'food' ? r.food.name : r.recipe.name;
          const brand = r.kind === 'food' ? r.food.brand : null;
          return (
            <li key={`${r.kind}:${id}`}>
              <button
                type="button"
                onClick={() => {
                  setQ('');
                  onPick(r);
                }}
                className="flex min-h-touch w-full items-center gap-2 border-b border-hairline py-2 text-left"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                  {name}
                  {brand ? <span className="text-muted"> · {brand}</span> : null}
                </span>
                {r.kind === 'recipe' ? <span className="micro">Recipe</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {rows.length === 0 ? (
        <p className="py-4 text-sm text-muted">
          {query ? 'No matches in your foods.' : 'No foods yet. Search USDA or create one.'}
        </p>
      ) : null}
      {query ? (
        <>
          <p className="micro mt-4">USDA</p>
          {remoteRows.length > 0 ? (
            <ul aria-label="USDA results" className="mt-1">
              {remoteRows.map((r) => (
                <li key={r.key}>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void pickRemote(r.remote)}
                    className="flex min-h-touch w-full items-center gap-2 border-b border-hairline py-2 text-left"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">
                      {r.name}
                      {r.brand ? <span className="text-muted"> · {r.brand}</span> : null}
                    </span>
                    <span className="num text-xs text-muted">{r.kcal}</span>
                    {r.tag ? <span className="micro">{r.tag}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="py-3 text-sm text-muted" aria-live="polite">
            {usda.status === 'loading'
              ? 'Searching USDA…'
              : usda.status === 'offline'
                ? 'Offline: showing saved foods only'
                : usda.status === 'busy'
                  ? 'USDA search is busy, try again in a minute'
                  : usda.status === 'error'
                    ? 'USDA search failed'
                    : usda.status === 'done' && remoteRows.length === 0
                      ? 'No USDA matches'
                      : ''}
          </p>
        </>
      ) : null}
    </Sheet>
  );
}
