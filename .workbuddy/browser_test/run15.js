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
function safeStr(o){ const seen=new WeakSet(); return JSON.stringify(o, (k,v)=>{ if(typeof v==='object'&&v!==null){ if(seen.has(v)) return '[circular]'; seen.add(v); } if(typeof v==='function') return '[fn]'; return v; }); }
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
    const reAdd=/添加|新建|新增|创建|录入|登记|上报|布置|发布|开通|上传|发送|导入|配置|发起|生成|绑定|打卡|快速记录|添加规则|新增规则|新建规则/;
    const inNav=(el)=>!!el.closest('nav,aside,.sidebar,.ant-menu,[class*=sidebar],[class*=menu],header,.header,[class*=header],a[href]');
    const els=Array.from(document.querySelectorAll('button,[role=button],a:not([href])'));
    const cand=els.filter(e=>{ const t=(e.innerText||e.getAttribute('title')||'').trim(); return reAdd.test(t) && !inNav(e); });
    if(!cand.length) return {found:false};
    const score=t=>{ if(/添加|新建|新增|创建|发送|快速记录/.test(t)) return 3; if(/录入|登记|上报|布置|发布|开通|上传|导入/.test(t)) return 2; return 1; };
    const mx=Math.max(...cand.map(e=>score(e.textContent||'')));
    const top=cand.filter(e=>score(e.textContent||'')===mx);
    const create=top.find(e=>/添加|新建|新增|创建|发送|快速记录/.test(e.textContent||''));
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

// 课程表专用：先轮询等 班级/科目/星期/节次 选项从 API 加载完，再循环尝试组合避开"该班级此时段已有课程"冲突，确保真实落库
async function fillCourseSchedule(page, marker, sleep, captureResult){
  try{
    const realOpt=(opts)=>opts.filter(o=>!/请选择|选择|全部|不限/i.test(o.textContent||'')).length;
    // 1) 等待弹窗与下拉就绪（星期/节次 来自 weekDays/activePeriods，可能比弹窗晚到）
    let modal=null, form=null, sels=[];
    for(let w=0; w<25 && (!modal || sels.length<4); w++){
      modal = await page.$('div.fixed.inset-0');
      if(modal){ form = await modal.$('form'); if(form) sels = await form.$$('select'); }
      if(sels.length>=4) break;
      await sleep(700);
    }
    if(!modal) return {filled:0,result:null,note:'[课程表:未定位弹窗]'};
    if(!form) return {filled:0,result:null,note:'[课程表:未定位表单]'};
    if(sels.length<4) return {filled:0,result:null,note:`[课程表:select数=${sels.length}]`};
    const [classSel,subjectSel,daySel,periodSel]=sels; // [0]班级 [1]科目 [2]星期 [3]节次 [4]教师
    let loaded=false;
    for(let w=0; w<30 && !loaded; w++){
      const cls=await classSel.$$('option'), sub=await subjectSel.$$('option'), day=await daySel.$$('option'), per=await periodSel.$$('option');
      if(realOpt(cls)>=1 && realOpt(sub)>=1 && day.length>=1 && per.length>=1) loaded=true;
      else await sleep(700);
    }
    if(!loaded) return {filled:0,result:null,note:'[课程表:下拉选项迟迟未加载(可能缺班级/科目/星期/节次数据)]'};
    const classOpts = await classSel.$$('option');
    const dayOpts = await daySel.$$('option');
    const periodOpts = await periodSel.$$('option');
    const classReal = Math.max(1, classOpts.length-1);
    const subjectReal = Math.max(1, (await subjectSel.$$('option')).length-1);
    const dayN = dayOpts.length, periodN = periodOpts.length;
    const roomInput = await form.$('input[placeholder="输入教室"]');
    const maxTry = Math.min(classReal*subjectReal*dayN*periodN, 40);
    let attempts=0, done=false, res=null, lastNote='';
    for(let a=0; a<maxTry && !done; a++){
      attempts++;
      const cIdx=1+(a%classReal);
      const sIdx=1+Math.floor(a/classReal)%subjectReal;
      const dIdx=a%dayN, pIdx=Math.floor(a/dayN)%periodN;
      try{
        await classSel.selectOption({index:cIdx});
        await subjectSel.selectOption({index:sIdx});
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

// ===== 缺口页专属驱动（A 计划）=====
// idx 7 智能评分：切到"规则管理"Tab → 添加规则 → 填行为关键词 → 创建规则
async function fillNLP(page, marker, sleep){
  const tab=await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(e=>(e.innerText||'').trim()==='规则管理'); if(b){ b.click(); return true;} return false; });
  await sleep(1000);
  if(!tab) return {ok:false, note:'[NLP:未找到规则管理Tab]'};
  const add=await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(e=>(e.innerText||'').includes('添加规则')); if(b){ b.click(); return true;} return false; });
  await sleep(1000);
  if(!add) return {ok:false, note:'[NLP:未找到添加规则按钮]'};
  const res=await page.evaluate((mk)=>{
    const modal=document.querySelector('div.fixed.inset-0'); if(!modal) return {kw:false,desc:false};
    const text=modal.querySelectorAll('input[type=text]');
    const ta=modal.querySelector('textarea');
    if(text[0]){ const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; try{ s.call(text[0],mk); }catch(e){} text[0].dispatchEvent(new Event('input',{bubbles:true})); text[0].dispatchEvent(new Event('change',{bubbles:true})); }
    if(ta){ const s=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set; try{ s.call(ta,mk); }catch(e){} ta.dispatchEvent(new Event('input',{bubbles:true})); ta.dispatchEvent(new Event('change',{bubbles:true})); }
    return {kw:!!text[0], desc:!!ta};
  }, marker);
  await sleep(600);
  const sb=await page.evaluate(()=>{ const b=[...document.querySelectorAll('div.fixed.inset-0 button')].find(e=>(e.innerText||'').includes('创建规则')); if(b){ b.click(); return true;} return false; });
  await sleep(1500);
  return {ok:sb, note:(sb?'[NLP:已创建规则]':'[NLP:未找到创建规则按钮]')+'[kw='+res.kw+',desc='+res.desc+']'};
}

