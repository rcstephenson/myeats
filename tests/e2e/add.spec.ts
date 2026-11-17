import { expect, test, type Page } from '@playwright/test';
import {
  addButton,
  dateKey,
  fixture,
  makeEntry,
  makeFood,
  makeGoal,
  makeMeal,
  nut,
  OFF_URL,
  openApp,
  overlay,
  plus,
  searchBox,
  section,
  USDA_URL,
} from './helpers';

const iso = (minsAgo: number): string => new Date(Date.now() - minsAgo * 60_000).toISOString();

const oats = makeFood({ lastUsedAt: iso(120), useCount: 3, lastAmount: { amount: 80, unit: { kind: 'base' } } });
const banana = makeFood({
  name: 'Banana bread',
  per100: nut({ kcal: 300, protein: 5, carbs: 50, fiber: 2, fat: 10 }),
  servings: [{ id: 'sv1', label: '1 slice', amount: 60 }],
  defaultServingId: 'sv1',
  lastUsedAt: iso(5),
  useCount: 1,
});

async function mockUsda(page: Page, body: string, status = 200): Promise<{ count: () => number }> {
  let calls = 0;
  await page.route(USDA_URL, async (route) => {
    const url = route.request().url();
    if (url.includes('/foods/search')) {
      calls += 1;
      await route.fulfill({ status, contentType: 'application/json', body });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: fixture('usda/details-173944.json') });
    }
  });
  return { count: () => calls };
}

test('plus shows the overlay and focuses search in the same tap; recent is on top', async ({ page }) => {
  await openApp(page, { foods: [oats, banana] });
  await plus(page, 'Breakfast').click();
  await expect(overlay(page)).toBeVisible();
  await expect(searchBox(page)).toBeFocused();
  await expect(page).toHaveURL(/\?add=cat-breakfast$/);
  // Tab bar is hidden while adding.
  await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(0);
  const rows = overlay(page).getByRole('list', { name: 'Recent' }).getByRole('listitem');
  await expect(rows.first()).toContainText('Banana bread');
  await expect(rows.first()).toContainText('1 slice');
  await expect(rows.first()).toContainText('180 kcal');
  await expect(rows.nth(1)).toContainText('Rolled oats');
  await expect(rows.nth(1)).toContainText('80 g');
});

test('three taps: plus, recent row, Add; footer, undo, done', async ({ page }) => {
  await openApp(page, { goals: [makeGoal()], foods: [oats, banana] });
  await plus(page, 'Breakfast').click();
  await overlay(page).getByRole('list', { name: 'Recent' }).getByRole('button').first().click();
  await expect(page.getByRole('dialog', { name: 'Banana bread' })).toBeVisible();
  await expect(page.getByLabel('Amount')).toBeFocused();
  await expect(page.getByTestId('preview-kcal')).toContainText('180');
  await addButton(page).click();
  // Panel closes, search refocused, footer counts the add.
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(searchBox(page)).toBeFocused();
  await expect(overlay(page)).toContainText('Breakfast · 1 added · 180 kcal');
  // Logged straight away behind the overlay.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(overlay(page)).not.toContainText('1 added');
  // Add again (Enter adds), then Done.
  await overlay(page).getByRole('list', { name: 'Recent' }).getByRole('button').first().click();
  await page.getByLabel('Amount').press('Enter');
  await expect(overlay(page)).toContainText('1 added');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(overlay(page)).toBeHidden();
  await expect(page).toHaveURL(/\/$/);
  await expect(section(page, 'Breakfast').getByText('Banana bread')).toBeVisible();
  await expect(page.getByRole('meter', { name: /^Calories 180 of 2,000 calories, 1,820 left$/ })).toBeVisible();
});

