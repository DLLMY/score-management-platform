# NLP 深化四塔 — 终态汇总与收尾记忆

> 文档收口日期：2026-08-31（#988 / #989 / #990 / #991 + 死代码清理）
> 触发：2026-08-30~08-31 用户连续指令「继续完成未完成的任务」「清理死代码」「继续清理之前的遗留工作，并完善文档」
> 状态：**NLP 深化四塔（#988 情感+同义词 / #989 意图识别 / #990 analyzer 单例污染 / #991 复句贯通）+ 死代码清理 已全部收口**，G2 RBAC / G5 OpenAPI 零漂移，全量 pytest 零回归。

---

## 0. 终态结论

NLP 解析→评分链路在四塔深化后达到生产可用：

- **#988 情感+同义词**：情感否定翻转 + 程度副词深化、公开分析端点复用、同义词合并初始化修复。
- **#989 意图识别**：`determine_intent` 改为「疑问优先 > reset > add/deduct」层级裁决 + 否定前缀过滤；修复「吗/多少分」等疑问标记被配置词表覆盖导致漏判。
- **#990 #929 analyzer 单例污染**：进程级单例 `NLPAlgorithmAnalyzer` 的跨请求累积污染，通过**线程局部缓冲 + 锁内原子提交**消除，保留全局监控大盘与 `reset_metrics` 语义。
- **#991 #930 复句贯通**：移除复句「逐条确认」诚实拒绝，改为**逐子句评分、每条指令独立落库一条记录**，端点返回 `results` 列表。
- **死代码清理**：删除 `NLPService.analyze` 坏方法（误 import 不存在的 `NLPAnalyzer` + 调用不存在的 `analyze` 方法，恒静默失败，无生产调用方）。

全部改动**契约零漂移**（单条路径响应体/状态码/错误信息逐字节不变；仅复句由拒绝变为多记录落库，属用户拍板的契约增强），零回归。

- **G2 RBAC 一致性**：teacher 30 / 关键权限 OK，无缺失。
- **G5 OpenAPI 契约**：实时 swagger 拉取失败时脚本回落静态快照并报 [OK]（后端未启动，既有行为），路径零漂移。
- **全量 pytest + `bash scripts/run_regression.sh`**：5 步闸门全绿（RBAC 一致 / 契约 / 关键路由 / 核心索引 / 「全部回归通过」）。

---

## 1. 四塔覆盖范围与契约影响

| 塔 | 任务 | 核心文件 | 契约影响 |
|---|---|---|---|
| #988 情感+同义词 | 情感否定翻转 + 程度副词 + 同义词合并修复 | `services/nlp_enhanced_service.py`（`analyze_sentiment` 等） | 零漂移（评分/解析行为增强） |
| #989 意图识别精度 | 疑问优先层级裁决 + 否定前缀过滤 + `involves_scoring` 双条件 | `services/nlp_enhanced_service.py`（`determine_intent` / `multi_intent_detection`） | 零漂移（意图判定更准，输出键不变） |
| #990 #929 analyzer 污染 | 线程局部缓冲 + `flush_request_metrics` 锁内原子提交 | `services/nlp_analyzer_service.py` + `api/nlp/nlp_routes.py`（写端点 flush） | 零漂移（仅内部聚合时序修正，监控大盘语义不变） |
| #991 #930 复句贯通 | `_split_compound_text` + `execute_scoring` 递归 + `results` 列表 | `services/nlp_enhanced_service.py` + `frontend/src/pages/NLPManagement.tsx` | **契约增强**：复句由拒绝→多记录；单句路径不变 |
| 死代码 | 删除 `NLPService.analyze` 坏方法 | `services/nlp_service.py` + 2 测试引用 | 无生产调用方，删除零影响 |

---

## 2. 各塔实现要点

