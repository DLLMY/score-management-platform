# -*- coding: utf-8 -*-
"""
前后端接口契约测试（防命名/路径漂移）。

后端路由以 Flask 应用真实注册结果（app.url_map）为权威源；
前端调用以 apps/frontend/src/services/api.ts 中的 request(path, {method}) /
fetch(...) 提取为准。两者经归一化（路径参数 :id / ${id} 统一为 :p，忽略参数
命名差异，剔除查询串）后做「模板匹配 + 无参基路径匹配」。

断言：前端每一个 /api 调用都能在后端找到匹配的方法 + 路径。
若新增功能时前端默认路径与后端 namespace 漂移（如 exam-import 类问题），
本测试会直接失败并列出孤儿调用，防止缺陷合入主干。
"""
import os
import re
import sys

import pytest

# ----------------------------------------------------------------------------
# 归一化工具（与三层审计 analyze.py 保持一致）
# ----------------------------------------------------------------------------
def norm_path(p):
    p = (p or "").strip().split("?")[0]
    p = re.sub(r"<([^>]+?)>", lambda m: ":" + m.group(1).split(":")[-1], p)
    p = re.sub(r"\$\{[^}]*", "/:param", p)
    p = re.sub(r"(\w):param", r"\1/:param", p)
    p = re.sub(r"//+", "/", p)
    p = p.rstrip("/")
    if not p.startswith("/"):
        p = "/" + p
    return p


def norm_template(p):
    p = norm_path(p)
    p = re.sub(r":\w+", ":p", p)
    return p


def base_path(p):
    p = (p or "").split("?")[0]
    p = re.sub(r"<[^>]+?>", "", p)   # Flask 转换器 <int:id> / <string:name>
    p = re.sub(r"/:[^/]+", "", p)    # 归一化后的 :p 段
    p = p.rstrip("/")
    return p or "/"


# ----------------------------------------------------------------------------
# 前端调用提取（复用审计逻辑，仅适配为接受文件路径）
# ----------------------------------------------------------------------------
def _extract_call_text(src, start):
    i = src.find("(", start)
    if i == -1:
        return ""
    depth = 0
    j = i
    n = len(src)
    while j < n:
        c = src[j]
        if c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth == 0:
                return src[i + 1:j]
        elif c in ("'", '"', "`"):
            q = c
            j += 1
            while j < n and src[j] != q:
                if src[j] == "\\":
                    j += 1
                j += 1
        j += 1
    return src[i + 1:]


def extract_frontend_calls(api_ts_path):
    src = open(api_ts_path, encoding="utf-8").read()
    lines = src.split("\n")
    root_idx = -1
    mroot = re.search(r"const api\b.*?=\{", src)
    if mroot:
        root_idx = src[:mroot.start()].count("\n")
    service_re = re.compile(r"^  (\w+):\s*\{")
    method_re = re.compile(r"^\s{4,}(\w+):\s*(?:async\s*)?\(")
    svc_at = []
    meth_at = []
    for i, line in enumerate(lines):
        if i < root_idx:
            continue
        ms = service_re.match(line)
        if ms:
            svc_at.append((i, ms.group(1)))
        mm = method_re.match(line)
        if mm:
            meth_at.append((i, mm.group(1)))

    def nearest(lst, idx):
        cur = None
        for pos, name in lst:
            if pos <= idx:
                cur = name
            else:
                break
        return cur

    calls = []
    for m in re.finditer(r"(request|fetch)\(", src):
        start = m.start()
        line_idx = src[:start].count("\n")
        calltext = _extract_call_text(src, start)
        um = re.search(r"(['\"`])((?:\\.|(?!\1).)*?)\1", calltext)
        if not um:
            continue
        url = um.group(2)
        api_match = re.search(r"/api/.+", url)
        if not api_match:
            continue
        raw = api_match.group(0)
        raw = raw.split("`")[0]
        raw = re.split(r"\$\{[A-Za-z_]\w*\s*\?", raw)[0]
        raw = re.split(r"\$\{[^}]*`[^}]*\}", raw)[0]
        raw = re.split(r"\$\{[^}]*[\?'\"+.(][^}]*\}", raw)[0]
        raw = raw.split("?")[0]
        mmeth = re.search(r"method:\s*['\"](get|post|put|delete|patch)['\"]", calltext, re.I)
        verb = mmeth.group(1).lower() if mmeth else "get"
        verb_inline = bool(mmeth)

        pre_base = re.sub(r"\$\{[^}]*\}", "", raw)
        base_clean = re.sub(r"[^/:\w-]", "", pre_base)
        base_clean = re.sub(r":\w+", "", base_clean).rstrip("/")
        base_clean = re.sub(r"/+", "/", base_clean).rstrip("/")

        pre_param = re.sub(r"\$\{([A-Za-z_]\w*)\}", "/:param", raw)
        pre_param = re.sub(r"\$\{[^}]*\}", "", pre_param)
        param_clean = re.sub(r"[^/:\w-]", "", pre_param).rstrip("/")

        calls.append({
            "service": nearest(svc_at, line_idx),
            "method": nearest(meth_at, line_idx),
            "verb": verb,
            "verb_inline": verb_inline,
            "url": param_clean,
            "tmpl": norm_template(param_clean),
            "base": base_clean,
        })
    dedup = {}
    for c in calls:
        k = (c["service"], c["method"], c["verb"], c["tmpl"])
        dedup.setdefault(k, c)
    return list(dedup.values())


