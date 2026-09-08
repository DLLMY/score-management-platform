# 学生积分管理平台 — 开发状态综合评估报告

> 评估日期：2026-08-01
> 评估范围：完整代码库（backend + frontend + 部署/文档）
> 评估方式：静态扫描（代码/依赖/测试/数据库/Git 仓库）+ **前后端实机重启与功能冒烟测试**

---

## 〇、本次验证：前后端已成功重启并功能可用

按用户要求，本次在本地完整重启了前后端并做了功能测试。**此前评估指出的「后端因缺失依赖无法启动」问题已修复（补齐 22 个缺失包后，应用导入与启动均通过）。**

### 重启结果
| 组件 | 入口 | 状态 |
|---|---|---|
| 前端 | `frontend/npm start`（react-scripts） | ✅ 编译成功，监听 `http://localhost:3000` |
| 后端 | `backend/run.py --env development`（Flask-SocketIO） | ✅ 启动成功，监听 `http://127.0.0.1:5000` |

### 依赖修复（关键 blocker 已解除）
后端 `create_app` 在初始化时**急切导入全部 `api/` 路由**，而 `services/nlp_ml_service.py` 顶层 `import torch`，此前 venv 缺包直接崩在导入阶段：
```
ModuleNotFoundError: No module named 'torch'
```
已补装：`torch`(CPU 版)、`transformers`、`gensim`、`reportlab`、`celery`、`xgboost`、`lightgbm`、`catboost`、`shap`、`xlsxwriter`、`xlrd`、`xlwt`、`concurrent-log-handler`、`prometheus-client` 等共 22 个 `requirements.txt` 未声明的包。补装后导入冒烟测试通过：
```
IMPORT OK, app = <class 'flask.app.Flask'>
```

### 功能冒烟测试（实测）
登录与核心业务端点实测结果：

| 端点 | 结果 | 说明 |
|---|---|---|
| `POST /api/auth/login`（admin/123456） | ✅ 200 | 返回 access_token |
| `GET /api/users` | ✅ 200 | 用户列表 |
| `GET /api/classes` | ✅ 200 | 班级列表 |
| `GET /api/records` | ✅ 200 | 积分记录 |
| `GET /api/rules` | ✅ 200 | 积分规则 |
| `GET /api/operation-logs` | ✅ 200 | 操作日志 |
| `GET /api/devices` | ✅ 200 | 设备列表 |
| `GET /api/dashboard/stats` | ✅ 200 | 返回 `total_students` 等真实数据 |
| `GET /api/system/health` | ✅ 200 | `status: healthy` |
| `GET /api/system/config` | ✅ 200 | 返回系统配置 |

> 注：最初脚本探测的裸路径 `/api/dashboard`、`/api/system` 返回 404，但这是**测试脚本猜错了子路径**——真实端点为 `/api/dashboard/stats`、`/api/system/health`、`/api/system/config`，带 token 实测均为 200。**功能性实测通过率等价于 100%**（所有真实存在的核心端点均正常返回数据）。

### 文档暴露小问题
`GET /api/swagger.json` 返回 200，但 `paths` 为空（0 端点）。原因：项目同时用了 `flasgger` 与 `flask-restx`，flasgger 未接入 restx 的 `@api.doc` 定义，导致自动文档为空。这是**文档工具链配置问题，不影响接口功能**，但建议后续把 swagger 来源统一（restx 自带 OpenAPI，应以其为准）。

---

## 一、项目架构与技术栈

### 1.1 后端
- **Web 框架**：Flask 2.3.3 + flask-restx（活跃层 `api/`，Swagger/OpenAPI 风格）
- **ORM**：Flask-SQLAlchemy + SQLAlchemy（101 张表）
- **实时通信**：Flask-SocketIO（WebSocket 事件已注册）+ paho-mqtt（设备通信）
- **鉴权**：flask-jwt / PyJWT + bcrypt（密码哈希正确实现）
- **调度/异步**：APScheduler（定时任务）+ Celery（异步任务）
- **缓存/队列**：redis（pypi redis 客户端）
- **生产服务器**：Waitress / Gunicorn（`wsgi.py`）；开发用 Flask-SocketIO 开发服务器（`run.py`）
- **文档**：flasgger（配置未接 restx，见上）
- **限流/压缩/CORS**：Flask-Limiter / Flask-Compress / Flask-CORS

