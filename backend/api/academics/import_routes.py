from flask_restx import Namespace, Resource, fields
from flask import request, send_file
from datetime import datetime
from models import db, ImportConfig
from utils.permission import requires_permission
from utils.excel_utils import ExcelTemplateGenerator

from utils.response import APIResponse
import io

ns_import = Namespace("import", description="导入配置管理")

import_config_model = ns_import.model(
    "ImportConfig",
    {
        "id": fields.Integer(readOnly=True, description="配置ID"),
        "module_name": fields.String(required=True, description="模块名称"),
        "config_name": fields.String(required=True, description="配置名称"),
        "field_mappings": fields.List(
            fields.Nested(
                ns_import.model(
                    "FieldMapping",
                    {
                        "source_field": fields.String(required=True, description="源字段名"),
                        "target_field": fields.String(required=True, description="目标字段名"),
                        "field_type": fields.String(description="字段类型"),
                        "required": fields.Boolean(default=False, description="是否必填"),
                        "default_value": fields.String(description="默认值"),
                        "transform": fields.String(description="转换规则"),
                        "relation_field": fields.String(description="关联字段"),
                        "relation_module": fields.String(description="关联模块"),
                    },
                )
            ),
            description="字段映射配置",
        ),
        "validation_rules": fields.List(
            fields.Nested(
                ns_import.model(
                    "ValidationRule",
                    {
                        "field": fields.String(required=True, description="字段名"),
                        "rule_type": fields.String(required=True, description="规则类型"),
                        "params": fields.Raw(description="规则参数"),
                        "message": fields.String(description="错误消息"),
                    },
                )
            ),
            description="验证规则",
        ),
        "conflict_strategy": fields.String(
            enum=["skip", "update", "create_new"], default="update", description="冲突处理策略"
        ),
        "default_values": fields.Raw(description="默认值配置"),
        "is_active": fields.Boolean(default=True, description="是否启用"),
        "is_default": fields.Boolean(default=False, description="是否默认配置"),
        "description": fields.String(description="配置描述"),
        "created_by": fields.Integer(description="创建人"),
        "created_at": fields.DateTime(readOnly=True, description="创建时间"),
        "updated_at": fields.DateTime(readOnly=True, description="更新时间"),
    },
)


