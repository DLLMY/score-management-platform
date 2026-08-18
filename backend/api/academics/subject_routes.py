from flask_restx import Namespace, Resource, fields
from flask import request, send_file
from models import db, Subject, SubjectClass, ClassInfo, Admin, ImportConfig, get_by_id
from utils.permission import requires_permission
from utils.response import APIResponse
from datetime import datetime
from services.excel_service import excel_export_service, excel_import_service
from services.academics_service import academics_service
import json
import io

ns_subjects = Namespace("subjects", description="科目管理")

subject_model = ns_subjects.model(
    "Subject",
    {
        "id": fields.Integer(readOnly=True, description="科目ID"),
        "name": fields.String(required=True, description="科目名称"),
        "code": fields.String(description="科目代码"),
        "grade": fields.String(description="所属年级"),
        "description": fields.String(description="科目描述"),
        "color": fields.String(description="科目颜色"),
        "is_active": fields.Boolean(description="是否启用"),
        "created_at": fields.DateTime(readOnly=True, description="创建时间"),
        "updated_at": fields.DateTime(readOnly=True, description="更新时间"),
    },
)

subject_response = ns_subjects.model(
    "SubjectResponse",
    {
        "id": fields.Integer(description="科目ID"),
        "name": fields.String(description="科目名称"),
        "code": fields.String(description="科目代码"),
        "grade": fields.String(description="所属年级"),
        "description": fields.String(description="科目描述"),
        "color": fields.String(description="科目颜色"),
        "is_active": fields.Boolean(description="是否启用"),
        "class_count": fields.Integer(description="关联班级数量"),
        "created_at": fields.String(description="创建时间"),
        "updated_at": fields.String(description="更新时间"),
    },
)

subject_class_model = ns_subjects.model(
    "SubjectClass",
    {
        "subject_id": fields.Integer(required=True, description="科目ID"),
        "class_info_id": fields.Integer(required=True, description="班级ID"),
        "teacher_id": fields.Integer(description="授课教师ID"),
    },
)


@ns_subjects.route("/")
class SubjectList(Resource):

    @ns_subjects.doc("list_subjects", description="获取所有科目列表")
    @ns_subjects.response(200, "成功")
    @requires_permission("score.view")
    def get(self):
        """获取所有科目"""
        include_inactive = request.args.get("include_inactive", "false").lower() == "true"
        search = request.args.get("search", "").strip()

        query = Subject.query
        if not include_inactive:
            query = query.filter_by(is_active=True)

        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                db.or_(
                    Subject.name.like(search_pattern),
                    Subject.code.like(search_pattern),
                    Subject.grade.like(search_pattern),
                )
            )

        subjects = query.order_by(Subject.sort_order, Subject.name).all()

        result = []  # noqa: F841
        for s in subjects:
            class_count = SubjectClass.query.filter_by(subject_id=s.id).count()
            result.append(
                {
                    "id": s.id,
                    "name": s.name,
                    "code": s.code,
                    "grade": s.grade,
                    "description": s.description,
                    "color": s.color,
                    "is_active": s.is_active,
                    "sort_order": s.sort_order or 0,
                    "class_count": class_count,
                    "created_at": s.created_at.isoformat() if s.created_at else None,
                    "updated_at": s.updated_at.isoformat() if s.updated_at else None,
                }
            )
        return APIResponse.success(data=result)

    @ns_subjects.doc("create_subject", description="创建新科目")
    @ns_subjects.expect(subject_model)
    @ns_subjects.response(201, "创建成功", subject_response)
    @requires_permission("score.entry")
    def post(self):
        """创建新科目"""
        data = request.json

        if Subject.query.filter_by(name=data["name"]).first():
            return APIResponse.error(message="科目名称已存在", status_code=400)

        if data.get("code") and Subject.query.filter_by(code=data["code"]).first():
            return APIResponse.error(message="科目代码已存在", status_code=400)

        new_id = academics_service.create_subject(data)
        subject = Subject.query.get(new_id)

        return {
            "id": subject.id,
            "name": subject.name,
            "code": subject.code,
            "grade": subject.grade,
            "description": subject.description,
            "color": subject.color,
            "is_active": subject.is_active,
            "sort_order": subject.sort_order or 0,
            "class_count": 0,
            "created_at": subject.created_at.isoformat() if subject.created_at else None,
            "updated_at": subject.updated_at.isoformat() if subject.updated_at else None,
        }, 201


