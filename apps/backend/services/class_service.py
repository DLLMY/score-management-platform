"""班级域服务（ClassService）薄组合层。

原单体（794 行 / 14 方法 + 7 个导入助手 + 1 常量）按领域拆分至 services/class_/ 包：
基础助手 / CRUD / 关联维护 / 导入导出 共 4 个 mixin；本类仅作多继承组合，
__module__ 不变，消费者 from services.class_service import class_service 的导入面保持不变。
"""

from services.class_._association_mixin import _ClassAssociationMixin
from services.class_._base_mixin import _ClassBaseMixin
from services.class_._crud_mixin import _ClassCrudMixin
from services.class_._import_export_mixin import _ClassImportExportMixin

__all__ = ["ClassService", "class_service"]


class ClassService(
    _ClassBaseMixin,
    _ClassCrudMixin,
    _ClassAssociationMixin,
    _ClassImportExportMixin,
):
    """班级域服务（多继承组合层，行为与拆分前完全一致）。 """


class_service = ClassService()