@ns_import.route("/configs")
class ImportConfigList(Resource):

    @ns_import.doc("list_import_configs", description="获取导入配置列表")
    @requires_permission("system.manage")
    def get(self):
        """获取所有导入配置"""
        module_name = request.args.get("module_name")
        is_active = request.args.get("is_active")

        query = ImportConfig.query
        if module_name:
            query = query.filter_by(module_name=module_name)
        if is_active is not None:
            query = query.filter_by(is_active=is_active.lower() == "true")

        configs = query.order_by(ImportConfig.module_name, ImportConfig.config_name).all()

        return APIResponse.success(data=[config.to_dict() for config in configs], total=len(configs))

    @ns_import.doc("create_import_config", description="创建导入配置")
    @ns_import.expect(import_config_model)
    @requires_permission("system.manage")
    def post(self):
        """创建新的导入配置"""
        data = ns_import.payload
        if not data:
            return APIResponse.bad_request(message="请求体不能为空")

        module_name = data.get("module_name")
        config_name = data.get("config_name")
        if not module_name or not config_name:
            return APIResponse.bad_request(message="module_name 与 config_name 为必填项")

        existing = ImportConfig.query.filter(
            ImportConfig.module_name == module_name, ImportConfig.config_name == config_name
        ).first()

        if existing:
            return APIResponse.error(message="该模块下已存在同名配置", status_code=400)

        if data.get("is_default"):
            ImportConfig.query.filter_by(module_name=module_name, is_default=True).update({"is_default": False})

        config = ImportConfig(
            module_name=module_name,
            config_name=config_name,
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
        db.session.commit()

        return APIResponse.success(data=config.to_dict(), message="配置创建成功", status_code=201)


@ns_import.route("/configs/<int:id>")
class ImportConfigDetail(Resource):

    @ns_import.doc("get_import_config", description="获取导入配置详情")
    @requires_permission("system.manage")
    def get(self, id):
        """获取单个导入配置"""
        config = ImportConfig.query.get_or_404(id)
        return APIResponse.success(data=config.to_dict())

    @ns_import.doc("update_import_config", description="更新导入配置")
    @ns_import.expect(import_config_model)
    @requires_permission("system.manage")
    def put(self, id):
        """更新导入配置"""
        config = ImportConfig.query.get_or_404(id)
        data = ns_import.payload

        if "config_name" in data and data["config_name"] != config.config_name:
            existing = ImportConfig.query.filter(
                ImportConfig.module_name == config.module_name,
                ImportConfig.config_name == data["config_name"],
                ImportConfig.id != id,
            ).first()
            if existing:
                return APIResponse.error(message="该模块下已存在同名配置", status_code=400)
            config.config_name = data["config_name"]

        if "is_default" in data and data["is_default"] and not config.is_default:
            ImportConfig.query.filter_by(module_name=config.module_name, is_default=True).update({"is_default": False})

        if "field_mappings" in data:
            config.field_mappings = data["field_mappings"]
        if "validation_rules" in data:
            config.validation_rules = data["validation_rules"]
        if "conflict_strategy" in data:
            config.conflict_strategy = data["conflict_strategy"]
        if "default_values" in data:
            config.default_values = data["default_values"]
        if "is_active" in data:
            config.is_active = data["is_active"]
        if "is_default" in data:
            config.is_default = data["is_default"]
        if "description" in data:
            config.description = data["description"]

        config.updated_at = datetime.now()
        db.session.commit()

        return APIResponse.success(data=config.to_dict())

    @ns_import.doc("delete_import_config", description="删除导入配置")
    @requires_permission("system.manage")
    def delete(self, id):
        """删除导入配置"""
        config = ImportConfig.query.get_or_404(id)

        if config.is_default:
            return APIResponse.error(message="默认配置不能删除", status_code=400)

        db.session.delete(config)
        db.session.commit()

        return APIResponse.success(message="配置已删除")


@ns_import.route("/configs/default/<string:module_name>")
class ImportConfigDefault(Resource):

    @ns_import.doc("get_default_import_config", description="获取模块默认导入配置")
    def get(self, module_name):
        """获取指定模块的默认导入配置"""
        config = ImportConfig.query.filter(
            ImportConfig.module_name == module_name, ImportConfig.is_default, ImportConfig.is_active
        ).first()

        if not config:
            return APIResponse.success(data=None)

        return APIResponse.success(data=config.to_dict())


@ns_import.route("/configs/set-default/<int:id>")
class ImportConfigSetDefault(Resource):

    @ns_import.doc("set_default_import_config", description="设置为默认配置")
    @requires_permission("system.manage")
    def post(self, id):
        """将指定配置设置为模块默认配置"""
        config = ImportConfig.query.get_or_404(id)

        ImportConfig.query.filter_by(module_name=config.module_name, is_default=True).update({"is_default": False})
        config.is_default = True
        config.updated_at = datetime.now()

        db.session.commit()

        return APIResponse.success(message=f"{config.config_name} 已设置为 {config.module_name} 模块的默认配置")


@ns_import.route("/module-fields/<string:module_name>")
class ModuleFields(Resource):

    @ns_import.doc("get_module_fields", description="获取模块字段定义")
    def get(self, module_name):
        """获取指定模块的字段定义"""
        fields_config = {
            "classes": {
                "name": "班级管理",
                "fields": [
                    {"name": "name", "label": "班级名称", "type": "string", "required": True},
                    {"name": "grade", "label": "年级", "type": "string", "required": False},
                    {"name": "description", "label": "描述", "type": "string", "required": False},
                    {
                        "name": "head_teacher_id",
                        "label": "班主任ID",
                        "type": "integer",
                        "required": False,
                        "relation": "admin",
                    },
                    {
                        "name": "head_teacher_name",
                        "label": "班主任姓名",
                        "type": "string",
                        "required": False,
                        "relation": "admin",
                    },
                    {"name": "is_active", "label": "是否启用", "type": "boolean", "required": False},
                ],
            },
            "subjects": {
                "name": "科目管理",
                "fields": [
                    {"name": "name", "label": "科目名称", "type": "string", "required": True},
                    {"name": "code", "label": "科目代码", "type": "string", "required": False},
                    {"name": "grade", "label": "年级", "type": "string", "required": False},
                    {"name": "description", "label": "描述", "type": "string", "required": False},
                    {"name": "color", "label": "颜色", "type": "string", "required": False},
                    {"name": "is_active", "label": "是否启用", "type": "boolean", "required": False},
                ],
            },
            "course_schedule": {
                "name": "课程表管理",
                "fields": [
                    {
                        "name": "class_name",
                        "label": "班级名称",
                        "type": "string",
                        "required": True,
                        "relation": "class_info",
                    },
                    {
                        "name": "subject_name",
                        "label": "科目名称",
                        "type": "string",
                        "required": True,
                        "relation": "subject",
                    },
                    {"name": "day_of_week", "label": "星期", "type": "integer", "required": True},
                    {"name": "period_number", "label": "节次", "type": "integer", "required": True},
                    {"name": "teacher_name", "label": "教师", "type": "string", "required": False},
                    {"name": "classroom", "label": "教室", "type": "string", "required": False},
                    {"name": "description", "label": "备注", "type": "string", "required": False},
                    {"name": "is_active", "label": "是否启用", "type": "boolean", "required": False},
                ],
            },
        }

        if module_name not in fields_config:
            return APIResponse.error(message="未知模块", status_code=400)

        return APIResponse.success(data=fields_config[module_name])


@ns_import.route("/template/<string:template_type>")
class ImportTemplate(Resource):

    @ns_import.doc("download_import_template", description="下载导入模板")
    @requires_permission("report.import")
    def get(self, template_type):
        """下载指定类型的Excel导入模板"""
        template_type_map = {
            "classes": "class",
            "subjects": "subject",
            "course_schedule": "course_schedule",
            "exams": "exam",
        }

        internal_type = template_type_map.get(template_type)
        if not internal_type:
            return APIResponse.error(message="不支持的模板类型", status_code=400)

        try:
            excel_bytes = ExcelTemplateGenerator.generate_template(internal_type)

            template_names = {
                "class": "班级导入模板",
                "subject": "科目导入模板",
                "course_schedule": "课程表导入模板",
                "exam": "考试导入模板",
            }

            filename = f"{template_names[internal_type]}.xlsx"

            return send_file(
                io.BytesIO(excel_bytes),
                mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                as_attachment=True,
                download_name=filename,
            )
        except Exception as e:
            return APIResponse.error(message=f"生成模板失败: {str(e)}", status_code=500)