test('Back and Escape close the overlay', async ({ page }) => {
  await openApp(page);
  await plus(page, 'Lunch').click();
  await expect(overlay(page)).toBeVisible();
  await page.goBack();
  await expect(overlay(page)).toBeHidden();
  await expect(page).toHaveURL(/\/$/);
  await plus(page, 'Lunch').click();
  await expect(overlay(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(overlay(page)).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
});

test('category chip: defaults to the tapped category and can change', async ({ page }) => {
  await openApp(page, { foods: [oats] });
  await plus(page, 'Dinner').click();
  const chip = overlay(page).getByLabel('Category');
  await expect(chip).toHaveValue('cat-dinner');
  await chip.selectOption({ label: 'Snacks / Other' });
  await overlay(page).getByRole('list', { name: 'Recent' }).getByRole('button').first().click();
  await addButton(page).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(section(page, 'Snacks / Other').getByText('Rolled oats')).toBeVisible();
  await expect(section(page, 'Dinner').getByText('Rolled oats')).toHaveCount(0);
});

test('local results are instant, a unit change converts the amount', async ({ page }) => {
  await openApp(page, { foods: [oats, banana] });
  await plus(page, 'Breakfast').click();
  await searchBox(page).fill('roll');
  const mine = overlay(page).getByRole('list', { name: 'Your foods' });
  await expect(mine.getByRole('listitem')).toHaveCount(1);
  await mine.getByRole('button').click();
  const panel = page.getByRole('dialog', { name: 'Rolled oats' });
  await expect(panel.getByLabel('Amount')).toHaveValue('80');
  await panel.getByLabel('Unit').selectOption({ label: '1 scoop' });
  await expect(panel.getByLabel('Amount')).toHaveValue('2');
  await expect(page.getByTestId('preview-kcal')).toContainText('304');
  await expect(page.getByTestId('preview-macros')).toContainText('P 10');
  await panel.getByLabel('Amount').fill('1,5');
  await expect(page.getByTestId('preview-kcal')).toContainText('228');
  await panel.getByRole('button', { name: 'Add favourite' }).click();
  await expect(panel.getByRole('button', { name: 'Remove favourite' })).toBeVisible();
  await expect(panel.getByRole('link', { name: 'Edit food' })).toHaveAttribute('href', `/foods/${oats.id}`);
});

test('quick add 250 kcal to Snacks; macro-only quick add derives kcal', async ({ page }) => {
  await openApp(page, { goals: [makeGoal()] });
  await plus(page, 'Snacks / Other').click();
  await overlay(page).getByRole('button', { name: /Quick add/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Quick add' });
  await expect(addButton(page)).toBeDisabled();
  await sheet.getByLabel('kcal', { exact: true }).fill('250');
  await addButton(page).click();
  await page.getByRole('button', { name: 'Done' }).click();
  const snacks = section(page, 'Snacks / Other');
  await expect(snacks.getByText('Quick add')).toBeVisible();
  await expect(snacks).toContainText('250 kcal');
  await expect(page.getByRole('meter', { name: /^Calories 250 of 2,000 calories, 1,750 left$/ })).toBeVisible();

  // Macros only: 20 P + 10 C + 5 F = 80 + 40 + 45 = 165 (derived, marked with an approx sign).
  await plus(page, 'Snacks / Other').click();
  await overlay(page).getByRole('button', { name: /Quick add/ }).click();
  const second = page.getByRole('dialog', { name: 'Quick add' });
  await second.getByLabel('Label').fill('Shake');
  await second.getByLabel('Protein').fill('20');
  await second.getByLabel('Net carbs').fill('10');
  await second.getByLabel('Fat').fill('5');
  await addButton(page).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(snacks.getByText('Shake')).toBeVisible();
  await expect(snacks).toContainText('≈165');
  // Editing a quick entry edits its numbers.
  await snacks.getByRole('button', { name: /^Quick add/ }).click();
  const edit = page.getByRole('dialog', { name: 'Quick add' });
  await edit.getByLabel('kcal', { exact: true }).fill('300');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(snacks).toContainText('300');
});

test('USDA search: local first, then USDA, cached repeat makes no request', async ({ page }) => {
  await openApp(page, { foods: [banana] });
  const usda = await mockUsda(page, fixture('usda/search-banana.json'));
  await plus(page, 'Breakfast').click();
  await searchBox(page).fill('banana');
  const mine = overlay(page).getByRole('list', { name: 'Your foods' });
  await expect(mine).toContainText('Banana bread');
  const remote = overlay(page).getByRole('list', { name: 'USDA results' });
  await expect(remote.getByRole('listitem').first()).toContainText('Bananas');
  // Generic foods are listed before branded ones.
  await expect(remote.getByRole('listitem').first()).not.toContainText('BETTER');
  const mineBox = await mine.boundingBox();
  const remoteBox = await remote.boundingBox();
  expect(mineBox!.y).toBeLessThan(remoteBox!.y);
  expect(usda.count()).toBe(1);

  // Choose a Foundation food: it is saved locally and its servings are fetched.
  await remote.getByRole('listitem').filter({ hasText: 'Bananas, ripe and slightly ripe, raw' }).getByRole('button').click();
  const panel = page.getByRole('dialog', { name: /Bananas, ripe/ });
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId('preview-kcal')).toContainText('97');
  await addButton(page).click();
  await expect(overlay(page)).toContainText('1 added');

  // Same query again: served from the cache, marked CACHED, without another request.
  await searchBox(page).fill('banana');
  await expect(overlay(page).getByRole('list', { name: 'USDA results' }).getByText('CACHED').first()).toBeVisible();
  await page.waitForTimeout(400);
  expect(usda.count()).toBe(1);
  // The food just logged is local now, so it is not repeated under USDA.
  await expect(overlay(page).getByRole('list', { name: 'USDA results' })).not.toContainText('Bananas, ripe and slightly ripe, raw');
  await expect(overlay(page).getByRole('list', { name: 'Your foods' })).toContainText('Bananas, ripe and slightly ripe, raw');
});

test('USDA search: offline note, busy note', async ({ page, context }) => {
  await openApp(page, { foods: [banana] });
  await plus(page, 'Breakfast').click();
  await context.setOffline(true);
  await searchBox(page).fill('banana');
  await expect(overlay(page)).toContainText('Offline: showing saved foods only');
  await expect(overlay(page).getByRole('list', { name: 'Your foods' })).toContainText('Banana bread');
  await context.setOffline(false);

  await mockUsda(page, '{}', 429);
  await searchBox(page).fill('banana bread');
  await expect(overlay(page)).toContainText('USDA search is busy, try again in a minute');
});

test('meal panel: edit amounts for this log, Add all groups the entries', async ({ page }) => {
  const meal = makeMeal({
    name: 'Usual breakfast',
    items: [
      { kind: 'food', refId: oats.id, amount: 80, unit: { kind: 'base' } },
      { kind: 'food', refId: banana.id, amount: 1, unit: { kind: 'serving', servingId: 'sv1' } },
    ],
    lastUsedAt: iso(1),
    useCount: 1,
  });
  await openApp(page, { foods: [oats, banana], meals: [meal] });
  await plus(page, 'Breakfast').click();
  await overlay(page).getByRole('button', { name: 'Meals' }).click();
  await overlay(page).getByRole('button', { name: /Usual breakfast/ }).click();
  const panel = page.getByRole('dialog', { name: 'Usual breakfast' });
  await expect(panel.getByTestId('meal-total')).toContainText('484'); // 304 + 180
  await panel.getByLabel('Rolled oats amount').fill('40');
  await expect(panel.getByTestId('meal-total')).toContainText('332'); // 152 + 180
  await page.getByRole('button', { name: 'Add all' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  const group = section(page, 'Breakfast').getByRole('group', { name: 'Usual breakfast' });
  await expect(group).toContainText('332 kcal');
  await expect(group.getByText('40 g')).toBeVisible();
  await expect(group.getByText('1 slice')).toBeVisible();
});

test('?add=<category>&meal=<id> opens the meal panel directly', async ({ page }) => {
  const meal = makeMeal({
    name: 'Lunch combo',
    items: [{ kind: 'food', refId: oats.id, amount: 50, unit: { kind: 'base' } }],
  });
  await openApp(page, { foods: [oats], meals: [meal] }, `/?add=cat-lunch&meal=${meal.id}`);
  await expect(overlay(page)).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Lunch combo' })).toBeVisible();
  await page.getByRole('button', { name: 'Add all' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(section(page, 'Lunch').getByText('Rolled oats')).toBeVisible();
});

test('recipes log by serving', async ({ page }) => {
  const recipe = {
    id: 'recipe-porridge',
    name: 'Porridge',
    nameLower: 'porridge',
    ingredients: [{ foodId: oats.id, amount: 100, unit: { kind: 'base' as const } }],
    servingsPerBatch: 2,
    cookedWeightG: null,
    lastAmount: null,
    useCount: 0,
    lastUsedAt: null,
    favoriteAt: null,
    deletedAt: null,
    createdAt: iso(0),
    updatedAt: iso(0),
  };
  await openApp(page, { foods: [oats] });
  await page.evaluate(async (r) => {
    const db = await new Promise<IDBDatabase>((res) => {
      const req = indexedDB.open('myeats');
      req.onsuccess = () => res(req.result);
    });
    await new Promise<void>((res) => {
      const tx = db.transaction('recipes', 'readwrite');
      tx.objectStore('recipes').put(r);
      tx.oncomplete = () => res();
    });
    db.close();
  }, recipe);
  await page.reload();
  await plus(page, 'Breakfast').click();
  await searchBox(page).fill('porr');
  await overlay(page).getByRole('list', { name: 'Your foods' }).getByRole('button').click();
  const panel = page.getByRole('dialog', { name: 'Porridge' });
  await expect(panel.getByTestId('preview-kcal')).toContainText('190'); // half of 100 g oats
  await expect(panel.getByLabel('Unit').locator('option')).toHaveCount(1);
  await addButton(page).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(section(page, 'Breakfast').getByText('1 serving')).toBeVisible();
});

test.describe('scanner', () => {
  test('known barcode opens the Amount panel from local foods', async ({ page }) => {
    const bar = makeFood({ name: 'Protein bar', barcode: '5449000000996' });
    await openApp(page, { foods: [bar] });
    await plus(page, 'Snacks / Other').click();
    await overlay(page).getByRole('button', { name: 'Scan barcode' }).click();
    await expect.poll(() => page.evaluate(() => typeof window.__myeatsInjectBarcode)).toBe('function');
    await page.evaluate(() => window.__myeatsInjectBarcode?.('5449000000996'));
    await expect(page.getByRole('dialog', { name: 'Protein bar' })).toBeVisible();
  });

  test('unknown barcode offers Create food with the code, and Scan again', async ({ page }) => {
    await openApp(page);
    await page.route(OFF_URL, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: fixture('off/not-found.json') }),
    );
    await page.route(USDA_URL, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{"foods":[]}' }),
    );
    await plus(page, 'Snacks / Other').click();
    await overlay(page).getByRole('button', { name: 'Scan barcode' }).click();
    await expect.poll(() => page.evaluate(() => typeof window.__myeatsInjectBarcode)).toBe('function');
    await page.evaluate(() => window.__myeatsInjectBarcode?.('4006381333931'));
    const nomatch = page.getByRole('dialog', { name: 'No match for 4006381333931' });
    await expect(nomatch).toBeVisible();
    await nomatch.getByRole('button', { name: 'Scan again' }).click();
    await expect.poll(() => page.evaluate(() => typeof window.__myeatsInjectBarcode)).toBe('function');
    await page.evaluate(() => window.__myeatsInjectBarcode?.('4006381333931'));
    await page.getByRole('dialog', { name: 'No match for 4006381333931' }).getByRole('button', { name: 'Create food' }).click();
    await expect(page.getByRole('dialog', { name: 'Create food' })).toBeVisible();
  });

  test('an Open Food Facts match is saved locally and opens the Amount panel', async ({ page }) => {
    await openApp(page);
    await page.route(OFF_URL, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: fixture('off/5449000000996.json') }),
    );
    await plus(page, 'Snacks / Other').click();
    await overlay(page).getByRole('button', { name: 'Scan barcode' }).click();
    await expect.poll(() => page.evaluate(() => typeof window.__myeatsInjectBarcode)).toBe('function');
    await page.evaluate(() => window.__myeatsInjectBarcode?.('5449000000996'));
    const panel = page.getByRole('dialog', { name: 'Coca-Cola Original' });
    await expect(panel).toBeVisible();
    await addButton(page).click();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(section(page, 'Snacks / Other').getByText('Coca-Cola Original')).toBeVisible();

    // A second scan works offline: the food is now local.
    await page.route(OFF_URL, (r) => r.abort());
    await plus(page, 'Snacks / Other').click();
    await overlay(page).getByRole('button', { name: 'Scan barcode' }).click();
    await expect.poll(() => page.evaluate(() => typeof window.__myeatsInjectBarcode)).toBe('function');
    await page.evaluate(() => window.__myeatsInjectBarcode?.('5449000000996'));
    await expect(page.getByRole('dialog', { name: 'Coca-Cola Original' })).toBeVisible();
  });
});

test('entries added from the overlay keep order and update totals optimistically', async ({ page }) => {
  await openApp(page, {
    goals: [makeGoal()],
    foods: [oats, banana],
    entries: [makeEntry(oats, { date: dateKey(0), order: 1 })],
  });
  await plus(page, 'Breakfast').click();
  for (const name of ['Banana bread', 'Banana bread']) {
    await searchBox(page).fill('banana');
    await overlay(page).getByRole('list', { name: 'Your foods' }).getByRole('button', { name: new RegExp(name) }).click();
    await addButton(page).click();
  }
  await expect(overlay(page)).toContainText('2 added · 360 kcal');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(section(page, 'Breakfast')).toContainText('664 kcal');
});
