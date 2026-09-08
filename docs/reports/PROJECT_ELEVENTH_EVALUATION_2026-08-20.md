# 第十一次项目全面复评报告

**日期**：2026-08-20
**评估性质**：七维度全面复评（二次复核第十次评估闭环 + 新维度扩展）
**基线**：第十次评估（六维，评分 8.8/9.0/9.2/8.6/9.2/8.9，P2×2 + P3×N）
**综合评分**：**9.2**（较十评 9.1 小幅上调——P2 全闭环、安全面实质性增强）

---

## 〇、十评问题闭环复验（本次核心任务之一）

| 十评问题 | 复验结果 |
|----------|----------|
| P2-1 token 存 localStorage（XSS 面） | ✅ **完全 cookie 化闭环**：permission.py 6 处 HttpOnly cookie fallback；前端 localStorage 凭证读写归零；curl 实测仅凭 cookie 访问受保护端点 200 / 无凭据 401 / cookie 刷新 200 |
| P2-2 services→api 反向依赖 2 处 | ✅ **清零**（grep 0 命中；ScoreImportHelper/rank 辅助已下沉） |
| P3 全表遍历（export/devices 3 处） | ✅ 3→2；**本次复评额外发现 M6 preview 端点 1 处遗漏**，已顺手修复（count()/索引 filter） |
| P3 循环 count（categories/subject） | ✅ in_() + group_by 单查询聚合 |
| P3 any 34 处 | ✅ →3（全部为 React 泛型 lazy 透传的类型系统边界） |
| P3 长函数（course_schedule 487 行） | ✅ →249 行（抽 4 个模块级 helper） |
| P3 pyflakes / 死代码 | ✅ 清理完成 |
| P2-1 安全响应头 | ✅ security_headers.py 已注册（nosniff/X-Frame/Referrer/CSP） |

**复评新发现并修复**：`remote_notify_routes.py` preview 端点（M6 引入）仍走 `Device.query.all()` 全表遍历——十评批量修复时遗漏。已改为 `count()` + 索引 filter + `order_by(limit 20)`，行为等价。

---

## 一、七维度评估

### 1. 架构设计合理性 — 9.3
- **分层清晰**：api（路由）→ services（业务）→ models（数据）→ utils（横切）；写路径事务内联在 services 薄封装，路由保留校验/缓存失效/跨切面副作用（F17 防腐层模式已铺开）
- **依赖健康**：0 循环依赖；services→api 反向依赖 **0**（十评 P2-2 闭环）
- **路由治理**：路由唯一源 + G5 OpenAPI 契约（464 端点零漂移）；权限装饰器 **593 处**
- **一致性好**：统一响应信封、统一分页 helper（get_pagination）、统一缓存（cached_api 96 处）、统一确认弹窗（useConfirm）

### 2. 代码质量 — 9.0
- eslint 全量 **0 错误**；裸 except 业务代码 0；SQL 全参数化
- TODO/占位 **0**（4 处命中均为注释/说明性文字，无未实现功能）
- **残余长函数 13 个 >200 行**：users_routes.py:1017 post 295 行、nlp_enhanced_service.py 364/302 行（配置加载）、academics_service 284 行、class_service 269 行等——非紧急但可继续拆
- any 3 处均为类型系统边界（React 泛型 lazy 透传，TS 已知限制），已显式豁免注释

### 3. 功能完整性 — 9.2
- M1-M13 全部闭环（M12 移动适配按用户要求跳过）；十评 P2/P3 全部处理完毕
- 双身份隔离（Admin/学生）、RBAC 68 条、批量审批/键盘流/草稿恢复/进度条等体验增强均在位
- **薄弱环节**：移动端适配缺失（平板/手机访问体验未覆盖）；NLP 重推理仍在 HTTP 线程同步执行（有槽位限流兜底但无异步任务化）

### 4. 性能与可扩展性 — 9.3
- 冷启动 **11s**（<25s 验收）；首屏 gzip ≈190-214KB（≤380KB）
- 缓存覆盖率 96/464 ≈ **20.7%**（列表 ttl=30/聚合 60，强一致不加）；per_page 上限 100%
- 关键查询 EXPLAIN **4/4 索引命中**（score_record/device/alert/operation_log）；DB 207 索引，索引闸门已入回归
- 全表遍历仅剩 2 处（均为导出全量，功能需要）
- 扩展性：Celery 任务基础设施已就绪（定时通知在用），NLP 异步化可平滑接入

### 5. 安全性 — 9.0
- **认证**：token 完全 HttpOnly cookie 化（access/refresh 均 `HttpOnly; SameSite=Lax`，实测仅凭 cookie 通过鉴权）；双轨共存向后兼容
- **传输/头**：CSP（幂等保留）+ nosniff + X-Frame-Options + Referrer-Policy（security_headers.py）
- **CSRF**：flask_wtf 启用 + csrf_token cookie + 前端 X-CSRFToken 注入
- **输入/权限**：SQL 全参数化（0 拼接）；权限装饰器 593 处；数据隔离（get_allowed_classes/学生视角隔离）在位
- 敏感信息硬编码 **0**
- 剩余：`SESSION_COOKIE_SECURE` 生产需显式配置为 True（开发 http 下为 False，属预期）

