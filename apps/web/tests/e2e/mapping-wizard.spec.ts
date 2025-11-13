import { expect, test } from '@playwright/test';

test.describe('Mapping wizard harness', () => {
  test('maps columns, reviews selections, and preserves state when returning', async ({ page }) => {
    await page.goto('/testing/mapping-wizard');

    const mappingStep = page.getByTestId('mapping-step');
    await expect(mappingStep).toBeVisible();

    const prefillButton = page.getByTestId('prefill-mappings');
    await expect(prefillButton).toHaveAttribute('data-hydrated', 'true', { timeout: 30000 });
    await prefillButton.click();

    await expect(page.getByTestId('mapping-count')).toContainText('Current mappings: 3');
    await expect(page.locator('[data-testid="target-select-0"]')).toHaveValue('hex_code');
    await expect(page.locator('[data-testid="target-select-1"]')).toHaveValue('designation');
    await expect(page.locator('[data-testid="target-select-2"]')).toHaveValue('matiere');

    const goReview = page.getByTestId('go-review');
    await expect(goReview).toBeEnabled();
    await goReview.click();

    const reviewStep = page.getByTestId('review-step');
    await expect(reviewStep).toBeVisible();
    await expect(reviewStep.getByTestId('review-row-0')).toContainText('HEX Code');
    await expect(reviewStep.getByTestId('review-row-1')).toContainText('Designation');

    await page.getByTestId('back-to-mapping').click();
    await expect(mappingStep).toBeVisible();

    await expect(page.locator('[data-testid="target-select-0"]')).toHaveValue('hex_code');
    await expect(page.locator('[data-testid="target-select-1"]')).toHaveValue('designation');
    await expect(page.locator('[data-testid="target-select-2"]')).toHaveValue('matiere');
  });
});
