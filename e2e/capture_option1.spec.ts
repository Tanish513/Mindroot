import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const ARTIFACTS_DIR = 'C:\\Users\\tanis\\.gemini\\antigravity\\brain\\7388ce46-dc92-4d43-ac9e-d54e8df46f5c\\screenshots';

function saveAndMirror(localPath: string, fileName: string) {
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }
  const target = path.join(ARTIFACTS_DIR, fileName);
  fs.copyFileSync(localPath, target);
}

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

test('Capture Sidebar and Marketplace Option 1', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript((user) => {
    localStorage.clear();
    localStorage.setItem('mindroot_current_user', JSON.stringify(user));
    localStorage.setItem('mindroot_auth_token', 'dev-token-' + user.id);
    localStorage.setItem('mindroot_current_role', 'student');
    localStorage.setItem('mindroot_theme', 'light');
  }, baseUser);

  await page.goto('/marketplace');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(600);

  // Open "More" in sidebar
  const moreBtn = page.locator('button:has-text("More")').first();
  if (await moreBtn.isVisible()) {
    await moreBtn.click();
    await page.waitForTimeout(400);
  }

  // Screenshot of Sidebar with More expanded
  const sidebarPath = 'screenshots/phase5/sidebar_option1_more_expanded.png';
  await page.screenshot({ path: sidebarPath, fullPage: false });
  saveAndMirror(sidebarPath, 'sidebar_option1_more_expanded.png');

  // Click on "Skill Swaps" tab
  const swapsTabBtn = page.locator('button:has-text("Skill Swaps")');
  await swapsTabBtn.click();
  await page.waitForTimeout(600);

  // Screenshot of unified Find Peers on Skill Swaps tab
  const marketplaceSwapsPath = 'screenshots/phase5/marketplace_swaps_tab.png';
  await page.screenshot({ path: marketplaceSwapsPath, fullPage: false });
  saveAndMirror(marketplaceSwapsPath, 'marketplace_swaps_tab.png');
});
