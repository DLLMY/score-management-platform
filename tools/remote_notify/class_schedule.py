# -*- coding: utf-8 -*-
"""
上课时间管理模块

功能：
- 管理课程时间表
- 检测当前是否处于上课时间
- 支持工作日/周末/节假日配置

作者：开发团队
日期：2026-06-18
"""

import json
import os
from datetime import datetime, time, timedelta
from typing import Optional, Dict, List


class ClassScheduleManager:
    """上课时间管理器"""
    
    def __init__(self, config_path: str = 'class_schedule.json'):
        """
        初始化上课时间管理器
        
        Args:
            config_path: 配置文件路径
        """
        self.config_path = config_path
        self.schedule = self._load_schedule()
        self.is_class_time = False
        self.current_class = None
        
    def _load_schedule(self) -> Dict:
        """加载日程配置"""
        default_schedule = {
            'version': '1.0',
            'schedule_type': 'weekday',
            'class_periods': [
                {'name': '早读', 'start': '07:30', 'end': '08:00'},
                {'name': '第一节', 'start': '08:00', 'end': '08:45'},
                {'name': '第二节', 'start': '08:55', 'end': '09:40'},
                {'name': '大课间', 'start': '09:40', 'end': '10:00'},
                {'name': '第三节', 'start': '10:00', 'end': '10:45'},
                {'name': '第四节', 'start': '10:55', 'end': '11:40'},
                {'name': '午休', 'start': '11:40', 'end': '14:00'},
                {'name': '第五节', 'start': '14:00', 'end': '14:45'},
                {'name': '第六节', 'start': '14:55', 'end': '15:40'},
                {'name': '眼保健操', 'start': '15:40', 'end': '16:00'},
                {'name': '第七节', 'start': '16:00', 'end': '16:45'},
                {'name': '第八节', 'start': '16:55', 'end': '17:40'},
                {'name': '晚自习', 'start': '19:00', 'end': '21:00'},
            ],
            'weekend_schedules': {
                'saturday': [
                    {'name': '早自习', 'start': '07:30', 'end': '08:00'},
                    {'name': '第一节', 'start': '08:10', 'end': '08:55'},
                    {'name': '第二节', 'start': '09:05', 'end': '09:50'},
                    {'name': '第三节', 'start': '10:00', 'end': '10:45'},
                    {'name': '第四节', 'start': '10:55', 'end': '11:40'},
                ],
                'sunday': [
                    {'name': '早自习', 'start': '07:30', 'end': '08:00'},
                    {'name': '第一节', 'start': '08:10', 'end': '08:55'},
                    {'name': '第二节', 'start': '09:05', 'end': '09:50'},
                    {'name': '第三节', 'start': '10:00', 'end': '10:45'},
                    {'name': '第四节', 'start': '10:55', 'end': '11:40'},
                    {'name': '晚自习', 'start': '19:00', 'end': '21:00'},
                ]
            },
            'holidays': [],  # 节假日列表，格式：['2026-01-01', '2026-02-10']
            'vacations': [],  # 假期列表，格式：['2026-07-01', '2026-08-31']
            'notification_strategy': {
                'during_class': 'banner',      # 上课时：横幅
                'between_classes': 'popup',     # 课间：弹窗
                'after_hours': 'fullscreen',    # 放学后：全屏
                'silent_urgent': True           # 上课时紧急通知静音
            }
        }
        
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    loaded = json.load(f)
                    # 合并默认配置和加载的配置
                    for key in default_schedule:
                        if key not in loaded:
                            loaded[key] = default_schedule[key]
                    return loaded
            except Exception as e:
                print(f"[上课时间] 加载配置失败: {e}")
                return default_schedule
        else:
            self.save_schedule(default_schedule)
            return default_schedule
        
    def save_schedule(self, schedule: Dict = None):
        """保存日程配置"""
        data = schedule if schedule is not None else self.schedule
        try:
            with open(self.config_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"[上课时间] 保存配置失败: {e}")
            return False
            
    def is_now_class_time(self) -> bool:
        """
        检查当前是否处于上课时间
        
        Returns:
            bool: True-上课中，False-非上课时间
        """
        now = datetime.now()
        today_str = now.strftime('%Y-%m-%d')
        
        # 检查是否假期
        if self._is_vacation(now):
            self.is_class_time = False
            self.current_class = None
            return False
            
        # 检查是否节假日
        if today_str in self.schedule.get('holidays', []):
            self.is_class_time = False
            self.current_class = None
            return False
            
        # 获取当前时间段的课程表
        periods = self._get_today_periods()
        
        # 检查是否在上课时间
        current_time = now.time()
        for period in periods:
            try:
                start = datetime.strptime(period['start'], '%H:%M').time()
                end = datetime.strptime(period['end'], '%H:%M').time()
                
                # 处理跨天情况（如晚自习）
                if start <= current_time <= end:
                    self.is_class_time = True
                    self.current_class = period['name']
                    return True
            except ValueError:
                continue
                
        self.is_class_time = False
        self.current_class = None
        return False
        
    def _get_today_periods(self) -> List[Dict]:
        """获取今天的课程时间段"""
        now = datetime.now()
        weekday = now.weekday()  # 0=周一, 6=周日
        
        if weekday < 5:  # 工作日
            return self.schedule.get('class_periods', [])
        elif weekday == 5:  # 周六
            return self.schedule.get('weekend_schedules', {}).get('saturday', [])
        elif weekday == 6:  # 周日
            return self.schedule.get('weekend_schedules', {}).get('sunday', [])
        else:
            return []
            
    def _is_vacation(self, dt: datetime) -> bool:
        """检查是否在假期中"""
        today = dt.date()
        vacations = self.schedule.get('vacations', [])
        
        for vacation in vacations:
            if isinstance(vacation, list) and len(vacation) >= 2:
                try:
                    start = datetime.strptime(vacation[0], '%Y-%m-%d').date()
                    end = datetime.strptime(vacation[1], '%Y-%m-%d').date()
                    if start <= today <= end:
                        return True
                except ValueError:
                    continue
        return False
        
    def get_current_period(self) -> Optional[str]:
        """获取当前课程节次名称"""
        if self.is_now_class_time():
            return self.current_class
        return None
        
    def get_next_period(self) -> Optional[Dict]:
        """获取下一节课信息"""
        now = datetime.now()
        current_time = now.time()
        periods = self._get_today_periods()
        
        for period in periods:
            try:
                start = datetime.strptime(period['start'], '%H:%M').time()
                if start > current_time:
                    # 计算距离下一节课的时间
                    start_dt = datetime.combine(now.date(), start)
                    diff = start_dt - now
                    minutes = int(diff.total_seconds() / 60)
                    return {
                        'name': period['name'],
                        'start': period['start'],
                        'minutes_until': minutes
                    }
            except ValueError:
                continue
        return None
        
    def get_notification_strategy(self) -> Dict:
        """获取通知策略配置"""
        return self.schedule.get('notification_strategy', {
            'during_class': 'banner',
            'between_classes': 'popup',
            'after_hours': 'fullscreen',
            'silent_urgent': True
        })
        
    def should_silent_urgent(self) -> bool:
        """检查紧急通知是否应静音"""
        strategy = self.get_notification_strategy()
        if strategy.get('silent_urgent', False) and self.is_now_class_time():
            return True
        return False
        
    def get_display_mode(self) -> str:
        """
        获取当前应使用的通知显示模式
        
        Returns:
            str: 'banner'-横幅, 'popup'-弹窗, 'fullscreen'-全屏
        """
        if self.is_now_class_time():
            return self.schedule.get('notification_strategy', {}).get('during_class', 'banner')
        
        # 检查是否课间（下一节课开始前10分钟）
        next_period = self.get_next_period()
        if next_period and next_period.get('minutes_until', 999) <= 10:
            return self.schedule.get('notification_strategy', {}).get('between_classes', 'popup')
        
        return self.schedule.get('notification_strategy', {}).get('after_hours', 'fullscreen')
        
    def set_class_period(self, index: int, name: str, start: str, end: str) -> bool:
        """设置课程时间段"""
        try:
            # 验证时间格式
            datetime.strptime(start, '%H:%M')
            datetime.strptime(end, '%H:%M')
            
            periods = self.schedule.get('class_periods', [])
            if 0 <= index < len(periods):
                periods[index] = {'name': name, 'start': start, 'end': end}
                self.schedule['class_periods'] = periods
                self.save_schedule()
                return True
        except ValueError:
            pass
        return False
        
    def add_holiday(self, date_str: str) -> bool:
        """添加节假日"""
        try:
            datetime.strptime(date_str, '%Y-%m-%d')
            if 'holidays' not in self.schedule:
                self.schedule['holidays'] = []
            if date_str not in self.schedule['holidays']:
                self.schedule['holidays'].append(date_str)
                self.schedule['holidays'].sort()
                self.save_schedule()
            return True
        except ValueError:
            return False
            
    def add_vacation(self, start_date: str, end_date: str) -> bool:
        """添加假期"""
        try:
            datetime.strptime(start_date, '%Y-%m-%d')
            datetime.strptime(end_date, '%Y-%m-%d')
            if 'vacations' not in self.schedule:
                self.schedule['vacations'] = []
            self.schedule['vacations'].append([start_date, end_date])
            self.save_schedule()
            return True
        except ValueError:
            return False


# 单例模式
_instance = None
_lock = None

def get_instance():
    """获取上课时间管理器单例"""
    global _instance, _lock
    if _instance is None:
        import threading
        _lock = threading.Lock()
        with _lock:
            if _instance is None:
                _instance = ClassScheduleManager()
    return _instance


# 测试代码
if __name__ == '__main__':
    print("测试上课时间管理器...")
    
    manager = ClassScheduleManager()
    
    # 测试当前状态
    print(f"当前是否上课: {manager.is_now_class_time()}")
    print(f"当前节次: {manager.get_current_period()}")
    print(f"通知显示模式: {manager.get_display_mode()}")
    print(f"紧急通知静音: {manager.should_silent_urgent()}")
    
    # 测试下一节课
    next_period = manager.get_next_period()
    if next_period:
        print(f"下一节: {next_period['name']}, 开始时间: {next_period['start']}, "
              f"还有 {next_period['minutes_until']} 分钟")
    
    print("\n配置文件已保存到 class_schedule.json")
