import os
import sys
from app import app, db
from models import ClassPeriod

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


default_periods = [
    {
        "name": "第一节课",
        "period_number": 1,
        "start_hour": 8,
        "start_minute": 0,
        "end_hour": 8,
        "end_minute": 40,
        "description": "上午第一节",
        "sort_order": 1,
    },
    {
        "name": "第二节课",
        "period_number": 2,
        "start_hour": 8,
        "start_minute": 50,
        "end_hour": 9,
        "end_minute": 30,
        "description": "上午第二节",
        "sort_order": 2,
    },
    {
        "name": "第三节课",
        "period_number": 3,
        "start_hour": 9,
        "start_minute": 40,
        "end_hour": 10,
        "end_minute": 20,
        "description": "上午第三节",
        "sort_order": 3,
    },
    {
        "name": "第四节课",
        "period_number": 4,
        "start_hour": 10,
        "start_minute": 30,
        "end_hour": 11,
        "end_minute": 10,
        "description": "上午第四节",
        "sort_order": 4,
    },
    {
        "name": "第五节课",
        "period_number": 5,
        "start_hour": 11,
        "start_minute": 20,
        "end_hour": 12,
        "end_minute": 0,
        "description": "上午第五节",
        "sort_order": 5,
    },
    {
        "name": "第六节课",
        "period_number": 6,
        "start_hour": 14,
        "start_minute": 0,
        "end_hour": 14,
        "end_minute": 40,
        "description": "下午第一节",
        "sort_order": 6,
    },
    {
        "name": "第七节课",
        "period_number": 7,
        "start_hour": 14,
        "start_minute": 50,
        "end_hour": 15,
        "end_minute": 30,
        "description": "下午第二节",
        "sort_order": 7,
    },
    {
        "name": "第八节课",
        "period_number": 8,
        "start_hour": 15,
        "start_minute": 40,
        "end_hour": 16,
        "end_minute": 20,
        "description": "下午第三节",
        "sort_order": 8,
    },
    {
        "name": "第九节课",
        "period_number": 9,
        "start_hour": 16,
        "start_minute": 30,
        "end_hour": 17,
        "end_minute": 10,
        "description": "下午第四节",
        "sort_order": 9,
    },
    {
        "name": "晚自习一",
        "period_number": 10,
        "start_hour": 19,
        "start_minute": 0,
        "end_hour": 19,
        "end_minute": 40,
        "description": "晚自习第一节",
        "sort_order": 10,
    },
    {
        "name": "晚自习二",
        "period_number": 11,
        "start_hour": 19,
        "start_minute": 50,
        "end_hour": 20,
        "end_minute": 30,
        "description": "晚自习第二节",
        "sort_order": 11,
    },
    {
        "name": "晚自习三",
        "period_number": 12,
        "start_hour": 20,
        "start_minute": 40,
        "end_hour": 21,
        "end_minute": 20,
        "description": "晚自习第三节",
        "sort_order": 12,
    },
]


def main():
    with app.app_context():
        try:
            db.create_all()
            print("表创建成功")

            existing = ClassPeriod.query.count()
            if existing == 0:
                for data in default_periods:
                    period = ClassPeriod(**data)
                    db.session.add(period)
                db.session.commit()
                print(f"已插入 {len(default_periods)} 条默认节次数据")
            else:
                print(f"已存在 {existing} 条节次数据，跳过插入")

        except Exception as e:
            print(f"创建失败: {e}")
            db.session.rollback()


if __name__ == "__main__":
    main()
