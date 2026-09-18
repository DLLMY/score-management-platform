// 覆盖度差集分析：把 scan_coverage 的「发现集合」与「已测集合」做差，
// 并把未测按钮分成两类：
//   A. 弹窗控制键（确定/取消/关闭/是/否…）—— harness 经 submit/dismiss 实际已触发，非真实缺口
//   B. 真实操作键（CRUD/筛选/导出/行操作…）—— 此前 harness 快照式枚举未触碰，属真实覆盖缺口
const fs = require('fs');
const path = require('path');
const OUT = 'C:/Users/53527/Desktop/自我管理提升/自我管理提升V2.0/平台开发/管理平台设计/.workbuddy/browser_test';

const MODAL_CTRL = /^(确定|确认|确定并?关闭?|取消|关闭|×|收起|是|否|应用|完成|ok|OK|好的|知道了|知道了)$/;
// 这些虽然也可能是弹窗主按钮，但属于「真正的操作」，若未被覆盖仍算缺口
const realOps = [];
const modalCtrl = [];
const perPage = [];
let parsed = 0, totalDiscovered = 0, totalTested = 0, genuine = 0, modalOnly = 0;

const raw = fs.readFileSync(path.join(OUT,'coverage_scan.jsonl'),'utf8').split('\n').filter(Boolean).filter(l=>!l.includes('__DONE__'));
for (const l of raw){
  let r; try{ r=JSON.parse(l); }catch(e){ continue; }
  if (r.error){ perPage.push({idx:r.idx,name:r.name,error:r.error}); continue; }
  parsed++;
  totalDiscovered += r.discoveredCount||0;
  totalTested += r.testedCount||0;
  const genu=[]; const mc=[];
  for (const u of (r.uncovered||[])){
    if (MODAL_CTRL.test(u.text)) mc.push(u);
    else genu.push(u);
  }
  genuine += genu.length; modalOnly += mc.length;
  if (genu.length || mc.length){
    perPage.push({idx:r.idx,name:r.name,discovered:r.discoveredCount,tested:r.testedCount,
      genuine:genu, modalCtrl:mc.map(m=>m.text)});
  }
}

console.log('=== 覆盖度复核摘要 ===');
console.log('扫描页面:', parsed, '| 总发现交互元素(去重/页内):', totalDiscovered, '| 已测集合覆盖:', totalTested);
console.log('差集未测命中:', genuine+modalOnly, '( 真实操作键缺口:', genuine, ' + 弹窗控制键已覆盖:', modalOnly, ' )');
console.log('\n=== 各页真实操作键缺口 ===');
for (const p of perPage){
  if (p.error){ console.log(`  [${p.idx}] ${p.name}: 扫描异常 ${p.error}`); continue; }
  if (!p.genuine.length) continue;
  console.log(`\n  [${p.idx}] ${p.name}  (发现${p.discovered}/已测${p.tested})`);
  for (const g of p.genuine){
    console.log(`     - "${g.text}"  [来源: ${g.where.join(',')}]`);
  }
  if (p.modalCtrl.length) console.log(`     （弹窗控制键已覆盖: ${p.modalCtrl.join('/')}）`);
}

// 输出精简 JSON 供报告生成
const out = {parsed, totalDiscovered, totalTested, genuine, modalOnly, perPage: perPage.filter(p=>p.genuine&&p.genuine.length)};
fs.writeFileSync(path.join(OUT,'coverage_summary.json'), JSON.stringify(out,null,2));
console.log('\n已写出 coverage_summary.json');
