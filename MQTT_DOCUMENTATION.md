# MQTT 对接文档

## 1. 概述

本文档描述了积分管理平台与设备之间的MQTT通信协议规范，包括连接配置、主题定义、消息格式及交互流程。

---

## 2. MQTT 连接配置

### 2.1 基础配置

| 参数 | 默认值 | 说明 |
|------|--------|------|
| **MQTT Broker** | `127.0.0.1` | MQTT服务器地址 |
| **端口** | `1883` | MQTT默认端口 |
| **客户端ID** | `score_platform` | 平台客户端标识 |
| **用户名** | 空 | 如需认证请配置 |
| **密码** | 空 | 如需认证请配置 |
| **保持连接** | `60`秒 | 心跳间隔 |
| **QoS** | `1` | 消息服务质量 |

### 2.2 连接流程

```
设备/平台 → 连接 Broker → 订阅主题 → 接收/发送消息
```

---

## 3. 主题定义

### 3.1 平台订阅的主题

| 主题 | QoS | 说明 |
|------|-----|------|
| `phonebox/status` | 1 | 设备状态上报 |
| `phonebox/log` | 1 | 设备日志上报 |
| `phonebox/query` | 1 | 开锁查询请求 |
| `phonebox/heartbeat` | 1 | 设备心跳包 |
| `score/add` | 1 | 加分请求 |
| `score/undo` | 1 | 撤销积分请求 |
| `score/rules/query` | 1 | 规则查询请求 |

### 3.2 平台发布的主题

| 主题 | QoS | 说明 |
|------|-----|------|
| `phonebox/unlock/A` | 1 | A箱解锁指令 |
| `phonebox/unlock/B` | 1 | B箱解锁指令 |
| `score/add/result/{client_id}` | 1 | 加分结果响应 |
| `score/undo/result/{client_id}` | 1 | 撤销结果响应 |
| `score/rules/list` | 1 | 规则列表推送 |

---

## 4. 消息格式规范

### 4.1 心跳包 (`phonebox/heartbeat`)

**发布方**: 设备  
**订阅方**: 平台  
**发送间隔**: 默认10秒

**消息格式**（JSON）：
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

**字段说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `device_id` | String | 设备唯一标识符（使用MQTT Client ID） |
| `timestamp` | Number | 当前时间戳（秒） |
| `status` | String | 设备状态：`online` / `offline` |
| `wifi_signal` | Number | WiFi信号强度（dBm） |
| `uptime` | Number | 设备运行时长（秒） |
| `box_a_status` | String | A箱状态：`opened` / `closed` |
| `box_b_status` | String | B箱状态：`opened` / `closed` |
| `system_state` | Number | 系统状态码 |

**系统状态码**：
| 状态码 | 说明 |
|--------|------|
| 0 | 空闲 |
| 1 | A箱解锁中 |
| 2 | B箱解锁中 |
| 3 | 错误 |
| 4 | 显示卡号 |

**离线判定**：连续30秒未收到心跳则标记为离线

---

### 4.2 开锁查询请求 (`phonebox/query`)

**发布方**: 设备  
**订阅方**: 平台  

**消息格式**（JSON）：
```json
{
  "box_id": "A",
  "card_id": "CARD123456",
  "hour": 14,
  "minute": 30
}
```

**字段说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `box_id` | String | 箱子标识：`A` / `B` |
| `card_id` | String | 学生卡号 |
| `hour` | Number | 当前小时（24小时制） |
| `minute` | Number | 当前分钟 |

---

### 4.3 开锁指令 (`phonebox/unlock/{box_id}`)

**发布方**: 平台  
**订阅方**: 设备  

**消息格式**（JSON）：
```json
{
  "result": "true",
  "reason": "score_ok",
  "current_score": 85
}
```

**字段说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `result` | String | 开锁结果：`true` / `false` |
| `reason` | String | 结果原因 |
| `current_score` | Number | 当前积分（可选） |

