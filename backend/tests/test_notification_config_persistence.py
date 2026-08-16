"""通知配置持久化测试。

覆盖回归：
- PUT /api/notification-config/ 更新后：current_app.config 生效 + notification_config 表落库
- GET 返回配置
- 掩码值("***")不覆盖 DB 中已保存的真实密钥
- 启动加载：DB 行能回灌 current_app.config（模拟重启后配置不丢）
"""
from models.notification_config import NotificationConfig
from services.notification_config_store import load_notification_config_to_app


def test_put_persists_config(app, client, auth_headers):
    """更新通知配置 → 内存生效且落库。"""
    resp = client.put(
        "/api/notification-config/",
        json={
            "wechat_appid": "wx_test_appid",
            "template_unlock_success": "TPL_UNLOCK_OK",
            "enable_sms_notification": True,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200

    # 内存生效
    assert app.config.get("WECHAT_APPID") == "wx_test_appid"
    assert app.config.get("WECHAT_TEMPLATE_UNLOCK_SUCCESS") == "TPL_UNLOCK_OK"
    assert app.config.get("ENABLE_SMS_NOTIFICATION") is True

    # 落库
    with app.app_context():
        row = NotificationConfig.query.get(1)
        assert row is not None
        assert row.wechat_appid == "wx_test_appid"
        assert row.template_unlock_success == "TPL_UNLOCK_OK"
        assert row.enable_sms_notification is True


def test_get_returns_config(app, client, auth_headers):
    resp = client.get("/api/notification-config/", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data.get("success") is True
    config = data["data"]["config"]
    assert "wechat_appid" in config
    assert "sms_provider" in config


def test_mask_secret_does_not_overwrite(app, client, auth_headers):
    """掩码 wechat_secret("***") 不覆盖已保存的真实密钥。"""
    with app.app_context():
        row = NotificationConfig.query.get(1)
        if row is None:
            row = NotificationConfig(id=1)
        row.wechat_secret = "real_secret_value"
        from models import db

        db.session.add(row)
        db.session.commit()

    resp = client.put(
        "/api/notification-config/",
        json={"wechat_secret": "***", "wechat_appid": "wx_appid_2"},
        headers=auth_headers,
    )
    assert resp.status_code == 200

    with app.app_context():
        row = NotificationConfig.query.get(1)
        assert row.wechat_secret == "real_secret_value"
        assert row.wechat_appid == "wx_appid_2"


def test_load_from_db_restores_config(app, client, auth_headers):
    """模拟重启：DB 行存在 → 启动加载回灌 current_app.config。"""
    with app.app_context():
        row = NotificationConfig.query.get(1)
        if row is None:
            row = NotificationConfig(id=1)
        row.wechat_appid = "wx_restore_appid"
        row.enable_wechat_notification = False
        from models import db

        db.session.add(row)
        db.session.commit()

    # 模拟进程重启后的配置加载
    app.config["WECHAT_APPID"] = ""
    app.config["ENABLE_WECHAT_NOTIFICATION"] = True
    load_notification_config_to_app(app)

    assert app.config.get("WECHAT_APPID") == "wx_restore_appid"
    assert app.config.get("ENABLE_WECHAT_NOTIFICATION") is False
