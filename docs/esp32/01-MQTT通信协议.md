# ESP32 对接开发文档 01 — MQTT 通信协议

> 文档版本：v1.0
> 编写日期：2026-09-12
> 适用固件：ESP32 手机箱（phonebox）控制板
> 事实来源：`apps/backend/services/mqtt_manager.py`、`services/mqtt_message_service.py`、`services/mqtt_service.py`、`models/device_models.py`
>
> **本文档所有主题名、字段名、QoS 均逐字对照后端实现，可直接据此编码。**

---

## 一、架构总览

### 1.1 数据流向

```
┌──────────────┐   publish 上行     ┌──────────────┐   subscribe    ┌─────────────────────┐
│  ESP32 设备  │ ─────────────────► │   EMQX Broker│ ─────────────► │ Flask 后端（控制连接）│
│  （多台在线） │                    │  （云 / 自建）│                │  QoS1 即时业务派发    │
│              │ ◄───────────────── │              │ ◄───────────── │  publish 下行回包     │
└──────────────┘   subscribe 下行   └──────────────┘                └─────────────────────┘
                                                                              │
                                                                    遥测连接（QoS0，独立 TCP）
                                                                    心跳洪流不阻塞控制消息
```

### 1.2 后端「双连接分流」设计（设备侧必须知晓）

后端**不是**用单个 MQTT 客户端订阅全部主题，而是开了**两条独立 TCP 连接**：

| 连接 | 用途 | 订阅范围 | QoS | 客户端 ID 形态 |
|------|------|----------|-----|----------------|
| **控制连接** | 业务指令，必须可靠送达 | `score/#`、`phonebox/query`、`phonebox/unlock/#`、`phonebox/ota/#`、`phonebox/points/#` | **QoS 1** | `{client_id}_control_{timestamp}` |
| **遥测连接** | 高频心跳/状态，可容忍丢包 | `phonebox/#` | **QoS 0** | `{client_id}_telemetry_{timestamp}` |

**设计动因**：`phonebox/#` 遥测流量在满负荷时可达 ~5000 msg/s，若与业务控制消息共用一条连接，控制消息会被遥测洪流淹没，导致「设备刷了卡却迟迟收不到开箱回包」。分流后控制消息走独立 TCP 缓冲区，永不阻塞。

> **对设备侧的影响**：设备**无需感知**这个分流。设备只需按本文档的 topic 命名规范发布/订阅即可，后端会自动把控制类 topic 交给控制连接、把其他 `phonebox/#` 交给遥测连接。
>
> 唯一需要注意的是：**设备查询类请求（`phonebox/query`）后端只在控制连接订阅**，若设备把查询发到别处则不会被处理。

---

## 二、连接鉴权

### 2.1 连接参数

连接参数存于数据库表 `mqtt_config`（**唯一一条记录**），后端启动时通过 `MQTTManager.load_config_from_db()` 加载。

| 参数 | 字段 | 说明 |
|------|------|------|
| Broker 地址 | `broker` | MQTT 服务器域名 |
| 端口 | `port` | 明文 1883 / TLS 8883 |
| 客户端 ID | `client_id` | 后端连接 ID 前缀 |
| 用户名 | `username` | MQTT 用户名 |
| 密码 | `password` | MQTT 密码 |
| SSL | `ssl` | 是否启用 TLS |
| Keepalive | `keepalive` | 保活间隔（秒），默认 **60** |
| 超时 | `timeout` | 连接超时（秒），默认 10 |

### 2.2 代码内置默认值（DB 无记录时回退）

```python
DEFAULT_CONFIG = {
    "broker": "nc5233fc.ala.cn-hangzhou.emqxsl.cn",   # EMQX Cloud
    "port": 8883,                                     # TLS 端口
    "client_id": "score_backend",
    "username": "",                                   # 空 = 匿名
    "password": "",
    "ssl": True,
    "timeout": 10,
    "keepalive": 60,
    "transport": "tcp",
}
```

> ⚠️ **重要**：**当前开发库 `instance/score_management.db` 中的实际配置是**
> `broker=broker.hivemq.com` / `port=1883` / `ssl=0` / `username=''` / `password=''` / `client_id='score_backend_dev'`。
>
> 即**当前运行环境是「公共测试 Broker + 明文 + 匿名」**。生产部署必须先通过
> `PUT /api/mqtt/config` 或直接改库，切回 EMQX + TLS + 账号密码。
> 部署前请以 `GET /api/mqtt/config` 返回值为准。

### 2.3 TLS 配置（后端侧行为，设备侧需对齐）

后端 TLS 建立方式：

