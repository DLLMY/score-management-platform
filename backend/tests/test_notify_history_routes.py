class TestNotifyHistoryRoutes:

    def test_get_notify_history_list(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/notify_history/", headers=auth_headers)
            assert response.status_code == 200

    def test_get_notify_history_detail(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/notify_history/1", headers=auth_headers)
            assert response.status_code == 200 or response.status_code == 404

    def test_get_notify_history_stats(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/notify_history/stats", headers=auth_headers)
            assert response.status_code == 200

    def test_clean_notify_history(self, client, app, auth_headers):
        """DELETE /clean 清理 days 天前记录；契约零漂移：返回 success + 整数 deleted_count，且旧记录删除/新记录保留。"""
        from models import db, NotifyHistory
        from datetime import datetime, timedelta

        with app.app_context():
            old = NotifyHistory(text="old", created_at=datetime.now() - timedelta(days=90))
            recent = NotifyHistory(text="recent", created_at=datetime.now())
            db.session.add(old)
            db.session.add(recent)
            db.session.commit()
            old_id, recent_id = old.id, recent.id
            response = client.delete("/api/notify_history/clean?days=30", headers=auth_headers)
            assert response.status_code == 200
            body = response.get_json()
            assert body["success"] is True
            assert isinstance(body["deleted_count"], int)
            # 旧记录被清理，新记录保留（行为等价迁移前后）
            assert NotifyHistory.query.get(old_id) is None
            assert NotifyHistory.query.get(recent_id) is not None
