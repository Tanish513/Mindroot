const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '..', 'screenshots', 'phase5');

(async () => {
  const browser = await chromium.launch();
  const pages = [
    { name: 'dashboard', path: '/dashboard' },
    { name: 'marketplace', path: '/marketplace' },
    { name: 'schedule', path: '/schedule' },
    { name: 'messages', path: '/messages' },
    { name: 'wallet', path: '/wallet' },
  ];

  async function setupPage(context) {
    const page = await context.newPage();
    await page.addInitScript(() => {
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
      localStorage.setItem('mindroot_theme', 'light');
      sessionStorage.setItem('mindroot_socket_banner_dismissed', 'true');
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.classList.remove('dark');
    });
    return page;
  }

  async function compare(page, imgBufferA, imgBufferB) {
    const base64A = 'data:image/png;base64,' + imgBufferA.toString('base64');
    const base64B = 'data:image/png;base64,' + imgBufferB.toString('base64');
    return await page.evaluate(async ({ aSrc, bSrc }) => {
      const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; });
      const [imgA, imgB] = await Promise.all([load(aSrc), load(bSrc)]);
      const w = imgA.width, h = imgA.height;
      const cA = document.createElement('canvas'); cA.width = w; cA.height = h;
      const ctxA = cA.getContext('2d'); ctxA.drawImage(imgA, 0, 0);
      const dA = ctxA.getImageData(0, 0, w, h).data;
      const cB = document.createElement('canvas'); cB.width = w; cB.height = h;
      const ctxB = cB.getContext('2d'); ctxB.drawImage(imgB, 0, 0);
      const dB = ctxB.getImageData(0, 0, w, h).data;

      let diffCount = 0;
      for (let i = 0; i < dA.length; i += 4) {
        if (Math.abs(dA[i]-dB[i]) > 10 || Math.abs(dA[i+1]-dB[i+1]) > 10 || Math.abs(dA[i+2]-dB[i+2]) > 10) {
          diffCount++;
        }
      }
      return { diffCount, total: w * h, pct: (diffCount / (w * h) * 100).toFixed(4) };
    }, { aSrc: base64A, bSrc: base64B });
  }

  console.log('=== VERIFYING DESKTOP 1280px (Comparing against 781c3ff after screenshots) ===');
  const context1280 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page1280 = await setupPage(context1280);

  for (const item of pages) {
    await page1280.goto(`http://localhost:5173${item.path}`, { waitUntil: 'domcontentloaded' });
    await page1280.waitForTimeout(1000);
    const buf = await page1280.screenshot({ fullPage: false });
    
    const committedPath = path.join(targetDir, `p523_after_${item.name}_1280.png`);
    if (fs.existsSync(committedPath)) {
      const committedBuf = fs.readFileSync(committedPath);
      const diff = await compare(page1280, committedBuf, buf);
      console.log(`[1280px] ${item.name}: diff = ${diff.diffCount} / ${diff.total} (${diff.pct}%)`);
    }
  }
  await context1280.close();

  console.log('\n=== VERIFYING DESKTOP 1440px (Comparing against 781c3ff after screenshots) ===');
  const context1440 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page1440 = await setupPage(context1440);

  for (const item of pages) {
    await page1440.goto(`http://localhost:5173${item.path}`, { waitUntil: 'domcontentloaded' });
    await page1440.waitForTimeout(1000);
    const buf = await page1440.screenshot({ fullPage: false });
    
    const committedPath = path.join(targetDir, `p523_after_${item.name}_1440.png`);
    if (fs.existsSync(committedPath)) {
      const committedBuf = fs.readFileSync(committedPath);
      const diff = await compare(page1440, committedBuf, buf);
      console.log(`[1440px] ${item.name}: diff = ${diff.diffCount} / ${diff.total} (${diff.pct}%)`);
    }
  }
  await context1440.close();

  await browser.close();
})();
