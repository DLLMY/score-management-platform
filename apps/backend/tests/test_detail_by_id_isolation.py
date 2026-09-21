"""detail-by-id 越权隔离测试（Step B 收口验证）。

验证 study_group / study_guide（class_id 直查）与 parent（student→class 解析）
三类服务在「非超管 + 非授权班级」下返回 403，在「授权班级」下正常成功。
覆盖点：StudyGroupService.update/delete_group、StudyGuideService.update/delete_guide、
ParentService.update/delete_contact。

隔离机制：patch 三个 service 模块内的 get_current_admin / get_admin_class_ids
（它们用 `from utils.permission import ...` 本地绑定，必须 patch 模块级引用）。
"""
import pytest
from unittest.mock import patch, MagicMock

from models import db
from models.study_group import StudyGroup
from models.study_guide import StudyGuide
from models.parent import ParentContact
from models.user_models import User
from models.system_models import ClassInfo
from models.alert_models import Alert

from services.study_group_service import study_group_service
from services.study_guide_service import study_guide_service
from services.parent_service import parent_service
from services.alert_service import alert_service


def _make_class_and_student(db_session, class_name, card_id):
    cls = ClassInfo(name=class_name, grade="高一")
    db_session.add(cls)
    db_session.flush()
    student = User(name="学生甲", card_id=card_id, class_info_id=cls.id)
    db_session.add(student)
    db_session.flush()
    return cls, student


def _scoped_admin(role="teacher"):
    admin = MagicMock()
    admin.role = role
    admin.id = 1
    return admin


class TestStudyGroupIsolation:
    def test_update_allowed(self, app, db_session):
        cls, _ = _make_class_and_student(db_session, "SG-A", "SG-A-CARD")
        g = StudyGroup(class_id=cls.id, name="组1")
        db_session.add(g)
        db_session.flush()
        admin = _scoped_admin()
        with patch(
            "services.study_group_service.get_current_admin", return_value=admin
        ), patch(
            "services.study_group_service.get_admin_class_ids", return_value=[cls.id]
        ):
            res = study_group_service.update_group(g.id, {"name": "组2"})
        assert res["success"] is True
        assert res["data"]["name"] == "组2"

    def test_update_denied(self, app, db_session):
        cls, _ = _make_class_and_student(db_session, "SG-B", "SG-B-CARD")
        g = StudyGroup(class_id=cls.id, name="组X")
        db_session.add(g)
        db_session.flush()
        admin = _scoped_admin()
        with patch(
            "services.study_group_service.get_current_admin", return_value=admin
        ), patch(
            "services.study_group_service.get_admin_class_ids", return_value=[999]
        ):
            res = study_group_service.update_group(g.id, {"name": "组Y"})
        assert res[0]["success"] is False
        assert res[1] == 403

    def test_delete_allowed(self, app, db_session):
        cls, _ = _make_class_and_student(db_session, "SG-C", "SG-C-CARD")
        g = StudyGroup(class_id=cls.id, name="待删组")
        db_session.add(g)
        db_session.flush()
        gid = g.id
        admin = _scoped_admin()
        with patch(
            "services.study_group_service.get_current_admin", return_value=admin
        ), patch(
            "services.study_group_service.get_admin_class_ids", return_value=[cls.id]
        ):
            res = study_group_service.delete_group(gid)
        assert res["success"] is True
        assert StudyGroup.query.get(gid) is None

    def test_delete_denied(self, app, db_session):
        cls, _ = _make_class_and_student(db_session, "SG-D", "SG-D-CARD")
        g = StudyGroup(class_id=cls.id, name="越权删组")
        db_session.add(g)
        db_session.flush()
        gid = g.id
        admin = _scoped_admin()
        with patch(
            "services.study_group_service.get_current_admin", return_value=admin
        ), patch(
            "services.study_group_service.get_admin_class_ids", return_value=[999]
        ):
            res = study_group_service.delete_group(gid)
        assert res[0]["success"] is False
        assert res[1] == 403
        # 越权未删：记录仍在
        assert StudyGroup.query.get(gid) is not None


