#!/usr/bin/env python3
""" """

# 数据一致性检查服务测试模块
"""
"""

import uuid

try:
    from services.data_consistency_checker import DataConsistencyChecker
except ImportError:
    pass

try:
    from models import User, Admin, AdminClass, CourseSchedule, ClassInfo, db
except ImportError:
    pass

try:
    from utils.security import hash_password
except ImportError:
    pass


class TestDataConsistencyChecker:
    """数据一致性检查服务测试类"""

    def test_checker_initialization(self):
        """测试检查器初始化"""
        from services.data_consistency_checker import DataConsistencyChecker

        checker = DataConsistencyChecker()
        assert checker is not None
        assert checker.issues == []
        assert checker.stats == {}

    def test_check_all_empty_database(self, app):
        """测试空数据库的一致性检查"""
        from models import User, Admin, AdminClass, CourseSchedule, ClassInfo, db

        with app.app_context():
            AdminClass.query.delete()
            CourseSchedule.query.delete()
            User.query.delete()
            Admin.query.delete()
            ClassInfo.query.delete()
            db.session.commit()

            checker = DataConsistencyChecker()
            result = checker.check_all()

            assert isinstance(result, dict)
            assert "timestamp" in result
            assert result["total_issues"] == 0
            assert result["healthy"] is True
            assert "stats" in result

    def test_check_user_class_consistency_empty(self, app):
        """测试空用户数据的班级一致性检查"""

        with app.app_context():
            User.query.delete()
            db.session.commit()

            checker = DataConsistencyChecker()
            issues = checker.check_user_class_consistency()

            assert isinstance(issues, list)
            assert len(issues) == 0
            assert "users" in checker.stats

    def test_check_admin_class_consistency_empty(self, app):
        """测试空管理员数据的班级一致性检查"""

        with app.app_context():
            checker = DataConsistencyChecker()
            issues = checker.check_admin_class_consistency()

            assert isinstance(issues, list)
            assert len(issues) == 0
            assert "admins" in checker.stats

    def test_check_admin_class_links_empty(self, app):
        """测试空AdminClass数据的关联检查"""

        with app.app_context():
            checker = DataConsistencyChecker()
            issues = checker.check_admin_class_links()

            assert isinstance(issues, list)
            assert len(issues) == 0
            assert "admin_class_links" in checker.stats

    def test_check_course_schedule_consistency_empty(self, app):
        """测试空课程表数据的一致性检查"""

        with app.app_context():
            checker = DataConsistencyChecker()
            issues = checker.check_course_schedule_consistency()

            assert isinstance(issues, list)
            assert len(issues) == 0
            assert "course_schedules" in checker.stats

    def test_check_orphaned_classes_empty(self, app):
        """测试空班级数据的孤立检查"""

        with app.app_context():
            ClassInfo.query.delete()
            db.session.commit()

            checker = DataConsistencyChecker()
            issues = checker.check_orphaned_classes()

            assert isinstance(issues, list)
            assert len(issues) == 0
            assert "classes" in checker.stats

    def test_generate_report_empty(self, app):
        """测试生成空报告"""

        with app.app_context():
            AdminClass.query.delete()
            CourseSchedule.query.delete()
            User.query.delete()
            Admin.query.delete()
            ClassInfo.query.delete()
            db.session.commit()

            checker = DataConsistencyChecker()
            report = checker.generate_report()

            assert isinstance(report, str)
            assert "Data Consistency Check Report" in report
            assert "Total Issues: 0" in report
            assert "Status: HEALTHY" in report

    def test_check_user_class_consistency_with_unlinked_users(self, app):
        """测试未关联用户的班级一致性检查"""

        with app.app_context():
            user = User(
                name="测试用户", card_id="TEST001", class_name="测试班级", class_info_id=None
            )
            db.session.add(user)
            db.session.commit()

            checker = DataConsistencyChecker()
            issues = checker.check_user_class_consistency()

            assert isinstance(issues, list)
            assert len(issues) >= 1
            issue_types = [i["type"] for i in issues]
            assert "user_unlinked" in issue_types

    def test_check_user_class_consistency_with_mismatched_users(self, app):
        """测试班级名称不匹配的用户一致性检查"""

        with app.app_context():
            class_info = ClassInfo(name="实际班级", is_active=True)
            db.session.add(class_info)
            db.session.commit()

            user = User(
                name="测试用户",
                card_id="TEST002",
                class_name="测试班级",
                class_info_id=class_info.id,
            )
            db.session.add(user)
            db.session.commit()

            checker = DataConsistencyChecker()
            issues = checker.check_user_class_consistency()

            assert isinstance(issues, list)
            issue_types = [i["type"] for i in issues]
            assert "user_class_mismatch" in issue_types

    def test_check_user_class_consistency_with_invalid_fk(self, app):
        """测试无效外键用户的一致性检查"""

        with app.app_context():
            user = User(
                name="测试用户", card_id="TEST003", class_name="测试班级", class_info_id=99999
            )
            db.session.add(user)
            db.session.commit()

            checker = DataConsistencyChecker()
            issues = checker.check_user_class_consistency()

            assert isinstance(issues, list)
            issue_types = [i["type"] for i in issues]
            assert "user_invalid_fk" in issue_types

    def test_check_admin_class_consistency_with_unlinked_admins(self, app):
        """测试未关联管理员的班级一致性检查"""
        from utils.security import hash_password

        with app.app_context():
            admin = Admin(
                username=f"test_admin_{uuid.uuid4()}",
                password=hash_password("password"),
                real_name="测试管理员",
                class_name="测试班级",
                primary_class_id=None,
            )
            db.session.add(admin)
            db.session.commit()

            checker = DataConsistencyChecker()
            issues = checker.check_admin_class_consistency()

            assert isinstance(issues, list)
            issue_types = [i["type"] for i in issues]
            assert "admin_unlinked" in issue_types

    def test_check_admin_class_links_with_invalid_admin(self, app):
        """测试无效管理员的AdminClass关联检查"""

        with app.app_context():
            admin_class = AdminClass(admin_id=99999, class_info_id=1, is_primary=True)
            db.session.add(admin_class)
            db.session.commit()

            checker = DataConsistencyChecker()
            issues = checker.check_admin_class_links()

            assert isinstance(issues, list)
            issue_types = [i["type"] for i in issues]
            assert "admin_class_invalid_admin" in issue_types

    def test_check_admin_class_links_with_invalid_class(self, app):
        """测试无效班级的AdminClass关联检查"""

        with app.app_context():
            admin = Admin(
                username="test_admin2", password=hash_password("password"), real_name="测试管理员2"
            )
            db.session.add(admin)
            db.session.commit()

            admin_class = AdminClass(admin_id=admin.id, class_info_id=99999, is_primary=True)
            db.session.add(admin_class)
            db.session.commit()

            checker = DataConsistencyChecker()
            issues = checker.check_admin_class_links()

            assert isinstance(issues, list)
            issue_types = [i["type"] for i in issues]
            assert "admin_class_invalid_class" in issue_types

    def test_check_admin_class_links_with_multiple_primary(self, app):
        """测试多个主班级的管理员检查"""

        with app.app_context():
            admin = Admin(
                username="test_admin3", password=hash_password("password"), real_name="测试管理员3"
            )
            class1 = ClassInfo(name="班级1", is_active=True)
            class2 = ClassInfo(name="班级2", is_active=True)

            db.session.add_all([admin, class1, class2])
            db.session.commit()

            admin_class1 = AdminClass(admin_id=admin.id, class_info_id=class1.id, is_primary=True)
            admin_class2 = AdminClass(admin_id=admin.id, class_info_id=class2.id, is_primary=True)

            db.session.add_all([admin_class1, admin_class2])
            db.session.commit()

            checker = DataConsistencyChecker()
            issues = checker.check_admin_class_links()

            assert isinstance(issues, list)
            issue_types = [i["type"] for i in issues]
            assert "admin_multiple_primary" in issue_types

    def test_check_course_schedule_consistency_with_invalid_class(self, app):
        """测试无效班级的课程表一致性检查"""

        with app.app_context():
            schedule = CourseSchedule(
                class_info_id=99999, subject_id=1, day_of_week=1, period_number=1
            )
            db.session.add(schedule)
            db.session.commit()

            checker = DataConsistencyChecker()
            issues = checker.check_course_schedule_consistency()

            assert isinstance(issues, list)
            issue_types = [i["type"] for i in issues]
            assert "schedule_invalid_class" in issue_types

    def test_check_course_schedule_consistency_with_invalid_subject(self, app):
        """测试无效科目的课程表一致性检查"""

        with app.app_context():
            class_info = ClassInfo(name=f"测试班级_{uuid.uuid4()}", is_active=True)
            db.session.add(class_info)
            db.session.commit()

            schedule = CourseSchedule(
                class_info_id=class_info.id, subject_id=99999, day_of_week=1, period_number=1
            )
            db.session.add(schedule)
            db.session.commit()

            checker = DataConsistencyChecker()
            issues = checker.check_course_schedule_consistency()

            assert isinstance(issues, list)
            issue_types = [i["type"] for i in issues]
            assert "schedule_invalid_subject" in issue_types

    def test_check_orphaned_classes_with_orphaned(self, app):
        """测试孤立班级检查"""

        with app.app_context():
            class_info = ClassInfo(name="孤立班级", is_active=True)
            db.session.add(class_info)
            db.session.commit()

            checker = DataConsistencyChecker()
            issues = checker.check_orphaned_classes()

            assert isinstance(issues, list)
            assert len(issues) >= 1
            issue_types = [i["type"] for i in issues]
            assert "orphaned_class" in issue_types

    def test_generate_report_with_issues(self, app):
        """测试生成包含问题的报告"""

        with app.app_context():
            AdminClass.query.delete()
            CourseSchedule.query.delete()
            User.query.delete()
            Admin.query.delete()
            ClassInfo.query.delete()
            db.session.commit()

            user = User(
                name="测试用户",
                card_id=f"TEST004_{uuid.uuid4()}",
                class_name="测试班级",
                class_info_id=None,
            )
            db.session.add(user)
            db.session.commit()

            checker = DataConsistencyChecker()
            report = checker.generate_report()

            assert isinstance(report, str)
            assert "Data Consistency Check Report" in report
            assert "Total Issues: 1" in report
            assert "Status: ISSUES FOUND" in report
            assert "[WARNING]" in report

    def test_severity_icons_in_report(self, app):
        """测试报告中的严重程度图标"""

        with app.app_context():
            user = User(
                name="测试用户", card_id="TEST005", class_name="测试班级", class_info_id=99999
            )
            db.session.add(user)
            db.session.commit()

            checker = DataConsistencyChecker()
            report = checker.generate_report()

            assert "[CRITICAL]" in report
