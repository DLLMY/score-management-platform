// 定向验证「全量回归中被标为 unclickable 的 34 个余下按钮」。
// 这些按钮并非功能 bug，而是 harness 的可达性缺口：
//   #7  解析          —— 条件按钮，需先填内容
//   #22/#23/#24 行操作 —— React 按行 hover 状态条件渲染，DOM 无此按钮
//   #32 设备 toolbar  —— 无设备时走空状态不渲染 toolbar（seed 1 台设备后渲染，测后删除）
//   #37 远程通知色块  —— SendForm 右侧面板中的预设色块，按 title 点击
// 安全策略：破坏性确认框只打开并取消，绝不执行删除/开箱等写操作。
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = 'C:/Users/53527/Desktop/自我管理提升/自我管理提升V2.0/平台开发/管理平台设计/.workbuddy/browser_test';
const RESULT = path.join(OUT, 'verify_remaining.jsonl');
const BASE = 'http://127.0.0.1:3000';
const API = 'http://127.0.0.1:5000';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function log(s){ fs.appendFileSync(RESULT, s + '\n'); }
function safeStr(o){ const seen=new WeakSet(); return JSON.stringify(o,(k,v)=>{ if(typeof v==='object'&&v!==null){ if(seen.has(v)) return '[circular]'; seen.add(v);} if(typeof v==='function') return '[fn]'; return v; }); }

// 关闭可见的弹窗/确认框（优先 取消/关闭/否）
async function dismissOverlays(page){
  await page.evaluate(()=>{
    const vis=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
    const bts=Array.from(document.querySelectorAll('.ant-modal button,[role=dialog] button,div.fixed button,.ant-popconfirm button')).filter(vis);
    const c=bts.find(b=>/取消|关闭|×|收起|暂不|算了|返回|否/.test(b.innerText||''));
    if(c) c.click();
  }).catch(()=>{});
  await page.keyboard.press('Escape').catch(()=>{});
  await sleep(400);
}