class TestStudyGuideIsolation:
    def test_update_allowed(self, app, db_session):
        cls, _ = _make_class_and_student(db_session, "SG-A", "SG-A-CARD2")
        guide = StudyGuide(class_id=cls.id, title="指导1")
        db_session.add(guide)
        db_session.flush()
        admin = _scoped_admin()
        with patch(
            "services.study_guide_service.get_current_admin", return_value=admin
        ), patch(
            "services.study_guide_service.get_admin_class_ids", return_value=[cls.id]
        ):
            res = study_guide_service.update_guide(guide.id, {"title": "指导2"})
        assert res["success"] is True
        assert res["data"]["title"] == "指导2"

    def test_update_denied(self, app, db_session):
        cls, _ = _make_class_and_student(db_session, "SG-B", "SG-B-CARD2")
        guide = StudyGuide(class_id=cls.id, title="越权指导")
        db_session.add(guide)
        db_session.flush()
        admin = _scoped_admin()
        with patch(
            "services.study_guide_service.get_current_admin", return_value=admin
        ), patch(
            "services.study_guide_service.get_admin_class_ids", return_value=[999]
        ):
            res = study_guide_service.update_guide(guide.id, {"title": "改不动"})
        assert res[0]["success"] is False
        assert res[1] == 403

    def test_delete_allowed(self, app, db_session):
        cls, _ = _make_class_and_student(db_session, "SG-C", "SG-C-CARD2")
        guide = StudyGuide(class_id=cls.id, title="待删指导")
        db_session.add(guide)
        db_session.flush()
        gid = guide.id
        admin = _scoped_admin()
        with patch(
            "services.study_guide_service.get_current_admin", return_value=admin
        ), patch(
            "services.study_guide_service.get_admin_class_ids", return_value=[cls.id]
        ):
            res = study_guide_service.delete_guide(gid)
        assert res["success"] is True
        assert StudyGuide.query.get(gid) is None

    def test_delete_denied(self, app, db_session):
        cls, _ = _make_class_and_student(db_session, "SG-D", "SG-D-CARD2")
        guide = StudyGuide(class_id=cls.id, title="越权删指导")
        db_session.add(guide)
        db_session.flush()
        gid = guide.id
        admin = _scoped_admin()
        with patch(
            "services.study_guide_service.get_current_admin", return_value=admin
        ), patch(
            "services.study_guide_service.get_admin_class_ids", return_value=[999]
        ):
            res = study_guide_service.delete_guide(gid)
        assert res[0]["success"] is False
        assert res[1] == 403
        assert StudyGuide.query.get(gid) is not None


class TestParentContactIsolation:
    def test_update_allowed(self, app, db_session):
        cls, student = _make_class_and_student(db_session, "PC-A", "PC-A-CARD")
        contact = ParentContact(student_id=student.id, father_name="原父")
        db_session.add(contact)
        db_session.flush()
        admin = _scoped_admin()
        with patch(
            "services.parent_service.get_current_admin", return_value=admin
        ), patch(
            "services.parent_service.get_admin_class_ids", return_value=[cls.id]
        ):
            res = parent_service.update_contact(contact.id, {"father_name": "新父"})
        assert res["success"] is True
        assert res["data"]["father_name"] == "新父"

    def test_update_denied(self, app, db_session):
        cls, student = _make_class_and_student(db_session, "PC-B", "PC-B-CARD")
        contact = ParentContact(student_id=student.id, father_name="越权父")
        db_session.add(contact)
        db_session.flush()
        admin = _scoped_admin()
        with patch(
            "services.parent_service.get_current_admin", return_value=admin
        ), patch(
            "services.parent_service.get_admin_class_ids", return_value=[999]
        ):
            res = parent_service.update_contact(contact.id, {"father_name": "改不动"})
        assert res[0]["success"] is False
        assert res[1] == 403

    def test_delete_allowed(self, app, db_session):
        cls, student = _make_class_and_student(db_session, "PC-C", "PC-C-CARD")
        contact = ParentContact(student_id=student.id, father_name="待删父")
        db_session.add(contact)
        db_session.flush()
        cid = contact.id
        admin = _scoped_admin()
        with patch(
            "services.parent_service.get_current_admin", return_value=admin
        ), patch(
            "services.parent_service.get_admin_class_ids", return_value=[cls.id]
        ):
            res = parent_service.delete_contact(cid)
        assert res["success"] is True
        assert ParentContact.query.get(cid) is None

    def test_delete_denied(self, app, db_session):
        cls, student = _make_class_and_student(db_session, "PC-D", "PC-D-CARD")
        contact = ParentContact(student_id=student.id, father_name="越权删父")
        db_session.add(contact)
        db_session.flush()
        cid = contact.id
        admin = _scoped_admin()
        with patch(
            "services.parent_service.get_current_admin", return_value=admin
        ), patch(
            "services.parent_service.get_admin_class_ids", return_value=[999]
        ):
            res = parent_service.delete_contact(cid)
        assert res[0]["success"] is False
        assert res[1] == 403
        assert ParentContact.query.get(cid) is not None


