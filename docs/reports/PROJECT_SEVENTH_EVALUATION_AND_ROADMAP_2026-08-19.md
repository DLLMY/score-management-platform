# 项目第七次综合评估报告与开发路线图

**评估日期**: 2026-08-19
**评估类型**: 产品级全面评估（代码质量 / 架构合理性 / 功能完整性 / 性能表现 / 用户体验）
**分支**: refactor/F17（HEAD 29f82bc）
**对比基线**: 第六次综合评估（2026-08-19，8.9/10，生产就绪）

> **本次与前六次的区别**：前六次评估聚焦"工程质量闸门"（测试、静态扫描、契约、依赖），已连续三次全绿并达 8.9/10。**本次不再重复闸门验证**，而是把评估视角切换到**"老师真正在用的时候好不好用、快不快、错了怎么办"**——即功能完整性、性能表现与用户体验。所有结论均带 `文件:行号` 证据或实测数据，并已逐条抽查复核（修正了 3 处初查误判，见附录 A）。

---

## 一、结论摘要

| 维度 | 评分 | 与第六次对比 | 核心判断 |
|------|------|------|------|
| 代码质量 | 9.0/10 | — | 闸门全绿，规范层面已无债务 |
| 架构合理性 | 8.5/10 | ↓ 0.8 | 后端分层优秀；**前端"组件库与页面脱节"、索引定义与部署脱钩**两处架构裂缝 |
| 功能完整性 | 9.0/10 | ↓ 0.2 | 56 页面业务闭环完整；**批量审批、真实进度反馈、移动端审批**为真实功能缺口 |
| 性能表现 | 7.8/10 | ↓ 1.2 | 当前数据量（3k 记录）无感；**结构性风险明确**：缓存覆盖 2.6%、分页上限保护 26%、无虚拟滚动 |
| 用户体验 | **6.5/10** | 新增维度 | **本次最大短板**：加载态缺失、原生确认框、技术报错直吐用户 |
| 安全性 | 8.7/10 | ↓ 0.3 | 认证/审计全绿；但 150 处异常明文回传属信息泄漏面 |
| 可维护性 | 9.3/10 | — | F17 防腐层 + 路由唯一源稳定 |

**项目成熟度（工程视角）: 8.9/10** — 维持
**产品成熟度（用户视角）: 7.2/10** — 本次首次量化

> **一句话结论**：这是一个**工程质量优秀、但用户体验尚未打磨**的系统。它"不会坏"，但"用起来不够顺"。下一阶段的投入重点应从"修 bug、补测试"整体转向"打磨体验、防未来的性能悬崖"。

---

## 二、实测数据基线（本次采集）

### 2.1 前端产物体积（vite 6.4.3 生产构建）

| 产物 | 原始 | gzip | 说明 |
|------|------|------|------|
| antd-C2jXrvP0.js | 788 KB | **245 KB** | 首屏必载，占首屏 54% |
| vendor-D2poWBgj.js | 416 KB | **128 KB** | 首屏必载 |
| index-BauhcrXZ.js | 228 KB | **55 KB** | 首屏必载 |
| index.css | 192 KB | **24 KB** | 首屏必载 |
| recharts-CPFIDghx.js | 344 KB | 85 KB | 按需（图表页） |
| **首屏合计** | **1.6 MB** | **≈ 452 KB** | 校园网 4G 下约 1.5–3s |
| dist 总体积 | 3.3 MB | — | 56 页面全部路由级懒加载 ✅ |

**判断**：懒加载做得好（56/56 页面分包），但首屏 452 KB 偏重，主因 antd 全量引入。属 P2 优化项。

### 2.2 数据库现状与查询计划实测

- 开发库 `backend/instance/score_management.db`：**105 张表 / 221 个索引**
- 数据量：`user` 94、`score_record` 3118、`operation_log` 3615、`device` 6、`approval` 6

