#!/usr/bin/env python3
"""
密码迁移脚本 - 将现有明文密码转换为bcrypt哈希
"""

import sqlite3
import os
import bcrypt


def migrate_passwords():
    # 获取数据库路径
    db_path = os.path.join(os.path.dirname(__file__), "..", "instance", "score_management.db")
    db_path = os.path.abspath(db_path)

    if not os.path.exists(db_path):
        print(f"错误: 数据库文件不存在 - {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 获取所有管理员记录
    cursor.execute("SELECT id, username, password FROM admin")
    admins = cursor.fetchall()

    migrated_count = 0
    skipped_count = 0

    print("开始迁移管理员密码...")
    print(f"数据库路径: {db_path}")
    print("-" * 50)

    for admin_id, username, password in admins:
        # 检查密码是否已经是哈希（bcrypt哈希以$2b$或$2a$开头）
        if password and (password.startswith("$2b$") or password.startswith("$2a$")):
            print(f"[SKIP] 用户 {username} 的密码已经是哈希格式")
            skipped_count += 1
            continue

        # 将明文密码转换为哈希
        try:
            hashed_password = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
            hashed_password_str = hashed_password.decode("utf-8")

            cursor.execute("UPDATE admin SET password = ? WHERE id = ?", (hashed_password_str, admin_id))
            conn.commit()

            print(f"[OK] 用户 {username} 的密码已迁移")
            migrated_count += 1
        except Exception as e:
            print(f"[ERROR] 用户 {username} 的密码迁移失败: {e}")

    # 同样处理子账户
    cursor.execute("SELECT id, username, password FROM sub_account")
    sub_accounts = cursor.fetchall()

    for account_id, username, password in sub_accounts:
        if password and (password.startswith("$2b$") or password.startswith("$2a$")):
            print(f"[SKIP] 子账户 {username} 的密码已经是哈希格式")
            skipped_count += 1
            continue

        try:
            hashed_password = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
            hashed_password_str = hashed_password.decode("utf-8")

            cursor.execute("UPDATE sub_account SET password = ? WHERE id = ?", (hashed_password_str, account_id))
            conn.commit()

            print(f"[OK] 子账户 {username} 的密码已迁移")
            migrated_count += 1
        except Exception as e:
            print(f"[ERROR] 子账户 {username} 的密码迁移失败: {e}")

    conn.close()

    print("-" * 50)
    print(f"迁移完成!")
    print(f"迁移数量: {migrated_count}")
    print(f"跳过数量: {skipped_count}")


if __name__ == "__main__":
    migrate_passwords()