@ns_subjects.route("/<int:id>/toggle")
@ns_subjects.param("id", "科目ID")
class SubjectToggle(Resource):

    @ns_subjects.doc("toggle_subject", description="切换科目启用/禁用状态")
    @ns_subjects.response(200, "切换成功")
    @ns_subjects.response(404, "科目不存在")
    @requires_permission("score.entry")
    def get(self, id):
        """切换科目启用/禁用状态"""
        subject = Subject.query.get_or_404(id)
        academics_service.toggle_subject(subject)
        subject = Subject.query.get(id)

        class_count = SubjectClass.query.filter_by(subject_id=id).count()

        return {
            "id": subject.id,
            "name": subject.name,
            "is_active": subject.is_active,
            "sort_order": subject.sort_order or 0,
            "class_count": class_count,
            "message": "科目已启用" if subject.is_active else "科目已禁用",
        }


@ns_subjects.route("/<int:id>")
@ns_subjects.param("id", "科目ID")
class SubjectResource(Resource):

    @ns_subjects.doc("get_subject", description="获取科目详情")
    @ns_subjects.response(200, "成功", subject_response)
    @ns_subjects.response(404, "科目不存在")
    @requires_permission("score.view")
    def get(self, id):
        """获取科目详情"""
        subject = Subject.query.get_or_404(id)  # noqa: F841
        class_count = SubjectClass.query.filter_by(subject_id=id).count()

        return {
            "id": subject.id,
            "name": subject.name,
            "code": subject.code,
            "grade": subject.grade,
            "description": subject.description,
            "color": subject.color,
            "is_active": subject.is_active,
            "sort_order": subject.sort_order or 0,
            "class_count": class_count,
            "created_at": subject.created_at.isoformat() if subject.created_at else None,
            "updated_at": subject.updated_at.isoformat() if subject.updated_at else None,
        }

    @ns_subjects.doc("update_subject", description="更新科目信息")
    @ns_subjects.expect(subject_model)
    @ns_subjects.response(200, "更新成功")
    @ns_subjects.response(404, "科目不存在")
    @requires_permission("score.entry")
    def put(self, id):
        """更新科目信息"""
        subject = Subject.query.get_or_404(id)
        data = request.json

        # 检查名称是否重复
        if data.get("name") and data["name"] != subject.name:
            if Subject.query.filter_by(name=data["name"]).first():
                return APIResponse.error(message="科目名称已存在", status_code=400)

        # 检查代码是否重复
        if data.get("code") and data["code"] != subject.code:
            if Subject.query.filter_by(code=data["code"]).first():
                return APIResponse.error(message="科目代码已存在", status_code=400)

        academics_service.update_subject(subject, data)
        subject = Subject.query.get(id)

        class_count = SubjectClass.query.filter_by(subject_id=id).count()

        return {
            "id": subject.id,
            "name": subject.name,
            "code": subject.code,
            "grade": subject.grade,
            "description": subject.description,
            "color": subject.color,
            "is_active": subject.is_active,
            "sort_order": subject.sort_order or 0,
            "class_count": class_count,
            "created_at": subject.created_at.isoformat() if subject.created_at else None,
            "updated_at": subject.updated_at.isoformat() if subject.updated_at else None,
        }

    @ns_subjects.doc("delete_subject", description="删除科目")
    @ns_subjects.response(200, "删除成功")
    @ns_subjects.response(404, "科目不存在")
    @requires_permission("score.entry")
    def delete(self, id):
        """删除科目（先级联清理关联数据，再删除科目本身）"""
        subject = Subject.query.get_or_404(id)  # noqa: F841
        academics_service.delete_subject(id)
        return APIResponse.success(message="科目已删除")


