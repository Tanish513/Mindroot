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

  // Pixel comparison helper using in-browser Canvas
  async function compareImages(page, baselinePath, currentBuffer) {
    if (!fs.existsSync(baselinePath)) {
      return { diffPixels: -1, totalPixels: 0, reason: 'Baseline missing' };
    }
    const baselineBuffer = fs.readFileSync(baselinePath);
    const baselineBase64 = 'data:image/png;base64,' + baselineBuffer.toString('base64');
    const currentBase64 = 'data:image/png;base64,' + currentBuffer.toString('base64');

    return await page.evaluate(async ({ imgA, imgB }) => {
      const loadImg = (src) => new Promise((resolve) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.src = src;
      });

      const [a, b] = await Promise.all([loadImg(imgA), loadImg(imgB)]);
      const w = a.width;
      const h = a.height;
      if (w !== b.width || h !== b.height) {
        return { diffPixels: 999999, totalPixels: w * h, reason: `Dimension mismatch: ${w}x${h} vs ${b.width}x${b.height}` };
      }

      const canvasA = document.createElement('canvas');
      canvasA.width = w; canvasA.height = h;
      const ctxA = canvasA.getContext('2d');
      ctxA.drawImage(a, 0, 0);
      const dataA = ctxA.getImageData(0, 0, w, h).data;

      const canvasB = document.createElement('canvas');
      canvasB.width = w; canvasB.height = h;
      const ctxB = canvasB.getContext('2d');
      ctxB.drawImage(b, 0, 0);
      const dataB = ctxB.getImageData(0, 0, w, h).data;

      let diffCount = 0;
      for (let i = 0; i < dataA.length; i += 4) {
        const dr = Math.abs(dataA[i] - dataB[i]);
        const dg = Math.abs(dataA[i+1] - dataB[i+1]);
        const db = Math.abs(dataA[i+2] - dataB[i+2]);
        const da = Math.abs(dataA[i+3] - dataB[i+3]);
        // Threshold: allow minor subpixel antialiasing differences <= 10
        if (dr > 10 || dg > 10 || db > 10 || da > 10) {
          diffCount++;
        }
      }
      return { diffPixels: diffCount, totalPixels: w * h, pct: ((diffCount / (w * h)) * 100).toFixed(4) };
    }, { imgA: baselineBase64, imgB: currentBase64 });
  }

  console.log('\n--- 1. CAPTURING & VERIFYING DESKTOP 1280px (Check A6) ---');
  const context1280 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page1280 = await setupPage(context1280, 'light');
  const diffResults1280 = [];

  for (const item of pages) {
    await page1280.goto(`http://localhost:5173${item.path}`, { waitUntil: 'domcontentloaded' });
    await page1280.waitForTimeout(1000);
    const buf = await page1280.screenshot({ fullPage: false });
    const afterFilename = `p523_after_${item.name}_1280.png`;
    saveScreenshot(buf, afterFilename);

    const baselinePath = path.join(targetDir, `p523_baseline_${item.name}_1280.png`);
    const diff = await compareImages(page1280, baselinePath, buf);
    console.log(`[Diff 1280px] ${item.name}: diffPixels = ${diff.diffPixels} / ${diff.totalPixels} (${diff.pct || 0}%)`);
    diffResults1280.push({ name: item.name, diff });
  }

  // Sidebar 1280
  const sidebarBuf1280 = await page1280.screenshot({ fullPage: false });
  saveScreenshot(sidebarBuf1280, 'p523_after_sidebar_1280.png');
  const sidebarDiff1280 = await compareImages(page1280, path.join(targetDir, 'p523_baseline_sidebar_1280.png'), sidebarBuf1280);
  console.log(`[Diff 1280px] sidebar: diffPixels = ${sidebarDiff1280.diffPixels} / ${sidebarDiff1280.totalPixels}`);
  diffResults1280.push({ name: 'sidebar', diff: sidebarDiff1280 });
  await context1280.close();

  console.log('\n--- 2. CAPTURING & VERIFYING DESKTOP 1440px (Check A6) ---');
  const context1440 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page1440 = await setupPage(context1440, 'light');
  const diffResults1440 = [];

  for (const item of pages) {
    await page1440.goto(`http://localhost:5173${item.path}`, { waitUntil: 'domcontentloaded' });
    await page1440.waitForTimeout(1000);
    const buf = await page1440.screenshot({ fullPage: false });
    const afterFilename = `p523_after_${item.name}_1440.png`;
    saveScreenshot(buf, afterFilename);

    const baselinePath = path.join(targetDir, `p523_baseline_${item.name}_1440.png`);
    const diff = await compareImages(page1440, baselinePath, buf);
    console.log(`[Diff 1440px] ${item.name}: diffPixels = ${diff.diffPixels} / ${diff.totalPixels} (${diff.pct || 0}%)`);
    diffResults1440.push({ name: item.name, diff });
  }

  const sidebarBuf1440 = await page1440.screenshot({ fullPage: false });
  saveScreenshot(sidebarBuf1440, 'p523_after_sidebar_1440.png');
  const sidebarDiff1440 = await compareImages(page1440, path.join(targetDir, 'p523_baseline_sidebar_1440.png'), sidebarBuf1440);
  console.log(`[Diff 1440px] sidebar: diffPixels = ${sidebarDiff1440.diffPixels} / ${sidebarDiff1440.totalPixels}`);
  diffResults1440.push({ name: 'sidebar', diff: sidebarDiff1440 });
  await context1440.close();

  console.log('\n--- 3. CAPTURING MOBILE 360px AFTER (LIGHT & DARK) ---');
  const context360L = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const page360L = await setupPage(context360L, 'light');
  for (const item of pages) {
    await page360L.goto(`http://localhost:5173${item.path}`, { waitUntil: 'domcontentloaded' });
    await page360L.waitForTimeout(800);
    const buf = await page360L.screenshot({ fullPage: false });
    saveScreenshot(buf, `p523_after_${item.name}_360_light.png`);
  }
  const sideBuf360L = await page360L.screenshot({ fullPage: false });
  saveScreenshot(sideBuf360L, 'p523_after_sidebar_360_light.png');
  await context360L.close();

  const context360D = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const page360D = await setupPage(context360D, 'dark');
  for (const item of pages) {
    await page360D.goto(`http://localhost:5173${item.path}`, { waitUntil: 'domcontentloaded' });
    await page360D.waitForTimeout(800);
    const buf = await page360D.screenshot({ fullPage: false });
    saveScreenshot(buf, `p523_after_${item.name}_360_dark.png`);
  }
  const sideBuf360D = await page360D.screenshot({ fullPage: false });
  saveScreenshot(sideBuf360D, 'p523_after_sidebar_360_dark.png');
  await context360D.close();

  console.log('\n--- 4. CAPTURING MOBILE 390px & 768px AFTER ---');
  const context390 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page390 = await setupPage(context390, 'light');
  for (const item of pages) {
    await page390.goto(`http://localhost:5173${item.path}`, { waitUntil: 'domcontentloaded' });
    await page390.waitForTimeout(800);
    const buf = await page390.screenshot({ fullPage: false });
    saveScreenshot(buf, `p523_after_${item.name}_390.png`);
  }
  await context390.close();

  const context768 = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const page768 = await setupPage(context768, 'light');
  for (const item of pages) {
    await page768.goto(`http://localhost:5173${item.path}`, { waitUntil: 'domcontentloaded' });
    await page768.waitForTimeout(800);
    const buf = await page768.screenshot({ fullPage: false });
    saveScreenshot(buf, `p523_after_${item.name}_768.png`);
  }
  await context768.close();

  await browser.close();
  console.log('\nVerification and diff analysis completed!');
})();