| 查询 | 耗时 | 执行计划 | 判断 |
|------|------|----------|------|
| operation_log 按时间倒序 limit 20 | 1.2 ms | `SCAN USING INDEX ix_log_created_desc` | ✅ 命中索引 |
| operation_log 时间范围统计 | 1.9 ms | `SEARCH USING COVERING INDEX` | ✅ 覆盖索引 |
| score_record 按时间倒序 limit 20 | 2.2 ms | `SCAN USING INDEX ix_score_record_created_desc` | ✅ |
| `operation_log WHERE description LIKE '%开A箱%'` | **20.4 ms** | **`SCAN operation_log`（全表）** | ⚠️ 前置通配符无法走索引，**线性劣化**：10 万行推算 ≈ 550 ms+ |

证据：`backend/api/monitoring/operation_logs_routes.py:96,98`

### 2.3 后端启动与响应

- **冷启动 25–55 s**：25 s 时健康探测无响应，约 55 s 后可服务。构成：jieba 词典 + BERT 权重加载 + **MQTT 连接确认超时串行阻塞 5 s + 10 s**（`[MQTTManager] 客户端(control)连接确认超时`）
- 登录接口（401 路径）**0.30 s**：含 bcrypt 校验，属正常量级
- 说明：开发环境 EMQX 不可达导致 MQTT 超时，但**超时等待发生在启动路径上**，生产环境网络抖动时会同样拖慢启动 → P2

---

## 三、架构合理性：两处真实裂缝

后端分层（F17 防腐层、路由唯一源、services 写路径收口）经六次评估验证稳固，本次不再复述。以下是**本次新发现的两处架构裂缝**，都属"能跑但迟早出事"类型。

### 裂缝 1：前端"组件库与页面脱节"（P1，UX 与性能问题的共同根因）

| 事实 | 数据 | 证据 |
|------|------|------|
| 页面用原生 `<table>` 渲染列表 | **36 处** | `pages/`、`components/` |
| 使用 antd `<Table>` | 仅 4 处 | UserList / ScoreRecords / SemesterReport / ImportConfigManagement |
| 设置了 `pagination` 属性 | **1 处** | `pages/` 全域 |
| 设置了 `scroll={{ x }}`（小屏横滚） | **0 处** | 全域 |
| `VirtualList.tsx` / `OptimizedList.tsx` 已实现 | **0 个页面引用** | `components/data-display/VirtualList.tsx:1-141` |
| `Skeleton` 骨架屏实际落地 | **6 / 56 页面** | Profile、RuleList、Settings、UserList、Dashboard、CategoryList |
| `loading={...}` 加载态 | 仅 9 处 | 全前端 |

**本质问题**：项目**已经造好了轮子（VirtualList、OptimizedList、Skeleton、UserListSkeleton），但页面没装上**。36 处原生 table 各写各的，导致 loading / 空态 / 分页 / 横滚 / 虚拟滚动**五件事在 56 个页面里重复缺失**。

**影响**：这一处裂缝同时解释了后文 UX 问题 1、2、6 和性能问题 3——**修它一处，收益覆盖全站**。

### 裂缝 2：221 个索引依赖手动脚本，未纳入部署闸门（P2）

- 全部性能索引由 `backend/scripts/create_indexes.py` 创建（含 `ix_log_created_desc`、`ix_score_record_created_desc` 等覆盖索引）
- **全仓检索确认：无任何启动脚本、部署脚本、迁移流程调用它**，仅 `docs/STARTUP_GUIDE.md:156` 作为"手动工具"列出
- **后果**：新环境（换机、重装、生产迁移）若漏跑此脚本，221 个索引全部缺失，所有查询退化为全表扫描，且**测试不会失败、闸门不会报警**——是典型的"静默性能崩塌"

---

## 四、功能完整性：模块盘点与真实缺口

### 4.1 模块盘点（56 页面 / 461 端点）

