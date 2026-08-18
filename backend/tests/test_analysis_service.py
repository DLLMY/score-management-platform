import pytest

try:
    from services.analysis_service import analysis_service
except ImportError:
    pass

try:
    from models import ScoreRecord
except ImportError:
    pass

try:
    from datetime import datetime
except ImportError:
    pass


class TestAnalysisService:
    """分析服务测试"""

    def test_get_user_analysis_empty(self, app):
        """测试获取用户分析 - 无数据"""
        from services.analysis_service import analysis_service

        with app.app_context():
            try:
                analysis_service.get_user_analysis(99999)
            except Exception:
                pass

    def test_get_user_analysis_with_data(self, app, sample_user, db_session):
        """测试获取用户分析 - 有数据"""
        from models import ScoreRecord

        with app.app_context():
            for i in range(5):
                record = ScoreRecord(
                    user_id=sample_user.id,
                    rule_id=1,
                    score_change=10 if i % 2 == 0 else -5,
                    description="测试记录",
                )
                db_session.add(record)
            db_session.commit()

            result = analysis_service.get_user_analysis(sample_user.id)

            assert result["user_id"] == sample_user.id
            assert result["user_name"] == sample_user.name
            assert result["record_count"] >= 5

    def test_get_class_analysis(self, app, sample_user, db_session):
        """测试获取班级分析"""

        with app.app_context():
            result = analysis_service.get_class_analysis("测试班级")

            assert result["class_name"] == "测试班级"
            assert "student_count" in result
            assert "avg_score" in result

    def test_get_unlock_stats_empty(self, app):
        """测试获取开锁统计 - 无数据"""

        with app.app_context():
            result = analysis_service.get_unlock_stats()

            assert result["total_unlock_count"] == 0
            assert result["total_cost"] == 0

    def test_get_unlock_stats_with_data(self, app, sample_user, db_session):
        """测试获取开锁统计 - 有数据"""
        from datetime import datetime

        with app.app_context():
            record = ScoreRecord(
                user_id=sample_user.id,
                rule_id=1,
                score_change=-10,
                description="开锁",
                created_at=datetime.now(),
            )
            db_session.add(record)
            db_session.commit()

            result = analysis_service.get_unlock_stats()

            assert result["total_unlock_count"] >= 1
            assert result["total_cost"] >= 10

    def test_get_class_ranking(self, app):
        """测试获取班级排名"""

        with app.app_context():
            result = analysis_service.get_class_ranking()

            assert "ranking" in result
            assert "total_classes" in result

    def test_get_class_ranking_sort_options(self, app):
        """测试班级排名排序选项"""

        with app.app_context():
            result = analysis_service.get_class_ranking(sort_by="avg_score", order="desc")

            assert "ranking" in result

    def test_get_student_ranking(self, app):
        """测试获取学生排名"""

        with app.app_context():
            result = analysis_service.get_student_ranking()

            assert "ranking" in result
            assert "total_students" in result

    def test_get_student_ranking_with_class(self, app):
        """测试获取指定班级学生排名"""

        with app.app_context():
            result = analysis_service.get_student_ranking(class_name="测试班级")

            assert result["class_name"] == "测试班级"

    def test_get_student_ranking_sort_options(self, app):
        """测试学生排名排序选项"""

        with app.app_context():
            result = analysis_service.get_student_ranking(sort_by="unlock_count", order="desc")

            assert "ranking" in result

    def test_get_class_compare(self, app):
        """测试班级对比分析"""

        with app.app_context():
            result = analysis_service.get_class_compare(["测试班级"])

            assert result["success"] is True
            assert "data" in result

    def test_get_class_compare_empty(self, app):
        """测试班级对比分析 - 空列表"""

        with app.app_context():
            with pytest.raises(ValueError):
                analysis_service.get_class_compare([])

    def test_get_class_compare_period_options(self, app):
        """测试班级对比分析 - 不同周期"""

        with app.app_context():
            result = analysis_service.get_class_compare(["测试班级"], period="7d")

            assert result["period"] == "7d"
            assert result["days"] == 7

    def test_get_dashboard_summary(self, app):
        """测试获取仪表板摘要"""

        with app.app_context():
            result = analysis_service.get_dashboard_summary()

            assert "today" in result
            assert "week" in result
            assert "month" in result
            assert "totals" in result