**响应原因码**：
| 原因码 | 说明 |
|--------|------|
| `score_ok` | 积分足够，允许开锁 |
| `score_low` | 积分不足（低于60分） |
| `card_not_found` | 卡号未找到 |
| `not_in_time` | 不在允许时间范围内 |

---

### 4.4 加分请求 (`score/add`)

**发布方**: 设备  
**订阅方**: 平台  

**消息格式**（JSON）：
```json
{
  "msg_id": "MSG_20240101_001",
  "client_id": "phonebox_001",
  "user_id": 123,
  "rule_id": 5,
  "rule_name": "按时交作业",
  "score_change": 10,
  "description": "数学作业按时提交",
  "operator": "张老师"
}
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `msg_id` | String | 是 | 消息唯一标识（用于幂等性检查） |
| `client_id` | String | 是 | 发送设备ID |
| `user_id` | Integer | 是 | 用户ID |
| `rule_id` | Integer | 否 | 规则ID（与rule_name二选一） |
| `rule_name` | String | 否 | 规则名称（与rule_id二选一） |
| `score_change` | Integer | 否 | 直接指定积分变化（优先级最高） |
| `description` | String | 否 | 操作描述 |
| `operator` | String | 否 | 操作人，默认"MQTT系统" |

**响应主题**: `score/add/result/{client_id}`

**响应格式**：
```json
{
  "success": true,
  "message": "加分成功: 按时交作业 (+10分)",
  "msg_id": "MSG_20240101_001",
  "new_score": 95,
  "rule_name": "按时交作业",
  "record_id": 1001,
  "undo_code": "UNDO_1001"
}
```

---

### 4.5 撤销积分请求 (`score/undo`)

**发布方**: 设备  
**订阅方**: 平台  

**消息格式**（JSON）：
```json
{
  "msg_id": "MSG_20240101_002",
  "client_id": "phonebox_001",
  "undo_code": "UNDO_1001",
  "operator": "张老师"
}
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `msg_id` | String | 是 | 消息唯一标识 |
| `client_id` | String | 是 | 发送设备ID |
| `undo_code` | String | 是 | 撤销码（来自加分响应） |
| `operator` | String | 否 | 操作人 |

**响应主题**: `score/undo/result/{client_id}`

---

### 4.6 规则查询请求 (`score/rules/query`)

**发布方**: 设备  
**订阅方**: 平台  

**消息格式**（JSON）：
```json
{
  "client_id": "phonebox_001"
}
```

**响应主题**: `score/rules/list`

**响应格式**：
```json
{
  "rules": [
    {
      "id": 1,
      "name": "按时交作业",
      "score": 10,
      "is_active": true,
      "daily_limit": 3
    }
  ]
}
```

---

## 5. 交互流程图

### 5.1 开锁流程

```
设备                          平台
  |                             |
  |--- phonebox/query --------->|
  |     (card_id, box_id)       |
  |                             |
  | 检查时间规则                 |
  | 检查卡号有效性               |
  | 检查积分是否 >= 60           |
  |                             |
  |<-- phonebox/unlock/A -------|
  |     (result, reason)        |
  |                             |
```

### 5.2 加分流程

```
设备                          平台
  |                             |
  |--- score/add -------------->|
  |     (user_id, rule_name)    |
  |                             |
  | 验证消息幂等性              |
  | 查询规则配置                |
  | 检查每日限额                |
  | 更新用户积分                |
  |                             |
  |<-- score/add/result/<client> |
  |     (success, new_score)    |
  |                             |
```

### 5.3 心跳流程

```
设备                          平台
  |                             |
  |--- phonebox/heartbeat ----->|  (每10秒)
  |     (device_id, status, ...)|
  |                             |
  | 更新设备状态                |
  | 保存心跳记录                |
  | 检测离线状态                |
  |                             |
```

---

## 6. 数据存储

