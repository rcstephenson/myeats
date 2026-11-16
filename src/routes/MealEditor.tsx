import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ArrowLeft, Plus } from 'lucide-react';
import { entries as entriesRepo, meals as mealsRepo } from '../db/repositories';
import {
  ItemPicker,
  SortableItemRow,
  type DraftItem,
  type Picked,
} from '../components/foods/ItemRows';
import { SelectField, TextField } from '../components/foods/fields';
import { itemsFromEntries, mealItemNutrients, mealTotals } from '../components/foods/mealMath';
import { Button, Card, ConfirmDialog, EmptyState, PageHeader, useToast } from '../components/ui';
import { activeCategories, defaultCategory } from '../domain/categories';
import { netCarbs } from '../domain/nutrients';
import { recipeUnitOptions } from '../domain/recipes';
import { defaultUnit, formatGrams, formatKcal, unitOptions } from '../domain/units';
import type { Entry, Food, MealItem, Recipe, SavedMeal } from '../domain/types';
import { nowIso } from '../lib/dates';
import { newId } from '../lib/ids';
import { useCategories } from '../hooks/useCategories';
import { useFoods } from '../hooks/useFoods';
import { useRecipes } from '../hooks/useRecipes';

const toDraft = (i: MealItem): DraftItem => ({
  key: newId(),
  kind: i.kind,
  refId: i.refId,
  amount: i.amount,
  unit: i.unit,
});

/** Starting amount for a freshly picked food or recipe. */
function startingItem(p: Picked): DraftItem {
  if (p.kind === 'recipe') {
    return {
      key: newId(),
      kind: 'recipe',
      refId: p.recipe.id,
      amount: 1,
      unit: { kind: 'serving', servingId: 'serving' },
    };
  }
  const f = p.food;
  const last = f.lastAmount;
  const lastOk =
    last &&
    (last.unit.kind === 'base' ||
      f.servings.some((s) => last.unit.kind === 'serving' && s.id === last.unit.servingId));
  const unit = lastOk && last ? last.unit : defaultUnit(f);
  return {
    key: newId(),
    kind: 'food',
    refId: f.id,
    amount: lastOk && last ? last.amount : unit.kind === 'serving' ? 1 : 100,
    unit,
  };
}

