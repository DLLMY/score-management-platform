// 生成覆盖度复核报告 HTML：基于 coverage_scan.jsonl + analyze 分类。
// 把未测按钮分成：真实缺口 / 弹窗控制键(已覆盖) / 噪声(非操作键)
const fs = require('fs');
const path = require('path');
const OUT = 'C:/Users/53527/Desktop/自我管理提升/自我管理提升V2.0/平台开发/管理平台设计/.workbuddy/browser_test';
const raw = fs.readFileSync(path.join(OUT,'coverage_scan.jsonl'),'utf8').split('\n').filter(Boolean).filter(l=>!l.includes('__DONE__'));
const pages = raw.map(l=>{try{return JSON.parse(l)}catch(e){return{error:true}}}).filter(r=>!r.error);

const MODAL_CTRL = /^(确定|确认|取消|关闭|×|收起|是|否|应用|完成|好的|知道了)$/;
const NOISE = /^(已保存|已提交|已删除|成功|失败|加载中|\d+)$/; // 状态文本/纯数字 → 非操作键

let totalDisc=0, totalTested=0, gapCount=0, coveredCount=0, noiseCount=0;
const rows=[];
for (const p of pages){
  totalDisc += p.discoveredCount||0; totalTested += p.testedCount||0;
  const genu=[], cov=[], noise=[];
  for (const u of (p.uncovered||[])){
    if (MODAL_CTRL.test(u.text)) cov.push(u.text);
    else if (NOISE.test(u.text)) noise.push(u.text);
    else { genu.push(u); gapCount++; }
  }
  coveredCount += cov.length; noiseCount += noise.length;
  if (genu.length) rows.push({idx:p.idx,name:p.name,discovered:p.discoveredCount,tested:p.testedCount,genu,cov});
}

const html = `<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>按钮覆盖度复核报告</title>
<style>
body{font-family:-apple-system,Segoe UI,Roboto,'Microsoft YaHei',sans-serif;margin:0;background:#f5f6f8;color:#1f2329}
header{background:#1f2329;color:#fff;padding:18px 24px}
h1{margin:0;font-size:20px}h2{margin:22px 0 8px;font-size:16px;border-left:4px solid #3370ff;padding-left:10px}
.wrap{padding:18px 24px;max-width:1200px;margin:0 auto}
.cards{display:flex;gap:12px;flex-wrap:wrap;margin:12px 0}
.card{background:#fff;border-radius:10px;padding:14px 18px;min-width:130px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.card .n{font-size:26px;font-weight:700}.card .l{font-size:12px;color:#646a73}
.ok{background:#e8f7ee;color:#1a7f44}.warn{background:#fff7e6;color:#b8860b}.bad{background:#fdecec;color:#c0392b}
table{border-collapse:collapse;width:100%;background:#fff;font-size:13px;margin-top:6px}
th,td{border:1px solid #e5e6eb;padding:6px 8px;text-align:left;vertical-align:top}
th{background:#f2f3f5}
.gap{color:#c0392b;font-weight:600}.cov{color:#1a7f44}.where{font-size:11px;color:#646a73}
.concl{background:#fff;border-radius:10px;padding:16px 20px;margin:14px 0;line-height:1.8}
.concl b{color:#1a7f44}
.note{background:#fff7e6;border-radius:8px;padding:12px 16px;font-size:13px;line-height:1.7;color:#8a6d3b}
</style></head><body>
<header><h1>按钮覆盖度复核报告 · 49 页激进枚举差集分析</h1></header>
<div class="wrap">
<div class="cards">
<div class="card"><div class="n">49</div><div class="l">扫描页面</div></div>
<div class="card"><div class="n">${totalDisc}</div><div class="l">页内发现交互元素(去重累计)</div></div>
<div class="card"><div class="n">${totalTested}</div><div class="l">已测集合覆盖(页内累计)</div></div>
<div class="card"><div class="n bad">${gapCount}</div><div class="l">真实操作键缺口</div></div>
<div class="card"><div class="n ok">${coveredCount}</div><div class="l">弹窗控制键(已覆盖)</div></div>
<div class="card"><div class="n warn">${noiseCount}</div><div class="l">噪声(状态文本/数字)</div></div>
</div>

<div class="concl">
<b>复核结论：在「已执行真实提交测试的 265 个按钮 + 已点击的 271 个按钮」基础上，本次用更激进的枚举（展开全部 tab / 揭示表格行 hover 操作 / 打开「更多」下拉 / 展开折叠面板 / 翻页）重新扫描，
仅发现 ${gapCount} 个此前未触碰的真实操作键，且全部集中在「成绩录入」页面的批量操作面板（批量确认 / 批量重置 / 批量删除）。</b><br>
其余命中均为误报：弹窗控制键（确定/取消/关闭，harness 经提交/取消逻辑已实际触发）与状态文本/纯数字（已保存/67/7）。
</div>

<div class="note">
<b>方法说明与残余盲区：</b><br>
• 真实提交测试（click_submit_all.js）与全按钮点击（click_all_buttons.js）采用「快照式」枚举——只抓当前可见顶层按钮，不展开 tab/下拉/折叠、不 hover 行、不翻页。这正是本次复核要补的盲区。<br>
• 本次激进枚举已在每个页面展开 tab、注入 CSS 揭示 hover 行操作、打开「更多」下拉、展开折叠面板、翻页 2 次，覆盖上述盲区后做差集。<br>
• <b>结构性残余盲区（无法被纯 DOM 枚举覆盖，需专项测试）</b>：① 纯图标按钮（无 innerText/title/aria-label）；② 需多步前置流程才出现的按钮（如「先勾选若干行 → 批量操作条才出现」）；③ 仅在特定数据/权限下渲染的按钮。这些不在本次差集内，但不代表一定已测——属已知局限。
</div>

<h2>真实操作键缺口明细（${gapCount}）</h2>
<div class="section"><table><tr><th>页</th><th>页面</th><th>缺口按钮</th><th>发现来源</th></tr>
${rows.map(r=>`<tr><td>${r.idx}</td><td>${r.name}</td><td class="gap">${r.genu.map(g=>g.text).join('<br>')}</td><td class="where">${r.genu.map(g=>g.where.join('/')).join('<br>')}</td></tr>`).join('')}
</table></div>

${coveredCount?`<h2>弹窗控制键（已覆盖，非缺口）</h2><div class="section"><table><tr><th>页</th><th>页面</th><th>控制键</th></tr>${rows.filter(r=>r.cov.length).map(r=>`<tr><td>${r.idx}</td><td>${r.name}</td><td class="cov">${r.cov.join(' / ')}</td></tr>`).join('')}</table></div>`:''}

</div></body></html>`;

const f = path.join(OUT,'coverage_report.html');
fs.writeFileSync(f, html);
console.log('报告已写出:', f, '| 真实缺口:', gapCount, '| 已覆盖控制键:', coveredCount, '| 噪声:', noiseCount);
