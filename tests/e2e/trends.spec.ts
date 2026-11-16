import { expect, test } from '@playwright/test';

function key(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
});

test('empty state without entries', async ({ page }) => {
  await page.goto('/trends');
  await expect(page.getByText('No entries')).toBeVisible();
});

test('renders the weekly table and both charts across a goal change', async ({ page }) => {
  await page.goto('/trends');
  await expect(page.getByRole('heading', { name: 'Trends', level: 1 })).toBeVisible();

  const nutrients = (kcal: number, protein: number) => ({
    kcal,
    protein,
    carbs: 20,
    fiber: 5,
    sugar: 2,
    fat: 10,
    satFat: 1,
    sodium: 100,
  });
  const entries = [] as unknown[];
  // Log ~3 days in each of the last 4 weeks; the most recent day is today minus 1..
  for (let w = 0; w < 4; w++) {
    for (const d of [1, 3, 4]) {
      const date = key(-(w * 7 + d));
      entries.push({
        id: `e-${date}`,
        date,
        categoryId: 'c',
        order: 0,
        kind: 'quick',
        refId: null,
        name: 'Quick add',
        brand: null,
        amount: null,
        unitLabel: null,
        baseAmount: null,
        snapshot: null,
        // Weeks older than 2 are under goal, newer ones over.
        nutrients: nutrients(w < 2 ? 2600 : 1800, 120),
        kcalDerived: false,
        mealLogId: null,
        mealName: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }
  const goals = [
    {
      id: 'g1',
      effectiveFrom: key(-60),
      kcal: 2200,
      protein: 150,
      netCarbs: 100,
      fat: 80,
      fiber: 30,
      sugar: null,
      satFat: null,
      sodium: null,
    },
    {
      id: 'g2',
      effectiveFrom: key(-14),
      kcal: 2000,
      protein: 160,
      netCarbs: 100,
      fat: 80,
      fiber: 30,
      sugar: null,
      satFat: null,
      sodium: null,
    },
  ];
  await page.evaluate(
    async ({ entries, goals }) => {
      const db = await new Promise<IDBDatabase>((res, rej) => {
        const r = indexedDB.open('myeats');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      await new Promise<void>((res, rej) => {
        const tx = db.transaction(['entries', 'goals'], 'readwrite');
        for (const e of entries) tx.objectStore('entries').put(e);
        for (const g of goals) tx.objectStore('goals').put(g);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    },
    { entries, goals },
  );
  await page.reload();

  const table = page.getByTestId('weekly-table');
  await expect(table).toBeVisible();
  // 12W default: 12 body rows, newest first.
  await expect(table.locator('tbody tr')).toHaveCount(12);
  await expect(
    table
      .locator('tbody tr')
      .filter({ hasText: /[1-9]\/7/ })
      .first(),
  ).toBeVisible();
  // Over-goal ticks have a text alternative.
  await expect(table.getByTestId('over-tick').first()).toBeVisible();
  await expect(table.getByText('over goal:').first()).toBeAttached();

  const kcal = page.getByTestId('kcal-chart');
  const protein = page.getByTestId('protein-chart');
  await expect(kcal).toHaveAttribute('data-days', '12');
  await expect(kcal.locator('.recharts-bar-rectangle path.recharts-rectangle')).toHaveCount(12);
  await expect(protein.locator('.recharts-bar-rectangle path.recharts-rectangle')).toHaveCount(12);
  await expect(kcal.locator('path.recharts-line-curve')).toHaveCount(1);
  await expect(kcal.locator('path.recharts-line-curve')).toHaveAttribute('stroke-dasharray', '4 4');

  await page.getByRole('button', { name: '4W' }).click();
  await expect(table.locator('tbody tr')).toHaveCount(4);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
