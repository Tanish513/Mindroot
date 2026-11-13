const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const user = {
  id: 'user-demo-student',
  name: 'Aarav Patel',
  email: 'aarav.patel@mindroot.com',
  role: 'student',
  trustScore: 4.95,
  avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=256&q=80',
  tokenBalance: 250,
  rewardPoints: 120,
};

const pages = [
  { name: 'dashboard', path: '/dashboard' },
  { name: 'marketplace', path: '/marketplace' },
  { name: 'schedule', path: '/schedule' },
  { name: 'messages', path: '/messages' },
  { name: 'wallet', path: '/wallet' },
];

const viewports = [
  { width: 360, height: 800, name: '360' },
  { width: 390, height: 844, name: '390' }
];

async function run() {
  const browser = await chromium.launch();
  const outDir = path.join(__dirname, '..', 'screenshots', 'phase5');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const diagnostics = {};

  for (const vp of viewports) {
    diagnostics[vp.name] = {};
    for (const pg of pages) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 3,
      });
      const page = await context.newPage();

      await page.addInitScript((u) => {
        localStorage.setItem('mindroot_current_user', JSON.stringify(u));
        localStorage.setItem('mindroot_user_id', u.id);
        localStorage.setItem('mindroot_user_name', u.name);
        localStorage.setItem('mindroot_user_role', u.role);
        localStorage.setItem('mindroot_auth_token', 'dev-token-' + u.id);
        localStorage.setItem('mindroot_theme', 'light');
        sessionStorage.setItem('mindroot_socket_banner_dismissed', 'true');
        document.documentElement.setAttribute('data-theme', 'light');
        document.documentElement.classList.remove('dark');
      }, user);

      await page.goto(`http://localhost:5173${pg.path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);

      const shotPath = path.join(outDir, `p525_before_${pg.name}_${vp.name}.png`);
      await page.screenshot({ path: shotPath, fullPage: false });
      console.log(`Saved screenshot: ${shotPath}`);

      // Evaluate computed styles & fold visibility
      const pageMetrics = await page.evaluate(({ vpWidth, vpHeight }) => {
        const header = document.querySelector('header');
        const bottomNav = document.querySelector('nav[aria-label="Mobile Navigation"]');
        const headerH = header ? header.getBoundingClientRect().height : 0;
        const navH = bottomNav ? bottomNav.getBoundingClientRect().height : 0;

        const main = document.querySelector('main');
        const mainStyle = main ? window.getComputedStyle(main) : null;

        // Headings & Text
        const h1 = document.querySelector('h1');
        const h2 = document.querySelector('h2');
        const h3 = document.querySelector('h3');
        const p = document.querySelector('p');
        const buttons = Array.from(document.querySelectorAll('button'));
        
        // Items above the fold
        const foldBottom = vpHeight - navH;
        let mentorCardsAboveFold = 0;
        let checklistAboveFold = 0;
        let statsAboveFold = 0;

        // Check mentor cards in Marketplace
        const mentorCards = Array.from(document.querySelectorAll('.group.border.border-border, [data-testid="mentor-card"]'));
        mentorCards.forEach(c => {
          const rect = c.getBoundingClientRect();
          if (rect.top < foldBottom && rect.bottom > headerH) {
            mentorCardsAboveFold++;
          }
        });

        // Dashboard specific
        const statsEl = document.querySelector('.grid.grid-cols-2');
        if (statsEl) {
          const rect = statsEl.getBoundingClientRect();
          if (rect.top < foldBottom && rect.bottom > headerH) statsAboveFold = 1;
        }

        const h2s = Array.from(document.querySelectorAll('h2'));
        const checklistH2 = h2s.find(el => el.textContent.includes('Get started') || el.textContent.includes('Checklist'));
        if (checklistH2) {
          const card = checklistH2.closest('.rounded-2xl') || checklistH2.parentElement;
          if (card) {
            const rect = card.getBoundingClientRect();
            if (rect.top < foldBottom && rect.bottom > headerH) checklistAboveFold = 1;
          }
        }

        return {
          headerHeight: Math.round(headerH),
          bottomNavHeight: Math.round(navH),
          mainPadding: mainStyle ? `${mainStyle.paddingTop} ${mainStyle.paddingRight} ${mainStyle.paddingBottom} ${mainStyle.paddingLeft}` : 'n/a',
          h1FontSize: h1 ? window.getComputedStyle(h1).fontSize : 'n/a',
          h2FontSize: h2 ? window.getComputedStyle(h2).fontSize : 'n/a',
          h3FontSize: h3 ? window.getComputedStyle(h3).fontSize : 'n/a',
          pFontSize: p ? window.getComputedStyle(p).fontSize : 'n/a',
          mentorCardsAboveFold,
          statsAboveFold,
          checklistAboveFold,
          buttonHeights: buttons.slice(0, 5).map(b => ({
            text: (b.innerText || b.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 24),
            height: Math.round(b.getBoundingClientRect().height),
            fontSize: window.getComputedStyle(b).fontSize
          }))
        };
      }, { vpWidth: vp.width, vpHeight: vp.height });

      diagnostics[vp.name][pg.name] = pageMetrics;
      await context.close();
    }
  }

  await browser.close();
  console.log('\n--- DIAGNOSTIC RESULTS ---');
  console.log(JSON.stringify(diagnostics, null, 2));
  fs.writeFileSync(path.join(__dirname, 'diagnose_report.json'), JSON.stringify(diagnostics, null, 2));
}

run().catch(console.error);
