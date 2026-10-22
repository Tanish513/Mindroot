import { test, expect } from '@playwright/test';

const userFixture = {
  id: 'e2e-user-layout-1',
  name: 'Alex Rivera',
  email: 'alex@mindroot.dev',
  role: 'student',
  tokenBalance: 120,
  trustScore: 4.9
};

test.describe('Live Room Layout, Overflow & Viewport Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem('mindroot_current_user', JSON.stringify(user));
      localStorage.setItem('mindroot_auth_token', 'dev-token-' + user.id);
      localStorage.setItem('mindroot_current_role', 'student');
    }, userFixture);

    // Mock API endpoints for a clean practice / live room environment
    await page.route('**/api/config', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ demoMode: true })
      });
    });

    await page.route('**/api/sessions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    await page.route('**/api/notes*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'note-sample-1',
            sessionId: 'practice',
            authorId: 'e2e-user-layout-1',
            title: 'Calculus Fundamental Theorem Key Steps',
            content: 'Remember to apply substitution rule before evaluating boundaries.',
            visibility: 'shared',
            createdAt: new Date().toISOString()
          },
          {
            id: 'note-sample-2',
            sessionId: 'practice',
            authorId: 'other-user',
            title: 'Personal Checklist',
            content: 'Clarify step 3 with mentor next lecture.',
            visibility: 'private',
            createdAt: new Date().toISOString()
          }
        ])
      });
    });
  });

  test('1366x768 desktop: control bar in viewport, no sidebar horizontal clipping, segmented control and whiteboard confirmation', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/live-room/practice');

    // Lobby step
    const enterBtn = page.locator('button:has-text("Enter Practice Classroom")');
    await expect(enterBtn).toBeVisible({ timeout: 10000 });
    await enterBtn.click();

    // Verify main room container loaded
    const roomHeader = page.locator('header').first();
    await expect(roomHeader).toBeVisible({ timeout: 10000 });
    await expect(page.locator('h1', { hasText: 'Practice Room (Device Check)' })).toBeVisible();

    // 1. Bottom Control Bar Visibility & Viewport placement at 1366x768
    const controlBar = page.locator('footer');
    await expect(controlBar).toBeVisible();
    const footerBox = await controlBar.boundingBox();
    expect(footerBox).not.toBeNull();
    if (footerBox) {
      expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(768);
      expect(footerBox.y).toBeGreaterThanOrEqual(0);
    }

    // 2. View switcher segmented control check
    const segmentedSwitcher = page.locator('[aria-label="Room view mode"]');
    await expect(segmentedSwitcher).toBeVisible();
    await expect(segmentedSwitcher.locator('button:has-text("Studio")')).toBeVisible();
    await expect(segmentedSwitcher.locator('button:has-text("Gallery")')).toBeVisible();
    await expect(segmentedSwitcher.locator('button:has-text("Fullscreen")')).toBeVisible();

    // 3. Top bar clean layout: bare "ICE: DIRECT P2P" is NOT shown directly in top bar
    const topBarText = await roomHeader.innerText();
    expect(topBarText).not.toContain('ICE:');

    // 4. Right Sidebar (Chat & Quick Notes) width and no horizontal clipping
    const sidebar = page.locator('aside[aria-label="Live room sidebar"]');
    await expect(sidebar).toBeVisible();
    const sidebarBox = await sidebar.boundingBox();
    expect(sidebarBox).not.toBeNull();

    // Switch to Quick Notes tab
    const notesTab = sidebar.locator('button[role="tab"]:has-text("Quick Notes")');
    await expect(notesTab).toBeVisible();
    await notesTab.click();

    // Quick Inline Note card check
    await expect(sidebar.locator('text=Quick Inline Note')).toBeVisible();
    await expect(sidebar.locator('button:has-text("Full Editor")')).toBeVisible();

    // Notes panel container has no horizontal clipping
    const notesPanel = sidebar.locator('.overflow-y-auto').first();
    const hasHorizontalClip = await notesPanel.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(hasHorizontalClip).toBe(false);

    // Refresh icon button is visible and inside sidebar bounds
    const refreshBtn = sidebar.locator('button[aria-label="Refresh session notes"]');
    await expect(refreshBtn).toBeVisible();
    const refreshBox = await refreshBtn.boundingBox();
    expect(refreshBox).not.toBeNull();
    if (refreshBox && sidebarBox) {
      expect(refreshBox.x + refreshBox.width).toBeLessThanOrEqual(sidebarBox.x + sidebarBox.width + 5);
    }

    // Note badges high contrast and visible
    await expect(sidebar.locator('text=Shared').first()).toBeVisible();
    await expect(sidebar.locator('text=Private').first()).toBeVisible();

    // 5. Whiteboard toolbar grouping, color swatches & clear confirmation
    const whiteboardToolbar = page.locator('[role="toolbar"][aria-label="Whiteboard toolbar"]');
    await expect(whiteboardToolbar).toBeVisible();

    // Color swatch visible with border
    const colorSwatches = whiteboardToolbar.locator('button[aria-label^="Select color"]');
    expect(await colorSwatches.count()).toBeGreaterThanOrEqual(5);

    // Stroke size dots
    const sizeButtons = whiteboardToolbar.locator('button[aria-label^="Stroke width"]');
    expect(await sizeButtons.count()).toBe(4);

    // Clear button confirmation flow
    const clearBtn = whiteboardToolbar.locator('button:has-text("Clear")');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();
    await expect(whiteboardToolbar.locator('text=Clear all?')).toBeVisible();
    const cancelBtn = whiteboardToolbar.locator('button:has-text("Cancel")');
    await cancelBtn.click();
    await expect(whiteboardToolbar.locator('text=Clear all?')).not.toBeVisible();
  });

  test('1920x1080 Full HD: control bar in viewport, studio layout balanced with whiteboard expanded', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/live-room/practice');

    const enterBtn = page.locator('button:has-text("Enter Practice Classroom")');
    await expect(enterBtn).toBeVisible({ timeout: 10000 });
    await enterBtn.click();

    // Verify main room container loaded
    const roomHeader = page.locator('header').first();
    await expect(roomHeader).toBeVisible({ timeout: 10000 });

    // Assert bottom control bar is visible and within 1080 viewport
    const controlBar = page.locator('footer');
    await expect(controlBar).toBeVisible();
    const footerBox = await controlBar.boundingBox();
    expect(footerBox).not.toBeNull();
    if (footerBox) {
      expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(1080);
      expect(footerBox.y).toBeGreaterThanOrEqual(0);
    }

    // Assert whiteboard canvas has generous height in 1080p
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    if (canvasBox) {
      expect(canvasBox.height).toBeGreaterThan(450);
    }

    // Right sidebar is visible and within bounds
    const sidebar = page.locator('aside[aria-label="Live room sidebar"]');
    await expect(sidebar).toBeVisible();
  });

  test('390px mobile width: control bar in viewport, no horizontal document overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/live-room/practice');

    // Enter classroom
    const enterBtn = page.locator('button:has-text("Enter Practice Classroom")');
    await expect(enterBtn).toBeVisible({ timeout: 10000 });
    await enterBtn.click();

    // Verify room loaded
    const controlBar = page.locator('footer');
    await expect(controlBar).toBeVisible({ timeout: 10000 });

    // Assert control bar is within viewport
    const footerBox = await controlBar.boundingBox();
    expect(footerBox).not.toBeNull();
    if (footerBox) {
      expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(844);
      expect(footerBox.y).toBeGreaterThanOrEqual(0);
    }

    // Assert no horizontal document scroll / clipping
    const documentScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentScrollWidth).toBeLessThanOrEqual(390);
  });

  test('Readability & accessibility: icon-only buttons have aria-labels and labels >= 12px', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/live-room/practice');

    const enterBtn = page.locator('button:has-text("Enter Practice Classroom")');
    await expect(enterBtn).toBeVisible({ timeout: 10000 });
    await enterBtn.click();

    // Verify control bar aria labels
    const micBtn = page.locator('footer button[aria-label*="microphone"]').first();
    await expect(micBtn).toBeVisible();
    const camBtn = page.locator('footer button[aria-label*="camera"]').first();
    await expect(camBtn).toBeVisible();
    const leaveBtn = page.locator('footer button[aria-label="Leave call"]');
    await expect(leaveBtn).toBeVisible();

    // Verify room text size is >= 12px
    const roomInfo = page.locator('p:has-text("Room:")');
    await expect(roomInfo).toBeVisible();
    const fontSize = await roomInfo.evaluate((el) => window.getComputedStyle(el).fontSize);
    expect(parseFloat(fontSize)).toBeGreaterThanOrEqual(12);
  });
});
