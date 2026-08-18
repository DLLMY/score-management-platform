# 项目第四次综合评估报告

**评估日期**: 2026-08-18
**评估类型**: 全面系统评估（F17 防腐层重构 + 三目录清理收尾后）
**评估方法**: 静态分析（pyflakes）+ 实测验证闸门 + 近期提交审查 + 遗留问题对照
**对比基线**: 第三次综合评估（2026-07-31，8.4/10，生产就绪）

---

## 一、评估背景

自上次评估以来，项目完成了**系统性重构与清理**（refactor/F17 分支，15 条近期提交）：

1. **F17 防腐层渐进重构**：21+ 域全部收口（scores / notifications / devices / academics / users / nlp / sub_accounts / system_routes / admin_notifications / import_export / security / admins / rbac），写入路径统一迁移至 services 薄封装层，路由层仅保留 404 语义 / 请求校验 / 跨切面副作用 / 响应构造。
2. **三目录清理**：后端根残留清除（app.py / sweep_endpoints.py / token.txt）、前端 401 个误提交产物 git rm（644→243 跟踪文件）、deploy 60+ 处失效引用与文档死链修正。
3. **代码质量治理**：pyflakes 全仓清零（~40 处未用导入）、25 处调试 print→logger、密钥随机化、migrations 语法缺陷修复、config.json 对齐。
4. **gitignore 治理**：新建 frontend/.gitignore（之前缺失导致 dist/playwright-report 反复散落）。

---

## 二、项目现状

### 2.1 规模（实测）

| 维度 | 后端 | 前端 |
|------|------|------|
| 源文件 | 492 .py（~98k LOC） | 187 .tsx/.ts（~63k LOC） |
| 测试文件 | 157 | 20+（vitest + Playwright e2e） |
| 路由文件 | ~40（api/ 分层） | 63 页面（App.tsx 懒加载注册） |
| 服务层 | services/ 30+ 薄封装 | 6 services |
| 状态管理 | - | 2 stores（zustand） |

### 2.2 技术栈（稳定）

后端：Flask-RESTX + SQLAlchemy + SQLite + Redis + MQTT(EMQX) + WebSocket + APScheduler + Celery
前端：React 18 + TS + Vite 5 + antd + zustand + recharts + socket.io-client + Playwright
NLP/AI：BERT + TextCNN + 规则引擎；硬件：ESP32 固件（OTA 无缝升级）

---

## 三、维度评估

### 3.1 功能完整性 — 9.2/10

- 核心闭环完整：成绩/积分/考勤/设备/手机箱/审批/通知/NLP/算法/报表/学生自助端/班主任工作台
- 历史 4 轮功能深评发现的 P0-P3 缺陷已全部修复（含导出、导入、预警合并、综合评分重算等）
- 保留项：无已知 P0 功能缺陷

### 3.2 性能 — 9.0/10

- 缓存统一为单套 RedisCacheService（历史 3 套合一），失效与统计接口齐备
- MQTT 双连接分流根治遥测洪流；批量接口（bulk create/update/delete）异常隔离
- 补充缺失索引（course_schedule/score/scheduled_notify 等）
- 遗留：未做正式基准压测文档（可选补充）

### 3.3 安全性 — 8.5/10

- RBAC 统一：role_permission_mappings 单一事实源，G2 闸门 68 条一致性验证
- 双 JWT（admin/student 隔离）+ CSRF + 限流 + 审计日志
- 近期强化：部署脚本密钥随机生成（消除公开 dev 密钥）、明文密码打印移除、S8 路径穿越修复（本轮发现 import os 缺失已补）、RBAC 权限解析 except:pass 修复
- 遗留：SSL 证书自动续期、更细粒度审计报表（可选）

### 3.4 稳定性 — 9.0/10

- 实测闸门全绿（见第四节）
- F17 防腐层：逐字节复刻响应契约，21+ 域迁移后契约无漂移
- 遗留：tsc 类型检查闸门缺失（见遗留问题 #1）

### 3.5 代码质量 — 9.0/10

- pyflakes 全仓 **0 真实残留**（仅 models/__init__ 再导出误报 + 3 处有意 noqa）
- 25 处调试 print→logger 完成，无 pdb/breakpoint 残留
- black + prettier 格式统一；命名规范（git mv 修正 outliers）
- 死代码清理：累计删除 500+ 文件（dist_verify/playwright-report/死 .js/一次性脚本/未用导入）
- 遗留：CSS 拼写告警 1 处、17 文件 28 处 eslint-disable（exhaustive-deps/any，有意保留）

### 3.6 可维护性 — 9.3/10

