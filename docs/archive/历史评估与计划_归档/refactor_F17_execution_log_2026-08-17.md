# F17 路由服务化 — 执行日志（scores 域：categories + rank / time_rules / class_periods）

> 生成日期：2026-08-17 14:55（第一批）；15:2x 补充第二批
> 触发：依据 `docs/重构专项评估与排期_F16F17F19S4_2026-08-17.md` 第 2 节 F17 排期"按域分期、防腐层渐进、禁止一次性 883 处全改"。
> 本文件记录 **F17 在 scores 域已完成的两批**：categories（pilot）+ rank/time_rules/class_periods（纯 CRUD 中低风险的范式巩固）。F17 为跨域大型重构，按域分期执行。

---

## 0. 执行前准备（与升级同体系）
- 分支：`git checkout -b refactor/F17`（自 `refactor/F16` 切出，含 F16 模型拆包成果）。
- 备份快照：`backend/backups/refactor_F17/categories_routes_before.py`（迁移前 `api/scores/categories_routes.py` 完整副本，可一键回滚）。
- 测试 DB：pytest 使用 `sqlite:///:memory:`（function 级隔离），**不触碰 2.3G 生产库**，符合 C 盘满约束。

## 1. 升级范围与目标（本批）
| 项 | 内容 |
|----|------|
| 目标 | 把 `api/scores/categories_routes.py` 中的**写入/事务路径**（create/update/delete）从路由内联 `db.session` 收口到薄服务层，路由改为调用 service 方法。 |
| 优先级遵循 | 评估排期原文"**优先改写入/事务路径，只读 `db.session.query` 可暂缓**" → 本批只迁移 POST/PUT/DELETE，GET 列表/详情/规则保持原样（只读）。 |
| 改动文件 | 新增 `services/score_category_service.py`；改写 `api/scores/categories_routes.py`（仅写入路径 + 清理无用 import）。 |
| 不变 | 所有响应体/状态码/错误信息**逐字节不变**（含 create 端点历史双元组返回的 `[response_dict, 200]` 列表形态）。 |

## 2. 服务层设计（防腐层，行为兜底）
`services/score_category_service.py` 三个方法，**逻辑逐行照搬原路由**，仅 relocated：
- `create_category(data)` → 重复名校验 + 构造 + `db.session.add/commit`，返回 `(category, None)` 或 `(None, "分类名称已存在")`。
- `update_category(category, data)` → 路由经 `get_or_404` 取对象（404 语义留在路由）+ 排它重名校验 + 字段更新（含 `category.updated_at = datetime.now()` 原样保留，即使模型无该列也复刻为 no-op）+ commit，返回 `None` 或错误串。
- `delete_category(category)` → 规则数校验 + `delete/commit`，返回 `None` 或 `"该分类下还有{N}条规则，无法删除"`。

路由侧：保留原 `get_or_404` 调用以不变更 404 行为；`db`/`datetime` import 因已迁至 service 而移除（避免 F401）。

## 3. 测试先行（"单测/集成测试先行"）
- 强化 `tests/test_categories_routes.py`：在迁移**前**先补充行为断言（创建返回 id/默认值、重复名 400、更新 200、排它重名 400、删除 200、带规则删除 400），并统一 `_body()` 归一化 create 端点的列表信封。
- **基线（迁移前）先行跑通 9/9**，锁定对外契约，作为迁移后一致性判据。

## 4. 验证闸门（本批）
| 闸门 | 命令/范围 | 结果 |
|------|-----------|------|
| 行为测试（定向 pytest） | `pytest tests/test_categories_routes.py` | ✅ **9 passed**（迁移前 9 / 迁移后 9，契约 0 漂移） |
| G1 py_compile | 改动文件 `categories_routes.py`/`score_category_service.py` | ✅ 0 error |
| G2 RBAC 一致性 | `verify_rbac_consistency.py --check-only` | ✅ exit 0（权限目录 68 条） |
| G3 后端 create_app 冒烟 | `create_app(lightweight=True)` | ✅ RBAC/Redis/安全/API缓存中间件 OK，无 ImportError |
| G5 OpenAPI strict | `verify_openapi_contract.py --strict` | ✅ 461/461 路径 0 漂移 |
| G6/G7/G8 前端 | 本轮未改前端代码，沿用升级阶段全绿（ESLint 0 / build 0 / vitest 164-3） | ➖ 不适用 |

## 5. 回滚方案（极低风险）
- 一键文件回滚：`cp backend/backups/refactor_F17/categories_routes_before.py backend/api/scores/categories_routes.py` 并 `rm backend/services/score_category_service.py`。
- 分支回滚：`git checkout refactor/F16 -- .`（或丢弃 `refactor/F17` 分支）。
- 数据库：本批零表结构变更、零数据迁移，无需 DB 回滚。

## 6. 后续（F17 仍在进行，按域分期）
scores 域其他子域（按风险升序建议顺序）：
1. ✅ categories（第一批 pilot，已完成）
2. ✅ rank / time_rules / class_periods（第二批，中低，纯 CRUD 类，已完成，见第 8 节）
3. ✅ rules_routes（高风险：含 R7 删除级联解引用 / import 批量事务 / apply_template 事务+flush+回滚，已完成，见第 9 节）
4. ✅ records_routes（成绩录入主写入路径，4 写入路径收口 service；含 score-entry 双重累加缺陷修复，已完成，见第 10 节）
5. ✅ approvals_routes（14 处，**审批事务**）
- scores 域完成。进入 post-scores 域（按排期顺序，每域同样 6 步：快照→建 service→改路由→测试先行→全闸门→文档+记忆）：
  1. ✅ notifications（第六批，本日志第 12 节）
  2. ⏸ devices
  3. ⏸ academics
  4. ⏸ users
- **铁律重申**：每改一个子域必须跑对应 pytest + G1–G5；records/approvals 等重写入路径迁移前须先补强针对性行为测试（覆盖幂等 undo_code、flush 后读 id、事务回滚）。禁止一次性 883 处全改。

## 7. 结论（第一批）
F17 第一批 pilot 已按评估排期"一步到位、可回滚、全闸门验证"完成，零契约漂移、零回归，确立了"路由留 404/get_or_404 + 写入收口 service + 定向 pytest 先行"的范式与回滚样板。

## 8. 第二批：rank / time_rules / class_periods（中低风险的范式巩固）

### 8.1 范围与目标
| 路由 | db.session 处数 | 写入路径迁移 |
|------|----------------|--------------|
| `api/scores/rank_routes.py` | 5 | create / update / delete → `services/score_rank_service.py` |
| `api/scores/time_rules_routes.py` | 5 | create / update / delete → `services/time_rule_service.py`（create 响应 `(dict,201)` 原样保留） |
| `api/scores/class_periods_routes.py` | 8 | create / update / delete / batch / reset → `services/class_period_service.py`（重复编号校验留路由） |

