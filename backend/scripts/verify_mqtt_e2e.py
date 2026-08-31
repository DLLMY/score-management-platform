#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
MQTT 端到端真机验证（设备 <-> EMQX Cloud Broker <-> 后端）。

用 paho-mqtt 模拟一台"设备"，对接 Broker（默认生产 Broker，与后端同一 MQTTConfig：
nc5233fc.ala.cn-hangzhou.emqxsl.cn:8883, TLS, phoneboxtest/123456），
发布业务 topic，并断言后端 handle_mqtt_message 在真实 Broker 上收到请求并回发结果。

本地干净环境验证（无生产洪流干扰）可用环境变量覆盖：
  MQTT_BROKER=127.0.0.1 MQTT_PORT=8883 MQTT_USER= MQTT_PASS= python scripts/verify_mqtt_e2e.py
此时需先把后端 mqtt_config 指向同一本地 Broker（见 local_broker_config.yaml + amqtt）。

判定方式（关键设计，规避洪流与锁竞争）：
  本验证在真实生产 Broker 上跑，除本脚本外还有真实设备在对 phonebox/* 高频请求
  （~5000 msg/s 的 card_not_found / status 洪流），后端单进程在洪流下发布套接字会被
  挤占，偶发丢弃 score/# 消息（实测 40 发仅 11 收，~73% 丢弃）。

  判定改为"设备自己订阅响应 topic，在内存中实时接收后端回包"：
    * 订阅者（收包）与发布者（发包）为两条**物理分离的 paho 连接**：收包连接只订阅+收包，
      其网络 loop 不会被高频发包占用，根除生产线高延迟下"发流饿死收包"导致的假阴性。
    * 设备订阅 4 个精确响应 topic（score/rules/result、phonebox/unlock/<唯一box>、score/add/result/#、
      score/undo/result/#），这些 topic 均不在洪流主体内，设备连接不会被淹没。
    * 回包到达内存即证明"设备->Broker->后端->Broker->设备"全链路真机跑通，且是内存级判定，
      完全不读 mqtt_log（200 万行表在洪流写锁竞争下每次全表扫描可阻塞 ~30s，是早期卡死根因）。
    * 请求侧丢包由「持续重发直到收到回包」规避（score/add 用 msg_id 幂等重发；手机箱查询每次
      重发都触发后端重新回包，总有一次穿透）。
    * C2 撤销效果以 DB 的 user.current_score 小表判定（user 表不被洪流写，无锁竞争）。

覆盖此前"订阅了但无 handler / 静默丢弃"的关键链路：
  A. score/rules/query  -> score/rules/result   (21 条规则)
  B. phonebox/query     -> phonebox/unlock/{box} (刷卡查询开箱结果)
  C1. score/add(不存在用户) -> score/add/result/{cid} (链路接通，诚实返回失败)
  C2. score/add(沙箱用户)  -> score/add/result/{cid} -> score/undo -> score/undo/result/{cid}
     (完整写库 + 撤回往返，沙箱用户测后清理)

说明：
  * score/# 全链路后端均真实订阅并处理（独立探针已证实 score/undo 逻辑正确：
    收到即按 undo_code 撤销 current_score）。C2 偶发失败纯属洪流丢包，非代码缺陷。
  * C2 撤销一律使用后端回包里的 undo_code（UNDO_{ScoreRecord.id}），不自己从 score_record
    表猜——沙箱用户可能有历史遗留记录，猜错会撤销错记录（初版曾因此误判 85-25=60）。
  * 不依赖后端进程内 mock，是真实网络往返。
  * box_id / mark 均带本运行时间戳，天然隔离上一轮被 TaskStop 杀残的设备进程（其连接若残留
    也不会命中本运行的唯一 topic）。finally 中 loop_stop+disconnect 防止本运行残留设备。
"""

import atexit
import json
import os
import ssl
import sqlite3
import sys
import threading
import time
import glob
import logging
logger = logging.getLogger(__name__)

import paho.mqtt.client as mqtt

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
DB = sorted(glob.glob(os.path.join(BACKEND, "instance", "*.db")))[-1]

# 默认对接生产 Broker（真机）。本地干净环境验证可用环境变量覆盖：
#   MQTT_BROKER=127.0.0.1 MQTT_PORT=8883 MQTT_USER= MQTT_PASS= python -m ...
BROKER = os.getenv("MQTT_BROKER", "nc5233fc.ala.cn-hangzhou.emqxsl.cn")
PORT = int(os.getenv("MQTT_PORT", "8883"))
USER = os.getenv("MQTT_USER", "phoneboxtest")
PASS = os.getenv("MQTT_PASS", "123456")

SANDBOX_USER_ID = 999001
SANDBOX_CARD = "E2ECARD999001"

RUN_TS = int(time.time())
# 本运行唯一 box_id，避开 card_not_found 洪流且不被上轮残留设备命中
E2E_BOX = "E2EZ%d" % RUN_TS

_lock = threading.Lock()
_sub_mid = {}  # mid -> topic，用于关联 SUBACK
_received = []  # [(topic, payload), ...] 设备实时收到的回包
client = None  # 订阅者（收包）连接：仅订阅 + 收包，杜绝发包饿死收包 loop
pub_client = None  # 发布者（发包）连接：仅发包，与收包连接物理分离


def _on_connect(c, userdata, flags, rc):
    print(f"[DEVICE] connected rc={rc}")
    for t in (
        "score/rules/result",
        "phonebox/unlock/%s" % E2E_BOX,
        "score/add/result/#",
        "score/undo/result/#",
    ):
        try:
            _res, mid = c.subscribe(t, qos=1)
        except Exception as e:
            print(f"[DEVICE][SUB] topic={t} subscribe 失败: {e}")
            continue
        _sub_mid[mid] = t
    print(f"[DEVICE] 已发起 {len(_sub_mid)} 个 topic 订阅 (qos=1, 等待 SUBACK 确认)")


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


def _publish(topic, data):
    pub_client.publish(topic, json.dumps(data), qos=1)
    print(f"[DEVICE] -> publish {topic} {json.dumps(data, ensure_ascii=False)[:150]}")


def _recv_snapshot():
    with _lock:
        return list(_received)


def _wait_response(prefix, predicate=None, timeout=45, gap=0.4, clear_first=False):
    """轮询内存回包，直到 topic 以 prefix 开头且 predicate 命中。clear_first 先清历史回包。"""
    if clear_first:
        with _lock:
            _received.clear()
    deadline = time.time() + timeout
    while time.time() < deadline:
        for topic, pl in _recv_snapshot():
            if topic.startswith(prefix) and (predicate is None or predicate(pl)):
                return pl
        time.sleep(gap)
    return None


def _request_response(
    topic, data, resp_prefix, predicate=None, max_attempts=60, gap=1.5, clear_first=True
):
    """持续重发请求直到内存中收到匹配回包（洪流下后端响应偶发丢弃，故重试；score/add 幂等）。
    返回回包 payload 或 None（绝不返回不可解包的对象，调用方负责判 None）。"""
    resp = None
    for i in range(max_attempts):
        _publish(topic, data)
        pl = _wait_response(
            resp_prefix, predicate, timeout=gap + 0.5, gap=0.3, clear_first=(i == 0 and clear_first)
        )
        if pl:
            resp = pl
            break
    return resp


def _db_get(sql, args=()):
    """只读 user 小表，带 SQLITE_BUSY 重试；user 不被洪流写，无长锁竞争。"""
    last = None
    for _ in range(6):
        try:
            c = sqlite3.connect(DB, timeout=10)
            c.execute("PRAGMA busy_timeout=5000")
            row = c.execute(sql, args).fetchone()
            c.close()
            return row
        except sqlite3.OperationalError as e:
            last = e
            time.sleep(0.3)
    print(f"[WARN] user db query failed: {last}")
    return None


def _cleanup_sandbox():
    try:
        con = sqlite3.connect(DB, timeout=30)
        con.execute("PRAGMA busy_timeout=30000")
        con.execute("DELETE FROM processed_message WHERE client_id LIKE 'e2eC%'")
        con.execute("DELETE FROM score_record WHERE user_id=?", (SANDBOX_USER_ID,))
        con.execute("DELETE FROM user WHERE id=?", (SANDBOX_USER_ID,))
        con.commit()
        con.close()
        print(f"[CLEANUP] sandbox user {SANDBOX_USER_ID} + its records removed")
    except Exception as e:
        print(f"[WARN] 沙箱清理失败(可忽略): {e}")


def main():
    global client, pub_client
    # 收包连接：仅订阅 + 收包，loop 不被发包占用，根除高延迟下收包饿死
    client = mqtt.Client(client_id=f"e2e_recv_{RUN_TS}", clean_session=True)
    client.username_pw_set(USER, PASS)
    client.tls_set(cert_reqs=ssl.CERT_NONE)
    client.tls_insecure_set(True)
    client.on_connect = _on_connect
    client.on_message = _on_message
    client.on_subscribe = _on_subscribe
    client.connect_async(BROKER, PORT, keepalive=60)
    client.loop_start()

    # 发包连接：仅发包，与收包连接物理分离
    pub_client = mqtt.Client(client_id=f"e2e_pub_{RUN_TS}", clean_session=True)
    pub_client.username_pw_set(USER, PASS)
    pub_client.tls_set(cert_reqs=ssl.CERT_NONE)
    pub_client.tls_insecure_set(True)
    pub_client.connect_async(BROKER, PORT, keepalive=60)
    pub_client.loop_start()
    time.sleep(5)  # 等两条连接都连上 broker

    results = []

    # ---- Test A: score/rules/query -> score/rules/result ----
    mark_a = "E2EA_%d" % RUN_TS
    pl_a = _request_response(
        "score/rules/query",
        {"request_id": mark_a},
        "score/rules/result",
        predicate=lambda p: isinstance(p.get("rules"), list),
    )
    ok_a = bool(pl_a) and len(pl_a.get("rules", [])) > 0
    if pl_a:
        print(
            f"[DEBUG][A 回包] success={pl_a.get('success')} count={pl_a.get('count')} "
            f"msg={pl_a.get('message')} rules_len={len(pl_a.get('rules', []))}"
        )
    results.append(
        (
            "A.score/rules/query->result",
            ok_a,
            f"rules={len(pl_a.get('rules', [])) if pl_a else 0} "
            f"success={pl_a.get('success') if pl_a else None} "
            f"msg={pl_a.get('message') if pl_a else 'no response'}",
        )
    )

    # ---- Test B: phonebox/query (真实用户 2026001) -> phonebox/unlock/<唯一box> ----
    # 注意：后端 publish_unlock_result 回包 result 为字符串 "true"/"false"（非布尔），
    # 故判定以"在精确订阅 topic 上收到含 result 字段的回包"为准，证明端到端链路通。
    mark_b = "E2EB_%d" % RUN_TS
    pl_b = _request_response(
        "phonebox/query",
        {"box_id": E2E_BOX, "card_id": "2026001", "_mark": mark_b},
        "phonebox/unlock/%s" % E2E_BOX,
        predicate=lambda p: isinstance(p, dict) and "result" in p,
    )
    ok_b = bool(pl_b)
    detail_b = (
        ("result=%s reason=%s" % (pl_b.get("result"), pl_b.get("reason")))
        if pl_b
        else "no response"
    )
    results.append(("B.phonebox/query->unlock/%s" % E2E_BOX, ok_b, detail_b))

    # ---- Test C1: score/add 不存在用户 -> score/add/result/e2eC1 ----
    mark_c1 = "e2eC1_%d" % RUN_TS
    pl_c1 = _request_response(
        "score/add",
        {"msg_id": mark_c1, "client_id": "e2eC1", "user_id": 999999, "score_change": 5},
        "score/add/result/e2eC1",
        predicate=lambda p: p.get("msg_id") == mark_c1,
    )
    ok_c1 = bool(pl_c1) and (pl_c1.get("success") is False)
    detail_c1 = (
        ("success=%s msg=%s" % (pl_c1.get("success"), pl_c1.get("message")))
        if pl_c1
        else "no response"
    )
    results.append(("C1.score/add(bogus)->result", ok_c1, detail_c1))

    # ---- Test C2: score/add 沙箱用户 -> undo 往返 ----
    mark_c2 = "e2eC2_%d" % RUN_TS
    _cleanup_sandbox()  # 起始硬清理，保证基线纯净
    con = sqlite3.connect(DB, timeout=30)
    con.execute("PRAGMA busy_timeout=30000")
    con.execute(
        "INSERT INTO user (id,name,card_id,current_score) VALUES (?,?,?,?)",
        (SANDBOX_USER_ID, "MQTT_E2E_SANDBOX", SANDBOX_CARD, 80),
    )
    con.commit()
    con.close()
    print(f"[SETUP] sandbox user {SANDBOX_USER_ID} inserted (score=80)")

    # add（msg_id 幂等，洪流下重发安全），等回包取权威 undo_code
    pl_add = _request_response(
        "score/add",
        {"msg_id": mark_c2, "client_id": "e2eC2", "user_id": SANDBOX_USER_ID, "score_change": 5},
        "score/add/result/e2eC2",
        predicate=lambda p: p.get("msg_id") == mark_c2 and p.get("undo_code"),
    )
    undo_code = pl_add.get("undo_code") if pl_add else None
    db_score = _db_get("SELECT current_score FROM user WHERE id=?", (SANDBOX_USER_ID,))
    ok_add = bool(undo_code) and (db_score and db_score[0] == 85)
    if undo_code and ok_add:
        # undo：发布-轮询交织重试（score/undo 幂等于 undo_code）。以 DB user.current_score==80 为
        # 后端已真实撤销的判定（user 表小，不被洪流写，无锁竞争）。
        reverted = False
        score_after_undo = db_score[0]
        for _ in range(60):
            _publish("score/undo", {"undo_code": undo_code, "client_id": "e2eC2"})
            time.sleep(1.2)
            s = _db_get("SELECT current_score FROM user WHERE id=?", (SANDBOX_USER_ID,))
            if s and s[0] == 80:
                reverted = True
                score_after_undo = s[0]
                break
        ok_undo = reverted
        ok_c2 = ok_add and ok_undo
        results.append(
            (
                "C2.score/add->undo 往返",
                ok_c2,
                f"add new_score={db_score[0]} (期望85), undo_code={undo_code}, "
                f"undo new_score={score_after_undo} (期望80)",
            )
        )
    else:
        results.append(
            (
                "C2.score/add->undo 往返",
                False,
                f"未取到权威 undo_code 或 add 未生效: undo_code={undo_code}, "
                f"db_score={db_score[0] if db_score else None} (期望85)",
            )
        )

    # 汇总
    print("\n==================== MQTT 端到端真机结果 (设备实时收后端回包) ====================")
    all_ok = True
    for name, ok, detail in results:
        all_ok = all_ok and ok
        print(f"[{'PASS' if ok else 'FAIL'}] {name}\n        {detail}")
    print("==================================================================================")
    print("OVERALL:", "ALL PASS" if all_ok else "HAS FAILURE")
    return 0 if all_ok else 1


def _shutdown():
    for c in (client, pub_client):
        if c is not None:
            try:
                c.loop_stop()
                c.disconnect()
            except Exception as e:
                logger.warning('MQTT 客户端关闭异常（已忽略）: %s', e)


if __name__ == "__main__":
    atexit.register(_shutdown)
    try:
        rc = main()
    finally:
        _shutdown()
    sys.exit(rc if rc is not None else 1)
