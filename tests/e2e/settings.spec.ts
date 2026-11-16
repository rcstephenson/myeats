import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const fixture = (name: string) =>
  readFileSync(new URL(`../fixtures/usda/${name}`, import.meta.url), 'utf8');

/** Blocks every request that leaves the app; USDA calls are answered per test. */
test.beforeEach(async ({ page, baseURL }) => {
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(baseURL!)) return route.continue();
    return route.abort();
  });
});

async function setGoal(page: Page, v: { kcal: string; p: string; c: string; f: string }) {
  await page.goto('/settings/goals');
  await page.getByRole('textbox', { name: 'Calories', exact: true }).fill(v.kcal);
  await page.getByRole('textbox', { name: 'Protein', exact: true }).fill(v.p);
  await page.getByRole('textbox', { name: 'Net carbs', exact: true }).fill(v.c);
  await page.getByRole('textbox', { name: 'Fat', exact: true }).fill(v.f);
}

test('goals: read-outs, mismatch note, save and history', async ({ page }) => {
  await setGoal(page, { kcal: '2000', p: '150', c: '185', f: '67' });
  await expect(page.getByTestId('macro-share')).toHaveText('P 30% · C 37% · F 30%');
  await expect(page.getByTestId('macro-mismatch')).toHaveCount(0);

  await page.getByRole('textbox', { name: 'Fat', exact: true }).fill('90');
  await expect(page.getByTestId('macro-mismatch')).toHaveText('Macros add up to 2,150 kcal');
  await page.getByRole('textbox', { name: 'Fat', exact: true }).fill('67');

  await page.getByRole('textbox', { name: 'Sodium (max)' }).fill('2300');
  await page.getByRole('button', { name: 'Save goals' }).click();
  await expect(page.getByRole('status')).toContainText('Goals saved');
  const history = page.getByRole('region', { name: 'Goal history' }).getByRole('listitem');
  await expect(history).toHaveCount(1);
  await expect(history.first()).toContainText('2,000 kcal');

  // Saving again on the same day replaces today's version rather than adding one.
  await page.getByRole('textbox', { name: 'Calories', exact: true }).fill('2100');
  await page.getByRole('button', { name: 'Save goals' }).click();
  await expect(history).toHaveCount(1);
  await expect(history.first()).toContainText('2,100 kcal');

  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Calories', exact: true })).toHaveValue('2100');
  await expect(page.getByRole('textbox', { name: 'Sodium (max)' })).toHaveValue('2300');
});

test('goals: save is disabled until the required fields are valid', async ({ page }) => {
  await page.goto('/settings/goals');
  await expect(page.getByRole('button', { name: 'Save goals' })).toBeDisabled();
  await setGoal(page, { kcal: '2000', p: '150', c: '185', f: '' });
  await expect(page.getByRole('button', { name: 'Save goals' })).toBeDisabled();
  await page.getByRole('textbox', { name: 'Fat', exact: true }).fill('67');
  await expect(page.getByRole('button', { name: 'Save goals' })).toBeEnabled();
});

