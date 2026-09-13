# ESP32 对接开发文档 04 — OTA 升级设计

> 文档版本：v1.0
> 编写日期：2026-09-12
> 事实来源：`services/ota_negotiation_service.py`、`services/mqtt_manager.py`、`api/devices/firmware_routes.py`、`services/firmware_service.py`、`models/device_models.py`、`scripts/verify_ota_e2e.py`
>
> **核心结论（请先读）**：
> 1. 系统提供 **MQTT 自动推送** 与 **REST 手动触发** 两条下发通道，**报文格式一致**。
> 2. 版本协商支持 `min_compatible_version`（最低兼容版本），过低版本会被拒绝升级（需先中间升级）。
> 3. 指令带 **HMAC-SHA256 签名** + 固件 **MD5** 双重校验。
> 4. **系统当前没有设备端回滚机制**（无 A/B 分区、无版本回退指令）——设备侧必须自行实现。
> 5. 自动推送受**静默期（上课时段）+ 冷却期 + 灰度百分比 + 分批错峰**四重保护。
> 6. 自动推送**依赖 `OTA_FIRMWARE_BASE_URL`**，未配置则中止。

---

## 一、涉及的数据模型

### 1.1 `FirmwareVersion`（表名 `firmware_versions`）

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | Integer PK | 固件 ID（**签名与下载 URL 都用到**） |
| `version` | String(50) **UNIQUE** | 版本号，**必须语义化 `x.y.z`** |
| `description` | Text | 版本说明 |
| `file_path` | String(500) | 服务器绝对路径（realpath 校验） |
| `file_size` | Integer | 字节数 |
| `md5` | String(64) | **MD5 校验值**（设备侧必须验证） |
| `min_compatible_version` | String(50) | **最低兼容版本**（低于此版本需先中间升级） |
| `is_mandatory` | Boolean | 是否强制升级 |
| `is_active` | Boolean | 是否启用（**只有 active 才参与协商**） |
| `created_at` | DateTime | 上传时间（「最新固件」按此倒序取） |
| `created_by` | Integer FK | 上传人 |

> 🔴 **`FirmwareVersion` 没有 `device_type` 维度**。
> 若未来接入 `doorlock`，会误推 phonebox 固件。详见《06-差异同步与优化方案》§1。

### 1.2 `DeviceFirmwareUpdate`（表名 `device_firmware_updates`）

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | Integer PK | — |
| `device_id` | String | 设备标识 |
| `device_name` | String | 设备名快照 |
| `from_version` | String | 升级前版本 |
| `to_version` | String | 目标版本 |
| `status` | String(20) | `pending` / `in_progress` / `completed` / `failed` |
| `started_at` | DateTime | 开始时间 |
| `completed_at` | DateTime | 完成时间 |
| `error_message` | String | 失败原因 |

### 1.3 `Device` 上的 OTA 相关列

| 列 | 说明 |
|----|------|
| `fw_version` | **当前固件版本**（协商输入） |
| `platform` | 平台标识 |
| `device_type` | 设备类型 |
| `auto_update` | **是否允许自动推送**（默认 `True`） |
| `ota_status` | `idle` / `pending` / `upgrading` / `failed` |
| `last_ota_push_at` | 上次推送时间（**冷却判定依据**） |

---

## 二、OTA 全流程状态机

### 2.1 总体时序

```
┌──────────────┐                              ┌────────────────────────────────────┐
│  ESP32 设备  │                              │            Flask 后端              │
└──────┬───────┘                              └──────────────┬─────────────────────┘
       │                                                     │
       │ ① 开机 / 每 30min                                    │
       │    publish phonebox/ota/register ──────────────────► │
       │    {device_id, fw_version, platform, device_type}    │
       │                                                     │
       │                            ② try_auto_negotiate()   │
       │                               ├─ compare_versions() │
       │                               ├─ 检查 min_compatible │
       │                               └─ can_auto_push()     │
       │                                                     │
       │                            ③ schedule_auto_push()   │
       │                               ├─ device.ota_status = "pending"
       │                               ├─ last_ota_push_at = now
       │                               └─ threading.Timer(抖动 + 静默期推迟)
       │                                                     │
       │                            ④ _execute_push() 二次校验
       │                               ├─ 仍在静默期 → 重试
       │                               ├─ 已 upgrading → reset pending
       │                               ├─ 重新 negotiate（版本已最新 → reset）
       │                               ├─ URL 非 http 开头 → 中止
       │                               └─ publish_ota_command() ──┐
       │                                                     │    │
       │ ⑤ ◄──────────── phonebox/ota/{device_id} ◄──────────┘    │
       │    {action:"update", id, url, version, md5,               │
       │     is_mandatory, force:false, signature, timestamp}      │
       │                                                           │
       │ ⑥ 验签（HMAC）→ 校验 force → 下载                                        │
       │    publish phonebox/ota/status {status:"started"} ──────► │
       │                                    → device.ota_status="upgrading"
       │                                    → DeviceFirmwareUpdate(status="in_progress")
       │                                                           │
       │ ⑦ 下载中（HTTP GET /api/firmware/download/{id}）           │
       │    publish phonebox/ota/status {status:"downloading", progress:N}
       │                                                           │
       │ ⑧ MD5 校验 → 写入分区 → 重启生效                            │
       │                                                           │
       │ ⑨ 升级完成                                                │
       │    publish phonebox/ota/status                          │
       │      {status:"success", from_version, to_version} ──────► │
       │                            → DeviceFirmwareUpdate(status="completed")
       │                            → device.fw_version = to_version
       │                            → device.ota_status = "idle"
       │                            → device.last_ota_push_at = None
       │                            → 写 OperationLog
       │                                                           │
       │ ⑩ 重启后重新 register → 闭环校验版本
```

### 2.2 `Device.ota_status` 状态机

