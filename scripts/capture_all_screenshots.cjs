const { chromium } = require('@playwright/test');
const jwt = require('../server/node_modules/jsonwebtoken');
const fs = require('fs');
const path = require('path');

const JWT_SECRET = 'mindroot-dev-secret-key-change-in-prod';

if (!fs.existsSync('screenshots')) {
  fs.mkdirSync('screenshots');
}

const alex = {
  id: 'user-alex-morgan',
  name: 'Alex Morgan',
  email: 'alex.morgan@mindroot.edu',
  role: 'both',
  tokenBalance: 14,
  trustScore: 4.96,
  hourlyRate: 450,
  skillsTaught: ['React & TypeScript', 'Next.js', 'State Management'],
  skillsLearned: ['Machine Learning', 'Python FastAPI', 'Docker'],
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80',
  upiId: 'alex.morgan@oksbi'
};

const sarah = {
  id: 'user-sarah-chen',
  name: 'Sarah Chen',
  email: 'sarah.chen@mindroot.edu',
  role: 'teacher',
  tokenBalance: 22,
  trustScore: 5.00,
  hourlyRate: 599,
  skillsTaught: ['Data Structures & Algorithms', 'C++ STL', 'Graph Algorithms'],
  skillsLearned: ['UI/UX Interaction Design', 'Figma Prototyping'],
  avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=256&h=256&q=80',
  upiId: 'sarah.chen@okhdfc'
};

const adminUser = {
  id: 'user-admin',
  name: 'System Admin',
  email: 'admin@mindroot.com',
  role: 'admin',
  tokenBalance: 9999,
  trustScore: 5.00
};

const alexToken = jwt.sign({ userId: alex.id, role: alex.role }, JWT_SECRET);
const sarahToken = jwt.sign({ userId: sarah.id, role: sarah.role }, JWT_SECRET);
const adminToken = jwt.sign({ userId: adminUser.id, role: 'admin' }, JWT_SECRET);

async function injectAuth(context, user, token, currentRole = 'student', loginRole = 'both') {
  await context.addInitScript(({ u, tok, cr, lr }) => {
    localStorage.setItem('mindroot_current_user', JSON.stringify(u));
    sessionStorage.setItem('mindroot_current_user', JSON.stringify(u));
    localStorage.setItem('mindroot_auth_token', tok);
    sessionStorage.setItem('mindroot_auth_token', tok);
    localStorage.setItem('mindroot_current_role', cr);
    sessionStorage.setItem('mindroot_current_role', cr);
    localStorage.setItem('mindroot_login_role', lr);
    sessionStorage.setItem('mindroot_login_role', lr);
    localStorage.setItem('mindroot_theme', 'light');
  }, { u: user, tok: token, cr: currentRole, lr: loginRole });
}