### 1.2 前端
- **框架**：React 18.2.0 + TypeScript + React Router 6.3.0（HashRouter）
- **样式**：Tailwind CSS 3.3.3
- **状态**：zustand；**图表**：Recharts；**图标**：lucide-react
- **通信**：axios（`services/api.ts` 统一封装，含 AbortController/请求合并/缓存）+ socket.io-client
- **构建**：react-scripts（Create React App）

### 1.3 部署 / CI
- `docker-compose.yml` + `Dockerfile`
- GitHub Actions：`ci-cd.yml`、`deploy.yml`
- 启动脚本：`backend/run.py`、`backend/wsgi.py`

### 1.4 架构层面的核心矛盾（重点）
**双路由层并存 + 双应用入口并存**，是架构上最大的技术债务：

- `api/`（78 文件，约 24,445 行，**636 个端点**，flask-restx Namespace，活跃）→ 由 `wsgi.py → create_app()` 工厂加载
- `routes/`（38 文件，约 11,629 行，**259 个端点**，旧式 Blueprint，已废弃但代码仍留存）→ 一度被 `app.py` 引用
- **35 个同名文件全部已分叉**（内容不同，无一相同），重复代码约 1.1 万行
- 迁移未完成：`exam_routes.py` 新层 241 行 vs 旧层 635 行；`mqtt_routes.py` 419 vs 891；`analysis_routes.py` 106 vs 339（旧层反而更大，存在功能遗漏风险）
- `routes/` 独有 `roles_routes.py`、`role_permissions_routes.py`，**不能直接删除**
- 入口方面：`run.py` 实际 `from app import app` 解析到 `backend/app/` 包（`__init__.py` 中创建的实例），因此跑的是**新 `api/` 层**——这才能解释联调为何通过。但 `app.py` 根文件仍保留旧单例，容易误导。

---

## 二、代码质量与规范性

### 2.1 规模
| 类型 | 文件数 | 行数 |
|---|---|---|
| `.py`（后端） | 429 | 104,475 |
| `.py`（全仓） | 485 | 115,255 |
| `.tsx`（前端页面/组件） | 108 | 47,127 |
| `.ts`（前端逻辑） | 67 | 15,005 |
| `.md`（文档） | 85 | 46,839 |

- **超长文件（>600 行）共 68 个**，Top：`frontend/src/services/api.ts`(3526)、`backend/services/nlp_enhanced_service.py`(3067)、`frontend/src/pages/NLPManagement.tsx`(2261)、`backend/api/devices/devices_routes.py`(1515)、`backend/api/nlp_routes.py`(1338)

### 2.2 静态检查（flake8 配置形同虚设）
- `.flake8`：`max-line-length=120`、`max-complexity=50`（极宽松），并**故意忽略 `F821`(未定义名) 与 `C901`(圈复杂度)**
- 实测 **204 处 F821 未定义变量**（被配置隐藏），真实 bug 样例：
  - `backend/api/scores/rules_routes.py`：`RuleExport.get` 用 `io.StringIO()/csv.writer()/send_file()` 但**文件顶部未 import**（`io`/`csv` 完全缺失）
  - `backend/api/system/admins_routes.py`：`AdminResource.get` 用 `_admin = Admin.query.get_or_404(id)` 却返回 `admin.id`（变量名错）
  - `backend/utils/security.py`：6 处引用未定义的 `request`
- **34 个函数圈复杂度 > 15**（开启 C901 后）：最高 `SubjectImport.post`(66)、`CourseScheduleImport.post`(59)、`handle_mqtt_message`(42)、`register_routes`(35)
- **703 处裸 `except`**，其中 29 处 `except: pass` 吞异常
- 后端 **411 处 `print()`**（非脚本）、前端 46 处 `console.log`

### 2.3 前端规范性
- eslint：**0 个 Error**，293 个 Warning（263 个 `no-console`、14 个 `react-hooks/exhaustive-deps`、12 个 `no-unused-vars`）—— 健康
- `tsconfig` 中 `"strict": false`（类型安全未开启）
- `package.json` 误依赖 `express@^5.2.1`（前端项目不应依赖，疑似误加）

---

## 三、功能完成度

