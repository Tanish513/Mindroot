import { test, expect } from '@playwright/test';

test.describe('Verify Email Page without Token', () => {
  test('displays a friendly explanation and a working link home when token is missing', async ({ page }) => {
    // Navigate directly to /verify-email without token
    await page.goto('/verify-email');

    // Check that no-token state is shown
    const noTokenContainer = page.getByTestId('verify-email-no-token');
    await expect(noTokenContainer).toBeVisible();

    // Verify friendly explanation content
    await expect(noTokenContainer).toContainText('Email Verification Link Required');
    await expect(noTokenContainer).toContainText('It looks like you arrived here without a verification token');
    await expect(noTokenContainer).toContainText('please check your spam folder or sign in');

    // Click Return Home button
    const returnHomeBtn = page.getByTestId('return-home-btn');
    await expect(returnHomeBtn).toBeVisible();
    await returnHomeBtn.click();

    // Verify navigation back home (URL should be /)
    await expect(page).toHaveURL(/\/(#.*)?$/);
  });
});
