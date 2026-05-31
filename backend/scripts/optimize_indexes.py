#!/usr/bin/env python3
"""
数据库索引优化脚本
根据实际查询模式创建和优化索引
"""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from models import db
from sqlalchemy import text
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class IndexOptimizer:
    """索引优化器"""

    def __init__(self):
        self.recommended_indexes = []
        self.created_indexes = []

    def get_existing_indexes(self, table_name):
        """获取现有索引"""
        with app.app_context():
            result = db.session.execute(text(f"SHOW INDEX FROM {table_name}"))
            indexes = {}
            for row in result:
                index_name = row[2]
                if index_name not in indexes:
                    indexes[index_name] = {
                        'name': index_name,
                        'unique': row[1] == 0,
                        'columns': []
                    }
                indexes[index_name]['columns'].append(row[4])
            return list(indexes.values())

    def create_index_if_not_exists(self, table_name, columns, index_name=None, unique=False):
        """创建索引（如果不存在）"""
        if index_name is None:
            index_name = f"idx_{table_name}_{'_'.join(columns)}"

        with app.app_context():
            existing = self.get_existing_indexes(table_name)
            existing_names = [idx['name'] for idx in existing]

            if index_name in existing_names:
                logger.info(f"索引 {index_name} 已存在，跳过")
                return False

            try:
                columns_str = ', '.join(columns)
                if unique:
                    sql = f"CREATE UNIQUE INDEX {index_name} ON {table_name} ({columns_str})"
                else:
                    sql = f"CREATE INDEX {index_name} ON {table_name} ({columns_str})"

                db.session.execute(text(sql))
                db.session.commit()
                logger.info(f"创建索引: {sql}")
                self.created_indexes.append(index_name)
                return True
            except Exception as e:
                logger.error(f"创建索引失败: {e}")
                db.session.rollback()
                return False

    def drop_unused_indexes(self, table_name, min_usage=1000):
        """删除未使用的索引"""
        pass

    def analyze_table(self, table_name):
        """分析表以更新统计信息"""
        with app.app_context():
            try:
                db.session.execute(text(f"ANALYZE TABLE {table_name}"))
                db.session.commit()
                logger.info(f"分析表 {table_name} 完成")
            except Exception as e:
                logger.error(f"分析表失败: {e}")


def optimize_user_table():
    """优化用户表索引"""
    optimizer = IndexOptimizer()
    table = 'user'

    logger.info("开始优化用户表索引...")

    existing = optimizer.get_existing_indexes(table)
    logger.info(f"现有索引: {[idx['name'] for idx in existing]}")

    optimizer.create_index_if_not_exists(table, ['name'], 'idx_user_name')
    optimizer.create_index_if_not_exists(table, ['card_id'], 'idx_user_card_id')
    optimizer.create_index_if_not_exists(table, ['class_name'], 'idx_user_class_name')
    optimizer.create_index_if_not_exists(table, ['current_score'], 'idx_user_score')
    optimizer.create_index_if_not_exists(table, ['created_at'], 'idx_user_created')

    optimizer.create_index_if_not_exists(
        table,
        ['class_name', 'name'],
        'idx_user_class_name_name'
    )

    optimizer.create_index_if_not_exists(
        table,
        ['card_id', 'current_score'],
        'idx_user_card_score'
    )

    optimizer.analyze_table(table)
    logger.info(f"用户表优化完成，创建了 {len(optimizer.created_indexes)} 个新索引")


def optimize_score_record_table():
    """优化积分记录表索引"""
    optimizer = IndexOptimizer()
    table = 'score_record'

    logger.info("开始优化积分记录表索引...")

    existing = optimizer.get_existing_indexes(table)
    logger.info(f"现有索引: {[idx['name'] for idx in existing]}")

    optimizer.create_index_if_not_exists(table, ['user_id'], 'idx_record_user')
    optimizer.create_index_if_not_exists(table, ['rule_id'], 'idx_record_rule')
    optimizer.create_index_if_not_exists(table, ['created_at'], 'idx_record_created')

    optimizer.create_index_if_not_exists(
        table,
        ['user_id', 'created_at'],
        'idx_record_user_created'
    )

    optimizer.create_index_if_not_exists(
        table,
        ['rule_id', 'created_at'],
        'idx_record_rule_created'
    )

    optimizer.create_index_if_not_exists(
        table,
        ['score_change', 'created_at'],
        'idx_record_score_created'
    )

    optimizer.analyze_table(table)
    logger.info(f"积分记录表优化完成，创建了 {len(optimizer.created_indexes)} 个新索引")


def optimize_device_table():
    """优化设备表索引"""
    optimizer = IndexOptimizer()
    table = 'device'

    logger.info("开始优化设备表索引...")

    existing = optimizer.get_existing_indexes(table)
    logger.info(f"现有索引: {[idx['name'] for idx in existing]}")

    optimizer.create_index_if_not_exists(table, ['device_id'], 'idx_device_device_id')
    optimizer.create_index_if_not_exists(table, ['status'], 'idx_device_status')
    optimizer.create_index_if_not_exists(table, ['class_info_id'], 'idx_device_class')
    optimizer.create_index_if_not_exists(table, ['last_heartbeat'], 'idx_device_heartbeat')

    optimizer.create_index_if_not_exists(
        table,
        ['status', 'last_heartbeat'],
        'idx_device_status_heartbeat'
    )

    optimizer.analyze_table(table)
    logger.info(f"设备表优化完成，创建了 {len(optimizer.created_indexes)} 个新索引")


def optimize_notification_table():
    """优化通知表索引"""
    optimizer = IndexOptimizer()
    table = 'notification'

    logger.info("开始优化通知表索引...")

    existing = optimizer.get_existing_indexes(table)
    logger.info(f"现有索引: {[idx['name'] for idx in existing]}")

    optimizer.create_index_if_not_exists(table, ['user_id'], 'idx_notification_user')
    optimizer.create_index_if_not_exists(table, ['status'], 'idx_notification_status')
    optimizer.create_index_if_not_exists(table, ['type'], 'idx_notification_type')
    optimizer.create_index_if_not_exists(table, ['created_at'], 'idx_notification_created')

    optimizer.create_index_if_not_exists(
        table,
        ['user_id', 'status'],
        'idx_notification_user_status'
    )

    optimizer.analyze_table(table)
    logger.info(f"通知表优化完成，创建了 {len(optimizer.created_indexes)} 个新索引")


def optimize_all_tables():
    """优化所有表"""
    logger.info("开始优化所有表的索引...")

    optimize_user_table()
    optimize_score_record_table()
    optimize_device_table()
    optimize_notification_table()

    logger.info("=" * 50)
    logger.info("索引优化完成！")
    logger.info("=" * 50)


if __name__ == '__main__':
    optimize_all_tables()
