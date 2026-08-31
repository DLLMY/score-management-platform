import logging
from models import db, User, Admin, ClassInfo, AdminClass, get_by_id
from services.class_migration_service import ClassMigrationService
from typing import Dict, Optional, List

"\n"
"数据同步服务"
"负责实时同步班级名称变更到关联数据"
"\n"
logger = logging.getLogger(__name__)


class DataSyncService:
    """数据同步服务"""

    @staticmethod
    def sync_class_name_change(class_info: ClassInfo, old_name: str, new_name: str) -> Dict:
        """
        同步班级名称变更
        当 ClassInfo.name 变更时，同步更新所有使用旧名称的记录
        """
        stats = {"users_updated": 0, "admins_updated": 0, "errors": []}
        if old_name == new_name:
            return stats
        try:
            users = User.query.filter_by(class_name=old_name).all()
            for user in users:
                user.class_name = new_name
                stats["users_updated"] += 1
            admins = Admin.query.filter_by(class_name=old_name).all()
            for admin in admins:
                admin.class_name = new_name
                stats["admins_updated"] += 1
            logger.info(
                f"Class name sync: {old_name} -> {new_name}, updated {stats['users_updated']} users, {stats['admins_updated']} admins"  # noqa: E501
            )
        except Exception as e:
            stats["errors"].append(str(e))
            logger.error(f"Class name sync failed: {e}")
        return stats

    @staticmethod
    def sync_new_class_creation(class_info: ClassInfo) -> Dict:
        """
        同步新班级创建
        检查是否有未关联的用户/管理员使用该班级名称，自动建立关联
        """
        stats = {"users_linked": 0, "admins_linked": 0, "admin_classes_created": 0}
        try:
            users = User.query.filter(
                User.class_name == class_info.name, User.class_info_id.is_(None)
            ).all()
            for user in users:
                user.class_info_id = class_info.id
                stats["users_linked"] += 1
            admins = Admin.query.filter(
                Admin.class_name == class_info.name, Admin.primary_class_id.is_(None)
            ).all()
            for admin in admins:
                admin.primary_class_id = class_info.id
                admin_class = AdminClass(
                    admin_id=admin.id, class_info_id=class_info.id, is_primary=True
                )
                db.session.add(admin_class)
                stats["admins_linked"] += 1
                stats["admin_classes_created"] += 1
            logger.info(
                f"New class sync: {class_info.name}, linked {stats['users_linked']} users, {stats['admins_linked']} admins"  # noqa: E501
            )
        except Exception as e:
            logger.error(f"New class sync failed: {e}")
            try:
                db.session.rollback()  # 防中途异常遗留 pending 修改
            except Exception as e2:
                logger.warning(f"New class sync 回滚失败: {e2}")
        return stats

    @staticmethod
    def sync_class_deletion(class_info: ClassInfo) -> Dict:
        """
        同步班级删除
        处理班级删除时的关联数据
        """
        stats = {
            "users_unlinked": 0,
            "admins_unlinked": 0,
            "admin_classes_deleted": 0,
            "course_schedules_deleted": 0,
        }
        try:
            users = User.query.filter_by(class_info_id=class_info.id).all()
            for user in users:
                user.class_info_id = None
                stats["users_unlinked"] += 1
            admins = Admin.query.filter_by(primary_class_id=class_info.id).all()
            for admin in admins:
                admin.primary_class_id = None
                stats["admins_unlinked"] += 1
            admin_classes = AdminClass.query.filter_by(class_info_id=class_info.id).all()
            for ac in admin_classes:
                db.session.delete(ac)
                stats["admin_classes_deleted"] += 1
            from models import CourseSchedule

            schedules = CourseSchedule.query.filter_by(class_info_id=class_info.id).all()
            for schedule in schedules:
                db.session.delete(schedule)
                stats["course_schedules_deleted"] += 1
            logger.info(
                f"Class delete sync: {class_info.name}, unlinked {stats['users_unlinked']} users"
            )
        except Exception as e:
            logger.error(f"Class delete sync failed: {e}")
            try:
                db.session.rollback()  # 防中途异常遗留 pending 修改
            except Exception as e2:
                logger.warning(f"Class delete sync 回滚失败: {e2}")
        return stats

    @staticmethod
    def sync_user_class_change(
        user: User, old_class_name: Optional[str], new_class_name: Optional[str]
    ) -> Dict:
        """
        同步用户班级变更
        当用户班级变更时，自动建立或解除关联
        """
        stats = {"linked": False, "class_created": False, "class_info_id": None}
        if not new_class_name:
            user.class_info_id = None
            return stats
        class_info = ClassInfo.query.filter_by(name=new_class_name).first()
        if not class_info:
            from services.class_migration_service import ClassMigrationService

            grade = ClassMigrationService._infer_grade(new_class_name)
            class_info = ClassInfo(
                name=new_class_name, grade=grade, description="Auto created", is_active=True
            )
            db.session.add(class_info)
            db.session.flush()
            stats["class_created"] = True
        user.class_info_id = class_info.id
        stats["class_info_id"] = class_info.id
        stats["linked"] = True
        return stats

    @staticmethod
    def sync_admin_class_change(
        admin: Admin, old_class_name: Optional[str], new_class_name: Optional[str]
    ) -> Dict:
        """
        同步管理员班级变更
        当管理员班级变更时，自动建立或解除关联
        """
        stats = {"linked": False, "class_created": False, "admin_class_created": False}
        if not new_class_name:
            admin.primary_class_id = None
            return stats
        class_info = ClassInfo.query.filter_by(name=new_class_name).first()
        if not class_info:
            grade = ClassMigrationService._infer_grade(new_class_name)
            class_info = ClassInfo(
                name=new_class_name, grade=grade, description="Auto created", is_active=True
            )
            db.session.add(class_info)
            db.session.flush()
            stats["class_created"] = True
        admin.primary_class_id = class_info.id
        admin_class = AdminClass.query.filter_by(
            admin_id=admin.id, class_info_id=class_info.id
        ).first()
        if not admin_class:
            admin_class = AdminClass(
                admin_id=admin.id, class_info_id=class_info.id, is_primary=True
            )
            db.session.add(admin_class)
            stats["admin_class_created"] = True
        stats["linked"] = True
        return stats

    @staticmethod
    def get_class_students(class_info_id: int) -> List[User]:
        """获取班级的所有学生"""
        return User.query.filter_by(class_info_id=class_info_id, is_active=True).all()

    @staticmethod
    def get_class_teachers(class_info_id: int) -> List[Admin]:
        """获取班级的所有教师/班主任"""
        return Admin.query.filter_by(primary_class_id=class_info_id).all()

    @staticmethod
    def get_teacher_classes(teacher_id: int) -> List[ClassInfo]:
        """获取教师负责的所有班级"""
        admin = get_by_id(Admin, teacher_id)
        if not admin or not admin.primary_class_id:
            return []
        class_info = get_by_id(ClassInfo, admin.primary_class_id)
        return [class_info] if class_info else []
