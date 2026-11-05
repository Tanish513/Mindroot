import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const studentUser = {
  id: 'u-student-1',
  name: 'Alex Johnson',
  email: 'alex@mindroot.dev',
  role: 'student',
  tokenBalance: 150,
  trustScore: 4.9,
  streakCount: 5,
};

const mentorUser = {
  id: 'u-mentor-1',
  name: 'Sophia Chen',
  email: 'sophia@mindroot.dev',
  role: 'teacher',
  upiId: 'sophia@okhdfc',
  hasUpiConfigured: true,
  hourlyRate: 500,
  skillsTaught: ['System Design', 'React'],
  userSkills: [{ id: 'us-1', type: 'teaches', skill: { id: 's-1', name: 'System Design' } }],
  availability: {
    'Mon-10:00 AM': true,
    'Tue-02:00 PM': true,
    'Wed-11:00 AM': true,
    'Thu-04:00 PM': true,
    'Fri-01:00 PM': true,
  },
};

const targetDir = path.resolve('screenshots/phase5');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const sampleSession = {
  id: 'sess-view-test-1',
  title: 'System Design 1:1',
  scheduledAt: new Date(Date.now() + 3600000).toISOString(),
  durationMin: 60,
  status: 'confirmed',
  teacherId: mentorUser.id,
  teacher: mentorUser,
  studentId: studentUser.id,
  student: studentUser,
};

test.describe('Capture Schedule Views (Week, Day, Month)', () => {
  const viewports = [
    { name: '1440', width: 1440, height: 900 },
    { name: '390', width: 390, height: 844 },
  ];

  for (const vp of viewports) {
    test(`Capture views at ${vp.name}px`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      await page.addInitScript((user) => {
        localStorage.setItem('mindroot_current_user', JSON.stringify(user));
        localStorage.setItem('mindroot_auth_token', 'dev-token-' + user.id);
        localStorage.setItem('mindroot_current_role', 'student');
      }, studentUser);

      await page.route('**/api/config', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ demoMode: false }) });
      });

      await page.route('**/api/sessions', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([sampleSession]) });
      });

      await page.route('**/api/peers', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([mentorUser]) });
      });

      await page.route('**/api/notes**', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      });

      await page.route('**/api/users/profile', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(studentUser) });
      });

      // Navigate to schedule page and wait for grid to load
      await page.goto('/schedule');
      await page.locator('[data-testid="calendar-grid-week"]').waitFor({ state: 'visible', timeout: 10000 });
      await page.waitForTimeout(500);

      // 1. Week View (Default)
      await page.screenshot({ path: path.join(targetDir, `schedule_week_${vp.name}.png`), fullPage: true });

      // 2. Day View
      const dropdown = page.locator('[data-testid="calendar-view-dropdown"]');
      await dropdown.click();
      await page.locator('[data-testid="calendar-view-option-day"]').click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(targetDir, `schedule_day_${vp.name}.png`), fullPage: true });

      // 3. Month View
      await dropdown.click();
      await page.locator('[data-testid="calendar-view-option-month"]').click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(targetDir, `schedule_month_${vp.name}.png`), fullPage: true });
    });
  }
});
