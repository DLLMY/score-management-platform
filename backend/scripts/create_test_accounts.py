"""创建多角色测试账号"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import app
from models import db, Admin
from werkzeug.security import generate_password_hash

with app.app_context():
    # 检查现有的管理员账号
    print("=== 现有管理员账号 ===")
    admins = Admin.query.all()
    for admin in admins:
        print(f"  ID: {admin.id}, 用户名: {admin.username}, 真实姓名: {admin.real_name}, 角色: {admin.role}")
    
    # 检查Admin表的字段
    print("\n=== Admin模型属性 ===")
    admin_attrs = [attr for attr in dir(Admin) if not attr.startswith('_')]
    relevant_attrs = [a for a in admin_attrs if a in ['password', 'password_hash', 'role', 'role_type', 'username', 'real_name', 'is_active']]
    print(f"  相关字段: {relevant_attrs}")
    
    # 创建教师账号（如果不存在）
    print("\n=== 创建教师账号 ===")
    teacher = Admin.query.filter_by(username="teacher").first()
    if teacher:
        print(f"  教师账号已存在: ID={teacher.id}")
        teacher.password = generate_password_hash("123456")
        db.session.commit()
        print(f"  已重置密码为: 123456")
    else:
        teacher = Admin(
            username="teacher",
            password=generate_password_hash("123456"),
            real_name="测试教师",
            role="teacher",
            is_active=True,
        )
        db.session.add(teacher)
        db.session.commit()
        print(f"  ✓ 创建教师账号成功: ID={teacher.id}, 用户名=teacher, 密码=123456")
    
    # 创建学生账号（使用Admin表，因为登录接口是 /api/auth/login）
    print("\n=== 创建学生账号 ===")
    student_admin = Admin.query.filter_by(username="student").first()
    if student_admin:
        print(f"  学生账号(Admin)已存在: ID={student_admin.id}")
        student_admin.password = generate_password_hash("123456")
        db.session.commit()
        print(f"  已重置密码为: 123456")
    else:
        student_admin = Admin(
            username="student",
            password=generate_password_hash("123456"),
            real_name="测试学生",
            role="student",
            is_active=True,
        )
        db.session.add(student_admin)
        db.session.commit()
        print(f"  ✓ 创建学生账号(Admin)成功: ID={student_admin.id}, 用户名=student, 密码=123456")
    
    # 确保admin账号密码正确
    print("\n=== 确认管理员账号 ===")
    admin = Admin.query.filter_by(username="admin").first()
    if admin:
        admin.password = generate_password_hash("123456")
        db.session.commit()
        print(f"  ✓ 管理员账号已确认: ID={admin.id}, 用户名=admin, 密码=123456")
    
    print("\n=== 测试账号创建完成 ===")
    print("可用测试账号:")
    print("  - admin / 123456 (管理员)")
    print("  - teacher / 123456 (教师)")
    print("  - student / 123456 (学生)")
