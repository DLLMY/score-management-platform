import logging
from models import db, User, Admin, ClassInfo, AdminClass, CourseSchedule
from datetime import datetime
from typing import Dict, List

"\n"
"数据一致性校验服务"
"自动检测并报告数据不一致问题"
"\n"
logger = logging.getLogger(__name__)


class DataConsistencyChecker:
    """数据一致性校验器"""

    def __init__(self):
        self.issues = []
        self.stats = {}

    def check_all(self) -> Dict:
        """执行所有一致性检查"""
        self.issues = []
        self.check_user_class_consistency()
        self.check_admin_class_consistency()
        self.check_admin_class_links()
        self.check_course_schedule_consistency()
        self.check_orphaned_classes()
        return {
            "timestamp": datetime.now().isoformat(),
            "total_issues": len(self.issues),
            "issues": self.issues,
            "stats": self.stats,
            "healthy": len(self.issues) == 0,
        }

    def check_user_class_consistency(self) -> List[Dict]:
        """
        检查用户班级一致性
        """
        issues = []
        total_users = User.query.count()
        users_with_class_name = User.query.filter(User.class_name.isnot(None), User.class_name != "").count()
        users_with_fk = User.query.filter(User.class_info_id.isnot(None)).count()
        self.stats["users"] = {
            "total": total_users,
            "with_class_name": users_with_class_name,
            "with_fk": users_with_fk,
            "unlinked": users_with_class_name - users_with_fk,
        }
        unlinked_users = (
            User.query.filter(User.class_name.isnot(None), User.class_name != "", User.class_info_id.is_(None))
            .limit(50)
            .all()
        )
        for user in unlinked_users:
            issues.append(
                {
                    "type": "user_unlinked",
                    "severity": "warning",
                    "model": "User",
                    "id": user.id,
                    "name": user.name,
                    "class_name": user.class_name,
                    "message": f"User {user.name} (ID:{user.id}) is not linked to a class",
                }
            )
        mismatched_users = (
            db.session.query(User)
            .join(ClassInfo, User.class_info_id == ClassInfo.id)
            .filter(User.class_name != ClassInfo.name)
            .limit(20)
            .all()
        )
        for user in mismatched_users:
            issues.append(
                {
                    "type": "user_class_mismatch",
                    "severity": "error",
                    "model": "User",
                    "id": user.id,
                    "name": user.name,
                    "class_name": user.class_name,
                    "linked_class": user.class_info.name if user.class_info else None,
                }
            )
        invalid_fk_users = (
            User.query.filter(User.class_info_id.isnot(None))
            .filter(
                ~db.session.query(ClassInfo.id)
                .filter(ClassInfo.id == User.class_info_id)
                .exists()
            )
            .limit(20)
            .all()
        )
        for user in invalid_fk_users:
            issues.append(
                {
                    "type": "user_invalid_fk",
                    "severity": "critical",
                    "model": "User",
                    "id": user.id,
                    "name": user.name,
                    "class_info_id": user.class_info_id,
                    "message": f"User {user.name} (ID:{user.id}) has invalid class_info_id",
                }
            )
        self.issues.extend(issues)
        return issues

    def check_admin_class_consistency(self) -> List[Dict]:
        """
        检查管理员班级一致性
        """
        issues = []
        total_admins = Admin.query.count()
        admins_with_class = Admin.query.filter(Admin.class_name.isnot(None), Admin.class_name != "").count()
        admins_with_fk = Admin.query.filter(Admin.primary_class_id.isnot(None)).count()
        self.stats["admins"] = {
            "total": total_admins,
            "with_class_name": admins_with_class,
            "with_fk": admins_with_fk,
            "unlinked": admins_with_class - admins_with_fk,
        }
        unlinked_admins = (
            Admin.query.filter(Admin.class_name.isnot(None), Admin.class_name != "", Admin.primary_class_id.is_(None))
            .limit(30)
            .all()
        )
        for admin in unlinked_admins:
            issues.append(
                {
                    "type": "admin_unlinked",
                    "severity": "warning",
                    "model": "Admin",
                    "id": admin.id,
                    "name": admin.real_name or admin.username,
                    "class_name": admin.class_name,
                    "message": f"Admin {admin.username} (ID:{admin.id}) is not linked to a class",
                }
            )
        self.issues.extend(issues)
        return issues

    def check_admin_class_links(self) -> List[Dict]:
        """
        检查 AdminClass 关联表一致性
        """
        issues = []
        total_links = AdminClass.query.count()
        primary_links = AdminClass.query.filter_by(is_primary=True).count()
        self.stats["admin_class_links"] = {"total": total_links, "primary": primary_links}
        invalid_admin_links = (
            db.session.query(AdminClass)
            .outerjoin(Admin, AdminClass.admin_id == Admin.id)
            .filter(Admin.id.is_(None))
            .filter(Admin.id.is_(None))
        )
        for link in invalid_admin_links:
            issues.append(
                {
                    "type": "admin_class_invalid_admin",
                    "severity": "critical",
                    "model": "AdminClass",
                    "id": link.id,
                    "admin_id": link.admin_id,
                    "message": f"AdminClass ID:{link.id} references non-existent admin ID:{link.admin_id}",
                }
            )
        invalid_class_links = (
            db.session.query(AdminClass)
            .outerjoin(ClassInfo, AdminClass.class_info_id == ClassInfo.id)
            .filter(ClassInfo.id.is_(None))
            .filter(ClassInfo.id.is_(None))
        )
        for link in invalid_class_links:
            issues.append(
                {
                    "type": "admin_class_invalid_class",
                    "severity": "critical",
                    "model": "AdminClass",
                    "id": link.id,
                    "class_info_id": link.class_info_id,
                    "message": f"AdminClass ID:{link.id} references non-existent class ID:{link.class_info_id}",
                }
            )
        admins_with_multiple_primary = (
            db.session.query(AdminClass.admin_id, db.func.count(AdminClass.id).label("count"))
            .filter(AdminClass.is_primary)
            .group_by(AdminClass.admin_id)
            .all()
        )  # noqa: E501
        for admin_id, count in admins_with_multiple_primary:
            issues.append(
                {
                    "type": "admin_multiple_primary",
                    "severity": "warning",
                    "admin_id": admin_id,
                    "count": count,
                    "message": f"Admin ID:{admin_id} has {count} primary class links",
                }
            )
        self.issues.extend(issues)
        return issues

    def check_course_schedule_consistency(self) -> List[Dict]:
        """
        检查课程表一致性
        """
        issues = []
        total_schedules = CourseSchedule.query.count()
        self.stats["course_schedules"] = {"total": total_schedules}
        invalid_class_schedules = (
            db.session.query(CourseSchedule)
            .outerjoin(ClassInfo, CourseSchedule.class_info_id == ClassInfo.id)
            .filter(ClassInfo.id.is_(None))
            .filter(ClassInfo.id.is_(None))
        )
        for schedule in invalid_class_schedules:
            issues.append(
                {
                    "type": "schedule_invalid_class",
                    "severity": "critical",
                    "model": "CourseSchedule",
                    "id": schedule.id,
                    "class_info_id": schedule.class_info_id,
                    "message": f"CourseSchedule ID:{schedule.id} references non-existent class ID:{schedule.class_info_id}",  # noqa: E501
                }
            )
        from models import Subject

        invalid_subject_schedules = (
            db.session.query(CourseSchedule)
            .outerjoin(Subject, CourseSchedule.subject_id == Subject.id)
            .filter(Subject.id.is_(None))
            .filter(Subject.id.is_(None))
        )
        for schedule in invalid_subject_schedules:
            issues.append(
                {
                    "type": "schedule_invalid_subject",
                    "severity": "critical",
                    "model": "CourseSchedule",
                    "id": schedule.id,
                    "subject_id": schedule.subject_id,
                    "message": f"CourseSchedule ID:{schedule.id} references non-existent subject ID:{schedule.subject_id}",  # noqa: E501
                }
            )
        self.issues.extend(issues)
        return issues

    def check_orphaned_classes(self) -> List[Dict]:
        """
        检查孤立班级
        """
        issues = []
        all_classes = ClassInfo.query.filter_by(is_active=True).all()
        self.stats["classes"] = {"total": len(all_classes)}
        for class_info in all_classes:
            user_count = User.query.filter_by(class_info_id=class_info.id).count()
            admin_count = AdminClass.query.filter_by(class_info_id=class_info.id).count()
            schedule_count = CourseSchedule.query.filter_by(class_info_id=class_info.id).count()
            if user_count == 0 and admin_count == 0 and (schedule_count == 0):
                issues.append(
                    {
                        "type": "orphaned_class",
                        "severity": "info",
                        "model": "ClassInfo",
                        "id": class_info.id,
                        "name": class_info.name,
                        "message": f"Class '{class_info.name}' has no linked data",
                    }
                )
        self.issues.extend(issues)
        return issues

    def generate_report(self) -> str:
        """生成一致性报告"""
        result = self.check_all()
        lines = []
        lines.append("=" * 60)
        lines.append("Data Consistency Check Report")
        lines.append("=" * 60)
        lines.append(f"Timestamp: {result['timestamp']}")
        lines.append(f"Total Issues: {result['total_issues']}")
        lines.append(f"Status: {('HEALTHY' if result['healthy'] else 'ISSUES FOUND')}")
        lines.append("")
        lines.append("Statistics:")
        for model, stats in result["stats"].items():
            lines.append(f"  {model}:")
            for key, value in stats.items():
                lines.append(f"    - {key}: {value}")
        lines.append("")
        if result["issues"]:
            lines.append("Issues Found:")
            for issue in result["issues"][:50]:
                icon = {"critical": "[CRITICAL]", "error": "[ERROR]", "warning": "[WARNING]", "info": "[INFO]"}
                icon_text = icon.get(issue["severity"], "[UNKNOWN]")
                lines.append(f"  {icon_text} [{issue['type']}] {issue['message']}")
        return "\n".join(lines)
