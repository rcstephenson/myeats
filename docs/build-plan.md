# myeats build plan

The phases are ordered so that each one ends with something deployable and testable. One phase is one PR, or a short series of PRs, and each must pass `typecheck`, `lint`, `test` and `e2e` before it merges. Section numbers refer to [`SPEC.md`](../SPEC.md).

**Scope rules:**

- An agent working a phase implements only that phase's scope.
- Anything the spec doesn't settle goes in the PR description as a question. Don't invent product behaviour.
- When the spec and trakr's code differ, the spec wins for myeats.

---

## Phase 0: Scaffold and risk spikes

**Scope**

- Create the repo from trakr's conventions. Copy and adapt:
  - configs: `package.json`, `tsconfig`, `vite.config.ts`, `vitest`/`playwright` configs, ESLint, Prettier, Tailwind, PostCSS
  - `.github/workflows/deploy.yml`, adding the `VITE_USDA_API_KEY: ${{ vars.USDA_API_KEY }}` env
  - `src/lib/{ids,dates,theme,cloud*}`
  - `src/components/ui/*`, `UpdatePrompt`, `index.css`
- Rename everything to myeats (always lower case). Update the PWA manifest: name `myeats`, theme colour, and new icons (a simple placeholder mark in ink and orange is fine).
- Apply the design tokens from `docs/design-system.md` §2, and render the new tokens on `/dev/ui`.
- Add the app shell: tab bar (Diary, Foods, Weight, Trends) and placeholder routes.
- Add a Playwright `webkit` iPhone project as the primary e2e project, keeping Chromium.
- Add a **spike page `/dev/spike`** (dev builds, plus behind `?spike` on production for this phase only). It has buttons that:
  1. call the USDA search for "banana"
  2. call OFF for barcode `3017620422003`
  3. open the camera with the `barcode-detector` ponyfill (self-hosted wasm) and show decoded values

**Acceptance**

- The app is deployed to `https://rcstephenson.github.io/myeats/` and installs as a PWA on iPhone.
- The spike confirms CORS works for USDA and OFF from the deployed origin. **If either fails, stop and report it** (SPEC 6.6).
- The spike decodes a UPC-A and an EAN-13 on a real iPhone in Safari and as a home-screen app, and reports the time to first decode.
- Remove the spike's production flag at the end of the phase.

## Phase 1: Data layer and domain

**Scope**

- `src/domain/types.ts` (SPEC 4.2).
- Dexie schema version 1 with all tables and indexes; `seed.ts` creates the default categories.
- Repositories:
  - foods, recipes, meals, entries (log, update, delete, copy, undo record)
  - categories, goals, weighIns, settings
- Domain modules, each with unit tests:
  - `nutrients.ts`: scale per-100 values, sum, net carbs, derive kcal, incomplete flag
  - `units.ts`: unit conversion, lb↔kg, number formatting
  - `goals.ts`: `goalFor`, directions, over/left maths, macro percentage of kcal
  - `categories.ts`: `defaultCategory`
  - `barcode.ts`: normalisation, UPC-E expansion, check digit
  - `recipes.ts`: per-serving and per-100 g, snapshot shape
  - `weekly.ts`: ISO weeks, averages over logged days

**Acceptance**

- 100% of the domain functions have unit tests, with edge cases: `null` nutrients, fiber > carbs, zero-yield recipes rejected, goal boundaries on `effectiveFrom`, and midnight for the default category.
- Repositories have tests against `fake-indexeddb`.

## Phase 2: Diary, goals, custom foods, quick add

**Scope**

- Diary for today:
  - header with date navigation and past-day read-only view (SPEC 3.1.3, 3.1.5)
  - `SummaryCard` with `NutrientBar`s (3.1.1)
  - `CategorySection`s with `EntryRow`s (3.1.2)
  - Entry sheet: edit amount, unit and category; delete with Undo
- Goals screen (3.10.1), with the "Set daily goal" link from an empty summary.
- Food editor (3.5) for custom foods: per-serving or per-100 g entry and the servings list.
- The **Add overlay shell** (3.2), with only these parts working:
  - local foods list (no scoring yet, alphabetical)
  - Amount panel with `KeyboardActionBar`
  - Quick add
  - Create food
  - multi-add footer and Undo

**Acceptance (e2e on WebKit iPhone)**

- Set a goal, create a food from label values per serving, and add it to Breakfast. Totals and bars update and `N left` is correct.
- Quick add 250 kcal to Snacks.
- Edit an entry's amount, then delete it and undo.
- Viewing yesterday is read-only.
- Unit tests confirm that changing a food after logging does not change the logged entry.

## Phase 3: Fast local search, Recents, Favourites

**Scope**

- `domain/search.ts` (SPEC 6.1) with a benchmark test.
- `useFoodIndex` builds the index.
- Empty-query chips: Recent, Favourites, Meals (placeholder until Phase 6), Recipes (placeholder).
- Amount panel prefill from `lastAmount`.
- Focusing the input synchronously in the `＋` tap handler (verify the keyboard appears on a real iPhone).
- The time-of-day default category for the Add overlay chip.

**Acceptance**

- A food added earlier appears at the top of Recent. Adding it again takes three taps from the Diary: `＋`, the row, Add.
- Keystroke-to-results stays under 50 ms with 5,000 generated foods, measured by a Playwright performance mark on the Chromium project with a loose threshold, plus a manual check on an iPhone.
- Favourites toggle from the Amount panel and from the Foods library list.

