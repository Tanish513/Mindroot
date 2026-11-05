import { test, expect } from '@playwright/test';

const testUser = {
  id: 'e2e-schedule-student',
  name: 'Aarav Patel',
  email: 'aarav@mindroot.dev',
  role: 'student',
  tokenBalance: 100,
  trustScore: 5.0,
};

const mentorUser = {
  id: 'peer-mentor-1',
  name: 'Priya Sharma',
  email: 'priya@mindroot.dev',
  role: 'teacher',
  upiId: 'priya@okhdfc',
  hasUpiConfigured: true,
  hourlyRate: 500,
  skillsTaught: ['System Design'],
  userSkills: [{ id: 'us-sd-1', type: 'teaches', skill: { id: 's-sd', name: 'System Design' } }],
  availability: {
    'Mon-10:00 AM': true,
    'Wed-03:00 PM': true,
  },
};

const sampleSession = {
  id: 'sess-view-test-1',
  title: 'System Design 1:1',
  scheduledAt: new Date().toISOString(),
  durationMin: 60,
  status: 'confirmed',
  teacherId: mentorUser.id,
  teacher: mentorUser,
  studentId: testUser.id,
  student: testUser,
};

test.describe('Schedule Header Views: Day, Week, Month', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem('mindroot_current_user', JSON.stringify(user));
      localStorage.setItem('mindroot_auth_token', 'dev-token-' + user.id);
      localStorage.setItem('mindroot_current_role', 'student');
    }, testUser);

    await page.route('**/api/config', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ demoMode: false }) });
    });

    await page.route('**/api/sessions', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([sampleSession]) });
    });

    await page.route('**/api/peers', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([mentorUser]) });
    });

    await page.route('**/api/notes**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.route('**/api/users/profile', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(testUser) });
    });
  });

  test('Schedule view dropdown switches between Week, Day, and Month views correctly', async ({ page }) => {
    await page.goto('/schedule');

    // 1. Initial default state is Week view
    const dropdown = page.locator('[data-testid="calendar-view-dropdown"]');
    await expect(dropdown).toBeVisible();
    await expect(dropdown).toHaveText(/week/i);
    await expect(page.locator('[data-testid="calendar-grid-week"]')).toBeVisible();

    // 2. Select Day view
    await dropdown.click();
    const dayOption = page.locator('[data-testid="calendar-view-option-day"]');
    await expect(dayOption).toBeVisible();
    await dayOption.click();

    // Check dropdown shows "Day" and grid shows single day column
    await expect(dropdown).toHaveText(/day/i);
    await expect(page.locator('[data-testid="calendar-grid-day"]')).toBeVisible();
    await expect(page.locator('[data-testid="calendar-grid-week"]')).not.toBeVisible();

    // Check header date range label shows single date (includes current date)
    const dateLabel = page.locator('[data-testid="calendar-date-range-label"]');
    const today = new Date();
    await expect(dateLabel).toContainText(String(today.getDate()));

    // 3. Select Month view
    await dropdown.click();
    const monthOption = page.locator('[data-testid="calendar-view-option-month"]');
    await expect(monthOption).toBeVisible();
    await monthOption.click();

    // Check dropdown shows "Month" and month grid appears
    await expect(dropdown).toHaveText(/month/i);
    await expect(page.locator('[data-testid="calendar-grid-month"]')).toBeVisible();
    await expect(page.locator('[data-testid="calendar-grid-day"]')).not.toBeVisible();

    // Month label should include current month and 4-digit year
    await expect(dateLabel).toHaveText(/[A-Z][a-z]+ \d{4}/);

    // 4. Clicking a day in Month view opens that day in Day view without opening the booking modal
    const dayCells = page.locator('[data-testid="month-day-cell"]');
    await expect(dayCells.first()).toBeVisible();
    await dayCells.nth(15).click();

    // Should switch to Day view
    await expect(dropdown).toHaveText(/day/i);
    await expect(page.locator('[data-testid="calendar-grid-day"]')).toBeVisible();

    // Must NOT have opened booking form modal
    const bookingHeading = page.locator('h3:has-text("Book Session"), h3:has-text("Schedule Session")');
    await expect(bookingHeading).not.toBeVisible();

    // 5. Clicking Today button resets to today
    const nextBtn = page.locator('[data-testid="calendar-next-button"]');
    await nextBtn.click();
    await nextBtn.click();

    const todayBtn = page.locator('[data-testid="calendar-today-button"]');
    await todayBtn.click();
    await expect(dateLabel).toContainText(String(today.getDate()));
  });

  test('Schedule page has no horizontal overflow at 390px mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/schedule');

    // Wait for content to render
    await expect(page.locator('h1', { hasText: 'Schedule & Bookings' })).toBeVisible();

    // Verify document width does not exceed viewport width
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(390);

    // Switch to Day view on mobile and verify no document overflow
    const dropdown = page.locator('[data-testid="calendar-view-dropdown"]');
    await dropdown.click();
    await page.locator('[data-testid="calendar-view-option-day"]').click();
    await expect(page.locator('[data-testid="calendar-grid-day"]')).toBeVisible();

    const scrollWidthDay = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidthDay).toBeLessThanOrEqual(390);

    // Switch to Month view on mobile and verify no document overflow
    await dropdown.click();
    await page.locator('[data-testid="calendar-view-option-month"]').click();
    await expect(page.locator('[data-testid="calendar-grid-month"]')).toBeVisible();

    const scrollWidthMonth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidthMonth).toBeLessThanOrEqual(390);
  });
});
