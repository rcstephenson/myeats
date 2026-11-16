import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Plus } from 'lucide-react';
import { recipes as recipesRepo } from '../db/repositories';
import { ItemPicker, ItemRow, type DraftItem } from '../components/foods/ItemRows';
import { TextField } from '../components/foods/fields';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  NumberField,
  PageHeader,
  useToast,
} from '../components/ui';
import {
  ingredientNutrients,
  isValidServingsPerBatch,
  batchNutrients,
  perServingNutrients,
} from '../domain/recipes';
import { netCarbs, withDerivedKcal } from '../domain/nutrients';
import { defaultUnit, formatGrams, formatKcal, unitOptions } from '../domain/units';
import type { Food, Nutrients, Recipe, RecipeIngredient } from '../domain/types';
import { nowIso } from '../lib/dates';
import { newId } from '../lib/ids';
import { useFoods } from '../hooks/useFoods';

function Totals({ title, n, testId }: { title: string; n: Nutrients | null; testId: string }) {
  const d = n ? withDerivedKcal(n).nutrients : null;
  return (
    <div data-testid={testId}>
      <h3 className="micro mb-1">{title}</h3>
      {d ? (
        <>
          <p className="num text-ink">
            <span className="text-xl font-semibold">
              {d.kcal === null ? '-' : formatKcal(d.kcal)}
            </span>{' '}
            kcal
          </p>
          <p className="num text-sm text-muted">
            P {formatGrams(d.protein ?? 0)} · C {formatGrams(netCarbs(d))} · F{' '}
            {formatGrams(d.fat ?? 0)}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted">Set servings per batch (1 or more)</p>
      )}
    </div>
  );
}

