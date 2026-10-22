import { test, expect } from '@playwright/test';

const userFixture = {
  id: 'e2e-user-1',
  name: 'Alex Rivera',
  email: 'alex@mindroot.dev',
  role: 'student',
  tokenBalance: 120,
  trustScore: 4.9
};

const sessionFixture = {
  id: 'session-upi-test',
  title: 'Advanced Machine Learning',
  scheduledAt: new Date(Date.now() + 86400000).toISOString(),
  duration: 60,
  status: 'confirmed',
  paymentStatus: 'unpaid',
  pricePerStudent: 499,
  teacherId: 'peer-richard',
  studentId: 'e2e-user-1',
  teacher: {
    id: 'peer-richard',
    name: 'Prof. Richard Feynman',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
    upiId: 'feynman@upi',
    hourlyRate: 499
  }
};

test.describe('UPI Modal Viewport and Sticky Footer', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem('mindroot_current_user', JSON.stringify(user));
      localStorage.setItem('mindroot_auth_token', 'dev-token-' + user.id);
      localStorage.setItem('mindroot_current_role', 'student');
    }, userFixture);

    await page.route('**/api/config', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ demoMode: false }) });
    });

    await page.route('**/api/peers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([sessionFixture.teacher])
      });
    });

    await page.route('**/api/sessions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([sessionFixture])
      });
    });

    await page.route('**/api/users/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sessionFixture.teacher)
      });
    });

    await page.route('**/api/payment/mentor-upi/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          isConfigured: true,
          upiId: 'feynman@upi',
          accountHolderName: 'Prof. Richard Feynman',
          isIdVerified: true
        })
      });
    });
  });

  test('Confirm button is inside viewport after entering UTR at 1366x768', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/schedule');

    const payButton = page.locator('button', { hasText: /Pay .* to Mentor via UPI/i });
    await expect(payButton).toBeVisible({ timeout: 10000 });
    await payButton.click();

    // Modal opens
    const utrInput = page.locator('input[placeholder*="489218201948"]');
    await expect(utrInput).toBeVisible();

    // Type 12-digit UTR
    await utrInput.fill('123456789012');

    const confirmBtn = page.locator('button', { hasText: /I Have Transferred/i });
    await expect(confirmBtn).toBeVisible();
    await expect(confirmBtn).toBeEnabled();

    // Verify it is inside the 768px viewport
    const box = await confirmBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(768);
  });

  test('Confirm button is inside viewport after entering UTR at 390px mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/schedule');

    const payButton = page.locator('button', { hasText: /Pay .* to Mentor via UPI/i });
    await expect(payButton).toBeVisible({ timeout: 10000 });
    await payButton.click();

    // Modal opens
    const utrInput = page.locator('input[placeholder*="489218201948"]');
    await expect(utrInput).toBeVisible();

    // Type 12-digit UTR
    await utrInput.fill('987654321098');

    const confirmBtn = page.locator('button', { hasText: /I Have Transferred/i });
    await expect(confirmBtn).toBeVisible();
    await expect(confirmBtn).toBeEnabled();

    // Verify it is inside the 390x844 viewport
    const box = await confirmBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390 + 5); // allowing slight subpixel margin
  });
});
