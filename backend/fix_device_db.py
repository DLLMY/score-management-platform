import sqlite3
import os

print("检查 device 表结构...")

conn = sqlite3.connect('instance/score_management.db')
cursor = conn.cursor()

# 检查 device 表
cursor.execute("PRAGMA table_info(device)")
columns = cursor.fetchall()
print('\n当前 device 表的列:')
for col in columns:
    print(f'  {col[1]} ({col[2]})')

columns_list = [col[1] for col in columns]

# Device 模型需要的列
device_columns = [
    ('device_id', 'VARCHAR(100)'),
    ('name', 'VARCHAR(100)'),
    ('status', 'VARCHAR(20)'),
    ('last_heartbeat', 'DATETIME'),
    ('wifi_signal', 'INTEGER'),
    ('uptime', 'INTEGER'),
    ('box_a_status', 'VARCHAR(20)'),
    ('box_b_status', 'VARCHAR(20)'),
    ('system_state', 'INTEGER'),
    ('class_info_id', 'INTEGER'),
    ('admin_id', 'INTEGER'),
    ('ip_address', 'VARCHAR(45)'),
    ('fw_version', 'VARCHAR(20)'),
    ('platform', 'VARCHAR(50)'),
    ('free_heap', 'INTEGER'),
    ('last_error', 'VARCHAR(500)'),
    ('error_count', 'INTEGER'),
    ('alert_enabled', 'BOOLEAN'),
    ('heartbeat_timeout', 'INTEGER'),
    ('created_at', 'DATETIME'),
    ('updated_at', 'DATETIME'),
]

# 添加缺失的列
missing_cols = []
for col_name, col_type in device_columns:
    if col_name not in columns_list:
        try:
            cursor.execute(f'ALTER TABLE device ADD COLUMN {col_name} {col_type}')
            missing_cols.append(col_name)
            print(f'已添加: {col_name}')
        except Exception as e:
            print(f'添加 {col_name} 失败: {e}')

conn.commit()
conn.close()

if missing_cols:
    print(f'\n已添加缺失的列: {", ".join(missing_cols)}')
else:
    print('\n所有列都已存在')

print('Done')
