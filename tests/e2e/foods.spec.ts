import { expect, test, type Page } from '@playwright/test';
import { fixture } from './helpers';

// All network is blocked; data is seeded straight into IndexedDB (db "myeats", see src/db/schema.ts).

const NOW = '2026-11-16T12:00:00.000Z';

type Row = Record<string, unknown>;

function foodRow(p: Row): Row {
  const name = String(p.name ?? 'Food');
  return {
    id: 'f-' + name.toLowerCase().replace(/\W+/g, '-'),
    source: 'custom',
    sourceId: null,
    overrides: null,
    name,
    nameLower: name.toLowerCase(),
    brand: null,
    barcode: null,
    baseUnit: 'g',
    per100: {
      kcal: 100,
      protein: 10,
      carbs: 10,
      fiber: 0,
      sugar: 1,
      fat: 2,
      satFat: 0.5,
      sodium: 10,
    },
    servings: [],
    defaultServingId: null,
    lastAmount: null,
    useCount: 0,
    lastUsedAt: null,
    favoriteAt: null,
    deletedAt: null,
    fetchedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...p,
  };
}

async function open(page: Page): Promise<void> {
  await page.route(/api\.nal\.usda\.gov|openfoodfacts\.org/, (r) => r.abort());
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Primary' }).waitFor();
  // Wait for the seeded categories so the db is fully created before raw writes.
  await expect.poll(() => count(page, 'categories')).toBeGreaterThan(0);
}

function count(page: Page, store: string): Promise<number> {
  return all(page, store).then((r) => r.length);
}

function all(page: Page, store: string): Promise<Row[]> {
  return page.evaluate(
    (s) =>
      new Promise<Row[]>((resolve, reject) => {
        const req = indexedDB.open('myeats');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const g = req.result.transaction(s).objectStore(s).getAll();
          g.onsuccess = () => {
            req.result.close();
            resolve(g.result as Row[]);
          };
          g.onerror = () => reject(g.error);
        };
      }),
    store,
  );
}

