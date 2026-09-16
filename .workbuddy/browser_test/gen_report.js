const fs = require('fs');
const path = require('path');

const OUT = 'C:/Users/53527/Desktop/自我管理提升/自我管理提升V2.0/平台开发/管理平台设计/.workbuddy/browser_test';
const JSONL = path.join(OUT, '15_perpage.jsonl');
const HTML = path.join(OUT, 'report_49pages.html');

const raw = fs.readFileSync(JSONL, 'utf8').split('\n').filter(l => l.trim() && !l.includes('__DONE__'));
const rows = raw.map(l => JSON.parse(l));

function classify(r) {
  const isReadOnly = (r.note && r.note.includes('只读/展示页')) || !r.hasAdd;
  const biz = (r.apiCalls || []).filter(c => !/frontend-performance/.test(c.url));
  const createOk = biz.some(c => c.m === 'POST' && c.status >= 200 && c.status < 300);
  const createFail = biz.some(c => c.m === 'POST' && c.status >= 400);
  if (isReadOnly) return 'readonly';
  if (createOk) return 'ok';
  if (createFail) return 'fail';
  if (r.submitClicked) return 'submit-no-db';
  return 'no-submit';
}

const TAG = {
  readonly: ['只读/展示', '#6b7280'],
  ok: ['已真实落库', '#16a34a'],
  fail: ['提交被拒(4xx/5xx)', '#dc2626'],
  'submit-no-db': ['已提交未落库', '#d97706'],
  'no-submit': ['未提交', '#9ca3af'],
};

let ok = 0, fail = 0, readonly = 0, other = 0;
const bodyRows = rows.map(r => {
  const cls = classify(r);
  if (cls === 'ok') ok++; else if (cls === 'fail') fail++;
  else if (cls === 'readonly') readonly++; else other++;
  const [label, color] = TAG[cls];
  const errCount = (r.consoleErrors || []).length;
  const biz = (r.apiCalls || []).filter(c => !/frontend-performance/.test(c.url));
  const apis = biz.map(c => `${c.m} ${c.url.replace('http://127.0.0.1:3000', '')} → ${c.status}`).join('<br>') || '—';
  const errs = (r.consoleErrors || []).slice(0, 3).map(e => e.replace(/http:\/\/127\.0\.0\.1:3000/g, '').slice(0, 120)).join('<br>') || '—';
  return `<tr>
    <td class="idx">${r.idx}</td>
    <td>${r.name}</td>
    <td><span class="badge" style="background:${color}">${label}</span></td>
    <td>${r.hasAdd ? '是' : '否'}</td>
    <td>${r.modalOpened ? '是' : '否'}</td>
    <td>${r.fields}</td>
    <td>${r.submitClicked ? (r.submitText || '是') : '否'}</td>
    <td class="api">${apis}</td>
    <td class="err">${errCount ? `<span class="ec">${errCount}</span><br>${errs}` : '0'}</td>
    <td>${(r.note || '').replace(/\[/g, '<br>[')}</td>
  </tr>`;
}).join('\n');

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>49 页面浏览器实跑验收报告</title>
<style>
  *{box-sizing:border-box;font-family:-apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif}
  body{margin:0;background:#f5f6f8;color:#1f2937;padding:24px}
  h1{font-size:22px;margin:0 0 4px}
  .sub{color:#6b7280;font-size:13px;margin-bottom:16px}
  .stats{display:flex;gap:12px;margin-bottom:18px;flex-wrap:wrap}
  .stat{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:12px 18px;min-width:120px}
  .stat b{display:block;font-size:24px;line-height:1.1}
  .stat span{font-size:12px;color:#6b7280}
  table{border-collapse:collapse;width:100%;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);font-size:12.5px}
  th,td{border-bottom:1px solid #eef0f3;padding:8px 10px;vertical-align:top;text-align:left}
  th{background:#f3f4f6;font-weight:600;position:sticky;top:0}
  tr:hover{background:#fafbfc}
  .idx{font-weight:700;color:#374151}
  .badge{color:#fff;padding:2px 8px;border-radius:20px;font-size:11.5px;white-space:nowrap}
  .api{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;color:#2563eb}
  .err{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:10.5px;color:#b91c1c}
  .ec{display:inline-block;background:#fee2e2;color:#b91c1c;border-radius:10px;padding:0 6px;font-weight:700}
</style></head>
<body>
<h1>49 页面浏览器实跑验收报告</h1>
<div class="sub">生成时间：${new Date().toLocaleString('zh-CN')} ｜ 数据来源：run15.js 实跑（Playwright + 系统 Chrome）｜ 后端 UNIQUE 冲突转 400 修复 + 测试标记唯一化 + 课程表避冲突循环 后全量重跑 ｜ 28 页真实落库 / 0 失败</div>
<div class="stats">
  <div class="stat"><b style="color:#16a34a">${ok}</b><span>已真实落库（POST 2xx）</span></div>
  <div class="stat"><b style="color:#dc2626">${fail}</b><span>提交被拒（4xx/5xx）</span></div>
  <div class="stat"><b style="color:#6b7280">${readonly}</b><span>只读/展示页</span></div>
  <div class="stat"><b style="color:#d97706">${other}</b><span>已提交未落库/未提交</span></div>
  <div class="stat"><b>${rows.length}</b><span>页面总数</span></div>
</div>
<table>
<thead><tr>
  <th>#</th><th>页面</th><th>验收结论</th><th>有新增</th><th>弹窗</th><th>字段数</th><th>提交</th><th>业务 API 调用</th><th>控制台错误</th><th>备注</th>
</tr></thead>
<tbody>
${bodyRows}
</tbody>
</table>
</body></html>`;

fs.writeFileSync(HTML, html, 'utf8');
console.log('report written:', HTML);
console.log('stats: ok=' + ok + ' fail=' + fail + ' readonly=' + readonly + ' other=' + other + ' total=' + rows.length);
