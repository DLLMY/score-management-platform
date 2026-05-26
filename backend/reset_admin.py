import sys
sys.path.insert(0, '.')

from app import app, db, Admin

with app.app_context():
    admin = Admin.query.filter_by(username='admin').first()
    
    if admin:
        print(f"找到管理员: {admin.username}")
        print(f"当前密码: {admin.password}")
        
        admin.password = 'admin123'
        db.session.commit()
        print("密码已重置为: admin123")
    else:
        print("管理员不存在，创建新管理员...")
        new_admin = Admin(
            username='admin',
            password='admin123',
            role='admin',
            real_name='系统管理员',
            phone='13800138000'
        )
        db.session.add(new_admin)
        db.session.commit()
        print("管理员已创建，密码: admin123")

print("操作完成！")