"""导入配置 CRUD 与默认配置。"""

from datetime import datetime

from models import (
    Admin,
    AdminClass,
    ClassInfo,
    CourseSchedule,
    Exam,
    ImportConfig,
    Score,
    Subject,
    SubjectClass,
    User,
    cascade_delete_related_records,
    db,
    get_by_id,
)
from utils.db_session import db_session_scope


class _ImportConfigMixin:
    def create_import_config(self, data):
        """创建导入配置。module_name/config_name 必填与同名冲突校验（请求级 400）由路由层完成；
        本方法仅负责写入（含 is_default 互斥清理）并返回新 id。逐字节复刻 ImportConfigList.post。
        """
        with db_session_scope(detach=False):
            if data.get("is_default"):
                ImportConfig.query.filter_by(
                    module_name=data["module_name"], is_default=True
                ).update({"is_default": False})
            config = ImportConfig(
                module_name=data["module_name"],
                config_name=data["config_name"],
                field_mappings=data.get("field_mappings", []),
                validation_rules=data.get("validation_rules", []),
                conflict_strategy=data.get("conflict_strategy", "update"),
                default_values=data.get("default_values", {}),
                is_active=data.get("is_active", True),
                is_default=data.get("is_default", False),
                description=data.get("description"),
                created_by=data.get("created_by"),
            )
            db.session.add(config)
            db.session.flush()
            return config.id

    def update_import_config(self, config_id, data):
        """更新导入配置。改名冲突校验（请求级 400）由路由层完成；逐字节复刻字段赋值与 is_default 互斥清理。"""
        with db_session_scope(detach=False):
            config = get_by_id(ImportConfig, config_id)
            if config is None:
                return None
            self._apply_import_config_fields(config, data)
            config.updated_at = datetime.now()
            return config.id

    @staticmethod
    def _apply_import_config_fields(config, data):
        """逐字段复刻导入配置更新（与 update_import_config 行为一致）。
        is_default 带同模块互斥清理：置为 True 时先清同模块其他默认。"""
        _IMPORT_CONFIG_SIMPLE_FIELDS = (
            "config_name",
            "field_mappings",
            "validation_rules",
            "conflict_strategy",
            "default_values",
            "is_active",
            "description",
        )
        for _field in _IMPORT_CONFIG_SIMPLE_FIELDS:
            if _field in data:
                setattr(config, _field, data[_field])
        if "is_default" in data:
            if data["is_default"] and not config.is_default:
                ImportConfig.query.filter_by(
                    module_name=config.module_name, is_default=True
                ).update({"is_default": False})
            config.is_default = data["is_default"]

    def delete_import_config(self, config_id):
        """删除导入配置。is_default 禁删校验（请求级 400）由路由层完成；404 语义由路由层 get_or_404 保证。"""
        with db_session_scope(detach=False):
            config = get_by_id(ImportConfig, config_id)
            if config:
                db.session.delete(config)

    def set_default_import_config(self, config_id):
        """将指定配置设为模块默认（清理同模块其他默认）。404 语义由路由层 get_or_404 保证。"""
        with db_session_scope(detach=False):
            config = get_by_id(ImportConfig, config_id)
            if config is None:
                return None
            ImportConfig.query.filter_by(module_name=config.module_name, is_default=True).update(
                {"is_default": False}
            )
            config.is_default = True
            config.updated_at = datetime.now()
            return config.id
