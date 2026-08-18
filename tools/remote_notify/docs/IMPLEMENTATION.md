# Remote Notify 客户端优化实现文档

> **版本：** 2.0  
> **日期：** 2026-06-18  
> **作者：** 开发团队

---

## 目录

1. [概述](#概述)
2. [新功能模块](#新功能模块)
3. [文件结构](#文件结构)
4. [配置说明](#配置说明)
5. [API接口](#api接口)
6. [兼容性测试](#兼容性测试)
7. [常见问题](#常见问题)

---

## 概述

本文档描述 remote_notify 桌面客户端的三大优化功能：

1. **积分变化小窗口** - 右上角实时显示积分变化记录
2. **紧急通知横幅** - 上课时间使用横幅代替全屏通知
3. **声音美化** - 完善的声音管理和语音播报

---

## 新功能模块

### 1. 积分变化小窗口 (`score_window.py`)

#### 功能特性
- **窗口尺寸**：280-320px 宽度，350-450px 高度
- **窗口位置**：桌面右上角置顶
- **背景**：半透明（95%不透明度）
- **滚动显示**：Canvas + Scrollbar 实现流畅滚动
- **系统托盘**：最小化后托盘图标，右键菜单

#### 数据结构
```python
{
    'time': 'HH:MM:SS',           # 时间戳
    'student': '学生姓名',         # 学生姓名
    'change': 5,                  # 积分变动（正数加分，负数扣分）
    'reason': '变动原因',          # 变动原因
    'course': '课程名称',          # 课程名称（可选）
    'timestamp': 1234567890        # Unix时间戳（用于排序）
}
```

#### 消息格式
MQTT消息格式：
```json
{
    "type": "score_change",
    "text": "学生:张三, +5分, 原因:课堂表现优秀, 课程:数学",
    "popup": true
}
```

#### API
```python
from score_window import ScoreChangeWindow, get_instance

# 获取单例
window = get_instance()

# 添加积分记录
window.add_record('张三', 5, '课堂表现优秀', '数学')

# 清空记录
window.clear_records()

# 显示窗口
window.show()

# 最小化到托盘
window.hide_to_tray()
```

---

### 2. 上课时间管理 (`class_schedule.py`)

#### 功能特性
- **课程时间表**：支持工作日/周末分别配置
- **上课时间检测**：自动判断当前是否上课
- **通知策略**：根据时间自动选择显示方式
- **节假日/假期**：支持配置节假日和假期

#### 配置结构
```json
{
    "class_periods": [
        {"name": "第一节", "start": "08:00", "end": "08:45"},
        {"name": "第二节", "start": "08:55", "end": "09:40"}
    ],
    "notification_strategy": {
        "during_class": "banner",
        "between_classes": "popup",
        "after_hours": "fullscreen",
        "silent_urgent": true
    }
}
```

#### 通知策略
| 时间状态 | 显示方式 | 说明 |
|---------|---------|------|
| 上课时 | banner | 横幅通知，不遮挡内容 |
| 课间（10分钟内） | popup | 弹窗通知 |
| 放学后 | fullscreen | 全屏通知 |
| 紧急+上课 | banner | 横幅+静音 |

#### API
```python
from class_schedule import ClassScheduleManager, get_instance

# 获取单例
manager = get_instance()

# 检查当前是否上课
if manager.is_now_class_time():
    print(f"当前节次: {manager.get_current_period()}")

# 获取应使用的显示模式
mode = manager.get_display_mode()  # 'banner' | 'popup' | 'fullscreen'

# 检查紧急通知是否静音
if manager.should_silent_urgent():
    print("紧急通知将静音")
```

---

### 3. 横幅通知 (`notifier.py`)

#### 功能特性
- **尺寸**：屏幕宽度的85%，高度70px
- **位置**：顶部居中
- **滚动**：文本从右向左滚动，速度40字符/秒
- **自动关闭**：默认8秒，可配置
- **悬停效果**：鼠标悬停时半透明

#### 配色方案
| 类型 | 背景色 | 文字色 |
|-----|-------|-------|
| 普通通知 | #e74c3c | 白色 |
| 紧急通知 | #c0392b | 白色 |

---

### 4. 声音管理器 (`sound_manager.py`)

#### 功能特性
- **音量控制**：0-100%分级
- **声音类型**：7种内置声音类型
- **自定义音效**：支持添加自定义WAV文件
- **TTS语音**：中文语音播报

#### 声音类型
```python
SoundType.NOTIFICATION    # 通知音
SoundType.URGENT          # 紧急音
SoundType.SUCCESS         # 成功音
SoundType.WARNING         # 警告音
SoundType.REMINDER        # 提醒音
SoundType.SCORE_INCREASE  # 积分增加音
SoundType.SCORE_DECREASE  # 积分减少音
```

#### API
```python
from sound_manager import SoundManager, SoundType, get_instance

# 获取单例
manager = get_instance()

# 设置音量
manager.set_volume(50)  # 50%

# 播放声音
manager.play_sound(SoundType.NOTIFICATION)

# 语音播报
manager.speak("这是一条测试语音")

# TTS控制
manager.set_tts_enabled(False)  # 禁用TTS
manager.set_tts_rate(180)       # 设置语速
```

---

### 5. 样式配置 (`style_config.py`)

#### 颜色方案
```python
Colors.PRIMARY       # 主色调 #3498db
Colors.SUCCESS       # 成功色 #27ae60
Colors.WARNING       # 警告色 #f39c12
Colors.DANGER        # 危险色 #e74c3c
Colors.SCORE_POSITIVE  # 加分色 #27ae60
Colors.SCORE_NEGATIVE  # 扣分色 #e74c3c
```

#### 按钮样式
```python
from style_config import BUTTON_STYLES, apply_button_style

# 预定义样式
BUTTON_STYLES['primary']   # 蓝色主按钮
BUTTON_STYLES['success']   # 绿色成功按钮
BUTTON_STYLES['danger']    # 红色危险按钮
BUTTON_STYLES['warning']   # 橙色警告按钮
BUTTON_STYLES['outline']   # 轮廓按钮

# 应用样式
button = tk.Button(root, text="点击")
apply_button_style(button, 'primary')
```

---

## 文件结构

```
remote_notify/
├── notifier.py           # 核心通知模块
├── mqtt_listener.py      # MQTT监听器
├── score_window.py       # 积分变化小窗口
├── class_schedule.py     # 上课时间管理
├── sound_manager.py      # 声音管理器
├── style_config.py       # 样式配置
├── class_schedule.json   # 上课时间表配置
├── sound_config.json     # 声音配置
├── style_config.json     # 样式配置
├── requirements.txt      # Python依赖
├── install.bat           # 安装脚本
├── run_background.bat    # 后台运行脚本
├── check_status.bat      # 状态检查脚本
├── tests/                # 测试目录
│   ├── __init__.py
│   ├── test_score_window.py
│   ├── test_class_schedule.py
│   ├── test_sound_manager.py
│   └── test_style_config.py
└── docs/                  # 文档目录
    └── IMPLEMENTATION.md
```

---

## 配置说明

### 依赖安装

```bash
pip install paho-mqtt pyttsx3 pystray Pillow
```

### 环境变量

| 变量名 | 默认值 | 说明 |
|-------|-------|------|
| MQTT_BROKER | nc5233fc.ala.cn-hangzhou.emqxsl.cn | MQTT服务器 |
| MQTT_PORT | 8883 | MQTT端口 |
| MQTT_USERNAME | phoneboxtest | 用户名 |
| MQTT_PASSWORD | 123456 | 密码 |
| MQTT_SSL | true | 启用SSL |
| MQTT_TOPIC | phonebox/remote/notify | 订阅主题 |

### MQTT消息格式

#### 普通通知
```json
{
    "text": "这是一条通知消息",
    "popup": true,
    "speak": false,
    "urgent": false,
    "timeout_sec": 8
}
```

#### 积分变化通知
```json
{
    "type": "score_change",
    "text": "学生:张三, +5分, 原因:课堂表现优秀, 课程:数学",
    "popup": true
}
```

#### 紧急通知
```json
{
    "text": "紧急情况，请立即处理！",
    "urgent": true,
    "timeout_sec": 10
}
```

---

## 兼容性测试

### Windows 版本
| 版本 | 状态 | 备注 |
|-----|------|------|
| Windows 10 1903+ | ✓ | 正常 |
| Windows 10 1909 | ✓ | 正常 |
| Windows 11 | ✓ | 正常 |

### 分辨率测试
| 分辨率 | 状态 | 备注 |
|-------|------|------|
| 1920x1080 | ✓ | 正常 |
| 1366x768 | ✓ | 正常 |
| 2560x1440 | ✓ | 正常 |
| 3840x2160 | ✓ | 正常 |

### Python 版本
| 版本 | 状态 | 备注 |
|-----|------|------|
| Python 3.8 | ✓ | 正常 |
| Python 3.9 | ✓ | 正常 |
| Python 3.10 | ✓ | 正常 |
| Python 3.11 | ✓ | 正常 |

---

## 常见问题

### Q1: 托盘图标不显示？
**A:** 确保已安装 `pystray` 和 `Pillow`：
```bash
pip install pystray Pillow
```

### Q2: 声音无法播放？
**A:** 检查是否安装了 `winsound`（Windows内置）或配置了自定义音效文件。

### Q3: 窗口不置顶？
**A:** 确保调用了 `root.attributes('-topmost', True)`。

### Q4: 滚动速度太快/太慢？
**A:** 修改 `style_config.py` 中的 `Animation.SCROLL_NORMAL` 值，或修改 `banner_popup` 中的 `scroll_speed` 变量。

---

## 更新日志

### v2.0 (2026-06-18)
- 新增积分变化小窗口功能
- 新增上课时间检测和通知策略
- 新增横幅通知功能
- 优化声音管理器
- 完善样式配置
- 新增完整单元测试

---

## 许可证

本项目仅供内部使用。
