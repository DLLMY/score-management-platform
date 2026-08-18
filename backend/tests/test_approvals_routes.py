"""approvals 路由行为测试。

测试先行（F17 铁律）：在将写入/事务路径迁移到 approval_service 之前，先建立可固化行为的
基线用例，覆盖创建/审批/驳回/更新/删除全流程及关键边界（已处理不可重复、积分原子累加、
学生通知中心落库、数据隔离、分页筛选）。迁移后重跑须全部保持绿，确保零契约漂移。
"""

from models import Approval, User, ScoreRecord, Notification


def _unwrap(payload):
    """兼容 API 信封单/双元组：单元组 → dict；双重元组 → [envelope, status] 列表取首个。"""
    return payload[0] if isinstance(payload, list) else payload


class TestApprovalsRoutes:

    # ---------- 只读列表/详情 ----------

    def test_get_approvals_list(self, client, app, auth_headers):
        with app.app_context():
            resp = client.get("/api/approvals/", headers=auth_headers)
            assert resp.status_code == 200
            body = _unwrap(resp.get_json())
            assert body["success"] is True
            assert "approvals" in body["data"]
            assert "pagination" in body["data"]

    def test_get_approval_detail(self, client, app, auth_headers, sample_user, db_session):
        with app.app_context():
            a = Approval(student_id=sample_user.id, type="score_adjust", title="详情", score_change=5, status="pending")
            db_session.add(a)
            db_session.commit()
            resp = client.get("/api/approvals/%d" % a.id, headers=auth_headers)
            assert resp.status_code == 200
            body = _unwrap(resp.get_json())
            assert body["data"]["id"] == a.id
            # 契约修复：detail 端点补齐 student_id（与 list 端点一致，F17 已知不一致已整改）
            assert body["data"]["user_id"] == sample_user.id
            assert body["data"]["student_id"] == sample_user.id
            assert body["data"]["status"] == "pending"

    def test_get_approval_detail_404(self, client, app, auth_headers):
        with app.app_context():
            resp = client.get("/api/approvals/999999", headers=auth_headers)
            assert resp.status_code == 404

    def test_get_pending_approvals(self, client, app, auth_headers):
        with app.app_context():
            resp = client.get("/api/approvals/pending", headers=auth_headers)
            assert resp.status_code == 200
            body = _unwrap(resp.get_json())
            assert body["success"] is True
            assert "approvals" in body["data"]

    def test_pending_only_returns_pending(self, client, app, auth_headers, sample_user, db_session):
        with app.app_context():
            pending_a = Approval(student_id=sample_user.id, type="t", title="待审", score_change=1, status="pending")
            approved_a = Approval(student_id=sample_user.id, type="t", title="已批", score_change=1, status="approved")
            db_session.add(pending_a)
            db_session.add(approved_a)
            db_session.commit()
            pending_id = pending_a.id
            approved_id = approved_a.id
            resp = client.get("/api/approvals/pending", headers=auth_headers)
            body = _unwrap(resp.get_json())
            items = body["data"]["approvals"]
            # 契约修复：pending 列表补齐 status（与全量列表一致）
            assert len(items) == 1
            assert items[0]["id"] == pending_id
            assert items[0]["status"] == "pending"
            ids = [it["id"] for it in items]
            assert approved_id not in ids

    # ---------- 创建 ----------

    def test_create_approval_success(self, client, app, auth_headers, sample_user, db_session):
        with app.app_context():
            resp = client.post(
                "/api/approvals/",
                json={
                    "user_id": sample_user.id,
                    "type": "score_adjust",
                    "title": "测试审批",
                    "description": "测试",
                    "score_change": 5,
                },
                headers=auth_headers,
            )
            assert resp.status_code == 201
            body = _unwrap(resp.get_json())
            assert body["success"] is True
            aid = body["data"]["approval_id"]
            assert aid is not None
            a = Approval.query.get(aid)
            assert a is not None
            assert a.student_id == sample_user.id
            assert a.status == "pending"
            assert a.score_change == 5

    def test_create_approval_missing_user_id(self, client, app, auth_headers):
        with app.app_context():
            resp = client.post("/api/approvals/", json={"type": "x"}, headers=auth_headers)
            assert resp.status_code == 400

    def test_create_approval_student_not_found(self, client, app, auth_headers, db_session):
        with app.app_context():
            resp = client.post(
                "/api/approvals/",
                json={"user_id": 999999, "type": "score_adjust", "title": "x"},
                headers=auth_headers,
            )
            assert resp.status_code == 404

    # ---------- 审批通过 ----------

    def test_approve_approval_success(self, client, app, auth_headers, sample_user, db_session):
        with app.app_context():
            # 降到 50，避免默认 max_score=100 钳制，使积分变动可观测
            sample_user.current_score = 50
            db_session.commit()
            a = Approval(student_id=sample_user.id, type="score_adjust", title="加分", description="x", score_change=10, status="pending")
            db_session.add(a)
            db_session.commit()
            aid = a.id
            resp = client.post(
                "/api/approvals/%d/approve" % aid,
                json={"approver_id": 1, "comment": "通过"},
                headers=auth_headers,
            )
            assert resp.status_code == 200
            body = _unwrap(resp.get_json())
            assert body["success"] is True
            # 积分原子累加：50 + 10 = 60
            u = User.query.get(sample_user.id)
            assert u.current_score == 60
            assert body["data"]["new_points"] == 60
            assert body["data"]["score_change"] == 10
            # ScoreRecord 已生成，积分变动量 = actual_change = 10
            rec = ScoreRecord.query.filter_by(student_id=sample_user.id).first()
            assert rec is not None
            assert rec.score_change == 10
            # 学生通知中心落库 approval_result
            notif = Notification.query.filter_by(student_id=sample_user.id, type="approval_result").first()
            assert notif is not None
            assert notif.recipient_type == "user"
            assert "审批通过" in notif.title
            # 状态翻转
            assert Approval.query.get(aid).status == "approved"

    def test_approve_approval_not_pending(self, client, app, auth_headers, sample_user, db_session):
        with app.app_context():
            a = Approval(student_id=sample_user.id, type="score_adjust", title="x", score_change=5, status="approved")
            db_session.add(a)
            db_session.commit()
            resp = client.post(
                "/api/approvals/%d/approve" % a.id,
                json={"approver_id": 1},
                headers=auth_headers,
            )
            assert resp.status_code == 400

    def test_approve_no_score_change_does_not_mutate(self, client, app, auth_headers, sample_user, db_session):
        with app.app_context():
            a = Approval(student_id=sample_user.id, type="leave", title="请假", score_change=None, status="pending")
            db_session.add(a)
            db_session.commit()
            before = sample_user.current_score
            resp = client.post("/api/approvals/%d/approve" % a.id, json={"approver_id": 1}, headers=auth_headers)
            assert resp.status_code == 200
            u = User.query.get(sample_user.id)
            assert u.current_score == before
            # 无积分变动则不应生成 ScoreRecord
            assert ScoreRecord.query.filter_by(student_id=sample_user.id).first() is None

    # ---------- 审批拒绝 ----------

    def test_reject_approval_success(self, client, app, auth_headers, sample_user, db_session):
        with app.app_context():
            a = Approval(student_id=sample_user.id, type="score_adjust", title="请假", description="x", score_change=5, status="pending")
            db_session.add(a)
            db_session.commit()
            resp = client.post(
                "/api/approvals/%d/reject" % a.id,
                json={"approver_id": 1, "comment": "不通过"},
                headers=auth_headers,
            )
            assert resp.status_code == 200
            body = _unwrap(resp.get_json())
            assert body["success"] is True
            assert Approval.query.get(a.id).status == "rejected"
            notif = Notification.query.filter_by(student_id=sample_user.id, type="approval_result").first()
            assert notif is not None
            assert notif.recipient_type == "user"
            assert "未通过" in notif.content

    def test_reject_approval_not_pending(self, client, app, auth_headers, sample_user, db_session):
        with app.app_context():
            a = Approval(student_id=sample_user.id, type="score_adjust", title="x", score_change=5, status="rejected")
            db_session.add(a)
            db_session.commit()
            resp = client.post("/api/approvals/%d/reject" % a.id, json={"approver_id": 1}, headers=auth_headers)
            assert resp.status_code == 400

    def test_reject_does_not_change_score(self, client, app, auth_headers, sample_user, db_session):
        with app.app_context():
            a = Approval(student_id=sample_user.id, type="score_adjust", title="x", score_change=20, status="pending")
            db_session.add(a)
            db_session.commit()
            before = sample_user.current_score
            resp = client.post("/api/approvals/%d/reject" % a.id, json={"approver_id": 1}, headers=auth_headers)
            assert resp.status_code == 200
            assert User.query.get(sample_user.id).current_score == before

    # ---------- 更新 / 删除 ----------

    def test_update_approval(self, client, app, auth_headers, sample_user, db_session):
        with app.app_context():
            a = Approval(student_id=sample_user.id, type="score_adjust", title="原", score_change=5, status="pending")
            db_session.add(a)
            db_session.commit()
            resp = client.put(
                "/api/approvals/%d" % a.id,
                json={"title": "改后", "description": "d", "score_change": 8},
                headers=auth_headers,
            )
            assert resp.status_code == 200
            a2 = Approval.query.get(a.id)
            assert a2.title == "改后"
            assert a2.score_change == 8

    def test_delete_approval(self, client, app, auth_headers, sample_user, db_session):
        with app.app_context():
            a = Approval(student_id=sample_user.id, type="score_adjust", title="x", score_change=5, status="pending")
            db_session.add(a)
            db_session.commit()
            aid = a.id
            resp = client.delete("/api/approvals/%d" % aid, headers=auth_headers)
            assert resp.status_code == 200
            assert Approval.query.get(aid) is None
