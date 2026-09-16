const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = 'C:/Users/53527/Desktop/自我管理提升/自我管理提升V2.0/平台开发/管理平台设计/.workbuddy/browser_test';
const SHOTS = path.join(OUT, 'shots');
const RESULT = path.join(OUT, '15_perpage.jsonl');
const BASE = 'http://127.0.0.1:3000';
fs.mkdirSync(SHOTS, { recursive: true });
fs.writeFileSync(RESULT, '');

// 仅跑指定页（逗号分隔索引），不设置则全跑
const FILTER = (process.env.PAGES || '').split(',').map(s=>s.trim()).filter(Boolean).map(Number);
const ONLY = FILTER.length ? new Set(FILTER) : null;

const ROUTES = [
  ['#/dashboard','数据概览',false],['#/users','学生管理',true],['#/analysis','数据分析',false],['#/class-compare','班级对比',false],
  ['#/rules','积分规则',true],['#/rank-rules','排名规则',true],['#/categories','分类管理',true],['#/nlp-management','智能评分',true],
  ['#/class-management','班级管理',true],['#/subject-management','科目管理',true],['#/course-schedule','课程表管理',true],['#/class-time-settings','时间规则设置',true],
  ['#/class-period-settings','课程节次管理',true],['#/workbench','工作台总览',false],['#/seating-chart','座次表',true],['#/duty-roster','值日生表',true],
  ['#/committee','班委名单',true],['#/parent-contact','家长联系',true],['#/homework-check','作业检查',true],['#/attendance','考勤管理',true],
  ['#/study-groups','学习小组',true],['#/mental-health','心理健康',true],['#/activity','文体活动',true],['#/culture','班级文化',true],
  ['#/study-guide','学法指导',true],['#/teacher-comments','评语管理',true],['#/phonebox-policy','手机箱开箱策略',true],['#/exams','考试管理',true],
  ['#/score-entry','成绩录入',true],['#/score-records','成绩档案',false],['#/score-analysis','成绩分析',false],['#/algorithm-analysis','算法分析',false],
  ['#/devices','设备管理',true],['#/device-groups','设备分组',true],['#/firmware','固件管理',true],['#/notifications','通知管理',true],
  ['#/approvals','审批管理',true],['#/remote-notify','远程通知',true],['#/wake-on-lan','远程开机',false],['#/settings','系统设置',false],
  ['#/permission','权限管理',true],['#/data-sync','数据同步',true],['#/ops-center','运维总览',false],['#/ops-center/telemetry','前端遥测',false],
  ['#/ops-center/metrics','系统指标趋势',false],['#/diagnostics','系统诊断',false],['#/security-audit','安全审计',false],['#/operation-logs','操作日志',false],
  ['#/help','帮助中心',false],
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function log(s){ fs.appendFileSync(RESULT, s + '\n'); }
const vis = (e)=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
async function clickById(page, id){
  const h = await page.$(`#${id}`);
  if(!h) return false;
  try{ await h.scrollIntoViewIfNeeded(); }catch{}
  try{ await h.click({timeout:4000}); return true; }
  catch(e){ try{ await h.click({timeout:2000, force:true}); return true; }catch{ return false; } }
}

async function pickAddBtn(page){
  return await page.evaluate(() => {
    const reAdd=/添加|新建|新增|创建|录入|登记|上报|布置|发布|开通|上传|发送|导入|配置|发起|生成|绑定|打卡|添加规则|新增规则|新建规则/;
    const inNav=(el)=>!!el.closest('nav,aside,.sidebar,.ant-menu,[class*=sidebar],[class*=menu],header,.header,[class*=header],a[href]');
    const els=Array.from(document.querySelectorAll('button,[role=button],a:not([href])'));
    const cand=els.filter(e=>{ const t=(e.innerText||e.getAttribute('title')||'').trim(); return reAdd.test(t) && !inNav(e); });
    if(!cand.length) return {found:false};
    const score=t=>{ if(/添加|新建|新增|创建|发送/.test(t)) return 3; if(/录入|登记|上报|布置|发布|开通|上传|导入/.test(t)) return 2; return 1; };
    const mx=Math.max(...cand.map(e=>score(e.textContent||'')));
    const top=cand.filter(e=>score(e.textContent||'')===mx);
    const create=top.find(e=>/添加|新建|新增|创建|发送/.test(e.textContent||''));
    const chosen=create||top[0];
    chosen.id='__auto_add_btn';
    return {found:true, text:(chosen.innerText||chosen.getAttribute('title')||'').trim().slice(0,20)};
  });
}

async function findModalContainer(page){
  return await page.evaluate(() => {
    const vis=(e)=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
    for (const f of Array.from(document.querySelectorAll('form'))) if (vis(f)) return {found:true, fields:f.querySelectorAll('input,textarea,select,.ant-select,.ant-picker').length};
    const sels=['[role=dialog]','.ant-modal-content','.ant-drawer-content','div.fixed.inset-0','div[class*=overlay]','div[class*=modal]'];
    let best=null;
    for (const s of sels) for (const e of Array.from(document.querySelectorAll(s))){
      if (vis(e) && e.querySelector('input,textarea,select,.ant-select,.ant-picker')){
        const fields=e.querySelectorAll('input,textarea,select,.ant-select,.ant-picker').length;
        if(!best||fields>best.fields) best={found:true, fields, cls:(e.className||'').toString().slice(0,40)};
      }
    }
    return best||{found:false};
  });
}

// 单下拉填充：跳过禁用/已选/占位符，点第一个真实选项（支持可搜索下拉与级联）
async function fillOneSelect(scope, sel){
  const disabled = await sel.evaluate(el=>el.classList.contains('ant-select-disabled')||el.getAttribute('aria-disabled')==='true').catch(()=>true);
  if(disabled) return false;
  const hasVal = await sel.evaluate(el=>!!el.querySelector('.ant-select-selection-item')).catch(()=>false);
  if(hasVal) return false;
  try{ await sel.click({timeout:2500}); }catch{ return false; }
  await sleep(800);
  let dd = await scope.$('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
  if(!dd){ const dds = await scope.$$('.ant-select-dropdown'); dd = dds[dds.length-1]; }
  if(!dd) return false;
  let opts = await dd.$$('.ant-select-item-option');
  let target=null;
  for(const o of opts){
    const t = await o.evaluate(el=>el.innerText.trim()).catch(()=>'');
    if(!t) continue;
    if(/请选择|全部|选择|不限|select/i.test(t)) continue;
    target=o; break;
  }
  if(!target && opts.length) target=opts[0];
  if(target){ try{ await target.click({timeout:2500}); await sleep(500); return true; }catch{ return false; } }
  return false;
}

// 改进 smartFill：级联感知 + 保留默认值 + 数字按 min/max 语义
async function fillAntSelects(page){
  let total=0;
  for(let pass=0; pass<4; pass++){
    const done = await page.evaluate(async ()=>{
      const sleep=ms=>new Promise(r=>setTimeout(r,ms));
      const ph=/请选择|全部|选择|不限|select/i;
      const root=document.querySelector('[role=dialog],.ant-modal-content,.ant-drawer-content')||document;
      const sels=Array.from(root.querySelectorAll('.ant-select'));
      let cnt=0;
      for(const sel of sels){
        const item=sel.querySelector('.ant-select-selection-item');
        if(item && (item.textContent||'').trim()!=='' && !ph.test(item.textContent||'')) continue;
        const trigger=sel.querySelector('.ant-select-selector')||sel;
        try{ trigger.scrollIntoView({block:'center'}); }catch{}
        trigger.click();
        await sleep(350);
        const opts=Array.from(document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option'));
        const opt=opts.find(o=>{ if(o.classList.contains('ant-select-item-option-disabled')) return false; const t=o.textContent||''; return t.trim()!=='' && !ph.test(t); });
        if(opt){ opt.click(); cnt++; await sleep(300); }
        else { try{ trigger.click(); }catch{} await sleep(150); }
      }
      return cnt;
    });
    total+=done;
    const sl=ms=>new Promise(r=>setTimeout(r,ms));
    await sl(350);
  }
  return total;
}

async function smartFill(scope, marker){
  let filled=0;
  // 1) 文本/数字/日期等原生输入
  const inputs = await scope.$$('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=file]):not([type=checkbox]):not([type=radio])');
  for(const inp of inputs){
    const tp=(await inp.getAttribute('type')||'text').toLowerCase();
    const name=((await inp.getAttribute('name'))||'').toLowerCase();
    const ph=((await inp.getAttribute('placeholder'))||'').toLowerCase();
    const tag=(await inp.getAttribute('data-testid'))||'';
    const ctx=(name+' '+ph+' '+tag).toLowerCase();
    let cur=''; try{ cur=await inp.inputValue(); }catch{}
    try{
      if(tp==='color'){ await inp.evaluate(el=>{el.value='#3498db';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}); filled++; }
      else if(tp==='number'||tp==='hidden'){
        if(cur===''||cur===undefined){ let v='1'; if(/max|end|limit|上限|到|止|高|大|后|结束/.test(ctx)) v='100'; else if(/min|start|begin|下限|从|低|小|前|开始/.test(ctx)) v='1'; await inp.fill(v); filled++; }
      }
      else if(tp==='email'){ if(!cur){ await inp.fill('test@example.com'); filled++; } }
      else if(tp==='tel'||tp==='phone'){ if(!cur){ await inp.fill('13800000000'); filled++; } }
      else if(tp==='password'){ if(!cur){ await inp.fill('Test@13579'); filled++; } }
      else if(tp==='datetime-local'){ if(!cur){ await inp.fill('2026-09-15T09:00'); filled++; } }
      else if(tp==='date'){ if(!cur){ await inp.fill('2026-09-15'); filled++; } }
      else if(tp==='url'){ if(!cur){ await inp.fill('https://example.com'); filled++; } }
      else {
        if(!cur){
          // 学号/卡号/编号等必须是数字且常需唯一：用毫秒时间戳保证 12 位数字 + 跨运行唯一
          if(/学号|卡号|学工|工号|编号|身份证|card_?id|student_?id|学工号|考生号|准考证/.test(ctx)){
            await inp.fill(String(Date.now()).slice(-12)); filled++;
          } else if(/电话|手机|手机号|联系电话|phone|tel/.test(ctx)){
            await inp.fill('13800000000'); filled++;
          } else { await inp.fill(marker); filled++; }
        }
      }
    }catch{}
  }
  for(const t of await scope.$$('textarea')){ try{ const cur=await t.inputValue().catch(()=>''); if(!cur){ await t.fill(marker); filled++; } }catch{} }
  // 1.5) 揭示依赖字段：点击「添加科目/添加成员/添加行」等按钮一次（如考试需先点+添加科目）
  for(const b of await scope.$$('button')){
    try{
      const t = await b.evaluate(el=>el.innerText.trim()).catch(()=>'');
      if(/添加科目|添加成员|添加学生|添加行|新增一行|添加一项|添加条目/.test(t)){ await b.click({timeout:1500}); await sleep(600); }
    }catch{}
  }
  // 2) 原生 <select> 级联填充（多轮，等异步加载依赖选项）
  for(let pass=0; pass<4; pass++){
    const sels = await scope.$$('select');
    let changed=false;
    for(const sel of sels){
      try{
        const curIdx = await sel.evaluate(el=>el.selectedIndex).catch(()=>-1);
        const curTxt = await sel.evaluate(el=>{ const o=el.options[el.selectedIndex]; return o?o.text.trim():''; }).catch(()=>'');
        const isPlaceholder = /选择|请选择|不限|全部|select/i.test(curTxt);
        if(!isPlaceholder) continue; // 已有真实值，跳过
        const opts = await sel.$$('option');
        let idx=-1;
        for(let k=0;k<opts.length;k++){
          const t = await opts[k].evaluate(o=>o.text.trim()).catch(()=>'');
          if(/选择|请选择|不限|全部|select/i.test(t)) continue;
          idx=k; break;
        }
        if(idx<0 && opts.length) idx=0;
        if(idx>=0){ await sel.selectOption({index: idx}); await sleep(250); changed=true; }
      }catch{}
    }
    if(!changed) break;
    await sleep(600);
  }
  // 2.5) antd 下拉：多轮级联
  for(let pass=0; pass<4; pass++){
    const sels = await scope.$$('.ant-select');
    let changed=false;
    for(const sel of sels){ if(await fillOneSelect(scope,sel)) changed=true; }
    if(!changed) break;
    await sleep(500);
  }
  // 3) antd 日期选择器：点选单元格（避开今天/占位）
  const pks=await scope.$$('.ant-picker');
  for(let pi=0; pi<pks.length; pi++){
    try{
      const pk=pks[pi];
      const inp=await pk.$('input');
      if(!inp){ continue; }
      const cur=await inp.inputValue().catch(()=>'');
      if(cur) continue;
      await inp.click({timeout:1500}); await sleep(400);
      // 打开的面板
      const panel = await scope.$('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)');
      if(!panel){ continue; }
      // 优先点「今天之后/之前的可用单元格」：取所有 td.ant-picker-cell（跳过 disabled 与 今天）
      const cells = await panel.$$('td.ant-picker-cell:not(.ant-picker-cell-disabled)');
      let target=null;
      for(const c of cells){ const t=await c.evaluate(el=>el.getAttribute('title')||'').catch(()=>''); if(t && !c.className.includes('ant-picker-cell-today')){ target=c; break; } }
      if(!target && cells.length) target=cells[Math.min(cells.length-1, 5)];
      if(target){ await target.click({timeout:1500}); await sleep(300); }
      // RangePicker 有第二个输入框
      await sleep(200);
    }catch{}
  }
  // 4) 开关：开启第一个关闭的
  for(const sw of await scope.$$('.ant-switch')){ try{ const on=await sw.evaluate(el=>el.classList.contains('ant-switch-checked')).catch(()=>false); if(!on){ await sw.click({timeout:1200}); filled++; } }catch{} }
  // 5) 单选组：点第一个
  for(const grp of await scope.$$('.ant-radio-group')){ try{ const first=await grp.$('.ant-radio-wrapper'); if(first) await first.click({timeout:1200}); }catch{} }
  // 6) Ant Design Select：点击打开后选第一个真实选项（原生 <select> 已在上文处理）
  try{ filled += await fillAntSelects(scope); }catch{}
  return filled;
}

// 考试页专用填充：考试名称 + 勾选首个科目 checkbox + 起止时间（不点"添加科目"，避免误建科目）
async function fillExam(scope, marker){
  let filled=0;
  const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
  // 考试名称
  const nameInput=await scope.$('input[placeholder="请输入考试名称"]');
  if(nameInput){ try{ const cur=await nameInput.inputValue().catch(()=>''); if(!cur){ await nameInput.fill(marker+'考试'); filled++; } }catch{} }
  // 考试说明（可选）
  const desc=await scope.$('textarea[placeholder="请输入考试说明"]');
  if(desc){ try{ const cur=await desc.inputValue().catch(()=>''); if(!cur){ await desc.fill(marker); filled++; } }catch{} }
  // 勾选第一个科目 checkbox（subjects 为数组，校验要求至少 1 个）
  let cb=await scope.$('input[type=checkbox]');
  if(!cb){
    // 无科目时通过"+添加科目"临时建一个，再勾选
    const opened=await scope.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(e=>(e.innerText||'').includes('添加科目')); if(b){ b.click(); return true; } return false; });
    await sleep(1200);
    if(opened){
      const sname=await scope.$('input[placeholder="请输入科目名称"]');
      if(sname){ try{ await sname.fill(marker+'科目'); filled++; }catch{} }
      await scope.evaluate(()=>{ const mods=[...document.querySelectorAll('[role=dialog]')]; const m=mods[mods.length-1]; const b=[...m.querySelectorAll('button')].find(e=>(e.innerText||e.textContent||'').trim()==='保存'); if(b) b.click(); });
      await sleep(1500);
      cb=await scope.$('input[type=checkbox]');
    }
  }
  if(cb){ try{ const on=await cb.isChecked().catch(()=>false); if(!on){ await cb.check({timeout:2000}); filled++; } }catch{} }
  // 开始/结束时间（datetime-local）
  const times=await scope.$$('input[type=datetime-local]');
  if(times[0]){ try{ const cur=await times[0].inputValue().catch(()=>''); if(!cur){ await times[0].fill('2026-09-15T09:00'); filled++; } }catch{} }
  if(times[1]){ try{ const cur=await times[1].inputValue().catch(()=>''); if(!cur){ await times[1].fill('2026-09-15T10:30'); filled++; } }catch{} }
  // 班级 select（可选，选第一个真实项）
  const sel=await scope.$('select');
  if(sel){ try{ const opts=await sel.$$('option'); let idx=-1; for(let k=0;k<opts.length;k++){ const t=await opts[k].evaluate(o=>o.text.trim()).catch(()=>''); if(/全部|选择|请选择|不限/i.test(t)) continue; idx=k; break; } if(idx<0&&opts.length) idx=0; if(idx>=0){ await sel.selectOption({index:idx}); filled++; } }catch{} }
  return filled;
}

// 课程表专用：循环尝试 (班级 × 星期 × 节次) 组合，避开"该班级此时段已有课程"冲突，确保真实落库
async function fillCourseSchedule(page, marker, sleep, captureResult){
  try{
    const modal = await page.$('div.fixed.inset-0');
    if(!modal) return {filled:0,result:null,note:'[课程表:未定位弹窗]'};
    const form = await modal.$('form');
    if(!form) return {filled:0,result:null,note:'[课程表:未定位表单]'};
    const sels = await form.$$('select');
    if(sels.length<4) return {filled:0,result:null,note:`[课程表:select数=${sels.length}]`};
    const [classSel,subjectSel,daySel,periodSel]=sels; // [0]班级 [1]科目 [2]星期 [3]节次
    const classOpts = await classSel.$$('option');
    const dayOpts = await daySel.$$('option');
    const periodOpts = await periodSel.$$('option');
    const classReal = Math.max(1, classOpts.length-1); // 去掉"选择班级"占位
    const dayN = dayOpts.length, periodN = periodOpts.length;
    const roomInput = await form.$('input[placeholder="输入教室"]');
    const maxTry = Math.min(classReal*dayN*periodN, 30);
    let attempts=0, done=false, res=null, lastNote='';
    for(let a=0; a<maxTry && !done; a++){
      attempts++;
      const cIdx=1+(a%classReal), dIdx=a%dayN, pIdx=Math.floor(a/dayN)%periodN;
      try{
        await classSel.selectOption({index:cIdx});
        await subjectSel.selectOption({index:1});
        await daySel.selectOption({index:dIdx});
        await periodSel.selectOption({index:pIdx});
        if(roomInput) await roomInput.fill(marker+'_'+a);
      }catch(e){ lastNote='[选择失败'+String(e).slice(0,30)+']'; }
      try{
        const sb=await form.$('button[type=submit]');
        if(sb) await sb.click({timeout:3000});
        else await page.click('div.fixed.inset-0 button:has-text("保存")',{timeout:3000});
      }catch(e){ lastNote='[提交点击失败]'; }
      await sleep(2200);
      res=await captureResult(page);
      if(res && (res.success || res.toasts.some(t=>/成功|已|创建|添加|保存|ok/i.test(t))) && !res.crash){ done=true; }
      else if(res && !res.modalOpen){ done=true; } // 弹窗关闭但无成功提示，避免死等
    }
    return {filled:5, result:res, note:`[课程表尝试=${attempts}/${maxTry}]`+(done?'[成功]':'[仍冲突]')+lastNote};
  }catch(e){ return {filled:0,result:null,note:'[课程表异常'+String(e).slice(0,60)+']'}; }
}

// 提交按钮：限定在弹窗 form 内，排除取消/重置/关闭
async function pickSubmit(page){
  return await page.evaluate(() => {
    const vis=(e)=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
    // 候选容器：所有可见 form + 弹窗/抽屉/遮罩层（提交按钮常位于 form 之外）
    const containers=[];
    for(const f of Array.from(document.querySelectorAll('form'))) if(vis(f)) containers.push(f);
    const ov=document.querySelector('[role=dialog],.ant-modal-content,.ant-drawer-content,div.fixed.inset-0');
    if(ov) containers.push(ov);
    if(!containers.length) containers.push(document);
    const seen=new Set(); const els=[];
    for(const c of containers){ for(const b of c.querySelectorAll('button,[role=button]')){ if(!seen.has(b)){seen.add(b);els.push(b);} } }
    const re=/保存|提交|确定|发布|创建|确认|添加|录入|上报|开通|下一步|完成|上传|发送/;
    const bad=/取消|关闭|重置|清空|返回|删除/;
    const hit=els.filter(e=>{const t=(e.innerText||e.getAttribute('title')||'').trim(); return re.test(t)&&!bad.test(t)&&!e.closest('nav,aside,.ant-menu,header');});
    if(!hit.length) return {found:false};
    const b=hit[hit.length-1]; b.id='__auto_submit_btn';
    return {found:true, text:(b.innerText||b.getAttribute('title')||'').trim().slice(0,20)};
  });
}

async function captureResult(page){
  await sleep(2200);
  return await page.evaluate(() => {
    const vis=(e)=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
    const toasts=Array.from(document.querySelectorAll('.ant-message-notice,.ant-notification-notice')).map(e=>(e.innerText||e.textContent||'').trim()).filter(Boolean);
    const inlineErr=[];
    for(const e of Array.from(document.querySelectorAll('.ant-form-item-explain-error, .ant-form-item-explain, .text-danger-600, [role=alert], .form-error, .error-text, .text-red-500, .ant-form-item-explain-error div'))){
      const t=(e.innerText||e.textContent||'').trim(); if(t) inlineErr.push(t);
    }
    let modalOpen=false;
    for(const s of ['[role=dialog]','.ant-modal-content','.ant-drawer-content','div.fixed.inset-0']) for(const e of Array.from(document.querySelectorAll(s))) if(vis(e)&&e.querySelector('input,textarea,select,.ant-select,.ant-picker')) modalOpen=true;
    const body=document.body.innerText;
    return { toasts:toasts.slice(0,5), inlineErr:inlineErr.slice(0,8), modalOpen, crash:body.includes('页面加载失败'), success:toasts.some(t=>/成功|已|创建|添加|保存|提交|ok|done/i.test(t)) };
  });
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'] });
  const ctx = await browser.newContext({ viewport:{width:1280,height:1100} });
  const page = await ctx.newPage();
  const errBuf=[];
  const respBuf=[];
  let curRoute=-1;
  page.on('pageerror', e=>errBuf.push({t:'pageerror',m:String(e.message||e).slice(0,200)}));
  page.on('console', m=>{ if(m.type()==='error') errBuf.push({t:'console',m:String(m.text()).slice(0,200)}); });
  page.on('response', r=>{ const m=r.request().method(); if(['POST','PUT','DELETE','PATCH'].includes(m)) respBuf.push({route:curRoute, m, url:r.url().split('?')[0], status:r.status()}); });

  await page.goto(BASE+'/#/login',{waitUntil:'networkidle'}); await sleep(1500);
  await page.fill('input[placeholder="请输入用户名"]','admin');
  await page.fill('input[placeholder="请输入密码"]','Test@123456');
  await page.click('button:has-text("登录")'); await sleep(2500);

  const RUN_TAG = Math.random().toString(36).slice(2,8);
  for(let i=0;i<ROUTES.length;i++){
    if(ONLY && !ONLY.has(i)) continue;
    const [hash,name,hasAdd]=ROUTES[i];
    curRoute=i;
    const marker=`PBT${String(i).padStart(2,'0')}_${RUN_TAG}`;
    const slug=hash.replace('#/','').replace(/\//g,'_');
    const before=errBuf.length;
    const beforeResp=respBuf.length;
    const rec={idx:i,hash,name,hasAdd,pageErrors:[],consoleErrors:[],h1:'',addBtnFound:false,addBtnText:'',modalOpened:false,fields:0,submitClicked:false,submitText:'',result:null,apiCalls:[],db:null,note:''};
    try{
      await page.goto(BASE+hash,{waitUntil:'networkidle'}); await sleep(1300);
      await page.screenshot({path:path.join(SHOTS,`${String(i).padStart(2,'0')}_${slug}.jpeg`),type:'jpeg',quality:55});
      rec.h1=await page.evaluate(()=>{const h=document.querySelector('h1,h2,.page-title');return ((h?(h.innerText||''):'')||'').trim().slice(0,40)||document.title.slice(0,40);});
      if(hasAdd){
        const pick=await pickAddBtn(page);
        rec.addBtnFound=pick.found; rec.addBtnText=pick.text||'';
        if(pick.found){
          try{ await clickById(page,'__auto_add_btn'); }catch{}
          await sleep(2200);
          const m=await findModalContainer(page);
          if(m.found){
            rec.modalOpened=true; rec.fields=m.fields;
            const scope=page;
            let fileInput=null;
            try{ const fi=await scope.$$('input[type=file]'); if(fi.length) fileInput=fi[0]; }catch{}
            if(fileInput){
              try{
                const dummy='C:/Users/53527/Desktop/自我管理提升/自我管理提升V2.0/平台开发/管理平台设计/.workbuddy/browser_test/dummy_fw.bin';
                fs.writeFileSync(dummy, Buffer.from('dummy firmware v1.0.0'));
                await fileInput.setInputFiles(dummy);
                rec.note=(rec.note||'')+'[文件已选]';
              }catch(e){ rec.note=(rec.note||'')+'[文件选择失败:'+String(e).slice(0,60)+']'; }
            }
            if(name==='课程表管理'){
              const r=await fillCourseSchedule(page,marker,sleep,captureResult);
              rec.note=(rec.note||'')+r.note;
              rec.result=r.result;
              rec.submitClicked=true; rec.submitText='保存(循环避冲突)';
            } else {
              const filled=(name==='考试管理')?await fillExam(scope,marker):await smartFill(scope,marker);
              rec.note=(rec.note||'')+`[filled=${filled}]`;
              const sb=await pickSubmit(page);
              if(sb.found){
                rec.submitClicked=true; rec.submitText=sb.text;
                const ok=await clickById(page,'__auto_submit_btn');
                rec.note=(rec.note||'')+(ok?'[submit-clicked]':'[submit-click-FAILED]');
                rec.result=await captureResult(page);
              } else { rec.note=(rec.note||'')+'[表单已开但未定位到提交按钮]'; }
            }
            try{ await page.screenshot({path:path.join(SHOTS,`${String(i).padStart(2,'0')}_${slug}_form.jpeg`),type:'jpeg',quality:55}); }catch{}
          } else { rec.note=(rec.note||'')+'[点击新增后未出现可见表单]'; }
        } else { rec.note=(rec.note||'')+'[未识别到新增按钮]'; }
      } else { rec.note='只读/展示页'; }
    }catch(e){ rec.note='EXCEPTION: '+String(e).slice(0,160); }
    rec.apiCalls=respBuf.slice(beforeResp).map(x=>({m:x.m,url:x.url,status:x.status}));
    const slice=errBuf.slice(before);
    rec.pageErrors=slice.filter(x=>x.t==='pageerror').map(x=>x.m);
    rec.consoleErrors=slice.filter(x=>x.t==='console').map(x=>x.m);
    log(JSON.stringify(rec));
    console.log(`[${i}] ${name} add=${rec.addBtnFound}(${rec.addBtnText}) modal=${rec.modalOpened} f=${rec.fields} submit=${rec.submitClicked} err=${rec.pageErrors.length+rec.consoleErrors.length}`);
  }
  await browser.close();
  log('__DONE__');
})().catch(e=>{ fs.appendFileSync(RESULT,'FATAL '+String(e)+'\n'); });
