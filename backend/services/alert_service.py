#!/usr/bin/env python3
"""
告警通知服务 - 处理系统告警和通知
"""

import time
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from models import db, Alert
from utils.logger import log_info, log_error

class AlertService:
    """告警服务类"""
    
    def __init__(self):
        # 告警级别
        self.SEVERITY_LEVELS = {
            'info': {'label': '信息', 'color': '#17a2b8'},
            'warning': {'label': '警告', 'color': '#ffc107'},
            'error': {'label': '错误', 'color': '#dc3545'},
            'critical': {'label': '严重', 'color': '#721c24'}
        }
        
        # 告警类型
        self.ALERT_TYPES = {
            'device_offline': {'label': '设备离线', 'level': 'warning'},
            'device_online': {'label': '设备上线', 'level': 'info'},
            'score_abnormal': {'label': '积分异常', 'level': 'error'},
            'score_threshold': {'label': '积分阈值', 'level': 'warning'},
            'system_error': {'label': '系统错误', 'level': 'error'},
            'system_warning': {'label': '系统警告', 'level': 'warning'},
            'backup_failure': {'label': '备份失败', 'level': 'error'},
            'mqtt_disconnect': {'label': 'MQTT断开', 'level': 'warning'},
            'cache_miss': {'label': '缓存失效', 'level': 'info'},
            'high_memory': {'label': '内存过高', 'level': 'warning'},
            'high_cpu': {'label': 'CPU过高', 'level': 'warning'}
        }
        
        # 告警抑制时间（同一类型告警的最小间隔时间，秒）
        self.alert_suppression = {
            'device_offline': 300,  # 5分钟
            'device_online': 60,    # 1分钟
            'score_abnormal': 180,  # 3分钟
            'score_threshold': 600, # 10分钟
            'system_error': 60,     # 1分钟
            'system_warning': 300,  # 5分钟
            'backup_failure': 3600, # 1小时
            'mqtt_disconnect': 60,  # 1分钟
            'cache_miss': 300,      # 5分钟
            'high_memory': 600,     # 10分钟
            'high_cpu': 600         # 10分钟
        }
        
        # 记录最近告警时间，用于抑制重复告警
        self.last_alert_time = {}
    
    def _get_severity(self, alert_type: str) -> str:
        """获取告警级别"""
        return self.ALERT_TYPES.get(alert_type, {}).get('level', 'info')
    
    def _should_suppress(self, alert_type: str, device_id: Optional[str] = None) -> bool:
        """检查是否应该抑制该告警"""
        key = f"{alert_type}:{device_id}" if device_id else alert_type
        last_time = self.last_alert_time.get(key, 0)
        suppression_time = self.alert_suppression.get(alert_type, 60)
        
        if time.time() - last_time < suppression_time:
            return True
        return False
    
    def _update_last_alert_time(self, alert_type: str, device_id: Optional[str] = None):
        """更新最后告警时间"""
        key = f"{alert_type}:{device_id}" if device_id else alert_type
        self.last_alert_time[key] = time.time()
    
    def create_alert(self, alert_type: str, message: str, device_id: Optional[str] = None, 
                     device_name: Optional[str] = None, extra_data: Optional[Dict] = None,
                     suppress: bool = True) -> Alert:
        """
        创建告警
        
        Args:
            alert_type: 告警类型
            message: 告警消息
            device_id: 设备ID（可选）
            device_name: 设备名称（可选）
            extra_data: 额外数据（可选）
            suppress: 是否启用告警抑制
        
        Returns:
            创建的告警对象
        """
        # 检查是否需要抑制
        if suppress and self._should_suppress(alert_type, device_id):
            log_info(f"告警被抑制: {alert_type} - {message}")
            return None
        
        severity = self._get_severity(alert_type)
        alert_label = self.ALERT_TYPES.get(alert_type, {}).get('label', alert_type)
        
        alert = Alert(
            alert_type=alert_type,
            severity=severity,
            message=message,
            device_id=device_id,
            device_name=device_name,
            extra_data=extra_data,
            is_read=False
        )
        
        try:
            db.session.add(alert)
            db.session.commit()
            
            # 更新最后告警时间
            self._update_last_alert_time(alert_type, device_id)
            
            log_info(f"告警已创建: [{severity.upper()}] {alert_label} - {message}")
            
            # 触发通知（可以扩展为邮件、短信等）
            self._trigger_notification(alert)
            
            return alert
        except Exception as e:
            log_error(f"创建告警失败: {e}")
            db.session.rollback()
            return None
    
    def _trigger_notification(self, alert: Alert):
        """触发告警通知（可扩展）"""
        # 可以在这里添加邮件通知、短信通知、Webhook等
        # 当前仅记录日志
        log_info(f"触发告警通知: [{alert.severity}] {alert.alert_type} - {alert.message}")
    
    def get_alerts(self, limit: int = 50, offset: int = 0, severity: Optional[str] = None,
                   is_read: Optional[bool] = None, alert_type: Optional[str] = None) -> List[Alert]:
        """
        获取告警列表
        
        Args:
            limit: 每页数量
            offset: 偏移量
            severity: 告警级别过滤
            is_read: 是否已读过滤
            alert_type: 告警类型过滤
        
        Returns:
            告警列表
        """
        query = Alert.query.order_by(Alert.created_at.desc())
        
        if severity:
            query = query.filter(Alert.severity == severity)
        
        if is_read is not None:
            query = query.filter(Alert.is_read == is_read)
        
        if alert_type:
            query = query.filter(Alert.alert_type == alert_type)
        
        return query.offset(offset).limit(limit).all()
    
    def get_alert_by_id(self, alert_id: int) -> Optional[Alert]:
        """根据ID获取告警"""
        return Alert.query.get(alert_id)
    
    def mark_as_read(self, alert_id: int) -> bool:
        """标记告警为已读"""
        alert = Alert.query.get(alert_id)
        if alert:
            alert.is_read = True
            alert.read_at = datetime.now()
            try:
                db.session.commit()
                return True
            except Exception as e:
                log_error(f"标记告警已读失败: {e}")
                db.session.rollback()
        return False
    
    def mark_all_as_read(self) -> int:
        """标记所有告警为已读"""
        try:
            count = Alert.query.filter(Alert.is_read == False).update({'is_read': True, 'read_at': datetime.now()})
            db.session.commit()
            return count
        except Exception as e:
            log_error(f"标记所有告警已读失败: {e}")
            db.session.rollback()
            return 0
    
    def delete_alert(self, alert_id: int) -> bool:
        """删除告警"""
        alert = Alert.query.get(alert_id)
        if alert:
            try:
                db.session.delete(alert)
                db.session.commit()
                return True
            except Exception as e:
                log_error(f"删除告警失败: {e}")
                db.session.rollback()
        return False
    
    def delete_old_alerts(self, days: int = 7) -> int:
        """删除指定天数之前的告警"""
        cutoff_date = datetime.now() - timedelta(days=days)
        try:
            count = Alert.query.filter(Alert.created_at < cutoff_date).delete()
            db.session.commit()
            log_info(f"删除了 {count} 条过期告警")
            return count
        except Exception as e:
            log_error(f"删除过期告警失败: {e}")
            db.session.rollback()
            return 0
    
    def get_alert_stats(self) -> Dict[str, Any]:
        """获取告警统计信息"""
        try:
            # 总告警数
            total = Alert.query.count()
            
            # 未读告警数
            unread = Alert.query.filter(Alert.is_read == False).count()
            
            # 按级别统计
            severity_stats = {}
            for severity in self.SEVERITY_LEVELS.keys():
                count = Alert.query.filter(Alert.severity == severity).count()
                severity_stats[severity] = count
            
            # 今日告警数
            today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            today_count = Alert.query.filter(Alert.created_at >= today).count()
            
            return {
                'total': total,
                'unread': unread,
                'by_severity': severity_stats,
                'today_count': today_count
            }
        except Exception as e:
            log_error(f"获取告警统计失败: {e}")
            return {}
    
    def trigger_device_offline_alert(self, device_id: str, device_name: str):
        """触发设备离线告警"""
        message = f"设备离线: {device_name} ({device_id})"
        return self.create_alert('device_offline', message, device_id, device_name)
    
    def trigger_device_online_alert(self, device_id: str, device_name: str):
        """触发设备上线告警"""
        message = f"设备上线: {device_name} ({device_id})"
        return self.create_alert('device_online', message, device_id, device_name)
    
    def trigger_score_abnormal_alert(self, user_id: int, user_name: str, score: int, reason: str):
        """触发积分异常告警"""
        message = f"积分异常: 用户 {user_name} (ID:{user_id}) 积分 {score}，原因: {reason}"
        extra_data = {'user_id': user_id, 'user_name': user_name, 'score': score, 'reason': reason}
        return self.create_alert('score_abnormal', message, extra_data=extra_data)
    
    def trigger_score_threshold_alert(self, user_id: int, user_name: str, score: int, threshold_type: str):
        """触发积分阈值告警"""
        message = f"积分阈值告警: 用户 {user_name} (ID:{user_id}) 积分 {score}，{threshold_type}"
        extra_data = {'user_id': user_id, 'user_name': user_name, 'score': score, 'threshold_type': threshold_type}
        return self.create_alert('score_threshold', message, extra_data=extra_data)
    
    def trigger_system_error_alert(self, error_message: str, error_type: str = 'unknown'):
        """触发系统错误告警"""
        message = f"系统错误: {error_type} - {error_message}"
        extra_data = {'error_type': error_type, 'error_message': error_message}
        return self.create_alert('system_error', message, extra_data=extra_data)
    
    def trigger_system_warning_alert(self, warning_message: str):
        """触发系统警告告警"""
        message = f"系统警告: {warning_message}"
        return self.create_alert('system_warning', message)
    
    def trigger_backup_failure_alert(self, backup_type: str, error_message: str):
        """触发备份失败告警"""
        message = f"备份失败: {backup_type} - {error_message}"
        extra_data = {'backup_type': backup_type, 'error_message': error_message}
        return self.create_alert('backup_failure', message, extra_data=extra_data)
    
    def trigger_mqtt_disconnect_alert(self, client_id: str):
        """触发MQTT断开告警"""
        message = f"MQTT连接断开: {client_id}"
        return self.create_alert('mqtt_disconnect', message, device_id=client_id)
    
    def trigger_high_memory_alert(self, memory_percent: float):
        """触发内存过高告警"""
        message = f"内存使用率过高: {memory_percent:.1f}%"
        extra_data = {'memory_percent': memory_percent}
        return self.create_alert('high_memory', message, extra_data=extra_data)
    
    def trigger_high_cpu_alert(self, cpu_percent: float):
        """触发CPU过高告警"""
        message = f"CPU使用率过高: {cpu_percent:.1f}%"
        extra_data = {'cpu_percent': cpu_percent}
        return self.create_alert('high_cpu', message, extra_data=extra_data)

# 创建全局告警服务实例
alert_service = AlertService()