// 全按钮验收：对 49 个页面的「每一个」交互按钮逐一点击，验证其效果且不抛错。
// 与 run15.js（仅测新增按钮并落库）互补：本脚本覆盖 编辑/删除/搜索/筛选/分页/标签/刷新/开关 等全部按钮。
// 安全策略：破坏性确认框（删除/清空/移除/作废）只打开并「取消」，绝不执行破坏性操作；新增表单弹窗只打开统计字段数后取消，不落库（写路径已由 run15 full22 覆盖）。
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = 'C:/Users/53527/Desktop/自我管理提升/自我管理提升V2.0/平台开发/管理平台设计/.workbuddy/browser_test';
const SHOTS = path.join(OUT, 'shots_all');
const RESULT = path.join(OUT, 'all_buttons.jsonl');
const BASE = 'http://127.0.0.1:3000';
fs.mkdirSync(SHOTS, { recursive: true });
fs.writeFileSync(RESULT, '');

// 仅跑指定页（逗号分隔索引），不设置则全跑
const FILTER = (process.env.PAGES || '').split(',').map(s=>s.trim()).filter(Boolean).map(Number);
const ONLY = FILTER.length ? new Set(FILTER) : null;

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

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function log(s){ fs.appendFileSync(RESULT, s + '\n'); }
function safeStr(o){ const seen=new WeakSet(); return JSON.stringify(o, (k,v)=>{ if(typeof v==='object'&&v!==null){ if(seen.has(v)) return '[circular]'; seen.add(v); } if(typeof v==='function') return '[fn]'; return v; }); }

const SEL = 'button,[role=button],a.ant-btn,a[class*=btn],input[type=submit],div[role=tab],a[role=tab],li[role=tab]';

