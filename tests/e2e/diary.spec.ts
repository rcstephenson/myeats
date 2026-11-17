import { expect, test } from '@playwright/test';
import {
  dateKey,
  makeEntry,
  makeFood,
  makeGoal,
  openApp,
  overlay,
  plus,
  section,
} from './helpers';

const oats = makeFood();
const whey = makeFood({
  name: 'Whey isolate',
  per100: { ...oats.per100, kcal: 400, protein: 80, carbs: 8, fiber: 0, fat: 5 },
  servings: [{ id: 'sv1', label: '1 scoop', amount: 30 }],
});

test('fresh install: five categories, no goal prompt state, no weigh-in row', async ({ page }) => {
  await openApp(page);
  for (const c of ['Breakfast', 'Lunch', 'Meal 3', 'Dinner', 'Snacks']) {
    await expect(section(page, c)).toBeVisible();
  }
  await expect(page.getByRole('link', { name: 'Set daily goal' })).toHaveAttribute('href', '/settings/goals');
  await expect(page.getByRole('meter')).toHaveCount(0);
  await expect(page.getByText(/Log weight|Weigh-in/)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
  await expect(overlay(page)).toBeHidden();
});

test('totals and "N left" follow the goal; subtotals and macro rows are right', async ({ page }) => {
  await openApp(page, {
    goals: [makeGoal()],
    foods: [oats, whey],
    entries: [
      makeEntry(oats, { amount: 80, categoryId: 'cat-breakfast', order: 1 }),
      makeEntry(whey, { amount: 1, unit: { kind: 'serving', servingId: 'sv1' }, categoryId: 'cat-breakfast', order: 2 }),
    ],
  });
  // oats 80 g = 304 kcal, whey 30 g = 120 kcal.
  await expect(page.getByRole('meter', { name: /^Calories 424 of 2,000 calories, 1,576 left$/ })).toBeVisible();
  await expect(section(page, 'Breakfast')).toContainText('424 kcal');
  await expect(section(page, 'Breakfast').getByText('80 g')).toBeVisible();
  await expect(section(page, 'Breakfast').getByText('1 scoop')).toBeVisible();
  // Net carbs: oats (67-10)*0.8 = 45.6, whey 2.4 => 48.
  await expect(page.getByRole('meter', { name: /^Net carbs 48 of 150 grams, 102 left$/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Set daily goal' })).toHaveCount(0);
});

test('over goal reads "over"; the More row is remembered', async ({ page }) => {
  await openApp(page, {
    goals: [makeGoal({ kcal: 200, fiber: 30 })],
    foods: [oats],
    entries: [makeEntry(oats, { amount: 80 })],
  });
  await expect(page.getByRole('meter', { name: /104 over/ })).toBeVisible();
  const more = page.getByRole('button', { name: /More/ });
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await more.click();
  await expect(page.getByRole('meter', { name: /^Fiber 8 of 30 grams/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: /More/ })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('meter', { name: /^Fiber 8 of 30 grams/ })).toBeVisible();
});

test('edit amount recomputes from the snapshot; delete has Undo', async ({ page }) => {
  await openApp(page, { foods: [oats], entries: [makeEntry(oats, { amount: 80 })] });
  const breakfast = section(page, 'Breakfast');
  await breakfast.getByRole('button', { name: /Rolled oats/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Rolled oats' });
  await sheet.getByLabel('Amount').fill('100');
  await expect(sheet.getByTestId('entry-preview-kcal')).toContainText('380');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(breakfast.getByText('100 g')).toBeVisible();
  await expect(breakfast).toContainText('380 kcal');

  await breakfast.getByRole('button', { name: /Rolled oats/ }).click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(breakfast.getByText('Rolled oats')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(breakfast.getByText('Rolled oats')).toBeVisible();
});

test('editing can change unit and category', async ({ page }) => {
  await openApp(page, { foods: [oats], entries: [makeEntry(oats, { amount: 80 })] });
  await section(page, 'Breakfast').getByRole('button', { name: /Rolled oats/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Rolled oats' });
  await sheet.getByLabel('Unit').selectOption({ label: '1 scoop' });
  await expect(sheet.getByLabel('Amount')).toHaveValue('2'); // 80 g = 2 x 40 g
  await sheet.getByLabel('Category').selectOption({ label: 'Lunch' });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(section(page, 'Lunch').getByText('2 scoop')).toBeVisible();
  await expect(section(page, 'Breakfast').getByText('Rolled oats')).toHaveCount(0);
});

test('clear asks for confirmation and can be undone', async ({ page }) => {
  await openApp(page, { foods: [oats], entries: [makeEntry(oats)] });
  const breakfast = section(page, 'Breakfast');
  await breakfast.getByRole('button', { name: 'Breakfast options' }).click();
  await page.getByRole('menuitem', { name: 'Clear' }).click();
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(breakfast.getByText('Rolled oats')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(breakfast.getByText('Rolled oats')).toBeVisible();
});

test('yesterday is read-only and can be copied to today', async ({ page }) => {
  await openApp(page, {
    goals: [makeGoal({ effectiveFrom: '2020-01-01', kcal: 1800 })],
    foods: [oats],
    entries: [makeEntry(oats, { amount: 80, date: dateKey(1), categoryId: 'cat-lunch' })],
  });
  await page.getByRole('button', { name: 'Previous day' }).click();
  await expect(page).toHaveURL(new RegExp(`/day/${dateKey(1)}$`));
  await expect(page.getByText(/READ-ONLY/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Add to / })).toHaveCount(0);
  await expect(page.getByRole('meter', { name: /^Calories 304 of 1,800/ })).toBeVisible();
  // Rows are not editable.
  await section(page, 'Lunch').getByText('Rolled oats').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // The category menu only offers Copy to today.
  await section(page, 'Lunch').getByRole('button', { name: 'Lunch options' }).click();
  await expect(page.getByRole('menuitem')).toHaveCount(1);
  await page.getByRole('menuitem', { name: 'Copy to today' }).click();
  await page.getByRole('link', { name: 'Back to today' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(section(page, 'Lunch').getByText('Rolled oats')).toBeVisible();
  // A single past entry can be copied too, from its own menu.
  await page.getByRole('button', { name: 'Previous day' }).click();
  await section(page, 'Lunch').getByRole('button', { name: 'Rolled oats options' }).click();
  await page.getByRole('menuitem', { name: 'Copy to today' }).click();
  await page.getByRole('link', { name: 'Back to today' }).click();
  await expect(section(page, 'Lunch').getByText('Rolled oats')).toHaveCount(2);
});

test('copy from yesterday: disabled when empty, copies with Undo', async ({ page }) => {
  await openApp(page, {
    foods: [oats],
    entries: [makeEntry(oats, { amount: 60, date: dateKey(1), categoryId: 'cat-breakfast' })],
  });
  await section(page, 'Lunch').getByRole('button', { name: 'Lunch options' }).click();
  await expect(page.getByRole('menuitem', { name: 'Copy from yesterday' })).toBeDisabled();
  await page.keyboard.press('Escape');
  const breakfast = section(page, 'Breakfast');
  await breakfast.getByRole('button', { name: 'Breakfast options' }).click();
  await page.getByRole('menuitem', { name: 'Copy from yesterday' }).click();
  await expect(breakfast.getByText('60 g')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(breakfast.getByText('60 g')).toHaveCount(0);
});

test('save as meal passes the date and category to the meal editor', async ({ page }) => {
  await openApp(page, { foods: [oats], entries: [makeEntry(oats, { categoryId: 'cat-dinner' })] });
  await section(page, 'Dinner').getByRole('button', { name: 'Dinner options' }).click();
  await page.getByRole('menuitem', { name: 'Save as meal' }).click();
  await expect(page).toHaveURL(new RegExp(`/meals/new\\?fromDate=${dateKey(0)}&category=cat-dinner$`));
});

test('date input navigates to a past day; future days redirect to today', async ({ page }) => {
  await openApp(page);
  const target = dateKey(3);
  await page.getByLabel('Choose date').fill(target);
  await expect(page).toHaveURL(new RegExp(`/day/${target}$`));
  await expect(page.getByRole('button', { name: 'Next day' })).toBeEnabled();
  await page.goto(`/day/${dateKey(-2)}`);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: 'Next day' })).toBeDisabled();
  await expect(plus(page, 'Breakfast')).toBeVisible();
});

test('saved-meal entries are grouped under a meal header', async ({ page }) => {
  const a = { ...makeEntry(oats, { order: 1 }), mealLogId: 'log1', mealName: 'Usual breakfast' };
  const b = { ...makeEntry(whey, { amount: 1, unit: { kind: 'serving' as const, servingId: 'sv1' }, order: 2 }), mealLogId: 'log1', mealName: 'Usual breakfast' };
  await openApp(page, { foods: [oats, whey], entries: [a, b] });
  const group = section(page, 'Breakfast').getByRole('group', { name: 'Usual breakfast' });
  await expect(group).toContainText('424 kcal');
  await expect(group.getByText('Whey isolate')).toBeVisible();
});