### #990（#929 analyzer 单例污染）— 生产级修复
- **根因**：进程级单例 `NLPAlgorithmAnalyzer` 的 `intent_metrics` / `performance_metrics` / `error_analysis` / `request_history` / `component_stats` 为全局可变态，跨请求累积，造成监控指标污染。
- **方案（用户 AskUserQuestion 选 Option1 全局聚合+请求原子写入）**：
  - `__init__` 末加 `self._local = threading.local()`（与 `self._lock` 并列）。
  - `record_intent_prediction` / `record_performance` / `record_error` / `record_component_call` / `add_request_to_history` 全部改为写入 `self._get_buffer()`（线程局部 list），不再直接改全局态。
  - 新增 `_get_buffer()` / `flush_request_metrics()` / `_apply_event()`：读端点（`get_intent_analysis` 等）首行 flush；写端点（`/feedback/record`、`/analyze`）请求结束前 flush；`reset_metrics` 同步清空缓冲。
- **效果**：请求处理期只写自身线程缓冲，永不触碰共享全局态；提交是锁内原子批次，外部读取不观察半写入状态。

### #991（#930 复句/多意图贯通评分）
- **契约（用户 AskUserQuestion 选 q-0 全量贯通+返回列表）**：移除复句 early-reject，对每条 valid intent/subclause 循环评分并落库 N 条记录，端点返回 `results` 列表。
- **实现**：
  - 新增 `_split_compound_text(text)`：按中英文标点 `[，,；;。.、！!？?\n\r]+` 拆分子句、过滤空串（**刻意不含空格**，避免破坏「张三 上课认真 加5分」这类单意图短语）。
  - `execute_scoring` 签名加第 4 个可选参数 `sub_clause=False`（外部/路由仍传 3 个位置参数，默认 False，**零契约漂移**）；递归子调用传 `sub_clause=True` → **天然防无限递归**。
  - 原 S6-B-P0-2「多条评分指令，请逐条确认」拒绝块替换为：`len(valid_intents) > 1 and not sub_clause` 时逐子句递归 `self.execute_scoring(sub, None, context_history, sub_clause=True)` 收集结果，返回 `{success, message, results, count}`（任一子句失败 → 整体 success=False，message 标注「部分未成功」）；**无法按句拆分的退化多意图仍保留诚实拒绝**（避免静默漏记首条之外）。
  - 子调用各自走完整单条路径（ScoreRecord 流水 + atomic_score_update + 综合分重算 + NLPRuleUsage/NLPMatchResult + `_update_context_memory`），故**每条指令独立落库一条记录**。
- **前端**：`NLPManagement.tsx` 三处执行点（`executeScoring` / `applySuggestionAsRule` / `handleManualExecute`）改为按 `response.results` 提示「成功评分 N 条指令」；用 `as { results?: Array<{ success?: boolean }> }` 断言规避 `any`（`api.nlp.execute` 返回 `Promise<unknown>`，且 `request` 层已 `unwrapEnvelope` → response 即后端 result 字典）。

### 死代码清理
- `NLPService.analyze`（原 `nlp_service.py:255-262`）：`from services.nlp_analyzer_service import NLPAnalyzer`（误 import，实际类名已改为 `NLPAlgorithmAnalyzer`）+ 调用 `analyzer.analyze()`（该类无 `analyze` 方法）→ 恒 `AttributeError` 被 `except` 静默吞掉，永远返回 `{"success": False}`；无任何生产路由/前端调用，仅 2 个宽松测试引用。
- **处置**：删除 `NLPService.analyze` 方法（保留 `NLPService` 其余 `parse` / `parse_batch` / `optimize` / `get_stats` / `warmup`）；同步删除 2 个测试引用 `test_nlp_service.py::test_analyze_text`、`test_nlp_performance.py::test_nlp_analyze_function`（两测试仅断言「返回 dict」，属对坏方法的无效覆盖）。
- 保留项：`nlp_analyzer_service.py:492` 日志标签字符串 `[NLPAnalyzer] 指标已重置` 仅作日志前缀、不指向符号，按最小改动原则保留未动。

---

## 3. 迁移中修复/增强的行为（测试先行暴露）

| 塔 | 行为变更 | 验证 |
|---|---|---|
| #989 | 疑问标记（「吗/多少分」）此前被配置词表覆盖导致意图漏判 → `involves_scoring` 双条件修复 | 新增 4 回归测试锁定否定/疑问优先级 |
| #991 | 复句由「逐条确认拒绝」反转为「逐子句评分落库 N 条」 | `test_regression_20260817.py::test_nlp_multi_intent_rejected` 原断言「多条评分指令 in src」**反转**为锁定新行为（`_split_compound_text` + `for sub in` / `results` + `count` + `ScoreRecord(` + `atomic_score_update`）；`test_nlp_execute_service.py` 新增 2 行为测试（2 子句→2 记录；部分失败→整体 False + 标注） |
| 死代码 | 删除恒失败坏方法 | 2 测试引用同步移除，17 passed |

