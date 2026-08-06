/**
 * 班主任工作台 UI 交互验证：以班主任身份逐页点击「新增」类按钮，
 * 检查弹窗能否打开，以及点击过程中是否出现 403 / JS 报错。
 */
const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:3006';
const ROUTES = [
  'seating-chart', 'duty-roster', 'committee', 'parent-contact',
  'homework-check', 'attendance', 'study-groups', 'mental-health',
  'activity', 'culture', 'study-guide', 'phonebox-policy',
];

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  let apiErrors = [];
  let pageErrors = [];
  page.on('response', (r) => {
    const u = r.url();
    if (u.includes('/api/') && r.status() >= 400) apiErrors.push(`${r.status()} ${u.replace(BASE, '').split('?')[0]}`);
  });
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 100)));

  await page.goto(BASE + '/#/login', { waitUntil: 'networkidle' });
  await page.fill('input[autocomplete="username"]', 'teacher');
  await page.fill('input[autocomplete="current-password"]', '123456');
  await page.getByRole('button', { name: '登录' }).click();
  await page.waitForTimeout(2500);
  console.log('登录完成，开始逐页点击「新增」\n');

  let bad = 0;
  for (const route of ROUTES) {
    apiErrors = []; pageErrors = [];
    await page.goto(BASE + '/#/' + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    // 找主内容区里的新增类按钮
    const btn = page.locator('main button, button').filter({ hasText: /新增|添加|创建|新建|生成|布置|登记|录入/ }).first();
    const cnt = await btn.count();
    if (cnt === 0) {
      console.log(`  --  /${route.padEnd(16)} 无新增类按钮（可能是纯配置页）`);
      continue;
    }
    const btnText = (await btn.innerText()).trim().replace(/\s+/g, '');
    try {
      await btn.click({ timeout: 5000 });
    } catch (e) {
      console.log(`  ❌ /${route.padEnd(16)} 按钮"${btnText}"点击失败: ${String(e).slice(0, 60)}`);
      bad++; continue;
    }
    await page.waitForTimeout(1000);

    const state = await page.evaluate(() => {
      const txt = document.body.innerText;
      // 常见弹窗容器：role=dialog / .modal / fixed 定位遮罩
      const dialog = document.querySelector('[role="dialog"], .modal, .fixed.inset-0');
      return {
        modalOpen: !!dialog,
        forbidden: txt.includes('权限不足') || txt.includes('无权'),
        toastErr: /失败|错误|403/.test(txt),
        inputs: dialog ? dialog.querySelectorAll('input, select, textarea').length : 0,
      };
    });

    const problem = state.forbidden || apiErrors.length > 0 || pageErrors.length > 0;
    if (problem) bad++;
    let line = `  ${problem ? '❌' : '✅'} /${route.padEnd(16)} 按钮"${btnText}" 弹窗=${state.modalOpen} 表单项=${state.inputs}`;
    if (state.forbidden) line += ' [权限不足]';
    if (apiErrors.length) line += ` [API: ${apiErrors.join(',')}]`;
    if (pageErrors.length) line += ` [JS: ${pageErrors[0]}]`;
    console.log(line);

    // 关掉弹窗，避免影响下一页
    await page.keyboard.press('Escape').catch(() => {});
  }

  await browser.close();
  console.log(`\n===== 交互异常页面数: ${bad} =====`);
}
run().then(() => process.exit(0)).catch((e) => { console.error('FATAL', e); process.exit(1); });
