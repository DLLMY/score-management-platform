#!/usr/bin/env python3
import os
import sys
import sqlite3

"""
"""
"""
数据库迁移脚本 - 为User表添加风险评分相关字段
"""
"""
"""


# 添加项目路径到PYTHONPATH
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def add_risk_fields():
    """
    为User表添加risk_score和last_risk_updated字段
    """
    db_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "instance", "score_management.db"
    )

    print("检查数据库路径: %s" % db_path)

    if not os.path.exists(db_path):
        print("[ERROR] 数据库文件不存在: %s" % db_path)
        return

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # 检查risk_score字段是否存在
        cursor.execute("PRAGMA table_info(user)")
        columns = [col[1] for col in cursor.fetchall()]

        if "risk_score" not in columns:
            print("[INFO] 正在添加risk_score字段...")
            cursor.execute("ALTER TABLE user ADD COLUMN risk_score REAL DEFAULT 0.0")
            print("[OK] risk_score字段添加成功")
        else:
            print("[SKIP] risk_score字段已存在")

        if "last_risk_updated" not in columns:
            print("[INFO] 正在添加last_risk_updated字段...")
            cursor.execute("ALTER TABLE user ADD COLUMN last_risk_updated DATETIME")
            print("[OK] last_risk_updated字段添加成功")
        else:
            print("[SKIP] last_risk_updated字段已存在")

        conn.commit()
        print("\n[DONE] 字段添加完成！")

    except Exception as e:
        print("[ERROR] 添加字段失败: %s" % str(e))
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    add_risk_fields()