```python
client.tls_set(cert_reqs=ssl.CERT_NONE, tls_version=ssl.PROTOCOL_TLS)
client.tls_insecure_set(True)   # 不校验服务端证书链
```

**含义**：后端**不校验** Broker 证书。设备侧若使用 `WiFiClientSecure`，可用
`client.setInsecure()` 对齐（不校验证书），或按需烧录 CA 证书做强校验。

**端口选择建议**：

| 场景 | 端口 | 加密 | 设备侧写法 |
|------|------|------|-----------|
| 生产（推荐） | 8883 | TLS | `WiFiClientSecure` + `setInsecure()` |
| 内网 / 调试 | 1883 | 明文 | `WiFiClient` |

### 2.4 客户端 ID 规范（设备侧）

设备侧 `clientId` **必须全局唯一**，否则后连接者会把先连接者踢下线（MQTT 协议行为，EMQX 默认如此）。

**推荐格式**：

```
{device_id}                       # 最简单的做法，例：esp32_box_001
{device_id}-{chip_id_hex}         # 防止同 device_id 重复烧录导致互踢
```

**约束**（EMQX 默认）：

- 长度 ≤ 65535，建议 ≤ 64
- 建议仅用 `[A-Za-z0-9_-]`
- **禁止**使用后端的 `{client_id}_control_*` / `{client_id}_telemetry_*` 命名（会与后端连接冲突）

### 2.5 ESP32 连接代码（Arduino / PubSubClient）

```cpp
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>

static const char* MQTT_HOST  = "nc5233fc.ala.cn-hangzhou.emqxsl.cn";
static const int   MQTT_PORT  = 8883;
static const char* MQTT_USER  = "phoneboxtest";
static const char* MQTT_PASS  = "123456";
static const char* DEVICE_ID  = "esp32_box_001";   // 见文档 02：唯一标识生成

WiFiClientSecure net;
PubSubClient mqtt(net);

void mqttConnect() {
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setKeepAlive(60);          // 与后端 keepalive=60 对齐
  mqtt.setBufferSize(1024);       // 手机箱报文小，1024 足够

  net.setInsecure();              // 与后端 CERT_NONE 对齐

  while (!mqtt.connected()) {
    String cid = String(DEVICE_ID);
    Serial.printf("[MQTT] connecting as %s ...\n", cid.c_str());
    if (mqtt.connect(cid.c_str(), MQTT_USER, MQTT_PASS)) {
      Serial.println("[MQTT] connected");
      // —— 下行订阅（见第三章）——
      mqtt.subscribe("phonebox/unlock/esp32_box_001", 1);   // 定向开锁结果
      mqtt.subscribe("phonebox/points/result", 1);          // 积分回包
      mqtt.subscribe("phonebox/ota/esp32_box_001", 1);      // 定向 OTA
      mqtt.subscribe("score/rules/result", 1);              // 规则查询回包
      mqtt.subscribe("score/add/result", 1);                // 加分回包
      mqtt.subscribe("score/undo/result", 1);               // 撤销回包
    } else {
      Serial.printf("[MQTT] failed rc=%d, retry in 5s\n", mqtt.state());
      vTaskDelay(pdMS_TO_TICKS(5000));
    }
  }
}
```

> **重连策略**：后端指数退避（5s → 10s → 20s → 40s → 60s 封顶）。设备侧建议同样采用指数退避，避免 Broker 抖动时被大量重连打垮。**设备侧必须实现自动重连**，并且重连后**重新订阅全部下行 topic**（MQTT 会话默认 `clean_session=True`，订阅不会保留）。

---

## 三、主题（Topic）命名规范

### 3.1 命名总原则

```
phonebox/{功能}/{可选设备标识}
score/{动作}/{可选子路径}
```

- 第一级是**域**：`phonebox`（手机箱设备域）、`score`（积分业务域）
- 第二级是**动作/功能**
- `{device_id}` 出现在 topic 中时，表示**定向**（只给该设备）；缺席表示**广播**或**统一回包**

### 3.2 设备上行 topic（设备 → 后端）