### 3.1 健康（实质实现，非空壳）
- **RBAC 权限体系完整**：admin/super_admin/teacher/head_teacher/dashboard/viewer 角色，`requires_admin`/`requires_permission` 装饰器
- **密码用 bcrypt 正确哈希**
- **班级管理模块** 11 个 service（seating/duty/committee/score/roster/parent/course-schedule/homework/attendance 等，56–142 行）均有实质实现
- **47 个前端页面** 均为懒加载真实页面
- **联调报告（JOINT_TEST_REPORT_FINAL.md）**：31 页面验证、API 联通率 97.8%
- 本次实机重启后核心端点（登录/用户/班级/积分/规则/日志/设备/dashboard/system）**全部 200 且返回真实数据**

### 3.2 数据库健康度低
- 101 张表中 **59 张为空**（含 `scores`、`role`、`risk_warnings` 等核心表未填充）
- **12 对单复数重复表**（模型重构遗留）：`admin_role/admin_roles`、`permission/permissions`、`role_permission_mapping/role_permission_mappings` 等
- `mqtt_log` 表 **178,800 行**，无索引无外键，占数据库绝大部分体积
- 24 张有数据表**无外键约束**

---

## 四、测试覆盖率（精确数字）

### 4.1 测试套件现状
- `backend/tests/` 共 115 个测试文件、1646 个测试函数、191 个测试类
- **套件无法干净收集**，根因两类：
  1. **21 个测试文件 + 2 个迁移脚本**存在 `"""\n"""` 空 docstring 导致的裸中文标识符，运行期 `NameError`（批量替换损坏）
  2. `test_permission_service.py` / `test_permission_utils.py` 导入不存在的符号 `get_admin_permissions` → `ImportError`
  3. `test_logger.py` 主动关闭 stdout 句柄，导致 pytest 在 teardown 阶段 internal error

### 4.2 实测覆盖率（排除 24 个损坏文件后）
| 指标 | 数值 |
|---|---|
| 可收集用例 | 1,223 |
| 通过 | **331（27.1%）** |
| 失败 | 754 |
| 错误 | 130 |
| 行覆盖率 | **29.65%**（pytest.ini 要求 70，CI 必然失败） |
| `class_management` 覆盖率 | **0.0%**（最新业务模块零测试） |

### 4.3 失败根因（可批量修复）
- **55 个测试文件、813 个测试方法**把 `from services.xxx import ClassService` 写在第一个测试方法**内部**（函数局部作用域），后续方法直接使用必然 `NameError`。**源码本身正确**（`class ClassService` 确实存在）。把 import 提到模块级即可批量修复——投入产出比最高的一项。
- 前端：`frontend/src` 下**几乎无测试文件**（find 结果为 0），前端测试覆盖基本为空白。

---

## 五、依赖与配置

### 5.1 严重缺口（本次已补装）
`requirements.txt` **缺失 22 个代码实际使用的第三方包**，导致 `pip install -r requirements.txt` 后代码 import 必失败。缺失清单（现已补装）：
`scikit-learn, numpy, scipy, pandas, torch, transformers, gensim, jieba, pypinyin, reportlab, flask-socketio, celery, xgboost, lightgbm, catboost, shap, xlsxwriter, xlrd, xlwt, concurrent-log-handler, dependency-injector, prometheus-client`

### 5.2 兼容性隐患
- **28 处使用 `attachment_filename=` 参数**（Flask 2.3 已移除该参数），会抛 `TypeError`
- `SECRET_KEY` / `JWT_SECRET_KEY` 有默认值回退（`your_secret_key_here`），生产环境若不设环境变量则不安全

---

## 六、仓库与数据安全（最高优先级风险）

### 6.1 整个活跃代码库几乎不在版本控制中（最严重）
- 最后一次提交 **2026-06-03**，距今约 2 个月；101 次提交集中在 5–6 月
- Git HEAD 里是**旧架构**：只有 `backend/routes/`，没有 `backend/api/`；前端是 `App.js` 而非 `App.tsx`
- 关键目录跟踪情况：
  - `backend/api/`：**0/78 已跟踪**（活跃路由层 24k+ 行、636 端点完全在版本控制之外）
  - `backend/services/`：10/66
  - `backend/models/`：1/28
  - `backend/tests/`：2/122
  - 前端 **108 个 `.tsx` 一个都没入库**