(async () => {
  fs.writeFileSync(RESULT, '');
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'] });
  const ctx = await browser.newContext({ viewport:{width:1280,height:1100} });
  const page = await ctx.newPage();
  const errBuf = [];
  page.on('pageerror', e => errBuf.push({t:'pageerror', m:String(e.message||e).slice(0,220)}));
  page.on('console', m => { if(m.type()==='error') errBuf.push({t:'console', m:String(m.text()).slice(0,220)}); });
  page.on('response', r => { const s=r.status(); if(s>=400) errBuf.push({t:'http'+s, m:r.request().method()+' '+r.url().split('?')[0]+' -> '+s}); });

  const errCount = () => errBuf.length;
  const snap = () => errCount();
  const drain = (s) => errBuf.slice(s).map(x=>x.t+': '+x.m);
  const results = [];

  // 登录
  await page.goto(BASE+'/#/login', {waitUntil:'networkidle'}); await sleep(1200);
  await page.fill('input[placeholder="请输入用户名"]','admin');
  await page.fill('input[placeholder="请输入密码"]','Test@123456');
  await page.click('button:has-text("登录")'); await sleep(2500);

  // ---------- #7 解析（条件按钮） ----------
  try {
    await page.goto(BASE+'/#/nlp-management', {waitUntil:'networkidle'}); await sleep(1500);
    const s = snap();
    let effect='no-input';
    const inp = page.locator('input[placeholder*="自然语言文本"]').first();
    if(await inp.count()){
      await inp.fill('张三上课睡觉扣分，李四积极回答问题加分');
      await sleep(700);
      const parseBtn = page.locator('button:has-text("解析")').first();
      if(await parseBtn.count()){ await parseBtn.click(); effect='clicked'; }
      else effect='no-parse-btn';
    }
    await sleep(1200);
    results.push({page:'#7 智能评分', button:'解析', effect, errors:drain(s)});
    await page.goto(BASE+'/#/nlp-management',{waitUntil:'networkidle'}); await sleep(600);
  } catch(e){ results.push({page:'#7 智能评分', button:'解析', effect:'exception', errors:[String(e).slice(0,200)]}); }

  // ---------- #22/#23/#24 行 hover 操作 ----------
  const rowPages = [
    {hash:'#/activity', name:'#22 文体活动', acts:['编辑','删除','报名','取消']},
    {hash:'#/culture',  name:'#23 班级文化', acts:['上移','下移','编辑','删除']},
    {hash:'#/study-guide', name:'#24 学法指导', acts:['编辑','删除']},
  ];
  for(const rp of rowPages){
    try {
      await page.goto(BASE+rp.hash, {waitUntil:'networkidle'}); await sleep(1500);
      const rowHandle = await page.$('.ant-table-row, tbody tr');
      if(!rowHandle){ results.push({page:rp.name, button:'(无表格行)', effect:'no-row', errors:[]}); continue; }
      await rowHandle.hover().catch(()=>{});
      await sleep(500);
      for(const act of rp.acts){
        const s = snap();
        const clicked = await page.evaluate((act)=>{
          const row=document.querySelector('.ant-table-row, tbody tr');
          if(!row) return false;
          const SEL='button,[role=button],a.ant-btn,span.ant-btn';
          const v=e=>getComputedStyle(e).display!=='none';
          const t=e=>(e.innerText||e.getAttribute('title')||'').trim();
          const b=Array.from(row.querySelectorAll(SEL)).filter(v).find(e=>t(e)===act);
          if(!b) return false; b.click(); return true;
        }, act);
        await sleep(900);
        await dismissOverlays(page);
        results.push({page:rp.name, button:act, effect:clicked?'clicked':'not-found', errors:drain(s)});
        await page.goto(BASE+rp.hash, {waitUntil:'networkidle'}); await sleep(800);
      }
    } catch(e){ results.push({page:rp.name, button:'(block-exception)', effect:'exception', errors:[String(e).slice(0,200)]}); }
  }

  // ---------- #37 远程通知 预设色块 ----------
  try {
    await page.goto(BASE+'/#/remote-notify', {waitUntil:'networkidle'}); await sleep(1500);
    const colors = ['黑色','红色','蓝色','绿色','黄色','紫色','橙色','灰色','深灰','深蓝','深红','金色','白色','青色','粉红','天蓝'];
    for(const c of colors){
      const s = snap();
      const ok = await page.evaluate((c)=>{
        const b=document.querySelector(`[title="${c}"]`);
        if(!b) return false; b.click(); return true;
      }, c);
      await sleep(300);
      results.push({page:'#37 远程通知', button:c, effect:ok?'clicked':'not-found', errors:drain(s)});
    }
    await page.goto(BASE+'/#/remote-notify',{waitUntil:'networkidle'}); await sleep(600);
  } catch(e){ results.push({page:'#37 远程通知', button:'(block-exception)', effect:'exception', errors:[String(e).slice(0,200)]}); }

  // ---------- #32 设备管理 toolbar（seed 1 台设备渲染） ----------
  let seededId = null;
  try {
    const loginResp = await fetch(API+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:'Test@123456'})});
    const lj = await loginResp.json();
    const tok = lj.access_token || (lj.data&&lj.data.access_token) || '';
    if(tok){
      const devResp = await fetch(API+'/api/devices',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},body:JSON.stringify({device_id:'VERIFY_'+Date.now(), name:'验收临时设备'})});
      const dj = await devResp.json();
      seededId = (dj.data&&dj.data.device_id) || (dj.data&&dj.data.id) || null;
    }
  } catch(e){ results.push({page:'#32 设备管理', button:'(seed)', effect:'seed-failed', errors:[String(e).slice(0,200)]}); }
  await sleep(800);

  try {
    await page.goto(BASE+'/#/devices', {waitUntil:'networkidle'}); await sleep(1800);
    const toolbarBtns = ['导出Excel','导出PDF','导入设备','添加设备','批量OTA升级'];
    for(const b of toolbarBtns){
      const s = snap();
      const ok = await page.evaluate((b)=>{
        const SEL='button,[role=button],a.ant-btn';
        const v=e=>getComputedStyle(e).display!=='none';
        const t=e=>(e.innerText||e.getAttribute('title')||'').trim();
        const el=Array.from(document.querySelectorAll(SEL)).filter(v).find(e=>t(e)===b);
        if(!el) return false; el.click(); return true;
      }, b);
      await sleep(1000);
      await dismissOverlays(page);
      results.push({page:'#32 设备管理', button:b, effect:ok?'clicked':'not-found', errors:drain(s)});
      await page.goto(BASE+'/#/devices',{waitUntil:'networkidle'}); await sleep(900);
    }
  } catch(e){ results.push({page:'#32 设备管理', button:'(block-exception)', effect:'exception', errors:[String(e).slice(0,200)]}); }

  // 清理 seed 的设备
  if(seededId && typeof seededId==='number'){
    try{
      const loginResp = await fetch(API+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:'Test@123456'})});
      const lj = await loginResp.json(); const tok = lj.access_token || (lj.data&&lj.data.access_token) || '';
      await fetch(API+'/api/devices/'+seededId,{method:'DELETE',headers:{'Authorization':'Bearer '+tok}});
    }catch(e){ results.push({page:'#32 设备管理', button:'(cleanup)', effect:'cleanup-failed', errors:[String(e).slice(0,200)]}); }
  }

  await browser.close();
  let totalErr=0; for(const r of results) totalErr+=r.errors.length;
  log(safeStr({summary:{total:results.length, withErrors:results.filter(r=>r.errors.length).length, totalErrors:totalErr}}));
  for(const r of results) log(safeStr(r));
  log('__DONE__');
  console.log('VERIFY DONE total='+results.length+' errors='+totalErr);
})().catch(e=>{ console.error('FATAL', e); process.exit(1); });
