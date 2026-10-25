# -*- coding: utf-8 -*-
"""class_service 拆分后，被 test_class_service 以模块属性桩 patch 的符号集中地。

方法经 _shared.X 属性级访问，使 services.class_._shared.X 的 patch 可穿透到 mixin 方法体。
仅承载「被测试桩打」的再导出；其余内部依赖仍由各 mixin 自行 import。
再导出本身不被本模块使用，故加 noqa: F401 防止 ruff 清理。
"""

from models import Admin, AdminClass, ClassInfo, db, get_by_id  # noqa: F401
from utils.db_session import db_session_scope  # noqa: F401
from utils.permission import get_allowed_classes  # noqa: F401