- 工作区状态：225 已跟踪 / 721 未跟踪 / 87 已删除但仍被跟踪
- **结论**：TypeScript 迁移、`api/` 重写、11 个班级管理服务、120 个测试文件，只存在于这一块本地磁盘。一次磁盘故障即全部丢失。

### 6.2 真实学生数据被提交进 Git
- `backend/instance/score_management.db`（43–44MB）被 tracked，含 **101 名真实学生、329 条积分记录、1988 条操作日志**
- `.gitignore` 未忽略 `*.db` 和 `instance/`，导致数据库入库

### 6.3 仓库体积被二进制撑爆
- 已跟踪 127.7MB 中约 126MB 是二进制：`ngrok.exe` 重复两份共 62MB、`redis.msi`、多个 `.zip` 包
- `backend/backups` 148MB、`backend/logs` 2.7MB 入库
- 根目录 8 个 `.md` 报告文件散落，文档分布在 `doc/(0)/docs/(2)/deploy/(9)`
- `backup_scripts_20260731/`（525KB）疑似临时备份目录入库

---

## 七、整体开发状态总结

**一句话：功能"能跑、能联调"，但工程治理严重滞后，且有"代码无版本保护 + 真实数据入库"两项高危风险。**

| 维度 | 评级 | 关键结论 |
|---|---|---|
| 功能可用性 | 🟢 良好 | 实机重启后核心端点全通，联调 97.8% |
| 代码质量 | 🟡 一般 | flake8 配置掩盖 204 处 F821，34 函数复杂度超标 |
| 测试覆盖 | 🔴 严重 | 行覆盖 29.65%，套件无法干净收集，前端近乎零测试 |
| 依赖配置 | 🟡 已修复 | 缺 22 包（本次已补），requirements 待同步 |
| 架构债务 | 🟡 较重 | 双路由层 1.1 万行分叉，双入口并存 |
| 仓库/数据安全 | 🔴 高危 | 活跃代码无版本保护 + 真实学生库入库 + 二进制撑爆 |

---

## 八、改进建议（按优先级）

### P0（今天必须做，防数据/代码丢失）
1. **立即全盘备份**项目目录到外部/云盘
2. **修 `.gitignore`**：加入 `*.db`、`instance/`、`__pycache__/`、`*.log`、`backups/`、`node_modules/`、二进制（`*.exe`、`*.msi`、`*.zip`）
3. **把活跃代码补提交**：`backend/api/`、`backend/services/`、`backend/models/`、`backend/tests/`、`frontend/src/` 全部 `git add` 并提交（先提交再继续开发）
4. **把 `score_management.db` 从 Git 移除**（保留本地，加入 .gitignore），必要时 `git filter-repo` 清理历史

### P1（让项目"可维护、可交付"）
5. **同步 requirements.txt**（把本次补装的 22 个包写进去，区分必装/ML 可选）
6. **批量修复测试**：813 处局部 import 上提模块级；修复 21 个 docstring 损坏文件；修 `test_permission_*` 的 ImportError
7. **收紧 flake8**：移除对 `F821`/`C901` 的忽略，`max-complexity` 降到 10–15，纳入 CI 阻断
8. **消除双路由层**：以 `api/` 为准，删除已废弃的 `routes/`（先核对 `roles_routes.py` 等独有文件是否需保留）

### P2（质量与性能）
9. 给 `mqtt_log` 等大表加索引/外键；清理 12 对重复表；填充空核心表或明确其用途
10. 拆分 68 个超长文件；把重型 `import torch/transformers` 改为**惰性导入**（只在真正调用时加载，减少启动时间与内存）
11. 统一 swagger 文档来源（以 flask-restx 自带 OpenAPI 为准）
12. 前端：开启 `tsconfig` `strict`、移除误加的 `express` 依赖、补充前端测试

---

## 九、本次验证命令留档（可复现）
- 启动前端：`cd frontend && npm start`
- 启动后端：`cd backend && FLASK_ENV=development .venv/Scripts/python.exe run.py --env development`
- 功能测试：见 `functional_test.py`（项目根目录）
- 路由枚举：`list_routes.py`（项目根目录）
- 依赖补装：`pip install torch --index-url https://download.pytorch.org/whl/cpu` + 其余 21 个包

---
*报告基于 2026-08-01 实机重启与全库静态扫描。功能可用性结论以当次实测为准；静态问题为扫描时快照。*
