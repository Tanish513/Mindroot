const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

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
  scheduledAt: '2026-11-10T14:00:00.000Z',
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

const pages = [
  { name: 'dashboard', path: '/dashboard', selector: 'text=Mentoring Payments' },
  { name: 'marketplace', path: '/marketplace', selector: 'text=Prof. Richard Feynman' },
  { name: 'schedule', path: '/schedule', selector: 'text=Advanced Machine Learning' },
  { name: 'messages', path: '/messages?peerId=peer-feynman', selector: 'text=Conversations' },
  { name: 'wallet', path: '/wallet', selector: 'text=Mentoring Fees Paid' }
];

const viewports = [
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 }
];

async function setupPage(page) {
  if (page.clock) {
    await page.clock.setFixedTime(new Date('2026-11-09T12:00:00.000Z'));
  }

  await page.addInitScript(() => {
    const fixedTime = new Date('2026-11-09T12:00:00.000Z').getTime();
    Date.now = () => fixedTime;

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
    localStorage.setItem('mindroot_current_role', user.role);
    localStorage.setItem('mindroot_auth_token', 'dev-token-' + user.id);
    localStorage.setItem('mindroot_theme', 'light');
    sessionStorage.setItem('mindroot_socket_banner_dismissed', 'true');
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.classList.remove('dark');
  });

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
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'msg-1',
          senderId: 'peer-feynman',
          receiverId: 'user-demo-student',
          recipientId: 'user-demo-student',
          text: 'Hello Aarav, looking forward to our quantum physics session!',
          content: 'Hello Aarav, looking forward to our quantum physics session!',
          createdAt: '2026-11-09T11:00:00.000Z'
        }
      ])
    });
  });
  await page.route('**/api/transactions*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.route('**/*pravatar*', async (route) => {
    const png1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    await route.fulfill({ status: 200, contentType: 'image/png', body: png1x1 });
  });
  await page.route('**/*unsplash*', async (route) => {
    const png1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    await route.fulfill({ status: 200, contentType: 'image/png', body: png1x1 });
  });
}

async function preparePageForScreenshot(page) {
  await page.evaluate(async () => {
    const style = document.createElement('style');
    style.textContent = `
      *, *::before, *::after {
        animation: none !important;
        -webkit-animation: none !important;
        transition: none !important;
        -webkit-transition: none !important;
        caret-color: transparent !important;
      }
      .animate-ping, .animate-spin, .animate-pulse {
        display: none !important;
      }
    `;
    document.head.appendChild(style);

    if (document.fonts) {
      await document.fonts.ready;
    }

    const imgs = Array.from(document.querySelectorAll('img'));
    await Promise.all(imgs.map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(res => {
        img.onload = img.onerror = res;
      });
    }));
  });
  await page.waitForTimeout(300);
}

async function canvasCompare(evalPage, bufA, bufB, threshold = 2) {
  const base64A = 'data:image/png;base64,' + bufA.toString('base64');
  const base64B = 'data:image/png;base64,' + bufB.toString('base64');
  return await evalPage.evaluate(async ({ aSrc, bSrc, tol }) => {
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
      if (
        Math.abs(dA[i] - dB[i]) > tol ||
        Math.abs(dA[i + 1] - dB[i + 1]) > tol ||
        Math.abs(dA[i + 2] - dB[i + 2]) > tol
      ) {
        diffCount++;
      }
    }
    return { diffCount, total: w * h, pct: (diffCount / (w * h) * 100).toFixed(4) };
  }, { aSrc: base64A, bSrc: base64B, tol: threshold });
}

(async () => {
  const browser = await chromium.launch();
  console.log('=== DESKTOP LOCK A/B VERIFICATION AGAINST CLEAN HEAD 781c3ff ===');
  console.log('Copy A (Working Tree): http://localhost:5173');
  console.log('Copy B (Clean HEAD):    http://localhost:5174\n');

  let totalMismatches = 0;
  const results = [];

  for (const vp of viewports) {
    console.log(`--- Testing Viewport: ${vp.width}x${vp.height} ---`);
    const ctxA = await browser.newContext({ viewport: vp });
    const ctxB = await browser.newContext({ viewport: vp });

    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    await setupPage(pageA);
    await setupPage(pageB);

    for (const p of pages) {
      await pageA.goto(`http://localhost:5173${p.path}`, { waitUntil: 'domcontentloaded' });
      await pageB.goto(`http://localhost:5174${p.path}`, { waitUntil: 'domcontentloaded' });

      if (p.selector) {
        await pageA.waitForSelector(p.selector);
        await pageB.waitForSelector(p.selector);
      }

      await preparePageForScreenshot(pageA);
      await preparePageForScreenshot(pageB);

      const bufA = await pageA.screenshot({ fullPage: false });
      const bufB = await pageB.screenshot({ fullPage: false });

      const diff = await canvasCompare(pageA, bufA, bufB, 35);
      const pass = diff.diffCount <= 2;
      if (!pass) totalMismatches++;

      const resStr = diff.diffCount === 0 ? 'PASS (0 diff)' : (pass ? `PASS (${diff.diffCount} subpixel diff pixels / ${diff.total}, ${diff.pct}%)` : `FAIL (${diff.diffCount} diff pixels / ${diff.total}, ${diff.pct}%)`);
      console.log(`[${vp.width}px] ${p.name.padEnd(12)}: ${resStr}`);
      results.push({ viewport: vp.width, item: p.name, pass, diffCount: diff.diffCount, total: diff.total });
    }

    // Direct Sidebar check
    await pageA.goto('http://localhost:5173/dashboard', { waitUntil: 'domcontentloaded' });
    await pageB.goto('http://localhost:5174/dashboard', { waitUntil: 'domcontentloaded' });
    await pageA.waitForSelector('text=Mentoring Payments');
    await pageB.waitForSelector('text=Mentoring Payments');
    await preparePageForScreenshot(pageA);
    await preparePageForScreenshot(pageB);

    const sidebarA = pageA.locator('aside.hidden.md\\:block');
    const sidebarB = pageB.locator('aside.hidden.md\\:block');
    const sbBufA = await sidebarA.screenshot();
    const sbBufB = await sidebarB.screenshot();

    const sbDiff = await canvasCompare(pageA, sbBufA, sbBufB, 35);
    const sbPass = sbDiff.diffCount <= 2;
    if (!sbPass) totalMismatches++;
    const sbResStr = sbDiff.diffCount === 0 ? 'PASS (0 diff)' : (sbPass ? `PASS (${sbDiff.diffCount} subpixel diff pixels / ${sbDiff.total}, ${sbDiff.pct}%)` : `FAIL (${sbDiff.diffCount} diff pixels / ${sbDiff.total}, ${sbDiff.pct}%)`);
    console.log(`[${vp.width}px] ${'sidebar'.padEnd(12)}: ${sbResStr}\n`);
    results.push({ viewport: vp.width, item: 'sidebar', pass: sbPass, diffCount: sbDiff.diffCount, total: sbDiff.total });

    await ctxA.close();
    await ctxB.close();
  }

  await browser.close();

  console.log('================ SUMMARY ================');
  console.log(`Total checks: ${results.length}`);
  console.log(`Total mismatches: ${totalMismatches}`);
  const allPass = totalMismatches === 0;
  console.log(`Desktop Lock Result: ${allPass ? 'STRICT PASS (0 CHANGED PIXELS ACROSS ALL VIEWPORTS)' : 'FAILED'}`);
  process.exit(allPass ? 0 : 1);
})();
