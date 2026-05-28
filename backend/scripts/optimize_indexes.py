"""数据库索引优化脚本 - 为常用查询字段添加索引"""
import os
import sys

# 添加项目路径
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from app import app
from models import db

def add_indexes():
    """添加数据库索引"""
    indexes_added = []
    
    with app.app_context():
        inspector = db.inspect(db.engine)
        
        # 使用SQLAlchemy的text()方法执行原生SQL
        from sqlalchemy import text
        
        # ========== User表索引 ==========
        user_indexes = [
            ('idx_user_card_id', 'user', ['card_id']),
            ('idx_user_class_name', 'user', ['class_name']),
            ('idx_user_phone', 'user', ['phone']),
            ('idx_user_current_score', 'user', ['current_score']),
            ('idx_user_name', 'user', ['name']),
            ('idx_user_created_at', 'user', ['created_at']),
            # 复合索引
            ('idx_user_class_score', 'user', ['class_name', 'current_score']),
        ]
        
        # ========== ScoreRecord表索引 ==========
        record_indexes = [
            ('idx_record_user_id', 'score_record', ['user_id']),
            ('idx_record_rule_id', 'score_record', ['rule_id']),
            ('idx_record_score_change', 'score_record', ['score_change']),
            ('idx_record_created_at', 'score_record', ['created_at']),
            # 复合索引
            ('idx_record_user_time', 'score_record', ['user_id', 'created_at']),
            ('idx_record_rule_time', 'score_record', ['rule_id', 'created_at']),
        ]
        
        # ========== Notification表索引 ==========
        notification_indexes = [
            ('idx_notification_user_id', 'notification', ['user_id']),
            ('idx_notification_type', 'notification', ['type']),
            ('idx_notification_status', 'notification', ['status']),
            ('idx_notification_created_at', 'notification', ['created_at']),
            # 复合索引
            ('idx_notification_user_status', 'notification', ['user_id', 'status']),
            ('idx_notification_status_time', 'notification', ['status', 'created_at']),
        ]
        
        # ========== Approval表索引 ==========
        approval_indexes = [
            ('idx_approval_user_id', 'approval', ['user_id']),
            ('idx_approval_type', 'approval', ['type']),
            ('idx_approval_status', 'approval', ['status']),
            ('idx_approval_created_at', 'approval', ['created_at']),
            ('idx_approval_approver_id', 'approval', ['approver_id']),
            # 复合索引
            ('idx_approval_status_time', 'approval', ['status', 'created_at']),
            ('idx_approval_user_status', 'approval', ['user_id', 'status']),
        ]
        
        # ========== Admin表索引 ==========
        admin_indexes = [
            ('idx_admin_username', 'admin', ['username']),
            ('idx_admin_role', 'admin', ['role']),
            ('idx_admin_class_name', 'admin', ['class_name']),
        ]
        
        # ========== OperationLog表索引 ==========
        log_indexes = [
            ('idx_log_operation_type', 'operation_log', ['operation_type']),
            ('idx_log_target_type', 'operation_log', ['target_type']),
            ('idx_log_target_id', 'operation_log', ['target_id']),
            ('idx_log_operator', 'operation_log', ['operator']),
            ('idx_log_created_at', 'operation_log', ['created_at']),
            # 复合索引
            ('idx_log_type_time', 'operation_log', ['operation_type', 'created_at']),
            ('idx_log_target_type_id', 'operation_log', ['target_type', 'target_id']),
        ]
        
        # ========== ScoreRule表索引 ==========
        rule_indexes = [
            ('idx_rule_name', 'score_rule', ['name']),
            ('idx_rule_category_id', 'score_rule', ['category_id']),
            ('idx_rule_score', 'score_rule', ['score']),
            ('idx_rule_is_active', 'score_rule', ['is_active']),
            ('idx_rule_created_at', 'score_rule', ['created_at']),
            # 复合索引
            ('idx_rule_category_active', 'score_rule', ['category_id', 'is_active']),
        ]
        
        # ========== MQTTLog表索引 ==========
        mqtt_indexes = [
            ('idx_mqtt_topic', 'mqtt_log', ['topic']),
            ('idx_mqtt_direction', 'mqtt_log', ['direction']),
            ('idx_mqtt_timestamp', 'mqtt_log', ['timestamp']),
        ]
        
        all_indexes = [
            ('user', user_indexes),
            ('score_record', record_indexes),
            ('notification', notification_indexes),
            ('approval', approval_indexes),
            ('admin', admin_indexes),
            ('operation_log', log_indexes),
            ('score_rule', rule_indexes),
            ('mqtt_log', mqtt_indexes),
        ]
        
        for table_name, indexes in all_indexes:
            for index_name, idx_table, columns in indexes:
                try:
                    # 检查索引是否已存在
                    existing_indexes = inspector.get_indexes(idx_table)
                    existing_names = [idx['name'] for idx in existing_indexes]
                    
                    if index_name not in existing_names:
                        # 创建索引
                        columns_str = ', '.join(columns)
                        sql = text(f'CREATE INDEX {index_name} ON {idx_table} ({columns_str})')
                        db.session.execute(sql)
                        db.session.commit()
                        indexes_added.append(f'{index_name} ON {idx_table}')
                        print(f'✓ 创建索引: {index_name}')
                    else:
                        print(f'✓ 索引已存在: {index_name}')
                except Exception as e:
                    print(f'✗ 创建索引失败 {index_name}: {e}')
    
    return indexes_added

def analyze_database():
    """分析数据库表"""
    with app.app_context():
        from sqlalchemy import text
        
        tables = ['user', 'score_record', 'notification', 'approval', 'admin', 'operation_log']
        
        for table in tables:
            try:
                # ANALYZE命令收集统计信息
                db.session.execute(text(f'ANALYZE {table}'))
                db.session.commit()
                print(f'✓ 分析表: {table}')
            except Exception as e:
                print(f'✗ 分析表失败 {table}: {e}')

def main():
    print('=' * 60)
    print('数据库索引优化脚本')
    print('=' * 60)
    
    print('\n1. 添加索引...')
    added = add_indexes()
    
    print(f'\n2. 分析数据库表...')
    analyze_database()
    
    print('\n' + '=' * 60)
    print(f'索引优化完成！')
    print(f'新增索引数量: {len(added)}')
    if added:
        print('新增索引列表:')
        for idx in added:
            print(f'  - {idx}')
    print('=' * 60)

if __name__ == '__main__':
    main()