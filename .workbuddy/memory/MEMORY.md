# 管理平台设计 — 长期记忆

> SOP 已下沉 `~/.workbuddy/skills/`（backend-pytest-env-restore · black-batch-eol-safe · c901-cyclomatic-refactor · dirty-worktree-commit-split · frontend-dead-code-removal · frontend-import-barrel-unification · route-try-except-to-decorator · ts-noimplicitany-enable · react-page-split）。细节看 `memory/YYYY-MM-DD.md`。

## 运行 / 测试（口径固定）
- 后端：系统 Py3.11 起 `python run.py --env development --host 127.0.0.1 --port 5000`；改后端**强杀全部 python 再重启**（SocketIO 不 reload）。
- pytest/run_regression **必须** `apps/backend/.venv/Scripts/python.exe`（系统 Py3.11 缺 werkzeug）。全量串行基线 = **2084 passed / 7 skipped / 0 failed**（判回归：失败必须为 0）；勿用 `-n 4` xdist（2 个 nlp_performance 假失败）；串行 3 批分跑。C901 抽取后须复扫源码文本类测试（`inspect.getsource` 断言会被搬家 helper 静默破坏，正解=对象级断言，见 skill c901 §9）。
- 前端四闸门 managed Node 22.22.2 **直调二进制**（勿用 `.bin/*`；prettier 是 `bin-prettier.js`）：`typescript/bin/tsc`、`eslint/bin/eslint.js`、`prettier/bin-prettier.js`、`vitest/vitest.mjs run`。基线 38 文件 / **276 passed / 3 skipped**。
- 单测三要素：退出码=0；无 failed；报告文件数==磁盘文件数。push 后 `git ls-remote` 核实；**禁 commit 除非用户显式要求**。
- ruff 唯一口径 `ruff check apps/backend`（+`--select C901`）；基线默认 2259 / C901 46（2026-09-12）。run_regression 5 闸门用 PowerShell 直跑（sh 被沙箱拦）；回归日志剔 `\0` 再 UTF8。

## 已收官（勿再排期）
- C901 收口 12 函数（58→46→**47**，剩 47 项须用户逐项拍板）；safe_handle 收敛 18 处**已收官**（12 项硬拒判据在 skill route-try-except-to-decorator）；**F17 路由服务化已收官**（防腐层 + 路由层写路径下沉:实测 `api/` 内联写=0、写逻辑全在 `services/`;`system memory`「剩余106处写路径」为过时描述,以 `2026-09-12.md:225` 为准）· B3 to_dict · E1–E6 · NLP 四塔 · components/hooks barrel · 班主任工作台（12 子页+聚合首页 `/workbench`）· M9 分页（`utils/pagination.py`）。
- **06 差异 17 项全量落地已收官**（2026-09-12，详见 `memory/2026-09-12.md`）：含 #1 device_type 维度 / #2 回滚 / #3 心跳统一 / #4 设备认证三阶段 / #5 重启定向 / #6 下载签名 / #7 points 幂等 / #8 日限额 / #9 版本比较统一 / #10 在线判定 / #11 错误告警 / #12 device_type 透传 / #13 在线列表两段式 / #14 unlock payload / #15 device_id 校验 / #16 box 幂等 / #17 reason 常量。全量回归 2084/7/0 + 前端四闸门全绿。
- **06 收口轮三项已收官**（2026-09-12 晚）：① 旧 `docs/MQTT_INTEGRATION.md` **已归档**至 `docs/archive/doc/MQTT文档/MQTT_INTEGRATION_20260520_已废弃.md`（根 README 引用已改指 `docs/esp32/`）；② **差异 #4 阶段 3 前端 UI 已补齐**（`DeviceSecretPanel.tsx` + `useDeviceSecretDomain.ts`，入口在**设备设置弹窗内**）**并顺带补齐阶段 1 白名单开关**（`Settings` 页新增「设备接入安全」区块）；③ skill 库归置**只出报告未动文件**（`docs/reports/skill库归置报告-20260912.md`）。
- ⚠️ 过时文档（引用前复核）：`下一步开发计划-20260824.md` T7/T8/T10/T11 已闭环；`班主任工作台优化方案` P3 A 批已闭环。

