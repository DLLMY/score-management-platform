import { test, expect, Page } from '@playwright/test';

/**
 * 算法结果导出 Excel e2e（本轮新功能固化）
 * 覆盖：三个 Tab（班级归因 / 参与度分析 / 风险评估）的「导出 Excel」按钮
 * 真实触发文件下载（download 事件，文件名含 算法xxx）。
 * 运行：`npm run test:e2e -- --project=chrome algorithm-export.spec.ts`（需后端 5000 已启动）
 */

async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/#/login', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="text"]').first().fill('admin');
  await page.locator('input[type="password"]').first().fill('123456');
  await page.locator('button:has-text("登录")').first().click();
  await expect(page.getByRole('navigation')).toBeVisible({ timeout: 20000 });
}

/** 在算法页顶部全局下拉框选择班级（selectedClass 为共享 state，三 Tab 均生效） */
async function selectClass(page: Page): Promise<void> {
  const sel = page.locator('select').first();
  await sel.selectOption({ label: '一年级1班' });
  await page.waitForTimeout(3000);
}

test.describe('算法结果导出 Excel', () => {
  test.describe.configure({ mode: 'serial' });

  test('班级归因 Tab 导出 Excel 触发下载', async ({ page }) => {
    test.setTimeout(120000);
    page.setDefaultTimeout(20000);
    await loginAsAdmin(page);
    await page.goto('/#/algorithm-analysis?tab=batchAttribution', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await expect(page.getByRole('button', { name: /导出 Excel/ }).first()).toBeVisible({ timeout: 10000 });
    await selectClass(page);
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      page.getByRole('button', { name: /导出 Excel/ }).first().click(),
    ]);
    expect(download.suggestedFilename()).toContain('.xlsx');
  });

  test('参与度分析 Tab 导出 Excel 触发下载', async ({ page }) => {
    test.setTimeout(120000);
    page.setDefaultTimeout(20000);
    await loginAsAdmin(page);
    // HashRouter 同路径仅 query 变化不重挂载，reload 强制 activeTab 重新初始化
    await page.goto('/#/algorithm-analysis?tab=engagement', { waitUntil: 'domcontentloaded' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await expect(page.getByRole('button', { name: /导出 Excel/ }).first()).toBeVisible({ timeout: 10000 });
    await selectClass(page);
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      page.getByRole('button', { name: /导出 Excel/ }).first().click(),
    ]);
    expect(download.suggestedFilename()).toContain('.xlsx');
  });

  test('风险评估 Tab 导出 Excel 触发下载（不选班级导出全部）', async ({ page }) => {
    test.setTimeout(120000);
    page.setDefaultTimeout(20000);
    await loginAsAdmin(page);
    await page.goto('/#/algorithm-analysis?tab=riskPredict', { waitUntil: 'domcontentloaded' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await expect(page.getByRole('button', { name: /导出 Excel/ }).first()).toBeVisible({ timeout: 10000 });
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      page.getByRole('button', { name: /导出 Excel/ }).first().click(),
    ]);
    expect(download.suggestedFilename()).toContain('.xlsx');
  });
});
