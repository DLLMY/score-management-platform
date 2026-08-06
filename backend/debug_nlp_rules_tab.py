"""打开浏览器到 NLP 规则管理 tab，捕获 console + 网络请求"""
import sys
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:3000"
USER = "admin"
PWD  = "123456"

console_msgs = []
net_requests = []
net_responses = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context()
    page = ctx.new_page()
    page.on("console", lambda m: console_msgs.append(f"[{m.type}] {m.text}"))
    page.on("request", lambda r: net_requests.append(f"{r.method} {r.url}"))
    page.on("response", lambda r: net_responses.append(f"{r.status} {r.url}"))

    # 1) 登录
    page.goto(f"{BASE}/login", wait_until="networkidle", timeout=30000)
    # 找登录表单
    try:
        page.fill('input[type="text"], input[name="username"]', USER, timeout=5000)
        page.fill('input[type="password"]', PWD, timeout=5000)
        page.click('button:has-text("登录")', timeout=5000)
    except Exception as e:
        # 试 placeholder
        try:
            page.fill('input[placeholder*="账号"]', USER)
            page.fill('input[placeholder*="密码"]', PWD)
            page.click('button[type="submit"]')
        except Exception as e2:
            print("LOGIN_FAIL:", e, e2)
    page.wait_for_load_state("networkidle", timeout=15000)

    # 2) 跳到 NLP 规则管理
    page.goto(f"{BASE}/nlp-management", wait_until="networkidle", timeout=30000)
    # 点击 "规则管理" tab
    try:
        page.click('text=规则管理', timeout=8000)
    except Exception as e:
        print("TAB_CLICK_FAIL:", e)
    page.wait_for_timeout(3000)

    # 截图
    page.screenshot(path="nlp_rules_tab.png", full_page=True)

    # 抓表格内容
    try:
        rows = page.locator("table tbody tr").count()
        print("TABLE_ROW_COUNT:", rows)
    except Exception as e:
        print("ROW_COUNT_ERR:", e)

    browser.close()

print("\n=== CONSOLE ===")
for m in console_msgs[-30:]:
    print(m)
print("\n=== NETWORK REQUESTS (only /api/nlp/ and /api/rules) ===")
for r in [r for r in net_requests if "/api/nlp/" in r or "/api/rules" in r][-25:]:
    print(r)
print("\n=== NETWORK RESPONSES (only /api/nlp/rules and /api/rules) ===")
for r in [r for r in net_responses if "/api/nlp/rules" in r or "/api/rules?" in r][-15:]:
    print(r)
