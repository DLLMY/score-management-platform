/* eslint-disable */
const { chromium } = require('playwright-core');
const fs = require('fs');

const FE = 'http://127.0.0.1:3000';
const OUT = 'c:/Users/53527/Desktop/自我管理提升/自我管理提升V2.0/平台开发/管理平台设计/.workbuddy/browser_test/e2e_round2b_result.json';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ts = () => Date.now();

async function loginReal(page) {
  await page.goto(FE + '/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[autocomplete="username"]', { timeout: 15000 });
  await page.locator('input[autocomplete="username"]').click();
  await page.keyboard.type('admin');
  await page.locator('input[type="password"]').click();
  await page.keyboard.type('admin123');
  await page.locator('button[aria-label="登录"]').click();
  return page.waitForFunction(() => !!localStorage.getItem('admin'), { timeout: 15000 })
    .then(() => true).catch(() => false);
}
async function waitBtn(page, text, timeout = 20000) {
  return page.waitForFunction((t) => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent && x.textContent.includes(t));
    return b && !b.disabled ? true : false;
  }, text, { timeout }).then(() => true).catch(() => false);
}

(async () => {
  const report = [];
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-setuid-sandbox', '--single-process'],
    timeout: 60000,
  });
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const allReqs = [];
  page.on('request', (q) => { if (q.method() === 'POST') allReqs.push(q.method() + ' ' + q.url()); });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERR: ' + e.message));

  await loginReal(page);
  await page.waitForLoadState('networkidle').catch(() => {});
  await sleep(1200);

  // ===== CLASS =====
  {
    const marker = 'E2E_CLASS_' + ts();
    const r = { domain: 'class', marker };
    await page.evaluate(() => { window.location.hash = '#/class-management'; });
    await sleep(1500);
    r.btnReady = await waitBtn(page, '添加班级');
    await page.locator('button', { hasText: '添加班级' }).first().click();
    r.modal = await page.waitForSelector('input[placeholder="输入班级名称"]', { timeout: 5000 }).then(() => true).catch(() => false);
    await page.locator('input[placeholder="输入班级名称"]').click();
    await page.keyboard.type(marker);
    await sleep(300);
    // 读取输入值确认已填入
    r.nameVal = await page.locator('input[placeholder="输入班级名称"]').inputValue().catch(() => 'ERR');
    await page.locator('textarea[placeholder="输入班级描述"]').click();
    await page.keyboard.type('E2E 自动添加班级');
    // 找保存按钮
    r.saveBtns = await page.evaluate(() => Array.from(document.querySelectorAll('.fixed.inset-0 button')).map(b => b.textContent.trim()));
    const before = allReqs.length;
    await page.locator('.fixed.inset-0 button', { hasText: '保存' }).first().click();
    await sleep(2500);
    r.newReqs = allReqs.slice(before);
    report.push(r);
  }

  // ===== PHONEBOX =====
  {
    const r = { domain: 'phonebox', marker: 'override' };
    await page.evaluate(() => { window.location.hash = '#/phonebox-policy'; });
    await sleep(1800);
    const clsSel = page.locator('select').first();
    r.classSelected = await clsSel.selectOption({ index: 1 }).then(() => true).catch((e) => 'ERR:' + e.message);
    await sleep(2000);
    r.btnReady = await waitBtn(page, '立即允许本班开箱');
    r.btns = await page.evaluate(() => Array.from(document.querySelectorAll('button')).filter(b=>b.textContent.includes('开箱')||b.textContent.includes('放行')).map(b=>b.textContent.trim()+':'+(b.disabled?'[disabled]':'')));
    const before = allReqs.length;
    await page.locator('button', { hasText: '立即允许本班开箱' }).first().click();
    await sleep(2500);
    r.newReqs = allReqs.slice(before);
    report.push(r);
  }

  fs.writeFileSync(OUT, JSON.stringify({ report, allReqs, errors: errors.slice(0, 12) }, null, 2));
  console.log(JSON.stringify({ report, allReqs, errors: errors.slice(0, 12) }, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
