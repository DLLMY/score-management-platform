#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
无缝 OTA 端到端验证（设备 <-> Broker <-> 后端）。

默认对接「生产云端 Broker」(nc5233fc.ala.cn-hangzhou.emqxsl.cn:8883, TLS)，
也可通过环境变量切到本地 Broker（docker-compose.mqtt.yml 起的 eclipse-mosquitto）。
用 paho 模拟一台「设备」，验证 P2 落地后的
「后端 -> Broker -> 设备 -> Broker -> 后端」无缝 OTA 全链路：

  1. 后端经 HTTP 触发 OTA 推送（/api/firmware/<id>/ota-upgrade，force=True）
     —— 推送 payload 含 id/url/version/md5/force/signature（signature 为
        HMAC-SHA256("{id}:{version}:{url}")，密钥 OTA_SIGNING_SECRET）。
  2. 设备（模拟）在 phonebox/ota/<dev> 实时收到指令，重算 HMAC 验签：
     - 密钥一致且签名匹配 -> 接受（证明 P2 设备↔后端签名契约对齐）
     - 签名缺失/不匹配 -> 拒绝（证明伪造指令被拦截）
  3. 设备回报状态 started -> success 到 phonebox/ota/<dev>/status。
  4. 后端 _process_ota_status 收到回报，写 DeviceFirmwareUpdate(completed) 并回写
     device.ota_status=idle（无缝闭环自愈）；脚本经 HTTP 轮询 /api/firmware/ota-status
     断言 completed 记录出现。

运行前提：
  # 1) 后端已运行并指向同一 Broker（默认即生产云端 Broker，与设备同 MQTTConfig）
  #    生产 Broker（EMQX Cloud，TLS 8883）：
  MQTT_BROKER=nc5233fc.ala.cn-hangzhou.emqxsl.cn MQTT_PORT=8883 MQTT_SSL=true \
    MQTT_USERNAME=phoneboxtest MQTT_PASSWORD=123456 \
    OTA_SIGNING_SECRET=<与设备侧一致的密钥> python run.py
  # 2) 跑本验证（默认即对接生产云端 Broker；可用 MQTT_BROKER/MQTT_PORT 覆盖为本地）
  OTA_SIGNING_SECRET=<同一密钥> \
    BACKEND_URL=http://127.0.0.1:5000 \
    ADMIN_USER=admin ADMIN_PASS=123456 \
    python scripts/verify_ota_e2e.py
  # 本地干净环境（避开生产 ~5000 msg/s 洪流）可用：
  MQTT_BROKER=127.0.0.1 MQTT_PORT=1883 MQTT_SSL=false \
    OTA_SIGNING_SECRET=<密钥> BACKEND_URL=http://127.0.0.1:5000 \
    python scripts/verify_ota_e2e.py

环境变量：
  MQTT_BROKER / MQTT_PORT / MQTT_USER / MQTT_PASS   云端 Broker 连接（默认 nc5233fc.ala.cn-hangzhou.emqxsl.cn:8883, phoneboxtest/123456）；本地覆盖为 127.0.0.1:1883 匿名
  MQTT_SSL / MQTT_CA_CERT                           TLS 开关（默认端口=8883 即开）；设 MQTT_CA_CERT 启用严格 CA 校验（默认 insecure 跳过校验）
  OTA_SIGNING_SECRET                              设备侧验签密钥（须与后端一致；空=两端均不校验）
  BACKEND_URL                                     后端基址（默认 http://127.0.0.1:5000）
  ADMIN_USER / ADMIN_PASS                         后端管理员账号（默认 admin/123456）
  DEVICE_ID                                       指定设备 ID；缺省自动生成唯一 ID
  FIRMWARE_ID                                     指定固件 ID；缺省取第一个 active 固件

退出码：0=全部通过，1=存在失败，2=环境不满足（如无 active 固件，需先上传）。

判定设计（复用 verify_mqtt_e2e.py 的「收发分离 + SUBACK 诊断」范式）：
  收包连接只订阅+收包，发包连接只发包，两条物理分离连接根除高延迟下收包饿死；
  回包到达内存即判定，绝不依赖易被写锁拖死的 mqtt_log 全表扫描。
