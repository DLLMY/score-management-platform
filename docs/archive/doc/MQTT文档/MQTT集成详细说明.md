# MQTT 对接文档

## 1. 概述

本文档详细描述了积分管理平台与 ESP32 设备之间的 MQTT 通信协议。平台采用 MQTT 3.1.1 协议进行设备通信，支持实时消息传递、设备状态监控、远程控制等功能。

---

## 2. 架构设计

### 2.1 系统架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         云端服务层                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                │
│  │  Web前端    │    │  Flask后端   │    │  MQTT Broker│                │
│  │  Dashboard  │───►│  API服务    │───►│  EMQX Cloud │                │
│  └─────────────┘    └─────────────┘    └──────┬──────┘                │
└─────────────────────────────────────────────────────────────────────────┘
                                                 │
                                                 │ MQTT over TLS
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         设备层                                          │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                │
│  │  ESP32-A    │    │  ESP32-B    │    │  ESP32-C    │                │
│  │  手机管理箱  │◄───►│  手机管理箱  │◄───►│  手机管理箱  │              │
│  └─────────────┘    └─────────────┘    └─────────────┘                │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 核心组件

| 组件 | 职责 | 实现方式 |
|------|------|---------|
| **MQTT Broker** | 消息中转、路由分发 | EMQX Cloud |
| **MQTT Manager** | 连接管理、消息处理 | Python 单例类 |
| **设备端** | 消息收发、硬件控制 | ESP32 + Arduino |
| **后端服务** | 业务逻辑、数据持久化 | Flask + SQLAlchemy |

---

## 3. 连接配置

### 3.1 默认配置

| 参数 | 默认值 | 说明 |
|------|--------|------|
| **Broker** | `nc5233fc.ala.cn-hangzhou.emqxsl.cn` | EMQX Cloud 服务器 |
| **Port (TCP)** | `8883` | TLS 加密端口 |
| **Port (WebSocket)** | `8084` | WebSocket 端口 |
| **Username** | `phoneboxtest` | 认证用户名 |
| **Password** | `123456` | 认证密码 |
| **Client ID** | `score_backend_<timestamp>` | 客户端标识 |
| **SSL** | `true` | 是否启用 TLS |
| **Keepalive** | `60` | 心跳间隔（秒） |
| **Timeout** | `10` | 连接超时（秒） |

### 3.2 连接方式

支持两种连接方式：

#### 方式一：TCP 连接（推荐）

```python
mqtt_config = {
    'broker': 'nc5233fc.ala.cn-hangzhou.emqxsl.cn',
    'port': 8883,
    'client_id': 'score_backend_tcp',
    'username': 'phoneboxtest',
    'password': '123456',
    'ssl': True,
    'transport': 'tcp'
}
```

#### 方式二：WebSocket 连接（备用）

```python
mqtt_config = {
    'broker': 'nc5233fc.ala.cn-hangzhou.emqxsl.cn',
    'port': 8084,
    'client_id': 'score_backend_ws',
    'username': 'phoneboxtest',
    'password': '123456',
    'ssl': True,
    'transport': 'websockets',
    'ws_path': '/mqtt'
}
```

---

## 4. 主题定义

### 4.1 主题命名规范

```
phonebox/<功能>/<子功能>/<设备ID>
score/<功能>/<子功能>/<客户端ID>
```

### 4.2 完整主题列表

| 主题 | QoS | 方向 | 描述 |
|------|-----|------|------|
| `phonebox/query` | 1 | 设备→后端 | 刷卡查询请求 |
| `phonebox/unlock/A` | 1 | 后端→设备 | A箱开锁指令 |
| `phonebox/unlock/B` | 1 | 后端→设备 | B箱开锁指令（含验证结果） |
| `phonebox/status` | 1 | 设备→后端 | 设备状态上报 |
| `phonebox/heartbeat` | 1 | 设备→后端 | 设备心跳 |
| `phonebox/log` | 1 | 设备→后端 | 设备日志 |
| `phonebox/ota` | 1 | 后端→设备 | OTA升级广播 |
| `phonebox/ota/<device_id>` | 1 | 后端→设备 | OTA定向升级 |
| `phonebox/ota/status` | 1 | 设备→后端 | OTA状态上报 |
| `phonebox/ota/<device_id>/status` | 1 | 设备→后端 | 指定设备OTA状态 |
| `score/add` | 1 | 设备→后端 | 积分增加请求 |
| `score/add/result/<client_id>` | 1 | 后端→设备 | 积分增加响应 |
| `score/undo` | 1 | 设备→后端 | 积分撤销请求 |
| `score/undo/result/<client_id>` | 1 | 后端→设备 | 积分撤销响应 |
| `score/rules/query` | 1 | 设备→后端 | 规则查询请求 |

