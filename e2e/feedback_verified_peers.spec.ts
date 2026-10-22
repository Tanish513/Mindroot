import { test, expect } from '@playwright/test';

const currentUser = {
  id: 'e2e-fb-student',
  name: 'Kavya Nair',
  email: 'kavya@mindroot.dev',
  role: 'student',
  tokenBalance: 40,
  trustScore: 4.9
};

const peerWithConfirmedSession = {
  id: 'peer-verified-mentor',
  name: 'Prof. Ada Lovelace',
  email: 'ada@mindroot.dev',
  role: 'teacher'
};

const peerWithoutSession = {
  id: 'peer-unrelated',
  name: 'Stranger Peer',
  email: 'stranger@mindroot.dev',
  role: 'teacher'
};

test.describe('Feedback: Verified Peers List & Submission Result', () => {
  test('Feedback lists only peers from verified sessions and displays success banner on submit', async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem('mindroot_current_user', JSON.stringify(user));
      localStorage.setItem('mindroot_auth_token', 'dev-token-' + user.id);
      localStorage.setItem('mindroot_current_role', 'student');
    }, currentUser);

    await page.route('**/api/config', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ demoMode: false }) });
    });

    await page.route('**/api/users/profile', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(currentUser) });
    });

    await page.route('**/api/users/me', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(currentUser) });
    });

    await page.route('**/api/reviews**', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'rev-new-123', rating: 5, quote: 'Amazing lecture!', createdAt: new Date().toISOString() })
        });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      }
    });

    // Provide two peers in system, but only one has a confirmed session
    await page.route('**/api/peers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([peerWithConfirmedSession, peerWithoutSession])
      });
    });

    await page.route('**/api/sessions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'sess-confirmed-1',
            status: 'confirmed',
            teacherId: peerWithConfirmedSession.id,
            teacher: peerWithConfirmedSession,
            studentId: currentUser.id,
            student: currentUser,
            scheduledAt: new Date().toISOString()
          }
        ])
      });
    });

    await page.goto('/feedback');

    // 1. Peer dropdown must contain Prof. Ada Lovelace, but NOT Stranger Peer
    const peerSelect = page.getByTestId('feedback-peer-select');
    await expect(peerSelect).toBeVisible();
    await expect(peerSelect.locator('option', { hasText: 'Prof. Ada Lovelace' })).toHaveCount(1);
    await expect(peerSelect.locator('option', { hasText: 'Stranger Peer' })).toHaveCount(0);

    // 2. Select 5 stars
    const stars = page.locator('span.material-symbols-outlined', { hasText: 'star' });
    await stars.nth(4).click();

    // 3. Submit feedback
    const submitBtn = page.getByTestId('submit-feedback-btn');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 4. Visible success result banner MUST appear
    const successBanner = page.getByTestId('feedback-success-banner');
    await expect(successBanner).toBeVisible();
    await expect(successBanner).toHaveText(/Feedback submitted successfully/i);
  });

  test('Feedback displays visible error banner when submission fails', async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem('mindroot_current_user', JSON.stringify(user));
      localStorage.setItem('mindroot_auth_token', 'dev-token-' + user.id);
      localStorage.setItem('mindroot_current_role', 'student');
    }, currentUser);

    await page.route('**/api/config', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ demoMode: false }) });
    });

    await page.route('**/api/users/profile', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(currentUser) });
    });

    await page.route('**/api/users/me', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(currentUser) });
    });

    await page.route('**/api/reviews**', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Database transaction failed: server busy' })
        });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      }
    });

    await page.route('**/api/peers', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([peerWithConfirmedSession]) });
    });

    await page.route('**/api/sessions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'sess-confirmed-1',
            status: 'confirmed',
            teacherId: peerWithConfirmedSession.id,
            teacher: peerWithConfirmedSession,
            studentId: currentUser.id,
            student: currentUser,
            scheduledAt: new Date().toISOString()
          }
        ])
      });
    });

    await page.goto('/feedback');

    // Select 4 stars
    const stars = page.locator('span.material-symbols-outlined', { hasText: 'star' });
    await stars.nth(3).click();

    // Submit feedback
    const submitBtn = page.getByTestId('submit-feedback-btn');
    await submitBtn.click();

    // Visible error banner MUST appear
    const errorBanner = page.getByTestId('feedback-error-banner');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toHaveText(/Database transaction failed/i);
  });
});
