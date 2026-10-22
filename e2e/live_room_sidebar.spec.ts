import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const userFixture = {
  id: 'e2e-user-1',
  name: 'Alex Rivera',
  email: 'alex@mindroot.dev',
  role: 'student',
  tokenBalance: 120,
  trustScore: 4.9
};

test.describe('Live Room & Sidebar Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem('mindroot_current_user', JSON.stringify(user));
      localStorage.setItem('mindroot_auth_token', 'dev-token-' + user.id);
      localStorage.setItem('mindroot_current_role', 'student');
    }, userFixture);
  });

  test('Empty state: opening /live-room with nothing booked shows empty state and buttons navigate', async ({ page }) => {
    // Mock empty sessions
    await page.route('**/api/sessions', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/config', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ demoMode: true }) });
    });
    await page.route('**/api/peers', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
        { id: 'peer-top', name: 'Dr. Jane Smith', trustScore: 4.98, rating: 5, bio: 'Machine Learning Expert' }
      ]) });
    });

    await page.goto('/live-room');

    // Verify empty state title and description
    await expect(page.locator('h1', { hasText: 'No lecture scheduled' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=You don\'t have an active or upcoming peer lecture right now')).toBeVisible();

    // Verify buttons are present
    const findMatchBtn = page.locator('button:has-text("Find a Match")');
    const scheduleBtn = page.locator('button:has-text("Schedule Session")');
    await expect(findMatchBtn).toBeVisible();
    await expect(scheduleBtn).toBeVisible();

    // Verify navigation on "Find a Match"
    await findMatchBtn.click();
    await expect(page).toHaveURL(/.*match-finder/);

    // Navigate back to /live-room and test "Schedule Session"
    await page.goto('/live-room');
    await expect(page.locator('h1', { hasText: 'No lecture scheduled' })).toBeVisible();
    await page.locator('button:has-text("Schedule Session")').click();
    await expect(page).toHaveURL(/.*schedule/);
  });

  test('Sidebar: tooltips are present on navigation items', async ({ page }) => {
    await page.goto('/dashboard');
    const sidebar = page.locator('aside').first();
    await expect(sidebar).toBeVisible();

    // Verify tooltip attributes and aria-labels exist on navigation links
    const liveRoomLink = sidebar.locator('a[href="/live-room"]');
    await expect(liveRoomLink).toBeVisible();
    await expect(liveRoomLink).toHaveAttribute('aria-label', 'Live Room');

    const scheduleLink = sidebar.locator('a[href="/schedule"]');
    await expect(scheduleLink).toHaveAttribute('aria-label', 'Schedule');

    const dashboardLink = sidebar.locator('a[href="/dashboard"]');
    await expect(dashboardLink).toHaveAttribute('aria-label', 'Dashboard');

    // Verify tooltip elements exist inside links
    const tooltip = liveRoomLink.locator('[role="tooltip"]');
    await expect(tooltip).toContainText('Live Room');
  });

  test('Sidebar: pulsing dot appears when a session is joinable', async ({ page }) => {
    const now = Date.now();
    // Confirmed session starting in 5 minutes (inside the 10-minute join window)
    const joinableSession = {
      id: 'session-joinable-e2e',
      studentId: userFixture.id,
      teacherId: 'teacher-2',
      teacher: { id: 'teacher-2', name: 'Prof. Miller' },
      status: 'confirmed',
      title: 'Operating Systems & Concurrency',
      scheduledAt: new Date(now + 5 * 60 * 1000).toISOString(),
      durationMin: 60
    };

    await page.route('**/api/sessions', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([joinableSession]) });
    });
    await page.route('**/api/config', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ demoMode: true }) });
    });

    await page.goto('/dashboard');
    const sidebar = page.locator('aside').first();
    await expect(sidebar).toBeVisible();

    const liveRoomLink = sidebar.locator('a[href="/live-room"]');
    await expect(liveRoomLink).toBeVisible();

    // Expect the pulsing emerald dot container and ping animation
    const pulsingDot = liveRoomLink.locator('.animate-ping');
    await expect(pulsingDot).toBeVisible({ timeout: 8000 });
  });

  test('Capture before/after screenshots of the sidebar in light and dark mode', async ({ page }) => {
    const artifactDir = path.join(process.cwd(), 'test-results');
    if (!fs.existsSync(artifactDir)) {
      fs.mkdirSync(artifactDir, { recursive: true });
    }

    await page.goto('/dashboard');
    const sidebar = page.locator('aside').first();
    await expect(sidebar).toBeVisible();
    await page.waitForTimeout(1000);

    // Light mode screenshot
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
    });
    await page.waitForTimeout(500);
    await sidebar.screenshot({ path: path.join(artifactDir, 'sidebar-light.png') });

    // Dark mode screenshot
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
    });
    await page.waitForTimeout(500);
    await sidebar.screenshot({ path: path.join(artifactDir, 'sidebar-dark.png') });
  });
});
