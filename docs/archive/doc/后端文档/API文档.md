# API 接口文档

## 概述

本文档详细描述了积分管理平台的REST API接口。API基于Flask-RESTX构建，支持Swagger UI文档自动生成。

**基础URL**: `http://localhost:5000/api`

**认证方式**: Bearer Token (JWT)

---

## 统一响应格式

所有API响应均使用统一格式，通过`APIResponse`类封装：

### 成功响应

```json
{
  "success": true,
  "code": 0,
  "message": "操作成功",
  "data": { ... }
}
```

### 错误响应

```json
{
  "success": false,
  "code": -1,
  "message": "操作失败",
  "error_code": "ERROR_CODE",
  "timestamp": "2024-01-15T10:30:00Z",
  "path": "/api/users/1"
}
```

### 响应字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| success | bool | 是否成功 |
| code | int | 业务状态码（0=成功，-1=失败） |
| message | string | 响应消息 |
| data | any | 响应数据（成功时返回） |
| error_code | string | 错误代码（失败时返回） |
| timestamp | string | 时间戳（失败时返回） |
| path | string | 请求路径（失败时返回） |

---

## 认证接口

### 1. 登录

**端点**: `POST /api/auth/login`

**描述**: 用户登录获取访问令牌

**请求体**:
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**响应**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin",
    "real_name": "系统管理员"
  },
  "expires_in": 86400
}
```

**错误响应**:
```json
{
  "success": false,
  "message": "用户名或密码错误",
  "error_code": "AUTH_FAILED"
}
```

---

### 2. 刷新令牌

**端点**: `POST /api/auth/refresh`

**描述**: 使用刷新令牌获取新的访问令牌

**请求头**:
```
Authorization: Bearer <refresh_token>
```

**响应**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 86400
}
```

---

### 3. 登出

**端点**: `POST /api/auth/logout`

**描述**: 使当前令牌失效

**响应**:
```json
{
  "success": true,
  "message": "登出成功"
}
```

---

## 用户管理接口

### 1. 获取用户列表

**端点**: `GET /api/users/`

**描述**: 获取所有用户列表，支持分页和过滤

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | int | 否 | 页码（默认1） |
| per_page | int | 否 | 每页数量（默认20） |
| class_name | string | 否 | 班级名称过滤 |
| keyword | string | 否 | 搜索关键词 |
| status | string | 否 | 状态过滤（active/blacklisted） |

**响应**:
```json
{
  "success": true,
  "users": [
    {
      "id": 1,
      "name": "张三",
      "card_id": "1234567890",
      "class_name": "一班",
      "current_score": 85,
      "is_active": true,
      "is_blacklisted": false,
      "created_at": "2024-01-01T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 100,
    "pages": 5
  }
}
```

---

### 2. 创建用户

**端点**: `POST /api/users/`

**描述**: 创建新用户

**请求体**:
```json
{
  "name": "李四",
  "card_id": "1234567891",
  "class_name": "一班",
  "gender": "男",
  "phone": "13800138000",
  "email": "lisi@example.com",
  "initial_score": 60,
  "parent_phone": "13900139000",
  "student_id": "2024001"
}
```

**响应**:
```json
{
  "success": true,
  "user": {
    "id": 2,
    "name": "李四",
    "card_id": "1234567891",
    "class_name": "一班",
    "current_score": 60,
    "created_at": "2024-01-02T10:00:00Z"
  }
}
```

---

### 3. 获取用户详情

**端点**: `GET /api/users/<id>`

**描述**: 获取指定用户的详细信息

**路径参数**:
- `id`: 用户ID

**响应**:
```json
{
  "success": true,
  "user": {
    "id": 1,
    "name": "张三",
    "card_id": "1234567890",
    "class_name": "一班",
    "current_score": 85,
    "total_score": 150,
    "is_active": true,
    "is_blacklisted": false,
    "rank": {
      "name": "进取者",
      "level": 3
    },
    "statistics": {
      "total_operations": 45,
      "weekly_unlock_count": 2,
      "today_unlock_count": 0
    },
    "created_at": "2024-01-01T10:00:00Z"
  }
}
```

---

### 4. 更新用户

**端点**: `PUT /api/users/<id>`