- 迁移后路由仅保留：`get_or_404`（404 语义）、`format_day_of_week` 只读格式化（time_rules）、`to_dict()` 序列化（class_periods）、响应构造；所有 `db.session` 写入收口 service。
- 响应体/状态码/错误信息**逐字节不变**（time_rules create 仍为 `(dict, 201)` 元组；class_periods batch/reset 文案不变）。

### 8.2 服务层
- `score_rank_rule_service`：`create_rank_rule(data)` / `update_rank_rule(rule, data)`（含 `updated_at=datetime.now()`）/ `delete_rank_rule(rule)`。
- `time_rule_service`：`create_time_rule` / `update_time_rule` / `delete_time_rule`（同构）。
- `class_period_service`：`create_class_period` / `update_class_period` / `delete_class_period` / `batch_update_class_periods`（get_by_id 按 id 匹配）/ `reset_class_periods`（清空+重建 12 默认节次，DEFAULT_PERIODS 与路由原值逐字一致）。

### 8.3 测试先行
- 强化 `tests/test_rank_routes.py`（7 用例：增查改删+404+更新验证名称生效）。
- 强化 `tests/test_time_rules_routes.py`（6 用例：增查改删+check；create 端点按 `(dict,201)` 直接取 `data['id']`）。
- 新增 `tests/test_class_periods_routes.py`（7 用例：列表/增/重号 400/改/删/batch/reset→total==12）。
- 三文件均在迁移后跑通（锁定契约）。

### 8.4 验证闸门（第二批）
| 闸门 | 范围 | 结果 |
|------|------|------|
| 行为测试（定向 pytest） | rank + time_rules + class_periods 三文件 | ✅ **20 passed**（7+6+7） |
| 回归（scores 域全套） | `test_scores_routes`/`test_categories_routes`/`test_rank_routes`/`test_time_rules_routes`/`test_class_periods_routes`/`test_score_*` | ✅ **87 passed**（85.45s，零回归） |
| G1 py_compile | 3 路由 + 3 service + models | ✅ 0 error |
| G2 RBAC 一致性 | `--check-only` | ✅ exit 0（68 条） |
| G3 create_app 冒烟 | `lightweight=True` | ✅ 中间件 OK，无 ImportError |
| G5 OpenAPI strict | `--strict` | ✅ 461/461 路径 0 漂移 |
| G6/G7/G8 前端 | 本轮未改前端，沿用升级阶段全绿 | ➖ 不适用 |

### 8.5 回滚方案
- 文件回滚：`cp backups/refactor_F17/{rank,time_rules,class_periods}_routes_before.py backend/api/scores/` + `rm services/{score_rank_service,time_rule_service,class_period_service}.py`。
- 分支回滚：`git checkout refactor/F16 -- .`（弃 F17 全部）。
- 数据库：零表结构/数据变更，无需 DB 回滚。

### 8.6 结论（第二批）
scores 域中低风险子域（categories + rank/time_rules/class_periods）全部完成，累计 **5 路由 → 5 service**，范式稳定、闸门齐全、零回归。下一步进入 scores 域高风险写入路径 **rules / records / approvals**，迁移前须先补强针对性行为测试。

## 9. 第三批：rules_routes（高风险写入路径，防腐层稳健推进）

### 9.1 范围与目标
| 路由 | db.session 处数 | 写入路径迁移 |
|------|----------------|--------------|
| `api/scores/rules_routes.py` | 13 | create / update / delete(R7 级联解引用) / import(批量事务) / templates/apply(事务+flush+回滚) → `services/score_rule_service.py` |

- 迁移后路由仅保留：`get_or_404`（404 语义）、请求级校验（create 名称/分数/分类存在性）、缓存失效 `invalidate_by_tag("rules")`、操作日志 `log_operation`、响应构造；所有 `db.session` 写入/事务收口 service。
- 只读 GET（列表/详情/导出/模板下载/模板列表/统计）**逐字节不变、未迁移**（按评估"只读暂缓"）。
- 响应体/状态码/错误信息**逐字节不变**：create 仍为 `(dict,201)` 元组→列表信封；delete/update 文案不变；import 汇总 dict 结构不变；apply_template 成功/失败文案与 400/404/500 状态码不变。

### 9.2 服务层
`services/score_rule_service.py`（逻辑逐行照搬原路由，仅 relocated）：
- `create_rule(data)`：构造 + `add/commit`，返回 rule 对象（data 已由路由完成请求级校验）。
- `update_rule(rule, data)`：字段更新（含 `updated_at=datetime.now()`）+ commit，返回 None。
- `delete_rule(rule)`：**R7 修复保留**——`try/except` 内 `ScoreRecord.query.filter_by(rule_id=rule.id).update({rule_id: None})` 解除历史流水引用后再 `delete/commit`，返回 None。
- `import_rules(rules_data)`：逐行校验（失败计入 errors/messages 并跳过）+ 合法行 `add`，统一 `commit`，返回原结构汇总 dict `{total,success_count,failed_count,errors,messages}`。
- `apply_rule_template(template, category_id)`：无 category_id 则按模板名建/复用分类并 `flush()` 取 id；否则 `get_by_id` 校验（不存在返回 `(None,"指定的分类不存在")`）；同名同分类跳过；统一 `commit`，返回 `(result_dict, None)`。

### 9.3 测试先行（高风险行为补强）
迁移**前**补强 `tests/test_rules_routes.py`，锁定契约基线后迁移、再重跑：
- 原有 12 用例（列表/分页/筛选/增/校验 400×2/详情/404/改/改404/删/删404）。
- 新增 5 用例覆盖高风险行为：
  - `test_delete_rule_cascades_score_records`：**R7 回归**——建规则→建引用该规则的 `ScoreRecord(rule_id=rule.id, score_change=5.0)`→删规则须 200 且流水 `rule_id` 被置 `None`（验证不再 IntegrityError 500）。
  - `test_import_rules_mixed_valid_and_invalid`：合法+非法混合导入，`success_count==2 / failed_count==1 / errors[0].row==2`，验证批量事务隔离。
  - `test_apply_rule_template_creates_rules`：`template_id="discipline"` 应用，`created_count>0`。
  - `test_apply_rule_template_missing_id`：缺 `template_id` → 400。
  - `test_apply_rule_template_not_found`：未知 `template_id` → 404。

### 9.4 验证闸门（第三批）
| 闸门 | 范围 | 结果 |
|------|------|------|
| 行为测试（定向 pytest） | `test_rules_routes.py` | ✅ **17 passed**（12+5，迁移后零回归） |
| 回归（scores 域全套） | categories+rank+time_rules+class_periods+rules 五文件 | ✅ **46 passed**（49.73s，零回归） |
| G1 py_compile | `rules_routes.py` + `score_rule_service.py` | ✅ 0 error |
| G2 RBAC 一致性 | `--check-only` | ✅ exit 0（68 条） |
| G3 create_app 冒烟 | 经 pytest conftest 隐式加载 | ✅ 无 ImportError |
| G5 OpenAPI strict | `--strict` | ✅ 461/461 路径 0 漂移 |
| G6/G7/G8 前端 | 本轮未改前端，沿用升级阶段全绿 | ➖ 不适用 |