---

## 4. 回归闸门证据（全绿）

| 闸门 | 命令/工具 | 结果 |
|---|---|---|
| 后端编译 | managed Py3.13.12 `py_compile` 改动文件 | ✅ OK（四塔 + 死代码） |
| 后端定向 pytest（#988/#989） | 系统 Py3.11 `test_nlp_enhanced_service + test_regression_20260817` | ✅ **57 passed, 1 warning** |
| 后端定向 pytest（#990） | 系统 Py3.11 `test_nlp_analyzer_service.py` | ✅ **33 passed** |
| 后端定向 pytest（#991） | 系统 Py3.11 `test_nlp_execute_service.py + test_regression_20260817.py` | ✅ **27 passed**（EXIT=0） |
| 后端定向 pytest（死代码） | 系统 Py3.11 `test_nlp_service.py + test_nlp_performance.py` | ✅ **17 passed**（EXIT=0） |
| 全量回归 | 仓库根 `bash scripts/run_regression.sh` | ✅ **REG_EXIT=0 全部回归通过**（RBAC 一致 / 契约 / 关键路由 / 核心索引） |
| 前端类型 | managed Node22 `tsc --noEmit` | ✅ exit 0 |
| 前端 lint | managed Node22 `eslint src --ext .ts,.tsx` | ✅ 0 error（2 warning 为 `useApiFetch.ts` 既有） |
| 前端单测 | managed Node22 `vitest.mjs run --pool=forks src/tests/components/NLPManagement.test.tsx` | ✅ 2 passed |

> 注：`run_regression.sh` 第 2 步实时 `swagger.json` 拉取失败（后端未启动，`WinError 10061`）为既有非阻塞行为，脚本自动回落静态快照并报 [OK] 契约测试通过。

---

## 5. 防腐层/契约铁律（面向未来维护）

1. **#990 范**：`NLPAlgorithmAnalyzer` 的 `record_*` 只允许写线程局部缓冲，聚合提交必须经 `flush_request_metrics()`（锁内原子）；禁止在请求处理期直接改全局可变态。
2. **#991 范**：复句评分入口恒为 `execute_scoring(text, manual_correction, context_history, sub_clause)`；递归子调用必须 `sub_clause=True` 防无限递归；新增评分落库逻辑须复用完整单条路径（流水+原子更新+综合分重算+规则/匹配记录+上下文记忆）。
3. **契约零漂移**：单条路径响应体/状态码/错误信息逐字节不变；create 端点历史双元组 `[dict, 201]` 信封形态保留。
4. **禁止静默失败**：任何解析/评分异常不得 `except: pass`；前端 `useApiFetch` 已日志化（T11），后端 analyzer 写路径已 fail-observable（T9 / #990）。
5. **死代码原则**：误 import 不存在符号或被 try/except 静默降级的调用，属死代码，按本收尾方式清理而非保留。
6. **禁止一次性全改**；**禁止 git commit**（须用户明确指示）。

---

## 6. 待办 / 下一步

- **NLP 深化四塔（#988/#989/#990/#991）+ 死代码清理 全部收口**，整体工作树（含 F17、格式化/命名、文档重组等多条工作流）仍有 **2 本地 commit（b380129 / c3e751b）待 push + 大量未提交 M 文件**，须经用户明确指示才 commit/push。
- **文档重组观测（未擅自处置）**：`git status` 显示 `docs/项目文档汇总/` 为空的新目录、`docs/archive/doc/项目文档/` 有 12 个 `.md` 被删（D），疑似一处未完成的文档移动重组（源删、目标空）。该重组存在歧义，**未触碰**，待用户定夺是否继续/回退。
- 已知非阻塞：`run_regression.sh` 实时 `swagger.json` 拉取失败回落静态快照（见 §4 注）。