**描述**: 更新用户信息

**请求体**:
```json
{
  "name": "张三（修改）",
  "class_name": "二班",
  "phone": "13800138001",
  "is_active": true
}
```

---

### 5. 删除用户

**端点**: `DELETE /api/users/<id>`

**描述**: 删除指定用户

**响应**:
```json
{
  "success": true,
  "message": "用户已删除"
}
```

---

### 6. 通过卡号查询用户

**端点**: `GET /api/users/card/<card_id>`

**描述**: 使用刷卡卡号查询用户信息

**响应**:
```json
{
  "success": true,
  "user": {
    "id": 1,
    "name": "张三",
    "card_id": "1234567890",
    "current_score": 85
  }
}
```

---

### 7. 更新用户积分

**端点**: `PUT /api/users/<id>/score`

**描述**: 更新用户积分（加分或扣分）

**请求体**:
```json
{
  "score_change": 10,
  "reason": "按时完成作业"
}
```

**响应**:
```json
{
  "success": true,
  "new_score": 95,
  "change": 10,
  "reason": "按时完成作业"
}
```

---

### 8. 用户黑名单管理

**端点**: `PUT /api/users/<id>/blacklist`

**描述**: 将用户加入或移出黑名单

**请求体**:
```json
{
  "is_blacklisted": true,
  "blacklist_reason": "多次违规",
  "blacklist_until": "2024-12-31T23:59:59Z"
}
```

---

### 9. 批量导入用户

**端点**: `POST /api/users/import`

**描述**: 批量导入用户（Excel文件）

**请求**: multipart/form-data

**表单字段**:
- `file`: Excel文件
- `class_name`: 班级名称（可选）

**响应**:
```json
{
  "success": true,
  "imported": 45,
  "failed": 2,
  "errors": [
    {"row": 10, "message": "卡号已存在"},
    {"row": 15, "message": "数据格式错误"}
  ]
}
```

---

## 积分规则接口

### 1. 获取规则列表

**端点**: `GET /api/rules/`

**描述**: 获取所有积分规则

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| category_id | int | 否 | 分类ID |
| is_active | bool | 否 | 是否启用 |
| keyword | string | 否 | 搜索关键词 |

**响应**:
```json
{
  "success": true,
  "rules": [
    {
      "id": 1,
      "name": "按时完成作业",
      "description": "按时提交各科作业",
      "category": {
        "id": 1,
        "name": "学业表现"
      },
      "score": 5,
      "is_active": true,
      "daily_limit": 1,
      "min_interval": 86400,
      "created_at": "2024-01-01T10:00:00Z"
    }
  ]
}
```

---

### 2. 创建规则

**端点**: `POST /api/rules/`

**描述**: 创建新的积分规则

**请求体**:
```json
{
  "name": "课堂积极发言",
  "description": "在课堂上主动回答问题",
  "category_id": 1,
  "score": 3,
  "is_active": true,
  "daily_limit": 3,
  "min_interval": 3600,
  "start_time": "08:00",
  "end_time": "18:00",
  "weekdays": [1, 2, 3, 4, 5]
}
```

---

### 3. 更新规则

**端点**: `PUT /api/rules/<id>`

**描述**: 更新积分规则

**请求体**:
```json
{
  "name": "课堂积极发言（修改）",
  "score": 5,
  "daily_limit": 5
}
```

---

### 4. 删除规则

**端点**: `DELETE /api/rules/<id>`

**描述**: 删除积分规则

---

### 5. 切换规则状态

**端点**: `PUT /api/rules/<id>/toggle`

**描述**: 启用/禁用规则

**响应**:
```json
{
  "success": true,
  "is_active": false
}
```

---

## 设备管理接口

### 1. 获取设备列表

**端点**: `GET /api/devices/`

**描述**: 获取所有设备列表

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| status | string | 否 | 在线状态过滤 |
| location | string | 否 | 位置过滤 |

**响应**:
```json
{
  "success": true,
  "devices": [
    {
      "id": 1,
      "device_id": "ESP32_001",
      "name": "手机管理箱-A",
      "location": "教学楼1层",
      "status": "online",
      "last_heartbeat": "2024-01-15T10:30:00Z",
      "system_state": 0,
      "box_a_status": "closed",
      "box_b_status": "closed",
      "wifi_signal": -55
    }
  ],
  "statistics": {
    "total": 5,
    "online": 4,
    "offline": 1
  }
}
```

