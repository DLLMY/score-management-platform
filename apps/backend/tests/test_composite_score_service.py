#!/usr/bin/env python3
""" """

# 综合评分服务测试模块
"""
"""

from unittest.mock import MagicMock, patch
import numpy as np

try:
    from services.composite_score_service import CompositeScoreService
except ImportError:
    pass


class TestCompositeScoreService:
    """综合评分服务测试类"""

    def test_calculate_composite_score_no_students(self, app):
        """测试计算综合评分-无学生数据"""
        with app.app_context():
            from services.composite_score_service import CompositeScoreService

            with patch("services.composite_score_service.User.query") as mock_query:
                mock_query.filter.return_value.all.return_value = []

                result = CompositeScoreService.calculate_composite_score()

                assert result["method"] == "entropy_weight"
                assert result["weights"] == {}
                assert result["rankings"] == []
                assert result["message"] == "没有找到学生数据"

    def test_calculate_composite_score_with_students(self, app):
        """测试计算综合评分-有学生数据"""
        with app.app_context():

            mock_user1 = MagicMock()
            mock_user1.id = 1
            mock_user1.name = "张三"
            mock_user1.class_name = "一班"
            mock_user1.current_score = 80
            mock_user1.is_active = True

            mock_user2 = MagicMock()
            mock_user2.id = 2
            mock_user2.name = "李四"
            mock_user2.class_name = "一班"
            mock_user2.current_score = 90
            mock_user2.is_active = True

            with patch("services.composite_score_service.User.query") as mock_query:
                mock_query.filter.return_value.all.return_value = [mock_user1, mock_user2]

                with patch("services.composite_score_service.db.session.query") as mock_db_query:
                    mock_academic_stat = MagicMock()
                    mock_academic_stat.student_id = 1
                    mock_academic_stat.avg_score = 85.0
                    mock_academic_stat2 = MagicMock()
                    mock_academic_stat2.student_id = 2
                    mock_academic_stat2.avg_score = 92.0

                    mock_unlock_count = MagicMock()
                    mock_unlock_count.student_id = 1
                    mock_unlock_count.count = 2

                    mock_db_query.return_value.filter.return_value.group_by.return_value.all.return_value = [
                        mock_academic_stat,
                        mock_academic_stat2,
                    ]
                    mock_db_query.return_value.filter.return_value.group_by.return_value.all.side_effect = [
                        [mock_academic_stat, mock_academic_stat2],
                        [mock_unlock_count],
                    ]

                    with patch(
                        "services.composite_score_service.CompositeScore.query"
                    ) as mock_composite_query:
                        mock_composite_query.delete.return_value = None

                        with patch("services.composite_score_service.db_session_scope"):
                            result = CompositeScoreService.calculate_composite_score()

                            assert result["method"] == "entropy_weight"
                            assert len(result["weights"]) == 3
                            assert "behavior" in result["weights"]
                            assert "academic" in result["weights"]
                            assert "compliance" in result["weights"]
                            assert len(result["rankings"]) == 2

    def test_calculate_composite_score_with_class(self, app):
        """测试计算综合评分-按班级过滤"""
        with app.app_context():

            mock_user = MagicMock()
            mock_user.id = 1
            mock_user.name = "张三"
            mock_user.class_name = "二班"
            mock_user.current_score = 80
            mock_user.is_active = True

            with patch("services.composite_score_service.User.query") as mock_query:
                mock_query.filter.return_value.filter.return_value.all.return_value = [mock_user]

                with patch("services.composite_score_service.db.session.query") as mock_db_query:
                    mock_db_query.return_value.filter.return_value.group_by.return_value.all.return_value = (
                        []
                    )

                    with patch(
                        "services.composite_score_service.CompositeScore.query"
                    ) as mock_composite_query:
                        mock_composite_query.delete.return_value = None

                        with patch("services.composite_score_service.db_session_scope"):
                            result = CompositeScoreService.calculate_composite_score(
                                class_name="二班"
                            )

                            assert result["method"] == "entropy_weight"
                            assert len(result["rankings"]) == 1

    def test_get_composite_scores_empty(self, app):
        """测试获取综合评分-无数据"""
        with app.app_context():

            with patch("services.composite_score_service.CompositeScore.query") as mock_query:
                mock_query.join.return_value.filter.return_value.order_by.return_value.all.return_value = (
                    []
                )

                result = CompositeScoreService.get_composite_scores()

                assert result["method"] == "entropy_weight"
                assert result["weights"] == {}
                assert result["rankings"] == []
                assert result["message"] == "暂无综合评分数据，请先计算"

    def test_get_composite_scores_with_data(self, app):
        """测试获取综合评分-有数据"""
        with app.app_context():

            mock_composite = MagicMock()
            mock_composite.student_id = 1
            mock_composite.behavior_weight = 0.3333
            mock_composite.academic_weight = 0.3333
            mock_composite.compliance_weight = 0.3334
            mock_composite.composite_score = 85.5
            mock_composite.ranking = 1

            mock_user = MagicMock()
            mock_user.id = 1
            mock_user.name = "张三"
            mock_user.class_name = "一班"
            mock_user.current_score = 80
            mock_user.is_active = True
            mock_composite.user = mock_user

            with patch("services.composite_score_service.CompositeScore.query") as mock_query:
                mock_query.join.return_value.filter.return_value.order_by.return_value.all.return_value = [
                    mock_composite
                ]

                with patch("services.composite_score_service.db.session.query") as mock_db_query:
                    mock_db_query.return_value.filter.return_value.group_by.return_value.all.return_value = (
                        []
                    )

                    with patch("services.composite_score_service.User.query") as mock_user_query:
                        mock_user_query.filter.return_value.all.return_value = [mock_user]

                        result = CompositeScoreService.get_composite_scores()

                        assert result["method"] == "entropy_weight"
                        assert len(result["weights"]) == 3
                        assert len(result["rankings"]) == 1
                        assert result["rankings"][0]["name"] == "张三"
                        assert result["rankings"][0]["ranking"] == 1

    def test_get_student_composite_score(self, app):
        """测试获取单个学生综合评分"""
        with app.app_context():

            mock_composite = MagicMock()
            mock_composite.student_id = 1
            mock_composite.composite_score = 85.5
            mock_composite.ranking = 1
            mock_composite.behavior_weight = 0.3333
            mock_composite.academic_weight = 0.3333
            mock_composite.compliance_weight = 0.3334

            with patch("services.composite_score_service.CompositeScore.query") as mock_query:
                mock_query.filter_by.return_value.first.return_value = mock_composite
                mock_query.filter.return_value.count.return_value = 0

                result = CompositeScoreService.get_student_composite_score(1)

                assert result is not None
                assert result["user_id"] == 1
                assert result["composite_score"] == 85.5
                assert result["ranking"] == 1

    def test_get_student_composite_score_not_found(self, app):
        """测试获取单个学生综合评分-不存在"""
        with app.app_context():

            with patch("services.composite_score_service.CompositeScore.query") as mock_query:
                mock_query.filter_by.return_value.first.return_value = None

                result = CompositeScoreService.get_student_composite_score(999)

                assert result is None

    def test_recalculate_user_score_no_composite_records(self, app):
        """测试增量更新-无综合评分记录"""
        with app.app_context():

            with patch("services.composite_score_service.CompositeScore.query") as mock_query:
                mock_query.first.return_value = None

                result = CompositeScoreService.recalculate_user_score(1)

                assert result is None

    def test_recalculate_user_score_user_not_found(self, app):
        """测试增量更新-学生不存在"""
        with app.app_context():

            mock_composite = MagicMock()
            mock_composite.behavior_weight = 0.3333
            mock_composite.academic_weight = 0.3333
            mock_composite.compliance_weight = 0.3334

            with patch("services.composite_score_service.CompositeScore.query") as mock_query:
                mock_query.first.return_value = mock_composite

                with patch("services.composite_score_service.get_by_id") as mock_get_by_id:
                    mock_get_by_id.return_value = None

                    result = CompositeScoreService.recalculate_user_score(1)

                    assert result is None

    def test_get_computation_progress(self, app):
        """测试获取计算进度"""
        with app.app_context():

            progress = CompositeScoreService.get_computation_progress()

            assert "status" in progress
            assert "progress" in progress
            assert "message" in progress
            assert "total_students" in progress
            assert "completed_students" in progress

    def test_preprocess_data(self, app):
        """测试数据预处理"""
        with app.app_context():

            data = [
                {
                    "user_id": 1,
                    "name": "张三",
                    "class_name": "一班",
                    "behavior": 80,
                    "academic": 85,
                    "unlock_count": 2,
                },
                {
                    "user_id": 2,
                    "name": "李四",
                    "class_name": "一班",
                    "behavior": 90,
                    "academic": 92,
                    "unlock_count": 1,
                },
            ]

            result = CompositeScoreService._preprocess_data(data)

            assert len(result) == 2
            for item in result:
                assert "behavior_norm" in item
                assert "academic_norm" in item
                assert "compliance_norm" in item
                assert 0 <= item["behavior_norm"] <= 1
                assert 0 <= item["academic_norm"] <= 1
                assert 0 <= item["compliance_norm"] <= 1

    def test_calculate_scores(self, app):
        """测试计算综合得分"""
        with app.app_context():

            data = [
                {
                    "user_id": 1,
                    "name": "张三",
                    "class_name": "一班",
                    "behavior": 80,
                    "academic": 85,
                    "unlock_count": 2,
                    "behavior_norm": 0.5,
                    "academic_norm": 0.5,
                    "compliance_norm": 0.5,
                },
                {
                    "user_id": 2,
                    "name": "李四",
                    "class_name": "一班",
                    "behavior": 90,
                    "academic": 92,
                    "unlock_count": 1,
                    "behavior_norm": 1.0,
                    "academic_norm": 1.0,
                    "compliance_norm": 1.0,
                },
            ]
            weights = np.array([0.3333, 0.3333, 0.3334])

            results = CompositeScoreService._calculate_scores(data, weights)

            assert len(results) == 2
            assert results[0]["ranking"] == 1
            assert results[1]["ranking"] == 2
            assert results[0]["composite_score"] > results[1]["composite_score"]

    def test_score_recalc_dispatcher_falls_back_to_sync(self, app):
        """T4 闸门：CELERY_ASYNC_SCORE_RECALC 未开启时必须同步重算，绝不静默跳过。"""
        with app.app_context():
            # 确保异步开关关闭（默认行为）
            app.config["CELERY_ASYNC_SCORE_RECALC"] = False
            with patch(
                "services.composite_score_service.CompositeScoreService.recalculate_user_score"
            ) as mock_recalc:
                from services.score_recalc import enqueue_or_recalc_user_score

                enqueue_or_recalc_user_score(42)

                mock_recalc.assert_called_once_with(42)
