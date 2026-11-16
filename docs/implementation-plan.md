# Implementation plan (parallel agents)

`docs/build-plan.md` orders the work into phases for a single agent. The first build is done by
parallel agents instead, split by **file ownership** so they never edit the same file. Every agent
still follows `AGENTS.md`, `SPEC.md` and `docs/design-system.md`. trakr's source lives at
`C:\Users\rcsmi\code\misc\trakr` (read-only reference: copy patterns from it, never edit it).

Already in place (Phase 0 scaffold): configs, tokens (`src/styles/index.css`, `tailwind.config.ts`),
`src/domain/types.ts` (the shared contract), `src/db/schema.ts`, `src/db/seed.ts`,
`src/db/repositories/settings.ts`, `src/lib/*`, `src/components/ui/*` (trakr's kit), app shell and
placeholder routes in `src/App.tsx`.

## Wave 1 (parallel; depends only on `src/domain/types.ts`)

| Agent | Owns |
|---|---|
| A: domain | `src/domain/{nutrients,units,goals,categories,recipes,weekly,search,entries}.ts`, `tests/unit/domain/*` (except barcode/mappers) |
| B: data | `src/db/repositories/*` (except settings), `src/hooks/*` (new hooks), `tests/unit/db/*` |
| C: sources | `src/domain/{barcode,usdaMapper,offMapper}.ts`, `src/sources/*`, `tests/fixtures/{usda,off}/*`, their unit tests |
| D: scanner | `src/scanner/*`, PWA icons in `public/icons/*`, `tests/unit/scanner/*` |
| E: UI kit | new presentational components in `src/components/ui/*` (design-system §4), `src/dev/UiDemo.tsx`, `scripts/contrast.mjs` |

### Contracts between wave-1 agents

Repositories persist; they never compute nutrition. Domain builds the objects; repositories save them.

- **A** exports from `src/domain/entries.ts`:
  - `buildFoodEntry(args: { food: Food; amount: number; unit: UnitRef; date: string; categoryId: string; order: number; now: string; id: string; mealLogId?: string | null; mealName?: string | null }): Entry`
  - `buildRecipeEntry(args: { recipe: Recipe; foods: Map<string, Food>; amount: number; unit: UnitRef; date; categoryId; order; now; id; mealLogId?; mealName? }): Entry`
  - `buildQuickEntry(args: { label: string | null; kcal: number | null; protein: number | null; netCarbs: number | null; fat: number | null; date; categoryId; order; now; id }): Entry`
  - `rescaleEntry(entry: Entry, amount: number, unit: UnitRef, now: string): Entry` (recomputes from `entry.snapshot`)
  - `cloneEntry(entry: Entry, args: { id: string; date: string; categoryId: string; order: number; now: string; mealLogId?: string | null }): Entry`
- **B** exports (namespace imports via `src/db/repositories/index.ts`):
  - `entries.add(entries: Entry[], touch: { foods?: { id: string; lastAmount: LastAmount | null }[]; recipes?: { id: string; lastAmount: LastAmount | null }[]; mealId?: string }): Promise<UndoRecord>` in one transaction, updating `useCount`/`lastUsedAt` (and `lastAmount` only when given non-null)
  - `entries.update(entry)`, `entries.remove(ids): Promise<UndoRecord>`, `entries.undo(record)`, `entries.forDay(date)`, `entries.nextOrder(date, categoryId)`
  - `foods.{get,save,upsertRemote,byBarcode,toggleFavorite,softDelete,list}`; `recipes.*`, `meals.*` likewise; `categories.*`, `goals.*` (`saveToday`), `weighIns.*` (`saveToday`, `update`, `remove`), `searchCache.{get,put}` (keeps newest 300)
  - hooks: `useDay(date)`, `useGoalFor(date)`, `useGoals()`, `useCategories({ includeArchived? })`, `useFoods()`, `useRecipes()`, `useMeals()`, `useRecents(limit)`, `useWeighIns()`
- **C** exports `searchUsda(query, { signal, apiKey })`, `getUsdaDetails(fdcId, ...)`, `lookupBarcodeOff(code, { signal })`, `lookupBarcodeUsda(gtin, ...)`, error classes `OfflineError`, `RateLimitError`, `NotFoundError`, `SourceError`; `resolveUsdaKey(settingsKey)` → `{ key, source: 'device' | 'build' | 'demo' }`; `normaliseBarcode(raw): string | null`.
- **D** exports a default lazy-loadable `ScannerView` component: `{ onDetected(code: string): void; onClose(): void; onManualEntry?(code: string): void }`, plus `prefetchScanner()`. Test hook: `window.__myeatsInjectBarcode?.(code)` when `import.meta.env.MODE !== 'production'` **or** `localStorage['myeats:e2e'] === '1'`.

## Wave 1 result: APIs available to screens (read the source for details)

- **Domain** (`src/domain/`):
  - `nutrients.ts`: `scaleNutrients`, `sumNutrients`, `netCarbs`, `deriveKcal`, `withDerivedKcal`, `isIncomplete`, `macroKcalShare`.
  - `units.ts`: `toBaseAmount`, `convertAmount`, `unitOptions`, `defaultUnit`, `unitLabel`, `amountLabel`, `lbToKg`, `formatKcal`, `formatGrams`, `formatSodium`, `formatPercent`, `parseDecimal`.
  - `goals.ts`: `goalFor`, `GOAL_DIRECTIONS`, `progress`, `macroShareOfGoal`, `macroKcalMismatch`.
  - `categories.ts`: `defaultCategory`, `activeCategories`, `sortCategories`.
  - `recipes.ts`: `batchNutrients`, `perServingNutrients`, `per100gNutrients`, `recipeSnapshot`, `recipeUnitOptions`, `recipeServings`, `isValidServingsPerBatch`.
  - `weekly.ts`: `dayTotals` (use `.netCarbs` from here for day net carbs), `weeklySummaries`, `dailySeries`.
  - `search.ts`: `buildIndex(foods, recipes, meals, now)`, `search(index, q, limit)`.
  - `entries.ts`: `buildFoodEntry`, `buildRecipeEntry`, `buildQuickEntry`, `rescaleEntry`, `cloneEntry`.
  - Barcodes and mappers: `barcode.ts` (`normaliseBarcode`), `usdaMapper.ts`, `offMapper.ts`.
- **Repositories** (`import { entries, foods, recipes, meals, categories, goals, weighIns, searchCache, settings } from '../db/repositories'`):
  - `entries.add(entries, touch)`, `update`, `remove(ids)`, `clearCategory`, `undo(record)`, `forDay`, `forRange`, `nextOrder`.
  - `foods.save`, `upsertRemote`, `byBarcode`, `saveOverride`, `toggleFavorite`, `softDelete`, `list`.
  - `categories.add`, `rename`, `reorder`, `archive`, `unarchive`, `setStartsAt`.
  - `goals.saveToday`, `forDate`; `weighIns.saveToday`, `update`, `remove`; `searchCache.get`, `put`.
- **Hooks** (`src/hooks/`): `useToday`, `useDay`, `useGoalFor`, `useGoals`, `useCategories`, `useFoods`, `useRecipes`, `useMeals`, `useRecents`, `useWeighIns`, `useSettings`, `useCloudAccount`.
- **Sources** (`src/sources/`):
  - `searchUsda(q, {signal, apiKey})`, `getUsdaDetails`, `lookupBarcodeUsda`, `lookupBarcodeOff`, `normaliseQuery`, `resolveUsdaKey(deviceKey)`.
  - Errors: `OfflineError`, `RateLimitError`, `NotFoundError`, `SourceError`, `isAbortError`.
- **Scanner** (`src/scanner`): `ScannerView` (lazy; props `{onDetected, onClose}`), `prefetchScanner()`. e2e hook: set `localStorage['myeats:e2e']='1'`, then call `window.__myeatsInjectBarcode(code)`.
- **UI kit** (`src/components/ui`):
  - Bars and rows: `NutrientBar`, `EntryRow`, `ResultRow`, `CategoryHeader`, `MealGroupHeader`.
  - Inputs: `SearchField` (forwardRef), `NumberField`, `RangeChips`.
  - Overlays and actions: `KeyboardActionBar`, `Menu`, `IconButton`, `AddedFooter`, `MacroLegend`.
  - Toasts: `Toast` and `useToast()`. `ToastProvider` is already mounted in `App.tsx`.
  - Plus trakr's Button, Card, Chip, ConfirmDialog, EmptyState, InlineSelect, Mono, PageHeader, SectionLabel, SegmentedBar and Sheet.
  - Use the domain formatters (`src/domain/units.ts`) for numbers in screens.

## Wave 2 (after wave 1 is merged)

| Agent | Owns |
|---|---|
| F: diary + add | `src/routes/Diary.tsx`, `src/components/diary/*`, `src/components/add/*`, Diary/Add e2e |
| G: library | `src/routes/{Foods,FoodEditor,MealEditor,RecipeEditor}.tsx`, `src/components/foods/*`, their e2e |
| H: charts | `src/routes/{Weight,Trends}.tsx`, `src/components/{weight,trends}/*`, their e2e |
| I: settings | `src/routes/{Settings,Goals,Categories}.tsx`, `src/components/settings/*`, `src/lib/backup.ts`, `docs/backup-format.md`, `src/dev/SeedDemo.tsx`, their e2e |

## Wave 3

Integration, cross-screen e2e journeys, bundle-size check (`scripts/size-check.mjs`), README.
