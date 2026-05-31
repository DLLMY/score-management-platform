import sqlite3

conn = sqlite3.connect('instance/score_management.db')
cursor = conn.cursor()

# 获取所有表
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()
print("数据库中的表:")
for table in tables:
    print(f"  {table[0]}")

# 检查特定表是否存在
print("\n检查关键表是否存在:")
table_list = ['sub_account', 'permission_log']
for table_name in table_list:
    cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table_name}';")
    result = cursor.fetchone()
    if result:
        print(f"  ✅ {table_name} 表存在")
    else:
        print(f"  ❌ {table_name} 表不存在")

conn.close()