| 域 | 页面 | 完整度 |
|----|------|--------|
| 成绩 | ScoreEntry、ScoreRecords、ScoreAnalysis、ExamManagement、SemesterReport、RankBoard、ClassCompare、AlgorithmAnalysis | ✅ 闭环 |
| 学生/班级 | UserList、UserDetail、ClassManagement、SubjectManagement、SeatingChart、CommitteeList、StudyGroups、DutyRoster | ✅ 闭环 |
| 审批/考勤 | Approvals、AttendanceManage、ActivityManage、HomeworkCheck | ⚠️ 缺批量 |
| 设备（手机保管箱） | DeviceManagement、DeviceGroup、PhoneBoxPolicy、FirmwareManagement、WakeOnLan、Diagnostics | ⚠️ 解锁两步 |
| 通知 | Notifications、RemoteNotify、ParentContact | ⚠️ 无真实进度 |
| 系统/运维 | OpsCenter、SystemMetrics、SecurityAudit、OperationLogs、PermissionManagement、Settings、FrontendTelemetry、DataSyncPage、ImportConfigManagement | ✅ 完整 |
| 学生端 | StudentLogin、StudentPortal | ✅ 有移动端 |
| 其他 | NLPManagement、MentalHealth、CultureBoard、StudyGuide、HelpCenter、Profile | ✅ |

**结论**：业务闭环**没有缺失模块**，TODO/FIXME/NotImplementedError 在业务代码中几乎为零（历史清理良好）。缺口集中在"高频操作的效率"而非"功能有没有"。

### 4.2 真实功能缺口清单

| # | 缺口 | 证据 | 影响场景 | 级别 |
|---|------|------|----------|------|
| F1 | **请假审批无批量操作** | `pages/Approvals.tsx:101,120` 仅单条 approve/reject | 早读前集中处理 20 条请假 = 点 20 次 + 20 次原生确认框 | **P1** |
| F2 | **批量通知/成绩确认无真实进度** | `RemoteNotify.tsx` 批量发送仅 window.confirm；`ScoreEntry.tsx:604` confirmAll 阻塞无进度；`ImportExportPanel.tsx:105-554` 的进度条是**模拟**的 | 老师不知道发到第几个、是否卡死 → 反复点击 | **P1** |
| F3 | **全站无表单草稿/离开未保存拦截** | `useAutoSave` 仅 `UserList.tsx:296` 一处；`useSubmitGuard` 仅 ScoreEntry / ExamManagement 两处 | 成绩录到一半误关标签 = 全部丢失 | **P1** |
| F4 | **管理端无移动端适配** | `pages/` 中 `useDeviceDetection`/`isMobile` 引用 **0 次**；`scroll={{x}}` 0 处；仅 `styles/mobile.css` 71 行 | 老师手机上批不了假、查不了成绩 | **P2** |
| F5 | 设备解锁需两步弹窗 | `DeviceManagement.tsx` 8 个 Modal（1345-1963），控制需"开弹窗→选 unlock_a/unlock_b" | 学生等着拿手机时的高频操作 | **P2** |
| F6 | 异常积分归因未实现 | `services/anomaly_service.py:445` 非 sudden_change 类型"暂用 0 占位" | 异常检测结论不完整 | **P3** |
| F7 | 导入失败无行级定位 | `import_export_routes.py:416,611,721` pandas 全量读取 | 导入 200 行报错，不知哪行错 | **P2** |

---

## 五、性能表现：当前无感，但悬崖清晰

**关键前提**：当前数据量小（3k 成绩、3.6k 日志、94 学生），实测均在毫秒级，**用户当前感受不到慢**。以下问题是**规模悬崖**——按 40 人/班 × 20 班 × 每周多科目录入推算，一学年成绩记录可达 10 万+ 量级，届时集中爆发。

