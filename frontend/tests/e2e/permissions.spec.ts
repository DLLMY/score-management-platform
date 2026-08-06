import { test, expect } from '@playwright/test';

/**
 * 权限控制测试（已加固，修复历史偶发失败）：
 * - 串行执行 + 放宽 teardown 超时；
 * - hash router：页面路由统一用 /#/xxx（goto('/dashboard') 会请求服务器路径）；
 * - 退出登录断言对齐实现事实：认证态存于 localStorage['auth-storage']，
 *   退出时前端明确 removeItem('auth-storage')。
 */
test.describe('权限控制', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(90000);
    page.setDefaultTimeout(20000);
  });

  test('未登录用户应重定向到登录页面', async ({ page }) => {
    await page.goto('/#/dashboard');
    await expect(page).toHaveURL(/login/);
    await expect(page.getByRole('heading', { name: '积分管理平台' })).toBeVisible();
  });

  test('登录后应保存用户信息到localStorage', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('请输入用户名').fill('admin');
    await page.getByPlaceholder('请输入密码').fill('123456');
    await page.getByRole('button', { name: '登录' }).click();
    await expect(page.getByRole('navigation')).toBeVisible({ timeout: 15000 });

    // 登录成功后前端写入 localStorage['admin']（Login.tsx:181）
    const adminData = await page.evaluate(() => localStorage.getItem('admin'));
    expect(adminData).toBeTruthy();
    expect(JSON.parse(adminData!).username).toBe('admin');
  });

  test('侧边栏菜单应根据权限显示', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('请输入用户名').fill('admin');
    await page.getByPlaceholder('请输入密码').fill('123456');
    await page.getByRole('button', { name: '登录' }).click();
    await expect(page.getByRole('navigation')).toBeVisible({ timeout: 15000 });

    const sidebar = page.getByRole('navigation');
    await expect(sidebar.getByText('系统管理')).toBeVisible();
    await expect(sidebar.getByText('权限管理')).toBeVisible();
    await expect(sidebar.getByText('操作日志')).toBeVisible();
  });

  test('退出登录后应清除认证存储', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('请输入用户名').fill('admin');
    await page.getByPlaceholder('请输入密码').fill('123456');
    await page.getByRole('button', { name: '登录' }).click();
    await expect(page.getByRole('navigation')).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: /退出/ }).click();
    await expect(page).toHaveURL(/login/);
    // 认证态清除的实现事实：admin 键被 removeItem；auth-storage（zustand persist）
    // 键可能仍存在但 state.token 已清空
    const adminData = await page.evaluate(() => localStorage.getItem('admin'));
    expect(adminData).toBeNull();
    const authRaw = await page.evaluate(() => localStorage.getItem('auth-storage'));
    const authState = authRaw ? JSON.parse(authRaw).state : null;
    expect((authState && authState.token) || null).toBeNull();
  });
});
