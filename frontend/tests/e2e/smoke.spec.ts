import { test, expect, Page } from '@playwright/test';

/**
 * 核心页面冒烟回归（P1 改进项：提升前端测试覆盖）。
 *
 * 背景：本项目历史高频事故集中在「后端响应 shape 错位 → 前端运行时崩溃 /
 * ErrorBoundary / 接口 5xx」。本 spec 作为前端侧契约回归网，与后端
 * backend/tests/test_api_envelope.py 互补：
 *   - 后端契约测试：遍历 API 端点，保证无 5xx / 信封一致；
 *   - 本冒烟测试：真实登录后依次访问核心页面，断言无 ErrorBoundary、
 *     无 console error / pageerror、无 5xx API 响应。
 *
 * 运行：`npm run test:e2e -- --project=chrome smoke.spec.ts`
 * （需后端 5000 已启动；Playwright 会通过 dev:vite 自动拉起前端 3000）。
 */

interface PageErrors {
  consoleErrors: string[];
  pageErrors: string[];
  api5xx: string[];
}

const CORE_ROUTES: Array<{ path: string; name: string; marker: string }> = [
  { path: '/dashboard', name: '数据概览', marker: '数据概览' },
  { path: '/users', name: '学生管理', marker: '学生管理' },
  { path: '/rules', name: '积分规则', marker: '积分规则' },
  { path: '/devices', name: '设备管理', marker: '设备管理' },
  { path: '/exams', name: '考试管理', marker: '考试' },
  { path: '/analysis', name: '数据分析', marker: '数据分析' },
  { path: '/algorithm-analysis', name: '算法分析', marker: '算法分析' },
  { path: '/diagnostics', name: '系统诊断', marker: '系统诊断' },
];

function attachErrorCollectors(page: Page): PageErrors {
  const errors: PageErrors = { consoleErrors: [], pageErrors: [], api5xx: [] };
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.consoleErrors.push(msg.text().slice(0, 240));
  });
  page.on('pageerror', (err) => errors.pageErrors.push(String(err.message || err).slice(0, 240)));
  page.on('response', (resp) => {
    if (resp.url().includes('/api/') && resp.status() >= 500) {
      errors.api5xx.push(`${resp.status()} ${resp.url()}`);
    }
  });
  return errors;
}

test.describe('核心页面冒烟回归', () => {
  // 串行执行：冒烟页含 BERT/算法等重负载页面，并行下多页同时登录+导航会相互
  // 挤占资源导致偶发 API 超时/console error 误报。冒烟回归以稳定性优先。
  test.describe.configure({ mode: 'serial' });

  for (const route of CORE_ROUTES) {
    test(`访问 ${route.path} 无 ErrorBoundary / console error / 5xx`, async ({ page }) => {
      page.setDefaultTimeout(20000);
      const errors = attachErrorCollectors(page);

      // 登录
      await page.goto('/#/login', { waitUntil: 'domcontentloaded' });
      await page.locator('input[type="text"], input[name="username"]').first().fill('admin');
      await page.locator('input[type="password"]').first().fill('123456');
      await page.locator('button[type="submit"], button:has-text("登录")').first().click();
      await expect(page.getByRole('navigation')).toBeVisible({ timeout: 20000 });

      // 访问目标路由（hash router）
      await page.goto(`/#${route.path}`, { waitUntil: 'domcontentloaded' });
      // 等待异步数据加载与渲染稳定
      await page.waitForTimeout(3000);

      // 断言：无 ErrorBoundary 占位
      const boundaryCount = await page.locator('text=页面加载失败').count();
      expect(boundaryCount, `${route.path} 出现 ErrorBoundary「页面加载失败」`).toBe(0);

      // 断言：无 5xx API
      expect(errors.api5xx, `${route.path} 存在 5xx API 响应`).toEqual([]);

      // 断言：无 console error / pageerror（容忍已知第三方噪音：过滤 devtools 提示等）
      const noise = /Download the React DevTools|favicon|net::ERR_/;
      const realConsole = errors.consoleErrors.filter((e) => !noise.test(e));
      expect(realConsole, `${route.path} 存在 console error`).toEqual([]);
      expect(errors.pageErrors, `${route.path} 存在 pageerror`).toEqual([]);
    });
  }
});
