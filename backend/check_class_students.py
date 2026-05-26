from app import app, db, User, ClassInfo

with app.app_context():
    # 获取所有班级
    classes = ClassInfo.query.all()
    print("班级学生分布:")
    print("=" * 60)
    
    for c in classes:
        students = User.query.filter_by(class_name=c.name).all()
        print(f"班级: {c.name}")
        print(f"  学生数量: {len(students)}")
        if students:
            print(f"  学生列表:")
            for s in students:
                print(f"    - {s.name} (学号: {s.card_id})")
        print()