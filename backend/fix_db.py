import sqlite3
import os

# 查找数据库文件
print("查找数据库文件...")
for root, dirs, files in os.walk('.'):
    for f in files:
        if f.endswith('.db'):
            print(f'Found DB: {os.path.join(root, f)}')

# 连接并检查表结构
conn = sqlite3.connect('instance/score_management.db')
cursor = conn.cursor()
cursor.execute("PRAGMA table_info(user)")
columns = cursor.fetchall()
print('\nCurrent columns in user table:')
for col in columns:
    print(f'  {col[1]} ({col[2]})')

# 添加缺失的列
columns_list = [col[1] for col in columns]
missing_cols = []

if 'is_blacklisted' not in columns_list:
    cursor.execute('ALTER TABLE user ADD COLUMN is_blacklisted BOOLEAN DEFAULT FALSE')
    missing_cols.append('is_blacklisted')

if 'blacklist_reason' not in columns_list:
    cursor.execute('ALTER TABLE user ADD COLUMN blacklist_reason TEXT')
    missing_cols.append('blacklist_reason')

if 'blacklist_until' not in columns_list:
    cursor.execute('ALTER TABLE user ADD COLUMN blacklist_until DATETIME')
    missing_cols.append('blacklist_until')

if 'daily_unlock_limit' not in columns_list:
    cursor.execute('ALTER TABLE user ADD COLUMN daily_unlock_limit INTEGER DEFAULT 10')
    missing_cols.append('daily_unlock_limit')

if 'today_unlock_count' not in columns_list:
    cursor.execute('ALTER TABLE user ADD COLUMN today_unlock_count INTEGER DEFAULT 0')
    missing_cols.append('today_unlock_count')

if 'last_unlock_date' not in columns_list:
    cursor.execute('ALTER TABLE user ADD COLUMN last_unlock_date DATE')
    missing_cols.append('last_unlock_date')

if 'is_active' not in columns_list:
    cursor.execute('ALTER TABLE user ADD COLUMN is_active BOOLEAN DEFAULT TRUE')
    missing_cols.append('is_active')

conn.commit()
conn.close()

if missing_cols:
    print(f'\n已添加缺失的列: {", ".join(missing_cols)}')
else:
    print('\n所有列都已存在')

print('Done')
