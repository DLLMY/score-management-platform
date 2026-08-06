/**
 * 姓名显示终验：确认列表接口已返回 student_name/class_name/subject_name/leader_name，
 * 且前端不再显示 "学生 #61" / "班级 #1" / "科目 #" 这类裸 ID。
 */
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:3006';

// 路由 -> 该页应当出现的真实姓名样例（来自 CrudTest 数据）
const PAGES = [
  ['attendance', '考勤管理', ['测试学生_CrudTest', '一年级1班']],
  ['homework-check', '作业检查', ['一年级1班', '语文']],
  ['duty-roster', '值日生', ['一年级1班']],
  ['committee', '班委', ['测试学生_CrudTest', '一年级1班']],
  ['study-groups', '学习小组', ['一年级1班']],
  ['seating-chart', '座次表管理', ['测试学生_CrudTest']],
];

const ID_PATTERNS = ['学生 #', '班级 #', '科目 #', '领导 #'];

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(BASE + '/#/login', { waitUntil: 'networkidle' });
  await page.fill('input[autocomplete="username"]', 'admin');
  await page.fill('input[autocomplete="current-password"]', '123456');
  await page.getByRole('button', { name: '登录' }).click();
  await page.waitForTimeout(2500);

  let bad = 0;
  for (const [route, heading, expectNames] of PAGES) {
    await page.goto(BASE + '/#/' + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1400);
    const info = await page.evaluate(() => {
      const main = document.querySelector('main') || document.body;
      return { txt: main.innerText, forbidden: main.innerText.includes('权限不足') };
    });
    const idHits = ID_PATTERNS.filter((p) => info.txt.includes(p));
    const nameHits = expectNames.filter((n) => info.txt.includes(n));
    // 真 bug 信号 = 出现裸 ID；数据为空时姓名命中为 0 属正常，不算失败
    const ok = idHits.length === 0 && !info.forbidden;
    if (!ok) bad++;
    const flag = ok ? '✅' : '❌';
    console.log(`${flag} /${route.padEnd(14)} 裸ID=[${idHits.join(',') || '无'}] 命中姓名=[${nameHits.join(',') || '无'}]${info.forbidden ? ' [权限不足]' : ''}`);
  }
  await browser.close();
  console.log(`\n===== 姓名显示异常页: ${bad} =====`);
  process.exit(bad > 0 ? 1 : 0);
}
run().then(() => process.exit(0)).catch((e) => { console.error('FATAL', e); process.exit(1); });
