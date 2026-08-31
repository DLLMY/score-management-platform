import { test, expect } from '@playwright/test';

/**
 * 登录页测试（已加固，修复历史偶发失败）：
 * - 串行执行：登录页含全局 socket.io 长连接，并行多 context 关闭时易触发
 *   browserContext.close 超时误报；
 * - test.setTimeout(90000) 给 teardown 留足余量；
 * - 脆弱断言（title().toBe）改为 toHaveTitle（自动重试）。
 */
test.describe('登录页面', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(90000);
    page.setDefaultTimeout(20000);
  });

  test('页面应正常显示登录表单', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: '积分管理平台' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder('请输入用户名')).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder('请输入密码')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible({ timeout: 10000 });
  });

  test('页面标题应为积分管理平台', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/积分管理平台/);
  });

  test('页面应包含用户名输入框', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const input = page.getByPlaceholder('请输入用户名');
    await expect(input).toBeVisible({ timeout: 10000 });
    await input.fill('testuser');
    await expect(input).toHaveValue('testuser');
  });

  test('页面应包含密码输入框', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const input = page.getByPlaceholder('请输入密码');
    await expect(input).toBeVisible({ timeout: 10000 });
    await input.fill('testpassword');
    await expect(input).toHaveValue('testpassword');
  });
});