async function seed(page: Page, store: string, rows: Row[]): Promise<void> {
  await page.evaluate(
    ({ s, rs }) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('myeats');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const tx = req.result.transaction(s, 'readwrite');
          for (const r of rs) tx.objectStore(s).put(r);
          tx.oncomplete = () => {
            req.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { s: store, rs: rows },
  );
}

test('creates a food from per-serving label values and stores per-100', async ({ page }) => {
  await open(page);
  await page.goto('/foods/new');
  await page.getByLabel('Name', { exact: true }).fill('Protein bar');
  await page.getByLabel('Brand').fill('Acme');
  await page.getByRole('button', { name: 'One serving' }).click();
  await page.getByLabel('Serving label').fill('1 bar');
  await page.getByLabel('Serving amount').fill('45');
  await page.getByLabel('Calories per 1 bar').fill('180');
  await page.getByLabel('Protein per 1 bar').fill('20');
  await page.getByLabel('Total carbs per 1 bar').fill('18,5');
  await page.getByLabel('Fiber per 1 bar').fill('3');
  await expect(page.getByTestId('net-carbs')).toContainText('Net carbs = 15.5 g');
  await page.getByLabel('Barcode').fill('12345');
  await page.getByRole('button', { name: 'Save food' }).click();
  await expect(page.getByText('Not a valid barcode')).toBeVisible();
  await page.getByLabel('Barcode').fill('016459200441');
  await page.getByRole('button', { name: 'Save food' }).click();
  await expect(page).toHaveURL(/\/foods$/);
  await expect(page.getByRole('link', { name: /Protein bar/ })).toBeVisible();

  const [row] = (await all(page, 'foods')).filter((f) => f.name === 'Protein bar');
  const per100 = row.per100 as Record<string, number | null>;
  expect(per100.kcal).toBe(400);
  expect(per100.protein).toBe(44.444);
  expect(per100.carbs).toBe(41.111);
  expect(per100.fat).toBeNull();
  expect(row.barcode).toBe('0016459200441');
  const servings = row.servings as { id: string; label: string; amount: number }[];
  expect(servings).toHaveLength(1);
  expect(servings[0]).toMatchObject({ label: '1 bar', amount: 45 });
  expect(row.defaultServingId).toBe(servings[0].id);
});

test('editing a remote food saves an override and leaves the original untouched', async ({
  page,
}) => {
  await open(page);
  const orig = foodRow({
    id: 'usda-1',
    source: 'usda',
    sourceId: '123',
    name: 'Banana raw',
    fetchedAt: NOW,
  });
  await seed(page, 'foods', [orig]);
  await page.goto('/foods');
  await page.getByRole('link', { name: /Banana raw/ }).click();
  await expect(page.getByText('read-only')).toBeVisible();
  await page.getByRole('button', { name: 'Edit (save my version)' }).click();
  await page.getByLabel('Name', { exact: true }).fill('My banana');
  await page.getByRole('button', { name: 'Save my version' }).click();
  await expect(page).toHaveURL(/\/foods$/);

  const foods = await all(page, 'foods');
  const original = foods.find((f) => f.id === 'usda-1');
  expect(original).toEqual(orig);
  const override = foods.find((f) => f.overrides === 'usda:123');
  expect(override).toMatchObject({ source: 'custom', name: 'My banana', sourceId: null });
  // The original is hidden from the library while the override is live.
  await expect(page.getByRole('link', { name: /My banana/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Banana raw/ })).toHaveCount(0);
});

test('builds a saved meal of three foods and reorders it', async ({ page }) => {
  await open(page);
  await seed(page, 'foods', [
    foodRow({ name: 'Oats', per100: { ...(foodRow({}).per100 as Row), kcal: 100 } }),
    foodRow({ name: 'Milk', per100: { ...(foodRow({}).per100 as Row), kcal: 200 } }),
    foodRow({ name: 'Berries', per100: { ...(foodRow({}).per100 as Row), kcal: 300 } }),
  ]);
  await page.goto('/meals/new');
  await page.getByLabel('Name', { exact: true }).fill('Usual breakfast');
  for (const n of ['Oats', 'Milk', 'Berries']) {
    await page.getByRole('button', { name: 'Add item' }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: new RegExp(n) })
      .click();
    await expect(page.getByRole('group', { name: n })).toBeVisible();
  }
  // 100 g of each: 100 + 200 + 300 kcal
  await expect(page.getByTestId('meal-totals')).toContainText('600');
  await page.getByLabel('Amount of Berries').fill('50');
  await expect(page.getByTestId('meal-totals')).toContainText('450');

  // Move Berries (last) to the top: pointer drag where it is reliable, keyboard sensor otherwise.
  const handleLoc = page.getByRole('button', { name: 'Reorder Berries' });
  if (test.info().project.name === 'webkit-iphone') {
    await handleLoc.focus();
    await page.keyboard.press('Space');
    await page.waitForTimeout(100);
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(100);
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(100);
    await page.keyboard.press('Space');
  } else {
    const handle = await handleLoc.boundingBox();
    const target = await page.getByRole('button', { name: 'Reorder Oats' }).boundingBox();
    if (!handle || !target) throw new Error('handles not found');
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2, handle.y - 20, { steps: 5 });
    await page.mouse.move(target.x + target.width / 2, target.y - 10, { steps: 20 });
    await page.mouse.up();
  }
  await page.getByRole('button', { name: 'Save meal' }).click();
  await expect(page).toHaveURL(/\/foods\?tab=meals/);
  await expect(page.getByRole('link', { name: /Usual breakfast/ })).toContainText('450 kcal');

  const [meal] = await all(page, 'meals');
  const items = meal.items as { refId: string; amount: number }[];
  expect(items).toHaveLength(3);
  expect(items.map((i) => i.refId)).toEqual(['f-berries', 'f-oats', 'f-milk']);
  expect(items[0].amount).toBe(50);
});