// idx 19 考勤管理：点"快速记录" → 班级自动首选项 + 选学生 + 出勤 + 保存记录
async function fillAttendance(page, marker, sleep){
  let add=false;
  for(let t=0;t<10 && !add;t++){ add=await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(e=>(e.innerText||'').includes('快速记录')); if(b){ b.click(); return true;} return false; }); if(!add) await sleep(1000); }
  if(!add) return {ok:false, note:'[考勤:未找到快速记录]'};
  const modal=await page.$('div.fixed.inset-0'); if(!modal) return {ok:false, note:'[考勤:未找到弹窗]'};
  // 选日期
  const dateInp=await modal.$('input[type=date]'); if(dateInp){ const cur=await dateInp.inputValue().catch(()=>''); if(!cur){ try{ await dateInp.fill('2026-09-15'); }catch(e){} } }
  await sleep(400);
  // select 顺序：0=班级 1=学生 2=时段；轮询班级直到该班有学生
  const sels=await modal.$$('select');
  if(sels.length<3) return {ok:false, note:'[考勤:下拉框数量不足='+sels.length+']'};
  let stChosen=false;
  for(let ci=0; ci<8 && !stChosen; ci++){
    try{ await sels[0].selectOption({index:ci}); }catch(e){}
    await sleep(900);
    const stOpts=await sels[1].$$('option');
    for(let k=1;k<stOpts.length;k++){
      const v=await stOpts[k].getAttribute('value');
      if(v && v!=='0' && v!==''){ await sels[1].selectOption({index:k}).catch(()=>{}); stChosen=true; break; }
    }
  }
  if(!stChosen) return {ok:false, note:'[考勤:所有班级均无可选学生]'};
  await sleep(500);
  await page.evaluate(()=>{ const b=[...document.querySelectorAll('div.fixed.inset-0 button')].find(e=>(e.innerText||'')==='出勤'); if(b) b.click(); });
  await sleep(500);
  const sb=await page.evaluate(()=>{ const b=[...document.querySelectorAll('div.fixed.inset-0 button')].find(e=>(e.innerText||'').includes('保存记录')); if(b){ b.click(); return true;} return false; });
  await sleep(1800);
  return {ok:sb, note:(sb?'[考勤:已保存记录]':'[考勤:未找到保存记录]')};
}

