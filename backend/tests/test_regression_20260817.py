"""F1/F2 修复回归测试（2026-08-17 系统级评估修复）"""

import inspect

import pytest


class TestRuleLimitRegression:
    """F1: check_rule_limits 缺 .first() → min_interval 规则 500 的回归"""

    def test_check_rule_limits_uses_first(self):
        """records_routes.check_rule_limits 的 min_interval 分支必须调用 .first()（Query 恒真 bug）"""
        from api.scores.records_routes import check_rule_limits

        src = inspect.getsource(check_rule_limits)
        # 原 bug：query 未 .first()，last_record 为 Query 对象恒真 → .created_at 抛 AttributeError
        assert ".first()" in src, "check_rule_limits 必须对 last_record 查询调用 .first()"

    def test_box_routes_rule_limit_uses_first(self):
        """box_routes 刷卡限流分支同样补 .first()"""
        import api.devices.box_routes as box_routes

        src = inspect.getsource(box_routes)
        assert ".first()" in src, "box_routes 限流分支必须调用 .first()"

    def test_check_rule_limits_returns_tuple_with_valid_rule(self, app, db_session):
        """配置 min_interval 的规则调用 check_rule_limits 不再抛 AttributeError"""
        from models import User, ScoreRule, ScoreRecord
        from api.scores.records_routes import check_rule_limits

        with app.app_context():
            student = User.query.filter_by(role="student").first()
            if student is None:
                # 测试库无 seed 学生时自建（card_id 唯一必填）
                student = User(
                    name="回归测试学生",
                    card_id="reg_f1_20260817",
                    role="student",
                    class_name="回归测试班",
                )
                db_session.add(student)
                db_session.commit()
                db_session.refresh(student)
            rule = ScoreRule(
                name="回归-限频", score=1, min_interval=60, daily_limit=10
            )
            db_session.add(rule)
            db_session.commit()
            db_session.refresh(rule)
            # 首次调用（无历史记录）应返回 (True, None)；若 Query 恒真 bug 复现则抛 AttributeError
            allowed, message = check_rule_limits(student.id, rule.id)
            assert allowed is True
            assert message is None
            # 插入一条记录后再次调用（min_interval 生效，应返回 False 而非 500）
            db_session.add(
                ScoreRecord(student_id=student.id, rule_id=rule.id, score_change=1, description="回归记录")
            )
            db_session.commit()
            allowed2, message2 = check_rule_limits(student.id, rule.id)
            assert allowed2 is False
            assert message2 is not None


class TestExamImportPreviewRegression:
    """F2: exam-import/preview 此前 subject_id 未定义 → NameError 恒 500"""

    def test_preview_resolves_subject_id(self):
        """preview 端点源码必须解析 subject_id（与 execute 一致）"""
        from api.academics import exam_import_routes

        src = inspect.getsource(exam_import_routes.PreviewImportData.post)
        assert "_resolve_subject_id(subject, None)" in src, "preview 必须调用 _resolve_subject_id"


class TestR1R9ReviewRegression:
    """R1-R9 修复后复核补漏项回归（2026-08-17 第 4 轮）"""

    def test_score_to_dict_no_rank(self, app, db_session):
        """R7 复核: Score.to_dict 不得访问已删的 rank 列（原访问 self.rank → 有成绩即 AttributeError）"""
        from models import User, Subject, Exam, Score

        with app.app_context():
            student = User(
                name="复核学生", card_id="reg_r7_20260817", role="student", class_name="复核班"
            )
            db_session.add(student)
            db_session.commit()
            subject = Subject(name="数学", code="MATH")
            db_session.add(subject)
            db_session.commit()
            exam = Exam(name="复核考试", class_id=None)
            db_session.add(exam)
            db_session.commit()
            score = Score(
                exam_id=exam.id,
                student_id=student.id,
                subject_id=subject.id,
                score=90.0,
                full_score=100.0,
                status="confirmed",
            )
            db_session.add(score)
            db_session.commit()
            db_session.refresh(score)
            d = score.to_dict()
            assert "rank" not in d
            assert d["score"] == 90.0

    def test_approve_leave_generates_attendance(self, app, db_session):
        """P1-4 复核: 请假审批通过后生成考勤记录（status=leave），否则考勤统计漏掉请假"""
        from datetime import date, timedelta
        from models import User, Approval
        from models.attendance import Attendance
        from services.attendance_service import attendance_service

        with app.app_context():
            student = User(
                name="请假学生", card_id="reg_leave_20260817", role="student",
                class_name="复核班", class_info_id=1,
            )
            db_session.add(student)
            db_session.commit()
            db_session.refresh(student)
            leave = Approval(
                student_id=student.id, type="leave", leave_type="personal",
                start_date=date.today(), end_date=date.today() + timedelta(days=1),
                description="复核请假", status="pending",
            )
            db_session.add(leave)
            db_session.commit()
            db_session.refresh(leave)
            result = attendance_service.approve_leave(leave.id, approve=True)
            assert result.get("success") is True
            rows = Attendance.query.filter_by(student_id=student.id, status="leave").all()
            assert len(rows) == 2, f"应生成 2 天请假考勤，实际 {len(rows)}"

    def test_recalculate_without_composite_no_crash(self, app, db_session):
        """P2-8 复核: 学生无综合评分记录时 recalc 返回 None 不崩（原 active_user_ids.index() ValueError）"""
        from models import User
        from services.composite_score_service import CompositeScoreService

        with app.app_context():
            student = User(
                name="新学生", card_id="reg_p28_20260817", role="student", class_name="复核班"
            )
            db_session.add(student)
            db_session.commit()
            db_session.refresh(student)
            result = CompositeScoreService.recalculate_user_score(student.id)
            assert result is None  # 无 composite 记录 → 跳过，由全量计算生成

    def test_unlock_daily_limit_none_no_crash(self, app, db_session):
        """R2 复核: daily_unlock_limit 为 NULL 的历史学生校验不崩（原 None 比较 TypeError）"""
        from models import User
        from services.unlock_validator import UnlockValidator

        with app.app_context():
            student = User(
                name="老数据学生", card_id="reg_nl_20260817", role="student",
                class_name="复核班", current_score=85, is_active=True,
                daily_unlock_limit=None,  # 历史数据 NULL
            )
            db_session.add(student)
            db_session.commit()
            db_session.refresh(student)
            allowed, reason, info = UnlockValidator.validate_unlock(
                student.card_id, skip_time_window=True
            )
            # 不崩即可；daily limit 按默认 5 处理，应通过
            assert reason not in ("daily_limit_exceeded",)

    def test_policy_serialize_no_policy(self):
        """P2-7 复核: 无策略时 allow_self_unlock 应为 False（原 True 与 evaluate DEFER 矛盾）"""
        from api.phonebox import phonebox_policy_routes as pr

        serialized = pr._serialize(None, 99)
        assert serialized["allow_self_unlock"] is False

    def test_mqtt_no_python_readmodifywrite(self):
        """R5 复核: mqtt_message_service 不应再有 apply_score_limit 读改写（rule_name/score_change 路径已原子化）"""
        import services.mqtt_message_service as m

        src = inspect.getsource(m)
        # 仅保留定义处 1 次；若残留调用即回归
        assert src.count("apply_score_limit(") == 1, "mqtt 不得再残留 Python 读改写加分"


