# -*- coding: utf-8 -*-
"""
上课时间管理测试模块
"""

import sys
import os
from datetime import datetime, time

# 添加父目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from class_schedule import ClassScheduleManager


def test_load_schedule():
    """测试加载日程配置"""
    manager = ClassScheduleManager()
    
    assert manager.schedule is not None, "日程配置应不为空"
    assert 'class_periods' in manager.schedule, "应有class_periods字段"
    print("[PASS]test_load_schedule 通过")


def test_is_now_class_time():
    """测试上课时间检测"""
    manager = ClassScheduleManager()
    
    # 测试当前时间是否在上课时间段内
    result = manager.is_now_class_time()
    assert isinstance(result, bool), "返回值应为布尔类型"
    print(f"[PASS]test_is_now_class_time 通过 (当前是否上课: {result})")


def test_get_current_period():
    """测试获取当前节次"""
    manager = ClassScheduleManager()
    
    period = manager.get_current_period()
    # 可能为None（课间）或节次名称
    assert period is None or isinstance(period, str), "返回值应为None或字符串"
    print(f"[PASS]test_get_current_period 通过 (当前节次: {period})")


def test_get_display_mode():
    """测试获取显示模式"""
    manager = ClassScheduleManager()
    
    mode = manager.get_display_mode()
    assert mode in ['banner', 'popup', 'fullscreen'], "显示模式应在允许范围内"
    print(f"[PASS]test_get_display_mode 通过 (显示模式: {mode})")


def test_should_silent_urgent():
    """测试紧急通知是否静音"""
    manager = ClassScheduleManager()
    
    silent = manager.should_silent_urgent()
    assert isinstance(silent, bool), "返回值应为布尔类型"
    print(f"[PASS]test_should_silent_urgent 通过 (是否静音: {silent})")


def test_get_notification_strategy():
    """测试获取通知策略"""
    manager = ClassScheduleManager()
    
    strategy = manager.get_notification_strategy()
    
    assert 'during_class' in strategy, "策略应有during_class字段"
    assert 'between_classes' in strategy, "策略应有between_classes字段"
    assert 'after_hours' in strategy, "策略应有after_hours字段"
    print(f"[PASS]test_get_notification_strategy 通过")


def test_get_today_periods():
    """测试获取今天的课程表"""
    manager = ClassScheduleManager()
    
    periods = manager._get_today_periods()
    assert isinstance(periods, list), "返回值应为列表"
    print(f"[PASS]test_get_today_periods 通过 (当前有{len(periods)}个时间段)")


def test_add_holiday():
    """测试添加节假日"""
    manager = ClassScheduleManager()
    
    # 添加一个测试节假日
    test_date = '2026-12-25'
    result = manager.add_holiday(test_date)
    
    assert result is True, "添加节假日应返回True"
    assert test_date in manager.schedule.get('holidays', []), "节假日应被添加"
    print("[PASS]test_add_holiday 通过")


def test_add_vacation():
    """测试添加假期"""
    manager = ClassScheduleManager()
    
    start_date = '2026-07-01'
    end_date = '2026-08-31'
    result = manager.add_vacation(start_date, end_date)
    
    assert result is True, "添加假期应返回True"
    print("[PASS]test_add_vacation 通过")


def test_invalid_date():
    """测试无效日期格式"""
    manager = ClassScheduleManager()
    
    # 无效日期格式应返回False
    result = manager.add_holiday('invalid-date')
    assert result is False, "无效日期应返回False"
    
    result = manager.add_vacation('invalid', 'date')
    assert result is False, "无效假期应返回False"
    
    print("[PASS]test_invalid_date 通过")


def test_get_instance():
    """测试单例模式"""
    from class_schedule import get_instance
    
    instance1 = get_instance()
    instance2 = get_instance()
    
    assert instance1 is instance2, "应返回同一个实例"
    print("[PASS]test_get_instance 通过")


if __name__ == '__main__':
    print("=" * 50)
    print("上课时间管理测试")
    print("=" * 50)
    
    test_load_schedule()
    test_is_now_class_time()
    test_get_current_period()
    test_get_display_mode()
    test_should_silent_urgent()
    test_get_notification_strategy()
    test_get_today_periods()
    test_add_holiday()
    test_add_vacation()
    test_invalid_date()
    test_get_instance()
    
    print("=" * 50)
    print("所有测试通过！")
    print("=" * 50)
