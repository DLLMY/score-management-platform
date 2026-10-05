// Round4: 评分规则 / 课程安排 / 家长联系方式 三个新增类写域真实点击实证
// 机制：真实 Chrome + 真实 UI；before/after 索引法精确捕获各域 POST（排除 frontend-performance 噪声）。
const { chromium } = require('playwright-core');
const fs = require('fs');

const OUT = 'c:/Users/53527/Desktop/自我管理提升/自我管理提升V2.0/平台开发/管理平台设计/.workbuddy/browser_test/e2e_round4_result.json';
const log = [];
const reqs = [];
function L(...a){ const s=a.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' '); log.push(s); console.log(s); }
const postsSince = (n) => reqs.slice(n).filter(r=>r.method==='POST' && !r.url.includes('frontend-performance'));

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-setuid-sandbox','--single-process'],
    timeout: 60000,
  });
  const page = await browser.newPage();
  page.on('request', (r) => { const u=r.url(); if(u.includes('/api/')) reqs.push({method:r.method(), url:u, _st:null}); });
  page.on('response', (r) => { const u=r.url(); if(u.includes('/api/')){ const e=reqs.find(x=>x.url===u && x._st===null && x.method===r.request().method()); if(e) e._st=r.status(); } });
  const result = { rule:{}, schedule:{}, parentContact:{} };

  try {
    await page.goto('http://127.0.0.1:3000/#/login', { waitUntil: 'networkidle' });
    await page.fill('input[autocomplete="username"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[aria-label="登录"]');
    await page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('admin')||'null')?.id===1; } catch(e){ return false; } }, { timeout: 15000 });
    L('loggedIn=true');

    // ---- 1) 评分规则 score_rule ----
    await page.evaluate(() => { window.location.hash = '#/rules'; });
    await page.waitForTimeout(1800);
    let before = reqs.length;
    await page.locator('button:has-text("添加规则")').first().click();
    await page.waitForSelector('input[placeholder="请输入规则名称"]', { timeout: 8000 });
    const rname = 'E2E_RULE_' + Date.now();
    await page.locator('input[placeholder="请输入规则名称"]').click();
    await page.keyboard.type(rname);
    await page.locator('input[placeholder="正数为加分，负数为扣分"]').click();
    await page.keyboard.type('5');
    await page.locator('.modal-content button[type="submit"]').click();
    await page.waitForTimeout(2200);
    let posts = postsSince(before);
    result.rule = { name: rname, post: posts[0] || null };
    L('rule=', result.rule);

    // ---- 2) 课程安排 course_schedules ----
    await page.keyboard.press('Escape').catch(()=>{});
    await page.evaluate(() => { window.location.hash = '#/course-schedule'; });
    await page.waitForTimeout(1800);
    before = reqs.length;
    await page.locator('button:has-text("添加课程安排")').first().click();
    await page.waitForSelector('select', { timeout: 8000 });
    await page.waitForTimeout(900); // 等 options 就绪
    const sels = page.locator('.fixed.inset-0 select');
    await sels.nth(0).selectOption({ index: 1 }); // 班级
    await sels.nth(1).selectOption({ index: 1 }); // 科目
    await sels.nth(2).selectOption({ index: 0 }); // 星期
    await sels.nth(3).selectOption({ index: 0 }); // 节次
    const classroom = 'E2E教室' + (Date.now()%1000);
    await page.locator('input[placeholder="输入教室"]').click();
    await page.keyboard.type(classroom);
    await page.locator('.fixed.inset-0 button:has-text("保存")').click();
    await page.waitForTimeout(2200);
    posts = postsSince(before);
    result.schedule = { classroom, post: posts[0] || null };
    L('schedule=', result.schedule);

    // ---- 3) 家长联系方式 parent_contact ----
    await page.keyboard.press('Escape').catch(()=>{});
    await page.evaluate(() => { window.location.hash = '#/parent-contact'; });
    await page.waitForTimeout(1800);
    before = reqs.length;
    await page.locator('button:has-text("添加家长")').first().click();
    await page.waitForSelector('input[placeholder="父亲姓名"]', { timeout: 8000 });
    await page.waitForTimeout(900);
    const ssel = page.locator('.fixed.inset-0 select').first();
    await ssel.selectOption({ index: 1 }); // 第一个学生
    const fname = 'E2E_F' + (Date.now()%100000);
    await page.locator('input[placeholder="父亲姓名"]').click();
    await page.keyboard.type(fname);
    await page.locator('input[type="tel"]').first().click();
    await page.keyboard.type('13800000000');
    await page.locator('.fixed.inset-0 button:has-text("添加")').click();
    await page.waitForTimeout(2200);
    posts = postsSince(before);
    result.parentContact = { fname, post: posts[0] || null };
    L('parentContact=', result.parentContact);

  } catch (e) {
    L('ERROR', e.message);
  } finally {
    result._reqs = reqs;
    result._log = log;
    fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
    L('WROTE', OUT);
    await browser.close();
  }
})();
