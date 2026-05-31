# 固件版本记录

> 编译固件存放目录。每次编译后，将 `phonebox/build/phonebox.ino.bin` 复制到此目录并重命名以版本号。

## 目录结构

```
firmware/
├── README.md              # 本文件
├── phonebox_v2.5.bin      # 当前稳定版本
└── phonebox_vX.X.bin      # 历史版本（按需保留）
```

## 版本历史

| 版本 | 日期 | 大小 | 变更说明 | 状态 |
|------|------|------|----------|------|
| v2.5 | 2026-05-27 | - | +OTA远程升级 +ArduinoOTA | ✅ 当前 |
| v2.4 | - | - | 心跳包 + 状态机优化 | 📦 历史 |
| v2.0 | - | - | MQTT+RFID双箱系统 | 📦 历史 |

## 发布 OTA 升级

```powershell
# 1. Arduino IDE 编译导出固件后，复制到此目录
copy phonebox\build\phonebox.ino.bin firmware\phonebox_v2.6.bin

# 2. 使用工具上传
cd tools
python ota_manager.py full --firmware ../firmware/phonebox_v2.6.bin --version v2.6
```

## .gitignore 建议

固件文件较大，建议在 `.gitignore` 中添加：
```
firmware/*.bin
```
用 GitHub Releases 管理固件版本，不提交到仓库。
