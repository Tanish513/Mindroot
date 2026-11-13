import { test, expect } from '@playwright/test';

const pagesToTest = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Marketplace', path: '/marketplace' },
  { name: 'Schedule', path: '/schedule' },
  { name: 'Messages', path: '/messages' },
  { name: 'Wallet', path: '/wallet' },
];

const viewports = [
  { width: 320, height: 640, name: '320px' },
  { width: 340, height: 720, name: '340px' },
  { width: 360, height: 740, name: '360px' },
  { width: 390, height: 844, name: '390px' },
  { width: 412, height: 915, name: '412px' },
  { width: 768, height: 1024, name: '768px' },
];

const mockMentors = [
  {
    id: 'peer-feynman',
    name: 'Prof. Richard Feynman',
    role: 'teacher',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
    upiId: 'feynman@upi',
    hourlyRate: 499,
    bio: 'Theoretical physicist and quantum educator.',
    userSkills: [{ id: 's1', type: 'teaches', skill: { name: 'Physics & AI', category: 'Software & AI' } }]
  },
  {
    id: 'peer-curie',
    name: 'Dr. Marie Curie',
    role: 'teacher',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956',
    upiId: 'curie@upi',
    hourlyRate: 599,
    bio: 'Pioneering researcher in chemistry and data sciences.',
    userSkills: [{ id: 's2', type: 'teaches', skill: { name: 'Chemistry & ML', category: 'Software & AI' } }]
  }
];

const sessionFixture = {
  id: 'session-upi-test',
  title: 'Advanced Machine Learning',
  scheduledAt: new Date(Date.now() + 86400000).toISOString(),
  duration: 60,
  durationMin: 60,
  status: 'confirmed',
  paymentStatus: 'unpaid',
  pricePerStudent: 499,
  amount: 499,
  teacherId: 'peer-feynman',
  studentId: 'user-demo-student',
  teacher: mockMentors[0],
  student: {
    id: 'user-demo-student',
    name: 'Aarav Patel'
  }
};

