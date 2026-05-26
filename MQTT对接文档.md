# MQTT对接文档

## 概述

本文档描述了积分管理平台与设备之间的MQTT通信协议，用于实现设备状态监控、心跳检测、开锁控制、积分查询和加分等功能。

## MQTT服务器配置

### 默认配置

| 参数 | 默认值 | 说明 |
|------|--------|------|
| Broker | `nc5233fc.ala.cn-hangzhou.emqxsl.cn` | MQTT服务器地址 |
| Port | `8883` | MQTT端口（SSL） |
| Username | `phoneboxtest` | 连接用户名 |
| Password | `123456` | 连接密码 |
| Keepalive | `60` | 心跳间隔（秒） |
| SSL | `true` | 是否启用SSL |

### 连接质量（QoS）

系统使用 **QoS 1** 级别，确保消息至少被接收一次。

---

## 主题列表

### 1. 设备心跳相关

#### 订阅主题：`phonebox/heartbeat`

**设备发送心跳包到该主题，平台自动创建设备记录并更新状态。**

**消息格式（JSON）：**

```json
{
  "device_id": "phonebox_001",
  "timestamp": 1716249600,
  "status": "online",
  "wifi_signal": -65,
  "uptime": 3600,
  "box_a_status": "closed",
  "box_b_status": "closed",
  "system_state": 0
}
```

**字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| device_id | String | 是 | 设备唯一标识符（建议使用设备MAC地址或序列号） |
| timestamp | Number | 是 | 当前Unix时间戳（秒） |
| status | String | 是 | 设备状态：`online` / `offline` |
| wifi_signal | Number | 否 | WiFi信号强度（dBm），如 `-65` |
| uptime | Number | 否 | 设备运行时长（秒） |
| box_a_status | String | 否 | A箱状态：`opened` / `closed` |
| box_b_status | String | 否 | B箱状态：`opened` / `closed` |
| system_state | Number | 否 | 系统状态码（详见系统状态码表） |

**系统状态码说明：**

| 状态码 | 含义 |
|--------|------|
| 0 | 空闲 |
| 1 | A箱解锁中 |
| 2 | B箱解锁中 |
| 3 | 错误 |
| 4 | 显示卡号 |

**心跳发送建议：**
- 发送间隔：10秒
- 超时阈值：30秒（3倍心跳间隔）
- 离线判定：连续3次心跳超时则标记为离线

---

### 2. 开锁查询相关

#### 订阅主题：`phonebox/query`

**设备发送开锁查询请求，平台验证后返回是否可以开锁。**

**消息格式（JSON）：**

```json
{
  "box_id": "A",
  "card_id": "12345678",
  "hour": 14,
  "minute": 30
}
```

**字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| box_id | String | 是 | 箱体标识：`A` 或 `B` |
| card_id | String | 是 | 饭卡号（与平台用户绑定的卡号） |
| hour | Number | 是 | 当前小时（0-23） |
| minute | Number | 是 | 当前分钟（0-59） |

#### 发布主题：`phonebox/unlock/{box_id}`

**平台响应开锁查询结果。**

**响应消息格式（JSON）：**

