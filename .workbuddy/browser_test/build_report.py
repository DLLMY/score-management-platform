import json, os, base64, html

BASE = r"C:\Users\53527\Desktop\自我管理提升\自我管理提升V2.0\平台开发\管理平台设计"
BT = os.path.join(BASE, ".workbuddy", "browser_test")
SHOTS = os.path.join(BT, "shots")
JL = os.path.join(BT, "14_perpage.jsonl")
REPORT_MD = os.path.join(BASE, "docs", "reports", "分页面浏览器验收报告-20260915.md")
REPORT_HTML = os.path.join(BT, "分页面验收报告.html")

rows = []
for line in open(JL, encoding="utf-8"):
    line = line.strip()
    if not line or line.startswith("__"):
        continue
    rows.append(json.loads(line))

def classify(r):
    err = len(r.get("pageErrors", [])) + len(r.get("consoleErrors", []))
    apis = r.get("apiCalls") or []
    biz = [a for a in apis if "/system/frontend-performance" not in a["url"]]
    db = r.get("db") or []
    if err > 0:
        render = f"⚠️ 控制台错误 {err} 条"
    else:
        render = "✅ 渲染正常"
    # 提交分类
    if not r["hasAdd"]:
        submit = "— 只读/展示页"
    elif not r["addBtnFound"]:
        submit = "ℹ️ 无新增按钮(需上下文/特殊形态)"
    elif not r["modalOpened"]:
        submit = "ℹ️ 点击新增未出表单(整页表单/需先选班级)"
    elif db:
        submit = "✅ 真实落库 " + ", ".join(db)
    elif any(a["status"] == 201 for a in biz):
        submit = "✅ 创建成功(201)"
    elif any(a["status"] == 500 for a in biz):
        submit = "❌ 服务端错误(500)"
    elif any(a["status"] == 400 for a in biz):
        submit = "⚠️ 后端校验拦截(400)-提交链路正常"
    elif biz:
        submit = f"⚠️ 业务API {biz[0]['status']}"
    elif r["submitClicked"]:
        submit = "⚠️ 提交触发但无业务API(前端校验拦截/按钮未匹配)"
    else:
        submit = "⚠️ 未触发提交"
    return render, submit

# ---- Markdown ----
md = ["# 分页面浏览器实跑验收报告（更新版）", "", f"> 生成时间：2026-09-15（二轮·修复提交点击与重复key后）｜ 后端 127.0.0.1:5000 ｜ 前端 127.0.0.1:3000 ｜ 账号 admin ｜ 浏览器：系统 Chrome + playwright-core", "",
      "## 一、汇总（49 页）", "",
      "| # | 路由 | 页面 | 渲染 | 新增流 | 提交/落库结果 |",
      "|---|------|------|------|------|------|"]
for r in rows:
    render, submit = classify(r)
    md.append(f"| {r['idx']:02d} | {r['hash']} | {r['name']} | {render} | {'有' if r['addBtnFound'] else '无'} | {submit} |")
md.append("")
md.append("## 二、按页面详情")
md.append("")
for r in rows:
    render, submit = classify(r)
    slug = r["hash"].replace("#/", "").replace("/", "_")
    page_img = f"shots/{r['idx']:02d}_{slug}.jpeg"
    form_img = f"shots/{r['idx']:02d}_{slug}_form.jpeg"
    md.append(f"### {r['idx']:02d}. {r['name']}（`{r['hash']}`）")
    md.append(f"- 渲染：{render}（pageerror {len(r['pageErrors'])} / console {len(r['consoleErrors'])}）")
    md.append(f"- 新增按钮：{r['addBtnText'] or '—'} ｜ 弹窗字段数：{r['fields']} ｜ 提交点击：{r['submitClicked']}")
    if r.get("consoleErrors"):
        md.append(f"- 控制台错误：{r['consoleErrors'][0][:120]}")
    if r.get("apiCalls"):
        apis = [f"{a['m']} {a['url'].split('/api')[-1]} → {a['status']}" for a in r["apiCalls"] if "/system/frontend-performance" not in a["url"]]
        if apis:
            md.append(f"- 提交API：{'；'.join(apis)}")
    md.append(f"- 结论：{submit}")
    md.append(f"- 截图：页面 `shots/{r['idx']:02d}_{slug}.jpeg`" + (f" ｜ 表单 `shots/{r['idx']:02d}_{slug}_form.jpeg`" if os.path.isfile(os.path.join(SHOTS, form_img)) else ""))
    md.append("")

