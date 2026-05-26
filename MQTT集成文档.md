# MQTT 协议集成文档

## 版本信息

| 项目 | 版本 |
|------|------|
| 文档版本 | v1.0 |
| 最后更新 | 2026-05-20 |
| 适用系统 | 积分管理平台 |

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
  "client_id": "客户端标识"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `msg_id` | string | 建议 | 用于幂等性保证 |
| `client_id` | string | 建议 | 用于响应路由 |

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
| `rule_name` | string | 三选一 | 通过规则名称模糊匹配 |
| `score_change` | int | 三选一 | 直接指定积分变化值 |
| `description` | string | 否 | 操作说明 |
| `operator` | string | 否 | 操作人 |

**响应格式（Topic: `score/add/result/{client_id}`）：**

```json
{
  "success": true,
  "msg_id": "msg_20260520_001",
  "message": "加分成功: 主动回答问题 (+1分)",
  "new_score": 85,
  "record_id": 123,
  "undo_code": "UNDO_123"
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
  "box