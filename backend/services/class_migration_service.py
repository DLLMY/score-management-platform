from models import User, Admin, SubAccount, ClassInfo, AdminClass, db
from typing import List, Dict, Tuple
import logging

"""
班级数据迁移服务
负责将旧的 class_name 字符串数据迁移到 ClassInfo 表并建立关联
"""
logger = logging.getLogger(__name__)


class ClassMigrationService:
    """班级数据迁移服务"""

    def __init__(self):
        self.stats = {
            "classes_created": 0,
            "users_migrated": 0,
            "admins_migrated": 0,
            "subaccounts_migrated": 0,
            "admin_classes_created": 0,
            "errors": [],
        }

    def analyze_existing_data(self) -> Dict:
        """分析现有数据，生成迁移报告"""
        # 收集所有使用的班级名称
        user_classes = set()
        admin_classes = set()
        # 从 User 表收集班级名称
        users = User.query.filter(User.class_name.isnot(None)).all()
        for user in users:
            if user.class_name and user.class_name.strip():
                user_classes.add(user.class_name.strip())
        # 从 Admin 表收集班级名称
        admins = Admin.query.filter(Admin.class_name.isnot(None)).all()
        for admin in admins:
            if admin.class_name and admin.class_name.strip():
                admin_classes.add(admin.class_name.strip())
        # 获取现有 ClassInfo 表中的班级
        existing_classes = ClassInfo.query.all()
        existing_class_names = {c.name for c in existing_classes}
        # 分析缺失的班级
        missing_classes = (user_classes | admin_classes) - existing_class_names
        return {
            "user_count": len(users),
            "admin_count": len(admins),
            "user_classes": sorted(user_classes),
            "admin_classes": sorted(admin_classes),
            "existing_classes": sorted(existing_class_names),
            "missing_classes": sorted(missing_classes),
            "total_missing": len(missing_classes),
        }

    def create_missing_classes(self, class_names: List[str]) -> Dict[str, ClassInfo]:
        """创建缺失的班级记录"""
        created = {}
        for name in class_names:
            # 检查是否已存在
            existing = ClassInfo.query.filter_by(name=name).first()
            if existing:
                created[name] = existing
                continue
            # 创建新班级
            # 尝试从名称推断年级
            grade = self._infer_grade(name)
            class_info = ClassInfo(
                name=name,
                grade=grade,
                description="从历史数据迁移创建",
                is_active=True,
            )
            db.session.add(class_info)
            db.session.flush()  # 获取 ID
            created[name] = class_info
            self.stats["classes_created"] += 1
            logger.info(f"创建班级: {name} (年级: {grade})")
        db.session.commit()
        return created

    @staticmethod
    def _infer_grade(class_name: str) -> str:
        """从班级名称推断年级"""
        # 常见年级格式匹配
        grade_patterns = [
            ("高一", ["高一", "高一(", "高1"]),
            ("高二", ["高二", "高二(", "高2"]),
            ("高三", ["高三", "高三(", "高3"]),
            ("初一", ["初一", "初一(", "初1", "七年级"]),
            ("初二", ["初二", "初二(", "初2", "八年级"]),
            ("初三", ["初三", "初三(", "初3", "九年级"]),
        ]
        for grade, patterns in grade_patterns:
            for pattern in patterns:
                if class_name.startswith(pattern) or pattern in class_name:
                    return grade
        return ""

    def migrate_users(self, class_map: Dict[str, ClassInfo]) -> Tuple[int, List[str]]:
        """迁移用户数据"""
        users = User.query.filter(
            User.class_name.isnot(None), User.class_info_id.is_(None)
        ).all()  # 只迁移未关联的
        migrated = 0
        errors = []
        for user in users:
            class_name = user.class_name.strip() if user.class_name else ""
            if not class_name:
                continue
            if class_name not in class_map:
                errors.append(f"用户 {user.name} (ID:{user.id}) 班级 '{class_name}' 不存在")
                continue
            user.class_info_id = class_map[class_name].id
            migrated += 1
            self.stats["users_migrated"] += 1
        db.session.commit()
        return migrated, errors

    def migrate_admins(self, class_map: Dict[str, ClassInfo]) -> Tuple[int, List[str]]:
        """迁移管理员/教师数据"""
        admins = Admin.query.filter(
            Admin.class_name.isnot(None),
            Admin.primary_class_id.is_(None),  # 只迁移未关联的
        ).all()
        migrated = 0
        errors = []
        for admin in admins:
            class_name = admin.class_name.strip() if admin.class_name else ""
            if not class_name:
                continue
            if class_name not in class_map:
                errors.append(
                    (
                        f"管理员 {admin.real_name or admin.username} "
                        f"(ID:{admin.id}) 班级 '{class_name}' 不存在"
                    )
                )
                continue
            # 设置主班级
            admin.primary_class_id = class_map[class_name].id
            # 同时创建 AdminClass 关联记录
            admin_class = AdminClass.query.filter_by(
                admin_id=admin.id, class_info_id=class_map[class_name].id
            ).first()
            if not admin_class:
                admin_class = AdminClass(
                    admin_id=admin.id,
                    class_info_id=class_map[class_name].id,
                    is_primary=True,
                )
                db.session.add(admin_class)
                self.stats["admin_classes_created"] += 1
            migrated += 1
            self.stats["admins_migrated"] += 1
        db.session.commit()
        return migrated, errors

    def migrate_subaccounts(self, class_map: Dict[str, ClassInfo]) -> Tuple[int, List[str]]:
        """迁移子账号数据"""
        # SubAccount 通过 parent_admin_id 关联到 Admin，不需要单独迁移班级
        # 子账号的班级关联通过其父级管理员间接获取
        subaccounts = SubAccount.query.all()
        migrated = 0
        errors = []
        for subaccount in subaccounts:
            if subaccount.parent_admin and subaccount.parent_admin.primary_class_id:
                migrated += 1
                self.stats["subaccounts_migrated"] += 1
        return migrated, errors

    def run_full_migration(self) -> Dict:
        """执行完整迁移流程"""
        logger.info("开始班级数据迁移...")
        # 1. 分析现有数据
        analysis = self.analyze_existing_data()
        logger.info(f"分析结果: 缺失 {analysis['total_missing']} 个班级")
        # 2. 创建缺失的班级
        if analysis["missing_classes"]:
            class_map = self.create_missing_classes(analysis["missing_classes"])
        else:
            # 获取现有班级映射
            class_map = {c.name: c for c in ClassInfo.query.all()}
        # 3. 迁移用户数据
        user_migrated, user_errors = self.migrate_users(class_map)
        self.stats["errors"].extend(user_errors)
        # 4. 迁移管理员数据
        admin_migrated, admin_errors = self.migrate_admins(class_map)
        self.stats["errors"].extend(admin_errors)
        # 5. 迁移子账号数据
        sub_migrated, sub_errors = self.migrate_subaccounts(class_map)
        self.stats["errors"].extend(sub_errors)
        logger.info("班级数据迁移完成")
        return {
            "success": len(self.stats["errors"]) == 0,
            "stats": self.stats.copy(),
            "analysis": analysis,
        }

    def get_migration_status(self) -> Dict:
        """获取迁移状态"""
        analysis = self.analyze_existing_data()
        # 统计已迁移的数据
        users_with_fk = User.query.filter(User.class_info_id.isnot(None)).count()
        users_total = User.query.filter(User.class_name.isnot(None)).count()
        admins_with_fk = Admin.query.filter(Admin.primary_class_id.isnot(None)).count()
        admins_total = Admin.query.filter(Admin.class_name.isnot(None)).count()
        admin_class_links = AdminClass.query.count()
        return {
            "classes": {
                "total": len(analysis["existing_classes"]),
                "used_by_users": len(analysis["user_classes"]),
                "used_by_admins": len(analysis["admin_classes"]),
                "missing": analysis["total_missing"],
            },
            "users": {
                "total_with_class": users_total,
                "linked": users_with_fk,
                "unlinked": users_total - users_with_fk,
                "link_rate": (
                    f"{(users_with_fk/users_total*100):.1f}%" if users_total > 0 else "N/A"
                ),
            },
            "admins": {
                "total_with_class": admins_total,
                "linked": admins_with_fk,
                "unlinked": admins_total - admins_with_fk,
                "link_rate": (
                    f"{(admins_with_fk/admins_total*100):.1f}%" if admins_total > 0 else "N/A"
                ),
            },
            "admin_class_links": admin_class_links,
            "missing_classes": analysis["missing_classes"],
        }
