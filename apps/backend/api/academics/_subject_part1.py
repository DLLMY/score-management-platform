# -*- coding: utf-8 -*-
# part of api/academics/subject_routes.py (D2 split)

import logging
from flask_restx import Namespace, Resource, fields
from flask import request, send_file
from models import Subject, SubjectClass, ClassInfo, Admin, ImportConfig, get_by_id
from utils.permission import requires_permission
from utils.decorators import safe_handle
from utils.response import APIResponse
from utils.api_cache_middleware import cached_api, invalidate_cache
from datetime import datetime
from services.excel_service import excel_export_service, excel_import_service
from services.academics_service import academics_service
from services.subject_service import (
    get_subject_list_view,
    get_subject_detail_view,
    get_subject_classes_view,
    get_subject_export_data_view,
)
import json
import io

from api.academics.subject_routes import logger, ns_subjects, subject_model, subject_response, subject_class_model, _resolve_subject_import_config, _build_subject_import_config, _parse_subject_multipart_file, _parse_subject_json_file, _parse_subject_excel_file, _map_subject_excel_rows, _map_subject_row

@ns_subjects.route("/")
class SubjectList(Resource):

    @ns_subjects.doc("list_subjects", description="获取所有科目列表")
    @ns_subjects.response(200, "成功")
    @requires_permission("score.view")
    @cached_api(ttl=60)
    def get(self):
        """获取所有科目"""
        include_inactive = request.args.get("include_inactive", "false").lower() == "true"
        search = request.args.get("search", "").strip()
        result = get_subject_list_view(include_inactive=include_inactive, search=search)
        return APIResponse.success(
            data=result["items"],
            pagination=result["pagination"],
        )

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
        invalidate_cache("api:/api/subjects/*")

        return {**subject.to_dict(), "class_count": 0}, 201

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
        invalidate_cache("api:/api/subjects/*")

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
        subject = get_subject_detail_view(id)
        if not subject:
            return APIResponse.not_found(message="科目不存在")
        return subject

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
        if (
            data.get("name")
            and data["name"] != subject.name
            and Subject.query.filter_by(name=data["name"]).first()
        ):
            return APIResponse.error(message="科目名称已存在", status_code=400)

        # 检查代码是否重复
        if (
            data.get("code")
            and data["code"] != subject.code
            and Subject.query.filter_by(code=data["code"]).first()
        ):
            return APIResponse.error(message="科目代码已存在", status_code=400)

        academics_service.update_subject(subject, data)
        subject = Subject.query.get(id)
        invalidate_cache("api:/api/subjects/*")

        class_count = SubjectClass.query.filter_by(subject_id=id).count()

        return {**subject.to_dict(), "class_count": class_count}

    @ns_subjects.doc("delete_subject", description="删除科目")
    @ns_subjects.response(200, "删除成功")
    @ns_subjects.response(404, "科目不存在")
    @requires_permission("score.entry")
    def delete(self, id):
        """删除科目（先级联清理关联数据，再删除科目本身）"""
        Subject.query.get_or_404(id)
        academics_service.delete_subject(id)
        invalidate_cache("api:/api/subjects/*")
        return APIResponse.success(message="科目已删除")

@ns_subjects.route("/<int:id>/classes")
@ns_subjects.param("id", "科目ID")
class SubjectClasses(Resource):

    @ns_subjects.doc("get_subject_classes", description="获取科目关联的班级列表")
    @ns_subjects.response(200, "成功")
    @ns_subjects.response(404, "科目不存在")
    @requires_permission("score.view")
    @cached_api(ttl=30)
    def get(self, id):
        """获取科目关联的班级列表"""
        result = get_subject_classes_view(id)
        if not result:
            return APIResponse.not_found(message="科目不存在")
        return APIResponse.success(data=result)

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
        invalidate_cache("api:/api/subjects/*")

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
        invalidate_cache("api:/api/subjects/*")

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
        invalidate_cache("api:/api/subjects/*")

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

        export_data = get_subject_export_data_view(include_inactive, search)

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
        if export_format == "csv":
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
