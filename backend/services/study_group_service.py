from models import db
from models.study_group import StudyGroup, StudyGroupMember, StudyGroupScore
from utils.permission import get_current_admin
from services.entity_names import names


class StudyGroupService:
    def list_groups(self, class_id=None, is_active=True):
        query = StudyGroup.query
        if class_id:
            query = query.filter_by(class_id=class_id)
        if is_active is not None:
            query = query.filter_by(is_active=is_active)
        groups = query.order_by(StudyGroup.score.desc()).all()
        return {"success": True, "data": [self._build_group_response(g) for g in groups]}

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
        for key, value in data.items():
            if hasattr(group, key) and key not in ("id", "created_at", "score"):
                setattr(group, key, value)
        db.session.commit()
        return {"success": True, "data": self._build_group_response(group)}

    def delete_group(self, group_id):
        group = StudyGroup.query.get(group_id)
        if not group:
            return {"success": False, "message": "学习小组不存在"}, 404
        StudyGroupMember.query.filter_by(group_id=group_id).delete()
        StudyGroupScore.query.filter_by(group_id=group_id).delete()
        db.session.delete(group)
        db.session.commit()
        return {"success": True, "message": "删除成功"}

    def add_member(self, group_id, student_id):
        group = StudyGroup.query.get(group_id)
        if not group:
            return {"success": False, "message": "学习小组不存在"}, 404
        existing = StudyGroupMember.query.filter_by(group_id=group_id, student_id=student_id).first()
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

    def _build_group_response(self, group):
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