async function enumButtons(page){
  return await page.evaluate((SEL)=>{
    const vis=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
    const inNav=el=>!!el.closest('nav,aside,.sidebar,.ant-menu,[class*=sidebar],[class*=menu],header,.header,[class*=header]');
    const labelOf=el=>(el.innerText||el.getAttribute('title')||el.getAttribute('aria-label')||el.value||'').trim().replace(/\s+/g,' ');
    const els=Array.from(document.querySelectorAll(SEL)).filter(e=>vis(e) && !inNav(e));
    const seen=new Set(); const out=[];
    for(const e of els){ const t=labelOf(e); if(!t) continue; const key=t+'|'+e.tagName; if(seen.has(key)) continue; seen.add(key); out.push({text:t.slice(0,40), tag:e.tagName, cls:(e.className||'').toString().slice(0,60)}); }
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

async function modalFields(page){
  return await page.evaluate(()=>{
    const vis=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
    let best=0;
    const sels=['[role=dialog]','.ant-modal-content','.ant-drawer-content','div.fixed.inset-0'];
    for(const s of sels){ for(const e of Array.from(document.querySelectorAll(s))){ if(vis(e)){ const f=e.querySelectorAll('input,textarea,select,.ant-select,.ant-picker').length; if(f>best) best=f; } } }
    return best;
  });
}

async function isDestructiveConfirm(page){
  return await page.evaluate(()=>{
    const vis=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
    const bts=Array.from(document.querySelectorAll('.ant-modal button,[role=dialog] button,div.fixed button')).filter(vis);
    return bts.some(b=>/删除|移除|作废|清空|重置全部/.test(b.innerText||''));
  });
}

async function dismissModal(page){
  // 优先点取消/关闭类按钮；否则 Escape
  const did = await page.evaluate(()=>{
    const vis=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
    const bts=Array.from(document.querySelectorAll('.ant-modal button,[role=dialog] button,div.fixed button,div[class*=overlay] button')).filter(vis);
    const c=bts.find(b=>/取消|关闭|×|收起|暂不|算了|返回/.test(b.innerText||''));
    if(c){ c.click(); return true; }
    return false;
  });
  if(!did){ try{ await page.keyboard.press('Escape'); }catch(_){} }
  await sleep(500);
}

async function clickByText(page, txt){
  return await page.evaluate((txt)=>{
    const SEL='button,[role=button],a.ant-btn,a[class*=btn],input[type=submit],div[role=tab],a[role=tab],li[role=tab]';
    const vis=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
    const inNav=el=>!!el.closest('nav,aside,.sidebar,.ant-menu,[class*=sidebar],[class*=menu],header,.header,[class*=header]');
    const labelOf=el=>(el.innerText||el.getAttribute('title')||el.getAttribute('aria-label')||el.value||'').trim().replace(/\s+/g,' ');
    const els=Array.from(document.querySelectorAll(SEL)).filter(e=>vis(e)&&!inNav(e));
    const target=els.find(e=>labelOf(e)===txt);
    if(!target) return false;
    try{ target.click(); }catch(e){ return false; }
    return true;
  }, txt);
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'] });
  const ctx = await browser.newContext({ viewport:{width:1280,height:1100} });
  const page = await ctx.newPage();
  const errBuf=[]; const respBuf=[]; let curRoute=-1;
  page.on('pageerror', e=>errBuf.push({t:'pageerror',m:String(e.message||e).slice(0,200),route:curRoute}));
  page.on('console', m=>{ if(m.type()==='error') errBuf.push({t:'console',m:String(m.text()).slice(0,200),route:curRoute}); });
  page.on('response', r=>{ const m=r.request().method(); if(['POST','PUT','DELETE','PATCH'].includes(m)) respBuf.push({route:curRoute,m,url:r.url().split('?')[0],status:r.status()}); });

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
        let effect='none'; let note=''; let unclickable=false;
        try{
          const clicked = await clickByText(page, btn.text);
          if(!clicked){ unclickable=true; effect='unclickable'; note='点击时按钮已不可见/动态消失'; }
          else {
            await sleep(1000);
            const modalOpen = await isModalOpen(page);
            const urlNow = page.url();
            const nav = urlNow!==beforeUrl;
            const newResp = respBuf.slice(beforeResp).filter(c=>!/frontend-performance|socket.io/.test(c.url));
            if(modalOpen) effect='modal';
            else if(nav) effect='navigate';
            else if(newResp.length) effect='api';
            else effect='none';
            if(modalOpen){
              const destructive = await isDestructiveConfirm(page);
              if(destructive){ effect='confirm(cancelled)'; note='破坏性确认框已打开并取消，未执行破坏性操作'; await dismissModal(page); }
              else { const f=await modalFields(page); note='表单/对话框已打开(字段数='+f+')，已取消未落库'; effect='dialog(cancelled)'; await dismissModal(page); }
            }
            // 复位到干净页面，避免状态串扰
            if(nav || modalOpen){ try{ await page.goto(BASE+hash,{waitUntil:'networkidle'}); await sleep(900); }catch(_){} }
          }
        }catch(e){ note='CLICK_EXCEPTION '+String(e).slice(0,140); effect='exception'; try{ await dismissModal(page); }catch(_){} }
        const slice=errBuf.slice(beforeErr);
        const errs=slice.map(x=>x.m);
        recs.push({button:btn.text, tag:btn.tag, effect, unclickable, note, errors:errs,
          apiCalls:respBuf.slice(beforeResp).filter(c=>!/frontend-performance|socket.io/.test(c.url)).map(c=>({m:c.m,url:c.url,status:c.status}))});
        // 每按钮测试后强制复位本页
        try{ await page.goto(BASE+hash,{waitUntil:'networkidle'}); await sleep(700); }catch(_){}
      }
      log(safeStr({idx:i, hash, name, buttonsFound:buttons.length, buttons:recs}));
      try{ console.log(`[${i}] ${name} buttons=${buttons.length} errTotal=${recs.reduce((a,b)=>a+b.errors.length,0)}`); }catch(_){}
    }catch(e){ log(safeStr({idx:i, hash, name, error:String(e).slice(0,180)})); console.log(`[${i}] ${name} PAGE_EXCEPTION ${String(e).slice(0,80)}`); }
  }
  await browser.close();
  log('__DONE__');
})();