// idx 26 手机箱开箱策略：选班级 → 添加时段 → 保存总开关与时段（PUT 更新/建）
async function fillPhonebox(page, marker, sleep){
  const sel=await page.$('select'); let chose=false;
  if(sel){ const opts=await sel.$$('option'); for(let k=1;k<opts.length;k++){ const t=await opts[k].evaluate(o=>o.text.trim()); if(t && !/请选择/.test(t)){ await sel.selectOption({index:k}); chose=true; break; } } }
  await sleep(1000);
  if(!chose) return {ok:false, note:'[开箱策略:无可选班级]'};
  const addWin=await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(e=>(e.innerText||'').includes('添加时段')); if(b){ b.click(); return true;} return false; });
  await sleep(800);
  const sb=await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(e=>(e.innerText||'').includes('保存总开关与时段')); if(b){ b.click(); return true;} return false; });
  await sleep(1500);
  return {ok:sb, note:(addWin?'[已添加时段]':'')+(sb?'[已保存策略]':'[未找到保存按钮]')};
}

// idx 28 成绩录入：自建"已发布+带科目"考试 → 刷新 → 选考试 → 填首个单元格 → 保存全部
async function fillScoreEntry(page, marker, sleep){
  let examId=null, dbg='';
  // 成绩录入页按科目名解析 subject_id（getSubjectId 依赖 Subject 表存在该科目）。
  // 若科目不在 Subject 表，blur-save 会 POST /api/scores 400 并写入控制台错误。
  // 故建考试前先确保科目存在，使前端能解析到 subject_id，400 消失。
  const subjName='测试69614';
  try{
    const gl=await page.request.get(BASE+'/api/subjects?page_size=300');
    let subjList=[]; try{ const gj=await gl.json(); subjList=(gj&&(gj.data||gj.items||gj))||[]; if(!Array.isArray(subjList)) subjList=[]; }catch(_){}
    if(!subjList.some(s=>s&&s.name===subjName)){
      await page.request.post(BASE+'/api/subjects', { data: JSON.stringify({name:subjName}), headers:{'Content-Type':'application/json'} }).catch(()=>{});
    }
  }catch(e){}
  try{
    const resp=await page.request.post(BASE+'/api/exams', {
      data: JSON.stringify({
        name: '自动化测试考试_'+marker,
        start_time: '2026-09-15T09:00:00',
        end_time: '2026-09-15T10:30:00',
        subjects: ['测试69614'],
        status: 'published'
      }),
      headers: { 'Content-Type':'application/json' }
    });
    const st=resp.status();
    dbg='[examPOST='+st+']';
    let cj={}; try{ cj=await resp.json(); }catch(e){ try{ cj={raw:await resp.text()}; }catch(_){} }
    if(st>=200&&st<300){ examId=(cj&&cj.data&&cj.data.id)||cj.id||null; }
    else { dbg+='[examErr='+JSON.stringify(cj).slice(0,120)+']'; }
  }catch(e){ dbg='[examEX='+String(e).slice(0,80)+']'; }
  if(!examId) return {ok:false, note:'[成绩录入:建考试失败]'+dbg};
  await page.reload({waitUntil:'load'}); await sleep(2200);
  let chose=false;
  for(let attempt=0; attempt<3 && !chose; attempt++){
    const sel=await page.$('select'); if(!sel) break;
    const opts=await sel.$$('option');
    for(let k=1;k<opts.length;k++){ const t=await opts[k].evaluate(o=>o.text.trim()); if(t && !/请选择考试/.test(t)){ await sel.selectOption({index:k}); chose=true; break; } }
    if(!chose) await sleep(1000);
  }
  await sleep(3500);
  if(!chose) return {ok:false, note:'[成绩录入:无可选考试]'+dbg};
  const cell=await page.$('input[data-sid]'); if(!cell) return {ok:false, note:'[成绩录入:未找到单元格]'+dbg};
  try{ await cell.fill('88'); }catch(e){}
  await sleep(400);
  try{ await page.keyboard.press('Tab'); }catch(e){}
  await sleep(900);
  const sb=await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(e=>(e.innerText||'').includes('保存全部')); if(b){ b.click(); return true;} return false; });
  await sleep(1800);
  return {ok:sb, note:(sb?'[成绩录入:已保存成绩]':'[成绩录入:未找到保存全部]')+dbg};
}

