# 成绩管理系统 API 文档

**生成时间**: 2026-07-29 17:37:38

**框架**: Flask-RESTX (OpenAPI 3.0)

**API端点总数**: 545

---

## 积分管理平台 API

积分管理平台的 RESTful API 文档

## 数据模型 (Schemas)

| 名称 | 类型 | 描述 | 属性数 |
|------|------|------|--------|
| `ActiveRule` | object |  | 3 |
| `Admin` | object |  | 8 |
| `AdminClassesResponse` | object |  | 5 |
| `AdminNotification` | object |  | 10 |
| `ApplyTemplate` | object |  | 2 |
| `Approval` | object |  | 10 |
| `AssignClass` | object |  | 2 |
| `AssignClassRequest` | object |  | 2 |
| `AssignRoles` | object |  | 1 |
| `BackupRestore` | object |  | 1 |
| `BatchControl` | object |  | 2 |
| `BatchDeleteRequest` | object |  | 1 |
| `BatchScoreRequest` | object |  | 3 |
| `BatchUpdate` | object |  | 1 |
| `BatchUpgradeRequest` | object |  | 2 |
| `BindAdminRequest` | object |  | 1 |
| `BindClassRequest` | object |  | 1 |
| `BlacklistRequest` | object |  | 2 |
| `BoxVerifyRequest` | object |  | 3 |
| `Category` | object |  | 4 |
| `ChangePasswordRequest` | object |  | 2 |
| `ClassInfo` | object |  | 6 |
| `ClassPeriod` | object |  | 10 |
| `ClassPeriodListResponse` | object |  | 2 |
| `ClassPeriodResponse` | object |  | 13 |
| `ClassResponse` | object |  | 10 |
| `CourseSchedule` | object |  | 11 |
| `CourseScheduleResponse` | object |  | 19 |
| `Device` | object |  | 6 |
| `DeviceGroup` | object |  | 11 |
| `DeviceGroupCreate` | object |  | 6 |
| `DeviceGroupDetail` | object |  | 12 |
| `DeviceInGroup` | object |  | 4 |
| `DeviceListResponse` | object |  | 18 |
| `DeviceSettings` | object |  | 3 |
| `DeviceStatsResponse` | object |  | 6 |
| `Exam` | object |  | 13 |
| `ExecuteInput` | object |  | 2 |
| `ExportFormat` | object |  | 2 |
| `FieldMapping` | object |  | 8 |
| `FirmwareUpload` | object |  | 4 |
| `FirmwareVersion` | object |  | 8 |
| `FrontendError` | object |  | 13 |
| `FrontendPerformance` | object |  | 10 |
| `FrontendPerformanceBatch` | object |  | 1 |
| `ImportConfig` | object |  | 13 |
| `LoginRequest` | object |  | 2 |
| `LoginResponse` | object |  | 5 |
| `MQTTCommand` | object |  | 3 |
| `MQTTConfig` | object |  | 9 |
| `MQTTConnect` | object |  | 10 |
| `MQTTPublish` | object |  | 2 |
| `MQTTStatusResponse` | object |  | 2 |
| `MQTTSubscribe` | object |  | 2 |
| `MQTTUnlock` | object |  | 1 |
| `ManualCorrection` | object |  | 6 |
| `MatchedRule` | object |  | 11 |
| `Notification` | object |  | 8 |
| `NotificationConfig` | object |  | 12 |
| `NotificationCount` | object |  | 2 |
| `NotifyResponse` | object |  | 4 |
| `NotifyTemplate` | object |  | 13 |
| `OTAUpgrade` | object |  | 3 |
| `ParseInput` | object |  | 1 |
| `ParseOutput` | object |  | 11 |
| `Permission` | object |  | 8 |
| `RecordListResponse` | object |  | 5 |
| `RecordStatistics` | object |  | 5 |
| `RemoteControl` | object |  | 1 |
| `RemoteNotify` | object |  | 9 |
| `RoleWithPermissions` | object |  | 7 |
| `RuleListResponse` | object |  | 5 |
| `ScheduledNotify` | object |  | 12 |
| `ScoreChangeNotify` | object |  | 6 |
| `ScoreRankRule` | object |  | 10 |
| `ScoreRecord` | object |  | 7 |
| `ScoreRule` | object |  | 8 |
| `ScoringRule` | object |  | 8 |
| `SetPermissions` | object |  | 1 |
| `Subject` | object |  | 9 |
| `SubjectClass` | object |  | 3 |
| `SubjectResponse` | object |  | 10 |
| `Suggestion` | object |  | 5 |
| `SystemConfig` | object |  | 11 |
| `TemplateResponse` | object |  | 16 |
| `TimeRule` | object |  | 10 |
| `TimeRuleCheckResponse` | object |  | 3 |
| `TimeRuleListResponse` | object |  | 1 |
| `TimeRuleResponse` | object |  | 13 |
| `TrainInput` | object |  | 5 |
| `UnlockLimitRequest` | object |  | 1 |
| `User` | object |  | 14 |
| `UserImportRequest` | object |  | 1 |
| `UserListResponse` | object |  | 5 |
| `ValidationRule` | object |  | 4 |
| `WOLDevice` | object |  | 9 |
| `WOLResponse` | object |  | 4 |
| `WakeOnLAN` | object |  | 3 |
| `WakeOnLANBroadcast` | object |  | 3 |

## admin-classes

### <span style="color: green">**GET**</span> `/admin-classes/{admin_id}`

获取管理员关联的班级列表

> 获取指定管理员关联的所有班级信息。

参数：
- admin_id: 管理员ID（路径参数）

**响应**:

- **`404`**: 管理员不存在

- **`200`**: 成功
  - Schema: `AdminClassesResponse`

**示例请求**:

```bash
curl -X GET `$BASE_URL`/admin-classes/{admin_id} \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: blue">**POST**</span> `/admin-classes/{admin_id}/assign-class`

为管理员分配班级

> 将指定班级分配给管理员。如果已存在关联，则更新主班标识。

参数：
- admin_id: 管理员ID（路径参数）

请求体：
- class_id: 班级ID（必填）
- is_primary: 是否主要班级（可选，默认False）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `AssignClass` (参见数据模型章节)

**响应**:

- **`404`**: 管理员或班级不存在

- **`200`**: 分配成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/admin-classes/{admin_id}/assign-class \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: blue">**POST**</span> `/admin-classes/{admin_id}/remove-class/{class_id}`

移除管理员的班级关联

> 移除管理员与指定班级的关联关系。

参数：
- admin_id: 管理员ID（路径参数）
- class_id: 班级ID（路径参数）

**响应**:

- **`404`**: 未找到关联记录

- **`200`**: 移除成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/admin-classes/{admin_id}/remove-class/{class_id} \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

## admin_notifications

### <span style="color: green">**GET**</span> `/admin_notifications/`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/admin_notifications/ \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/admin_notifications/`

创建课程安排。需要课表管理权限。

> 请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `AdminNotification` (参见数据模型章节)

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/admin_notifications/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: green">**GET**</span> `/admin_notifications/count`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**请求头参数**:

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| `X-Fields` | string | 否 | An optional fields mask |

**响应**:

- **`200`**: Success
  - Schema: `NotificationCount`

**示例请求**:

```bash
curl -X GET `$BASE_URL`/admin_notifications/count \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/admin_notifications/read_all`

创建课程安排。需要课表管理权限。

> 请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/admin_notifications/read_all \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/admin_notifications/recent`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**请求头参数**:

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| `X-Fields` | string | 否 | An optional fields mask |

**响应**:

- **`200`**: Success
  - Schema: `AdminNotification`

**示例请求**:

```bash
curl -X GET `$BASE_URL`/admin_notifications/recent \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/admin_notifications/{id}`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**请求头参数**:

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| `X-Fields` | string | 否 | An optional fields mask |

**响应**:

- **`200`**: Success
  - Schema: `AdminNotification`

**示例请求**:

```bash
curl -X GET `$BASE_URL`/admin_notifications/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: red">**DELETE**</span> `/admin_notifications/{id}`

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/admin_notifications/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/admin_notifications/{id}/read`

创建课程安排。需要课表管理权限。

> 请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/admin_notifications/{id}/read \
  -H "Authorization: Bearer $TOKEN"
```

---

## admins

### <span style="color: green">**GET**</span> `/admins/`

获取所有管理员列表

> 获取管理员列表
需要管理员权限。返回所有管理员的基本信息。

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/admins/ \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: blue">**POST**</span> `/admins/`

创建新管理员

> 创建一个新的管理员账户。需要超级管理员权限。

参数：
- username: 用户名（必填）
- password: 密码（必填，至少8位，包含字母和数字）
- role: 角色（可选，默认admin）
- real_name: 真实姓名（可选）
- phone: 联系电话（可选）
- class_name: 所属班级（可选，教师角色使用）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `Admin` (参见数据模型章节)

**响应**:

- **`400`**: 参数错误或密码强度不足

- **`201`**: 创建成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/admins/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/admins/csrf-token`

获取CSRF令牌

> 获取用于表单提交的CSRF令牌。

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/admins/csrf-token \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/admins/login`

管理员登录

> 使用用户名和密码进行登录，成功后返回JWT令牌。

请求体：
- username: 用户名
- password: 密码

返回：
- access_token: 访问令牌（有效期较短）
- refresh_token: 刷新令牌（有效期较长）
- admin: 管理员信息

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `LoginRequest` (参见数据模型章节)

**响应**:

- **`401`**: 用户名或密码错误

- **`200`**: 登录成功
  - Schema: `LoginResponse`

**示例请求**:

```bash
curl -X POST `$BASE_URL`/admins/login \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: blue">**POST**</span> `/admins/refresh-token`

刷新访问令牌

> 使用refresh_token获取新的access_token。

请求：refresh_token优先从Cookie获取，若Cookie不存在则从请求体获取

返回：
- access_token: 新的访问令牌
- refresh_token: 新的刷新令牌

**响应**:

- **`401`**: 无效的refresh_token或管理员不存在

- **`400`**: 缺少refresh_token

- **`200`**: 刷新成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/admins/refresh-token \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/admins/{admin_id}/assign-class`

为管理员分配班级

> 将班级分配给指定的管理员。需要管理员权限。

请求体：
- class_id: 班级ID（必填）
- is_primary: 是否为主班级（可选，默认false）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `AssignClassRequest` (参见数据模型章节)

**响应**:

- **`404`**: 管理员或班级不存在

- **`400`**: 参数错误

- **`200`**: 分配成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/admins/{admin_id}/assign-class \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: blue">**POST**</span> `/admins/{admin_id}/remove-class/{class_id}`

移除管理员的班级分配

> 从管理员中移除指定班级的关联。需要管理员权限。

**响应**:

- **`404`**: 未找到关联记录

- **`200`**: 移除成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/admins/{admin_id}/remove-class/{class_id} \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/admins/{id}`

获取单个管理员详细信息

> 获取单个管理员信息
根据管理员ID获取详细信息。需要管理员权限。

**响应**:

- **`404`**: 管理员不存在

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/admins/{id} \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: orange">**PUT**</span> `/admins/{id}`

更新管理员信息

> 更新指定管理员的信息。需要管理员权限。

参数：
- username: 用户名（可选）
- password: 密码（可选）
- role: 角色（可选）
- real_name: 真实姓名（可选）
- phone: 联系电话（可选）
- class_name: 所属班级（可选）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `Admin` (参见数据模型章节)

**响应**:

- **`404`**: 管理员不存在

- **`200`**: 更新成功

**示例请求**:

```bash
curl -X PUT `$BASE_URL`/admins/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: red">**DELETE**</span> `/admins/{id}`

删除管理员

> 删除指定的管理员账户。需要超级管理员权限。

**响应**:

- **`404`**: 管理员不存在

- **`200`**: 删除成功

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/admins/{id} \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: blue">**POST**</span> `/admins/{id}/change-password`

修改管理员密码

> 修改密码
修改指定管理员的密码。需要验证旧密码。

请求体：
- old_password: 旧密码
- new_password: 新密码（至少8位，包含字母和数字）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `ChangePasswordRequest` (参见数据模型章节)

**响应**:

- **`404`**: 管理员不存在

- **`400`**: 参数错误或密码强度不足

- **`200`**: 修改成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/admins/{id}/change-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

## alerts

### <span style="color: green">**GET**</span> `/alerts/`

获取告警列表

> 获取系统告警列表，支持分页和过滤。

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/alerts/ \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: blue">**POST**</span> `/alerts/cleanup`

清理过期告警

> 删除指定天数之前的告警记录，默认为7天。

**响应**:

- **`200`**: 清理成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/alerts/cleanup \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: blue">**POST**</span> `/alerts/read-all`

标记所有告警为已读

> 将所有未读告警标记为已读状态。

**响应**:

- **`200`**: 标记成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/alerts/read-all \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: blue">**POST**</span> `/alerts/read/{alert_id}`

标记告警为已读

> 将指定告警标记为已读状态。

**响应**:

- **`404`**: 告警不存在

- **`200`**: 标记成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/alerts/read/{alert_id} \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/alerts/stats`

获取告警统计信息

> 获取告警的统计数据，包括总数、未读数、按级别统计等。

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/alerts/stats \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: blue">**POST**</span> `/alerts/test`

测试告警功能

> 创建一条测试告警，用于验证告警系统是否正常工作。

**响应**:

- **`200`**: 测试成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/alerts/test \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/alerts/{alert_id}`

获取单个告警

> 根据ID获取告警详情。

**响应**:

- **`404`**: 告警不存在

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/alerts/{alert_id} \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: orange">**PUT**</span> `/alerts/{alert_id}`

更新告警状态

> 标记告警为已读或未读。

**响应**:

- **`404`**: 告警不存在

- **`200`**: 更新成功

**示例请求**:

```bash
curl -X PUT `$BASE_URL`/alerts/{alert_id} \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: red">**DELETE**</span> `/alerts/{alert_id}`

删除告警

> 删除指定的告警记录。

**响应**:

- **`404`**: 告警不存在

- **`200`**: 删除成功

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/alerts/{alert_id} \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

## algorithm

### <span style="color: green">**GET**</span> `/algorithm/all`

获取所有算法数据

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/all \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/anomaly/batch`

