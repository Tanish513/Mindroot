import { test, expect } from '@playwright/test';

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

test.describe('P5.21 Live Room End Meeting Ends for Everyone', () => {
  test('Teacher ends meeting ends for everyone, student sees post-session modal', async ({ browser }) => {
    const teacherContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const studentContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });

    const teacherPage = await teacherContext.newPage();
    const studentPage = await studentContext.newPage();

    await teacherPage.addInitScript((u) => {
      localStorage.setItem('mindroot_current_user', JSON.stringify(u));
      localStorage.setItem('mindroot_auth_token', 'dev-token-' + u.id);
      localStorage.setItem('mindroot_current_role', 'teacher');
      localStorage.setItem('mindroot_theme', 'light');
    }, teacherUser);

    await studentPage.addInitScript((u) => {
      localStorage.setItem('mindroot_current_user', JSON.stringify(u));
      localStorage.setItem('mindroot_auth_token', 'dev-token-' + u.id);
      localStorage.setItem('mindroot_current_role', 'student');
      localStorage.setItem('mindroot_theme', 'light');
    }, studentUser);

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

    const mockApi = async (page: any) => {
      await page.route('**/api/config', async (route: any) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ demoMode: true }) });
      });
      await page.route('**/api/sessions', async (route: any) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([mockSession]) });
      });
      await page.route(`**/api/sessions/${sessionId}`, async (route: any) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSession) });
      });
    };

    await mockApi(teacherPage);
    await mockApi(studentPage);

    // 1. Teacher enters live room
    await teacherPage.goto(`/live-room/${sessionId}`);
    const tEnterBtn = teacherPage.locator('[data-testid="join-classroom-btn"]');
    await tEnterBtn.waitFor({ state: 'visible', timeout: 10000 });
    await tEnterBtn.click();

    // 2. Student enters live room
    await studentPage.goto(`/live-room/${sessionId}`);
    const sEnterBtn = studentPage.locator('[data-testid="join-classroom-btn"]');
    await sEnterBtn.waitFor({ state: 'visible', timeout: 10000 });
    await sEnterBtn.click();

    // Verify teacher sees "End" button
    const teacherEndBtn = teacherPage.locator('[data-testid="end-session-btn"]').first();
    await expect(teacherEndBtn).toBeVisible({ timeout: 10000 });

    // Verify student sees "Leave" button
    const studentLeaveBtn = studentPage.locator('[data-testid="leave-room-btn"]').first();
    await expect(studentLeaveBtn).toBeVisible({ timeout: 10000 });

    // Teacher clicks End button -> confirm modal opens
    await teacherEndBtn.click();
    const endModal = teacherPage.locator('[data-testid="end-session-modal"]');
    await expect(endModal).toBeVisible();

    // Teacher confirms "End Session for All"
    const confirmBtn = teacherPage.locator('[data-testid="confirm-end-session-for-all-btn"]');
    await confirmBtn.click();

    // Student receives session-ended-by-host and sees Session Ended modal
    const endedModal = studentPage.locator('[data-testid="session-ended-modal"]');
    await expect(endedModal).toBeVisible({ timeout: 10000 });
    await expect(studentPage.locator('text=Session ended').first()).toBeVisible();

    await teacherContext.close();
    await studentContext.close();
  });
});
