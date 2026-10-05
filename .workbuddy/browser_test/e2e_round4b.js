// Round4b: 课程安排专项（避开冲突：选节次2=period_number 2，现有排课全用 period 1）
const { chromium } = require('playwright-core');
const fs = require('fs');
const OUT = 'c:/Users/53527/Desktop/自我管理提升/自我管理提升V2.0/平台开发/管理平台设计/.workbuddy/browser_test/e2e_round4b_result.json';
const log = []; const reqs = [];
function L(...a){ const s=a.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' '); log.push(s); console.log(s); }

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
  const result = { schedule:{} };
  try {
    await page.goto('http://127.0.0.1:3000/#/login', { waitUntil: 'networkidle' });
    await page.fill('input[autocomplete="username"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[aria-label="登录"]');
    await page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('admin')||'null')?.id===1; } catch(e){ return false; } }, { timeout: 15000 });
    L('loggedIn=true');
    await page.evaluate(() => { window.location.hash = '#/course-schedule'; });
    await page.waitForTimeout(1800);
    const before = reqs.length;
    await page.locator('button:has-text("添加课程安排")').first().click();
    await page.waitForSelector('select', { timeout: 8000 });
    await page.waitForTimeout(900);
    const sels = page.locator('.fixed.inset-0 select');
    await sels.nth(0).selectOption({ index: 1 }); // 班级(第一个真实班)
    await sels.nth(1).selectOption({ index: 1 }); // 科目
    await sels.nth(2).selectOption({ index: 0 }); // 星期=周一(day0)
    await sels.nth(3).selectOption({ index: 1 }); // 节次=period 2 (空闲)
    const classroom = 'E2E教室' + (Date.now()%1000);
    await page.locator('input[placeholder="输入教室"]').click();
    await page.keyboard.type(classroom);
    // 记录选中的班级/节次值，便于校验
    const selVals = await page.evaluate(() => Array.from(document.querySelectorAll('.fixed.inset-0 select')).map(s=>s.value));
    result.schedule.selVals = selVals;
    await page.locator('.fixed.inset-0 button:has-text("保存")').click();
    await page.waitForTimeout(2500);
    const posts = reqs.slice(before).filter(r=>r.method==='POST' && !r.url.includes('frontend-performance'));
    result.schedule.post = posts[0] || null;
    result.schedule.classroom = classroom;
    L('schedule=', result.schedule);
  } catch (e) {
    L('ERROR', e.message);
  } finally {
    result._reqs = reqs; result._log = log;
    fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
    L('WROTE', OUT);
    await browser.close();
  }
})();
