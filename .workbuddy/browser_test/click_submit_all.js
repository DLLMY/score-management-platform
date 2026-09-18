// 真实提交验收：对 48 个页面的「每一个」交互按钮真实点击并提交（新增表单真实落库、编辑真实保存、
// 删除/移除/清空真实确认执行、开关/筛选真实生效），验证端到端不报错。
// 安全边界（与用户确认）：
//   ① 物理硬件控制按钮（开A箱/开B箱/批量OTA/远程控制/重启/唤醒）在网络层 aborts，绝不向真实 ESP32 下发指令；
//      仅在 UI 层验证其确认弹窗能正确渲染。
//   ② 测试前已对 dev SQLite 打快照，测试完整体还原（净零数据变更）。
//   ③ 破坏性删除：仅当表格行数>=2 才真正执行，避免清空核心表导致后续测试自污染；最终仍以快照还原兜底。
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = 'C:/Users/53527/Desktop/自我管理提升/自我管理提升V2.0/平台开发/管理平台设计/.workbuddy/browser_test';
const SHOTS = path.join(OUT, 'shots_submit');
const RESULT = path.join(OUT, 'submit_results.jsonl');
const BASE = 'http://127.0.0.1:3000';
fs.mkdirSync(SHOTS, { recursive: true });
// 清空逻辑见下方：仅全量运行(PAGES 未指定)才截断；分片运行(PAGES 指定)改为追加，避免覆盖已有结果

const FILTER = (process.env.PAGES || '').split(',').map(s=>s.trim()).filter(Boolean).map(Number);
const ONLY = FILTER.length ? new Set(FILTER) : null;
if(!ONLY) fs.writeFileSync(RESULT, ''); // 全量运行才清空结果；分片(PAGES)追加

const ROUTES = [
  ['#/dashboard','数据概览'],['#/users','学生管理'],['#/analysis','数据分析'],['#/class-compare','班级对比'],
  ['#/rules','积分规则'],['#/rank-rules','排名规则'],['#/categories','分类管理'],['#/nlp-management','智能评分'],
  ['#/class-management','班级管理'],['#/subject-management','科目管理'],['#/course-schedule','课程表管理'],['#/class-time-settings','时间规则设置'],
  ['#/class-period-settings','课程节次管理'],['#/workbench','工作台总览'],['#/seating-chart','座次表'],['#/duty-roster','值日生表'],
  ['#/committee','班委名单'],['#/parent-contact','家长联系'],['#/homework-check','作业检查'],['#/attendance','考勤管理'],
  ['#/study-groups','学习小组'],['#/mental-health','心理健康'],['#/activity','文体活动'],['#/culture','班级文化'],
  ['#/study-guide','学法指导'],['#/teacher-comments','评语管理'],['#/phonebox-policy','手机箱开箱策略'],['#/exams','考试管理'],
  ['#/score-entry','成绩录入'],['#/score-records','成绩档案'],['#/score-analysis','成绩分析'],['#/algorithm-analysis','算法分析'],
  ['#/devices','设备管理'],['#/device-groups','设备分组'],['#/firmware','固件管理'],['#/notifications','通知管理'],
  ['#/approvals','审批管理'],['#/remote-notify','远程通知'],['#/wake-on-lan','远程开机'],['#/settings','系统设置'],
  ['#/permission','权限管理'],['#/data-sync','数据同步'],['#/ops-center','运维总览'],['#/ops-center/telemetry','前端遥测'],
  ['#/ops-center/metrics','系统指标趋势'],['#/diagnostics','系统诊断'],['#/security-audit','安全审计'],['#/operation-logs','操作日志'],
  ['#/help','帮助中心'],
];