with open(REPORT_MD, "w", encoding="utf-8") as f:
    f.write("\n".join(md))
print("MD written:", REPORT_MD, os.path.getsize(REPORT_MD))

# ---- HTML (内嵌截图) ----
def img_b64(path):
    if not os.path.isfile(path):
        return ""
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()

cards = []
for r in rows:
    render, submit = classify(r)
    slug = r["hash"].replace("#/", "").replace("/", "_")
    p = img_b64(os.path.join(SHOTS, f"{r['idx']:02d}_{slug}.jpeg"))
    fm = img_b64(os.path.join(SHOTS, f"{r['idx']:02d}_{slug}_form.jpeg"))
    apis = [f"{a['m']} {a['url'].split('/api')[-1]} → {a['status']}" for a in r.get("apiCalls", []) if "/system/frontend-performance" not in a["url"]]
    cls = "ok" if submit.startswith("✅") else ("err" if "❌" in submit else "warn")
    card = f"""<div class="card {cls}">
<h3>{r['idx']:02d}. {html.escape(r['name'])} <span class="hash">{html.escape(r['hash'])}</span></h3>
<div class="verdict">{html.escape(submit)}</div>
<div class="meta">渲染: {html.escape(render)} ｜ 字段: {r['fields']} ｜ 提交: {r['submitClicked']}</div>
{('<img src="data:image/jpeg;base64,'+p+'" alt="page"/>') if p else ''}
{('<div class="formlabel">表单截图</div><img src="data:image/jpeg;base64,'+fm+'" alt="form"/>') if fm else ''}
{('<div class="apis">API: '+'；'.join(html.escape(a) for a in apis)+'</div>') if apis else ''}
</div>"""
    cards.append(card)

summary_rows = "".join(
    f"<tr class='{('ok' if classify(r)[1].startswith('✅') else 'err' if '❌' in classify(r)[1] else 'warn')}'><td>{r['idx']:02d}</td><td>{html.escape(r['name'])}</td><td>{html.escape(classify(r)[1])}</td></tr>"
    for r in rows
)

html_doc = f"""<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><title>分页面浏览器验收报告</title>
<style>
body{{font-family:-apple-system,Segoe UI,'Microsoft YaHei',sans-serif;margin:0;background:#f5f6f8;color:#222}}
header{{background:#1f2937;color:#fff;padding:16px 24px}}
header h1{{margin:0;font-size:18px}}
header p{{margin:4px 0 0;color:#9ca3af;font-size:12px}}
.summary{{margin:16px 24px}}
table{{border-collapse:collapse;width:100%;font-size:13px;background:#fff}}
th,td{{border:1px solid #e5e7eb;padding:6px 8px;text-align:left}}
tr.ok td{{background:#ecfdf5}} tr.err td{{background:#fef2f2}} tr.warn td{{background:#fffbeb}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:16px;padding:16px 24px}}
.card{{background:#fff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)}}
.card.ok{{border-left:4px solid #10b981}} .card.err{{border-left:4px solid #ef4444}} .card.warn{{border-left:4px solid #f59e0b}}
.card h3{{margin:0;padding:10px 12px;font-size:14px;background:#f9fafb;border-bottom:1px solid #eee}}
.hash{{font-weight:normal;color:#9ca3af;font-size:11px}}
.verdict{{padding:8px 12px;font-size:13px;font-weight:600}}
.meta{{padding:0 12px 8px;font-size:11px;color:#6b7280}}
.card img{{width:100%;display:block;border-top:1px solid #eee}}
.formlabel{{padding:6px 12px 0;font-size:11px;color:#9ca3af}}
.apis{{padding:8px 12px;font-size:11px;color:#374151;background:#f9fafb;border-top:1px solid #eee}}
</style></head>
<body>
<header><h1>分页面浏览器实跑验收报告</h1><p>2026-09-15 ｜ 后端 127.0.0.1:5000 ｜ 前端 127.0.0.1:3000 ｜ admin ｜ 系统 Chrome + playwright-core ｜ 49 个路由全量遍历</p></header>
<div class="summary"><table><thead><tr><th>#</th><th>页面</th><th>提交/落库结论</th></tr></thead><tbody>{summary_rows}</tbody></table></div>
<div class="grid">{''.join(cards)}</div>
</body></html>"""
with open(REPORT_HTML, "w", encoding="utf-8") as f:
    f.write(html_doc)
print("HTML written:", REPORT_HTML, os.path.getsize(REPORT_HTML))
