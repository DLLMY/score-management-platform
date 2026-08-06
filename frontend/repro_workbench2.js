const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:3006';
const ROUTES = [
  ['seating-chart', '座次表管理'], ['duty-roster', '值日生'], ['committee', '班委'],
  ['parent-contact', '家长联系'], ['homework-check', '作业检查'], ['attendance', '考勤管理'],
  ['study-groups', '学习小组'], ['mental-health', '心理健康'], ['activity', '文体活动'],
  ['culture', '班级文化'], ['study-guide', '学法指导'], ['phonebox-policy', '手机箱'],
];
const HEADINGS = ['座次表管理','值日生','班委','家长联系','作业检查','考勤管理','学习小组','心理健康','文体活动','班级文化','学法指导','手机箱','权限不足'];

const accounts = [
  { name: 'admin', user: 'admin', pass: '123456' },
  { name: 'teacher', user: 'teacher', pass: '123456' },
  { name: 'paikao', user: 'paikao', pass: 'Paikao@123' },
];

async function detect(page) {
  return await page.evaluate((HEADINGS) => {
    const txt = document.body.innerText;
    const forbidden = txt.includes('权限不足');
    const loading = txt.includes('加载权限');
    let heading = '(none)';
    for (const h of HEADINGS) { if (txt.includes(h)) { heading = h; break; } }
    const tables = document.querySelectorAll('table').length;
    const rows = document.querySelectorAll('table tbody tr').length;
    return { forbidden, loading, heading, tables, rows, len: txt.trim().length };
  }, HEADINGS);
}

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  for (const acc of accounts) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    console.log(`\n########## ACCOUNT: ${acc.name} ##########`);
    await page.goto(BASE + '/#/login', { waitUntil: 'networkidle' });
    await page.fill('input[autocomplete="username"]', acc.user);
    await page.fill('input[autocomplete="current-password"]', acc.pass);
    await page.getByRole('button', { name: '登录' }).click();
    await page.waitForTimeout(2500);
    const store = await page.evaluate(() => localStorage.getItem('user_permissions'));
    if (!store) { console.log('  LOGIN FAILED / no perms stored'); await context.close(); continue; }
    console.log('  perms:', store);
    // which sidebar items visible?
    const sidebar = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a')).map(a => a.getAttribute('href'));
      const wb = links.filter(h => h && h.includes('#/') && ['seating-chart','duty-roster','committee','parent-contact','homework-check','attendance','study-groups','mental-health','activity','culture','study-guide','phonebox-policy'].some(r => h.includes(r)));
      return wb;
    });
    console.log('  sidebar 班主任工作台 links visible:', sidebar.length, sidebar);
    for (const [route, label] of ROUTES) {
      await page.goto(BASE + '/#/' + route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);
      const info = await detect(page);
      console.log(`  /${route}: forbidden=${info.forbidden} loading=${info.loading} heading="${info.heading}" tables=${info.tables} rows=${info.rows}`);
    }
    await context.close();
  }
  await browser.close();
}
run().then(() => process.exit(0)).catch((e) => { console.error('FATAL', e); process.exit(1); });
