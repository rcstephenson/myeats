// Backup export/import and clear-all-data (SPEC section 5, docs/backup-format.md).
import { z } from 'zod';
import { db } from '../db/schema';
import { ensureSeeded } from '../db/seed';
import { nowIso, toDateKey } from './dates';

const num = z.number().finite();
const nullableNum = num.nullable();
const iso = z.string().min(1);
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');

const NutrientsSchema = z.object({
  kcal: nullableNum,
  protein: nullableNum,
  carbs: nullableNum,
  fiber: nullableNum,
  sugar: nullableNum,
  fat: nullableNum,
  satFat: nullableNum,
  sodium: nullableNum,
});

const ServingSchema = z.object({ id: z.string().min(1), label: z.string(), amount: num });

const UnitRefSchema = z.union([
  z.object({ kind: z.literal('base') }),
  z.object({ kind: z.literal('serving'), servingId: z.string() }),
]);

const LastAmountSchema = z.object({ amount: num, unit: UnitRefSchema });

const baseUnit = z.enum(['g', 'ml']);
const nullableIso = iso.nullable();

const FoodSchema = z.object({
  id: z.string().min(1),
  source: z.enum(['custom', 'usda', 'off']),
  sourceId: z.string().nullable(),
  overrides: z.string().nullable(),
  name: z.string(),
  nameLower: z.string(),
  brand: z.string().nullable(),
  barcode: z.string().nullable(),
  baseUnit,
  per100: NutrientsSchema,
  servings: z.array(ServingSchema),
  defaultServingId: z.string().nullable(),
  lastAmount: LastAmountSchema.nullable(),
  useCount: num,
  lastUsedAt: nullableIso,
  favoriteAt: nullableIso,
  deletedAt: nullableIso,
  fetchedAt: nullableIso,
  createdAt: iso,
  updatedAt: iso,
});

const RecipeSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  nameLower: z.string(),
  ingredients: z.array(z.object({ foodId: z.string(), amount: num, unit: UnitRefSchema })),
  servingsPerBatch: num,
  cookedWeightG: nullableNum,
  lastAmount: LastAmountSchema.nullable(),
  useCount: num,
  lastUsedAt: nullableIso,
  favoriteAt: nullableIso,
  deletedAt: nullableIso,
  createdAt: iso,
  updatedAt: iso,
});

const MealSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  nameLower: z.string(),
  items: z.array(
    z.object({
      kind: z.enum(['food', 'recipe']),
      refId: z.string(),
      amount: num,
      unit: UnitRefSchema,
    }),
  ),
  defaultCategoryId: z.string().nullable(),
  useCount: num,
  lastUsedAt: nullableIso,
  favoriteAt: nullableIso,
  deletedAt: nullableIso,
  createdAt: iso,
  updatedAt: iso,
});

const EntrySchema = z.object({
  id: z.string().min(1),
  date: dateKey,
  categoryId: z.string(),
  order: num,
  kind: z.enum(['food', 'recipe', 'quick']),
  refId: z.string().nullable(),
  name: z.string(),
  brand: z.string().nullable(),
  amount: nullableNum,
  unitLabel: z.string().nullable(),
  baseAmount: nullableNum,
  snapshot: z
    .object({ baseUnit, per100: NutrientsSchema, servings: z.array(ServingSchema) })
    .nullable(),
  nutrients: NutrientsSchema,
  kcalDerived: z.boolean(),
  mealLogId: z.string().nullable(),
  mealName: z.string().nullable(),
  createdAt: iso,
  updatedAt: iso,
});

const CategorySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  order: num,
  startsAt: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be HH:MM')
    .nullable(),
  archivedAt: nullableIso,
});

const GoalSchema = z.object({
  id: z.string().min(1),
  effectiveFrom: dateKey,
  kcal: num,
  protein: num,
  netCarbs: num,
  fat: num,
  fiber: nullableNum,
  sugar: nullableNum,
  satFat: nullableNum,
  sodium: nullableNum,
});

const WeighInSchema = z.object({
  id: z.string().min(1),
  date: dateKey,
  weightLb: num,
  bodyFatPct: nullableNum,
  createdAt: iso,
  updatedAt: iso,
});

export const BackupSchema = z.object({
  app: z.literal('myeats'),
  backupVersion: z.literal(1),
  exportedAt: z.string(),
  data: z.object({
    foods: z.array(FoodSchema),
    recipes: z.array(RecipeSchema),
    meals: z.array(MealSchema),
    entries: z.array(EntrySchema),
    categories: z.array(CategorySchema),
    goals: z.array(GoalSchema),
    weighIns: z.array(WeighInSchema),
  }),
});

export type Backup = z.infer<typeof BackupSchema>;
export type BackupData = Backup['data'];
export type ImportMode = 'replace' | 'merge';

export interface BackupSummary {
  counts: Record<keyof BackupData, number>;
  /** Earliest and latest diary entry date, or null when there are none. */
  dateRange: { from: string; to: string } | null;
  exportedAt: string;
}

export type ParseBackupResult =
  { ok: true; backup: Backup; summary: BackupSummary } | { ok: false; errors: string[] };

const DATA_KEYS = [
  'foods',
  'recipes',
  'meals',
  'entries',
  'categories',
  'goals',
  'weighIns',
] as const;

/** Dexie Cloud adds `realmId`/`owner` to synced rows; they are account-specific, not backup data. */
function stripSyncFields<T extends object>(row: T): T {
  const copy: Record<string, unknown> = { ...(row as Record<string, unknown>) };
  delete copy.realmId;
  delete copy.owner;
  return copy as T;
}

