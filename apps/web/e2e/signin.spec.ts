import { test, expect } from '@playwright/test';

test.describe('signin', () => {
  test('shows the magic-link form with brand voice', async ({ page }) => {
    await page.goto('/signin');
    await expect(page.getByRole('heading')).toContainText(/sign in/i);
    await expect(page.getByText(/no password/i)).toBeVisible();
    await expect(page.getByPlaceholder('you@domain.com')).toBeVisible();
    await expect(page.getByRole('button', { name: /send sign-in link/i })).toBeVisible();
  });

  test('rejects empty email submit', async ({ page }) => {
    await page.goto('/signin');
    const submit = page.getByRole('button', { name: /send sign-in link/i });
    await submit.click();
    // Native HTML5 required attribute should keep us on the page
    await expect(page).toHaveURL(/\/signin/);
  });
});