@ns_subjects.route("/<int:id>/classes")
@ns_subjects.param("id", "科目ID")
class SubjectClasses(Resource):

    @ns_subjects.doc("get_subject_classes", description="获取科目关联的班级列表")
    @ns_subjects.response(200, "成功")
    @ns_subjects.response(404, "科目不存在")
    @requires_permission("score.view")
    def get(self, id):
        """获取科目关联的班级列表"""
        subject = Subject.query.get_or_404(id)  # noqa: F841

        links = SubjectClass.query.filter_by(subject_id=id).all()
        result = []  # noqa: F841
        for link in links:
            teacher = get_by_id(Admin, link.teacher_id) if link.teacher_id else None
            class_info = get_by_id(ClassInfo, link.class_info_id)
            result.append(
                {
                    "id": link.id,
                    "class_info_id": link.class_info_id,
                    "class_name": class_info.name if class_info else "",
                    "grade": class_info.grade if class_info else "",
                    "teacher_id": link.teacher_id,
                    "teacher_name": teacher.real_name if teacher else None,
                    "created_at": link.created_at.isoformat() if link.created_at else None,
                }
            )

        return APIResponse.success(data={"classes": result})

    @ns_subjects.doc("add_subject_class", description="添加科目与班级的关联")
    @ns_subjects.expect(subject_class_model)
    @ns_subjects.response(201, "关联成功")
    @ns_subjects.response(404, "科目不存在")
    @requires_permission("score.entry")
    def post(self, id):
        """添加科目与班级的关联"""
        Subject.query.get_or_404(id)
        data = request.json

        existing = SubjectClass.query.filter(
            SubjectClass.subject_id == id, SubjectClass.class_info_id == data["class_info_id"]
        ).first()

        if existing:
            return APIResponse.error(message="该科目与班级已关联", status_code=400)

        class_info = get_by_id(ClassInfo, data["class_info_id"])
        if not class_info:
            return APIResponse.error(message="班级不存在", status_code=404)

        link_id = academics_service.create_subject_class(
            id, data["class_info_id"], data.get("teacher_id")
        )

        link = get_by_id(SubjectClass, link_id)
        subject = Subject.query.get(id)
        teacher = get_by_id(Admin, link.teacher_id) if link.teacher_id else None

        return {
            "id": link.id,
            "subject_id": id,
            "subject_name": subject.name,
            "class_info_id": link.class_info_id,
            "class_name": class_info.name,
            "teacher_id": link.teacher_id,
            "teacher_name": teacher.real_name if teacher else None,
            "created_at": link.created_at.isoformat() if link.created_at else None,
        }, 201


@ns_subjects.route("/<int:subject_id>/classes/<int:class_id>")
@ns_subjects.param("subject_id", "科目ID")
@ns_subjects.param("class_id", "班级ID")
class SubjectClassResource(Resource):

    @ns_subjects.doc("update_subject_class", description="更新科目与班级的关联")
    @ns_subjects.expect(subject_class_model)
    @ns_subjects.response(200, "更新成功")
    @ns_subjects.response(404, "关联不存在")
    @requires_permission("score.entry")
    def put(self, subject_id, class_id):
        """更新科目与班级的关联（如更换授课教师）"""
        link = SubjectClass.query.filter(
            SubjectClass.subject_id == subject_id, SubjectClass.class_info_id == class_id
        ).first_or_404()

        data = request.json

        if "teacher_id" in data:
            academics_service.update_subject_class(link, data["teacher_id"])

        link = get_by_id(SubjectClass, link.id)
        teacher = get_by_id(Admin, link.teacher_id) if link.teacher_id else None
        class_info = get_by_id(ClassInfo, link.class_info_id)
        subject = get_by_id(Subject, subject_id)

        return {
            "id": link.id,
            "subject_id": subject_id,
            "subject_name": subject.name,
            "class_info_id": link.class_info_id,
            "class_name": class_info.name if class_info else "",
            "teacher_id": link.teacher_id,
            "teacher_name": teacher.real_name if teacher else None,
            "updated_at": datetime.now().isoformat(),
        }

    @ns_subjects.doc("delete_subject_class", description="删除科目与班级的关联")
    @ns_subjects.response(200, "删除成功")
    @ns_subjects.response(404, "关联不存在")
    @requires_permission("score.entry")
    def delete(self, subject_id, class_id):
        """删除科目与班级的关联"""
        link = SubjectClass.query.filter(
            SubjectClass.subject_id == subject_id, SubjectClass.class_info_id == class_id
        ).first_or_404()

        academics_service.delete_subject_class(link)

        return APIResponse.success(message="科目与班级关联已删除")


