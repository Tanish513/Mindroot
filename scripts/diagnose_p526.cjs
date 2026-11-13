const { chromium, devices } = require('playwright');
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
  try {
    fs.writeFileSync(path.join(artifactDir, filename), sourceBuffer);
  } catch (e) {
    // ignore
  }
}

(async () => {
  const browser = await chromium.launch();

  const viewports = [
    { name: '320', width: 320, height: 640, dpr: 2 },
    { name: '340', width: 340, height: 720, dpr: 2.5 },
    { name: '360', width: 360, height: 800, dpr: 3 },
    { name: '390', width: 390, height: 844, dpr: 3 },
    { name: '412', width: 412, height: 915, dpr: 2.625, profile: devices['Pixel 7'] }
  ];

  const pages = [
    { name: 'dashboard', path: '/dashboard' },
    { name: 'marketplace', path: '/marketplace' },
    { name: 'schedule', path: '/schedule' },
    { name: 'messages', path: '/messages' },
    { name: 'wallet', path: '/wallet' }
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

  const results = {};

  for (const vp of viewports) {
    console.log(`\nDiagnosing viewport ${vp.name} (${vp.width}x${vp.height})...`);
    results[vp.name] = {};

    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dpr,
      userAgent: vp.profile ? vp.profile.userAgent : undefined
    });

    const page = await setupPage(context);

    for (const pg of pages) {
      await page.goto(`http://localhost:5173${pg.path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);

      // Check horizontal overflow
      const overflow = await page.evaluate(() => {
        const docEl = document.documentElement;
        return {
          scrollWidth: docEl.scrollWidth,
          clientWidth: docEl.clientWidth,
          hasOverflow: docEl.scrollWidth > docEl.clientWidth
        };
      });

      // Compute style metrics inside main
      const metrics = await page.evaluate((vpHeight) => {
        const getComp = (el) => window.getComputedStyle(el);
        const main = document.querySelector('main');
        if (!main) return null;

        // Headings inside main
        const h1 = main.querySelector('h1');
        const h2 = main.querySelector('h2');
        const h3 = main.querySelector('h3');
        
        // Cards inside main
        const cards = Array.from(main.querySelectorAll('div.rounded-xl, div.rounded-2xl, section.rounded-xl'));
        
        // Buttons inside main
        const buttons = Array.from(main.querySelectorAll('button:not([disabled])'));
        
        // Visible items above fold
        const aboveFoldCards = cards.filter(c => {
          const r = c.getBoundingClientRect();
          return r.top >= 0 && r.top < vpHeight && r.height > 20;
        });

        // Mentor card in marketplace
        const mentorCards = cards.filter(c => c.textContent.includes('/hr'));
        const mentorCard = mentorCards[0];

        // Avatars & Icons inside main
        const avatars = Array.from(main.querySelectorAll('img.rounded-full, img.rounded-xl'));
        const icons = Array.from(main.querySelectorAll('.material-symbols-outlined'));

        // Viewport meta
        const meta = document.querySelector('meta[name="viewport"]');

        return {
          h1: h1 ? { text: h1.textContent.trim().slice(0, 30), fontSize: getComp(h1).fontSize, lineHeight: getComp(h1).lineHeight } : null,
          h2: h2 ? { text: h2.textContent.trim().slice(0, 30), fontSize: getComp(h2).fontSize } : null,
          h3: h3 ? { text: h3.textContent.trim().slice(0, 30), fontSize: getComp(h3).fontSize } : null,
          mainPadding: getComp(main).padding,
          cardCountAboveFold: aboveFoldCards.length,
          firstCard: cards[0] ? {
            padding: getComp(cards[0]).padding,
            height: Math.round(cards[0].getBoundingClientRect().height),
            top: Math.round(cards[0].getBoundingClientRect().top)
          } : null,
          mentorCard: mentorCard ? {
            padding: getComp(mentorCard).padding,
            height: Math.round(mentorCard.getBoundingClientRect().height),
            top: Math.round(mentorCard.getBoundingClientRect().top),
            visibleAboveFold: mentorCard.getBoundingClientRect().top + 50 < vpHeight
          } : null,
          mentorCardsAboveFold: mentorCards.filter(c => c.getBoundingClientRect().top < vpHeight).length,
          primaryButton: (() => {
            const pb = buttons.find(b => b.className.includes('bg-primary'));
            return pb ? { text: pb.textContent.trim().slice(0, 25), height: Math.round(pb.getBoundingClientRect().height), fontSize: getComp(pb).fontSize } : null;
          })(),
          avatarSample: avatars[0] ? { width: Math.round(avatars[0].getBoundingClientRect().width), height: Math.round(avatars[0].getBoundingClientRect().height) } : null,
          iconSample: icons[0] ? { fontSize: getComp(icons[0]).fontSize } : null,
          viewportMeta: meta ? meta.getAttribute('content') : null,
          bodyFontSize: getComp(document.body).fontSize
        };
      }, vp.height);

      results[vp.name][pg.name] = { overflow, metrics };

      // Save screenshot
      const buf = await page.screenshot({ fullPage: false });
      const filename = `p526_before_${pg.name}_${vp.name}.png`;
      saveScreenshot(buf, filename);
    }

    await context.close();
  }

  fs.writeFileSync(path.join(__dirname, 'diagnose_p526_report.json'), JSON.stringify(results, null, 2));

  console.log('\n--- TABULATED DIAGNOSIS (Step 1) ---');
  for (const vp of viewports) {
    const d = results[vp.name].dashboard.metrics;
    const m = results[vp.name].marketplace.metrics;
    const s = results[vp.name].schedule.metrics;
    const w = results[vp.name].wallet.metrics;
    const msg = results[vp.name].messages.metrics;
    console.log(`\n[Viewport ${vp.name} (${vp.width}x${vp.height}, DPR ${vp.dpr})]`);
    console.log(`  Dashboard:   h1=${d?.h1?.fontSize || 'N/A'}, cardsAboveFold=${d?.cardCountAboveFold}, primaryBtn=${d?.primaryButton?.height}px, avatar=${d?.avatarSample?.width}px`);
    console.log(`  Marketplace: h1=${m?.h1?.fontSize || 'N/A'}, mentorCardH=${m?.mentorCard?.height || 'N/A'}px, mentorCardsAboveFold=${m?.mentorCardsAboveFold}`);
    console.log(`  Schedule:    h1/h2=${s?.h1?.fontSize || s?.h2?.fontSize || 'N/A'}, cardsAboveFold=${s?.cardCountAboveFold}`);
    console.log(`  Messages:    h1/h2=${msg?.h1?.fontSize || msg?.h2?.fontSize || 'N/A'}, cardsAboveFold=${msg?.cardCountAboveFold}`);
    console.log(`  Wallet:      h1/h2=${w?.h1?.fontSize || w?.h2?.fontSize || 'N/A'}, cardsAboveFold=${w?.cardCountAboveFold}`);
  }

  await browser.close();
})();
