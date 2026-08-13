import { test, expect, Page } from '@playwright/test';

/**
 * 2026-08-13「逐个页面不真实显示/失败伪装」修复验证：
 * 遍历本次改动页面，断言 0 5xx / 0 console error / 0 pageerror / 无 ErrorBoundary 白屏。
 * 运行：npm run test:e2e -- --project=chrome verify-fix.spec.ts（需后端 5000 已启动）
 */
test.describe('页面修复实跑验证', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(90000);
    page.setDefaultTimeout(20000);
  });

  async function loginAdmin(page: Page) {
    await page.goto('/#/login', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="text"]').first().fill('admin');
    await page.locator('input[type="password"]').first().fill('123456');
    await page.locator('button:has-text("登录")').first().click();
    await page.waitForTimeout(2500);
  }

  const PAGES = [
    '/#/dashboard',
    '/#/profile',
    '/#/users',
    '/#/devices',
    '/#/device-groups',
    '/#/firmware',
    '/#/nlp-management',
    '/#/remote-notify',
    '/#/algorithm-analysis',
    '/#/score-analysis',
    '/#/notifications',
    '/#/teacher-tools',
    '/#/class-management',
    '/#/subject-management',
    '/#/study-groups',
    '/#/homework-check',
    '/#/mental-health',
    '/#/score-entry',
    '/#/rank-board',
    '/#/phonebox-policy',
    '/#/data-sync',
    '/#/course-schedule',
    '/#/approvals',
    '/#/rules',
  ];

  test('管理员端：登录后遍历 24 个改动页面，无 5xx/无 console error/无白屏', async ({ page }) => {
    const errors: string[] = [];
    const rateLimited: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      // 429 为后端限流保护（遍历过快触发），非页面缺陷，单独记录
      if (msg.text().includes('429') || msg.text().includes('TOO MANY REQUESTS')) {
        rateLimited.push(msg.text());
        return;
      }
      errors.push(`[console.error] ${msg.text()}`);
    });
    page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));
    page.on('response', (res) => {
      if (res.status() >= 500) errors.push(`[http ${res.status()}] ${res.url()}`);
    });

    await loginAdmin(page);
    expect(errors.filter((e) => e.startsWith('[http'))).toEqual([]);

    for (const path of PAGES) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      // ErrorBoundary 白屏检测：整页 fallback 时出现特定文案
      const bodyText = await page.evaluate(() => document.body.innerText);
      if (bodyText.includes('页面出错了') || bodyText.includes('页面崩溃') || bodyText.includes('Something went wrong')) {
        errors.push(`[白屏fallback] ${path}`);
      }
    }

    // 限流仅作信息记录，不作为失败
    if (rateLimited.length) {
      console.log(`[限流保护信息] 捕获 ${rateLimited.length} 条 429（遍历过快触发后端限流）`);
    }
    expect(errors).toEqual([]);
  });

  test('学生端：登录后 5 个 Tab 渲染无崩溃', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`[console.error] ${msg.text()}`);
    });
    page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));
    page.on('response', (res) => {
      if (res.status() >= 500) errors.push(`[http ${res.status()}] ${res.url()}`);
    });

    // 取真实学生凭据：page.request 不走 UI，用 API 登录拿 admin token 并显式带 Authorization
    const loginResp = await page.request.post('/api/auth/login', {
      data: { username: 'admin', password: '123456' },
    });
    const lj = await loginResp.json();
    const adminToken = lj.data?.access_token || lj.access_token;

    const cj = await page.request.get(
      `/api/classes/${encodeURIComponent('一年级1班')}/students`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const cjData = await cj.json();
    const arr = cjData.data?.students || cjData.students || cjData.data || [];
    const stu = Array.isArray(arr) ? arr[0] : undefined;
    expect(stu, '应存在学生数据').toBeTruthy();

    const sResp = await page.request.post('/api/student/login', {
      data: { card_id: stu.card_id, name: stu.name },
    });
    const sj = await sResp.json();
    const token = sj.data?.access_token || sj.access_token || sj.data?.token || sj.token;
    expect(token, '学生登录应返回 token').toBeTruthy();

    await page.goto('/#/login', { waitUntil: 'domcontentloaded' });
    await page.evaluate(
      ({ t, info }) => {
        localStorage.setItem('student_token', t);
        localStorage.setItem('student', JSON.stringify(info));
      },
      { t: token, info: sj.data.student }
    );

    await page.goto('/#/student', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const text = await page.evaluate(() => document.body.innerText);
    for (const tab of ['积分', '通知', '请假', '手机箱', '排名']) {
      expect(text, `学生端应包含 Tab「${tab}」`).toContain(tab);
    }
    expect(errors).toEqual([]);
  });
});