@ns_subjects.route("/export")
class SubjectExport(Resource):

    @ns_subjects.doc("export_subjects", description="导出科目数据")
    @requires_permission("score.view")
    def get(self):
        """导出科目数据（支持JSON和Excel格式）"""
        include_inactive = request.args.get("include_inactive", "false").lower() == "true"
        export_format = request.args.get("format", "json").lower()
        search = request.args.get("search", "").strip()

        query = Subject.query
        if not include_inactive:
            query = query.filter_by(is_active=True)

        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                db.or_(
                    Subject.name.like(search_pattern),
                    Subject.code.like(search_pattern),
                    Subject.grade.like(search_pattern),
                )
            )

        subjects = query.order_by(Subject.name).all()

        if not subjects:
            export_data = []
        else:
            # 批量获取所有科目关联（1次查询）
            subject_ids = [s.id for s in subjects]
            class_links = SubjectClass.query.filter(SubjectClass.subject_id.in_(subject_ids)).all()

            # 批量获取所有班级信息（1次查询）
            class_info_ids = list(
                set(link.class_info_id for link in class_links if link.class_info_id)
            )
            class_info_map = {}
            if class_info_ids:
                class_infos = ClassInfo.query.filter(ClassInfo.id.in_(class_info_ids)).all()
                class_info_map = {c.id: c for c in class_infos}

            # 批量获取所有教师信息（1次查询）
            teacher_ids = list(set(link.teacher_id for link in class_links if link.teacher_id))
            teacher_map = {}
            if teacher_ids:
                teachers = Admin.query.filter(Admin.id.in_(teacher_ids)).all()
                teacher_map = {t.id: t for t in teachers}

            # 构建科目关联映射
            subject_class_map = {}
            for link in class_links:
                if link.subject_id not in subject_class_map:
                    subject_class_map[link.subject_id] = []
                subject_class_map[link.subject_id].append(link)

            # 构建导出数据（无额外查询）
            export_data = []
            for s in subjects:
                classes = []
                for link in subject_class_map.get(s.id, []):
                    class_info = class_info_map.get(link.class_info_id)
                    teacher = teacher_map.get(link.teacher_id)
                    classes.append(
                        {
                            "class_info_id": link.class_info_id,
                            "class_name": class_info.name if class_info else "",
                            "grade": class_info.grade if class_info else "",
                            "teacher_id": link.teacher_id,
                            "teacher_name": teacher.real_name if teacher else None,
                        }
                    )

                export_data.append(
                    {
                        "name": s.name,
                        "code": s.code,
                        "grade": s.grade,
                        "description": s.description,
                        "color": s.color,
                        "is_active": "是" if s.is_active else "否",
                        "classes": classes,
                        "created_at": s.created_at.isoformat() if s.created_at else None,
                        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
                    }
                )

        if export_format == "excel":
            headers = [
                "科目名称",
                "科目代码",
                "年级",
                "描述",
                "颜色",
                "是否启用",
                "关联班级",
                "创建时间",
                "更新时间",
            ]
            flat_data = []
            for item in export_data:
                class_teacher_str = ""
                for ct in item["classes"]:
                    class_teacher_str += f"{ct['class_name']}({ct['teacher_name'] or '未分配'}); "
                flat_data.append(
                    {
                        "科目名称": item["name"],
                        "科目代码": item["code"],
                        "年级": item["grade"],
                        "描述": item["description"],
                        "颜色": item["color"],
                        "是否启用": item["is_active"],
                        "关联班级": class_teacher_str.rstrip("; "),
                        "创建时间": item["created_at"],
                        "更新时间": item["updated_at"],
                    }
                )

            buf = excel_export_service.export_to_excel(
                data=flat_data, headers=headers, filename="subjects_export", sheet_name="科目数据"
            )

            filename = excel_export_service._sanitize_filename(
                f'subjects_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
            )
            return send_file(
                buf,
                mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                as_attachment=True,
                download_name=filename,
            )
        elif export_format == "csv":
            headers = [
                "科目名称",
                "科目代码",
                "年级",
                "描述",
                "颜色",
                "是否启用",
                "关联班级",
                "创建时间",
                "更新时间",
            ]
            flat_data = []
            for item in export_data:
                class_teacher_str = ""
                for ct in item["classes"]:
                    class_teacher_str += f"{ct['class_name']}({ct['teacher_name'] or '未分配'}); "
                flat_data.append(
                    {
                        "科目名称": item["name"],
                        "科目代码": item["code"],
                        "年级": item["grade"],
                        "描述": item["description"],
                        "颜色": item["color"],
                        "是否启用": item["is_active"],
                        "关联班级": class_teacher_str.rstrip("; "),
                        "创建时间": item["created_at"],
                        "更新时间": item["updated_at"],
                    }
                )

            csv_buf = excel_export_service.export_to_csv(
                data=flat_data, headers=headers, filename="subjects_export"
            )

            csv_content = csv_buf.getvalue()
            if isinstance(csv_content, str):
                csv_content = csv_content.encode("utf-8-sig")
            else:
                csv_content = csv_content

            filename = excel_export_service._sanitize_filename(
                f'subjects_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
            )
            return send_file(
                io.BytesIO(csv_content),
                mimetype="text/csv; charset=utf-8",
                as_attachment=True,
                download_name=filename,
            )
        else:
            output = {
                "export_time": datetime.now().isoformat(),
                "total": len(export_data),
                "data": export_data,
            }

            json_str = json.dumps(output, ensure_ascii=False, indent=2)
            buf = io.BytesIO(json_str.encode("utf-8"))
            buf.seek(0)

            return send_file(
                buf,
                mimetype="application/json",
                as_attachment=True,
                download_name=f'subjects_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json',
            )


