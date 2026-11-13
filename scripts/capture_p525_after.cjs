const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const pagesToCapture = [
  { name: 'dashboard', path: '/dashboard' },
  { name: 'marketplace', path: '/marketplace' },
  { name: 'schedule', path: '/schedule' },
  { name: 'messages', path: '/messages' },
  { name: 'wallet', path: '/wallet' }
];

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
  scheduledAt: new Date(Date.now() + 86400000).toISOString(),
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

(async () => {
  const browser = await chromium.launch();
  const outDir = path.join(__dirname, '..', 'screenshots', 'phase5');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const runCapture = async (width, height, theme, suffix) => {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 3
    });
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
        rewardPoints: 120,
      };
      localStorage.setItem('mindroot_current_user', JSON.stringify(user));
      localStorage.setItem('mindroot_user_id', user.id);
      localStorage.setItem('mindroot_user_name', user.name);
      localStorage.setItem('mindroot_user_role', user.role);
      localStorage.setItem('mindroot_current_role', user.role);
      localStorage.setItem('mindroot_auth_token', 'dev-token-' + user.id);
      localStorage.setItem('mindroot_theme', themeVal);
      document.documentElement.setAttribute('data-theme', themeVal);
      if (themeVal === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }, theme);

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

    for (const p of pagesToCapture) {
      await page.goto(`http://localhost:5173${p.path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);

      const filePath = path.join(outDir, `p525_after_${p.name}_${suffix}.png`);
      await page.screenshot({ path: filePath, fullPage: false });
      console.log(`Saved screenshot: ${filePath}`);
    }

    await context.close();
  };

  // 1. 360 light
  console.log('Capturing 360 light...');
  await runCapture(360, 800, 'light', '360');

  // 2. 390 light
  console.log('Capturing 390 light...');
  await runCapture(390, 844, 'light', '390');

  // 3. 360 dark
  console.log('Capturing 360 dark...');
  await runCapture(360, 800, 'dark', '360_dark');

  await browser.close();
  console.log('All after screenshots captured!');
})();
