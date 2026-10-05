/* eslint-disable */
const { chromium } = require('playwright-core');
const fs = require('fs');
const FE = 'http://127.0.0.1:3000';
const OUT = 'c:/Users/53527/Desktop/自我管理提升/自我管理提升V2.0/平台开发/管理平台设计/.workbuddy/browser_test/period_fix_result.json';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const log = [];
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-setuid-sandbox', '--single-process'],
    timeout: 60000,
  });
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERR: ' + e.message));

  await page.goto(FE + '/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[autocomplete="username"]', { timeout: 15000 });
  await page.locator('input[autocomplete="username"]').click();
  await page.keyboard.type('admin');
  await page.locator('input[type="password"]').click();
  await page.keyboard.type('admin123');
  await page.locator('button[aria-label="登录"]').click();
  await page.waitForFunction(() => !!localStorage.getItem('admin'), { timeout: 15000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  await sleep(1200);

  const marker = 'E2E_PERIOD_' + Date.now();
  await page.evaluate(() => { window.location.hash = '#/class-period-settings'; });
  await sleep(1500);

  const btnReady = await page.waitForFunction(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent && x.textContent.includes('添加节次'));
    return b && !b.disabled ? true : false;
  }, { timeout: 20000 }).then(() => true).catch(() => false);
  log.push('btnReady=' + btnReady);

  await page.locator('button', { hasText: '添加节次' }).first().click();
  const modal = await page.waitForSelector('input[placeholder="例如：第一节课、早自习"]', { timeout: 5000 }).then(() => true).catch(() => false);
  log.push('modal=' + modal);

  // 作用域限定模态内
  const scope = page.locator('.fixed.inset-0').last();
  // 节次名称
  await scope.locator('input[placeholder="例如：第一节课、早自习"]').click();
  await page.keyboard.type(marker);
  // 节次编号（模态内第一个 number input），清空后填 16
  const num = scope.locator('input[type="number"]').first();
  await num.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('16');
  // 时间下拉：模态内 4 个 select（start_hour,start_minute,end_hour,end_minute）
  const sel = scope.locator('select');
  const selCount = await sel.count();
  log.push('selectCount=' + selCount);
  if (selCount >= 4) {
    await sel.nth(0).selectOption('8');
    await sel.nth(1).selectOption('0');
    await sel.nth(2).selectOption('9');
    await sel.nth(3).selectOption('0');
  }
  // 描述
  const ta = scope.locator('textarea').first();
  await ta.click();
  await page.keyboard.type('E2E 自动添加节次');

  // 诊断：读取表单值
  const diag = await page.evaluate(() => {
    const m = document.querySelector('.fixed.inset-0');
    const inputs = Array.from(m.querySelectorAll('input'));
    return inputs.map((i) => ({ type: i.type, val: i.value, ph: i.placeholder }));
  });
  log.push('formDiag=' + JSON.stringify(diag));

  const reqs = [];
  const resps = [];
  page.on('request', (q) => { if (q.method() === 'POST') reqs.push(q.method() + ' ' + q.url()); });
  page.on('response', (r) => { if (r.request().method() === 'POST') resps.push(r.status() + ' ' + r.url()); });

  const rp = page.waitForResponse((x) => x.request().method() === 'POST' && x.url().includes('class-periods'), { timeout: 10000 }).catch(() => null);
  await scope.locator('button[type="submit"]', { hasText: '添加节次' }).first().click();
  const resp = await rp;
  log.push('reqs=' + JSON.stringify(reqs));
  log.push('resps=' + JSON.stringify(resps));
  log.push('createStatus=' + (resp ? resp.status() : 'null'));
  if (resp) { try { log.push('createBody=' + (await resp.text()).slice(0, 300)); } catch (e) {} }

  // 捕获校验/报错提示
  const toast = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('div,span,p')).map((e) => e.textContent.trim()).filter((t) => t && (t.includes('请填写') || t.includes('失败') || t.includes('错误') || t.includes('必填') || t.includes('成功')));
    return els.slice(0, 5);
  });
  log.push('toast=' + JSON.stringify(toast));

  fs.writeFileSync(OUT, JSON.stringify({ log, errors }, null, 2));
  console.log(JSON.stringify({ log, errors: errors.slice(0, 8) }, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