function MealForm({
  meal,
  initialItems,
  skippedQuick,
  initialCategoryId,
  foods,
  recipes,
}: {
  meal: SavedMeal | null;
  initialItems: MealItem[];
  skippedQuick: number;
  initialCategoryId: string | null;
  foods: Food[];
  recipes: Recipe[];
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const categories = useCategories();
  const [name, setName] = useState(meal?.name ?? '');
  const [categoryId, setCategoryId] = useState<string>(
    meal?.defaultCategoryId ?? initialCategoryId ?? '',
  );
  const [items, setItems] = useState<DraftItem[]>(() => initialItems.map(toDraft));
  const [picking, setPicking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const foodMap = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const recipeMap = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const asMealItem = (d: DraftItem): MealItem | null =>
    d.amount !== null && d.amount > 0
      ? { kind: d.kind, refId: d.refId, amount: d.amount, unit: d.unit }
      : null;
  const valid = items.map(asMealItem).filter((i): i is MealItem => i !== null);
  const totals = mealTotals(valid, foodMap, recipeMap);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((d) => d.key === active.id);
    const to = items.findIndex((d) => d.key === over.id);
    if (from >= 0 && to >= 0) setItems(arrayMove(items, from, to));
  };

  const save = async () => {
    if (!name.trim()) return setError('Name is required');
    if (items.length === 0) return setError('Add at least one item');
    if (valid.length !== items.length) return setError('Every item needs an amount above 0');
    setError(null);
    const now = nowIso();
    const base: SavedMeal = meal ?? {
      id: newId(),
      name: '',
      nameLower: '',
      items: [],
      defaultCategoryId: null,
      useCount: 0,
      lastUsedAt: null,
      favoriteAt: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await mealsRepo.save({
      ...base,
      name: name.trim(),
      items: valid,
      defaultCategoryId: categoryId || null,
    });
    navigate('/foods?tab=meals', { replace: true });
  };

  const logToToday = () => {
    if (!meal) return;
    const cats = activeCategories(categories ?? []);
    const target = categoryId || defaultCategory(new Date(), cats)?.id || cats[0]?.id || '';
    navigate(`/?add=${encodeURIComponent(target)}&meal=${encodeURIComponent(meal.id)}`);
  };

  const options = [
    { value: '', label: 'None' },
    ...activeCategories(categories ?? []).map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <>
      <PageHeader
        title={meal ? 'Edit meal' : 'New meal'}
        back={
          <Link
            to="/foods?tab=meals"
            aria-label="Back to Foods"
            className="-ml-2 inline-flex h-12 w-12 items-center justify-center rounded-btn text-ink"
          >
            <ArrowLeft size={22} aria-hidden="true" />
          </Link>
        }
      />
      <form
        className="flex flex-col gap-4 px-gutter"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <TextField label="Name" value={name} onChange={setName} autoComplete="off" />

        {skippedQuick > 0 ? (
          <p
            role="status"
            className="rounded-card border border-hairline bg-surface p-3 text-sm text-muted"
          >
            {skippedQuick} quick-add {skippedQuick === 1 ? 'entry was' : 'entries were'} skipped: a
            saved meal needs foods or recipes.
          </p>
        ) : null}

        <section aria-label="Items" className="flex flex-col gap-2">
          <h2 className="micro">Items</h2>
          {items.length === 0 ? (
            <EmptyState title="No items yet" description="Add the foods or recipes in this meal." />
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext
                items={items.map((d) => d.key)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-2">
                  {items.map((d) => {
                    const src = d.kind === 'food' ? foodMap.get(d.refId) : recipeMap.get(d.refId);
                    const itemOptions = !src
                      ? []
                      : d.kind === 'food'
                        ? unitOptions(src as Food)
                        : recipeUnitOptions(src as Recipe);
                    const mi = asMealItem(d);
                    return (
                      <SortableItemRow
                        key={d.key}
                        draft={d}
                        name={src ? src.name : 'Deleted item'}
                        subtitle={
                          d.kind === 'recipe'
                            ? 'Recipe'
                            : ((src as Food | undefined)?.brand ?? undefined)
                        }
                        options={itemOptions}
                        kcal={mi ? (mealItemNutrients(mi, foodMap, recipeMap)?.kcal ?? null) : null}
                        onChange={(next) =>
                          setItems(items.map((x) => (x.key === d.key ? next : x)))
                        }
                        onRemove={() => setItems(items.filter((x) => x.key !== d.key))}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
          <Button variant="secondary" onClick={() => setPicking(true)} className="self-start">
            <Plus size={16} aria-hidden="true" />
            Add item
          </Button>
        </section>

        <Card data-testid="meal-totals">
          <h2 className="micro mb-1">Total</h2>
          <p className="num text-ink">
            <span className="text-xl font-semibold">{formatKcal(totals.kcal)}</span> kcal
          </p>
          <p className="num text-sm text-muted">
            P {formatGrams(totals.protein)} · C {formatGrams(netCarbs(totals))} · F{' '}
            {formatGrams(totals.fat)}
          </p>
        </Card>

        <div>
          <span className="micro mb-1 block">Default category</span>
          <SelectField
            label="Default category"
            value={categoryId}
            options={options}
            onChange={setCategoryId}
          />
          <p className="mt-1 text-xs text-muted">
            Preselected when you add this meal from the Foods library.
          </p>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate(-1)} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" className="flex-[2]">
            Save meal
          </Button>
        </div>
        {meal ? (
          <>
            <Button variant="secondary" onClick={logToToday}>
              Log to today
            </Button>
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              Delete meal
            </Button>
          </>
        ) : null}
      </form>

      <ItemPicker
        open={picking}
        title="Add item"
        foods={foods}
        recipes={recipes}
        onClose={() => setPicking(false)}
        onPick={(p) => {
          setItems((cur) => [...cur, startingItem(p)]);
          setPicking(false);
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        destructive
        title={`Delete ${meal?.name ?? 'meal'}?`}
        message="Past diary entries are not changed."
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (!meal) return;
          setConfirmDelete(false);
          void mealsRepo.softDelete(meal.id).then(() => {
            toast.show({ message: `Deleted ${meal.name}` });
            navigate('/foods?tab=meals', { replace: true });
          });
        }}
      />
    </>
  );
}

export default function MealEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const fromDate = id ? null : params.get('fromDate');
  const fromCategory = id ? null : params.get('category');

  const meal = useLiveQuery(async () => {
    if (!id) return null;
    const m = (await mealsRepo.get(id)) ?? null;
    return m && m.deletedAt === null ? m : null;
  }, [id]);
  const foods = useFoods();
  const recipes = useRecipes();
  const [dayEntries, setDayEntries] = useState<Entry[] | undefined>(undefined);

  useEffect(() => {
    if (!fromDate) return;
    let cancelled = false;
    void entriesRepo.forDay(fromDate).then((es) => {
      if (!cancelled) setDayEntries(es);
    });
    return () => {
      cancelled = true;
    };
  }, [fromDate]);

  const ready = meal !== undefined && foods && recipes && (!fromDate || dayEntries !== undefined);
  if (!ready) return <PageHeader title="Meal" />;
  if (id && meal === null) {
    return (
      <>
        <PageHeader title="Meal" />
        <div className="px-gutter">
          <EmptyState title="Meal not found" description="It may have been deleted." />
        </div>
      </>
    );
  }

  let initialItems: MealItem[] = meal?.items ?? [];
  let skippedQuick = 0;
  if (fromDate && fromCategory && dayEntries) {
    const mapped = itemsFromEntries(dayEntries, fromCategory, (kind, refId, servingId) =>
      kind === 'recipe'
        ? servingId === 'serving'
        : (foods.find((f) => f.id === refId)?.servings.some((s) => s.id === servingId) ?? false),
    );
    initialItems = mapped.items;
    skippedQuick = mapped.skippedQuick;
  }

  return (
    <MealForm
      key={id ?? 'new'}
      meal={meal}
      initialItems={initialItems}
      skippedQuick={skippedQuick}
      initialCategoryId={fromCategory}
      foods={foods}
      recipes={recipes}
    />
  );
}
