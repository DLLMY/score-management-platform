"""清除登录锁定"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import app
from models import db, LoginAttempt

with app.app_context():
    # 删除所有登录尝试记录
    records = LoginAttempt.query.all()
    for record in records:
        print(f"  删除记录: username={record.username}, attempts={record.attempt_count}, locked_until={record.locked_until}")
        db.session.delete(record)
    db.session.commit()
    print(f"✓ 已清除 {len(records)} 条登录尝试记录")
