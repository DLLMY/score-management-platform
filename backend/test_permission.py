from app import app, db, Admin, User, ClassInfo, AdminClass
import requests

# 测试权限系统
def test_permissions():
    with app.app_context():
        # 获取所有学生
        all_students = User.query.all()
        print(f"系统中共有 {len(all_students)} 名学生")
        
        # 获取所有班级
        all_classes = ClassInfo.query.all()
        print(f"系统中共有 {len(all_classes)} 个班级: {[c.name for c in all_classes]}")
        
        # 获取张老师信息
        teacher1 = Admin.query.filter_by(username='teacher1').first()
        print(f"\n张老师信息: ID={teacher1.id}, 角色={teacher1.role}, 班级={teacher1.class_name}")
        
        # 获取张老师关联的班级
        admin_classes = AdminClass.query.filter_by(admin_id=teacher1.id).all()
        class_names = [link.class_info.name for link in admin_classes]
        print(f"张老师关联的班级: {class_names}")
        
        # 测试 API 权限过滤
        print("\n=== 测试教师账号权限 ===")
        
        # 测试获取班级列表（模拟教师登录）
        url = "http://127.0.0.1:5000/api/classes"
        headers = {'X-Admin-Id': str(teacher1.id)}
        
        try:
            response = requests.get(url, headers=headers)
            if response.status_code == 200:
                classes = response.json()
                print(f"教师可见班级数量: {len(classes)}")
                print(f"教师可见班级: {[c['name'] for c in classes]}")
            else:
                print(f"请求失败: {response.status_code}")
        except Exception as e:
            print(f"请求异常: {e}")
        
        # 测试获取学生列表（模拟教师登录）
        url = "http://127.0.0.1:5000/api/users?per_page=100"
        
        try:
            response = requests.get(url, headers=headers)
            if response.status_code == 200:
                data = response.json()
                users = data.get('users', [])
                total = data.get('total', 0)
                print(f"\n教师可见学生总数: {total}")
                print(f"当前页学生数量: {len(users)}")
                if users:
                    print("教师可见学生列表:")
                    for u in users:
                        print(f"  - {u['name']} ({u['class_name']})")
            else:
                print(f"请求失败: {response.status_code}")
        except Exception as e:
            print(f"请求异常: {e}")
        
        # 测试管理员账号权限
        print("\n=== 测试管理员账号权限 ===")
        admin = Admin.query.filter_by(username='admin').first()
        headers = {'X-Admin-Id': str(admin.id)}
        
        try:
            response = requests.get("http://127.0.0.1:5000/api/classes", headers=headers)
            if response.status_code == 200:
                classes = response.json()
                print(f"管理员可见班级数量: {len(classes)}")
            
            response = requests.get("http://127.0.0.1:5000/api/users", headers=headers)
            if response.status_code == 200:
                users = response.json()
                print(f"管理员可见学生数量: {len(users)}")
        except Exception as e:
            print(f"请求异常: {e}")

if __name__ == "__main__":
    test_permissions()