| Topic | 用途 | QoS | 是否需 `device_id` 字段 | 处理函数 |
|-------|------|-----|------------------------|----------|
| `phonebox/query` | 刷卡前查询（只读校验，不扣分） | 1 | `box_id`+`card_id` | `handle_query_message` |
| `phonebox/heartbeat` | 心跳 / 状态上报 | 0 | **必须** | `handle_heartbeat_message` |
| `phonebox/unlock/{box_id}` | 请求开箱（走完整校验+扣分） | 1 | `box_id`+`card_id` | `handle_unlock_message` |
| `phonebox/points/query` | 查询学生当前积分 | 1 | `card_id` | `handle_points_query` |
| `phonebox/points/add` | 申请加分（**走审批**） | 1 | `card_id` | `handle_points_add` |
| `phonebox/points/sub` | 申请减分（**走审批**） | 1 | `card_id` | `handle_points_sub` |
| `score/add` | 直接加分（**立即生效**） | 1 | `user_id` 或 `card_id` | `handle_score_add` |
| `score/undo` | 撤销一笔加分 | 1 | `undo_code` | `handle_score_undo` |
| `score/rules/query` | 拉取可用积分规则列表 | 1 | — | `handle_score_rules_query` |
| `phonebox/ota/register` | OTA 注册 / 类型上报（广播形式） | 1 | **必须** | `_process_ota_register` |
| `phonebox/ota/{device_id}/register` | OTA 注册 / 类型上报（定向形式） | 1 | 可从 topic 解析 | `_process_ota_register` |
| `phonebox/ota/status` | OTA 进度上报（广播形式） | 1 | **必须** | `_process_ota_status` |
| `phonebox/ota/{device_id}/status` | OTA 进度上报（定向形式） | 1 | 可从 topic 解析 | `_process_ota_status` |

> **`phonebox/unlock` 的双形态**：后端 `_dispatch_mqtt_topic` 同时支持
> `phonebox/unlock`（无 box_id，默认 `box_id="A"`）与 `phonebox/unlock/{box_id}`。
> **推荐设备侧始终带 box_id**，便于回包定向。

### 3.3 后端下行 topic（后端 → 设备）

| Topic | 何时下发 | QoS | 订阅方式 |
|-------|---------|-----|----------|
| `phonebox/unlock/{box_id}` | 开箱请求的**结果** | 1 | 设备订阅 `phonebox/unlock/{自己的设备标识}` |
| `phonebox/points/result` | 积分查询/加/减的**统一回包** | 1 | 设备订阅 `phonebox/points/result` |
| `score/add/result` | 加分结果（无 client_id 时） | 1 | 设备订阅 |
| `score/add/result/{client_id}` | 加分结果（定向回包） | 1 | 设备订阅自己的 client_id 后缀 |
| `score/undo/result` | 撤销结果（无 client_id 时） | 1 | 设备订阅 |
| `score/undo/result/{client_id}` | 撤销结果（定向） | 1 | 设备订阅自己的 client_id 后缀 |
| `score/rules/result` | 规则列表 | 1 | 设备订阅 |
| `phonebox/ota/{device_id}` | OTA 升级指令（**定向**） | 1 | 设备订阅自己的 device_id |
| `phonebox/ota` | OTA 升级指令（**广播**） | 1 | 全设备订阅 |
| `phonebox/control/restart` | 重启指令 | 1 | 全设备订阅 |

> ⚠️ **`score/add/result` 的回包 topic 规则**：后端 `_publish_score_result` 逻辑是
> 「给了 `client_id` 就发 `score/add/result/{client_id}`，否则发 `score/add/result`」。
> **设备侧建议**：上行带 `client_id`（= 自己的 device_id）以便定向接收，同时**也订阅**无后缀的公共 topic 作为兜底。

### 3.4 一图记住订阅关系

**设备侧需要订阅（推荐全量）：**

```
phonebox/unlock/{我的 box 标识}       QoS1
phonebox/points/result                QoS1
phonebox/ota/{我的 device_id}         QoS1
phonebox/ota                          QoS1   （接广播升级）
phonebox/control/restart              QoS1
score/add/result                      QoS1
score/undo/result                     QoS1
score/rules/result                    QoS1
```

**设备侧需要发布：**

```
phonebox/heartbeat                    QoS0   周期 30s
phonebox/query                        QoS1   刷卡前
phonebox/unlock/{box_id}              QoS1   确认开箱
phonebox/ota/register                 QoS1   开机
phonebox/ota/status                   QoS1   升级各阶段
```

---

## 四、消息结构规范

### 4.1 通用信封（上行）

所有上行 JSON **建议**携带以下三个字段：

