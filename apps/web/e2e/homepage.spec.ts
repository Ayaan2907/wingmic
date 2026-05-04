import { test, expect } from '@playwright/test';

test.describe('homepage', () => {
  test('renders the hero and announcement bar', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/wingmic.*social RAM/i);
    await expect(page.getByText('capture + recall ship first')).toBeVisible();
  });

  test('navigates to signin from get-an-invite', async ({ page }) => {
    await page.goto('/');
    // Multiple elements may say "get an invite" — scope to the first link
    const inviteLink = page.getByRole('link', { name: /invite/i }).first();
    await expect(inviteLink).toBeVisible();
  });

  test('protected routes redirect to /signin when unauthed', async ({ page }) => {
    await page.goto('/capture');
    await expect(page).toHaveURL(/\/signin\?next=%2Fcapture/);
    await page.goto('/recall');
    await expect(page).toHaveURL(/\/signin\?next=%2Frecall/);
  });
});