- **F17 防腐层是最重要的架构改进**：路由/服务分层清晰，事务边界明确，只读查询与写路径分离
- 目录重组：根目录按域（api/ + services/ + models/ + utils/），前端 components 按职责分子目录
- 文档：部署 9 份文档引用修正 + 6 份评估报告存档 + API 文档
- 遗留：models/__init__.py 82 条再导出（pyflakes 误报但量大，可考虑显式 __all__）

### 3.7 测试覆盖 — 7.5/10

- 后端 157 测试文件；本轮实测 184 passed（15 文件）+ 40 passed（5 文件）
- 前端 vitest 20+ + Playwright 9 spec
- 遗留：未量化行覆盖率（建议跑一次 pytest --cov 建立基线）；前端测试偏少

### 3.8 文档完备 — 8.2/10

- 部署文档（DEPLOYMENT_GUIDE 等 9 份）引用已全部修正为真实入口
- config.json 与 CONFIG_GUIDE 双向对齐
- 遗留：docs/ 部分归档文档未同步到最新入口（低优先级）

### 3.9 技术债 — 显著下降

- 清理：401 前端产物 + 8 死文件 + 8 死模块（后端）+ 60 失效引用 + 40 未用导入 + 密钥/调试残留
- 剩余：tsc 版本、CSS 拼写、2 个 .js 转 ts（webVitals.js/api.test.js）、backups/ 616MB（已 gitignore，仅磁盘占用）

---

## 四、实测验证闸门（2026-08-18）

| 关卡 | 命令 | 结果 |
|------|------|------|
| G2 RBAC 一致性 | `verify_rbac_consistency.py --check-only` | ✅ 68 条一致性 OK |
| 定向 pytest | 15 文件（F17 全域） | ✅ 184 passed / 146s |
| 代表性 pytest | import_export/rbac/records/users/envelope | ✅ 40 passed / 80s |
| pyflakes | 全仓 492 .py | ✅ 0 真实残留 |
| ESLint | `eslint src --ext .ts,.tsx` | ✅ exit 0 |
| 生产构建 | `vite build` | ✅ exit 0（仅 1 条 CSS 告警） |
| .gitignore 治理 | build 后 `git status frontend/dist` | ✅ dist 不再出现在 status |

---

## 五、遗留问题清单

### 阻塞（建议优先）
1. **tsc 类型检查闸门不可用**：`tsconfig.json` 使用 `moduleResolution:"bundler"` 等 TS5 选项，`package.json` 锁定 `typescript ^4.9.5`。建议升级 `typescript ^5.x` 或降级配置，恢复类型检查（唯一缺失的验证闸门）。

### 建议（排期处理）
2. CSS 拼写 `backgroundposition` → `background-position`（1 处，构建告警）。
3. 量化测试覆盖率：`pytest --cov` 建立基线，目标后端 ≥60%。
4. 2 个遗留 .js 转 .ts：`utils/webVitals.js`（被 index.tsx 引用）、`services/__tests__/api.test.js`（vitest）。

### 可选（低优先级）
5. 17 文件 28 处 eslint-disable（exhaustive-deps/any）逐步收敛。
6. `models/__init__.py` 82 条再导出补 `__all__` 消除 pyflakes 噪音。
7. `backups/`（616MB）磁盘占用迁移至独立存储。
8. docs/ 归档文档入口同步。

---

## 六、综合评分

| 维度 | 评分 | 变化 |
|------|------|------|
| 功能完整性 | 9.2/10 | ↑（历史 9.0） |
| 性能 | 9.0/10 | — |
| 安全性 | 8.5/10 | ↑（密钥随机化/路径穿越修复） |
| 稳定性 | 9.0/10 | ↑（F17 收口 + 184 测试） |
| 代码质量 | 9.0/10 | ↑↑（pyflakes 清零/print→logger） |
| 可维护性 | 9.3/10 | ↑↑（防腐层架构） |
| 测试覆盖 | 7.5/10 | —（待量化基线） |
| 文档完备 | 8.2/10 | ↑（引用修正/配置对齐） |

**项目成熟度: 8.7 / 10**（较上次 8.4 提升 0.3）

**结论**: 项目处于**生产就绪**状态，F17 防腐层重构 + 三目录清理使架构更清晰、技术债显著下降、验证闸门全绿。唯一阻塞项是 tsc 类型检查闸门恢复，其余均为低风险优化项。

---

## 七、下一步建议（按优先级）

1. **恢复 tsc 闸门**：typescript 升 ^5.x（或改 moduleResolution），让 CI 具备类型检查能力。
2. **建立覆盖率基线**：跑 `pytest --cov` + vitest coverage，量化后逐步提升。
3. **收尾 2 个 .js 转 .ts**，完成前端"零遗留 .js"。
4. 建议下次评估：1 个月后或下一次重大架构变更后。

---

**报告生成**: 2026-08-18 ｜ 分支 refactor/F17（HEAD 98b92ca）