```json
{
  "msg_id": "msg_20260912_0001",
  "client_id": "esp32_box_001",
  "device_id": "esp32_box_001",
  "timestamp": 1757680000
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `msg_id` | string | **强烈建议** | 全局唯一；后端据此做**幂等去重**（见 4.3） |
| `client_id` | string | 建议 | 回包 topic 定向后缀 |
| `device_id` | string | **心跳/OTA 必须** | 设备唯一标识（见文档 02） |
| `timestamp` | int / string | 否 | Unix 秒或 ISO8601；后端仅落库，不参与业务判定 |

### 4.2 消息编码

- **编码**：UTF-8 JSON 字符串（`mqtt.publish` 前 `json.dumps`）
- **长度**：建议 ≤ 1 KB（后端 `PubSubClient` 缓冲建议 1024）
- **数值**：积分/分数为 **float**（`ScoreRule.score` 是 `Float`），设备侧请用浮点或整数均可，后端按 float 存储

### 4.3 幂等去重机制（重点）

后端对**每一条**控制类消息（`score/add`、`score/undo`、`phonebox/*`）执行：

```
解析 msg_id
  ├─ 无 msg_id → 跳过去重，直接处理（不保证幂等）
  └─ 有 msg_id → 查 processed_message 表
       ├─ 已存在 → 直接返回上次结果，不重复执行
       └─ 不存在 → 执行 + 写 processed_message(msg_id UNIQUE)
```

对应表 `ProcessedMessage`：

| 列 | 说明 |
|----|------|
| `message_id` | **UNIQUE 约束**，即 `msg_id` |
| `record_id` | 关联的 ScoreRecord id |
| `new_score` | 处理后的分数快照 |
| `client_id` | 来源客户端 |

**设备侧最佳实践**：

```cpp
// 断电重启后仍不重复：用 NVS 持久化一个自增序号
uint32_t bootCount;   // 存 NVS
String makeMsgId(const char* action) {
  bootCount++;
  saveBootCountToNVS();
  return String("msg_") + DEVICE_ID + "_" + String(bootCount) + "_" + action;
}
```

> ⚠️ **重要**：`phonebox/unlock/*`、`phonebox/heartbeat` 的**处理路径不做 `msg_id` 去重**
> （心跳本身是周期覆盖写，开箱走 `UnlockValidator` 的日/周限额做约束）。
> **重复发送 `phonebox/heartbeat` 是安全的；重复发送 `phonebox/unlock/{box}` 会重复扣分！**
> 实际保护来自 `UnlockValidator` 的 `DAILY_LIMIT=10` / `WEEKLY_LIMIT=5`。
> **设备侧必须实现「一次刷卡只发一次 unlock」**，禁止在未收到回包时盲目重试 unlock。

---

## 五、QoS 等级规范

| 消息方向 | 主题类型 | QoS | 理由 |
|---------|---------|-----|------|
| 设备上行 | `phonebox/heartbeat` | **0** | 高频、可丢；下次心跳会覆盖 |
| 设备上行 | 其余全部（query/unlock/points/score/ota） | **1** | 业务消息，不能丢 |
| 后端下行 | `phonebox/points/result`、`phonebox/unlock/*`、`score/*/result`、`phonebox/ota*`、`phonebox/control/restart` | **1** | 后端统一走 `publish_mqtt(qos=1)` |

**后端下发统一 QoS 1**（`services/mqtt_service.py::publish_mqtt` 默认 `qos=1`），设计意图是根治「请求已处理、设备却收不到回包」的假超时。

> **不要对心跳使用 QoS 1**：EMQX 在 QoS1 下会为每条消息维护 inflight 窗口，5000 msg/s 的心跳会严重消耗 Broker 资源。

---

## 六、上下行指令格式详解

### 6.1 刷卡查询 — `phonebox/query`

**方向**：设备 → 后端 → `phonebox/unlock/{box_id}`

**上行**：

```json
{
  "msg_id": "msg_20260912_0001",
  "client_id": "esp32_box_001",
  "box_id": "A",
  "card_id": "20230001"
}
```

**下行**（topic `phonebox/unlock/{box_id}`）：

```json
{
  "result": "true",
  "reason": "query_ok",
  "current_score": 92.5
}
```

**失败**：

```json
{ "result": "false", "reason": "card_not_found", "current_score": null }
```

> ⚠️ **`result` 字段是字符串 `"true"` / `"false"`，不是布尔值**。设备侧解析必须判断
> `strcmp(json["result"], "true") == 0`，直接当 bool 用会永远为真。

---

### 6.2 心跳上报 — `phonebox/heartbeat`

**方向**：设备 → 后端（**无下行回包**）

**QoS**：**0**

**周期**：建议 **30 秒**（后端 `heartbeat_timeout` 默认 30，`is_device_online` 用该阈值判定超时）

**上行**：

```json
{
  "device_id": "esp32_box_001",
  "status": "online",
  "timestamp": 1757680000,
  "wifi_signal": -58,
  "uptime": 86400,
  "box_a_status": "closed",
  "box_b_status": "closed",
  "system_state": 1,
  "fw_version": "1.2.3",
  "platform": "esp32",
  "device_type": "phonebox",
  "free_heap": 187432,
  "battery_level": 100,
  "temperature": 36.5,
  "last_error": "",
  "error_count": 0
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `device_id` | string | **是** | 后端按此查找/自动创建设备 |
| `status` | string | 是 | `online` / `offline` / `error` |
| `timestamp` | int | 否 | Unix 秒 |
| `wifi_signal` | int | 否 | RSSI，单位 dBm，典型 -30 ~ -90 |
| `uptime` | int | 否 | 运行秒数 |
| `box_a_status` | string | 否 | `open` / `closed` |
| `box_b_status` | string | 否 | `open` / `closed` |
| `system_state` | int | 否 | 自定义状态码 |
| `fw_version` | string | 否 | 固件版本，OTA 协商依据（**必须语义化 `x.y.z`**） |
| `platform` | string | 否 | 如 `esp32` |
| `device_type` | string | 否 | ⚠️ **见下方警告** |
| `free_heap` | int | 否 | 剩余堆内存（字节） |
| `battery_level` | float | 否 | ⚠️ **见下方警告** |
| `temperature` | float | 否 | ⚠️ **见下方警告** |
| `last_error` | string | 否 | 最近错误文本 |
| `error_count` | int | 否 | 累计错误数 |

> ⚠️ **心跳双路径不一致警告**：后端有两条心跳处理路径：
> - **路径 A** `mqtt_message_service.handle_heartbeat_message`（Celery 兜底/同步路径）
>   → 接受 `fw_version`/`platform`/`free_heap`/`last_error`/`error_count`，
>   **不处理 `device_type` / `battery_level` / `temperature`**
> - **路径 B** `mqtt_manager._process_heartbeat`（主路径）
>   → 额外处理 `device_type`（条件写）
>
> 即同一条心跳，`battery_level` 与 `temperature` **可能不会被写入 Device 表**。
> 详见《06-差异同步与优化方案》§3。

**后端行为**：

1. 写入 `DeviceHeartbeat` 表（历史记录）
2. 查找 `Device`；**不存在则自动创建**（`name = "Device {device_id}"`）
3. 更新 `status` / `last_heartbeat` / `wifi_signal` / `uptime` / `box_*_status` / `system_state`
4. 触发 OTA 版本协商 `try_auto_negotiate(device)`
5. 通过 WebSocket 向前端推送设备状态

**离线判定**（后端权威逻辑 `heartbeat_service.is_device_online`）：

```python
if device.last_heartbeat is None:                    return False   # 从未上报
if (now - last_heartbeat).seconds > heartbeat_timeout: return False  # 超时
return device.status == "online"
```

> **注意**：判定**不只看 `last_heartbeat`**，还要求 `status == "online"`。
> 因此**心跳里的 `status` 字段必须发 `"online"`**，否则设备会被判为离线。

---

### 6.3 请求开箱 — `phonebox/unlock/{box_id}`

**方向**：设备 → 后端 → `phonebox/unlock/{box_id}`

**上行**：

```json
{
  "msg_id": "msg_20260912_0002",
  "client_id": "esp32_box_001",
  "box_id": "A",
  "card_id": "20230001",
  "hour": 10,
  "minute": 25
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `card_id` | string | **是** | 学生卡号（8-16 位纯数字） |
| `box_id` | string | 否 | 默认 `"A"` |
| `hour` / `minute` | int | 否 | 设备本地时间；用于时段校验。**不传则后端用服务器时间** |

**下行**（topic `phonebox/unlock/{box_id}`）：

```json
{
  "result": "true",
  "reason": "success",
  "current_score": 82.5
}
```

**判定优先级链（后端 `handle_unlock_message`）**：

```
1. 无 card_id                  → result=false, reason="card_not_found"
2. 卡号查不到用户              → result=false, reason="card_not_found"
3. 班主任策略 evaluate()
   ├─ BLOCK（本班已关自助开箱） → result=false, reason="teacher_disabled"
   └─ ALLOW_OVERRIDE/WINDOW     → 跳过 4、5，直接进 6
4. 全局 TimeRule 时段门禁
   └─ 不在允许时段              → result=false, reason="not_in_time"
5. 班级课表硬拦截（上课/自习）
   └─ 正在上课                  → result=false, reason="class_in_session"
6. _deduct_and_unlock() → UnlockValidator.validate_unlock()
   ├─ 用户停用                  → reason="user_inactive"
   ├─ 黑名单（临时/永久）        → reason="blacklisted"
   ├─ 分数 < 门槛（默认 80）     → reason="score_low"
   ├─ 周开箱次数超限（默认 5）    → reason="weekly_limit"
   ├─ 日开箱次数超限（默认 10）   → reason="daily_limit"
   ├─ 不在允许时段窗口           → reason="time_window"
   └─ 通过                      → 扣 10 分 + 记流水 → result=true, reason="success"
```

**reason 码全集**（设备侧建议直接映射为蜂鸣/屏幕提示）：

| reason | 含义 | 建议设备提示 | 可重试 |
|--------|------|-------------|--------|
| `ok` / `success` / `query_ok` | 成功 | 绿灯 + 开箱 | — |
| `manual` | 后台手动开箱 | 绿灯 | — |
| `card_not_found` | 卡不存在 | 红闪 + "卡未注册" | ❌ |
| `teacher_disabled` | 班主任已关闭本班自助开箱 | 红闪 + "请找班主任" | ❌ |
| `not_in_time` / `not_in_time_window` | 不在允许时段 | 红闪 + "非开箱时段" | ⏳ |
| `class_in_session` | 正在上课 | 红闪 + "上课中" | ⏳ |
| `user_inactive` | 账号停用 | 红闪 | ❌ |
| `blacklisted` | 黑名单 | 红闪 + "已禁用" | ❌ |
| `score_low` | 分数不足 | 红闪 + 显示 `current_score` | ❌ |
| `weekly_limit_exceeded` | 本周次数用尽 | 红闪 | ❌ |
| `daily_limit_exceeded` | 今日次数用尽 | 红闪 | ❌ |

> 🔴 **reason 存在两套命名**（判定层用全称 `daily_limit_exceeded` / `not_in_time_window`，
> 派发层用简写 `daily_limit` / `not_in_time`）。
> **设备侧必须用「包含匹配」而非精确全等**，例如：
> ```cpp
> if (reason.indexOf("limit") >= 0) { /* 次数用尽 */ }
> else if (reason.indexOf("time") >= 0) { /* 非时段 */ }
> ```
> 详见《06-差异同步与优化方案》§17。

> 🔴 **设备侧铁律**：**收到 `result=false` 时绝对不要自动重发 unlock**。
> 重发会消耗日/周限额，且失败原因通常是「课中/分数不足」这类**重发也无法通过**的条件。

---

### 6.4 查询积分 — `phonebox/points/query`

**方向**：设备 → 后端 → `phonebox/points/result`

**上行**：

```json
{
  "msg_id": "msg_20260912_0003",
  "client_id": "esp32_box_001",
  "card_id": "20230001",
  "request_id": "req_0003"
}
```

**下行**（topic **固定** `phonebox/points/result`）：

```json
{
  "success": true,
  "message": "查询成功",
  "card_id": "20230001",
  "user_name": "张三",
  "new_points": 92.5,
  "request_id": "req_0003"
}
```

> **注意**：`phonebox/points/*` 三条指令的回包 topic **统一是 `phonebox/points/result`**（不带设备后缀）。
> 多台设备同时在线时，设备侧必须**用 `card_id` / `request_id` 自行过滤**是否是自己关心的回包。

---

### 6.5 申请加/减分（走审批）— `phonebox/points/add` / `phonebox/points/sub`

**设计语义**：这两条**不会立即改分**，而是创建一条 `Approval` 审批单（`type=score_add` / `score_sub`，`status=pending`），由老师在后台审批后才生效。

**上行（add）**：

```json
{
  "msg_id": "msg_20260912_0004",
  "client_id": "esp32_box_001",
  "card_id": "20230001",
  "points": 5,
  "reason": "课堂表现优秀",
  "request_id": "req_0004"
}
```

**上行（sub）**：结构同上，`points` 为申请扣减的分值。

**下行**（topic `phonebox/points/result`）：

```json
{
  "success": true,
  "message": "已提交审批",
  "card_id": "20230001",
  "user_name": "张三",
  "new_points": 92.5,
  "request_id": "req_0004",
  "approval_id": 77,
  "status": "pending"
}
```

> 设备侧应展示「已提交，等待老师审批」，**不要**直接显示分数已加。

---

### 6.6 直接加分 — `score/add`

**设计语义**：**立即生效**（无审批），走 `atomic_score_update` 原子累加 + 写 `ScoreRecord`。

**上行**：

```json
{
  "msg_id": "msg_20260912_0005",
  "client_id": "esp32_box_001",
  "user_id": 1,
  "rule_id": 5,
  "rule_name": "主动回答问题",
  "score_change": 5,
  "description": "课堂表现优秀",
  "operator": "李老师"
}
```

**三选一寻址**（必须且只需提供其一）：

| 方式 | 字段 | 后端行为 |
|------|------|---------|
| 按 ID | `rule_id` | 精确匹配 `ScoreRule.id` |
| 按名称 | `rule_name` | **模糊匹配** `like('%name%')`，可能命中多条（取第一条） |
| 按分值 | `score_change` | 直接指定分值，不关联规则 |

**下行**：topic `score/add/result/{client_id}`（有 client_id）或 `score/add/result`

```json
{
  "success": true,
  "msg_id": "msg_20260912_0005",
  "message": "加分成功: 主动回答问题 (+5分)",
  "new_score": 92.5,
  "record_id": 1234,
  "rule_name": "主动回答问题",
  "undo_code": "UNDO_1234"
}
```

**失败**：

```json
{
  "success": false,
  "msg_id": "msg_20260912_0005",
  "message": "Daily limit reached (3/3)"
}
```

> **`undo_code` 必须持久化到设备 NVS**，供用户后续撤销。

**频率限制**（`ScoreRule` 字段，由 `check_rule_limit` 强制）：

| 字段 | 含义 | 拒绝消息 |
|------|------|---------|
| `daily_limit` | 当日同规则累计次数上限（0 = 不限） | `Daily limit reached (x/y)` |
| `min_interval` | 距上次使用的最小间隔（分钟，0 = 不限） | `Too frequent, wait Ns` |

---

### 6.7 撤销加分 — `score/undo`

**上行**：

```json
{
  "client_id": "esp32_box_001",
  "undo_code": "UNDO_1234",
  "reason": "操作失误"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `undo_code` | string | **是** | **必须**以 `UNDO_` 为前缀（后端强校验） |
| `reason` | string | 否 | 撤销原因 |

**下行**：topic `score/undo/result/{client_id}` 或 `score/undo/result`

```json
{
  "success": true,
  "message": "撤销成功 (+5分已回滚)",
  "user_id": 1,
  "new_score": 87.5
}
```

> **重复撤销保护**：后端通过检查原 `ScoreRecord.description` 是否包含 `"undone"` 判定是否已撤销。

---

### 6.8 查询积分规则 — `score/rules/query`

**上行**：

```json
{
  "client_id": "esp32_box_001",
  "category": "课堂",
  "search": "回答"
}
```

**下行**（topic **固定** `score/rules/result`）：

```json
{
  "success": true,
  "rules": [
    {
      "id": 5,
      "name": "主动回答问题",
      "description": "课堂上主动回答问题",
      "score": 5.0,
      "category": "课堂表现类",
      "daily_limit": 3,
      "min_interval": 5,
      "score_type": "add",
      "start_time": null,
      "end_time": null
    }
  ]
}
```

> **建议设备侧缓存规则列表**（开机 + 每 30 分钟刷新），避免每次加分都走 MQTT 往返。
> 后端侧已加 SQLite 写锁规避（`busy_timeout=5000` + 4 次重试）。

---

### 6.9 OTA 注册 / 类型上报 — `phonebox/ota/register`

见《04-OTA升级设计.md》§3。摘要：

```json
{
  "device_id": "esp32_box_001",
  "fw_version": "1.0.0",
  "platform": "esp32",
  "device_type": "phonebox"
}
```

后端处理后会：更新设备 `status=online` / `fw_version` / `platform` / `device_type`，
然后调用 `try_auto_negotiate(device)` 检查是否需要推送升级。

---

### 6.10 OTA 进度上报 — `phonebox/ota/status`

见《04-OTA升级设计.md》§5。摘要：

```json
{
  "device_id": "esp32_box_001",
  "status": "downloading",
  "from_version": "1.0.0",
  "to_version": "1.2.3",
  "progress": 45,
  "error_message": ""
}
```

**status 取值与后端映射**：

| 设备上报 | 后端 `Device.ota_status` |
|---------|------------------------|
| `started` | `upgrading` |
| `downloading` | `upgrading` |
| `updating` | `upgrading` |
| `success` / `completed` | `idle`（且 `fw_version` 更新为 `to_version`） |
| `failed` / `error` / `download_failed` / `space_insufficient` / `begin_failed` / `signature_failed` / `version_check_failed` / `resume_exhausted` / `incomplete` | `failed` |

---

### 6.11 重启指令 — `phonebox/control/restart`

**方向**：后端 → 设备（**广播**，不带 device_id）

后端在 `POST /api/devices/{id}/remote-control` 且 `action=restart` 时下发：

```json
{ "command": "restart" }
```

> ⚠️ **当前实现是广播 topic `phonebox/control/restart`**，即**发给所有设备**。
> 设备侧收到后**必须自行判断**是否是自己被重启——但当前 payload **不含 `device_id`**，
> 无法区分！详见《06-差异同步与优化方案》§5。

---

## 七、错误处理与重试策略

### 7.1 设备侧重试矩阵

| 上行指令 | 收不到回包时是否重试 | 策略 |
|---------|-------------------|------|
| `phonebox/heartbeat` | 不需要 | 周期发送，无需等待确认 |
| `phonebox/query` | **可以重试** | 只读，无副作用；建议 3 次 × 2s |
| `phonebox/points/query` | **可以重试** | 只读，无副作用 |
| `phonebox/points/add` / `sub` | **可以重试** | 走审批，重复提交会产生多条 Approval（后端未去重，建议用 `msg_id` + 后端侧补去重） |
| `score/add` | **可以重试** | **带 `msg_id` 则幂等安全** |
| `score/undo` | **可以重试** | 已撤销会被拒绝，安全 |
| `phonebox/unlock/{box}` | 🔴 **禁止盲目重试** | 有扣分副作用！仅在同一次刷卡会话内、且**未收到任何回包**时最多重试 1 次 |
| `phonebox/ota/status` | **可以重试** | 纯状态上报 |

### 7.2 常见异常

| 现象 | 排查方向 |
|------|---------|
| 连接被反复踢下线 | 多台设备用了相同 `clientId` |
| 连接成功但收不到下行 | `clean_session=True` 导致重连后订阅丢失 → 在 `on_connect` 里重新订阅 |
| 下发 OTA 收不到 | 未订阅 `phonebox/ota/{device_id}`，或 device_id 拼写不一致 |
| 加分解析出 bool 恒真 | `result` 是字符串 `"true"`，不是 bool |
| 心跳发了但设备被判离线 | 心跳里 `status` 没发 `"online"` |
| 乱序/重复处理 | `msg_id` 未带或未持久化，重启后序号归零 |

---

## 八、相关后端 REST 接口（运维/调试用）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/mqtt/status` | 连接状态 |
| GET | `/api/mqtt/config` | 读取当前 Broker 配置 |
| PUT | `/api/mqtt/config` | 修改 Broker 配置 |
| GET | `/api/mqtt/logs` | 消息日志（收发全量） |
| GET | `/api/mqtt/recent` | 最近消息 |
| POST | `/api/mqtt/publish` | 手动发布消息 |
| POST | `/api/mqtt/connect` | 手动连接 |
| POST | `/api/mqtt/disconnect` | 手动断开 |
| POST | `/api/mqtt/subscribe` | 手动订阅 |
| POST | `/api/mqtt/unsubscribe` | 手动取消订阅 |
| POST | `/api/mqtt/unlock` | 手动下发开箱 |
| POST | `/api/mqtt/command` | 下发通用指令 |

> 调试期可用 `POST /api/mqtt/publish` 直接向 `phonebox/unlock/A` 发一条假回包，
> 验证设备侧解析逻辑，无需真实刷卡。

---

## 九、接入自检清单

设备固件完成前，逐项确认：

- [ ] `clientId` 全局唯一，且不与后端 `*_control_*` / `*_telemetry_*` 冲突
- [ ] `keepalive = 60`
- [ ] `on_connect` 回调中**重新订阅全部下行 topic**
- [ ] 心跳周期 30s，`status` 字段为 `"online"`
- [ ] 心跳携带 `fw_version`（语义化 `x.y.z`）与 `device_type`
- [ ] 心跳 QoS=0，其余上行 QoS=1
- [ ] 所有业务上行携带 `msg_id`（持久化自增序号）
- [ ] `msg_id` 断电重启后**不重复**
- [ ] 解析下行时 `result` 按**字符串**比较
- [ ] `phonebox/unlock/*` **绝不盲目重试**
- [ ] 收到 `score/add/result` 后持久化 `undo_code` 到 NVS
- [ ] `phonebox/points/*` 回包统一订阅 `phonebox/points/result`，并自行按 `card_id` 过滤
- [ ] 实现指数退避重连（5s → 10s → 20s → 40s → 60s）
- [ ] 开机发送 `phonebox/ota/register`
- [ ] 订阅 `phonebox/ota/{device_id}` **且** 订阅广播 `phonebox/ota`

---

## 十、相关文档

| 文档 | 内容 |
|------|------|
| 02-设备识别与注册认证.md | `device_id` 生成规则、注册流程、认证现状 |
| 03-积分逻辑.md | 四条积分路径、规则字段、扣分与限额 |
| 04-OTA升级设计.md | 升级流程、版本协商、签名校验、灰度与回滚 |
| 05-其他对接功能与多设备管理.md | 心跳、远程控制、告警、设备分组、多设备 API |
| 06-差异同步与优化方案.md | 现有实现与规范的出入 + 优化方案 |
