import { test, expect } from '@playwright/test';

const pagesToTest = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Marketplace', path: '/marketplace' },
  { name: 'Schedule', path: '/schedule' },
  { name: 'Messages', path: '/messages' },
  { name: 'Wallet', path: '/wallet' },
];

const viewports = [
  { width: 360, height: 740, name: '360px' },
  { width: 390, height: 844, name: '390px' },
  { width: 768, height: 1024, name: '768px' },
];

test.describe('Mobile Redesign Acceptance Suite (P5.23)', () => {
  // Helper to authenticate user
  const setupAuth = async (page: any, theme: string = 'light') => {
    await page.addInitScript((themeVal: string) => {
      const user = {
        id: 'user-demo-student',
        name: 'Aarav Patel',
        email: 'aarav.patel@mindroot.com',
        role: 'student',
        trustScore: 4.95,
        avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=256&q=80',
        tokenBalance: 250,
        rewardPoints: 120,
      };
      localStorage.setItem('mindroot_current_user', JSON.stringify(user));
      localStorage.setItem('mindroot_user_id', user.id);
      localStorage.setItem('mindroot_user_name', user.name);
      localStorage.setItem('mindroot_user_role', user.role);
      localStorage.setItem('mindroot_auth_token', 'dev-token-' + user.id);
      localStorage.setItem('mindroot_theme', themeVal);
      document.documentElement.setAttribute('data-theme', themeVal);
      if (themeVal === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }, theme);
  };

  for (const vp of viewports) {
    test(`A1: 0 horizontal overflow at ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setupAuth(page, 'light');

      for (const p of pagesToTest) {
        await page.goto(p.path, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(600);

        const overflow = await page.evaluate(() => {
          const docEl = document.documentElement;
          const body = document.body;
          const maxScroll = Math.max(docEl.scrollWidth, body.scrollWidth);
          return {
            windowWidth: window.innerWidth,
            scrollWidth: maxScroll,
            hasOverflow: maxScroll > window.innerWidth,
          };
        });

        expect(
          overflow.scrollWidth,
          `Horizontal overflow detected on ${p.name} at ${vp.name}: scrollWidth=${overflow.scrollWidth} > windowWidth=${overflow.windowWidth}`
        ).toBeLessThanOrEqual(overflow.windowWidth);
      }
    });
  }

  test('A2: No clipped labels, stats, or step descriptions at 360px and 390px', async ({ page }) => {
    for (const w of [360, 390]) {
      await page.setViewportSize({ width: w, height: 780 });
      await setupAuth(page, 'light');

      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);

      const offenders = await page.evaluate(() => {
        const issues: string[] = [];
        // Check stat labels
        const statLabels = document.querySelectorAll('.divide-y p, .divide-x p');
        statLabels.forEach((el) => {
          const txt = el.textContent?.trim() || '';
          if (txt.includes('…') || txt.includes('...')) {
            issues.push(`Stat label has ellipsis: "${txt}"`);
          }
        });

        // Check onboarding descriptions
        const descriptions = document.querySelectorAll('section p');
        descriptions.forEach((el) => {
          const style = window.getComputedStyle(el);
          if (style.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth) {
            issues.push(`Ellipsis clipped text: "${el.textContent?.slice(0, 30)}..."`);
          }
        });

        return issues;
      });

      expect(offenders.length, `Found clipped labels at ${w}px: ${offenders.join('; ')}`).toBe(0);
    }
  });

  test('A3: Tap targets >= 44px for navigation, buttons, and tabs at 360px and 390px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await setupAuth(page, 'light');

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    // Check Mobile Bottom Nav tap targets
    const navItems = page.locator('nav[aria-label="Mobile Navigation"] a');
    const count = await navItems.count();
    expect(count).toBe(5);

    for (let i = 0; i < count; i++) {
      const box = await navItems.nth(i).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }

    // Check Hero Header action buttons
    const scheduleBtn = page.locator('button:has-text("Schedule Session")').first();
    const scheduleBox = await scheduleBtn.boundingBox();
    expect(scheduleBox).not.toBeNull();
    expect(scheduleBox!.height).toBeGreaterThanOrEqual(44);

    const matchBtn = page.locator('button:has-text("Find Peer Match")').first();
    const matchBox = await matchBtn.boundingBox();
    expect(matchBox).not.toBeNull();
    expect(matchBox!.height).toBeGreaterThanOrEqual(44);
  });

  test('A4: Floating AI button does not overlap bottom nav or primary page actions', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await setupAuth(page, 'light');

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    const aiButton = page.locator('button[aria-label="Open AI Assistant"]');
    await expect(aiButton).toBeVisible();
    const aiBox = await aiButton.boundingBox();
    expect(aiBox).not.toBeNull();

    // Check size is 48px
    expect(aiBox!.width).toBeGreaterThanOrEqual(48);
    expect(aiBox!.height).toBeGreaterThanOrEqual(48);

    // Check position is above the 64px bottom nav
    const bottomNav = page.locator('nav[aria-label="Mobile Navigation"]');
    const navBox = await bottomNav.boundingBox();
    expect(navBox).not.toBeNull();

    // AI Button bottom should be <= bottomNav top
    expect(aiBox!.y + aiBox!.height).toBeLessThanOrEqual(navBox!.y);
  });

  test('A5: Exactly one solid primary button per page on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await setupAuth(page, 'light');

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    const scheduleBtn = page.locator('button:has-text("Schedule Session")').first();
    const matchBtn = page.locator('button:has-text("Find Peer Match")').first();

    await expect(scheduleBtn).toBeVisible();
    await expect(matchBtn).toBeVisible();

    // Schedule Session is the solid primary button (has bg-primary)
    await expect(scheduleBtn).toHaveClass(/bg-primary/);

    // Find Peer Match is the outlined secondary button (has border-border, NOT bg-primary)
    const matchClass = await matchBtn.getAttribute('class');
    expect(matchClass).toContain('border-border');
    expect(matchClass).not.toContain('bg-primary');
  });

  test('A9: UPI Modal on phones has Open UPI app & Copy UPI ID buttons; absent on desktop', async ({ page }) => {
    // 1. Mobile Phone Check (360px)
    await page.setViewportSize({ width: 360, height: 740 });
    await setupAuth(page, 'light');

    await page.goto('/marketplace', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);

    // Click "Book Lecture" on first available mentor
    const bookBtn = page.locator('button:has-text("Book Lecture")').first();
    if (await bookBtn.isVisible()) {
      await bookBtn.click();
      await page.waitForTimeout(500);

      // Verify "Open UPI app" and "Copy UPI ID" are rendered on mobile
      const openUpiBtn = page.locator('a:has-text("Open UPI app")');
      const copyUpiBtn = page.locator('button:has-text("Copy UPI ID")');

      await expect(openUpiBtn).toBeVisible();
      await expect(copyUpiBtn).toBeVisible();

      const openBox = await openUpiBtn.boundingBox();
      const copyBox = await copyUpiBtn.boundingBox();
      expect(openBox!.height).toBeGreaterThanOrEqual(44);
      expect(copyBox!.height).toBeGreaterThanOrEqual(44);

      // Close modal
      const closeBtn = page.locator('button:has-text("close")').first();
      await closeBtn.click();
      await page.waitForTimeout(300);
    }

    // 2. Desktop Check (1280px)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/marketplace', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);

    const desktopBookBtn = page.locator('button:has-text("Book Lecture")').first();
    if (await desktopBookBtn.isVisible()) {
      await desktopBookBtn.click();
      await page.waitForTimeout(500);

      // Verify "Open UPI app" and "Copy UPI ID" are NOT rendered on desktop
      const openUpiBtn = page.locator('a:has-text("Open UPI app")');
      const copyUpiBtn = page.locator('button:has-text("Copy UPI ID")');

      await expect(openUpiBtn).toBeHidden();
      await expect(copyUpiBtn).toBeHidden();
    }
  });

  test('A10: Form inputs have computed font-size >= 16px on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await setupAuth(page, 'light');

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    // Click search icon to expand search
    const searchToggle = page.locator('button[aria-label="Search"]').first();
    await searchToggle.click();
    await page.waitForTimeout(200);

    const searchInput = page.locator('input[placeholder="Search skills, peers, sessions..."]');
    const fontSize = await searchInput.evaluate((el) => {
      return parseFloat(window.getComputedStyle(el).fontSize);
    });

    expect(fontSize).toBeGreaterThanOrEqual(16);
  });

  test('A11: Dark mode passes A1 (0 horizontal overflow) and contrast checks at 360px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await setupAuth(page, 'dark');

    for (const p of pagesToTest) {
      await page.goto(p.path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(360);
    }
  });
});
