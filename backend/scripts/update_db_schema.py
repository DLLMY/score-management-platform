"""更新数据库表结构以匹配最新的模型定义"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import app
from models import db

with app.app_context():
    # 检查表并添加新字段
    inspector = db.inspect(db.engine)

    # 需要检查和更新的表
    tables_to_update = {
        "class_periods": {
            "columns": [
                "id",
                "name",
                "period_number",
                "start_hour",
                "start_minute",
                "end_hour",
                "end_minute",
                "description",
                "is_active",
                "sort_order",
                "created_at",
                "updated_at",
            ]
        },
        "notify_templates": {
            "columns": [
                "id",
                "name",
                "template",
                "text",
                "description",
                "volume",
                "speak",
                "popup",
                "timeout_sec",
                "urgent",
                "bg_color",
                "text_color",
                "font_size",
                "language",
                "category",
                "tags",
                "usage_count",
                "is_active",
                "created_by",
                "created_at",
                "updated_at",
            ]
        },
        "device_groups": {
            "columns": [
                "id",
                "name",
                "description",
                "location",
                "icon",
                "color",
                "sort_order",
                "admin_id",
                "is_active",
                "created_at",
                "updated_at",
            ]
        },
    }

    print("检查数据库表结构...")

    # 添加新字段到现有表
    for table_name, config in tables_to_update.items():
        if table_name in inspector.get_table_names():
            existing_columns = [col["name"] for col in inspector.get_columns(table_name)]
            missing_columns = [col for col in config["columns"] if col not in existing_columns]

            if missing_columns:
                print(f"\n表 {table_name} 缺少字段: {missing_columns}")
                print(f"  现有字段: {existing_columns}")
                print("  正在添加缺失的字段...")

                # 使用 ALTER TABLE 添加缺失的列
                for col in missing_columns:
                    # 根据列名推断类型
                    col_type = "VARCHAR(500)"
                    if col in [
                        "id",
                        "period_number",
                        "start_hour",
                        "start_minute",
                        "end_hour",
                        "end_minute",
                        "sort_order",
                        "admin_id",
                        "created_by",
                        "usage_count",
                        "timeout_sec",
                        "font_size",
                    ]:
                        col_type = "INTEGER"
                    elif col in ["is_active", "speak", "popup", "urgent"]:
                        col_type = "BOOLEAN"
                    elif col in ["volume"]:
                        col_type = "FLOAT"
                    elif col in ["created_at", "updated_at", "scheduled_at"]:
                        col_type = "DATETIME"
                    elif col in ["text", "template", "tags"]:
                        col_type = "TEXT"
                    elif col in ["bg_color", "text_color", "color"]:
                        col_type = "VARCHAR(20)"
                    elif col in ["language"]:
                        col_type = "VARCHAR(20)"
                    elif col in ["icon"]:
                        col_type = "VARCHAR(50)"
                    elif col in ["category", "location"]:
                        col_type = "VARCHAR(100)"
                    elif col in ["description", "name"]:
                        col_type = "VARCHAR(500)" if col == "description" else "VARCHAR(100)"

                    try:
                        db.session.execute(
                            db.text(f"ALTER TABLE {table_name} ADD COLUMN {col} {col_type}")
                        )
                        print(f"    ✓ 添加列 {col} ({col_type})")
                    except Exception as e:
                        print(f"    ✗ 添加列 {col} 失败: {e}")

                db.session.commit()
                print(f"  ✓ 表 {table_name} 已更新")
            else:
                print(f"\n表 {table_name} 结构完整 ✓")
        else:
            print(f"\n表 {table_name} 不存在，正在创建...")
            db.create_all()
            print(f"  ✓ 表 {table_name} 已创建")

    print("\n✓ 数据库表结构检查和更新完成")
