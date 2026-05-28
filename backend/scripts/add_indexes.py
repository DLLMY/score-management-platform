#!/usr/bin/env python3
"""
数据库索引优化脚本
为高频查询的表添加索引，提升查询性能
"""

import sqlite3
import os

def add_indexes():
    # 获取数据库路径
    db_path = os.path.join(os.path.dirname(__file__), '..', 'instance', 'score_management.db')
    db_path = os.path.abspath(db_path)
    
    if not os.path.exists(db_path):
        print(f"错误: 数据库文件不存在 - {db_path}")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    indexes_to_add = [
        # MQTT日志表 - 经常按主题和时间查询
        ("mqtt_log", "idx_mqtt_log_topic", "CREATE INDEX IF NOT EXISTS idx_mqtt_log_topic ON mqtt_log(topic)"),
        ("mqtt_log", "idx_mqtt_log_timestamp", "CREATE INDEX IF NOT EXISTS idx_mqtt_log_timestamp ON mqtt_log(timestamp)"),
        ("mqtt_log", "idx_mqtt_log_direction", "CREATE INDEX IF NOT EXISTS idx_mqtt_log_direction ON mqtt_log(direction)"),
        
        # 操作日志表 - 经常按类型和时间查询
        ("operation_log", "idx_operation_log_type", "CREATE INDEX IF NOT EXISTS idx_operation_log_type ON operation_log(operation_type)"),
        ("operation_log", "idx_operation_log_target", "CREATE INDEX IF NOT EXISTS idx_operation_log_target ON operation_log(target_type)"),
        ("operation_log", "idx_operation_log_created", "CREATE INDEX IF NOT EXISTS idx_operation_log_created ON operation_log(created_at)"),
        
        # 设备心跳表 - 经常按设备ID查询
        ("device_heartbeat", "idx_device_heartbeat_id", "CREATE INDEX IF NOT EXISTS idx_device_heartbeat_id ON device_heartbeat(device_id)"),
        ("device_heartbeat", "idx_device_heartbeat_received", "CREATE INDEX IF NOT EXISTS idx_device_heartbeat_received ON device_heartbeat(received_at)"),
        
        # 管理员表 - 登录查询
        ("admin", "idx_admin_username", "CREATE INDEX IF NOT EXISTS idx_admin_username ON admin(username)"),
        
        # 积分记录 - 按用户ID和时间范围查询
        ("score_record", "idx_score_record_user_time", "CREATE INDEX IF NOT EXISTS idx_score_record_user_time ON score_record(user_id, created_at)"),
        
        # 用户表 - 复合索引优化
        ("user", "idx_user_class_score", "CREATE INDEX IF NOT EXISTS idx_user_class_score ON user(class_name, current_score)"),
        
        # 审批表 - 按状态和时间查询
        ("approval", "idx_approval_status_time", "CREATE INDEX IF NOT EXISTS idx_approval_status_time ON approval(status, created_at)"),
        
        # 通知表 - 按用户和状态查询
        ("notification", "idx_notification_user_status", "CREATE INDEX IF NOT EXISTS idx_notification_user_status ON notification(user_id, status)"),
    ]
    
    print("开始添加数据库索引...")
    print(f"数据库路径: {db_path}")
    print("-" * 50)
    
    for table_name, index_name, sql in indexes_to_add:
        try:
            cursor.execute(sql)
            conn.commit()
            print(f"[OK] 已添加索引: {index_name} (表: {table_name})")
        except Exception as e:
            print(f"[ERROR] 添加索引失败 {index_name}: {e}")
    
    # 验证索引是否添加成功
    print("-" * 50)
    print("验证索引列表:")
    cursor.execute("SELECT name FROM sqlite_master WHERE type='index' ORDER BY name")
    indexes = cursor.fetchall()
    print(f"总索引数: {len(indexes)}")
    for idx in indexes[:10]:
        print(f"  - {idx[0]}")
    if len(indexes) > 10:
        print(f"  ... 还有 {len(indexes) - 10} 个索引")
    
    conn.close()
    print("-" * 50)
    print("索引添加完成!")

if __name__ == '__main__':
    add_indexes()
