import { test, expect } from '@playwright/test';

const userFixture = {
  id: 'e2e-user-eraser-1',
  name: 'Taylor Swift',
  email: 'taylor@mindroot.dev',
  role: 'student',
  tokenBalance: 120,
  trustScore: 4.9
};

test.describe('Live Room Whiteboard Stroke Eraser Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem('mindroot_current_user', JSON.stringify(user));
      localStorage.setItem('mindroot_auth_token', 'dev-token-' + user.id);
      localStorage.setItem('mindroot_current_role', 'student');
    }, userFixture);

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
        body: JSON.stringify([])
      });
    });
  });

  test('Stroke Eraser tool button is visible and active on click', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/live-room/practice');

    const enterBtn = page.locator('button:has-text("Enter Practice Classroom")');
    await expect(enterBtn).toBeVisible({ timeout: 10000 });
    await enterBtn.click();

    // Verify toolbar and Stroke Eraser button presence
    const strokeEraserBtn = page.locator('button[aria-label="Stroke eraser tool"]');
    await expect(strokeEraserBtn).toBeVisible();

    // Verify Pixel Eraser tool button presence
    const pixelEraserBtn = page.locator('button[aria-label="Eraser tool"]');
    await expect(pixelEraserBtn).toBeVisible();

    // Click Stroke Eraser and verify active state
    await strokeEraserBtn.click();
    await expect(strokeEraserBtn).toHaveClass(/text-\[#10B981\]/);

    // Verify canvas cursor changes to cell
    const canvas = page.locator('canvas').first();
    await expect(canvas).toHaveClass(/cursor-cell/);
  });

  test('Drawing strokes and erasing whole stroke with Stroke Eraser', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/live-room/practice');

    const enterBtn = page.locator('button:has-text("Enter Practice Classroom")');
    await expect(enterBtn).toBeVisible({ timeout: 10000 });
    await enterBtn.click();

    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();

    // 1. Draw a pen stroke at x: 200, y: 200 -> x: 250, y: 200
    const penBtn = page.locator('button[aria-label="Pen tool"]');
    await penBtn.click();

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    await page.mouse.move(box.x + 200, box.y + 200);
    await page.mouse.down();
    await page.mouse.move(box.x + 250, box.y + 200, { steps: 5 });
    await page.mouse.up();

    // Verify stroke is rendered on canvas
    const countAfterPen = await page.evaluate(() => {
      const c = document.querySelector('canvas') as HTMLCanvasElement;
      const ctx = c.getContext('2d');
      if (!ctx) return 0;
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let nonZero = 0;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 20) nonZero++;
      }
      return nonZero;
    });
    expect(countAfterPen).toBeGreaterThan(50);

    // 2. Select Stroke Eraser
    const strokeEraserBtn = page.locator('button[aria-label="Stroke eraser tool"]');
    await strokeEraserBtn.click();

    // 3. Click directly on the stroke at x: 225, y: 200
    await page.mouse.click(box.x + 225, box.y + 200);

    // Verify the entire stroke has vanished
    const countAfterStrokeErase = await page.evaluate(() => {
      const c = document.querySelector('canvas') as HTMLCanvasElement;
      const ctx = c.getContext('2d');
      if (!ctx) return 0;
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let nonZero = 0;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 20) nonZero++;
      }
      return nonZero;
    });
    expect(countAfterStrokeErase).toBe(0);

    // 4. Test Undo restores the stroke
    const undoBtn = page.locator('button[aria-label="Undo stroke"]');
    await undoBtn.click();

    const countAfterUndo = await page.evaluate(() => {
      const c = document.querySelector('canvas') as HTMLCanvasElement;
      const ctx = c.getContext('2d');
      if (!ctx) return 0;
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let nonZero = 0;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 20) nonZero++;
      }
      return nonZero;
    });
    expect(countAfterUndo).toBeGreaterThan(50);

    // 5. Test Redo re-erases the stroke
    const redoBtn = page.locator('button[aria-label="Redo stroke"]');
    await redoBtn.click();

    const countAfterRedo = await page.evaluate(() => {
      const c = document.querySelector('canvas') as HTMLCanvasElement;
      const ctx = c.getContext('2d');
      if (!ctx) return 0;
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let nonZero = 0;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 20) nonZero++;
      }
      return nonZero;
    });
    expect(countAfterRedo).toBe(0);
  });

  test('Erasing geometric shapes and multiple strokes via drag sweep', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/live-room/practice');

    const enterBtn = page.locator('button:has-text("Enter Practice Classroom")');
    await expect(enterBtn).toBeVisible({ timeout: 10000 });
    await enterBtn.click();

    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    // Draw Stroke 1: Vertical line at x: 150
    const penBtn = page.locator('button[aria-label="Pen tool"]');
    await penBtn.click();
    await page.mouse.move(box.x + 150, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 150, box.y + 250, { steps: 5 });
    await page.mouse.up();

    // Draw Stroke 2: Vertical line at x: 250
    await page.mouse.move(box.x + 250, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 250, box.y + 250, { steps: 5 });
    await page.mouse.up();

    // Verify both strokes exist
    const countBeforeSweep = await page.evaluate(() => {
      const c = document.querySelector('canvas') as HTMLCanvasElement;
      const ctx = c.getContext('2d');
      if (!ctx) return 0;
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let nonZero = 0;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 20) nonZero++;
      }
      return nonZero;
    });
    expect(countBeforeSweep).toBeGreaterThan(150);

    // Switch to Stroke Eraser
    const strokeEraserBtn = page.locator('button[aria-label="Stroke eraser tool"]');
    await strokeEraserBtn.click();

    // Drag horizontally across both vertical lines (sweep from x: 100 to x: 300 at y: 175)
    await page.mouse.move(box.x + 100, box.y + 175);
    await page.mouse.down();
    await page.mouse.move(box.x + 300, box.y + 175, { steps: 10 });
    await page.mouse.up();

    // Both strokes should be completely erased!
    const countAfterSweep = await page.evaluate(() => {
      const c = document.querySelector('canvas') as HTMLCanvasElement;
      const ctx = c.getContext('2d');
      if (!ctx) return 0;
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let nonZero = 0;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 20) nonZero++;
      }
      return nonZero;
    });
    expect(countAfterSweep).toBe(0);
  });
});
