#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
无缝 OTA 端到端验证（pytest 版，默认对接生产云端 Broker）。

分两层：
  1) 确定性「签名契约」单测（TestOTASignatureContract）—— 无需任何 Broker，
     在任意环境（含本机 Windows）即可运行，验证 P2 落地的「后端 sign_ota_command
     ⇔ 设备侧 HMAC 验签」字节级一致，以及缺密钥/被篡改时的拒绝行为。这是 P2 最
     易回归、也最该常驻 CI 的部分。
  2) 全链路 e2e（TestOTAE2ELocalBroker）—— 默认对接生产云端 Broker
     （nc5233fc.ala.cn-hangzhou.emqxsl.cn:8883, TLS）。Broker 不可达时整类自动 skip，
     不污染全量套件；可达时真实跑通
     「后端 publish_ota_command -> Broker -> 设备收包验签 -> 设备回报状态 -> 后端路由」。
     也可用 OTA_E2E_BROKER=127.0.0.1:1883 切到本地干净 Broker（避开生产洪流）。

运行：
  # 仅跑确定性签名契约（无需 broker）
  python -m pytest backend/tests/test_ota_e2e_local_broker.py -v
  # 全链路（默认云端 Broker；本地覆盖）
  OTA_E2E_BROKER=127.0.0.1:1883 MQTT_SSL=false python -m pytest backend/tests/test_ota_e2e_local_broker.py -v
