"""检查数据库索引"""
import os
import sqlite3

def check_indexes():
    basedir = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
    db_path = os.path.join(basedir, 'instance', 'score_management.db')
    
    if not os.path.exists(db_path):
        print(f"数据库文件不存在: {db_path}")
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("=" * 60)
        print("数据库表列表:")
        print("=" * 60)
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        for table in tables:
            print(f"  - {table[0]}")
        
        print("\n" + "=" * 60)
        print("数据库索引列表:")
        print("=" * 60)
        cursor.execute("SELECT name, tbl_name FROM sqlite_master WHERE type='index'")
        indexes = cursor.fetchall()
        if not indexes:
            print("  暂无索引")
        else:
            for idx_name, tbl_name in indexes:
                print(f"  - {idx_name} (表: {tbl_name})")
        
        print(f"\n总索引数: {len(indexes)}")
        
        conn.close()
        
    except sqlite3.Error as e:
        print(f"数据库操作失败: {e}")

if __name__ == '__main__':
    check_indexes()