| # | 问题 | 量化 | 证据 | 级别 |
|---|------|------|------|------|
| PF1 | **分页上限保护缺失** | 27 处读取 per_page，仅 **7 处**有 `min()` 上限 = 26% | `users_routes.py:138` `per_page` 默认 100 **无上限** → `?per_page=100000` 可一次 dump 全表 | **P1** |
| PF2 | **缓存覆盖率极低** | `@cached_api` **12 处 / 461 端点 = 2.6%** | 仅 devices / dashboard / rank 用了；成绩列表、学生列表、审批列表、通知历史全部直击 DB | **P1** |
| PF3 | **列表无虚拟滚动 + 客户端全量渲染** | 虚拟滚动组件 0 引用 | `AttendanceManage.tsx:201` 一次取 `per_page:500` 全量渲染；RuleList / DeviceManagement 全量数组客户端过滤 | **P1** |
| PF4 | **缓存失效过度** | 一次写操作清空全部 API 缓存 | `utils/api_cache_middleware.py:152` `invalidate_cache()` 无参 → `flush("api:*")` | **P2** |
| PF5 | **设备域 N+1 与全表内存过滤** | — | `devices_routes.py:83,468` `sum(1 for d in Device.query.all() if d.is_online)`；`:513` 列表 `.all()` 无分页；`device_service.py:130-205` 导入逐行 3 次查询 | **P2** |
| PF6 | **NLP 推理在 HTTP 线程同步执行** | Celery 已接入（15 处 delay/shared_task）但 NLP 未卸载 | `nlp_routes.py:517,539,560,653,675` predict/ensemble_predict 无异步、无超时 | **P1** |
| PF7 | 前置通配 LIKE 全表扫描 | 20.4 ms @3.6k → 推算 550 ms @100k | `operation_logs_routes.py:96,98` | P2 |
| PF8 | 预加载使用稀疏 | joinedload 系列仅 7 个文件 | 成绩列表已优化（`records_routes.py:193-195`），其余聚合接口未做 | P2 |
| PF9 | 导入导出全量载入内存 | — | `import_export_routes.py:416,611,721` pandas 全量；`export_routes.py` 全量构建 | P2 |
| PF10 | 首屏 452 KB gzip | antd 占 245 KB | 见 2.1 | P2 |

---

## 六、用户体验：本次最大短板（6.5/10）

### UX1 — 列表首屏无加载反馈（P1，影响约 50 个页面）
仅 9 处 `loading=`、6/56 页面有骨架屏。其余列表页冷加载期间**白屏或闪空**，老师会以为"卡了"而重复点击。
证据：`UserList.tsx:999,1052`、`ScoreRecords.tsx:552`、`SemesterReport.tsx:87,114,122`、`ImportConfigManagement.tsx:435` 之外的所有列表页。

### UX2 — 技术报错直吐用户（P1，同时是信息泄漏面）
- 后端 **150 处** 在 API 响应 message 中回传 `str(e)`，例：`exam_import_routes.py:199,329,390`、`classes_routes.py:164`、`subject_routes.py:699`
- 前端 `services/api.ts:446-454` `getErrorMessage` **优先返回后端原始 message**，友好文案表（`errorMessages`，含 500/502/503/504 中文提示）**仅作兜底**
- **净效果**：老师会看到 `IntegrityError: UNIQUE constraint failed: scores.exam_id` 这类弹窗，既看不懂也暴露表结构

### UX3 — 确认交互双标准并存（P1）
- `window.confirm`：**56 处 / 34 个文件**（ScoreEntry:604,620,649、Approvals:101,120、DeviceManagement:604、RemoteNotify:387,563、ClassManagement:242,481 …）
- `useConfirmDialog`（项目自研，体验正常）：已在 **11 个页面**使用
- **同一页面两种标准并存**（ScoreEntry、DeviceManagement、RemoteNotify、RuleList、ClassManagement 同时出现在两份清单）→ 风格割裂，原生框还会阻塞主线程、在移动端不可用

### UX4 — 长耗时操作无进度（P1）
批量通知、批量成绩确认、导入导出均无真实进度反馈（唯一进度条是模拟的）。用户唯一可用信息是"页面还在转"。

