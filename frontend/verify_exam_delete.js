// 验证考试删除 bug 修复：缓存僵尸 + 幂等删除 + 真实删除
const { chromium } = require('playwright-core');
const BASE = 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

  // 1) 登录
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.fill('input[placeholder="请输入用户名"]', 'admin');
  await page.fill('input[placeholder="请输入密码"]', '123456');
  await page.click('button:has-text("登录")');
  await page.waitForTimeout(1500);
  const token = await page.evaluate(() => localStorage.getItem('access_token'));
  console.log('已登录?', token ? '是 (token存在)' : '否', '| url=', page.url());

  // 2) 进入考试页
  await page.goto(BASE + '/exams', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 3) 注入僵尸考试缓存到 IndexedDB
  await page.evaluate(async () => {
    return new Promise((resolve) => {
      const open = indexedDB.open('api-cache-db', 1);
      open.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache', { keyPath: 'key' });
      };
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('cache', 'readwrite');
        const store = tx.objectStore('cache');
        store.put({ key: 'GET:/api/exams', data: [
          { id: 99999, name: '缓存僵尸考试', exam_type: 'midterm', status: 'draft', class_id: 1 },
        ], timestamp: Date.now(), expiry: Date.now() + 3600000 });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      };
      open.onerror = () => resolve(false);
    });
  });

  // 4) 重载考试页（fetchData 用 skipCache:true 应绕过僵尸缓存）
  await page.goto(BASE + '/exams', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const bodyText = await page.evaluate(() => document.body.innerText);
  const zombieShown = bodyText.includes('缓存僵尸考试');
  console.log('僵尸考试(缓存残留)是否仍显示:', zombieShown ? '是 ❌' : '否 ✅');

  // 5) 统计考试行（用“删除”按钮数量代表考试数）
  const delBtns = page.locator('button:has-text("删除")');
  const examCount = await delBtns.count();
  console.log('当前考试数(删除按钮数):', examCount);

  // 6) 真实删除第一个考试（自动确认 confirm 弹窗）
  page.on('dialog', (d) => d.accept());
  let deleteResult = '未执行';
  if (examCount > 0) {
    await delBtns.first().click();
    await page.waitForTimeout(2500);
    const examCountAfter = await page.locator('button:has-text("删除")').count();
    const errs = consoleErrors.filter((t) => t.includes('考试不存在') || (t.includes('404') && t.includes('exams')));
    deleteResult = (examCountAfter === examCount - 1 && errs.length === 0)
      ? `PASS (${examCount}->${examCountAfter}, 无404报错)`
      : `检查: ${examCount}->${examCountAfter}, 404报错=${errs.length}`;
    console.log('真实删除结果:', deleteResult);
  }

  console.log('--- 相关控制台报错 ---');
  consoleErrors.filter((t) => t.includes('exams') || t.includes('考试') || t.includes('API Error'))
    .slice(0, 8).forEach((t) => console.log('  ', t.slice(0, 160)));

  console.log('\n=== 结论 ===');
  console.log('僵尸缓存绕过:', zombieShown ? 'FAIL' : 'PASS');
  console.log('真实删除无 404:', deleteResult);

  await browser.close();
})().catch((e) => { console.error('TEST ERROR', e); process.exit(1); });
