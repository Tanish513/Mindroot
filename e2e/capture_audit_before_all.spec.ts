import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const baseUser = {
  id: 'e2e-user-audit',
  name: 'Aarav Patel',
  email: 'aarav.patel@mindroot.dev',
  role: 'student',
  tokenBalance: 250,
  trustScore: 4.95,
  skillsTaught: [],
  skillsLearned: []
};

const artifactDir = 'C:/Users/tanis/.gemini/antigravity/brain/7388ce46-dc92-4d43-ac9e-d54e8df46f5c/screenshots';

function saveAndMirror(localPath: string, brainFileName: string) {
  const brainPath = path.join(artifactDir, brainFileName);
  if (fs.existsSync(localPath)) {
    fs.copyFileSync(localPath, brainPath);
  }
}

test.describe('Audit Before Screenshots Suite', () => {
  test.beforeAll(() => {
    if (!fs.existsSync('screenshots/phase5')) {
      fs.mkdirSync('screenshots/phase5', { recursive: true });
    }
    if (!fs.existsSync(artifactDir)) {
      fs.mkdirSync(artifactDir, { recursive: true });
    }
  });

  const viewports = [
    { name: '1440', width: 1440, height: 900 },
    { name: '1280', width: 1280, height: 800 },
    { name: '390', width: 390, height: 844 }
  ];

  // 1. Dashboard: New user with onboarding checklist
  test('Capture Dashboard (New User with Onboarding)', async ({ page }) => {
    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.addInitScript((user) => {
        localStorage.clear();
        localStorage.setItem('mindroot_current_user', JSON.stringify({ ...user, skillsTaught: [], skillsLearned: [] }));
        localStorage.setItem('mindroot_auth_token', 'dev-token-' + user.id);
        localStorage.setItem('mindroot_current_role', 'student');
        localStorage.setItem('mindroot_theme', 'light');
      }, baseUser);

      await page.route('**/api/sessions', async (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.route('**/api/users', async (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
        { id: 'u1', name: 'Dr. Priya Sharma', role: 'teacher', skillsTaught: ['Calculus', 'Linear Algebra'] },
        { id: 'u2', name: 'Maya Sharma', role: 'student', skillsTaught: ['React', 'TypeScript'] },
        { id: 'u3', name: 'Tanishq S.', role: 'student', skillsTaught: ['Python', 'Data Science'] }
      ]) }));

      await page.goto('/dashboard');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(600);

      const file = `dashboard_onboarding_${vp.name}.png`;
      const localPath = `screenshots/phase5/${file}`;
      await page.screenshot({ path: localPath, fullPage: false });
      saveAndMirror(localPath, file);
      console.log(`Saved ${file}`);
    }
  });

  // 2. Dashboard: User with scheduled sessions
  test('Capture Dashboard (User with Sessions)', async ({ page }) => {
    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.addInitScript((user) => {
        localStorage.clear();
        localStorage.setItem('mindroot_current_user', JSON.stringify({ ...user, skillsTaught: ['Python'], skillsLearned: ['React'] }));
        localStorage.setItem('mindroot_auth_token', 'dev-token-' + user.id);
        localStorage.setItem('mindroot_current_role', 'student');
        localStorage.setItem('mindroot_theme', 'light');
      }, baseUser);

      await page.route('**/api/sessions', async (r) => r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'sess-active-1',
            title: 'Fullstack React Architecture Masterclass',
            scheduledAt: new Date(Date.now() + 3600000).toISOString(),
            status: 'confirmed',
            duration: 60,
            pricePerStudent: 499,
            teacher: { id: 'u1', name: 'Dr. Priya Sharma', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&q=80' }
          },
          {
            id: 'sess-active-2',
            title: 'Applied Machine Learning & Statistical Inference',
            scheduledAt: new Date(Date.now() + 86400000).toISOString(),
            status: 'confirmed',
            duration: 90,
            pricePerStudent: 399,
            teacher: { id: 'u3', name: 'Tanishq S.', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80' }
          }
        ])
      }));
      await page.route('**/api/users', async (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
        { id: 'u1', name: 'Dr. Priya Sharma', role: 'teacher', skillsTaught: ['Calculus', 'Linear Algebra'] },
        { id: 'u2', name: 'Maya Sharma', role: 'student', skillsTaught: ['React', 'TypeScript'] }
      ]) }));

      await page.goto('/dashboard');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(600);

      const file = `dashboard_with_sessions_${vp.name}.png`;
      const localPath = `screenshots/phase5/${file}`;
      await page.screenshot({ path: localPath, fullPage: false });
      saveAndMirror(localPath, file);
      console.log(`Saved ${file}`);
    }
  });

  // 3. Dashboard: User who completed onboarding
  test('Capture Dashboard (User Completed Onboarding)', async ({ page }) => {
    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.addInitScript((user) => {
        localStorage.clear();
        localStorage.setItem('mindroot_current_user', JSON.stringify({ ...user, skillsTaught: ['Python'], skillsLearned: ['React'] }));
        localStorage.setItem('mindroot_auth_token', 'dev-token-' + user.id);
        localStorage.setItem('mindroot_current_role', 'student');
        localStorage.setItem('mindroot_theme', 'light');
        localStorage.setItem('mindroot_onboarding_matched', 'true');
      }, baseUser);

      await page.route('**/api/sessions', async (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
        { id: 'sess-past', title: 'Calculus Session', scheduledAt: new Date(Date.now() - 86400000).toISOString(), status: 'completed' }
      ]) }));
      await page.route('**/api/users', async (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
        { id: 'u1', name: 'Dr. Priya Sharma', role: 'teacher', skillsTaught: ['Calculus', 'Linear Algebra'] },
        { id: 'u2', name: 'Maya Sharma', role: 'student', skillsTaught: ['React', 'TypeScript'] }
      ]) }));

      await page.goto('/dashboard');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(600);

      const file = `dashboard_onboarding_done_${vp.name}.png`;
      const localPath = `screenshots/phase5/${file}`;
      await page.screenshot({ path: localPath, fullPage: false });
      saveAndMirror(localPath, file);
      console.log(`Saved ${file}`);
    }
  });

  // 4. Practice Live Room
  test('Capture Practice Live Room', async ({ page }) => {
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
      await page.waitForTimeout(800);

      const file = `liveroom_practice_${vp.name}.png`;
      const localPath = `screenshots/phase5/${file}`;
      await page.screenshot({ path: localPath, fullPage: false });
      saveAndMirror(localPath, file);
      console.log(`Saved ${file}`);
    }
  });

  // 5. Lecture Completed Popup
  test('Capture Lecture Completed Popup', async ({ page }) => {
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

      // Click Leave to trigger showEndedModal
      const leaveBtn = page.locator('button[aria-label="Leave call"], button[aria-label="Leave lecture call"]').first();
      await leaveBtn.click();

      // Wait for ended modal
      await page.waitForSelector('text=Lecture Completed!', { timeout: 5000 });
      await page.waitForTimeout(600);

      const file = `lecture_completed_popup_${vp.name}.png`;
      const localPath = `screenshots/phase5/${file}`;
      await page.screenshot({ path: localPath, fullPage: false });
      saveAndMirror(localPath, file);
      console.log(`Saved ${file}`);
    }
  });
});
