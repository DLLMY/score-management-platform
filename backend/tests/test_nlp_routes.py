"""NLP 路由行为测试（F17 防腐层迁移前后一致性基线）。

契约（基于当前实现）：
- POST /api/nlp/feedback/record   含字段纠正时 status 200，body.success True，
                                   data.corrections_saved == 实际纠正条数，并在库内创建
                                   NLPCorrection(status='approved')
- PUT  /api/nlp/corrections/<id>  更新状态：status 200 信封 "纠正状态已更新"；approved 时 confidence_after=1.0
- DELETE /api/nlp/corrections/<id> 删除：status 200 信封 "纠正记录已删除"；删除后库内记录消失

迁移核心契约：上述 3 个写路径的落库语义（建模字段、status='approved'、approved→confidence_after=1.0）
必须由 services/nlp_correction_service 逐字节复刻，路由层仅保留 get_or_404/校验/缓存失效/响应构造。
"""

from models import NLPCorrection, db


def _json(resp):
    return resp.get_json()


def test_feedback_record_creates_corrections(client, app, auth_headers):
    payload = {
        "text": "反馈测试文本",
        "predicted_intent": "add",
        "true_intent": "deduct",
        "confidence": 0.9,
        "corrected_name": "张三",
        "original_name": "李四",
        "corrected_intent": "deduct",
        "original_intent": "add",
        "corrected_score": 5,
        "original_score": 3,
    }
    with app.app_context():
        before = NLPCorrection.query.count()
        resp = client.post("/api/nlp/feedback/record", json=payload, headers=auth_headers)
    assert resp.status_code == 200
    body = _json(resp)
    assert body["success"] is True
    assert body["data"]["corrections_saved"] == 3
    with app.app_context():
        after = NLPCorrection.query.count()
        assert after == before + 3
        new = NLPCorrection.query.filter_by(input_text="反馈测试文本").all()
        assert len(new) == 3
        assert all(c.status == "approved" for c in new)


def test_correction_update_status(client, app, auth_headers):
    with app.app_context():
        c = NLPCorrection(
            input_text="u",
            field_type="name",
            original_value="a",
            corrected_value="b",
            status="pending",
        )
        db.session.add(c)
        db.session.commit()
        cid = c.id
    with app.app_context():
        resp = client.put(
            "/api/nlp/corrections/%d" % cid, json={"status": "approved"}, headers=auth_headers
        )
    assert resp.status_code == 200
    body = _json(resp)
    assert body["success"] is True
    assert "纠正状态已更新" in body["message"]
    with app.app_context():
        rec = NLPCorrection.query.get(cid)
        assert rec.status == "approved"
        assert rec.confidence_after == 1.0


def test_correction_delete(client, app, auth_headers):
    with app.app_context():
        c = NLPCorrection(
            input_text="u",
            field_type="name",
            original_value="a",
            corrected_value="b",
            status="pending",
        )
        db.session.add(c)
        db.session.commit()
        cid = c.id
    with app.app_context():
        resp = client.delete("/api/nlp/corrections/%d" % cid, headers=auth_headers)
    assert resp.status_code == 200
    body = _json(resp)
    assert body["success"] is True
    assert "纠正记录已删除" in body["message"]
    with app.app_context():
        # expire_all：强制重新 SELECT，避免同一 session 的 identity map 在
        # 多文件 + --cov 场景下返回已删除对象的幽灵实例（偶发假失败）
        db.session.expire_all()
        assert NLPCorrection.query.get(cid) is None


def test_train_all_async_flow(client, app, auth_headers, monkeypatch):
    """#912 实机修复：train-all 异步契约——POST 立即返回 task_id（started），
    轮询状态端点直至 done，result 为 train_all 完整返回（前端 30s 同步等待曾必 504）。"""
    import time as _time
    from unittest.mock import MagicMock

    from api.nlp import nlp_routes

    fake_result = {
        "success": True,
        "message": "训练完成",
        "best_algorithm": "svm",
        "best_f1_score": 0.85,
        "results": [],
    }
    fake_service = MagicMock()
    fake_service.train_all.return_value = fake_result
    monkeypatch.setattr(nlp_routes, "_get_ml_service", lambda: fake_service)

    resp = client.post("/api/nlp/model/train-all", json={"trained_by": 1}, headers=auth_headers)
    assert resp.status_code == 200
    body = _json(resp)
    assert body["success"] is True
    assert body["data"]["status"] == "started"
    task_id = body["data"]["task_id"]
    assert task_id

    status_body = None
    for _ in range(100):
        r = client.get(
            "/api/nlp/model/train-all/status?task_id=%s" % task_id, headers=auth_headers
        )
        assert r.status_code == 200
        status_body = _json(r)["data"]
        if status_body["status"] in ("done", "error"):
            break
        _time.sleep(0.1)

    assert status_body is not None
    assert status_body["status"] == "done"
    assert status_body["result"]["success"] is True
    assert status_body["result"]["best_algorithm"] == "svm"


