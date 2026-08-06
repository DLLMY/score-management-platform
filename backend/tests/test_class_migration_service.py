from models import ClassInfo
#!/usr/bin/env python3
"""
"""
# 班级数据迁移服务测试模块
"""
"""

from unittest.mock import MagicMock
import uuid
try:
    from services.class_migration_service import ClassMigrationService
except ImportError:
    pass

try:
    from models import User, Admin, db
except ImportError:
    pass

try:
    from utils.security import hash_password
except ImportError:
    pass

try:
    from models import SubAccount
except ImportError:
    pass


class TestClassMigrationService:
    """班级数据迁移服务测试类"""

    def test_service_initialization(self):
        """测试服务初始化"""
        from services.class_migration_service import ClassMigrationService

        service = ClassMigrationService()
        assert service is not None
        assert "classes_created" in service.stats
        assert "users_migrated" in service.stats
        assert "admins_migrated" in service.stats
        assert "errors" in service.stats

    def test_analyze_existing_data_empty(self, app):
        """测试分析空数据"""
        from models import User, Admin, db

        with app.app_context():
            User.query.filter(User.class_name.isnot(None)).delete()
            Admin.query.filter(Admin.class_name.isnot(None)).delete()
            db.session.commit()

            service = ClassMigrationService()
            result = service.analyze_existing_data()

            assert isinstance(result, dict)
            assert "user_count" in result
            assert "admin_count" in result
            assert "user_classes" in result
            assert "admin_classes" in result
            assert "existing_classes" in result
            assert "missing_classes" in result
            assert result["total_missing"] == 0

    def test_analyze_existing_data_with_users(self, app):
        """测试分析包含用户的数据"""

        with app.app_context():
            user1 = User(name="用户1", card_id=f"TEST{str(uuid.uuid4())[:12]}", class_name="初一(1)班")
            user2 = User(name="用户2", card_id=f"TEST{str(uuid.uuid4())[:12]}", class_name="初一(2)班")
            db.session.add_all([user1, user2])
            db.session.commit()

            service = ClassMigrationService()
            result = service.analyze_existing_data()

            assert isinstance(result, dict)
            assert result["user_count"] >= 2
            assert "初一(1)班" in result["user_classes"]
            assert "初一(2)班" in result["user_classes"]

    def test_analyze_existing_data_with_admins(self, app):
        """测试分析包含管理员的数据"""
        from utils.security import hash_password

        with app.app_context():
            admin = Admin(
                username=f"test_admin_{uuid.uuid4()}",
                password=hash_password("password"),
                real_name="测试管理员",
                class_name="初一(1)班"
            )
            db.session.add(admin)
            db.session.commit()

            service = ClassMigrationService()
            result = service.analyze_existing_data()

            assert isinstance(result, dict)
            assert result["admin_count"] >= 1
            assert "初一(1)班" in result["admin_classes"]

    def test_infer_grade(self):
        """测试从班级名称推断年级"""

        assert ClassMigrationService._infer_grade("高一(1)班") == "高一"
        assert ClassMigrationService._infer_grade("高二(2)班") == "高二"
        assert ClassMigrationService._infer_grade("高三(3)班") == "高三"
        assert ClassMigrationService._infer_grade("初一(1)班") == "初一"
        assert ClassMigrationService._infer_grade("初二(2)班") == "初二"
        assert ClassMigrationService._infer_grade("初三(3)班") == "初三"
        assert ClassMigrationService._infer_grade("七年级") == "初一"
        assert ClassMigrationService._infer_grade("八年级") == "初二"
        assert ClassMigrationService._infer_grade("九年级") == "初三"
        assert ClassMigrationService._infer_grade("高1班") == "高一"
        assert ClassMigrationService._infer_grade("高2班") == "高二"
        assert ClassMigrationService._infer_grade("未知班级") == ""

    def test_create_missing_classes_empty(self, app):
        """测试创建空的缺失班级"""

        with app.app_context():
            service = ClassMigrationService()
            result = service.create_missing_classes([])

            assert isinstance(result, dict)
            assert len(result) == 0

    def test_create_missing_classes_with_data(self, app):
        """测试创建缺失班级"""

        with app.app_context():
            service = ClassMigrationService()
            result = service.create_missing_classes(["初一(1)班", "初一(2)班"])

            assert isinstance(result, dict)
            assert "初一(1)班" in result
            assert "初一(2)班" in result
            assert service.stats["classes_created"] == 2

    def test_create_missing_classes_with_existing(self, app):
        """测试创建包含已存在班级的缺失列表"""

        with app.app_context():
            class_name_1 = f"初一(1)班_{str(uuid.uuid4())[:8]}"
            class_name_2 = f"初一(2)班_{str(uuid.uuid4())[:8]}"

            existing_class = ClassInfo(name=class_name_1, grade="初一", is_active=True)
            db.session.add(existing_class)
            db.session.commit()

            service = ClassMigrationService()
            result = service.create_missing_classes([class_name_1, class_name_2])

            assert isinstance(result, dict)
            assert class_name_1 in result
            assert class_name_2 in result
            assert service.stats["classes_created"] == 1

    def test_migrate_users_empty(self, app):
        """测试迁移空用户数据"""

        with app.app_context():
            User.query.filter(User.class_info_id.is_(None)).delete()
            db.session.commit()

            service = ClassMigrationService()
            migrated, errors = service.migrate_users({})

            assert migrated == 0
            assert isinstance(errors, list)
            assert len(errors) == 0

    def test_migrate_users_with_data(self, app):
        """测试迁移用户数据"""

        with app.app_context():
            class_name = f"初一(1)班_{str(uuid.uuid4())[:8]}"
            user = User(name="测试用户", card_id=f"TEST{str(uuid.uuid4())[:12]}", class_name=class_name)
            class_info = ClassInfo(name=class_name, grade="初一", is_active=True)
            db.session.add_all([user, class_info])
            db.session.commit()

            service = ClassMigrationService()
            migrated, errors = service.migrate_users({class_name: class_info})

            assert migrated == 1
            assert isinstance(errors, list)
            assert len(errors) == 0
            assert service.stats["users_migrated"] == 1

    def test_migrate_users_with_missing_class(self, app):
        """测试迁移用户-班级不存在"""

        with app.app_context():
            user = User(name="测试用户", card_id=f"TEST{str(uuid.uuid4())[:12]}", class_name="不存在的班级")
            db.session.add(user)
            db.session.commit()

            service = ClassMigrationService()
            migrated, errors = service.migrate_users({})

            assert migrated == 0
            assert isinstance(errors, list)
            assert len(errors) == 1

    def test_migrate_admins_empty(self, app):
        """测试迁移空管理员数据"""

        with app.app_context():
            Admin.query.filter(
                Admin.class_name.isnot(None),
                Admin.primary_class_id.is_(None)
            ).delete()
            db.session.commit()

            service = ClassMigrationService()
            migrated, errors = service.migrate_admins({})

            assert migrated == 0
            assert isinstance(errors, list)
            assert len(errors) == 0

    def test_migrate_admins_with_data(self, app):
        """测试迁移管理员数据"""

        with app.app_context():
            class_name = f"初一(1)班_{str(uuid.uuid4())[:8]}"
            admin = Admin(
                username=f"test_admin_{str(uuid.uuid4())}",
                password=hash_password("password"),
                real_name="测试管理员",
                class_name=class_name
            )
            class_info = ClassInfo(name=class_name, grade="初一", is_active=True)
            db.session.add_all([admin, class_info])
            db.session.commit()

            service = ClassMigrationService()
            migrated, errors = service.migrate_admins({class_name: class_info})

            assert migrated == 1
            assert isinstance(errors, list)
            assert len(errors) == 0
            assert service.stats["admins_migrated"] == 1

    def test_migrate_admins_with_missing_class(self, app):
        """测试迁移管理员-班级不存在"""

        with app.app_context():
            admin = Admin(
                username=f"test_admin_{str(uuid.uuid4())}",
                password=hash_password("password"),
                real_name="测试管理员",
                class_name="不存在的班级"
            )
            db.session.add(admin)
            db.session.commit()

            service = ClassMigrationService()
            migrated, errors = service.migrate_admins({})

            assert migrated == 0
            assert isinstance(errors, list)
            assert len(errors) == 1

    def test_migrate_subaccounts_empty(self, app):
        """测试迁移空子账号数据"""

        with app.app_context():
            service = ClassMigrationService()
            migrated, errors = service.migrate_subaccounts({})

            assert migrated == 0
            assert isinstance(errors, list)
            assert len(errors) == 0

    def test_migrate_subaccounts_with_parent(self, app):
        """测试迁移子账号数据-有父级管理员"""
        from models import SubAccount

        with app.app_context():
            class_name = f"初一(1)班_{str(uuid.uuid4())[:8]}"
            class_info = ClassInfo(name=class_name, grade="初一", is_active=True)
            db.session.add(class_info)
            db.session.commit()

            admin = Admin(
                username=f"test_admin_{str(uuid.uuid4())}",
                password=hash_password("password"),
                real_name="测试管理员",
                primary_class_id=class_info.id
            )
            db.session.add(admin)
            db.session.commit()

            subaccount = SubAccount(
                parent_admin_id=admin.id,
                username=f"test_sub_{str(uuid.uuid4())}",
                password=hash_password("password")
            )
            db.session.add(subaccount)
            db.session.commit()

            service = ClassMigrationService()
            migrated, errors = service.migrate_subaccounts({class_name: class_info})

            assert migrated == 1
            assert isinstance(errors, list)
            assert len(errors) == 0
            assert service.stats["subaccounts_migrated"] == 1

    def test_run_full_migration_empty(self, app):
        """测试执行完整迁移-空数据"""

        with app.app_context():
            service = ClassMigrationService()
            result = service.run_full_migration()

            assert isinstance(result, dict)
            assert "success" in result
            assert "stats" in result
            assert "analysis" in result

    def test_run_full_migration_with_data(self, app):
        """测试执行完整迁移-有数据"""

        with app.app_context():
            class_name = f"初一(1)班_{str(uuid.uuid4())[:8]}"
            user = User(name="测试用户", card_id=f"TEST{str(uuid.uuid4())[:12]}", class_name=class_name)
            admin = Admin(
                username=f"test_admin_{str(uuid.uuid4())}",
                password=hash_password("password"),
                real_name="测试管理员",
                class_name=class_name
            )
            db.session.add_all([user, admin])
            db.session.commit()

            service = ClassMigrationService()
            result = service.run_full_migration()

            assert isinstance(result, dict)
            assert result["success"] is True
            assert result["stats"]["classes_created"] >= 1
            assert result["stats"]["users_migrated"] >= 1
            assert result["stats"]["admins_migrated"] >= 1

    def test_get_migration_status_empty(self, app):
        """测试获取迁移状态-空数据"""

        with app.app_context():
            service = ClassMigrationService()
            status = service.get_migration_status()

            assert isinstance(status, dict)
            assert "classes" in status
            assert "users" in status
            assert "admins" in status
            assert "admin_class_links" in status

    def test_get_migration_status_with_data(self, app):
        """测试获取迁移状态-有数据"""

        with app.app_context():
            User.query.filter(User.class_info_id.is_(None)).delete()
            db.session.commit()

            class_name = f"初一(1)班_{str(uuid.uuid4())[:8]}"
            existing_class = ClassInfo.query.filter_by(name=class_name).first()
            if not existing_class:
                class_info = ClassInfo(name=class_name, grade="初一", is_active=True)
                db.session.add(class_info)
                db.session.commit()
            else:
                class_info = existing_class

            user = User(
                name="测试用户",
                card_id=f"TEST{str(uuid.uuid4())[:8]}",
                class_name=class_name,
                class_info_id=class_info.id
            )
            db.session.add(user)
            db.session.commit()

            service = ClassMigrationService()
            status = service.get_migration_status()

            assert isinstance(status, dict)
            assert status["users"]["total_with_class"] >= 1
            assert status["users"]["linked"] >= 1

    def test_migrate_users_with_empty_class_name(self, app):
        """测试迁移用户-空班级名称"""

        with app.app_context():
            User.query.filter(
                User.class_name.isnot(None),
                User.class_info_id.is_(None)
            ).delete()
            db.session.commit()

            user = User(name="测试用户", card_id=f"TEST{str(uuid.uuid4())[:8]}", class_name="")
            db.session.add(user)
            db.session.commit()

            service = ClassMigrationService()
            migrated, errors = service.migrate_users({"初一(1)班": MagicMock()})

            assert migrated == 0
            assert len(errors) == 0

    def test_migrate_admins_with_empty_class_name(self, app):
        """测试迁移管理员-空班级名称"""

        with app.app_context():
            admin = Admin(
                username=f"test_admin_empty_{str(uuid.uuid4())[:8]}",
                password=hash_password("password"),
                real_name="测试管理员",
                class_name=""
            )
            db.session.add(admin)
            db.session.commit()

            service = ClassMigrationService()
            migrated, errors = service.migrate_admins({"初一(1)班": MagicMock()})

            assert migrated == 0
            assert len(errors) == 0

    def test_migrate_subaccounts_without_parent(self, app):
        """测试迁移子账号-无父级管理员"""

        with app.app_context():
            SubAccount.query.delete()
            db.session.commit()

            parent_admin = Admin(
                username=f"parent_admin_{str(uuid.uuid4())[:8]}",
                password=hash_password("password"),
                real_name="父级管理员",
                primary_class_id=None
            )
            db.session.add(parent_admin)
            db.session.commit()

            subaccount = SubAccount(
                parent_admin_id=parent_admin.id,
                username=f"test_sub_{str(uuid.uuid4())[:8]}",
                password=hash_password("password")
            )
            db.session.add(subaccount)
            db.session.commit()

            service = ClassMigrationService()
            migrated, errors = service.migrate_subaccounts({})

            assert migrated == 0
            assert len(errors) == 0
