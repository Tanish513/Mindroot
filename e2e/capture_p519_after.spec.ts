import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const userFixture = {
  id: 'e2e-user-liveroom-audit',
  name: 'Aarav Patel',
  email: 'aarav.patel@mindroot.dev',
  role: 'student',
  tokenBalance: 250,
  trustScore: 4.95
};

const artifactDir = 'C:/Users/tanis/.gemini/antigravity/brain/7388ce46-dc92-4d43-ac9e-d54e8df46f5c/screenshots';

test.describe('Live Room Fullscreen & Gallery After Screenshots (P5.19)', () => {
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

  test('Capture Gallery and Fullscreen after screenshots at 1440, 1280, and 390', async ({ page }) => {
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

      // Wait for view switcher in header
      const galleryBtn = page.locator('button[aria-label="Gallery View"]');
      await galleryBtn.waitFor({ state: 'visible', timeout: 10000 });

      // 1. Switch to Gallery View
      await galleryBtn.click();
      await page.waitForTimeout(1000);

      // In gallery view, click "+ Simulate 3 Students" if available to show badges and layout
      const simBtn = page.locator('button:has-text("+ Simulate 3 Students")');
      if (await simBtn.isVisible().catch(() => false)) {
        await simBtn.click();
        await page.waitForTimeout(1000);
      }

      const galleryLocalPath = `screenshots/phase5/liveroom_gallery_after_${vp.name}.png`;
      const galleryBrainPath = path.join(artifactDir, `liveroom_gallery_after_${vp.name}.png`);
      await page.screenshot({ path: galleryLocalPath, fullPage: false });
      fs.copyFileSync(galleryLocalPath, galleryBrainPath);

      // 2. Switch to Fullscreen Mode
      const fullscreenBtn = page.locator('button[aria-label="Fullscreen View"]');
      await fullscreenBtn.click();
      await page.waitForTimeout(1000);

      const fsLocalPath = `screenshots/phase5/liveroom_fullscreen_after_${vp.name}.png`;
      const fsBrainPath = path.join(artifactDir, `liveroom_fullscreen_after_${vp.name}.png`);
      await page.screenshot({ path: fsLocalPath, fullPage: false });
      fs.copyFileSync(fsLocalPath, fsBrainPath);

      // Exit fullscreen with ESC
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  });
});