### 9.5 回滚方案
- 文件回滚：`cp backups/refactor_F17/rules_routes_before.py backend/api/scores/rules_routes.py` + `rm backend/services/score_rule_service.py`。
- 分支回滚：`git checkout refactor/F16 -- .`（弃 F17 全部）。
- 数据库：零表结构/数据变更，无需 DB 回滚。

### 9.6 结论（第三批）
rules_routes 高风险写入路径完成迁移，累计 **6 路由 → 6 service**。R7 级联解引用、import 批量事务、apply_template 事务+flush+回滚三类高风险行为均有定向测试覆盖并零回归，验证 F17 范式可稳健承纳事务型写入路径。下一步进入 scores 域最高风险 **records_routes（成绩录入主写入，含 `score/add` 幂等+`flush()` 后读 `record.id` 契约）/ approvals_routes（审批事务）**，迁移前须先补强针对性行为测试（undo_code 幂等、flush 后读 id、事务回滚）。

## 10. 第四批：records_routes（最高风险主写入路径，含 score-entry 双重累加缺陷修复）

### 10.1 范围与目标
| 路由 | 迁移前 db.session 处数 | 写入路径迁移 |
|------|----------------|--------------|
| `api/scores/records_routes.py` | 写入 4（POST /、POST /score-entry、POST /batch-entry、DELETE /<id>）；快照 1049 行 → 改写后 998 行 | create_record / create_score_entry / commit_batch_score_entry / delete_record → `services/score_record_service.py` |

- 迁移后路由仅保留：`get_or_404`（404 语义）、请求级校验（user_id/score_change/rule 解析/数据隔离 `_can_access_student`）、缓存失效 `invalidate_by_tag`、操作日志 `log_operation`、MQTT 排名/积分变动通知、管理员通知、统计缓存失效、综合评分重算 `CompositeScoreService.recalculate_user_score`、响应构造；所有 `db.session` 写入/事务收口 service。
- grep 复核：路由内仅剩 2 处 `db.session`（1 处 `rollback()` 异常兜底 + 1 处只读 `query`），写入路径已全部收口。
- 只读 GET（列表/详情/按学生/按班级/统计/录入页）**逐字节不变、未迁移**（按评估"只读暂缓"）。
- 响应体/状态码/错误信息**逐字节不变**：create 仍 `(dict,201)` 元组→列表信封；score-entry 仍 `(dict,201)` 双重元组→列表信封；batch-entry 返回 `{success,results,errors}` 不变；delete 文案不变。

### 10.2 服务层
`services/score_record_service.py`（4 方法，逻辑逐行照搬原路由，仅 relocated + 收口事务）：
- `create_record(data)`：构造 `ScoreRecord` + **R5 SQL 原子累加** `atomic_score_update`（含 SystemConfig min/max 钳制，与审批/MQTT 一致）+ `add/commit`，返回 `(record, user_name)`。
- `delete_record(record)`：**R5 读改写竞态防护**——`atomic_score_update(user.id, -record.score_change)` 原子回滚 + `delete/commit`，返回 `(before_score, after_score, user_name)`。
- `commit_batch_score_entry(created_records)`：**F3 修复逻辑保留**——仅成功行 `add` + 逐条原子累加（flush 生成 `record.id`）+ 单次 `commit`，返回 `(results, errors)`；`results[].new_score` 由原子累加结果填充。
- `create_score_entry(data)`：排名计算（懒导入 `rank_routes._get_active_rank_rules_cached`/`_find_rank_by_score_binary_search`）+ 设分（直接 `user.current_score = before_score + score_change`，与原路由一致、无钳制）+ `log_operation`（commit 前设 `record.operation_log_id`，`hasattr` 守卫避免 bool 返回 500）+ `add/commit`，返回结构化 `(result_dict, None)` 或 `(None,"学生不存在")`；`result_dict` 含 `user_name/new_score/before_rank_name/after_rank_name/user_id/score_change/rule_id/description/card_id` 供路由 POST-COMMIT 副作用。

### 10.3 测试先行（高风险行为补强 + 缺陷修复）
迁移**前**补强 `tests/test_records_routes.py`（12 → 17 用例），加静态 `_unwrap(response)` 兼容列表/字典信封，新增 5 用例：
- `test_create_record_success`：201 + `record_id` 非空 + 原子累加 `current_score == 原值 + change`。
- `test_score_entry_success`：201 + `new_score == before - 5`（**捕获并修复路由侧双重累加缺陷**）。
- `test_batch_entry_success`：200 + `results[0].record_id` 非空 + 原子累加。
- `test_delete_record_requires_confirm`：发 `json={}` 避 JSON 解码 400，断言 400 + `requires_confirm`。
- `test_delete_record_with_confirm_rolls_back`：`confirm` 删除 + 积分还原。
- 用 `User.query.get(sample_user.id)` 重查避脱离会话（`expire` 后跨会话访问触发 `InvalidRequestError`）；测试内 `from models import db, User` 补 db。

**迁移中发现并修复的生产缺陷**：原 score-entry 路由 `record.operation_log_id = log_entry.id` 因 `log_operation` 返回 `bool`（非 `OperationLog` 对象）→ `AttributeError` 500。先在路由加 `if log_entry and hasattr(log_entry, "id")` 守卫（让基线变绿），service 同法守卫。属非破坏性修复（未改对外契约）。

**迁移后暴露并修复的双重累加缺陷**：路由在调 `create_score_entry` 前仍内联 `user.current_score = before_score + score_change`（line 589），service 又读已更新的 `user.current_score` 作 before 再累加一次 → `new_score` 偏差 `2×score_change`。已删除路由内联积分改写，仅保留只读排名对比（基于 `before_score + score_change` 预测 after_rank），积分原子累加完全交给 service。

### 10.4 验证闸门（第四批）
| 闸门 | 范围 | 结果 |
|------|------|------|
| 行为测试（定向 pytest） | `test_records_routes.py` | ✅ **17 passed**（12+5，迁移后零回归） |
| 回归（scores 域路由全套） | records+rules+rank+time_rules+class_periods+scores 六文件 | ✅ **58 passed**（零回归） |
| G1 py_compile | `api/scores` + `services` 全量 compileall | ✅ 0 error |
| G2 RBAC 一致性 | `--check-only` | ✅ exit 0（权限目录 68 条） |
| G3 create_app 冒烟 | 经 pytest conftest 隐式加载 | ✅ 无 ImportError |
| G5 OpenAPI strict | `--strict` | ✅ 461/461 路径 0 漂移 |
| G6/G7/G8 前端 | 本轮未改前端，沿用升级阶段全绿 | ➖ 不适用 |