// idx 41 数据同步：点"执行修复" → 确认弹窗"确定"（POST 修复）
async function fillDataSync(page, marker, sleep){
  const fix=await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(e=>(e.innerText||'').includes('执行修复')); if(b){ b.click(); return true;} return false; });
  await sleep(1200);
  if(!fix) return {ok:false, note:'[数据同步:未找到执行修复]'};
  const ok=await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(e=>(e.innerText||'').includes('确定')); if(b){ b.click(); return true;} return false; });
  await sleep(2200);
  return {ok:ok, note: ok?'[数据同步:已执行修复]':'[数据同步:未找到确认按钮]'};
}

// idx 4 积分规则：点"添加规则" → modal-overlay 内填 规则名称/积分值/描述/分类 → 提交"添加规则"
async function fillPointsRule(page, marker, sleep){
  const ok=await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(e=>(e.innerText||'').includes('添加规则')); if(b){ b.click(); return true;} return false; });
  await sleep(1200);
  if(!ok) return {ok:false, note:'[积分规则:未找到添加规则按钮]'};
  const r=await page.evaluate((mk)=>{
    const overlay=document.querySelector('.modal-overlay'); if(!overlay) return {ok:false, note:'[未找到.modal-overlay]'};
    const form=overlay.querySelector('form'); if(!form) return {ok:false, note:'[未找到form]'};
    const setVal=(el,v)=>{ if(!el) return; const proto=el.tagName==='TEXTAREA'?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype; const s=Object.getOwnPropertyDescriptor(proto,'value').set; try{ s.call(el,v); }catch(e){} el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); };
    const name=form.querySelector('input[type=text]')||form.querySelector('input'); if(name) setVal(name, mk);
    const nums=form.querySelectorAll('input[type=number]'); if(nums[0]) setVal(nums[0],'5');
    const ta=form.querySelector('textarea'); if(ta) setVal(ta, mk);
    const sel=form.querySelector('select'); if(sel){ const o=[...sel.options].find(o=>!/请选择|选择|全部|不限/i.test(o.text)); if(o){ sel.value=o.value; sel.dispatchEvent(new Event('change',{bubbles:true})); } }
    return {ok:true};
  }, marker);
  await sleep(600);
  const sb=await page.evaluate(()=>{ const b=[...document.querySelectorAll('.modal-overlay button')].find(e=>(e.innerText||'').includes('添加规则')); if(b){ b.click(); return true;} return false; });
  await sleep(2000);
  return {ok:sb, note:(r.ok?'[表单已填]':'')+(sb?'[已提交]':'[未找到提交按钮]')+(r.note||'')};
}

