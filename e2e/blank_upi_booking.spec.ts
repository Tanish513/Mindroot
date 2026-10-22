import { test, expect } from '@playwright/test';

const studentUser = {
  id: 'e2e-student',
  name: 'Maya Learner',
  email: 'maya@mindroot.dev',
  role: 'student',
  tokenBalance: 50,
  trustScore: 4.8
};

const blankUpiTeacher = {
  id: 'peer-blank-upi',
  name: 'Prof. Blank UPI',
  email: 'blank@mindroot.dev',
  role: 'teacher',
  upiId: null,
  hasUpiConfigured: false,
  hourlyRate: 500,
  skillsTaught: ['Quantum Computing'],
  userSkills: [{ id: 'us-1', type: 'teaches', skill: { id: 's-qc', name: 'Quantum Computing' } }]
};

test.describe('Blank-UPI Teachers and MENTOR_PAYOUT_NOT_CONFIGURED Mapping', () => {
  test('Marketplace disables booking for blank-UPI mentor with Payments Not Set Up indicator', async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem('mindroot_current_user', JSON.stringify(user));
      localStorage.setItem('mindroot_auth_token', 'dev-token-' + user.id);
      localStorage.setItem('mindroot_current_role', 'student');
    }, studentUser);

    await page.route('**/api/config', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ demoMode: false }) });
    });

    await page.route('**/api/peers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([blankUpiTeacher])
      });
    });

    await page.route('**/api/sessions', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto('/marketplace');

    const disabledBtn = page.locator('button', { hasText: 'Payments Not Set Up' });
    await expect(disabledBtn).toBeVisible({ timeout: 10000 });
    await expect(disabledBtn).toBeDisabled();
  });

  test('Schedule maps MENTOR_PAYOUT_NOT_CONFIGURED to clear student message and avoids sign-in error', async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem('mindroot_current_user', JSON.stringify(user));
      localStorage.setItem('mindroot_auth_token', 'dev-token-' + user.id);
      localStorage.setItem('mindroot_current_role', 'student');
    }, studentUser);

    await page.route('**/api/config', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ demoMode: false }) });
    });

    await page.route('**/api/peers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([blankUpiTeacher])
      });
    });

    await page.route('**/api/sessions', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'MENTOR_PAYOUT_NOT_CONFIGURED',
            error: 'Cannot book a paid session: mentor has not configured their UPI payout address (VPA). Please book with tokens or configure payout VPA.'
          })
        });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      }
    });

    await page.goto('/schedule');

    // Click book session button
    const bookModalBtn = page.locator('button', { hasText: /Schedule Session/i });
    await expect(bookModalBtn).toBeVisible({ timeout: 10000 });
    await bookModalBtn.click();

    // Select blank UPI teacher
    const peerSelect = page.locator('select').first();
    await peerSelect.selectOption(blankUpiTeacher.id);

    // Verify option label has Payments Not Set Up
    await expect(page.locator(`option[value="${blankUpiTeacher.id}"]`)).toContainText('Payments Not Set Up');

    // Verify clear warning banner is displayed
    await expect(page.locator('text=This mentor has not set up payments yet')).toBeVisible();

    // Verify booking button is disabled
    const bookSubmitBtn = page.locator('button', { hasText: /Book for/i });
    await expect(bookSubmitBtn).toBeDisabled();
  });

  test('Teacher Portal displays clear Payments Not Set Up state when teacher has no UPI ID', async ({ page }) => {
    await page.addInitScript((teacher) => {
      localStorage.setItem('mindroot_current_user', JSON.stringify(teacher));
      localStorage.setItem('mindroot_auth_token', 'dev-token-' + teacher.id);
      localStorage.setItem('mindroot_current_role', 'teacher');
    }, blankUpiTeacher);

    await page.route('**/api/config', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ demoMode: false }) });
    });

    await page.route('**/api/sessions', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.route('**/api/wallet/transactions', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto('/teacher-portal');

    await expect(page.locator('h4', { hasText: 'Payments Not Set Up' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button', { hasText: 'Configure UPI in Profile' })).toBeVisible();
  });
});
