/**
 * 性能上报刷屏验证（2026-08-13）：
 * 设备页停留 70s（覆盖 12+ 次 5s flush），统计 429 / Reported / Flushed 日志 / console error。
 * 目标：429 = 0、Reported = 0、Flushed 成功日志 = 0、无 console error。
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const counts = { reported: 0, flushedOk: 0, flushedFail: 0, rateLimited: 0, http429: 0, http5xx: 0, consoleError: [] };

  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('[Performance] Reported')) counts.reported++;
    if (text.includes('[Performance] Flushed:')) counts.flushedOk++;
    if (text.includes('Flushed status') || text.includes('Flush 失败')) counts.flushedFail++;
    if (text.includes('429')) counts.rateLimited++;
    if (msg.type() === 'error') counts.consoleError.push(text);
  });
  page.on('response', (res) => {
    if (res.status() === 429) counts.http429++;
    if (res.status() >= 500) counts.http5xx++;
  });

  // 登录
  await page.goto('http://127.0.0.1:3000/#/login', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="text"]').first().fill('admin');
  await page.locator('input[type="password"]').first().fill('123456');
  await page.locator('button:has-text("登录")').first().click();
  await page.waitForTimeout(2500);

  // 设备页停留 70s
  await page.goto('http://127.0.0.1:3000/#/devices', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(70000);

  console.log('=== 验证结果 ===');
  console.log('Reported 日志:', counts.reported, '(目标 0)');
  console.log('Flushed 成功日志:', counts.flushedOk, '(目标 0)');
  console.log('Flush 失败日志:', counts.flushedFail, '(目标 0)');
  console.log('429 提示日志:', counts.rateLimited, '(目标 0)');
  console.log('HTTP 429:', counts.http429, '(目标 0)');
  console.log('HTTP 5xx:', counts.http5xx, '(目标 0)');
  console.log('console error:', counts.consoleError.length, counts.consoleError.slice(0, 3));
  const pass = counts.http429 === 0 && counts.http5xx === 0 && counts.reported === 0 && counts.flushedOk === 0 && counts.consoleError.length === 0;
  console.log(pass ? '✅ PASS' : '❌ FAIL');
  await browser.close();
  process.exit(pass ? 0 : 1);
})();