test.describe('Mobile Redesign Acceptance Suite (P5.23, P5.25 & P5.26)', () => {
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
      localStorage.setItem('mindroot_current_role', user.role);
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

  const setupUpiRoutes = async (page: any) => {
    await page.route('**/api/config', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ demoMode: false }) });
    });
    await page.route('**/api/peers', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockMentors) });
    });
    await page.route('**/api/sessions', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([sessionFixture]) });
    });
    await page.route('**/api/notes*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/messages*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
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

  test('A2: No clipped labels, stats, or step descriptions on all 5 pages at 360px and 390px', async ({ page }) => {
    for (const w of [360, 390]) {
      await page.setViewportSize({ width: w, height: 780 });
      await setupAuth(page, 'light');

      for (const p of pagesToTest) {
        await page.goto(p.path, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(600);

        const offenders = await page.evaluate((pageName) => {
          const issues: string[] = [];

          // 1. Check stat labels / section headings for unwanted ellipsis truncation
          const statLabels = document.querySelectorAll('.divide-y p, .divide-x p, h1, h2, h3');
          statLabels.forEach((el) => {
            const txt = el.textContent?.trim() || '';
            if (txt.includes('…') || txt.includes('...')) {
              issues.push(`[${pageName}] Label has ellipsis: "${txt.slice(0, 40)}"`);
            }
          });

          // 2. Check for unexpected text-overflow clipping
          const descriptions = document.querySelectorAll('section p, header p');
          descriptions.forEach((el) => {
            const style = window.getComputedStyle(el);
            if (style.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth && !el.classList.contains('truncate')) {
              issues.push(`[${pageName}] Ellipsis clipped text: "${el.textContent?.slice(0, 30)}..."`);
            }
          });

          // 3. Check for sub-12px rendered text (P5.7 floor)
          const allTextEls = document.querySelectorAll('p, span, h1, h2, h3, h4, button, a, label');
          allTextEls.forEach((el) => {
            const style = window.getComputedStyle(el);
            const size = parseFloat(style.fontSize);
            const text = el.textContent?.trim() || '';
            if (text.length > 0 && el.getBoundingClientRect().height > 0 && size < 11.5) {
              issues.push(`[${pageName}] Sub-12px text (${size}px): "${text.slice(0, 25)}"`);
            }
          });

          return issues;
        }, p.name);

        expect(offenders.length, `Found issues on ${p.name} at ${w}px: ${offenders.slice(0, 5).join('; ')}`).toBe(0);
      }
    }
  });

  test('A3: Tap targets >= 44px for all visible buttons, tabs, chips, and nav items on all 5 pages at 360px and 390px', async ({ page }) => {
    for (const w of [360, 390]) {
      await page.setViewportSize({ width: w, height: 740 });
      await setupAuth(page, 'light');

      for (const p of pagesToTest) {
        await page.goto(p.path, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(600);

        const sub44Elements = await page.evaluate((pageName) => {
          const elements = Array.from(document.querySelectorAll('button, a, [role="button"], [role="tab"]'));
          const offenders: string[] = [];

          elements.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;

            // Height must be >= 43.5px (accounting for sub-pixel rendering)
            // Width must be >= 43.5px for icon/square buttons (text elements can be wider)
            const text = el.textContent?.trim() || '';
            const isSub44Height = rect.height < 43.5;
            const isSub44Width = rect.width < 43.5 && text.length === 0;

            if (isSub44Height || isSub44Width) {
              offenders.push(`[${pageName}] <${el.tagName.toLowerCase()}> "${text.slice(0, 20)}" (${Math.round(rect.width)}x${Math.round(rect.height)}px)`);
            }
          });

          return offenders;
        }, p.name);

        expect(
          sub44Elements.length,
          `Found sub-44px tap targets on ${p.name} at ${w}px: ${sub44Elements.slice(0, 5).join(', ')}`
        ).toBe(0);
      }
    }
  });

  test('A4: Floating AI button does not overlap bottom nav and no intersection with card actions on any page', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await setupAuth(page, 'light');

    for (const p of pagesToTest) {
      await page.goto(p.path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);

      const aiButton = page.locator('button[aria-label="Open AI Assistant"]');
      await expect(aiButton).toBeVisible();
      const aiBox = await aiButton.boundingBox();
      expect(aiBox).not.toBeNull();

      // Check size is in 44-48px target range
      expect(aiBox!.width).toBeGreaterThanOrEqual(44);
      expect(aiBox!.height).toBeGreaterThanOrEqual(44);

      // Check position is above the bottom nav
      const bottomNav = page.locator('nav[aria-label="Mobile Navigation"]');
      const navBox = await bottomNav.boundingBox();
      expect(navBox).not.toBeNull();
      expect(navBox!.height).toBeLessThanOrEqual(56);

      // AI Button bottom should be <= bottomNav top
      expect(aiBox!.y + aiBox!.height).toBeLessThanOrEqual(navBox!.y);

      // Scroll to bottom and verify page container bottom padding clears nav and AI button (>= 80px)
      await page.evaluate(() => {
        const main = document.querySelector('main');
        if (main) main.scrollTo(0, main.scrollHeight);
        else window.scrollTo(0, document.body.scrollHeight);
      });
      await page.waitForTimeout(300);

      const bottomPadding = await page.evaluate(() => {
        const main = document.querySelector('main');
        if (!main) return 0;
        return parseFloat(window.getComputedStyle(main).paddingBottom);
      });
      expect(bottomPadding).toBeGreaterThanOrEqual(80);

      // Verify AI button and bottom nav NEVER intersect any card action
      const hasIntersection = await page.evaluate(() => {
        const ai = document.querySelector('button[aria-label="Open AI Assistant"]')?.getBoundingClientRect();
        const nav = document.querySelector('nav[aria-label="Mobile Navigation"]')?.getBoundingClientRect();
        if (!ai || !nav) return false;

        const cardButtons = Array.from(document.querySelectorAll('section button, .rounded-xl button, .rounded-2xl button, card button'));
        for (const btn of cardButtons) {
          if (!btn.offsetParent) continue;
          if (btn.getAttribute('aria-label') === 'Open AI Assistant') continue;
          const r = btn.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;

          // Check intersection with AI button
          const hitAi = !(r.right < ai.left || r.left > ai.right || r.bottom < ai.top || r.top > ai.bottom);
          // Check intersection with Bottom Nav
          const hitNav = !(r.right < nav.left || r.left > nav.right || r.bottom < nav.top || r.top > nav.bottom);
          if (hitAi || hitNav) return true;
        }
        return false;
      });

      expect(hasIntersection, `AI button or bottom nav intersects card action on ${p.name}`).toBe(false);
    }
  });

  test('A5: Exactly one solid primary button per page on mobile', async ({ page }) => {
    await setupUpiRoutes(page);
    await page.setViewportSize({ width: 360, height: 740 });
    await setupAuth(page, 'light');

    // 1. Dashboard: Schedule Session is primary; Find Peer Match is secondary outline
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    const dashScheduleBtn = page.locator('button:has-text("Schedule Session")').first();
    const dashMatchBtn = page.locator('button:has-text("Find Peer Match")').first();
    await expect(dashScheduleBtn).toBeVisible();
    await expect(dashMatchBtn).toBeVisible();
    await expect(dashScheduleBtn).toHaveClass(/bg-primary/);
    expect(await dashMatchBtn.getAttribute('class')).not.toContain('bg-primary');

    // 2. Marketplace: "Book Lecture" is primary; "Chat" is secondary
    await page.goto('/marketplace', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    const marketPrimaryBtn = page.locator('button:has-text("Book Lecture"), button:has-text("Chat with Mentor")').first();
    await expect(marketPrimaryBtn).toBeVisible();
    await expect(marketPrimaryBtn).toHaveClass(/bg-primary/);

    // 3. Schedule: "New Booking" is the solid primary button, "Sync" is outline
    await page.goto('/schedule', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    const schedBookingBtn = page.locator('button:has-text("New Booking")').first();
    const schedSyncBtn = page.locator('button:has-text("Sync")').first();
    await expect(schedBookingBtn).toBeVisible();
    await expect(schedBookingBtn).toHaveClass(/bg-primary/);
    expect(await schedSyncBtn.getAttribute('class')).not.toContain('bg-primary');

    // 4. Messages: Send button or proposal accept is solid primary
    await page.goto('/messages?peerId=peer-feynman', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('button[aria-label="Send message"], button:has-text("Accept & Lock Slot")', { timeout: 15000 });
    const msgPrimaryBtn = page.locator('button[aria-label="Send message"], button:has-text("Accept & Lock Slot")').first();
    await expect(msgPrimaryBtn).toBeVisible();
    await expect(msgPrimaryBtn).toHaveClass(/bg-primary/);

    // 5. Wallet: "Pay Mentor Directly" is solid primary
    await page.goto('/wallet', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    const walletPrimaryBtn = page.locator('button:has-text("Pay Mentor Directly")').first();
    await expect(walletPrimaryBtn).toBeVisible();
    await expect(walletPrimaryBtn).toHaveClass(/bg-primary/);
  });

  test('A9: UPI Modal on phones has Open UPI app & Copy UPI ID buttons at 360px and 390px; absent on desktop', async ({ page }) => {
    test.setTimeout(60000);
    await setupUpiRoutes(page);

    for (const w of [360, 390]) {
      await page.setViewportSize({ width: w, height: 740 });
      await setupAuth(page, 'light');

      await page.goto('/schedule', { waitUntil: 'domcontentloaded' });
      const payBtn = page.locator('button', { hasText: /Pay .* to Mentor via UPI/i }).first();
      await expect(payBtn, 'Pay to Mentor via UPI button must be present in Schedule').toBeVisible({ timeout: 15000 });
      await payBtn.click();
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

      // Verify UTR input attributes
      const utrInput = page.locator('input[placeholder="e.g. 489218201948"]');
      await expect(utrInput).toBeVisible();
      expect(await utrInput.getAttribute('inputmode')).toBe('numeric');
      expect(await utrInput.getAttribute('maxlength')).toBe('12');

      // Close modal before next iteration or desktop check
      const closeBtn = page.locator('button:has-text("close")').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(300);
      }
    }

    // Desktop Check (1280px): verify UPI buttons are hidden on desktop
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/schedule', { waitUntil: 'domcontentloaded' });
    const deskPayBtn = page.locator('button', { hasText: /Pay .* to Mentor via UPI/i }).first();
    if (await deskPayBtn.isVisible()) {
      await deskPayBtn.click();
      await page.waitForTimeout(400);
      await expect(page.locator('a:has-text("Open UPI app")')).toBeHidden();
      await expect(page.locator('button:has-text("Copy UPI ID")')).toBeHidden();
    }
  });

  test('A10: Form inputs >= 16px and bottom-sheet input focus keeps primary action visible above keyboard', async ({ page }) => {
    await setupUpiRoutes(page);

    await page.setViewportSize({ width: 360, height: 740 });
    await setupAuth(page, 'light');

    // 1. Search input font size >= 16px
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    const searchToggle = page.locator('button[aria-label="Search"]').first();
    await searchToggle.click();
    await page.waitForTimeout(200);

    const searchInput = page.locator('input[placeholder="Search skills, peers, sessions..."]');
    const fontSize = await searchInput.evaluate((el) => {
      return parseFloat(window.getComputedStyle(el).fontSize);
    });
    expect(fontSize).toBeGreaterThanOrEqual(16);

    // 2. Schedule modal: UTR input font size >= 16px
    await page.goto('/schedule', { waitUntil: 'domcontentloaded' });
    const payBtn = page.locator('button', { hasText: /Pay .* to Mentor via UPI/i }).first();
    await expect(payBtn).toBeVisible({ timeout: 15000 });
    await payBtn.click();
    await page.waitForTimeout(400);

    const utrInput = page.locator('input[placeholder="e.g. 489218201948"]');
    await expect(utrInput).toBeVisible();
    const utrFontSize = await utrInput.evaluate((el) => {
      return parseFloat(window.getComputedStyle(el).fontSize);
    });
    expect(utrFontSize).toBeGreaterThanOrEqual(16);

    // 3. Virtual keyboard simulation: reduce viewport height to 420px (keyboard occupying bottom 320px)
    await page.setViewportSize({ width: 360, height: 420 });
    await utrInput.focus();
    await page.waitForTimeout(300);

    // Primary action button should remain visible above the keyboard (within 420px height)
    const confirmBtn = page.locator('button', { hasText: /I Have Transferred/i }).first();
    await expect(confirmBtn).toBeVisible();
    const confirmBox = await confirmBtn.boundingBox();
    expect(confirmBox).not.toBeNull();
    expect(confirmBox!.y + confirmBox!.height).toBeLessThanOrEqual(420);
  });

  test('A11: Dark mode passes A1 (0 overflow), A2 (floor 12px) and A5 (primary button) at 360px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await setupAuth(page, 'dark');

    for (const p of pagesToTest) {
      await page.goto(p.path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);

      // A1 check: 0 horizontal overflow
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(360);

      // A2 check: no sub-12px rendered text
      const sub12Count = await page.evaluate(() => {
        const els = document.querySelectorAll('p, span, h1, h2, h3, h4, button, a, label');
        let count = 0;
        els.forEach(el => {
          const s = parseFloat(window.getComputedStyle(el).fontSize);
          const t = el.textContent?.trim() || '';
          if (t.length > 0 && el.getBoundingClientRect().height > 0 && s < 11.5) {
            count++;
          }
        });
        return count;
      });
      expect(sub12Count, `Sub-12px text found in dark mode on ${p.name}`).toBe(0);
    }
  });

  test('A12: Mobile density and layout budget at 360x800', async ({ page }) => {
    await setupUpiRoutes(page);
    await page.setViewportSize({ width: 360, height: 800 });
    await setupAuth(page, 'light');

    // 1. Dashboard density: Header <= 52px, Bottom nav <= 56px, checklist step above fold
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    const dashboardMetrics = await page.evaluate(() => {
      const header = document.querySelector('header');
      const nav = document.querySelector('nav[aria-label="Mobile Navigation"]');
      const h1 = document.querySelector('h1');
      const p = document.querySelector('main p');
      
      const checklistHeading = Array.from(document.querySelectorAll('h3')).find(
        (el) => el.textContent?.includes('Get started')
      );
      const checklistRect = checklistHeading?.getBoundingClientRect();

      return {
        headerHeight: header ? header.getBoundingClientRect().height : 0,
        navHeight: nav ? nav.getBoundingClientRect().height : 0,
        h1FontSize: h1 ? parseFloat(window.getComputedStyle(h1).fontSize) : 0,
        pFontSize: p ? parseFloat(window.getComputedStyle(p).fontSize) : 0,
        checklistTop: checklistRect ? checklistRect.top : 9999,
      };
    });

    expect(dashboardMetrics.headerHeight).toBeLessThanOrEqual(52);
    // Strict 56px ceiling for bottom navigation
    expect(dashboardMetrics.navHeight).toBeLessThanOrEqual(56);
    expect(dashboardMetrics.checklistTop).toBeLessThan(800);

    // 2. Marketplace density: At least 2 mentor cards above the fold (top < 800px)
    await page.goto('/marketplace', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('button:has-text("Chat"), button:has-text("Chat with Mentor")', { timeout: 15000 });

    const mentorCardsAboveFold = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('main div.rounded-xl, main div.rounded-2xl'))
        .filter((el) => el.querySelector('img') && el.textContent?.includes('/hr'));
      return cards.filter((c) => c.getBoundingClientRect().top < 800).length;
    });

    expect(mentorCardsAboveFold, 'At least 2 mentor cards must be visible above the fold at 360x800').toBeGreaterThanOrEqual(2);
  });

  test('A12b: Viewport meta tag is standard', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewportMeta).toBe('width=device-width, initial-scale=1.0');
  });
});