// idx 36 审批管理：点"创建申请" → 填 学生(真实选项)/标题/积分变化/说明 → 提交"创建申请"
async function fillApproval(page, marker, sleep){
  const ok=await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(e=>(e.innerText||'').includes('创建申请')); if(b){ b.click(); return true;} return false; });
  await sleep(1200);
  if(!ok) return {ok:false, note:'[审批:未找到创建申请按钮]'};
  const r=await page.evaluate((mk)=>{
    const modal=document.querySelector('div.fixed.inset-0'); if(!modal) return {ok:false,note:'[未找到modal]'};
    const form=modal.querySelector('form'); if(!form) return {ok:false,note:'[未找到form]'};
    const setVal=(el,v)=>{ if(!el) return; const proto=el.tagName==='TEXTAREA'?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype; const s=Object.getOwnPropertyDescriptor(proto,'value').set; try{s.call(el,v);}catch(e){} el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); };
    const sels=form.querySelectorAll('select');
    if(sels[0]){ const o=[...sels[0].options].find(o=>o.value&&o.value!=='0'); if(o){ sels[0].value=o.value; sels[0].dispatchEvent(new Event('change',{bubbles:true})); } else return {ok:false, note:'[无可选学生]'}; }
    const title=form.querySelector('input[type=text]'); if(title) setVal(title, mk);
    const num=form.querySelector('input[type=number]'); if(num) setVal(num,'5');
    const ta=form.querySelector('textarea'); if(ta) setVal(ta, mk);
    return {ok:true};
  }, marker);
  await sleep(600);
  const sb=await page.evaluate(()=>{ const modal=document.querySelector('div.fixed.inset-0'); if(!modal) return false; const b=[...modal.querySelectorAll('button')].find(e=>(e.innerText||'').includes('创建申请')); if(b){ b.click(); return true;} return false; });
  await sleep(2000);
  return {ok:sb, note:(r.ok?'[表单已填]':'')+(sb?'[已提交]':'[未找到提交按钮]')+(r.note||'')};
}

// idx 37 远程通知：精确点「我的模板」卡片的"新建" → 填模板名称/内容 → 保存（POST 模板，2xx 即真实落库）
// 该页有两个"新建"（模板 / 定时通知）外加右侧"发送通知"，通用 pickAddBtn 在连续跑时偶发检测不到弹窗；专属驱动精确命中模板弹窗
async function fillRemoteNotify(page, marker, sleep){
  // 1) 精确命中「我的模板」卡片内的"新建"按钮（避开「定时通知」卡片的"新建"与右侧"发送通知"）
  let add=false;
  for(let t=0; t<8 && !add; t++){
    add=await page.evaluate(()=>{
      const h3=[...document.querySelectorAll('h3')].find(h=>(h.innerText||'').includes('我的模板'));
      if(!h3) return false;
      const card=h3.parentElement && h3.parentElement.parentElement; // header div -> card div
      if(!card) return false;
      const b=[...card.querySelectorAll('button,[role=button]')].find(e=>(e.innerText||'').trim()==='新建');
      if(b){ b.click(); return true; } return false;
    });
    if(!add) await sleep(800);
  }
  if(!add) return {ok:false, note:'[远程通知:未找到我的模板-新建按钮]'};
  // 2) 轮询等待模板弹窗（div.fixed.inset-0 内含 input/textarea），比通用流程等待更久，规避连续跑首检过早
  let modal=null;
  for(let t=0; t<12 && !modal; t++){
    modal=await page.evaluate(()=>{
      const ov=document.querySelector('div.fixed.inset-0');
      if(ov && ov.querySelector('input,textarea')) return {found:true};
      return null;
    });
    if(!modal) await sleep(600);
  }
  if(!modal) return {ok:false, note:'[远程通知:未出现模板弹窗]'};
  // 3) 填模板名称 + 内容
  const r=await page.evaluate((mk)=>{
    const ov=document.querySelector('div.fixed.inset-0'); if(!ov) return {ok:false};
    const setVal=(el,v)=>{ if(!el) return; const proto=el.tagName==='TEXTAREA'?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype; const s=Object.getOwnPropertyDescriptor(proto,'value').set; try{s.call(el,v);}catch(e){} el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); };
    const name=ov.querySelector('input[type=text]')||ov.querySelector('input'); if(name) setVal(name, 'PBT模板'+mk);
    const ta=ov.querySelector('textarea'); if(ta) setVal(ta, 'PBT自动化测试通知内容'+mk);
    return {ok:!!name};
  }, marker);
  await sleep(600);
  // 4) 点"保存"（handleSaveTemplate → api.notifyTemplates.create → POST 真实写库）
  const sb=await page.evaluate(()=>{ const ov=document.querySelector('div.fixed.inset-0'); if(!ov) return false; const b=[...ov.querySelectorAll('button')].find(e=>(e.innerText||'').includes('保存')); if(b){ b.click(); return true;} return false; });
  await sleep(2200);
  return {ok:sb, note:(r.ok?'[模板表单已填]':'[模板名称输入框未定位]')+(sb?'[已保存模板]':'[未找到保存按钮]')};
}

