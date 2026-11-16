import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft } from 'lucide-react';
import { foods } from '../db/repositories';
import { FoodForm } from '../components/foods/FoodForm';
import { netCarbsOf } from '../components/foods/foodDraft';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  IconButton,
  PageHeader,
  useToast,
} from '../components/ui';
import { formatKcal, formatNumber } from '../domain/units';
import type { Food, NutrientKey } from '../domain/types';

const ROWS: { key: NutrientKey; label: string; unit: string }[] = [
  { key: 'kcal', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Total carbs', unit: 'g' },
  { key: 'fiber', label: 'Fiber', unit: 'g' },
  { key: 'sugar', label: 'Sugar', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'satFat', label: 'Sat fat', unit: 'g' },
  { key: 'sodium', label: 'Sodium', unit: 'mg' },
];

function BackLink() {
  return (
    <Link
      to="/foods"
      aria-label="Back to Foods"
      className="-ml-2 inline-flex h-12 w-12 items-center justify-center rounded-btn text-ink"
    >
      <ArrowLeft size={22} aria-hidden="true" />
    </Link>
  );
}

function ReadOnlyFood({ food, onEdit }: { food: Food; onEdit: () => void }) {
  return (
    <div className="flex flex-col gap-4 px-gutter">
      <p className="text-sm text-muted">
        From {food.source === 'usda' ? 'USDA FoodData Central' : 'Open Food Facts'}. This copy is
        read-only; edit it to save your own version.
      </p>
      <Card>
        <h2 className="micro mb-2">Nutrition per 100 {food.baseUnit}</h2>
        <dl className="num grid grid-cols-[1fr_auto] gap-y-1 text-sm">
          {ROWS.map((r) => (
            <div key={r.key} className="contents">
              <dt className="text-muted">{r.label}</dt>
              <dd className="text-right text-ink">
                {food.per100[r.key] === null
                  ? '-'
                  : `${r.key === 'kcal' ? formatKcal(food.per100.kcal ?? 0) : formatNumber(food.per100[r.key] ?? 0)} ${r.unit}`}
              </dd>
            </div>
          ))}
          <dt className="text-muted">Net carbs</dt>
          <dd className="text-right text-ink">{formatNumber(netCarbsOf(food.per100))} g</dd>
        </dl>
      </Card>
      {food.servings.length > 0 ? (
        <Card>
          <h2 className="micro mb-2">Servings</h2>
          <ul className="text-sm text-ink">
            {food.servings.map((s) => (
              <li key={s.id}>
                {s.label} = {formatNumber(s.amount)} {food.baseUnit}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Button onClick={onEdit}>Edit (save my version)</Button>
    </div>
  );
}

export default function FoodEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // undefined = loading, null = not found. An original with a live override opens the override.
  const loaded = useLiveQuery(async () => {
    if (!id) return null;
    const f = (await foods.get(id)) ?? null;
    if (f === null || f.deletedAt !== null) return null;
    const key = foods.overrideKeyOf(f);
    const override = key && f.source !== 'custom' ? await foods.byOverrideKey(key) : undefined;
    return override ?? f;
  }, [id]);

  const back = <BackLink />;
  const done = () => navigate('/foods', { replace: true });

  if (!id) {
    return (
      <>
        <PageHeader title="New food" back={back} />
        <div className="px-gutter">
          <FoodForm
            prefill={{
              barcode: params.get('barcode') ?? undefined,
              name: params.get('name') ?? undefined,
            }}
            onSaved={done}
            onCancel={() => navigate(-1)}
          />
        </div>
      </>
    );
  }

  if (loaded === undefined) return <PageHeader title="Food" back={back} />;
  if (loaded === null) {
    return (
      <>
        <PageHeader title="Food" back={back} />
        <div className="px-gutter">
          <EmptyState title="Food not found" description="It may have been deleted." />
        </div>
      </>
    );
  }

  const food = loaded;
  const remote = food.source !== 'custom';

  return (
    <>
      <PageHeader
        title={editing || !remote ? 'Edit food' : food.name}
        subtitle={food.brand ?? undefined}
        back={back}
        action={
          !remote ? (
            <IconButton aria-label="Delete food" onClick={() => setConfirmDelete(true)}>
              <span className="text-xs font-semibold text-danger">Delete</span>
            </IconButton>
          ) : null
        }
      />
      <div className={remote && !editing ? '' : 'px-gutter'}>
        {remote && !editing ? (
          <ReadOnlyFood food={food} onEdit={() => setEditing(true)} />
        ) : (
          <FoodForm
            key={food.id}
            initial={food}
            onSaved={done}
            onCancel={() => (remote ? setEditing(false) : navigate(-1))}
          />
        )}
      </div>
      <ConfirmDialog
        open={confirmDelete}
        destructive
        title={`Delete ${food.name}?`}
        message="It disappears from your lists and search. Past diary entries keep their nutrition."
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          void foods.softDelete(food.id).then(() => {
            toast.show({ message: `Deleted ${food.name}` });
            done();
          });
        }}
      />
    </>
  );
}
