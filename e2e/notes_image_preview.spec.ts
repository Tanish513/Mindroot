import { test, expect } from '@playwright/test';

test.describe('Notes Image Upload, Preview & Lightbox', () => {
  const mockUser = {
    id: 'e2e-user-1',
    name: 'Alex Rivera',
    email: 'alex@mindroot.dev',
    role: 'student',
    tokenBalance: 120,
    trustScore: 4.9
  };

  const mockNote = {
    id: 'note-with-image-1',
    title: 'Thermodynamics Lecture Notes',
    content: '<p>Key formulas from today class.</p><p><img src="/uploads/notes/1793879799220-22752f07e5c551ca3c07f394ad325587.jpg" alt="Embedded Carnot Diagram" /></p>',
    type: 'regular',
    authorId: 'e2e-user-1',
    visibility: 'private',
    tags: ['physics', 'thermo'],
    attachments: [
      {
        name: 'carnot_cycle_diagram.png',
        url: '/uploads/notes/1793879799220-22752f07e5c551ca3c07f394ad325587.jpg',
        type: 'image/jpeg',
        size: 172974
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem('mindroot_current_user', JSON.stringify(user));
      localStorage.setItem('mindroot_auth_token', 'dev-token-' + user.id);
      localStorage.setItem('mindroot_current_role', 'student');
    }, mockUser);

    await page.route('**/api/users/me', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockUser) });
    });

    await page.route('**/api/sessions**', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.route('**/api/notes/tags', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(['physics', 'thermo']) });
    });

    await page.route('**/api/notes/daily/**', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ streak: 1 }) });
    });

    await page.route(/\/api\/notes(\?.*)?$/, async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([mockNote])
        });
      } else {
        await route.continue();
      }
    });
  });

  test('Attachment image opens lightbox modal and provides open/download actions', async ({ page }) => {
    // Navigate to Notes page
    await page.goto('/notes');

    // Find and click the note card
    const noteCard = page.locator('text=Thermodynamics Lecture Notes').first();
    await expect(noteCard).toBeVisible({ timeout: 10000 });
    await noteCard.click();

    // The NoteEditor modal should be open
    await expect(page.locator('input[placeholder*="Note Title"]').first()).toHaveValue('Thermodynamics Lecture Notes');

    // Verify the image attachment is rendered with an image tag
    const attachmentImg = page.locator('img[alt="carnot_cycle_diagram.png"]');
    await expect(attachmentImg).toBeVisible();

    // Verify the image source is NOT broken or empty, and resolves to the backend / uploads path
    const imgSrc = await attachmentImg.getAttribute('src');
    expect(imgSrc).toBeTruthy();
    expect(imgSrc).toContain('/uploads/notes/');

    // Click the image thumbnail to trigger the Lightbox Preview Modal
    await attachmentImg.click();

    // Verify Lightbox Preview Modal is displayed
    const lightboxModal = page.locator('div[class*="fixed inset-0 z-50"]').filter({ hasText: 'carnot_cycle_diagram.png' });
    await expect(lightboxModal.first()).toBeVisible();

    // Verify Lightbox has "Open in tab" and "Download" buttons
    await expect(page.locator('a[title="Open original image in new tab"]')).toBeVisible();
    await expect(page.locator('a[title="Download image"]')).toBeVisible();

    // Verify the full image is rendered in the Lightbox
    const fullImg = page.locator('div[class*="min-h-[300px]"] img');
    await expect(fullImg).toBeVisible();

    // Close the lightbox using close button
    const closeLightboxBtn = page.locator('button[aria-label="Close image preview"]');
    await closeLightboxBtn.click();
    await expect(page.locator('div[class*="min-h-[300px]"] img')).not.toBeVisible();
  });

  test('Clicking an image embedded inside note content opens the Lightbox preview', async ({ page }) => {
    await page.goto('/notes');

    const noteCard = page.locator('text=Thermodynamics Lecture Notes').first();
    await expect(noteCard).toBeVisible({ timeout: 10000 });
    await noteCard.click();

    // Find the embedded image inside the note content
    const embeddedImg = page.locator('div[contenteditable="true"] img, .prose img').first();
    await expect(embeddedImg).toBeVisible();

    // Click the embedded image
    await embeddedImg.click();

    // Verify Lightbox modal opens
    await expect(page.locator('div[class*="min-h-[300px]"] img')).toBeVisible();

    // Press Escape to close
    await page.keyboard.press('Escape');
    await expect(page.locator('div[class*="min-h-[300px]"] img')).not.toBeVisible();
  });
});
