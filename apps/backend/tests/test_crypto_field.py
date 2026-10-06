"""R13 回归：敏感字段静态加密（at-rest encryption）。

覆盖：
- 纯函数层 encrypt/decrypt 往返、None、向后兼容明文、密文幂等；
- MQTTConfig.password 落库为密文、读取透明解密、to_dict 不含密码；
- Device.device_secret 经 issue_device_secret 落库为密文、读取透明解密。
"""
from sqlalchemy import text

from models import Device, MQTTConfig, db
from utils.crypto_field import decrypt_value, encrypt_value


def test_encrypt_decrypt_value_roundtrip(app):
    # 加解密依赖 current_app.config["SECRET_KEY"]，必须在 app 上下文中验证。
    with app.app_context():
        assert encrypt_value(None) is None
        assert decrypt_value(None) is None

        enc = encrypt_value("hello")
        assert enc.startswith("enc:")
        assert enc != "hello"
        assert decrypt_value(enc) == "hello"

        # 无前缀明文原样返回（向后兼容既有明文行）
        assert decrypt_value("plain") == "plain"
        # 已是密文不重复加密（幂等）
        assert encrypt_value(enc) == enc


def test_mqtt_password_encrypted_at_rest(app):
    with app.app_context():
        cfg = MQTTConfig(broker="tcp://broker", password="supersecret")
        db.session.add(cfg)
        db.session.commit()

        raw = db.session.execute(
            text(f"SELECT password FROM {MQTTConfig.__tablename__} WHERE id=:i"),
            {"i": cfg.id},
        ).scalar()
        assert raw.startswith("enc:"), "密码应以密文落库"
        assert raw != "supersecret"

        # 读取透明解密
        db.session.expire(cfg)
        assert cfg.password == "supersecret"
        # to_dict 不含密码（序列化不泄露）
        assert "password" not in cfg.to_dict()


def test_device_secret_encrypted_at_rest(app):
    with app.app_context():
        dev = Device(device_id="enc-dev-1")
        db.session.add(dev)
        db.session.commit()

        from utils.device_auth import issue_device_secret

        secret = issue_device_secret(dev, commit=True)
        assert secret

        # 透明读取解密
        assert dev.device_secret == secret

        raw = db.session.execute(
            text(f"SELECT device_secret FROM {Device.__tablename__} WHERE id=:i"),
            {"i": dev.id},
        ).scalar()
        assert raw.startswith("enc:") and raw != secret
