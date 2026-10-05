/* eslint-disable */
const { chromium } = require('playwright-core');
const fs = require('fs');

const FE = 'http://127.0.0.1:3000';
const OUT = 'c:/Users/53527/Desktop/自我管理提升/自我管理提升V2.0/平台开发/管理平台设计/.workbuddy/browser_test/notif_result.json';
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

  // ---- 1) 真实 UI 登录 ----
  await page.goto(FE + '/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[autocomplete="username"]', { timeout: 15000 });
  await page.locator('input[autocomplete="username"]').click();
  await page.keyboard.type('admin');
  await page.locator('input[type="password"]').click();
  await page.keyboard.type('admin123');
  await page.locator('button[aria-label="登录"]').click();

  // 等待登录态落地（Login.tsx 写入 localStorage('admin')）
  const loggedIn = await page.waitForFunction(() => !!localStorage.getItem('admin'), { timeout: 15000 })
    .then(() => true).catch(() => false);
  log.push('loggedIn=' + loggedIn);
  if (!loggedIn) {
    fs.writeFileSync(OUT, JSON.stringify({ log, errors }, null, 2));
    console.log(JSON.stringify({ log, errors: errors.slice(0, 8) }, null, 2));
    await browser.close();
    return;
  }

  await page.waitForLoadState('networkidle').catch(() => {});
  await sleep(1500);

  // ---- 2) 进入通知页 ----
  await page.evaluate(() => { window.location.hash = '#/notifications'; });
  await sleep(1800);

  // ---- 3) 等待「发送通知」按钮出现且非 disabled（权限加载完）----
  const btnReady = await page.waitForFunction(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find((x) => x.textContent && x.textContent.includes('发送通知'));
    return b && !b.disabled ? true : false;
  }, { timeout: 20000 }).then(() => true).catch(() => false);
  log.push('sendBtnReady=' + btnReady);

  const diag = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find((x) => x.textContent && x.textContent.includes('发送通知'));
    if (!b) return 'NO_BUTTON';
    return 'disabled=' + b.disabled + '; text=' + b.textContent.trim();
  });
  log.push('diag=' + diag);

  let modalOpened = false, postStatus = null, postBody = null;

  if (btnReady) {
    await page.locator('button', { hasText: '发送通知' }).first().click();
    modalOpened = await page.waitForSelector('.fixed.inset-0', { timeout: 5000 }).then(() => true).catch(() => false);
    log.push('modalOpened=' + modalOpened);

    if (modalOpened) {
      const titleInput = page.locator('input[placeholder="请输入通知标题"]');
      await titleInput.click();
      await page.keyboard.type('E2E_UI_NOTIF_' + Date.now());
      const ta = page.locator('textarea[placeholder="请输入通知内容"]');
      await ta.click();
      await page.keyboard.type('由浏览器自动化真实点击发送的通知');

      // 诊断：读取受控输入实际值
      const vals = await page.evaluate(() => {
        const t = document.querySelector('input[placeholder="请输入通知标题"]');
        const m = document.querySelector('textarea[placeholder="请输入通知内容"]');
        return { title: t ? t.value : 'NO_INPUT', msg: m ? m.value : 'NO_TEXTAREA' };
      });
      log.push('inputVals=' + JSON.stringify(vals));

      // 捕获提交阶段所有请求
      const reqs = [];
      const onReq = (r) => { if (r.url().includes('admin_notifications')) reqs.push(r.method() + ' ' + r.url()); };
      page.on('request', onReq);

      const respPromise = page.waitForResponse(
        (r) => r.url().includes('/api/admin_notifications/') && r.request().method() === 'POST',
        { timeout: 8000 }
      ).catch(() => null);

      await page.locator('.fixed.inset-0 button[type="submit"]').first().click();
      const resp = await respPromise;
      if (resp) {
        postStatus = resp.status();
        try { postBody = await resp.text(); } catch (e) { postBody = 'ERR:' + e.message; }
      }
      log.push('requests=' + JSON.stringify(reqs));
      log.push('postStatus=' + postStatus);
      log.push('postBody=' + (postBody || '').slice(0, 400));
    }
  }

  fs.writeFileSync(OUT, JSON.stringify({ log, errors, modalOpened, postStatus, postBody }, null, 2));
  console.log(JSON.stringify({ log, errors: errors.slice(0, 8), modalOpened, postStatus }, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