# ----------------------------------------------------------------------------
# 匹配判定
# ----------------------------------------------------------------------------
def call_matches_backend(c, be_index, be_base_index):
    """判断前端调用是否能在后端找到匹配路由。

    - verb_inline=True：method 内联可达（如 request(path, {method:'POST'})），
      严格动词匹配（模板匹配 + 无参基路径匹配，任一命中即可）。
    - verb_inline=False：method 外部化（如 fetch(url, fetchOptions) 走 fetchOptions
      传递 method），静态分析无法确定动词，退化为「路径存在任一方法即判命中」，
      避免把真实存在的端点误报为孤儿（如 /api/admins/refresh-token 仅注册 POST）。
    """
    tmpl = c["tmpl"]
    base = c["base"]
    verb = (c.get("verb") or "get").upper()
    if c.get("verb_inline"):
        return (tmpl in be_index and verb in be_index[tmpl]) or \
               (base in be_base_index and verb in be_base_index[base])
    # method 外部化：仅要求路径存在（任一方法）
    return tmpl in be_index or base in be_base_index


# ----------------------------------------------------------------------------
# 测试
# ----------------------------------------------------------------------------
_FRONTEND_TS = os.path.normpath(os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..",
    "frontend", "src", "services", "api.ts"))


@pytest.fixture(scope="module")
def backend_routes():
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from app import create_app
    app = create_app()
    be_index = {}
    be_base_index = {}
    with app.app_context():
        for rule in app.url_map.iter_rules():
            methods = sorted(m for m in rule.methods if m not in ("HEAD", "OPTIONS"))
            if not methods:
                continue
            tmpl = norm_template(rule.rule)
            base = base_path(rule.rule)
            be_index.setdefault(tmpl, set()).update(methods)
            be_base_index.setdefault(base, set()).update(methods)
    return be_index, be_base_index


def test_frontend_calls_have_backend_routes(backend_routes):
    be_index, be_base_index = backend_routes
    assert os.path.exists(_FRONTEND_TS), f"未找到前端 api.ts: {_FRONTEND_TS}"
    calls = extract_frontend_calls(_FRONTEND_TS)

    orphans = []
    for c in calls:
        if not call_matches_backend(c, be_index, be_base_index):
            orphans.append(c)

    assert not orphans, (
        f"发现 {len(orphans)} 个前端孤儿调用（前端调用了后端不存在的端点）：\n"
        + "\n".join(
            f"  {o['service']}.{o['method']}  {o['verb'].upper()} {o['url']}"
            for o in orphans
        )
        + "\n请核对后端 namespace / 路由是否已注册对应方法，"
          "或为前端调用指向正确端点（如成绩导入应指向 /api/exam-import/execute）。"
    )


def test_no_exams_import_orphan(backend_routes):
    """回归守卫：exams.import 默认端点必须真实存在（曾经指向不存在的 /api/exams/import）。"""
    be_index, be_base_index = backend_routes
    calls = extract_frontend_calls(_FRONTEND_TS)
    ex_import = [c for c in calls if c["service"] == "exams" and c["method"] == "import"]
    assert ex_import, "未找到 exams.import 调用定义"
    c = ex_import[0]
    assert call_matches_backend(c, be_index, be_base_index), \
        f"exams.import 默认端点 {c['url']} 在后端无匹配路由，请修正默认 URL。"


if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from app import create_app
    app = create_app()
    be_index, be_base_index = {}, {}
    with app.app_context():
        for rule in app.url_map.iter_rules():
            methods = sorted(m for m in rule.methods if m not in ("HEAD", "OPTIONS"))
            if not methods:
                continue
            be_index.setdefault(norm_template(rule.rule), set()).update(methods)
            be_base_index.setdefault(base_path(rule.rule), set()).update(methods)
    cs = extract_frontend_calls(_FRONTEND_TS)
    orph = [c for c in cs if not call_matches_backend(c, be_index, be_base_index)]
    print("前端调用:", len(cs), "孤儿:", len(orph))
    for o in orph:
        print("  ORPHAN", o["service"], o["method"], o["verb"].upper(), o["url"],
              "(method 外部化)" if not o.get("verb_inline") else "")
