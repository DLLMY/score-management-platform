from datetime import datetime
import uuid
try:
    from models import User, StudentCluster, db
except ImportError:
    pass

try:
    from models import ScoreRule
except ImportError:
    pass

try:
    from models import ScoreRecord
except ImportError:
    pass

try:
    from models import Admin
except ImportError:
    pass

try:
    from utils.security import hash_password
except ImportError:
    pass

try:
    from models import ClassInfo
except ImportError:
    pass

try:
    from models import Device
except ImportError:
    pass

try:
    from models import NLPScoringRule
except ImportError:
    pass

try:
    from models import MQTTConfig
except ImportError:
    pass


class TestModels:

    def test_user_model(self, app):
        with app.app_context():
            from models import User, StudentCluster, db
            user = User(
                name='Test User',
                gender='男',
                class_name='测试班级',
                phone='13800138001',
                card_id='C001',
                current_score=100
            )
            db.session.add(user)
            db.session.commit()

            retrieved = User.query.filter_by(name='Test User').first()
            assert retrieved is not None
            assert retrieved.name == 'Test User'
            assert retrieved.current_score == 100
            assert retrieved.is_active is True

            StudentCluster.query.filter_by(user_id=retrieved.id).delete()
            db.session.delete(retrieved)
            db.session.commit()

    def test_score_rule_model(self, app):
        with app.app_context():
            from models import ScoreRule
            rule = ScoreRule(
                name='Test Rule',
                score=5,
                description='Test rule description',
                category_id=1,
                daily_limit=10,
                min_interval=300
            )
            db.session.add(rule)
            db.session.commit()

            retrieved = ScoreRule.query.filter_by(name='Test Rule').first()
            assert retrieved is not None
            assert retrieved.score == 5

            db.session.delete(retrieved)
            db.session.commit()

    def test_score_record_model(self, app):
        with app.app_context():
            from models import ScoreRecord

            user = User(
                name='Record User',
                gender='女',
                class_name='测试班级',
                phone='13800138002',
                card_id='C002',
                current_score=50
            )
            db.session.add(user)

            rule = ScoreRule(
                name='Record Rule',
                score=5,
                description='Rule for testing',
                category_id=1
            )
            db.session.add(rule)
            db.session.commit()

            record = ScoreRecord(
                user_id=user.id,
                rule_id=rule.id,
                score_change=5,
                description='Test record',
                operator='admin'
            )
            db.session.add(record)
            db.session.commit()

            retrieved = ScoreRecord.query.filter_by(user_id=user.id).first()
            assert retrieved is not None
            assert retrieved.score_change == 5

            db.session.delete(retrieved)
            db.session.delete(rule)
            StudentCluster.query.filter_by(user_id=user.id).delete()
            db.session.delete(user)
            db.session.commit()

    def test_admin_model(self, app):
        with app.app_context():
            from models import Admin
            from utils.security import hash_password

            # 清除共享 :memory: 会话中前序用例可能遗留的 PendingRollback/脏状态，
            # 使本测试与执行顺序无关（全量套件中前序失败可能使会话进入回滚态）。
            # 注意：仅 rollback 不会移除“从未 flush 的 pending 对象”，而某些前序用例
            # 会往共享 db.session 里 add 一个 admin_id=None 的 AdminRole 却不提交，
            # 它一直以 pending 状态残留；下次任意 commit 的 flush 会连带插入它并触发
            # NOT NULL 约束失败。故用 expunge_all() 彻底清空所有游离实例。
            db.session.rollback()
            db.session.expunge_all()

            # 使用唯一 username，避免与共享 :memory: DB 中前序用例残留的同名
            # Admin 触发唯一约束冲突（IntegrityError），使测试与顺序无关。
            unique_username = 'testadmin_' + uuid.uuid4().hex[:12]
            admin = Admin(
                username=unique_username,
                password=hash_password('test123'),
                role='teacher',
                real_name='Test Admin',
                phone='13800138003'
            )
            db.session.add(admin)
            db.session.commit()

            retrieved = Admin.query.filter_by(username=unique_username).first()
            assert retrieved is not None
            assert retrieved.role == 'teacher'

    def test_class_model(self, app):
        with app.app_context():
            from models import ClassInfo

            cls = ClassInfo(
                name='Test Class',
                grade='一年级',
                is_active=True
            )
            db.session.add(cls)
            db.session.commit()

            retrieved = ClassInfo.query.filter_by(name='Test Class').first()
            assert retrieved is not None
            assert retrieved.grade == '一年级'
            assert retrieved.is_active is True

            db.session.delete(retrieved)
            db.session.commit()

    def test_device_model(self, app):
        with app.app_context():
            from models import Device

            device = Device(
                device_id='TEST_DEVICE_001',
                name='Test Device',
                ip_address='192.168.1.100',
                status='online',
                last_heartbeat=datetime.now()
            )
            db.session.add(device)
            db.session.commit()

            retrieved = Device.query.filter_by(device_id='TEST_DEVICE_001').first()
            assert retrieved is not None
            assert retrieved.status == 'online'

            db.session.delete(retrieved)
            db.session.commit()

    def test_nlp_scoring_rule_model(self, app):
        with app.app_context():
            from models import NLPScoringRule

            rule = NLPScoringRule(
                behavior_keyword='迟到',
                behavior_description='迟到扣分规则',
                score_value=-5,
                score_type='deduct',
                behavior_tags=['迟到'],
                match_pattern='.*迟到.*',
                priority=10
            )
            db.session.add(rule)
            db.session.commit()

            retrieved = NLPScoringRule.query.filter_by(behavior_keyword='迟到').first()
            assert retrieved is not None
            assert retrieved.score_type == 'deduct'
            assert retrieved.priority == 10

            db.session.delete(retrieved)
            db.session.commit()

    def test_mqtt_config_model(self, app):
        with app.app_context():
            from models import MQTTConfig

            config = MQTTConfig(
                broker='test.broker.com',
                port=1883,
                client_id='test_client',
                username='test_user',
                password='test_pass',
                ssl=False
            )
            db.session.add(config)
            db.session.commit()

            retrieved = MQTTConfig.query.filter_by(client_id='test_client').first()
            assert retrieved is not None
            assert retrieved.ssl is False

            db.session.delete(retrieved)
            db.session.commit()