"""
import hashlib
import hmac
import json
import os
import socket
import ssl
import threading
import time
import types

import pytest

# backend 包可导入（conftest 已 insert basedir，这里再保险一次）
sys_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if sys_path not in __import__("sys").path:
    __import__("sys").path.insert(0, sys_path)

SECRET = "e2e-p3-signing-secret"
DEV_ID = "E2E_P3_%d" % int(time.time())

# 全链路默认走「本地干净 Broker」(127.0.0.1:1883, 需 docker compose 起)，避免 CI/常规跑误打生产。
# 手动对云端 Broker 验证：OTA_E2E_BROKER=nc5233fc.ala.cn-hangzhou.emqxsl.cn:8883 OTA_E2E_SSL=true
E2E_BROKER = os.getenv("OTA_E2E_BROKER", "127.0.0.1:1883")
E2E_SSL = os.getenv("OTA_E2E_SSL", "true" if E2E_BROKER.endswith(":8883") else "false").lower() == "true"
E2E_USER = os.getenv("OTA_E2E_USER", "phoneboxtest")
E2E_PASS = os.getenv("OTA_E2E_PASS", "123456")


# ============================================================
# 1) 确定性签名契约（无需 broker）
# ============================================================
class TestOTASignatureContract:
    """验证后端签名与设备侧验签契约对齐（P2 核心，防回归）。"""

    def test_sign_matches_device_recompute(self, monkeypatch):
        import services.ota_negotiation_service as svc
        from services.ota_negotiation_service import sign_ota_command

        monkeypatch.setattr(svc, "OTA_SIGNING_SECRET", SECRET)
        fw = types.SimpleNamespace(id=7, version="2.6", md5="a" * 32)
        url = "http://broker.local/fw/phonebox_2.6.bin"

        sig = sign_ota_command(fw, url)
        # 设备侧重算（固件 verifyOtaSignature 的等价 Python 实现）
        expect = hmac.new(
            SECRET.encode("utf-8"),
            f"{fw.id}:{fw.version}:{url}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        assert sig == expect
        assert sig != ""  # 配了密钥就必须出非空签名

    def test_sign_empty_when_no_secret(self, monkeypatch):
        import services.ota_negotiation_service as svc
        from services.ota_negotiation_service import sign_ota_command

        monkeypatch.setattr(svc, "OTA_SIGNING_SECRET", "")
        fw = types.SimpleNamespace(id=7, version="2.6", md5="a" * 32)
        assert sign_ota_command(fw, "http://x/y.bin") == ""

    def test_device_rejects_tampered_signature(self, monkeypatch):
        """URL 被篡改时，设备重算的 HMAC 与指令签名对不上 -> 应拒绝（防伪造/广播注入）。"""
        import services.ota_negotiation_service as svc
        from services.ota_negotiation_service import sign_ota_command

        monkeypatch.setattr(svc, "OTA_SIGNING_SECRET", SECRET)
        fw = types.SimpleNamespace(id=7, version="2.6", md5="a" * 32)
        url = "http://broker.local/fw/phonebox_2.6.bin"
        sig = sign_ota_command(fw, url)  # 基于正确 url 的签名

        tampered_url = "http://evil/fw/phonebox_2.6.bin"
        expect_tampered = hmac.new(
            SECRET.encode("utf-8"),
            f"{fw.id}:{fw.version}:{tampered_url}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        assert sig != expect_tampered  # 篡改后签名对不上 -> 设备应拒绝


# ============================================================
# 2) 全链路 e2e（需可达的本地 Broker，否则整类 skip）
# ============================================================
class TestOTAE2ELocalBroker:
    """真实 Broker 下的「后端 -> 设备 -> 后端」无缝 OTA 闭环。

    无 Broker 时自动 skip；有 Broker 时验证 topic 路由 + 签名契约 + 状态返回链路。
    """

    BROKER = E2E_BROKER

    @pytest.fixture(scope="class")
    def broker(self):
        host, _, port_s = self.BROKER.partition(":")
        port = int(port_s) if port_s else 1883
        try:
            s = socket.create_connection((host, port), timeout=2)
            s.close()
        except OSError:
            pytest.skip(
                "MQTT Broker 不可达 %s（本地可用 `docker compose -f docker-compose.mqtt.yml up -d`"
                " 或设 OTA_E2E_BROKER=127.0.0.1:1883）" % self.BROKER
            )
        yield host, port

    def test_publish_receive_signature_status_loop(self, broker, monkeypatch):
        import paho.mqtt.client as mqtt
        import services.ota_negotiation_service as svc
        from services.ota_negotiation_service import sign_ota_command
        from services.mqtt_manager import mqtt_manager

        host, port = broker
        monkeypatch.setattr(svc, "OTA_SIGNING_SECRET", SECRET)

        received = []
        evt = threading.Event()
        # 设备客户端：既订阅收指令、又发布状态回报（减少并发连接数，避免触发云端 Broker 连接上限）
        rec_c = mqtt.Client(client_id="p3_recv_%d" % int(time.time()), clean_session=True)
        if E2E_SSL:
            rec_c.tls_set(cert_reqs=ssl.CERT_NONE); rec_c.tls_insecure_set(True)
        rec_c.username_pw_set(E2E_USER, E2E_PASS)

        # 后端侧订阅者：模拟 MQTTManager 控制连接对 phonebox/ota/# 的订阅。
        # 探针已验证该订阅在云端 Broker 上被授予且能收到嵌套 status topic。
        be_recv = []
        be_evt = threading.Event()
        be_c = mqtt.Client(client_id="p3_be_%d" % int(time.time()), clean_session=True)
        if E2E_SSL:
            be_c.tls_set(cert_reqs=ssl.CERT_NONE); be_c.tls_insecure_set(True)
        be_c.username_pw_set(E2E_USER, E2E_PASS)

        def on_connect(c, u, f, rc):
            c.subscribe("phonebox/ota/%s" % DEV_ID, qos=1)

        def on_be_connect(c, u, f, rc):
            c.subscribe("phonebox/ota/#", qos=1)

        def on_msg(c, u, msg):
            try:
                pl = json.loads(msg.payload.decode())
            except Exception:
                return
            if msg.topic == "phonebox/ota/%s" % DEV_ID:
                received.append(pl)
                evt.set()

        def on_be_msg(c, u, msg):
            be_recv.append(msg.topic)
            be_evt.set()

        rec_c.on_connect = on_connect
        rec_c.on_message = on_msg
        be_c.on_connect = on_be_connect
        be_c.on_message = on_be_msg
        rec_c.connect(host, port, 60); rec_c.loop_start()
        be_c.connect(host, port, 60); be_c.loop_start()
        time.sleep(2)

        # 后端经 MQTTManager 下发 OTA 指令（关闭重连，避免遗留线程）
        mqtt_manager._should_reconnect = False
        mqtt_manager.disconnect()
        mqtt_manager.set_config({
            "broker": host, "port": port, "client_id": "p3_backend",
            "username": E2E_USER, "password": E2E_PASS, "ssl": E2E_SSL,
            "timeout": 10, "keepalive": 60, "transport": "tcp",
        })
        mqtt_manager.connect()
        deadline = time.time() + 10
        while not mqtt_manager.is_connected and time.time() < deadline:
            time.sleep(0.2)
        assert mqtt_manager.is_connected, "后端 MQTTManager 未连上 Broker"

        # 构造与后端 ota-upgrade 端点一致的 payload
        fw = types.SimpleNamespace(id=7, version="2.6", md5="a" * 32)
        url = "http://broker.local/fw/phonebox_2.6.bin"
        sig = sign_ota_command(fw, url)
        payload = {
            "id": fw.id, "url": url, "download_url": "/api/firmware/download/7",
            "version": fw.version, "md5": fw.md5, "is_mandatory": False, "force": True,
        }
        if sig:
            payload["signature"] = sig
        assert mqtt_manager.publish_ota_command(DEV_ID, payload), "publish_ota_command 失败"

        # 1) 设备应收到并验签通过（publish -> Broker -> 设备）
        assert evt.wait(timeout=15), "设备未在 15s 内收到 OTA 指令"
        pl = received[0]
        msg = f"{pl.get('id')}:{pl.get('version')}:{pl.get('url')}".encode("utf-8")
        expect = hmac.new(SECRET.encode("utf-8"), msg, hashlib.sha256).hexdigest()
        assert hmac.compare_digest(pl.get("signature", ""), expect), "设备侧验签失败（P2 契约不一致）"

        # 2) 设备回报状态 -> 后端侧订阅者（phonebox/ota/#）应经 Broker 收到（返回链路）
        status_topic = "phonebox/ota/%s/status" % DEV_ID
        rec_c.publish(
            status_topic,
            json.dumps({
                "device_id": DEV_ID, "status": "success",
                "from_version": "0.0.0", "to_version": "2.6", "progress": 100,
            }),
            qos=1,
        )
        # 注意：be_evt 会被「指令 topic」(phonebox/ota/<id>) 抢先置位（# 订阅也匹配指令），
        # 故必须专门等待 status topic 出现，而非依赖 be_evt。
        deadline = time.time() + 15
        while status_topic not in be_recv and time.time() < deadline:
            time.sleep(0.2)
        assert status_topic in be_recv, "后端侧订阅者未收到设备 OTA 状态回报（返回链路未接通）"

        # 3) 离线验证：管理器路由逻辑确实把该 topic 派发到 _process_ota_status
        routed = []
        monkeypatch.setattr(mqtt_manager, "_process_ota_status", lambda t, m: routed.append(t))
        mqtt_manager._process_critical_message(
            "phonebox/ota/%s/status" % DEV_ID,
            json.dumps({"device_id": DEV_ID, "status": "success"}),
        )
        assert routed and routed[0] == "phonebox/ota/%s/status" % DEV_ID, \
            "管理器未将 status topic 路由到 _process_ota_status"

        rec_c.loop_stop(); rec_c.disconnect()
        be_c.loop_stop(); be_c.disconnect()
        mqtt_manager.disconnect()