### UX5 — 无草稿保护（P1）
见 F3。成绩录入是本系统最高频、最怕丢的操作，恰恰没有草稿保存与离开拦截。

### UX6 — 弱网无重试（P2）
`api.ts:689,773` 仅对 401（token 刷新）与 419（CSRF 重取）重试；**5xx 与网络错误不重试**。校园 WiFi 抖动即报错。

### UX7 — 管理端小屏不可用（P2）
36 处原生 table 无横向滚动容器，无响应式断点。

### UX8 — 高频操作步骤偏多（P2）
设备解锁两步弹窗；审批无键盘流；无批量。

**做得好的部分（应保持）**：ErrorBoundary 全局兜底（`App.tsx:73,345,800`）✅、路由级懒加载 56/56 ✅、搜索防抖 `useDebouncedValue` 普遍 ✅、AbortController 每请求 + 路由切换取消（`api.ts:898`）✅、EmptyState 空态约 15 处 ✅、`message.success` 成功反馈普遍 ✅、学生端已有移动页面 ✅。

---

## 七、问题总清单（按优先级）

| ID | 问题 | 级别 | 类型 | 修复成本 | 收益面 |
|----|------|------|------|----------|--------|
| A1 | 组件库脱节：36 处原生 table，五件事重复缺失 | P1 | 架构/UX/性能 | 高 | **全站 56 页面** |
| A2 | 150 处 `str(e)` 明文回传 + 前端优先展示 | P1 | UX/安全 | 中 | 全站 |
| A3 | `window.confirm` 56 处，与自研 dialog 双标准 | P1 | UX | 中 | 34 文件 |
| A4 | 分页上限保护仅 26% | P1 | 性能/安全 | 低 | 27 端点 |
| A5 | 缓存覆盖 2.6% + 失效过度 | P1 | 性能 | 中 | 高频读端点 |
| A6 | 无草稿保存 / 离开拦截 | P1 | UX | 低 | 录入类页面 |
| A7 | 批量审批缺失 | P1 | 功能 | 中 | 日常高频 |
| A8 | 长操作无真实进度 | P1 | UX | 中 | 通知/导入/确认 |
| A9 | NLP 同步推理阻塞 worker | P1 | 性能 | 中 | 全站可用性 |
| A10 | 221 索引未纳入部署闸门 | P2 | 架构 | **低** | 环境迁移 |
| A11 | 设备域 N+1 与全表内存过滤 | P2 | 性能 | 中 | 设备页 |
| A12 | 5xx/网络无重试 | P2 | UX | 低 | 弱网 |
| A13 | 管理端无移动适配 | P2 | 功能/UX | 高 | 手机办公 |
| A14 | 导入导出非流式 + 无行级错误定位 | P2 | 性能/UX | 中 | 学期初导入 |
| A15 | 首屏 452 KB | P2 | 性能 | 中 | 首次访问 |
| A16 | MQTT 超时阻塞启动路径 | P2 | 性能 | 低 | 启动/重启 |
| A17 | 前置通配 LIKE 全表扫描 | P2 | 性能 | 中 | 日志统计 |
| A18 | 异常积分归因占位 | P3 | 功能 | 中 | 异常检测 |
| A19 | 无障碍（aria/role）缺失 | P3 | UX | 中 | 合规 |
| A20 | dev-only 依赖漏洞 3 个 | P3 | 安全 | 观察 | — |

---

## 八、开发路线图

**排序原则**：① 先修"一处收益覆盖全站"的根因；② 再修高频业务的效率；③ 再防规模悬崖；④ 最后做增强。**每阶段结束必须跑通既有闸门**（G2 RBAC 68 / G5 OpenAPI 461 / 全量 pytest / tsc+eslint+build+vitest），不允许为体验优化牺牲已有质量。

### 阶段一：体验基座（横切，收益覆盖 56 页面）— 最高优先

