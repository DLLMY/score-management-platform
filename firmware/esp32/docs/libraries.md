# ESP32手机管理箱 - 库文件说明

## 依赖库列表

| 库名 | 版本要求 | 来源/安装方式 | 用途 |
|------|----------|--------------|------|
| WiFi | 内置 | ESP32 Arduino Core | WiFi连接 |
| WebServer | 内置 | ESP32 Arduino Core | 网页服务器 |
| PubSubClient | ≥2.8.0 | Library Manager搜索"PubSubClient" | MQTT通信 |
| U8g2 | ≥2.35.0 | Library Manager搜索"U8g2" | OLED显示 |
| ArduinoJson | ≥6.21.0 | Library Manager搜索"ArduinoJson" | JSON解析 |
| EEPROM | 内置 | ESP32 Arduino Core | 配置存储 |

## 安装方法

### 方法1：Arduino库管理器（推荐）
1. 打开Arduino IDE
2. 点击 工具 -> 管理库
3. 搜索对应的库名并安装

### 方法2：手动安装
1. 从GitHub下载库源码zip包
2. 解压到 Arduino/libraries 目录
3. 重启Arduino IDE

## DX-NF01 RFID模块说明

本项目使用国产DX-NF01 13.56MHz RFID模块，模块特点：
- 工作电压：3.3V/5V兼容
- 通信接口：UART（TTL电平）
- 默认波特率：9600
- 通信协议：AT指令
- 支持协议：ISO14443A/B、ISO15693
- 详细资料：`../202507265960/DX-NF01资料包/`

## WiFiClientSecure
- 用途：支持MQTT SSL/TLS加密连接
- 状态：内置

## DNSServer
- 用途：Captive Portal自动弹窗配网
- 状态：内置
