from models import TimeRule, CourseSchedule, ClassPeriod, User
from datetime import datetime
from typing import Optional, Dict, Tuple
import json


class ClassTimeChecker:
    """
    上课时间检查器
    用于判断当前时间是否处于上课时间，以及获取课程时间表信息。

    拦截层级（优先级从高到低）：
    1. force_send=True 且调用方有权限 -> 放行（写 FORCE 审计）
    2. 全局 TimeRule（全校时段规则，如调休/考试特例）命中 -> 拦截（GLOBAL_TIME_RULE）
    3. 按班级课表反查（course_schedules + class_periods）：该班此刻在第几节且有课（含自习） -> 拦截（CLASS_IN_SESSION）
    4. 否则放行
    """

    @staticmethod
    def is_during_class_time(
        check_time: Optional[datetime] = None,
    ) -> Tuple[bool, Optional[Dict]]:
        """
        判断当前时间是否处于 TimeRule 定义的全局上课时段

        Returns:
            Tuple[是否在上课时间, 匹配的规则信息]
        """
        if check_time is None:
            check_time = datetime.now()

        current_day = check_time.weekday()
        current_hour = check_time.hour
        current_minute = check_time.minute
        current_total_minutes = current_hour * 60 + current_minute

        active_rules = TimeRule.query.filter_by(is_active=True).all()

        for rule in active_rules:
            if rule.day_of_week != -1 and rule.day_of_week != current_day:
                continue

            start_total_minutes = rule.start_hour * 60 + rule.start_minute
            end_total_minutes = rule.end_hour * 60 + rule.end_minute

            if start_total_minutes <= current_total_minutes <= end_total_minutes:
                return True, {
                    "id": rule.id,
                    "name": rule.name,
                    "description": rule.description,
                    "day_of_week": rule.day_of_week,
                    "start_hour": rule.start_hour,
                    "start_minute": rule.start_minute,
                    "end_hour": rule.end_hour,
                    "end_minute": rule.end_minute,
                }

        return False, None

    @staticmethod
    def _current_period(check_time: datetime):
        """返回当前时间落在的节次（ClassPeriod），课间/放学返回 None"""
        total = check_time.hour * 60 + check_time.minute
        periods = ClassPeriod.query.filter_by(is_active=True).all()
        for p in periods:
            start = p.start_hour * 60 + p.start_minute
            end = p.end_hour * 60 + p.end_minute
            if start <= total <= end:
                return p
        return None

    @staticmethod
    def check_class_in_session(
        class_info_id: Optional[int],
        check_time: Optional[datetime] = None,
    ) -> Tuple[bool, Optional[Dict]]:
        """
        判断指定班级此刻是否正在上课（含自习）

        判定：当前时间落在某个节次时间窗内，且该班当天的该节次在 course_schedules 有记录即视为上课。
        课表空格（无记录）-> 不拦；课间/放学（不在任何节次窗）-> 不拦。

        Returns:
            Tuple[是否在上课, 课程信息 dict]
        """
        if not class_info_id:
            return False, None
        if check_time is None:
            check_time = datetime.now()

        period = ClassTimeChecker._current_period(check_time)
        if period is None:
            return False, None  # 课间 / 放学后

        day = check_time.weekday()
        sched = CourseSchedule.query.filter_by(
            class_info_id=class_info_id,
            day_of_week=day,
            period_number=period.period_number,
            is_active=True,
        ).first()
        if sched is None:
            return False, None  # 该班此节无课 -> 放行

        subject_name = sched.subject.name if sched.subject else "自习"
        class_name = sched.class_info.name if sched.class_info else ""
        info = {
            "class_info_id": class_info_id,
            "class_name": class_name,
            "period_number": period.period_number,
            "period_name": period.name,
            "subject_name": subject_name,
            "start_time": f"{period.start_hour:02d}:{period.start_minute:02d}",
            "end_time": f"{period.end_hour:02d}:{period.end_minute:02d}",
            "day_of_week": day,
        }
        return True, info

    @staticmethod
    def any_class_in_session(check_time: Optional[datetime] = None) -> bool:
        """是否有任意班级此刻正在上课（用于广播类下发）"""
        if check_time is None:
            check_time = datetime.now()
        period = ClassTimeChecker._current_period(check_time)
        if period is None:
            return False
        day = check_time.weekday()
        cnt = CourseSchedule.query.filter_by(
            day_of_week=day, period_number=period.period_number, is_active=True
        ).count()
        return cnt > 0

    @staticmethod
    def resolve_class_info_id(
        target_class_info_id: Optional[int] = None,
        target_user_id: Optional[int] = None,
    ) -> Optional[int]:
        """解析目标班级 ID：优先直接用传入的班级，否则从用户反查"""
        if target_class_info_id:
            return target_class_info_id
        if target_user_id:
            user = User.query.get(target_user_id)
            if user and user.class_info_id:
                return user.class_info_id
        return None

    @staticmethod
    def is_notification_allowed(
        target_class_info_id: Optional[int] = None,
        target_user_id: Optional[int] = None,
        force_send: bool = False,
    ) -> Tuple[bool, str, Optional[str], Optional[Dict]]:
        """
        判断是否允许发送通知 / 下发

        Args:
            target_class_info_id: 目标班级 ID（精确按班拦截）
            target_user_id: 目标学生 ID（用于反查班级）
            force_send: 强制发送（需 notification.force_send 权限，由调用方校验）

        Returns:
            Tuple[是否允许, 提示消息, 拦截码, 规则/课程信息]
            code ∈ {"GLOBAL_TIME_RULE", "CLASS_IN_SESSION", None}
        """
        if force_send:
            return True, "强制发送模式，跳过上课时间检查", None, None

        # 1) 全局 TimeRule 优先
        is_class_time, rule_info = ClassTimeChecker.is_during_class_time()
        if is_class_time:
            name = rule_info.get("name", "未知课程") if rule_info else "未知课程"
            return (
                False,
                f"当前处于上课时间（{name}），系统自动通知已暂停",
                "GLOBAL_TIME_RULE",
                rule_info,
            )

        # 2) 按班级课表反查
        cls_id = ClassTimeChecker.resolve_class_info_id(target_class_info_id, target_user_id)
        if cls_id is not None:
            in_session, info = ClassTimeChecker.check_class_in_session(cls_id)
            if in_session:
                msg = (
                    f"{info['class_name']}正在第{info['period_number']}节"
                    f"《{info['subject_name']}》，系统自动通知已暂停"
                )
                return False, msg, "CLASS_IN_SESSION", info

        return True, "当前不在上课时间，可以发送通知", None, None

    @staticmethod
    def is_broadcast_blocked(
        force_send: bool = False,
    ) -> Tuple[bool, str, Optional[str]]:
        """
        广播类下发是否应被拦截：全局上课时段 或 任意班级在上课 即拦截
        """
        if force_send:
            return False, "强制发送模式，跳过上课时间检查", None
        allowed, msg, code, _ = ClassTimeChecker.is_notification_allowed(force_send=False)
        if not allowed:
            return True, msg, code
        if ClassTimeChecker.any_class_in_session():
            return True, "当前有班级正在上课，广播通知已暂停", "CLASS_IN_SESSION"
        return False, "可以发送", None

    @staticmethod
    def log_notify_audit(
        audit_type: str,
        target_class_id: Optional[int],
        admin_id: Optional[int],
        payload,
        reason_code: str,
        reason_message: str,
        force_send: bool = False,
    ):
        """记录拦截 / 强制发送审计（失败不影响主流程）"""
        try:
            from models import db, NotifyAudit

            if not isinstance(payload, str):
                try:
                    payload = json.dumps(payload, ensure_ascii=False)
                except Exception:
                    payload = str(payload)
            if payload and len(payload) > 2000:
                payload = payload[:2000]

            rec = NotifyAudit(
                type=audit_type,
                target_class_id=target_class_id,
                admin_id=admin_id,
                payload=payload,
                reason_code=reason_code,
                reason_message=reason_message,
                force_send=force_send,
            )
            db.session.add(rec)
            db.session.commit()
        except Exception as e:
            db.session.rollback()  # 失败回滚，防脏 session 污染后续请求
            print(f"[NotifyAudit] 写入失败: {e}")

    @staticmethod
    def get_today_class_schedule() -> Dict:
        """
        获取今日课程时间表

        Returns:
            Dict包含今日所有课程时段
        """
        today = datetime.now()
        today_day = today.weekday()

        active_rules = TimeRule.query.filter_by(is_active=True).all()

        today_classes = []
        all_classes = []

        for rule in active_rules:
            rule_info = {
                "id": rule.id,
                "name": rule.name,
                "description": rule.description,
                "day_of_week": rule.day_of_week,
                "day_of_week_text": ClassTimeChecker._format_day(rule.day_of_week),
                "start_time": f"{rule.start_hour:02d}:{rule.start_minute:02d}",
                "end_time": f"{rule.end_hour:02d}:{rule.end_minute:02d}",
                "is_active": rule.is_active,
            }

            all_classes.append(rule_info)

            if rule.day_of_week == -1 or rule.day_of_week == today_day:
                today_classes.append(rule_info)

        today_classes.sort(key=lambda x: (x["start_time"]))

        return {
            "today": today_classes,
            "all": all_classes,
            "today_date": today.strftime("%Y-%m-%d"),
            "today_day": ClassTimeChecker._format_day(today_day),
            "is_during_class": ClassTimeChecker.is_during_class_time()[0],
        }

    @staticmethod
    def _format_day(day: int) -> str:
        """
        格式化星期几

        Args:
            day: 星期数字（-1=每天, 0=周一~6=周日）

        Returns:
            星期文本
        """
        if day == -1:
            return "每天"
        days = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
        return days[day] if 0 <= day <= 6 else "未知"

    @staticmethod
    def get_next_class() -> Optional[Dict]:
        """
        获取下一节课程信息

        Returns:
            下一节课程信息，如果没有则返回None
        """
        now = datetime.now()
        current_day = now.weekday()
        current_total_minutes = now.hour * 60 + now.minute

        active_rules = TimeRule.query.filter_by(is_active=True).all()

        next_class = None
        min_time_diff = float("inf")

        for rule in active_rules:
            if rule.day_of_week == -1 or rule.day_of_week == current_day:
                start_total_minutes = rule.start_hour * 60 + rule.start_minute

                if start_total_minutes > current_total_minutes:
                    time_diff = start_total_minutes - current_total_minutes
                    if time_diff < min_time_diff:
                        min_time_diff = time_diff
                        next_class = {
                            "id": rule.id,
                            "name": rule.name,
                            "description": rule.description,
                            "start_time": (f"{rule.start_hour:02d}:" f"{rule.start_minute:02d}"),
                            "end_time": (f"{rule.end_hour:02d}:{rule.end_minute:02d}"),
                            "minutes_until": min_time_diff,
                        }

        return next_class


class_time_checker = ClassTimeChecker()
