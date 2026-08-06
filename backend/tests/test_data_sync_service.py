try:
    from models import db, ClassInfo, User, Admin
except ImportError:
    pass

try:
    from services.data_sync_service import DataSyncService
except ImportError:
    pass

try:
    from models import AdminClass
except ImportError:
    pass

try:
    from models import CourseSchedule
except ImportError:
    pass

try:
    from utils.security import hash_password
except ImportError:
    pass



class TestDataSyncService:

    def test_sync_class_name_change(self, app):
        with app.app_context():
            from models import db, ClassInfo, User, Admin
            from services.data_sync_service import DataSyncService

            class_info = ClassInfo(
                name='旧班级',
                grade='初一',
                is_active=True
            )
            db.session.add(class_info)

            user1 = User(
                name='学生1',
                card_id='SYNC001',
                class_name='旧班级',
                current_score=100
            )
            user2 = User(
                name='学生2',
                card_id='SYNC002',
                class_name='旧班级',
                current_score=80
            )
            admin1 = Admin(
                username='admin_sync1',
                password='password',
                role='admin',
                real_name='教师1',
                phone='13800138001',
                class_name='旧班级'
            )
            db.session.add_all([user1, user2, admin1])
            db.session.commit()

            stats = DataSyncService.sync_class_name_change(class_info, '旧班级', '新班级')

            assert stats['users_updated'] == 2
            assert stats['admins_updated'] == 1
            assert len(stats['errors']) == 0

            updated_users = User.query.filter_by(class_name='新班级').all()
            assert len(updated_users) == 2

            updated_admin = Admin.query.filter_by(class_name='新班级').first()
            assert updated_admin is not None

            db.session.rollback()

    def test_sync_class_name_change_same_name(self, app):
        with app.app_context():

            class_info = ClassInfo(
                name='班级A',
                grade='初一',
                is_active=True
            )
            db.session.add(class_info)
            db.session.commit()

            stats = DataSyncService.sync_class_name_change(class_info, '班级A', '班级A')

            assert stats['users_updated'] == 0
            assert stats['admins_updated'] == 0

            db.session.rollback()

    def test_sync_new_class_creation(self, app):
        with app.app_context():
            from models import AdminClass

            user1 = User(
                name='学生1',
                card_id='SYNC003',
                class_name='新建班级',
                current_score=100
            )
            admin1 = Admin(
                username='admin_sync2',
                password='password',
                role='admin',
                real_name='教师2',
                phone='13800138002',
                class_name='新建班级'
            )
            db.session.add_all([user1, admin1])
            db.session.commit()

            new_class = ClassInfo(
                name='新建班级',
                grade='初二',
                is_active=True
            )
            db.session.add(new_class)
            db.session.commit()

            stats = DataSyncService.sync_new_class_creation(new_class)

            assert stats['users_linked'] == 1
            assert stats['admins_linked'] == 1
            assert stats['admin_classes_created'] == 1

            updated_user = User.query.filter_by(card_id='SYNC003').first()
            assert updated_user.class_info_id == new_class.id

            updated_admin = Admin.query.filter_by(username='admin_sync2').first()
            assert updated_admin.primary_class_id == new_class.id

            admin_class = AdminClass.query.filter_by(
                admin_id=updated_admin.id,
                class_info_id=new_class.id
            ).first()
            assert admin_class is not None
            assert admin_class.is_primary is True

            db.session.rollback()

    def test_sync_class_deletion(self, app):
        with app.app_context():
            from models import CourseSchedule

            class_info = ClassInfo(
                name='待删除班级',
                grade='初三',
                is_active=True
            )
            db.session.add(class_info)
            db.session.commit()

            user1 = User(
                name='学生3',
                card_id='SYNC004',
                class_name='待删除班级',
                class_info_id=class_info.id,
                current_score=100
            )
            admin1 = Admin(
                username='admin_sync3',
                password='password',
                role='admin',
                real_name='教师3',
                phone='13800138003',
                class_name='待删除班级',
                primary_class_id=class_info.id
            )
            admin_class = AdminClass(
                admin_id=1,
                class_info_id=class_info.id,
                is_primary=True
            )
            schedule = CourseSchedule(
                class_info_id=class_info.id,
                subject_id=1,
                day_of_week=1,
                period_number=1,
                teacher_name='教师3'
            )
            db.session.add_all([user1, admin1, admin_class, schedule])
            db.session.commit()

            stats = DataSyncService.sync_class_deletion(class_info)

            assert stats['users_unlinked'] >= 1
            assert stats['admins_unlinked'] >= 1
            assert stats['admin_classes_deleted'] >= 1
            assert stats['course_schedules_deleted'] >= 1

            updated_user = User.query.filter_by(card_id='SYNC004').first()
            assert updated_user.class_info_id is None
            assert updated_user.class_name == '待删除班级'

            db.session.rollback()

    def test_sync_user_class_change(self, app):
        with app.app_context():

            user = User(
                name='学生4',
                card_id='SYNC005',
                class_name='原班级',
                current_score=100
            )
            db.session.add(user)
            db.session.commit()

            stats = DataSyncService.sync_user_class_change(user, '原班级', '新班级B')

            assert stats['linked'] is True
            assert stats['class_created'] is True
            assert stats['class_info_id'] is not None

            class_info = ClassInfo.query.filter_by(name='新班级B').first()
            assert class_info is not None
            assert user.class_info_id == class_info.id

            db.session.rollback()

    def test_sync_user_class_change_existing_class(self, app):
        with app.app_context():

            class_info = ClassInfo(
                name='已有班级',
                grade='初二',
                is_active=True
            )
            db.session.add(class_info)

            user = User(
                name='学生5',
                card_id='SYNC006',
                class_name='原班级',
                current_score=100
            )
            db.session.add(user)
            db.session.commit()

            stats = DataSyncService.sync_user_class_change(user, '原班级', '已有班级')

            assert stats['linked'] is True
            assert stats['class_created'] is False
            assert stats['class_info_id'] == class_info.id

            assert user.class_info_id == class_info.id

            db.session.rollback()

    def test_sync_user_class_change_remove(self, app):
        with app.app_context():

            class_info = ClassInfo(
                name='班级C',
                grade='初一',
                is_active=True
            )
            db.session.add(class_info)

            user = User(
                name='学生6',
                card_id='SYNC007',
                class_name='班级C',
                class_info_id=class_info.id,
                current_score=100
            )
            db.session.add(user)
            db.session.commit()

            stats = DataSyncService.sync_user_class_change(user, '班级C', None)

            assert stats['linked'] is False
            assert stats['class_created'] is False
            assert stats['class_info_id'] is None
            assert user.class_info_id is None

            db.session.rollback()

    def test_sync_admin_class_change(self, app):
        with app.app_context():
            from utils.security import hash_password

            admin = Admin(
                username='admin_sync4',
                password=hash_password('password'),
                role='admin',
                real_name='教师4',
                phone='13800138004',
                class_name='原班级'
            )
            db.session.add(admin)
            db.session.commit()

            stats = DataSyncService.sync_admin_class_change(admin, '原班级', '新班级D')

            assert stats['linked'] is True
            assert stats['class_created'] is True
            assert stats['admin_class_created'] is True

            class_info = ClassInfo.query.filter_by(name='新班级D').first()
            assert class_info is not None
            assert admin.primary_class_id == class_info.id

            admin_class = AdminClass.query.filter_by(
                admin_id=admin.id,
                class_info_id=class_info.id
            ).first()
            assert admin_class is not None

            db.session.rollback()

    def test_sync_admin_class_change_existing(self, app):
        with app.app_context():

            class_info = ClassInfo(
                name='已有班级B',
                grade='初三',
                is_active=True
            )
            db.session.add(class_info)

            admin = Admin(
                username='admin_sync5',
                password=hash_password('password'),
                role='admin',
                real_name='教师5',
                phone='13800138005',
                class_name='原班级'
            )
            db.session.add(admin)
            db.session.commit()

            stats = DataSyncService.sync_admin_class_change(admin, '原班级', '已有班级B')

            assert stats['linked'] is True
            assert stats['class_created'] is False

            assert admin.primary_class_id == class_info.id

            db.session.rollback()

    def test_get_class_students(self, app):
        with app.app_context():

            class_info = ClassInfo(
                name='班级E',
                grade='初一',
                is_active=True
            )
            db.session.add(class_info)
            db.session.commit()
            db.session.refresh(class_info)

            user1 = User(
                name='学生7',
                card_id='SYNC008',
                class_name='班级E',
                class_info_id=class_info.id,
                current_score=100,
                is_active=True
            )
            user2 = User(
                name='学生8',
                card_id='SYNC009',
                class_name='班级E',
                class_info_id=class_info.id,
                current_score=80,
                is_active=False
            )
            db.session.add_all([user1, user2])
            db.session.commit()

            students = DataSyncService.get_class_students(class_info.id)

            assert len(students) == 1
            assert students[0].name == '学生7'

            db.session.rollback()

    def test_get_class_teachers(self, app):
        with app.app_context():

            class_info = ClassInfo(
                name='班级F',
                grade='初二',
                is_active=True
            )
            db.session.add(class_info)
            db.session.commit()
            db.session.refresh(class_info)

            admin1 = Admin(
                username='admin_sync6',
                password=hash_password('password'),
                role='admin',
                real_name='教师6',
                phone='13800138006',
                primary_class_id=class_info.id
            )
            admin2 = Admin(
                username='admin_sync7',
                password=hash_password('password'),
                role='admin',
                real_name='教师7',
                phone='13800138007',
                primary_class_id=None
            )
            db.session.add_all([admin1, admin2])
            db.session.commit()

            teachers = DataSyncService.get_class_teachers(class_info.id)

            assert len(teachers) == 1
            assert teachers[0].username == 'admin_sync6'

            db.session.rollback()

    def test_get_teacher_classes(self, app):
        with app.app_context():

            class_info = ClassInfo(
                name='班级G',
                grade='初三',
                is_active=True
            )
            db.session.add(class_info)
            db.session.commit()
            db.session.refresh(class_info)

            admin = Admin(
                username='admin_sync8',
                password=hash_password('password'),
                role='admin',
                real_name='教师8',
                phone='13800138008',
                primary_class_id=class_info.id
            )
            db.session.add(admin)
            db.session.commit()
            db.session.refresh(admin)

            classes = DataSyncService.get_teacher_classes(admin.id)

            assert len(classes) == 1
            assert classes[0].name == '班级G'

            db.session.rollback()

    def test_get_teacher_classes_no_class(self, app):
        with app.app_context():

            admin = Admin(
                username='admin_sync9',
                password=hash_password('password'),
                role='admin',
                real_name='教师9',
                phone='13800138009',
                primary_class_id=None
            )
            db.session.add(admin)
            db.session.commit()

            classes = DataSyncService.get_teacher_classes(admin.id)

            assert len(classes) == 0

            db.session.rollback()
