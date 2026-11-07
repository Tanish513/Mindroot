import { test } from '@playwright/test';

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

const widths = [360, 390, 768, 1280];

test('Capture AFTER screenshots for Mobile and Desktop', async ({ page }) => {
  for (const width of widths) {
    const height = width >= 768 ? 800 : 780;
    await page.setViewportSize({ width, height });

    await page.addInitScript((user) => {
      localStorage.clear();
      localStorage.setItem('mindroot_current_user', JSON.stringify(user));
      localStorage.setItem('mindroot_auth_token', 'dev-token-' + user.id);
      localStorage.setItem('mindroot_current_role', 'student');
      localStorage.setItem('mindroot_theme', 'light');
    }, baseUser);

    // Dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(600);
    await page.screenshot({ path: `screenshots/mobile_fix/after_dashboard_${width}.png`, fullPage: false });

    // Marketplace
    await page.goto('/marketplace');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(600);
    await page.screenshot({ path: `screenshots/mobile_fix/after_marketplace_${width}.png`, fullPage: false });
  }

  // Also capture mobile search opened on 360px
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/dashboard');
  await page.waitForTimeout(400);
  const searchBtn = page.locator('button[aria-label="Search"]');
  if (await searchBtn.isVisible()) {
    await searchBtn.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `screenshots/mobile_fix/after_search_expanded_360.png`, fullPage: false });
  }

  // Also capture mobile drawer with theme toggle
  await page.goto('/dashboard');
  await page.waitForTimeout(400);
  const menuBtn = page.locator('button[aria-label="Open navigation menu"]');
  if (await menuBtn.isVisible()) {
    await menuBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `screenshots/mobile_fix/after_mobile_drawer_360.png`, fullPage: false });
  }
});
