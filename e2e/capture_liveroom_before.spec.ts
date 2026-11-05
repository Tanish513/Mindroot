import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const userFixture = {
  id: 'e2e-user-liveroom',
  name: 'Aarav Patel',
  email: 'aarav.patel@mindroot.dev',
  role: 'student',
  tokenBalance: 250,
  trustScore: 4.95
};

const artifactDir = 'C:/Users/tanis/.gemini/antigravity/brain/7388ce46-dc92-4d43-ac9e-d54e8df46f5c/screenshots';

test.describe('Live Room Before Audit Screenshots', () => {
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

    await page.route('**/api/notes*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'note-sample-1',
            sessionId: 'practice',
            authorId: 'e2e-user-liveroom',
            title: 'Calculus Fundamental Theorem Key Steps',
            content: 'Remember to apply substitution rule before evaluating boundaries.',
            visibility: 'shared',
            createdAt: new Date().toISOString()
          },
          {
            id: 'note-sample-2',
            sessionId: 'practice',
            authorId: 'other-user',
            title: 'Personal Checklist',
            content: 'Clarify step 3 with mentor next lecture.',
            visibility: 'private',
            createdAt: new Date().toISOString()
          }
        ])
      });
    });
  });

  test('Capture practice room before screenshots at 1440px, 1280px, and 390px', async ({ page }) => {
    const viewports = [
      { name: '1440', width: 1440, height: 900 },
      { name: '1280', width: 1280, height: 800 },
      { name: '390', width: 390, height: 844 }
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/live-room/practice');
      await page.waitForLoadState('domcontentloaded');

      const enterBtn = page.locator('button:has-text("Enter Practice Classroom"), button:has-text("Join Classroom Now")');
      await expect(enterBtn).toBeVisible({ timeout: 10000 });
      await enterBtn.click();

      // Ensure room header is visible
      await expect(page.locator('header').first()).toBeVisible({ timeout: 10000 });
      await expect(page.locator('h1', { hasText: 'Practice Room (Device Check)' })).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);

      const localPath = `screenshots/phase5/liveroom_before_${vp.name}.png`;
      const brainPath = path.join(artifactDir, `liveroom_before_${vp.name}.png`);

      await page.screenshot({ path: localPath, fullPage: false });
      if (fs.existsSync(localPath)) {
        fs.copyFileSync(localPath, brainPath);
      }
      console.log(`Saved screenshot for ${vp.name}px to ${localPath}`);
    }
  });
});
