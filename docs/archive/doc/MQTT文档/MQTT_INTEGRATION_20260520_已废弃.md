# MQTT 协议集成文档

> 文档版本：v1.0  
> 最后更新：2026-05-20  
> 适用系统：积分管理平台

---

## 目录

1. [MQTT 基础配置](#一-mqtt-基础配置)
2. [Topic 订阅列表](#二-topic-订阅列表)
3. [消息格式规范](#三-消息格式规范)
4. [响应 Topic 路由规则](#四-响应-topic-路由规则)
5. [幂等性保证](#五-幂等性保证)
6. [积分保护机制](#六-积分保护机制)
7. [客户端集成示例](#七-客户端集成示例)
8. [服务端 API 接口](#八-服务端-api-接口)
9. [安全注意事项](#九-安全注意事项)
10. [故障排查](#十-故障排查)

---

## 一、MQTT 基础配置

### 1.1 连接参数

| 参数 | 值 | 说明 |
|------|-----|------|
| **Broker 地址** | `nc5233fc.ala.cn-hangzhou.emqxsl.cn` | EMQX 云服务 |
| **端口** | `8883` | SSL/TLS 端口 |
| **协议** | MQTT 3.1.1 / 5.0 | 支持两种协议版本 |
| **QoS** | 1 | 至少送达一次 |
| **Keepalive** | 60 秒 | 心跳间隔 |

### 1.2 认证信息

| 参数 | 值 | 说明 |
|------|-----|------|
| **Username** | `phoneboxtest` | 用户名 |
| **Password** | `123456` | 密码 |
| **Client ID** | 自定义 | 建议使用唯一标识 |

### 1.3 安全配置

- **SSL/TLS**: 启用（推荐）
- **证书验证**: 可选（生产环境建议启用）

---

## 二、Topic 订阅列表

系统订阅以下 Topic（均使用 QoS 1）：

| Topic | 用途 | 方向 |
|-------|------|------|
| `phonebox/status` | 手机箱状态上报 | 接收 |
| `phonebox/log` | 手机箱日志上报 | 接收 |
| `phonebox/query` | 手机箱查询请求 | 接收 |
| `score/add` | 积分加分请求 | 接收 |
| `score/undo` | 积分撤销请求 | 接收 |
| `score/rules/query` | 规则查询请求 | 接收 |

---

## 三、消息格式规范

### 3.1 通用消息结构

```json
{
  "msg_id": "唯一消息ID",
  "client_id": "客户端标识",
  "timestamp": "可选的时间戳"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `msg_id` | string | 建议 | 用于幂等性保证，防止重复处理 |
| `client_id` | string | 建议 | 用于响应路由到特定客户端 |
| `timestamp` | string | 否 | ISO 8601 格式时间戳 |

### 3.2 积分加分消息（Topic: `score/add`）

**请求格式：**

```json
{
  "msg_id": "msg_20260520_001",
  "client_id": "client_001",
  "user_id": 1,
  "rule_id": 5,
  "rule_name": "主动回答问题",
  "score_change": 5,
  "description": "课堂表现优秀",
  "operator": "李老师"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `user_id` | int | 是 | 学生ID |
| `rule_id` | int | 三选一 | 通过规则ID加分 |
| `rule_name` | string | 三选一 | 通过规则名称模糊匹配加分 |
| `score_change` | int | 三选一 | 直接指定积分变化值 |
| `description` | string | 否 | 操作说明 |
| `operator` | string | 否 | 操作人，默认"MQTT系统" |

**三选一规则**：必须提供 `rule_id`、`rule_name` 或 `score_change` 中的一个。

**响应格式（Topic: `score/add/result/{client_id}`）：**

```json
{
  "success": true,
  "msg_id": "msg_20260520_001",
  "message": "加分成功: 主动回答问题 (+1分)",
  "new_score": 85,
  "record_id": 123,
  "rule_name": "主动回答问题",
  "undo_code": "UNDO_123"
}
```

**错误响应示例：**

```json
{
  "success": false,
  "msg_id": "msg_20260520_001",
  "message": "用户不存在"
}
```

### 3.3 积分撤销消息（Topic: `score/undo`）

**请求格式：**

```json
{
  "client_id": "client_001",
  "undo_code": "UNDO_123",
  "reason": "操作失误"
}
```

**响应格式（Topic: `score/undo/result/{client_id}`）：**

```json
{
  "success": true,
  "message": "撤销成功 (+1分已回滚)",
  "user_id": 1,
  "new_score": 84
}
```

### 3.4 规则查询消息（Topic: `score/rules/query`）

**请求格式：**

```json
{
  "client_id": "client_001",
  "category": "课堂",
  "search": "回答"
}
```

**响应格式（Topic: `score/rules/result/{client_id}`）：**

```json
{
  "success": true,
  "rules": [
    {
      "id": 1,
      "name": "主动回答问题",
      "score": 0.5,
      "category": "课堂纪律类",
      "description": "课堂上主动回答问题"
    }
  ]
}
```

### 3.5 手机箱状态上报（Topic: `phonebox/status`）

```json
{
  "box_id": "A",
  "status": "opened",
  "timestamp": "2026-05-20T10:30:00Z",
  "card_id": "CARD001",
  "user_id": 1
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `box_id` | string | 是 | 箱子标识（A/B/C等） |
| `status` | string | 是 | `opened` / `closed` / `error` |
| `card_id` | string | 否 | 刷卡的饭卡号 |
| `user_id` | int | 否 | 学生ID |

### 3.6 手机箱日志上报（Topic: `phonebox/log`）

```json
{
  "box_id": "A",
  "level": "INFO",
  "message": "门已打开",
  "timestamp": "2026-05-20T10:30:00Z",
  "details": {}
}
```

---

## 四、响应 Topic 路由规则

| 请求 Topic | 响应 Topic |
|------------|------------|
| `score/add` | `score/add/result/{client_id}` |
| `score/undo` | `score/undo/result/{client_id}` |
| `score/rules/query` | `score/rules/result/{client_id}` |

**如果未提供 `client_id`，响应将发送到公共 Topic**（如 `score/add/result`）。

---

## 五、幂等性保证

### 5.1 消息去重机制

1. 客户端发送消息时携带唯一 `msg_id`
2. 服务端检查 `msg_id` 是否已处理
3. 已处理则返回之前的结果，未处理则执行操作

### 5.2 消息 ID 格式建议

```
msg_{日期}_{序号}
例如: msg_20260520_001
```

### 5.3 过期策略

- 已处理消息记录保留 **7天**

---

## 六、积分保护机制

### 6.1 积分上下限

| 限制类型 | 值 |
|----------|-----|
| 最小值 | 0 |
| 最大值 | 100 |

### 6.2 频率限制

每条规则可配置 `max_per_day`（每日最大使用次数）和 `min_interval`（最小间隔）。

### 6.3 错误码说明

| 错误消息 | 原因 |
|----------|------|
| "用户不存在" | `user_id` 对应的学生不存在 |
| "规则无效或未启用" | `rule_id` 对应的规则不存在或未启用 |
| "频率限制：今日已达上限" | 超过每日使用次数限制 |

---

## 七、客户端集成示例

### 7.1 Python 示例

```python
import paho.mqtt.client as mqtt
import json

client = mqtt.Client(client_id="my_client")
client.username_pw_set("phoneboxtest", "123456")
client.tls_set()

def on_connect(client, userdata, flags, rc):
    client.subscribe("score/add/result/my_client", qos=1)

def on_message(client, userdata, msg):
    print(f"Received: {msg.payload.decode()}")

client.on_connect = on_connect
client.on_message = on_message
client.connect("nc5233fc.ala.cn-hangzhou.emqxsl.cn", 8883, 60)

# 发送加分请求
message = {
    "msg_id": "msg_20260520_001",
    "client_id": "my_client",
    "user_id": 1,
    "rule_name": "主动回答问题"
}
client.publish("score/add", json.dumps(message), qos=1)

client.loop_forever()
```

### 7.2 JavaScript 示例

```javascript
const mqtt = require('mqtt');

const client = mqtt.connect('mqtts://nc5233fc.ala.cn-hangzhou.emqxsl.cn:8883', {
  username: 'phoneboxtest',
  password: '123456',
  clientId: 'my_client'
});

client.on('connect', () => {
  client.subscribe('score/add/result/my_client');
});

client.on('message', (topic, message) => {
  console.log(`Received: ${message.toString()}`);
});

client.publish('score/add', JSON.stringify({
  msg_id: 'msg_20260520_001',
  client_id: 'my_client',
  user_id: 1,
  rule_name: '主动回答问题'
}), { qos: 1 });
```

---

## 八、服务端 API 接口

### 8.1 获取 MQTT 状态

```
GET /api/mqtt/status
```

### 8.2 获取 MQTT 日志

```
GET /api/mqtt/logs?limit=200
```

### 8.3 发布消息

```
POST /api/mqtt/publish
Content-Type: application/json

{
  "topic": "score/add",
  "message": "{...}",
  "qos": 1
}
```

---

## 九、安全注意事项

1. **认证**: 所有连接必须提供用户名和密码
2. **数据加密**: 生产环境必须使用 SSL/TLS
3. **权限控制**: 服务端对消息内容进行严格校验
4. **消息大小**: 单条消息最大 1KB

---

## 十、故障排查

| 问题 | 排查步骤 |
|------|---------|
| 连接失败 | 检查 Broker 地址、端口、用户名密码 |
| 消息发送后无响应 | 检查 Topic 是否正确、QoS 设置 |
| 消息重复处理 | 检查 `msg_id` 是否唯一 |

---

## 代码参考

| 文件 | 说明 |
|------|------|
| [app.py](file:///c:/Users/53527/Desktop/自我管理提升/平台开发/管理平台设计/backend/app.py#L209-L216) | MQTT Topic 订阅配置 |
| [app.py](file:///c:/Users/53527/Desktop/自我管理提升/平台开发/管理平台设计/backend/app.py#L283-L400) | 积分加分消息处理 |

---

**文档结束**