test('categories: add, rename, retime, archive, restore and the last-active guard', async ({
  page,
}) => {
  await page.goto('/settings/categories');
  const names = page.getByRole('textbox', { name: /^Name of / });
  await expect(names).toHaveCount(5);

  await page.getByRole('textbox', { name: 'New category name' }).fill('Brunch');
  await page.getByRole('button', { name: 'Add category' }).click();
  await expect(names).toHaveCount(6);
  await expect(names.last()).toHaveValue('Brunch');

  const lunch = page.getByRole('textbox', { name: 'Name of Lunch' });
  await lunch.fill('Midday');
  await lunch.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Name of Midday' })).toBeVisible();
  await page.getByLabel('Starts at for Brunch').fill('10:15');
  await expect(page.getByLabel('Starts at for Brunch')).toHaveValue('10:15');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Name of Midday' })).toBeVisible();
  await expect(page.getByLabel('Starts at for Brunch')).toHaveValue('10:15');

  // Archive needs confirmation; the category moves to the muted Archived list.
  await page.getByRole('button', { name: 'Remove Brunch' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
  await expect(names).toHaveCount(5);
  const archived = page.getByRole('region', { name: 'Archived categories' });
  await expect(archived).toContainText('Brunch');
  await archived.getByRole('button', { name: 'Restore Brunch' }).click();
  await expect(names).toHaveCount(6);
  await expect(archived).toHaveCount(0);

  // Cancelling keeps it.
  await page.getByRole('button', { name: 'Remove Brunch' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(names).toHaveCount(6);

  // Archive down to one: the last remove button is disabled.
  for (const name of ['Brunch', 'Midday', 'Meal 3', 'Dinner']) {
    await page.getByRole('button', { name: `Remove ${name}` }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByRole('textbox', { name: `Name of ${name}` })).toHaveCount(0);
  }
  await expect(names).toHaveCount(2);
  await page.getByRole('button', { name: 'Remove Snacks' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
  await expect(names).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Remove Breakfast' })).toBeDisabled();
  await expect(page.getByText(/At least one category must stay active/)).toBeVisible();
});

test('categories: keyboard reorder persists', async ({ page }) => {
  await page.goto('/settings/categories');
  const names = page.getByRole('textbox', { name: /^Name of / });
  await page.getByRole('button', { name: 'Reorder Breakfast' }).focus();
  await page.keyboard.press('Space');
  await page.waitForTimeout(250);
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(250);
  await page.keyboard.press('Space');
  await expect(names.first()).toHaveValue('Lunch');
  await page.reload();
  await expect(names.first()).toHaveValue('Lunch');
  await expect(names.nth(1)).toHaveValue('Breakfast');
});

test('theme switch applies and persists', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
  await page.getByRole('radio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('radio', { name: 'Light' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Light' })).toHaveAttribute('aria-checked', 'true');
});

test('settings links, version and storage status', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('link', { name: /Goals/ }).click();
  await expect(page.getByRole('heading', { name: 'Goals', level: 1 })).toBeVisible();
  await page.getByRole('link', { name: 'Back to Settings' }).click();
  await page.getByRole('link', { name: /Categories/ }).click();
  await expect(page.getByRole('heading', { name: 'Categories', level: 1 })).toBeVisible();
  await page.goto('/settings');
  await expect(page.getByTestId('app-version')).toHaveText(/^\d+\.\d+\.\d+/);
  await expect(page.getByTestId('storage-status')).toHaveText(/persistent/i);
  await expect(
    page.getByText(/Food data from USDA FoodData Central and Open Food Facts \(ODbL\)/),
  ).toBeVisible();
});

test('food database: key source, Test success, rate limit and error', async ({ page }) => {
  let mode: 'ok' | '429' | '500' = 'ok';
  const keys: string[] = [];
  await page.route('https://api.nal.usda.gov/**', (route) => {
    keys.push(new URL(route.request().url()).searchParams.get('api_key') ?? '');
    if (mode === '429') return route.fulfill({ status: 429, body: '{}' });
    if (mode === '500') return route.fulfill({ status: 500, body: '{}' });
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: fixture('search-banana.json'),
    });
  });
  await page.goto('/settings');
  await expect(page.getByTestId('key-source')).toHaveText('build');
  await expect(page.getByRole('link', { name: /free USDA API key/ })).toHaveAttribute(
    'href',
    'https://fdc.nal.usda.gov/api-key-signup',
  );

  await page.getByRole('button', { name: 'Test' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Key works' })).toBeVisible();

  mode = '429';
  await page.getByRole('button', { name: 'Test' }).click();
  await expect(page.getByRole('alert')).toContainText('Rate limit');

  mode = '500';
  await page.getByRole('button', { name: 'Test' }).click();
  await expect(page.getByRole('alert')).toContainText('HTTP 500');

  // A device key overrides the build key and is used by Test.
  await page.getByRole('textbox', { name: 'Device key' }).fill('MY_DEVICE_KEY');
  await page.getByRole('button', { name: 'Save key' }).click();
  await expect(page.getByTestId('key-source')).toHaveText('device');
  mode = 'ok';
  await page.getByRole('button', { name: 'Test' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Key works' })).toBeVisible();
  expect(keys.at(-1)).toBe('MY_DEVICE_KEY');

  await page
    .getByRole('region', { name: 'Food database' })
    .getByRole('button', { name: 'Clear' })
    .click();
  await expect(page.getByTestId('key-source')).toHaveText('build');
});

test('export then clear all data then import (Merge) restores everything', async ({ page }) => {
  await setGoal(page, { kcal: '1900', p: '140', c: '150', f: '80' });
  await page.getByRole('button', { name: 'Save goals' }).click();
  await expect(page.getByRole('status')).toContainText('Goals saved');
  await page.goto('/settings/categories');
  await page.getByRole('textbox', { name: 'New category name' }).fill('Brunch');
  await page.getByRole('button', { name: 'Add category' }).click();
  await expect(page.getByRole('textbox', { name: 'Name of Brunch' })).toBeVisible();

  await page.goto('/settings');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export/ }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^myeats-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const path = (await file.path())!;
  const backup = JSON.parse(readFileSync(path, 'utf8'));
  expect(backup).toMatchObject({ app: 'myeats', backupVersion: 1 });
  expect(Object.keys(backup.data)).toContain('weighIns');
  expect(backup).not.toHaveProperty('settings');

  await page
    .getByRole('region', { name: 'Data', exact: true })
    .getByRole('button', { name: /^Clear/ })
    .click();
  await page.getByRole('button', { name: 'Continue' }).click();
  const erase = page.getByRole('button', { name: 'Erase all data' });
  await expect(erase).toBeDisabled();
  await page
    .getByRole('dialog', { name: /Type DELETE/ })
    .getByRole('textbox')
    .fill('DELETE');
  await erase.click();
  await expect(page.getByRole('status')).toHaveText('All data cleared.');

  await page.goto('/settings/goals');
  await expect(page.getByText('No goals saved yet.')).toBeVisible();
  await page.goto('/settings/categories');
  await expect(page.getByRole('textbox', { name: 'Name of Brunch' })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: /^Name of / })).toHaveCount(5);

  await page.goto('/settings');
  await page.getByTestId('backup-file-input').setInputFiles(path);
  const dialog = page.getByRole('dialog', { name: 'Import backup' });
  await expect(dialog).toContainText('Goals');
  await dialog.getByRole('button', { name: 'Merge into existing data' }).click();
  await expect(page.getByRole('status')).toHaveText('Backup merged into your data.');

  await page.goto('/settings/goals');
  await expect(page.getByRole('textbox', { name: 'Calories', exact: true })).toHaveValue('1900');
  await page.goto('/settings/categories');
  await expect(page.getByRole('textbox', { name: 'Name of Brunch' })).toBeVisible();
});

test('import: Replace needs DELETE, and invalid files are rejected', async ({ page }) => {
  await page.goto('/settings/categories');
  await page.getByRole('textbox', { name: 'New category name' }).fill('Brunch');
  await page.getByRole('button', { name: 'Add category' }).click();
  await expect(page.getByRole('textbox', { name: 'Name of Brunch' })).toBeVisible();
  await page.goto('/settings');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export/ }).click();
  const path = (await (await download).path())!;

  // Garbage is refused with a clear message.
  await page.getByTestId('backup-file-input').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ app: 'trakr', backupVersion: 1 })),
  });
  await expect(page.getByRole('alert')).toContainText('Not a valid MYeats backup');
  await page.getByTestId('backup-file-input').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{nope'),
  });
  await expect(page.getByRole('alert')).toContainText('not valid JSON');

  // Add a local-only category, then Replace from the file: it disappears.
  await page.goto('/settings/categories');
  await page.getByRole('textbox', { name: 'New category name' }).fill('Local only');
  await page.getByRole('button', { name: 'Add category' }).click();
  await expect(page.getByRole('textbox', { name: 'Name of Local only' })).toBeVisible();

  await page.goto('/settings');
  await page.getByTestId('backup-file-input').setInputFiles(path);
  await page
    .getByRole('dialog', { name: 'Import backup' })
    .getByRole('button', { name: 'Replace all data' })
    .click();
  const confirm = page.getByRole('dialog', { name: /Type DELETE/ });
  const go = confirm.getByRole('button', { name: 'Replace all data' });
  await expect(go).toBeDisabled();
  await confirm.getByRole('textbox').fill('DELETE');
  await go.click();
  await expect(page.getByRole('status')).toHaveText('Backup restored.');

  await page.goto('/settings/categories');
  await expect(page.getByRole('textbox', { name: 'Name of Brunch' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Name of Local only' })).toHaveCount(0);
});