```
                  ┌──────────────────────────────────────────┐
                  │                                          │
             ┌────▼────┐  schedule_auto_push   ┌─────────┐   │
             │  idle   │ ────────────────────► │ pending │   │
             └────┬────┘                       └────┬────┘   │
                  │                                 │        │
                  │            _execute_push 成功下发 │        │
                  │                                 ▼        │
                  │                            ┌──────────┐  │
                  │                            │upgrading │  │
                  │                            └────┬─────┘  │
                  │                                 │        │
                  │        ┌────────────────────────┼────────┤
                  │        │                        │        │
                  │   status=success          status=failed │
                  │   /completed              或任一失败码  │
                  │        │                        │        │
                  │        ▼                        ▼        │
                  │   ┌────────┐              ┌────────┐     │
                  └───│  idle  │              │ failed │─────┘
                      └────────┘              └────────┘
                                              冷却 600s 后可重试
```

| 状态 | 含义 | 如何退出 |
|------|------|---------|
| `idle` | 空闲（初始 / 升级成功） | 协商通过 → `pending` |
| `pending` | 已调度，等待定时器触发 | 定时器 → `upgrading`；二次校验失败 → `idle` |
| `upgrading` | 设备正在升级 | 设备报 `success` → `idle`；报失败码 → `failed` |
| `failed` | 升级失败 | 冷却 `OTA_PUSH_COOLDOWN_SEC`（600s）后可重新调度 |

---

## 三、设备注册与版本上报

### 3.1 注册/上报 topic

| Topic | 形式 | device_id 来源 |
|-------|------|---------------|
| `phonebox/ota/register` | 广播 | payload 必填 `device_id` |
| `phonebox/ota/{device_id}/register` | 定向 | payload 优先，缺失则取 topic 第 3 段 |

**推荐**：设备侧用**定向形式**（`phonebox/ota/{device_id}/register`），便于后端溯源与排障。

### 3.2 注册报文

```json
{
  "msg_id": "msg_pb7C9EBDA1F2C4_2_reg",
  "client_id": "pb7C9EBDA1F2C4",
  "device_id": "pb7C9EBDA1F2C4",
  "fw_version": "1.0.0",
  "platform": "esp32",
  "device_type": "phonebox"
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `device_id` | **是** | 用于定位设备 |
| `fw_version` | **强烈建议** | 不传则后端不协商（`try_auto_negotiate` 直接 return） |
| `platform` | 建议 | 如 `esp32` |
| `device_type` | 建议 | 如 `phonebox` |

### 3.3 后端处理

```python
# MQTTManager._process_ota_register
device = Device.query.filter_by(device_id=device_id).first()
if not device:
    device = Device(device_id=device_id, name=f"设备 {device_id}", status="online")
    db.session.add(device)
device.status = "online"
device.last_heartbeat = datetime.now()
if fw_version:   device.fw_version  = fw_version
if platform:     device.platform    = platform
if device_type:  device.device_type = device_type
db.session.commit()
try_auto_negotiate(device)          # ← 版本协商入口
```

> ⚠️ **`device_type` 只在 `_process_ota_register` 中写入**（心跳路径的 `handle_heartbeat_message` 不写）。
> 因此**必须发送 `phonebox/ota/register`**，否则设备 `device_type` 为空。

---

## 四、版本管理与协商

### 4.1 版本号规范（硬性）

**必须语义化**：`{major}.{minor}.{patch}`，如 `1.0.0`、`1.2.13`

后端 `compare_versions` 实现（`ota_negotiation_service.py`）：

```python
def compare_versions(v1, v2):
    """语义化版本比较，返回 1 / -1 / 0。支持 '2.10' > '2.9'。
       非数字片段按 0 处理；长度不齐时短侧补 0。"""
    def parse(v):
        parts = []
        for x in str(v).split("."):
            try:    parts.append(int(x))
            except ValueError: parts.append(0)     # 非数字 → 0
        return parts
    a, b = parse(v1), parse(v2)
    for i in range(max(len(a), len(b))):
        p1 = a[i] if i < len(a) else 0
        p2 = b[i] if i < len(b) else 0
        if p1 != p2:
            return 1 if p1 > p2 else -1
    return 0
```

**行为**：

| 比较 | 结果 |
|------|------|
| `2.10` vs `2.9` | `2.10 > 2.9` ✅（数值比较，非字符串） |
| `1.0` vs `1.0.0` | 相等 ✅（短侧补 0） |
| `1.0.0-beta` vs `1.0.0` | 相等（`beta` → 0） ⚠️ |
| `v1.0.0` vs `1.0.0` | **`v1` → 0**，故 `v1.0.0` 被当作 `0.0.0` 🔴 |

> 🔴 **设备侧禁止在版本号中加 `v` 前缀或非数字后缀**。用纯 `1.0.0` 格式。

### 4.2 协商决策（`negotiate`）

```python
def negotiate(device, reported_version):
    latest = get_latest_active_firmware()        # 按 created_at 倒序取 is_active 的
    if not latest:
        return {"action": "no_firmware"}
    if compare_versions(reported_version, latest.version) >= 0:
        return {"action": "up_to_date", "latest_version": latest.version}
    if (latest.min_compatible_version
        and compare_versions(reported_version, latest.min_compatible_version) < 0):
        return {"action": "skip_too_old",
                "latest_version": latest.version,
                "min_compatible_version": latest.min_compatible_version}
    return {"action": "upgrade", "firmware": latest, "latest_version": latest.version}
```

| action | 含义 | 自动推送 |
|--------|------|---------|
| `no_firmware` | 无 active 固件 | 否 |
| `up_to_date` | 已是最新 | 否 |
| `skip_too_old` | **低于 `min_compatible_version`**，需先中间升级 | 否 |
| `upgrade` | 可升级 | **是**（若其他护栏通过） |

> **`min_compatible_version` 用途**：防止设备从 `0.9.0` 直接跳到 `2.0.0`（分区大小/接口不兼容）。
> 运维需为 `2.0.0` 设置 `min_compatible_version = "1.5.0"`，引导设备先升到 `1.5.x`。

### 4.3 自动推送护栏（`can_auto_push`）

全部条件通过才允许自动推送：

```python
if not OTA_AUTO_PUSH_ENABLED:              return False   # 1. 全局开关
if device.auto_update is False:            return False   # 2. 设备开关
if in_quiet_window():                      return False   # 3. 静默期
status = device.ota_status or "idle"
last   = device.last_ota_push_at
if status == "upgrading":                  return False   # 4. 已在升级
if status in ("pending", "failed") and last is not None:
    if (now - last).seconds < OTA_PUSH_COOLDOWN_SEC:
                                           return False   # 5. 冷却期内
