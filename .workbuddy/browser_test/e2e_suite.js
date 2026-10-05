// E2E 回归套件 — 覆盖 15 个写域/操作的「真实点击 → 后端 → live SQLite」闭环
//
// 用法（需先启动后端 5000 + 前端 3000）：
//   NODE_PATH="C:/Users/<用户>/.workbuddy/binaries/node/workspace/node_modules" \
//   "<托管node>/node.exe" e2e_suite.js
//
// 产物：e2e_suite_result.json（含每域按钮链路/请求/落库 id）
// 清理：配套 cleanup_e2e.py（删除 E2E_ 标记行 + 还原被改字段）
//
// 设计要点（踩坑固化）：
//  1. Chrome 必须 --single-process 启动，否则沙箱内 chromium.launch 挂死。
//  2. 真实 UI 登录（填表+点按钮）；页面内 fetch 登录须用相对路径 /api/...（Vite 代理）。
//  3. PermissionButton 在权限 isLoading 期间渲染 disabled 按钮 → 点击前必须等非 disabled。
//  4. React 受控输入：Playwright fill() 不触发 onChange → 必须 click()+keyboard.type() 真实键击。
//  5. 合成 .click() 不触发 React onClick → 用 Playwright 原生 locator.click()。
//  6. 精确捕获写请求用「before/after 索引法」，并排除 frontend-performance 上报噪声：
//     reqs.slice(before).filter(r=>r.method==='POST' && !r.url.includes('frontend-performance'))
//     （waitForResponse 在多域连续序列中有竞态假象，勿单独依赖）
//  7. 列表行内按钮需精确定位：evaluate 内给目标按钮 setAttribute 临时标记再点。
//  8. Modal 是 if(!isOpen) return null（无动画）；若 create 抛异常模态不关，遮罩会拦截后续点击。
//  9. 部分域提交前有业务校验，选值须避开冲突（如课程安排 checkConflicts）。
// 10. 审批存在级联副作用（自动写 notification），清理需按 created_at 精准删，勿全表清。
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'e2e_suite_result.json');
const FE = 'http://127.0.0.1:3000';
const CREDS = { u: 'admin', p: 'admin123' };

const reqs = [];
const result = {};
const log = [];
const L = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); log.push(s); console.log(s); };
const postsSince = (n) => reqs.slice(n).filter(r => r.method === 'POST' && !r.url.includes('frontend-performance'));
const writesSince = (n) => reqs.slice(n).filter(r => r.method !== 'GET' && !r.url.includes('frontend-performance') && !r.url.includes('frontend-performance'));
const stamp = () => Date.now();
const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 输入辅助：定义在闭包外，故显式接收 page
async function typeInto(page, selector, value) {
  const el = page.locator(selector).first();
  await el.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(value);
}