> 这一阶段不新增任何业务功能，但会一次性抬升全站体验分。**投入产出比最高**。

**M1. 统一 DataTable 基础组件**（解 A1、UX1、UX7、PF3）
- 封装 `components/data-display/DataTable.tsx`，内置五件套：`loading` 骨架态（复用已有 Skeleton）、`EmptyState` 空态、受控分页（默认 20/50/100，**硬上限 200**）、`scroll={{ x: 'max-content' }}` 小屏横滚、行数 >200 自动切 `VirtualList`
- 迁移策略：**先高频 5 页**（ScoreRecords、UserList、Approvals、DeviceManagement、OperationLogs），验证后再批量迁移剩余 31 处原生 table
- 交互流程优化：列宽记忆、排序状态持久化到 URL query（刷新/分享不丢筛选）
- 界面响应速度：首屏骨架 → 数据到达渐显，消除白屏；分页请求带 AbortController（已有能力，接进组件）
- 验收：`loading=` 覆盖率 ≥90% 列表页；`<table` 原生用量 36 → ≤5；小屏无横向溢出

**M2. 错误处理体系化**（解 A2、A12、UX2、UX6）
- 后端：定义 `error_code` 枚举 + 用户可读 `message` 双字段；**150 处 `str(e)` 收敛**为"用户看的中文短句 + 技术细节仅进日志/仅 debug 模式返回"。分批处理，优先 import/export/exam 三域（用户最常触发）
- 前端：`api.ts:446-454` 反转优先级——**先查友好文案表（按 error_code），后端 message 仅在明确标记 `user_facing: true` 时展示**；异常兜底文案"操作失败，请稍后重试（错误码 XXX）"，附"复制诊断信息"按钮
- 重试机制：对 5xx / 网络错误做**指数退避重试 2 次**（幂等 GET 自动，POST 需用户确认），复用现有 419 重试骨架
- 错误可观测：接入已有 `errorMonitor`，统计 Top 错误码驱动下一轮修复
- 验收：抽样 20 个错误路径，用户可见文案 100% 中文可懂、0 处泄漏表名/SQL

**M3. 确认与防误操作统一**（解 A3、A6、UX3、UX5）
- `window.confirm` 56 处 **全量替换** `useConfirmDialog`（已在 11 页验证可用），破坏性操作（删除、清空、批量解锁）加二次输入确认
- `useSubmitGuard` 从 2 页推广到所有提交表单（防重复提交）
- `useAutoSave` 从 1 页推广到**录入类页面**：ScoreEntry、ExamManagement、AttendanceManage、RemoteNotify 草稿本地暂存 + `beforeunload` 离开拦截 + "恢复上次未提交内容"提示
- 验收：`window.confirm` 归零；成绩录入中途刷新可恢复

### 阶段二：高频业务效率（解决"点太多次"）

**M4. 请假审批模块**（解 A7、F1）
- 批量选择 + **批量通过/批量拒绝**（后端补批量端点，事务内处理，返回逐条结果）
- 常用拒绝理由模板（下拉即选，免打字）
- 键盘流：`J/K` 上下移动、`Y` 通过、`N` 拒绝 → 20 条审批从 40+ 次点击降到 20 次按键
- 审批结果通知复用现有 `create_admin_notification` 链路（勿改契约）
- 错误处理：批量部分失败时展示"成功 18 / 失败 2（含原因）"，失败项可一键重试

**M5. 成绩录入模块**（解 A8、UX4、UX5）
- 真实进度：批量确认改为分批提交 + 进度条（已完成/总数/预计剩余），可中断
- 录入体验：Tab/Enter 跳格、上下键切换学生、粘贴 Excel 列直接填充、超出合法范围即时红框提示（前端校验先行，减少往返）
- 草稿：见 M3
- 响应速度：确认操作乐观更新（先改 UI 再回滚失败项）