return True
```

| # | 护栏 | 控制项 |
|---|------|--------|
| 1 | 全局自动推送开总 | `OTA_AUTO_PUSH_ENABLED` |
| 2 | 单设备开关 | `Device.auto_update` |
| 3 | 静默期 | `OTA_RESPECT_CLASS_TIME` + `OTA_QUIET_WINDOWS` |
| 4 | 已在升级中 | `Device.ota_status == "upgrading"` |
| 5 | 冷却期 | `OTA_PUSH_COOLDOWN_SEC`（默认 600s） |

### 4.4 静默期（`in_quiet_window`）

```python
def in_quiet_window(now=None):
    # A. 上课时段（复用 ClassTimeChecker）
    if OTA_RESPECT_CLASS_TIME:
        if ClassTimeChecker.is_during_class_time()[0]:
            return True
    # B. 显式静默窗口（支持跨午夜）
    if OTA_QUIET_WINDOWS:
        cur = now.hour * 60 + now.minute
        for win in OTA_QUIET_WINDOWS.split(","):        # 例 "22:00-06:00,12:00-14:00"
            a, b = win.split("-", 1)
            start, end = _parse_hhmm(a), _parse_hhmm(b)
            if _hit_window(cur, start, end):            # start > end 时跨午夜
                return True
    return False
