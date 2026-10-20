import { test, expect } from '@playwright/test';

const userFixture = {
  id: 'e2e-user-theme',
  name: 'Taylor Green',
  email: 'taylor@mindroot.dev',
  role: 'student',
  tokenBalance: 150,
  trustScore: 4.95
};

test.describe('Midnight + Electric Mint Theme Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem('mindroot_current_user', JSON.stringify(user));
      localStorage.setItem('mindroot_auth_token', 'dev-token-' + user.id);
      localStorage.setItem('mindroot_current_role', 'student');
    }, userFixture);
  });

  test('Theme initialization, toggle, persistence and design tokens verification', async ({ page }) => {
    // 1. Visit dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Verify data-theme attribute is present on <html>
    const initialTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(['light', 'dark']).toContain(initialTheme);

    // 2. Click the sun/moon theme toggle button in TopBar
    const toggleButton = page.locator('button[aria-label="Toggle theme mode"]');
    await expect(toggleButton).toBeVisible();

    // Set theme to dark via localStorage to test explicit dark mode tokens
    await page.evaluate(() => {
      localStorage.setItem('mindroot_theme', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify dark theme is applied
    const darkThemeAttr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(darkThemeAttr).toBe('dark');

    // Verify CSS design tokens in dark mode
    const darkTokens = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return {
        bg: s.getPropertyValue('--bg').trim().toUpperCase(),
        surface: s.getPropertyValue('--surface').trim().toUpperCase(),
        surface2: s.getPropertyValue('--surface-2').trim().toUpperCase(),
        border: s.getPropertyValue('--border').trim().toUpperCase(),
        text: s.getPropertyValue('--text').trim().toUpperCase(),
        primary: s.getPropertyValue('--primary').trim().toUpperCase(),
        sidebarBg: s.getPropertyValue('--sidebar-bg').trim().toUpperCase(),
        sidebarActiveBg: s.getPropertyValue('--sidebar-active-bg').trim().toUpperCase(),
        accent: s.getPropertyValue('--accent').trim().toUpperCase(),
        warning: s.getPropertyValue('--warning').trim().toUpperCase(),
        danger: s.getPropertyValue('--danger').trim().toUpperCase(),
      };
    });

    expect(darkTokens.bg).toBe('#0A1612');
    expect(darkTokens.surface).toBe('#11201B');
    expect(darkTokens.surface2).toBe('#142A26');
    expect(darkTokens.border).toBe('#233A33');
    expect(darkTokens.text).toBe('#E8F1EE');
    expect(darkTokens.primary).toBe('#2BC48A');
    expect(darkTokens.sidebarBg).toBe('#142A26');
    expect(darkTokens.sidebarActiveBg).toBe('RGBA(43, 196, 138, 0.14)');
    expect(darkTokens.accent).toBe('#FBBF24');
    expect(darkTokens.warning).toBe('#FBBF24');
    expect(darkTokens.danger).toBe('#F87171');

    // 3. Click the toggle to switch to light mode
    await toggleButton.click();

    // Verify light theme is applied
    const lightThemeAttr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(lightThemeAttr).toBe('light');

    // Verify CSS design tokens in light mode
    const lightTokens = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return {
        bg: s.getPropertyValue('--bg').trim().toUpperCase(),
        surface: s.getPropertyValue('--surface').trim().toUpperCase(),
        surface2: s.getPropertyValue('--surface-2').trim().toUpperCase(),
        border: s.getPropertyValue('--border').trim().toUpperCase(),
        text: s.getPropertyValue('--text').trim().toUpperCase(),
        primary: s.getPropertyValue('--primary').trim().toUpperCase(),
        sidebarBg: s.getPropertyValue('--sidebar-bg').trim().toUpperCase(),
        sidebarActiveBg: s.getPropertyValue('--sidebar-active-bg').trim().toUpperCase(),
        accent: s.getPropertyValue('--accent').trim().toUpperCase(),
        warning: s.getPropertyValue('--warning').trim().toUpperCase(),
        danger: s.getPropertyValue('--danger').trim().toUpperCase(),
      };
    });

    expect(lightTokens.bg).toBe('#F7FAF9');
    expect(lightTokens.surface).toBe('#FFFFFF');
    expect(lightTokens.surface2).toBe('#E3EEEA');
    expect(lightTokens.border).toBe('#E1E8E5');
    expect(lightTokens.text).toBe('#0F1A17');
    expect(lightTokens.primary).toBe('#0A7C5A');
    expect(lightTokens.sidebarBg).toBe('#E3EEEA');
    expect(lightTokens.sidebarActiveBg).toBe('#E3F4EC');
    expect(lightTokens.accent).toBe('#F59E0B');
    expect(lightTokens.warning).toBe('#F59E0B');
    expect(lightTokens.danger).toBe('#DC2626');

    // Verify persistence in localStorage
    const savedTheme = await page.evaluate(() => localStorage.getItem('mindroot_theme'));
    expect(savedTheme).toBe('light');

    // Verify smooth transition property on body
    const transition = await page.evaluate(() => {
      return getComputedStyle(document.body).transitionProperty;
    });
    expect(transition).toContain('background-color');
  });
});
