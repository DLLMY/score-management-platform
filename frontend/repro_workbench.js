const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:3006';
const ROUTES = [
  'seating-chart', 'duty-roster', 'committee', 'parent-contact',
  'homework-check', 'attendance', 'study-groups', 'mental-health',
  'activity', 'culture', 'study-guide', 'phonebox-policy',
];

const accounts = [
  { name: 'admin', user: 'admin', pass: '123456' },
  { name: 'teacher', user: 'teacher', pass: '123456' },
];

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  for (const acc of accounts) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => pageErrors.push(e.message));

    console.log(`\n########## ACCOUNT: ${acc.name} ##########`);
    // Login
    await page.goto(BASE + '/#/login', { waitUntil: 'networkidle' });
    await page.fill('input[autocomplete="username"]', acc.user);
    await page.fill('input[autocomplete="current-password"]', acc.pass);
    await page.getByRole('button', { name: '登录' }).click();
    await page.waitForTimeout(2500);

    // print stored admin + permissions
    const store = await page.evaluate(() => ({
      admin: localStorage.getItem('admin'),
      perms: localStorage.getItem('user_permissions'),
      roles: localStorage.getItem('user_roles'),
    }));
    console.log('  admin:', store.admin);
    console.log('  perms:', store.perms);
    console.log('  roles:', store.roles);

    const results = {};
    for (const route of ROUTES) {
      await page.goto(BASE + '/#/' + route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      const info = await page.evaluate(() => {
        const txt = document.body.innerText;
        const h1 = document.querySelector('h1');
        const hasForbidden = txt.includes('权限不足');
        const hasLoading = txt.includes('加载权限');
        const hasEmpty = txt.includes('暂无') || txt.includes('暂无数据');
        return {
          h1: h1 ? h1.innerText : '(no h1)',
          len: txt.trim().length,
          hasForbidden, hasLoading, hasEmpty,
          snippet: txt.replace(/\s+/g, ' ').slice(0, 160),
        };
      });
      results[route] = info;
      console.log(`  /${route}: forbidden=${info.hasForbidden} loading=${info.hasLoading} h1="${info.h1}" len=${info.len} | ${info.snippet}`);
    }
    console.log(`  [${acc.name}] consoleErrors=${consoleErrors.length} pageErrors=${pageErrors.length}`);
    if (pageErrors.length) console.log('    pageErrors:', pageErrors.slice(0, 5));
    if (consoleErrors.length) console.log('    consoleErrors:', consoleErrors.slice(0, 5));
    await context.close();
  }
  await browser.close();
}

run().then(() => process.exit(0)).catch((e) => { console.error('FATAL', e); process.exit(1); });
