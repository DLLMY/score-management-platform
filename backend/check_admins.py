from app import app, db, Admin

with app.app_context():
    admins = Admin.query.all()
    print("管理员列表:")
    for a in admins:
        print(f"ID: {a.id}, 用户名: {a.username}, 角色: {a.role}, 姓名: {a.real_name}, 班级: {a.class_name}")
