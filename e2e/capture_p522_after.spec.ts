import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const userFixture = {
  id: 'e2e-user-persistence-capture',
  name: 'Aarav Patel',
  email: 'aarav.patel@mindroot.dev',
  role: 'student',
  tokenBalance: 250,
  trustScore: 4.95
};

const artifactDir = 'C:/Users/tanis/.gemini/antigravity/brain/7388ce46-dc92-4d43-ac9e-d54e8df46f5c/screenshots';

test.describe('P5.22 In-Session Floating Bar After Screenshots', () => {
  test.beforeAll(() => {
    if (!fs.existsSync('screenshots/phase5')) {
      fs.mkdirSync('screenshots/phase5', { recursive: true });
    }
    if (!fs.existsSync(artifactDir)) {
      fs.mkdirSync(artifactDir, { recursive: true });
    }
  });

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

  test('Capture Dashboard with in-session floating bar at 1440, 1280, and 390', async ({ page }) => {
    const viewports = [
      { name: '1440', width: 1440, height: 900 },
      { name: '1280', width: 1280, height: 800 },
      { name: '390', width: 390, height: 844 }
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/live-room/practice');
      await page.waitForLoadState('networkidle');

      const enterBtn = page.locator('button:has-text("Enter Practice Classroom")');
      await enterBtn.waitFor({ state: 'visible', timeout: 10000 });
      await enterBtn.click();

      // Ensure room is entered
      await expect(page.locator('header').first()).toBeVisible({ timeout: 10000 });

      // Navigate to Dashboard via client-side routing
      await page.evaluate(() => {
        window.history.pushState({}, '', '/dashboard');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      await page.waitForLoadState('networkidle');

      // Verify floating bar
      const floatingBar = page.locator('[data-testid="in-session-floating-bar"]');
      await expect(floatingBar).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(500);

      const localPath = `screenshots/phase5/dashboard_insession_bar_${vp.name}.png`;
      const brainPath = path.join(artifactDir, `dashboard_insession_bar_${vp.name}.png`);
      await page.screenshot({ path: localPath, fullPage: false });
      fs.copyFileSync(localPath, brainPath);

      // Leave call before next iteration
      await floatingBar.locator('[data-testid="floating-bar-leave"]').click();
      await expect(floatingBar).not.toBeVisible();
    }
  });
});
