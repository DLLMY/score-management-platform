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
