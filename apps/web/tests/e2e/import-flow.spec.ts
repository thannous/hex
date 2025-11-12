import { expect, test } from '@playwright/test';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '../fixtures');
const csvFixture = join(fixturesDir, 'sample.csv');
const xlsxFixture = join(fixturesDir, 'sample.xlsx');

test.describe('Import wizard flow', () => {
  test('parses CSV then XLSX sequentially without reload', async ({ page }) => {
    await page.goto('/testing/import-flow');

    const fileInput = page.locator('input[type="file"]');

    await fileInput.setInputFiles(csvFixture);

    await expect(page.getByText('Import successful!')).toBeVisible();
    await expect(page.getByText('2 rows parsed and stored')).toBeVisible();

    await page.getByRole('button', { name: 'Import another file' }).click();

    await expect(page.getByText('Drag and drop your file here, or click to select')).toBeVisible();

    await fileInput.setInputFiles(xlsxFixture);

    await expect(page.getByText('Import successful!')).toBeVisible();
    await expect(page.getByText('2 rows parsed and stored')).toBeVisible();
  });
});