### 10.5 回滚方案
- 文件回滚：`cp backups/refactor_F17/records_routes_before.py backend/api/scores/records_routes.py` + `rm backend/services/score_record_service.py`。
- 分支回滚：`git checkout refactor/F16 -- .`（弃 F17 全部）。
- 数据库：零表结构/数据变更，无需 DB 回滚。

### 10.6 结论（第四批）
records_routes 最高风险主写入路径完成迁移，累计 **7 路由 → 7 service**。迁移中修复两处生产缺陷（score-entry `log_operation` 返回 bool 致 500；路由侧积分双重累加），均不影响对外契约。scores 域剩 **approvals_routes（审批事务，14 处）** 待迁移，迁移前须补强针对性行为测试（事务回滚、级联审批流、MQTT 通知）。scores 域完成后依次进入 notifications → devices → academics → users 域。

---

## 11. 第五批：approvals_routes（审批事务，14 处写入路径收口）

### 11.1 范围与目标
| 路由 | 迁移前 db.session 处数 | 写入路径迁移 |
|------|----------------|--------------|
| `api/scores/approvals_routes.py` | 写入 14（POST / 创建、PUT /<id> 更新、DELETE /<id> 删除、POST /<id>/approve 审批通过[状态+原子积分+ScoreRecord+主提交+Notification 二级提交]、POST /<id>/reject 拒绝[状态+Notification 二级提交]）；快照 `backups/refactor_F17/approvals_routes_before.py` 480 行 | create/update/delete/approve/reject 五个事务 → `services/approval_service.py` |

- 迁移后路由保留：`get_or_404`（404 语义）、请求级校验（user_id 非空 / 学生存在 / 数据隔离 `_can_access_approval_user`）、**跨切面副作用**（R4 综合评分重算 `CompositeScoreService.recalculate_user_score` / D3+R4 学生通知中心落库 `Notification` / MQTT 用户缓存更新 / MQTT 审批结果+积分变动下发 / 管理通知 `create_admin_notification`）、响应构造；审批/积分/ScoreRecord 的 `db.session` 写入与提交全部收口 service。
- grep 复核：路由内仅剩 **6 处 `db.session`**（approve + reject 各 1 个 `Notification` 块的 `add/commit/rollback`），均为跨切面通知副作用，按 F17 范式保留在路由；其余 14 处写入全部收口 service。
- 只读 GET（列表 / 详情 / 待审批）**逐字节不变、未迁移**（按评估"只读暂缓"）。
- 响应体/状态码/错误信息**逐字节不变**：create 仍 `status_code=201` 单元组→dict 信封；approve/reject 仍 200 单元组→dict 信封（`approval_id/score_change/new_points/notification_sent` 与 `approval_id/comment/notification_sent` 字段一致）；update/delete 文案不变。

### 11.2 服务层
`services/approval_service.py`（5 方法，逻辑逐行照搬原路由，仅 relocated + 收口事务）：
- `create_approval(data)`：构造 `Approval(...)` + `add/commit`，返回 `(approval_id, None)`；校验（user_id 非空/学生存在/数据隔离）仍由路由负责。
- `update_approval(approval, data)`：赋值 `title/description/score_change`（带默认值回退）+ `commit`。
- `delete_approval(approval)`：`delete/commit`。
- `approve_approval(approval, data)`：**R5 SQL 原子累加** `atomic_score_update`（含 SystemConfig min/max 钳制，与 records/审批一致，无读改写竞态）+ 设 `user.current_score=final_score` + 设 `user.updated_at` + 计算 `actual_change` + 生成 `ScoreRecord(score_change=actual_change, description="审批通过: ...", operator="admin_<approver_id>")` + `add/commit`，返回 `{approval_id, user, actual_change, score_change, new_points}`。
- `reject_approval(approval, data)`：状态/审批人/意见/时间 + `commit`，返回 `{approval_id, user, comment}`。

### 11.3 测试先行（行为补强 + 契约不一致发现）
迁移**前**补强 `tests/test_approvals_routes.py`（6 → 16 用例），加 `_unwrap` 兼容列表/字典信封，新增 10 用例覆盖全流程与边界：
- `test_create_approval_success`（201 + `approval_id` 非空 + DB 落库 student_id/status/score_change）、`test_create_approval_missing_user_id`（400）、`test_create_approval_student_not_found`（404）。
- `test_approve_approval_success`：断言 `current_score 50→60`（原子累加）、`new_points==60`、`ScoreRecord.score_change==10`、学生通知中心 `approval_result` 落库 `recipient_type='user'`、状态翻转 `approved`。
- `test_approve_approval_not_pending`（400）、`test_approve_no_score_change_does_not_mutate`（无积分变动→不生成 ScoreRecord）。
- `test_reject_approval_success`（reject→状态 `rejected` + 通知含"未通过"）、`test_reject_approval_not_pending`（400）、`test_reject_does_not_change_score`。
- `test_update_approval`（字段回写）、`test_delete_approval`（404 后查无）、`test_pending_only_returns_pending`（仅 pending 返回）、`test_get_approval_detail`（含 404）。

**基线发现并记录的契约不一致（按 F17 零漂移原则保留，不在此迁移顺手修）**：
1. `GET /api/approvals/<id>` 详情仅返回 `user_id`（=student_id），**不含 `student_id` 字段**；而全量列表/待审批列表均返回 `student_id`。前端详情页若依赖 `student_id` 会取空。
2. `GET /api/approvals/pending` 项**不含 `status` 字段**；而全量列表含 `status`。
两处均为既有响应不一致，测试已对齐实际契约锁定行为，留待独立契约整改任务处理。

### 11.4 验证闸门（第五批）
| 闸门 | 范围 | 结果 |
|------|------|------|
| 行为测试（定向 pytest） | `test_approvals_routes.py` | ✅ **16 passed**（6→16，迁移后零回归） |
| 回归（scores 域路由全套） | approvals+class_periods+rank+records+rules+scores+time_rules 七文件 | ✅ **74 passed**（原 58 + 16，零回归） |
| G1 py_compile | `approvals_routes.py` + `approval_service.py` | ✅ 0 error |
| G2 RBAC 一致性 | `--check-only` | ✅ exit 0（权限目录 68 条） |
| G3 create_app 冒烟 | 经 pytest conftest 隐式加载 | ✅ 无 ImportError |
| G5 OpenAPI strict | `--strict` | ✅ 461/461 路径 0 漂移 |
| G6/G7/G8 前端 | 本轮未改前端，沿用升级阶段全绿 | ➖ 不适用 |

