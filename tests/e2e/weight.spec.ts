import { expect, test, type Page } from '@playwright/test';

function key(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

async function seedWeighIns(
  page: Page,
  rows: { date: string; weightLb: number; bodyFatPct: number | null }[],
) {
  await page.evaluate(async (items) => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open('myeats');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    await new Promise<void>((res, rej) => {
      const tx = db.transaction('weighIns', 'readwrite');
      for (const it of items) {
        tx.objectStore('weighIns').put({
          id: `w-${it.date}`,
          ...it,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, rows);
  await page.reload();
}

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
  await page.goto('/weight');
  await expect(page.getByRole('heading', { name: 'Weight', level: 1 })).toBeVisible();
});

test('logs today with a live kg read-out, and saving again replaces it', async ({ page }) => {
  await expect(page.getByText('No weigh-ins')).toBeVisible();
  await page.getByLabel('Weight in lb').fill('182.3');
  await expect(page.getByTestId('kg-readout')).toHaveText('= 82.7 kg');
  await page.getByLabel('Body fat %').fill('18.5');
  await page.getByRole('button', { name: 'Save' }).click();

  const rows = page.getByTestId('weighin-row');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('182.3 lb');
  await expect(rows.first()).toContainText('82.7 kg');
  await expect(rows.first()).toContainText('18.5% body fat');
  await expect(page.getByTestId('weight-chart')).toHaveAttribute('data-points', '1');

  await page.getByLabel('Weight in lb').fill('181.7');
  await page.getByRole('button', { name: 'Update' }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('181.7 lb');
  await expect(rows.first()).toContainText('82.4 kg');
});

test('edits and deletes from the list, with change from previous', async ({ page }) => {
  await seedWeighIns(page, [
    { date: key(-8), weightLb: 180, bodyFatPct: null },
    { date: key(-3), weightLb: 179.4, bodyFatPct: 20 },
  ]);
  const rows = page.getByTestId('weighin-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('−0.6');
  await expect(page.getByTestId('weight-chart')).toHaveAttribute('data-points', '2');
  await expect(page.locator('[data-testid="weight-chart"] circle.recharts-dot')).toHaveCount(2);

  await rows.first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Weight in lb').fill('178.9');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(rows.first()).toContainText('178.9 lb');
  await expect(rows.first()).toContainText('−1.1');

  await rows.first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('180.0 lb');
});

test('has no horizontal page scroll', async ({ page }) => {
  await seedWeighIns(page, [{ date: key(-1), weightLb: 180, bodyFatPct: null }]);
  await expect(page.getByTestId('weight-chart')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
