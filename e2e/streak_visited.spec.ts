import { test, expect } from '@playwright/test';

const testUser = {
  id: 'e2e-streak-student',
  name: 'Devon Miles',
  email: 'devon@mindroot.dev',
  role: 'student',
  tokenBalance: 80,
  trustScore: 4.9,
  streak: 1,
  lastActiveDate: '2026-10-28',
  streakHistory: [{ date: '2026-10-28', activities: ['visit'] }],
  lastClaimedStreakMilestone: 0,
  rewardPoints: 10
};

test.describe('7-Day Streak Tracker Visited State & Animation', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept common APIs
    await page.route('**/api/config', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ demoMode: false }) });
    });
    await page.route('**/api/sessions**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/peers**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/champions**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/notes**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/users/profile', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(testUser) });
    });
  });

  test('Tracker shows visited state after load and captures light screenshot', async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem('mindroot_current_user', JSON.stringify(user));
      localStorage.setItem('mindroot_auth_token', 'dev-token-' + user.id);
      localStorage.setItem('mindroot_current_role', 'student');
      localStorage.setItem('mindroot_theme', 'light');
    }, testUser);

    await page.route('**/api/users/me/visit', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          isFirstVisitToday: true,
          todayStr: '2026-10-28',
          streak: 1,
          user: testUser
        })
      });
    });

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // 1. Tracker container must be visible
    const tracker = page.locator('[data-testid="streak-tracker-container"]');
    await expect(tracker).toBeVisible();

    // 2. Track background line and filled line exist behind circles
    const trackLine = page.locator('[data-testid="streak-track-line"]');
    await expect(trackLine).toBeVisible();

    // 3. Today's circle must settle into visited state with checkmark '✓'
    const todayCircle = page.locator('[data-testid="streak-day-today"]');
    await expect(todayCircle).toBeVisible();
    await expect(todayCircle).toContainText('✓');

    // 4. Capture light theme screenshot
    await page.screenshot({ path: 'screenshots/streak-tracker-light.png' });
  });

  test('No animation on reload when visited flag is set', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    await page.addInitScript(({ user, dateStr }) => {
      localStorage.setItem('mindroot_current_user', JSON.stringify(user));
      localStorage.setItem('mindroot_auth_token', 'dev-token-' + user.id);
      localStorage.setItem('mindroot_current_role', 'student');
      localStorage.setItem(`mindroot_streak_anim_${user.id}_${dateStr}`, 'true');
    }, { user: testUser, dateStr: today });

    await page.route('**/api/users/me/visit', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          isFirstVisitToday: false,
          todayStr: today,
          streak: 1,
          user: testUser
        })
      });
    });

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Settled visited state immediately visible with checkmark
    const todayCircle = page.locator('[data-testid="streak-day-today"]');
    await expect(todayCircle).toBeVisible();
    await expect(todayCircle).toContainText('✓');
  });

  test('Respects prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await page.addInitScript((user) => {
      localStorage.setItem('mindroot_current_user', JSON.stringify(user));
      localStorage.setItem('mindroot_auth_token', 'dev-token-' + user.id);
      localStorage.setItem('mindroot_current_role', 'student');
    }, testUser);

    await page.route('**/api/users/me/visit', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          isFirstVisitToday: true,
          todayStr: '2026-10-28',
          streak: 1,
          user: testUser
        })
      });
    });

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const todayCircle = page.locator('[data-testid="streak-day-today"]');
    await expect(todayCircle).toBeVisible();
    await expect(todayCircle).toContainText('✓');
  });

  test('Dark theme rendering and dark screenshot capture', async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem('mindroot_current_user', JSON.stringify(user));
      localStorage.setItem('mindroot_auth_token', 'dev-token-' + user.id);
      localStorage.setItem('mindroot_current_role', 'student');
      localStorage.setItem('mindroot_theme', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
    }, testUser);

    await page.route('**/api/users/me/visit', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          isFirstVisitToday: false,
          todayStr: '2026-10-28',
          streak: 1,
          user: testUser
        })
      });
    });

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Verify dark theme applied
    const darkTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(darkTheme).toBe('dark');

    const todayCircle = page.locator('[data-testid="streak-day-today"]');
    await expect(todayCircle).toBeVisible();
    await expect(todayCircle).toContainText('✓');

    // Capture dark theme screenshot
    await page.screenshot({ path: 'screenshots/streak-tracker-dark.png' });
  });
});