@ns_subjects.route("/template")
class SubjectTemplate(Resource):

    @ns_subjects.doc("download_subject_template", description="下载科目导入模板")
    @requires_permission("score.view")
    def get(self):
        """下载科目导入模板"""
        headers = [
            "科目名称",
            "科目代码",
            "年级",
            "描述",
            "颜色",
            "是否启用",
            "班级名称",
            "教师姓名",
        ]
        sample_data = [
            {
                "科目名称": "数学",
                "科目代码": "MATH001",
                "年级": "高一",
                "描述": "必修课程",
                "颜色": "#10B981",
                "是否启用": "是",
                "班级名称": "高一1班",
                "教师姓名": "张老师",
            }
        ]

        buf = excel_export_service.export_to_excel(
            data=sample_data,
            headers=headers,
            filename="subjects_template",
            sheet_name="科目导入模板",
        )

        filename = excel_export_service._sanitize_filename("subjects_import_template.xlsx")
        return send_file(
            buf,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name=filename,
        )


@ns_subjects.route("/import")
class SubjectImport(Resource):

    @ns_subjects.doc("import_subjects", description="导入科目数据")
    @requires_permission("score.entry")
    def post(self):
        """从JSON或Excel文件导入科目数据（支持配置映射）"""
        content_type = request.content_type or ""
        config_id = request.args.get("config_id", type=int)

        config = None
        if config_id:
            config = get_by_id(ImportConfig, config_id)
        else:
            config = ImportConfig.query.filter(
                ImportConfig.import_type == "subjects", ImportConfig.is_active
            ).first()

        default_mappings = [
            {
                "source_field": "科目名称",
                "target_field": "name",
                "field_type": "string",
                "required": True,
            },
            {"source_field": "科目代码", "target_field": "code", "field_type": "string"},
            {"source_field": "年级", "target_field": "grade", "field_type": "string"},
            {"source_field": "描述", "target_field": "description", "field_type": "string"},
            {"source_field": "颜色", "target_field": "color", "field_type": "string"},
            {"source_field": "是否启用", "target_field": "is_active", "field_type": "boolean"},
            {
                "source_field": "班级名称",
                "target_field": "class_name",
                "field_type": "string",
                "relation": "class",
            },
            {
                "source_field": "班级ID",
                "target_field": "class_id",
                "field_type": "integer",
                "relation": "class",
            },
            {
                "source_field": "教师姓名",
                "target_field": "teacher_name",
                "field_type": "string",
                "relation": "admin",
            },
            {
                "source_field": "教师ID",
                "target_field": "teacher_id",
                "field_type": "integer",
                "relation": "admin",
            },
        ]

        config_data = config.config_data if config else {}
        field_mappings = (
            config_data.get("field_mappings", default_mappings) if config_data else default_mappings
        )
        validation_rules = config_data.get("validation_rules", []) if config_data else []
        conflict_strategy = (
            config_data.get("conflict_strategy", "update") if config_data else "update"
        )
        default_values = config_data.get("default_values", {}) if config_data else {}

        import_list = []

        if "multipart/form-data" in content_type:
            if "file" not in request.files:
                return APIResponse.error(message="请上传文件", status_code=400)

            file = request.files["file"]
            if not file.filename:
                return APIResponse.error(message="请选择文件", status_code=400)

            filename = file.filename.lower()

            if filename.endswith(".json"):
                file_content = file.read()
                try:
                    json_data = json.loads(file_content.decode("utf-8"))
                    if isinstance(json_data, list):
                        import_list = json_data
                    elif isinstance(json_data, dict) and "data" in json_data:
                        import_list = json_data["data"]
                    else:
                        return APIResponse.error(
                            message="JSON格式错误：应为数组或包含data字段的对象", status_code=400
                        )
                except (json.JSONDecodeError, UnicodeDecodeError) as e:
                    return APIResponse.error(message=f"JSON解析失败: {str(e)}", status_code=400)
            elif filename.endswith(".xlsx") or filename.endswith(".xls"):
                file_content = file.read()
                parse_result = excel_import_service.parse_excel_file(file_content)

                if not parse_result.get("success"):
                    return APIResponse.error(
                        message=parse_result.get("error", "文件解析失败"), status_code=400
                    )

                headers = parse_result.get("headers", [])
                parsed_rows = parse_result.get("data", [])

                col_map = {}
                for idx, header in enumerate(headers):
                    if header:
                        col_map[header] = idx

                for row_idx, row_data in enumerate(parsed_rows):
                    mapped_item = {}
                    row_has_required = True
                    for mapping in field_mappings:
                        source_val = row_data.get(mapping["source_field"])
                        target_field = mapping["target_field"]
                        field_type = mapping.get("field_type", "string")

                        if source_val is None or source_val == "":
                            if mapping.get("required"):
                                row_has_required = False
                                break
                            source_val = mapping.get(
                                "default_value", default_values.get(target_field)
                            )

                        if field_type == "boolean":
                            if isinstance(source_val, str):
                                mapped_item[target_field] = source_val in [
                                    "是",
                                    "true",
                                    "True",
                                    "1",
                                ]
                            else:
                                mapped_item[target_field] = bool(source_val)
                        else:
                            mapped_item[target_field] = source_val

                    if not row_has_required:
                        import_list.append(
                            {
                                "__error__": True,
                                "__message__": f'第{row_idx + 2}行: 缺少必填字段"科目名称"',
                            }
                        )
                    elif mapped_item.get("name"):
                        import_list.append(mapped_item)
            else:
                return APIResponse.error(
                    message="仅支持 .xlsx、.xls 或 .json 格式", status_code=400
                )
        elif "application/json" in content_type:
            data = request.json
            if not data or "data" not in data:
                return APIResponse.error(message="导入数据格式错误", status_code=400)
            import_list = data["data"]
        else:
            return APIResponse.error(message="不支持的文件格式", status_code=400)

        result = academics_service.execute_subject_import(
            import_list=import_list,
            validation_rules=validation_rules,
            conflict_strategy=conflict_strategy,
        )
        return result


@ns_subjects.route("/order")
class SubjectOrder(Resource):
    @ns_subjects.doc("update_subject_order", description="更新科目排列顺序")
    @requires_permission("score.manage")
    def put(self):
        """批量更新科目排序"""
        data = request.get_json()
        if not data or not isinstance(data, list):
            return APIResponse.error(message="无效数据: 应为 [{id, order}] 列表", status_code=400)
        try:
            academics_service.update_subject_order(data)
            return APIResponse.success(message="排序更新成功")
        except Exception as e:
            return APIResponse.error(message=str(e))
