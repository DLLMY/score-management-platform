// 诊断 3 个 no-submit 页：点"新增"后弹窗为何未被 harness 识别。
// 用法: node diag_nosubmit.js <hash> [waitMs]
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const PROJ = 'C:/Users/53527/Desktop/自我管理提升/自我管理提升V2.0/平台开发/管理平台设计';
const SHOTS = path.join(PROJ, '.workbuddy/browser_test/shots');
const hash = process.argv[2] || '#/rank-rules';
const extraWait = parseInt(process.argv[3] || '0', 10);

const BASE = 'http://127.0.0.1:3000';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function pickAddBtn(page) {
  return await page.evaluate(() => {
    const reAdd = /添加|新建|新增|创建|录入|登记|上报|布置|发布|开通|上传|发送|导入|配置|发起|生成|绑定|打卡|添加规则|新增规则|新建规则/;
    const inNav = (el) => !!el.closest('nav,aside,.sidebar,.ant-menu,[class*=sidebar],[class*=menu],header,.header,[class*=header],a[href]');
    const els = Array.from(document.querySelectorAll('button,[role=button],a:not([href])'));
    const cand = els.filter(e => { const t = (e.innerText || e.getAttribute('title') || '').trim(); return reAdd.test(t) && !inNav(e); });
    if (!cand.length) return { found: false, all: els.slice(0, 20).map(e => (e.innerText || '').trim().slice(0, 20)) };
    const score = (t) => { if (/添加|新建|新增|创建|发送/.test(t)) return 3; if (/录入|登记|上报|布置|发布|开通|上传|导入/.test(t)) return 2; return 1; };
    const mx = Math.max(...cand.map(e => score(e.textContent || '')));
    const top = cand.filter(e => score(e.textContent || '') === mx);
    const create = top.find(e => /添加|新建|新增|创建|发送/.test(e.textContent || ''));
    const chosen = create || top[0];
    chosen.id = '__auto_add_btn';
    return { found: true, text: (chosen.innerText || '').trim().slice(0, 30), all: cand.map(e => (e.innerText || '').trim().slice(0, 20)) };
  });
}

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1600 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); });
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 120)));
  await page.goto(BASE + '/#/login', { waitUntil: 'networkidle' });
  await sleep(1000);
  await page.fill('input[placeholder="请输入用户名"]', 'admin');
  await page.fill('input[placeholder="请输入密码"]', 'Test@123456');
  await page.click('button:has-text("登录")');
  await sleep(2500);
  await page.goto(BASE + hash, { waitUntil: 'networkidle' });
  await sleep(2000);
  const pick = await pickAddBtn(page);
  console.log('PICK:', JSON.stringify(pick));
  if (pick.found) {
    try { await page.click('#__auto_add_btn', { timeout: 3000 }); } catch (e) { console.log('CLICK ERR', e.message.slice(0, 80)); }
    await sleep(2500 + extraWait);
    const diag = await page.evaluate(() => {
      const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden'; };
      const forms = Array.from(document.querySelectorAll('form')).map(f => ({ vis: vis(f), fields: f.querySelectorAll('input,textarea,select').length }));
      const containers = ['[role=dialog]', '.ant-modal-content', '.ant-drawer-content', 'div.fixed.inset-0', 'div[class*=overlay]', 'div[class*=modal]'];
      const found = [];
      for (const s of containers) for (const e of Array.from(document.querySelectorAll(s))) {
        if (vis(e)) found.push({ sel: s, cls: (e.className || '').toString().slice(0, 50), fields: e.querySelectorAll('input,textarea,select').length, snippet: e.outerHTML.slice(0, 200) });
      }
      return { formCount: forms.length, forms, modalContainers: found.slice(0, 5) };
    });
    console.log('DIAG:', JSON.stringify(diag, null, 1).slice(0, 2000));
  }
  console.log('CONSOLE_ERRORS:', JSON.stringify(errs.slice(0, 8)));
  await browser.close();
})().catch(e => { console.log('FATAL', e.message); process.exit(1); });
