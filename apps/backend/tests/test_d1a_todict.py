"""D1-a 对象级断言：新增 to_dict 模型输出形状校验（不依赖 DB/session）。

验证点（沿用 c901 / B3 战法：对象级断言，非 inspect.getsource）：
- to_dict() 返回全部基础列；
- to_dict(fields=[...]) 仅返回指定键；
- 字段值与原生构造值一致（零行为破坏）。
"""
from models.system_models import OperationLog, TimeRule
from models.score_models import SubjectClass
from models.user_models import RolePermissionMapping, RoleHierarchy


def test_operation_log_to_dict():
    op = OperationLog(
        operation_type="create",
        target_type="user",
        target_id=7,
        operator="admin",
        description="x",
    )
    d = op.to_dict()
    assert d["operation_type"] == "create"
    assert d["target_type"] == "user"
    assert d["target_id"] == 7
    assert d["operator"] == "admin"
    assert d["id"] is None
    assert d["created_at"] is None
    # fields 过滤
    d2 = op.to_dict(fields=["operation_type", "target_id"])
    assert set(d2.keys()) == {"operation_type", "target_id"}


def test_time_rule_to_dict():
    tr = TimeRule(
        name="morning",
        start_hour=8,
        start_minute=0,
        end_hour=9,
        end_minute=30,
        allow_unlock=True,
        is_active=False,
    )
    d = tr.to_dict()
    assert d["name"] == "morning"
    assert d["start_hour"] == 8 and d["end_hour"] == 9
    assert d["start_minute"] == 0 and d["end_minute"] == 30
    assert d["allow_unlock"] is True
    assert d["is_active"] is False
    assert "created_at" in d and "updated_at" in d


def test_subject_class_to_dict():
    sc = SubjectClass(subject_id=1, class_info_id=2, teacher_id=3)
    d = sc.to_dict()
    assert d["subject_id"] == 1
    assert d["class_info_id"] == 2
    assert d["teacher_id"] == 3
    assert "created_at" in d


def test_role_permission_mapping_to_dict():
    m = RolePermissionMapping(role_code="teacher", permission_code="student.view")
    d = m.to_dict()
    assert d["role_code"] == "teacher"
    assert d["permission_code"] == "student.view"
    assert d["id"] is None


def test_role_hierarchy_to_dict():
    h = RoleHierarchy(parent_role_code="admin", child_role_code="teacher")
    d = h.to_dict()
    assert d["parent_role_code"] == "admin"
    assert d["child_role_code"] == "teacher"
    assert d["id"] is None
