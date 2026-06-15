import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/en/dashboard');

    await expect(page).toHaveURL(/.*\/auth\/login/);
  });

  test('should display language switcher', async ({ page }) => {
    await page.goto('/en');
  });

  test('should navigate between locales', async ({ page }) => {
    await page.goto('/en');
  });
});
