// 读取 all_buttons.jsonl，生成 all_buttons_report.html（页面×按钮 验收矩阵）
const fs = require('fs');
const path = require('path');
const OUT = 'C:/Users/53527/Desktop/自我管理提升/自我管理提升V2.0/平台开发/管理平台设计/.workbuddy/browser_test';
const RESULT = path.join(OUT, 'all_buttons.jsonl');
const HTML = path.join(OUT, 'all_buttons_report.html');

const rows = [];
for (const line of fs.readFileSync(RESULT, 'utf-8').split('\n')) {
  const l = line.trim();
  if (!l || l.includes('__DONE__')) continue;
  try { rows.push(JSON.parse(l)); } catch (e) {}
}
rows.sort((a, b) => (a.idx || 0) - (b.idx || 0));

let totalButtons = 0, errButtons = 0, safeCancelled = 0, unclickable = 0, okNoErr = 0;
const errList = [];
for (const r of rows) {
  for (const b of (r.buttons || [])) {
    totalButtons++;
    const hasErr = (b.errors || []).length > 0;
    if (hasErr) { errButtons++; errList.push({ page: r.name, idx: r.idx, button: b.button, errors: b.errors }); }
    else if (b.unclickable) unclickable++;
    else if (/cancelled|confirm/.test(b.effect || '')) safeCancelled++;
    else okNoErr++;
  }
}

function statusOf(b) {
  if ((b.errors || []).length) return { cls: 'bad', txt: '报错' };
  if (b.unclickable) return { cls: 'warn', txt: '未触发' };
  if (/cancelled|confirm/.test(b.effect || '')) return { cls: 'safe', txt: '安全取消' };
  if (b.effect === 'exception') return { cls: 'bad', txt: '异常' };
  if (b.effect === 'none') return { cls: 'ok', txt: '无副作用' };
  return { cls: 'ok', txt: '正常' };
}

