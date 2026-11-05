import { test, expect } from '@playwright/test';

test.describe('Audit After Screenshots', () => {
  test('Capture after screenshots of all main pages with professional redesign', async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1440, height: 900 });

    // Clear any previous state
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 1. Login Page
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/after/01_login.png' });

    // 2. Sign in as Demo Student
    await page.click('button:has-text("Demo Student (Alex)")');
    await page.click('button[type="submit"]:has-text("Sign In to Mindroot")');

    // 3. Dashboard
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'screenshots/after/02_dashboard.png' });

    // 4. Match Finder
    await page.goto('/match-finder');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'screenshots/after/03_match_finder.png' });

    // 5. Marketplace
    await page.goto('/marketplace');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'screenshots/after/04_marketplace.png' });

    // 6. Schedule
    await page.goto('/schedule');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'screenshots/after/05_schedule.png' });

    // 7. Notes Journal
    await page.goto('/notes');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'screenshots/after/06_notes.png' });

    // 8. Messages
    await page.goto('/messages');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'screenshots/after/07_messages.png' });

    // 9. Wallet
    await page.goto('/wallet');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'screenshots/after/08_wallet.png' });

    // 10. Log out and sign in as Demo Mentor for Teacher Portal
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.click('button:has-text("Demo Mentor (Dr. Marcus)")');
    await page.click('button[type="submit"]:has-text("Sign In to Mindroot")');
    await page.waitForURL('**/teacher', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'screenshots/after/09_teacher_portal.png' });

    // 11. Log out and sign in as Demo Admin for Admin Portal
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.click('button:has-text("Demo Admin")');
    await page.click('button[type="submit"]:has-text("Sign In to Mindroot")');
    await page.waitForURL('**/admin', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'screenshots/after/10_admin_portal.png' });
  });
});