**M6. 通知下发模块**（解 A8）
- 批量发送改为后台任务（Celery 已接入，15 处 delay 可复用）+ 前端轮询进度
- 失败清单展示 + 一键重发失败项
- 发送前预览"将发给 N 人（点击展开名单）"，避免误发

**M7. 设备管理模块**（解 F5、A11、PF5）
- 解锁一步到位：列表行内直接 `开A箱`/`开B箱` 按钮（保留二次确认），移除中间弹窗
- 后端：`devices_routes.py:83,468` 全表内存统计改为带索引 `count()` + `filter(status=...)`；`:513` 列表加分页；`device_service.py:130-205` 导入改 `in_()` 批量预取消除行级 N+1
- 实时性：设备状态走已有 WebSocket 推送，替代轮询

**M8. 导入导出模块**（解 A14、F7）
- 流式处理：openpyxl 逐行 / 分块，替代 pandas 全量载入
- 行级错误定位：返回 `[{row: 12, field: '学号', reason: '不存在'}]`，前端表格化展示可跳转修正
- 真实进度替换模拟进度条（`ImportExportPanel.tsx:105-554`）
- 大导出转后台任务 + 完成通知 + 下载链接

### 阶段三：防规模悬崖（性能加固）

**M9. API 保护与缓存**（解 A4、A5、PF1、PF2、PF4）
- 统一分页上限：在 `api_versioning` 或公共 helper 加 `get_pagination(default=20, max=200)`，**27 处读取点统一替换**（`users_routes.py:138` 优先）
- 缓存扩面：成绩列表、学生列表、审批列表、通知历史、班级统计接入 `@cached_api`，目标覆盖率 2.6% → **15%+**（只覆盖高频只读）
- 失效精准化：`api_cache_middleware.py:152` 从 `flush("api:*")` 改为按资源前缀清除（写学生只清 `api:/api/users/*`）
- 预加载补齐：审批列表（学生+审批人）、设备列表（绑定学生）加 `joinedload`

**M10. 异步化与启动优化**（解 A9、A16、PF6）
- NLP 推理（`nlp_routes.py:517,539,560,653,675`）改 Celery 任务 + 任务 ID 轮询 + 超时保护，避免占满 worker
- MQTT 连接确认改为**非阻塞后台重连**，从启动路径移出（预计冷启动 55 s → 25 s 内）
- 模型/词典延迟加载（首次调用时载入）

**M11. 索引纳入部署闸门**（解 A10，成本最低收益最高的一项）
- `create_indexes.py` 改为**幂等**并接入：① 启动时校验关键索引存在，缺失则告警/自动补建；② 部署脚本强制调用；③ 新增闸门脚本 `verify_indexes.py` 纳入 `scripts/run_regression.sh`
- 顺带：`operation_logs_routes.py:96,98` 前置通配 LIKE 改为预聚合计数字段或全文索引（FTS 已有基础设施）

### 阶段四：覆盖面增强

**M12. 管理端移动适配**（解 A13、F4）— 教师手机审批/查分场景
- 基于 M1 的 DataTable：小屏自动切"卡片列表"呈现
- 优先适配 3 个页面：Approvals（手机批假）、ScoreRecords（手机查分）、DeviceManagement（手机解锁）
- 复用已有 `useDeviceDetection`（当前页面层 0 引用）与 `styles/mobile.css`

**M13. 收尾项**
- 首屏瘦身：antd 按需 + 图标按需，目标 452 KB → 350 KB gzip（A15）
- 异常积分归因补全（`anomaly_service.py:445`，A18）
- 无障碍基线：表单 label 关联、关键按钮 aria-label（A19）
- dev-only 漏洞随 eslint 9 升级自然解决，每月复查（A20）

### 路线图依赖关系

