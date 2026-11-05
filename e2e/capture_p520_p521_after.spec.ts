import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const teacherUser = {
  id: 'teacher-e2e-end',
  name: 'Professor Alan Turing',
  email: 'alan.turing@mindroot.dev',
  role: 'teacher',
  tokenBalance: 800,
  trustScore: 4.98
};

const studentUser = {
  id: 'student-e2e-end',
  name: 'Ada Lovelace',
  email: 'ada.lovelace@mindroot.dev',
  role: 'student',
  tokenBalance: 150,
  trustScore: 4.95
};

const artifactDir = 'C:/Users/tanis/.gemini/antigravity/brain/7388ce46-dc92-4d43-ac9e-d54e8df46f5c/screenshots';

function saveAndMirror(localPath: string, fileName: string) {
  if (fs.existsSync(localPath)) {
    fs.copyFileSync(localPath, path.join(artifactDir, fileName));
  }
}

test.describe('P5.20 & P5.21 Evidence Screenshots', () => {
  test.beforeAll(() => {
    if (!fs.existsSync('screenshots/phase5')) fs.mkdirSync('screenshots/phase5', { recursive: true });
    if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });
  });

  const viewports = [
    { width: 1440, height: 900, name: '1440' },
    { width: 1280, height: 800, name: '1280' },
    { width: 390, height: 844, name: '390' }
  ];

  for (const vp of viewports) {
    test(`Capture End Session Modal & People Tab at ${vp.name}px`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.addInitScript((u) => {
        localStorage.setItem('mindroot_current_user', JSON.stringify(u));
        localStorage.setItem('mindroot_auth_token', 'dev-token-' + u.id);
        localStorage.setItem('mindroot_current_role', 'teacher');
        localStorage.setItem('mindroot_theme', 'light');
      }, teacherUser);

      await page.route('**/api/config', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ demoMode: true }) });
      });

      const now = Date.now();
      const sessionId = 'session-p521-' + now;
      const mockSession = {
        id: sessionId,
        teacherId: teacherUser.id,
        studentId: studentUser.id,
        teacher: { id: teacherUser.id, name: teacherUser.name },
        student: { id: studentUser.id, name: studentUser.name },
        title: 'Discrete Mathematics & Logic',
        scheduledAt: new Date(now - 5 * 60 * 1000).toISOString(),
        durationMin: 60,
        status: 'confirmed'
      };

      await page.route('**/api/sessions', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([mockSession]) });
      });
      await page.route(`**/api/sessions/${sessionId}`, async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSession) });
      });

      await page.goto(`/live-room/${sessionId}`);
      const joinBtn = page.locator('[data-testid="join-classroom-btn"]');
      await joinBtn.waitFor({ state: 'visible', timeout: 10000 });
      await joinBtn.click();

      // Open People tab
      const peopleTab = page.locator('button[role="tab"]:has-text("People")');
      if (await peopleTab.isVisible()) {
        await peopleTab.click();
        await page.waitForTimeout(400);
        const peoplePath = `screenshots/phase5/liveroom_people_tab_${vp.name}.png`;
        await page.screenshot({ path: peoplePath });
        saveAndMirror(peoplePath, `liveroom_people_tab_${vp.name}.png`);
      }

      // Trigger End session confirmation modal
      const endBtn = page.locator('[data-testid="end-session-btn"]').first();
      await endBtn.waitFor({ state: 'visible', timeout: 10000 });
      await endBtn.click();
      await page.waitForTimeout(300);

      const modalPath = `screenshots/phase5/liveroom_end_session_modal_${vp.name}.png`;
      await page.screenshot({ path: modalPath });
      saveAndMirror(modalPath, `liveroom_end_session_modal_${vp.name}.png`);
    });

    test(`Capture Student Removed Screen at ${vp.name}px`, async ({ browser }) => {
      const teacherContext = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const studentContext = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });

      const teacherPage = await teacherContext.newPage();
      const studentPage = await studentContext.newPage();

      const tUser = {
        id: 'teacher-e2e-kick',
        name: 'Professor Claude Shannon',
        email: 'claude.shannon@mindroot.dev',
        role: 'teacher',
        tokenBalance: 800,
        trustScore: 4.99
      };

      const sUser = {
        id: 'student-e2e-kick',
        name: 'Grace Hopper',
        email: 'grace.hopper@mindroot.dev',
        role: 'student',
        tokenBalance: 150,
        trustScore: 4.95
      };

      await teacherPage.addInitScript((u) => {
        localStorage.setItem('mindroot_current_user', JSON.stringify(u));
        localStorage.setItem('mindroot_auth_token', 'dev-token-' + u.id);
        localStorage.setItem('mindroot_current_role', 'teacher');
        localStorage.setItem('mindroot_theme', 'light');
      }, tUser);

      await studentPage.addInitScript((u) => {
        localStorage.setItem('mindroot_current_user', JSON.stringify(u));
        localStorage.setItem('mindroot_auth_token', 'dev-token-' + u.id);
        localStorage.setItem('mindroot_current_role', 'student');
        localStorage.setItem('mindroot_theme', 'light');
      }, sUser);

      const now = Date.now();
      const sessionId = 'session-p520-cap-' + vp.name + '-' + now;
      const mockSession = {
        id: sessionId,
        teacherId: tUser.id,
        studentId: sUser.id,
        teacher: { id: tUser.id, name: tUser.name },
        student: { id: sUser.id, name: sUser.name },
        title: 'Information Theory & Signal Processing',
        scheduledAt: new Date(now - 5 * 60 * 1000).toISOString(),
        durationMin: 60,
        status: 'confirmed'
      };

      const mockApi = async (p: any) => {
        await p.route('**/api/config', async (route: any) => {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ demoMode: true }) });
        });
        await p.route('**/api/sessions', async (route: any) => {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([mockSession]) });
        });
        await p.route(`**/api/sessions/${sessionId}`, async (route: any) => {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSession) });
        });
      };

      await mockApi(teacherPage);
      await mockApi(studentPage);

      // Teacher joins
      await teacherPage.goto(`/live-room/${sessionId}`);
      const tEnterBtn = teacherPage.locator('[data-testid="join-classroom-btn"]');
      await tEnterBtn.waitFor({ state: 'visible', timeout: 10000 });
      await tEnterBtn.click();

      // Student joins
      await studentPage.goto(`/live-room/${sessionId}`);
      const sEnterBtn = studentPage.locator('[data-testid="join-classroom-btn"]');
      await sEnterBtn.waitFor({ state: 'visible', timeout: 10000 });
      await sEnterBtn.click();

      // Teacher switches to People tab
      const peopleTab = teacherPage.locator('button[role="tab"]:has-text("People")');
      await expect(peopleTab).toBeVisible({ timeout: 10000 });
      await peopleTab.click();

      // Teacher removes student
      const removeBtn = teacherPage.locator('[data-testid="remove-student-btn"]').first();
      await expect(removeBtn).toBeVisible({ timeout: 10000 });
      await removeBtn.click();

      // Teacher confirms
      const confirmKickBtn = teacherPage.locator('[data-testid="confirm-kick-student-btn"]');
      await confirmKickBtn.click();

      // Student receives removal
      const kickedOverlay = studentPage.locator('[data-testid="kicked-notice-overlay"]');
      await expect(kickedOverlay).toBeVisible({ timeout: 10000 });

      const kickedPath = `screenshots/phase5/liveroom_kicked_screen_${vp.name}.png`;
      await studentPage.screenshot({ path: kickedPath });
      saveAndMirror(kickedPath, `liveroom_kicked_screen_${vp.name}.png`);

      await teacherContext.close();
      await studentContext.close();
    });
  }
});