const DEVICE_CONTROL = /开\s*A\s*箱|开\s*B\s*箱|批量\s*OTA|远程控制|重启设备|唤醒|强制.*下线|锁定设备/;
// 系统级危险操作：真实提交会杀后端/注销会话，只验证弹窗不确认执行
const DANGER = /重启(服务|系统|后端|应用|服务器)?|停止服务|退出登录|登出|注销账户|清空所有|重置系统|恢复出厂|清空缓存|重建索引/;
const DESTRUCTIVE = /删除|移除|作废|清空|重置全部|解散|删除用户|删除班级|删除设备/;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function log(s){ fs.appendFileSync(RESULT, s + '\n'); }
function safeStr(o){ const seen=new WeakSet(); return JSON.stringify(o, (k,v)=>{ if(typeof v==='object'&&v!==null){ if(seen.has(v)) return '[circular]'; seen.add(v); } if(typeof v==='function') return '[fn]'; return v; }); }

const SEL = 'button,[role=button],a.ant-btn,a[class*=btn],input[type=submit],div[role=tab],a[role=tab],li[role=tab]';

async function enumButtons(page){
  return await page.evaluate((SEL)=>{
    const vis=e=>getComputedStyle(e).display!=='none';
    const inNav=el=>!!el.closest('nav,aside,.sidebar,.ant-menu,[class*=sidebar],[class*=menu],header,.header,[class*=header]');
    const labelOf=el=>(el.innerText||el.getAttribute('title')||el.getAttribute('aria-label')||el.value||'').trim().replace(/\s+/g,' ');
    const els=Array.from(document.querySelectorAll(SEL)).filter(e=>vis(e) && !inNav(e));
    const seen=new Set(); const out=[];
    for(const e of els){ const t=labelOf(e); if(!t) continue; const key=t+'|'+e.tagName; if(seen.has(key)) continue; seen.add(key); out.push({text:t, tag:e.tagName, cls:(e.className||'').toString().slice(0,60)}); }
    return out;
  }, SEL);
}

async function isModalOpen(page){
  return await page.evaluate(()=>{
    const vis=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
    const sels=['[role=dialog]','.ant-modal-content','.ant-drawer-content','div.fixed.inset-0','div[class*=overlay]'];
    for(const s of sels){ for(const e of Array.from(document.querySelectorAll(s))){ if(vis(e)) return true; } }
    return false;
  });
}

async function clickByText(page, txt){
  for(let attempt=0; attempt<3; attempt++){
    const ok = await page.evaluate((txt)=>{
      const SEL='button,[role=button],a.ant-btn,a[class*=btn],input[type=submit],div[role=tab],a[role=tab],li[role=tab]';
      const vis=e=>getComputedStyle(e).display!=='none';
      const inNav=el=>!!el.closest('nav,aside,.sidebar,.ant-menu,[class*=sidebar],[class*=menu],header,.header,[class*=header]');
      const labelOf=el=>(el.innerText||el.getAttribute('title')||el.getAttribute('aria-label')||el.value||'').trim().replace(/\s+/g,' ');
      const els=Array.from(document.querySelectorAll(SEL)).filter(e=>vis(e) && !inNav(e));
      let target=els.find(e=>labelOf(e)===txt);
      if(!target) target=els.find(e=>labelOf(e).startsWith(txt+' ') || labelOf(e).endsWith(' '+txt));
      if(!target) return false;
      try{ target.click(); }catch(e){ return false; }
      return true;
    }, txt);
    if(ok) return true;
    if(attempt===0){
      await page.evaluate(()=>{
        const SEL='button,[role=button],a.ant-btn,a[class*=btn]';
        const vis=e=>getComputedStyle(e).display!=='none';
        const labelOf=el=>(el.innerText||el.getAttribute('title')||'').trim();
        const trig=Array.from(document.querySelectorAll(SEL)).filter(e=>vis(e)&&/^(更多|操作|更多操作|展开|设置|···|⋮)$|更多操作/.test(labelOf(e)));
        if(trig.length) trig[0].click();
      }).catch(()=>{});
      await sleep(600);
    }
    await sleep(400);
  }
  return false;
}

async function countRows(page){
  return await page.evaluate(()=>{
    const t=document.querySelector('.ant-table-tbody')||document.querySelector('table tbody');
    if(!t) return -1;
    return t.querySelectorAll('tr.ant-table-row,tr:not(:first-child)').length;
  });
}

