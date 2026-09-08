"""
数据迁移脚本：添加班级外键关联字段
执行方式：python -m models.migrations.001_add_class_info_fk
"""

from app import app, db
from sqlalchemy import text


def migrate():
    with app.app_context():
        print("🚀 开始数据库迁移：添加班级外键关联字段")
        print("-" * 50)

        # 添加 User 表的外键字段
        try:
            db.engine.execute(text("ALTER TABLE user ADD COLUMN class_info_id INTEGER"))
            db.engine.execute(text("CREATE INDEX IF NOT EXISTS idx_user_class_info_id ON user(class_info_id)"))
            print("✅ User 表添加 class_info_id 字段成功")
        except Exception as e:
            if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
                print("⚠️ User 表 class_info_id 字段已存在，跳过")
            else:
                print(f"⚠️ User 表字段添加遇到问题: {e}")

        # 添加 Admin 表的主班级外键字段
        try:
            db.engine.execute(text("ALTER TABLE admin ADD COLUMN primary_class_id INTEGER"))
            db.engine.execute(text("CREATE INDEX IF NOT EXISTS idx_admin_primary_class_id ON admin(primary_class_id)"))
            print("✅ Admin 表添加 primary_class_id 字段成功")
        except Exception as e:
            if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
                print("⚠️ Admin 表 primary_class_id 字段已存在，跳过")
            else:
                print(f"⚠️ Admin 表字段添加遇到问题: {e}")

        # 添加 SubAccount 表的班级外键字段
        try:
            db.engine.execute(text("ALTER TABLE sub_account ADD COLUMN primary_class_id INTEGER"))
            db.engine.execute(
                text("CREATE INDEX IF NOT EXISTS idx_sub_account_primary_class_id ON sub_account(primary_class_id)")
            )
            print("✅ SubAccount 表添加 primary_class_id 字段成功")
        except Exception as e:
            if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
                print("⚠️ SubAccount 表 primary_class_id 字段已存在，跳过")
            else:
                print(f"⚠️ SubAccount 表字段添加遇到问题: {e}")

        # 添加外键约束
        try:
            # SQLite 不支持直接添加外键约束，需要使用 PRAGMA foreign_keys = ON
            # 并通过重建表的方式添加外键
            db.session.execute(text("PRAGMA foreign_keys=OFF"))

            # 检查外键约束是否已存在
            result = db.session.execute(text("PRAGMA foreign_key_list(user)"))  # noqa: F841
            fk_exists = False
            for row in result:
                if row[2] == "class_info_id" and row[3] == "class_info.id":
                    fk_exists = True
                    break

            if not fk_exists:
                # SQLite 无法直接添加外键约束，需要重建表
                print("ℹ️ SQLite 不支持直接添加外键约束，将在数据层面保证一致性")

            db.session.commit()
            db.session.execute(text("PRAGMA foreign_keys=ON"))
        except Exception as e:
            print(f"⚠️ 外键约束检查遇到问题: {e}")

        print("-" * 50)
        print("🎉 数据库迁移完成!")
        print("")
        print("📋 下一步操作:")
        print("   1. 运行数据迁移脚本: python -m models.migrations.002_migrate_class_data")
        print("   2. 验证迁移结果: 检查 User/Admin 表中的 class_info_id 字段")


def verify():
    """验证字段添加结果"""
    with app.app_context():
        print("🔍 验证数据库字段...")

        # 检查 User 表
        result = db.session.execute(text("PRAGMA table_info(user)"))  # noqa: F841
        columns = [row[1] for row in result]
        if "class_info_id" in columns:
            print("✅ User 表包含 class_info_id 字段")
        else:
            print("❌ User 表缺少 class_info_id 字段")

        # 检查 Admin 表
        result = db.session.execute(text("PRAGMA table_info(admin)"))  # noqa: F841
        columns = [row[1] for row in result]
        if "primary_class_id" in columns:
            print("✅ Admin 表包含 primary_class_id 字段")
        else:
            print("❌ Admin 表缺少 primary_class_id 字段")

        # 检查 SubAccount 表
        result = db.session.execute(text("PRAGMA table_info(sub_account)"))  # noqa: F841
        columns = [row[1] for row in result]
        if "primary_class_id" in columns:
            print("✅ SubAccount 表包含 primary_class_id 字段")
        else:
            print("❌ SubAccount 表缺少 primary_class_id 字段")


if __name__ == "__main__":
    migrate()
    print("")
    verify()
