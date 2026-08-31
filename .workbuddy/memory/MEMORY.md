# 管理平台设计 — 长期记忆

## 运行/测试
- 后端：系统 Py3.11 `C:/Users/53527/AppData/Local/Programs/Python/Python311/python.exe`，`cd backend && python run.py --env development --host 127.0.0.1 --port 5000`；改后端须强杀全部 python 重启（Flask-SocketIO 不 reload）。MQTT 改 `app/service_init.py::init_mqtt`。
- 前端：Vite dev proxy /api、/ws→5000；build `node node_modules/vite/bin/vite.js build --logLevel warn`；`tsc --noEmit`；lint `node node_modules/eslint/bin/eslint.js src --ext .ts,.tsx`；单测 `node node_modules/vitest/vitest.mjs run --pool=forks <files>`。⚠️ 勿用 `node node_modules/.bin/eslint`/`.bin/vitest`（bash 脚本被当 JS）。
- pytest：系统3.11，`-p no:locust --timeout=600`；全量 `python -m pytest -p no:locust --timeout=600 -q`（pytest.ini testpaths=backend/tests，~19min，collected 2061）。**基线 2052 passed / 1 failed(沙箱假阳性 test_clear_cache safe-delete 拦 rmtree) / 8 skipped**，真实失败 0。

## 架构/重构铁律
- 路由唯一源 `app/api_versioning.py::register_v1_routes`；信封 `{success,code,data}`；create 双元组 `[env,201]` 勿改。
- **F17 防腐层（✅全收口，#629 剩余写路径 2026-08-30 真终态闭合）**：写入/事务路径内联 db.session → `services/*_service.py` 薄封装，路由保留 get_or_404/校验/缓存失效/副作用/响应构造、逐字节复刻；#629 收口含 rollback 守卫下沉 service（不得仅删）。回归闸门脚本在**仓库根 `scripts/run_regression.sh`**（非 backend/scripts），默认系统 Py3.11，5 步全绿。终态见 `docs/F17_路由服务化重构_终态汇总与收尾记忆.md`。
- **提取/重构必跑回归**：后端 `bash scripts/run_regression.sh` + 被改模块补 pytest；前端 `tsc --noEmit`+`eslint`+`vitest run --pool=forks`。**未跑回归=重构未完成**。
- ⚠️ pytest 路径坑：records/scores 域正确文件 `test_scores_routes.py`/`test_records_routes.py`（`test_score_record_service.py` 不存在，误跑静默 exit=4）。
- ⚠️ 新建后端工具前先 Glob 确认不存在（excel_utils/query_optimizer 曾误覆盖）。
- 禁一次性全改、禁 git commit。

## RBAC/双JWT/db_session
- 改 RBAC 必跑 `verify_rbac_consistency.py --check-only`(G2 68/DB70/seed66/teacher30)；teacher 含 notification.send 无 score.manage；`/api/roles` 已下线。Admin=access+requires_permission；学生=student+requires_student。
- `db_session_scope(detach=True)` finally `session.remove()`：**请求链 service 写路径必须 detach=False**（Flask teardown 清），否则 DetachedInstanceError 500。

## 关键坑
- MQTT 双连接（控制 QoS1 score/#+phonebox/query/unlock/#/ota/#/points/#；遥测 QoS0 phonebox/#）；生产 EMQX `nc5233fc.ala.cn-hangzhou.emqxsl.cn:8883`。
- SQLite join User：显式 class_id 与隔离过滤各自 `join(User)`→重复 JOIN `ambiguous column name`；须 `is_scoped or class_id` 判断后**单次 join**。
- run.py 只 `load_dotenv(.env)`，`--env development` 不切 .env.development；外部签 JWT 用 `.env` 的 `JWT_SECRET_KEY`。
- conftest 动态注册 Namespace 须自带 `path="/mental-health"`（连字符）否则 404。
- sandbox torch 段错误：验证主线程先 `import services.nlp_ml_service` 预热再 import app；pytest 输出被日志淹没须 grep 结果行。
- 不主动 git commit；push 走 `origin-ssh`(`ssh://git@ssh.github.com:443/...`)。

## NLP 模块（✅P0–P1全修 2026-08-29）
- P0-1 /model/evaluate 去伪造0.85；P0-2 ml_based 死分支已禁；P0-3 优化器误引 NLPMLService→NLPMLTrainingService 已修。P1-1 路由52法加 `@safe_handle()`；P1-2 评分并发防重 ProcessedMessage；P1-3 前端信封统一 unwrapEnvelope/parseEnvelopeSafe；P1-4 测试挖出 create_rule 未设 is_active / `_usage_to_dict` 读错列 两缺陷并修。
- #929 analyzer 单例污染（测试加 reset_metrics fixture，未改生产）；#930 FastNLPParser 复句拆分（**快路径潜伏态，仅预热不可达**）；#931 deep_semantic_match 接入真实 BERT（候选内相对归一，降级归零与 np.zeros 逐字节一致）。
- **T7 torch 懒加载**：`nlp_enhanced_service` 删顶层 torch import，`_get_ml_service()` 首次 ml_predict 才加载。
- **活跃链路**=`api/nlp/nlp_routes.py::_get_parser()`→`services/nlp_enhanced_service.get_nlp_parser()`；`services/nlp_service.py`(FastNLPParser) 仅预热。沙箱无 BERT/TFIDF 端到端验证受限；G5 当前 **469 paths** 零漂移。

## 班主任工作台（✅2026-08-21）
- `useWorkbenchClass`（store+useSyncExternalStore，12子页共享当前班级 sessionStorage 持久）；后端班级隔离 join User.class_info_id；评语模型 TeacherComment 路由 /api/teacher-comments 权限 comment.view/edit。