### 6. 测试覆盖 — 9.0
- 后端：**157 测试文件 / 约 1979 用例**；前端：16 测试文件 / vitest 176 用例
- **五步回归闸门**（run_regression.sh）：RBAC 68 / OpenAPI 464 / 契约信封 / 关键路由 / 索引校验——每次必跑
- **CI 已接入**（GitHub Actions 双 job，push/PR 自动跑；首跑排障后全绿）
- 薄弱：前端核心交互（键盘流/草稿/预览确认）缺少组件级单测；NLP 推理端点并发场景缺压测

### 7. 技术债与潜在风险 — 识别清单
| 风险 | 等级 | 说明 |
|------|------|------|
| M12 移动适配缺失 | P2 | 用户明确跳过；平板/手机访问将出现横向滚动、触摸不友好 |
| NLP 推理未异步化 | P2 | 大文本评分占 HTTP 线程（Semaphore(4) 兜底不排队）；Celery 已有基础设施 |
| 长函数 13 个 >200 行 | P3 | 可维护性债，非功能缺陷 |
| opencv/numpy 版本不匹配 | P3 | pip check 告警，需对齐版本 |
| SQLite 技术局限 | P3 | 前置通配 LIKE 无索引手段、中文 FTS 不可行、写并发受限（已论证收口） |
| npm audit 未跑 | P3 | npmmirror 不支持 audit；需换 registry 或 CI 加步骤 |
| 生产部署未演练 | P2 | create_indexes/静态资源/HTTPS cookie secure 标志均未在生产形态验证过 |
| CI 冒烟深度 | P3 | 当前只跑契约/路由测试，无"登录→cookie→受保护端点"端到端冒烟 |

---

## 二、下一步开发任务清单（按优先级排序）

### P0 — 部署准备与 CI 固化（无新功能，消除上线风险）

**任务 1：生产部署演练 + 部署配置核对**
- 目标：验证生产形态冷启动、建表建索引、静态资源、反向代理、HTTPS 下 cookie `secure` 标志
- 模块：deploy/、scripts/、config/、middleware/security_headers.py
- 验收：生产配置启动成功；`create_indexes.py --create` 后 `verify_indexes.py` 全绿；curl 验证安全响应头齐全；HTTPS 下 Set-Cookie 含 `Secure`；补部署文档（SESSION_COOKIE_SECURE 说明）

**任务 2：CI 增加 cookie 认证轨冒烟**
- 目标：把本次人工 curl 验证（登录→仅凭 cookie 访问受保护端点→200）固化为自动化，防回归
- 模块：.github/workflows/ci.yml、backend 测试
- 验收：CI 新增后端冒烟步骤（pytest 或 curl 断言），双 job 全绿

### P1 — 功能补强（用户价值）

**任务 3：NLP 推理异步化（可选，若存在大文本场景）**
- 目标：/model/predict 等重推理改 Celery 任务 + 任务 ID 轮询，释放 HTTP 线程；轻推理保留同步
- 模块：api/nlp/nlp_routes.py、tasks/、前端 NLPManagement
- 验收：大文本推理返回 task_id，前端轮询展示结果；小文本仍同步；G5 464 零漂移；NLP 测试全绿

**任务 4：M12 移动端适配（用户此前跳过，按需排期）**
- 目标：表格卡片化、触摸友好、375px 无横向滚动
- 模块：DataTable 响应式、布局（Sidebar/Header）、Top 页面（成绩/审批/考勤）
- 验收：主流机型宽度下核心页面无横向滚动；touch 事件可用；vitest/build 全绿

### P2 — 工程债清理（低风险）

**任务 5：长函数拆分第二批**
- 目标：users_routes.py:1017 post（295 行）优先拆分（复用 course_schedule 拆分范式：抽 helper + 响应逐字节一致）；nlp_enhanced_service 的 364/302 行配置加载函数抽常量/解析器
- 模块：api/users/users_routes.py、services/nlp_enhanced_service.py
- 验收：每域 py_compile + 定向 pytest 全绿 + G5 零漂移；函数 <200 行

**任务 6：pip 依赖对齐**
- 目标：修复 opencv/numpy 版本不匹配（pip check 清零）
- 模块：requirements.txt
- 验收：`pip check` 0 冲突；回归全绿

**任务 7：前端核心交互单测扩面**
- 目标：Approvals 键盘流（J/K/Y/N）、ScoreEntry 草稿恢复/进度条、RemoteNotify 预览确认补组件级测试
- 模块：frontend/src 对应 __tests__/
- 验收：新增 ≥6 用例；vitest 全绿（176+）

### P3 — 可延后

**任务 8：npm audit 补跑**（CI 换 registry 或加 audit 步骤，确认 0 高危）
**任务 9：WebSocket 设备状态推送端到端测试**（连接→状态变更→客户端收到）

---

## 三、结论

- 十评 P2/P3 **全部闭环**，复评新发现 1 处遗漏（M6 preview 全表遍历）已顺手修复
- 七维度评分：架构 9.3 / 代码质量 9.0 / 功能 9.2 / 性能 9.3 / 安全 9.0 / 测试 9.0 / 可扩展 9.3 → **综合 9.2**
- 无 P0/P1 缺陷；最大待办为**生产部署演练**（P0，纯上线前风险消除）与**移动端适配**（用户可选项）
- 系统处于可交付状态：契约零漂移、五步回归全绿、CI 已接入、凭证与安全头就位

**建议顺序**：任务 1→2（上线准备）→ 5→6→7（工程债）→ 3/4（按业务需要插队）。
