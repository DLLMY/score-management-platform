"""测试NotifyTemplate写入错误"""

import sys
import os
import traceback

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import app
from models import db, NotifyTemplate

with app.app_context():
    # 测试直接创建模板
    try:
        template = NotifyTemplate(
            name="测试模板",
            text="这是一条测试通知",
            volume=0.8,
            speak=True,
            popup=True,
            timeout_sec=10,
            urgent=False,
            bg_color="#FF0000",
            text_color="#FFFFFF",
            font_size=36,
            language="zh",
            category="测试",
            tags='["测试", "验证"]',  # 使用JSON字符串
            created_by=1,
        )
        db.session.add(template)
        db.session.commit()
        print(f"✓ 创建成功, ID: {template.id}")
        print(f"  tags: {template.tags}")

        # 测试使用list直接赋值
        template2 = NotifyTemplate(
            name="测试模板2",
            text="这是第二条测试通知",
            created_by=1,
        )
        template2.tags = ["测试", "验证"]  # 直接使用list
        db.session.add(template2)
        db.session.commit()
        print(f"✓ 创建成功2, ID: {template2.id}")

    except Exception as e:
        print(f"✗ 创建失败: {e}")
        traceback.print_exc()
        db.session.rollback()
