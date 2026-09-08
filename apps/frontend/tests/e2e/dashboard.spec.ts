import { test, expect } from '@playwright/test';

test.describe('仪表盘页面', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(90000);
    page.setDefaultTimeout(20000);
    await page.goto('/');
    await page.getByPlaceholder('请输入用户名').fill('admin');
    await page.getByPlaceholder('请输入密码').fill('123456');
    await page.getByRole('button', { name: '登录' }).click();
    // 该前端为 hash-router SPA，登录后通过 URL hash 切换路由而非整页导航，
    // 因此不能用 waitForNavigation()；侧边栏（navigation）出现即代表已进入主布局。
    await expect(page.getByRole('navigation')).toBeVisible({ timeout: 15000 });
  });

  test('仪表盘页面应正常显示', async ({ page }) => {
    const sidebar = page.getByRole('navigation');
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByText('数据概览')).toBeVisible();
  });

  test('侧边栏菜单应正常显示', async ({ page }) => {
    const sidebar = page.getByRole('navigation');
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByText('数据概览')).toBeVisible();
    await expect(sidebar.getByText('学生管理')).toBeVisible();
    await expect(sidebar.getByText('积分管理')).toBeVisible();
  });

  test('点击侧边栏菜单应导航到对应页面', async ({ page }) => {
    const sidebar = page.getByRole('navigation');
    await sidebar.getByText('学生管理').click();
    await expect(page).toHaveURL(/users/);
    await expect(page.getByRole('heading', { name: '学生管理' })).toBeVisible();

    await sidebar.getByText('数据分析').click();
    await expect(page).toHaveURL(/analysis/);
  });

  test('响应式设计：移动端视口下侧边栏正常渲染', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    // 缩小到移动端视口后，侧边栏（桌面版 nav）仍应正常渲染且可见，
    // 布局不崩（实际会折叠为图标模式，文本标签隐藏）。
    await expect(page.locator('nav.relative.z-10')).toBeVisible();
  });
});
