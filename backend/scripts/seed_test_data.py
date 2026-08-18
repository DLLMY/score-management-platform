# -*- coding: utf-8 -*-
"""
测试数据预置脚本 - 简化版
预置一个完整班级的测试数据
"""

import sys
import os
import random
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from models import db
from models import (
    User,
    ClassInfo,
    ScoreCategory,
    Subject,
    ScoreRule,
    ScoreRecord,
    SeatingChart,
    SeatingSeat,
    DutyGroup,
    DutyAssignment,
    ClassCommittee,
    ParentContact,
    ContactLog,
    HomeworkAssignment,
    Attendance,
    Approval,
    StudyGroup,
    StudyGroupMember,
    MentalHealthRecord,
    Activity,
    CultureRecord,
    StudyGuide,
)

# 配置
CLASS_NAME = "高一(1)班"
STUDENT_COUNT = 42

# 全局变量存储班级ID
CLASS_ID = None


def clear_data():
    """清除现有数据"""
    print("清除现有测试数据...")
    global CLASS_ID
    try:
        # 先找到班级ID
        existing_class = ClassInfo.query.filter_by(name=CLASS_NAME).first()
        if existing_class:
            CLASS_ID = existing_class.id
        else:
            CLASS_ID = None

        db.session.query(ScoreRecord).delete()
        db.session.query(ScoreRule).delete()
        db.session.query(ScoreCategory).delete()
        db.session.query(Subject).delete()
        db.session.query(User).filter(User.class_name == CLASS_NAME).delete()
        db.session.query(ClassInfo).filter(ClassInfo.name == CLASS_NAME).delete()
        db.session.query(SeatingSeat).delete()
        db.session.query(SeatingChart).delete()
        db.session.query(DutyAssignment).delete()
        db.session.query(DutyGroup).delete()
        db.session.query(ClassCommittee).delete()
        db.session.query(ContactLog).delete()
        db.session.query(ParentContact).delete()
        db.session.query(HomeworkAssignment).delete()
        db.session.query(Approval).filter_by(type="leave").delete()
        db.session.query(Attendance).delete()
        db.session.query(StudyGroupMember).delete()
        db.session.query(StudyGroup).delete()
        db.session.query(MentalHealthRecord).delete()
        db.session.query(Activity).delete()
        db.session.query(CultureRecord).delete()
        db.session.query(StudyGuide).delete()
        db.session.commit()
        print("✅ 清除完成")
    except Exception as e:
        db.session.rollback()
        print(f"清除数据时出错: {e}")


def seed_class():
    """创建班级"""
    global CLASS_ID
    print("创建班级...")
    class_info = ClassInfo(name=CLASS_NAME, grade="高一", description="高一重点班", is_active=True)
    db.session.add(class_info)
    db.session.commit()
    CLASS_ID = class_info.id
    print(f"✅ 班级: {CLASS_NAME} (ID: {CLASS_ID})")
    return class_info


def seed_students():
    """创建学生"""
    global CLASS_ID
    print(f"创建{STUDENT_COUNT}名学生...")

    surnames = [
        "张",
        "王",
        "李",
        "刘",
        "陈",
        "杨",
        "周",
        "吴",
        "黄",
        "赵",
        "孙",
        "朱",
        "胡",
        "林",
        "何",
    ]
    male_names = [
        "伟",
        "强",
        "明",
        "洋",
        "浩",
        "帆",
        "杰",
        "涛",
        "磊",
        "鑫",
        "旭",
        "亮",
        "彬",
        "峰",
        "俊",
    ]
    female_names = [
        "芳",
        "娜",
        "静",
        "婷",
        "颖",
        "雪",
        "敏",
        "琳",
        "丽",
        "薇",
        "萍",
        "红",
        "婷",
        "洁",
        "燕",
    ]

    students = []
    for i in range(STUDENT_COUNT):
        gender = "男" if i < 24 else "女"
        name_list = male_names if gender == "男" else female_names
        name = random.choice(surnames) + random.choice(name_list)

        card_id = f"2024{CLASS_ID:02d}{i+1:03d}"

        student = User(
            name=name,
            gender=gender,
            class_name=CLASS_NAME,
            class_info_id=CLASS_ID,
            card_id=card_id,
            current_score=random.randint(60, 95),
            is_active=True,
            role="student",
        )
        students.append(student)
        db.session.add(student)

    db.session.commit()
    print(f"✅ 学生: {len(students)}名")
    return students


