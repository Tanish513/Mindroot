import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

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

test('Capture BEFORE screenshots for Mobile and Desktop', async ({ page }) => {
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
    await page.screenshot({ path: `screenshots/mobile_fix/before_dashboard_${width}.png`, fullPage: false });

    // Marketplace
    await page.goto('/marketplace');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(600);
    await page.screenshot({ path: `screenshots/mobile_fix/before_marketplace_${width}.png`, fullPage: false });
  }
});