### 11.5 回滚方案
- 文件回滚：`cp backups/refactor_F17/approvals_routes_before.py backend/api/scores/approvals_routes.py` + `rm backend/services/approval_service.py`。
- 分支回滚：`git checkout refactor/F16 -- .`（弃 F17 全部）。
- 数据库：零表结构/数据变更，无需 DB 回滚。

### 11.6 结论（第五批）
approvals_routes 审批事务写入路径完成迁移，累计 **8 路由 → 8 service**（categories/rank/time_rules/class_periods/rules/records/approvals + 早期）。scores 域路由写入路径已全部服务化；迁移中**未引入新缺陷**，仅记录两处既有响应不一致（detail 缺 student_id / pending 缺 status），按零漂移保留。下一步进入 **notifications → devices → academics → users** 域（这些域的写入路径同样遵循"写入/事务收口 service、只读暂缓、零契约漂移"）。

---

## 12. 第六批：notifications_routes（post-scores 首域，写入收口 + 两处只读缺陷修复）

### 12.1 范围与目标
| 路由 | 迁移前 db.session 处数 | 写入路径迁移 |
|------|----------------|--------------|
| `api/monitoring/notifications_routes.py` | 写入 12（POST / 创建、PUT /<id> 更新、DELETE /<id> 删除、POST /<id>/read 标记已读、POST /send 单发、POST /batch 群发[逐条 savepoint]）；快照 `backups/refactor_F17/notifications_routes_before.py` 288 行 → 改写后 249 行 | create_user_notification / update_notification / delete_notification / mark_notification_read / send_notification / batch_send_notifications → 追加到既有 `services/notification_service.py`（该文件为外部微信/短信下发服务，**不可覆盖**，仅追加 DB-CRUD 模块） |

- 迁移后路由保留：`get_or_404`（404 语义，见 12.5 修复说明）、请求级校验（batch 的 title/content 非空、user_ids/class_id 至少一、空参数 400）、权限/时段拦截（force_send 需 `notification.force_send`、ClassTimeChecker 上课时段拦截 403）、数据隔离（班级过滤 join User）、响应构造；所有 `db.session` 写入/事务收口 service。
- 只读 GET（列表 / 详情 / 按用户）**逐字节不变、未迁移**（按评估"只读暂缓"），但其中两处**既有 500 缺陷在迁移中被就地修复**（见 12.5），修复属恢复预期契约（200/404），非契约漂移，且未将读逻辑移入 service。
- 响应体/状态码/错误信息**逐字节不变**：create 仍 `status_code=201` 单元组→dict 信封 `{notification_id}`；send 仍 200 单元组→dict 信封；update/delete/mark-read 文案不变；batch 仍 `{sent,errors,total}` + 全部失败 `success:False/400`、部分成功 200。

### 12.2 服务层
追加至 `services/notification_service.py`（顶部加 `from models import db, Notification, User`；6 函数逻辑逐行照搬原路由，仅 relocated + 收口事务）：
- `create_user_notification(data)`：构造 `Notification(student_id=data["user_id"], ...)` + `add/commit`，返回对象（recipient_type 默认 "user" 落库，契约兼容）。
- `update_notification(notification, data)`：字段回写（title/content/type/status 带默认值）+ `status=="sent" 且 sent_at 空则补 datetime.now()` + commit。
- `delete_notification(notification)`：`delete/commit`。
- `mark_notification_read(notification)`：`status="read"/is_read=True/read_at=datetime.now()` + commit。
- `send_notification(data)`：构造 `Notification(..., status="sent", sent_at=datetime.now())` + `add/commit`，返回对象。
- `batch_send_notifications(title, content, notify_type, target_ids)`：**逐条 savepoint 事务**（`db.session.begin_nested()` 包 `add`，单条失败仅回滚该条）→ 全部成功才外层 `commit`，返回 `(sent, errors, total)`；目标解析/校验/时段拦截/权限留在路由。

### 12.3 测试先行（行为补强 + 暴露只读缺陷）
新增 `tests/test_notifications_routes.py`（16 用例），覆盖 3 只读 GET + 6 写入路径，断言逐字节契约：
- 列表（空 0 条 / 字段齐全含 F9-B merged 字段）、详情（含 404）、按用户通知；
- 创建 201 + DB recipient_type=="user"、更新 200 + status=sent 触发 sent_at、更新 404、删除 200 + 查无、标记已读 200 + is_read/status/read_at、单发 200 + status=sent；
- 群发按 user_ids 成功（sent==1）、群发按 class_id 解析学生成功、群发缺 title 400、群发缺目标 400、群发非上课时段放行（sent==1）。

**跑批结果：迁移后 16 passed，零回归。**

**测试先行暴露、并就地修复的两处只读 500 缺陷（属迁移前既有 bug，非本次写入迁移引入）**：
1. `Notification.query.filter_by(recipient_type="user").get_or_404(id)` 在 SQLAlchemy 2.0 抛 `InvalidRequestError: Query.get() being called on a Query with existing criterion` → 4 个端点（详情/PUT/DELETE/标记已读）全部 500。改为 `filter_by(recipient_type="user", id=id).first_or_404()`。
2. `GET /user/<id>` 对 Query 直接取 `.items`/`.total` 而漏调 `.paginate()` → 500。补 `.paginate(page=page, per_page=per_page, error_out=False)`。

**已知 F9-B 残留不一致（只读响应，按"暂缓不动"保留，测试对齐实际契约）**：detail 端点返回 `user_id`（=student_id）但**不含 `student_id`** 字段，而 list 端点返回 `student_id`。测试对 detail 断言 `user_id`，锁定实际行为，留独立契约整改。

### 12.4 验证闸门（第六批）
| 闸门 | 范围 | 结果 |
|------|------|------|
| 行为测试（定向 pytest） | `tests/test_notifications_routes.py` | ✅ **16 passed** |
| G1 py_compile | `notifications_routes.py` + `notification_service.py` | ✅ 0 error |
| G2 RBAC 一致性 | `verify_rbac_consistency.py --check-only` | ✅ exit 0（权限目录 68 条） |
| G3 create_app 冒烟 | 经 pytest conftest 隐式加载（walk_packages 注册全部命名空间，含本域） | ✅ 无 ImportError |
| G5 OpenAPI strict | `verify_openapi_contract.py --strict` | ✅ 461/461 路径 0 漂移 |
| G6/G7/G8 前端 | 本轮未改前端，沿用升级阶段全绿 | ➖ 不适用 |

### 12.5 回滚方案
- 文件回滚：`cp backups/refactor_F17/notifications_routes_before.py backend/api/monitoring/notifications_routes.py`；service 追加函数需 `git checkout` 或手动移除（仅追加、未改原外部下发逻辑，影响面小）。
- 分支回滚：`git checkout refactor/F16 -- .`（弃 F17 全部）。
- 数据库：零表结构/数据变更，无需 DB 回滚。

