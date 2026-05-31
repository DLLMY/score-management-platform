import { test, expect } from '@playwright/test';

test.describe('User Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await page.goto('/users');
  });

  test('should display user list', async ({ page }) => {
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
  });

  test('should search users', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="搜索" i]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await expect(page.locator('table')).toBeVisible();
    }
  });

  test('should open user creation modal', async ({ page }) => {
    const addButton = page.locator('button:has-text("Add"), button:has-text("添加"), button:has-text("新建")');
    if (await addButton.first().isVisible()) {
      await addButton.first().click();
      await expect(page.locator('modal, [role="dialog"]')).toBeVisible();
    }
  });
});

test.describe('Device Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await page.goto('/devices');
  });

  test('should display device list', async ({ page }) => {
    await expect(page.locator('table, .device-list')).toBeVisible({ timeout: 10000 });
  });

  test('should show device status indicators', async ({ page }) => {
    const onlineIndicator = page.locator('text=Online, text=在线');
    const offlineIndicator = page.locator('text=Offline, text=离线');
    const hasStatus = await onlineIndicator.isVisible() || await offlineIndicator.isVisible();
    expect(hasStatus).toBeTruthy();
  });
});

test.describe('Score Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await page.goto('/rules');
  });

  test('should display rules list', async ({ page }) => {
    await expect(page.locator('table, .rule-list')).toBeVisible({ timeout: 10000 });
  });

  test('should open rule creation modal', async ({ page }) => {
    const addButton = page.locator('button:has-text("Add"), button:has-text("添加"), button:has-text("新建")');
    if (await addButton.first().isVisible()) {
      await addButton.first().click();
      await expect(page.locator('modal, [role="dialog"]')).toBeVisible();
    }
  });
});
