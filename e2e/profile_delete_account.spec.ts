import { test, expect } from '@playwright/test';

const testUser = {
  id: 'e2e-profile-user',
  name: 'Sam Tester',
  email: 'sam@mindroot.dev',
  role: 'student',
  tokenBalance: 0,
  trustScore: 4.9
};

test.describe('Profile Delete Account Confirmation Dialog', () => {
  test('Clicking Delete Account button opens the confirmation modal and allows cancel/confirm', async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem('mindroot_current_user', JSON.stringify(user));
      localStorage.setItem('mindroot_auth_token', 'dev-token-' + user.id);
      localStorage.setItem('mindroot_current_role', 'student');
    }, testUser);

    await page.route('**/api/config', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ demoMode: false }) });
    });

    await page.route('**/api/users/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(testUser)
      });
    });

    await page.route('**/api/sessions', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    let deleteRequested = false;
    await page.route('**/api/users/e2e-profile-user', async (route) => {
      if (route.request().method() === 'DELETE') {
        deleteRequested = true;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      } else {
        await route.fallback();
      }
    });

    await page.goto('/profile');

    // Verify Delete Account button is visible in Danger Zone
    const deleteBtn = page.getByTestId('delete-account-button');
    await expect(deleteBtn).toBeVisible();

    // Confirmation modal should initially not be in document
    const modal = page.getByTestId('delete-account-modal');
    await expect(modal).not.toBeVisible();

    // Click Delete Account button
    await deleteBtn.click();

    // Confirmation modal MUST open and be visible
    await expect(modal).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Delete Your Account?' })).toBeVisible();
    await expect(page.getByText('Are you sure you want to delete your account? This action cannot be undone.')).toBeVisible();

    // Click Cancel button
    const cancelBtn = page.getByTestId('cancel-delete-account-button');
    await cancelBtn.click();

    // Modal should close
    await expect(modal).not.toBeVisible();

    // Click Delete Account again
    await deleteBtn.click();
    await expect(modal).toBeVisible();

    // Click confirm delete button
    const confirmBtn = page.getByTestId('confirm-delete-account-button');
    await confirmBtn.click();

    // Should have called DELETE /api/users/e2e-profile-user
    await expect.poll(() => deleteRequested).toBe(true);
  });
});