```

**命中静默期时的推送推迟策略**：

| 情形 | 推迟 |
|------|------|
| `OTA_QUIET_WINDOWS` 命中 | `seconds_until_quiet_window_end()` 精确计算到窗口结束 |
| **上课时段命中** | **固定 300s 重试**（无法预估下课时间） |

### 4.5 灰度与分批（`_plan_rollout`）

```python
def _plan_rollout(eligible, stage_percent, batch_size):
    chosen = list(eligible)
    if stage_percent < 100:
        random.shuffle(chosen)                                    # 随机洗牌（每批不同设备）
        k = max(1, int(math.ceil(len(chosen) * stage_percent / 100.0)))
        chosen = chosen[:k]
    planned = []
    for i, (d, fw) in enumerate(chosen):
        extra_delay = (i // batch_size) * OTA_STAGE_BATCH_INTERVAL_SEC if batch_size else 0
        planned.append((d, fw, extra_delay))
    return planned
```

**灰度推进建议**：

```
第 1 次：POST /api/firmware/negotiate-all {"stage_percent": 10}    → 10% 设备
观察 30min，无异常
第 2 次：POST /api/firmware/negotiate-all {"stage_percent": 50}    → 50%
观察 30min
第 3 次：POST /api/firmware/negotiate-all {"stage_percent": 100}   → 全量
```

**分批错峰**：

```
POST /api/firmware/negotiate-all {"stage_percent": 100, "batch_size": 10}
→ 第 1 批（10 台）立即；
  第 2 批推迟 1 * OTA_STAGE_BATCH_INTERVAL_SEC；
  第 3 批推迟 2 * OTA_STAGE_BATCH_INTERVAL_SEC；...
```

### 4.6 推送抖动

`schedule_auto_push` 中：

```python
jitter = random.uniform(0, max(0, OTA_ROLLOUT_JITTER_SEC))     # 默认 0~30s
delay  = extra_delay + jitter
```

**目的**：避免数十台设备在同一秒集中下载，打满服务器带宽与 EMQX 连接。

---

## 五、OTA 指令格式

### 5.1 自动推送指令（`force: false`）

**Topic**：`phonebox/ota/{device_id}`  **QoS**：`1`

```json
{
  "action": "update",
  "timestamp": 1757680123,
  "id": 3,
  "url": "https://phonebox.example.com/api/firmware/download/3",
  "version": "1.2.3",
  "md5": "d41d8cd98f00b204e9800998ecf8427e",
  "is_mandatory": false,
  "force": false,
  "signature": "8f14e45fceea167a5a36dedd4bea2543c0f0a1b2..."
}
```

### 5.2 手动/批量推送指令（`force: true`）

**Topic**：`phonebox/ota/{device_id}`  **QoS**：`1`

```json
{
  "action": "update",
  "timestamp": 1757680123,
  "id": 3,
  "url": "https://phonebox.example.com/api/firmware/download/3",
  "download_url": "/api/firmware/download/3",
  "version": "1.2.3",
  "md5": "d41d8cd98f00b204e9800998ecf8427e",
  "is_mandatory": true,
  "force": true,
  "signature": "8f14e45fceea167a5a36dedd4bea2543c0f0a1b2..."
}
```

### 5.3 字段说明

| 字段 | 类型 | 自动推送 | 手动/批量 | 说明 |
|------|------|---------|----------|------|
| `action` | string | `"update"` | `"update"` | 固定（后端 `publish_ota_command` 自动补） |
| `timestamp` | int | ✅ | ✅ | Unix 秒（后端自动补） |
| `id` | int | ✅ | ✅ | `FirmwareVersion.id`（**参与签名**） |
| `url` | string | ✅ | ✅ | 绝对下载 URL（**参与签名**） |
| `download_url` | string | ❌ | ✅ | 相对路径（仅供展示/兜底） |
| `version` | string | ✅ | ✅ | 目标版本（**参与签名**） |
| `md5` | string | ✅ | ✅ | 固件 MD5 |
| `is_mandatory` | bool | ✅ | ✅ | 是否强制 |
| `force` | bool | **`false`** | **`true`** | 见 §5.4 |
| `signature` | string | ✅（若配置密钥） | ✅（若配置密钥） | HMAC-SHA256，见 §6 |

### 5.4 `force` 语义（设备侧判定）

| `force` | 语义 | 设备侧应有行为 |
|---------|------|--------------|
| `false` | **自动推送**（后端定时器发起） | 可**自行判断**是否方便升级（如正在服务中→推迟）；但仍受 `is_mandatory` 约束 |
| `true` | **管理员手动/批量下发** | **必须立即升级**，跳过一切本地推迟逻辑 |

**建议设备侧判定优先级**：

```
1. force == true     → 立即升级（无视其他条件）
2. is_mandatory      → 立即升级
3. force == false    → 检查本地条件（是否空闲、电量、是否在服务）
                       ├─ 满足 → 升级
                       └─ 不满足 → 上报 status="deferred"?? (见 §7.3 说明)
```

> ⚠️ 后端**不识别 `deferred` 状态**。若设备上报未知 status，`_process_ota_status` 不匹配任何分支，
> 既不置 `upgrading` 也不置 `failed`，`ota_status` 会停在 `pending` 直到冷却期后重试。
> **推荐**：设备侧不推迟，直接按 `force`/`is_mandatory` 执行；需要推迟就干脆**不升级且不上报**。

---

## 六、固件签名校验

### 6.1 签名算法

```python
# services/ota_negotiation_service.py
OTA_SIGNING_SECRET = (os.environ.get("OTA_SIGNING_SECRET", "") or "").strip()

def sign_ota_command(firmware, url):
    """对 OTA 指令生成 HMAC-SHA256 签名；未配置密钥返回空串（设备侧跳过校验）。"""
    if not OTA_SIGNING_SECRET:
        return ""
    msg = f"{firmware.id}:{firmware.version}:{url}"
    return hmac.new(
        OTA_SIGNING_SECRET.encode("utf-8"),
        msg.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
```

**签名内容（冒号分隔的字符串）**：

```
{firmware.id}:{firmware.version}:{url}
```

例：`3:1.2.3:https://phonebox.example.com/api/firmware/download/3`

**密钥**：环境变量 `OTA_SIGNING_SECRET`（**后端与设备侧必须一致**）

> ⚠️ **未配置密钥时，后端返回空串 `""`，`signature` 字段被省略**。
> 设备侧应实现「**有 signature 就校验，没有就跳过**」的宽容逻辑，
> 但**生产环境必须配置密钥**。

### 6.2 设备侧验签实现（mbedtls）

```cpp
#include <mbedtls/md.h>

// 与后端一致：signature 为 lowercase hex
bool verifyOtaSignature(const String& id, const String& version,
                        const String& url, const String& signature) {
  if (signature.length() == 0) {
    Serial.println("[OTA] 未携带签名（后端未配置密钥）→ 跳过验签");
    return true;                    // 宽容模式；生产应改为 return false
  }

  String msg = id + ":" + version + ":" + url;

  unsigned char hmac[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), 1);
  mbedtls_md_hmac_starts(&ctx, (const unsigned char*)OTA_SIGNING_SECRET,
                         strlen(OTA_SIGNING_SECRET));
  mbedtls_md_hmac_update(&ctx, (const unsigned char*)msg.c_str(), msg.length());
  mbedtls_md_hmac_finish(&ctx, hmac);
  mbedtls_md_free(&ctx);

  char hex[65];
  for (int i = 0; i < 32; i++) sprintf(hex + i * 2, "%02x", hmac[i]);
  hex[64] = 0;

  bool ok = (signature == String(hex));
  Serial.printf("[OTA] 验签 %s\n", ok ? "通过" : "失败");
  return ok;
}
```

> **密钥烧录建议**：编译期宏 `-D OTA_SIGNING_SECRET=\"...\"`，或存 NVS 加密分区。
> **不要**把密钥硬编码在会公开的源码里。

### 6.3 固件完整性校验（MD5）

下载完成后**必须**校验 MD5：

```cpp
#include <mbedtls/md5.h>
#include <Update.h>

bool verifyFirmwareMd5(const String& expectedMd5) {
  // 前提：固件已下载到临时缓冲/文件，遍历计算 MD5
  mbedtls_md5_context ctx;
  mbedtls_md5_init(&ctx);
  mbedtls_md5_starts(&ctx);
  // ... 对每个 chunk: mbedtls_md5_update(&ctx, buf, len);
  unsigned char out[16];
  mbedtls_md5_finish(&ctx, out);
  mbedtls_md5_free(&ctx);

  char hex[33];
  for (int i = 0; i < 16; i++) sprintf(hex + i * 2, "%02x", out[i]);
  hex[32] = 0;

  bool ok = (expectedMd5 == String(hex));
  if (!ok) Serial.printf("[OTA] MD5 不匹配 expected=%s actual=%s\n",
                         expectedMd5.c_str(), hex);
  return ok;
}
```

> **推荐做法**：使用 ESP32 `Update` 库的**流式写入 + 边收边算 MD5**，避免占用大块内存：
>
> ```cpp
> Update.begin(contentLength, U_FLASH);
> mbedtls_md5_starts(&ctx);
> while (stream.available() || remaining > 0) {
>   size_t n = stream.readBytes(buf, min((size_t)bufSize, remaining));
>   mbedtls_md5_update(&ctx, buf, n);
>   Update.write(buf, n);
>   remaining -= n;
>   if (total % 4096 == 0) reportProgress(total * 100 / contentLength);
> }
> mbedtls_md5_finish(&ctx, out);
> if (md5Matches(out)) Update.end(true); else Update.abort();
> ```

### 6.4 三层安全链

| 层 | 机制 | 防御目标 |
|----|------|---------|
| 1 | **MQTT 层** Broker 账号密码 | 未授权接入 |
| 2 | **指令层** HMAC-SHA256 签名 | **伪造 OTA 指令**（中间人推送恶意固件） |
| 3 | **固件层** MD5 | **传输损坏** / 下载被截断 |

> 固件下载端点 `GET /api/firmware/download/{id}` **是匿名的**，
> 安全性由「层 2 签名 + 层 3 MD5」保证（详见文档 02 §4.2）。

---

## 七、进度上报与状态处理

### 7.1 上报 topic

| Topic | 形式 |
|-------|------|
| `phonebox/ota/status` | 广播（payload 需带 `device_id`） |
| `phonebox/ota/{device_id}/status` | 定向 |

### 7.2 上报报文

```json
{
  "device_id": "pb7C9EBDA1F2C4",
  "status": "downloading",
  "from_version": "1.0.0",
  "to_version": "1.2.3",
  "progress": 45,
  "error_message": ""
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `device_id` | **是** | 定位设备 |
| `status` | **是** | 见 §7.3 |
| `from_version` | 建议 | 升级前版本 |
| `to_version` | 建议 | 目标版本（**必须与指令里的 `version` 一致**，否则 `completed`/`failed` 匹配不到 in_progress 记录） |
| `progress` | 否 | 0-100，当前仅落库展示 |
| `error_message` | 否 | 失败原因（强烈建议携带） |

### 7.3 status 取值与后端映射

| 设备上报 | 后端行为 |
|---------|---------|
| `started` | `device.ota_status = "upgrading"`；创建 `DeviceFirmwareUpdate(status="in_progress")` |
| `downloading` | `device.ota_status = "upgrading"` |
| `updating` | `device.ota_status = "upgrading"` |
| `success` / `completed` | 关闭 in_progress 记录 → `completed`；`device.fw_version = to_version`；`ota_status="idle"`；`last_ota_push_at=None`；写 OperationLog |
| **失败码全集**（见下） | `device.ota_status = "failed"`；记录 → `failed` + `error_message` |

**失败码全集**（`_OTA_FAILURE_STATUSES`，设备侧**必须**从中选择）：

```
failed
error
download_failed
space_insufficient
begin_failed
signature_failed
version_check_failed
resume_exhausted
incomplete
```

> 🔴 **必须使用上述枚举值**。原因（代码注释原文）：
> 原实现仅识别 `failed`/`error`，其余失败码不落 `failed`，
> 导致 `device.ota_status` 停在 `upgrading` → `can_auto_push` 永久拒绝 → **自动推送死锁**。
>
> **设备侧失败时请这样选**：
> | 设备侧失败原因 | 应上报 status |
> |--------------|--------------|
> | 下载 HTTP 失败 / 超时 | `download_failed` |
> | 分区空间不足 | `space_insufficient` |
> | `Update.begin()` 失败 | `begin_failed` |
> | HMAC 验签失败 | `signature_failed` |
> | MD5 校验失败 | `version_check_failed` |
> | 断点续传次数耗尽 | `resume_exhausted` |
> | 写入未完成 | `incomplete` |
> | 其他未分类 | `failed` |

### 7.4 上报时机（推荐）

| 时机 | status |
|------|--------|
| 验签通过、准备下载 | `started` |
| 每下载 10% | `downloading`（带 `progress`） |
| 开始写入 Flash | `updating` |
| MD5 通过、准备重启前 | 可再报一次 `updating` |
| 升级后首次启动成功 | `success`（带 `from_version` + `to_version`） |
| 任一环节失败 | 对应失败码 + `error_message` |

> ⚠️ **`success` 应在重启后上报**（而非重启前）。
> 因为重启前上报无法证明新固件能正常启动。
> 但需要注意：**后端把 `last_ota_push_at` 置 `None` 并 `ota_status="idle"`**，
> 若新固件启动后上报的 `from_version` 仍是旧版本，后端不会二次推送（因为 `fw_version` 已更新）。
> **推荐设备侧做法**：在 NVS 里记录 `pending_ota_from/to`，重启后读出来上报。

### 7.5 设备侧上报代码骨架

```cpp
void otaReport(const char* status, const char* fromV, const char* toV,
               int progress, const char* errMsg) {
  StaticJsonDocument<512> d;
  d["device_id"]     = DEVICE_ID;
  d["status"]        = status;
  d["from_version"]  = fromV;
  d["to_version"]    = toV;
  if (progress >= 0) d["progress"] = progress;
  if (errMsg && strlen(errMsg)) d["error_message"] = errMsg;

  String out; serializeJson(d, out);
  mqtt.publish("phonebox/ota/status", out.c_str(), /*retain=*/false);   // QoS1
}

// 使用
otaReport("started",     "1.0.0", "1.2.3", -1, "");
otaReport("downloading", "1.0.0", "1.2.3", 45, "");
otaReport("updating",    "1.0.0", "1.2.3", 100, "");
// ... 失败时
otaReport("download_failed", "1.0.0", "1.2.3", -1, "HTTP 404");
```

---

## 八、回滚机制

### 8.1 现状：⚠️ **系统没有服务端回滚机制**

**已实现**：

- ✅ 失败记录：`DeviceFirmwareUpdate(status="failed", error_message=...)`
- ✅ 失败冷却重试：`OTA_PUSH_COOLDOWN_SEC`（默认 600s）后可重新调度
- ✅ 失败码细分：9 种失败码，便于定位原因
- ✅ 手动重新推送：`POST /api/devices/{id}/ota-upgrade` 或 `POST /api/firmware/{id}/ota-upgrade`

**未实现**：

- ❌ **无 A/B 分区切换 / 回退指令**
- ❌ **无「回滚到上一个版本」的 API**
- ❌ **无设备端「启动失败自动回滚」的服务端配合逻辑**
- ❌ `FirmwareVersion` 无「稳定版本」标记，无法指示「回退到某版本」

### 8.2 设备侧必须自行实现的回滚（推荐方案）

ESP32 Arduino 提供 `esp_ota_get_state_partition` 与**回滚 API**，配合「自检 + 标记」实现：

```cpp
#include <esp_ota_ops.h>

// —— 步骤 1：设备升级后首次启动，标记「待确认」——
void markOtaPendingVerify() {
  const esp_partition_t* running = esp_ota_get_running_partition();
  esp_ota_img_states_t st;
  if (esp_ota_get_state_partition(running, &st) == ESP_OK) {
    if (st == ESP_OTA_IMG_PENDING_VERIFY) {
      Serial.println("[OTA] 新固件待验证，启动自检...");
      // 运行自检：WiFi 能连上？MQTT 能连上？外设正常？
      if (selfCheckPassed()) {
        esp_ota_mark_app_valid_cancel_rollback();
        otaReportSuccessAfterReboot();        // 上报 success
      } else {
        Serial.println("[OTA] 自检失败 → 回滚到上一版本");
        otaReport("version_check_failed", OLD_VER, NEW_VER, -1, "self-check failed");
        vTaskDelay(pdMS_TO_TICKS(1000));      // 给上报留时间
        esp_ota_mark_app_invalid_rollback_and_reboot();
      }
    }
  }
}

bool selfCheckPassed() {
  // 1. WiFi 连接成功
  if (WiFi.status() != WL_CONNECTED) return false;
  // 2. MQTT 连接成功
  if (!mqtt.connected()) return false;
  // 3. 关键外设（读卡器/锁）初始化成功
  if (!cardReaderOk() || !lockOk()) return false;
  return true;
}
```

**需要在 `platformio.ini` 开启**：

```ini
board_build.partitions = min_spiffs.csv    ; 或自定义带 app0/app1 双分区表
```

**双分区表要求**：`app0` 与 `app1` 各 ≥ 固件大小 ×1.2，否则 `Update.begin()` 会因空间不足失败。

### 8.3 手工回退到旧版本（当前可行方案）

由于后端无回滚 API，**只能靠「重新推送旧版本」实现**：

```bash
# 1. 把旧固件重新上传为 new active 版本（版本号必须比当前高，否则不会触发升级）
#    推荐命名：1.2.3 -> 1.2.4-rollback（但要注意 §4.1 禁非数字后缀）

# 正确做法：把稳定版本重新标记为 active，并把故障版本 is_active=False
curl -X PUT /api/firmware/versions/{bad_id}   -d '{"is_active": false}'
curl -X PUT /api/firmware/versions/{good_id}  -d '{"is_active": true}'

# 2. 手动推送给指定设备（force=true）
curl -X POST /api/devices/{id}/ota-upgrade \
     -d '{"firmware_url": "...", "version": "1.2.2", "force": true}'
```

> **限制**：`negotiate` 只在 `latest.version > reported_version` 时才推送。
> 若设备当前是 `1.2.3`（故障版），把让它回退到 `1.2.2` 会被判 `up_to_date` 而**拒绝**。
> 因此**必须走 `force: true` 的手动推送路径**（手动路径不经 `negotiate`）。
>
> 这是当前设计的**主要痛点**，优化方案见《06-差异同步与优化方案》§2。

### 8.4 推荐的回滚增强（自研方案）

```python
# 建议新增 FirmwareVersion 列
is_stable    = db.Column(db.Boolean, default=False)   # 标记为「稳定版本」
rollback_to  = db.Column(db.Integer, nullable=True)   # FK 到自身，指示回退目标

# 建议新增 API
POST /api/firmware/rollback
{
  "device_ids": ["pb7C9EBDA1F2C4"],
  "target_version": "1.2.2",
  "reason": "1.2.3 导致读卡器异常"
}
# 后端行为：构造 force=true 的指令（绕过 negotiate）+ 写 OperationLog + 标记 rollback 记录
```

完整实现步骤见《06-差异同步与优化方案》§2。

---

## 九、OTA 环境变量全表

| 环境变量 | 类型 | 默认值 | 说明 |
|---------|------|--------|------|
| `OTA_AUTO_PUSH_ENABLED` | bool | `true` | **全局自动推送总开关** |
| `OTA_PUSH_COOLDOWN_SEC` | int | `600` | 同设备最短重推间隔（秒） |
| `OTA_ROLLOUT_JITTER_SEC` | int | `30` | 滚动发布抖动上限（秒），错峰用 |
| `OTA_FIRMWARE_BASE_URL` | str | `""` | **公网可访问的后端基础 URL**（如 `https://phonebox.example.com`）。**未配置 → 自动推送中止** |
| `OTA_RESPECT_CLASS_TIME` | bool | `true` | 是否在上课时段静默（不自动推送） |
| `OTA_QUIET_WINDOWS` | str | `""` | 静默窗口，逗号分隔 `HH:MM-HH:MM`，支持跨午夜 |
| `OTA_STAGED_ROLLOUT` | bool | `false` | 是否启用灰度 |
| `OTA_STAGE_PERCENT` | int | `100` | 灰度百分比（`OTA_STAGED_ROLLOUT=true` 时生效） |
| `OTA_STAGE_BATCH_SIZE` | int | `0` | 分批大小（0 = 不分批） |
| `OTA_STAGE_BATCH_INTERVAL_SEC` | int | `60` | 批间隔（秒） |
| `OTA_SIGNING_SECRET` | str | `""` | **HMAC-SHA256 签名密钥**（后端与设备必须一致；空 = 两端都不校验） |

**生产推荐配置**：

```bash
export OTA_AUTO_PUSH_ENABLED=true
export OTA_FIRMWARE_BASE_URL=https://phonebox.example.com
export OTA_SIGNING_SECRET=<32+ 字节随机串>
export OTA_RESPECT_CLASS_TIME=true
export OTA_QUIET_WINDOWS=22:00-06:30
export OTA_PUSH_COOLDOWN_SEC=600
export OTA_ROLLOUT_JITTER_SEC=30
export OTA_STAGED_ROLLOUT=true
export OTA_STAGE_PERCENT=10            # 首次灰度 10%
export OTA_STAGE_BATCH_SIZE=10
export OTA_STAGE_BATCH_INTERVAL_SEC=60
```

> 🔴 **必须配置 `OTA_FIRMWARE_BASE_URL`**，否则 `_execute_push` 检测到 URL 不以 `http` 开头会
> **直接中止推送并把 `ota_status` 重置为 `idle`**。表现为「自动推送完全不动」。

---

## 十、OTA REST 管理接口

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/firmware/versions` | `device.view` | 固件版本列表（分页 50） |
| POST | `/api/firmware/versions` | `device.manage` | 创建版本记录（不含文件） |
| GET | `/api/firmware/versions/{id}` | `device.view` | 版本详情 |
| PUT | `/api/firmware/versions/{id}` | `device.manage` | 更新（`description`/`is_mandatory`/`is_active`） |
| DELETE | `/api/firmware/versions/{id}` | `device.manage` | 删除（**仅允许删除 inactive**） |
| POST | `/api/firmware/upload` | `device.manage` | **上传固件文件**（multipart，扩展名限 `bin`/`hex`/`fw`） |
| GET | `/api/firmware/download/{id}` | **匿名** | 下载固件（设备侧 HTTP GET） |
| GET | `/api/firmware/latest` | `view_devices` | 最新 active 固件信息 |
| GET | `/api/firmware/ota/check` | `view_devices` | **设备查更新**（`device_id` 未注册 → 401） |
| POST | `/api/firmware/ota/report` | `manage_devices` | **设备上报状态**（`started`/`completed`/`failed`） |
| GET | `/api/firmware/upgrade-records` | `device.view` | 升级记录（分页 20） |
| GET | `/api/firmware/ota-status` | `device.view` | OTA 汇总（`summary` + `in_progress` + `recent`） |
| POST | `/api/firmware/batch-upgrade` | `device.manage` | 批量升级（`target_version` 支持 `"latest"`，`force:true`） |
| POST | `/api/firmware/{id}/ota-upgrade` | `device.manage` | 指定固件 OTA 升级（`force:true`） |
| POST | `/api/firmware/negotiate-all` | `device.manage` | **触发全量协商扫描**（`stage_percent` / `batch_size`） |
| POST | `/api/devices/{id}/ota-upgrade` | — | 单设备 OTA（`firmware_url` + `version` + `force`） |
| POST | `/api/devices/ota-upgrade-all` | — | 全设备 OTA 广播 |
| POST | `/api/devices/bulk-ota-upgrade` | — | 多设备 OTA |

### 10.1 关键接口详解

**`GET /api/firmware/ota/check`**（设备侧可选调用，MQTT 之外的备用通道）

```
GET /api/firmware/ota/check?device_id=pb7C9EBDA1F2C4&current_version=1.0.0
```

**响应（有更新）**：

```json
{
  "has_update": true,
  "version": "1.2.3",
  "description": "修复读卡器偶发超时",
  "file_size": 1048576,
  "md5": "d41d8cd98f00b204e9800998ecf8427e",
  "download_url": "/api/firmware/download/3",
  "is_mandatory": false
}
```

**响应（无更新）**：`{"has_update": false, "message": "Already latest version"}`

**响应（版本过低）**：`{"has_update": false, "message": "Current version too old, need intermediate upgrade first"}`

**响应（设备未注册）**：HTTP **401**，`{"success": false, "message": "Device not registered"}`

> ⚠️ **注意**：本接口的 `_compare_versions` 是**独立实现**（朴素 `int(x)`，非数字会抛异常），
> 与 `ota_negotiation_service.compare_versions`（容错补 0）**不统一**。
> 详见《06-差异同步与优化方案》§9。

**`POST /api/firmware/negotiate-all`**（运维触发全量协商）

```json
{ "stage_percent": 10, "batch_size": 5 }
```

**响应**：

```json
{
  "success": true,
  "data": {
    "checked": 48,
    "eligible": 46,
    "scheduled": 5,
    "stage_percent": 10
  }
}
```

| 字段 | 含义 |
|------|------|
| `checked` | 扫描到的设备数（`fw_version` 非空） |
| `eligible` | 通过 `can_auto_push` 且 `negotiate` 判定可升级的设备数 |
| `scheduled` | **实际调度推送的设备数**（受 `stage_percent` 限制） |

### 10.2 上传固件

```bash
curl -X POST http://127.0.0.1:5000/api/firmware/upload \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -F "file=@firmware.bin" \
  -F "version=1.2.3" \
  -F "description=修复读卡器偶发超时" \
  -F "min_compatible_version=1.0.0" \
  -F "is_mandatory=false"
```

**后端行为**：

1. 扩展名校验（`bin` / `hex` / `fw`）
2. 版本号唯一性校验（重复 → 400）
3. 保存为 `firmware_{version}_{timestamp}.bin` 到 `uploads/firmware/`
4. **分块计算 MD5**（4KB chunk，避免大文件占内存）
5. 落库 `FirmwareVersion(is_active=True)`
6. 写 `OperationLog(operation_type="firmware_upload")`

**响应**：

```json
{
  "success": true,
  "message": "Firmware uploaded successfully",
  "firmware": {
    "id": 3,
    "version": "1.2.3",
    "file_size": 1048576,
    "md5": "d41d8cd98f00b204e9800998ecf8427e",
    "description": "修复读卡器偶发超时",
    "is_mandatory": false
  }
}
```

---

## 十一、设备侧 OTA 完整实现骨架

```cpp
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Update.h>
#include <Preferences.h>

static char g_otaFromVer[16];
static char g_otaToVer[16];

void handleOtaCommand(JsonDocument& doc) {
  const char* action = doc["action"] | "";
  if (strcmp(action, "update") != 0) return;

  const char* url        = doc["url"]        | "";
  const char* version    = doc["version"]    | "";
  const char* md5        = doc["md5"]        | "";
  bool        force      = doc["force"]      | false;
  bool        mandatory  = doc["is_mandatory"] | false;
  String      signature  = doc["signature"]  | "";
  String      fwId       = String((int)(doc["id"] | 0));

  // 1. 本地版本比对：已是目标版本则直接返回（防重复升级）
  if (strcmp(version, FW_VERSION) == 0) {
    Serial.println("[OTA] 已是目标版本，跳过");
    return;
  }

  // 2. 验签
  if (!verifyOtaSignature(fwId, String(version), String(url), signature)) {
    otaReport("signature_failed", FW_VERSION, version, -1, "HMAC mismatch");
    return;
  }

  // 3. force / is_mandatory 判定
  if (!force && !mandatory && !isIdleForUpgrade()) {
    Serial.println("[OTA] 非强制升级且当前不空闲 → 本次不升级（不上报）");
    return;
  }

  // 4. 记录待验证版本（重启后上报 success 用）
  Preferences prefs; prefs.begin("ota", false);
  prefs.putString("from", FW_VERSION);
  prefs.putString("to",   version);
  prefs.end();

  strncpy(g_otaFromVer, FW_VERSION, sizeof(g_otaFromVer) - 1);
  strncpy(g_otaToVer,   version,    sizeof(g_otaToVer) - 1);

  // 5. 上报 started
  otaReport("started", g_otaFromVer, g_otaToVer, -1, "");

  // 6. 下载 + 流式写 Flash + 同步算 MD5
  if (!downloadAndFlash(url, md5)) return;      // 内部会 otaReport 对应失败码

  // 7. 上报 updating，然后重启
  otaReport("updating", g_otaFromVer, g_otaToVer, 100, "");
  vTaskDelay(pdMS_TO_TICKS(800));
  ESP.restart();
}

bool downloadAndFlash(const char* url, const char* expectedMd5) {
  WiFiClientSecure client; client.setInsecure();
  HTTPClient http;
  http.begin(client, url);
  http.setTimeout(20000);
  int code = http.GET();
  if (code != HTTP_CODE_OK) {
    otaReport("download_failed", g_otaFromVer, g_otaToVer, -1,
              String("HTTP " + String(code)).c_str());
    http.end();
    return false;
  }

  int len = http.getSize();
  if (len <= 0) { otaReport("incomplete", g_otaFromVer, g_otaToVer, -1, "no content-length");
                  http.end(); return false; }

  if (!Update.begin(len, U_FLASH)) {
    otaReport("begin_failed", g_otaFromVer, g_otaToVer, -1,
              String("err=" + String(Update.getError())).c_str());
    http.end();
    return false;
  }

  mbedtls_md5_context ctx; mbedtls_md5_init(&ctx); mbedtls_md5_starts(&ctx);

  WiFiClient* stream = http.getStreamPtr();
  uint8_t buf[1024];
  int remaining = len, written = 0;
  while (remaining > 0) {
    size_t avail = stream->available();
    if (!avail) { vTaskDelay(pdMS_TO_TICKS(10)); continue; }
    size_t n = stream->readBytes(buf, min((size_t)sizeof(buf), (size_t)remaining));
    if (Update.write(buf, n) != n) {
      otaReport("incomplete", g_otaFromVer, g_otaToVer, -1, "flash write fail");
      Update.abort(); mbedtls_md5_free(&ctx); http.end(); return false;
    }
    mbedtls_md5_update(&ctx, buf, n);
    remaining -= n; written += n;
    if ((written % 8192) == 0)
      otaReport("downloading", g_otaFromVer, g_otaToVer, written * 100 / len, "");
  }

  unsigned char out[16]; mbedtls_md5_finish(&ctx, out); mbedtls_md5_free(&ctx);
  char hex[33]; for (int i = 0; i < 16; i++) sprintf(hex + i * 2, "%02x", out[i]); hex[32] = 0;

  if (strcmp(hex, expectedMd5) != 0) {
    otaReport("version_check_failed", g_otaFromVer, g_otaToVer, -1,
              String("MD5 " + String(hex)).c_str());
    Update.abort(); http.end(); return false;
  }

  if (!Update.end(true)) {
    otaReport("incomplete", g_otaFromVer, g_otaToVer, -1,
              String("end err=" + String(Update.getError())).c_str());
    http.end(); return false;
  }

  http.end();
  Serial.println("[OTA] 固件写入成功，MD5 校验通过");
  return true;
}

// 重启后自检 + 上报 success（配合 §8.2 回滚逻辑）
void otaPostBootCheck() {
  Preferences prefs; prefs.begin("ota", true);
  String fromV = prefs.getString("from", ""), toV = prefs.getString("to", "");
  prefs.end();
  if (toV.length() == 0) return;
  if (strcmp(toV.c_str(), FW_VERSION) != 0) return;   // 版本没变 → 升级未生效

  if (selfCheckPassed()) {
    otaReport("success", fromV.c_str(), toV.c_str(), -1, "");
    esp_ota_mark_app_valid_cancel_rollback();
    prefs.begin("ota", false); prefs.remove("from"); prefs.remove("to"); prefs.end();
  } else {
    otaReport("version_check_failed", fromV.c_str(), toV.c_str(), -1, "post-boot self-check failed");
    vTaskDelay(pdMS_TO_TICKS(1000));
    esp_ota_mark_app_invalid_rollback_and_reboot();
  }
}
```

---

## 十二、OTA 自检清单

- [ ] 版本号严格 `x.y.z` 纯数字，无 `v` 前缀、无 `-beta` 后缀
- [ ] 开机与每 30min 发送 `phonebox/ota/register`（带 `fw_version` + `device_type`）
- [ ] 订阅 `phonebox/ota/{device_id}` **且** 订阅广播 `phonebox/ota`
- [ ] 上报 `to_version` **与指令里的 `version` 逐字一致**
- [ ] 失败时使用 §7.3 的 **9 种失败码全集**之一（禁止自定义）
- [ ] 实现 HMAC-SHA256 验签（`{id}:{version}:{url}`，密钥与后端 `OTA_SIGNING_SECRET` 一致）
- [ ] 实现 MD5 流式校验（边下载边算，不占大内存）
- [ ] 分区表为**双 app 分区**（app0/app1），空间足够
- [ ] 实现 `esp_ota_mark_app_valid_cancel_rollback()` 自检确认
- [ ] 实现 `esp_ota_mark_app_invalid_rollback_and_reboot()` 自检失败回滚
- [ ] `force=true` 时立即升级（不推迟）
- [ ] 上报 `started` / `downloading` / `updating` / `success` 或失败码
- [ ] `success` 在**重启后自检通过**时上报（非重启前）
- [ ] NVS 记录 `pending_ota_from/to`，供重启后上报
- [ ] `Update.abort()` 在所有失败路径被调用（避免残留半包）

---

## 十三、相关文档

| 文档 | 内容 |
|------|------|
| 01-MQTT通信协议.md | 连接、topic、QoS、报文格式 |
| 02-设备识别与注册认证.md | device_id、注册、认证、固件下载匿名化 |
| 03-积分逻辑.md | 积分规则、扣分、限额 |
| 05-其他对接功能与多设备管理.md | 心跳、远程控制、告警、分组 |
| **06-差异同步与优化方案.md** | **无回滚机制、无 device_type 固件维度、版本比较双实现等** |