function RecipeForm({ recipe, foods }: { recipe: Recipe | null; foods: Food[] }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState(recipe?.name ?? '');
  const [yieldN, setYieldN] = useState<number | null>(recipe?.servingsPerBatch ?? 1);
  const [cookedRaw, setCookedRaw] = useState<string>(
    recipe?.cookedWeightG != null ? String(recipe.cookedWeightG) : '',
  );
  const [cooked, setCooked] = useState<number | null>(recipe?.cookedWeightG ?? null);
  const [items, setItems] = useState<DraftItem[]>(() =>
    (recipe?.ingredients ?? []).map((i) => ({
      key: newId(),
      kind: 'food' as const,
      refId: i.foodId,
      amount: i.amount,
      unit: i.unit,
    })),
  );
  const [picking, setPicking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const foodMap = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const asIngredient = (d: DraftItem): RecipeIngredient | null =>
    d.amount !== null && d.amount > 0 ? { foodId: d.refId, amount: d.amount, unit: d.unit } : null;
  const ingredients = items.map(asIngredient).filter((i): i is RecipeIngredient => i !== null);

  const draftRecipe: Recipe = {
    ...(recipe ?? {
      id: 'draft',
      lastAmount: null,
      useCount: 0,
      lastUsedAt: null,
      favoriteAt: null,
      deletedAt: null,
      createdAt: '',
      updatedAt: '',
    }),
    name,
    nameLower: name.toLowerCase(),
    ingredients,
    servingsPerBatch: yieldN ?? 0,
    cookedWeightG: cooked,
  };
  const yieldOk = yieldN !== null && isValidServingsPerBatch(yieldN);
  const batch = batchNutrients(draftRecipe, foodMap);
  const perServing = yieldOk ? perServingNutrients(draftRecipe, foodMap) : null;

  const save = async () => {
    if (!name.trim()) return setError('Name is required');
    if (!yieldOk) return setError('Servings per batch must be 1 or more');
    if (cookedRaw.trim() !== '' && (cooked === null || !(cooked > 0)))
      return setError('Cooked weight must be a number above 0, or blank');
    if (items.length === 0) return setError('Add at least one ingredient');
    if (ingredients.length !== items.length)
      return setError('Every ingredient needs an amount above 0');
    setError(null);
    const now = nowIso();
    await recipesRepo.save({
      ...(recipe ?? { ...draftRecipe, id: newId(), createdAt: now, updatedAt: now }),
      name: name.trim(),
      ingredients,
      servingsPerBatch: yieldN as number,
      cookedWeightG: cookedRaw.trim() === '' ? null : cooked,
    });
    navigate('/foods?tab=recipes', { replace: true });
  };

  return (
    <>
      <PageHeader
        title={recipe ? 'Edit recipe' : 'New recipe'}
        back={
          <Link
            to="/foods?tab=recipes"
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

        <section aria-label="Ingredients" className="flex flex-col gap-2">
          <h2 className="micro">Ingredients</h2>
          {items.length === 0 ? (
            <EmptyState
              title="No ingredients yet"
              description="Add the foods that go in the pot."
            />
          ) : (
            items.map((d) => {
              const food = foodMap.get(d.refId);
              const ing = asIngredient(d);
              return (
                <ItemRow
                  key={d.key}
                  draft={d}
                  name={food ? food.name : 'Deleted food'}
                  subtitle={food?.brand ?? undefined}
                  options={food ? unitOptions(food) : []}
                  kcal={ing ? (ingredientNutrients(ing, foodMap)?.kcal ?? null) : null}
                  onChange={(next) => setItems(items.map((x) => (x.key === d.key ? next : x)))}
                  onRemove={() => setItems(items.filter((x) => x.key !== d.key))}
                />
              );
            })
          )}
          <Button variant="secondary" onClick={() => setPicking(true)} className="self-start">
            <Plus size={16} aria-hidden="true" />
            Add ingredient
          </Button>
          {batch.missingFoodIds.length > 0 ? (
            <p role="status" className="text-xs text-muted">
              Some ingredients were deleted and are not counted.
            </p>
          ) : null}
        </section>

        <div className="flex gap-3">
          <div className="min-w-0 flex-1">
            <span className="micro mb-1 block">Servings per batch</span>
            <NumberField
              label="Servings per batch"
              defaultValue={yieldN === null ? '' : String(yieldN)}
              onChange={setYieldN}
              aria-invalid={!yieldOk ? true : undefined}
            />
          </div>
          <div className="min-w-0 flex-1">
            <span className="micro mb-1 block">Cooked weight (optional)</span>
            <NumberField
              label="Cooked weight"
              defaultValue={cookedRaw}
              suffix="g"
              onChange={(v, r) => {
                setCooked(v);
                setCookedRaw(r);
              }}
            />
          </div>
        </div>

        <Card className="flex flex-col gap-3">
          <Totals title="Per serving" n={perServing} testId="recipe-per-serving" />
          <Totals title="Whole batch" n={batch.nutrients} testId="recipe-batch" />
        </Card>

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
            Save recipe
          </Button>
        </div>
        {recipe ? (
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            Delete recipe
          </Button>
        ) : null}
      </form>

      <ItemPicker
        open={picking}
        title="Add ingredient"
        foods={foods}
        onClose={() => setPicking(false)}
        onPick={(p) => {
          if (p.kind !== 'food') return;
          const unit = defaultUnit(p.food);
          setItems((cur) => [
            ...cur,
            {
              key: newId(),
              kind: 'food',
              refId: p.food.id,
              amount: unit.kind === 'serving' ? 1 : 100,
              unit,
            },
          ]);
          setPicking(false);
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        destructive
        title={`Delete ${recipe?.name ?? 'recipe'}?`}
        message="Past diary entries are not changed. Meals that use this recipe will show it as deleted."
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (!recipe) return;
          setConfirmDelete(false);
          void recipesRepo.softDelete(recipe.id).then(() => {
            toast.show({ message: `Deleted ${recipe.name}` });
            navigate('/foods?tab=recipes', { replace: true });
          });
        }}
      />
    </>
  );
}

export default function RecipeEditor() {
  const { id } = useParams();
  const recipe = useLiveQuery(async () => {
    if (!id) return null;
    const r = (await recipesRepo.get(id)) ?? null;
    return r && r.deletedAt === null ? r : null;
  }, [id]);
  const foods = useFoods();
  if (recipe === undefined || !foods) return <PageHeader title="Recipe" />;
  if (id && recipe === null) {
    return (
      <>
        <PageHeader title="Recipe" />
        <div className="px-gutter">
          <EmptyState title="Recipe not found" description="It may have been deleted." />
        </div>
      </>
    );
  }
  return <RecipeForm key={id ?? 'new'} recipe={recipe} foods={foods} />;
}
