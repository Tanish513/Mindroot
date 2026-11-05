import { test, expect } from '@playwright/test';

const userFixture = {
  id: 'e2e-user-persistence',
  name: 'Aarav Patel',
  email: 'aarav.patel@mindroot.dev',
  role: 'student',
  tokenBalance: 250,
  trustScore: 4.95
};

test.describe('P5.22 Live Room Persistent Call Across Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem('mindroot_current_user', JSON.stringify(user));
      localStorage.setItem('mindroot_auth_token', 'dev-token-' + user.id);
      localStorage.setItem('mindroot_current_role', 'student');
      localStorage.setItem('mindroot_theme', 'light');
    }, userFixture);

    await page.route('**/api/config', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ demoMode: true })
      });
    });

    await page.route('**/api/sessions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });
  });

  test('Navigating between Live Room and Dashboard keeps session alive with floating bar', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/live-room/practice');
    await page.waitForLoadState('networkidle');

    // Enter practice room
    const enterBtn = page.locator('button:has-text("Enter Practice Classroom")');
    await enterBtn.waitFor({ state: 'visible', timeout: 10000 });
    await enterBtn.click();

    // Verify room header is visible
    await expect(page.locator('h1', { hasText: 'Practice Room (Device Check)' })).toBeVisible({ timeout: 10000 });

    // Navigate to Dashboard via sidebar
    const dashboardNav = page.locator('nav a[href="/dashboard"], aside a[href="/dashboard"]').first();
    if (await dashboardNav.isVisible()) {
      await dashboardNav.click();
    } else {
      await page.goto('/dashboard');
    }
    await page.waitForLoadState('networkidle');

    // Verify In-Session Floating Bar is visible on Dashboard
    const floatingBar = page.locator('[data-testid="in-session-floating-bar"]');
    await expect(floatingBar).toBeVisible({ timeout: 10000 });
    await expect(floatingBar).toContainText('In session');
    await expect(floatingBar.locator('[data-testid="return-to-live-room"]')).toBeVisible();

    // Click Return to Live Room
    await floatingBar.locator('[data-testid="return-to-live-room"]').click();
    await page.waitForURL('**/live-room/practice');

    // Verify user is back in the active room (lobby was skipped because session was retained)
    await expect(page.locator('h1', { hasText: 'Practice Room (Device Check)' })).toBeVisible({ timeout: 10000 });

    // Floating bar is hidden while inside the live room
    await expect(floatingBar).not.toBeVisible();

    // Navigate to Schedule via sidebar link
    const scheduleNav = page.locator('nav a[href="/schedule"], aside a[href="/schedule"]').first();
    await scheduleNav.click();
    await page.waitForLoadState('networkidle');
    await expect(floatingBar).toBeVisible({ timeout: 10000 });

    // Click Leave on floating bar to explicitly end the call
    await floatingBar.locator('[data-testid="floating-bar-leave"]').click();
    await expect(floatingBar).not.toBeVisible();
  });
});
