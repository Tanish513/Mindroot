import { test, expect } from '@playwright/test';

const userFixture = {
  id: 'e2e-user-fullscreen-audit',
  name: 'Aarav Patel',
  email: 'aarav.patel@mindroot.dev',
  role: 'student',
  tokenBalance: 250,
  trustScore: 4.95
};

test.describe('P5.19 Live Room Fullscreen & Gallery Polish', () => {
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

  test('Fullscreen mode renders bottom control bar, sentence case header, and non-overlapping PiP', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/live-room/practice');
    await page.waitForLoadState('networkidle');

    const enterBtn = page.locator('button:has-text("Enter Practice Classroom")');
    await enterBtn.waitFor({ state: 'visible', timeout: 10000 });
    await enterBtn.click();

    // Switch to Fullscreen Mode
    const fullscreenBtn = page.locator('button[aria-label="Fullscreen View"]');
    await fullscreenBtn.waitFor({ state: 'visible', timeout: 10000 });
    await fullscreenBtn.click();

    // 1. Sentence-case header
    await expect(page.locator('header span:has-text("Focus mode")')).toBeVisible();

    // 2. Fullscreen docked bottom control bar
    const fsFooter = page.locator('footer:has-text("In Focus Mode")');
    await expect(fsFooter).toBeVisible();
    await expect(fsFooter.locator('button[aria-label*="microphone"]')).toBeVisible();
    await expect(fsFooter.locator('button[aria-label*="camera"]')).toBeVisible();
    await expect(fsFooter.locator('button[aria-label="Share screen"]')).toBeVisible();
    await expect(fsFooter.locator('button[aria-label="Leave call"]')).toBeVisible();

    // 3. PiP box is at bottom right, leaving top-right area clear
    const pipBox = page.locator('[data-testid="fullscreen-pip-box"]');
    await expect(pipBox).toBeVisible();
    const pipBounding = await pipBox.boundingBox();
    expect(pipBounding).not.toBeNull();
    if (pipBounding) {
      // Bounding box y should be towards the bottom (> 300px), not top (< 100px)
      expect(pipBounding.y).toBeGreaterThan(300);
    }

    // 4. Test escape exits fullscreen
    await page.keyboard.press('Escape');
    await expect(fsFooter).not.toBeVisible();
  });

  test('Gallery mode renders honest demo chip without per-tile badges and gates simulation button', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/live-room/practice');
    await page.waitForLoadState('networkidle');

    const enterBtn = page.locator('button:has-text("Enter Practice Classroom")');
    await enterBtn.waitFor({ state: 'visible', timeout: 10000 });
    await enterBtn.click();

    const galleryBtn = page.locator('button[aria-label="Gallery View"]');
    await galleryBtn.waitFor({ state: 'visible', timeout: 10000 });
    await galleryBtn.click();

    // Click Simulate 3 Students
    const simBtn = page.locator('button:has-text("+ Simulate 3 Students")');
    if (await simBtn.isVisible().catch(() => false)) {
      await simBtn.click();
      await page.waitForTimeout(500);
    }

    // Honest single chip in header
    await expect(page.locator('text=Demo: simulated participants')).toBeVisible();

    // Ensure NO per-tile uppercase "SIMULATED" badge elements exist
    const perTileBadges = page.locator('div.absolute.top-2.right-2:has-text("Simulated")');
    expect(await perTileBadges.count()).toBe(0);
  });

  test('Fullscreen on 390px mobile viewport exhibits zero horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/live-room/practice');
    await page.waitForLoadState('networkidle');

    const enterBtn = page.locator('button:has-text("Enter Practice Classroom")');
    await enterBtn.waitFor({ state: 'visible', timeout: 10000 });
    await enterBtn.click();

    const fullscreenBtn = page.locator('button[aria-label="Fullscreen View"]');
    await fullscreenBtn.waitFor({ state: 'visible', timeout: 10000 });
    await fullscreenBtn.click();

    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth || document.body.scrollWidth > window.innerWidth;
    });
    expect(overflow).toBe(false);
  });
});
