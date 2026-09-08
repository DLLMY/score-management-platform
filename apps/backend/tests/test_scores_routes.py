try:
    from models import User, ScoreRecord
except ImportError:
    User = None
    ScoreRecord = None


class TestScoreRecordsRoutes:
    """成绩/积分录入端点健壮性回归（对应 records_routes POST /records 校验+回滚修复）"""

    def test_create_record_missing_user_id(self, client, app, auth_headers, db_session):
        with app.app_context():
            response = client.post(
                "/api/records",
                json={"score_change": 10},
                headers=auth_headers,
            )
            assert response.status_code == 400
            assert response.get_json()["success"] is False

    def test_create_record_missing_score_change(self, client, app, auth_headers, db_session):
        with app.app_context():
            user = User(
                name="成绩校验学生A",
                card_id="SCORE_TEST_CARD_A",
                class_name="一班",
                current_score=0,
            )
            db_session.add(user)
            db_session.commit()
            response = client.post(
                "/api/records",
                json={"user_id": user.id},
                headers=auth_headers,
            )
            assert response.status_code == 400
            assert response.get_json()["success"] is False

    def test_create_record_invalid_score_change(self, client, app, auth_headers, db_session):
        with app.app_context():
            user = User(
                name="成绩校验学生B",
                card_id="SCORE_TEST_CARD_B",
                class_name="一班",
                current_score=0,
            )
            db_session.add(user)
            db_session.commit()
            response = client.post(
                "/api/records",
                json={"user_id": user.id, "score_change": "not_a_number"},
                headers=auth_headers,
            )
            assert response.status_code == 400
            assert response.get_json()["success"] is False

    def test_create_record_success_updates_score(self, client, app, auth_headers, db_session):
        with app.app_context():
            user = User(
                name="成绩校验学生C",
                card_id="SCORE_TEST_CARD_C",
                class_name="一班",
                current_score=0,
            )
            db_session.add(user)
            db_session.commit()
            uid = user.id
            response = client.post(
                "/api/records",
                json={"user_id": uid, "score_change": 5},
                headers=auth_headers,
            )
            assert response.status_code == 201
            data = response.get_json()
            assert data["success"] is True
            # 记录已落库
            rec = ScoreRecord.query.filter_by(student_id=uid).first()
            assert rec is not None
            assert rec.score_change == 5
            # 学生当前积分已同步更新
            db_session.refresh(user)
            assert user.current_score == 5

    def test_create_record_recalc_failure_marks_status_and_keeps_data(
        self, client, app, auth_headers, db_session, monkeypatch
    ):
        """T1 回归：综合分重算异常不得污染主数据落库，且响应标记 composite_score=recalculate_failed。"""
        import api.scores.records_routes as rr

        def _recalc_boom(user_id):
            raise RuntimeError("recalc boom")

        monkeypatch.setattr(rr, "enqueue_or_recalc_user_score", _recalc_boom)
        with app.app_context():
            user = User(
                name="成绩重算失败学生",
                card_id="SCORE_RECALC_FAIL_CARD",
                class_name="一班",
                current_score=0,
            )
            db_session.add(user)
            db_session.commit()
            uid = user.id
            response = client.post(
                "/api/records",
                json={"user_id": uid, "score_change": 5},
                headers=auth_headers,
            )
            assert response.status_code == 201
            data = response.get_json()
            assert data["success"] is True
            # 主数据未被重算异常污染：记录照常落库、积分照常更新
            rec = ScoreRecord.query.filter_by(student_id=uid).first()
            assert rec is not None
            assert rec.score_change == 5
            db_session.refresh(user)
            assert user.current_score == 5
            # 重算失败被显式标记，前端可感知综合分可能漂移
            assert data["data"]["composite_score"] == "recalculate_failed"
