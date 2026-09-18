// 覆盖度复核扫描器：对 49 页做「激进枚举」，找出此前 harness（快照式只枚举可见顶层按钮）
// 可能漏掉的按钮/操作键。覆盖此前未触碰的：非默认 tab 内容、hover 才显现的表格行操作、
// 「更多/⋮」下拉菜单项、折叠面板/树节点展开后按钮、翻页后新行操作。
// 最后把「发现集合」与「已测集合」(submit_results.jsonl ∪ all_buttons_full_v4.jsonl) 做差集。
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = 'C:/Users/53527/Desktop/自我管理提升/自我管理提升V2.0/平台开发/管理平台设计/.workbuddy/browser_test';
const BASE = 'http://127.0.0.1:3000';
const COV = path.join(OUT, 'coverage_scan.jsonl');
const fs2 = fs;
fs2.writeFileSync(COV, '');

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

const sleep = ms => new Promise(r => setTimeout(r, ms));
function norm(s){ return (s||'').trim().replace(/\s+/g,' ').replace(/[·•‥…]/g,'').replace(/[⋮⋯]/g,'').slice(0,40); }

// ---- 加载已测集合 ----
function loadTested(){
  const tested = {}; // idx -> Set(normText)
  for (const f of ['submit_results.jsonl','all_buttons_full_v4.jsonl','verify_remaining.jsonl','verify_box.jsonl','all_buttons_pre_fix.jsonl']) {
    const fp = path.join(OUT, f);
    if (!fs2.existsSync(fp)) continue;
    const lines = fs2.readFileSync(fp,'utf8').split('\n').filter(Boolean).filter(l=>!l.includes('__DONE__'));
    for (const l of lines){
      let rec; try { rec = JSON.parse(l); } catch(e){ continue; }
      if (rec.idx===undefined) continue;
      const set = tested[rec.idx] || (tested[rec.idx]=new Set());
      const btns = rec.buttons||[];
      for (const b of btns){
        const t = b.button || b.text || (b.label) || '';
        if (t) set.add(norm(t));
        // all_buttons 记录里可能没有 button 字段而是直接是字符串
        if (typeof b === 'string') set.add(norm(b));
      }
      // 某些记录按钮是 {button, action} 或纯字符串数组
    }
  }
  return tested;
}
const TESTED = loadTested();

