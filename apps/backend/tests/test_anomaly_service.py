from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta

try:
    from services.anomaly_service import AnomalyDetector
except ImportError:
    pass

try:
    from services.anomaly_service import AnomalyService
except ImportError:
    pass


class TestAnomalyDetector:
    """异常检测器测试"""

    def test_fit_empty_scores(self):
        """测试训练-空分数列表"""
        from services.anomaly_service import AnomalyDetector

        detector = AnomalyDetector()
        detector.fit([])

        assert detector.fitted is True
        assert detector.mean is not None
        assert detector.std is not None

    def test_fit_with_scores(self):
        """测试训练-有分数数据"""

        detector = AnomalyDetector()
        scores = [1, 2, 3, 4, 5]
        detector.fit(scores)

        assert detector.fitted is True
        assert detector.mean == 3.0
        assert detector.std > 0

    def test_detect_zscore_not_fitted(self):
        """测试Z-Score检测-未训练"""

        detector = AnomalyDetector()
        is_anomaly, z_score = detector.detect_zscore(10)

        assert is_anomaly is False
        assert z_score == 0.0

    def test_detect_zscore_zero_std(self):
        """测试Z-Score检测-标准差为0"""

        detector = AnomalyDetector()
        detector.fit([5, 5, 5])
        is_anomaly, z_score = detector.detect_zscore(10)

        assert is_anomaly is False
        assert z_score == 0.0

    def test_detect_zscore_normal(self):
        """测试Z-Score检测-正常数据"""

        detector = AnomalyDetector()
        scores = [1, 2, 3, 4, 5]
        detector.fit(scores)
        is_anomaly, z_score = detector.detect_zscore(3)

        assert not is_anomaly
        assert z_score == 0.0

    def test_detect_zscore_anomaly(self):
        """测试Z-Score检测-异常数据"""

        detector = AnomalyDetector()
        scores = [1, 2, 3, 4, 5]
        detector.fit(scores)
        is_anomaly, z_score = detector.detect_zscore(100)

        assert is_anomaly
        assert z_score > 3

    def test_detect_batch_empty(self):
        """测试批量检测-空数据"""

        detector = AnomalyDetector()
        anomalies = detector.detect_batch([])

        assert len(anomalies) == 0

    def test_detect_batch_with_anomalies(self):
        """测试批量检测-有异常"""

        detector = AnomalyDetector()
        scores = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 50]
        anomalies = detector.detect_batch(scores)

        assert len(anomalies) >= 1
        assert any(a["value"] == 50 for a in anomalies)