test('Save as meal pre-populates from a day and category, skipping quick adds', async ({
  page,
}) => {
  await open(page);
  const f = foodRow({
    name: 'Whey',
    servings: [{ id: 'sc', label: '1 scoop', amount: 30 }],
    defaultServingId: 'sc',
  });
  await seed(page, 'foods', [f]);
  const base = {
    date: '2026-11-15',
    categoryId: 'cat-breakfast',
    brand: null,
    nutrients: f.per100,
    kcalDerived: false,
    mealLogId: null,
    mealName: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
  const snapshot = { baseUnit: 'g', per100: f.per100, servings: f.servings };
  await seed(page, 'entries', [
    {
      ...base,
      id: 'e1',
      order: 1,
      kind: 'food',
      refId: f.id,
      name: 'Whey',
      amount: 2,
      unitLabel: '1 scoop',
      baseAmount: 60,
      snapshot,
    },
    {
      ...base,
      id: 'e2',
      order: 2,
      kind: 'quick',
      refId: null,
      name: 'Quick add',
      amount: null,
      unitLabel: null,
      baseAmount: null,
      snapshot: null,
    },
    {
      ...base,
      id: 'e3',
      order: 3,
      kind: 'food',
      refId: f.id,
      name: 'Whey',
      amount: 40,
      unitLabel: 'g',
      baseAmount: 40,
      snapshot,
    },
    {
      ...base,
      id: 'e4',
      categoryId: 'cat-lunch',
      order: 1,
      kind: 'food',
      refId: f.id,
      name: 'Whey',
      amount: 99,
      unitLabel: 'g',
      baseAmount: 99,
      snapshot,
    },
  ]);
  await page.goto('/meals/new?fromDate=2026-11-15&category=cat-breakfast');
  await expect(page.getByText('1 quick-add entry was skipped')).toBeVisible();
  await expect(page.getByLabel('Amount of Whey')).toHaveCount(2);
  await expect(page.getByLabel('Amount of Whey').first()).toHaveValue('2');
  await expect(page.getByLabel('Unit for Whey').first()).toHaveValue('s:sc');
  await expect(page.getByLabel('Amount of Whey').last()).toHaveValue('40');
  await expect(page.getByLabel('Default category')).toHaveValue('cat-breakfast');
});

test('recipe with 6 servings shows per-serving totals', async ({ page }) => {
  await open(page);
  await seed(page, 'foods', [foodRow({ name: 'Rice' })]);
  await page.goto('/recipes/new');
  await page.getByLabel('Name', { exact: true }).fill('Big pot');
  await page.getByRole('button', { name: 'Add ingredient' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Rice/ }).click();
  await page.getByLabel('Amount of Rice').fill('600');
  await page.getByLabel('Servings per batch').fill('6');
  await expect(page.getByTestId('recipe-batch')).toContainText('600');
  await expect(page.getByTestId('recipe-per-serving')).toContainText('100');
  await expect(page.getByTestId('recipe-per-serving')).toContainText('P 10');

  await page.getByLabel('Servings per batch').fill('0');
  await page.getByRole('button', { name: 'Save recipe' }).click();
  await expect(page.getByRole('alert')).toContainText('Servings per batch');
  await page.getByLabel('Servings per batch').fill('6');
  await page.getByRole('button', { name: 'Save recipe' }).click();
  await expect(page).toHaveURL(/\/foods\?tab=recipes/);
  await expect(page.getByRole('link', { name: /Big pot/ })).toContainText('100 kcal / serving');
  const [recipe] = await all(page, 'recipes');
  expect(recipe).toMatchObject({ name: 'Big pot', servingsPerBatch: 6, cookedWeightG: null });
});

test('favourites toggle from the library and sort first', async ({ page }) => {
  await open(page);
  await seed(page, 'foods', [foodRow({ name: 'Apple' }), foodRow({ name: 'Zucchini' })]);
  await page.goto('/foods');
  const names = () => page.locator('main ul li a').allInnerTexts();
  await expect.poll(async () => (await names())[0]).toContain('Apple');
  await page.getByRole('button', { name: 'Favourite Zucchini' }).click();
  await expect(page.getByRole('button', { name: 'Unfavourite Zucchini' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect.poll(async () => (await names())[0]).toContain('Zucchini');
  const z = (await all(page, 'foods')).find((f) => f.name === 'Zucchini');
  expect(z?.favoriteAt).toBeTruthy();

  await page.getByLabel('Filter foods').fill('app');
  await expect(page.getByRole('link', { name: /Zucchini/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Apple/ })).toBeVisible();
});

test('deleting a custom food is a soft delete after confirmation', async ({ page }) => {
  await open(page);
  await seed(page, 'foods', [foodRow({ name: 'Doomed' })]);
  await page.goto('/foods/f-doomed');
  await page.getByRole('button', { name: 'Delete food' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page).toHaveURL(/\/foods$/);
  await expect(page.getByRole('link', { name: /Doomed/ })).toHaveCount(0);
  const row = (await all(page, 'foods')).find((f) => f.name === 'Doomed');
  expect(row?.deletedAt).toBeTruthy();
});

test('meal picker: Create food prefills the search text and adds the new food', async ({
  page,
}) => {
  await open(page);
  await page.goto('/meals/new');
  await page.getByRole('button', { name: 'Add item' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('searchbox').fill('Greek yogurt');
  await dialog.getByRole('button', { name: 'Create food' }).click();
  const form = page.getByRole('dialog', { name: 'Create food' });
  await expect(form.getByLabel('Name', { exact: true })).toHaveValue('Greek yogurt');
  await form.getByLabel('Calories per 100 g').fill('97');
  await form.getByRole('button', { name: 'Save food' }).click();
  await expect(page.getByLabel('Amount of Greek yogurt')).toBeVisible();
  const foods = await all(page, 'foods');
  expect(foods).toEqual([expect.objectContaining({ name: 'Greek yogurt', source: 'custom' })]);
});

test('recipe picker: a USDA result is saved to foods and added as an ingredient', async ({
  page,
}) => {
  await open(page);
  await page.route(/api\.nal\.usda\.gov/, (r) =>
    r.fulfill({ contentType: 'application/json', body: fixture('usda/search-banana.json') }),
  );
  await page.goto('/recipes/new');
  await page.getByRole('button', { name: 'Add ingredient' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('searchbox').fill('banana');
  const results = dialog.getByRole('list', { name: 'USDA results' });
  const first = results.getByRole('button').first();
  await expect(first).toBeVisible();
  const name = ((await first.textContent()) ?? '').split(' · ')[0].replace(/\d.*$/, '').trim();
  await first.click();
  await expect(page.getByLabel(`Amount of ${name}`, { exact: false })).toBeVisible();
  const foods = await all(page, 'foods');
  expect(foods).toEqual([expect.objectContaining({ source: 'usda' })]);
});
