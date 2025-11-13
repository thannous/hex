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
    // Ensure client hydration finished before interacting with React handlers
    const harness = page.getByTestId('import-harness');
    await expect(harness).toHaveAttribute('data-hydrated', 'true', { timeout: 30000 });

    const fileInput = page.locator('input[type="file"]');

    await fileInput.setInputFiles(csvFixture);

    await expect(page.getByText('Import successful!')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('2 rows parsed and stored')).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Import another file' }).click();

    await expect(page.getByText('Drag and drop your file here, or click to select')).toBeVisible({
      timeout: 10000,
    });

    await fileInput.setInputFiles(xlsxFixture);

    await expect(page.getByText('Import successful!')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('2 rows parsed and stored')).toBeVisible({ timeout: 15000 });
  });
});
