const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '..', 'screenshots', 'phase5');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const artifactDir = 'C:/Users/tanis/.gemini/antigravity/brain/7388ce46-dc92-4d43-ac9e-d54e8df46f5c/screenshots/phase5';
if (!fs.existsSync(artifactDir)) {
  fs.mkdirSync(artifactDir, { recursive: true });
}

function saveScreenshot(sourceBuffer, filename) {
  fs.writeFileSync(path.join(targetDir, filename), sourceBuffer);
  fs.writeFileSync(path.join(artifactDir, filename), sourceBuffer);
  console.log(`Saved: ${filename}`);
}

(async () => {
  const browser = await chromium.launch();

  const pages = [
    { name: 'dashboard', path: '/dashboard' },
    { name: 'marketplace', path: '/marketplace' },
    { name: 'schedule', path: '/schedule' },
    { name: 'messages', path: '/messages' },
    { name: 'wallet', path: '/wallet' },
  ];

  // Helper to setup page with auth
  async function setupPage(context, theme = 'light') {
    const page = await context.newPage();
    await page.addInitScript((themeVal) => {
      const user = {
        id: 'user-demo-student',
        name: 'Aarav Patel',
        email: 'aarav.patel@mindroot.com',
        role: 'student',
        trustScore: 4.95,
        avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=256&q=80',
        tokenBalance: 250,
        rewardPoints: 120
      };
      localStorage.setItem('mindroot_current_user', JSON.stringify(user));
      localStorage.setItem('mindroot_user_id', user.id);
      localStorage.setItem('mindroot_user_name', user.name);
      localStorage.setItem('mindroot_user_role', user.role);
      localStorage.setItem('mindroot_auth_token', 'dev-token-' + user.id);
      localStorage.setItem('mindroot_theme', themeVal);
      sessionStorage.setItem('mindroot_socket_banner_dismissed', 'true');
      document.documentElement.setAttribute('data-theme', themeVal);
      if (themeVal === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }, theme);
    return page;
  }

  console.log('--- CAPTURING DESKTOP 1280px BASELINES ---');
  const context1280 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page1280 = await setupPage(context1280, 'light');
  for (const item of pages) {
    await page1280.goto(`http://localhost:5173${item.path}`, { waitUntil: 'domcontentloaded' });
    await page1280.waitForTimeout(1000);
    const buf = await page1280.screenshot({ fullPage: false });
    saveScreenshot(buf, `p523_baseline_${item.name}_1280.png`);
  }
  // Sidebar focused view
  const sidebarBuf1280 = await page1280.screenshot({ fullPage: false });
  saveScreenshot(sidebarBuf1280, 'p523_baseline_sidebar_1280.png');
  await context1280.close();

  console.log('--- CAPTURING DESKTOP 1440px BASELINES ---');
  const context1440 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page1440 = await setupPage(context1440, 'light');
  for (const item of pages) {
    await page1440.goto(`http://localhost:5173${item.path}`, { waitUntil: 'domcontentloaded' });
    await page1440.waitForTimeout(1000);
    const buf = await page1440.screenshot({ fullPage: false });
    saveScreenshot(buf, `p523_baseline_${item.name}_1440.png`);
  }
  const sidebarBuf1440 = await page1440.screenshot({ fullPage: false });
  saveScreenshot(sidebarBuf1440, 'p523_baseline_sidebar_1440.png');
  await context1440.close();

  console.log('--- CAPTURING MOBILE 360px BEFORE (LIGHT) ---');
  const context360Light = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const page360Light = await setupPage(context360Light, 'light');
  for (const item of pages) {
    await page360Light.goto(`http://localhost:5173${item.path}`, { waitUntil: 'domcontentloaded' });
    await page360Light.waitForTimeout(1000);
    const buf = await page360Light.screenshot({ fullPage: false });
    saveScreenshot(buf, `p523_before_${item.name}_360_light.png`);
  }
  const sidebarBuf360Light = await page360Light.screenshot({ fullPage: false });
  saveScreenshot(sidebarBuf360Light, 'p523_before_sidebar_360_light.png');
  await context360Light.close();

  console.log('--- CAPTURING MOBILE 360px BEFORE (DARK) ---');
  const context360Dark = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const page360Dark = await setupPage(context360Dark, 'dark');
  for (const item of pages) {
    await page360Dark.goto(`http://localhost:5173${item.path}`, { waitUntil: 'domcontentloaded' });
    await page360Dark.waitForTimeout(1000);
    const buf = await page360Dark.screenshot({ fullPage: false });
    saveScreenshot(buf, `p523_before_${item.name}_360_dark.png`);
  }
  const sidebarBuf360Dark = await page360Dark.screenshot({ fullPage: false });
  saveScreenshot(sidebarBuf360Dark, 'p523_before_sidebar_360_dark.png');
  await context360Dark.close();

  await browser.close();
  console.log('All Step 1 baseline & before screenshots successfully captured!');
})();
