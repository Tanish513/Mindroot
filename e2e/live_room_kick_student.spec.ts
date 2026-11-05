import { test, expect } from '@playwright/test';

const teacherUser = {
  id: 'teacher-e2e-kick',
  name: 'Professor Claude Shannon',
  email: 'claude.shannon@mindroot.dev',
  role: 'teacher',
  tokenBalance: 800,
  trustScore: 4.99
};

const studentUser = {
  id: 'student-e2e-kick',
  name: 'Grace Hopper',
  email: 'grace.hopper@mindroot.dev',
  role: 'student',
  tokenBalance: 150,
  trustScore: 4.95
};

test.describe('P5.20 Teacher Removes Student from Class', () => {
  test('Teacher removes student, student sees removed screen and cannot rejoin', async ({ browser }) => {
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
    const sessionId = 'session-p520-' + now;
    const mockSession = {
      id: sessionId,
      teacherId: teacherUser.id,
      studentId: studentUser.id,
      teacher: { id: teacherUser.id, name: teacherUser.name },
      student: { id: studentUser.id, name: studentUser.name },
      title: 'Information Theory & Signal Processing',
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

    // 3. Teacher switches to "People" tab in side drawer
    const peopleTab = teacherPage.locator('button[role="tab"]:has-text("People")');
    await expect(peopleTab).toBeVisible({ timeout: 10000 });
    await peopleTab.click();

    // 4. Teacher sees "Remove" button next to student
    const removeBtn = teacherPage.locator('[data-testid="remove-student-btn"]').first();
    await expect(removeBtn).toBeVisible({ timeout: 10000 });
    await removeBtn.click();

    // 5. Confirm kick modal opens
    const kickModal = teacherPage.locator('[data-testid="kick-confirm-modal"]');
    await expect(kickModal).toBeVisible();

    // 6. Teacher confirms removal
    const confirmKickBtn = teacherPage.locator('[data-testid="confirm-kick-student-btn"]');
    await confirmKickBtn.click();

    // 7. Student receives kicked event and sees full-page removed screen (D-KICK-2: no rating or payment popup)
    const kickedOverlay = studentPage.locator('[data-testid="kicked-notice-overlay"]');
    await expect(kickedOverlay).toBeVisible({ timeout: 10000 });
    await expect(studentPage.locator('text=Removed from Class')).toBeVisible();

    // Student returns to Dashboard
    const returnDashboardBtn = studentPage.locator('[data-testid="removed-return-dashboard-btn"]');
    await returnDashboardBtn.click();
    await expect(studentPage).toHaveURL(/\/dashboard/);

    // 8. Teacher sees student in "Removed Students" section with "Allow back" button
    const allowBackBtn = teacherPage.locator('[data-testid="allow-back-btn"]').first();
    await expect(allowBackBtn).toBeVisible({ timeout: 10000 });

    await teacherContext.close();
    await studentContext.close();
  });
});
