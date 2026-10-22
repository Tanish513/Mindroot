import { test, expect } from '@playwright/test';

const studentUser = {
  id: 'e2e-student-controls',
  name: 'Sam Student',
  email: 'sam@mindroot.dev',
  role: 'student',
  tokenBalance: 80,
  trustScore: 4.8
};

const sessionFixture = {
  id: 'session-controls-test',
  title: 'Advanced Operating Systems',
  scheduledAt: new Date(Date.now() - 60000).toISOString(),
  duration: 60,
  status: 'live',
  paymentStatus: 'paid',
  pricePerStudent: 399,
  teacherId: 'teacher-1',
  studentId: 'e2e-student-controls',
  teacher: {
    id: 'teacher-1',
    name: 'Dr. Turing',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb'
  }
};

test.describe('Live Room Controls & Gating', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem('mindroot_current_user', JSON.stringify(user));
      localStorage.setItem('mindroot_auth_token', 'dev-token-' + user.id);
      localStorage.setItem('mindroot_current_role', 'student');
    }, studentUser);

    await page.route('**/api/sessions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([sessionFixture])
      });
    });

    await page.route(`**/api/sessions/${sessionFixture.id}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sessionFixture)
      });
    });

    await page.route('**/api/notes*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });
  });

  test('Non-demo student cannot see dev controls or simulation tile even with ?demo=true in URL', async ({ page }) => {
    // Server config has demoMode: false
    await page.route('**/api/config', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ demoMode: false })
      });
    });

    // Visit with ?demo=true
    await page.goto(`/live/${sessionFixture.id}?demo=true`);

    // Enter classroom if in lobby
    const enterBtn = page.locator('button:has-text("Join Classroom Now"), button:has-text("Enter Practice Classroom")');
    await expect(enterBtn).toBeVisible({ timeout: 10000 });
    await enterBtn.click();

    // Verify main header loaded
    await expect(page.locator('header').first()).toBeVisible({ timeout: 10000 });

    // Developer controls must NOT be present
    const devBtn = page.locator('button[aria-label="Developer and Demo controls"]');
    await expect(devBtn).not.toBeVisible();

    // Simulation tile must NOT be present
    const simTile = page.locator('text=+ Click to Simulate 3 Students');
    await expect(simTile).not.toBeVisible();

    // Regular waiting state is shown
    await expect(page.locator('text=Students will appear here once connected')).toBeVisible();

    // Exactly ONE fullscreen control is in standard mode
    const fullscreenButtons = page.locator('button[aria-label*="Fullscreen"]');
    await expect(fullscreenButtons).toHaveCount(1);
  });

  test('Demo mode renders developer controls, simulation tile and single fullscreen toggle', async ({ page }) => {
    // Server config has demoMode: true
    await page.route('**/api/config', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ demoMode: true })
      });
    });

    await page.goto(`/live/${sessionFixture.id}`);

    const enterBtn = page.locator('button:has-text("Join Classroom Now"), button:has-text("Enter Practice Classroom")');
    await expect(enterBtn).toBeVisible({ timeout: 10000 });
    await enterBtn.click();

    await expect(page.locator('header').first()).toBeVisible({ timeout: 10000 });

    // Developer controls MUST be present
    const devBtn = page.locator('button[aria-label="Developer and Demo controls"]');
    await expect(devBtn).toBeVisible();

    // Simulation tile MUST be present
    const simTile = page.locator('text=+ Click to Simulate 3 Students');
    await expect(simTile).toBeVisible();

    // Exactly ONE fullscreen control
    const fullscreenButtons = page.locator('button[aria-label*="Fullscreen"]');
    await expect(fullscreenButtons).toHaveCount(1);
  });
});
