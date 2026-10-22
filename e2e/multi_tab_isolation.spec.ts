import { test, expect } from '@playwright/test';

const teacherUser = {
  id: 'user-demo-priya-mentor',
  name: 'Dr. Priya Sharma',
  email: 'priya.sharma@mindroot.com',
  role: 'teacher',
  trustScore: 4.98,
  tokenBalance: 480
};

const studentUser = {
  id: 'user-demo-student',
  name: 'Aarav Patel',
  email: 'aarav.patel@mindroot.com',
  role: 'student',
  trustScore: 4.95,
  tokenBalance: 250
};

test.describe('Multi-Tab Session Isolation Suite', () => {
  test('Two tabs in the same browser context retain independent accounts without clobbering each other', async ({ context }) => {
    // 1. Tab 1: Initialize as Teacher (Dr. Priya Sharma)
    const tab1 = await context.newPage();
    await tab1.addInitScript((teacher) => {
      sessionStorage.setItem('mindroot_current_user', JSON.stringify(teacher));
      sessionStorage.setItem('mindroot_auth_token', 'dev-token-' + teacher.id);
      sessionStorage.setItem('mindroot_current_role', 'teacher');
      sessionStorage.setItem('mindroot_login_role', 'teacher');
    }, teacherUser);

    await tab1.goto('/dashboard');
    await expect(tab1.locator('body')).toBeVisible();

    // Verify Tab 1 has Teacher user in session storage
    const tab1UserId = await tab1.evaluate(() => {
      const u = sessionStorage.getItem('mindroot_current_user');
      return u ? JSON.parse(u).id : null;
    });
    expect(tab1UserId).toBe('user-demo-priya-mentor');

    // 2. Tab 2: Open a new tab in the same context and initialize as Student (Aarav Patel)
    const tab2 = await context.newPage();
    await tab2.addInitScript((student) => {
      sessionStorage.setItem('mindroot_current_user', JSON.stringify(student));
      sessionStorage.setItem('mindroot_auth_token', 'dev-token-' + student.id);
      sessionStorage.setItem('mindroot_current_role', 'student');
      sessionStorage.setItem('mindroot_login_role', 'student');
    }, studentUser);

    await tab2.goto('/dashboard');
    await expect(tab2.locator('body')).toBeVisible();

    // Verify Tab 2 has Student user in session storage
    const tab2UserId = await tab2.evaluate(() => {
      const u = sessionStorage.getItem('mindroot_current_user');
      return u ? JSON.parse(u).id : null;
    });
    expect(tab2UserId).toBe('user-demo-student');

    // 3. Reload Tab 1 and verify it does NOT flip to Student
    await tab1.reload();
    const tab1AfterReload = await tab1.evaluate(() => {
      const u = sessionStorage.getItem('mindroot_current_user');
      return u ? JSON.parse(u).id : null;
    });
    expect(tab1AfterReload).toBe('user-demo-priya-mentor');

    // 4. Reload Tab 2 and verify it remains Student
    await tab2.reload();
    const tab2AfterReload = await tab2.evaluate(() => {
      const u = sessionStorage.getItem('mindroot_current_user');
      return u ? JSON.parse(u).id : null;
    });
    expect(tab2AfterReload).toBe('user-demo-student');

    // Close both tabs
    await tab1.close();
    await tab2.close();
  });
});