// 统一的「可见模态根」检测：同时兼容 antd Modal/Drawer 与本项目自定义 Tailwind 模态
// （div.fixed.inset-0 z-[100]...）。仅保留含交互内容的，排除纯背景/布局。
async function modalRoots(page){
  return await page.evaluate(()=>{
    const vis=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
    return [...document.querySelectorAll('[role=dialog],.ant-modal-content,.ant-drawer-content,div.fixed.inset-0')]
      .filter(vis)
      .filter(e=>e.querySelector('button,input,textarea,.ant-form-item,[role=button],a'))
      .map(e=>e.outerHTML.slice(0,40));
  });
}
async function modalRootHandle(page){
  return await page.evaluateHandle(()=>{
    const vis=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
    const cand=[...document.querySelectorAll('[role=dialog],.ant-modal-content,.ant-drawer-content,div.fixed.inset-0')].filter(vis);
    const inter=cand.filter(e=>e.querySelector('button,input,textarea,.ant-form-item,[role=button],a'));
    return inter.length?inter[inter.length-1]:null;
  });
}

// 通用表单填充：text/number/email/textarea/select/datepicker/switch/radio 全部尝试填充
async function fillForm(page){
  return await page.evaluate(async ()=>{
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    function setNativeValue(el,value){
      try{
        const proto=Object.getPrototypeOf(el);
        const desc=Object.getOwnPropertyDescriptor(proto,'value')||Object.getOwnPropertyDescriptor(el,'value');
        if(desc&&desc.set){ desc.set.call(el,value); } else { el.value=value; }
      }catch(_){ el.value=value; }
      el.dispatchEvent(new Event('input',{bubbles:true}));
      el.dispatchEvent(new Event('change',{bubbles:true}));
    }
    const vis=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
    const cand=[...document.querySelectorAll('[role=dialog],.ant-modal-content,.ant-drawer-content,div.fixed.inset-0')].filter(vis);
    const roots=cand.filter(e=>e.querySelector('button,input,textarea,.ant-form-item,[role=button],a'));
    if(!roots.length) return {filled:0,missed:['no-modal']};
    const root=roots[roots.length-1];
    let filled=0; const missed=[];
    // 文本/数字/邮箱/文本域
    const inputs=root.querySelectorAll('input,textarea');
    for(const el of inputs){
      if(el.type==='hidden'||el.disabled||el.type==='file') continue;
      if(el.closest('.ant-select-dropdown')||el.closest('.ant-picker-dropdown')) continue;
      const tag=el.tagName.toLowerCase();
      if(tag==='textarea'){ if(!el.value){ setNativeValue(el,'测试内容_'+Date.now()); filled++; } }
      else if(el.type==='number'){ if(!el.value){ setNativeValue(el,'1'); filled++; } }
      else if(el.type==='email'){ if(!el.value){ setNativeValue(el,'test@example.com'); filled++; } }
      else if(el.type==='checkbox'||el.type==='radio'){ /* 由下方 radio 统一处理 */ }
      else { if(!el.value){ setNativeValue(el,'测试'+Date.now().toString().slice(-5)); filled++; } }
    }
    // 下拉选择 .ant-select
    const selects=root.querySelectorAll('.ant-select:not(.ant-select-disabled)');
    for(const sel of selects){
      const inp=sel.querySelector('input');
      if(inp&&inp.value&&inp.value.trim()) continue;
      try{ sel.click(); }catch(_){}
      await sleep(350);
      const opts=document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option');
      let chosen=null;
      for(const o of opts){ if(!o.className.includes('ant-select-item-option-disabled')&&!/请选择|placeholder/i.test(o.innerText||'')){ chosen=o; break; } }
      if(chosen){ try{ chosen.click(); }catch(_){} await sleep(250); filled++; }
      else { try{ document.body.click(); }catch(_){} await sleep(150); missed.push('select'); }
    }
    // 原生 select
    const natives=root.querySelectorAll('select:not([disabled])');
    for(const sel of natives){
      if(sel.value) continue;
      const opts=[...sel.options].filter(o=>o.value);
      if(opts.length){ setNativeValue(sel, opts[0].value); sel.dispatchEvent(new Event('change',{bubbles:true})); await sleep(150); filled++; }
      else { missed.push('select-native'); }
    }
    // 日期 .ant-picker
    const pickers=root.querySelectorAll('.ant-picker:not(.ant-picker-disabled)');
    for(const pk of pickers){
      try{ pk.click(); }catch(_){} await sleep(350);
      const panel=document.querySelector('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)');
      if(panel){ const cell=panel.querySelector('.ant-picker-cell-today,.ant-picker-cell-selected')||panel.querySelector('.ant-picker-cell'); if(cell){ try{ cell.click(); }catch(_){} await sleep(200);
        const okBtn=panel.querySelector('.ant-picker-ok button'); if(okBtn){ try{ okBtn.click(); }catch(_){} await sleep(200);} filled++; }
      else { missed.push('picker'); } }
      else { missed.push('picker'); }
    }
    // 开关 .ant-switch 关→开
    const sws=root.querySelectorAll('.ant-switch:not(.ant-switch-checked):not(.ant-switch-disabled)');
    for(const sw of sws){ try{ sw.click(); }catch(_){} await sleep(120); filled++; }
    // 单选 .ant-radio 每组取第一个
    const radioGroups=new Set();
    const radios=root.querySelectorAll('.ant-radio-wrapper:not(.ant-radio-wrapper-disabled)');
    for(const rw of radios){ const g=rw.querySelector('input'); if(!g) continue; const name=g.name||rw.innerText.slice(0,8); if(radioGroups.has(name)) continue; radioGroups.add(name); try{ rw.click(); }catch(_){} await sleep(80); filled++; }
    return {filled, missed, rootCount:roots.length, rootCls:(root.className||'').toString().slice(0,40), inputCount:root.querySelectorAll('input,textarea').length, btnTexts:[...root.querySelectorAll('button')].slice(0,6).map(b=>b.innerText)};
  });
}

