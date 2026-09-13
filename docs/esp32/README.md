# ESP32 手机箱对接开发文档套件

> 版本：v1.0 ｜ 编写日期：2026-09-12
> 适用对象：ESP32 固件开发者、后端联调工程师、运维
> 编写依据：**后端源码逐行核对**（非凭空设计），所有 topic / 字段 / 常量均可直接落地

---

## 文档清单

| # | 文档 | 内容摘要 | 篇幅 |
|---|------|---------|------|
| **01** | [MQTT通信协议](./01-MQTT通信协议.md) | 连接鉴权、双连接分流架构、主题命名规范、QoS 等级、消息信封、上下行指令格式（逐 topic 报文样例）、幂等机制 | ~600 行 |
| **02** | [设备识别与注册认证](./02-设备识别与注册认证.md) | `Device` 全字段、`device_id` 生成规则与校验正则、注册时序、认证现状与增强方案、多设备在线识别 | ~560 行 |
| **03** | [积分逻辑](./03-积分逻辑.md) | **四条积分写入路径**选型矩阵、`score/add` 幂等、`points/*` 审批、开锁扣分与限额、`ScoreRule` 字段、设备侧范式 | ~640 行 |
| **04** | [OTA升级设计](./04-OTA升级设计.md) | 升级全流程状态机、版本协商与 `min_compatible_version`、HMAC 签名 + MD5 双校验、静默期/灰度/分批/冷却、**回滚现状与自研方案**、环境变量全表 | ~830 行 |
| **05** | [其他功能与多设备管理](./05-其他对接功能与多设备管理.md) | 心跳与在线判定、箱体状态、远程控制/重启、告警、设备分组、班主任策略、**多设备在线读取 API 全清单** | ~700 行 |
| **06** | [差异同步与优化方案](./06-差异同步与优化方案.md) | **17 项差异**逐条：现象 → 证据 → 影响 → 同步方案 → 改动范围 → 风险 | ~900 行 |

**旧文档已移除**（2026-09-12 归档）：

- ~~`docs/MQTT_INTEGRATION.md`~~（2026-05-20）—— 旧版 MQTT 说明，**未覆盖双连接分流、OTA、points 路径**，
  且「积分范围 0~100」「`DAILY_LIMIT=10`」等描述已过时或从未生效。
  **已归档至 `docs/archive/doc/MQTT文档/MQTT_INTEGRATION_20260520_已废弃.md`**（不再维护，仅供历史追溯）。
  **请以本套件 01/03 为唯一事实来源。**

---

## 快速导航（按角色）

### 我是 ESP32 固件开发者

推荐阅读顺序：

```
02 §2     device_id 生成规则       → 先确定设备标识
01 §1-2   连接与鉴权               → 把设备连上
01 §3     Topic 规范               → 确定订阅/发布清单
02 §3     注册时序                 → 开机流程
05 §1     心跳                     → 保活
01 §6.1   刷卡查询                 → 基础交互
01 §6.3   请求开箱                 → 核心功能
03 §6     开锁扣分规则             → 理解扣分
03 §3     加分（走 P1）            → 加分功能
04 §11    OTA 完整实现骨架         → 升级功能
```

**可直接复制的代码片段**：

| 片段 | 位置 |
|------|------|
| MQTT 连接 + 订阅 | 01 §2.5 |
| `device_id` 生成（ChipID 派生） | 02 §2.2 |
| 共享 topic 过滤 | 02 §5.4 |
| 刷卡查询 / 开箱 / 加分 / 申请 | 03 §8 |
| HMAC 验签（mbedtls） | 04 §6.2 |
| MD5 流式校验 | 04 §6.3 |
| 完整 OTA 下载 + 写入 + 重启 | 04 §11 |
| 启动自检 + 自动回滚 | 04 §8.2 |
| 进度上报 | 04 §7.5 |
| 重启指令兼容处理 | 06 §5 |
| reason 码包含匹配 | 06 §17 |

### 我是后端联调/运维

推荐阅读顺序：

```
06        差异清单 → 了解已知问题与修复排期
05 §8     多设备在线读取 API
04 §10    OTA 管理接口
04 §9     OTA 环境变量配置
01 §8     MQTT 调试接口
```

### 我要做生产部署

**必读检查清单**：

| 检查项 | 位置 | 说明 |
|--------|------|------|
| MQTT Broker 切回生产配置 | 01 §2.2 | **当前开发库是 `broker.hivemq.com` 明文匿名！** |
| 配置 `OTA_FIRMWARE_BASE_URL` | 04 §9 | **未配置 → 自动推送完全不动** |
| 配置 `OTA_SIGNING_SECRET` | 04 §9 | 未配置 → 指令签名失效 |
| 确认日/周开锁限额 | 06 §8 | **日限额实际是 5，不是 10** |
| 修复重启指令广播缺陷 | 06 §5 | 🔴 **会导致全校设备同时重启** |
| 固件下载访问控制 | 06 §6 | 当前匿名 + ID 可枚举 |

---

## 核心事实速查

### MQTT 连接

| 项 | 值 |
|----|-----|
| 代码默认 Broker | `nc5233fc.ala.cn-hangzhou.emqxsl.cn:8883`（TLS） |
| **实际开发库配置** | `broker.hivemq.com:1883`（**明文匿名，非生产**） |
| Keepalive | 60s |
| 后端连接数 | **2 条**（控制连接 + 遥测连接） |
| 设备 QoS | 心跳 **0**，其余上行 **1**；下行统一 **1** |

