// 定向补测 v2：成绩录入页「批量操作」面板内的 3 个真实操作键
//   批量确认 / 批量重置 / 批量删除
// 关键修正：用 Playwright 原生 selectOption 让 React 受控 <select> 真正更新 state.batchSubject，
//           使三个 PermissionButton 由 disabled 变为 enabled，从而真正触发业务 API。
// 安全策略：测试前对 dev SQLite 打快照，测试完整体还原（净零数据变更）。
//   批量确认/批量重置：真实提交（捕获业务 API 即视为通过，数据由快照还原）。
//   批量删除：点击后验证二次确认弹窗正确渲染即取消（不真正删除全科目成绩）。
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = 'C:/Users/53527/Desktop/自我管理提升/自我管理提升V2.0/平台开发/管理平台设计/.workbuddy/browser_test';
const INST = 'C:/Users/53527/Desktop/自我管理提升/自我管理提升V2.0/平台开发/管理平台设计/apps/backend/instance/';
const LIVE = INST + 'score_management.db';
const SNAP = OUT + '/db_snapshot_batchbtn.db';
const RESULT = OUT + '/batch_buttons_result.jsonl';
fs.writeFileSync(RESULT, '');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = s => fs.appendFileSync(RESULT, s + '\n');
const md5 = p => { try { return crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex'); } catch (e) { return 'ERR'; } };

function snap() { try { fs.copyFileSync(LIVE, SNAP); } catch (e) { console.log('SNAP FAIL', e.message); } console.log('snapshot md5', md5(SNAP)); }
function restore() { try { fs.copyFileSync(SNAP, LIVE); } catch (e) { console.log('RESTORE FAIL', e.message); } console.log('after-restore md5', md5(LIVE), 'match=', md5(LIVE) === md5(SNAP)); }

(async () => {
  snap();
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 1200 } });
  const page = await ctx.newPage();
  const writes = [];
  page.on('response', r => {
    const m = r.request().method();
    const u = r.url().split('?')[0];
    if (/frontend-performance/.test(u)) return;               // 排除遥测信标
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(m) || (m === 'GET' && /\/api\//.test(u))) {
      writes.push({ m, url: u.replace('http://127.0.0.1:3000', ''), status: r.status() });
    }
  });

  await page.goto('http://127.0.0.1:3000/#/login', { waitUntil: 'networkidle' }); await sleep(1200);
  await page.fill('input[placeholder="请输入用户名"]', 'admin');
  await page.fill('input[placeholder="请输入密码"]', 'Test@123456');
  await page.click('button:has-text("登录")'); await sleep(2500);
  await page.goto('http://127.0.0.1:3000/#/score-entry', { waitUntil: 'networkidle' }); await sleep(1500);

  const results = [];
  // 先选考试（页面级），让 examSubjects 有数据，批量科目下拉才会有选项
  const examInfo = await page.evaluate(() => {
    const selects = Array.from(document.querySelectorAll('select'));
    const idx = selects.findIndex(s => Array.from(s.options).some(o => /请选择考试/.test(o.text)));
    if (idx < 0) return { found: false };
    const opts = Array.from(selects[idx].options).filter(o => o.value);
    return { found: true, idx, opts: opts.length };
  });
  let chosenExam = -1;
  if (examInfo.found && examInfo.opts > 0) {
    for (let i = 1; i <= examInfo.opts; i++) {
      await page.locator('select').nth(examInfo.idx).selectOption({ index: i });
      await sleep(1600);
      const subjCount = await page.evaluate(() => {
        const selects = Array.from(document.querySelectorAll('select'));
        const idx = selects.findIndex(s => Array.from(s.options).some(o => /请选择科目/.test(o.text)));
        if (idx < 0) return 0;
        return Array.from(selects[idx].options).filter(o => o.value).length;
      });
      if (subjCount > 0) { chosenExam = i; break; }
    }
  }
  console.log('考试选择:', JSON.stringify(examInfo), 'chosenExamIndex=', chosenExam);
  results.push({ step: 'select_exam', examInfo, chosenExamIndex: chosenExam });

  const opened = await page.evaluate(() => {
    const vis = e => getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden';
    const labelOf = el => (el.innerText || el.getAttribute('title') || '').trim();
    const els = Array.from(document.querySelectorAll('button,[role=button],a.ant-btn')).filter(e => vis(e));
    const t = els.find(e => labelOf(e) === '批量操作') || els.find(e => labelOf(e).includes('批量操作'));
    if (t) { t.click(); return true; } return false;
  });
  await sleep(1000);
  console.log('批量操作面板打开:', opened);
  results.push({ step: 'open_batch_modal', ok: opened });

  // 选中科目（用 Playwright 原生 selectOption 让 React state 真正更新）
  const selInfo = await page.evaluate(() => {
    const selects = Array.from(document.querySelectorAll('select'));
    const idx = selects.findIndex(s => Array.from(s.options).some(o => /请选择科目/.test(o.text)));
    if (idx < 0) return { found: false };
    const opts = Array.from(selects[idx].options).filter(o => o.value);
    return { found: true, idx, opts: opts.length };
  });
  let subjectVal = null;
  if (selInfo.found && selInfo.opts > 0) {
    const loc = page.locator('select').nth(selInfo.idx);
    await loc.selectOption({ index: 1 });   // 第一个真实科目
    await sleep(500);
    subjectVal = await page.evaluate(i => document.querySelectorAll('select')[i].value, selInfo.idx);
  }
  console.log('科目选择:', JSON.stringify(selInfo), '=> value=', subjectVal);
  results.push({ step: 'select_subject', selInfo, value: subjectVal });

  async function btnState(txt) {
    return await page.evaluate(arg => {
      const vis = e => getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden';
      const labelOf = el => (el.innerText || el.getAttribute('title') || '').trim();
      const els = Array.from(document.querySelectorAll('button,[role=button]')).filter(e => vis(e));
      const el = els.find(e => labelOf(e) === arg);
      if (!el) return { exists: false };
      return { exists: true, disabled: el.disabled, text: labelOf(el) };
    }, txt);
  }
  async function clickBatch(txt) {
    writes.length = 0;
    const before = md5(LIVE);
    const st = await btnState(txt);
    let clicked = false;
    if (st.exists && !st.disabled) {
      await page.evaluate(arg => {
        const vis = e => getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden';
        const labelOf = el => (el.innerText || el.getAttribute('title') || '').trim();
        const els = Array.from(document.querySelectorAll('button,[role=button]')).filter(e => vis(e));
        const el = els.find(e => labelOf(e) === arg); if (el) el.click();
      }, txt);
      clicked = true;
    }
    await sleep(1800);
    const confirmOpen = await page.evaluate(() => {
      const vis = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden'; };
      return [...document.querySelectorAll('[role=dialog],.ant-modal-content,div.fixed.inset-0')].some(e => vis(e) && /确定删除|确认删除|删除确认|永久删除|此操作|二次确认|确认要/.test(e.innerText || ''));
    });
    let cancelled = false;
    if (confirmOpen) {
      await page.evaluate(() => {
        const vis = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden'; };
        const roots = [...document.querySelectorAll('[role=dialog],.ant-modal-content,div.fixed.inset-0')].filter(vis);
        const root = roots[roots.length - 1];
        const c = [...root.querySelectorAll('button')].filter(vis).find(b => /取消|关闭|×|否/.test(b.innerText || ''));
        if (c) c.click();
      });
      await sleep(600); cancelled = true;
    }
    const after = md5(LIVE);
    const biz = writes.filter(w => !/frontend-performance/.test(w.url));
    return { text: txt, stateBefore: st, clicked, confirmDialog: confirmOpen, cancelled, writes: biz, dataChanged: after !== before };
  }

  const confirm = await clickBatch('批量确认');
  console.log('批量确认:', JSON.stringify(confirm)); results.push({ button: '批量确认', ...confirm });
  // 若弹窗被关闭需重新打开
  if (!(await btnState('批量重置')).exists) {
    await page.evaluate(() => {
      const vis = e => getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden';
      const labelOf = el => (el.innerText || el.getAttribute('title') || '').trim();
      const els = Array.from(document.querySelectorAll('button,[role=button],a.ant-btn')).filter(e => vis(e));
      const t = els.find(e => labelOf(e) === '批量操作'); if (t) t.click();
    });
    await sleep(800);
    if (selInfo.found) { await page.locator('select').nth(selInfo.idx).selectOption({ index: 1 }); await sleep(400); }
  }
  const reset = await clickBatch('批量重置');
  console.log('批量重置:', JSON.stringify(reset)); results.push({ button: '批量重置', ...reset });
  if (!(await btnState('批量删除')).exists) {
    await page.evaluate(() => {
      const vis = e => getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden';
      const labelOf = el => (el.innerText || el.getAttribute('title') || '').trim();
      const els = Array.from(document.querySelectorAll('button,[role=button],a.ant-btn')).filter(e => vis(e));
      const t = els.find(e => labelOf(e) === '批量操作'); if (t) t.click();
    });
    await sleep(800);
    if (selInfo.found) { await page.locator('select').nth(selInfo.idx).selectOption({ index: 1 }); await sleep(400); }
  }
  const del = await clickBatch('批量删除');
  console.log('批量删除:', JSON.stringify(del)); results.push({ button: '批量删除', ...del });

  await browser.close();
  log(JSON.stringify({ results, snapshot: SNAP, liveBefore: md5(SNAP) }));
  restore();
  log('__DONE__');
  console.log('BATCH TEST DONE');
})();
