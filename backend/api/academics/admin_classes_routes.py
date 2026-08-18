from flask import request
from flask_restx import Namespace, Resource, fields
from models import Admin, AdminClass, ClassInfo, get_by_id
from utils.permission import requires_permission
from utils.response import APIResponse
from services.academics_service import academics_service

ns_admin_classes = Namespace("admin-classes", description="管理员班级关联相关操作")

admin_class_model = ns_admin_classes.model(
    "AdminClass",
    {
        "class_id": fields.Integer(description="班级ID"),
        "class_name": fields.String(description="班级名称"),
        "grade": fields.Integer(description="年级"),
        "is_primary": fields.Boolean(description="是否主要班级"),
        "assigned_at": fields.String(description="分配时间"),
    },
)

admin_classes_response = ns_admin_classes.model(
    "AdminClassesResponse",
    {
        "class_id": fields.Integer(description="班级ID"),
        "class_name": fields.String(description="班级名称"),
        "grade": fields.Integer(description="年级"),
        "is_primary": fields.Boolean(description="是否主要班级"),
        "assigned_at": fields.String(description="分配时间"),
    },
)

assign_class_model = ns_admin_classes.model(
    "AssignClass",
    {
        "class_id": fields.Integer(required=True, description="班级ID"),
        "is_primary": fields.Boolean(description="是否主要班级", default=False),
    },
)


@ns_admin_classes.route("/<int:admin_id>")
@ns_admin_classes.param("admin_id", "管理员ID")
class AdminClasses(Resource):

    @ns_admin_classes.doc("get_admin_classes", description="获取管理员关联的班级列表", security="Bearer")
    @ns_admin_classes.response(200, "成功", admin_classes_response)
    @ns_admin_classes.response(404, "管理员不存在")
    @requires_permission("score.view")
    def get(self, admin_id):
        """
        获取管理员关联的班级列表

        获取指定管理员关联的所有班级信息。

        参数：
        - admin_id: 管理员ID（路径参数）
        """
        _admin = Admin.query.get_or_404(admin_id)  # noqa: F841
        class_links = AdminClass.query.filter_by(admin_id=admin_id).all()
        classes = []
        for link in class_links:
            class_info = get_by_id(ClassInfo, link.class_info_id)
            if class_info:
                classes.append(
                    {
                        "class_id": class_info.id,
                        "class_name": class_info.name,
                        "grade": class_info.grade,
                        "is_primary": link.is_primary,
                        "assigned_at": link.assigned_at.isoformat() if link.assigned_at else None,
                    }
                )
        return classes


@ns_admin_classes.route("/<int:admin_id>/assign-class")
@ns_admin_classes.param("admin_id", "管理员ID")
class AdminAssignClass(Resource):

    @ns_admin_classes.doc("assign_class_to_admin", description="为管理员分配班级", security="Bearer")
    @ns_admin_classes.expect(assign_class_model)
    @ns_admin_classes.response(200, "分配成功")
    @ns_admin_classes.response(404, "管理员或班级不存在")
    @requires_permission("score.entry")
    def post(self, admin_id):
        """
        为管理员分配班级

        将指定班级分配给管理员。如果已存在关联，则更新主班标识。

        参数：
        - admin_id: 管理员ID（路径参数）

        请求体：
        - class_id: 班级ID（必填）
        - is_primary: 是否主要班级（可选，默认False）
        """
        data = request.get_json()
        class_id = data.get("class_id")
        is_primary = data.get("is_primary", False)

        # 404 语义保留在路由层
        _admin = Admin.query.get_or_404(admin_id)  # noqa: F841
        class_info = ClassInfo.query.get_or_404(class_id)

        academics_service.assign_class_to_admin(admin_id, class_id, is_primary, class_info)
        return APIResponse.success(message="班级分配成功")


@ns_admin_classes.route("/<int:admin_id>/remove-class/<int:class_id>")
@ns_admin_classes.param("admin_id", "管理员ID")
@ns_admin_classes.param("class_id", "班级ID")
class AdminRemoveClass(Resource):

    @ns_admin_classes.doc("remove_class_from_admin", description="移除管理员的班级关联", security="Bearer")
    @ns_admin_classes.response(200, "移除成功")
    @ns_admin_classes.response(404, "未找到关联记录")
    @requires_permission("score.entry")
    def post(self, admin_id, class_id):
        """
        移除管理员的班级关联

        移除管理员与指定班级的关联关系。

        参数：
        - admin_id: 管理员ID（路径参数）
        - class_id: 班级ID（路径参数）
        """
        removed = academics_service.remove_class_from_admin(admin_id, class_id)
        if not removed:
            return APIResponse.not_found(message="未找到关联记录")
        return APIResponse.success(message="班级移除成功")