## 后端铁律
- 路由唯一源 `app/api_versioning.py::register_v1_routes`（注意在 `app/` 不是 `utils/`）；信封 `{success,code,data}`；create 双元组 `[env,201]` 勿改；**未跑回归=重构未完成**；新建工具前先 Glob。
- RBAC：改后必跑 `verify_rbac_consistency.py --check-only`（G2 68/DB 70/seed 66/teacher 30）；班级隔离 `_CLASS_SCOPE_PREFIXES` 12 词根自动 403，**新增班级模块必须加词根**；`db_session_scope` 请求链 service 写路径须 `detach=False`。
- ⚠️ **「统一命名」≠ 改线上取值**：枚举常量化的正确姿势是**只收拢字面量**，绝不做跨语义合并。反例（本轮踩过）：`not_in_time`（派发层，全局 TimeRule）与 `not_in_time_window`（判定层 validate_unlock）是**两个不同语义的独立常量**，合并即破坏设备端/前端匹配。同理 `user_blacklisted` ≠ `user_permanently_blacklisted`。判据：**该值是否已被下游按字面量匹配**？是 → 原样保留。
- ⚠️ **收紧判据必须留兼容兜底**：把 `device.status == "online"` 换成 `is_device_online()` 会让「有 status 无 last_heartbeat」的既有数据从在线翻转为离线（破坏性）。正解=`is_device_online(device) or device.status == "online"`（两口径取或）。

## 前端规范
- tsconfig 严格档全收口；禁新增 `any`；`React.ComponentType`（禁 `<unknown>`）；导入走 barrel（新增子目录建 index.ts）；Context value 必须 useMemo；src 全 LF；prettier 100/singleQuote/semi/jsxSingleQuote/lf。
- hook 复用优先：useStableToast/useSubmitGuard/useForm/useListFetch/useListData/useWorkbenchClass/useDebouncedValue/useModal/usePermissions。
- 重构范式 E6a/D2：hook 含 JSX 必 `.tsx`；搬 types.ts 要 export；复合类型 `ReturnType<typeof useXxx>`。

## T12 巨型页拆分（✅ 已收官，判据达成）
- 判据=单文件行数；**实测 `pages/**` 共 360 个 `.ts/.tsx`，≥600 行者 = 0**（最大 591 examManagement/useExamManagementLogic）。四闸门全项目绿：tsc=0 / eslint 0 error（仅 4 个 `confirmRef` ref 既有 warning）/ prettier --check 全绿 / vitest **276 passed / 3 skipped**。
- 拆法：**B**（View 型纯搬迁：组件/纯函数/常量/types/列定义外提 + re-export）· **C**（god hook 按域切：组合根持共享原语，SharedDeps 注入子 hook，子 hook 顶部解构出原名、函数体逐字原搬）。
- 全部批次 commit：T12-1 `e4f05e4` / T12-2 `35bbe51` / T12-3 `7e66874` / T12-4 `025b00e` / T12-5 `f74a0de` / T12-6 `3254750` / T12-7 `67e57fc` / T12-8 `773f3e9` / T12-9a `5152809` / T12-9b `f7751f0` / T12-10a `f9ff191` / T12-10b `f8f28ff` / T12-10c `3be7992` / T12-10d `28e2295` / T12-10e `036146f` / T12-10f `9c22489` / T12-10g `68e8fac` / T12-10h `1095b92` / T12-10i `066485d` / prettier 补格式 `866643e`。
- 拆分手法定型（7 条坑，含「deps 类型须真源派生」「spread 键完备性须用类型级 `Exclude<Needed, keyof ReturnType<typeof useX>>` + tsc 校验，Python 正则脚本不识别 spread」）见 `memory/2026-09-12.md`「T12 战役收官」段；范式 SOP 在 skill `react-page-split`；脚本沉淀 `.workbuddy/tmp_scan/equiv_t12*.py`。

