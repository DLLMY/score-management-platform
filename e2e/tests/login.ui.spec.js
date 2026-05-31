import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login form', async ({ page }) => {
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    await page.click('button[type="submit"]');
    await expect(page.locator('.text-red-500')).toBeVisible();
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
  });
});

test.describe('Navigation', () => {
  test('should navigate between pages', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.click('text=User List');
    await expect(page).toHaveURL('/users');

    await page.click('text=Device Management');
    await expect(page).toHaveURL('/devices');
  });

  test('should toggle sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
  });
});
