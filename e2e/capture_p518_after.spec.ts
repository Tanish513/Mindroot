import { test } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const VIEWPORTS = [
  { width: 1440, height: 900, name: '1440' },
  { width: 1280, height: 800, name: '1280' },
  { width: 390, height: 844, name: '390' }
];

const ARTIFACT_DIR = 'C:/Users/tanis/.gemini/antigravity/brain/7388ce46-dc92-4d43-ac9e-d54e8df46f5c/screenshots';

test.describe('Dashboard P5.18 After Screenshots', () => {
  test('Capture Dashboard After P5.18', async ({ page }) => {
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/dashboard');
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const localDir = path.join(process.cwd(), 'screenshots', 'phase5');
      if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
      if (!fs.existsSync(ARTIFACT_DIR)) fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

      const fileName = `dashboard_after_p518_${vp.name}.png`;
      const localPath = path.join(localDir, fileName);
      const artifactPath = path.join(ARTIFACT_DIR, fileName);

      await page.screenshot({ path: localPath, fullPage: true });
      fs.copyFileSync(localPath, artifactPath);
      console.log(`Saved ${fileName}`);
    }
  });
});
