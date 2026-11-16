# MYeats design system: Signal (orange variant)

MYeats uses trakr's **Signal** design language unchanged, except for what this document lists. Read trakr's [`docs/design-system.md`](https://github.com/rcstephenson/trakr/blob/main/docs/design-system.md) first. The principles, typography (Geist and Geist Mono), spacing, radii, hairlines, the dot grid, focus rules, motion and voice all carry over.

These carry over without change, so copy them from trakr and adjust only the tokens:

- `src/styles/index.css`
- `tailwind.config.ts`
- `src/components/ui/*`: Button, Card, Chip, ConfirmDialog, EmptyState, InlineSelect, Mono, PageHeader, SectionLabel, SegmentedBar, Sheet, TabBar
- `src/lib/theme.ts`
- the `/dev/ui` page

Like trakr, the code is the source of truth once it exists. If this document and the code disagree, fix the document.

## 1. What changes

1. **The accent is orange, not lime.** It keeps exactly the same role as an indicator light: the active tab tick, focus ring, today marker, selected chip underline, added-tick and the primary button on Graphite. It is never used as an area.
2. **Macro colours are new.** Protein, net carbs and fat each get a colour, used *only* for their bars, chart marks and 8 px legend squares, never for text.
3. **The calorie bar is ink.** Calories are the main number, and the accent stays reserved for indicators.
4. **No PR colour.** trakr's `--pr` amber is dropped.
5. **Layout:** Cronometer's information order (summary, then meal groups), drawn with Signal's hairline ledger rows.

## 2. Colour tokens

The neutral tokens (`--bg`, `--surface`, `--raised`, `--ink`, `--muted`, `--hairline`, `--hairline-strong`, `--danger`, `--scrim`) are identical to trakr. New or changed values:

| Token | Tailwind | Paper (light) | Graphite (dark) | Role |
|---|---|---|---|---|
| `--accent` | `bg-accent` | `#ff6a13` | `#ff7a29` | Indicator fills: tab tick, today marker, added tick, small squares |
| `--on-accent` | `text-on-accent` | `#0a0e14` | `#0a0c10` | Text on an accent fill |
| `--accent-ink` | `text-accent`, `border-accent`, `bg-accent-ink` | `#b23c00` | `#ff8a3d` | Accent text, lines, active-state bars and the focus ring |
| `--primary` | `bg-primary` | `#0a0e14` (ink) | `#ff7a29` | Primary button fill (as in trakr: ink on Paper, accent on Graphite) |
| `--on-primary` | `text-on-primary` | `#f8fafb` | `#0a0c10` | Primary button label |
| `--kcal` | `bg-kcal` | = `--ink` | = `--ink` | Calorie bar fill |
| `--protein` | `bg-protein`, `stroke-protein` | `#1f8f4e` | `#3ddc84` | Protein bar, chart and legend |
| `--carbs` | `bg-carbs`, `stroke-carbs` | `#2364d2` | `#5b9dff` | Net carbs bar, chart and legend |
| `--fat` | `bg-fat`, `stroke-fat` | `#8a3fd1` | `#b98cff` | Fat bar, chart and legend |
| `--secondary-nutrient` | `bg-nutrient` | = `--muted` | = `--muted` | Fiber, sugar, sat fat and sodium bars (neutral, to keep the summary calm) |
| `--track` | `bg-track` | = `--hairline` | = `--hairline` | Unfilled part of every bar |

**Removed:** `--pr`.

### 2.1 Contrast (WCAG 2.x, computed)

| Pair | Paper (bg / surface / raised) | Graphite (bg / surface / raised) | Verdict |
|---|---|---|---|
| `accent-ink` as text | 5.23 / 5.67 / 5.93 | 8.35 / 7.81 / 7.29 | AA text in both themes |
| `accent` fill | 2.53 / 2.74 / 2.87 | 7.52 / 7.03 / 6.57 | **Paper: decoration only.** Anything that must be perceived (active bars, focus) uses `accent-ink`, the same rule as trakr's lime |
| `on-accent` on `accent` | 6.74 | 7.52 | AA text |
| `protein` | 3.63 / 3.94 / 4.12 | 10.97 / 10.26 / 9.58 | ≥ 3:1 graphic in both |
| `carbs` | 4.84 / 5.24 / 5.49 | 7.19 / 6.72 / 6.28 | ≥ 3:1 graphic in both |
| `fat` | 4.99 / 5.40 / 5.66 | 7.70 / 7.20 / 6.72 | ≥ 3:1 graphic in both |

Add these rows to the contrast script and table when the tokens land. Macro colours still never carry text: labels are `text-ink` and `text-muted`, and every bar has a text label and numbers, so colour is never the only signal.

## 3. Typography additions

- Summary numbers (`1,620 / 2,400`): Geist Mono, tabular, `text-ink`. The calorie value is one step larger than the macro values.
- `N left` uses `text-muted`. `N over` uses `text-danger` together with the word "over", never colour alone.
- Category headers are micro-labels (`BREAKFAST`), as with trakr's section labels. Drop trakr's `01 /` indices on the Diary to keep it minimal; Settings and Trends may keep them.
- Entry names use Geist sans in `text-ink`; the amount and macro line use mono in `text-muted`.

## 4. New components

| Component | Spec |
|---|---|
| `NutrientBar` | Props: `label`, `eaten`, `goal \| null`, `unit`, `direction: 'target' \| 'min' \| 'max'`, `color` token, `share?` (the `% kcal` text). A 6 px track (`bg-track`, 2 px radius) with a fill clamped to 100%. When over a `target`/`max` goal, a 2 px `--danger` tick sits at the right end and the right text reads `N over`. With no goal, it shows just the label and the eaten amount, with no bar. `role="meter"` with `aria-valuenow/min/max` and an `aria-label` like "Protein 120 of 180 grams, 60 left" |
| `SummaryCard` | Calorie `NutrientBar` (large variant, 8 px track), three macro bars, and the collapsible **More** row. `surface` card, 8 px radius, hairline border |
| `CategorySection` | Header row (micro-label name, mono kcal subtotal, `＋` IconButton 48 px, `⋯` menu), then `EntryRow`s separated by hairlines. It always renders, even when empty |
| `EntryRow` | Two lines: name/brand and amount in mono, with kcal right-aligned; then the `P · C · F` line in small muted mono. At least 56 px tall. `~` incomplete mark. It is a full-row button that opens the Entry sheet |
| `MealGroupHeader` | Indented sub-header inside a category for a saved-meal log: meal name and combined kcal |
| `SearchField` | A 48 px input with a leading search icon, a clear button, and a trailing scan IconButton separated by a hairline. `font-size: 16px` |
| `ResultRow` | A fixed 56 px row: name (one line, truncated), brand or source micro-tag (`USDA`, `OFF`, `MEAL`, `RECIPE`, `CACHED`), and the amount and kcal on the right |
| `AmountPanel` | A sheet with the amount input (large mono), a unit `InlineSelect`, a live nutrient preview (kcal and P/C/F with macro legend squares) and a `KeyboardActionBar` |
| `KeyboardActionBar` | Fixed to the bottom of `visualViewport` so it rides on top of the iOS keyboard. It holds the primary action (Add / Save). It sits above the safe area when no keyboard is open |
| `AddedFooter` | Bar in the Add overlay: `BREAKFAST · 2 ADDED · 424 kcal` in micro-label mono, with **Done**. The Undo toast sits above it |
| `Toast` | Hairline bordered `raised` strip, one line of text plus an optional action (Undo). It auto-dismisses after 5 s. `aria-live="polite"` |
| `ScannerView` | Full-bleed video. The guide rectangle is drawn with a 2 px `accent-ink` outline and corner ticks, with no dimming gradient (Signal has no gradients). A scrim covers outside the guide. Controls at the bottom: torch (if supported), **Enter barcode**, ✕ |
| `WeightChart` | Recharts scatter-with-line: 4 px `--ink` dots and a 1 px line at 40% opacity, hairline grid, mono axis labels. A crosshair tooltip shows lb, kg and body fat |
| `DailyBarsChart` | Bars per day (calories in `--kcal`, protein in `--protein`) with a stepped goal line in `--accent-ink`, dashed 4/4 |

## 5. Charts

Follow trakr's data-visualisation section: no gradients or shadows, mono tick labels, hairline gridlines, and `--accent-ink` for the "current" highlight. Macro colours are used only where the macro is the subject of the chart.

## 6. Voice

Terse and factual, as in trakr. Examples:

- `780 left`, `120 over`, `+12`
- `No entries`, `Offline: showing saved foods only`
- `No match for 0123456789012`, `Added Rolled oats`

There is no coaching or praise copy ("Great job!"), no "healthy" or "unhealthy" labels, and no emoji.
