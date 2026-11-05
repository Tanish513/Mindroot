import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const ARTIFACTS_DIR = 'C:\\Users\\tanis\\.gemini\\antigravity\\brain\\7388ce46-dc92-4d43-ac9e-d54e8df46f5c\\screenshots';

function saveAndMirror(localPath: string, fileName: string) {
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }
  const target = path.join(ARTIFACTS_DIR, fileName);
  fs.copyFileSync(localPath, target);
}

const viewports = [
  { name: '1440', width: 1440, height: 900 },
  { name: '1280', width: 1280, height: 800 },
  { name: '390', width: 390, height: 844 }
];

const baseUser = {
  id: 'u-student-1',
  name: 'Alex Rivera',
  email: 'alex.rivera@mindroot.dev',
  role: 'student',
  skillsTaught: [],
  skillsLearned: ['React'],
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
  tokenBalance: 450,
  karmaScore: 120,
  streakDays: 4,
  streakFreezeActive: false,
  rating: 4.8
};

test.describe('Capture Live Room and Lecture Completed Popup After P5.11-P5.17', () => {
  test('Capture Live Room Practice Stage (After)', async ({ page }) => {
    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.addInitScript((user) => {
        localStorage.clear();
        localStorage.setItem('mindroot_current_user', JSON.stringify(user));
        localStorage.setItem('mindroot_auth_token', 'dev-token-' + user.id);
        localStorage.setItem('mindroot_current_role', 'student');
        localStorage.setItem('mindroot_theme', 'light');
      }, baseUser);

      await page.route('**/api/config', async (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ demoMode: true }) }));
      await page.route('**/api/sessions', async (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.route('**/api/notes*', async (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

      await page.goto('/live-room/practice');
      await page.waitForLoadState('domcontentloaded');

      const enterBtn = page.locator('button:has-text("Enter Practice Classroom"), button:has-text("Join Classroom Now")');
      await expect(enterBtn).toBeVisible({ timeout: 15000 });
      await enterBtn.click();

      await page.waitForSelector('footer', { timeout: 10000 });
      await page.waitForTimeout(1000);

      // Verify leave is NOT in header
      const headerLeave = page.locator('header button:has-text("Leave")');
      expect(await headerLeave.count()).toBe(0);

      // Save screenshot
      const file = `liveroom_after_p511_${vp.name}.png`;
      const localPath = `screenshots/phase5/${file}`;
      await page.screenshot({ path: localPath, fullPage: false });
      saveAndMirror(localPath, file);
      console.log(`Saved ${file}`);
    }
  });

  test('Capture Lecture Completed Popup (After)', async ({ page }) => {
    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.addInitScript((user) => {
        localStorage.clear();
        localStorage.setItem('mindroot_current_user', JSON.stringify(user));
        localStorage.setItem('mindroot_auth_token', 'dev-token-' + user.id);
        localStorage.setItem('mindroot_current_role', 'student');
        localStorage.setItem('mindroot_theme', 'light');
      }, baseUser);

      await page.route('**/api/config', async (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ demoMode: true }) }));
      await page.route('**/api/sessions', async (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.route('**/api/notes*', async (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

      await page.goto('/live-room/practice');
      await page.waitForLoadState('domcontentloaded');

      const enterBtn = page.locator('button:has-text("Enter Practice Classroom"), button:has-text("Join Classroom Now")');
      await expect(enterBtn).toBeVisible({ timeout: 15000 });
      await enterBtn.click();

      await page.waitForSelector('footer', { timeout: 10000 });
      await page.waitForTimeout(600);

      // Click Leave in footer to open modal
      const leaveBtn = page.locator('button[aria-label="Leave call"], button[aria-label="Leave lecture call"]').first();
      await leaveBtn.click();

      // Wait for ended modal
      await page.waitForSelector('text=Session ended', { timeout: 5000 });
      await page.waitForTimeout(600);

      const file = `lecture_completed_after_p517_${vp.name}.png`;
      const localPath = `screenshots/phase5/${file}`;
      await page.screenshot({ path: localPath, fullPage: false });
      saveAndMirror(localPath, file);
      console.log(`Saved ${file}`);
    }
  });
});
