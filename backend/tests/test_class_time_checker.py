#!/usr/bin/env python3
""" """

# 上课时间检查器测试模块
"""
"""

from datetime import datetime
from services.class_time_checker import ClassTimeChecker


class TestClassTimeChecker:
    """上课时间检查器测试类"""

    def test_is_during_class_time_structure(self, app):
        """测试上课时间检查返回结构"""
        with app.app_context():
            result = ClassTimeChecker.is_during_class_time()

            assert isinstance(result, tuple)
            assert len(result) == 2
            assert isinstance(result[0], bool)
            assert result[1] is None or isinstance(result[1], dict)

    def test_is_during_class_time_with_custom_time(self, app):
        """测试自定义时间检查"""
        with app.app_context():
            custom_time = datetime(2024, 1, 1, 10, 0, 0)
            result = ClassTimeChecker.is_during_class_time(custom_time)

            assert isinstance(result, tuple)
            assert isinstance(result[0], bool)

    def test_is_notification_allowed_force_send(self):
        """测试强制发送通知"""
        result = ClassTimeChecker.is_notification_allowed(force_send=True)

        assert isinstance(result, tuple)
        assert len(result) == 4
        assert result[0] is True
        assert "强制发送" in result[1]
        assert result[2] is None
        assert result[3] is None

    def test_is_notification_allowed_normal(self, app):
        """测试正常通知检查"""
        with app.app_context():
            result = ClassTimeChecker.is_notification_allowed(force_send=False)

            assert isinstance(result, tuple)
            assert len(result) == 4
            assert isinstance(result[0], bool)
            assert isinstance(result[1], str)
            assert result[2] is None or isinstance(result[2], str)
            assert result[3] is None or isinstance(result[3], dict)

    def test_is_notification_allowed_class_in_session(self, app, db_session):
        """测试按班级课表反查命中上课 -> 拦截 CLASS_IN_SESSION（真实 DB 数据）"""
        from datetime import datetime
        from models import ClassPeriod, CourseSchedule, ClassInfo, Subject

        now = datetime.now()
        day = now.weekday()

        # 插入覆盖当前时刻的节次窗口，使 _current_period 命中
        period = ClassPeriod(
            period_number=1,
            name="第1节",
            start_hour=now.hour,
            start_minute=0,
            end_hour=now.hour,
            end_minute=59,
            is_active=True,
        )
        db_session.add(period)
        db_session.commit()

        cls = ClassInfo(name="上课测试班", grade="高一")
        db_session.add(cls)
        db_session.commit()

        subj = Subject(name="数学", is_active=True)
        db_session.add(subj)
        db_session.commit()

        sched = CourseSchedule(
            class_info_id=cls.id,
            subject_id=subj.id,
            day_of_week=day,
            period_number=1,
            is_active=True,
        )
        db_session.add(sched)
        db_session.commit()

        # 当前无 TimeRule -> 全局时段不命中；按课表反查应命中上课
        with app.app_context():
            allowed, msg, code, info = ClassTimeChecker.is_notification_allowed(
                target_class_info_id=cls.id, force_send=False
            )
            assert allowed is False
            assert code == "CLASS_IN_SESSION"
            assert info is not None
            assert info["period_number"] == 1
            assert info["subject_name"] == "数学"

    def test_get_today_class_schedule_structure(self, app):
        """测试获取今日课程表返回结构"""
        with app.app_context():
            result = ClassTimeChecker.get_today_class_schedule()

            assert isinstance(result, dict)
            assert "today" in result
            assert "all" in result
            assert "today_date" in result
            assert "today_day" in result
            assert "is_during_class" in result
            assert isinstance(result["today"], list)
            assert isinstance(result["all"], list)

    def test_format_day(self):
        """测试星期格式化"""
        assert ClassTimeChecker._format_day(-1) == "每天"
        assert ClassTimeChecker._format_day(0) == "周一"
        assert ClassTimeChecker._format_day(1) == "周二"
        assert ClassTimeChecker._format_day(6) == "周日"
        assert ClassTimeChecker._format_day(7) == "未知"
        assert ClassTimeChecker._format_day(-2) == "未知"

    def test_get_next_class_structure(self, app):
        """测试获取下一节课返回结构"""
        with app.app_context():
            result = ClassTimeChecker.get_next_class()

            assert result is None or isinstance(result, dict)

    def test_class_time_checker_methods_exist(self):
        """测试上课时间检查器方法存在性"""
        assert hasattr(ClassTimeChecker, "is_during_class_time")
        assert hasattr(ClassTimeChecker, "is_notification_allowed")
        assert hasattr(ClassTimeChecker, "get_today_class_schedule")
        assert hasattr(ClassTimeChecker, "_format_day")
        assert hasattr(ClassTimeChecker, "get_next_class")