"""
import atexit
import hashlib
import hmac
import json
import os
import ssl
import sys
import threading
import time
import urllib.request
import urllib.error

import paho.mqtt.client as mqtt

# ---------- 配置（环境变量覆盖）----------
# 默认对接生产云端 Broker（EMQX Cloud，TLS 8883）；本地干净环境用
#   MQTT_BROKER=127.0.0.1 MQTT_PORT=1883 MQTT_SSL=false 覆盖。
BROKER = os.getenv("MQTT_BROKER", "nc5233fc.ala.cn-hangzhou.emqxsl.cn")
PORT = int(os.getenv("MQTT_PORT", "8883"))
USE_TLS = os.getenv("MQTT_SSL", "true" if PORT == 8883 else "false").lower() == "true"
CA_CERT = os.getenv("MQTT_CA_CERT", "")               # 可选：EMQX Cloud CA 证书路径，设置后启用严格校验
USER = os.getenv("MQTT_USER", "phoneboxtest")
PASS = os.getenv("MQTT_PASS", "123456")
SECRET = os.getenv("OTA_SIGNING_SECRET", "")          # 设备侧验签密钥（须与后端一致）
BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:5000").rstrip("/")
ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASS = os.getenv("ADMIN_PASS", "123456")
DEVICE_ID = os.getenv("DEVICE_ID") or ("E2E_OTA_%d" % int(time.time()))
FIRMWARE_ID = os.getenv("FIRMWARE_ID")                 # 可选，缺省取首个 active

RUN_TS = int(time.time())
_lock = threading.Lock()
_sub_mid = {}            # mid -> topic（关联 SUBACK）
_received = []          # [(topic, payload)] 设备实时收到的 OTA 指令
_status_reported = []   # 设备已发出的状态回报（topic, payload）
client = None            # 收包连接
pub_client = None        # 发包连接


# ============================================================
# MQTT 设备侧（模拟 ESP32）
# ============================================================
def _on_connect(c, userdata, flags, rc):
    print(f"[DEVICE] connected rc={rc}")
    # 专属 topic + 广播 topic + 状态回报回执（验证后端收到状态）
    for t in ("phonebox/ota/%s" % DEVICE_ID, "phonebox/ota",
              "phonebox/ota/%s/status" % DEVICE_ID):
        try:
            _res, mid = c.subscribe(t, qos=1)
        except Exception as e:
            print(f"[DEVICE][SUB] topic={t} 订阅失败: {e}")
            continue
        _sub_mid[mid] = t
    print(f"[DEVICE] 已发起 {len(_sub_mid)} 个 OTA topic 订阅 (qos=1, 等待 SUBACK)")


def _on_subscribe(c, userdata, mid, granted_qos):
    topic = _sub_mid.get(mid, "<未知 mid=%s>" % mid)
    gq = list(granted_qos) if isinstance(granted_qos, (list, tuple)) else [granted_qos]
    status = "OK" if all(q == 1 for q in gq) else "WARN(授予QoS非1)"
    print(f"[DEVICE][SUBACK] topic={topic} granted_qos={gq} -> {status} (mid={mid})")


def _on_message(c, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
    except Exception:
        payload = {"_raw": msg.payload.decode()}
    with _lock:
        _received.append((msg.topic, payload))


def _verify_signature(payload):
    """设备侧验签：与后端 sign_ota_command 完全一致（msg = id:version:url）。"""
    sig = payload.get("signature", "")
    fw_id = payload.get("id")
    version = payload.get("version")
    url = payload.get("url") or payload.get("download_url")
    if not SECRET:
        # 两端均未配置密钥：后端签名应为空串，设备跳过校验仅告警
        return (sig == ""), ("未配置密钥, 跳过验签(仅告警)" if sig == "" else "未配置密钥但收到非空签名!")
    if not sig:
        return False, "缺少签名(可能被伪造/广播)"
    msg = f"{fw_id}:{version}:{url}".encode("utf-8")
    expect = hmac.new(SECRET.encode("utf-8"), msg, hashlib.sha256).hexdigest()
    ok = hmac.compare_digest(sig, expect)
    return ok, ("签名匹配" if ok else "签名不匹配(指令伪造)")


def _publish(topic, data):
    pub_client.publish(topic, json.dumps(data), qos=1)
    print(f"[DEVICE] -> publish {topic} {json.dumps(data, ensure_ascii=False)[:160]}")


# ============================================================
# HTTP 助手（urllib 标准库，无额外依赖）
# ============================================================
def _http(method, path, token=None, data=None, timeout=15):
    url = BACKEND_URL + path
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode("utf-8"))
        except Exception:
            return e.code, {}


def _login():
    st, body = _http("POST", "/api/auth/login", data={"username": ADMIN_USER, "password": ADMIN_PASS})
    if st != 200 or not body.get("success"):
        raise RuntimeError("登录失败 HTTP %s: %s" % (st, body.get("message")))
    return body["access_token"]


def _get_active_firmware(token):
    if FIRMWARE_ID:
        st, body = _http("GET", "/api/firmware/%s" % FIRMWARE_ID, token=token)
        if st == 200 and body.get("data"):
            f = body["data"]
            return f.get("id"), f.get("version")
        raise RuntimeError("指定 FIRMWARE_ID=%s 不存在" % FIRMWARE_ID)
    # 取首个 active 固件
    st, body = _http("GET", "/api/firmware", token=token)
    if st != 200:
        raise RuntimeError("获取固件列表失败 HTTP %s" % st)
    fw_list = (body.get("data") or {}).get("items") or body.get("data") or body.get("items") or []
    for f in fw_list:
        if f.get("is_active"):
            return f.get("id"), f.get("version")
    return None, None


# ============================================================
# 主流程
# ============================================================
def main():
    global client, pub_client
    token = _login()
    print(f"[SETUP] 已登录后端 {BACKEND_URL}（admin={ADMIN_USER}）")

    fid, fver = _get_active_firmware(token)
    if fid is None:
        print("[SKIP] 后端无 active 固件，请先上传并激活一个固件后再跑 OTA e2e（退出码 2）")
        return 2
    print(f"[SETUP] 选用 active 固件 id={fid} version={fver}")

    # 收包 / 发包 双连接（收发分离，根治高延迟收包饿死）
    client = mqtt.Client(client_id="e2e_ota_recv_%d" % RUN_TS, clean_session=True)
    pub_client = mqtt.Client(client_id="e2e_ota_pub_%d" % RUN_TS, clean_session=True)
    if USER:
        client.username_pw_set(USER, PASS)
        pub_client.username_pw_set(USER, PASS)
    if USE_TLS:
        if CA_CERT:
            client.tls_set(ca_certs=CA_CERT, cert_reqs=ssl.CERT_REQUIRED)
            pub_client.tls_set(ca_certs=CA_CERT, cert_reqs=ssl.CERT_REQUIRED)
            print(f"[TLS] 启用严格校验 (ca={CA_CERT})")
        else:
            client.tls_set(cert_reqs=ssl.CERT_NONE); client.tls_insecure_set(True)
            pub_client.tls_set(cert_reqs=ssl.CERT_NONE); pub_client.tls_insecure_set(True)
            print("[TLS] 启用(insecure, 跳过 CA 校验；生产建议设 MQTT_CA_CERT)")
    client.on_connect = _on_connect
    client.on_message = _on_message
    client.on_subscribe = _on_subscribe
    client.connect_async(BROKER, PORT, keepalive=60)
    pub_client.connect_async(BROKER, PORT, keepalive=60)
    client.loop_start(); pub_client.loop_start()
    time.sleep(4)  # 等双连接 + SUBACK

    # 注册设备（后端创建 Device 并触发协商；上报版本=active 版本以免被自动推送干扰）
    _publish("phonebox/ota/register", {
        "device_id": DEVICE_ID, "device_type": "phonebox",
        "fw_version": fver, "platform": "esp32",
    })
    print(f"[SETUP] 已上报设备注册 {DEVICE_ID}（fw={fver}），等待后端创建设备…")
    time.sleep(3)

    # 触发 OTA 推送（force=True，绕过版本/auto_update 检查）
    st, body = _http("POST", "/api/firmware/%s/ota-upgrade" % fid,
                     token=token, data={"device_ids": [DEVICE_ID]})
    if st != 200 or not (body.get("success") or body.get("data", {}).get("success")):
        print(f"[FAIL] 触发 OTA 推送失败 HTTP {st}: {body}")
        return 1
    print(f"[PUSH] 后端已向 {DEVICE_ID} 下发 OTA 指令（firmware {fid}）")

    # ---- 等待设备收到 OTA 指令 + 验签 ----
    results = []
    cmd = None
    deadline = time.time() + 30
    while time.time() < deadline:
        with _lock:
            if _received:
                cmd = _received[-1]
                break
        time.sleep(0.3)

    if cmd is None:
        results.append(("1.设备收到OTA指令", False, "30s 内未在 phonebox/ota/%s 收到指令" % DEVICE_ID))
    else:
        topic, pl = cmd
        ok_topic = topic in ("phonebox/ota/%s" % DEVICE_ID, "phonebox/ota")
        sig_ok, sig_msg = _verify_signature(pl)
        recv_ok = ok_topic and sig_ok and bool(pl.get("url")) and bool(pl.get("version"))
        detail = (f"topic={topic} version={pl.get('version')} url={str(pl.get('url'))[:40]}… "
                  f"md5={pl.get('md5')} sig={'有' if pl.get('signature') else '无'} -> {sig_msg}")
        results.append(("1.设备收到OTA指令+签名校验", recv_ok, detail))
        print(f"[DEVICE] 收到指令并验签: {'通过' if recv_ok else '拒绝'} ({sig_msg})")

        # ---- 设备回报状态：started -> success ----
        if recv_ok:
            _publish("phonebox/ota/%s/status" % DEVICE_ID, {
                "device_id": DEVICE_ID, "status": "started",
                "from_version": pl.get("md5") and "0.0.0", "to_version": pl.get("version"), "progress": 0,
            })
            time.sleep(1)
            _publish("phonebox/ota/%s/status" % DEVICE_ID, {
                "device_id": DEVICE_ID, "status": "success",
                "from_version": "0.0.0", "to_version": pl.get("version"), "progress": 100,
            })
            print(f"[DEVICE] 已回报 started -> success 到 phonebox/ota/{DEVICE_ID}/status")

    # ---- 等待后端闭环：ota-status 出现 completed 记录 ----
    completed = False
    deadline = time.time() + 30
    while time.time() < deadline:
        st, body = _http("GET", "/api/firmware/ota-status?device_id=%s" % DEVICE_ID, token=token)
        if st == 200:
            recent = (body.get("recent") or [])
            for r in recent:
                if r.get("device_id") == DEVICE_ID and r.get("status") == "completed":
                    completed = True
                    break
            if completed:
                break
        time.sleep(1.0)
    results.append(("2.后端闭环(ota_status=completed)", completed,
                    "后端已处理状态回报并落库 completed" if completed else "30s 内未见到 completed 记录"))

    # ---- 汇总 ----
    print("\n==================== 无缝 OTA 本地 Broker e2e 结果 ====================")
    all_ok = True
    for name, ok, detail in results:
        all_ok = all_ok and ok
        print(f"[{'PASS' if ok else 'FAIL'}] {name}\n        {detail}")
    print("===========================================================================")
    print("OVERALL:", "ALL PASS" if all_ok else "HAS FAILURE")
    return 0 if all_ok else 1


def _shutdown():
    for c in (client, pub_client):
        if c is not None:
            try:
                c.loop_stop(); c.disconnect()
            except Exception:
                pass


if __name__ == "__main__":
    atexit.register(_shutdown)
    try:
        rc = main()
    finally:
        _shutdown()
    sys.exit(rc if rc is not None else 1)
