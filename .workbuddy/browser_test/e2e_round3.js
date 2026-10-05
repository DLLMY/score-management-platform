// Round3: 审批(状态变更) / 删除(销毁) / 编辑(更新) 三类"非新增"写操作真实点击实证
// 修复：发送通知模态关闭后再点删除；每步前 ESC 兜底清残留 modal。
const { chromium } = require('playwright-core');
const fs = require('fs');

const OUT = 'c:/Users/53527/Desktop/自我管理提升/自我管理提升V2.0/平台开发/管理平台设计/.workbuddy/browser_test/e2e_round3_result.json';
const log = [];
const reqs = [];
function L(...a){ const s=a.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' '); log.push(s); console.log(s); }

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-setuid-sandbox','--single-process'],
    timeout: 60000,
  });
  const page = await browser.newPage();
  let loginBody = null;
  page.on('request', (r) => { const u=r.url(); if(u.includes('/api/')) reqs.push({method:r.method(), url:u, _st:null}); });
  page.on('response', async (r) => {
    const u=r.url();
    if(u.includes('/api/')){
      const e=reqs.find(x=>x.url===u && x._st===null && x.method===r.request().method());
      if(e) e._st=r.status();
      if(u.includes('/api/auth/login')) { try { loginBody = await r.text(); } catch(e){} }
    }
  });
  const result = { approval:{}, delNotif:{}, editCat:{} };
  const waitGone = async (sel) => { await page.waitForSelector(sel, { state:'detached', timeout:8000 }).catch(()=>{}); };

  try {
    await page.goto('http://127.0.0.1:3000/#/login', { waitUntil: 'networkidle' });
    await page.fill('input[autocomplete="username"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[aria-label="登录"]');
    try {
      await page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('admin')||'null')?.id===1; } catch(e){ return false; } }, { timeout: 15000 });
      L('loggedIn=true');
    } catch (e) {
      const ls = await page.evaluate(() => localStorage.getItem('admin'));
      const url = page.url();
      L('LOGIN_FAIL url=', url, 'localStorage.admin=', (ls||'').slice(0,300), 'loginBody=', (loginBody||'').slice(0,400));
      throw e;
    }
    await page.waitForSelector('text=积分管理平台', { timeout: 8000 });
    L('dashboard visible');

    // ---- 1) 审批写 ----
    await page.evaluate(() => { window.location.hash = '#/approvals'; });
    await page.waitForTimeout(1500);
    await page.locator('button:has-text("通过")').first().click();
    await page.waitForSelector('text=确定要通过这个申请吗？', { timeout: 8000 });
    await page.getByRole('button', { name: '通过' }).last().click();
    await page.waitForTimeout(2500);
    await waitGone('text=确定要通过这个申请吗？');
    const appReq = reqs.filter(r=>r.method==='PUT' || r.method==='POST').find(r=>/approvals\/\d+\/approve/.test(r.url));
    result.approval.req = appReq ? { method:appReq.method, url:appReq.url, status:appReq._st } : null;
    const am = result.approval.req ? result.approval.req.url.match(/\/approvals\/(\d+)/) : null;
    result.approval.id = am ? Number(am[1]) : null;
    L('approval=', result.approval);

    // ---- 2) 删除写（fetch 自建 + 真实 UI 删除按钮自删，零污染） ----
    await page.keyboard.press('Escape').catch(()=>{});
    await page.evaluate(() => { window.location.hash = '#/notifications'; });
    await page.waitForTimeout(1500);
    // 用 fetch 创建一条 E2E 删除用通知（绕过发送模态偶发不稳定；创建路径已由 round1 真实按钮验证）
    const createRes = await page.evaluate(async () => {
      const csrf = (document.cookie.split('; ').find(c=>c.startsWith('csrf_token='))||'').split('=')[1] || '';
      const title = 'E2E_DEL_' + Date.now();
      const r = await fetch('/api/admin_notifications/', {
        method:'POST',
        headers:{'Content-Type':'application/json','X-CSRFToken':csrf},
        body: JSON.stringify({title, message:'del test', type:'info', priority:'medium', admin_id:1})
      });
      const txt = await r.text();
      let id=null; try { const j=JSON.parse(txt); id = j?.data?.notification?.id ?? j?.data?.id ?? null; } catch(e){}
      return { status:r.status, title, id };
    });
    result.delNotif.create = createRes;
    L('delNotif.create=', createRes);
    // 刷新列表以显示新建通知
    await page.reload({ waitUntil:'networkidle' }).catch(()=>{});
    await page.waitForSelector('text=积分管理平台', { timeout: 10000 }).catch(()=>{});
    await page.waitForTimeout(1500);
    // 在页面内给目标删除按钮打临时标记（精确匹配所属卡片含该 title）
    const marked = await page.evaluate((title) => {
      const all = Array.from(document.querySelectorAll('button'));
      for (const b of all) {
        const txt = (b.textContent||'').trim();
        if (txt.includes('删除')) {
          let p=b, found=false;
          while(p && p!==document.body){ if((p.textContent||'').includes(title)){found=true;break;} p=p.parentElement; }
          if(found){ b.setAttribute('data-e2e-del','1'); return true; }
        }
      }
      return false;
    }, createRes.title);
    L('delNotif.marked=', marked);
    const delBtn = page.locator('[data-e2e-del="1"]');
    await delBtn.waitFor({ state:'visible', timeout:8000 });
    await delBtn.click({ timeout: 10000 });
    await page.waitForSelector('text=确定要删除这条通知吗？', { timeout: 8000 });
    await page.getByRole('button', { name: '确定' }).last().click();
    await page.waitForTimeout(2000);
    const delReq = reqs.filter(r=>r.method==='DELETE' && /admin_notifications/.test(r.url)).pop();
    result.delNotif.deleteReq = delReq ? {method:delReq.method,url:delReq.url,status:delReq._st} : null;
    const dm = result.delNotif.deleteReq ? result.delNotif.deleteReq.url.match(/\/admin_notifications\/(\d+)/) : null;
    result.delNotif.id = dm ? Number(dm[1]) : null;
    L('delNotif=', result.delNotif);

    // ---- 3) 编辑写 ----
    await page.keyboard.press('Escape').catch(()=>{});
    await page.evaluate(() => { window.location.hash = '#/categories'; });
    await page.waitForTimeout(1500);
    const editBtn = page.locator('button.btn-icon.text-warning-500').first();
    await editBtn.waitFor({ state:'visible', timeout:10000 });
    await editBtn.click();
    await page.waitForSelector('input[placeholder="请输入分类名称"]', { timeout: 8000 });
    const nameInput = page.locator('input[placeholder="请输入分类名称"]');
    result.editCat.beforeName = await nameInput.inputValue();
    await nameInput.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Backspace');
    const newName = 'E2E_EDIT_' + Date.now();
    await page.keyboard.type(newName);
    await page.getByRole('button', { name: '保存修改' }).click();
    await page.waitForTimeout(2000);
    const editReq = reqs.filter(r=>r.method==='PUT' && /score-categories/.test(r.url)).pop();
    result.editCat.req = editReq ? {method:editReq.method,url:editReq.url,status:editReq._st} : null;
    result.editCat.afterName = newName;
    const em = result.editCat.req ? result.editCat.req.url.match(/\/score-categories\/(\d+)/) : null;
    result.editCat.id = em ? Number(em[1]) : null;
    L('editCat=', result.editCat);

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
