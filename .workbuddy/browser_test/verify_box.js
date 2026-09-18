// 补充验证 #32 设备管理的 2 个行级按钮：开A箱 / 开B箱。
// 它们位于设备表格行内（DeviceColumns.tsx:185/193），点击会弹二次确认框，
// 仅打开确认框并取消，绝不真正下发开箱指令（安全）。
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = 'C:/Users/53527/Desktop/自我管理提升/自我管理提升V2.0/平台开发/管理平台设计/.workbuddy/browser_test';
const RESULT = path.join(OUT, 'verify_box.jsonl');
const BASE = 'http://127.0.0.1:3000';
const API = 'http://127.0.0.1:5000';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function safeStr(o){ const seen=new WeakSet(); return JSON.stringify(o,(k,v)=>{ if(typeof v==='object'&&v!==null){ if(seen.has(v)) return '[circular]'; seen.add(v);} if(typeof v==='function') return '[fn]'; return v; }); }
fs.writeFileSync(RESULT,'');

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'] });
  const ctx = await browser.newContext({ viewport:{width:1280,height:1100} });
  const page = await ctx.newPage();
  const errBuf = [];
  page.on('pageerror', e => errBuf.push({t:'pageerror', m:String(e.message||e).slice(0,220)}));
  page.on('console', m => { if(m.type()==='error') errBuf.push({t:'console', m:String(m.text()).slice(0,220)}); });
  page.on('response', r => { const s=r.status(); if(s>=400) errBuf.push({t:'http'+s, m:r.request().method()+' '+r.url().split('?')[0]+' -> '+s}); });
  const snap=()=>errBuf.length; const drain=s=>errBuf.slice(s).map(x=>x.t+': '+x.m);
  const results=[];

  // 登录
  await page.goto(BASE+'/#/login', {waitUntil:'networkidle'}); await sleep(1200);
  await page.fill('input[placeholder="请输入用户名"]','admin');
  await page.fill('input[placeholder="请输入密码"]','Test@123456');
  await page.click('button:has-text("登录")'); await sleep(2500);

  // seed 1 台临时设备
  let seededId=null;
  try{
    const lr=await fetch(API+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:'Test@123456'})});
    const lj=await lr.json(); const tok=lj.access_token||(lj.data&&lj.data.access_token)||'';
    if(tok){
      const dr=await fetch(API+'/api/devices',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},body:JSON.stringify({device_id:'BOX_'+Date.now(), name:'验收临时设备'})});
      const dj=await dr.json(); seededId=(dj.data&&dj.data.device_id)||(dj.data&&dj.data.id)||null;
    }
  }catch(e){ results.push({page:'#32 设备管理',button:'(seed)',effect:'seed-failed',errors:[String(e).slice(0,200)]}); }
  await sleep(800);

  await page.goto(BASE+'/#/devices', {waitUntil:'networkidle'}); await sleep(1800);
  for(const box of ['开A箱','开B箱']){
    const s=snap();
    const ok=await page.evaluate((box)=>{
      const rows=Array.from(document.querySelectorAll('.ant-table-row, tbody tr'));
      for(const row of rows){
        const SEL='button,[role=button],span.ant-btn';
        const v=e=>getComputedStyle(e).display!=='none';
        const t=e=>(e.innerText||e.getAttribute('title')||'').trim();
        const b=Array.from(row.querySelectorAll(SEL)).filter(v).find(e=>t(e)===box);
        if(b){ b.click(); return true; }
      }
      return false;
    }, box);
    await sleep(900);
    // 取消可能出现的二次确认框（绝不确认开箱）
    await page.evaluate(()=>{
      const vis=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
      const bts=Array.from(document.querySelectorAll('.ant-modal button,[role=dialog] button,.ant-popconfirm button')).filter(vis);
      const c=bts.find(b=>/取消|关闭|×|否|算了/.test(b.innerText||''));
      if(c) c.click();
    }).catch(()=>{});
    await page.keyboard.press('Escape').catch(()=>{});
    await sleep(500);
    results.push({page:'#32 设备管理', button:box, effect:ok?'clicked':'not-found', errors:drain(s)});
    await page.goto(BASE+'/#/devices',{waitUntil:'networkidle'}); await sleep(900);
  }

  // 清理
  if(seededId && typeof seededId==='number'){
    try{
      const lr=await fetch(API+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:'Test@123456'})});
      const lj=await lr.json(); const tok=lj.access_token||(lj.data&&lj.data.access_token)||'';
      await fetch(API+'/api/devices/'+seededId,{method:'DELETE',headers:{'Authorization':'Bearer '+tok}});
    }catch(e){ results.push({page:'#32 设备管理',button:'(cleanup)',effect:'cleanup-failed',errors:[String(e).slice(0,200)]}); }
  }
  await browser.close();
  let totalErr=0; for(const r of results) totalErr+=r.errors.length;
  fs.appendFileSync(RESULT, safeStr({summary:{total:results.length,withErrors:results.filter(r=>r.errors.length).length,totalErrors:totalErr}})+'\n');
  for(const r of results) fs.appendFileSync(RESULT, safeStr(r)+'\n');
  console.log('BOX VERIFY DONE total='+results.length+' errors='+totalErr);
})().catch(e=>{ console.error('FATAL', e); process.exit(1); });
