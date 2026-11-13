const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const pagesToCapture = [
  { name: 'dashboard', path: '/dashboard' },
  { name: 'marketplace', path: '/marketplace' },
  { name: 'schedule', path: '/schedule' },
  { name: 'messages', path: '/messages?peerId=peer-feynman' },
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
    rating: 4.9,
    reviewsCount: 18,
    userSkills: [
      { id: 's1', type: 'teaches', skill: { name: 'Physics & AI', category: 'Software & AI' } },
      { id: 's2', type: 'wants_to_learn', skill: { name: 'Quantum Computing', category: 'Software & AI' } }
    ]
  },
  {
    id: 'peer-curie',
    name: 'Dr. Marie Curie',
    role: 'teacher',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956',
    upiId: 'curie@upi',
    hourlyRate: 599,
    bio: 'Pioneering researcher in chemistry and data sciences.',
    rating: 5.0,
    reviewsCount: 24,
    userSkills: [
      { id: 's3', type: 'teaches', skill: { name: 'Chemistry & ML', category: 'Software & AI' } }
    ]
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
  const outDir = path.join(__dirname, '..', 'screenshots', 'dark_mode_audit');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const targets = [
    { width: 1280, height: 800, prefix: 'desktop_dark' },
    { width: 390, height: 844, prefix: 'mobile_dark' }
  ];

  for (const t of targets) {
    const context = await browser.newContext({
      viewport: { width: t.width, height: t.height },
      deviceScaleFactor: 2
    });
    const page = await context.newPage();

    await page.addInitScript(() => {
      const user = {
        id: 'user-demo-student',
        name: 'Aarav Patel',
        email: 'student.demo@mindroot.edu',
        role: 'both',
        tokenBalance: 4,
        inrWalletBalance: 1250,
        streakDays: 5,
        rating: 4.9,
        reviewsCount: 14,
        bio: 'CS junior learning ML and teaching Web Dev basics.'
      };
      sessionStorage.setItem('mindroot_current_user', JSON.stringify(user));
      sessionStorage.setItem('mindroot_auth_token', 'dev-token-user-demo-student');
      sessionStorage.setItem('mindroot_current_role', 'student');
      localStorage.setItem('mindroot_current_user', JSON.stringify(user));
      localStorage.setItem('mindroot_auth_token', 'dev-token-user-demo-student');
      localStorage.setItem('mindroot_current_role', 'student');
      localStorage.setItem('mindroot_theme', 'dark');
      localStorage.setItem('theme', 'dark');
    });

    await page.route('**/api/users/me', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      id: 'user-demo-student',
      name: 'Aarav Patel',
      email: 'student.demo@mindroot.edu',
      role: 'both',
      tokenBalance: 4,
      inrWalletBalance: 1250,
      streakDays: 5,
      rating: 4.9,
      reviewsCount: 14,
      bio: 'CS junior learning ML and teaching Web Dev basics.'
    })}));

    await page.route('**/api/users/mentors*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockMentors) }));
    await page.route('**/api/sessions/my', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([sessionFixture]) }));
    await page.route('**/api/sessions', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([sessionFixture]) }));
    await page.route('**/api/sessions/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sessionFixture) }));
    await page.route('**/api/messages**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
      { id: 'm1', senderId: 'peer-feynman', receiverId: 'user-demo-student', text: 'Hey Aarav! Looking forward to discussing neural network architectures.', createdAt: new Date().toISOString() }
    ])}));
    await page.route('**/api/wallet/transactions', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
      { id: 'tx1', type: 'session_payment', amount: 499, description: 'Mentoring Fees Paid', createdAt: new Date().toISOString() }
    ])}));
    await page.route('**/api/notes**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));

    for (const p of pagesToCapture) {
      try {
        await page.goto(`http://localhost:5173${p.path}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(600);
        await page.evaluate(() => {
          document.documentElement.classList.add('dark');
          document.documentElement.setAttribute('data-theme', 'dark');
        });
        await page.waitForTimeout(500);

        const screenshotPath = path.join(outDir, `${t.prefix}_${p.name}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });
        console.log(`Captured ${screenshotPath}`);
      } catch (err) {
        console.error(`Failed ${p.name}:`, err.message);
      }
    }
    await context.close();
  }

  await browser.close();
  console.log('Finished capturing authenticated dark mode audit screenshots.');
})();
