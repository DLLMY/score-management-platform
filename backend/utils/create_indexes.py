"""数据库索引创建工具"""
import os
import sys
import sqlite3

def create_indexes():
    """为现有数据库创建索引"""
    basedir = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
    db_path = os.path.join(basedir, 'instance', 'score_management.db')
    
    if not os.path.exists(db_path):
        print(f"数据库文件不存在: {db_path}")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 用户表索引
        indexes = [
            # User表 (表名是单数 user)
            "CREATE INDEX IF NOT EXISTS idx_users_name ON user(name)",
            "CREATE INDEX IF NOT EXISTS idx_users_class_name ON user(class_name)",
            "CREATE INDEX IF NOT EXISTS idx_users_phone ON user(phone)",
            "CREATE INDEX IF NOT EXISTS idx_users_card_id ON user(card_id)",
            "CREATE INDEX IF NOT EXISTS idx_users_current_score ON user(current_score)",
            "CREATE INDEX IF NOT EXISTS idx_users_created_at ON user(created_at)",
            
            # ScoreRule表
            "CREATE INDEX IF NOT EXISTS idx_score_rule_name ON score_rule(name)",
            "CREATE INDEX IF NOT EXISTS idx_score_rule_category_id ON score_rule(category_id)",
            "CREATE INDEX IF NOT EXISTS idx_score_rule_score ON score_rule(score)",
            "CREATE INDEX IF NOT EXISTS idx_score_rule_is_active ON score_rule(is_active)",
            "CREATE INDEX IF NOT EXISTS idx_score_rule_created_at ON score_rule(created_at)",
            
            # ScoreRecord表
            "CREATE INDEX IF NOT EXISTS idx_score_record_user_id ON score_record(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_score_record_rule_id ON score_record(rule_id)",
            "CREATE INDEX IF NOT EXISTS idx_score_record_score_change ON score_record(score_change)",
            "CREATE INDEX IF NOT EXISTS idx_score_record_created_at ON score_record(created_at)",
            
            # Device表
            "CREATE INDEX IF NOT EXISTS idx_device_device_id ON device(device_id)",
            "CREATE INDEX IF NOT EXISTS idx_device_status ON device(status)",
            "CREATE INDEX IF NOT EXISTS idx_device_last_heartbeat ON device(last_heartbeat)",
            
            # DeviceHeartbeat表
            "CREATE INDEX IF NOT EXISTS idx_device_heartbeat_device_id ON device_heartbeat(device_id)",
            "CREATE INDEX IF NOT EXISTS idx_device_heartbeat_timestamp ON device_heartbeat(timestamp)",
            
            # Notification表
            "CREATE INDEX IF NOT EXISTS idx_notification_user_id ON notification(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_notification_type ON notification(type)",
            "CREATE INDEX IF NOT EXISTS idx_notification_status ON notification(status)",
            "CREATE INDEX IF NOT EXISTS idx_notification_created_at ON notification(created_at)",
            
            # Approval表
            "CREATE INDEX IF NOT EXISTS idx_approval_user_id ON approval(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_approval_type ON approval(type)",
            "CREATE INDEX IF NOT EXISTS idx_approval_status ON approval(status)",
            "CREATE INDEX IF NOT EXISTS idx_approval_approver_id ON approval(approver_id)",
            "CREATE INDEX IF NOT EXISTS idx_approval_created_at ON approval(created_at)",
            
            # Admin表
            "CREATE INDEX IF NOT EXISTS idx_admin_username ON admin(username)",
            "CREATE INDEX IF NOT EXISTS idx_admin_role ON admin(role)",
            
            # ClassInfo表
            "CREATE INDEX IF NOT EXISTS idx_class_info_name ON class_info(name)",
            "CREATE INDEX IF NOT EXISTS idx_class_info_is_active ON class_info(is_active)",
            
            # SubAccount表
            "CREATE INDEX IF NOT EXISTS idx_sub_account_parent_admin_id ON sub_account(parent_admin_id)",
            "CREATE INDEX IF NOT EXISTS idx_sub_account_username ON sub_account(username)",
            "CREATE INDEX IF NOT EXISTS idx_sub_account_role_type ON sub_account(role_type)",
            "CREATE INDEX IF NOT EXISTS idx_sub_account_is_active ON sub_account(is_active)",
            
            # OperationLog表
            "CREATE INDEX IF NOT EXISTS idx_operation_log_operation_type ON operation_log(operation_type)",
            "CREATE INDEX IF NOT EXISTS idx_operation_log_target_type ON operation_log(target_type)",
            "CREATE INDEX IF NOT EXISTS idx_operation_log_created_at ON operation_log(created_at)",
            
            # PermissionLog表
            "CREATE INDEX IF NOT EXISTS idx_permission_log_operator_id ON permission_log(operator_id)",
            "CREATE INDEX IF NOT EXISTS idx_permission_log_action ON permission_log(action)",
            "CREATE INDEX IF NOT EXISTS idx_permission_log_created_at ON permission_log(created_at)",
            
            # AdminClass表
            "CREATE INDEX IF NOT EXISTS idx_admin_class_admin_id ON admin_class(admin_id)",
            "CREATE INDEX IF NOT EXISTS idx_admin_class_class_info_id ON admin_class(class_info_id)",
            
            # ProcessedMessage表
            "CREATE INDEX IF NOT EXISTS idx_processed_message_message_id ON processed_message(message_id)",
            "CREATE INDEX IF NOT EXISTS idx_processed_message_client_id ON processed_message(client_id)",
            
            # TimeRule表
            "CREATE INDEX IF NOT EXISTS idx_time_rule_is_active ON time_rule(is_active)"
        ]
        
        created_count = 0
        for idx_sql in indexes:
            try:
                cursor.execute(idx_sql)
                created_count += 1
            except sqlite3.Error as e:
                print(f"创建索引失败: {idx_sql}\n错误: {e}")
        
        conn.commit()
        conn.close()
        
        print(f"成功创建 {created_count} 个索引")
        return True
        
    except sqlite3.Error as e:
        print(f"数据库操作失败: {e}")
        return False

if __name__ == '__main__':
    create_indexes()