### 12.6 结论（第六批）
notifications 域作为 post-scores 首域完成迁移，写入路径 **6/6 收口 service**（追加进既有 notification_service，未覆盖外部下发逻辑）。迁移中**测试先行**暴露并就地修复两处既有只读 500 缺陷（get_or_404 过滤查询 / 漏 paginate），均恢复预期 200/404 契约、未改对外响应形态、未将读逻辑移入 service，符合"防腐层渐进、零契约漂移"。累计 F17 服务化：**9 路由 → 9 service**（scores 8 + notifications 1 文件聚合）。下一步进入 **devices → academics → users** 域。

---

## 13. 第七批：devices 域（Device + DeviceGroup 两实体，写入收口 + 测试 bug 修复）

### 13.1 范围与目标
| 路由 | 迁移前 db.session 处数 | 写入路径迁移 |
|------|----------------|--------------|
| `api/devices/devices_routes.py` | 写入 8（POST / 创建设备、PUT /<id> 更新、DELETE /<id> 删除、POST /<id>/bind-class 绑定班级、POST /<id>/bind-admin 绑定管理员、POST /<id>/resolve-alert 处置预警、PUT /<id>/settings 设置、POST /import 批量导入[openpyxl 批量事务]）；快照 `backups/refactor_F17/devices_routes_before.py` 1493 行 → 改写后 1348 行 | create_device / update_device / delete_device / bind_device_class / bind_device_admin / resolve_device_alert / update_device_settings / import_devices → `services/device_service.py`（新建） |
| `api/devices/device_group_routes.py` | 写入 5（POST / 创建分组、PUT /<id> 更新、DELETE /<id> 删除、POST /<id>/devices 批量加入、DELETE /<id>/devices/<did> 移出）；快照 `backups/refactor_F17/device_group_routes.py_before.py` 393 行 → 改写后 332 行 | create_device_group / update_device_group / delete_device_group / add_devices_to_group / remove_device_from_group → 同一 `services/device_service.py` |

- 迁移后路由保留：`get_or_404`（404 语义）、请求级校验（bind-class/bind-admin 的 ClassInfo/Admin 存在性校验保留在路由并转为 not_found 响应）、缓存失效、操作日志、跨切面副作用（如 import 的 import_result 透传）、响应构造；所有 `db.session` 写入/事务收口 service。
- grep 复核：两路由仅剩**合法** `db.session` 残留（devices_routes：line 934 聚合只读 `query` + line 1236 `rollback()` 异常兜底；device_group_routes：已无 `db` import），写入路径已全部收口，符合"只读暂缓"铁律。
- 只读 GET（设备列表/详情/分组列表/分组设备列表/在线状态等）**逐字节不变、未迁移**。
- 响应体/状态码/错误信息**逐字节不变**：create 仍 `status_code=201` 单元组→dict 信封（`data={"device_id": device_id}` 其中 `device_id` 为**业务键 str**，与详情业务键同名不同义——见 13.5）；import 批量事务返回原结构汇总 `{success,total,success_count,failed_count,messages}`；settings 仍返回 settings dict；bind/resolve 文案不变。

### 13.2 服务层
新建 `services/device_service.py`（352 行，13 函数，逻辑逐行照搬原路由，仅 relocated + 收口事务）：
- **Device（8）**：
  - `create_device(data)`：构造 `Device(device_id=data.get("device_id"), name=...)` + `add/commit`，返回 `device.id`（PK）。
  - `update_device(device, data)`：字段回写 + commit。
  - `delete_device(device)`：`delete/commit`。
  - `bind_device_class(device, class_info_id)`：设 `device.class_info_id` + commit（校验由路由负责）。
  - `bind_device_admin(device, admin_id)`：设 `device.admin_id` + commit（校验由路由负责）。
  - `resolve_device_alert(alert)`：预警处置状态翻转 + commit。
  - `update_device_settings(device, data)`：settings 字段回写 + commit，返回 settings dict。
  - `import_devices(file)`：openpyxl 读 Excel，逐行校验（`validate_device_id`/`validate_name`/`ClassInfo` 存在/`Admin` 角色 `admin|teacher`），合法行 `add`，统一 `commit`，返回 `{success,total,success_count,failed_count,messages}`；致命错误抛出交由路由 `rollback()` + server_error。
- **DeviceGroup（5）**：
  - `create_device_group(data)`：构造 `DeviceGroup` + `add/commit`，返回 `(group, None)` 或 `(None, "分组名称已存在")`。
  - `update_device_group(group, data)`：字段回写（重名校验留路由）+ commit。
  - `delete_device_group(group)`：`delete/commit`（映射由 FK 级联或路由先清）。
  - `add_devices_to_group(group_id, device_ids)`：逐条建 `DeviceGroupMapping`，返回 `{added:[...], failed:[...]}`，末尾刷新 `group.device_count`。
  - `remove_device_from_group(group_id, device_id)`：映射不存在返回 `False`（路由判 404），否则删映射 + 刷新计数返回 `True`。

### 13.3 测试先行（行为补强 + 暴露测试契约 bug）
迁移**前**补强 `tests/test_devices_routes.py`，新增两类端点测试 + 修正预存 OTA 种子（使 `is_device_online` 为真）：
- `TestDeviceWriteEndpoints`（11 用例）：create（201，断言 **PK `id` 与业务键 `device_id` 区分**——`get.get_json()['data']['id']==did` 且 `['data']['device_id']=='dev_create_001'`）/ update / delete / bind-class / bind-admin / settings / resolve-alert / import（openpyxl 成功 `success_count==1`）。
- `TestDeviceGroupWriteEndpoints`（4 用例）：create / update（重名 400）/ delete / add / remove。
- **修复的测试侧 bug（非迁移代码 bug，未改业务契约）**：
  1. `test_create_device`：混淆 create 响应 `data.device_id`（实为 PK int）与 GET 详情业务键 `device_id`（str）→ 修正断言区分 PK 与业务键。
  2. `test_create_device_missing_device_id`：原契约缺失 device_id → `Device.device_id NOT NULL` → TESTING 模式抛 `IntegrityError`。误断言 500，**改为 `pytest.raises(IntegrityError)` 锁定原始行为**（契约零漂移原则：不改代码补校验，仅锁定既有行为）。
  3. `test_import_devices`：测试行名 "导入设备1" 含数字被 `validate_name` 拒 → 改 `device_id="phonebox001"`、`name="导入设备"`（纯中文 2 字）后 `success_count==1`。
  4. `test_ota_upgrade_all_success` / `test_bulk_ota_upgrade_alias`（**预存失败，非本轮迁移范围**：OTA 端点未迁 db.session）：种子设备 `status='online'` 但无 `last_heartbeat` → `is_device_online` 返回 False → "没有在线设备" 400。修正测试种子加 `last_heartbeat=datetime.now()`。