def seed_subjects():
    """创建科目"""
    print("创建科目...")

    subjects_data = [
        ("语文", "YW", "#EF4444"),
        ("数学", "SX", "#3B82F6"),
        ("英语", "YY", "#10B981"),
        ("物理", "WL", "#8B5CF6"),
        ("化学", "HX", "#F59E0B"),
        ("生物", "SW", "#EC4899"),
        ("历史", "LS", "#6366F1"),
        ("地理", "DL", "#14B8A6"),
        ("政治", "ZZ", "#F97316"),
    ]

    subjects = []
    for name, code, color in subjects_data:
        subject = Subject(name=name, code=code, color=color, is_active=True)
        subjects.append(subject)
        db.session.add(subject)

    db.session.commit()
    print(f"✅ 科目: {len(subjects)}门")
    return subjects


def seed_rules():
    """创建积分规则"""
    print("创建积分规则...")

    categories_data = [
        ("纪律表现", "#EF4444", [("迟到", -2), ("早退", -2), ("旷课", -5), ("上课说话", -1)]),
        (
            "学习表现",
            "#3B82F6",
            [("作业优秀", 2), ("课堂回答", 1), ("考试进步", 3), ("作业缺交", -2)],
        ),
        ("行为习惯", "#10B981", [("值日认真", 1), ("帮助同学", 2), ("违反纪律", -3)]),
        ("活动参与", "#8B5CF6", [("运动会参与", 2), ("文艺演出", 3), ("志愿服务", 2)]),
    ]

    rules = []
    for cat_name, color, rule_list in categories_data:
        cat = ScoreCategory(name=cat_name, color=color, is_active=True)
        db.session.add(cat)
        db.session.flush()

        for rule_name, score in rule_list:
            rule = ScoreRule(name=rule_name, category_id=cat.id, score=score, is_active=True)
            rules.append(rule)
            db.session.add(rule)

    db.session.commit()
    print(f"✅ 规则: {len(rules)}条")
    return rules


def seed_scores(students, rules):
    """创建积分记录"""
    print("创建积分记录...")

    records = []
    for student in students:
        for _ in range(random.randint(5, 10)):
            rule = random.choice(rules)
            record = ScoreRecord(
                user_id=student.id, rule_id=rule.id, score_change=rule.score, reason=rule.name
            )
            records.append(record)
            db.session.add(record)

    db.session.commit()
    print(f"✅ 积分记录: {len(records)}条")


def seed_seating(students):
    """创建座次表"""
    global CLASS_ID
    print("创建座次表...")

    chart = SeatingChart(
        class_id=CLASS_ID, name="高一(1)班座次表", rows=7, columns=8, is_active=True
    )
    db.session.add(chart)
    db.session.flush()

    seats = []
    student_list = list(students)
    random.shuffle(student_list)

    idx = 0
    for row in range(7):
        for col in range(8):
            is_aisle = col == 3 or col == 4
            student_id = None
            if not is_aisle and idx < len(student_list):
                student_id = student_list[idx].id
                idx += 1

            seat = SeatingSeat(
                chart_id=chart.id, row=row, col=col, student_id=student_id, is_aisle=is_aisle
            )
            seats.append(seat)
            db.session.add(seat)

    db.session.commit()
    print(f"✅ 座位: {len(seats)}个")