---

### 2. 获取设备详情

**端点**: `GET /api/devices/<id>`

**描述**: 获取设备详细信息

**响应**:
```json
{
  "success": true,
  "device": {
    "id": 1,
    "device_id": "ESP32_001",
    "name": "手机管理箱-A",
    "location": "教学楼1层",
    "status": "online",
    "firmware_version": "v1.2.0",
    "last_heartbeat": "2024-01-15T10:30:00Z",
    "uptime": 864000,
    "system_state": 0,
    "system_state_name": "空闲",
    "box_a_status": "closed",
    "box_b_status": "closed",
    "wifi_signal": -55,
    "free_heap": 24500,
    "error_count": 0,
    "last_error": null,
    "created_at": "2024-01-01T10:00:00Z"
  }
}
```

---

### 3. 设备远程控制

**端点**: `POST /api/devices/<id>/control`

**描述**: 远程控制设备

**请求体**:
```json
{
  "action": "restart"
}
```

**action 可选值**:
- `restart`: 重启设备
- `unlock_a`: 打开A箱（无需验证）
- `unlock_b`: 打开B箱（手动模式）

**响应**:
```json
{
  "success": true,
  "message": "重启指令已发送",
  "action": "restart",
  "device_id": "ESP32_001"
}
```

---

### 4. 获取设备状态

**端点**: `GET /api/devices/status`

**描述**: 获取设备在线状态概览

**响应**:
```json
{
  "success": true,
  "status": {
    "total": 5,
    "online": 4,
    "offline": 1,
    "updating": 0
  },
  "devices": [...]
}
```

---

## MQTT接口

### 1. 获取MQTT状态

**端点**: `GET /api/mqtt/status`

**描述**: 获取MQTT连接状态

**响应**:
```json
{
  "success": true,
  "status": {
    "connected": true,
    "broker": "nc5233fc.ala.cn-hangzhou.emqxsl.cn",
    "port": 8883,
    "uptime": 3600,
    "message_count": 1250
  }
}
```

---

### 2. 发送开锁命令

**端点**: `POST /api/mqtt/unlock`

**描述**: 发送开锁命令到设备

**请求体**:
```json
{
  "box_id": "B",
  "response": {
    "result": "true",
    "reason": "score_ok",
    "current_score": 85
  }
}
```

**响应**:
```json
{
  "success": true,
  "message": "已发送开锁指令到 phonebox/unlock/B"
}
```

---

### 3. 发布MQTT消息

**端点**: `POST /api/mqtt/publish`

**描述**: 向指定主题发布MQTT消息

**请求体**:
```json
{
  "topic": "phonebox/ota",
  "payload": {
    "action": "update",
    "version": "v1.3.0",
    "url": "https://example.com/firmware/v1.3.0.bin"
  }
}
```

---

### 4. 获取MQTT日志

**端点**: `GET /api/mqtt/logs`

**描述**: 获取MQTT消息历史

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| topic | string | 否 | 主题过滤 |
| start_time | datetime | 否 | 开始时间 |
| end_time | datetime | 否 | 结束时间 |
| limit | int | 否 | 返回数量（默认100） |