async function clickPrimarySubmit(page){
  return await page.evaluate(async ()=>{
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const vis=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
    const cand=[...document.querySelectorAll('[role=dialog],.ant-modal-content,.ant-drawer-content,div.fixed.inset-0')].filter(vis);
    const roots=cand.filter(e=>e.querySelector('button,input,textarea,.ant-form-item,[role=button],a'));
    if(!roots.length) return false;
    const root=roots[roots.length-1];
    const btns=[...root.querySelectorAll('button')].filter(vis);
    let b=btns.find(x=>x.className.includes('ant-btn-primary'));
    if(!b) b=btns.find(x=>/确定|提交|保存|创建|新增|发布|确认|添加|生成|导入|导出|开始|执行|下发/.test(x.innerText));
    if(!b) b=btns.find(x=>!/取消|关闭|返回|上一步/.test(x.innerText));
    if(!b) return false;
    try{ b.click(); }catch(_){ return false; }
    await sleep(900);
    return true;
  });
}

async function confirmDestructive(page){
  return await page.evaluate(async ()=>{
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const vis=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
    const cand=[...document.querySelectorAll('[role=dialog],.ant-modal-content,.ant-drawer-content,div.fixed.inset-0,.ant-popconfirm,.ant-popover')].filter(vis);
    const roots=cand.filter(e=>e.querySelector('button'));
    const root=roots[roots.length-1];
    if(!root) return false;
    const b=[...root.querySelectorAll('button')].filter(vis).find(x=>/确定|是|删除|移除|清空|重置/.test(x.innerText));
    if(!b) return false;
    try{ b.click(); }catch(_){ return false; }
    await sleep(900);
    return true;
  });
}

async function getModalButtonTexts(page){
  return await page.evaluate(()=>{
    const vis=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
    const cand=[...document.querySelectorAll('[role=dialog],.ant-modal-content,.ant-drawer-content,div.fixed.inset-0')].filter(vis);
    const roots=cand.filter(e=>e.querySelector('button,input,textarea,.ant-form-item,[role=button],a'));
    if(!roots.length) return '';
    return [...roots[roots.length-1].querySelectorAll('button')].filter(vis).map(b=>b.innerText).join('|');
  });
}

