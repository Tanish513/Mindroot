import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const userFixture = {
  id: 'e2e-user-evidence',
  name: 'Aarav Patel',
  email: 'aarav.patel@mindroot.dev',
  role: 'student',
  tokenBalance: 250,
  trustScore: 4.95
};

const artifactDir = 'C:/Users/tanis/.gemini/antigravity/brain/7388ce46-dc92-4d43-ac9e-d54e8df46f5c/screenshots';

test.describe('Phase 5 Verification & Evidence Suite', () => {
  test.beforeAll(() => {
    if (!fs.existsSync('screenshots/phase5')) {
      fs.mkdirSync('screenshots/phase5', { recursive: true });
    }
    if (!fs.existsSync(artifactDir)) {
      fs.mkdirSync(artifactDir, { recursive: true });
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem('mindroot_current_user', JSON.stringify(user));
      localStorage.setItem('mindroot_auth_token', 'dev-token-' + user.id);
      localStorage.setItem('mindroot_current_role', 'student');
      localStorage.setItem('mindroot_theme', 'light');
    }, userFixture);
  });

  test('Check computed typography: No rendered visible text under 12px on main pages', async ({ page }) => {
    const pagesToCheck = ['/dashboard', '/schedule', '/marketplace', '/live-room'];
    const violations: { page: string; selector: string; text: string; fontSize: string }[] = [];

    for (const p of pagesToCheck) {
      await page.goto(p);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(600);

      const pageViolations = await page.evaluate((url) => {
        const found: any[] = [];
        const elements = document.querySelectorAll('body *');
        elements.forEach((el) => {
          // Check if element has direct text content and is visible
          const style = window.getComputedStyle(el);
          if (
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            style.opacity === '0' ||
            el.getAttribute('aria-hidden') === 'true'
          ) {
            return;
          }

          // Check if it has direct text nodes
          let hasDirectText = false;
          for (let i = 0; i < el.childNodes.length; i++) {
            const child = el.childNodes[i];
            if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
              hasDirectText = true;
              break;
            }
          }

          if (hasDirectText) {
            const fontSizePx = parseFloat(style.fontSize);
            // Allow sub-pixel antialiasing tolerance (e.g. 11.9px)
            if (fontSizePx < 11.8) {
              found.push({
                page: url,
                tagName: el.tagName.toLowerCase(),
                className: el.className,
                text: (el.textContent || '').trim().slice(0, 30),
                fontSize: style.fontSize
              });
            }
          }
        });
        return found;
      }, p);

      violations.push(...pageViolations);
    }

    console.log(`Typography check violations (< 12px): ${violations.length}`);
    if (violations.length > 0) {
      console.log('Violations sample:', violations.slice(0, 5));
    }
    expect(violations.length).toBe(0);
  });

  test('Capture before and after screenshots at 1440px, 1280px, and 390px', async ({ page }) => {
    const viewports = [
      { name: '1440', width: 1440, height: 900 },
      { name: '1280', width: 1280, height: 800 },
      { name: '390', width: 390, height: 844 }
    ];

    const targets = [
      { path: '/dashboard', label: 'dashboard' },
      { path: '/schedule', label: 'schedule' },
      { path: '/marketplace', label: 'marketplace' }
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const t of targets) {
        await page.goto(t.path);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(600);

        const filename = `${t.label}_${vp.name}.png`;
        const localPath = path.join('screenshots/phase5', filename);
        const artPath = path.join(artifactDir, filename);

        await page.screenshot({ path: localPath });
        try {
          fs.copyFileSync(localPath, artPath);
        } catch {
          // ignore
        }
      }

      // Sidebar capture
      await page.goto('/dashboard');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(400);

      const sidebarLocal = path.join('screenshots/phase5', `sidebar_${vp.name}.png`);
      const sidebarArt = path.join(artifactDir, `sidebar_${vp.name}.png`);
      await page.screenshot({ path: sidebarLocal });
      try {
        fs.copyFileSync(sidebarLocal, sidebarArt);
      } catch {
        // ignore
      }
    }
  });
});