**响应**:
```json
{
  "success": true,
  "logs": [
    {
      "id": 1,
      "topic": "phonebox/query",
      "payload": "{\"card_id\": \"123\"}",
      "direction": "in",
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

## 数据分析接口

### 1. 获取仪表盘数据

**端点**: `GET /api/dashboard/`

**描述**: 获取仪表盘统计数据

**响应**:
```json
{
  "success": true,
  "data": {
    "total_students": 150,
    "total_classes": 8,
    "average_score": 72.5,
    "online_devices": 4,
    "total_devices": 5,
    "today_operations": 25,
    "weekly_trend": {
      "scores": [70, 72, 75, 73, 74, 72, 72.5],
      "labels": ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
    }
  }
}
```

---

### 2. 获取积分趋势

**端点**: `GET /api/analysis/trend`

**描述**: 获取积分趋势数据

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 否 | 趋势类型（daily/weekly/monthly） |
| class_name | string | 否 | 班级过滤 |
| start_date | date | 否 | 开始日期 |
| end_date | date | 否 | 结束日期 |

**响应**:
```json
{
  "success": true,
  "trend": {
    "data": [
      {"date": "2024-01-01", "avg_score": 70.5, "total_students": 150},
      {"date": "2024-01-02", "avg_score": 71.2, "total_students": 150}
    ],
    "statistics": {
      "max": 85.5,
      "min": 65.0,
      "avg": 72.5,
      "change": 2.5
    }
  }
}
```

---

### 3. 获取班级排名

**端点**: `GET /api/analysis/class-ranking`

**描述**: 获取班级积分排名

**响应**:
```json
{
  "success": true,
  "ranking": [
    {
      "rank": 1,
      "class_name": "一班",
      "avg_score": 85.5,
      "total_score": 3420,
      "student_count": 40,
      "trend": "up"
    },
    {
      "rank": 2,
      "class_name": "二班",
      "avg_score": 82.3,
      "total_score": 3292,
      "student_count": 40,
      "trend": "down"
    }
  ]
}
```

---

### 4. 获取学生排名

**端点**: `GET /api/analysis/student-ranking`

**描述**: 获取学生积分排名

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| class_name | string | 否 | 班级过滤 |
| limit | int | 否 | 返回数量（默认50） |

**响应**:
```json
{
  "success": true,
  "ranking": [
    {
      "rank": 1,
      "name": "张三",
      "class_name": "一班",
      "score": 120,
      "rank_name": "卓越者"
    }
  ]
}
```

---

## 积分记录接口

### 1. 获取积分记录

**端点**: `GET /api/records/`

**描述**: 获取积分变动记录

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| user_id | int | 否 | 用户ID |
| rule_id | int | 否 | 规则ID |
| type | string | 否 | 类型（add/deduct） |
| start_date | date | 否 | 开始日期 |
| end_date | date | 否 | 结束日期 |
| page | int | 否 | 页码 |
| per_page | int | 否 | 每页数量 |

**响应**:
```json
{
  "success": true,
  "records": [
    {
      "id": 1,
      "user": {
        "id": 1,
        "name": "张三",
        "class_name": "一班"
      },
      "rule": {
        "id": 1,
        "name": "按时完成作业"
      },
      "score_change": 5,
      "type": "add",
      "reason": "按时完成作业",
      "operator": "系统",
      "device_id": "ESP32_001",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 500,
    "pages": 25
  }
}
```

---

### 2. 撤销积分记录

**端点**: `POST /api/records/<id>/undo`

**描述**: 撤销指定的积分记录

**请求体**:
```json
{
  "reason": "操作失误"
}
```

---

## 固件管理接口

### 1. 获取固件列表

**端点**: `GET /api/firmware/`

**描述**: 获取所有固件版本

**响应**:
```json
{
  "success": true,
  "firmwares": [
    {
      "id": 1,
      "version": "v1.2.0",
      "description": "修复已知问题",
      "file_size": 524288,
      "md5": "abc123def456",
      "is_latest": false,
      "created_at": "2024-01-01T10:00:00Z"
    }
  ]
}
```

---

### 2. 上传新固件

**端点**: `POST /api/firmware/`

**描述**: 上传新固件版本

**请求**: multipart/form-data

**表单字段**:
- `file`: 固件文件
- `version`: 版本号
- `description`: 版本说明

---

### 3. 升级设备固件

**端点**: `POST /api/firmware/upgrade`

**描述**: 升级指定设备的固件

**请求体**:
```json
{
  "device_ids": [1, 2, 3],
  "firmware_version": "v1.3.0"
}
```

---

## 系统配置接口

### 1. 获取系统配置

**端点**: `GET /api/system/config`

**描述**: 获取当前系统配置

**权限**: system.settings

**响应**:
```json
{
  "success": true,
  "code": 0,
  "message": "操作成功",
  "data": {
    "id": 1,
    "system_name": "积分管理平台",
    "system_logo": "/static/logo.png",
    "default_score": 60,
    "min_score": 0,
    "max_score": 100,
    "enable_notifications": true,
    "notification_sound": false,
    "auto_save": true,
    "theme": "dark",
    "language": "zh-CN",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

---

### 2. 更新系统配置

**端点**: `PUT /api/system/config`

**描述**: 更新系统配置

**权限**: system.settings

**请求体**:
```json
{
  "system_name": "新系统名称",
  "default_score": 100,
  "theme": "light"
}
```

**响应**:
```json
{
  "success": true,
  "code": 0,
  "message": "系统配置更新成功",
  "data": { ... }
}
```

---

### 3. 获取积分限制

**端点**: `GET /api/system/config/score-limits`

**描述**: 获取积分限制配置

**响应**:
```json
{
  "success": true,
  "code": 0,
  "message": "操作成功",
  "data": {
    "min_score": 0,
    "max_score": 100,
    "default_score": 60
  }
}
```

---

## 积分规则服务接口

### 1. 获取规则列表（服务层）

**端点**: `GET /api/rules/service`

**描述**: 通过服务层获取规则列表

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | int | 否 | 页码（默认1） |
| per_page | int | 否 | 每页数量（默认100） |
| category_id | int | 否 | 分类ID筛选 |
| is_active | bool | 否 | 是否启用筛选 |

**响应**:
```json
{
  "success": true,
  "code": 0,
  "message": "操作成功",
  "data": {
    "rules": [...],
    "total": 50,
    "page": 1,
    "per_page": 100,
    "pages": 1
  }
}
```

---

### 2. 获取规则详情（服务层）

**端点**: `GET /api/rules/service/<id>`

**描述**: 通过服务层获取规则详情

**路径参数**:
- `id`: 规则ID

**响应**:
```json
{
  "success": true,
  "code": 0,
  "message": "操作成功",
  "data": {
    "id": 1,
    "name": "按时完成作业",
    "description": "按时提交各科作业",
    "category_id": 1,
    "category_name": "学业表现",
    "score": 5,
    "is_active": true,
    "daily_limit": 1,
    "min_interval": 86400,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

---

### 3. 创建规则（服务层）

**端点**: `POST /api/rules/service`

**描述**: 通过服务层创建规则

**请求体**:
```json
{
  "name": "课堂积极发言",
  "score": 3,
  "category_id": 1,
  "daily_limit": 3,
  "min_interval": 3600
}
```

---

### 4. 更新规则（服务层）

**端点**: `PUT /api/rules/service/<id>`

**描述**: 通过服务层更新规则

**请求体**:
```json
{
  "name": "更新规则名称",
  "score": 5
}
```

---

### 5. 删除规则（服务层）

**端点**: `DELETE /api/rules/service/<id>`

**描述**: 通过服务层删除规则

**响应**:
```json
{
  "success": true,
  "code": 0,
  "message": "规则删除成功",
  "data": true
}
```

---

## 健康检查接口

### 1. 综合健康检查

**端点**: `GET /api/health`

**描述**: 获取系统健康状态

**响应**:
```json
{
  "success": true,
  "code": 0,
  "message": "操作成功",
  "data": {
    "database": {
      "status": "healthy",
      "message": "数据库连接正常"
    },
    "redis": {
      "status": "healthy",
      "message": "Redis连接正常"
    },
    "mqtt": {
      "status": "healthy",
      "message": "MQTT连接正常"
    }
  }
}
```

---

### 2. 单个服务健康检查

**端点**: `GET /api/health/<check_name>`

**描述**: 检查指定服务的健康状态

**路径参数**:
- `check_name`: database/redis/mqtt/disk/memory/cpu

---

## 错误码

| 错误码 | 说明 |
|--------|------|
| 1001 | 认证失败 |
| 1002 | 令牌过期 |
| 1003 | 权限不足 |
| 2001 | 用户不存在 |
| 2002 | 卡号已存在 |
| 2003 | 积分不足 |
| 3001 | 设备不在线 |
| 3002 | 设备控制失败 |
| 4001 | 参数错误 |
| 4002 | 数据格式错误 |
| 5001 | 服务器内部错误 |

---

## 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 已创建 |
| 400 | 请求参数错误 |
| 401 | 未授权 |
| 403 | 禁止访问 |
| 404 | 资源不存在 |
| 429 | 请求过于频繁 |
| 500 | 服务器内部错误 |
