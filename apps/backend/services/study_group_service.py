from models import db
from models.study_group import StudyGroup, StudyGroupMember, StudyGroupScore
from services.entity_names import names
from utils.permission import get_admin_class_ids, get_current_admin


class StudyGroupService:
    def list_groups(self, class_id=None, is_active=True):
        query = StudyGroup.query
        if class_id:
            query = query.filter_by(class_id=class_id)
        if is_active is not None:
            # R23 类型修正：query string 为字符串，需归一为 bool 后再与 Boolean 列比较
            # （直接传字符串会生成 `WHERE is_active = 'false'` → 恒空集）。
            # 同时兼容函数内部 bool 入参（默认 True）：is_active.lower() 在 bool 上抛
            # AttributeError（真实 bug），故统一经 _normalize_is_active 归一为 bool。
            flag = self._normalize_is_active(is_active)
            if flag is not None:
                query = query.filter_by(is_active=flag)
        groups = query.order_by(StudyGroup.score.desc()).all()
        # R14 批量预取成员 + 学生姓名，消除逐组查成员、逐成员查姓名的 N+1
        group_ids = [g.id for g in groups]
        members = (
            StudyGroupMember.query.filter(StudyGroupMember.group_id.in_(group_ids)).all()
            if group_ids
            else []
        )
        members_map = {}
        prefetch_ids = []
        for g in groups:
            if g.leader_id:
                prefetch_ids.append(g.leader_id)
        for m in members:
            members_map.setdefault(m.group_id, []).append(m)
            prefetch_ids.append(m.student_id)
        names.prefetch_students(prefetch_ids)
        return {
            "success": True,
            "data": [self._build_group_response(g, members_map=members_map) for g in groups],
        }

    @staticmethod
    def _normalize_is_active(is_active):
        """归一 is_active 多态入参 → bool（兼容 bool / 字符串 / None）。

        - None        → None（调用方据此跳过过滤）
        - bool        → 原样透传
        - str "true"  → True；"false"/其他 → False（R23 query-string 语义）
        - 其它类型    → bool() 兜底
        """
        if is_active is None:
            return None
        if isinstance(is_active, bool):
            return is_active
        if isinstance(is_active, str):
            return is_active.strip().lower() == "true"
        return bool(is_active)

    def create_group(self, data):
        group = StudyGroup(
            class_id=data["class_id"],
            name=data["name"],
            leader_id=data.get("leader_id"),
            description=data.get("description"),
        )
        db.session.add(group)
        db.session.flush()
        if data.get("member_ids"):
            for mid in data["member_ids"]:
                db.session.add(StudyGroupMember(group_id=group.id, student_id=mid))
        db.session.commit()
        return {"success": True, "data": self._build_group_response(group)}, 201

    def update_group(self, group_id, data):
        group = StudyGroup.query.get(group_id)
        if not group:
            return {"success": False, "message": "学习小组不存在"}, 404
        denied = self._deny_if_class_blocked(group.class_id)
        if denied:
            return denied
        for key, value in data.items():
            # R24 防批量赋值越权：class_id 为班级归属字段，禁止经通用更新接口改写
            if hasattr(group, key) and key not in ("id", "created_at", "score", "class_id"):
                setattr(group, key, value)
        db.session.commit()
        return {"success": True, "data": self._build_group_response(group)}

    def delete_group(self, group_id):
        group = StudyGroup.query.get(group_id)
        if not group:
            return {"success": False, "message": "学习小组不存在"}, 404
        denied = self._deny_if_class_blocked(group.class_id)
        if denied:
            return denied
        StudyGroupMember.query.filter_by(group_id=group_id).delete()
        StudyGroupScore.query.filter_by(group_id=group_id).delete()
        db.session.delete(group)
        db.session.commit()
        return {"success": True, "message": "删除成功"}

    def _deny_if_class_blocked(self, class_id):
        """隐私隔离：非超管只能操作自己关联班级的数据（detail-by-id 越权防护，对齐 duty/committee）。"""
        admin = get_current_admin()
        if admin and admin.role not in ("admin", "super_admin"):
            allowed_ids = get_admin_class_ids(admin.id)
            if not allowed_ids or class_id not in allowed_ids:
                return {"success": False, "message": "无权操作该班级的数据"}, 403
        return None

    def add_member(self, group_id, student_id):
        group = StudyGroup.query.get(group_id)
        if not group:
            return {"success": False, "message": "学习小组不存在"}, 404
        existing = StudyGroupMember.query.filter_by(
            group_id=group_id, student_id=student_id
        ).first()
        if existing:
            return {"success": False, "message": "学生已在组内"}, 400
        member = StudyGroupMember(group_id=group_id, student_id=student_id)
        db.session.add(member)
        db.session.commit()
        return {"success": True, "data": {"group_id": group_id, "student_id": student_id}}

    def remove_member(self, group_id, student_id):
        member = StudyGroupMember.query.filter_by(group_id=group_id, student_id=student_id).first()
        if not member:
            return {"success": False, "message": "学生不在组内"}, 404
        db.session.delete(member)
        db.session.commit()
        return {"success": True, "message": "移除成功"}

    def add_score(self, group_id, score_change, reason=""):
        group = StudyGroup.query.get(group_id)
        if not group:
            return {"success": False, "message": "学习小组不存在"}, 404
        admin = get_current_admin()
        score_record = StudyGroupScore(
            group_id=group_id,
            score_change=score_change,
            reason=reason,
            created_by=admin.id if admin else None,
        )
        group.score += score_change
        db.session.add(score_record)
        db.session.commit()
        return {"success": True, "data": {"group_id": group_id, "new_score": group.score}}

    def _build_group_response(self, group, members_map=None):
        if members_map is not None:
            members = members_map.get(group.id, [])
        else:
            members = StudyGroupMember.query.filter_by(group_id=group.id).all()
        return {
            "id": group.id,
            "class_id": group.class_id,
            "class_name": names.klass(group.class_id),
            "name": group.name,
            "leader_id": group.leader_id,
            "leader_name": names.student(group.leader_id),
            "description": group.description,
            "score": group.score,
            "is_active": group.is_active,
            "member_count": len(members),
            "members": [
                {"student_id": m.student_id, "student_name": names.student(m.student_id)}
                for m in members
            ],
        }


study_group_service = StudyGroupService()