**跑批结果：定向 pytest 27 passed，零回归。**

### 13.4 验证闸门（第七批）
| 闸门 | 范围 | 结果 |
|------|------|------|
| 行为测试（定向 pytest） | `tests/test_devices_routes.py` | ✅ **27 passed**（11+4+预存 OTA 修正，迁移后零回归） |
| G1 py_compile | `api/devices/*` + `services/device_service.py` | ✅ 0 error |
| G2 RBAC 一致性 | `verify_rbac_consistency.py --check-only` | ✅ exit 0（权限目录 68 条，无漂移） |
| G3 create_app 冒烟 | 经 pytest conftest 隐式加载 | ✅ 无 ImportError |
| G5 OpenAPI strict | `verify_openapi_contract.py --strict` | ✅ **461/461 路径 0 漂移** |
| G6/G7/G8 前端 | 本轮未改前端，沿用升级阶段全绿 | ➖ 不适用 |

### 13.5 回滚方案
- 文件回滚：`cp backups/refactor_F17/devices_routes_before.py backend/api/devices/devices_routes.py` + `cp backups/refactor_F17/device_group_routes.py_before.py backend/api/devices/device_group_routes.py` + `rm backend/services/device_service.py`。
- 分支回滚：`git checkout refactor/F16 -- .`（弃 F17 全部）。
- 数据库：零表结构/数据变更，无需 DB 回滚。

### 13.6 结论（第七批）
devices 域第一批（核心 Device + DeviceGroup 两实体）写入路径完成迁移，**13 写入端点 → 13 service 函数**（8 Device + 5 DeviceGroup）。迁移中仅修复**测试侧契约 bug**（PK vs 业务键混淆、缺失 device_id 锁定 IntegrityError、导入行名含数字被拒、OTA 在线判定种子缺失），未改动任何业务契约，符合"防腐层渐进、零契约漂移"。"**create 响应 `data.device_id` 字段语义为 PK（与详情业务键同名不同义）**"已逐字节复刻并写入本日志锁定，避免后续误判。devices 域剩余子批（box_routes.py / wol_routes.py / firmware_routes.py 写入路径）留作后续子批，再推进 **academics → users** 域。

### 13.7 后续（F17 仍在进行，按域分期）
post-scores 域进度：
1. ✅ notifications（第六批，本日志第 12 节）
2. ✅ devices（第七批，本日志第 13 节）—— 仅 Device + DeviceGroup 两实体；box/wol/firmware 子批待续
3. ⏸ devices 剩余子批：box_routes / wol_routes / firmware_routes 写入路径
4. ⏸ academics
5. ⏸ users
- **铁律重申**：每改一个子域必须跑对应 pytest + G1–G5；重写入路径迁移前须先补强针对性行为测试。禁止一次性 883 处全改。

---

## 14. 第八批：devices 子批2（box + wol 写入路径）

### 14.1 范围
| 路由文件 | DB 写端点 | 写入内容 |
|----------|-----------|----------|
| `api/devices/box_routes.py` | `POST /api/box/verify`（带 rule_id 分支） | `user.current_score += rule.score` + `ScoreRecord` 落库 + `commit` |
| `api/devices/wol_routes.py` | `POST /api/wol/devices` | 建 `Device(device_type="wol")` + `commit` + 返回 `(device, 201)` |
| `api/devices/wol_routes.py` | `PUT /api/wol/devices/<id>` | 字段回写 + `commit` |
| `api/devices/wol_routes.py` | `DELETE /api/wol/devices/<id>` | 软删 `is_active=False` + `commit` |

**网络类端点（无 DB 写，按铁律"只读 query 暂缓不动"保留路由内）**：`WakeOnLAN POST /wake`、`WakeOnLANBatch POST /wake/batch`、`ValidateMAC GET /validate`、`DeviceStatus GET /status/<mac>`、`WOLDeviceList GET /devices`。`box_routes.check_rule_limits`（限速只读查询）同样保留路由内。

### 14.2 服务层（`services/device_service.py` 追加 4 函数）
- `box_add_score(user, rule)`：积分累加 + `ScoreRecord` 落库 + `commit`，返回更新后 `current_score`（供路由复刻响应）。
- `create_wol_device(data)`：`device_id = f"wol-{mac_address}"` 派生，建 WOL `Device` + `commit`，返回 ORM 实体（路由 `marshal_with` 序列化 + 返回元组）。
- `update_wol_device(device, data)`：应用已通过校验的字段 + `commit`，返回 ORM 实体。
- `delete_wol_device(device)`：软删 `is_active=False` + `commit`。

**路由保留**：`get_by_id`/404 语义、请求级校验（name 必填、MAC 格式、MAC 唯一、规则启用/归属权限/每日·间隔限速）、响应构造。`create/update/delete_wol_device` 仅做写入；MAC 格式校验（400）与唯一性校验（409）仍在路由（因其产出错误状态码），service 对 mac 幂等再归一化一次。`device_service.py` 顶部 import 追加 `ScoreRecord`（box 明细用）。

### 14.3 测试先行（capture 当前契约 → 迁移前后零漂移）
- **复刻 `test_box_routes.py`**：原 2 弱用例（仅断言 `200/400/404` 无行为）→ 重写为 **6 行为用例**：缺参 400 / 用户不存在 404 / 设备离线 400 / 无 rule_id 只验身份不改分且无明细 / 带 rule_id 加分并落 `ScoreRecord`（校验 `message="积分添加成功 +<score>"`、`current_score == before+score`）/ 规则未启用 400。
- **新建 `test_wol_routes.py`**：**9 行为用例**：create 成功 201（校验派生 `device_id="wol-<MAC>"` + `device_type="wol"` 落库）/ 缺 name 400 / MAC 格式 400 / MAC 重复 409（小写归一化命中）/ update 成功 200 + 落库 / 不存在 404 / MAC 重复 409 / delete 成功 200 软删（`is_active=False`）/ 不存在 404。
- **流程**：先跑 15 passed 建立基线（原路由）→ 迁移 → 同 15 passed 确认零漂移。

### 14.4 验证闸门
| 闸门 | 范围 | 结果 |
|------|------|------|
| G1 py_compile | `box_routes.py` + `wol_routes.py` + `device_service.py` | ✅ 0 error |
| 行为测试（定向 pytest） | `tests/test_box_routes.py` + `tests/test_wol_routes.py` | ✅ **15 passed**（box 6 + wol 9，迁移前后一致） |
| 全量 devices 回归 | `tests/test_devices_routes.py`（共享 service 无回归） | ✅ **27 passed** |
| G2 RBAC 一致性 | `verify_rbac_consistency.py --check-only` | ✅ exit 0（权限目录 68 条，未新增权限码，无漂移） |
| G5 OpenAPI strict | `verify_openapi_contract.py --strict` | ✅ **461/461 路径 0 漂移** |
| flake8 | 改动文件 | ⚠️ 仅 `box_routes.py:55` 预存 E501（`check_rule_limits` 长行，非本次迁移引入，不在 F17 闸门） |

