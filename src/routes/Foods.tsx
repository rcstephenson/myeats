import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Star } from 'lucide-react';
import { foods as foodsRepo, meals as mealsRepo, recipes as recipesRepo } from '../db/repositories';
import { visibleFoods } from '../components/foods/library';
import { Segmented } from '../components/foods/fields';
import { mealTotals } from '../components/foods/mealMath';
import { buttonClass, EmptyState, PageHeader, SearchField } from '../components/ui';
import { perServingNutrients } from '../domain/recipes';
import { fold } from '../domain/search';
import { formatKcal } from '../domain/units';
import type { Recipe, SavedMeal } from '../domain/types';
import { useFoods } from '../hooks/useFoods';
import { useMeals } from '../hooks/useMeals';
import { useRecipes } from '../hooks/useRecipes';

type Tab = 'foods' | 'meals' | 'recipes';

function StarButton({ on, name, onToggle }: { on: boolean; name: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label={on ? `Unfavourite ${name}` : `Favourite ${name}`}
      aria-pressed={on}
      onClick={onToggle}
      className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-btn"
    >
      <Star
        size={20}
        aria-hidden="true"
        className={on ? 'fill-current text-accent' : 'text-muted'}
      />
    </button>
  );
}

function Row({
  to,
  title,
  sub,
  right,
  star,
}: {
  to: string;
  title: string;
  sub?: string;
  right: string;
  star?: React.ReactNode;
}) {
  return (
    <li className="flex items-center border-b border-hairline pl-gutter pr-1">
      <Link to={to} className="flex min-h-[56px] min-w-0 flex-1 items-center gap-3 py-2">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm text-ink">{title}</span>
          {sub ? <span className="truncate text-xs text-muted">{sub}</span> : null}
        </span>
        <span className="num shrink-0 text-xs text-ink">{right}</span>
      </Link>
      {star}
    </li>
  );
}

export default function Foods() {
  const [params] = useSearchParams();
  const initialTab = params.get('tab');
  const [tab, setTab] = useState<Tab>(
    initialTab === 'meals' || initialTab === 'recipes' ? initialTab : 'foods',
  );
  const [q, setQ] = useState('');
  const foods = useFoods();
  const recipes = useRecipes();
  const meals = useMeals();

  const query = fold(q).trim();
  const match = (name: string, brand?: string | null) =>
    query === '' || fold(`${name} ${brand ?? ''}`).includes(query);

  const foodRows = useMemo(
    () => visibleFoods(foods ?? []).filter((f) => match(f.name, f.brand)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [foods, query],
  );
  const foodMap = useMemo(() => new Map((foods ?? []).map((f) => [f.id, f])), [foods]);
  const recipeMap = useMemo(() => new Map((recipes ?? []).map((r) => [r.id, r])), [recipes]);
  const recipeRows = (recipes ?? [])
    .filter((r) => match(r.name))
    .sort((a, b) => a.nameLower.localeCompare(b.nameLower));
  const mealRows = (meals ?? [])
    .filter((m) => match(m.name))
    .sort((a, b) => a.nameLower.localeCompare(b.nameLower));

  const recipeKcal = (r: Recipe): string => {
    if (!(r.servingsPerBatch >= 1)) return '-';
    const k = perServingNutrients(r, foodMap).kcal;
    return k === null ? '-' : `${formatKcal(k)} kcal`;
  };
  const mealKcal = (m: SavedMeal): string =>
    `${formatKcal(mealTotals(m.items, foodMap, recipeMap).kcal)} kcal`;

  const newLink = tab === 'foods' ? '/foods/new' : tab === 'meals' ? '/meals/new' : '/recipes/new';
  const newLabel = tab === 'foods' ? 'New food' : tab === 'meals' ? 'New meal' : 'New recipe';

  const empty = (title: string, description: string) => (
    <div className="px-gutter pt-4">
      <EmptyState title={title} description={description} />
    </div>
  );

  return (
    <>
      <PageHeader
        title="Foods"
        action={
          <Link to={newLink} className={buttonClass('primary')}>
            <Plus size={16} aria-hidden="true" />
            {newLabel}
          </Link>
        }
      />
      <div className="flex flex-col gap-3 px-gutter pb-3">
        <Segmented
          label="Library section"
          value={tab}
          options={[
            { value: 'foods', label: 'Foods' },
            { value: 'meals', label: 'Meals' },
            { value: 'recipes', label: 'Recipes' },
          ]}
          onChange={setTab}
        />
        <SearchField
          value={q}
          onChange={setQ}
          placeholder={`Filter ${tab}`}
          aria-label={`Filter ${tab}`}
        />
      </div>

      {tab === 'foods' ? (
        foodRows.length === 0 ? (
          empty(
            'No foods',
            query ? 'Nothing matches that filter.' : 'Create a food or log one from search.',
          )
        ) : (
          <ul>
            {foodRows.map((f) => (
              <Row
                key={f.id}
                to={`/foods/${f.id}`}
                title={f.name}
                sub={[
                  f.brand,
                  f.source === 'custom'
                    ? f.overrides
                      ? 'My version'
                      : null
                    : f.source === 'usda'
                      ? 'USDA'
                      : 'OFF',
                ]
                  .filter(Boolean)
                  .join(' · ')}
                right={
                  f.per100.kcal === null
                    ? '-'
                    : `${formatKcal(f.per100.kcal)} kcal/100${f.baseUnit}`
                }
                star={
                  <StarButton
                    on={f.favoriteAt !== null}
                    name={f.name}
                    onToggle={() => void foodsRepo.toggleFavorite(f.id)}
                  />
                }
              />
            ))}
          </ul>
        )
      ) : null}

      {tab === 'meals' ? (
        mealRows.length === 0 ? (
          empty(
            'No saved meals',
            'Save a group of foods you eat together, or use Save as meal in the Diary.',
          )
        ) : (
          <ul>
            {mealRows.map((m) => (
              <Row
                key={m.id}
                to={`/meals/${m.id}`}
                title={m.name}
                sub={`${m.items.length} item${m.items.length === 1 ? '' : 's'}`}
                right={mealKcal(m)}
                star={
                  <StarButton
                    on={m.favoriteAt !== null}
                    name={m.name}
                    onToggle={() => void mealsRepo.toggleFavorite(m.id)}
                  />
                }
              />
            ))}
          </ul>
        )
      ) : null}

      {tab === 'recipes' ? (
        recipeRows.length === 0 ? (
          empty('No recipes', 'Build a recipe from your foods to log it by the serving.')
        ) : (
          <ul>
            {recipeRows.map((r) => (
              <Row
                key={r.id}
                to={`/recipes/${r.id}`}
                title={r.name}
                sub={`${r.servingsPerBatch} serving${r.servingsPerBatch === 1 ? '' : 's'} per batch`}
                right={`${recipeKcal(r)} / serving`}
                star={
                  <StarButton
                    on={r.favoriteAt !== null}
                    name={r.name}
                    onToggle={() => void recipesRepo.toggleFavorite(r.id)}
                  />
                }
              />
            ))}
          </ul>
        )
      ) : null}
    </>
  );
}
