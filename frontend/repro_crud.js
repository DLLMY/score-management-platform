const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:3006';

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERR: '+e.message));
  page.on('console', m => { if (m.type()==='error') errors.push('CONSOLE: '+m.text().slice(0,200)); });

  await page.goto(BASE + '/#/login', { waitUntil: 'networkidle' });
  await page.fill('input[autocomplete="username"]', 'teacher');
  await page.fill('input[autocomplete="current-password"]', '123456');
  await page.getByRole('button', { name: '登录' }).click();
  await page.waitForTimeout(2500);

  // ---- TEST 1: create homework ----
  console.log('\n--- TEST homework create ---');
  await page.goto(BASE + '/#/homework-check', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  try {
    await page.getByRole('button', { name: '布置作业' }).click();
    await page.waitForTimeout(500);
    await page.fill('input[placeholder="如：高一(1)班座次表"]', '测试作业A');
    // class_id input (number)
    const classInput = page.locator('input[type="number"]').first();
    await classInput.fill('1');
    // due_date (type=date)
    const dateInput = page.locator('input[type="date"]').nth(1);
    await dateInput.fill('2026-09-01');
    await page.getByRole('button', { name: '保存' }).click();
    await page.waitForTimeout(1500);
    const txt = await page.evaluate(() => document.body.innerText);
    console.log('  after submit, toast/has 测试作业A:', txt.includes('测试作业A'), '| snippet:', txt.replace(/\s+/g,' ').slice(0,200));
  } catch (e) { console.log('  homework create ERROR:', e.message); }

  // ---- TEST 2: create seating chart ----
  console.log('\n--- TEST seating create ---');
  await page.goto(BASE + '/#/seating-chart', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  try {
    await page.getByRole('button', { name: '新建座次表' }).click();
    await page.waitForTimeout(500);
    await page.fill('input[placeholder="如：高一(1)班座次表"]', '测试座次表A');
    await page.getByRole('button', { name: '创建' }).click();
    await page.waitForTimeout(1500);
    const txt = await page.evaluate(() => document.body.innerText);
    console.log('  after submit has 测试座次表A:', txt.includes('测试座次表A'), '| snippet:', txt.replace(/\s+/g,' ').slice(0,200));
  } catch (e) { console.log('  seating create ERROR:', e.message); }

  // ---- TEST 3: attendance quick record ----
  console.log('\n--- TEST attendance record ---');
  await page.goto(BASE + '/#/attendance', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  try {
    await page.getByRole('button', { name: '快速记录' }).click();
    await page.waitForTimeout(500);
    const clsIn = page.locator('input[type="number"]').first();
    await clsIn.fill('1');
    const stuIn = page.locator('input[type="number"]').nth(1);
    await stuIn.fill('1');
    await page.getByRole('button', { name: '保存记录' }).click();
    await page.waitForTimeout(1500);
    const txt = await page.evaluate(() => document.body.innerText);
    console.log('  after submit snippet:', txt.replace(/\s+/g,' ').slice(0,200));
  } catch (e) { console.log('  attendance record ERROR:', e.message); }

  console.log('\nERRORS:', errors.length);
  errors.slice(0,10).forEach(e => console.log('  '+e));
  await context.close();
  await browser.close();
}
run().then(()=>process.exit(0)).catch(e=>{console.error('FATAL',e);process.exit(1);});