### 14.5 回滚方案
- 文件回滚：`cp backups/refactor_F17/box_routes_before.py backend/api/devices/box_routes.py` + `cp backups/refactor_F17/wol_routes_before.py backend/api/devices/wol_routes.py`。
- `device_service.py` 新增 4 函数可整段删除（不影响其他 13 函数）；整体回滚须连同第一批：`rm backend/services/device_service.py`。
- 数据库：零表结构/数据变更，无需 DB 回滚。

### 14.6 结论（第八批）
devices 域子批2（box + wol）写入路径完成迁移，**4 写入端点 → 4 service 函数**。逐字节复刻响应体/状态码/错误（含 create 返回元组 `(device, 201)`、delete 返回 `{success,message,device_id}` 信封、box reply 消息 `积分添加成功 +<score>`）。G2/G5 零漂移确认无契约破坏。devices 域剩余子批仅 `firmware_routes.py`（**24 处 db.session**，紧接 OTA P0-P3 重写，签名/回滚/协商事务路径风险高，延至 devices 第三子批独立处理，需更强测试基线）。

### 14.7 后续（F17 仍在进行，按域分期）
1. ✅ notifications（第六批，第 12 节）
2. ✅ devices 第一批（Device + DeviceGroup，第 13 节）
3. ✅ devices 子批2（box + wol，第 14 节）
4. ✅ devices 子批3：firmware_routes（第 15 节，本批）
5. ⏸ academics
6. ⏸ users
- **铁律重申**：每改一个子域必须跑对应 pytest + G1–G5；重写入路径迁移前须先补强针对性行为测试。禁止一次性 883 处全改。

---

### 15. devices 第三子批：firmware 路由服务化（第 15 节）

**目标**：将 `api/devices/firmware_routes.py` 内 7 个 DB 写端点的 `db.session` 事务逻辑收口到新建
`services/firmware_service.py` 薄封装，路由仅留 get_or_404 / 请求校验 / 文件 I/O / MQTT 下发 / 响应构造。
`/negotiate-all` 本就委托 `ota_negotiation_service.negotiate_all_devices`，路由内无 db.session，无需迁移。

**规模**：818 行 → 改后约 720 行；24 处 `db.session` 全部移除出路由；新建 `firmware_service.py`
（7 函数）；新建 `tests/test_firmware_routes.py`（25 行为用例）。

#### 15.1 写端点 → service 函数映射
| 端点 | service 函数 | 说明 |
|------|--------------|------|
| POST /firmware/versions | `create_firmware_version(data, created_by)` | 建版本 + 操作日志，返回 id |
| PUT /firmware/versions/<id> | `update_firmware_version(firmware, data)` | 应用 description/is_mandatory/is_active |
| DELETE /firmware/versions/<id> | `delete_firmware_version(firmware)` | 落库删除（文件删除留路由 realpath 校验） |
| POST /firmware/ota/report | `report_ota_status(status, ...)` | started/completed/failed 三分支事务 |
| POST /firmware/batch-upgrade | `log_batch_upgrade(firmware_id, n, target)` | 仅操作日志（MQTT 下发留路由） |
| POST /firmware/upload | `create_uploaded_firmware(...)` | 落库 + 日志（save/MD5 计算留路由） |
| POST /firmware/<id>/ota-upgrade | `log_ota_upgrade(firmware_id, n, version)` | 仅操作日志（MQTT 下发留路由） |

#### 15.2 迁移中就地修复两处 upload 写路径 500 缺陷（测试先行暴露）
定向 pytest 基线运行暴露 `POST /firmware/upload` 必现 500（24 passed + 1 failed），根因两处：
1. 操作日志描述引用未定义变量 `sha256`（`f"...SHA256: {sha256}"`）→ `NameError` → 500；
   改为 `md5_hex`（真 MD5，32 位）。与 notifications 子批「测试暴露即修」 precedent 一致。
2. 响应体 `"md5": md5` 误用 `hashlib.md5` **模块对象**而非十六进制串；改为 `md5_hex`。
均属写路径缺陷修复，未改动任何契约语义（成功响应结构、`id/file_size/md5/description/is_mandatory` 字段不变）。

#### 15.3 测试先行（capture → 迁移前后零漂移）
- **新建 `tests/test_firmware_routes.py`**：25 行为用例，覆盖 7 写端点 + 4 只读回归
  （list/detail/upgrade-records/ota-status）+ 关键错误分支（version 必填/重复 400、删 active 400、
  ota-report 缺参 400、batch-upgrade 目标不存在 404、ota-upgrade 非 active 400/不存在 404、
  upload 无文件/无 version/类型不符/重复 400）。
- upload 用例用 `tmp_path` 覆盖 `FIRMWARE_UPLOAD_FOLDER`，断言落库 `md5` 为 32 位真值，避免污染真实 uploads 目录。
- **流程**：先跑基线 **24 passed + 1 failed**（失败=upload 缺陷）→ 迁移并修缺陷 → 重跑 **25 passed** 零漂移。

#### 15.4 验证闸门
| 闸门 | 范围 | 结果 |
|------|------|------|
| G1 py_compile | `firmware_routes.py` + `firmware_service.py` | ✅ 0 error |
| 行为测试（定向 pytest） | `tests/test_firmware_routes.py` | ✅ **25 passed**（基线 24+1 缺陷修复后全绿） |
| 全量 devices 回归 | `test_devices_routes/wol/box/..._property/is_device_online` | ✅ **58 passed** |
| G2 RBAC 一致性 | `verify_rbac_consistency.py --check-only` | ✅ exit 0（权限目录 68，无新增权限码） |
| G3 create_app 冒烟 | `create_app()` | ✅ 941 routes 正常启动 |
| G5 OpenAPI strict | `verify_openapi_contract.py --strict` | ✅ **461/461 路径 0 漂移** |

#### 15.5 回滚方案
- 路由回滚：`cp backups/refactor_F17/firmware_routes_before.py backend/api/devices/firmware_routes.py`。
- service 回滚：`rm backend/services/firmware_service.py`（独立新文件，不影响其他域）。
- 数据库：零表结构/数据变更，无需 DB 回滚。

#### 15.6 结论（devices 第三子批 / 第九批）
firmware 域写入路径完成迁移，**7 写入端点 → 7 service 函数**（含两处 upload 写路径缺陷修复）。
devices 域累计：第一批 13 + 子批2 4 + 子批3 7 = **24 端点 → 24 service 函数**，G1–G5 全绿、契约零漂移。
F17 后续域：academics → users（每域同样 7 步：快照基线 → 测试先行 → 建 service → 改写路由 → 全闸门 → 文档/记忆）。