let cards = '';
for (const r of rows) {
  const btns = r.buttons || [];
  const bad = btns.filter(b => (b.errors || []).length).length;
  const cardCls = bad ? 'card-bad' : 'card-ok';
  let lis = '';
  for (const b of btns) {
    const st = statusOf(b);
    const errHtml = (b.errors || []).map(e => `<div class="err">⚠ ${escapeHtml(String(e).slice(0, 160))}</div>`).join('');
    const apiHtml = (b.apiCalls || []).length ? `<span class="api">API ${b.apiCalls.map(a => a.m + ' ' + a.status).join(' / ')}</span>` : '';
    lis += `<li class="${st.cls}"><span class="bname">${escapeHtml(b.button || '(空标签)')}</span>
      <span class="tag">${(b.tag || '').toLowerCase()}</span>
      <span class="st">${st.txt}</span>
      <span class="eff">${escapeHtml(b.effect || '')}</span>
      ${apiHtml}
      ${b.note ? `<span class="note">${escapeHtml(b.note)}</span>` : ''}
      ${errHtml}</li>`;
  }
  cards += `<div class="card ${cardCls}">
    <div class="card-h"><span class="idx">#${r.idx}</span> <span class="pname">${escapeHtml(r.name)}</span>
      <span class="cnt">按钮 ${btns.length} · 报错 ${bad}</span></div>
    <ul class="blist">${lis || '<li class="muted">（无可交互按钮）</li>'}</ul>
  </div>`;
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>全按钮浏览器验收报告</title>
<style>
* { box-sizing: border-box; } body { font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; margin: 0; background: #f5f6f8; color: #1f2329; }
.header { background: #1f2329; color: #fff; padding: 20px 28px; }
.header h1 { margin: 0 0 6px; font-size: 20px; }
.sub { font-size: 12px; opacity: .8; line-height: 1.7; }
.summary { display: flex; gap: 14px; flex-wrap: wrap; padding: 18px 28px; }
.stat { background: #fff; border-radius: 10px; padding: 14px 18px; min-width: 130px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.stat .n { font-size: 26px; font-weight: 700; }
.stat .l { font-size: 12px; color: #6b7075; margin-top: 2px; }
.n.green { color: #18a058; } .n.red { color: #d03050; } .n.gray { color: #909399; } .n.blue { color: #2080d0; }
.wrap { padding: 0 28px 40px; }
.card { background: #fff; border-radius: 10px; margin-bottom: 14px; box-shadow: 0 1px 3px rgba(0,0,0,.06); overflow: hidden; }
.card-bad { border-left: 4px solid #d03050; }
.card-ok { border-left: 4px solid #18a058; }
.card-h { padding: 12px 16px; background: #fafbfc; border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 10px; }
.card-h .idx { font-weight: 700; color: #2080d0; }
.card-h .pname { font-weight: 600; }
.card-h .cnt { margin-left: auto; font-size: 12px; color: #6b7075; }
.blist { list-style: none; margin: 0; padding: 8px 16px; }
.blist li { padding: 7px 10px; border-radius: 6px; margin: 4px 0; font-size: 13px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; background: #fafbfc; }
.blist li.ok { background: #f0faf3; }
.blist li.bad { background: #fdf0f1; }
.blist li.safe { background: #f3f6fd; }
.blist li.warn { background: #fbf6e8; }
.bname { font-weight: 600; min-width: 120px; }
.tag { font-size: 11px; color: #909399; background: #eef0f2; padding: 1px 6px; border-radius: 4px; }
.st { font-weight: 600; }
.ok .st { color: #18a058; } .bad .st { color: #d03050; } .safe .st { color: #2080d0; } .warn .st { color: #caa115; }
.eff { font-size: 11px; color: #6b7075; }
.api { font-size: 11px; color: #2080d0; background: #eaf3fb; padding: 1px 6px; border-radius: 4px; }
.note { font-size: 11px; color: #909399; width: 100%; }
.err { color: #d03050; font-size: 12px; width: 100%; }
.muted { color: #909399; }
.sec { margin: 18px 0 8px; font-size: 15px; font-weight: 700; }
</style></head>
<body>
<div class="header"><h1>全按钮浏览器实跑验收报告</h1>
<div class="sub">生成时间：${new Date().toLocaleString('zh-CN')} ｜ 数据来源：click_all_buttons.js 实跑（Playwright + 系统 Chrome）｜ 登录 admin 遍历 49 页，逐按钮点击并捕获 console/page 错误<br>
安全策略：破坏性确认框（删除/清空/移除/作废）仅打开并取消，不执行破坏性操作；新增表单弹窗仅统计字段数后取消，不落库（写路径已由 run15 full22 覆盖）。</div></div>
<div class="summary">
  <div class="stat"><div class="n blue">${rows.length}</div><div class="l">页面数</div></div>
  <div class="stat"><div class="n">${totalButtons}</div><div class="l">测试按钮数（去重）</div></div>
  <div class="stat"><div class="n green">${okNoErr + safeCancelled}</div><div class="l">正常 / 安全取消</div></div>
  <div class="stat"><div class="n gray">${safeCancelled}</div><div class="l">安全取消（破坏性/表单）</div></div>
  <div class="stat"><div class="n red">${errButtons}</div><div class="l">触发错误按钮</div></div>
  <div class="stat"><div class="n gray">${unclickable}</div><div class="l">未触发（动态消失）</div></div>
</div>
<div class="wrap">
${errList.length ? `<div class="sec">⚠ 报错按钮明细（${errList.length}）</div>` + cardsWithErr(errList) : ''}
<div class="sec">全页面按钮矩阵</div>
${cards}
</div></body></html>`;

function cardsWithErr(list) {
  let h = '<ul class="blist" style="background:#fff;border-radius:10px;padding:12px 18px;box-shadow:0 1px 3px rgba(0,0,0,.06)">';
  for (const e of list) {
    h += `<li class="bad"><span class="bname">${escapeHtml(e.button)}</span><span class="note">页面：${escapeHtml(e.page)} (#${e.idx})</span>`;
    for (const er of e.errors) h += `<div class="err">⚠ ${escapeHtml(String(er).slice(0, 160))}</div>`;
    h += `</li>`;
  }
  return h + '</ul>';
}

fs.writeFileSync(HTML, html, 'utf-8');
console.log(`report written: ${HTML}`);
console.log(`pages=${rows.length} buttons=${totalButtons} err=${errButtons} safeCancelled=${safeCancelled} unclickable=${unclickable}`);