// ===== 编辑/删除回归（B 计划）：仅对本次新建的 PBT 测试行操作，绝不碰真实种子数据 =====
async function verifyEditDelete(page, sleep){
  const note=[]; let short='skipped';
  try{
    // 1) 在表格里找含 PBT 标记的行（即本次 UI 新建的测试行）
    const rowInfo=await page.evaluate(()=>{
      const rows=[...document.querySelectorAll('tr.ant-table-row, tr, .ant-list-item, [class*=row]')];
      for(const r of rows){
        const t=(r.innerText||'');
        if(/PBT/.test(t)){
          // 行内找编辑按钮（图标按钮 title/aria-label 含 编辑/修改，或文字按钮）
          const editBtn=r.querySelector('button[title*=编辑],button[aria-label*=编辑],a[title*=编辑],button[title*=修改],a[title*=修改]') || [...r.querySelectorAll('button,a,[role=button]')].find(e=>/编辑|修改/.test(e.innerText||e.getAttribute('title')||'')) || null;
          if(editBtn){ return {found:true, idx:[...r.parentNode.children].indexOf(r), hasEdit:true}; }
          return {found:true, idx:[...r.parentNode.children].indexOf(r), hasEdit:false};
        }
      }
      return {found:false};
    });
    if(!rowInfo.found){ note.push('[edit/delete:未发现PBT测试行,跳过,不触碰真实数据]'); return {note:note.join(''), short}; }
    if(rowInfo.hasEdit){
      // 重新定位该行并点编辑
      const clicked=await page.evaluate(()=>{
        const rows=[...document.querySelectorAll('tr.ant-table-row, tr, .ant-list-item, [class*=row]')];
        for(const r of rows){ if(/PBT/.test(r.innerText||'')){ const b=r.querySelector('button[title*=编辑],button[aria-label*=编辑],a[title*=编辑],button[title*=修改],a[title*=修改]') || [...r.querySelectorAll('button,a,[role=button]')].find(e=>/编辑|修改/.test(e.innerText||e.getAttribute('title')||'')); if(b){ b.click(); return true; } } } return false;
      });
      if(clicked){ note.push('[edit:已点编辑]'); await sleep(1300);
        await page.evaluate((mk)=>{ const inp=document.querySelector('.ant-modal input[type=text],.ant-modal textarea,.ant-modal input:not([type]),input[type=text],textarea'); if(inp){ const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; try{ s.call(inp, mk);}catch(e){} inp.dispatchEvent(new Event('input',{bubbles:true})); } }, 'EDIT'+String(Date.now()).slice(-8));
        await sleep(400);
        const sb=await page.evaluate(()=>{ const b=[...document.querySelectorAll('.ant-modal button')].find(e=>/保存|确定|提交|更新/.test(e.innerText||'')); if(b){ b.click(); return (e.innerText||'').trim().slice(0,8);} return null; });
        note.push(sb?('[edit-submit:'+sb+']'):'[edit提交未找到]'); await sleep(1500);
      } else { note.push('[edit:行内编辑按钮未定位]'); }
    } else { note.push('[edit:该行无编辑按钮]'); }
    // 2) 删除：找含 PBT 的行，点其删除
    const delClicked=await page.evaluate(()=>{
      const rows=[...document.querySelectorAll('tr.ant-table-row, tr, .ant-list-item, [class*=row]')];
      for(const r of rows){ if(/PBT/.test(r.innerText||'')){ const b=r.querySelector('button[title*=删除],button[aria-label*=删除],a[title*=删除]') || [...r.querySelectorAll('button,a,[role=button]')].find(e=>/删除|移除|作废/.test(e.innerText||e.getAttribute('title')||'')); if(b){ b.click(); return true; } } } return false;
    });
    if(delClicked){ note.push('[delete:已点删除]'); await sleep(1000);
      const ok=await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(e=>(e.innerText||'')==='确定'||(e.innerText||'')==='确认删除'||(e.innerText||'')==='删除'); if(b){ b.click(); return true;} return false; });
      note.push(ok?'[delete确认]':'[delete确认未找到]'); await sleep(1500);
    } else { note.push('[delete:该行无删除按钮]'); }
    short='attempted';
  }catch(e){ note.push('[editDelete异常'+String(e).slice(0,40)+']'); }
  return {note:note.join(''), short};
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
        const GAP={ '智能评分':fillNLP, '考勤管理':fillAttendance, '手机箱开箱策略':fillPhonebox, '成绩录入':fillScoreEntry, '数据同步':fillDataSync, '积分规则':fillPointsRule, '审批管理':fillApproval, '远程通知':fillRemoteNotify };
        let __gap=false;
        if(GAP[name]){
          __gap=true;
          rec.addBtnFound=true; rec.addBtnText=name+'专属驱动';
          try{
            const gr=await GAP[name](page, marker, sleep);
            rec.modalOpened=true; rec.submitClicked=!!gr.ok; rec.submitText=name+'提交';
            rec.note=(rec.note||'')+(gr.note||'');
            rec.result=await captureResult(page);
          }catch(e){ rec.note=(rec.note||'')+'[专属驱动异常 '+String(e).slice(0,80)+']'; }
        }
        if(!__gap){
        const pick=await pickAddBtn(page);
        rec.addBtnFound=pick.found; rec.addBtnText=pick.text||'';
        if(pick.found){
          let m={found:false};
          // 重试至多 3 轮：首检过早或点击偶发被吞时，重标按钮再点
          for(let attempt=0; attempt<3 && !m.found; attempt++){
            try{ await clickById(page,'__auto_add_btn'); }catch(_){}
            for(let w=0; w<6 && !m.found; w++){ await sleep(700); m=await findModalContainer(page); }
            if(!m.found){ try{ await pickAddBtn(page); }catch(_){} } // 重新给按钮打 id 供下一轮点击
          }
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
        } /* end !__gap */
        const wrote=respBuf.slice(beforeResp).some(c=>['POST','PUT','PATCH','DELETE'].includes(c.m)&&c.status>=200&&c.status<300 && !/frontend-performance/.test(c.url));
        if(wrote){ try{ const ed=await verifyEditDelete(page, sleep); rec.note=(rec.note||'')+(ed.note||''); rec.editDelete=ed.short||null; }catch(e){ rec.note=(rec.note||'')+'[editDelete异常]'; } }
      } else { rec.note='只读/展示页'; }
    }catch(e){ rec.note='EXCEPTION: '+String(e).slice(0,160); }
    rec.apiCalls=respBuf.slice(beforeResp).map(x=>({m:x.m,url:x.url,status:x.status}));
    const slice=errBuf.slice(before);
    rec.pageErrors=slice.filter(x=>x.t==='pageerror').map(x=>x.m);
    rec.consoleErrors=slice.filter(x=>x.t==='console').map(x=>x.m);
    try{ log(safeStr(rec)); }catch(e){ try{ log('LOG_FAIL idx='+i+' '+String(e).slice(0,80)); }catch(_){} }
    try{ console.log(`[${i}] ${name} add=${rec.addBtnFound}(${rec.addBtnText}) modal=${rec.modalOpened} f=${rec.fields} submit=${rec.submitClicked} err=${rec.pageErrors.length+rec.consoleErrors.length}`); }catch(_){}
  }
  await browser.close();
  log('__DONE__');
})().catch(e=>{ fs.appendFileSync(RESULT,'FATAL '+String(e)+'\n'); });
