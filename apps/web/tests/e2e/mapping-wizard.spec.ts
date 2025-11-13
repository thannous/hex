import { expect, test } from '@playwright/test';

test.describe('Mapping wizard harness', () => {
  test('maps columns, reviews selections, and preserves state when returning', async ({ page }) => {
    await page.goto('/testing/mapping-wizard');

    const mappingStep = page.getByTestId('mapping-step');
    await expect(mappingStep).toBeVisible();

    const selects = page.getByLabel('Target Field');
    await selects.nth(0).selectOption('hex_code');
    await selects.nth(1).selectOption('designation');
    await selects.nth(2).selectOption('matiere');

    const goReview = page.getByTestId('go-review');
    await expect(goReview).toBeEnabled();
    await goReview.click();

    const reviewStep = page.getByTestId('review-step');
    await expect(reviewStep).toBeVisible();
    await expect(reviewStep.getByTestId('review-row-0')).toContainText('HEX Code');
    await expect(reviewStep.getByTestId('review-row-1')).toContainText('Designation');

    await page.getByTestId('back-to-mapping').click();
    await expect(mappingStep).toBeVisible();

    await expect(selects.nth(0)).toHaveValue('hex_code');
    await expect(selects.nth(1)).toHaveValue('designation');
    await expect(selects.nth(2)).toHaveValue('matiere');
  });
});