```
阶段一 M1 DataTable ──┬─→ 阶段二 M4/M5/M7/M8（都依赖统一表格）
          M2 错误体系 ─┴─→ 所有阶段（错误反馈是共用基础）
          M3 确认统一 ───→ 阶段二（批量操作需要好的确认体验）
阶段三 M9/M10/M11 可与阶段二并行（后端独立）
阶段四 M12 强依赖 M1 完成
```

**关键提醒**：M1 与 M2 是**其他一切的前置**。若资源有限只能做一件事，做 M1；只能做两件，做 M1 + M2。

---

## 九、验收指标（可量化追踪）

| 指标 | 当前 | 阶段一后 | 阶段三后 |
|------|------|----------|----------|
| 列表页 loading 覆盖率 | 9 处 / ~50 页 | ≥90% | ≥90% |
| 骨架屏页面数 | 6 / 56 | ≥30 / 56 | ≥40 / 56 |
| `window.confirm` 数量 | 56 | **0** | 0 |
| 原生 `<table>` 数量 | 36 | ≤10 | ≤5 |
| 响应 message 含 `str(e)` | 150 处 | ≤30（非用户路径） | 0 |
| per_page 上限保护率 | 26% (7/27) | 26% | **100%** |
| `@cached_api` 覆盖率 | 2.6% (12/461) | 2.6% | **≥15%** |
| 虚拟滚动页面数 | 0 | ≥3（大列表） | ≥5 |
| 后端冷启动 | 25–55 s | — | **<25 s** |
| 首屏 gzip | 452 KB | — | ≤380 KB |
| 索引部署闸门 | 无 | — | **纳入回归** |
| 既有闸门（G2/G5/pytest/tsc/eslint/build/vitest） | 全绿 | **保持全绿** | **保持全绿** |

---

## 十、风险与"明确不做"

**风险**
1. **M1 迁移 36 处 table 是大改**：必须"先 5 页试点 → 跑闸门 → 再批量"，禁止一次性全改（沿用 F17 已验证的渐进纪律）
2. **M2 改动 150 处响应文案有契约风险**：G5 OpenAPI 契约校验 461 端点，改 message 内容不改结构应安全，但**每批必跑 G5 --strict**
3. **M9 缓存扩面可能引入脏读**：只对"容忍数秒延迟"的只读聚合加缓存，成绩明细等强一致场景**不加**
4. **M10 NLP 异步化改变前端调用方式**：需前后端同批发布

**明确不做（避免过度工程）**
- 不引入新的状态管理库 / UI 框架（现有 antd + hooks 足够）
- 不为当前 3k 数据量做分库分表、读写分离
- 不追求 100% 无障碍合规（教育内网场景，做基线即可）
- 不重写 F17 防腐层（已稳定，勿动）
- 不因体验优化降低任何既有闸门标准

---

## 附录 A：初查误判修正记录（本次抽查复核成果）

| 初查结论 | 复核结果 | 修正依据 |
|----------|----------|----------|
| `OperationLog.created_at` **缺索引** | ❌ 错误 | 数据库实测存在 `ix_log_created_desc`，查询计划命中（1.2 ms）。真实问题是**索引由手动脚本创建、未纳入部署闸门**（A10）——比原判断更值得修 |
| `useAutoSave`/`useSubmitGuard` **零调用** | ⚠️ 部分错误 | 实际 useAutoSave 用于 `UserList.tsx:296`，useSubmitGuard 用于 ScoreEntry / ExamManagement。真实问题是**推广不足**（1–2 页 / 56） |
| `useConfirmDialog` **未使用**、window.confirm 是唯一方案 | ⚠️ 部分错误 | 实际已在 **11 个页面**使用。真实问题是**双标准并存**，同一页面混用两种确认方式 |

> 这三处修正说明：报告中的每条结论都应带可复现证据。后续评估建议延续"初查 → 抽查复核 → 才入报告"的流程。

---

**报告生成**: 2026-08-19 ｜ 分支 refactor/F17（HEAD 29f82bc）
**建议复评**: 阶段一完成后立即复评用户体验维度（预期 6.5 → 8.0+）
