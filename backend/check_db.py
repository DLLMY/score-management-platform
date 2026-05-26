import sqlite3

db_path = 'instance/score_management.db'

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("=== 检查数据库内容 ===")
    
    # 检查用户数量
    cursor.execute("SELECT COUNT(*) FROM users")
    user_count = cursor.fetchone()[0]
    print(f"用户数量: {user_count}")
    
    # 显示前几个用户
    if user_count > 0:
        cursor.execute("SELECT id, name, class_name, current_score FROM users LIMIT 5")
        print("\n用户列表:")
        for row in cursor.fetchall():
            print(f"  {row}")
    
    # 检查规则数量
    cursor.execute("SELECT COUNT(*) FROM score_rules")
    rule_count = cursor.fetchone()[0]
    print(f"\n积分规则数量: {rule_count}")
    
    # 显示前几个规则
    if rule_count > 0:
        cursor.execute("SELECT id, name, score, is_active FROM score_rules LIMIT 5")
        print("\n规则列表:")
        for row in cursor.fetchall():
            print(f"  {row}")
    
    # 检查操作日志
    cursor.execute("SELECT COUNT(*) FROM operation_logs")
    log_count = cursor.fetchone()[0]
    print(f"\n操作日志数量: {log_count}")
    
    conn.close()
    print("\n=== 检查完成 ===")
    
except Exception as e:
    print(f"错误: {e}")