## Phase 4: USDA search and caching

**Scope**

- `sources/usda.ts` (SPEC 6.2) with debounce, abort, and errors for 429, offline and other failures.
- Generic-first ordering.
- A details fetch for Foundation and SR Legacy portions.
- `searchCache` with stale-while-revalidate and a cap of 300 queries.
- Opening or logging a remote food stores it in `foods`.
- Settings > Food database: key source, device key, Test button, and the data credit.

**Acceptance**

- Fixtures recorded from real responses live in `tests/fixtures/usda/`, and the mapper tests cover energy fallbacks (1008 → 2047 → 2048) and missing nutrients.
- e2e with mocked routes:
  - Search shows local results immediately and USDA results after the debounce.
  - Stale requests are aborted, so a fast typist never sees results out of order.
  - Offline shows saved foods and the offline note.
  - A repeated query shows cached results instantly.

## Phase 5: Barcode scanning, Open Food Facts, overrides

**Scope**

- `src/scanner/` (SPEC 6.5): lazy chunk, self-hosted precached wasm, native detector when available, camera lifecycle, the two-reads confirmation, torch where supported, and manual entry.
- `sources/off.ts` (6.3) and the lookup chain (3.3).
- Overrides: editing a remote food saves a custom override, which then replaces the original everywhere (search, scan, Recents).

**Acceptance**

- The OFF mapper is tested with fixtures, including the kJ-only energy case and sodium conversion.
- e2e uses a test hook to inject a detected barcode:
  - A known code opens the Amount panel.
  - An unknown code offers Create food with the barcode prefilled.
  - Scanning a code again while offline still works from the local cache.
  - An override wins over the original.
- Manual iPhone check, recorded in the PR: scanning a real product in Safari and as a home-screen app, and the time from tap to live camera.

## Phase 6: Saved meals, recipes, copying

**Scope**

- Saved meal editor (3.6) and recipe editor (3.7); the Foods library tabs (3.4).
- Meal panel in the Add overlay, with per-item amount changes that don't modify the saved meal.
- Meal-group display in the Diary.
- Logging recipes by serving, or by grams when a cooked weight is set.
- Category `⋯` menu: **Copy from yesterday**, **Save as meal**, **Clear**. On past days, **Copy to today** for a category and for an entry.

**Acceptance**

- e2e:
  - Build a meal of three foods and log it to Breakfast with one item's amount changed. The saved meal is unchanged and the Diary shows a grouped meal.
  - Make a recipe with 6 servings and log 1.5 servings. Change an ingredient afterwards; yesterday's entry is unchanged.
  - Copy yesterday's breakfast.

## Phase 7: Categories and goal history

**Scope**

- Categories editor (3.10.2): rename, reorder with dnd-kit, add, archive, and start times.
- Goal history list.
- Past days compare against historical goals.

**Acceptance**

- Archiving a category hides it today and keeps it on past days.
- Changing the goal today leaves yesterday's summary comparing against the old goal.
- At least one active category is enforced.

## Phase 8: Weigh-ins

**Scope**

- Weight tab (3.8) and the Diary weigh-in row (3.1.4).
- `WeightChart`: raw points, range chips, lb axis, and a lb/kg tooltip.

**Acceptance**

- Logging a weigh-in today, then saving again, replaces it.
- Editing and deleting from the list work, with no backdating.
- kg is always shown alongside lb with correct rounding.

## Phase 9: Trends

**Scope**

- Trends tab (3.9): weekly averages table, daily calories chart and daily protein chart with stepped goal lines; Recharts lazy-loaded.

**Acceptance**

- `weekly.ts` is unit-tested for averages over logged days only, ISO week boundaries, and a goal change mid-week (the line steps).
- e2e with seeded data renders the table and both charts.

## Phase 10: Backup, sync, polish and performance

**Scope**

- Backup export and import, Merge and Replace (SPEC 5), and `docs/backup-format.md`.
- Clear all data.
- Dexie Cloud sync with its own database; `settings` and `searchCache` unsynced.
- Storage persistence status.
- README (setup, sync, USDA key, backup).
- Audit the performance budgets (SPEC 9), the bundle-size check in CI, Lighthouse and accessibility.
- A `/dev/seed` demo seeder.

**Acceptance**

- A backup round-trip leaves the database identical, and import rejects invalid files with a clear error.
- The README sync steps work end to end from a clean device.
- Lighthouse mobile scores: Performance ≥ 90, Accessibility ≥ 95, installable PWA.
- Every budget in SPEC 9 is measured on an iPhone and recorded in the PR.

### iPhone QA checklist (run at the end of Phases 2, 5 and 10)

- [ ] Installs to the home screen; launches standalone; safe areas are correct and the tab bar clears the home indicator.
- [ ] `＋` raises the keyboard immediately. No zoom on focus.
- [ ] The Add bar rides on the decimal keypad. A comma decimal is accepted.
- [ ] The back swipe closes the Add overlay rather than leaving the app.
- [ ] The scanner works in Safari and standalone, and stops the camera when closed or backgrounded.
- [ ] Offline (airplane mode): Diary, Recents, local search and logging all work. Remote search shows the offline note.
- [ ] Light and dark themes follow the system setting.
- [ ] The day rolls over when the app is reopened after midnight.