class TestS12345678910Regression:
    """未覆盖区域深评 S1-S10 修复回归（2026-08-17 第 5 轮）"""

    def test_firmware_download_no_admin_required(self):
        """S1: 固件下载端点不应再挂 requires_permission（固件无认证头 → 401 断链）"""
        import inspect
        from api.devices.firmware_routes import FirmwareDownload

        src = inspect.getsource(FirmwareDownload.get)
        assert "@requires_permission" not in src, "FirmwareDownload.get 不得再挂管理员鉴权"

    def test_firmware_upload_uses_real_md5(self):
        """A-P0-2: 固件上传须计算真 MD5（32 位）而非 SHA256（64 位→固件校验静默跳过）"""
        import inspect
        from api.devices.firmware_routes import FirmwareUpload

        src = inspect.getsource(FirmwareUpload.post)
        assert "hashlib.md5()" in src, "固件上传必须使用 hashlib.md5"

    def test_ota_failed_statuses_mapped(self):
        """S5: mqtt_manager OTA 失败状态须包含固件全部失败码（防自动推送死锁）"""
        import inspect
        from services.mqtt_manager import MQTTManager

        src = inspect.getsource(MQTTManager._process_ota_status)
        for code in ("download_failed", "space_insufficient", "signature_failed", "version_check_failed", "incomplete"):
            assert code in src, f"OTA 失败码 {code} 未映射"

    def test_nlp_scoring_writes_score_record(self):
        """S2: NLP execute_scoring 必须写 ScoreRecord（原直接改 current_score 无流水）"""
        import inspect
        from services.nlp_enhanced_service import EnhancedNLPParserService

        src = inspect.getsource(EnhancedNLPParserService.execute_scoring)
        assert "ScoreRecord(" in src, "NLP 评分必须写积分流水"
        assert "atomic_score_update" in src, "NLP 评分必须走原子累加"

    def test_nlp_sign_normalized_by_intent(self):
        """S6: NLP 分数符号按意图归一化（deduct 规则误存正数不得变加分）"""
        import inspect
        from services.nlp_enhanced_service import EnhancedNLPParserService

        src = inspect.getsource(EnhancedNLPParserService.execute_scoring)
        assert 'score_type == "deduct"' in src, "必须按 score_type 归一化分数符号"

    def test_nlp_multi_intent_rejected(self):
        """S6: 复合句必须明确拒绝而非静默只执行第一人"""
        import inspect
        from services.nlp_enhanced_service import EnhancedNLPParserService

        src = inspect.getsource(EnhancedNLPParserService.execute_scoring)
        assert "多条评分指令" in src, "复合句须提示逐条确认"

    def test_nlp_negation_prefix(self):
        """S6: 否定词前缀（"不要扣分"）不得误判意图"""
        import inspect
        from services.nlp_enhanced_service import EnhancedNLPParserService

        src = inspect.getsource(EnhancedNLPParserService.determine_intent)
        assert "_NEG_PREFIXES" in src, "determine_intent 必须处理否定前缀"

    def test_export_has_class_scope(self):
        """S3: 导出端点必须按班级隔离（班主任不得导出全校）"""
        import inspect
        from api.data.export_routes import ExportData

        src = inspect.getsource(ExportData.post)
        assert "_admin_scope" in src, "导出端点必须调用班级隔离"

    def test_excel_formula_injection_guard(self):
        """S8: Excel 导出必须防公式注入（= + - @ 前缀清洗）"""
        from services.excel_service import ExcelExportService

        result = ExcelExportService._convert_value("=SUM(A1)")
        assert result.startswith("'"), "公式注入未清洗"
        result2 = ExcelExportService._convert_value("@cmd")
        assert result2.startswith("'"), "@ 前缀未清洗"

    def test_backup_delete_basename_guard(self):
        """S8: 备份删除必须校验 basename（防路径穿越删除任意文件）"""
        import inspect
        from api.data.import_export_routes import DeleteBackup

        src = inspect.getsource(DeleteBackup.delete)
        assert "os.path.basename" in src, "备份删除必须校验文件名"
