# PhoneBox ESP32 手机管理箱

> 基于 ESP32 WROOM 32 的双箱手机管理系统

## 项目结构

```
esp32/
├── phonebox/                # Arduino 项目源码
│   └── phonebox.ino         #   主程序 (v2.5)
├── firmware/                # 编译固件归档
│   └── README.md            #   版本记录
├── tools/                   # OTA 升级工具
│   ├── ota_manager.py       #   固件上传+下发+监控
│   ├── requirements.txt     #   Python 依赖
│   └── OTA升级指南.md        #   详细使用文档
├── docs/                    # 开发文档
│   ├── 开发设计指南.md
│   ├── 开发总结.md
│   ├── 测试方案.md
│   ├── 硬件接线设计.md
│   └── libraries.md
└── README.md                # 本文件
```

## 快速开始

### 首次烧录
1. Arduino IDE 打开 `phonebox/phonebox.ino`
2. 选择开发板 `ESP32 Dev Module`
3. 分区方案选择 `Minimal SPIFFS`
4. USB 连线烧录

### 远程 OTA 升级
```powershell
cd tools
pip install -r requirements.txt
$env:GITHUB_TOKEN="你的token"
python ota_manager.py full --firmware ../firmware/phonebox_v2.6.bin --version v2.6
```

详见 [`tools/OTA升级指南.md`](tools/OTA升级指南.md)

## 核心功能

| 功能 | 说明 |
|------|------|
| A箱远程开锁 | MQTT 远程控制 |
| B箱刷卡验证 | RFID 刷卡 + 积分校验 |
| OLED 显示 | 实时状态显示 |
| 网页配网 | Captive Portal 自动弹窗 |
| 心跳上报 | 每 10s 上报设备状态 |
| OTA 升级 | MQTT 远程固件升级 |
| ArduinoOTA | 本地 WiFi 无线烧录 |

## 硬件

- MCU: ESP32 WROOM 32
- RFID: DX-NF01 (13.56MHz)
- 显示: SSD1306 128x64 OLED
- 继电器: 2路电磁锁控制
- LED/蜂鸣器: 状态提示
