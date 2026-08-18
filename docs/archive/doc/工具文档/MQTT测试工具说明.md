# PhoneBox MQTT测试工具

用于测试ESP32手机管理箱的Web端MQTT测试工具。

## 功能特性

- 📡 MQTT连接管理（支持SSL/TLS WebSocket）
- 🔓 A箱远程开锁测试
- 🎯 B箱多种场景测试（成功/积分不足/卡号未注册）
- 📊 实时设备状态监控
- 📝 消息日志记录
- ✏️ 手动消息发布
- 🔄 一键重置配置

## 快速开始

### 方式一：直接打开（推荐）

1. 使用浏览器直接打开 `index.html` 文件
2. 如果显示旧配置，点击"🔄 重置配置"按钮
3. 点击"连接"按钮

### 方式二：使用本地服务器

```bash
# 进入工具目录
cd mqtt-test-tool

# 使用Python启动简易服务器
python -m http.server 8080

# 访问 http://localhost:8080
```

## 连接配置

| 参数 | 默认值 | 说明 |
|------|--------|------|
| 服务器地址 | nc5233fc.ala.cn-hangzhou.emqxsl.cn | MQTT服务器地址 |
| 端口 | 8084 | WebSocket over SSL端口 |
| SSL | ✅ 开启 | 使用加密连接 |
| 用户名 | phoneboxtest | MQTT认证用户名 |
| 密码 | 123456 | MQTT认证密码 |

### 端口说明

| 协议类型 | 端口 | 说明 |
|----------|------|------|
| MQTT/TCP | 1883 | 普通TCP连接（ESP32使用） |
| MQTT/TLS | 8883 | SSL/TLS加密（ESP32使用） |
| WebSocket | 8083 | 普通WebSocket（浏览器使用） |
| WebSocket/SSL | 8084 | SSL加密WebSocket（浏览器使用） |

**注意：ESP32使用8883端口，浏览器测试工具使用8084端口！**

## MQTT主题说明

### 发布主题（控制设备）
- `phonebox/unlock/A` - A箱远程开锁
- `phonebox/unlock/B` - B箱开锁指令

### 订阅主题（接收设备消息）
- `phonebox/status` - 门状态上报
- `phonebox/log` - 操作日志
- `phonebox/query` - 刷卡查询消息

## 使用说明

1. **连接MQTT服务器**
   - 点击"🔄 重置配置"确保使用最新配置
   - 点击"连接"按钮
   - 等待连接状态变为"已连接"

2. **测试A箱开锁**
   - 点击"开A箱"按钮
   - 观察设备响应和日志

3. **测试B箱开锁**
   - 点击对应按钮测试不同场景
   - 包括：成功、积分不足、卡号未注册

4. **手动发布消息**
   - 在手动发布区域输入主题和消息
   - 选择QoS级别
   - 点击"发布"按钮

## 常见问题

### 连接失败
1. 确认使用端口是 **8084**（不是8883）
2. 确认SSL已勾选
3. 尝试点击"🔄 重置配置"按钮
4. 检查浏览器控制台是否有错误

### 显示旧配置
- 点击"🔄 重置配置"按钮清除缓存
- 或按 `Ctrl+Shift+R` 强制刷新页面

## 技术栈

- HTML5
- CSS3 (响应式设计)
- JavaScript (ES6+)
- MQTT.js (通过CDN加载)

## 项目结构

```
mqtt-test-tool/
├── index.html    # 主页面
├── style.css     # 样式文件
├── app.js        # 应用逻辑
└── README.md     # 使用说明
```