class TestAnomalyService:
    """异常检测服务测试"""

    def test_get_student_score_changes_empty(self, app):
        """测试获取学生积分变化-空记录"""
        with app.app_context():
            from services.anomaly_service import AnomalyService

            with patch("services.anomaly_service.ScoreRecord.query") as mock_query:
                mock_query.filter.return_value.order_by.return_value.all.return_value = []

                result = AnomalyService.get_student_score_changes(1)

                assert isinstance(result, list)
                assert len(result) == 0

    def test_get_student_score_changes_with_records(self, app):
        """测试获取学生积分变化-有记录"""
        with app.app_context():

            mock_record = MagicMock()
            mock_record.created_at = datetime.now()
            mock_record.score_change = 5
            mock_record.rule_name = "test_rule"

            with patch("services.anomaly_service.ScoreRecord.query") as mock_query:
                mock_query.filter.return_value.order_by.return_value.all.return_value = [
                    mock_record
                ]

                result = AnomalyService.get_student_score_changes(1)

                assert isinstance(result, list)
                assert len(result) == 1
                assert result[0]["score_change"] == 5
                assert result[0]["rule_name"] == "test_rule"

    def test_detect_sudden_change_insufficient_data(self, app):
        """测试检测突变异常-数据不足"""
        with app.app_context():

            with patch("services.anomaly_service.ScoreRecord.query") as mock_query:
                mock_query.filter.return_value.order_by.return_value.all.return_value = []

                result = AnomalyService.detect_sudden_change(1)

                assert isinstance(result, list)
                assert len(result) == 0

    def test_detect_sudden_change_no_anomaly(self, app):
        """测试检测突变异常-无异常"""
        with app.app_context():

            mock_records = []
            for i in range(10):
                mock_record = MagicMock()
                mock_record.created_at = datetime.now() - timedelta(days=i)
                mock_record.score_change = i + 1
                mock_records.append(mock_record)

            with patch("services.anomaly_service.ScoreRecord.query") as mock_query:
                mock_query.filter.return_value.order_by.return_value.all.return_value = mock_records

                result = AnomalyService.detect_sudden_change(1)

                assert isinstance(result, list)

    def test_detect_trend_anomaly_insufficient_data(self, app):
        """测试检测趋势异常-数据不足"""
        with app.app_context():

            with patch("services.anomaly_service.ScoreRecord.query") as mock_query:
                mock_query.filter.return_value.order_by.return_value.all.return_value = []

                result = AnomalyService.detect_trend_anomaly(1)

                assert result["has_anomaly"] is False
                assert result["trend"] == "stable"

    def test_detect_trend_anomaly_rising(self, app):
        """测试检测趋势异常-上升趋势"""
        with app.app_context():

            mock_records = []
            base_date = datetime.now()
            for day in range(5):
                mock_record = MagicMock()
                mock_record.created_at = base_date - timedelta(days=4 - day)
                mock_record.score_change = 2
                mock_records.append(mock_record)

            with patch("services.anomaly_service.ScoreRecord.query") as mock_query:
                mock_query.filter.return_value.order_by.return_value.all.return_value = mock_records

                result = AnomalyService.detect_trend_anomaly(1)

                assert result["has_anomaly"] is True
                assert result["trend"] == "rising"
                assert result["consecutive_days"] == 5
                assert result["total_change"] == 10.0

    def test_detect_trend_anomaly_falling(self, app):
        """测试检测趋势异常-下降趋势"""
        with app.app_context():

            mock_records = []
            base_date = datetime.now()
            for day in range(5):
                mock_record = MagicMock()
                mock_record.created_at = base_date - timedelta(days=4 - day)
                mock_record.score_change = -2
                mock_records.append(mock_record)

            with patch("services.anomaly_service.ScoreRecord.query") as mock_query:
                mock_query.filter.return_value.order_by.return_value.all.return_value = mock_records

                result = AnomalyService.detect_trend_anomaly(1)

                assert result["has_anomaly"] is True
                assert result["trend"] == "falling"
                assert result["consecutive_days"] == 5
                assert result["total_change"] == -10.0

    def test_detect_trend_anomaly_stable(self, app):
        """测试检测趋势异常-稳定趋势"""
        with app.app_context():

            mock_records = []
            base_date = datetime.now()
            changes = [2, -2, 1, -1, 0]
            for day in range(5):
                mock_record = MagicMock()
                mock_record.created_at = base_date - timedelta(days=4 - day)
                mock_record.score_change = changes[day]
                mock_records.append(mock_record)

            with patch("services.anomaly_service.ScoreRecord.query") as mock_query:
                mock_query.filter.return_value.order_by.return_value.all.return_value = mock_records

                result = AnomalyService.detect_trend_anomaly(1)

                assert result["has_anomaly"] is False
                assert result["trend"] == "stable"

    def test_detect_group_anomaly_user_not_found(self, app):
        """测试检测群体异常-用户不存在"""
        with app.app_context():

            with patch("services.anomaly_service.get_by_id", return_value=None):
                result = AnomalyService.detect_group_anomaly(1)

                assert result["has_anomaly"] is False
                assert result["deviation"] == 0

    def test_detect_group_anomaly_no_class(self, app):
        """测试检测群体异常-无班级信息"""
        with app.app_context():

            mock_user = MagicMock()
            mock_user.id = 1
            mock_user.class_name = None

            with patch("services.anomaly_service.get_by_id", return_value=mock_user):
                result = AnomalyService.detect_group_anomaly(1)

                assert result["has_anomaly"] is False
                assert result["deviation"] == 0

    def test_detect_group_anomaly_no_classmates(self, app):
        """测试检测群体异常-无同学"""
        with app.app_context():

            mock_user = MagicMock()
            mock_user.id = 1
            mock_user.class_name = "一班"

            with patch("services.anomaly_service.get_by_id", return_value=mock_user):
                with patch("services.anomaly_service.User.query") as mock_query:
                    mock_query.filter.return_value.all.return_value = []
                    with patch("services.anomaly_service.ScoreRecord.query") as mock_score_query:
                        mock_score_query.filter.return_value.order_by.return_value.all.return_value = (
                            []
                        )

                        result = AnomalyService.detect_group_anomaly(1)

                        assert result["has_anomaly"] is False
                        assert result["deviation"] == 0

    def test_detect_group_anomaly_with_data(self, app):
        """测试检测群体异常-有数据"""
        with app.app_context():

            mock_user = MagicMock()
            mock_user.id = 1
            mock_user.class_name = "一班"

            mock_classmate = MagicMock()
            mock_classmate.id = 2

            mock_user_record = MagicMock()
            mock_user_record.created_at = datetime.now()
            mock_user_record.score_change = 10

            mock_classmate_record = MagicMock()
            mock_classmate_record.created_at = datetime.now()
            mock_classmate_record.score_change = 2

            with patch("services.anomaly_service.get_by_id", return_value=mock_user):
                with patch("services.anomaly_service.User.query") as mock_query:
                    mock_query.filter.return_value.all.return_value = [mock_classmate]
                    with patch("services.anomaly_service.ScoreRecord.query") as mock_score_query:

                        def mock_filter(*args, **kwargs):
                            mock_result = MagicMock()
                            mock_result.order_by.return_value.all.return_value = [mock_user_record]
                            return mock_result

                        mock_score_query.filter = mock_filter

                        result = AnomalyService.detect_group_anomaly(1)

                        assert "has_anomaly" in result
                        assert "deviation" in result

    def test_detect_group_anomaly_serializable(self, app):
        """回归：群体异常返回必须是 JSON 原生类型(bool/float)。

        曾因 np.mean/np.std 产生 numpy.bool_/float64，Flask 默认 JSON provider
        无法序列化，导致 /api/algorithm/anomaly/group/<id> 返回 500。
        本测试刻意构造 len(classmate_totals) > 1 以走 np.std 分支。

        AN2 后将「逐同学查库」改为单条聚合查询 db.session.query(
        func.coalesce(func.sum(ScoreRecord.score_change), 0.0)
        ).join(User).filter(...).group_by(ScoreRecord.student_id)，
        故此处用 mock 该聚合查询返回同班同学(排除本人)每生积分总量
        [(2.0,), (8.0,)]，user 自身积分(10)由 get_student_score_changes 提供。
        """
        import json
        from datetime import datetime

        with app.app_context():
            mock_user = MagicMock()
            mock_user.id = 1
            mock_user.class_name = "一班"

            def fake_changes(uid, days):
                sc = {1: 10, 2: 2, 3: 8}.get(uid, 0)
                return [
                    {
                        "date": datetime.now(),
                        "score_change": sc,
                        "rule_name": None,
                        "category": None,
                    }
                ]

            with patch.object(
                AnomalyService, "get_student_score_changes", side_effect=fake_changes
            ):
                with patch("services.anomaly_service.get_by_id", return_value=mock_user):
                    # AN2 后聚合走 db.session.query(...).group_by(ScoreRecord.student_id)，
                    # 返回每名同学积分总量；此处构造 [(2.0,),(8.0,)] 触发 np.std 分支。
                    with patch("services.anomaly_service.db.session") as mock_session:
                        mock_session.query.return_value.join.return_value.filter.return_value.group_by.return_value.all.return_value = [
                            (2.0,),
                            (8.0,),
                        ]
                        result = AnomalyService.detect_group_anomaly(1)

            serialized = json.dumps(result)  # 必须不抛 TypeError
            assert isinstance(result["has_anomaly"], bool)
            assert isinstance(result["deviation"], float)
            assert isinstance(result["class_mean"], float)
            assert isinstance(result["class_std"], float)

    def test_detect_all_anomalies_serializable(self, app):
        """回归：综合异常检测返回可 JSON 序列化，且 summary 布尔为原生类型。"""
        import json
        from datetime import datetime

        with app.app_context():
            mock_user = MagicMock()
            mock_user.id = 1
            mock_user.class_name = "一班"
            mock_classmate1 = MagicMock()
            mock_classmate1.id = 2
            mock_classmate2 = MagicMock()
            mock_classmate2.id = 3

            def fake_changes(uid, days):
                sc = {1: 10, 2: 2, 3: 8}.get(uid, 0)
                return [
                    {
                        "date": datetime.now(),
                        "score_change": sc,
                        "rule_name": None,
                        "category": None,
                    }
                ]

            with patch.object(
                AnomalyService, "get_student_score_changes", side_effect=fake_changes
            ):
                with patch("services.anomaly_service.get_by_id", return_value=mock_user):
                    with patch("services.anomaly_service.User.query") as mock_query:
                        mock_query.filter.return_value.all.return_value = [
                            mock_classmate1,
                            mock_classmate2,
                        ]
                        with patch(
                            "services.anomaly_service.ScoreRecord.query"
                        ) as mock_score_query:
                            mock_score_query.filter.return_value.count.return_value = 0
                            result = AnomalyService.detect_all_anomalies(1)

            json.dumps(result)  # 必须不抛 TypeError
            assert isinstance(result["has_anomaly"], bool)
            assert isinstance(result["summary"]["group_anomaly"], bool)

    def test_detect_frequency_anomaly_normal(self, app):
        """测试检测频率异常-正常频率"""
        with app.app_context():

            with patch("services.anomaly_service.ScoreRecord.query") as mock_query:
                mock_query.filter.return_value.count.return_value = 5

                result = AnomalyService.detect_frequency_anomaly(1)

                assert result["has_anomaly"] is False
                assert result["count"] == 5
                assert result["threshold"] == 10

    def test_detect_frequency_anomaly_high(self, app):
        """测试检测频率异常-高频"""
        with app.app_context():

            with patch("services.anomaly_service.ScoreRecord.query") as mock_query:
                mock_query.filter.return_value.count.return_value = 15

                result = AnomalyService.detect_frequency_anomaly(1)

                assert result["has_anomaly"] is True
                assert result["count"] == 15
                assert result["threshold"] == 10

    def test_detect_all_anomalies_no_anomaly(self, app):
        """测试综合检测-无异常"""
        with app.app_context():

            with patch("services.anomaly_service.ScoreRecord.query") as mock_query:
                mock_query.filter.return_value.order_by.return_value.all.return_value = []
                mock_query.filter.return_value.count.return_value = 5

            with patch("services.anomaly_service.get_by_id", return_value=None):
                result = AnomalyService.detect_all_anomalies(1)

                assert result["user_id"] == 1
                assert result["has_anomaly"] is False
                assert len(result["anomalies"]) == 0
                assert isinstance(result["suggestions"], list)

    def test_detect_all_anomalies_with_anomalies(self, app):
        """测试综合检测-有异常"""
        with app.app_context():

            mock_records = []
            for i in range(10):
                mock_record = MagicMock()
                mock_record.created_at = datetime.now() - timedelta(days=i)
                mock_record.score_change = i + 1
                mock_records.append(mock_record)

            with patch("services.anomaly_service.ScoreRecord.query") as mock_query:
                mock_query.filter.return_value.order_by.return_value.all.return_value = mock_records
                mock_query.filter.return_value.count.return_value = 15

            with patch("services.anomaly_service.get_by_id", return_value=None):
                result = AnomalyService.detect_all_anomalies(1)

                assert result["user_id"] == 1
                assert isinstance(result["anomalies"], list)
                assert isinstance(result["suggestions"], list)

    def test_generate_suggestions_empty(self):
        """测试生成建议-空异常列表"""

        suggestions = AnomalyService._generate_suggestions([])

        assert isinstance(suggestions, list)
        assert len(suggestions) == 0

    def test_generate_suggestions_all_types(self):
        """测试生成建议-所有异常类型"""

        anomalies = [
            {"type": "sudden_change", "name": "突变异常"},
            {"type": "trend_anomaly", "name": "趋势异常"},
            {"type": "group_anomaly", "name": "群体异常"},
            {"type": "frequency_anomaly", "name": "频率异常"},
        ]

        suggestions = AnomalyService._generate_suggestions(anomalies)

        assert len(suggestions) == 4
        assert any(s["type"] == "调查" for s in suggestions)
        assert any(s["type"] == "关注" for s in suggestions)
        assert any(s["type"] == "对比分析" for s in suggestions)
        assert any(s["type"] == "设备检查" for s in suggestions)

    def test_get_all_anomalies_empty(self, app):
        """测试获取所有异常-空学生列表"""
        with app.app_context():

            with patch("services.anomaly_service.User.query") as mock_query:
                mock_query.filter.return_value.all.return_value = []

                result = AnomalyService.get_all_anomalies()

                assert result["total_students"] == 0
                assert result["students_with_anomaly"] == 0
                assert len(result["anomalies"]) == 0

    def test_get_all_anomalies_with_students(self, app):
        """测试获取所有异常-有学生"""
        with app.app_context():

            mock_user = MagicMock()
            mock_user.id = 1
            mock_user.name = "张三"
            mock_user.class_name = "一班"
            mock_user.current_score = 100
            mock_user.is_active = True

            with patch("services.anomaly_service.User.query") as mock_user_query:
                mock_user_query.filter.return_value.all.return_value = [mock_user]
                with patch("services.anomaly_service.ScoreRecord.query") as mock_score_query:
                    mock_score_query.filter.return_value.order_by.return_value.all.return_value = []
                    mock_score_query.filter.return_value.count.return_value = 5
                    with patch("services.anomaly_service.get_by_id", return_value=None):
                        result = AnomalyService.get_all_anomalies()

                        assert result["total_students"] == 1
                        assert isinstance(result["anomalies"], list)

    def test_get_all_anomalies_with_class_filter(self, app):
        """测试获取所有异常-按班级筛选"""
        with app.app_context():

            mock_user = MagicMock()
            mock_user.id = 1
            mock_user.name = "张三"
            mock_user.class_name = "一班"
            mock_user.current_score = 100
            mock_user.is_active = True

            with patch("services.anomaly_service.User.query") as mock_user_query:
                mock_user_query.filter.return_value.filter.return_value.all.return_value = [
                    mock_user
                ]
                with patch("services.anomaly_service.ScoreRecord.query") as mock_score_query:
                    mock_score_query.filter.return_value.order_by.return_value.all.return_value = []
                    mock_score_query.filter.return_value.count.return_value = 5
                    with patch("services.anomaly_service.get_by_id", return_value=None):
                        result = AnomalyService.get_all_anomalies(class_name="一班")

                        assert result["total_students"] == 1
                        assert isinstance(result["anomalies"], list)