def test_train_async_flow(client, app, auth_headers, monkeypatch):
    """#912 实机修复：单算法 train 异步契约——POST 立即返回 task_id，轮询
    /model/train/status 直至 done（单算法训练 + 调参同样分钟级，30s 必超时）。"""
    import time as _time
    from unittest.mock import MagicMock

    from api.nlp import nlp_routes

    fake_result = {
        "success": True,
        "message": "训练完成",
        "algorithm": "svm",
        "evaluation": {"f1_score": 0.8},
    }
    fake_service = MagicMock()
    fake_service.train.return_value = fake_result
    monkeypatch.setattr(nlp_routes, "_get_ml_service", lambda: fake_service)

    resp = client.post(
        "/api/nlp/model/train",
        json={
            "trained_by": 1,
            "algorithm": "svm",
            "use_cross_validation": False,
            "use_hyperparameter_tuning": False,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = _json(resp)
    assert body["success"] is True
    assert body["data"]["status"] == "started"
    task_id = body["data"]["task_id"]
    assert task_id

    status_body = None
    for _ in range(100):
        r = client.get(
            "/api/nlp/model/train/status?task_id=%s" % task_id, headers=auth_headers
        )
        assert r.status_code == 200
        status_body = _json(r)["data"]
        if status_body["status"] in ("done", "error"):
            break
        _time.sleep(0.1)

    assert status_body is not None
    assert status_body["status"] == "done"
    assert status_body["result"]["algorithm"] == "svm"


def test_train_all_rejects_concurrent(client, app, auth_headers, monkeypatch):
    """并发保护：已有 running 任务时再次 POST 返回 already_running，不重复起线程。"""
    from unittest.mock import MagicMock

    from api.nlp import nlp_routes

    fake_service = MagicMock()
    fake_service.train_all.return_value = {"success": True, "message": "ok", "results": []}
    monkeypatch.setattr(nlp_routes, "_get_ml_service", lambda: fake_service)

    with nlp_routes._train_lock:
        tid = "trainall-%d" % next(nlp_routes._train_seq)
        nlp_routes._train_tasks[tid] = {
            "status": "running",
            "result": None,
            "error": None,
            "created_at": "x",
            "finished_at": None,
        }

    try:
        resp = client.post("/api/nlp/model/train-all", json={"trained_by": 1}, headers=auth_headers)
        assert resp.status_code == 200
        body = _json(resp)
        assert body["data"]["status"] == "already_running"
    finally:
        with nlp_routes._train_lock:
            nlp_routes._train_tasks.pop(tid, None)


def test_train_breaks_stale_running(client, app, auth_headers, monkeypatch):
    """熔断：running 超过 30 分钟的任务视为僵尸（可能卡死），置 error 并允许新任务接管。"""
    import time as _time
    from datetime import datetime, timedelta
    from unittest.mock import MagicMock

    from api.nlp import nlp_routes

    fake_service = MagicMock()
    fake_service.train_all.return_value = {"success": True, "message": "ok", "results": []}
    monkeypatch.setattr(nlp_routes, "_get_ml_service", lambda: fake_service)

    stale_created = (datetime.utcnow() - timedelta(minutes=40)).isoformat()
    with nlp_routes._train_lock:
        stale_tid = "trainall-%d" % next(nlp_routes._train_seq)
        nlp_routes._train_tasks[stale_tid] = {
            "status": "running",
            "result": None,
            "error": None,
            "created_at": stale_created,
            "finished_at": None,
        }

    try:
        resp = client.post("/api/nlp/model/train-all", json={"trained_by": 1}, headers=auth_headers)
        assert resp.status_code == 200
        body = _json(resp)
        # 僵尸任务被熔断 → 不再 already_running，新任务可启动
        assert body["data"]["status"] == "started"
        new_tid = body["data"]["task_id"]
        with nlp_routes._train_lock:
            assert nlp_routes._train_tasks[stale_tid]["status"] == "error"

        # 新任务轮询到 done
        status_body = None
        for _ in range(100):
            r = client.get(
                "/api/nlp/model/train-all/status?task_id=%s" % new_tid, headers=auth_headers
            )
            assert r.status_code == 200
            status_body = _json(r)["data"]
            if status_body["status"] in ("done", "error"):
                break
            _time.sleep(0.1)
        assert status_body is not None
        assert status_body["status"] == "done"
    finally:
        with nlp_routes._train_lock:
            nlp_routes._train_tasks.pop(stale_tid, None)
            nlp_routes._train_tasks.pop(new_tid, None)


def test_cleanup_stale_training_records(app):
    """#912 实机修复：启动清理 status=running 且 created_at 超阈值的悬挂训练记录 → error。"""
    from datetime import datetime, timedelta
    from utils.startup_cleanup import cleanup_stale_training_records

    from models import db
    from models.nlp_models import NLPModelTraining

    with app.app_context():
        # 注意：必须用 datetime.now()（与生产 train 流程 datetime.now() 写入同基准），
        # 不能用 datetime.utcnow()，否则与 cleanup 的 datetime.now() 阈值时区错位（#912）。
        # 1) 预置 1 条悬挂（10 分钟前创建，status=running）→ 应被清理
        stale = NLPModelTraining(
            model_name="stale_test_xxx",
            algorithm_type="random_forest",
            status="running",
            training_data_size=10733,
            created_at=datetime.now() - timedelta(minutes=10),
            trained_at=datetime.now() - timedelta(minutes=10),
        )
        # 2) 预置 1 条新鲜的（1 分钟前创建，status=running）→ 不应被清理
        fresh = NLPModelTraining(
            model_name="fresh_test_xxx",
            algorithm_type="svm",
            status="running",
            training_data_size=10733,
            created_at=datetime.now() - timedelta(minutes=1),
            trained_at=datetime.now() - timedelta(minutes=1),
        )
        # 3) 预置 1 条已 completed 的 → 不应被清理
        completed = NLPModelTraining(
            model_name="completed_test_xxx",
            algorithm_type="nb",
            status="completed",
            training_data_size=100,
            created_at=datetime.now() - timedelta(hours=1),
            trained_at=datetime.now() - timedelta(hours=1),
        )
        db.session.add_all([stale, fresh, completed])
        db.session.commit()
        stale_id, fresh_id, completed_id = stale.id, fresh.id, completed.id
        try:
            cleaned = cleanup_stale_training_records(app, max_running_minutes=5)
            assert cleaned >= 1
            db.session.expire_all()
            assert db.session.get(NLPModelTraining, stale_id).status == "error"
            assert db.session.get(NLPModelTraining, fresh_id).status == "running"
            assert db.session.get(NLPModelTraining, completed_id).status == "completed"
        finally:
            for rid in (stale_id, fresh_id, completed_id):
                r = db.session.get(NLPModelTraining, rid)
                if r is not None:
                    db.session.delete(r)
            db.session.commit()


# ==================== P1-4：rules 路由层契约（此前 0 路由层测试） ====================
# 覆盖 /api/nlp/rules 全部 8 个端点。核心契约：
# - 创建必须落 is_active=True，否则新规则在 get_rules/statistics/suggest
#   （均 filter(is_active)）中不可见 —— 创建"成功"但列表查不到
# - 删除为软删除（is_active=False），物理记录保留
# - 缺必填字段 / 空批量导入 / 空关键词推荐 → 400 错误信封，不得静默成功
# 注意：GET /rules 与 /rules/statistics 带 @cached_api，测试统一带 skip_cache=true
# 避免跨用例缓存污染。


def _create_rule(client, app, auth_headers, keyword, score_value=1.0, score_type="add"):
    with app.app_context():
        resp = client.post(
            "/api/nlp/rules",
            json={
                "behavior_keyword": keyword,
                "score_value": score_value,
                "score_type": score_type,
            },
            headers=auth_headers,
        )
    assert resp.status_code == 200, resp.get_json()
    body = _json(resp)
    assert body["success"] is True, body
    return body["data"]["rule"]["id"]


def test_rule_list_pagination_shape(client, app, auth_headers):
    """GET /rules 返回标准分页信封 {items,total,page,per_page,pages}。"""
    with app.app_context():
        resp = client.get("/api/nlp/rules?skip_cache=true", headers=auth_headers)
    assert resp.status_code == 200
    body = _json(resp)
    assert body["success"] is True
    for key in ("items", "total", "page", "per_page", "pages"):
        assert key in body["data"], key


def test_rule_create_is_visible_in_list(client, app, auth_headers):
    """P1-4 缺陷回归：POST /rules 创建的规则必须能出现在 GET /rules 列表里。

    根因：NLPScoringRule.is_active 列无 DB 默认值，create_rule 也未显式赋值 →
    落库 NULL；而 get_rules / statistics / suggest 全部 filter(is_active)，
    导致新规则创建"成功"却对用户完全不可见。
    """
    rule_id = _create_rule(client, app, auth_headers, "主动打扫卫生", 2.0, "add")

    with app.app_context():
        lst = client.get(
            "/api/nlp/rules?keyword=主动打扫卫生&skip_cache=true", headers=auth_headers
        )
    assert lst.status_code == 200
    lb = _json(lst)
    assert lb["data"]["total"] == 1, "新创建的规则必须能在列表中查到（is_active 不得为 NULL）"
    assert lb["data"]["items"][0]["id"] == rule_id


def test_rule_create_missing_required_field(client, app, auth_headers):
    """缺必填字段 behavior_keyword → 400 错误信封，不落库。"""
    with app.app_context():
        resp = client.post(
            "/api/nlp/rules",
            json={"score_value": 1.0, "score_type": "add"},
            headers=auth_headers,
        )
    assert resp.status_code == 400
    body = _json(resp)
    assert body["success"] is False
    assert "behavior_keyword不能为空" in body["message"]


def test_rule_create_duplicate_rejected(client, app, auth_headers):
    """同 behavior_keyword + score_type 重复创建 → success=False 且回传既有 rule_id。"""
    payload = {"behavior_keyword": "迟到", "score_value": -1.0, "score_type": "deduct"}
    with app.app_context():
        first = client.post("/api/nlp/rules", json=payload, headers=auth_headers)
        assert first.status_code == 200
        assert _json(first)["success"] is True
        second = client.post("/api/nlp/rules", json=payload, headers=auth_headers)
    assert second.status_code == 400
    body = _json(second)
    assert body["success"] is False
    assert body["data"]["rule_id"] is not None


def test_rule_get_by_id_found_and_missing(client, app, auth_headers):
    """GET /rules/<id>：命中返回规则；不存在 → 400 "规则不存在"（非 500）。"""
    rid = _create_rule(client, app, auth_headers, "早退", -1.0, "deduct")
    with app.app_context():
        ok = client.get("/api/nlp/rules/%d" % rid, headers=auth_headers)
        miss = client.get("/api/nlp/rules/999999", headers=auth_headers)
    assert ok.status_code == 200
    assert _json(ok)["data"]["id"] == rid
    assert miss.status_code == 400
    assert "规则不存在" in _json(miss)["message"]


def test_rule_update_and_soft_delete(client, app, auth_headers):
    """PUT 更新生效；DELETE 为软删除（is_active=False），物理记录保留且从列表消失。"""
    from models import NLPScoringRule, db

    rid = _create_rule(client, app, auth_headers, "课堂发言", 1.0, "add")

    with app.app_context():
        upd = client.put(
            "/api/nlp/rules/%d" % rid,
            json={"score_value": 3.0, "priority": 9},
            headers=auth_headers,
        )
    assert upd.status_code == 200
    assert "规则更新成功" in _json(upd)["message"]
    assert _json(upd)["data"]["rule"]["score_value"] == 3.0

    with app.app_context():
        dele = client.delete("/api/nlp/rules/%d" % rid, headers=auth_headers)
    assert dele.status_code == 200
    assert "规则删除成功" in _json(dele)["message"]

    with app.app_context():
        db.session.expire_all()
        rec = db.session.get(NLPScoringRule, rid)
        assert rec is not None, "删除必须是软删除，物理记录应保留"
        assert rec.is_active is False
        lst = client.get("/api/nlp/rules?keyword=课堂发言&skip_cache=true", headers=auth_headers)
    assert _json(lst)["data"]["total"] == 0


def test_rule_usage_endpoint(client, app, auth_headers):
    """GET /rules/<id>/usage 返回分页信封，items 带 rule_id。"""
    from models import NLPRuleUsage, db

    rid = _create_rule(client, app, auth_headers, "帮助同学", 2.0, "add")
    with app.app_context():
        db.session.add(
            NLPRuleUsage(
                rule_id=rid,
                student_id=1,
                input_text="帮助同学补习",
                matched_keyword="帮助同学",
                score_change=2.0,
                is_manual_correction=False,
            )
        )
        db.session.commit()
        resp = client.get("/api/nlp/rules/%d/usage" % rid, headers=auth_headers)
    assert resp.status_code == 200
    body = _json(resp)
    assert body["success"] is True
    assert body["data"]["total"] == 1
    assert body["data"]["items"][0]["rule_id"] == rid


def test_rule_statistics_endpoint_shape(client, app, auth_headers):
    """GET /rules/statistics 返回全部 7 个统计字段且新规则计入 total_rules。"""
    _create_rule(client, app, auth_headers, "统计关键字", 1.0, "add")
    with app.app_context():
        resp = client.get("/api/nlp/rules/statistics?skip_cache=true", headers=auth_headers)
    assert resp.status_code == 200
    data = _json(resp)["data"]
    for key in (
        "total_rules",
        "add_rules",
        "deduct_rules",
        "total_usage",
        "manual_corrections",
        "accuracy_rate",
        "high_usage_rules",
    ):
        assert key in data, key
    assert data["total_rules"] >= 1, "新创建规则应计入 total_rules"


def test_rule_suggest_requires_keyword(client, app, auth_headers):
    """GET /rules/suggest：空关键词 → 400；有关键词 → 列表。"""
    with app.app_context():
        bad = client.get("/api/nlp/rules/suggest", headers=auth_headers)
    assert bad.status_code == 400
    assert "关键词不能为空" in _json(bad)["message"]

    _create_rule(client, app, auth_headers, "推荐关键词", 1.0, "add")
    with app.app_context():
        ok = client.get("/api/nlp/rules/suggest?keyword=推荐", headers=auth_headers)
    assert ok.status_code == 200
    body = _json(ok)
    assert body["success"] is True
    assert isinstance(body["data"], list)


def test_rule_batch_import_counts(client, app, auth_headers):
    """POST /rules/batch-import：空数组 → 400；重复项跳过并正确计数。"""
    with app.app_context():
        empty = client.post(
            "/api/nlp/rules/batch-import", json={"rules": []}, headers=auth_headers
        )
    assert empty.status_code == 400
    assert "规则数据不能为空" in _json(empty)["message"]

    rules = [
        {"behavior_keyword": "批量甲", "score_value": 1.0, "score_type": "add"},
        {"behavior_keyword": "批量乙", "score_value": 2.0, "score_type": "add"},
        {"behavior_keyword": "批量甲", "score_value": 1.0, "score_type": "add"},
    ]
    with app.app_context():
        resp = client.post(
            "/api/nlp/rules/batch-import", json={"rules": rules}, headers=auth_headers
        )
    assert resp.status_code == 200
    data = _json(resp)["data"]
    assert data["imported_count"] == 2
    assert data["skipped_count"] == 1


def test_parse_degrades_gracefully_when_parser_raises(client, app, auth_headers, monkeypatch):
    """P1-4 BERT/ML 降级：解析器抛错时 /parse 必须返回标准错误信封，而非崩溃或假成功。

    @safe_handle() 兜底：非 HTTP 异常被捕获并记日志，响应仍是合法信封
    {success: False, ...}；绝不允许把解析失败包装成 success=True 返回（假绿）。
    """
    from api.nlp import nlp_routes

    class _BrokenParser:
        """模拟 BERT / ML 推理链路不可用。"""

        def parse(self, *args, **kwargs):
            raise RuntimeError("BERT 模型不可用")

    monkeypatch.setattr(nlp_routes, "_get_parser", lambda: _BrokenParser())

    with app.app_context():
        resp = client.post(
            "/api/nlp/parse", json={"text": "张三迟到扣2分"}, headers=auth_headers
        )
    assert resp.status_code == 500
    body = _json(resp)
    assert body["success"] is False, "解析失败不得包装成成功返回（拒绝假绿）"
