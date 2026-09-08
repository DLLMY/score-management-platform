"""
数据迁移脚本：添加班级班主任外键字段
执行方式：python -m migrations.add_head_teacher_id
"""

from app import app
from models import db
from sqlalchemy import text


def migrate():
    with app.app_context():
        print("🚀 开始数据库迁移：添加班级班主任外键字段")
        print("-" * 50)

        try:
            with db.engine.connect() as conn:
                conn.execute(text("ALTER TABLE class_info ADD COLUMN head_teacher_id INTEGER"))
                conn.execute(
                    text("CREATE INDEX IF NOT EXISTS idx_class_info_head_teacher_id ON class_info(head_teacher_id)")
                )
                conn.commit()
            print("✅ class_info 表添加 head_teacher_id 字段成功")
        except Exception as e:
            if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
                print("⚠️ class_info 表 head_teacher_id 字段已存在，跳过")
            else:
                print(f"❌ class_info 表字段添加失败: {e}")
                raise

        print("-" * 50)
        print("🎉 数据库迁移完成!")


def verify():
    """验证字段添加结果"""
    with app.app_context():
        print("🔍 验证数据库字段...")

        result = db.session.execute(text("PRAGMA table_info(class_info)"))  # noqa: F841
        columns = [row[1] for row in result]
        if "head_teacher_id" in columns:
            print("✅ class_info 表包含 head_teacher_id 字段")
        else:
            print("❌ class_info 表缺少 head_teacher_id 字段")


if __name__ == "__main__":
    migrate()
    print("")
    verify()