---

## 5. 消息格式

### 5.1 刷卡查询消息

**主题**: `phonebox/query`

**设备发送**:
```json
{
    "box_id": "B",
    "card_id": "1234567890",
    "hour": 14,
    "minute": 30
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `box_id` | String | 箱子标识（A/B） |
| `card_id` | String | 刷卡卡号 |
| `hour` | Integer | 当前小时 |
| `minute` | Integer | 当前分钟 |

**后端响应**: `phonebox/unlock/B`

成功：
```json
{
    "result": "true",
    "reason": "score_ok",
    "current_score": 85
}
```

失败：
```json
{
    "result": "false",
    "reason": "score_low",
    "current_score": 55
}
```

**`reason` 枚举**:

| 值 | 含义 |
|----|------|
| `score_ok` | 积分足够，开锁成功 |
| `score_low` | 积分不足 |
| `card_not_found` | 卡号未注册 |
| `not_in_time` | 不在开锁时间段 |
| `manual` | 手动远程开锁 |

---

### 5.2 心跳消息

**主题**: `phonebox/heartbeat`

**设备发送**:
```json
{
    "device_id": "esp32_001",
    "timestamp": 1699900000,
    "status": "online",
    "wifi_signal": -65,
    "uptime": 3600,
    "box_a_status": "closed",
    "box_b_status": "closed",
    "system_state": 0,
    "fw_version": "v1.2.0",
    "platform": "ESP32",
    "free_heap": 24500,
    "last_error": "",
    "error_count": 0
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `device_id` | String | 设备唯一标识 |
| `timestamp` | Integer | 时间戳（秒） |
| `status` | String | 设备状态（online/offline） |
| `wifi_signal` | Integer | WiFi信号强度（dBm） |
| `uptime` | Integer | 运行时间（秒） |
| `box_a_status` | String | A箱状态（open/closed） |
| `box_b_status` | String | B箱状态（open/closed） |
| `system_state` | Integer | 系统状态码 |
| `fw_version` | String | 固件版本 |
| `platform` | String | 硬件平台 |
| `free_heap` | Integer | 可用内存（字节） |
| `last_error` | String | 最后错误信息 |
| `error_count` | Integer | 错误计数 |

**系统状态码**:

| 码值 | 状态 | 说明 |
|------|------|------|
| 0 | `STATE_IDLE` | 空闲状态 |
| 1 | `STATE_UNLOCKING_A` | A箱开锁中 |
| 2 | `STATE_SHOWING_CARD` | 显示卡号等待响应 |
| 3 | `STATE_UNLOCKING_B` | B箱开锁中 |
| 4 | `STATE_ERROR_B` | B箱错误状态 |

---

### 5.3 积分增加消息

**主题**: `score/add`

**设备发送**:
```json
{
    "msg_id": "REQ_20240101_001",
    "client_id": "device_001",
    "user_id": 123,
    "rule_id": 5,
    "rule_name": "按时交作业",
    "score_change": 5,
    "description": "按时提交数学作业",
    "operator": "班主任"
}
```

**后端响应**: `score/add/result/<client_id>`

成功：
```json
{
    "success": true,
    "message": "加分成功: 按时交作业 (+5分)",
    "msg_id": "REQ_20240101_001",
    "new_score": 95,
    "record_id": 1001,
    "undo_code": "UNDO_1001"
}
```

失败：
```json
{
    "success": false,
    "message": "今日已达到上限 (20/20)",
    "msg_id": "REQ_20240101_001"
}
```

---

### 5.4 积分撤销消息

**主题**: `score/undo`

**设备发送**:
```json
{
    "undo_code": "UNDO_1001",
    "client_id": "device_001",
    "reason": "操作失误"
}
```

**后端响应**: `score/undo/result/<client_id>`

成功：
```json
{
    "success": true,
    "message": "撤销成功 (-5分已回滚)",
    "user_id": 123,
    "new_score": 90
}
```

---

### 5.5 OTA升级消息

**主题**: `phonebox/ota` 或 `phonebox/ota/<device_id>`

**后端发送**:
```json
{
    "action": "update",
    "timestamp": 1699900000,
    "url": "https://example.com/firmware/v1.3.0.bin",
    "version": "v1.3.0",
    "md5": "abc123def456",
    "force": false
}
```

**设备状态上报**: `phonebox/ota/status`

```json
{
    "device_id": "esp32_001",
    "status": "downloading",
    "progress": 45,
    "from_version": "v1.2.0",
    "to_version": "v1.3.0"
}
```

**`status` 枚举**:

| 值 | 说明 |
|----|------|
| `started` | 开始升级 |
| `downloading` | 下载中 |
| `updating` | 升级中 |
| `success` | 升级成功 |
| `failed` | 升级失败 |

---

## 6. 通信流程

### 6.1 刷卡开锁流程

```
设备端                          后端                          MQTT Broker
  │                               │                               │
  │ 1. 刷卡读取卡号               │                               │
  │                               │                               │
  │ 2. 发送查询请求               │                               │
  │───► phonebox/query ──────────►│                               │
  │                               │                               │
  │                               │ 3. 查询用户、验证积分、检查时间窗口
  │                               │                               │
  │                               │ 4. 发送开锁指令               │
  │◄─── phonebox/unlock/B ────────│                               │
  │                               │                               │
  │ 5. 验证指令、执行开锁          │                               │
  │                               │                               │
  │ 6. 发送状态日志               │                               │
  │───► phonebox/log ────────────►│                               │
  │                               │                               │
```

### 6.2 远程开锁流程

```
前端                            后端                          设备端
  │                               │                               │
  │ 1. 发起远程开锁请求            │                               │
  │───► POST /api/devices/id/control ─►                           │
  │                               │                               │
  │                               │ 2. 智能重试机制（3次发送）      │
  │                               │───► phonebox/unlock/A ────────►│
  │                               │───► phonebox/unlock/A ────────►│
  │                               │───► phonebox/unlock/A ────────►│
  │                               │                               │
  │                               │                               │ 3. 执行开锁
  │                               │                               │
```

### 6.3 心跳上报流程

```
设备端                          后端                          数据库
  │                               │                               │
  │ 1. 定时发送心跳（每30秒）       │                               │
  │───► phonebox/heartbeat ────────►│                               │
  │                               │                               │
  │                               │ 2. 更新设备状态                │
  │                               │───► UPDATE Device ───────────►│
  │                               │                               │
  │                               │ 3. 创建心跳记录                │
  │                               │───► INSERT Heartbeat ─────────►│
  │                               │                               │
  │                               │ 4. WebSocket广播状态变化       │
  │                               │───► 前端实时更新               │
  │                               │                               │
```

---

## 7. API 接口

### 7.1 基础接口

| API路径 | 方法 | 描述 | 权限 |
|---------|------|------|------|
| `/api/mqtt/status` | GET | 获取MQTT连接状态 | 公开 |
| `/api/mqtt/config` | GET | 获取MQTT配置 | 公开 |
| `/api/mqtt/config` | PUT | 更新MQTT配置 | 管理员 |
| `/api/mqtt/connect` | POST | 连接MQTT服务器 | 公开 |
| `/api/mqtt/disconnect` | POST | 断开MQTT连接 | 公开 |
| `/api/mqtt/publish` | POST | 发布MQTT消息 | 管理员 |
| `/api/mqtt/logs` | GET | 获取历史日志 | 公开 |
| `/api/mqtt/recent` | GET | 获取最近日志（内存） | 公开 |
| `/api/mqtt/subscribe` | POST | 订阅主题 | 公开 |
| `/api/mqtt/unsubscribe` | POST | 取消订阅 | 公开 |
| `/api/mqtt/unlock` | POST | 发送开锁命令 | 公开 |

### 7.2 设备远程控制

**路径**: `/api/devices/<id>/control`

**方法**: POST

**请求体**:
```json
{
    "action": "unlock_a"
}
```

**`action` 枚举**:

| 值 | 说明 |
|----|------|
| `restart` | 重启设备 |
| `unlock_a` | 打开A箱（无需验证） |
| `unlock_b` | 打开B箱（手动模式） |

**响应**:
```json
{
    "success": true,
    "message": "A箱智能开锁指令已发送（后台执行，共发送3次）",
    "action": "unlock_a",
    "device_id": "esp32_001"
}
```

---

## 8. 设备端实现

### 8.1 MQTT初始化

```cpp
#include <WiFi.h>
#include <PubSubClient.h>

// MQTT配置
#define MQTT_BROKER "nc5233fc.ala.cn-hangzhou.emqxsl.cn"
#define MQTT_PORT 8883
#define MQTT_USERNAME "phoneboxtest"
#define MQTT_PASSWORD "123456"

// 主题定义
#define TOPIC_QUERY       "phonebox/query"
#define TOPIC_UNLOCK_A    "phonebox/unlock/A"
#define TOPIC_UNLOCK_B    "phonebox/unlock/B"
#define TOPIC_HEARTBEAT   "phonebox/heartbeat"
#define TOPIC_LOG         "phonebox/log"

WiFiClientSecure wifiClient;
PubSubClient mqttClient(wifiClient);

void mqttSetup() {
    // 配置TLS
    wifiClient.setInsecure();
    
    mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
    mqttClient.setCallback(mqttCallback);
    mqttClient.setKeepAlive(60);
}

void mqttConnect() {
    String clientId = "esp32_" + String(random(0xffff), HEX);
    
    if (mqttClient.connect(clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD)) {
        mqttClient.subscribe(TOPIC_UNLOCK_A, 1);
        mqttClient.subscribe(TOPIC_UNLOCK_B, 1);
        Serial.println("MQTT连接成功，已订阅主题");
    }
}
```

### 8.2 消息回调处理

```cpp
void mqttCallback(char* topic, byte* payload, unsigned int length) {
    String message;
    for (unsigned int i = 0; i < length; i++) {
        message += (char)payload[i];
    }
    
    Serial.printf("收到消息: %s -> %s\n", topic, message.c_str());
    
    if (String(topic) == TOPIC_UNLOCK_A) {
        // A箱远程开锁 - 立即执行
        triggerUnlock("A");
    } else if (String(topic) == TOPIC_UNLOCK_B) {
        StaticJsonDocument<200> doc;
        DeserializationError error = deserializeJson(doc, message);
        
        if (!error) {
            String result = doc["result"] | "false";
            if (result == "true") {
                // B箱开锁授权成功
                triggerUnlock("B");
            } else if (result == "false") {
                // 开锁失败，显示错误信息
                String reason = doc["reason"] | "unknown";
                int score = doc["current_score"] | 0;
                showError(reason, score);
            }
        }
    }
}
```

### 8.3 发送查询请求

```cpp
void sendQuery(String cardId) {
    StaticJsonDocument<200> doc;
    doc["box_id"] = "B";
    doc["card_id"] = cardId;
    doc["hour"] = hour();
    doc["minute"] = minute();
    
    String payload;
    serializeJson(doc, payload);
    
    mqttClient.publish(TOPIC_QUERY, payload.c_str(), true);
}
```

---

## 9. 安全机制

### 9.1 认证与授权

- **用户名/密码认证**: 所有连接必须提供有效的用户名和密码
- **TLS加密**: 所有通信均通过 TLS 加密传输
- **主题权限**: 设备只能发布/订阅特定主题

### 9.2 消息幂等性

- 使用 `msg_id` 确保消息不被重复处理
- 已处理消息记录到 `ProcessedMessage` 表
- 撤销操作使用唯一 `undo_code`

### 9.3 限流保护

- 使用 Flask-Limiter 限制 API 请求频率
- 默认：1000次/小时，30次/分钟
- MQTT 消息处理设置队列上限（1000条）

---

## 10. 故障处理

### 10.1 连接断开处理

```
断开检测 ──► 指数退避重连 ──► 最大延迟60秒 ──► 持续重试
     │
     ▼
  记录日志
```

### 10.2 消息队列溢出

- 队列最大容量：1000条
- 超出时自动丢弃最早消息
- 记录溢出警告日志

### 10.3 设备心跳超时

- 心跳间隔：30秒
- 超时阈值：90秒（3个周期）
- 超时时更新设备状态为离线

---

## 11. 性能优化

### 11.1 消息批量处理

- 批量写入间隔：1秒
- 批量阈值：50条消息
- 使用数据库批量插入

### 11.2 用户缓存

- 缓存有效期：60秒
- 使用线程安全锁
- 缓存用户查询结果

### 11.3 异步处理

- 日志记录异步执行
- 非关键消息入队处理
- WebSocket推送异步发送

---

## 12. 部署说明

### 12.1 后端服务启动

```bash
cd backend
pip install -r requirements.txt
python app.py
```

### 12.2 环境变量配置

```bash
# .env 文件
FLASK_SECRET_KEY=your-secret-key
MQTT_BROKER=nc5233fc.ala.cn-hangzhou.emqxsl.cn
MQTT_PORT=8883
MQTT_USERNAME=phoneboxtest
MQTT_PASSWORD=123456
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 12.3 设备烧录

```bash
# 使用 esptool 烧录
esptool.py --chip esp32 --port COM3 write_flash -z 0x1000 firmware.bin
```

---

## 附录：错误码表

| 错误码 | 说明 | 解决方案 |
|--------|------|----------|
| 1 | 协议版本错误 | 检查MQTT协议版本 |
| 2 | 客户端标识符无效 | 使用有效的client_id |
| 3 | 服务器不可用 | 检查网络连接和Broker地址 |
| 4 | 用户名或密码错误 | 验证认证信息 |
| 5 | 未授权 | 检查主题权限配置 |
