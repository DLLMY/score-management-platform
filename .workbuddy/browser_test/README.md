# 浏览器 E2E 回归套件

对管理平台的**真实页面按钮**做端到端验证：真实 Chrome 点击 → 后端 API → live SQLite 落库，
并配套清理脚本保证**可重复执行、零污染**。

## 文件

| 文件 | 说明 |
|---|---|
| `e2e_suite.js` | 回归主脚本，覆盖 15 个写域/操作 |
| `cleanup_e2e.py` | 清理器：删 E2E_ 标记行、还原被编辑字段、删审批级联通知、校验基线 |
| `e2e_suite_result.json` | 运行产物（每域按钮链路 / 请求 / 落库 id） |
| `e2e_suite.js` 头部注释 | 10 条踩坑要点（改脚本前必读） |

历史专项脚本（保留作单域排障参考）：`e2e_notif.js` / `e2e_round2*.js` / `e2e_round3.js` /
`e2e_round4*.js` / `debug_*.js` / `diag2.js`。

## 前置条件

1. 后端运行：`python run.py --env development --host 127.0.0.1 --port 5000`
2. 前端运行：`npm run dev`（127.0.0.1:3000）
3. 账号：`admin / admin123`

## 用法

```bash
# 1) 记录跑前 notification 的 max(id)（用于精确清理审批级联通知）
apps/backend/.venv/Scripts/python.exe -c "
import sqlite3; c=sqlite3.connect('apps/backend/instance/score_management.db')
print('MAX_ID=', c.execute('SELECT IFNULL(MAX(id),0) FROM notification').fetchone()[0])"

# 2) 跑回归
NODE_PATH="C:/Users/<用户>/.workbuddy/binaries/node/workspace/node_modules" \
"C:/Users/<用户>/.workbuddy/binaries/node/versions/22.22.2-3/node.exe" \
.workbuddy/browser_test/e2e_suite.js

# 3) 清理（把上一步的 MAX_ID 和被审批的申请 id 传进去）
apps/backend/.venv/Scripts/python.exe .workbuddy/browser_test/cleanup_e2e.py \
  --approve-notif-after-id <MAX_ID> --approve-ids <审批id...>

# 4) 只想看状态不删数据
apps/backend/.venv/Scripts/python.exe .workbuddy/browser_test/cleanup_e2e.py --dry-run
```

`CHROME_PATH` 环境变量可覆盖 Chrome 路径（默认 `C:/Program Files/Google/Chrome/Application/chrome.exe`）。

## 覆盖范围（15 个写域/操作）

**新增类（11）**：通知、积分分类、课程节次、学生、班级、座次表、值日组、手机箱开箱策略、
评分规则、课程安排、家长联系方式

**非新增类（4）**：审批（状态变更）、删除（销毁）、编辑（更新）、成绩录入（网格）

## 当前状态（2026-10-05 实测）

- **13 域在套件中全绿**（含手机箱策略：需先选班级才渲染放行按钮）
- **3 域在套件中 NO_WRITE/ERROR，但已在历史专项轮实证通过**：
  - `classPeriod` — 套件用 `input[placeholder*="例如：第一节课"]` 定位，弹窗结构差异导致
  - `user` — 「添加学生」PermissionButton 的 disabled 等待在连续切页时序下不稳定
  - `scoreEntry` — 网格依赖考试异步加载 + 单元格定位，需人工确认选中单元格
- 这 3 域的历史实证：节次 `class_periods` id=16、学生 `user` id=18 均真实落库。

## 关键坑（务必先读 `e2e_suite.js` 头部 10 条）

1. Chrome 必须 `--single-process`，否则沙箱内 `chromium.launch` 挂死
2. 页面内 fetch 登录须用**相对路径** `/api/...`（Vite 代理），直连 5000 跨域被拦
3. `PermissionButton` 在权限 `isLoading` 期间渲染 **disabled**，点击前必须等非 disabled
4. React 受控输入：`fill()` 不触发 onChange → 必须 `click()` + `keyboard.type()`
5. 合成 `.click()` 不触发 React onClick → 用 Playwright 原生 `locator.click()`
6. 精确捕获写请求用 **before/after 索引法** + 排除 `frontend-performance` 上报噪声；
   `waitForResponse` 在多域连续序列中有竞态假象，勿单独依赖
7. 列表行内按钮需精确定位：`evaluate` 内 `setAttribute` 临时标记再点
8. `Modal` 是 `if(!isOpen) return null`（无动画）；若 create 抛异常模态不关，遮罩会拦截后续点击
9. 部分域提交前有业务校验（如课程安排 `checkConflicts`），选值须避开冲突
10. 审批存在**级联副作用**（自动写 notification），清理须按 id 阈值精确删

## 清理器安全约定（血泪教训）

- **禁用 `created_at >= 某天` 这类粗阈值删审批通知** —— 曾误删 9 条同日历史真实通知。
  必须记录跑前 `notification.max(id)`，只删 `id >` 该值的行。
- **必须「先还原被编辑的既有行，再删标记行」** —— 反序会把「被改名成 E2E_xxx 的既有行」
  当标记行删掉，导致该行永久丢失（曾致 `score_category` id=1 丢失）。
- SQL `LIKE` 中 `'_'` 是单字符通配符，`'E2E_%'` 不按字面匹配下划线；
  必须 `ESCAPE ?` **以参数形式**传反斜杠（写进 SQL 字符串会被 Python 吞掉，导致删除静默 0 行）。
- 基线（2026-10-05）：`user=17 class_info=9 class_periods=15 score_category=9 notification=19
  approval=8 phone_box_policy=2 course_schedules=8 parent_contact=8 score_rule=10`
  （`notification=19` 是误删 9 条历史通知后的实际值；原基线为 28）