def seed_duty(students):
    """创建值日表"""
    global CLASS_ID
    print("创建值日表...")

    groups = []
    for i in range(7):
        group = DutyGroup(class_id=CLASS_ID, name=f"值日组{i+1}")
        db.session.add(group)
        db.session.flush()
        groups.append(group)

        for student in random.sample(list(students), min(5, len(students))):
            assignment = DutyAssignment(
                group_id=group.id,
                student_id=student.id,
                date=date.today(),
                task=random.choice(["扫地", "拖地", "擦黑板", "倒垃圾"]),
                is_completed=random.choice([True, False]),
            )
            db.session.add(assignment)

    db.session.commit()
    print(f"✅ 值日组: {len(groups)}组")


def seed_committee(students):
    """创建班委"""
    global CLASS_ID
    print("创建班委...")

    positions = [
        "班长",
        "副班长",
        "学习委员",
        "纪律委员",
        "体育委员",
        "文艺委员",
        "劳动委员",
        "宣传委员",
        "生活委员",
    ]

    count = 0
    for i, pos in enumerate(positions):
        if i < len(students):
            member = ClassCommittee(
                class_id=CLASS_ID,
                student_id=students[i].id,
                position=pos,
                responsibilities=f"负责{pos}工作",
                is_active=True,
            )
            db.session.add(member)
            count += 1

    db.session.commit()
    print(f"✅ 班委: {count}名")


def seed_other_data(students, subjects):
    """创建其他数据"""
    global CLASS_ID
    print("创建其他数据...")

    try:
        # 作业 - 使用最基本的字段
        for subject in subjects[:5]:
            hw = HomeworkAssignment(
                class_id=CLASS_ID, subject_id=subject.id, title=f"{subject.name}作业"
            )
            db.session.add(hw)

        # 考勤 - 使用最基本的字段
        for student in students:
            record = Attendance(
                class_id=CLASS_ID, student_id=student.id, record_date=date.today(), status="present"
            )
            db.session.add(record)

        # 学习小组
        for i in range(6):
            group = StudyGroup(class_id=CLASS_ID, name=f"学习小组{i+1}")
            db.session.add(group)
            db.session.flush()

            start = i * 7
            end = min(start + 7, len(students))
            for student in students[start:end]:
                member = StudyGroupMember(group_id=group.id, student_id=student.id)
                db.session.add(member)

        # 活动
        for name in ["运动会", "元旦晚会", "篮球比赛"]:
            activity = Activity(class_id=CLASS_ID, title=name, activity_type="sports")
            db.session.add(activity)

        # 班级文化
        for title, content in [("班级口号", "团结奋进"), ("班级公约", "遵守纪律")]:
            culture = CultureRecord(class_id=CLASS_ID, title=title, content=content)
            db.session.add(culture)

        # 学法指导
        guide = StudyGuide(class_id=CLASS_ID, title="学习方法指导", content="学习技巧分享")
        db.session.add(guide)

        db.session.commit()
        print("✅ 其他数据创建完成")
    except Exception as e:
        db.session.rollback()
        print(f"创建其他数据时出错: {e}")
        # 继续执行，不中断


def main():
    print("\n" + "=" * 50)
    print("开始预置测试数据...")
    print("=" * 50 + "\n")

    with app.app_context():
        clear_data()
        seed_class()
        students = seed_students()
        subjects = seed_subjects()
        rules = seed_rules()
        seed_scores(students, rules)
        seed_seating(students)
        seed_duty(students)
        seed_committee(students)
        seed_other_data(students, subjects)

    print("\n" + "=" * 50)
    print("✅ 测试数据预置完成！")
    print("=" * 50)
    print(f"\n班级: {CLASS_NAME}")
    print(f"学生: {STUDENT_COUNT}名")
    print(f"科目: 9门")
    print(f"积分规则: 多条")
    print(f"班主工作台: 全部已配置\n")


if __name__ == "__main__":
    main()