### 6.1 设备状态表 (`device`)

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Integer | 主键ID |
| `device_id` | String | 设备唯一标识 |
| `name` | String | 设备名称 |
| `status` | String | 在线状态 |
| `last_heartbeat` | DateTime | 最后心跳时间 |
| `wifi_signal` | Integer | WiFi信号强度 |
| `uptime` | Integer | 运行时长 |
| `box_a_status` | String | A箱状态 |
| `box_b_status` | String | B箱状态 |
| `system_state` | Integer | 系统状态码 |
| `created_at` | DateTime | 创建时间 |
| `updated_at` | DateTime | 更新时间 |

### 6.2 心跳记录表 (`device_heartbeat`)

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Integer | 主键ID |
| `device_id` | String | 设备标识 |
| `timestamp` | Integer | 时间戳 |
| `status` | String | 设备状态 |
| `wifi_signal` | Integer | WiFi信号 |
| `uptime` | Integer | 运行时长 |
| `box_a_status` | String | A箱状态 |
| `box_b_status` | String | B箱状态 |
| `system_state` | Integer | 系统状态码 |
| `created_at` | DateTime | 记录时间 |

---

## 7. API 接口

### 7.1 设备管理接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/devices` | GET | 获取所有设备列表 |
| `/api/devices` | POST | 创建设备 |
| `/api/devices/{device_id}` | GET | 获取设备详情 |
| `/api/devices/{device_id}` | PUT | 更新设备信息 |
| `/api/devices/{device_id}` | DELETE | 删除设备 |
| `/api/devices/{device_id}/heartbeats` | GET | 获取心跳历史记录 |
| `/api/devices/stats` | GET | 获取设备统计 |

### 7.2 MQTT日志接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/mqtt/logs` | GET | 获取MQTT消息日志 |
| `/api/mqtt/config` | GET | 获取MQTT配置 |
| `/api/mqtt/config` | PUT | 更新MQTT配置 |
| `/api/mqtt/reconnect` | POST | 重新连接MQTT |

---

## 8. 错误处理

### 8.1 消息处理失败

当平台处理MQTT消息失败时，会记录日志并尝试重新处理。关键错误包括：

- **JSON解析错误**: 消息格式不符合JSON规范
- **字段缺失**: 必填字段缺失
- **数据验证失败**: 数据格式不正确
- **数据库操作失败**: 存储失败

### 8.2 连接断开重连

平台实现了自动重连机制：
- 检测到连接断开后，等待5秒
- 尝试重新连接到MQTT Broker
- 重连成功后自动重新订阅所有主题

---

## 9. 安全考虑

1. **消息幂等性**: 通过`msg_id`确保消息不会被重复处理
2. **数据验证**: 所有输入数据进行严格验证
3. **日志记录**: 所有MQTT消息都被记录到数据库
4. **访问控制**: API接口需要管理员认证

---

## 10. 测试工具

平台提供了MQTT测试工具：`/mqtt-test-tool/index.html`

功能：
- 模拟设备发送心跳包
- 发送开锁查询请求
- 发送加分请求
- 查看实时消息日志

---

## 附录：主题汇总

| 主题 | 方向 | 用途 |
|------|------|------|
| `phonebox/status` | 设备→平台 | 设备状态上报 |
| `phonebox/log` | 设备→平台 | 设备日志上报 |
| `phonebox/query` | 设备→平台 | 开锁查询 |
| `phonebox/heartbeat` | 设备→平台 | 心跳包 |
| `phonebox/unlock/A` | 平台→设备 | A箱解锁 |
| `phonebox/unlock/B` | 平台→设备 | B箱解锁 |
| `score/add` | 设备→平台 | 加分请求 |
| `score/add/result/{client}` | 平台→设备 | 加分响应 |
| `score/undo` | 设备→平台 | 撤销请求 |
| `score/undo/result/{client}` | 平台→设备 | 撤销响应 |
| `score/rules/query` | 设备→平台 | 规则查询 |
| `score/rules/list` | 平台→设备 | 规则列表 |

---

**文档版本**: v1.0  
**创建日期**: 2026年5月  
**适用平台**: 积分管理平台