```json
{
  "result": "true",
  "reason": "score_ok",
  "current_score": 85
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| result | String | 开锁结果：`true` / `false` |
| reason | String | 原因代码（见下方） |
| current_score | Number | 当前积分（可选） |

**原因代码说明：**

| 原因代码 | 说明 |
|----------|------|
| `score_ok` | 积分充足，可以开锁 |
| `score_low` | 积分不足（<60分），不能开锁 |
| `card_not_found` | 饭卡号未注册 |
| `not_in_time` | 不在允许时间段内 |

---

### 3. 积分管理相关

#### 订阅主题：`score/add`

**外部系统或设备发送加分请求。**

**消息格式（JSON）：**

```json
{
  "msg_id": "unique_message_id_123",
  "client_id": "client_001",
  "user_id": 1,
  "rule_name": "按时完成作业",
  "description": "今天作业完成得很好",
  "operator": "系统",
  "undo_code": "UNDO_123"
}
```

**字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| msg_id | String | 否 | 消息唯一ID（用于幂等处理） |
| client_id | String | 否 | 客户端ID（响应将发送到该客户端） |
| user_id | Number | 是 | 用户ID |
| rule_name | String | 否 | 规则名称（加分时使用） |
| score_change | Number | 否 | 直接指定积分变化（与rule_name二选一） |
| description | String | 否 | 描述信息 |
| operator | String | 否 | 操作人，默认为"MQTT系统" |
| undo_code | String | 否 | 撤销码（用于撤销操作） |

#### 发布主题：`score/add/result/{client_id}` 或 `score/add/result`

**平台响应加分请求结果。**

**响应消息格式（JSON）：**

```json
{
  "success": true,
  "message": "加分成功: 按时完成作业 (+5分)",
  "msg_id": "unique_message_id_123",
  "new_score": 90,
  "rule_name": "按时完成作业",
  "record_id": 123,
  "undo_code": "UNDO_123"
}
```

---

#### 订阅主题：`score/undo`

**撤销之前的加分操作。**

**消息格式（JSON）：**

```json
{
  "undo_code": "UNDO_123",
  "operator": "管理员"
}
```

**字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| undo_code | String | 是 | 撤销码（来自加分响应） |
| operator | String | 否 | 操作人 |

#### 发布主题：`score/undo/result/{client_id}` 或 `score/undo/result`

**平台响应撤销请求结果。**

**响应消息格式（JSON）：**

```json
{
  "success": true,
  "message": "撤销成功",
  "undo_code": "UNDO_123",
  "original_score": 85,
  "new_score": 80
}
```

---

#### 订阅主题：`score/rules/query`

**查询可用加分规则列表。**

**消息格式（JSON）：**

```json
{
  "msg_id": "query_rules_001"
}
```

#### 发布主题：`score/rules/result/{client_id}` 或 `score/rules/result`

**平台返回加分规则列表。**

**响应消息格式（JSON）：**

```json
{
  "success": true,
  "rules": [
    {
      "id": 1,
      "name": "按时完成作业",
      "description": "按时完成作业获得加分",
      "score": 5,
      "is_active": true
    }
  ],
  "msg_id": "query_rules_001"
}
```

---

### 4. 设备状态和日志（可选）

#### 订阅主题：`phonebox/status`

**设备主动上报状态变更。**

#### 订阅主题：`phonebox/log`

**设备主动上报日志信息。**

---

## 消息日志

系统会自动记录所有MQTT消息，包括：
- 主题
- 消息内容
- 方向（发送/接收）
- 时间戳
- QoS级别

可通过平台的MQTT日志管理界面查看。

---

## 设备管理API

平台提供REST API管理设备：

| API端点 | 方法 | 功能 |
|---------|------|------|
| `/api/devices` | GET | 获取所有设备列表 |
| `/api/devices` | POST | 创建设备 |
| `/api/devices/{device_id}` | GET | 获取设备详情 |
| `/api/devices/{device_id}` | PUT | 更新设备信息 |
| `/api/devices/{device_id}` | DELETE | 删除设备 |
| `/api/devices/{device_id}/heartbeats` | GET | 获取设备心跳记录 |
| `/api/devices/stats` | GET | 获取设备统计信息 |

---

## 注意事项

1. **消息幂等性**：使用 `msg_id` 确保消息处理的幂等性，避免重复处理。

2. **时间验证**：开锁请求会验证当前时间是否在允许的时间段内。

3. **积分限制**：用户积分范围为 0-100 分，超过100分自动截断为100分。

4. **每日限制**：加分规则可设置每日加分次数限制。

5. **SSL连接**：生产环境建议启用SSL连接，确保通信安全。

6. **心跳超时**：30秒内未收到心跳的设备将被标记为离线。

---

## 示例代码

### Python发布心跳

```python
import paho.mqtt.client as mqtt
import json
import time

def publish_heartbeat():
    client = mqtt.Client("phonebox_001")
    client.username_pw_set("phoneboxtest", "123456")
    client.tls_set()
    client.connect("nc5233fc.ala.cn-hangzhou.emqxsl.cn", 8883)
    
    while True:
        payload = {
            "device_id": "phonebox_001",
            "timestamp": int(time.time()),
            "status": "online",
            "wifi_signal": -65,
            "uptime": int(time.time()) - start_time,
            "box_a_status": "closed",
            "box_b_status": "closed",
            "system_state": 0
        }
        client.publish("phonebox/heartbeat", json.dumps(payload))
        time.sleep(10)  # 每10秒发送一次

client.loop_forever()
```

### Python订阅响应

```python
import paho.mqtt.client as mqtt
import json

def on_connect(client, userdata, flags, rc):
    print(f"Connected with result code {rc}")
    client.subscribe("phonebox/unlock/#")

def on_message(client, userdata, msg):
    print(f"Topic: {msg.topic}")
    print(f"Message: {msg.payload.decode()}")

client = mqtt.Client()
client.on_connect = on_connect
client.on_message = on_message
client.connect("nc5233fc.ala.cn-hangzhou.emqxsl.cn", 8883)
client.loop_forever()
```

---

## 联系支持

如有问题，请联系系统管理员。
