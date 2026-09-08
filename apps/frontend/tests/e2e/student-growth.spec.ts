import { test, expect, Page } from '@playwright/test';

/**
 * 算法洞察业务闭环 e2e（本轮新功能固化）
 * 覆盖：
 *  1) 学生端「我的成长」Tab：参与度/风险预警/积分趋势卡片渲染；
 *  2) 教师端「算法洞察」入口卡片 + 点「班级归因一键查看」跳转直达 batchAttribution Tab。
 * 运行：`npm run test:e2e -- --project=chrome student-growth.spec.ts`（需后端 5000 已启动）
 */

/** admin 登录 */
async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/#/login', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="text"]').first().fill('admin');
  await page.locator('input[type="password"]').first().fill('123456');
  await page.locator('button:has-text("登录")').first().click();
  await expect(page.getByRole('navigation')).toBeVisible({ timeout: 20000 });
}

/** 用真实学生凭据（一年级1班）完成学生端登录并注入 localStorage */
async function loginAsStudent(page: Page): Promise<string> {
  const loginResp = await page.request.post('/api/auth/login', {
    data: { username: 'admin', password: '123456' },
  });
  const lj = await loginResp.json();
  const adminToken = lj.data?.access_token || lj.access_token;

  const clsResp = await page.request.get(
    `/api/classes/${encodeURIComponent('一年级1班')}/students`,
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  const cj = await clsResp.json();
  const arr = cj.data?.students || cj.students || cj.data || [];
  expect(arr.length, '一年级1班应有学生数据').toBeGreaterThan(0);
  const stu = arr[0];

  const sResp = await page.request.post('/api/student/login', {
    data: { card_id: stu.card_id, name: stu.name },
  });
  const sj = await sResp.json();
  const token = sj.data?.access_token || sj.access_token;
  expect(token, '学生登录应返回 token').toBeTruthy();

  // 注入学生态（先进入同源页面）
  await page.goto('/#/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ t, info }) => {
      localStorage.setItem('student_token', t);
      localStorage.setItem('student', JSON.stringify(info));
    },
    { t: token, info: sj.data.student }
  );
  return stu.name as string;
}

test.describe('算法洞察业务闭环', () => {
  test.describe.configure({ mode: 'serial' });

  test('学生端「我的成长」Tab 渲染参与度/风险/趋势卡片', async ({ page }) => {
    test.setTimeout(120000);
    page.setDefaultTimeout(20000);
    const stuName = await loginAsStudent(page);

    await page.goto('/#/student', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    // 学生身份显示
    await expect(page.getByText(stuName)).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: '我的成长' }).click();
    await page.waitForTimeout(3000);

    await expect(page.getByText('我的参与度指数')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('风险预警')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/近 8 周积分变动/)).toBeVisible({ timeout: 10000 });
  });

  test('教师端「算法洞察」入口 + 班级归因一键查看直达', async ({ page }) => {
    test.setTimeout(120000);
    page.setDefaultTimeout(20000);
    await loginAsAdmin(page);

    await page.goto('/#/teacher-tools', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await expect(page.getByText('算法洞察')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('班级归因一键查看')).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: '班级归因一键查看' }).click();
    await page.waitForTimeout(3000);
    expect(page.url()).toContain('tab=batchAttribution');
    // 目标 Tab 内容渲染（生成按钮出现）
    await expect(page.getByRole('button', { name: /生成全班成绩波动归因/ }).first()).toBeVisible({
      timeout: 10000,
    });
  });
});
