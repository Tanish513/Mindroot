import { test } from '@playwright/test';

test('Capture Dashboard After Polish', async ({ page }) => {
  test.setTimeout(90000);

  // 1. Desktop 1440px
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await page.waitForLoadState('networkidle');

  // Sign in as Demo Student
  await page.click('button:has-text("Demo Student (Alex)")');
  await page.click('button[type="submit"]:has-text("Sign In to Mindroot")');

  await page.waitForURL('**/dashboard', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('button:text-is("Connect")', { timeout: 15000 });
  await page.waitForTimeout(1000);

  await page.screenshot({ path: 'screenshots/dashboard_after_polish_1440.png' });
  await page.screenshot({ path: 'screenshots/dashboard_after_redesign.png' });
  await page.screenshot({ path: 'screenshots/after/02_dashboard.png' });

  // 2. Desktop 1280px
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/dashboard_after_polish_1280.png' });

  // 3. Mobile 390px
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/dashboard_after_polish_mobile.png' });
});
