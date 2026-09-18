// 真实写入 + 字段统一 + API 对接验收（第二轮，用户指令「再次验证，真实写入」）
// 在 click_submit_all.js 基础上增强：
//   ① 每个按钮真实点击并提交（新增真实落库 / 编辑真实保存 / 删除真实执行）；硬件控制网络层 abort，绝不真实下发。
//   ② 拦截「每次写接口」的请求体与响应体：捕获 method / url / 请求字段+样本值 / 响应 status / 响应 data 字段+样本值。
//   ③ 由 analyze_fields.js 做「请求字段→响应持久化字段」值级 round-trip 比对（键归一化 camel↔snake），标记：
//        - 发送但响应未体现（值 null/缺失）= 字段未统一真信号
//        - 写接口非 2xx = API 对接失败
//   ④ 测试前需先 restore_db.js 把 live 设为基线；测试后再次 restore_db.js 净零还原。
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = 'C:/Users/53527/Desktop/自我管理提升/自我管理提升V2.0/平台开发/管理平台设计/.workbuddy/browser_test';
const RESULT = path.join(OUT, 'submit_results.jsonl');
const FIELDS = path.join(OUT, 'field_capture.jsonl');
const BASE = 'http://127.0.0.1:3000';

const FILTER = (process.env.PAGES || '').split(',').map(s=>s.trim()).filter(Boolean).map(Number);
const ONLY = FILTER.length ? new Set(FILTER) : null;
if(!ONLY){ fs.writeFileSync(RESULT, ''); fs.writeFileSync(FIELDS, ''); }

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
const DANGER = /重启(服务|系统|后端|应用|服务器)?|停止服务|退出登录|登出|注销账户|清空所有|重置系统|恢复出厂|清空缓存|重建索引/;
const DESTRUCTIVE = /删除|移除|作废|清空|重置全部|解散|删除用户|删除班级|删除设备/;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function safeStr(o){ const seen=new WeakSet(); return JSON.stringify(o, (k,v)=>{ if(typeof v==='object'&&v!==null){ if(seen.has(v)) return '[circular]'; seen.add(v); } if(typeof v==='function') return '[fn]'; return v; }); }
function tmpl(u){
  let p = u.split('?')[0].replace(/^https?:\/\/[^/]+/, '');
  p = p.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id'); // uuid
  p = p.replace(/\/[0-9]{6,}/g, '/:id'); // long numeric ids
  p = p.replace(/\/\d+(?=\/|$)/g, '/:id'); // short numeric ids
  return p;
}
function fieldSample(obj, maxKeys=20){
  if(obj===null||obj===undefined) return {type:'null', keys:[], sample:{}};
  if(Array.isArray(obj)){ return {type:'array', keys:['<array len '+obj.length+'>'], sample: obj.length?safeStr(obj[0]).slice(0,200):{}}; }
  if(typeof obj!=='object'){ return {type:typeof obj, keys:[], sample:String(obj).slice(0,80)}; }
  const keys=Object.keys(obj).slice(0,maxKeys);
  const sample={}; for(const k of keys){ const v=obj[k]; sample[k]= (typeof v==='object'&&v!==null)?(Array.isArray(v)?'[arr]':'[obj]'):String(v).slice(0,80); }
  return {type:'object', keys, sample};
}
function bodyOf(req){
  try{ const j=req.postDataJSON(); if(j!==undefined&&j!==null) return j; }catch(_){}
  try{ const raw=req.postData(); if(raw){ try{ return JSON.parse(raw); }catch(_){ return {__raw__:raw.slice(0,200)}; } } }catch(_){}
  return undefined;
}

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
async function isModalOpen(page){ return await page.evaluate(()=>{ const vis=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';}; const sels=['[role=dialog]','.ant-modal-content','.ant-drawer-content','div.fixed.inset-0','div[class*=overlay]']; for(const s of sels){ for(const e of Array.from(document.querySelectorAll(s))){ if(vis(e)) return true; } } return false; }); }
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
      try{ target.click(); }catch(e){ return false; } return true;
    }, txt);
    if(ok) return true;
    if(attempt===0){ await page.evaluate(()=>{ const SEL='button,[role=button],a.ant-btn,a[class*=btn]'; const vis=e=>getComputedStyle(e).display!=='none'; const labelOf=el=>(el.innerText||el.getAttribute('title')||'').trim(); const trig=Array.from(document.querySelectorAll(SEL)).filter(e=>vis(e)&&/^(更多|操作|更多操作|展开|设置|···|⋮)$|更多操作/.test(labelOf(e))); if(trig.length) trig[0].click(); }).catch(()=>{}); await sleep(600); }
    await sleep(400);
  }
  return false;
}
async function countRows(page){ return await page.evaluate(()=>{ const t=document.querySelector('.ant-table-tbody')||document.querySelector('table tbody'); if(!t) return -1; return t.querySelectorAll('tr.ant-table-row,tr:not(:first-child)').length; }); }
async function fillForm(page){ return await page.evaluate(async ()=>{
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    function setNativeValue(el,value){ try{ const proto=Object.getPrototypeOf(el); const desc=Object.getOwnPropertyDescriptor(proto,'value')||Object.getOwnPropertyDescriptor(el,'value'); if(desc&&desc.set){ desc.set.call(el,value); } else { el.value=value; } }catch(_){ el.value=value; } el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); }
    const vis=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
    const cand=[...document.querySelectorAll('[role=dialog],.ant-modal-content,.ant-drawer-content,div.fixed.inset-0')].filter(vis);
    const roots=cand.filter(e=>e.querySelector('button,input,textarea,.ant-form-item,[role=button],a'));
    if(!roots.length) return {filled:0,missed:['no-modal']};
    const root=roots[roots.length-1]; let filled=0; const missed=[];
    const inputs=root.querySelectorAll('input,textarea');
    for(const el of inputs){ if(el.type==='hidden'||el.disabled||el.type==='file') continue; if(el.closest('.ant-select-dropdown')||el.closest('.ant-picker-dropdown')) continue; const tag=el.tagName.toLowerCase();
      if(tag==='textarea'){ if(!el.value){ setNativeValue(el,'测试内容_'+Date.now()); filled++; } }
      else if(el.type==='number'){ if(!el.value){ setNativeValue(el,'1'); filled++; } }
      else if(el.type==='email'){ if(!el.value){ setNativeValue(el,'test@example.com'); filled++; } }
      else if(el.type==='checkbox'||el.type==='radio'){ }
      else { if(!el.value){ setNativeValue(el,'测试'+Date.now().toString().slice(-5)); filled++; } } }
    const selects=root.querySelectorAll('.ant-select:not(.ant-select-disabled)');
    for(const sel of selects){ const inp=sel.querySelector('input'); if(inp&&inp.value&&inp.value.trim()) continue; try{ sel.click(); }catch(_){} await sleep(350); const opts=document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option'); let chosen=null; for(const o of opts){ if(!o.className.includes('ant-select-item-option-disabled')&&!/请选择|placeholder/i.test(o.innerText||'')){ chosen=o; break; } } if(chosen){ try{ chosen.click(); }catch(_){} await sleep(250); filled++; } else { try{ document.body.click(); }catch(_){} await sleep(150); missed.push('select'); } }
    const natives=root.querySelectorAll('select:not([disabled])');
    for(const sel of natives){ if(sel.value) continue; const opts=[...sel.options].filter(o=>o.value); if(opts.length){ setNativeValue(sel, opts[0].value); sel.dispatchEvent(new Event('change',{bubbles:true})); await sleep(150); filled++; } else { missed.push('select-native'); } }
    const pickers=root.querySelectorAll('.ant-picker:not(.ant-picker-disabled)');
    for(const pk of pickers){ try{ pk.click(); }catch(_){} await sleep(350); const panel=document.querySelector('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)'); if(panel){ const cell=panel.querySelector('.ant-picker-cell-today,.ant-picker-cell-selected')||panel.querySelector('.ant-picker-cell'); if(cell){ try{ cell.click(); }catch(_){} await sleep(200); const okBtn=panel.querySelector('.ant-picker-ok button'); if(okBtn){ try{ okBtn.click(); }catch(_){} await sleep(200);} filled++; } else { missed.push('picker'); } } else { missed.push('picker'); } }
    const sws=root.querySelectorAll('.ant-switch:not(.ant-switch-checked):not(.ant-switch-disabled)');
    for(const sw of sws){ try{ sw.click(); }catch(_){} await sleep(120); filled++; }
    const radioGroups=new Set(); const radios=root.querySelectorAll('.ant-radio-wrapper:not(.ant-radio-wrapper-disabled)');
    for(const rw of radios){ const g=rw.querySelector('input'); if(!g) continue; const name=g.name||rw.innerText.slice(0,8); if(radioGroups.has(name)) continue; radioGroups.add(name); try{ rw.click(); }catch(_){} await sleep(80); filled++; }
    return {filled, missed};
  });
}
async function clickPrimarySubmit(page){ return await page.evaluate(async ()=>{ const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const vis=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';}; const cand=[...document.querySelectorAll('[role=dialog],.ant-modal-content,.ant-drawer-content,div.fixed.inset-0')].filter(vis); const roots=cand.filter(e=>e.querySelector('button,input,textarea,.ant-form-item,[role=button],a')); if(!roots.length) return false; const root=roots[roots.length-1]; const btns=[...root.querySelectorAll('button')].filter(vis); let b=btns.find(x=>x.className.includes('ant-btn-primary')); if(!b) b=btns.find(x=>/确定|提交|保存|创建|新增|发布|确认|添加|生成|导入|导出|开始|执行|下发/.test(x.innerText)); if(!b) b=btns.find(x=>!/取消|关闭|返回|上一步/.test(x.innerText)); if(!b) return false; try{ b.click(); }catch(_){ return false; } await sleep(900); return true; }); }
async function confirmDestructive(page){ return await page.evaluate(async ()=>{ const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const vis=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';}; const cand=[...document.querySelectorAll('[role=dialog],.ant-modal-content,.ant-drawer-content,div.fixed.inset-0,.ant-popconfirm,.ant-popover')].filter(vis); const roots=cand.filter(e=>e.querySelector('button')); const root=roots[roots.length-1]; if(!root) return false; const b=[...root.querySelectorAll('button')].filter(vis).find(x=>/确定|是|删除|移除|清空|重置/.test(x.innerText)); if(!b) return false; try{ b.click(); }catch(_){ return false; } await sleep(900); return true; }); }
async function getModalButtonTexts(page){ return await page.evaluate(()=>{ const vis=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';}; const cand=[...document.querySelectorAll('[role=dialog],.ant-modal-content,.ant-drawer-content,div.fixed.inset-0')].filter(vis); const roots=cand.filter(e=>e.querySelector('button,input,textarea,.ant-form-item,[role=button],a')); if(!roots.length) return ''; return [...roots[roots.length-1].querySelectorAll('button')].filter(vis).map(b=>b.innerText).join('|'); }); }
async function dismissModal(page){ const did = await page.evaluate(()=>{ const vis=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';}; const cand=[...document.querySelectorAll('[role=dialog],.ant-modal-content,.ant-drawer-content,div.fixed.inset-0')].filter(vis); const roots=cand.filter(e=>e.querySelector('button,input,textarea,.ant-form-item,[role=button],a')); if(!roots.length) return false; const root=roots[roots.length-1]; const c=[...root.querySelectorAll('button')].filter(vis).find(b=>/取消|关闭|×|收起|暂不|算了|返回|否/.test(b.innerText||'')); if(c){ c.click(); return true; } return false; }); if(!did){ try{ await page.keyboard.press('Escape'); }catch(_){} } await sleep(500); }
async function resetPage(page){ for(let k=0;k<4;k++){ const open=await isModalOpen(page); if(!open) break; await dismissModal(page); await sleep(400); } try{ await page.reload({waitUntil:'domcontentloaded'}); }catch(_){} await sleep(900); }

function appendJSONL(file, obj){ fs.appendFileSync(file, safeStr(obj)+'\n'); }

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'] });
  const ctx = await browser.newContext({ viewport:{width:1280,height:1100} });
  const page = await ctx.newPage();
  await page.route('**/api/devices/**/remote-control**', r=>r.abort());
  await page.route('**/api/devices/**/control**', r=>r.abort());
  await page.route('**/api/devices/**/restart**', r=>r.abort());
  await page.route('**/api/devices/**/wake**', r=>r.abort());
  await page.route('**/api/wol**', r=>r.abort());
  await page.route('**/api/**/wake-on-lan**', r=>r.abort());

  const errBuf=[]; const fieldBuf=[]; let curRoute=-1;
  page.on('pageerror', e=>errBuf.push({t:'pageerror',m:String(e.message||e).slice(0,240),route:curRoute}));
  page.on('console', m=>{ if(m.type()==='error') errBuf.push({t:'console',m:String(m.text()).slice(0,240),route:curRoute}); });
  // 捕获每次 API 请求（含写接口的请求体）与对应响应（含持久化 data）
  page.on('request', req=>{
    const m=req.method(); const u=req.url().split('?')[0];
    if(!/\/api\//.test(u)) return;
    if(['POST','PUT','PATCH','DELETE'].includes(m)){ const b=bodyOf(req); fieldBuf.push({_kind:'req', idx:curRoute, method:m, path:tmpl(u), url:u, reqFields: b&&typeof b==='object'&&!Array.isArray(b)?Object.keys(b):(Array.isArray(b)?['<array>']:[]), reqSample: fieldSample(b).sample, ts:Date.now()}); }
  });
  page.on('response', async (r)=>{
    const req=r.request(); const m=req.method(); const u=r.url().split('?')[0];
    if(!/\/api\//.test(u)) return;
    let respData=null, status=r.status();
    try{ const txt=await r.text(); try{ const j=JSON.parse(txt); if(j&&typeof j==='object'){ if('data' in j) respData=j.data; else respData=j; } }catch(_){} }catch(_){}
    const isWrite=['POST','PUT','PATCH','DELETE'].includes(m);
    const rec={_kind:'resp', idx:curRoute, method:m, path:tmpl(u), url:u, status, respType: respData===null?'(non-json/empty)':(Array.isArray(respData)?'array':typeof respData), respFields: respData&&typeof respData==='object'?(Array.isArray(respData)?(respData[0]&&typeof respData[0]==='object'?Object.keys(respData[0]):['<empty-array>']):Object.keys(respData)):[], respSample: fieldSample(respData).sample, ts:Date.now()};
    fieldBuf.push(rec);
    // 把写接口的「请求+响应」配对写入 field_capture.jsonl（供 analyze 做 round-trip）
    if(isWrite){
      const reqRec=fieldBuf.find(x=>x._kind==='req'&&x.idx===curRoute&&x.method===m&&x.path===rec.path&&x.ts<=rec.ts&&!x._paired);
      if(reqRec){ reqRec._paired=true; appendJSONL(FIELDS, {idx:curRoute, route:ROUTES[curRoute]?.[1], method:m, path:rec.path, status, reqFields:reqRec.reqFields, reqSample:reqRec.reqSample, respFields:rec.respFields, respSample:rec.respSample}); }
      else { appendJSONL(FIELDS, {idx:curRoute, route:ROUTES[curRoute]?.[1], method:m, path:rec.path, status, reqFields:[], reqSample:{}, respFields:rec.respFields, respSample:rec.respSample, note:'req-not-captured'}); }
    }
  });

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
        const beforeErr=errBuf.length; const beforeField=fieldBuf.length;
        let newFields = fieldBuf.slice(beforeField).filter(c=>!/frontend-performance|socket.io/.test(c.url||''));
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
            newFields = fieldBuf.slice(beforeField).filter(c=>!/frontend-performance|socket.io/.test(c.url||''));
            if(isProtected){
              if(modalOpen){ action='protected-verified'; note=(isDevice?'硬件控制':'系统危险操作')+'：确认弹窗已渲染，按安全边界未真实执行'; await dismissModal(page); }
              else if(newFields.some(c=>c._kind==='req'&&c.url&&c.url.includes('abort'))) { action='protected-aborted'; note=(isDevice?'硬件控制':'系统危险操作')+'：已触发但网络层 abort'; }
              else { action='protected-noop'; note=(isDevice?'硬件控制':'系统危险操作')+'：未触发可识别动作'; }
            }
            else if(modalOpen){
              const modalBtns = await getModalButtonTexts(page);
              const isDestructNow = /删除|移除|作废|清空|重置全部|解散/.test(modalBtns);
              if(isDestructNow){
                const rows=await countRows(page);
                if(rows>=2){
                  const ok=await confirmDestructive(page);
                  action='deleted'; note='破坏性确认已真实执行'+(ok?'':'（确认按钮未点中）');
                  detail.apiAfter=newFields.filter(c=>c._kind==='resp').map(c=>({m:c.method,path:c.path,status:c.status}));
                } else { action='delete-skipped'; note='破坏性操作跳过（行数<2；快照还原兜底）'; await dismissModal(page); }
              } else {
                const fr=await fillForm(page);
                const sub=await clickPrimarySubmit(page);
                const afterModal=await isModalOpen(page);
                action= afterModal ? 'submit-failed' : 'submitted';
                note='表单填充='+(fr.filled)+(fr.missed.length?(' 未覆盖='+fr.missed.join(',')):'')+' | 提交'+(sub?'成功':'失败')+(afterModal?' | 弹窗未关闭':' | 弹窗已关闭');
                detail.fill=fr; detail.apiAfter=newFields.filter(c=>c._kind==='resp').map(c=>({m:c.method,path:c.path,status:c.status}));
              }
            }
            else { action='api-or-nav'; detail.apiAfter=newFields.filter(c=>c._kind==='resp').map(c=>({m:c.method,path:c.path,status:c.status})); }
          }
        }catch(e){ action='exception'; note='CLICK_EXCEPTION '+String(e).slice(0,160); try{ await dismissModal(page); }catch(_){} }
        const slice=errBuf.slice(beforeErr);
        const writeCount=newFields.filter(c=>c._kind==='req').length;
        recs.push({button:btn.text, tag:btn.tag, action, note, errors:slice.map(x=>x.m), writeApiCount:writeCount,
          apiCalls:newFields.filter(c=>c._kind==='resp').map(c=>({m:c.method,path:c.path,status:c.status})) });
        try{ await resetPage(page); }catch(_){}
      }
      appendJSONL(RESULT, {idx:i, hash, name, buttonsFound:buttons.length, buttons:recs});
      console.log(`[${i}] ${name} buttons=${buttons.length} writes=${recs.reduce((a,b)=>a+b.writeApiCount,0)} errTotal=${recs.reduce((a,b)=>a+b.errors.length,0)}`);
    }catch(e){ appendJSONL(RESULT, {idx:i, hash, name, error:String(e).slice(0,200)}); console.log(`[${i}] ${name} PAGE_EXCEPTION ${String(e).slice(0,80)}`); }
  }
  await browser.close();
  appendJSONL(RESULT, '__DONE__');
  console.log('ALL DONE');
})();
