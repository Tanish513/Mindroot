import { test, expect } from '@playwright/test';

test.describe('Streak Redesign Screenshots', () => {
  const getMockUser = (todayVisited: boolean) => ({
    id: 'user-streak-test',
    name: 'Alex Rivera',
    email: 'alex@mindroot.edu',
    role: 'student',
    tokenBalance: 240,
    rewardPoints: 120,
    streak: todayVisited ? 4 : 3,
    lastActiveDate: todayVisited ? '2026-10-30' : '2026-10-29',
    streakHistory: [
      { date: '2026-10-26' }, // Day 1: Mon (Completed)
      { date: '2026-10-27' }, // Day 2: Tue (Completed)
      // Day 3: Wed missing (Missed)
      { date: '2026-10-29' }, // Day 4: Thu (Completed)
      ...(todayVisited ? [{ date: '2026-10-30' }] : []) // Day 5: Fri (Today)
    ]
  });

  const setupPage = async (page: any, todayVisited: boolean, theme: 'light' | 'dark', viewport: { width: number; height: number }) => {
    await page.setViewportSize(viewport);

    // Mock API endpoints
    await page.route('**/api/config', async (route: any) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ demoMode: false }) });
    });
    await page.route('**/api/sessions**', async (route: any) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/peers**', async (route: any) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/champions**', async (route: any) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/notes**', async (route: any) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/users/profile', async (route: any) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(getMockUser(todayVisited)) });
    });

    await page.route('**/api/users/me/visit', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          streak: 4,
          isFirstVisitToday: false,
          visitedDates: ['2026-10-26', '2026-10-27', '2026-10-29', '2026-10-30'],
          user: getMockUser(todayVisited)
        })
      });
    });

    await page.addInitScript(({ mockUser, theme }) => {
      localStorage.setItem('mindroot_auth_token', 'dev-token-' + mockUser.id);
      localStorage.setItem('mindroot_current_user', JSON.stringify(mockUser));
      localStorage.setItem('mindroot_current_role', 'student');
      localStorage.setItem('mindroot_theme', theme);
      if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
        document.documentElement.classList.remove('dark');
      }
    }, { mockUser: getMockUser(todayVisited), theme });

    await page.goto('/dashboard');
    await page.waitForSelector('[data-testid="streak-tracker-container"]');
  };

const getCardLocator = (page: any) => page.locator('[data-testid="streak-tracker-container"]').locator('xpath=./ancestor::div[contains(@class, "bg-surface") or contains(@class, "bg-accent-tint")][1]');

  test('Desktop Light Theme - Today Unclaimed', async ({ page }) => {
    await setupPage(page, false, 'light', { width: 1366, height: 768 });
    const card = getCardLocator(page);
    await expect(card).toBeVisible();
    await card.screenshot({ path: 'screenshots/streak-redesign-desktop-light-unclaimed.png' });
  });

  test('Desktop Dark Theme - Today Unclaimed', async ({ page }) => {
    await setupPage(page, false, 'dark', { width: 1366, height: 768 });
    const card = getCardLocator(page);
    await expect(card).toBeVisible();
    await card.screenshot({ path: 'screenshots/streak-redesign-desktop-dark-unclaimed.png' });
  });

  test('Desktop Light Theme - Today Claimed', async ({ page }) => {
    await setupPage(page, true, 'light', { width: 1366, height: 768 });
    const card = getCardLocator(page);
    await expect(card).toBeVisible();
    await card.screenshot({ path: 'screenshots/streak-redesign-desktop-light-claimed.png' });
  });

  test('Desktop Dark Theme - Today Claimed', async ({ page }) => {
    await setupPage(page, true, 'dark', { width: 1366, height: 768 });
    const card = getCardLocator(page);
    await expect(card).toBeVisible();
    await card.screenshot({ path: 'screenshots/streak-redesign-desktop-dark-claimed.png' });
  });

  test('Mobile 390px Light Theme - Today Unclaimed', async ({ page }) => {
    await setupPage(page, false, 'light', { width: 390, height: 844 });
    const card = getCardLocator(page);
    await expect(card).toBeVisible();
    await card.screenshot({ path: 'screenshots/streak-redesign-mobile-light-unclaimed.png' });
  });

  test('Mobile 390px Dark Theme - Today Unclaimed', async ({ page }) => {
    await setupPage(page, false, 'dark', { width: 390, height: 844 });
    const card = getCardLocator(page);
    await expect(card).toBeVisible();
    await card.screenshot({ path: 'screenshots/streak-redesign-mobile-dark-unclaimed.png' });
  });

  test('Mobile 390px Light Theme - Today Claimed', async ({ page }) => {
    await setupPage(page, true, 'light', { width: 390, height: 844 });
    const card = getCardLocator(page);
    await expect(card).toBeVisible();
    await card.screenshot({ path: 'screenshots/streak-redesign-mobile-light-claimed.png' });
  });

  test('Mobile 390px Dark Theme - Today Claimed', async ({ page }) => {
    await setupPage(page, true, 'dark', { width: 390, height: 844 });
    const card = getCardLocator(page);
    await expect(card).toBeVisible();
    await card.screenshot({ path: 'screenshots/streak-redesign-mobile-dark-claimed.png' });
  });
});
