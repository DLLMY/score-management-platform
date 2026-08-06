# Arduino IDE 烧录指南

## 一、环境准备

### 1. 安装Arduino IDE

下载地址：https://www.arduino.cc/en/software

### 2. 安装ESP32开发板支持

1. 打开Arduino IDE
2. 文件 → 首选项 → 附加开发板管理器网址
3. 添加：`https://dl.espressif.com/dl/package_esp32_index.json`
4. 工具 → 开发板 → 开发板管理器
5. 搜索 `esp32`，安装 `ESP32 by Espressif Systems`

### 3. 安装所需库

打开 工具 → 管理库，搜索并安装以下库：

| 库名 | 版本 | 说明 |
|:---|:---|:---|
| LiquidCrystal I2C | 1.1.2 | LCD驱动 |
| PubSubClient | 2.8 | MQTT客户端 |
| Keypad | 3.5.0 | 键盘扫描 |

**内置库（无需安装）**：
- WiFi
- Wire
- EEPROM
- DNSServer
- WebServer
- ArduinoOTA
- Update
- HTTPClient

## 二、开发板配置

打开项目后，在 工具 菜单设置：

| 选项 | 设置值 |
|:---|:---|
| 开发板 | ESP32S3 Dev Module |
| Upload Speed | 115200 |
| USB Mode | Hardware CDC and JTAG |
| USB CDC On Boot | Enabled |
| Partition Scheme | Huge App (3MB No OTA) |
| Flash Mode | QIO 80MHz |
| Flash Size | 16MB |
| Core Debug Level | None |

## 三、烧录步骤

### 1. 打开项目

1. 打开Arduino IDE
2. 文件 → 打开
3. 选择 `doorlock.ino` 文件

### 2. 连接设备

1. ESP32-S3通过USB连接电脑
2. 工具 → 端口 → 选择对应的COM口

### 3. 编译上传

1. 点击 ✅ 验证按钮编译
2. 点击 ➡️ 上传按钮烧录

## 四、常见问题

### Q1: 编译报错找不到库

**解决**：确保已安装所有必需库，重启Arduino IDE

### Q2: 上传失败

**解决**：
1. 按住ESP32的BOOT键
2. 点击上传
3. 等待出现"Connecting..."后松开BOOT键

### Q3: LCD不显示

**解决**：
1. 检查I2C地址（默认0x27）
2. 使用I2C扫描程序确认地址
3. 修改 `config.h` 中的 `LCD_ADDR`

### Q4: WiFi连接失败

**解决**：
1. 长按GPIO15按键3秒进入配网模式
2. 重新配置WiFi参数

## 五、引脚连接图

```
ESP32-S3          外设
─────────────────────────────
GPIO4  ────────── 键盘R1
GPIO5  ────────── 键盘R2
GPIO6  ────────── 键盘R3
GPIO7  ────────── 键盘R4
GPIO8  ────────── 键盘C1
GPIO9  ────────── 键盘C2
GPIO10 ────────── 键盘C3
GPIO14 ────────── 继电器
GPIO21 ────────── LCD SDA
GPIO22 ────────── LCD SCL
GPIO16 ────────── RFID TX
GPIO17 ────────── RFID RX
GPIO25 ────────── 红色LED
GPIO26 ────────── 绿色LED
GPIO27 ────────── 蜂鸣器
GPIO15 ────────── 配网按键
```

## 六、测试步骤

1. 上电后应显示"配网模式"
2. 手机连接WiFi热点 `DoorLock-Config`
3. 配置WiFi和MQTT参数
4. 设备重启后显示"系统就绪"
5. 按 `*` 键测试密码输入
6. 刷卡测试开门功能