批量获取异常检测

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 历史天数，默认30 |  |
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/anomaly/batch \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/anomaly/group/{user_id}`

检测群体异常

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 历史天数，默认30 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/anomaly/group/{user_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/anomaly/sudden/{user_id}`

检测突变异常

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 历史天数，默认30 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/anomaly/sudden/{user_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/anomaly/trend/{user_id}`

检测趋势异常

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 历史天数，默认30 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/anomaly/trend/{user_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/anomaly/{user_id}`

获取用户异常检测

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 历史天数，默认30 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/anomaly/{user_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/cluster`

获取学生分群结果

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/cluster \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/algorithm/cluster`

触发分群重新计算

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `n_clusters` | string | 否 | 聚类数量(默认4) |  |
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/algorithm/cluster \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/algorithm/cluster/recalculate`

重新计算学生分群

> 触发分群重新计算

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/algorithm/cluster/recalculate \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/cluster/{user_id}`

获取单个学生的分群信息

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/cluster/{user_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/composite-score`

获取综合评分排名

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/composite-score \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/algorithm/composite-score`

重新计算综合评分

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/algorithm/composite-score \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/composite-score/progress`

获取综合评分计算进度

> 用于前端轮询获取计算进度，显示进度条等UI元素。

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/composite-score/progress \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/algorithm/composite-score/recalculate`

重新计算所有学生的综合评分

> 重新计算综合评分

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/algorithm/composite-score/recalculate \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/composite-score/{user_id}`

获取单个学生的综合评分

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/composite-score/{user_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/prediction/batch`

批量获取预测

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 预测天数，默认7 |  |
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/prediction/batch \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/prediction/risk`

获取有下降风险的学生

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 预测天数，默认7 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/prediction/risk \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/prediction/{user_id}`

获取学生积分预测

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 预测天数，默认7 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/prediction/{user_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/reward/daily-usage/{user_id}`

获取用户今日奖励使用情况

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/reward/daily-usage/{user_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/reward/eligible/{user_id}`

获取用户可兑换的奖励

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/reward/eligible/{user_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/algorithm/reward/phone-access`

处理手机拿取请求

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/algorithm/reward/phone-access \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/algorithm/reward/redeem`

兑换奖励

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/algorithm/reward/redeem \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/reward/types`

获取所有奖励类型

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/reward/types \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/risk-predict/batch`

批量预测风险

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 统计天数，默认30 |  |
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/risk-predict/batch \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/risk-predict/evaluate`

评估风险预测模型

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 评估数据天数，默认30 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/risk-predict/evaluate \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/risk-predict/high-risk`

获取高风险学生

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 统计天数，默认30 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/risk-predict/high-risk \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/algorithm/risk-predict/train`

训练风险预测模型

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 训练数据天数，默认90 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/algorithm/risk-predict/train \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/risk-predict/{user_id}`

预测学生风险

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 统计天数，默认30 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/risk-predict/{user_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/algorithm/rule-engine/apply-by-behavior`

根据行为类型应用规则

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/algorithm/rule-engine/apply-by-behavior \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/algorithm/rule-engine/execute`

执行规则引擎

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/algorithm/rule-engine/execute \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/rule-recommend`

获取积分规则推荐

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 统计天数，默认30 |  |
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/rule-recommend \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/rule-recommend/combination`

获取规则组合建议

> 获取积分规则推荐

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 统计天数，默认30 |  |
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/rule-recommend/combination \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/rule-recommend/evaluate`

评估规则推荐模型

> 获取积分规则推荐

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 评估数据天数，默认30 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/rule-recommend/evaluate \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/rule-recommend/new`

获取新规则推荐

> 获取积分规则推荐

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 统计天数，默认30 |  |
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/rule-recommend/new \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/rule-recommend/optimization`

获取规则优化建议

> 获取积分规则推荐

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 统计天数，默认30 |  |
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/rule-recommend/optimization \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/rule-recommend/statistics`

获取规则统计信息

> 获取综合统计分析

包括描述性统计、相关性分析、分组对比等。

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 统计天数，默认30 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/rule-recommend/statistics \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/algorithm/rule-recommend/train`

训练规则推荐模型

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 训练数据天数，默认90 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/algorithm/rule-recommend/train \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/algorithm/run`

运行算法分析

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/algorithm/run \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/algorithm/score-distribution/adjust`

调整评分分布

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/algorithm/score-distribution/adjust \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/score-distribution/statistics`

获取评分分布统计

> 获取综合统计分析

包括描述性统计、相关性分析、分组对比等。

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/score-distribution/statistics \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/algorithm/score-distribution/validate`

验证评分分布

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/algorithm/score-distribution/validate \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/score-ecosystem/balance/{user_id}`

获取用户积分余额

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/score-ecosystem/balance/{user_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/algorithm/score-ecosystem/earn`

获取积分

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/algorithm/score-ecosystem/earn \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/score-ecosystem/earning-rules`

获取积分获取规则

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/score-ecosystem/earning-rules \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/algorithm/score-ecosystem/spend`

消费积分

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/algorithm/score-ecosystem/spend \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/score-ecosystem/spending-rules`

获取积分消费规则

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/score-ecosystem/spending-rules \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/score-predict/batch`

批量预测考试成绩

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 统计天数，默认30 |  |
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/score-predict/batch \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/score-predict/distribution`

获取成绩分布预测

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/score-predict/distribution \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/score-predict/evaluate`

评估成绩预测模型

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 评估数据天数，默认30 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/score-predict/evaluate \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/algorithm/score-predict/train`

训练成绩预测模型

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 训练数据天数，默认90 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/algorithm/score-predict/train \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/score-predict/{user_id}`

预测学生考试成绩

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 统计天数，默认30 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/score-predict/{user_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/algorithm/score-validator/detect-outliers`

检测离群值

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/algorithm/score-validator/detect-outliers \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/algorithm/score-validator/validate-and-correct`

校验并修正分数

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/algorithm/score-validator/validate-and-correct \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/statistics`

获取综合统计分析

> 包括描述性统计、相关性分析、分组对比等。

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/statistics \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/warning`

获取风险预警列表

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/warning \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/algorithm/warning`

执行风险评估

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/algorithm/warning \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/algorithm/warning/config`

获取预警配置

> 获取风险预警列表

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/algorithm/warning/config \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/algorithm/warning/config`

更新预警配置

> 请求体格式：
{
    "config_key": "score_threshold",
    "config_value": "30",
    "description": "积分预警阈值"
}

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/algorithm/warning/config \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/algorithm/warning/evaluate`

评估所有风险预警

> 执行风险评估

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/algorithm/warning/evaluate \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/algorithm/warning/{warning_id}/resolve`

处理预警

> 将指定预警标记为已处理

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `warning_id` | integer | 是 | 预警ID |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/algorithm/warning/{warning_id}/resolve \
  -H "Authorization: Bearer $TOKEN"
```

---

## analysis

### <span style="color: green">**GET**</span> `/analysis/class-compare`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `period` | string | 否 | 统计周期(7d/30d/90d) |  |
| `class_names` | string | 否 | 班级名称列表，逗号分隔 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/analysis/class-compare \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/analysis/class-ranking`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `limit` | string | 否 | 返回数量限制 |  |
| `order` | string | 否 | 排序方向(desc/asc) |  |
| `sort_by` | string | 否 | 排序字段(score/unlock_count/avg_score) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/analysis/class-ranking \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/analysis/class/{class_name}`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/analysis/class/{class_name} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/analysis/dashboard-summary`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/analysis/dashboard-summary \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/analysis/student-ranking`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `limit` | string | 否 | 返回数量限制 |  |
| `order` | string | 否 | 排序方向(desc/asc) |  |
| `sort_by` | string | 否 | 排序字段(score/unlock_count) |  |
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/analysis/student-ranking \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/analysis/unlock-stats`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `class_name` | string | 否 | 班级名称 |  |
| `device_id` | string | 否 | 设备ID |  |
| `end_date` | string | 否 | 结束日期(YYYY-MM-DD) |  |
| `start_date` | string | 否 | 开始日期(YYYY-MM-DD) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/analysis/unlock-stats \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/analysis/user/{user_id}`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/analysis/user/{user_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

## anomaly

### <span style="color: green">**GET**</span> `/anomaly/batch`

批量获取异常检测

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 历史天数，默认30 |  |
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/anomaly/batch \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/anomaly/group/{user_id}`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 历史天数，默认30 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/anomaly/group/{user_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/anomaly/sudden/{user_id}`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 历史天数，默认30 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/anomaly/sudden/{user_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/anomaly/trend/{user_id}`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 历史天数，默认30 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/anomaly/trend/{user_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/anomaly/{user_id}`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 历史天数，默认30 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/anomaly/{user_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

## approvals

### <span style="color: green">**GET**</span> `/approvals/`

获取审批列表。非管理员用户只能查看关联班级的审批。

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `page` | string | 否 | 页码（默认1） |  |
| `per_page` | string | 否 | 每页数量（默认10） |  |
| `status` | string | 否 | 状态筛选（pending/approved/rejected） |  |

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/approvals/ \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/approvals/`

创建审批申请。非管理员用户只能为关联班级的学生创建申请。

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `Approval` (参见数据模型章节)

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/approvals/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: green">**GET**</span> `/approvals/pending`

获取待审批列表。非管理员用户只能查看关联班级的待审批。

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `page` | string | 否 | 页码（默认1） |  |
| `per_page` | string | 否 | 每页数量（默认10） |  |

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/approvals/pending \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/approvals/{id}`

获取单个审批详情。非管理员用户只能查看关联班级的审批。

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/approvals/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: orange">**PUT**</span> `/approvals/{id}`

更新审批申请。非管理员用户只能更新关联班级的审批。

> 更新通知配置

更新微信和短信通知的配置。

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `Approval` (参见数据模型章节)

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X PUT `$BASE_URL`/approvals/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: red">**DELETE**</span> `/approvals/{id}`

删除审批记录。非管理员用户只能删除关联班级的审批。

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/approvals/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/approvals/{id}/approve`

批准审批。需要审批权限。非管理员用户只能审批关联班级的申请。

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/approvals/{id}/approve \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/approvals/{id}/reject`

拒绝审批。需要审批权限。非管理员用户只能审批关联班级的申请。

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/approvals/{id}/reject \
  -H "Authorization: Bearer $TOKEN"
```

---

## auth

### <span style="color: blue">**POST**</span> `/auth/login`

管理员登录接口

> 验证管理员用户名和密码，成功后返回JWT令牌。

请求体：
- username: 用户名（必填）
- password: 密码（必填）

返回：
- success: 登录是否成功
- message: 提示信息
- token: JWT令牌
- expires_in: 令牌过期时间（秒）
- user: 用户信息（包含role字段标识角色类型）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `LoginRequest` (参见数据模型章节)

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/auth/login \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: blue">**POST**</span> `/auth/logout`

登出接口，清除认证Cookie

> 清除access_token和refresh_token Cookie，实现安全登出。

返回：
- success: 登出是否成功
- message: 提示信息

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```

---

## box

### <span style="color: blue">**POST**</span> `/box/verify`

积分盒子验证

> 用于积分盒子设备的用户验证和积分操作。
如果提供rule_id，则根据规则添加积分；否则只验证用户身份。

请求体：
- card_id: 卡号ID（必填）
- device_id: 设备标识ID（必填）
- rule_id: 规则ID（可选）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `BoxVerifyRequest` (参见数据模型章节)

**响应**:

- **`404`**: 用户或设备不存在

- **`403`**: 无权限访问

- **`400`**: 缺少必要参数

- **`200`**: 验证成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/box/verify \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

## class-periods

### <span style="color: green">**GET**</span> `/class-periods/`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: 成功
  - Schema: `ClassPeriodListResponse`

**示例请求**:

```bash
curl -X GET `$BASE_URL`/class-periods/ \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/class-periods/`

创建课程安排。需要课表管理权限。

> 请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `ClassPeriod` (参见数据模型章节)

**响应**:

- **`201`**: 创建成功
  - Schema: `ClassPeriodResponse`

**示例请求**:

```bash
curl -X POST `$BASE_URL`/class-periods/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/class-periods/active`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 获取启用的课程节次列表

**响应**:

- **`200`**: 成功
  - Schema: `ClassPeriodListResponse`

**示例请求**:

```bash
curl -X GET `$BASE_URL`/class-periods/active \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: orange">**PUT**</span> `/class-periods/batch`

更新通知配置

> 更新微信和短信通知的配置。

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `BatchUpdate` (参见数据模型章节)

**响应**:

- **`200`**: 批量更新成功

**示例请求**:

```bash
curl -X PUT `$BASE_URL`/class-periods/batch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: blue">**POST**</span> `/class-periods/reset`

创建课程安排。需要课表管理权限。

> 重置课程节次为默认值

**响应**:

- **`200`**: 重置成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/class-periods/reset \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/class-periods/{id}`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`404`**: 节次不存在

- **`200`**: 成功
  - Schema: `ClassPeriodResponse`

**示例请求**:

```bash
curl -X GET `$BASE_URL`/class-periods/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: orange">**PUT**</span> `/class-periods/{id}`

更新通知配置

> 更新微信和短信通知的配置。

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `ClassPeriod` (参见数据模型章节)

**响应**:

- **`404`**: 节次不存在

- **`200`**: 更新成功

**示例请求**:

```bash
curl -X PUT `$BASE_URL`/class-periods/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: red">**DELETE**</span> `/class-periods/{id}`

删除课程节次

**响应**:

- **`404`**: 节次不存在

- **`200`**: 删除成功

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/class-periods/{id} \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

## classes

### <span style="color: green">**GET**</span> `/classes/`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/classes/ \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/classes/`

创建课程安排。需要课表管理权限。

> 请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `ClassInfo` (参见数据模型章节)

**响应**:

- **`201`**: 创建成功
  - Schema: `ClassResponse`

**示例请求**:

```bash
curl -X POST `$BASE_URL`/classes/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: green">**GET**</span> `/classes/export`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/classes/export \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/classes/import`

创建课程安排。需要课表管理权限。

> 请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/classes/import \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/classes/validate-associations`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/classes/validate-associations \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/classes/validate-associations`

创建课程安排。需要课表管理权限。

> 请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/classes/validate-associations \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/classes/{class_param}/students`

获取班级学生列表

> 支持通过班级ID或班级名称查询

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/classes/{class_param}/students \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/classes/{id}`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`404`**: 班级不存在

- **`200`**: 成功
  - Schema: `ClassResponse`

**示例请求**:

```bash
curl -X GET `$BASE_URL`/classes/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: orange">**PUT**</span> `/classes/{id}`

更新通知配置

> 更新微信和短信通知的配置。

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `ClassInfo` (参见数据模型章节)

**响应**:

- **`404`**: 班级不存在

- **`200`**: 更新成功

**示例请求**:

```bash
curl -X PUT `$BASE_URL`/classes/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: red">**DELETE**</span> `/classes/{id}`

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/classes/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

## composite

### <span style="color: green">**GET**</span> `/composite/cluster`

获取学生分群结果

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/composite/cluster \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/composite/cluster`

触发分群重新计算

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `n_clusters` | string | 否 | 聚类数量(默认4) |  |
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/composite/cluster \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/composite/cluster/{user_id}`

获取学生分群结果

> 获取单个学生的分群信息

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/composite/cluster/{user_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/composite/ecosystem/balance/{user_id}`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/composite/ecosystem/balance/{user_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/composite/ecosystem/earn`

创建课程安排。需要课表管理权限。

> 请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/composite/ecosystem/earn \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/composite/ecosystem/earning-rules`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/composite/ecosystem/earning-rules \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/composite/ecosystem/spend`

创建课程安排。需要课表管理权限。

> 请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/composite/ecosystem/spend \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/composite/ecosystem/spending-rules`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/composite/ecosystem/spending-rules \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/composite/reward/daily-usage/{user_id}`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 获取用户今日奖励使用情况

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/composite/reward/daily-usage/{user_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/composite/reward/eligible/{user_id}`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 获取用户可兑换的奖励

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/composite/reward/eligible/{user_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/composite/reward/phone-access`

处理手机拿取请求

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/composite/reward/phone-access \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/composite/reward/redeem`

兑换奖励

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/composite/reward/redeem \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/composite/reward/types`

获取所有奖励类型

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/composite/reward/types \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/composite/score`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/composite/score \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/composite/score`

创建课程安排。需要课表管理权限。

> 请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/composite/score \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/composite/score-distribution/adjust`

调整评分分布

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/composite/score-distribution/adjust \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/composite/score-distribution/statistics`

获取综合统计分析

> 包括描述性统计、相关性分析、分组对比等。

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/composite/score-distribution/statistics \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/composite/score-distribution/validate`

验证评分分布

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/composite/score-distribution/validate \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/composite/score-validator/detect-outliers`

检测离群值

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/composite/score-validator/detect-outliers \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/composite/score-validator/validate-and-correct`

校验并修正分数

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/composite/score-validator/validate-and-correct \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/composite/score/progress`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 获取综合评分计算进度

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/composite/score/progress \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/composite/score/{user_id}`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 获取单个学生的综合评分

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/composite/score/{user_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/composite/statistics`

获取综合统计分析

> 包括描述性统计、相关性分析、分组对比等。

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/composite/statistics \
  -H "Authorization: Bearer $TOKEN"
```

---

## consistency

### <span style="color: green">**GET**</span> `/consistency/check`

Execute consistency check

> Run data consistency check

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/consistency/check \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/consistency/fix`

Execute data fix

> Fix data consistency issues

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/consistency/fix \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/consistency/report`

Get consistency report

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/consistency/report \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/consistency/status`

Get migration status

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/consistency/status \
  -H "Authorization: Bearer $TOKEN"
```

---

## course-schedules

### <span style="color: green">**GET**</span> `/course-schedules/`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 获取课程表列表
可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/course-schedules/ \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/course-schedules/`

创建课程安排。需要课表管理权限。

> 创建课程安排
请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `CourseSchedule` (参见数据模型章节)

**响应**:

- **`201`**: 创建成功
  - Schema: `CourseScheduleResponse`

**示例请求**:

```bash
curl -X POST `$BASE_URL`/course-schedules/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/course-schedules/check-conflict`

检查课程时间冲突。支持按班级、教师、教室维度检测。

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/course-schedules/check-conflict \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/course-schedules/class/{class_info_id}`

获取指定班级的完整课程表。非管理员用户只能查看关联班级的课程表。

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/course-schedules/class/{class_info_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/course-schedules/export`

导出课程表数据（支持JSON和Excel格式）

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/course-schedules/export \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/course-schedules/import`

从JSON或Excel文件导入课程表数据（支持配置映射）

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/course-schedules/import \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/course-schedules/options`

获取课程表相关选项（班级、科目、节次）

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/course-schedules/options \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/course-schedules/{id}`

获取课程详情。需要课表查看权限。

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`404`**: 课程不存在

- **`200`**: 成功
  - Schema: `CourseScheduleResponse`

**示例请求**:

```bash
curl -X GET `$BASE_URL`/course-schedules/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: orange">**PUT**</span> `/course-schedules/{id}`

更新课程安排。需要课表管理权限。

> 更新通知配置

更新微信和短信通知的配置。

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `CourseSchedule` (参见数据模型章节)

**响应**:

- **`404`**: 课程不存在

- **`200`**: 更新成功

**示例请求**:

```bash
curl -X PUT `$BASE_URL`/course-schedules/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: red">**DELETE**</span> `/course-schedules/{id}`

删除课程安排。需要课表管理权限。

> 删除课程安排

**响应**:

- **`404`**: 课程不存在

- **`200`**: 删除成功

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/course-schedules/{id} \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

## dashboard

### <span style="color: green">**GET**</span> `/dashboard/data`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/dashboard/data \
  -H "Authorization: Bearer $TOKEN"
```

---

## device-group

### <span style="color: green">**GET**</span> `/device-group/`

获取设备分组列表

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/device-group/ \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: blue">**POST**</span> `/device-group/`

创建设备分组

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `DeviceGroupCreate` (参见数据模型章节)

**响应**:

- **`400`**: 参数错误

- **`201`**: 创建成功
  - Schema: `DeviceGroup`

**示例请求**:

```bash
curl -X POST `$BASE_URL`/device-group/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/device-group/device/{device_id}/groups`

获取设备所属的分组

> 列表

**响应**:

- **`404`**: 设备不存在

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/device-group/device/{device_id}/groups \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/device-group/options`

获取分组选项

> 获取设备分组选项列表

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/device-group/options \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/device-group/stats`

获取设备分组统计

> 信息

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/device-group/stats \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/device-group/{group_id}`

获取设备分组详情

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`404`**: 分组不存在

- **`200`**: 成功
  - Schema: `DeviceGroupDetail`

**示例请求**:

```bash
curl -X GET `$BASE_URL`/device-group/{group_id} \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: orange">**PUT**</span> `/device-group/{group_id}`

更新设备分组

> 更新通知配置

更新微信和短信通知的配置。

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `DeviceGroupCreate` (参见数据模型章节)

**响应**:

- **`404`**: 分组不存在

- **`400`**: 参数错误

- **`200`**: 更新成功
  - Schema: `DeviceGroup`

**示例请求**:

```bash
curl -X PUT `$BASE_URL`/device-group/{group_id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: red">**DELETE**</span> `/device-group/{group_id}`

删除设备分组

**响应**:

- **`404`**: 分组不存在

- **`200`**: 删除成功

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/device-group/{group_id} \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/device-group/{group_id}/devices`

获取分组内的设备列表

**响应**:

- **`404`**: 分组不存在

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/device-group/{group_id}/devices \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: blue">**POST**</span> `/device-group/{group_id}/devices`

添加设备到分组

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`404`**: 分组或设备不存在

- **`400`**: 参数错误

- **`201`**: 添加成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/device-group/{group_id}/devices \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: red">**DELETE**</span> `/device-group/{group_id}/devices/{device_id}`

从分组中移除设备

**响应**:

- **`404`**: 映射不存在

- **`200`**: 移除成功

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/device-group/{group_id}/devices/{device_id} \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

## devices

### <span style="color: green">**GET**</span> `/devices/`

获取设备列表

> 获取当前管理员有权访问的所有设备列表，支持分页和筛选。
超级管理员可以看到所有设备，普通管理员只能看到自己班级或绑定到自己的设备。

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `class_id` | string | 否 | 班级ID |  |
| `status` | string | 否 | 状态（online/offline/error） |  |
| `name` | string | 否 | 设备名称（模糊搜索） |  |
| `device_id` | string | 否 | 设备标识（模糊搜索） |  |
| `per_page` | string | 否 | 每页数量（默认20） |  |
| `page` | string | 否 | 页码（默认1） |  |

**响应**:

- **`200`**: 成功
  - Schema: `DeviceListResponse`

**示例请求**:

```bash
curl -X GET `$BASE_URL`/devices/ \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: blue">**POST**</span> `/devices/`

创建设备

> 创建新的设备，需要管理员权限。

请求体：
- device_id: 设备标识（必填）
- name: 设备名称（可选，默认"设备 {device_id}"）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `Device` (参见数据模型章节)

**响应**:

- **`201`**: 创建成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/devices/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/devices/admin/{admin_id}`

获取管理员的设备列表

> 获取绑定到指定管理员的所有设备。

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/devices/admin/{admin_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/devices/advanced-stats`

获取设备高级统计信息

> 获取设备高级统计
获取更详细的设备统计，包括信号强度分布、在线时长等。

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/devices/advanced-stats \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/devices/alerts`

获取设备告警列表

> 获取所有设备的告警记录，支持按状态和级别筛选，支持分页。

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `per_page` | string | 否 | 每页数量（默认50） |  |
| `page` | string | 否 | 页码（默认1） |  |
| `severity` | string | 否 | 告警级别（info/warning/error/critical） |  |
| `resolved` | string | 否 | 是否已解决（true/false） |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/devices/alerts \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/devices/batch-control`

批量设备控制

> 对多个设备同时执行远程操作。
只对在线设备执行操作。

操作类型：
- restart: 重启设备
- unlock: 打开所有箱门

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `BatchControl` (参见数据模型章节)

**响应**:

- **`400`**: 设备不在线

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/devices/batch-control \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: blue">**POST**</span> `/devices/bulk-ota-upgrade`

批量OTA固件升级（别名接口）

> 批量OTA固件升级（别名）
向所有在线设备发送OTA固件升级指令。

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `OTAUpgrade` (参见数据模型章节)

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/devices/bulk-ota-upgrade \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/devices/class/{class_id}`

获取班级的设备列表

> 获取绑定到指定班级的所有设备。

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/devices/class/{class_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/devices/device/{device_id}/heartbeats`

通过设备标识获取心跳记录

> 使用设备标识（如 phonebox_001）获取心跳历史记录，支持分页。

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `page` | string | 否 | 页码（默认1） |  |
| `per_page` | string | 否 | 每页数量（默认50） |  |

**响应**:

- **`404`**: 设备不存在

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/devices/device/{device_id}/heartbeats \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/devices/export`

导出设备数据

> 支持JSON和Excel格式导出。

参数：
- format: 导出格式（json 或 excel，默认excel）

返回设备数据文件下载。

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/devices/export \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/devices/heartbeat-timeout-check`

检查心跳超时的设备

> 检查心跳超时设备
遍历所有设备，检查是否有设备超过心跳间隔未响应。
返回超时的设备列表，并自动创建告警。

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/devices/heartbeat-timeout-check \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/devices/import`

批量导入设备

> 通过Excel文件信息。

支持的字段：设备标识(device_id)、设备名称(name)、班级名称(class_name)、管理员姓名(admin_name)

返回导入结果统计。

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/devices/import \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/devices/online`

获取在线设备列表

> 获取所有当前在线的设备列表。

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/devices/online \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/devices/ota-upgrade-all`

批量OTA固件升级

> 向所有在线设备发送OTA固件升级指令。

请求体：
- firmware_url: 固件下载URL（必填）
- version: 目标固件版本（可选）
- force: 是否强制升级，忽略版本检查（可选，默认false）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `OTAUpgrade` (参见数据模型章节)

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/devices/ota-upgrade-all \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/devices/stats`

获取设备统计信息

> 获取所有设备的统计数据，包括在线/离线数量、今日心跳数等。

**响应**:

- **`200`**: 成功
  - Schema: `DeviceStatsResponse`

**示例请求**:

```bash
curl -X GET `$BASE_URL`/devices/stats \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/devices/{id}`

获取单个设备详情

> 根据设备ID获取设备的详细信息。

**响应**:

- **`404`**: 设备不存在

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/devices/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: orange">**PUT**</span> `/devices/{id}`

更新设备

> 更新指定设备的信息，需要管理员权限。

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `Device` (参见数据模型章节)

**响应**:

- **`404`**: 设备不存在

- **`200`**: 更新成功

**示例请求**:

```bash
curl -X PUT `$BASE_URL`/devices/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: red">**DELETE**</span> `/devices/{id}`

删除设备

> 删除指定的设备，需要管理员权限。

**响应**:

- **`404`**: 设备不存在

- **`200`**: 删除成功

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/devices/{id} \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/devices/{id}/alerts`

获取设备的告警历史记录

> 获取设备告警历史
获取指定设备的所有告警记录。

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/devices/{id}/alerts \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/devices/{id}/alerts/{alert_id}/resolve`

解决设备告警（备用路径）

> 将指定告警标记为已解决。

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/devices/{id}/alerts/{alert_id}/resolve \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: blue">**POST**</span> `/devices/{id}/bind-admin`

绑定设备到管理员

> 将设备绑定到指定的管理员，只有管理员可以执行此操作。

请求体：
- admin_id: 管理员ID（设为null可解绑设备与管理员的关联）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `BindAdminRequest` (参见数据模型章节)

**响应**:

- **`404`**: 管理员不存在

- **`403`**: 只有超级管理员可以绑定管理员

- **`200`**: 绑定成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/devices/{id}/bind-admin \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: blue">**POST**</span> `/devices/{id}/bind-class`

绑定设备到班级

> 将设备绑定到指定的班级，需要设备编辑权限。
非管理员只能绑定到自己管理的班级。

请求体：
- class_id: 班级ID（设为null可解绑设备与班级的关联）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `BindClassRequest` (参见数据模型章节)

**响应**:

- **`404`**: 班级不存在

- **`403`**: 无权绑定到该班级

- **`200`**: 绑定成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/devices/{id}/bind-class \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/devices/{id}/heartbeats`

获取设备心跳记录

> 获取指定设备的所有心跳历史记录，支持分页。

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `page` | string | 否 | 页码（默认1） |  |
| `per_page` | string | 否 | 每页数量（默认50） |  |

**响应**:

- **`404`**: 设备不存在

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/devices/{id}/heartbeats \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/devices/{id}/ota-upgrade`

设备OTA固件升级

> 向指定设备发送OTA固件升级指令。
需要设备在线才能执行升级。

请求体：
- firmware_url: 固件下载URL（必填）
- version: 目标固件版本（可选）
- force: 是否强制升级，忽略版本检查（可选，默认false）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `OTAUpgrade` (参见数据模型章节)

**响应**:

- **`400`**: 设备不在线

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/devices/{id}/ota-upgrade \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: blue">**POST**</span> `/devices/{id}/remote-control`

设备远程控制

> 对指定设备执行远程操作，包括重启和远程开锁。
需要设备在线才能执行操作。

操作类型：
- restart: 重启设备
- unlock_a: 打开A箱（班主任远程开锁，无需验证）
- unlock_b: 打开B箱（需要验证积分）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `RemoteControl` (参见数据模型章节)

**响应**:

- **`400`**: 设备不在线

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/devices/{id}/remote-control \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: blue">**POST**</span> `/devices/{id}/resolve-alert/{alert_id}`

解决设备告警

> 将指定告警标记为已解决。

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/devices/{id}/resolve-alert/{alert_id} \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: orange">**PUT**</span> `/devices/{id}/settings`

更新设备设置

> 更新指定设备的配置选项。

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `DeviceSettings` (参见数据模型章节)

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X PUT `$BASE_URL`/devices/{id}/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

## diagnostics

### <span style="color: blue">**POST**</span> `/diagnostics/clear-cache`

清除性能监控缓存

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/diagnostics/clear-cache \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/diagnostics/cpu`

获取CPU使用信息

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/diagnostics/cpu \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/diagnostics/disk`

获取磁盘空间信息

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/diagnostics/disk \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/diagnostics/errors`

获取最近错误信息

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/diagnostics/errors \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/diagnostics/health`

系统健康检查

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/diagnostics/health \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/diagnostics/memory`

获取内存使用信息

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/diagnostics/memory \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/diagnostics/performance`

获取性能监控数据

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/diagnostics/performance \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/diagnostics/system`

获取系统信息

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/diagnostics/system \
  -H "Authorization: Bearer $TOKEN"
```

---

## exam-import

### <span style="color: blue">**POST**</span> `/exam-import/execute`

执行成绩导入

> 实际写入数据库。

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/exam-import/execute \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/exam-import/history`

获取成绩导入历史记录

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/exam-import/history \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/exam-import/preview`

预览导入数据

> 返回导入数据的预览，不实际写入数据库。

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/exam-import/preview \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/exam-import/template`

下载成绩导入Excel模板

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/exam-import/template \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/exam-import/validate`

验证导入文件格式

> 上传Excel文件后，先验证格式是否正确。

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/exam-import/validate \
  -H "Authorization: Bearer $TOKEN"
```

---

## exams

### <span style="color: green">**GET**</span> `/exams/`

获取考试列表。非管理员用户只能查看关联班级的考试。

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/exams/ \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/exams/`

创建考试。需要考试管理权限。

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `Exam` (参见数据模型章节)

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/exams/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: green">**GET**</span> `/exams/export`

导出考试数据。需要考试管理权限。

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/exams/export \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/exams/import`

批量导入考试。需要考试管理权限。

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/exams/import \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/exams/{id}`

获取考试详情。需要考试查看权限。

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/exams/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: orange">**PUT**</span> `/exams/{id}`

更新考试。需要考试管理权限。

> 更新通知配置

更新微信和短信通知的配置。

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X PUT `$BASE_URL`/exams/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: red">**DELETE**</span> `/exams/{id}`

删除考试。需要考试管理权限。

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/exams/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/exams/{id}/close`

关闭考试。需要考试管理权限。

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/exams/{id}/close \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/exams/{id}/publish`

发布考试。需要考试管理权限。

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/exams/{id}/publish \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/exams/{id}/scores`

获取指定考试的所有成绩

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/exams/{id}/scores \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/exams/{id}/scores`

上传指定考试的成绩

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/exams/{id}/scores \
  -H "Authorization: Bearer $TOKEN"
```

---

## export

### <span style="color: blue">**POST**</span> `/export/`

导出数据

> 支持导出学生、规则、设备、积分记录等数据，支持Excel和PDF格式。

请求体：
- format: 导出格式（excel 或 pdf）
- type: 导出类型（users/rules/devices/records/summary）

返回对应的文件下载。

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `ExportFormat` (参见数据模型章节)

**响应**:

- **`400`**: 参数错误

- **`200`**: 导出成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/export/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/export/categories`

导出分类数据

> 查询参数：
- format: 导出格式（excel 或 pdf，默认excel）

返回分类数据文件下载。

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `format` | string | 否 | 导出格式：excel（默认）或 pdf |  |

**响应**:

- **`200`**: 导出成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/export/categories \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/export/devices`

导出设备数据

> 查询参数：
- format: 导出格式（excel 或 pdf，默认excel）

返回设备数据文件下载。

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `format` | string | 否 | 导出格式：excel（默认）或 pdf |  |

**响应**:

- **`200`**: 导出成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/export/devices \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: blue">**POST**</span> `/export/errors`

导出导入错误数据

> 接收导入失败的错误数据列表，将其导出为Excel文件，方便用户修正后重新导入。

请求体：
- errors: 错误数据列表（从导入API返回的messages中筛选失败记录）
- module: 模块名称（users/devices/classes/exams/subjects）

返回错误数据Excel文件下载。

**响应**:

- **`400`**: 参数错误

- **`200`**: 导出成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/export/errors \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/export/records`

导出积分记录

> 查询参数：
- format: 导出格式（excel 或 pdf，默认excel）
- limit: 限制导出记录数量（默认10000）

返回积分记录文件下载。

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `format` | string | 否 | 导出格式：excel（默认）或 pdf |  |
| `limit` | string | 否 | 限制导出记录数量（默认10000） |  |

**响应**:

- **`200`**: 导出成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/export/records \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/export/rules`

导出积分规则

> 查询参数：
- format: 导出格式（excel 或 pdf，默认excel）

返回积分规则文件下载。

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `format` | string | 否 | 导出格式：excel（默认）或 pdf |  |

**响应**:

- **`200`**: 导出成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/export/rules \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/export/summary`

导出系统数据汇总报告（PDF格式）

> 导出系统数据汇总报告
返回包含学生总数、规则数、设备数、在线设备数、积分记录数等统计数据的汇总报告。

**响应**:

- **`200`**: 导出成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/export/summary \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/export/users`

导出学生数据

> 查询参数：
- format: 导出格式（excel 或 pdf，默认excel）

返回学生数据文件下载。

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `format` | string | 否 | 导出格式：excel（默认）或 pdf |  |

**响应**:

- **`200`**: 导出成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/export/users \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

## firmware

### <span style="color: blue">**POST**</span> `/firmware/batch-upgrade`

Batch upgrade device firmware

> Send firmware upgrade commands to multiple devices at once.

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `BatchUpgradeRequest` (参见数据模型章节)

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/firmware/batch-upgrade \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: green">**GET**</span> `/firmware/download/{id}`

Download firmware file

> by firmware ID.

**响应**:

- **`404`**: Not found

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/firmware/download/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/firmware/latest`

Get latest firmware information

> Get latest firmware
Returns latest active firmware version information for device update check.

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/firmware/latest \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/firmware/ota-status`

Get OTA upgrade status

> View current in-progress OTA upgrade progress and history records.

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `device_id` | string | 否 | Device ID |  |

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/firmware/ota-status \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/firmware/ota/check`

Device check firmware update

> Check firmware update
Device calls this interface at startup or periodically to check for available updates.
A valid device ID is required for authentication.

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `current_version` | string | 否 | Current firmware version |  |
| `device_id` | string | 否 | Device ID |  |

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/firmware/ota/check \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/firmware/ota/report`

Device report firmware upgrade status

> Report firmware upgrade result
Device reports status after firmware download or upgrade is complete.

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/firmware/ota/report \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/firmware/upgrade-records`

Get device upgrade records

> Get upgrade records
View all firmware upgrade history records, supports pagination.

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `per_page` | string | 否 | Items per page (default 20) |  |
| `page` | string | 否 | Page number (default 1) |  |
| `status` | string | 否 | Upgrade status |  |
| `device_id` | string | 否 | Device ID |  |

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/firmware/upgrade-records \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/firmware/upload`

Upload firmware file

> Upload new firmware file to server and create firmware version record.

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `FirmwareUpload` (参见数据模型章节)

**响应**:

- **`400`**: Bad request

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/firmware/upload \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: green">**GET**</span> `/firmware/versions`

Get firmware version list

> Returns all uploaded firmware version information.

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `is_active` | string | 否 | Is active |  |

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/firmware/versions \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/firmware/versions`

Create firmware version record

> Records new uploaded firmware version information.

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `FirmwareVersion` (参见数据模型章节)

**响应**:

- **`201`**: Created

**示例请求**:

```bash
curl -X POST `$BASE_URL`/firmware/versions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: green">**GET**</span> `/firmware/versions/{id}`

Get firmware version detail

**响应**:

- **`404`**: Not found

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/firmware/versions/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: orange">**PUT**</span> `/firmware/versions/{id}`

Update firmware version information

> Update firmware version

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `FirmwareVersion` (参见数据模型章节)

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X PUT `$BASE_URL`/firmware/versions/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: red">**DELETE**</span> `/firmware/versions/{id}`

Delete firmware version

> Only allows deleting inactive versions.

**响应**:

- **`404`**: Not found

- **`200`**: Success

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/firmware/versions/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/firmware/{firmware_id}/ota-upgrade`

Start OTA upgrade for specific firmware

> Send firmware upgrade commands to devices using specified firmware version.

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `firmware_id` | integer | 是 | Firmware ID |  |

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/firmware/{firmware_id}/ota-upgrade \
  -H "Authorization: Bearer $TOKEN"
```

---

## import

### <span style="color: green">**GET**</span> `/import/configs`

获取所有导入配置

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/import/configs \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/import/configs`

创建新的导入配置

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `ImportConfig` (参见数据模型章节)

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/import/configs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: green">**GET**</span> `/import/configs/default/{module_name}`

获取指定模块的默认导入配置

> 获取模块默认导入配置

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/import/configs/default/{module_name} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/import/configs/set-default/{id}`

将指定配置设置为模块默认配置

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/import/configs/set-default/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/import/configs/{id}`

获取单个导入配置

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/import/configs/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: orange">**PUT**</span> `/import/configs/{id}`

更新导入配置

> 更新通知配置

更新微信和短信通知的配置。

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `ImportConfig` (参见数据模型章节)

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X PUT `$BASE_URL`/import/configs/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: red">**DELETE**</span> `/import/configs/{id}`

删除导入配置

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/import/configs/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/import/module-fields/{module_name}`

获取指定模块的字段定义

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/import/module-fields/{module_name} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/import/template/{template_type}`

下载指定类型的Excel导入模板

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/import/template/{template_type} \
  -H "Authorization: Bearer $TOKEN"
```

---

## import_export

### <span style="color: blue">**POST**</span> `/import_export/backup/clean_old`

清理过期备份

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/import_export/backup/clean_old \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/import_export/backup/create`

创建手动备份

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `type` | string | 否 | 备份类型: full, incremental, data_only |  |

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/import_export/backup/create \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: red">**DELETE**</span> `/import_export/backup/delete/{filename}`

删除备份文件

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/import_export/backup/delete/{filename} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/import_export/backup/list`

获取备份文件列表

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/import_export/backup/list \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/import_export/backup/restore/{filename}`

恢复备份

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/import_export/backup/restore/{filename} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/import_export/backup/schedule/disable`

禁用定时备份

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/import_export/backup/schedule/disable \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/import_export/backup/schedule/enable`

启用定时备份

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/import_export/backup/schedule/enable \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/import_export/backup/schedule/set_time`

设置定时备份时间

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `time` | string | 否 | 定时时间，格式HH:MM |  |

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/import_export/backup/schedule/set_time \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/import_export/backup/schedule/status`

获取定时备份状态

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/import_export/backup/schedule/status \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/import_export/backup/stats`

获取备份统计信息

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/import_export/backup/stats \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/import_export/export/categories`

导出分类数据

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `format` | string | 否 | 导出格式 |  |

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/import_export/export/categories \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/import_export/export/records`

导出积分记录

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `format` | string | 否 | 导出格式 |  |
| `user_id` | string | 否 | 按用户ID筛选 |  |

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/import_export/export/records \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/import_export/export/rules`

导出规则数据

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `format` | string | 否 | 导出格式 |  |

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/import_export/export/rules \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/import_export/export/users`

导出用户数据

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `format` | string | 否 | 导出格式: excel 或 csv，默认excel |  |

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/import_export/export/users \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/import_export/import/categories`

导入分类数据

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `file` | string | 否 | Excel或CSV文件 |  |

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/import_export/import/categories \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/import_export/import/rules`

导入规则数据

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `file` | string | 否 | Excel或CSV文件 |  |

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/import_export/import/rules \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/import_export/import/users`

导入用户数据

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `file` | string | 否 | Excel或CSV文件 |  |

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/import_export/import/users \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/import_export/template/category`

下载分类导入模板

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/import_export/template/category \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/import_export/template/rule`

下载规则导入模板

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/import_export/template/rule \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/import_export/template/user`

下载用户导入模板

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/import_export/template/user \
  -H "Authorization: Bearer $TOKEN"
```

---

## mqtt

### <span style="color: blue">**POST**</span> `/mqtt/command`

创建课程安排。需要课表管理权限。

> Send device command

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `MQTTCommand` (参见数据模型章节)

**响应**:

- **`500`**: Send failed

- **`400`**: Bad request

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/mqtt/command \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/mqtt/config`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> Get MQTT config

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/mqtt/config \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: orange">**PUT**</span> `/mqtt/config`

更新通知配置

> Update MQTT config

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `MQTTConfig` (参见数据模型章节)

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X PUT `$BASE_URL`/mqtt/config \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: blue">**POST**</span> `/mqtt/connect`

创建课程安排。需要课表管理权限。

> Connect to MQTT server

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `MQTTConnect` (参见数据模型章节)

**响应**:

- **`500`**: Connection failed

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/mqtt/connect \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: blue">**POST**</span> `/mqtt/disconnect`

创建课程安排。需要课表管理权限。

> Disconnect MQTT

**响应**:

- **`500`**: Disconnect failed

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/mqtt/disconnect \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/mqtt/logs`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> Get MQTT logs

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/mqtt/logs \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/mqtt/publish`

创建课程安排。需要课表管理权限。

> Publish MQTT message

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `MQTTPublish` (参见数据模型章节)

**响应**:

- **`429`**: Rate limited

- **`400`**: Bad request

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/mqtt/publish \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/mqtt/recent`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> Get recent MQTT logs

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/mqtt/recent \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/mqtt/status`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> Get MQTT connection status

**响应**:

- **`200`**: Success
  - Schema: `MQTTStatusResponse`

**示例请求**:

```bash
curl -X GET `$BASE_URL`/mqtt/status \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/mqtt/subscribe`

创建课程安排。需要课表管理权限。

> Subscribe to MQTT topic

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `MQTTSubscribe` (参见数据模型章节)

**响应**:

- **`500`**: Subscribe failed

- **`400`**: Bad request

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/mqtt/subscribe \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: blue">**POST**</span> `/mqtt/unlock`

创建课程安排。需要课表管理权限。

> Publish unlock command

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `MQTTUnlock` (参见数据模型章节)

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/mqtt/unlock \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: blue">**POST**</span> `/mqtt/unsubscribe`

创建课程安排。需要课表管理权限。

> Unsubscribe from MQTT topic

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `MQTTSubscribe` (参见数据模型章节)

**响应**:

- **`500`**: Unsubscribe failed

- **`400`**: Bad request

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/mqtt/unsubscribe \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

## nlp

### <span style="color: green">**GET**</span> `/nlp/analysis/comprehensive`

获取NLP算法的综合分析报告

> 获取NLP算法综合分析报告
包括意图识别准确性、性能指标、错误分析等

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/nlp/analysis/comprehensive \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/nlp/analysis/errors`

获取错误分析报告

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/nlp/analysis/errors \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/nlp/analysis/intent`

获取意图识别的详细分析报告

> 获取意图识别分析报告

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/nlp/analysis/intent \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/nlp/analysis/performance`

获取算法性能分析报告

> 获取性能分析报告
包括响应时间、缓存命中率等

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/nlp/analysis/performance \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/nlp/analysis/reset`

重置所有分析指标数据

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/nlp/analysis/reset \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/nlp/analysis/suggestions`

获取基于当前指标的系统优化建议

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/nlp/analysis/suggestions \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/nlp/batch-parse`

创建课程安排。需要课表管理权限。

> 批量解析自然语言文本

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/nlp/batch-parse \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/nlp/benchmark/intent-classifier`

对意图分类器进行基准测试

> 基准测试意图分类器
测试不同算法在不同场景下的性能

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/nlp/benchmark/intent-classifier \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/nlp/corrections`

获取所有纠正记录，支持按状态筛选

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/nlp/corrections \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: orange">**PUT**</span> `/nlp/corrections/{correction_id}`

更新纠正记录状态（approve/reject）

> 更新通知配置

更新微信和短信通知的配置。

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X PUT `$BASE_URL`/nlp/corrections/{correction_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: red">**DELETE**</span> `/nlp/corrections/{correction_id}`

删除纠正记录

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/nlp/corrections/{correction_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/nlp/execute`

创建课程安排。需要课表管理权限。

> 请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `ExecuteInput` (参见数据模型章节)

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/nlp/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: blue">**POST**</span> `/nlp/feedback/record`

记录预测结果反馈和用户纠正，用于持续优化算法（自学习）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/nlp/feedback/record \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/nlp/model/algorithms`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/nlp/model/algorithms \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/nlp/model/bias-analysis`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 分析模型偏差和类别分布

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/nlp/model/bias-analysis \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/nlp/model/dynamic-weighted-predict`

创建课程安排。需要课表管理权限。

> 使用动态加权融合进行预测

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/nlp/model/dynamic-weighted-predict \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/nlp/model/ensemble-predict`

创建课程安排。需要课表管理权限。

> 使用集成模型进行预测

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/nlp/model/ensemble-predict \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/nlp/model/evaluate`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/nlp/model/evaluate \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/nlp/model/evaluate-all`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/nlp/model/evaluate-all \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/nlp/model/explanation`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/nlp/model/explanation \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/nlp/model/incremental-train`

创建课程安排。需要课表管理权限。

> 请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/nlp/model/incremental-train \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/nlp/model/online-train`

创建课程安排。需要课表管理权限。

> 在线增量训练（单条数据）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/nlp/model/online-train \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/nlp/model/predict`

创建课程安排。需要课表管理权限。

> 使用训练好的模型预测规则

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/nlp/model/predict \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/nlp/model/predict-multi`

创建课程安排。需要课表管理权限。

> 使用多个模型进行预测

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/nlp/model/predict-multi \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/nlp/model/predict-with-explanation`

创建课程安排。需要课表管理权限。

> 使用模型预测并返回解释

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/nlp/model/predict-with-explanation \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/nlp/model/train`

创建课程安排。需要课表管理权限。

> 请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `TrainInput` (参见数据模型章节)

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/nlp/model/train \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: blue">**POST**</span> `/nlp/model/train-all`

创建课程安排。需要课表管理权限。

> 训练所有算法并自动选择最佳模型

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/nlp/model/train-all \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/nlp/model/training-history`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `per_page` | string | 否 | 每页数量 |  |
| `page` | string | 否 | 页码 |  |

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/nlp/model/training-history \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/nlp/optimization/auto-tune`

根据当前性能指标自动优化算法参数

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/nlp/optimization/auto-tune \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/nlp/optimization/config`

获取当前NLP算法优化配置

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/nlp/optimization/config \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/nlp/optimization/config`

设置NLP算法优化策略

> 设置优化配置
可选策略: accuracy_first, speed_first, balanced

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/nlp/optimization/config \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/nlp/parse`

创建课程安排。需要课表管理权限。

> 请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `ParseInput` (参见数据模型章节)

**响应**:

- **`200`**: 成功
  - Schema: `ParseOutput`

**示例请求**:

```bash
curl -X POST `$BASE_URL`/nlp/parse \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: blue">**POST**</span> `/nlp/parse/context-aware`

创建课程安排。需要课表管理权限。

> 请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/nlp/parse/context-aware \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/nlp/parse/deep-semantic`

创建课程安排。需要课表管理权限。

> 请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/nlp/parse/deep-semantic \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/nlp/parse/entities`

创建课程安排。需要课表管理权限。

> 请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/nlp/parse/entities \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/nlp/parse/multi-intent`

创建课程安排。需要课表管理权限。

> 请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/nlp/parse/multi-intent \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/nlp/parse/with-analysis`

解析文本并返回详细的算法分析信息

> 解析并返回详细分析
包括每一步的处理时间和决策原因

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/nlp/parse/with-analysis \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/nlp/performance/clear-cache`

清空NLP解析缓存

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/nlp/performance/clear-cache \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/nlp/performance/monitor`

获取实时性能监控数据

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/nlp/performance/monitor \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/nlp/performance/stats`

获取NLP服务性能统计

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/nlp/performance/stats \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/nlp/performance/warmup`

手动触发NLP模型预热

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/nlp/performance/warmup \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/nlp/rules`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `sort_order` | string | 否 | 排序顺序 |  |
| `sort_by` | string | 否 | 排序字段 |  |
| `score_type` | string | 否 | 评分类型 |  |
| `keyword` | string | 否 | 关键词 |  |
| `per_page` | string | 否 | 每页数量 |  |
| `page` | string | 否 | 页码 |  |

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/nlp/rules \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/nlp/rules`

创建课程安排。需要课表管理权限。

> 请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `ScoringRule` (参见数据模型章节)

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/nlp/rules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: blue">**POST**</span> `/nlp/rules/batch-import`

创建课程安排。需要课表管理权限。

> 请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/nlp/rules/batch-import \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/nlp/rules/statistics`

获取综合统计分析

> 包括描述性统计、相关性分析、分组对比等。

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/nlp/rules/statistics \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/nlp/rules/suggest`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `keyword` | string | 否 | 行为关键词 |  |

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/nlp/rules/suggest \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/nlp/rules/{rule_id}`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/nlp/rules/{rule_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: orange">**PUT**</span> `/nlp/rules/{rule_id}`

更新通知配置

> 更新微信和短信通知的配置。

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X PUT `$BASE_URL`/nlp/rules/{rule_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: red">**DELETE**</span> `/nlp/rules/{rule_id}`

删除评分规则

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/nlp/rules/{rule_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/nlp/rules/{rule_id}/usage`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `per_page` | string | 否 | 每页数量 |  |
| `page` | string | 否 | 页码 |  |

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/nlp/rules/{rule_id}/usage \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/nlp/sentiment`

创建课程安排。需要课表管理权限。

> 请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `ParseInput` (参见数据模型章节)

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/nlp/sentiment \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

## notification-config

### <span style="color: green">**GET**</span> `/notification-config/`

获取通知配置

> 返回当前的微信和短信通知配置。

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/notification-config/ \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: orange">**PUT**</span> `/notification-config/`

更新通知配置

> 更新微信和短信通知的配置。

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `NotificationConfig` (参见数据模型章节)

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X PUT `$BASE_URL`/notification-config/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: blue">**POST**</span> `/notification-config/test-sms`

测试短信通知

> 发送一条测试短信。

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `phone` | string | 否 | 手机号 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/notification-config/test-sms \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/notification-config/test-wechat`

测试微信通知

> 发送一条测试模板消息。

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `openid` | string | 否 | 用户OpenID |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/notification-config/test-wechat \
  -H "Authorization: Bearer $TOKEN"
```

---

## notifications

### <span style="color: green">**GET**</span> `/notifications/`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/notifications/ \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/notifications/`

创建课程安排。需要课表管理权限。

> 请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `Notification` (参见数据模型章节)

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/notifications/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: blue">**POST**</span> `/notifications/send`

创建课程安排。需要课表管理权限。

> 请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/notifications/send \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/notifications/user/{user_id}`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/notifications/user/{user_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/notifications/{id}`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/notifications/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: orange">**PUT**</span> `/notifications/{id}`

更新通知配置

> 更新微信和短信通知的配置。

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `Notification` (参见数据模型章节)

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X PUT `$BASE_URL`/notifications/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: red">**DELETE**</span> `/notifications/{id}`

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/notifications/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/notifications/{id}/read`

创建课程安排。需要课表管理权限。

> 请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/notifications/{id}/read \
  -H "Authorization: Bearer $TOKEN"
```

---

## notify_history

### <span style="color: green">**GET**</span> `/notify_history/`

获取通知历史记录列表

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 最近天数 |  |
| `status` | string | 否 | 状态筛选 |  |
| `per_page` | string | 否 | 每页数量 | 20 |
| `page` | string | 否 | 页码 | 1 |

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/notify_history/ \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: red">**DELETE**</span> `/notify_history/clean`

清理历史记录

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 保留天数 | 30 |

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/notify_history/clean \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/notify_history/stats`

获取通知统计数据

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/notify_history/stats \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/notify_history/{id}`

获取单个通知历史记录详情

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/notify_history/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

## notify_templates

### <span style="color: green">**GET**</span> `/notify_templates/`

获取所有模板列表

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**请求头参数**:

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| `X-Fields` | string | 否 | An optional fields mask |

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/notify_templates/ \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/notify_templates/`

创建新模板

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**请求头参数**:

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| `X-Fields` | string | 否 | An optional fields mask |

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `NotifyTemplate` (参见数据模型章节)

**响应**:

- **`200`**: Success
  - Schema: `TemplateResponse`

**示例请求**:

```bash
curl -X POST `$BASE_URL`/notify_templates/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: green">**GET**</span> `/notify_templates/categories`

获取模板分类列表

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/notify_templates/categories \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/notify_templates/{id}`

获取单个模板详情

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**请求头参数**:

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| `X-Fields` | string | 否 | An optional fields mask |

**响应**:

- **`200`**: Success
  - Schema: `TemplateResponse`

**示例请求**:

```bash
curl -X GET `$BASE_URL`/notify_templates/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: orange">**PUT**</span> `/notify_templates/{id}`

更新模板

> 更新通知配置

更新微信和短信通知的配置。

**请求头参数**:

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| `X-Fields` | string | 否 | An optional fields mask |

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `NotifyTemplate` (参见数据模型章节)

**响应**:

- **`200`**: Success
  - Schema: `TemplateResponse`

**示例请求**:

```bash
curl -X PUT `$BASE_URL`/notify_templates/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: red">**DELETE**</span> `/notify_templates/{id}`

删除模板（软删除）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/notify_templates/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/notify_templates/{id}/use`

使用模板发送通知

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/notify_templates/{id}/use \
  -H "Authorization: Bearer $TOKEN"
```

---

## operation-logs

### <span style="color: green">**GET**</span> `/operation-logs/`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/operation-logs/ \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/operation-logs/stats`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/operation-logs/stats \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/operation-logs/summary`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/operation-logs/summary \
  -H "Authorization: Bearer $TOKEN"
```

---

## permission-logs

### <span style="color: green">**GET**</span> `/permission-logs/`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/permission-logs/ \
  -H "Authorization: Bearer $TOKEN"
```

---

## prediction

### <span style="color: green">**GET**</span> `/prediction/batch`

批量获取预测

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 预测天数，默认7 |  |
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/prediction/batch \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/prediction/risk`

获取有下降风险的学生

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 预测天数，默认7 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/prediction/risk \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/prediction/score/batch`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 统计天数，默认30 |  |
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/prediction/score/batch \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/prediction/score/distribution`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/prediction/score/distribution \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/prediction/score/evaluate`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 评估数据天数，默认30 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/prediction/score/evaluate \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/prediction/score/train`

创建课程安排。需要课表管理权限。

> 请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 训练数据天数，默认90 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/prediction/score/train \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/prediction/score/{user_id}`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 统计天数，默认30 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/prediction/score/{user_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/prediction/{user_id}`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 预测天数，默认7 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/prediction/{user_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

## rank-rules

### <span style="color: green">**GET**</span> `/rank-rules/`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/rank-rules/ \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/rank-rules/`

创建课程安排。需要课表管理权限。

> 请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `ScoreRankRule` (参见数据模型章节)

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/rank-rules/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: green">**GET**</span> `/rank-rules/get-rank/{score}`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/rank-rules/get-rank/{score} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/rank-rules/{id}`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/rank-rules/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: orange">**PUT**</span> `/rank-rules/{id}`

更新通知配置

> 更新微信和短信通知的配置。

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `ScoreRankRule` (参见数据模型章节)

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X PUT `$BASE_URL`/rank-rules/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: red">**DELETE**</span> `/rank-rules/{id}`

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/rank-rules/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

## rbac

### <span style="color: green">**GET**</span> `/rbac/admin-roles/{admin_id}`

获取管理员的所有角色

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/rbac/admin-roles/{admin_id} \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: orange">**PUT**</span> `/rbac/admin-roles/{admin_id}`

为管理员分配角色（覆盖式）

> 更新通知配置

更新微信和短信通知的配置。

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `AssignRoles` (参见数据模型章节)

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X PUT `$BASE_URL`/rbac/admin-roles/{admin_id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: red">**DELETE**</span> `/rbac/admin-roles/{admin_id}/{role_code}`

移除管理员的单个角色

> 移除管理员的角色

**响应**:

- **`404`**: 关联不存在

- **`200`**: 成功

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/rbac/admin-roles/{admin_id}/{role_code} \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: blue">**POST**</span> `/rbac/admin-roles/{admin_id}/{role_code}`

为管理员添加单个角色

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`404`**: 管理员或角色不存在

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/rbac/admin-roles/{admin_id}/{role_code} \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/rbac/check`

检查当前管理员是否有指定权限

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `permission` | string | 否 | 权限代码 |  |

**响应**:

- **`403`**: 权限不足

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/rbac/check \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/rbac/permissions`

获取所有权限定义

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `is_active` | string | 否 | 按状态筛选 |  |
| `category` | string | 否 | 按分类筛选 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/rbac/permissions \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: blue">**POST**</span> `/rbac/permissions`

创建新的权限定义

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `Permission` (参见数据模型章节)

**响应**:

- **`409`**: 权限已存在

- **`400`**: 参数错误

- **`201`**: 创建成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/rbac/permissions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/rbac/permissions/{code}`

获取权限详情

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`404`**: 权限不存在

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/rbac/permissions/{code} \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: orange">**PUT**</span> `/rbac/permissions/{code}`

更新权限信息

> 更新通知配置

更新微信和短信通知的配置。

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `Permission` (参见数据模型章节)

**响应**:

- **`404`**: 权限不存在

- **`200`**: 成功

**示例请求**:

```bash
curl -X PUT `$BASE_URL`/rbac/permissions/{code} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: red">**DELETE**</span> `/rbac/permissions/{code}`

删除权限

**响应**:

- **`409`**: 权限正在使用中

- **`404`**: 权限不存在

- **`200`**: 成功

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/rbac/permissions/{code} \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/rbac/role-hierarchy/{role_code}`

获取角色的父角色和子角色

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/rbac/role-hierarchy/{role_code} \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/rbac/role-permissions/{role_code}`

获取角色的所有权限

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/rbac/role-permissions/{role_code} \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: orange">**PUT**</span> `/rbac/role-permissions/{role_code}`

设置角色的权限（覆盖式）

> 更新通知配置

更新微信和短信通知的配置。

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `SetPermissions` (参见数据模型章节)

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X PUT `$BASE_URL`/rbac/role-permissions/{role_code} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: red">**DELETE**</span> `/rbac/role-permissions/{role_code}/{permission_code}`

移除角色的单个权限

> 移除角色的权限

**响应**:

- **`404`**: 关联不存在

- **`200`**: 成功

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/rbac/role-permissions/{role_code}/{permission_code} \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: blue">**POST**</span> `/rbac/role-permissions/{role_code}/{permission_code}`

为角色添加单个权限

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`404`**: 角色或权限不存在

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/rbac/role-permissions/{role_code}/{permission_code} \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/rbac/roles`

获取所有角色及其权限信息

> 获取角色列表（含权限）

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/rbac/roles \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: blue">**POST**</span> `/rbac/roles`

创建新的角色

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `RoleWithPermissions` (参见数据模型章节)

**响应**:

- **`409`**: 角色已存在

- **`400`**: 参数错误

- **`201`**: 创建成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/rbac/roles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/rbac/roles/{role_code}`

获取角色详情

> （含权限）

**响应**:

- **`404`**: 角色不存在

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/rbac/roles/{role_code} \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: orange">**PUT**</span> `/rbac/roles/{role_code}`

更新角色信息

> 更新通知配置

更新微信和短信通知的配置。

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `RoleWithPermissions` (参见数据模型章节)

**响应**:

- **`404`**: 角色不存在

- **`200`**: 成功

**示例请求**:

```bash
curl -X PUT `$BASE_URL`/rbac/roles/{role_code} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: red">**DELETE**</span> `/rbac/roles/{role_code}`

删除角色

**响应**:

- **`409`**: 角色正在使用中

- **`404`**: 角色不存在

- **`200`**: 成功

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/rbac/roles/{role_code} \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

## records

### <span style="color: green">**GET**</span> `/records/`

获取积分记录列表

> 支持分页、学生筛选、规则筛选和日期范围筛选。
非管理员用户只能查看关联班级的数据。

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `page` | string | 否 | 页码（默认1） |  |
| `per_page` | string | 否 | 每页数量（默认50） |  |
| `user_id` | string | 否 | 学生ID筛选 |  |
| `rule_id` | string | 否 | 规则ID筛选 |  |
| `start_date` | string | 否 | 开始日期（ISO格式） |  |
| `end_date` | string | 否 | 结束日期（ISO格式） |  |

**响应**:

- **`200`**: 成功
  - Schema: `RecordListResponse`

**示例请求**:

```bash
curl -X GET `$BASE_URL`/records/ \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/records/`

创建积分记录

> 创建新的积分变动记录。同时会更新学生的当前积分。
非管理员用户只能为关联班级的学生创建记录。

请求体：
- user_id: 学生ID（必填）
- rule_id: 规则ID
- score_change: 积分变化（必填，正数加分，负数扣分）
- description: 操作说明
- operator: 操作人（默认system）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `ScoreRecord` (参见数据模型章节)

**响应**:

- **`400`**: 请求参数错误

- **`201`**: 创建成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/records/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: blue">**POST**</span> `/records/batch-entry`

批量积分录入

> 一次为多个学生录入积分，适用于班级表扬等场景。
非管理员用户只能为关联班级的学生创建记录。

请求体：
- entries: 数组，每项包含：
  - user_id: 学生ID（必填）
  - rule_id: 规则ID（可选）
  - score_change: 积分变化（必填，正数加分，负数扣分）
  - description: 操作说明（可选）
- operator: 操作人（默认batch_admin）

**响应**:

- **`400`**: 请求参数错误

- **`200`**: 批量录入完成

**示例请求**:

```bash
curl -X POST `$BASE_URL`/records/batch-entry \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/records/score-entry`

获取积分录入页面所需数据

> 返回用于积分录入的规则列表和学生列表数据。
非管理员用户只能看到关联班级的学生。

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/records/score-entry \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/records/score-entry`

创建积分录入记录

> 批量或单个创建积分记录，支持根据规则ID或直接输入分数。
非管理员用户只能为关联班级的学生创建记录。

请求体：
- user_id: 学生ID（必填）
- rule_id: 规则ID（与score_change二选一）
- score_change: 积分变化（与rule_id二选一，正数加分，负数扣分）
- description: 操作说明
- operator: 操作人（默认system）

**响应**:

- **`429`**: 请求过于频繁

- **`400`**: 请求参数错误

- **`201`**: 创建成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/records/score-entry \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/records/statistics`

获取积分统计信息

> 获取积分记录的统计数据，包括总记录数、累计加分、累计扣分等。
非管理员用户只能查看关联班级的统计数据。

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `user_id` | string | 否 | 学生ID筛选 |  |
| `class_name` | string | 否 | 班级名称筛选 |  |
| `start_date` | string | 否 | 开始日期（ISO格式） |  |
| `end_date` | string | 否 | 结束日期（ISO格式） |  |

**响应**:

- **`200`**: 成功
  - Schema: `RecordStatistics`

**示例请求**:

```bash
curl -X GET `$BASE_URL`/records/statistics \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/records/user/{user_id}`

获取指定学生的积分记录

> 根据学生ID获取该学生的所有积分变动记录。
非管理员用户只能查看关联班级的学生记录。

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `page` | string | 否 | 页码（默认1） |  |
| `per_page` | string | 否 | 每页数量（默认50） |  |

**响应**:

- **`200`**: 成功
  - Schema: `RecordListResponse`

**示例请求**:

```bash
curl -X GET `$BASE_URL`/records/user/{user_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/records/{id}`

获取单个记录详情

> 根据记录ID获取积分记录的详细信息。
非管理员用户只能查看关联班级的学生记录。

**响应**:

- **`404`**: 记录不存在

- **`200`**: 成功
  - Schema: `ScoreRecord`

**示例请求**:

```bash
curl -X GET `$BASE_URL`/records/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: red">**DELETE**</span> `/records/{id}`

删除积分记录

> 删除指定的积分记录。删除时会回滚学生的积分。
非管理员用户只能删除关联班级的学生记录。

请求体：
- confirm: 是否确认删除（必填，必须为true）

**响应**:

- **`404`**: 记录不存在

- **`200`**: 删除成功

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/records/{id} \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

## remote_notify

### <span style="color: blue">**POST**</span> `/remote_notify/broadcast`

广播通知到所有接收端。需要通知发送权限。

> 同时发送到多个主题，确保所有设备都能收到
上课时间判断：系统自动通知在上课时间会被拦截，人工通知可通过force_send参数强制发送

**请求头参数**:

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| `X-Fields` | string | 否 | An optional fields mask |

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `RemoteNotify` (参见数据模型章节)

**响应**:

- **`200`**: Success
  - Schema: `NotifyResponse`

**示例请求**:

```bash
curl -X POST `$BASE_URL`/remote_notify/broadcast \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: blue">**POST**</span> `/remote_notify/score_change`

发送积分变化通知。需要通知发送权限。

> 专门用于发送学生积分变化信息到客户端的积分窗口
上课时间判断：系统自动通知在上课时间会被拦截，人工通知可通过force_send参数强制发送

**请求头参数**:

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| `X-Fields` | string | 否 | An optional fields mask |

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `ScoreChangeNotify` (参见数据模型章节)

**响应**:

- **`200`**: Success
  - Schema: `NotifyResponse`

**示例请求**:

```bash
curl -X POST `$BASE_URL`/remote_notify/score_change \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: blue">**POST**</span> `/remote_notify/send`

发送远程通知。需要通知发送权限。

> 通过MQTT向接收端电脑发送通知指令，支持：
- 全屏置顶弹窗
- 语音播报
- 系统音量调节
- 上课时间判断：系统自动通知在上课时间会被拦截，人工通知可通过force_send参数强制发送

**请求头参数**:

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| `X-Fields` | string | 否 | An optional fields mask |

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `RemoteNotify` (参见数据模型章节)

**响应**:

- **`200`**: Success
  - Schema: `NotifyResponse`

**示例请求**:

```bash
curl -X POST `$BASE_URL`/remote_notify/send \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: blue">**POST**</span> `/remote_notify/send_to_device/{device_id}`

向指定电脑客户端发送通知。需要通知发送权限。

> 通过MQTT向特定电脑接收端发送通知指令
客户端ID是电脑接收端程序启动时显示的唯一标识
上课时间判断：系统自动通知在上课时间会被拦截，人工通知可通过force_send参数强制发送

**请求头参数**:

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| `X-Fields` | string | 否 | An optional fields mask |

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `RemoteNotify` (参见数据模型章节)

**响应**:

- **`200`**: Success
  - Schema: `NotifyResponse`

**示例请求**:

```bash
curl -X POST `$BASE_URL`/remote_notify/send_to_device/{device_id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: blue">**POST**</span> `/remote_notify/test`

发送测试通知。需要通知发送权限。

> 发送一条测试消息用于验证通知功能是否正常
默认强制发送（人工操作），也可设置force_send=False测试上课时间拦截效果

**请求头参数**:

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| `X-Fields` | string | 否 | An optional fields mask |

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `RemoteNotify` (参见数据模型章节)

**响应**:

- **`200`**: Success
  - Schema: `NotifyResponse`

**示例请求**:

```bash
curl -X POST `$BASE_URL`/remote_notify/test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

## risk

### <span style="color: green">**GET**</span> `/risk/predict/batch`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 统计天数，默认30 |  |
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/risk/predict/batch \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/risk/predict/evaluate`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 评估数据天数，默认30 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/risk/predict/evaluate \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/risk/predict/high-risk`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 统计天数，默认30 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/risk/predict/high-risk \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/risk/predict/train`

创建课程安排。需要课表管理权限。

> 请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 训练数据天数，默认90 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/risk/predict/train \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/risk/predict/{user_id}`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 统计天数，默认30 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/risk/predict/{user_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/risk/warning`

获取风险预警列表

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/risk/warning \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/risk/warning`

执行风险评估

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/risk/warning \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/risk/warning/config`

获取风险预警列表

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/risk/warning/config \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/risk/warning/config`

执行风险评估

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/risk/warning/config \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/risk/warning/{warning_id}/resolve`

执行风险评估

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/risk/warning/{warning_id}/resolve \
  -H "Authorization: Bearer $TOKEN"
```

---

## rule

### <span style="color: blue">**POST**</span> `/rule/engine/apply-by-behavior`

创建课程安排。需要课表管理权限。

> 根据行为类型应用规则

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/rule/engine/apply-by-behavior \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/rule/engine/execute`

创建课程安排。需要课表管理权限。

> 请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/rule/engine/execute \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/rule/recommend`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 统计天数，默认30 |  |
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/rule/recommend \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/rule/recommend/combination`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 统计天数，默认30 |  |
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/rule/recommend/combination \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/rule/recommend/evaluate`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 评估数据天数，默认30 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/rule/recommend/evaluate \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/rule/recommend/new`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 统计天数，默认30 |  |
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/rule/recommend/new \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/rule/recommend/optimization`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 统计天数，默认30 |  |
| `class_name` | string | 否 | 班级名称(可选) |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/rule/recommend/optimization \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/rule/recommend/statistics`

获取综合统计分析

> 包括描述性统计、相关性分析、分组对比等。

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 统计天数，默认30 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/rule/recommend/statistics \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/rule/recommend/train`

创建课程安排。需要课表管理权限。

> 请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `days` | string | 否 | 训练数据天数，默认90 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/rule/recommend/train \
  -H "Authorization: Bearer $TOKEN"
```

---

## rules

### <span style="color: green">**GET**</span> `/rules/`

获取积分规则列表

> 支持分页、分类筛选和状态筛选。需要规则查看权限。

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `page` | string | 否 | 页码（默认1） |  |
| `per_page` | string | 否 | 每页数量（默认100） |  |
| `category_id` | string | 否 | 分类ID筛选 |  |
| `is_active` | string | 否 | 是否启用筛选（true/false） |  |

**响应**:

- **`200`**: 成功
  - Schema: `RuleListResponse`

**示例请求**:

```bash
curl -X GET `$BASE_URL`/rules/ \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/rules/`

创建积分规则

> 创建新的积分规则，需要规则管理权限。

请求体：
- name: 规则名称（必填）
- description: 规则描述
- category_id: 分类ID
- score: 分数（正数加分，负数扣分，必填，范围-1000到1000）
- is_active: 是否启用（默认true）
- daily_limit: 每日上限（0表示无限制）
- min_interval: 最小间隔（秒，0表示无限制）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `ScoreRule` (参见数据模型章节)

**响应**:

- **`400`**: 请求参数错误

- **`201`**: 创建成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/rules/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/rules/export`

导出规则列表

> 将所有规则导出为CSV文件，需要报表导出权限。

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/rules/export \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: blue">**POST**</span> `/rules/import`

批量导入规则

> 数据，需要管理员权限。

请求体：
- rules: 规则数据列表

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/rules/import \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/rules/statistics`

获取规则使用统计

> 返回各规则的被使用次数、最近使用时间等信息，帮助了解规则的使用情况。

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/rules/statistics \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/rules/template/download`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/rules/template/download \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/rules/templates`

获取预设规则模板列表

> 返回系统预设的积分规则模板，包含课堂表现、作业管理、纪律管理等多个类别。

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/rules/templates \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/rules/templates/apply`

应用预设规则模板

> 根据模板ID批量创建积分规则。如果指定了分类ID，则将所有规则归入该分类；
否则会自动创建一个与模板同名的新分类。

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `ApplyTemplate` (参见数据模型章节)

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/rules/templates/apply \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: green">**GET**</span> `/rules/{id}`

获取单个规则详情

> 根据规则ID获取规则的详细信息。需要规则查看权限。

**响应**:

- **`404`**: 规则不存在

- **`200`**: 成功
  - Schema: `ScoreRule`

**示例请求**:

```bash
curl -X GET `$BASE_URL`/rules/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: orange">**PUT**</span> `/rules/{id}`

更新规则

> 更新指定规则的信息，需要规则管理权限。

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `ScoreRule` (参见数据模型章节)

**响应**:

- **`404`**: 规则不存在

- **`200`**: 更新成功

**示例请求**:

```bash
curl -X PUT `$BASE_URL`/rules/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: red">**DELETE**</span> `/rules/{id}`

删除规则

> 删除指定的规则，需要规则管理权限。

**响应**:

- **`404`**: 规则不存在

- **`200`**: 删除成功

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/rules/{id} \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

## scheduled_notify

### <span style="color: green">**GET**</span> `/scheduled_notify/`

获取定时通知列表

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/scheduled_notify/ \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/scheduled_notify/`

创建定时通知

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `ScheduledNotify` (参见数据模型章节)

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/scheduled_notify/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: green">**GET**</span> `/scheduled_notify/{id}`

获取单个定时通知详情

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/scheduled_notify/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: orange">**PUT**</span> `/scheduled_notify/{id}`

更新定时通知

> 更新通知配置

更新微信和短信通知的配置。

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `ScheduledNotify` (参见数据模型章节)

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X PUT `$BASE_URL`/scheduled_notify/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: red">**DELETE**</span> `/scheduled_notify/{id}`

删除定时通知

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/scheduled_notify/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/scheduled_notify/{id}/cancel`

取消定时通知

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/scheduled_notify/{id}/cancel \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/scheduled_notify/{id}/trigger`

立即触发定时通知

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/scheduled_notify/{id}/trigger \
  -H "Authorization: Bearer $TOKEN"
```

---

## score-analysis

### <span style="color: green">**GET**</span> `/score-analysis/class/{class_param}`

班级成绩分析

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/score-analysis/class/{class_param} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/score-analysis/exam/{exam_id}`

考试成绩分析

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/score-analysis/exam/{exam_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/score-analysis/student/{student_id}`

学生成绩分析

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/score-analysis/student/{student_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

## score-categories

### <span style="color: green">**GET**</span> `/score-categories/`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/score-categories/ \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/score-categories/`

创建课程安排。需要课表管理权限。

> 请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `Category` (参见数据模型章节)

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/score-categories/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: green">**GET**</span> `/score-categories/{id}`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/score-categories/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: orange">**PUT**</span> `/score-categories/{id}`

更新通知配置

> 更新微信和短信通知的配置。

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `Category` (参见数据模型章节)

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X PUT `$BASE_URL`/score-categories/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: red">**DELETE**</span> `/score-categories/{id}`

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/score-categories/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/score-categories/{id}/rules`

获取课程表列表。非管理员用户只能查看关联班级的课程表。

> 可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/score-categories/{id}/rules \
  -H "Authorization: Bearer $TOKEN"
```

---

## scores

### <span style="color: green">**GET**</span> `/scores/`

获取成绩列表。需要成绩查看权限。

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/scores/ \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/scores/`

录入成绩。需要成绩录入权限。

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/scores/ \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/scores/batch`

批量录入成绩。需要成绩录入权限。

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/scores/batch \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/scores/export`

导出成绩数据。需要成绩查看权限。

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/scores/export \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/scores/import`

Excel导入成绩。需要成绩录入权限。

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/scores/import \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/scores/{exam_id}/confirm-all`

确认所有成绩

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/scores/{exam_id}/confirm-all \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/scores/{id}`

获取成绩详情。需要成绩查看权限。

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/scores/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: orange">**PUT**</span> `/scores/{id}`

修改成绩。需要成绩修改权限。

> 更新通知配置

更新微信和短信通知的配置。

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X PUT `$BASE_URL`/scores/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: red">**DELETE**</span> `/scores/{id}`

删除成绩。需要成绩删除权限。

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/scores/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/scores/{id}/confirm`

确认成绩

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/scores/{id}/confirm \
  -H "Authorization: Bearer $TOKEN"
```

---

## security

### <span style="color: green">**GET**</span> `/security/audit-logs`

获取安全审计日志

> 记录所有安全相关事件，包括登录失败、权限验证、异常访问等。

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `per_page` | string | 否 | 每页数量 |  |
| `page` | string | 否 | 页码 |  |
| `user_id` | string | 否 | 用户ID |  |
| `end_date` | string | 否 | 结束日期 |  |
| `start_date` | string | 否 | 开始日期 |  |
| `severity` | string | 否 | 严重级别(info/warning/error/critical) |  |
| `event_type` | string | 否 | 事件类型 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/security/audit-logs \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/security/audit-stats`

获取安全统计数据

> 获取安全统计
提供安全事件的统计概览。

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/security/audit-stats \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: red">**DELETE**</span> `/security/clear-rate-limit`

清除IP的限流记录

> 清除IP限流记录
手动清除特定IP的限流状态。

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `ip` | string | 否 | IP地址 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/security/clear-rate-limit \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/security/rate-limit-status`

获取IP的限流状态

> 获取限流状态
查看特定IP的请求频率和限流情况。

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `ip` | string | 否 | IP地址 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/security/rate-limit-status \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/security/suspicious-ips`

获取可疑IP列表

> 基于访问频率和错误率识别可疑IP。

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/security/suspicious-ips \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/security/verify-token`

验证JWT令牌时效性

> 验证JWT令牌
检查令牌是否过期或无效。

**响应**:

- **`401`**: 令牌无效

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/security/verify-token \
  -H "Authorization: Bearer $TOKEN"
```

---

## subjects

### <span style="color: green">**GET**</span> `/subjects/`

获取所有科目

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/subjects/ \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/subjects/`

创建新科目

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `Subject` (参见数据模型章节)

**响应**:

- **`201`**: 创建成功
  - Schema: `SubjectResponse`

**示例请求**:

```bash
curl -X POST `$BASE_URL`/subjects/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: green">**GET**</span> `/subjects/export`

导出科目数据（支持JSON和Excel格式）

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/subjects/export \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/subjects/import`

从JSON或Excel文件导入科目数据（支持配置映射）

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/subjects/import \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/subjects/template`

下载科目导入模板

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/subjects/template \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/subjects/{id}`

获取科目详情

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`404`**: 科目不存在

- **`200`**: 成功
  - Schema: `SubjectResponse`

**示例请求**:

```bash
curl -X GET `$BASE_URL`/subjects/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: orange">**PUT**</span> `/subjects/{id}`

更新科目信息

> 更新通知配置

更新微信和短信通知的配置。

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `Subject` (参见数据模型章节)

**响应**:

- **`404`**: 科目不存在

- **`200`**: 更新成功

**示例请求**:

```bash
curl -X PUT `$BASE_URL`/subjects/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: red">**DELETE**</span> `/subjects/{id}`

删除科目

**响应**:

- **`404`**: 科目不存在

- **`200`**: 删除成功

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/subjects/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/subjects/{id}/classes`

获取科目关联的班级列表

**响应**:

- **`404`**: 科目不存在

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/subjects/{id}/classes \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/subjects/{id}/classes`

添加科目与班级的关联

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `SubjectClass` (参见数据模型章节)

**响应**:

- **`404`**: 科目不存在

- **`201`**: 关联成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/subjects/{id}/classes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: green">**GET**</span> `/subjects/{id}/toggle`

切换科目启用/禁用状态

**响应**:

- **`404`**: 科目不存在

- **`200`**: 切换成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/subjects/{id}/toggle \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: orange">**PUT**</span> `/subjects/{subject_id}/classes/{class_id}`

更新科目与班级的关联（如更换授课教师）

> 更新科目与班级的关联

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `SubjectClass` (参见数据模型章节)

**响应**:

- **`404`**: 关联不存在

- **`200`**: 更新成功

**示例请求**:

```bash
curl -X PUT `$BASE_URL`/subjects/{subject_id}/classes/{class_id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: red">**DELETE**</span> `/subjects/{subject_id}/classes/{class_id}`

删除科目与班级的关联

**响应**:

- **`404`**: 关联不存在

- **`200`**: 删除成功

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/subjects/{subject_id}/classes/{class_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

## system

### <span style="color: blue">**POST**</span> `/system/backup`

备份数据库

> 创建数据库的完整备份。备份文件保存在backups目录下，
最多保留10个备份文件，超出后自动删除最旧的备份。

**响应**:

- **`500`**: 备份失败

- **`404`**: 数据库文件不存在

- **`200`**: 备份成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/system/backup \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/system/backups`

获取备份列表

> 获取所有可用数据库备份文件的列表。

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/system/backups \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/system/cache-stats`

获取缓存统计信息

> 获取Redis缓存的使用统计信息，包括命中率、操作次数等。

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/system/cache-stats \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: blue">**POST**</span> `/system/cache-stats`

刷新缓存

> 清空所有缓存数据，需要管理员权限。

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/system/cache-stats \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: blue">**POST**</span> `/system/clear-cache`

清理缓存

> 清理Python缓存文件（__pycache__），需要管理员权限。

**响应**:

- **`500`**: 清理失败

- **`200`**: 清理成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/system/clear-cache \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/system/config`

获取系统配置

> Get system config
获取当前系统的配置信息。

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/system/config \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: orange">**PUT**</span> `/system/config`

更新系统配置

> 信息，需要管理员权限。

请求体：
- system_name: 系统名称
- system_logo: 系统Logo
- default_score: 默认积分
- min_score: 最低积分
- max_score: 最高积分
- enable_notifications: 启用通知
- notification_sound: 通知声音
- auto_save: 自动保存
- theme: 主题
- language: 语言

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `SystemConfig` (参见数据模型章节)

**响应**:

- **`200`**: 更新成功

**示例请求**:

```bash
curl -X PUT `$BASE_URL`/system/config \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/system/csrf-token`

获取CSRF令牌

> 获取用于表单提交的CSRF防护令牌。

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/system/csrf-token \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/system/frontend-error`

创建课程安排。需要课表管理权限。

> 请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `FrontendError` (参见数据模型章节)

**响应**:

- **`429`**: 请求过于频繁

- **`400`**: 参数错误

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/system/frontend-error \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: blue">**POST**</span> `/system/frontend-performance`

创建课程安排。需要课表管理权限。

> 请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `FrontendPerformance` (参见数据模型章节)

**响应**:

- **`429`**: 请求过于频繁

- **`400`**: 参数错误

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/system/frontend-performance \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: blue">**POST**</span> `/system/frontend-performance/batch`

创建课程安排。需要课表管理权限。

> 批量上报前端性能指标

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `FrontendPerformanceBatch` (参见数据模型章节)

**响应**:

- **`429`**: 请求过于频繁

- **`400`**: 参数错误

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/system/frontend-performance/batch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: green">**GET**</span> `/system/health`

获取系统健康状态

> 返回系统各组件的健康状态，包括数据库、Redis、MQTT等。

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/system/health \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/system/performance`

获取系统性能指标

> 返回CPU、内存、磁盘等系统资源使用情况，以及API性能统计。

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/system/performance \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/system/restore`

恢复数据库

> 从备份文件，需要管理员权限。
警告：此操作会覆盖当前的数据库内容。

请求体：
- filename: 备份文件名（必填）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `BackupRestore` (参见数据模型章节)

**响应**:

- **`500`**: 恢复失败

- **`404`**: 备份文件不存在

- **`400`**: 请提供备份文件名

- **`200`**: 恢复成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/system/restore \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/system/stats`

获取系统统计信息

> 返回系统的综合统计数据，包括用户数、积分记录数等。

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/system/stats \
  -H "Authorization: Bearer $TOKEN"
```

---

## time-rules

### <span style="color: green">**GET**</span> `/time-rules/`

获取时间规则列表

> 获取系统中所有时间规则的列表。

**响应**:

- **`200`**: 成功
  - Schema: `TimeRuleListResponse`

**示例请求**:

```bash
curl -X GET `$BASE_URL`/time-rules/ \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/time-rules/`

创建时间规则

> 创建新的时间规则，需要管理员权限。

请求体：
- name: 规则名称（必填）
- description: 规则描述（可选）
- day_of_week: 星期（-1=每天, 0=周一~6=周日，默认-1）
- start_hour: 开始小时（必填，0-23）
- start_minute: 开始分钟（必填，0-59）
- end_hour: 结束小时（必填，0-23）
- end_minute: 结束分钟（必填，0-59）
- is_active: 是否启用（可选，默认True）
- allow_unlock: 是否允许开锁（可选，默认False）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `TimeRule` (参见数据模型章节)

**响应**:

- **`201`**: 创建成功
  - Schema: `TimeRuleResponse`

**示例请求**:

```bash
curl -X POST `$BASE_URL`/time-rules/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/time-rules/check`

检查当前时间是否允许操作

> 检查当前时间是否在任意已启用的时间规则范围内。
如果在范围内，返回允许操作及匹配的规则信息。

**响应**:

- **`200`**: 检查成功
  - Schema: `TimeRuleCheckResponse`

**示例请求**:

```bash
curl -X GET `$BASE_URL`/time-rules/check \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/time-rules/{id}`

获取时间规则详情

> 根据ID获取时间规则的详细信息。

参数：
- id: 规则ID（路径参数）

**响应**:

- **`404`**: 规则不存在

- **`200`**: 成功
  - Schema: `TimeRuleResponse`

**示例请求**:

```bash
curl -X GET `$BASE_URL`/time-rules/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: orange">**PUT**</span> `/time-rules/{id}`

更新时间规则

> 更新指定时间规则的信息，需要管理员权限。

参数：
- id: 规则ID（路径参数）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `TimeRule` (参见数据模型章节)

**响应**:

- **`404`**: 规则不存在

- **`200`**: 更新成功

**示例请求**:

```bash
curl -X PUT `$BASE_URL`/time-rules/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: red">**DELETE**</span> `/time-rules/{id}`

删除时间规则

> 删除指定的时间规则，需要管理员权限。

参数：
- id: 规则ID（路径参数）

**响应**:

- **`404`**: 规则不存在

- **`200`**: 删除成功

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/time-rules/{id} \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

## user-management

### <span style="color: green">**GET**</span> `/user-management/blacklist`

获取黑名单用户列表

> 返回所有被禁用的用户。

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/user-management/blacklist \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/user-management/blacklist-check/{card_id}`

检查用户是否在黑名单中

> 检查用户是否在黑名单
用于快速检查某用户是否可以正常使用开锁功能。

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/user-management/blacklist-check/{card_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: red">**DELETE**</span> `/user-management/blacklist/{card_id}`

从黑名单移除用户

> 允许指定用户重新使用开锁功能。

**响应**:

- **`404`**: 用户不存在

- **`200`**: 成功

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/user-management/blacklist/{card_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/user-management/blacklist/{card_id}`

添加用户到黑名单

> 将指定用户加入黑名单，阻止其使用开锁功能。

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `BlacklistRequest` (参见数据模型章节)

**响应**:

- **`404`**: 用户不存在

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/user-management/blacklist/{card_id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: green">**GET**</span> `/user-management/unlock-limit/{card_id}`

获取用户的开锁限制信息

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/user-management/unlock-limit/{card_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: orange">**PUT**</span> `/user-management/unlock-limit/{card_id}`

设置用户每日开锁次数限制

> 设置用户开锁限制
允许管理员自定义用户的每日开锁次数上限。

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `UnlockLimitRequest` (参见数据模型章节)

**响应**:

- **`400`**: 限制值无效

- **`404`**: 用户不存在

- **`200`**: 成功

**示例请求**:

```bash
curl -X PUT `$BASE_URL`/user-management/unlock-limit/{card_id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: green">**GET**</span> `/user-management/user-status`

获取用户状态列表

> 支持按启用状态和黑名单状态筛选。

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `is_blacklisted` | string | 否 | 是否在黑名单 |  |
| `is_active` | string | 否 | 是否启用 |  |

**响应**:

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/user-management/user-status \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/user-management/user/{user_id}/toggle-active`

切换用户启用状态

> 将用户标记为启用或禁用。禁用的用户无法使用开锁功能。

**响应**:

- **`404`**: 用户不存在

- **`200`**: 成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/user-management/user/{user_id}/toggle-active \
  -H "Authorization: Bearer $TOKEN"
```

---

## users

### <span style="color: green">**GET**</span> `/users/`

获取学生列表

> 根据权限返回学生列表。超级管理员可以查看所有学生，教师只能查看所属班级的学生。

查询参数：
- page: 页码（默认1）
- per_page: 每页数量（默认100）
- search: 搜索关键词，匹配姓名、卡号、电话
- class_name: 班级名称筛选

返回分页结果，包含用户列表和分页信息。

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `page` | string | 否 | 页码，默认1 |  |
| `per_page` | string | 否 | 每页数量，默认100 |  |
| `search` | string | 否 | 搜索关键词（姓名、学号、电话） |  |
| `class_name` | string | 否 | 班级名称筛选 |  |

**响应**:

- **`200`**: 成功
  - Schema: `UserListResponse`

**示例请求**:

```bash
curl -X GET `$BASE_URL`/users/ \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: blue">**POST**</span> `/users/`

创建新学生

> 创建学生
创建一个新的学生账户。
非管理员用户只能为关联班级创建学生。

请求体：
- name: 学生姓名（必填）
- gender: 性别（可选）
- class_name: 班级（可选）
- phone: 联系电话（可选）
- father_name: 父亲姓名（可选）
- father_phone: 父亲电话（可选）
- mother_name: 母亲姓名（可选）
- mother_phone: 母亲电话（可选）
- guardian_name: 监护人姓名（可选）
- guardian_phone: 监护人电话（可选）
- guardian_relation: 监护关系（可选）
- card_id: 学号（必填，8-16位数字）
- current_score: 当前积分（可选，默认0，范围-1000到1000）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `User` (参见数据模型章节)

**响应**:

- **`400`**: 参数错误

- **`201`**: 创建成功

**示例请求**:

```bash
curl -X POST `$BASE_URL`/users/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: blue">**POST**</span> `/users/batch-delete`

批量删除学生

> 批量删除指定的学生。
非管理员用户只能删除关联班级的学生。

请求体：
- ids: 用户ID列表

返回删除结果。

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `BatchDeleteRequest` (参见数据模型章节)

**响应**:

- **`400`**: 没有提供删除ID

- **`200`**: 删除完成

**示例请求**:

```bash
curl -X POST `$BASE_URL`/users/batch-delete \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: blue">**POST**</span> `/users/batch-score`

批量调整学生积分

> 为多个学生同时调整积分。
非管理员用户只能为关联班级的学生调整积分。

请求体：
- ids: 用户ID列表（必填）
- score_change: 积分变化量（必填，正数加分，负数扣分）
- description: 操作描述（可选）

返回调整结果。

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `BatchScoreRequest` (参见数据模型章节)

**响应**:

- **`400`**: 没有提供用户ID

- **`200`**: 调整完成

**示例请求**:

```bash
curl -X POST `$BASE_URL`/users/batch-score \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/users/by-card/{cardId}`

通过卡片ID获取学生信息

> 根据学生的卡片ID查询学生信息。
非管理员用户只能查看关联班级的学生。

**响应**:

- **`404`**: 未找到用户

- **`200`**: 成功

**示例请求**:

```bash
curl -X GET `$BASE_URL`/users/by-card/{cardId} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/users/import`

批量导入学生（JSON格式）

> 通过JSON格式批量导入学生数据。
非管理员用户只能为关联班级导入学生。

请求体：
- users: 学生列表数组

返回导入结果，包含成功和失败数量。

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `UserImportRequest` (参见数据模型章节)

**响应**:

- **`400`**: 没有导入数据

- **`200`**: 导入完成

**示例请求**:

```bash
curl -X POST `$BASE_URL`/users/import \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: blue">**POST**</span> `/users/import-file`

通过CSV文件批量导入学生

> 上传CSV文件批量导入学生数据。支持UTF-8和GBK编码。
非管理员用户只能为关联班级导入学生。

请求：multipart/form-data
- file: CSV文件

CSV文件格式：
姓名,性别,班级,联系电话,卡片ID,父亲姓名,父亲电话,母亲姓名,母亲电话,监护人姓名,监护人电话,监护关系,初始积分

返回导入结果，包含新增、更新数量和错误信息。

**响应**:

- **`400`**: 文件错误

- **`200`**: 导入完成

**示例请求**:

```bash
curl -X POST `$BASE_URL`/users/import-file \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: green">**GET**</span> `/users/template/download`

下载CSV导入模板

> 下载导入模板
下载学生批量导入的CSV模板文件。

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/users/template/download \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/users/{id}`

获取单个学生详细信息

> 获取单个学生信息
根据学生ID获取详细信息。
非管理员用户只能查看关联班级的学生。

**响应**:

- **`404`**: 学生不存在

- **`200`**: 成功
  - Schema: `User`

**示例请求**:

```bash
curl -X GET `$BASE_URL`/users/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: orange">**PUT**</span> `/users/{id}`

更新学生信息

> 更新指定学生的信息。
非管理员用户只能更新关联班级的学生。

请求体参数均为可选，只更新提供的字段。

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `User` (参见数据模型章节)

**响应**:

- **`404`**: 学生不存在

- **`200`**: 更新成功

**示例请求**:

```bash
curl -X PUT `$BASE_URL`/users/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**认证要求**: 需要 Bearer Token 认证

---

### <span style="color: red">**DELETE**</span> `/users/{id}`

删除学生

> 删除指定的学生账户。
非管理员用户只能删除关联班级的学生。

**响应**:

- **`404`**: 学生不存在

- **`200`**: 删除成功

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/users/{id} \
  -H "Authorization: Bearer $TOKEN"
```

**认证要求**: 需要 Bearer Token 认证

---

## wol

### <span style="color: green">**GET**</span> `/wol/devices`

Get all WOL devices from database

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**请求头参数**:

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| `X-Fields` | string | 否 | An optional fields mask |

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/wol/devices \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/wol/devices`

Add a new WOL device to database

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**请求头参数**:

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| `X-Fields` | string | 否 | An optional fields mask |

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `WOLDevice` (参见数据模型章节)

**响应**:

- **`200`**: Success
  - Schema: `WOLDevice`

**示例请求**:

```bash
curl -X POST `$BASE_URL`/wol/devices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: green">**GET**</span> `/wol/devices/{device_id}`

Get a single WOL device by ID

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**请求头参数**:

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| `X-Fields` | string | 否 | An optional fields mask |

**响应**:

- **`200`**: Success
  - Schema: `WOLDevice`

**示例请求**:

```bash
curl -X GET `$BASE_URL`/wol/devices/{device_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: orange">**PUT**</span> `/wol/devices/{device_id}`

Update an existing WOL device

> 更新通知配置

更新微信和短信通知的配置。

**请求头参数**:

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| `X-Fields` | string | 否 | An optional fields mask |

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `WOLDevice` (参见数据模型章节)

**响应**:

- **`200`**: Success
  - Schema: `WOLDevice`

**示例请求**:

```bash
curl -X PUT `$BASE_URL`/wol/devices/{device_id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: red">**DELETE**</span> `/wol/devices/{device_id}`

Delete a WOL device (soft delete)

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X DELETE `$BASE_URL`/wol/devices/{device_id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/wol/status/{mac_address}`

Check if device is reachable (ping check)

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**路径参数**:

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| `mac_address` | string | 是 | Device MAC address |

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/wol/status/{mac_address} \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: green">**GET**</span> `/wol/validate`

Validate MAC address format

> 获取课程表列表。非管理员用户只能查看关联班级的课程表。

可选参数：
- class_info_id: 班级ID
- day_of_week: 星期
- teacher_name: 教师姓名
- classroom: 教室

**查询参数**:

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| `mac` | string | 否 | MAC address to validate |  |

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X GET `$BASE_URL`/wol/validate \
  -H "Authorization: Bearer $TOKEN"
```

---

### <span style="color: blue">**POST**</span> `/wol/wake`

Wake up a single computer via Wake-on-LAN

> The target computer must support WOL and have it enabled in BIOS/UEFI

**请求头参数**:

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| `X-Fields` | string | 否 | An optional fields mask |

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `WakeOnLAN` (参见数据模型章节)

**响应**:

- **`200`**: Success
  - Schema: `WOLResponse`

**示例请求**:

```bash
curl -X POST `$BASE_URL`/wol/wake \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

### <span style="color: blue">**POST**</span> `/wol/wake/batch`

Wake up multiple computers via Wake-on-LAN

> 创建课程安排。需要课表管理权限。

请求体：
- class_info_id: 班级ID（必填）
- subject_id: 科目ID（必填）
- day_of_week: 星期(0-6)（必填）
- period_number: 节次编号（必填）
- teacher_name: 教师姓名（可选）
- classroom: 教室（可选）
- description: 描述（可选）
- color: 颜色（可选）

**请求体** (必填):

- Content-Type: `application/json`
  - Schema: `WakeOnLANBroadcast` (参见数据模型章节)

**响应**:

- **`200`**: Success

**示例请求**:

```bash
curl -X POST `$BASE_URL`/wol/wake/batch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

## 通用说明

### 统一响应格式

```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}
```

### 错误码说明

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 422 | 参数校验失败 |
| 500 | 服务器内部错误 |

### 认证头格式

```
Authorization: Bearer <JWT_TOKEN>
```

### 相关链接

- [在线Swagger UI (交互式)](swagger-ui.html)
- [在线Redoc文档 (易读)](redoc.html)
- [OpenAPI JSON规范](openapi.json)

### 查看方式

```bash
# 本地启动HTTP服务器
cd api-docs
python -m http.server 8000
# 然后浏览器访问 http://localhost:8000/swagger-ui.html
```
