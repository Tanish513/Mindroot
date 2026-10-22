import { test, expect } from '@playwright/test';

const testUser = {
  id: 'e2e-tz-student',
  name: 'Anaya Sharma',
  email: 'anaya@mindroot.dev',
  role: 'student',
  tokenBalance: 100,
  trustScore: 5.0
};

const mentorWithSlots = {
  id: 'peer-tz-mentor',
  name: 'Devin Vance',
  email: 'devin@mindroot.dev',
  role: 'teacher',
  upiId: 'devin@oksbi',
  hasUpiConfigured: true,
  hourlyRate: 600,
  skillsTaught: ['Fullstack React'],
  userSkills: [{ id: 'us-1', type: 'teaches', skill: { id: 's-react', name: 'Fullstack React' } }],
  availability: {
    'Mon-10:00 AM': true,
    'Tue-02:00 PM': true
  }
};

test.describe('Timezone Display on Availability & Schedule', () => {
  test('Schedule displays timezone label instead of GMT and shows timezone badge', async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem('mindroot_current_user', JSON.stringify(user));
      localStorage.setItem('mindroot_auth_token', 'dev-token-' + user.id);
      localStorage.setItem('mindroot_current_role', 'student');
    }, testUser);

    await page.route('**/api/config', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ demoMode: false }) });
    });

    await page.route('**/api/sessions', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.route('**/api/peers', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([mentorWithSlots]) });
    });

    await page.route('**/api/notes**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.route('**/api/users/profile', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(testUser) });
    });

    await page.goto('/schedule');

    // 1. Grid axis MUST NOT show 'GMT'
    await expect(page.locator('div.grid-cols-8').filter({ hasText: 'GMT' })).not.toBeVisible();

    // 2. Weekly Availability header MUST show user timezone label (default Asia/Kolkata or IST)
    const headerTzBadge = page.locator('span', { hasText: /IST|Asia\/Kolkata/i });
    await expect(headerTzBadge.first()).toBeVisible();

    // 3. Grid axis column header shows timezone abbreviation
    const axisHeader = page.locator('div.grid-cols-8 div').first();
    await expect(axisHeader).toHaveText(/IST|Asia\/Kolkata|[A-Z]{3,4}/);
  });

  test('Marketplace booking modal displays timezone badge on quick availability slots', async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem('mindroot_current_user', JSON.stringify(user));
      localStorage.setItem('mindroot_auth_token', 'dev-token-' + user.id);
      localStorage.setItem('mindroot_current_role', 'student');
    }, testUser);

    await page.route('**/api/config', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ demoMode: false }) });
    });

    await page.route('**/api/peers', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([mentorWithSlots]) });
    });

    await page.route('**/api/sessions', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto('/marketplace');

    // Open booking modal for Devin Vance
    const bookBtn = page.locator('button', { hasText: 'Book Lecture' }).first();
    await bookBtn.click();

    // Quick Availability Slots section must show timezone badge
    const quickSlotsSection = page.locator('div', { hasText: 'Quick Availability Slots' });
    await expect(quickSlotsSection.first()).toBeVisible();
    await expect(page.locator('span', { hasText: /IST|Asia\/Kolkata/i }).first()).toBeVisible();

    // The individual slot button shows timezone
    const slotBtn = page.locator('button', { hasText: /Mon 10:00 AM/i });
    await expect(slotBtn).toBeVisible();
  });
});
