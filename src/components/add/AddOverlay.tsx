import {
  forwardRef,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import * as entryRepo from '../../db/repositories/entries';
import * as foodRepo from '../../db/repositories/foods';
import * as recipeRepo from '../../db/repositories/recipes';
import type { UsageTouch } from '../../db/repositories/entries';
import { defaultCategory } from '../../domain/categories';
import { buildFoodEntry, buildQuickEntry, buildRecipeEntry } from '../../domain/entries';
import { buildIndex, search } from '../../domain/search';
import { recipeUnitOptions } from '../../domain/recipes';
import { formatKcal, unitOptions, type UnitOption } from '../../domain/units';
import type { Category, Entry, Food, LastAmount, Recipe, RemoteFood, SavedMeal, UnitRef } from '../../domain/types';
import { useCategories } from '../../hooks/useCategories';
import { useFoods } from '../../hooks/useFoods';
import { useMeals } from '../../hooks/useMeals';
import { useRecents } from '../../hooks/useRecents';
import { useRecipes } from '../../hooks/useRecipes';
import { useSettings } from '../../hooks/useSettings';
import { nowIso } from '../../lib/dates';
import { newId } from '../../lib/ids';
import { prefetchScanner, ScannerView } from '../../scanner';
import { lookupBarcodeOff } from '../../sources/off';
import { getUsdaDetails, lookupBarcodeUsda } from '../../sources/usda';
import { resolveUsdaKey } from '../../sources/usdaKey';
import {
  AddedFooter,
  Button,
  Chip,
  IconButton,
  InlineSelect,
  ResultRow,
  SearchField,
  Sheet,
  useToast,
} from '../ui';
import { AmountPanel } from './AmountPanel';
import { MealPanel } from './MealPanel';
import { Panel } from './Panel';
import { QuickAddPanel, type QuickValues } from './QuickAddPanel';
import {
  defaultFoodAmount,
  defaultRecipeAmount,
  foodSnap,
  recipeSnap,
  type Snap,
} from './amounts';
import { lookupBarcode } from './lookup';
import {
  dedupeRemote,
  refsForChip,
  remoteRow,
  rowFor,
  rowsForHits,
  rowsForRecents,
  toMap,
  type ChipKey,
  type Lookups,
  type MealLine,
  type RowModel,
} from './results';
import { useUsdaSearch } from './useUsdaSearch';

const FoodForm = lazy(() => import('../foods/FoodForm').then((m) => ({ default: m.FoodForm })));

export type AddOverlayHandle = {
  /** Call from the ＋ tap handler: shows the overlay and focuses search synchronously. */
  open: (categoryId: string) => void;
};

export interface AddOverlayProps {
  today: string;
  /** Today's entries (for ordering and nothing else). */
  entries: readonly Entry[];
}

type PanelState =
  | { type: 'food'; food: Food }
  | { type: 'recipe'; recipe: Recipe }
  | { type: 'meal'; meal: SavedMeal }
  | { type: 'quick' }
  | { type: 'create'; barcode?: string }
  | { type: 'looking'; code: string }
  | { type: 'nomatch'; code: string; failed: boolean; offline: boolean }
  | null;

const CHIPS: { key: ChipKey; label: string }[] = [
  { key: 'recent', label: 'Recent' },
  { key: 'favourites', label: 'Favourites' },
  { key: 'meals', label: 'Meals' },
  { key: 'recipes', label: 'Recipes' },
];

const EMPTY: never[] = [];

export const AddOverlay = forwardRef<AddOverlayHandle, AddOverlayProps>(function AddOverlay(
  { today, entries: dayEntries },
  ref,
) {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const addParam = params.get('add');
  const mealParam = params.get('meal');

  const settings = useSettings();
  const cats = useCategories();
  const foods = useFoods() ?? EMPTY;
  const recipes = useRecipes() ?? EMPTY;
  const meals = useMeals() ?? EMPTY;
  const recents = useRecents(30);

  const [visible, setVisible] = useState(false);
  const [preferredCat, setPreferredCat] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [chip, setChip] = useState<ChipKey>('recent');
  const [panel, setPanel] = useState<PanelState>(null);
  const [scanning, setScanning] = useState(false);
  const [added, setAdded] = useState<{ count: number; kcal: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const orderRef = useRef(new Map<string, number>());
  const lookupAbort = useRef<AbortController | null>(null);
  const mealOpened = useRef<string | null>(null);

  const category: Category | null =
    cats?.find((c) => c.id === preferredCat) ?? (cats ? defaultCategory(new Date(), cats) : null);

  // ---- open / close, synchronised with ?add= ----

  useImperativeHandle(
    ref,
    () => ({
      open(categoryId: string) {
        // Synchronous on purpose: iOS only raises the keyboard when focus() happens inside the tap.
        flushSync(() => {
          setPreferredCat(categoryId);
          setVisible(true);
        });
        inputRef.current?.focus();
        navigate(
          { pathname: location.pathname, search: `?add=${encodeURIComponent(categoryId)}` },
          { state: { addOverlay: true } },
        );
      },
    }),
    [navigate, location.pathname],
  );

  useEffect(() => {
    if (addParam !== null) {
      setVisible(true);
      if (addParam) setPreferredCat(addParam);
    } else {
      setVisible(false);
      setQuery('');
      setChip('recent');
      setPanel(null);
      setScanning(false);
      setAdded(null);
      mealOpened.current = null;
      lookupAbort.current?.abort();
    }
  }, [addParam]);

  useEffect(() => {
    if (visible) prefetchScanner();
  }, [visible]);

  const close = useCallback(() => {
    if ((location.state as { addOverlay?: boolean } | null)?.addOverlay) navigate(-1);
    else navigate({ pathname: location.pathname, search: '' }, { replace: true });
  }, [location.state, location.pathname, navigate]);

  // Desktop keys: "/" focuses search, Esc closes (panels handle their own Escape first).
  const panelOpen = panel !== null || scanning;
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (panelOpen) return;
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (e.key === 'Escape') close();
      else if (e.key === '/' && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, panelOpen, close]);

  // ---- data ----

  const foodsById = useMemo(() => toMap(foods), [foods]);
  const recipesById = useMemo(() => toMap(recipes), [recipes]);
  const lookups: Lookups = useMemo(
    () => ({ foods: foodsById, recipes: recipesById }),
    [foodsById, recipesById],
  );
  const index = useMemo(() => buildIndex(foods, recipes, meals, new Date()), [foods, recipes, meals]);

  const trimmed = query.trim();
  const localRows: RowModel[] = useMemo(
    () => (trimmed ? rowsForHits(search(index, trimmed, 30), lookups) : []),
    [index, trimmed, lookups],
  );
  const listRows: RowModel[] = useMemo(() => {
    if (trimmed) return [];
    if (chip === 'recent') return recents ? rowsForRecents(recents, lookups) : [];
    return refsForChip(chip, { foods, recipes, meals }).map((r) => rowFor(r, lookups));
  }, [trimmed, chip, recents, lookups, foods, recipes, meals]);

  const apiKey = resolveUsdaKey(settings?.usdaApiKey ?? null).key;
  const usda = useUsdaSearch(visible ? trimmed : '', apiKey);
  const remoteRows = useMemo(
    () => dedupeRemote(usda.results, foods).map((r) => remoteRow(r, usda.cached)),
    [usda.results, usda.cached, foods],
  );

  // Meal deep link: ?add=<cat>&meal=<id> opens the Meal panel (used by the Foods library).
  useEffect(() => {
    if (!visible || !mealParam || mealOpened.current === mealParam) return;
    const meal = meals.find((m) => m.id === mealParam);
    if (!meal) return;
    mealOpened.current = mealParam;
    setPanel({ type: 'meal', meal });
  }, [visible, mealParam, meals]);

  // ---- writing ----

  /** Reserve `n` consecutive orders in a category, robust to rapid adds before the live query updates. */
  const reserveOrder = (categoryId: string, n: number): number => {
    const key = `${today}|${categoryId}`;
    const fromDb = dayEntries.reduce(
      (m, e) => (e.categoryId === categoryId ? Math.max(m, e.order) : m),
      0,
    );
    const start = Math.max(fromDb, orderRef.current.get(key) ?? 0) + 1;
    orderRef.current.set(key, start + n - 1);
    return start;
  };

  const afterAdd = () => {
    setPanel(null);
    setQuery('');
    inputRef.current?.focus();
  };

  const commit = (list: Entry[], touch: UsageTouch, message: string) => {
    const kcal = list.reduce((s, e) => s + (e.nutrients.kcal ?? 0), 0);
    const count = list.length;
    const saved = entryRepo.add(list, touch);
    saved.catch(() => toast.show({ message: 'Could not save' }));
    setAdded((a) => ({ count: (a?.count ?? 0) + count, kcal: (a?.kcal ?? 0) + kcal }));
    toast.show({
      message,
      actionLabel: 'Undo',
      onAction: () => {
        setAdded((a) => (a ? { count: a.count - count, kcal: a.kcal - kcal } : a));
        void saved.then((rec) => entryRepo.undo(rec));
      },
    });
  };

  const addFood = (food: Food, amount: number, unit: UnitRef) => {
    if (!category) return;
    const entry = buildFoodEntry({
      food,
      amount,
      unit,
      date: today,
      categoryId: category.id,
      order: reserveOrder(category.id, 1),
      now: nowIso(),
      id: newId(),
    });
    afterAdd();
    commit([entry], { foods: [{ id: food.id, lastAmount: { amount, unit } }] }, `Added ${food.name}`);
  };

  const addRecipe = (recipe: Recipe, amount: number, unit: UnitRef) => {
    if (!category) return;
    const entry = buildRecipeEntry({
      recipe,
      foods: foodsById,
      amount,
      unit,
      date: today,
      categoryId: category.id,
      order: reserveOrder(category.id, 1),
      now: nowIso(),
      id: newId(),
    });
    afterAdd();
    commit([entry], { recipes: [{ id: recipe.id, lastAmount: { amount, unit } }] }, `Added ${recipe.name}`);
  };

  const addMeal = (meal: SavedMeal, chosen: { line: MealLine; amount: number }[]) => {
    if (!category || chosen.length === 0) return;
    const mealLogId = newId();
    const start = reserveOrder(category.id, chosen.length);
    const now = nowIso();
    const list: Entry[] = [];
    const touch: UsageTouch = { mealId: meal.id, foods: [], recipes: [] };
    chosen.forEach(({ line, amount }, i) => {
      const common = {
        amount,
        unit: line.item.unit,
        date: today,
        categoryId: category.id,
        order: start + i,
        now,
        id: newId(),
        mealLogId,
        mealName: meal.name,
      };
      if (line.item.kind === 'food') {
        const food = foodsById.get(line.item.refId);
        if (!food) return;
        list.push(buildFoodEntry({ ...common, food }));
        touch.foods?.push({ id: food.id, lastAmount: null });
      } else {
        const recipe = recipesById.get(line.item.refId);
        if (!recipe) return;
        list.push(buildRecipeEntry({ ...common, recipe, foods: foodsById }));
        touch.recipes?.push({ id: recipe.id, lastAmount: null });
      }
    });
    afterAdd();
    if (list.length > 0) commit(list, touch, `Added ${meal.name}`);
  };

  const addQuick = (v: QuickValues) => {
    if (!category) return;
    const entry = buildQuickEntry({
      ...v,
      date: today,
      categoryId: category.id,
      order: reserveOrder(category.id, 1),
      now: nowIso(),
      id: newId(),
    });
    afterAdd();
    commit([entry], {}, `Added ${entry.name}`);
  };

  // ---- picking ----

  const openRemote = async (remote: RemoteFood) => {
    const food = await foodRepo.upsertRemote(remote);
    setPanel({ type: 'food', food });
    const generic = remote.dataType === 'Foundation' || remote.dataType === 'SR Legacy';
    if (generic && remote.sourceId && food.servings.length === 0) {
      try {
        const servings = await getUsdaDetails(remote.sourceId, { apiKey });
        const latest = await foodRepo.get(food.id);
        if (servings.length > 0 && latest) await foodRepo.save({ ...latest, servings });
      } catch {
        // Servings are a nicety; grams still work.
      }
    }
  };

  const pick = (row: RowModel) => {
    const ref = row.ref;
    if (ref.kind === 'food') setPanel({ type: 'food', food: ref.item });
    else if (ref.kind === 'recipe') setPanel({ type: 'recipe', recipe: ref.item });
    else setPanel({ type: 'meal', meal: ref.item });
  };

  // ---- scanner ----

  const onDetected = (code: string) => {
    setScanning(false);
    setPanel({ type: 'looking', code });
    lookupAbort.current?.abort();
    const ac = new AbortController();
    lookupAbort.current = ac;
    void lookupBarcode(code, {
      byBarcode: foodRepo.byBarcode,
      off: lookupBarcodeOff,
      usda: lookupBarcodeUsda,
      apiKey,
      signal: ac.signal,
    })
      .then(async (res) => {
        if (ac.signal.aborted) return;
        if (res.kind === 'local') setPanel({ type: 'food', food: res.food });
        else if (res.kind === 'remote') await openRemote(res.remote);
        else setPanel({ type: 'nomatch', code, failed: res.kind === 'error', offline: res.kind === 'error' && res.offline });
      })
      .catch(() => {
        if (!ac.signal.aborted) setPanel({ type: 'nomatch', code, failed: true, offline: false });
      });
  };

  // ---- render ----

  const catOptions = (cats ?? []).map((c) => ({ value: c.id, label: c.name }));
  const showAdded = added !== null && added.count > 0;

  return (
    <div
      data-testid="add-overlay"
      aria-label="Add food"
      aria-hidden={!visible}
      className={`fixed inset-0 z-40 flex-col bg-bg pt-safe ${visible ? 'flex' : 'hidden'}`}
    >
      <div className="mx-auto flex min-h-0 w-full max-w-app flex-1 flex-col">
        <div className="flex items-center gap-1 pl-1 pr-gutter">
          <IconButton aria-label="Close" onClick={close}>
            <X size={22} aria-hidden="true" />
          </IconButton>
          <span className="micro">Add to</span>
          <span className="relative ml-1 rounded-chip border border-hairline bg-surface px-3 py-2 text-sm text-ink">
            <InlineSelect
              label="Category"
              value={category?.id ?? ''}
              options={catOptions}
              onChange={setPreferredCat}
            />
          </span>
        </div>
        <div className="px-gutter pb-2">
          <SearchField
            ref={inputRef}
            value={query}
            onChange={setQuery}
            onScan={() => setScanning(true)}
          />
        </div>

        {trimmed === '' ? (
          <div className="flex flex-wrap items-center gap-2 px-gutter pb-2">
            {CHIPS.map((c) => (
              <Chip key={c.key} selected={chip === c.key} onClick={() => setChip(c.key)}>
                {c.label}
              </Chip>
            ))}
            <span className="flex-1" />
            <Button variant="ghost" onClick={() => setPanel({ type: 'quick' })}>
              <Plus size={16} aria-hidden="true" /> Quick add
            </Button>
            <Button variant="ghost" onClick={() => setPanel({ type: 'create' })}>
              <Plus size={16} aria-hidden="true" /> Create food
            </Button>
          </div>
        ) : null}

        {/* Keep the search field focused (and the keyboard up) when a row is tapped. */}
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          onMouseDown={(e) => e.preventDefault()}
        >
          {trimmed === '' ? (
            listRows.length > 0 ? (
              <ul aria-label={CHIPS.find((c) => c.key === chip)?.label}>
                {listRows.map((r) => (
                  <li key={r.key}>
                    <ResultRow {...rowProps(r)} onSelect={() => pick(r)} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-gutter py-6 text-sm text-muted">{emptyText(chip)}</p>
            )
          ) : (
            <>
              <SectionHeading>Your foods</SectionHeading>
              {localRows.length > 0 ? (
                <ul aria-label="Your foods">
                  {localRows.map((r) => (
                    <li key={r.key}>
                      <ResultRow {...rowProps(r)} onSelect={() => pick(r)} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-gutter py-3 text-sm text-muted">No saved matches</p>
              )}
              <SectionHeading>USDA</SectionHeading>
              {remoteRows.length > 0 ? (
                <ul aria-label="USDA results">
                  {remoteRows.map((r) => (
                    <li key={r.key}>
                      <ResultRow {...rowProps(r)} onSelect={() => void openRemote(r.remote)} />
                    </li>
                  ))}
                </ul>
              ) : null}
              {usda.status === 'loading' ? (
                <p className="px-gutter py-3 text-sm text-muted">Searching USDA…</p>
              ) : null}
              {usda.status === 'offline' ? (
                <p className="px-gutter py-3 text-sm text-muted">
                  Offline: showing saved foods only
                </p>
              ) : null}
              {usda.status === 'busy' ? (
                <p className="px-gutter py-3 text-sm text-muted">
                  USDA search is busy, try again in a minute
                </p>
              ) : null}
              {usda.status === 'error' ? (
                <p className="px-gutter py-3 text-sm text-muted">USDA search failed</p>
              ) : null}
              {usda.status === 'done' && remoteRows.length === 0 ? (
                <p className="px-gutter py-3 text-sm text-muted">No USDA matches</p>
              ) : null}
            </>
          )}
        </div>

        {showAdded && category ? (
          <AddedFooter
            category={category.name}
            count={added.count}
            kcal={`${formatKcal(added.kcal)} kcal`}
            onDone={close}
          />
        ) : null}
      </div>

      {scanning ? (
        <Suspense fallback={null}>
          <ScannerView onDetected={onDetected} onClose={() => setScanning(false)} />
        </Suspense>
      ) : null}

      {panel?.type === 'food' ? (
        <FoodAmount
          key={panel.food.id}
          food={foodsById.get(panel.food.id) ?? panel.food}
          onAdd={(a, u) => addFood(foodsById.get(panel.food.id) ?? panel.food, a, u)}
          onClose={() => setPanel(null)}
        />
      ) : null}
      {panel?.type === 'recipe' ? (
        <RecipeAmount
          key={panel.recipe.id}
          recipe={recipesById.get(panel.recipe.id) ?? panel.recipe}
          foods={foodsById}
          onAdd={(a, u) => addRecipe(recipesById.get(panel.recipe.id) ?? panel.recipe, a, u)}
          onClose={() => setPanel(null)}
        />
      ) : null}
      {panel?.type === 'meal' ? (
        <MealPanel
          key={panel.meal.id}
          meal={panel.meal}
          lookups={lookups}
          onAddAll={(lines) => addMeal(panel.meal, lines)}
          onClose={() => setPanel(null)}
        />
      ) : null}
      {panel?.type === 'quick' ? (
        <QuickAddPanel onSubmit={addQuick} onClose={() => setPanel(null)} />
      ) : null}
      {panel?.type === 'create' ? (
        <Sheet open onClose={() => setPanel(null)} title="Create food">
          <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
            <FoodForm
              prefill={panel.barcode ? { barcode: panel.barcode } : undefined}
              onSaved={(food) => setPanel({ type: 'food', food })}
              onCancel={() => setPanel(null)}
            />
          </Suspense>
        </Sheet>
      ) : null}
      {panel?.type === 'looking' ? (
        <Panel
          open
          title={`Looking up ${panel.code}`}
          onClose={() => {
            lookupAbort.current?.abort();
            setPanel(null);
          }}
        >
          <p className="text-sm text-muted">Checking your foods, Open Food Facts and USDA…</p>
        </Panel>
      ) : null}
      {panel?.type === 'nomatch' ? (
        <Panel open title={panel.failed ? `Could not look up ${panel.code}` : `No match for ${panel.code}`} onClose={() => setPanel(null)}>
          {panel.failed ? (
            <p className="mb-3 text-sm text-muted">
              {panel.offline ? 'Offline: barcode lookup needs a connection.' : 'The lookup failed.'}
            </p>
          ) : null}
          <div className="flex flex-col gap-2">
            <Button fullWidth onClick={() => setPanel({ type: 'create', barcode: panel.code })}>
              Create food
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                setPanel(null);
                setScanning(true);
              }}
            >
              Scan again
            </Button>
          </div>
        </Panel>
      ) : null}
    </div>
  );
});

function rowProps(r: Pick<RowModel, 'name' | 'tag' | 'brand' | 'amount' | 'kcal'>) {
  return { name: r.name, tag: r.tag, brand: r.brand, amount: r.amount, kcal: r.kcal };
}

function emptyText(chip: ChipKey): string {
  if (chip === 'recent') return 'Nothing logged yet. Search above or use Quick add.';
  if (chip === 'favourites') return 'No favourites yet. Star a food in its Amount panel.';
  if (chip === 'meals') return 'No saved meals yet.';
  return 'No recipes yet.';
}

function SectionHeading({ children }: { children: string }) {
  return <h3 className="micro border-b border-hairline px-gutter py-2">{children}</h3>;
}

function FoodAmount({
  food,
  onAdd,
  onClose,
}: {
  food: Food;
  onAdd: (amount: number, unit: UnitRef) => void;
  onClose: () => void;
}) {
  const options: UnitOption[] = unitOptions(food);
  const initial: LastAmount = defaultFoodAmount(food);
  const snap: Snap = foodSnap(food);
  return (
    <AmountPanel
      title={food.name}
      brand={food.brand}
      snap={snap}
      options={options}
      initial={initial}
      favorite={food.favoriteAt !== null}
      onToggleFavorite={() => void foodRepo.toggleFavorite(food.id)}
      editHref={`/foods/${food.id}`}
      onAdd={onAdd}
      onClose={onClose}
    />
  );
}

function RecipeAmount({
  recipe,
  foods,
  onAdd,
  onClose,
}: {
  recipe: Recipe;
  foods: ReadonlyMap<string, Food>;
  onAdd: (amount: number, unit: UnitRef) => void;
  onClose: () => void;
}) {
  return (
    <AmountPanel
      title={recipe.name}
      snap={recipeSnap(recipe, foods)}
      options={recipeUnitOptions(recipe)}
      initial={defaultRecipeAmount(recipe)}
      favorite={recipe.favoriteAt !== null}
      onToggleFavorite={() => void recipeRepo.toggleFavorite(recipe.id)}
      editHref={`/recipes/${recipe.id}`}
      onAdd={onAdd}
      onClose={onClose}
    />
  );
}