async function runCapture() {
  console.log('🚀 Starting Playwright Chromium with fake media device flags...');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });

  // -------------------------------------------------------------
  // 1. SCREENSHOT 02: Auth Page / Google Sign-in Modal
  // -------------------------------------------------------------
  console.log('📸 Capturing 02_auth.png...');
  {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();
    await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/02_auth.png' });
    console.log('  ✓ Saved 02_auth.png');
    await context.close();
  }

  // -------------------------------------------------------------
  // 2. SCREENSHOT 01: Landing / Dashboard Page (Hero & Stats)
  // -------------------------------------------------------------
  console.log('📸 Capturing 01_landing.png...');
  {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    await injectAuth(context, alex, alexToken, 'student', 'both');
    const page = await context.newPage();
    await page.goto('http://localhost:5173/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'screenshots/01_landing.png' });
    console.log('  ✓ Saved 01_landing.png');
    await context.close();
  }

  // -------------------------------------------------------------
  // 3. SCREENSHOT 03: Matchmaker (Peer Discovery & Compatibility)
  // -------------------------------------------------------------
  console.log('📸 Capturing 03_matchmaker.png...');
  {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    await injectAuth(context, alex, alexToken, 'student', 'both');
    const page = await context.newPage();
    await page.goto('http://localhost:5173/match-finder', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/03_matchmaker.png' });
    console.log('  ✓ Saved 03_matchmaker.png');
    await context.close();
  }

  // -------------------------------------------------------------
  // 4. SCREENSHOT 04: Booking Modal with Slot Picker & Escrow Notice
  // -------------------------------------------------------------
  console.log('📸 Capturing 04_booking.png...');
  {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    await injectAuth(context, alex, alexToken, 'student', 'both');
    const page = await context.newPage();
    await page.goto('http://localhost:5173/match-finder', { waitUntil: 'domcontentloaded' });
    try {
      const btn = page.locator('button:has-text("Propose Swap")').first();
      await btn.waitFor({ state: 'visible', timeout: 15000 });
      await btn.click();
      await page.waitForTimeout(1500);
      console.log('  ✓ Clicked Propose Swap modal!');
    } catch (e) {
      console.log('  Note on modal button:', e.message);
    }
    await page.screenshot({ path: 'screenshots/04_booking.png' });
    console.log('  ✓ Saved 04_booking.png');
    await context.close();
  }

  // -------------------------------------------------------------
  // 5. SCREENSHOT 08: Wallet & Transaction Ledger
  // -------------------------------------------------------------
  console.log('📸 Capturing 08_wallet.png...');
  {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    await injectAuth(context, alex, alexToken, 'student', 'both');
    const page = await context.newPage();
    await page.goto('http://localhost:5173/wallet', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'screenshots/08_wallet.png' });
    console.log('  ✓ Saved 08_wallet.png');
    await context.close();
  }

  // -------------------------------------------------------------
  // 6. SCREENSHOT 07: Admin Dashboard (Users, Analytics, Disputes)
  // -------------------------------------------------------------
  console.log('📸 Capturing 07_admin.png...');
  {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    await injectAuth(context, adminUser, adminToken, 'admin', 'admin');
    const page = await context.newPage();
    await page.goto('http://localhost:5173/admin', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'screenshots/07_admin.png' });
    console.log('  ✓ Saved 07_admin.png');
    await context.close();
  }

  // -------------------------------------------------------------
  // 7. SCREENSHOT 05 & 06: Live Classroom (2 WebRTC peers) & Whiteboard/Code
  // -------------------------------------------------------------
  console.log('📸 Launching two-peer WebRTC classroom for 05_classroom.png & 06_whiteboard_code.png...');
  {
    const roomId = 'room-mindroot-p2p-live';
    const roomUrl = `http://localhost:5173/live-room/${roomId}`;

    // Context 1: Student Alex Morgan
    const ctxAlex = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      permissions: ['camera', 'microphone']
    });
    await injectAuth(ctxAlex, alex, alexToken, 'student', 'both');
    const pageAlex = await ctxAlex.newPage();

    // Context 2: Teacher Sarah Chen
    const ctxSarah = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      permissions: ['camera', 'microphone']
    });
    await injectAuth(ctxSarah, sarah, sarahToken, 'teacher', 'teacher');
    const pageSarah = await ctxSarah.newPage();

    // Both join the live classroom
    await pageSarah.goto(roomUrl, { waitUntil: 'domcontentloaded' });
    await pageSarah.waitForTimeout(2000);

    await pageAlex.goto(roomUrl, { waitUntil: 'domcontentloaded' });
    await pageAlex.waitForTimeout(4000);

    // Send a message in chat to make the chat feed realistic
    try {
      const chatInput = pageAlex.locator('input[placeholder*="chat" i], input[placeholder*="message" i], textarea').first();
      if (await chatInput.count() > 0) {
        await chatInput.fill('Hi Sarah! Excited to dive into Binary Trees and Dynamic Programming today.');
        await pageAlex.keyboard.press('Enter');
        await pageAlex.waitForTimeout(1000);
      }
    } catch (e) {
      console.log('Note on chat message:', e.message);
    }

    // Capture 05_classroom.png from Alex's view
    await pageAlex.screenshot({ path: 'screenshots/05_classroom.png' });
    console.log('  ✓ Saved 05_classroom.png');

    // Switch workspace to Whiteboard or Code
    console.log('📸 Switching to Whiteboard / Code for 06_whiteboard_code.png...');
    try {
      const wbBtn = pageAlex.locator('button:has-text("Whiteboard"), button:has-text("Code"), button[title*="Whiteboard" i], button[title*="Code" i]').first();
      if (await wbBtn.count() > 0) {
        await wbBtn.click();
        await pageAlex.waitForTimeout(2000);
      }
    } catch (e) {
      console.log('Note on workspace switch:', e.message);
    }

    await pageAlex.screenshot({ path: 'screenshots/06_whiteboard_code.png' });
    console.log('  ✓ Saved 06_whiteboard_code.png');

    await ctxAlex.close();
    await ctxSarah.close();
  }

  await browser.close();
  console.log('🎉 All 8 real screenshots captured successfully in /screenshots!');
}

runCapture().catch(err => {
  console.error('Fatal capture error:', err);
  process.exit(1);
});
