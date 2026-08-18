"""诚实错误处理回归：dashboard/insights 异常路径不再伪装成功/低风险。

覆盖：
- dashboard 数据服务异常 → APIResponse.error（success:false，不再返回全 0 假统计）
- insights 参与度异常 → engagement.error 标记（不再伪装 level=low）
- insights 风险异常 → risk.error 标记（不再伪装 low）
- insights 参与度周趋势异常 → participation_trend.error 标记（不再伪装 stable）
"""
from unittest import mock

from models import db, User, ClassInfo
from utils.security import generate_student_token


def _student_headers(user) -> dict:
    token = generate_student_token(user.id, user.name, user.card_id)["token"]
    return {"Authorization": "Bearer %s" % token}


class TestHonestErrorHandling:
    @staticmethod
    def _seed_student(app, sid=1, name="A", cid=1):
        with app.app_context():
            db.session.add(ClassInfo(id=cid, name="测试班%d" % cid))
            u = User(
                id=sid, name=name, card_id="CARD_%d" % sid,
                class_info_id=cid, class_name="测试班%d" % cid,
                current_score=100,
            )
            db.session.add(u)
            db.session.commit()
            return u

    def test_dashboard_exception_returns_error_not_fake_zeros(self, client, session):
        """dashboard /stats 数据服务抛异常 → success:false，不再返回全 0 假统计。"""
        from api.analytics.dashboard_routes import dashboard_service

        token = client.post('/api/auth/login', json={
            'username': 'test_admin', 'password': 'test_password'
        }).get_json().get('access_token') or \
            client.post('/api/auth/login', json={
                'username': 'test_admin', 'password': 'test_password'
            }).get_json().get('data', {}).get('access_token')

        with mock.patch.object(dashboard_service, 'get_dashboard_data', side_effect=RuntimeError("boom")):
            resp = client.get('/api/dashboard/stats', headers={'Authorization': f'Bearer {token}'})
        assert resp.status_code == 400  # APIResponse.error 默认 400
        data = resp.get_json()
        assert data['success'] is False
        assert '加载失败' in data.get('message', '')

    def test_insights_engagement_exception_has_error_marker(self, app, client):
        """参与度计算异常 → engagement.error 标记，而非伪装 low。"""
        u = self._seed_student(app)
        import api.student.student_routes as sr

        with mock.patch.object(sr, 'calculate_engagement', side_effect=RuntimeError("boom")):
            resp = client.get('/api/student/insights', headers=_student_headers(u))
        assert resp.status_code == 200
        data = resp.get_json()['data']
        assert data['engagement'].get('error')
        assert '参与度计算失败' in data['engagement']['error']

    def test_insights_risk_exception_has_error_marker(self, app, client):
        """风险评估异常 → risk.error 标记，而非伪装 low。"""
        u = self._seed_student(app)
        import api.student.student_routes as sr
        from services.risk_predict_service import RiskPredictService

        with mock.patch.object(RiskPredictService, 'predict_risk', side_effect=RuntimeError("boom")):
            resp = client.get('/api/student/insights', headers=_student_headers(u))
        assert resp.status_code == 200
        data = resp.get_json()['data']
        assert data['risk'].get('error')
        assert '风险评估失败' in data['risk']['error']

    def test_insights_trend_exception_has_error_marker(self, app, client):
        """参与度周趋势异常 → participation_trend.error 标记，而非伪装 stable。"""
        u = self._seed_student(app)
        import api.student.student_routes as sr
        from services.engagement_service import EngagementService

        with mock.patch.object(EngagementService, 'weekly_trend', side_effect=RuntimeError("boom")):
            resp = client.get('/api/student/insights', headers=_student_headers(u))
        assert resp.status_code == 200
        data = resp.get_json()['data']
        assert data['participation_trend'].get('error')
        assert '参与度周趋势计算失败' in data['participation_trend']['error']


class TestRiskAttendanceHonest:
    def test_attendance_stats_exception_returns_all_none(self, app):
        """_get_attendance_stats 异常 → 全 None（rate=None 触发代理回退），不再伪装缺勤 0。"""
        from services.risk_predict_service import RiskPredictService
        from datetime import date
        from unittest import mock
        from models import Attendance

        with mock.patch.object(Attendance, 'query', spec=['filter']) as mq:
            mq.filter.side_effect = RuntimeError("db down")
            result = RiskPredictService._get_attendance_stats(1, date(2026, 1, 1), date(2026, 1, 31))
        assert result == (None, None, None, None, None)

    def test_predict_risk_attendance_exception_falls_back(self, app, client):
        """考勤读取异常 → predict_risk 仍返回（走代理回退），attendance_rate 为 None 不谎报 0。"""
        from unittest import mock
        from datetime import date
        from models import db, User, ClassInfo
        from utils.security import generate_student_token

        with app.app_context():
            db.session.add(ClassInfo(id=99, name="测试班99"))
            u = User(
                id=5001, name="风险测试", card_id="CARD_5001",
                class_info_id=99, class_name="测试班99",
                current_score=80,
            )
            db.session.add(u)
            db.session.commit()

        from services.risk_predict_service import RiskPredictService
        from models import Attendance
        with mock.patch.object(Attendance, 'query', spec=['filter']) as mq:
            mq.filter.side_effect = RuntimeError("db down")
            result = RiskPredictService.predict_risk(5001, 30)
        assert result["overall_risk_level"] in ("high", "medium", "low")
        assert result["features"]["attendance_rate"] is None
        assert result["features"]["attendance_absent_count"] is None
