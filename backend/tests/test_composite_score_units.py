# -*- coding: utf-8 -*-
"""CompositeScore 分量 0-100 统一语义契约测试。

背景（D 级语义不一致，2026-09-04 决策收口）：
- 原全量计算落库：behavior/academic=原始值（积分/均分），social=norm×100；
- 增量重算落库：behavior/academic/social=0-1 norm；
- 读取（get_composite_scores）又独立重算 academic avg —— 三套口径并存，
  同一字段跨行/跨操作不可比。

决策：全链路统一为「0-100 归一化可比分量」（norm×100）：
全量(_calculate_scores) / 增量(recalculate_user_score) 落库口径一致；
读取(get_composite_scores)直接透出存储分量，不再重算。
"""
from unittest.mock import MagicMock, patch

import numpy as np

from services.composite_score_service import CompositeScoreService


class TestCompositeUniformUnit:
    """分量 0-100 契约：全量计算产物"""

    def test_calculate_scores_components_on_0_100_scale(self, app):
        data = [
            {
                "user_id": 1,
                "name": "张三",
                "class_name": "一班",
                "behavior": 80,
                "academic": 85,
                "unlock_count": 2,
                "behavior_norm": 0.2,
                "academic_norm": 0.4,
                "compliance_norm": 0.6,
            },
            {
                "user_id": 2,
                "name": "李四",
                "class_name": "一班",
                "behavior": 90,
                "academic": 92,
                "unlock_count": 0,
                "behavior_norm": 1.0,
                "academic_norm": 1.0,
                "compliance_norm": 0.2,
            },
        ]
        weights = np.array([0.4, 0.3, 0.3])
        results = CompositeScoreService._calculate_scores(data, weights)

        by_user = {r["user_id"]: r for r in results}
        r0, r1 = by_user[1], by_user[2]
        # 分量必须为 norm×100（0-100），而非原始值（80/85/92 等）
        assert r0["behavior_score"] == 20.0
        assert r0["academic_score"] == 40.0
        assert r0["social_score"] == 60.0
        assert r1["behavior_score"] == 100.0
        assert r1["academic_score"] == 100.0
        assert r1["social_score"] == 20.0
        for r in results:
            for key in ("behavior_score", "academic_score", "social_score", "composite_score"):
                assert 0 <= r[key] <= 100, f"{key}={r[key]} 越界 0-100"
        # 排序按 composite 降序：user2（norm 全 1）应居首
        assert results[0]["user_id"] == 2
        assert results[0]["composite_score"] > results[1]["composite_score"]
        assert results[0]["ranking"] == 1
        assert results[1]["ranking"] == 2

    def test_save_results_persists_0_100_trio(self, app):
        from contextlib import nullcontext

        from models import db

        results = [
            {
                "user_id": 1,
                "behavior_score": 20.0,
                "academic_score": 40.0,
                "social_score": 60.0,
                "composite_score": 72.3,
            },
            {
                "user_id": 2,
                "behavior_score": 100.0,
                "academic_score": 100.0,
                "social_score": 20.0,
                "composite_score": 88.4,
            },
        ]
        weights = np.array([0.4, 0.3, 0.3])

        with app.app_context():
            added = []

            def add_capture(obj):
                added.append(obj)  # 不真实落库，仅捕获构造入参

            with patch(
                "services.composite_score_service.CompositeScore.query"
            ) as mock_query:
                mock_query.filter.return_value.delete.return_value = None
                with patch.object(db.session, "add", side_effect=add_capture), patch(
                    "services.composite_score_service.db_session_scope", new=nullcontext
                ):
                    CompositeScoreService._save_results(results, weights)

        assert len(added) == 2
        for i, comp in enumerate(added):
            assert comp.behavior_score == results[i]["behavior_score"]
            assert comp.academic_score == results[i]["academic_score"]
            assert comp.social_score == results[i]["social_score"]
            assert comp.composite_score == results[i]["composite_score"]
            assert comp.weights == {
                "behavior": float(weights[0]),
                "academic": float(weights[1]),
                "social": float(weights[2]),
            }

    def test_get_composite_scores_passthrough_stored_components(self, app):
        """读取透出存储 0-100 分量，且不再触发成绩重算（移除第三套口径）。"""
        comp = MagicMock()
        comp.student_id = 1
        comp.behavior_score = 55.5
        comp.academic_score = 66.6
        comp.composite_score = 72.3
        comp.weights = {"behavior": 0.4, "academic": 0.3, "social": 0.3}
        comp.computed_at = None

        u = MagicMock()
        u.id = 1
        u.name = "张三"
        u.class_name = "一班"

        with patch("services.composite_score_service.CompositeScore.query") as mock_query:
            mock_query.join.return_value.filter.return_value.order_by.return_value.all.return_value = [
                comp
            ]
            with patch("services.composite_score_service.User.query") as mock_user_query:
                mock_user_query.filter.return_value.all.return_value = [u]
                with patch(
                    "services.composite_score_service.db.session.query"
                ) as mock_db_query:
                    result = CompositeScoreService.get_composite_scores()

        assert result["rankings"][0]["behavior_score"] == 55.5
        assert result["rankings"][0]["academic_score"] == 66.6
        # 读路径不再重算 academic：db.session.query（Score 聚合）不得被调用
        mock_db_query.assert_not_called()
