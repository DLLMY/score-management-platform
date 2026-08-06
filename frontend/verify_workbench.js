/**
 * 班主任工作台 12 个页面终验脚本
 * 校验维度：页面渲染标题 / 是否权限不足 / 页面 JS 报错 / 该页发起的 API 是否有 4xx-5xx
 */
const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:3006';
const ROUTES = [
  ['seating-chart', '座次表管理'], ['duty-roster', '值日生'], ['committee', '班委'],
  ['parent-contact', '家长联系'], ['homework-check', '作业检查'], ['attendance', '考勤管理'],
  ['study-groups', '学习小组'], ['mental-health', '心理健康'], ['activity', '文体活动'],
  ['culture', '班级文化'], ['study-guide', '学法指导'], ['phonebox-policy', '手机箱'],
];
const HEADINGS = ['座次表管理', '值日生', '班委', '家长联系', '作业检查', '考勤管理', '学习小组', '心理健康', '文体活动', '班级文化', '学法指导', '手机箱', '权限不足'];

const accounts = [
  { name: 'admin(超管)', user: 'admin', pass: '123456' },
  { name: 'teacher(班主任)', user: 'teacher', pass: '123456' },
];

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  let totalBad = 0;

  for (const acc of accounts) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    let apiErrors = [];
    let apiCalls = [];
    let pageErrors = [];
    page.on('response', (r) => {
      const u = r.url();
      if (!u.includes('/api/')) return;
      const short = u.replace(BASE, '').split('?')[0];
      apiCalls.push(`${short}:${r.status()}`);
      if (r.status() >= 400) apiErrors.push(`${r.status()} ${short}`);
    });
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 120)));

    console.log(`\n########## ${acc.name} ##########`);
    await page.goto(BASE + '/#/login', { waitUntil: 'networkidle' });
    await page.fill('input[autocomplete="username"]', acc.user);
    await page.fill('input[autocomplete="current-password"]', acc.pass);
    await page.getByRole('button', { name: '登录' }).click();
    await page.waitForTimeout(2500);

    const perms = await page.evaluate(() => localStorage.getItem('user_permissions'));
    if (!perms) { console.log('  ❌ 登录失败'); await context.close(); continue; }
    const hasCulture = perms.includes('culture.view') || perms.includes('all');
    console.log(`  权限条数=${JSON.parse(perms).length}  含culture.view=${hasCulture}`);

    for (const [route] of ROUTES) {
      apiErrors = []; pageErrors = []; apiCalls = [];
      await page.goto(BASE + '/#/' + route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1300);
      const info = await page.evaluate(() => {
        // 只看主内容区，避开侧边栏菜单文字干扰
        const main = document.querySelector('main') || document.body;
        const txt = main.innerText;
        const h = main.querySelector('h1, h2');
        return {
          forbidden: txt.includes('权限不足'),
          heading: h ? h.innerText.trim().slice(0, 20) : '(无标题)',
          rows: main.querySelectorAll('table tbody tr').length,
          empty: /暂无|没有数据|空/.test(txt),
          len: txt.trim().length,
        };
      });

      const bad = info.forbidden || pageErrors.length > 0 || apiErrors.length > 0;
      if (bad) totalBad++;
      const flag = bad ? '❌' : '✅';
      let line = `  ${flag} /${route.padEnd(16)} 标题="${info.heading}" 行数=${info.rows} API=[${apiCalls.join(' ')}]`;
      if (info.forbidden) line += ' [权限不足]';
      if (apiErrors.length) line += ` [API错误: ${apiErrors.join(', ')}]`;
      if (pageErrors.length) line += ` [JS错误: ${pageErrors[0]}]`;
      console.log(line);
    }
    await context.close();
  }
  await browser.close();
  console.log(`\n===== 异常页面总数: ${totalBad} =====`);
}
run().then(() => process.exit(0)).catch((e) => { console.error('FATAL', e); process.exit(1); });