export async function exportBackup(): Promise<Backup> {
  return db.transaction(
    'r',
    [db.foods, db.recipes, db.meals, db.entries, db.categories, db.goals, db.weighIns],
    async () => {
      const [foods, recipes, meals, entries, categories, goals, weighIns] = await Promise.all([
        db.foods.toArray(),
        db.recipes.toArray(),
        db.meals.toArray(),
        db.entries.toArray(),
        db.categories.toArray(),
        db.goals.toArray(),
        db.weighIns.toArray(),
      ]);
      return {
        app: 'myeats',
        backupVersion: 1,
        exportedAt: nowIso(),
        data: {
          foods: foods.map(stripSyncFields),
          recipes: recipes.map(stripSyncFields),
          meals: meals.map(stripSyncFields),
          entries: entries.map(stripSyncFields),
          categories: categories.map(stripSyncFields),
          goals: goals.map(stripSyncFields),
          weighIns: weighIns.map(stripSyncFields),
        },
      } satisfies Backup;
    },
  );
}

function formatIssuePath(path: PropertyKey[]): string {
  return path
    .map((p) => (typeof p === 'number' ? `[${p}]` : `.${String(p)}`))
    .join('')
    .replace(/^\./, '');
}

export function summarizeBackup(backup: Backup): BackupSummary {
  const dates = backup.data.entries.map((e) => e.date).sort();
  const counts = Object.fromEntries(DATA_KEYS.map((k) => [k, backup.data[k].length])) as Record<
    keyof BackupData,
    number
  >;
  return {
    counts,
    dateRange: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null,
    exportedAt: backup.exportedAt,
  };
}

/** Validates backup JSON (a string or an already-parsed value) without writing anything. */
export function parseBackup(json: unknown): ParseBackupResult {
  let value = json;
  if (typeof json === 'string') {
    try {
      value = JSON.parse(json);
    } catch {
      return { ok: false, errors: ['This file is not valid JSON.'] };
    }
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, errors: ['This file is not a MYeats backup.'] };
  }
  const head = value as { app?: unknown; backupVersion?: unknown };
  if (head.app !== 'myeats') {
    return { ok: false, errors: ['This file is not a MYeats backup (app is not "myeats").'] };
  }
  if (head.backupVersion !== 1) {
    const shown = head.backupVersion === undefined ? 'missing' : JSON.stringify(head.backupVersion);
    return { ok: false, errors: [`backupVersion: ${shown} is not supported (expected 1)`] };
  }
  const result = BackupSchema.safeParse(value);
  if (!result.success) {
    const errors = result.error.issues
      .slice(0, 8)
      .map((i) => `${formatIssuePath(i.path) || 'backup'}: ${i.message}`);
    return { ok: false, errors };
  }
  return { ok: true, backup: result.data, summary: summarizeBackup(result.data) };
}

const DATA_TABLES = () => [
  db.foods,
  db.recipes,
  db.meals,
  db.entries,
  db.categories,
  db.goals,
  db.weighIns,
];

/**
 * Validates then writes the backup in a single transaction. `replace` clears every data table
 * first; `merge` upserts by id. Settings and the search cache are never touched. Throws (writing
 * nothing) when the backup is invalid.
 */
export async function importBackup(json: unknown, mode: ImportMode): Promise<BackupSummary> {
  const parsed = parseBackup(json);
  if (!parsed.ok) throw new Error(parsed.errors.join('\n'));
  const { data } = parsed.backup;

  await db.transaction('rw', DATA_TABLES(), async () => {
    if (mode === 'replace') await Promise.all(DATA_TABLES().map((t) => t.clear()));
    else {
      // goals.effectiveFrom and weighIns.date are unique: an incoming row with a new id but an
      // existing date replaces the local row instead of failing the whole import.
      for (const g of data.goals) {
        const clash = await db.goals.where('effectiveFrom').equals(g.effectiveFrom).first();
        if (clash && clash.id !== g.id) await db.goals.delete(clash.id);
      }
      for (const w of data.weighIns) {
        const clash = await db.weighIns.where('date').equals(w.date).first();
        if (clash && clash.id !== w.id) await db.weighIns.delete(clash.id);
      }
    }
    await db.foods.bulkPut(data.foods);
    await db.recipes.bulkPut(data.recipes);
    await db.meals.bulkPut(data.meals);
    await db.entries.bulkPut(data.entries);
    await db.categories.bulkPut(data.categories);
    await db.goals.bulkPut(data.goals);
    await db.weighIns.bulkPut(data.weighIns);
  });
  // A replace with a file that has no categories must not leave the app without any.
  await ensureSeeded();
  return parsed.summary;
}

/** Deletes every table's contents, then reinstalls the default categories and settings. */
export async function clearAllData(): Promise<void> {
  const all = [...DATA_TABLES(), db.settings, db.searchCache];
  await db.transaction('rw', all, async () => {
    await Promise.all(all.map((t) => t.clear()));
  });
  await ensureSeeded();
}

export async function exportBackupText(): Promise<string> {
  return JSON.stringify(await exportBackup());
}

export function backupFileName(date: Date = new Date()): string {
  return `myeats-backup-${toDateKey(date)}.json`;
}

export type ExportResult = 'shared' | 'downloaded' | 'cancelled';

/** Exports the backup via the Web Share API when files can be shared, else downloads it. */
export async function exportBackupFile(): Promise<ExportResult> {
  const name = backupFileName();
  const text = await exportBackupText();

  if (typeof File !== 'undefined' && typeof navigator !== 'undefined' && navigator.canShare) {
    const file = new File([text], name, { type: 'application/json' });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'MYeats backup' });
        return 'shared';
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
        // Fall through to a normal download.
      }
    }
  }

  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