// 同 typeInto，但直接接受 locator（用于无 placeholder、需按 label 定位的输入框）
async function typeInto2(page, locator, value) {
  await locator.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(value);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-setuid-sandbox', '--single-process'],
    timeout: 60000,
  });
  const page = await browser.newPage();
  page.on('request', r => { if (r.url().includes('/api/')) reqs.push({ method: r.method(), url: r.url(), _st: null }); });
  page.on('response', r => {
    if (!r.url().includes('/api/')) return;
    const e = reqs.find(x => x.url === r.url() && x._st === null && x.method === r.request().method());
    if (e) e._st = r.status();
  });

  // 每个域一个 case：失败不中断整体，记入 result[domain].error
  const cases = [];
  const defineCase = (name, fn) => cases.push({ name, fn });

  // ---------- 登录 ----------
  async function login() {
    await page.goto(FE + '/#/login', { waitUntil: 'networkidle' });
    await page.fill('input[autocomplete="username"]', CREDS.u);
    await page.fill('input[type="password"]', CREDS.p);
    await page.click('button[aria-label="登录"]');
    await page.waitForFunction(() => {
      try { return JSON.parse(localStorage.getItem('admin') || 'null')?.id === 1; } catch (e) { return false; }
    }, { timeout: 20000 });
    L('loggedIn=true');
  }
  const goto = async (hash, wait = 1800) => {
    await page.keyboard.press('Escape').catch(() => {});
    await page.evaluate(h => { window.location.hash = h; }, hash);
    await page.waitForTimeout(wait);
  };

  // ================= 新增类（11 域） =================
  defineCase('notification', async () => {
    await goto('#/notifications');
    const before = reqs.length;
    await page.locator('button:has-text("发送通知")').first().click();
    await page.waitForSelector('input[placeholder="请输入通知标题"]', { timeout: 10000 });
    const title = 'E2E_SUITE_NOTIF_' + stamp();
    await typeInto(page, 'input[placeholder="请输入通知标题"]', title);
    await typeInto(page, 'textarea[placeholder="请输入通知内容"]', 'e2e suite');
    await page.locator('.fixed.inset-0 button[type="submit"]').first().click();
    await page.waitForTimeout(2200);
    result.notification = { title, post: postsSince(before)[0] || null };
  });

  defineCase('scoreCategory', async () => {
    await goto('#/categories');
    const before = reqs.length;
    await page.locator('button:has-text("添加新分类"), button:has-text("添加分类")').first().click();
    await page.waitForSelector('input[placeholder="请输入分类名称"]', { timeout: 10000 });
    const name = 'E2E_SUITE_CAT_' + stamp();
    await typeInto(page, 'input[placeholder="请输入分类名称"]', name);
    await page.locator('.modal-content button[type="submit"]').click();
    await page.waitForTimeout(2200);
    result.scoreCategory = { name, post: postsSince(before)[0] || null };
  });

  defineCase('classPeriod', async () => {
    await goto('#/class-period-settings');
    const before = reqs.length;
    await page.locator('button:has-text("添加节次")').first().click();
    // 名称框 placeholder 为「例如：第一节课、早自习」；编号是 min=1 max=20 的 number
    await page.waitForSelector('input[placeholder*="例如：第一节课"]', { timeout: 10000 });
    const name = 'E2E_SUITE_PERIOD_' + stamp();
    await typeInto(page, 'input[placeholder*="例如：第一节课"]', name);
    // 编号必须 ≤20（超范围被原生 max 校验拦截提交）
    await typeInto(page, 'input[type="number"][max="20"]', '18');
    await page.locator('button:has-text("添加节次")').last().click();
    await page.waitForTimeout(2200);
    result.classPeriod = { name, post: postsSince(before)[0] || null };
  });

  defineCase('user', async () => {
    await goto('#/users');
    const before = reqs.length;
    // 「添加学生」是 PermissionButton：权限 isLoading 期间 disabled，须等其可点。
    // 用 exact 文本匹配避免命中「导入学生」「导出学生」。
    const addBtn = page.getByRole('button', { name: '添加学生', exact: true }).first();
    await addBtn.waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForFunction(() => {
      const b = Array.from(document.querySelectorAll('button'))
        .find(x => (x.textContent || '').trim() === '添加学生');
      return b && !b.disabled;
    }, { timeout: 15000 });
    await addBtn.click();
    await page.waitForSelector('input[placeholder*="姓名"]', { timeout: 10000 });
    const name = 'E2E_SUITE_USER_' + stamp();
    await typeInto(page, 'input[placeholder*="姓名"]', name);
    await page.locator('button:has-text("创建")').last().click();
    await page.waitForTimeout(2200);
    result.user = { name, post: postsSince(before)[0] || null };
  });

  defineCase('classInfo', async () => {
    await goto('#/class-management');
    const before = reqs.length;
    await page.locator('button:has-text("添加班级")').first().click();
    await page.waitForSelector('input[placeholder="输入班级名称"]', { timeout: 10000 });
    const name = 'E2E_SUITE_CLASS_' + stamp();
    await typeInto(page, 'input[placeholder="输入班级名称"]', name);
    await page.locator('button:has-text("保存")').last().click();
    await page.waitForTimeout(2200);
    result.classInfo = { name, post: postsSince(before)[0] || null };
  });

  defineCase('seatingChart', async () => {
    await goto('#/seating-chart');
    const before = reqs.length;
    await page.locator('button:has-text("新建座次表")').first().click();
    await page.waitForSelector('input[placeholder*="座次表"]', { timeout: 10000 });
    const name = 'E2E_SUITE_SEAT_' + stamp();
    await typeInto(page, 'input[placeholder*="座次表"]', name);
    await page.locator('button:has-text("创建")').last().click();
    await page.waitForTimeout(2200);
    result.seatingChart = { name, post: postsSince(before)[0] || null };
  });

  defineCase('dutyGroup', async () => {
    await goto('#/duty-roster');
    const before = reqs.length;
    await page.locator('button:has-text("新建值日组")').first().click();
    await page.waitForSelector('input[placeholder*="值日组"]', { timeout: 10000 });
    const name = 'E2E_SUITE_DUTY_' + stamp();
    await typeInto(page, 'input[placeholder*="值日组"]', name);
    await page.locator('button:has-text("创建")').last().click();
    await page.waitForTimeout(2200);
    result.dutyGroup = { name, post: postsSince(before)[0] || null };
  });

  defineCase('phoneboxPolicy', async () => {
    // 该页需先在「管理班级」下拉选班，否则走 loadError 分支不渲染放行按钮
    await goto('#/phonebox-policy');
    const before = reqs.length;
    const classSel = page.locator('select').first();
    if (await classSel.count()) {
      await classSel.selectOption({ index: 1 });
      await page.waitForTimeout(2000);
    }
    const btn = page.locator('button:has-text("立即允许本班开箱")').first();
    if (!await btn.count()) { result.phoneboxPolicy = { skipped: '选班后仍未找到放行按钮' }; return; }
    await btn.click();
    await page.waitForTimeout(2000);
    // 可能弹自定义 confirm
    const confirm = page.locator('button:has-text("确定"), button:has-text("确认")').first();
    if (await confirm.count() && await confirm.isVisible().catch(() => false)) {
      await confirm.click().catch(() => {});
      await page.waitForTimeout(1500);
    }
    result.phoneboxPolicy = { write: writesSince(before)[0] || null };
  });

  defineCase('rule', async () => {
    await goto('#/rules');
    const before = reqs.length;
    await page.locator('button:has-text("添加规则")').first().click();
    await page.waitForSelector('input[placeholder="请输入规则名称"]', { timeout: 10000 });
    const name = 'E2E_SUITE_RULE_' + stamp();
    await typeInto(page, 'input[placeholder="请输入规则名称"]', name);
    await typeInto(page, 'input[placeholder="正数为加分，负数为扣分"]', '5');
    await page.locator('.modal-content button[type="submit"]').click();
    await page.waitForTimeout(2200);
    result.rule = { name, post: postsSince(before)[0] || null };
  });

  defineCase('courseSchedule', async () => {
    // 提交前有 checkConflicts()，必须选空闲 (class, day, period)；节次2 通常空闲
    await goto('#/course-schedule');
    const before = reqs.length;
    await page.locator('button:has-text("添加课程安排")').first().click();
    await page.waitForSelector('select', { timeout: 10000 });
    await page.waitForTimeout(900);
    const sels = page.locator('.fixed.inset-0 select');
    await sels.nth(0).selectOption({ index: 1 }); // 班级
    await sels.nth(1).selectOption({ index: 1 }); // 科目
    await sels.nth(2).selectOption({ index: 0 }); // 星期(0=周一)
    await sels.nth(3).selectOption({ index: 1 }); // 节次2
    const classroom = 'E2E_SUITE_' + (stamp() % 1000);
    await typeInto(page, 'input[placeholder="输入教室"]', classroom);
    await page.locator('.fixed.inset-0 button:has-text("保存")').click();
    await page.waitForTimeout(2400);
    result.courseSchedule = { classroom, post: postsSince(before)[0] || null };
  });

  defineCase('parentContact', async () => {
    await goto('#/parent-contact');
    const before = reqs.length;
    await page.locator('button:has-text("添加家长")').first().click();
    await page.waitForSelector('input[placeholder="父亲姓名"]', { timeout: 10000 });
    await page.waitForTimeout(900);
    await page.locator('.fixed.inset-0 select').first().selectOption({ index: 1 }); // 学生
    const fname = 'E2E_SUITE_F' + (stamp() % 100000);
    await typeInto(page, 'input[placeholder="父亲姓名"]', fname);
    await typeInto(page, 'input[type="tel"]', '13800000000');
    await page.locator('.fixed.inset-0 button:has-text("添加")').click();
    await page.waitForTimeout(2200);
    result.parentContact = { fname, post: postsSince(before)[0] || null };
  });

  // ================= 非新增类（4 域） =================
  defineCase('approve', async () => {
    await goto('#/approvals');
    const before = reqs.length;
    const btn = page.locator('button:has-text("通过")').first();
    if (!await btn.count()) { result.approve = { skipped: '无 pending 申请' }; return; }
    await btn.click();
    await page.waitForSelector('text=确定要通过这个申请吗？', { timeout: 10000 });
    await page.getByRole('button', { name: '通过' }).last().click();
    await page.waitForTimeout(2500);
    const w = writesSince(before)[0] || null;
    const m = w ? w.url.match(/\/approvals\/(\d+)/) : null;
    result.approve = { id: m ? Number(m[1]) : null, write: w };
  });

  defineCase('deleteNotification', async () => {
    // fetch 自建 + 真实 UI 删除按钮删除（零污染自删）；绕开发送模态偶发不稳定
    await goto('#/notifications');
    const created = await page.evaluate(async () => {
      const csrf = (document.cookie.split('; ').find(c => c.startsWith('csrf_token=')) || '').split('=')[1] || '';
      const title = 'E2E_SUITE_DEL_' + Date.now();
      const r = await fetch('/api/admin_notifications/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
        body: JSON.stringify({ title, message: 'del test', type: 'info', priority: 'medium', admin_id: 1 }),
      });
      const t = await r.text();
      let id = null; try { const j = JSON.parse(t); id = j?.data?.notification?.id ?? j?.data?.id ?? null; } catch (e) {}
      return { status: r.status, title, id };
    });
    await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(1600);
    const marked = await page.evaluate((title) => {
      for (const b of Array.from(document.querySelectorAll('button'))) {
        if (!(b.textContent || '').trim().includes('删除')) continue;
        let p = b;
        while (p && p !== document.body) {
          if ((p.textContent || '').includes(title)) { b.setAttribute('data-e2e-del', '1'); return true; }
          p = p.parentElement;
        }
      }
      return false;
    }, created.title);
    const before = reqs.length;
    if (marked) {
      await page.locator('[data-e2e-del="1"]').click();
      await page.waitForSelector('text=确定要删除这条通知吗？', { timeout: 10000 });
      await page.getByRole('button', { name: '确定' }).last().click();
      await page.waitForTimeout(2000);
    }
    result.deleteNotification = { created, marked, deleteWrite: writesSince(before)[0] || null };
  });

  defineCase('editCategory', async () => {
    await goto('#/categories');
    const before = reqs.length;
    const editBtn = page.locator('button.btn-icon.text-warning-500').first();
    if (!await editBtn.count()) { result.editCategory = { skipped: '无编辑按钮' }; return; }
    await editBtn.click();
    await page.waitForSelector('input[placeholder="请输入分类名称"]', { timeout: 10000 });
    const nameInput = page.locator('input[placeholder="请输入分类名称"]');
    result.editCategory = { beforeName: await nameInput.inputValue() };
    await typeInto(page, 'input[placeholder="请输入分类名称"]', 'E2E_SUITE_EDIT_' + stamp());
    await page.getByRole('button', { name: '保存修改' }).click();
    await page.waitForTimeout(2200);
    const w = writesSince(before)[0] || null;
    const m = w ? w.url.match(/score-categories\/(\d+)/) : null;
    result.editCategory.id = m ? Number(m[1]) : null;
    result.editCategory.write = w;
  });

  defineCase('scoreEntry', async () => {
    // 网格录入：选考试 → 单元格填分 → 失焦自动保存 / 「保存全部」
    await goto('#/score-entry', 2200);
    const examSel = page.locator('select').first();
    // 考试列表为异步加载，须等 option 数量 > 1（仅「请选择考试」时为 1）
    try {
      await page.waitForFunction(() => {
        const s = document.querySelector('select');
        return s && s.options.length > 1;
      }, { timeout: 15000 });
    } catch (e) {
      result.scoreEntry = { skipped: '考试列表加载超时/为空' };
      return;
    }
    const before = reqs.length;
    await examSel.selectOption({ index: 1 });
    await page.waitForTimeout(3000);
    // 找第一个可编辑分数输入框
    const cell = page.locator('input[inputmode="decimal"], input[type="number"], table input').first();
    let filled = false;
    if (await cell.count()) {
      await cell.click();
      await page.keyboard.press('Control+a');
      await page.keyboard.type('88');
      await page.keyboard.press('Tab'); // 失焦触发自动保存
      await page.waitForTimeout(1800);
      filled = true;
    }
    const saveAll = page.locator('button:has-text("保存全部")').first();
    if (await saveAll.count() && await saveAll.isEnabled()) {
      await saveAll.click();
      await page.waitForTimeout(2400);
    }
    result.scoreEntry = { filled, writes: writesSince(before).filter(w => !/exam/.test(w.url)) };
  });

  // ---------- 执行 ----------
  try {
    await login();
    for (const c of cases) {
      try {
        await c.fn();
        L('[OK]', c.name, JSON.stringify(result[c.name] || {}).slice(0, 200));
      } catch (e) {
        result[c.name] = { error: e.message };
        L('[FAIL]', c.name, e.message);
      }
    }
  } catch (e) {
    L('FATAL', e.message);
    result._fatal = e.message;
  } finally {
    // 汇总
    const summary = {};
    for (const k of Object.keys(result)) {
      if (k.startsWith('_')) continue;
      const r = result[k] || {};
      const w = r.post || r.write || r.deleteWrite || (Array.isArray(r.writes) ? r.writes[0] : null);
      summary[k] = r.error ? 'ERROR: ' + r.error.slice(0, 80)
        : r.skipped ? 'SKIPPED: ' + r.skipped
        : w ? 'WRITE ' + w.method + ' ' + w.url.replace(/^https?:\/\/[^/]+/, '') + ' → ' + w._st
        : 'NO_WRITE';
    }
    result._summary = summary;
    result._log = log;
    fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
    L('--- SUMMARY ---');
    for (const [k, v] of Object.entries(summary)) L(' ', k, '=>', v);
    L('WROTE', OUT);
    L('下一步：运行 cleanup_e2e.py 清理 E2E_ 数据');
    await browser.close();
  }
})();