## OTA/手机箱真实状态（2026-09-15 复评修正）
- **`device_type` 维度已闭合**：`device_models.py:155` 的 `FirmwareVersion` 已加 `device_type` 列（`server_default="phonebox"`, index），`get_latest_active_firmware` 按设备类型精确匹配——这是 06 差异 #1 收官的一部分。**此前「FirmwareVersion 无 device_type 维度」描述已过时，作废。**
- 仅剩 **F1 五阶段**的 `negotiate()`/`/ota/check` 推送闭环（设备类型主动上报→版本协商→自动推送）**仍按用户明确决定延期**，非技术阻塞。方案见 `docs/特性任务优化方案-20260912.md`。

## ESP32 硬件对接文档（唯一入口 `docs/esp32/`）
- 7 文件套件：README + 01 MQTT 通信协议 / 02 设备识别与注册认证 / 03 积分逻辑 / 04 OTA 升级设计 / 05 其他对接与多设备管理 / 06 差异同步与优化方案。**硬件对接问题先查这里**；`docs/MQTT_INTEGRATION.md`（旧）已过时，仅作历史参考。
- 铁律：**后端源码是唯一事实来源**。文档引用的常量/字段名/topic/reason 码必须 grep 溯源后再落笔（本轮曾凭印象写错日限额与 reason 码）。
- 差异清单 17 项，最高危 = #5 `_send_device_restart` 广播 `phonebox/control/restart` 不含 device_id（单设备重启会引爆全校）。其余见 `06-差异同步与优化方案.md` 排期表。

## 关键坑
- SQLite join User 双 join → ambiguous column，单次 join；run.py 只 load `.env`（`--env` 不切文件）；conftest 动态 Namespace 须自带 `path="/mental-health"`；sandbox torch 先 `import services.nlp_ml_service` 预热。
- ⚠️ **EOL 铁律**：backend **多数** `.py` 为 CRLF，**禁 Edit 直改**，须 python 二进制读改写（字节判据 `b"\r\n"`）。**但存在纯 LF 例外**（已实测：`api/scores/records_routes.py`、`api/algorithm/algorithm_routes.py`、`app/api_versioning.py` 等均为 LF）——改写前**必须逐文件检测实际行尾**再按该文件自身风格守恒，切勿断言 `crlf>0`（本轮曾因此误报失败）。
- ⚠️ Edit 同文件多次编辑勿放同一并行批次（会静默丢写）；`&&` 链断致假绿 → 校验段用 `;` + `echo EXIT=$?`；快照 diff 先证确定性；harness 必先自检。
- 引用 `docs/` 审计文档前必须实测复核；grep 权限词根带 `-A3`，前后端权限逐路由比对。
- ⚠️ **grep 被 SIGTERM 截断 = 假「0 引用」**。长 grep 必须先拆/后台化；**任何删除/归档操作前必须用 `Grep` 工具二次确认引用**（本轮若信了上轮的「0 引用」直接删，根 `README.md` 会留永久断链）。
- ⚠️ **同名类型/同名对象多处定义是本仓常态**。改前先 grep 全仓定位「真实类型源」——`api.ts` 的 `devices` 有**接口声明（~2378）与实现（~5205）两份**；`SystemConfig` 有 `types/index.ts:310` 与 `api.ts:1551` 两份且 `Settings.tsx` 用后者。`tsc` 报 `TS2353`/`TS2339` 基本就是这个原因 → **两处都要改**。
- ⚠️ **行尾守恒断言须按「多数风格」写**：先同时看 `crlf` 与 `bare` 两个计数判定风格，再断言该风格计数不变。对纯 LF 文件断言 `bare_lf == 0` 必然失败（本轮踩过）。
- 前端 `Device.id` 类型是 `ID`（`string | number`），传 REST 接口前须 `Number(...)` 转换。
