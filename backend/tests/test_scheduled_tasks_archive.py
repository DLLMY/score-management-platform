# -*- coding: utf-8 -*-
"""
定时归档任务回归守卫（2026-09-04 修复）。

背景：archive_operation_logs 原按 OperationLog 字段构造 OperationLogArchive，
但归档表实际结构为 original_id/admin_id/action/details/archived_at →
TypeError 恒败，主表日志从不归档。本用例验证：
1. 超过保留期的日志被迁移到 operation_log_archives（字段正确映射）并删除；
2. 保留期内的日志不动。
"""
from datetime import datetime, timedelta

import pytest


@pytest.fixture
def archive_env(app):
    from models import OperationLog, OperationLogArchive

    with app.app_context():
        # 清理既有数据（隔离）
        OperationLogArchive.query.delete()
        OperationLog.query.delete()
        old = OperationLog(
            operation_type="score.change",
            target_type="score",
            target_id=7,
            operator="tester",
            description="旧日志（应归档）",
            before_data="{\"a\":1}",
            after_data="{\"a\":2}",
            ip_address="127.0.0.1",
            user_id=3,
            created_at=datetime.now() - timedelta(days=100),
        )
        recent = OperationLog(
            operation_type="login",
            target_type="user",
            target_id=1,
            operator="tester",
            description="新日志（应保留）",
            user_id=3,
            created_at=datetime.now() - timedelta(days=1),
        )
        from models import db

        db.session.add_all([old, recent])
        db.session.commit()
        yield {"old_id": old.id, "recent_id": recent.id}


class TestArchiveOperationLogs:
    def test_archives_old_and_keeps_recent(self, app, archive_env):
        from models import OperationLog, OperationLogArchive
        from tasks.scheduled_tasks import archive_operation_logs

        with app.app_context():
            result = archive_operation_logs(days_to_keep=30)
            assert result["success"] is True, result
            assert result["archived_count"] == 1
            assert result["deleted_count"] == 1

            # 主表只剩保留期内的日志
            remaining_ids = [r.id for r in OperationLog.query.all()]
            assert remaining_ids == [archive_env["recent_id"]]
            assert archive_env["old_id"] not in remaining_ids

            # 归档表字段映射正确
            archives = OperationLogArchive.query.all()
            assert len(archives) == 1
            a = archives[0]
            assert a.original_id == archive_env["old_id"]
            assert a.admin_id == 3
            assert a.action == "score.change"
            assert a.details["target_type"] == "score"
            assert a.details["target_id"] == 7
            assert a.details["ip_address"] == "127.0.0.1"

    def test_no_old_logs_returns_zero(self, app, archive_env):
        from tasks.scheduled_tasks import archive_operation_logs

        with app.app_context():
            result = archive_operation_logs(days_to_keep=365)
            assert result["success"] is True
            assert result["archived_count"] == 0
            assert result["deleted_count"] == 0
