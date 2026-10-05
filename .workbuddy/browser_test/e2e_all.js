/* eslint-disable */
const { chromium } = require('playwright-core');
const fs = require('fs');

const FE = 'http://127.0.0.1:3000';
const OUT = 'c:/Users/53527/Desktop/自我管理提升/自我管理提升V2.0/平台开发/管理平台设计/.workbuddy/browser_test/e2e_all_result.json';
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
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERR: ' + e.message));

  const loggedIn = await loginReal(page);
  report.push({ step: 'login', ok: loggedIn });
  if (!loggedIn) { fs.writeFileSync(OUT, JSON.stringify({ report, errors }, null, 2)); console.log(JSON.stringify({ report, errors }, null, 2)); await browser.close(); return; }
  await page.waitForLoadState('networkidle').catch(() => {});
  await sleep(1200);

  // ============ 1) 通知：发送通知 ============
  {
    const marker = 'E2E_NOTIF_' + ts();
    const r = { domain: 'notification', marker };
    await page.evaluate(() => { window.location.hash = '#/notifications'; });
    await sleep(1500);
    r.btnReady = await waitBtn(page, '发送通知');
    if (r.btnReady) {
      await page.locator('button', { hasText: '发送通知' }).first().click();
      r.modal = await page.waitForSelector('input[placeholder="请输入通知标题"]', { timeout: 5000 }).then(() => true).catch(() => false);
      if (r.modal) {
        await page.locator('input[placeholder="请输入通知标题"]').click();
        await page.keyboard.type(marker);
        await page.locator('textarea[placeholder="请输入通知内容"]').click();
        await page.keyboard.type('浏览器自动化真实点击发送的通知');
        const reqs = [];
        page.on('request', (q) => { if (q.method() === 'POST') reqs.push(q.url()); });
        const rp = page.waitForResponse((x) => x.url().includes('/api/admin_notifications/') && x.request().method() === 'POST', { timeout: 8000 }).catch(() => null);
        await page.locator('.fixed.inset-0 button[type="submit"]').first().click();
        const resp = await rp;
        r.post = reqs;
        r.status = resp ? resp.status() : null;
        if (resp) { try { r.body = (await resp.text()).slice(0, 200); } catch (e) {} }
      }
    }
    report.push(r);
  }

  // ============ 2) 节次：添加节次 ============
  {
    const marker = 'E2E_PERIOD_' + ts();
    const r = { domain: 'class_period', marker };
    await page.evaluate(() => { window.location.hash = '#/class-period-settings'; });
    await sleep(1500);
    r.btnReady = await waitBtn(page, '添加节次');
    if (r.btnReady) {
      await page.locator('button', { hasText: '添加节次' }).first().click();
      r.modal = await page.waitForSelector('input[placeholder="例如：第一节课、早自习"]', { timeout: 5000 }).then(() => true).catch(() => false);
      if (r.modal) {
        // 节次名称
        await page.locator('input[placeholder="例如：第一节课、早自习"]').click();
        await page.keyboard.type(marker);
        // 节次编号：清空后填 99
        const num = page.locator('input[type="number"]').first();
        await num.click();
        await page.keyboard.press('Control+a');
        await page.keyboard.type('99');
        // 开始/结束时间下拉（避免 0 时长）
        await page.locator('select').nth(0).selectOption('8');
        await page.locator('select').nth(1).selectOption('0');
        await page.locator('select').nth(2).selectOption('9');
        await page.locator('select').nth(3).selectOption('0');
        // 描述
        const ta = page.locator('textarea').first();
        await ta.click();
        await page.keyboard.type('E2E 自动添加节次');
        const reqs = [];
        page.on('request', (q) => { if (q.method() === 'POST') reqs.push(q.url()); });
        const rp = page.waitForResponse((x) => x.request().method() === 'POST' && x.url().includes('period'), { timeout: 8000 }).catch(() => null);
        await page.locator('button[type="submit"]', { hasText: '添加节次' }).first().click();
        const resp = await rp;
        r.post = reqs;
        r.status = resp ? resp.status() : null;
        if (resp) { try { r.body = (await resp.text()).slice(0, 200); } catch (e) {} }
      }
    }
    report.push(r);
  }

  // ============ 3) 分类：添加分类 ============
  {
    const marker = 'E2E_CAT_' + ts();
    const r = { domain: 'score_category', marker };
    await page.evaluate(() => { window.location.hash = '#/categories'; });
    await sleep(1500);
    r.btnReady = await waitBtn(page, '添加分类');
    if (r.btnReady) {
      await page.locator('button', { hasText: '添加分类' }).first().click();
      r.modal = await page.waitForSelector('input[placeholder="请输入分类名称"]', { timeout: 5000 }).then(() => true).catch(() => false);
      if (r.modal) {
        await page.locator('input[placeholder="请输入分类名称"]').click();
        await page.keyboard.type(marker);
        const ta = page.locator('textarea[placeholder="请输入分类描述"]');
        await ta.click();
        await page.keyboard.type('E2E 自动添加分类');
        const reqs = [];
        page.on('request', (q) => { if (q.method() === 'POST') reqs.push(q.url()); });
        const rp = page.waitForResponse((x) => x.request().method() === 'POST' && (x.url().includes('categor') || x.url().includes('rule')), { timeout: 8000 }).catch(() => null);
        await page.locator('button[type="submit"]', { hasText: '添加分类' }).first().click();
        const resp = await rp;
        r.post = reqs;
        r.status = resp ? resp.status() : null;
        if (resp) { try { r.body = (await resp.text()).slice(0, 200); } catch (e) {} }
      }
    }
    report.push(r);
  }

  fs.writeFileSync(OUT, JSON.stringify({ report, errors }, null, 2));
  console.log(JSON.stringify({ report, errors: errors.slice(0, 10) }, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
