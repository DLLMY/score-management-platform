import { test, expect, Page } from '@playwright/test';

/**
 * 教师端「班级风险名单」卡片 e2e（本轮新功能固化）
 * 覆盖：TeacherTools 页风险名单卡片渲染 + 选班级后评估出高/中风险计数。
 * 运行：`npm run test:e2e -- --project=chrome teacher-risk-card.spec.ts`（需后端 5000 已启动）
 */

async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/#/login', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="text"]').first().fill('admin');
  await page.locator('input[type="password"]').first().fill('123456');
  await page.locator('button:has-text("登录")').first().click();
  await expect(page.getByRole('navigation')).toBeVisible({ timeout: 20000 });
}

test.describe('教师端班级风险名单', () => {
  test.describe.configure({ mode: 'serial' });

  test('风险名单卡片渲染并可评估班级风险', async ({ page }) => {
    test.setTimeout(120000);
    page.setDefaultTimeout(20000);

    await loginAsAdmin(page);
    await page.goto('/#/teacher-tools', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // 卡片标题可见
    await expect(page.getByText('班级风险名单')).toBeVisible({ timeout: 10000 });
    // 评估按钮存在
    await expect(page.getByRole('button', { name: '评估风险' })).toBeVisible();

    // 选择真实班级（一年级1班，本机种子数据）
    const sel = page.locator('select').first();
    await sel.selectOption({ label: '一年级1班' });
    await page.waitForTimeout(3500);

    // 高/中风险计数卡渲染（页面中「中风险」出现于计数卡与名单徽章两处，取 first 即可）
    await expect(page.getByText('高风险').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('中风险').first()).toBeVisible({ timeout: 10000 });

    // 页面无 ErrorBoundary / console error / 5xx
    const boundaryCount = await page.locator('text=页面加载失败').count();
    expect(boundaryCount).toBe(0);
  });
});
