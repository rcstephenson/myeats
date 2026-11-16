# MYeats: product and technical specification

MYeats is a local-first, mobile-first progressive web app for logging what you eat and tracking calories, macros, fiber, sugar, saturated fat and sodium against a daily goal, plus body-weight weigh-ins. It is a companion to [trakr](https://github.com/rcstephenson/trakr) (workout logging). It shares trakr's stack, conventions and visual language, but it is a separate repo, app and database, and the two apps share no data.

Companion documents:

- [`docs/design-system.md`](docs/design-system.md): the visual language. It is trakr's "Signal" with a new accent and macro colours.
- [`docs/build-plan.md`](docs/build-plan.md): phased milestones with acceptance criteria, for the agents implementing this.
- [`docs/requirements.md`](docs/requirements.md): the owner's answered questionnaire. This spec is derived from it; if they disagree, raise it rather than guess.
- [`AGENTS.md`](AGENTS.md): working rules for coding agents.

---

## 1. Principles

- **Finding and adding food is fast.** This is the most important property of the app. See the performance budgets in 9.
  - A food you've eaten before takes three taps or fewer from the Diary: `+`, the recent food, Add.
  - Searching your own foods responds on every keystroke without waiting for the network.
- **Clear at a glance.** The Diary answers two questions without scrolling: what have I eaten today against my goal, and where do I log the next thing.
- **Data, not advice.** The app records and shows what you ate. It never calculates goals for you (no TDEE/BMR), grades food (no Nutri-Score, no "healthy" labels) or nags.
- **iPhone first.** The primary device is an iPhone running Safari or the home-screen PWA. It must also be usable on desktop and other browsers.
- **Local-first.** Everything works offline except searching the remote databases and looking up new barcodes. No account is required. Optional Dexie Cloud sync is available.
- **History is fixed.** A logged entry stores a snapshot of its nutrition. Editing a food, meal, recipe or goal later never changes past days.
- **Log today only.** New entries and weigh-ins are always dated today. Past days are viewable and can be copied from, but cannot be added to.
- **Out of scope for v1:**
  - vitamins and other micronutrients
  - water tracking
  - day notes
  - label OCR
  - meal planning and future days
  - exercise and calories burned
  - goal calculators
  - CSV export
  - social features
  - any link to trakr
  - native apps

## 2. Architecture

The same as trakr: all data in IndexedDB via Dexie, static hosting on GitHub Pages, and optional Dexie Cloud sync. Two public food APIs are called directly from the browser.

| Layer | Where | Notes |
|---|---|---|
| UI | `src/routes/`, `src/components/` | React 18, React Router 6 (`BrowserRouter`), Tailwind with design tokens, `lucide-react` icons, Recharts (lazy-loaded) |
| Hooks | `src/hooks/` | `useLiveQuery` wrappers: `useDay(date)`, `useGoalFor(date)`, `useCategories`, `useFoodIndex`, `useRecents`, `useWeighIns`, `useSettings` |
| Repositories | `src/db/repositories/` | Typed async CRUD. UI code does not query Dexie directly |
| Database | `src/db/schema.ts` | Dexie database `myeats`; seeding in `src/db/seed.ts` |
| Domain | `src/domain/` | Pure, unit-tested functions with no React or Dexie imports. Covers nutrient maths, units and servings, net carbs, goal lookup, default category, search scoring, barcode normalisation, weekly averages, and the OFF/USDA mappers |
| Food sources | `src/sources/` | `usda.ts`, `off.ts`: fetch with `AbortController`, map to the internal `Food` with the domain mappers, and error types for offline, rate limits and not found |
| Scanner | `src/scanner/` | Lazy-loaded chunk wrapping the `barcode-detector` ponyfill (see 6.3) |
| Lib | `src/lib/` | ids (ULID), dates, theme, backup, cloud sync. Copy `ids`, `dates`, `theme`, `cloud*` from trakr and adapt them |
| Tests | `tests/unit/` (Vitest and Testing Library), `tests/e2e/` (Playwright on a mobile WebKit viewport against a preview build, with **all network mocked**) | |

Tooling is identical to trakr: Vite, TypeScript strict, Zod, `vite-plugin-pwa` (prompt update strategy), ESLint, Prettier, and `fake-indexeddb` for unit tests. Pin the same major versions as trakr's `package.json`. New dependencies:

- `barcode-detector`: ZXing-C++ WebAssembly ponyfill, MIT.

Avoid adding anything else without a reason recorded in the PR.

### 2.1 Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `BASE_PATH` | CI | Same as trakr (`/myeats/` on GitHub Pages) |
| `VITE_DEXIE_CLOUD_URL` | `.env.local`, Actions variable `DEXIE_CLOUD_URL` | Optional sync. Unset means the addon is stubbed out, as in trakr |
| `VITE_USDA_API_KEY` | `.env.local`, Actions variable `USDA_API_KEY` | Free data.gov key. It ends up in the public bundle, which is acceptable for this key: it only rate-limits. It can be overridden per device in Settings. If neither is set, `DEMO_KEY` is used and Settings shows a warning |

## 3. Screens

The bottom tab bar has four tabs: **Diary, Foods, Weight, Trends**. Settings is a gear icon in the Diary header. While the Add overlay is open the tab bar is hidden.

| Route | Screen |
|---|---|
| `/` | **Diary** for today (3.1) |
| `/day/:date` | **Diary** for a past day, read-only (3.1.5) |
| `/?add=<categoryId>` | **Add overlay** on top of the Diary (3.2). This is a search param, not a route, so Back closes it |
| `/foods` | **Foods library**: segmented **Foods / Meals / Recipes** with a filter field (3.4) |
| `/foods/new`, `/foods/:id` | **Food editor** (3.5) |
| `/meals/new`, `/meals/:id` | **Saved meal editor** (3.6) |
| `/recipes/new`, `/recipes/:id` | **Recipe editor** (3.7) |
| `/weight` | **Weight**: log today, chart, list (3.8) |
| `/trends` | **Trends**: weekly averages, calories and protein charts (3.9) |
| `/settings` | **Settings** (3.10) |
| `/settings/goals` | **Goals**: current goal and goal history (3.10.1) |
| `/settings/categories` | **Categories editor** (3.10.2) |

### 3.1 Diary

This follows Cronometer's layout (summary, then meal groups) in Signal styling. The wireframe is illustrative; the design system decides the details.

```
┌───────────────────────────────────────┐
│ ‹   TODAY · MON 16 NOV   ›         ⚙  │  header: date nav, settings
├───────────────────────────────────────┤
│ CALORIES               1,620 / 2,400  │  summary card
│ ██████████████████░░░░░░░░   780 left │  kcal bar (ink)
│                                       │
│ PROTEIN      120 / 180 g     60 left  │  macro bars (macro colours)
│ ████████████░░░░░░         30% kcal   │
│ NET CARBS    140 / 220 g     80 left  │
│ █████████░░░░░░            35% kcal   │
│ FAT           52 / 80 g      28 left  │
│ ███████░░░░                29% kcal   │
│ ▸ MORE   FIBER 18/35 · SUGAR 41/50 …  │  collapsible secondary rows
├───────────────────────────────────────┤
│ BREAKFAST                  512 kcal ＋ │  category header
│   Rolled oats          80 g       304 │  entry rows
│   Whey isolate      1 scoop       120 │
│   Banana           1 medium        88 │
│ LUNCH                             ＋  │  empty category: header only
│ MEAL 3                            ＋  │
│ DINNER                            ＋  │
│ SNACKS                            ＋  │
├───────────────────────────────────────┤
│ WEIGH-IN   182.4 lb · 82.7 kg         │  today's weigh-in, or "Log weight ＋"
└───────────────────────────────────────┘
   Diary     Foods     Weight     Trends
```

#### 3.1.1 Summary card

- **Calories row:** `eaten / goal` in mono, then a bar, then `N left` or `N over`.
- **Macro rows:** Protein, Net carbs and Fat, each showing `eaten / goal g`, a bar in the macro's colour, `N left` or `N over`, and the macro's share of the calories eaten so far (`30% kcal`, with protein and carbs at 4 kcal/g and fat at 9 kcal/g).
- **More:** collapsed by default, and the open or closed state is remembered per device. The collapsed row shows inline summaries. Expanded, it shows the same rows for Fiber, Sugar, Sat fat and Sodium. A secondary nutrient with no goal shows the eaten amount only, with no bar.
- **Over-goal display** depends on the goal direction (4.5):
  - `target` (calories, net carbs, fat): the bar is full, an overflow tick appears at the end in `--danger`, and the text reads `N over` in `--danger`.
  - `min` (protein, fiber): the bar is full in the macro colour, the text reads `+N`, and there is no danger colour.
  - `max` (sugar, sat fat, sodium): behaves like `target`.
- **No goal set** (fresh install): bars are hidden, eaten amounts are shown, and an inline link reads "Set daily goal".
- Tapping the summary card opens nothing in v1. Keep it static.

#### 3.1.2 Category sections

- Categories are shown in the user's order (archived ones are hidden on today). Every active category always shows, even when empty, so you can always see where to log.
- **Header:**
  - The name, as a micro-label.
  - The category's kcal subtotal, hidden when empty.
  - A `＋` button (48 px target) that opens the Add overlay preset to this category.
  - A `⋯` menu with: **Copy from yesterday** (disabled when yesterday has no entries in this category), **Save as meal** (disabled when empty), and **Clear** (with confirmation and an Undo toast).
- **Entry row:**
  - The name, plus the brand in muted text if present.
  - The amount as it was logged (`80 g`, `1 scoop`, `1.5 serving`).
  - kcal, right-aligned in mono.
  - A second line in small muted mono: `P 24 · C 30 · F 5`, where C is net carbs.
  - A quick-add entry shows its label (default "Quick add").
  - An entry with incomplete source data shows a small `~` mark, with a tooltip/aria label "Some nutrients missing".
- **Saved-meal group:** entries logged together from a saved meal appear under an indented sub-header with the meal name and its combined kcal. The items stay individually editable.
- **Tapping an entry** opens the **Entry sheet**:
  - amount and unit, with a live preview
  - a category picker
  - **Delete**, which takes effect immediately with an Undo toast
  - **Save**
  - Changing the amount recomputes from the entry's snapshot (4.3), not from the current food.

#### 3.1.3 Header

- The date label reads `TODAY · MON 16 NOV`.
- `‹` goes to the previous day. `›` goes to the next day and is disabled on today.
- Tapping the label opens a native date input (`max` = today).
- If the app is open across midnight, it switches to the new day when the page becomes visible again (`visibilitychange`) and once a minute while visible.

#### 3.1.4 Weigh-in row

- If today has a weigh-in, the row shows `182.4 lb · 82.7 kg` (and body fat if recorded). Tapping it opens the Weight tab.
- If not, the row reads **Log weight ＋** and opens an inline sheet with a weight field (lb), an optional body fat field, and Save.

#### 3.1.5 Past days (`/day/:date`)

- The same layout as today, with a muted banner: `VIEWING SUN 15 NOV · READ-ONLY` and **Back to today**.
- There is no `＋`, the Entry sheet does not open, and the category `⋯` menu only offers **Copy to today**.
- Long-pressing an entry (or using its `⋯` on desktop) offers **Copy to today**.
- The summary compares against the goal that was in effect on that date (4.5).

### 3.2 Add overlay

This is the critical path. It is an overlay mounted inside the Diary route, not a separate route, so the search input can be focused **synchronously inside the `＋` tap handler**. On iOS Safari, focus that happens after an async step or route transition does not raise the keyboard. The overlay's DOM is mounted with the Diary and only shown or hidden, and the URL gets `?add=<categoryId>` via `replace: false` so the iOS back swipe and the Back button close it.

```
┌───────────────────────────────────────┐
│ ✕   ADD TO  [ Breakfast ▾ ]           │  category chip opens a picker
│ ┌───────────────────────────────┬───┐ │
│ │ Search foods                  │ ▥ │ │  search field + scan button
│ └───────────────────────────────┴───┘ │
│ [Recent] Favourites  Meals  Recipes   │  shown when the query is empty
│ ＋ Quick add        ＋ Create food    │
│                                       │
│ Rolled oats              80 g · 304   │  rows: name, last amount, kcal
│ Whey isolate          1 scoop · 120   │
│ Usual breakfast (meal)          512   │
│ …                                     │
├───────────────────────────────────────┤
│ BREAKFAST · 2 ADDED · 424 kcal  [Done]│  appears after the first add
└───────────────────────────────────────┘
```

**With an empty query:**

- Chips: **Recent** (default), **Favourites**, **Meals**, **Recipes**.
- Two actions: **Quick add** and **Create food**.
- **Recent** lists up to 30 distinct foods, recipes and meals, sorted by `lastUsedAt` descending. Each row shows the amount last used and the kcal for that amount.

**When typing:**

- **Your foods** section: local foods, recipes and meals, scored as in 6.1, updated on every keystroke with no debounce. Remote foods you've already opened or logged are cached locally and appear here.
- **USDA** section: the remote search results below, as in 6.2.
  - It starts after a 250 ms debounce, and an `AbortController` cancels stale requests.
  - While waiting, any cached results for the same normalised query show immediately, marked as cached.
  - Offline, the section reads "Offline: showing saved foods only".
  - On a rate limit, it reads "USDA search is busy, try again in a minute".
  - Remote results that duplicate a local food (same `source + sourceId`, or overridden) are hidden.

**Choosing a result** opens the **Amount panel**, a sheet over the list. Its contents:

- the name and brand
- the amount field, focused, with `inputmode="decimal"`, prefilled with the last amount used for this food or else 1 of the default serving
- the unit picker (6.4)
- a live preview of kcal and P/C/F for the chosen amount
- a favourite star and an **Edit food** link
- the **Add** button, which is the primary action

**Placement of Add:** the iOS decimal keypad has **no Return key**, so Add is in a bar pinned to the top of the on-screen keyboard (positioned with `window.visualViewport`). Enter still adds on desktop and hardware keyboards.

**After Add:**

- The entry is written optimistically.
- The panel closes, the search clears and refocuses, and the footer shows `CATEGORY · N ADDED · kcal` with **Done** and a 5-second **Undo** for the last item.
- **Done**, ✕, Back or Escape closes the overlay.
- The point is that logging four breakfast items doesn't mean reopening the overlay four times.

**Choosing a meal:** this opens the **Meal panel**, which lists its items with editable amounts for this log only and a total, then **Add all**. It creates one entry per item, sharing a `mealLog` group (4.3).

**Choosing a recipe:** this opens the Amount panel with the recipe's units: `serving` (1/yield), plus `g` if a cooked weight is set.

**Quick add:**

- A sheet with an optional label, then kcal, protein, net carbs (stored as carbs with fiber 0) and fat. Only kcal is required.
- If kcal is blank but macros are entered, kcal is derived at 4/4/9 and shown as `≈`.
- It is saved as `kind: 'quick'` and is not added to Recents.

**Create food:** opens the Food editor (3.5) as a sheet. When it's saved, the Amount panel for the new food opens.

**Category chip:** defaults to the category whose `＋` was tapped. If the overlay was opened another way (for example a future shortcut), it uses the time-of-day default (4.6). It can be changed at any time, and changing it affects the next add.

### 3.3 Scanner

- The scan button in the search field opens a full-screen camera view inside the overlay. It shows the rear camera, a guide rectangle, a ✕ button and **Enter barcode** for manual digit entry. A torch toggle is shown only where `MediaStreamTrack.getCapabilities().torch` is supported.
- On detection the lookup order is:
  1. Local foods by normalised barcode (6.3), with overrides first.
  2. Open Food Facts.
  3. USDA Branded search by GTIN/UPC.
  4. If nothing is found: "No match for 0123456789012" with **Create food** (barcode prefilled) and **Scan again**.
- A match opens the Amount panel directly. The remote food is saved into the local `foods` table on open, so a second scan works offline.
- If camera permission is denied or there's no camera, the view shows manual entry with a one-line explanation.

### 3.4 Foods library

- A segmented control switches between **Foods**, **Meals** and **Recipes**, with a filter field above.
- **Foods** lists custom foods, overrides and remote foods that have been cached, sorted with favourites first, then by name.
  - Row actions: star, and tap to edit.
  - A remote food that hasn't been overridden opens read-only with **Edit (save my version)**.
- **Meals** and **Recipes** list by name, with kcal per meal or per serving. Tapping opens the editor. Each tab has a **New** button.
- Delete is a soft delete (`deletedAt`). Deleted items disappear from search and lists, but past entries are untouched because they hold snapshots.

### 3.5 Food editor

Fields:

- **Name** (required), **Brand**, **Barcode**.
- **Nutrition per:**
  - Either *one serving* (label, amount and unit, e.g. `1 bar = 45 g`) or *100 g*, chosen with a segmented control.
  - Typing values from a US label means choosing *one serving*.
  - The app stores values per 100 g (or per 100 ml), and converts on save.
- **Nutrients:** kcal (required), protein, total carbs, fiber, sugar, fat, sat fat (all in g), and sodium (mg). Blank means unknown, which is stored as `null` and is different from 0.
  - Show a live `Net carbs = total − fiber` read-out under the carb fields.
- **Base unit:** `g` (default) or `ml`, for liquids.
- **Servings:**
  - A list of rows, each with a label and an amount in the base unit (`1 scoop` → `32 g`). Add and remove rows; one row is marked as the default.
  - The serving entered under "Nutrition per" is added automatically.
- **Favourite** toggle.

Saving a remote food (USDA or OFF) never edits the cached original. It creates a custom food with `overrides: "usda:<fdcId>"` or `"off:<barcode>"`, and from then on that override replaces the original in search, scan and Recents (4.2).

### 3.6 Saved meal editor

- Fields: Name (required); Items, each a food or recipe with an amount and unit, reorderable with dnd-kit; and Total (kcal and P/C/F).
- Optional **Default category**, which preselects the category when the meal is added from the Foods library. This is not used from the Diary `＋`, which already has a category.
- **Save as meal** from a Diary category pre-populates the items from that day's entries. Quick-add entries are skipped, with a note.

### 3.7 Recipe editor

- Fields: Name (required); Ingredients (foods only in v1, no nested recipes), each with an amount and unit; **Servings per batch** (required, ≥ 1); and **Cooked weight** (g, optional).
- Shows the totals for the batch and per serving.
- A recipe's nutrition is computed live from its ingredients' current food data. Logging a portion takes a snapshot.

### 3.8 Weight

- **Log today** card:
  - A weight field in lb (one decimal), with a live kg read-out (`= 82.7 kg`).
  - An optional body fat % field.
  - **Save**.
  - If today already has a weigh-in, the card edits it: one weigh-in per date.
- **Chart:**
  - Raw points only, with no trend line or average.
  - Range chips: 1M, 3M, 1Y, All. The y-axis is lb and auto-fits with padding.
  - The tooltip shows date, lb, kg and body fat %.
  - Points connect with a thin line in `--ink` at low opacity, and each point is a 4 px dot.
- **List:**
  - Newest first, showing date, lb, kg (muted), body fat %, and the change from the previous weigh-in (`−0.6`).
  - Tap a row to edit or delete it, which fixes typos. The date cannot be changed and there is no backdating.

### 3.9 Trends

- Range chips: **4W, 12W, 26W**.
- **Weekly averages** table, one row per ISO week (Mon–Sun), newest first, with columns:
  - week label
  - days logged (`5/7`)
  - average kcal, protein, net carbs, fat and fiber
  - Averages are over logged days only. A day counts as logged if it has at least one entry.
  - Values over goal for `target`/`max` nutrients are marked with a small danger tick; colour is never the only signal.
- **Calories chart:** a bar per day, with the day's goal as a stepped line (it follows goal history). Days with no entries are gaps.
- **Protein chart:** the same, in the protein colour.
- Recharts is lazy-loaded with this route and with Weight.

### 3.10 Settings

| Section | Contents |
|---|---|
| Goals | Opens `/settings/goals` |
| Categories | Opens `/settings/categories` |
| Appearance | Light / Dark / System (as in trakr) |
| Food database | USDA API key: shows whether the build key, a device key or `DEMO_KEY` is in use; a field to set a device key; and a **Test** button. Link to the free key signup. Data credit: "Food data from USDA FoodData Central and Open Food Facts (ODbL)" |
| Data | Export backup, Import backup (Merge or Replace), Clear all data (type DELETE), as in trakr |
| Account & sync | As in trakr (section 8) |
| About | Version; storage persistence status |

#### 3.10.1 Goals

- **Editing:**
  - Required fields: kcal, protein g, net carbs g, fat g.
  - Optional fields: fiber g (min), sugar g (max), sat fat g (max), sodium mg (max).
- **Read-outs under the macro fields:**
  - Each macro's share of the kcal goal (`P 30% · C 37% · F 30%`).
  - When macro kcal differs from the kcal goal by more than 5%, a plain note: `Macros add up to 2,310 kcal`. This is information only, not a block.
- **Saving:**
  - Saving writes a goal version with `effectiveFrom` = today, or replaces today's version if one exists.
  - Past days keep comparing against the version in effect then.
- **Goal history:** a list of versions, newest first. Read-only in v1.

#### 3.10.2 Categories

- Rename inline; drag to reorder (dnd-kit); **Add category**.
- Each category has an optional **Starts at** time (`HH:MM`) that drives the time-of-day default (4.6).
- **Remove** archives the category: it stays on past days with its name but is hidden from today and the Add overlay. At least one active category must remain.
- Defaults on a fresh install:

| Order | Name | Starts at |
|---|---|---|
| 1 | Breakfast | 04:00 |
| 2 | Lunch | 11:00 |
| 3 | Meal 3 | 14:30 |
| 4 | Dinner | 17:30 |
| 5 | Snacks | 20:30 |

## 4. Data model

IDs are ULIDs. Timestamps are ISO-8601 strings. Calendar dates are local `YYYY-MM-DD` strings, from `lib/dates.ts`, never `toISOString()` (that gives UTC). Types live in `src/domain/types.ts`.

### 4.1 Nutrients

```ts
/** Amounts per 100 base units (food) or totals (entry). null = unknown, not zero. */
type Nutrients = {
  kcal: number | null;
  protein: number | null;   // g
  carbs: number | null;     // g, TOTAL carbohydrate (US label convention, includes fiber)
  fiber: number | null;     // g
  sugar: number | null;     // g
  fat: number | null;       // g
  satFat: number | null;    // g
  sodium: number | null;    // mg
};
```

- **Net carbs** are always derived, never stored: `max(0, (carbs ?? 0) − (fiber ?? 0))`. Goals and every display use net carbs. Total carbs appear only in the Food editor.
- **Totals** treat `null` as 0. An entry whose snapshot has `null` in any of kcal, protein, carbs or fat gets the `~` incomplete mark.
- **Missing kcal:** if kcal is `null` but protein, carbs and fat are known, `deriveKcal` gives `4P + 4C + 9F`, flagged `kcalDerived: true` and shown with `≈`.
- **EU labels:** on EU labels, "carbohydrate" already excludes fiber, so net carbs come out too low for imported EU products from Open Food Facts. v1 does not try to detect this. The user can fix a product with an override. Record this in the in-app help text for the food editor.

### 4.2 Tables (Dexie version 1)

| Table | Index string | Contents |
|---|---|---|
| `foods` | `id, source, sourceId, barcode, overrides, nameLower, lastUsedAt, favoriteAt, deletedAt` | `Food` (below) |
| `recipes` | `id, nameLower, lastUsedAt, favoriteAt, deletedAt` | `Recipe` |
| `meals` | `id, nameLower, lastUsedAt, favoriteAt, deletedAt` | `SavedMeal` |
| `entries` | `id, date, [date+categoryId], refId, mealLogId` | `Entry` |
| `categories` | `id, order` | `Category` |
| `goals` | `id, &effectiveFrom` | `Goal` |
| `weighIns` | `id, &date` | `WeighIn` |
| `settings` | `key` | One row `key: "app"`, per device |
| `searchCache` | `key, fetchedAt` | Remote search results, per device |

**IndexedDB cannot index booleans.** Use nullable timestamps: `favoriteAt` and `deletedAt`, not `isFavorite` and `isDeleted`.

```ts
type Food = {
  id: string;
  source: 'custom' | 'usda' | 'off';
  sourceId: string | null;          // fdcId for usda, normalised barcode for off
  overrides: string | null;         // custom foods only: "usda:<fdcId>" | "off:<barcode>"
  name: string; nameLower: string; brand: string | null;
  barcode: string | null;           // normalised GTIN-13 (see 6.3)
  baseUnit: 'g' | 'ml';
  per100: Nutrients;
  servings: { id: string; label: string; amount: number }[];  // amount in baseUnit
  defaultServingId: string | null;
  lastAmount: { amount: number; unit: UnitRef } | null;      // prefill for the Amount panel
  useCount: number; lastUsedAt: string | null;
  favoriteAt: string | null; deletedAt: string | null;
  fetchedAt: string | null;         // remote foods
  createdAt: string; updatedAt: string;
};

type UnitRef = { kind: 'base' } | { kind: 'serving'; servingId: string };

type Recipe = {
  id: string; name: string; nameLower: string;
  ingredients: { foodId: string; amount: number; unit: UnitRef }[];
  servingsPerBatch: number;         // >= 1
  cookedWeightG: number | null;
  lastAmount, useCount, lastUsedAt, favoriteAt, deletedAt, createdAt, updatedAt;  // as Food
};

type SavedMeal = {
  id: string; name: string; nameLower: string;
  items: { kind: 'food' | 'recipe'; refId: string; amount: number; unit: UnitRef }[];
  defaultCategoryId: string | null;
  useCount, lastUsedAt, favoriteAt, deletedAt, createdAt, updatedAt;
};

type Entry = {
  id: string;
  date: string;                     // local YYYY-MM-DD, always "today" at creation
  categoryId: string;
  order: number;                    // within the category for the day
  kind: 'food' | 'recipe' | 'quick';
  refId: string | null;             // food or recipe id
  name: string; brand: string | null;
  amount: number | null;            // null for quick add
  unitLabel: string | null;         // "g", "1 scoop", "serving" as displayed
  baseAmount: number | null;        // amount in base units
  // Snapshot, so amount edits and history never depend on the current food:
  snapshot: { baseUnit: 'g' | 'ml'; per100: Nutrients; servings: Food['servings'] } | null;
  nutrients: Nutrients;             // totals for this entry
  kcalDerived: boolean;
  mealLogId: string | null;         // shared by entries logged together from a saved meal
  mealName: string | null;
  createdAt: string; updatedAt: string;
};

type Category = { id: string; name: string; order: number; startsAt: string | null; archivedAt: string | null };

type Goal = {
  id: string; effectiveFrom: string; // YYYY-MM-DD, unique
  kcal: number; protein: number; netCarbs: number; fat: number;
  fiber: number | null; sugar: number | null; satFat: number | null; sodium: number | null;
};

type WeighIn = { id: string; date: string; weightLb: number; bodyFatPct: number | null; createdAt: string; updatedAt: string };

type Settings = {
  key: 'app';
  theme: 'light' | 'dark' | 'system';
  usdaApiKey: string | null;
  summaryMoreOpen: boolean;
};
```

**Recipe snapshot:** when a recipe portion is logged, `snapshot.per100` is the recipe's per-100 g nutrients if a cooked weight is set, or else per-serving values with `servings: [{label:'serving', amount: 1}]` and `baseUnit: 'g'` treated as a unitless count. Implement this in `domain/recipes.ts` and test it.

**Rules carried over from trakr:**

- Never edit a released Dexie version in place.
- Never delete user data without explicit confirmation.
- Backups and old data must keep loading.

### 4.3 Logging and snapshots

- **Logging a food** writes the entry and updates the food's `lastAmount`, `useCount` and `lastUsedAt` in one transaction.
- **Logging a saved meal:**
  - Writes one entry per item, sharing a new `mealLogId` and `mealName`.
  - Updates the meal's `useCount` and `lastUsedAt`.
  - Updates each item food's `lastUsedAt`, but not its `lastAmount`.
- **Copy from yesterday / Copy to today** clones entries with new ids, today's date, the target category, and the original snapshots.
- **Undo** deletes the created entries (or restores deleted ones) from an in-memory record of the last action.

### 4.4 Units

- Body weight is stored in **lb** and always displayed as `lb` with kg as secondary text. `kg = lb × 0.45359237`, rounded to one decimal.
- Food amounts are in base units (`g` or `ml`) or servings. There is no density conversion between g and ml.
- **Number formatting:**
  - kcal: integer with thousands separators.
  - Grams: one decimal below 10, integer from 10.
  - Sodium: integer mg.
  - Percentages: integer.

### 4.5 Goals

- `goalFor(date)` returns the goal with the greatest `effectiveFrom` ≤ `date`, or `null`.
- **Directions:**
  - `target`: kcal, netCarbs, fat.
  - `min`: protein, fiber.
  - `max`: sugar, satFat, sodium.
- The direction only changes how over-goal is displayed (3.1.1).

### 4.6 Default category

`defaultCategory(now, categories)` picks the active category with the latest `startsAt` ≤ the current local time. If none qualifies (before the earliest start), it picks the last category with a start time, since late-night eating counts as the previous evening's category. If no category has a start time, it picks the first category.

## 5. Sync and backup

- **Dexie Cloud:**
  - Set up exactly as in trakr, but with its **own database** (`npx dexie-cloud create` in this repo).
  - The free plan allows several databases (10 at the time of writing) and 3 production users, so it can sit alongside trakr's database at no cost. Each database has the free tier's own storage limit (100 MB), which is plenty.
  - Origins to whitelist: `http://localhost:5173` and `https://rcstephenson.github.io`.
  - Unsynced tables (`unsyncedTables` option): `settings`, `searchCache`.
  - Everything else syncs, including cached remote foods, so Recents work on every device.
- **Backup:**
  - Export writes `myeats-backup-YYYY-MM-DD.json` as `{ app: 'myeats', backupVersion: 1, exportedAt, data: { foods, recipes, meals, entries, categories, goals, weighIns } }`.
  - `searchCache` and `settings` are not included.
  - Import validates with Zod and offers **Merge** (upsert by id) or **Replace** (with a typed DELETE confirmation), exactly as in trakr.
  - Document the format in `docs/backup-format.md`.
- On start, call `navigator.storage.persist()`. On iOS, Safari may evict data for sites that are not installed to the home screen, so Settings > About shows the persistence status and recommends installing, and the README tells users to back up.

## 6. Food search, data sources and scanning

### 6.1 Local search (`domain/search.ts`)

- An in-memory index of non-deleted foods, recipes and meals, built from a `useLiveQuery`. Rebuilding it on change is fine at expected sizes (a few thousand items).
- **Matching:**
  - Query and names are lower-cased, accent-folded (`normalize('NFD')`, then combining marks stripped) and tokenised on non-alphanumerics.
  - Every query token must prefix-match some token in the name or brand.
- **Score:** the sum of:
  - an exact name-prefix bonus
  - a favourite bonus
  - `log(1 + useCount)`
  - a recency decay on `lastUsedAt`
- Overridden originals (a custom food exists with `overrides` = `source:sourceId`) are excluded.
- **Budget:** under 5 ms for 5,000 items on a mid-range phone. Write a benchmark unit test with generated data and a loose threshold.

### 6.2 USDA FoodData Central (`sources/usda.ts`)

- **Search:**
  - `POST https://api.nal.usda.gov/fdc/v1/foods/search?api_key=KEY`, body `{ query, dataType: ["Foundation","SR Legacy","Branded"], pageSize: 30 }`.
  - Results include per-100 g `foodNutrients`, so no second request is needed to show kcal.
  - Sort generic results (Foundation, SR Legacy) above Branded, and keep API order within each group.
- **Details:**
  - `GET /fdc/v1/food/{fdcId}?api_key=KEY` runs when a Foundation or SR Legacy food is opened, to get `foodPortions` as servings.
  - For Branded foods, servings come from `servingSize`, `servingSizeUnit` and `householdServingFullText` in the search result.
- **Nutrient ids:**

| Nutrient | id | Notes |
|---|---|---|
| Energy kcal | 1008 | Fall back to 2047, then 2048 (Atwater) |
| Protein | 1003 | |
| Carbs | 1005 | |
| Fiber | 1079 | |
| Sugars | 2000 | |
| Fat | 1004 | |
| Sat fat | 1258 | |
| Sodium | 1093 | mg |

- **Limits:** about 1,000 requests per hour per key; `DEMO_KEY` is far lower. Handle HTTP 429 with the "busy" message. Never retry automatically in a loop.
- **Cache:**
  - `searchCache` key `usda:<normalised query>`, holding the mapped results and `fetchedAt`.
  - Shown immediately on a repeat query, then refreshed in the background if older than 7 days.
  - Keep the newest 300 queries.

### 6.3 Open Food Facts (`sources/off.ts`) and barcodes

- **Lookup:** `GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json?fields=code,product_name,brands,nutriments,serving_size,serving_quantity&app_name=MYeats&app_version=<version>`.
  - OFF asks for an identifying User-Agent. Browsers don't allow setting one, so identify with the `app_name` and `app_version` parameters.
  - Product reads are rate-limited at about 100 per minute, which is fine.
  - Do **not** use OFF search: it is limited to about 10 per minute, and USDA handles search.
- **Mapping** from `nutriments`:

| Field | Maps to | Notes |
|---|---|---|
| `energy-kcal_100g` | kcal | If missing, use `energy_100g / 4.184` |
| `proteins_100g` | protein | |
| `carbohydrates_100g` | carbs | |
| `fiber_100g` | fiber | |
| `sugars_100g` | sugar | |
| `fat_100g` | fat | |
| `saturated-fat_100g` | satFat | |
| `sodium_100g` | sodium | × 1000 to get mg |

  - `serving_quantity` (g) with `serving_size` as the label becomes a serving.
  - `status: 0` means not found.
- **Normalisation** (`domain/barcode.ts`): strip non-digits, then left-pad UPC-A (12) and EAN-8/UPC-E as appropriate to GTIN-13 for storage and lookup. Expand UPC-E to UPC-A first. Validate the check digit. Query OFF with the code as scanned.

### 6.4 Units in the Amount panel

- The picker offers `g` (or `ml`) plus every serving, with the default serving first.
- Changing the unit converts the current amount so the quantity stays the same (e.g. `80 g` → `2.5 × 32 g scoop`). Round to 2 decimals for servings and integers for g.

### 6.5 Barcode scanning on iPhone (`src/scanner/`)

- **Library:**
  - Safari, and so every iOS browser, has no native `BarcodeDetector`. Use the `barcode-detector` package (ZXing-C++ compiled to WebAssembly) as a **ponyfill**: `import { BarcodeDetector, prepareZXingModule } from 'barcode-detector/ponyfill'`.
  - Use the native detector when `'BarcodeDetector' in window`.
  - Formats: `ean_13`, `ean_8`, `upc_a`, `upc_e`.
- **Self-host the `.wasm`.**
  - By default the library fetches it from a CDN, which breaks offline use and adds a third-party request.
  - Import it with Vite's `?url`, pass it to `prepareZXingModule({ overrides: { locateFile } })`, and include it in the Workbox precache (raise `maximumFileSizeToCacheInBytes` if needed).
- **Lazy-load** the scanner chunk on the first tap of the scan button. Prefetch it with `requestIdleCallback` after the Add overlay first opens.
- **Camera:**
  - `getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } })`.
  - `<video playsinline muted autoplay>`. `playsinline` is required on iOS.
  - Stop all tracks when the view closes or the page is hidden.
- **Decode loop:** call `detect()` on the video about every 150 ms (`requestVideoFrameCallback` where available, otherwise a timer). Accept a code once it's seen twice in a row, to avoid misreads.
- **Requirements:**
  - HTTPS.
  - iOS 17+ in Safari or a home-screen PWA. In standalone mode iOS may ask for camera permission again each launch; that's expected.
  - There is no `navigator.vibrate` on iOS, so confirm a scan visually.
- **Phase 0 spike:** confirm on a real iPhone, both in Safari and installed to the home screen, that the deployed build scans a UPC-A and an EAN-13.

### 6.6 CORS

Both APIs are expected to allow browser calls from any origin. **The Phase 0 spike must confirm this from the deployed GitHub Pages origin.** If either doesn't, stop and report it; it would need a small proxy, such as a Cloudflare Worker, which changes the architecture.

## 7. iOS and responsiveness requirements

- **Viewport and layout:**
  - `viewport-fit=cover`.
  - Pad for `env(safe-area-inset-*)`.
  - Use `100dvh`, not `100vh`.
  - The tab bar sits above the home indicator.
- **Input zoom:** all inputs use `font-size` ≥ 16 px, so iOS doesn't zoom on focus.
- **Input types:**
  - Numeric fields use `inputmode="decimal"` with `pattern` and `enterkeyhint="done"`, and also accept a comma as the decimal separator.
  - The Add action bar sits on the keyboard (3.2).
- **Keyboard focus:** raise the keyboard by focusing synchronously within a user gesture (the Add overlay design depends on this).
- **Touch:**
  - Touch targets are at least 48 px, as in trakr.
  - No hover-only affordances. Long-press menus have a visible `⋯` alternative.
- **Desktop:**
  - Content is a single centred column, max width 560 px.
  - Keyboard: `/` focuses search when the overlay is open, `Esc` closes it, and Enter adds.

## 8. Design

Signal from trakr, with an orange accent and per-macro colours. Full details in [`docs/design-system.md`](docs/design-system.md).

## 9. Performance budgets

These are measured on an iPhone 12-class device running the production build, installed. Each is checked in Phase 10 and kept in CI where it can be automated.

| Interaction | Budget |
|---|---|
| Cold start (cached PWA) to interactive Diary | < 1.5 s |
| Tap `＋` to keyboard visible with the input focused | < 150 ms |
| Keystroke to updated local results | < 50 ms p95 |
| Tap Add to entry visible in the totals | < 100 ms (optimistic write) |
| Repeat remote query (cached) to results shown | < 50 ms |
| Tap scan to live camera (after permission) | < 1 s |

- **Main JS bundle:** under 180 KB gzip, excluding lazy chunks (scanner, Recharts routes). Add a `size-limit`-style check in CI, or a script reading the Vite manifest.
- **Lighthouse (mobile):** Performance ≥ 90, Accessibility ≥ 95, installable PWA.
- **Rendering:** Diary and result lists render without layout shift. Result rows have fixed heights. Virtualise only if a list exceeds about 200 rows.

## 10. Quality bar

- TypeScript strict; no `any` in `domain/`, `db/` or `sources/`.
- `npm run typecheck`, `lint`, `test` and `e2e` all pass before a deploy.
- **Unit tests cover all of `domain/`**, including:
  - nutrient maths, net carbs, derived kcal
  - unit conversion
  - goal lookup
  - default category
  - search scoring
  - barcode normalisation
  - weekly averages
  - the USDA/OFF mappers, against recorded JSON fixtures in `tests/fixtures/` (real responses, trimmed)
- **e2e tests:**
  - Use Playwright's `webkit` project on an iPhone viewport as the primary project, plus Chromium.
  - Every remote call goes through `page.route` with fixtures. The real APIs are never hit in tests.
  - The scanner e2e covers the manual-entry path, plus a test hook that injects a fake detector result.
- Do not commit personal data such as goals, body weight or food logs. The repo is public.

## 11. Decisions made for unanswered or ambiguous points

The owner can change any of these; they're recorded here so agents don't guess.

| # | Point | Decision |
|---|---|---|
| D1 | Accent colour (questionnaire 2.2 unanswered) | Signal orange (`#ff6a13` Paper, `#ff7a29` Graphite), with protein green, net carbs blue and fat violet. Every colour is a single token, so it's a one-line change |
| D2 | "Log today only" vs. forgetting to log yesterday's dinner | Strict: no adding to past days. Past entries can be copied to today. If this proves annoying, a later version can allow adding to yesterday only |
| D3 | Can past entries and weigh-ins be edited or deleted? | Past diary entries: read-only. Weigh-ins: editable and deletable (typo fixes), never backdated |
| D4 | Calorie bar colour | Ink (neutral), so the accent stays an indicator and the macro colours stay distinct |
| D5 | Weigh-ins per day | One per date; saving again replaces it |
| D6 | Nested recipes | Not in v1 |
| D7 | Add overlay after adding | Stays open for multi-add, with Done (Cronometer closes after each add) |
