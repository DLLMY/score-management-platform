/* eslint-disable */
const { chromium } = require('playwright-core');
const fs = require('fs');

const FE = 'http://127.0.0.1:3000';
const OUT = 'c:/Users/53527/Desktop/自我管理提升/自我管理提升V2.0/平台开发/管理平台设计/.workbuddy/browser_test/e2e_round2_result.json';
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

async function clickBtn(page, text) {
  return page.locator('button', { hasText: text }).first().click();
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

  // ============ 1) 用户/学生：添加学生 -> 创建 ============
  {
    const marker = 'E2E_USER_' + ts();
    const card = String(ts()).slice(-10); // 唯一卡号
    const r = { domain: 'user', marker, card };
    await page.evaluate(() => { window.location.hash = '#/users'; });
    await sleep(1500);
    r.btnReady = await waitBtn(page, '添加学生');
    if (r.btnReady) {
      await clickBtn(page, '添加学生');
      r.modal = await page.waitForSelector('input[placeholder="请输入学生姓名"]', { timeout: 5000 }).then(() => true).catch(() => false);
      if (r.modal) {
        await page.locator('input[placeholder="请输入学生姓名"]').click();
        await page.keyboard.type(marker);
        // 班级 select（modal 内第 2 个 select，跳过"请选择班级"空选项）
        const sel = page.locator('.fixed.inset-0 select').nth(1);
        await sel.selectOption({ index: 1 }).catch(() => {});
        await page.locator('input[placeholder="请输入卡号"]').click();
        await page.keyboard.type(card);
        const rp = page.waitForResponse((x) => x.url().includes('/api/users') && x.request().method() === 'POST', { timeout: 8000 }).catch(() => null);
        await clickBtn(page, '创建');
        const resp = await rp;
        r.post = resp ? resp.request().method() + ' ' + resp.url() : null;
        r.status = resp ? resp.status() : null;
        if (resp) { try { r.body = (await resp.text()).slice(0, 260); } catch (e) {} }
      }
    }
    report.push(r);
  }

  // ============ 2) 班级：添加班级 -> 保存 ============
  {
    const marker = 'E2E_CLASS_' + ts();
    const r = { domain: 'class_info', marker };
    await page.evaluate(() => { window.location.hash = '#/class-management'; });
    await sleep(1500);
    r.btnReady = await waitBtn(page, '添加班级');
    if (r.btnReady) {
      await clickBtn(page, '添加班级');
      r.modal = await page.waitForSelector('input[placeholder="输入班级名称"]', { timeout: 5000 }).then(() => true).catch(() => false);
      if (r.modal) {
        await page.locator('input[placeholder="输入班级名称"]').click();
        await page.keyboard.type(marker);
        await page.locator('input[placeholder="输入年级（如：高一）"]').click();
        await page.keyboard.type('E2E高一');
        await page.locator('textarea[placeholder="输入班级描述"]').click();
        await page.keyboard.type('E2E 自动添加班级');
        const rp = page.waitForResponse((x) => x.url().includes('/api/classes') && x.request().method() === 'POST', { timeout: 8000 }).catch(() => null);
        await clickBtn(page, '保存');
        const resp = await rp;
        r.post = resp ? resp.request().method() + ' ' + resp.url() : null;
        r.status = resp ? resp.status() : null;
        if (resp) { try { r.body = (await resp.text()).slice(0, 260); } catch (e) {} }
      }
    }
    report.push(r);
  }

  // ============ 3) 座次表：新建座次表 -> 创建 ============
  {
    const marker = 'E2E_SEAT_' + ts();
    const r = { domain: 'seating_chart', marker };
    await page.evaluate(() => { window.location.hash = '#/seating-chart'; });
    await sleep(1800);
    r.btnReady = await waitBtn(page, '新建座次表');
    if (r.btnReady) {
      await clickBtn(page, '新建座次表');
      r.modal = await page.waitForSelector('input[placeholder="如：高一(1)班座次表"]', { timeout: 5000 }).then(() => true).catch(() => false);
      if (r.modal) {
        await page.locator('input[placeholder="如：高一(1)班座次表"]').click();
        await page.keyboard.type(marker);
        // 行数/列数保持默认(1)，默认排列策略保持默认
        const rp = page.waitForResponse((x) => x.url().includes('/api/seating/charts') && x.request().method() === 'POST', { timeout: 8000 }).catch(() => null);
        await clickBtn(page, '创建');
        const resp = await rp;
        r.post = resp ? resp.request().method() + ' ' + resp.url() : null;
        r.status = resp ? resp.status() : null;
        if (resp) { try { r.body = (await resp.text()).slice(0, 260); } catch (e) {} }
      }
    }
    report.push(r);
  }

  // ============ 4) 值日生：新建值日组 -> 创建 ============
  {
    const marker = 'E2E_DUTY_' + ts();
    const r = { domain: 'duty_group', marker };
    await page.evaluate(() => { window.location.hash = '#/duty-roster'; });
    await sleep(1800);
    r.btnReady = await waitBtn(page, '新建值日组');
    if (r.btnReady) {
      await clickBtn(page, '新建值日组');
      r.modal = await page.waitForSelector('input[placeholder="如：第一值日组"]', { timeout: 5000 }).then(() => true).catch(() => false);
      if (r.modal) {
        await page.locator('input[placeholder="如：第一值日组"]').click();
        await page.keyboard.type(marker);
        // 班级自动选第一项；值日日期/负责区域保持默认
        const rp = page.waitForResponse((x) => x.url().includes('/api/duty/groups') && x.request().method() === 'POST', { timeout: 8000 }).catch(() => null);
        await clickBtn(page, '创建');
        const resp = await rp;
        r.post = resp ? resp.request().method() + ' ' + resp.url() : null;
        r.status = resp ? resp.status() : null;
        if (resp) { try { r.body = (await resp.text()).slice(0, 260); } catch (e) {} }
      }
    }
    report.push(r);
  }

  // ============ 5) 手机箱策略：选班 -> 一键放行（override） ============
  {
    const r = { domain: 'phone_box_policy', marker: 'override' };
    await page.evaluate(() => { window.location.hash = '#/phonebox-policy'; });
    await sleep(1800);
    // 管理班级 select（页面内原生 select，第一个真实选项）
    const clsSel = page.locator('select').first();
    r.classSelected = await clsSel.selectOption({ index: 1 }).then(() => true).catch(() => false);
    await sleep(1500);
    r.btnReady = await waitBtn(page, '立即允许本班开箱');
    if (r.btnReady) {
      const rp = page.waitForResponse((x) => x.url().includes('/api/phonebox-policy/override') && x.request().method() === 'POST', { timeout: 8000 }).catch(() => null);
      await clickBtn(page, '立即允许本班开箱');
      const resp = await rp;
      r.post = resp ? resp.request().method() + ' ' + resp.url() : null;
      r.status = resp ? resp.status() : null;
      if (resp) { try { r.body = (await resp.text()).slice(0, 320); } catch (e) {} }
    }
    report.push(r);
  }

  fs.writeFileSync(OUT, JSON.stringify({ report, errors: errors.slice(0, 12) }, null, 2));
  console.log(JSON.stringify({ report, errors: errors.slice(0, 12) }, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