### 主题（设备侧必订阅）

```
phonebox/unlock/{box_id}        QoS1    开箱/查询结果
phonebox/points/result          QoS1    积分回包（共享，需按 card_id 过滤）
phonebox/ota/{device_id}        QoS1    定向 OTA
phonebox/ota                    QoS1    广播 OTA
phonebox/control/restart        QoS1    重启（当前无 device_id，见 06 §5）
phonebox/command/{device_id}    QoS1    通用命令（定向）
phonebox/command                QoS1    通用命令（广播）
score/add/result[/{client_id}]  QoS1    加分回包
score/undo/result[/{client_id}] QoS1    撤销回包
score/rules/result              QoS1    规则列表
```

### 关键常量

| 常量 | 值 | 位置 |
|------|-----|------|
| `MIN_SCORE`（开锁门槛） | **80** | `unlock_validator.py` |
| `UNLOCK_COST`（开锁扣分） | **10** | `unlock_validator.py` |
| `WEEKLY_LIMIT` | **5** | `unlock_validator.py` |
| `DAILY_LIMIT` | **5**（= `DEFAULT_DAILY_UNLOCK_LIMIT`，已收敛唯一口径，见 06 §8） | `unlock_validator.py` |
| `User.daily_unlock_limit` | **5**（用户级覆盖值，缺省回落 `DAILY_LIMIT`） | `user_models.py` |
| `heartbeat_timeout` | **30s** | `Device` 默认 |
| 开锁流水描述 | **`"开锁扣分"`**（统计依赖此串） | `unlock_validator.py` |
| OTA 签名内容 | `{id}:{version}:{url}` | `ota_negotiation_service.py` |
| OTA 推送冷却 | **600s** | `OTA_PUSH_COOLDOWN_SEC` |
| `device_id` 正则 | `^[a-zA-Z][a-zA-Z0-9_]{5,63}$` | `validation.py` |

### 必须由设备侧实现（后端无法替代）

| # | 能力 | 原因 |
|---|------|------|
| 1 | **启动自检 + 自动回滚** | 后端无回滚机制（06 §2） |
| 2 | **`msg_id` 持久化自增** | 断电重启不重复（03 §3.3） |
| 3 | **`unlock` 绝不盲目重试** | 有扣分副作用（01 §7.1） |
| 4 | **共享 topic 过滤** | `phonebox/points/result` 等多设备共收（02 §5.4） |
| 5 | **reason 包含匹配** | 双套命名（06 §17） |
| 6 | **处理空 payload** | `phonebox/unlock/A` payload 为 `""`（06 §14） |

---

## 后端核心文件索引

> 行数为 2026-09-12 实测值（06 差异同步落地后）。

| 文件 | 行数 | 职责 |
|------|------|------|
| `apps/backend/services/mqtt_manager.py` | 1143 | MQTT 连接/订阅/发布、OTA register/status、心跳、重连、设备认证门禁 |
| `apps/backend/services/mqtt_message_service.py` | 1022 | MQTT 上行消息处理中枢（派发表 + 各 handler + points 幂等） |
| `apps/backend/api/devices/devices_routes.py` | 1425 | 设备 REST 全量端点（含 `/online` 两段式分页、设备密钥 3 端点） |
| `apps/backend/api/devices/firmware_routes.py` | 884 | 固件/OTA REST 管理面（含 `device_type` 维度） |
| `apps/backend/services/ota_negotiation_service.py` | 786 | 版本协商 + 自动推送 + 灰度 + 签名 + 回滚 |
| `apps/backend/services/device_service.py` | 544 | 设备域防腐层（F17） |
| `apps/backend/services/unlock_validator.py` | 373 | 开锁资格校验 + 扣分记账（唯一日限额口径） |
| `apps/backend/services/heartbeat_service.py` | 354 | 在线判定权威实现 + 设备错误告警 |
| `apps/backend/utils/device_auth.py` | 215 | **设备认证（差异 #4）**：白名单开关 / HMAC 验签 / 密钥签发吊销 |
| `apps/backend/utils/unlock_reasons.py` | 117 | **开锁 reason 码统一（差异 #17）**：`UnlockReason` 常量 + `canonicalize` |
| `apps/backend/services/phonebox_policy.py` | 258 | 班主任自助开箱策略 |
| `apps/backend/services/class_time_checker.py` | 343 | 上课时段 / 课表反查 |
| `apps/backend/services/firmware_service.py` | 238 | 固件域防腐层（F17） |
| `apps/backend/models/device_models.py` | 248 | 设备域全部模型（含 `device_secret` / `last_seen_ts`） |
| `apps/backend/models/score_models.py` | 471 | 积分域模型 |
| `apps/backend/utils/validation.py` | 642 | 参数校验（含 `validate_device_id`） |
| `apps/backend/utils/score_utils.py` | — | `atomic_score_update` 原子累加 |

---

## 文档维护约定

1. **本套件以「后端源码」为唯一事实来源**。任何后端改动若影响 topic / 字段 / 常量，必须同步更新对应文档。
2. **标注差异**：文档中所有 🔴 / ⚠️ 标记处即为「现有实现与理想规范不一致」，明细汇总在 06。
3. **禁止凭记忆修改**：修改前请对照源码（文件路径已在各文档「事实来源」标注）。
4. **契约冻结**：`reason` 码、topic 名、payload 字段名一旦被设备侧依赖，改动需走版本化流程。