// ---- 枚举辅助 ----
const SEL = 'button,[role=button],a.ant-btn,a[class*=btn],input[type=submit],div[role=tab],a[role=tab],li[role=tab],.ant-dropdown-menu-item,[class*=action]';
async function collect(page, where){
  return await page.evaluate((SEL)=>{
    const vis=e=>{const s=getComputedStyle(e);return s.display!=='none'&&s.visibility!=='hidden';};
    const inNav=el=>!!el.closest('nav,aside,.sidebar,.ant-menu,[class*=sidebar],[class*=menu],header,.header,[class*=header]');
    const labelOf=el=>(el.innerText||el.getAttribute('title')||el.getAttribute('aria-label')||el.value||'').trim().replace(/\s+/g,' ');
    const els=Array.from(document.querySelectorAll(SEL)).filter(e=>vis(e)&&!inNav(e));
    const out=[]; const seen=new Set();
    for(const e of els){ const t=labelOf(e); if(!t||t.length>40) continue; const key=t+'|'+e.tagName; if(seen.has(key)) continue; seen.add(key); out.push({text:t,tag:e.tagName,cls:(e.className||'').toString().slice(0,40)}); }
    return out;
  }, SEL);
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'] });
  const ctx = await browser.newContext({ viewport:{width:1366,height:1200} });
  const page = await ctx.newPage();
  await page.goto(BASE+'/#/login',{waitUntil:'networkidle'}); await sleep(1500);
  await page.fill('input[placeholder="请输入用户名"]','admin');
  await page.fill('input[placeholder="请输入密码"]','Test@123456');
  await page.click('button:has-text("登录")'); await sleep(2500);

  const summary = [];
  for (let i=0;i<ROUTES.length;i++){
    const [hash,name]=ROUTES[i];
    const discovered = new Map(); // normText -> Set(where)
    const add = (arr, where) => { for (const b of arr){ const n=norm(b.text); if(!n) continue; if(!discovered.has(n)) discovered.set(n,new Set()); discovered.get(n).add(where); } };
    try{
      // 阶段1：基线可见按钮
      await page.goto(BASE+hash,{waitUntil:'networkidle'}); await sleep(1300);
      add(await collect(page,'visible'), 'visible');

      // 阶段2：逐个 tab 展开后枚举（非默认 tab 内容）
      const tabs = await page.$$('[role=tab]');
      for (let t=0;t<Math.min(tabs.length,14);t++){
        const tabsNow = await page.$$('[role=tab]');
        if (t>=tabsNow.length) break;
        try{ await tabsNow[t].click(); await sleep(700); add(await collect(page,'tab'+t),'tab'); }catch(_){}
      }
      // 复位到默认 tab
      try{ const first=await page.$('[role=tab]'); if(first) await first.click(); await sleep(500);}catch(_){}

      // 阶段3：注入 CSS 揭示表格行 hover 才显现的操作键，再枚举
      await page.addStyleTag({content:`
        .ant-table-row .ant-btn{opacity:1 !important;visibility:visible !important;pointer-events:auto !important;}
        .ant-table-cell .ant-btn{opacity:1 !important;visibility:visible !important;}
        tr:hover .ant-btn, .ant-table-row-hover .ant-btn{opacity:1 !important;visibility:visible !important;}
      `}).catch(()=>{});
      await sleep(400);
      add(await collect(page,'row-hover'),'row-hover');

      // 阶段4：逐个「更多/操作/⋮/...」下拉触发器，枚举菜单项
      const ddTriggers = await page.evaluate(()=>{
        const vis=e=>getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden';
        const labelOf=el=>(el.innerText||el.getAttribute('title')||el.getAttribute('aria-label')||'').trim();
        const els=Array.from(document.querySelectorAll('button,[role=button],.ant-dropdown-trigger,.ant-btn')).filter(e=>vis(e));
        const out=[];const seen=new Set();
        for(const e of els){const t=labelOf(e); if(/更多|操作|更多操作|⋮|⋯|···|展开|设置/.test(t)&&!seen.has(t)){seen.add(t);out.push(t);} }
        return out.slice(0,8);
      });
      for (const trig of ddTriggers){
        try{
          await page.evaluate((txt)=>{ const vis=e=>getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden'; const labelOf=el=>(el.innerText||el.getAttribute('title')||'').trim(); const els=Array.from(document.querySelectorAll('button,[role=button],.ant-dropdown-trigger')).filter(e=>vis(e)); const t=els.find(e=>labelOf(e)===txt)||els.find(e=>labelOf(e).startsWith(txt)); if(t) t.click(); }, trig);
          await sleep(700);
          add(await collect(page,'dropdown'),'dropdown');
          await page.keyboard.press('Escape').catch(()=>{}); await sleep(400);
        }catch(_){}
      }

      // 阶段5：展开折叠面板 / 树节点，枚举
      await page.evaluate(()=>{
        document.querySelectorAll('.ant-collapse-header').forEach(h=>{try{h.click();}catch(_){}});
        document.querySelectorAll('.ant-tree-switcher_close,.ant-tree-switcher_close').forEach(s=>{try{s.click();}catch(_){}});
      }).catch(()=>{});
      await sleep(700);
      add(await collect(page,'accordion'),'accordion');

      // 阶段6：翻页（最多2次）枚举新行
      for (let p=0;p<2;p++){
        const next = await page.$('.ant-pagination-next:not(.ant-pagination-disabled)');
        if(!next) break;
        try{ await next.click(); await sleep(800); add(await collect(page,'page'+(p+1)),'page'); }catch(_){ break; }
      }

      // ---- 差集 ----
      const testedSet = TESTED[i] || new Set();
      const uncovered = [];
      for (const [n, wheres] of discovered){
        if (!testedSet.has(n)) uncovered.push({text:n, where:[...wheres]});
      }
      const rec = {
        idx:i, hash, name,
        discoveredCount: discovered.size,
        testedCount: testedSet.size,
        uncoveredCount: uncovered.length,
        uncovered
      };
      fs2.appendFileSync(COV, JSON.stringify(rec)+'\n');
      console.log(`[${i}] ${name}: 发现=${discovered.size} 已测=${testedSet.size} 未测=${uncovered.length}`);
      // 复位
      await page.goto(BASE+'/#/dashboard',{waitUntil:'domcontentloaded'}); await sleep(400);
    }catch(e){
      fs2.appendFileSync(COV, JSON.stringify({idx:i,hash,name,error:String(e).slice(0,200)})+'\\n');
      console.log(`[${i}] ${name} SCAN_ERR ${String(e).slice(0,80)}`);
    }
  }
  await browser.close();
  fs2.appendFileSync(COV, '__DONE__\n');
  console.log('COVERAGE SCAN DONE');
})();
