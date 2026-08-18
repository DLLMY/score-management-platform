"""预测置信区间单元测试。

覆盖成绩预测（score_predict）与积分预测（prediction）两个 service 的
confidence_interval 计算：正常结构、边界（历史不足 / 零方差收敛）与路由返回。
后端区间计算逻辑已在 service 内联实现且天然健壮，这里做回归保护。
"""

import pytest
from datetime import datetime, timedelta

from models import ScoreRecord, User
from services.score_predict_service import ScorePredictService
from services.prediction_service import PredictionService


def _make_user(db_session, card_id, current_score=75):
    u = User(name="置信区间测试", card_id=card_id, class_name="CI", current_score=current_score)
    db_session.add(u)
    db_session.commit()
    return u


def _add_records(db_session, uid, changes, base_days=0):
    now = datetime.now()
    for i, c in enumerate(changes):
        db_session.add(
            ScoreRecord(
                user_id=uid,
                score_change=c,
                created_at=now - timedelta(days=base_days + i),
            )
        )
    db_session.commit()


def test_score_predict_confidence_interval_structure(db_session):
    """成绩预测：confidence_interval 为长度2、lower<=upper、predicted 落在区间内。"""
    u = _make_user(db_session, "CI_SCORE_1")
    # 正负波动，确保 std_dev > 0
    _add_records(db_session, u.id, [2, -1, 3, -2, 1, 2, -1, 4, -3, 1])

    res = ScorePredictService.predict_exam_score(u.id)
    assert "confidence_interval" in res
    ci = res["confidence_interval"]
    assert isinstance(ci, (list, tuple)) and len(ci) == 2
    lower, upper = ci[0], ci[1]
    assert lower <= upper
    # 成绩预测：lower = predicted-2σ, upper = predicted+2σ，σ>=0 → predicted 必在区间内
    assert lower <= res["predicted_score"] <= upper


def test_prediction_confidence_interval_normal(db_session):
    """积分预测：历史>=7 条时应返回合法置信区间。"""
    u = _make_user(db_session, "CI_PRED_1")
    _add_records(db_session, u.id, [2, -1, 3, -2, 1, 2, -1, 4])

    res = PredictionService.predict_future_scores(u.id)
    assert "confidence_interval" in res
    ci = res["confidence_interval"]
    assert isinstance(ci, (list, tuple)) and len(ci) == 2
    assert ci[0] <= ci[1]


def test_prediction_insufficient_data_no_interval(db_session):
    """积分预测：历史<7 条时早期返回，不应包含 confidence_interval 键。"""
    u = _make_user(db_session, "CI_PRED_2")
    _add_records(db_session, u.id, [1, -1, 2])  # 仅 3 条

    res = PredictionService.predict_future_scores(u.id)
    assert "confidence_interval" not in res
    assert res.get("trend") == "insufficient_data"


def test_prediction_zero_variance_interval_collapses(db_session):
    """积分预测：历史波动为零（所有 score_change 相同）→ 区间收敛为单点。"""
    u = _make_user(db_session, "CI_PRED_3")
    _add_records(db_session, u.id, [1, 1, 1, 1, 1, 1, 1, 1])  # 8 条全相同

    res = PredictionService.predict_future_scores(u.id)
    assert "confidence_interval" in res
    ci = res["confidence_interval"]
    assert ci[0] == ci[1]


def test_score_predict_route_returns_interval(client, auth_headers, db_session):
    """路由 /api/algorithm/score-predict/<id> 应返回含 confidence_interval 的 data。"""
    u = _make_user(db_session, "CI_SCORE_ROUTE")
    _add_records(db_session, u.id, [2, -1, 3, -2, 1, 2, -1, 4])

    resp = client.get(f"/api/algorithm/score-predict/{u.id}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()["data"]
    assert "confidence_interval" in data
    assert len(data["confidence_interval"]) == 2
