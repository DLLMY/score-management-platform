# PhoneBox ESP32 OTA 远程升级指南

## 架构概览

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  GitHub      │     │  MQTT Broker │     │  ESP32      │     │  你的电脑    │
│  Releases    │     │  (EMQX云)    │     │  PhoneBox   │     │  (任意网络)  │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │                    │
       │  ① 上传 .bin       │                    │                    │
       │◄───────────────────┼────────────────────┼────────────────────┤
       │                    │                    │                    │
       │  ② 获取公网直链     │                    │                    │
       │────────────────────┼────────────────────┼───────────────────►│
       │                    │                    │                    │
       │                    │  ③ MQTT下发OTA指令  │                    │
       │                    │◄───────────────────┼────────────────────┤
       │                    │                    │                    │
       │                    │  ④ ESP32收到指令    │                    │
       │                    │───────────────────►│                    │
       │                    │                    │                    │
       │  ⑤ ESP32 HTTPS下载固件                  │                    │
       │◄───────────────────┼────────────────────┤                    │
       │                    │                    │                    │
       │  ⑥ 刷写完成，自动重启                    │                    │
       │                    │  ⑦ 上报进度/结果      │                    │
       │                    │◄───────────────────┤                    │
```

---

## 前置准备（仅需一次）

### 1. Python 环境
```powershell
# 确保 Python 已安装
python --version

# 安装依赖
cd tools
pip install -r requirements.txt
```

### 2. GitHub Personal Access Token
1. 访问 https://github.com/settings/tokens
2. 点击 **Generate new token (classic)**
3. 勾选 **repo** 权限
4. 点击 **Generate token**
5. 复制生成的 token

### 3. 创建 GitHub 仓库
1. 在 GitHub 上创建一个仓库（或使用已有仓库）
2. 仓库内只需有 Releases 功能，可以不提交代码

### 4. 配置脚本

编辑 `tools/ota_manager.py`，修改顶部配置：

```python
GITHUB_OWNER = "你的GitHub用户名"
GITHUB_REPO  = "你的仓库名"
```

> MQTT 配置已预设好，一般无需修改。

---

## 使用方法

### 方式一：一键完整升级（推荐）

```powershell
# 设置 GitHub Token（每次开终端都需要）
$env:GITHUB_TOKEN="ghp_你的token"

# 进入 tools 目录
cd tools

# 一键执行：上传固件 + 下发指令 + 监控进度
python ota_manager.py full --firmware ../phonebox/build/phonebox.ino.bin --version v2.6
```

输出示例：
```
╔══════════════════════════════════════╗
║   PhoneBox OTA 一键升级工具          ║
╚══════════════════════════════════════╝

[步骤 1/3] 上传固件到 GitHub Release
--------------------------------------------------
固件文件: ../phonebox/build/phonebox.ino.bin
文件大小: 1,234,567 字节 (1205.6 KB)
发布版本: v2.6

正在创建 GitHub Release...
正在上传固件文件 'phonebox.ino.bin' ...
上传成功！
GitHub Releases: https://github.com/xxx/xxx/releases/tag/v2.6
固件直链:        https://github.com/xxx/xxx/releases/download/v2.6/phonebox.ino.bin

[步骤 2/3] 通过 MQTT 下发升级指令
--------------------------------------------------
OTA指令已发送 → phonebox/ota

[步骤 3/3] 监控升级进度
--------------------------------------------------
[16:30:01] 📩 设备:phonebox_001 → command_received
[16:30:02] ⬇️ 设备:phonebox_001 downloading [██████████░░░░░░░░░░░░░░░░░░░░] 33%
[16:30:05] ⬇️ 设备:phonebox_001 downloading [███████████████████░░░░░░░░░░░] 66%
[16:30:08] ⬇️ 设备:phonebox_001 downloading [██████████████████████████████] 100%
[16:30:10] ✅ 设备:phonebox_001 → success

🎉 OTA 升级完成！设备将自动重启
```

### 方式二：分步执行

**步骤 1：编译并导出固件**

在 Arduino IDE 中：
- `项目` → `导出已编译的二进制文件`
- 固件生成在 `phonebox/build/phonebox.ino.bin`

**步骤 2：上传到 GitHub**

```powershell
$env:GITHUB_TOKEN="ghp_你的token"
python ota_manager.py upload --firmware ../phonebox/build/phonebox.ino.bin --version v2.6
```

**步骤 3：下发 OTA 指令**

```powershell
python ota_manager.py send --url "https://github.com/xxx/xxx/releases/download/v2.6/phonebox.ino.bin"
```

**步骤 4：监控进度**

```powershell
python ota_manager.py monitor
```

### 方式三：手动操作（无需脚本）

如果不方便用脚本，也可以手动完成：

**1. 上传固件**
- 打开 GitHub 仓库页面
- 点击 Releases → Draft a new release
- Tag 填 `v2.6`，上传 `.bin` 文件
- 发布后复制下载直链

**2. 发送 MQTT 指令**
用任意 MQTT 客户端（如 MQTTX）发送：

Topic: `phonebox/ota`
```json
{
  "action": "update",
  "url": "https://github.com/xxx/xxx/releases/download/v2.6/phonebox.ino.bin"
}
```

---

## 常见问题

### Q: GitHub Token 永久有效吗？
经典 token 可设无限期，推荐设置过期后定期更换。

### Q: 固件直链是永久有效的吗？
是的，GitHub Release 的下载链接是永久 CDN 直链。

### Q: 需要设备在同一局域网吗？
不需要。ESP32 从 GitHub CDN 下载，你的电脑只需能访问外网。

### Q: 升级失败怎么办？
ESP32 有双分区保护，写入失败会自动回滚到旧固件，设备正常运行不受影响。

### Q: 如何知道升级是否成功？
- 监控工具会显示 `✅ success`
- 设备重启后心跳包 `fw_version` 字段会变为新版本
- 你也可以直接发 `phonebox/heartbeat` 查看心跳包中的版本

---

## 文件说明

```
esp32/tools/
├── ota_manager.py    # OTA 管理工具主脚本
└── requirements.txt  # Python 依赖
```