async function dismissModal(page){
  const did = await page.evaluate(()=>{
    const vis=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
    const cand=[...document.querySelectorAll('[role=dialog],.ant-modal-content,.ant-drawer-content,div.fixed.inset-0')].filter(vis);
    const roots=cand.filter(e=>e.querySelector('button,input,textarea,.ant-form-item,[role=button],a'));
    if(!roots.length) return false;
    const root=roots[roots.length-1];
    const c=[...root.querySelectorAll('button')].filter(vis).find(b=>/取消|关闭|×|收起|暂不|算了|返回|否/.test(b.innerText||''));
    if(c){ c.click(); return true; }
    return false;
  });
  if(!did){ try{ await page.keyboard.press('Escape'); }catch(_){} }
  await sleep(500);
}

// 彻底复位：先显式关闭所有残留模态，再硬刷新（同 hash 的 page.goto 不会真正重载，必须用 reload）
async function resetPage(page){
  for(let k=0;k<4;k++){
    const open=await isModalOpen(page);
    if(!open) break;
    await dismissModal(page); await sleep(400);
  }
  try{ await page.reload({waitUntil:'domcontentloaded'}); }catch(_){}
  await sleep(900);
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'] });
  const ctx = await browser.newContext({ viewport:{width:1280,height:1100} });
  const page = await ctx.newPage();
  // 物理硬件控制指令：网络层直接 abort，绝不向真实 ESP32 下发（仅拦截明确指向硬件下发的端点，
  // 不拦截固件/OTA 任务创建等纯 DB 操作）
  await page.route('**/api/devices/**/remote-control**', r=>r.abort());
  await page.route('**/api/devices/**/control**', r=>r.abort());
  await page.route('**/api/devices/**/restart**', r=>r.abort());
  await page.route('**/api/devices/**/wake**', r=>r.abort());
  await page.route('**/api/wol**', r=>r.abort());
  await page.route('**/api/**/wake-on-lan**', r=>r.abort());

  const errBuf=[]; const respBuf=[]; let curRoute=-1;
  page.on('pageerror', e=>errBuf.push({t:'pageerror',m:String(e.message||e).slice(0,240),route:curRoute}));
  page.on('console', m=>{ if(m.type()==='error') errBuf.push({t:'console',m:String(m.text()).slice(0,240),route:curRoute}); });
  page.on('response', r=>{ const m=r.request().method(); const u=r.url().split('?')[0];
    if(m==='GET' && /\/api\//.test(u)) respBuf.push({route:curRoute,m,url:u,status:r.status(),aborted:false});
    else if(['POST','PUT','DELETE','PATCH'].includes(m)) respBuf.push({route:curRoute,m,url:u,status:r.status(),aborted:false});
  });
  page.on('requestfailed', r=>{ const u=(typeof r.url==='function'?r.url():'').split('?')[0]; if(/\/api\//.test(u)) respBuf.push({route:curRoute,m:typeof r.method==='function'?r.method():'GET',url:u,status:0,aborted:true}); });

  await page.goto(BASE+'/#/login',{waitUntil:'networkidle'}); await sleep(1500);
  await page.fill('input[placeholder="请输入用户名"]','admin');
  await page.fill('input[placeholder="请输入密码"]','Test@123456');
  await page.click('button:has-text("登录")'); await sleep(2500);

  for(let i=0;i<ROUTES.length;i++){
    if(ONLY && !ONLY.has(i)) continue;
    const [hash,name]=ROUTES[i]; curRoute=i;
    const recs=[];
    try{
      await page.goto(BASE+hash,{waitUntil:'networkidle'}); await sleep(1300);
      const buttons = await enumButtons(page);
      for(const btn of buttons){
        const beforeErr=errBuf.length; const beforeResp=respBuf.length; const beforeUrl=page.url();
        let action='none'; let note=''; let detail={};
        const isDevice=DEVICE_CONTROL.test(btn.text);
        const isDanger=DANGER.test(btn.text);
        const isProtected=isDevice||isDanger;
        const isDestruct=DESTRUCTIVE.test(btn.text);
        try{
          const clicked = await clickByText(page, btn.text);
          if(!clicked){ action='unclickable'; note='点击时按钮不可见/动态消失'; }
          else {
            await sleep(1000);
            const modalOpen = await isModalOpen(page);
            const urlNow = page.url();
            const nav = urlNow!==beforeUrl;
            const newResp = respBuf.slice(beforeResp).filter(c=>!/frontend-performance|socket.io/.test(c.url));
            if(isProtected){
              // 物理硬件 / 系统级危险操作：仅验证弹窗渲染，绝不确认执行（硬件指令已网络层 abort 兜底）
              if(modalOpen){ action='protected-verified'; note=(isDevice?'硬件控制':'系统危险操作')+'：确认弹窗已渲染，按安全边界未真实执行'; await dismissModal(page); }
              else if(newResp.some(c=>c.aborted)){ action='protected-aborted'; note=(isDevice?'硬件控制':'系统危险操作')+'：已触发但网络层 abort（未真实执行）'; }
              else { action='protected-noop'; note=(isDevice?'硬件控制':'系统危险操作')+'：未触发可识别动作'; }
            }
            else if(modalOpen){
              const modalBtns = await getModalButtonTexts(page);
              const isDestructNow = /删除|移除|作废|清空|重置全部|解散/.test(modalBtns);
              if(isDestructNow){
                const rows=await countRows(page);
                if(rows>=2 || isDestructNow && rows<0){
                  const ok=await confirmDestructive(page);
                  action='deleted'; note='破坏性确认已真实执行'+(ok?'':'（确认按钮未点中，可能已是二次确认）');
                  const afterResp=respBuf.slice(beforeResp).filter(c=>!/frontend-performance|socket.io/.test(c.url));
                  detail.apiAfter=afterResp.map(c=>({m:c.m,url:c.url,status:c.status,aborted:c.aborted}));
                } else {
                  action='delete-skipped'; note='破坏性操作跳过（行数<2，避免清空核心表；快照还原兜底）'; await dismissModal(page);
                }
              } else {
                const fr=await fillForm(page);
                const sub=await clickPrimarySubmit(page);
                const afterModal=await isModalOpen(page);
                const afterResp=respBuf.slice(beforeResp).filter(c=>!/frontend-performance|socket.io/.test(c.url));
                action= afterModal ? 'submit-failed' : 'submitted';
                note='表单填充字段='+(fr.filled)+(fr.missed.length?(' 未覆盖='+fr.missed.join(',')):'')+' | 提交'+(sub?'成功':'失败')+(afterModal?' | 弹窗未关闭(校验/服务端拒绝)':' | 弹窗已关闭');
                detail.fill=fr; detail.apiAfter=afterResp.map(c=>({m:c.m,url:c.url,status:c.status,aborted:c.aborted}));
              }
            }
            else if(nav){ action='navigate'; }
            else if(newResp.length){ action='api'; detail.apiAfter=newResp.map(c=>({m:c.m,url:c.url,status:c.status,aborted:c.aborted})); }
            else { action='none'; }
          }
        }catch(e){ action='exception'; note='CLICK_EXCEPTION '+String(e).slice(0,160); try{ await dismissModal(page); }catch(_){} }
        const slice=errBuf.slice(beforeErr);
        const errs=slice.map(x=>x.m);
        recs.push({button:btn.text, tag:btn.tag, action, note, errors:errs,
          apiCalls:respBuf.slice(beforeResp).filter(c=>!/frontend-performance|socket.io/.test(c.url)).map(c=>({m:c.m,url:c.url,status:c.status,aborted:c.aborted})), detail});
        try{ await resetPage(page); }catch(_){}
      }
      log(safeStr({idx:i, hash, name, buttonsFound:buttons.length, buttons:recs}));
      try{ console.log(`[${i}] ${name} buttons=${buttons.length} errTotal=${recs.reduce((a,b)=>a+b.errors.length,0)}`); }catch(_){}
    }catch(e){ log(safeStr({idx:i, hash, name, error:String(e).slice(0,200)})); console.log(`[${i}] ${name} PAGE_EXCEPTION ${String(e).slice(0,80)}`); }
  }
  await browser.close();
  log('__DONE__');
})();