class TestAlertIsolation:
    def test_update_student_alert_allowed(self, app, db_session):
        cls, student = _make_class_and_student(db_session, "AL-A", "AL-A-CARD")
        alert = Alert(alert_type="score_abnormal", message="学生预警", student_id=student.id, is_read=False)
        db_session.add(alert)
        db_session.flush()
        admin = _scoped_admin()
        with patch(
            "services.alert_service.get_current_admin", return_value=admin
        ), patch(
            "services.alert_service.get_admin_class_ids", return_value=[cls.id]
        ):
            res = alert_service.update_alert_status(alert.id, True)
        assert res is True
        assert Alert.query.get(alert.id).is_read is True

    def test_update_student_alert_denied(self, app, db_session):
        cls, student = _make_class_and_student(db_session, "AL-B", "AL-B-CARD")
        alert = Alert(alert_type="score_abnormal", message="越权学生预警", student_id=student.id, is_read=False)
        db_session.add(alert)
        db_session.flush()
        admin = _scoped_admin()
        with patch(
            "services.alert_service.get_current_admin", return_value=admin
        ), patch(
            "services.alert_service.get_admin_class_ids", return_value=[999]
        ):
            res = alert_service.update_alert_status(alert.id, True)
        assert isinstance(res, tuple)
        assert res[0]["success"] is False
        assert res[1] == 403
        # 越权未改：状态不变
        assert Alert.query.get(alert.id).is_read is False

    def test_update_device_alert_denied_teacher(self, app, db_session):
        alert = Alert(alert_type="device_offline", message="设备离线", student_id=None, is_read=False)
        db_session.add(alert)
        db_session.flush()
        admin = _scoped_admin(role="teacher")
        with patch(
            "services.alert_service.get_current_admin", return_value=admin
        ):
            res = alert_service.update_alert_status(alert.id, True)
        assert isinstance(res, tuple)
        assert res[1] == 403

    def test_delete_device_alert_denied_teacher(self, app, db_session):
        alert = Alert(alert_type="device_offline", message="设备离线", student_id=None, is_read=False)
        db_session.add(alert)
        db_session.flush()
        aid = alert.id
        admin = _scoped_admin(role="teacher")
        with patch(
            "services.alert_service.get_current_admin", return_value=admin
        ):
            res = alert_service.delete_alert(aid)
        assert isinstance(res, tuple)
        assert res[1] == 403
        assert Alert.query.get(aid) is not None

    def test_delete_device_alert_allowed_admin(self, app, db_session):
        alert = Alert(alert_type="system_error", message="系统错误", student_id=None, is_read=False)
        db_session.add(alert)
        db_session.flush()
        aid = alert.id
        admin = _scoped_admin(role="admin")
        with patch(
            "services.alert_service.get_current_admin", return_value=admin
        ):
            res = alert_service.delete_alert(aid)
        assert res is True
        assert Alert.query.get(aid) is None

    def test_delete_device_alert_allowed_super(self, app, db_session):
        alert = Alert(alert_type="system_error", message="系统错误", student_id=None, is_read=False)
        db_session.add(alert)
        db_session.flush()
        aid = alert.id
        admin = _scoped_admin(role="super_admin")
        with patch(
            "services.alert_service.get_current_admin", return_value=admin
        ):
            res = alert_service.delete_alert(aid)
        assert res is True
        assert Alert.query.get(aid) is None
