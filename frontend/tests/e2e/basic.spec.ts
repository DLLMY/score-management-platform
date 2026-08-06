import { test, expect } from '@playwright/test';

test('页面应正常加载', async ({ page }) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(30000);

  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBe(200);

  await expect(page).toHaveTitle(/积分管理平台/);

  const content = await page.content();
  expect(content.length).toBeGreaterThan(0);

  // 未登录时前端路由守卫会将根路径重定向到登录页，确认页面已在 localhost:3000 正常渲染
  await expect(page).toHaveURL(/localhost:3000/);
  await expect(page.getByRole('heading', { name: '积分管理平台' })).toBeVisible({ timeout: 10000 });
});
