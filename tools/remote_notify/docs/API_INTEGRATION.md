# Remote Notify 前后端对接文档

> **版本：** 1.0  
> **日期：** 2026-06-18  
> **作者：** 开发团队

---

## 概述

本文档说明 remote_notify 客户端优化后的前后端对接方案。

---

## 对接清单

### ✅ 已完成
- [x] 后端API扩展（添加 `type` 字段支持）
- [x] 积分变化专用API (`/api/remote_notify/score_change`)
- [x] 客户端消息处理逻辑
- [x] MQTT消息格式统一

### 📋 待完成
- [ ] 前端API调用更新
- [ ] 上课时间配置API
- [ ] 声音配置API
- [ ] 前端测试验证

---

## API接口

### 1. 发送通知（已更新）

**接口：** `POST /api/remote_notify/send`

**请求体：**
```json
{
  "text": "通知内容",
  "type": "normal",           // 新增：通知类型
  "volume": 0.7,
  "speak": true,
  "popup": true,
  "timeout_sec": 8,
  "urgent": false,
  "topic": "phonebox/remote/notify"
}
```

**通知类型：**
- `normal` - 普通通知（默认）
- `score_change` - 积分变化通知
- `class_reminder` - 课程提醒

**响应：**
```json
{
  "success": true,
  "message": "通知指令已发送",
  "topic": "phonebox/remote/notify",
  "timestamp": "2026-06-18T22:30:00"
}
```

---

### 2. 积分变化通知（新增）

**接口：** `POST /api/remote_notify/score_change`

**请求体：**
```json
{
  "student_name": "张三",
  "score_change": 5,
  "reason": "课堂表现优秀",
  "course": "数学",
  "device_id": "remote_notify_host_1234567890"
}
```

**参数说明：**
| 参数 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| student_name | string | 是 | 学生姓名 |
| score_change | integer | 是 | 积分变化（正数加分，负数扣分） |
| reason | string | 是 | 变动原因 |
| course | string | 否 | 课程名称 |
| device_id | string | 否 | 指定设备ID，不指定则广播 |

**响应：**
```json
{
  "success": true,
  "message": "积分变化通知已发送: 张三 +5分",
  "topic": "phonebox/remote/notify",
  "timestamp": "2026-06-18T22:30:00"
}
```

---

### 3. 广播通知（已更新）

**接口：** `POST /api/remote_notify/broadcast`

**请求体：** 同发送通知

**说明：** 同时发送到多个主题：
- `phonebox/remote/notify`
- `phonebox/remote/notify/all`
- `remote/notify`

---

### 4. 指定设备通知（已更新）

**接口：** `POST /api/remote_notify/send_to_device/<device_id>`

**请求体：** 同发送通知

---

## MQTT消息格式

### 普通通知
```json
{
  "text": "这是一条通知",
  "type": "normal",
  "volume": 0.7,
  "speak": true,
  "popup": true,
  "timeout_sec": 8,
  "urgent": false,
  "timestamp": "2026-06-18T22:30:00"
}
```

### 积分变化通知
```json
{
  "type": "score_change",
  "text": "学生:张三, +5分, 原因:课堂表现优秀, 课程:数学",
  "popup": true,
  "timestamp": "2026-06-18T22:30:00"
}
```

---

## 客户端处理逻辑

### 通知类型路由

```python
def show_notification(message, timeout_sec, is_urgent, notification_type):
    """
    智能通知分发
    """
    # 1. 积分变化通知 -> 积分窗口
    if notification_type == 'score_change' and score_window:
        # 解析消息
        parts = message.split(',')
        student = reason = course = ''
        change = 0
        
        for part in parts:
            if '学生:' in part:
                student = part.split('学生:')[1]
            elif '分' in part and ('+' in part or '-' in part):
                change = int(part.replace('+', '').replace('-', '').replace('分', ''))
                if '-' in part:
                    change = -change
            elif '原因:' in part:
                reason = part.split('原因:')[1]
            elif '课程:' in part:
                course = part.split('课程:')[1]
        
        if student and change != 0:
            score_window.add_record(student, change, reason, course)
            return  # 积分窗口已处理，不需要弹窗
    
    # 2. 紧急通知且上课时间 -> 横幅
    if is_urgent and class_manager:
        if class_manager.should_silent_urgent():
            # 静音横幅
            banner_popup(message, timeout_sec, is_urgent=True)
            return
        elif class_manager.is_now_class_time():
            # 横幅 + 紧急音
            banner_popup(message, timeout_sec, is_urgent=True)
            sound_manager.play_sound(SoundType.URGENT)
            return
    
    # 3. 根据上课时间选择显示方式
    display_mode = class_manager.get_display_mode() if class_manager else 'fullscreen'
    
    if display_mode == 'banner':
        banner_popup(message, timeout_sec, is_urgent)
        sound_manager.play_sound(SoundType.NOTIFICATION)
    else:
        fullscreen_popup(message, timeout_sec, is_urgent)
        sound_manager.play_sound(SoundType.NOTIFICATION if not is_urgent else SoundType.URGENT)
```

---

## 前端集成

### 1. API调用更新

**发送积分变化通知：**
```typescript
// src/services/api.ts

export interface ScoreChangeNotify {
  student_name: string;
  score_change: number;
  reason: string;
  course?: string;
  device_id?: string;
}

export async function sendScoreChangeNotify(data: ScoreChangeNotify) {
  const response = await api.post('/api/remote_notify/score_change', data);
  return response.data;
}
```

**发送普通通知（支持类型）：**
```typescript
export interface RemoteNotify {
  text: string;
  type?: 'normal' | 'score_change' | 'class_reminder';
  volume?: number;
  speak?: boolean;
  popup?: boolean;
  timeout_sec?: number;
  urgent?: boolean;
  topic?: string;
}

export async function sendRemoteNotify(data: RemoteNotify) {
  const response = await api.post('/api/remote_notify/send', data);
  return response.data;
}
```

---

### 2. 前端页面更新

**RemoteNotify.tsx 添加积分变化通知功能：**
```typescript
// 发送积分变化通知
const handleScoreChange = async () => {
  try {
    await sendScoreChangeNotify({
      student_name: scoreForm.student,
      score_change: scoreForm.change,
      reason: scoreForm.reason,
      course: scoreForm.course
    });
    toast.success('积分变化通知已发送');
  } catch (error) {
    toast.error('发送失败');
  }
};
```

---

## 配置文件

### 客户端配置文件

**上课时间表 (`class_schedule.json`)**
```json
{
  "version": "1.0",
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

**声音配置 (`sound_config.json`)**
```json
{
  "version": "1.0",
  "volume": 70,
  "tts_enabled": true,
  "sounds": {
    "notification": {"file": "sounds/notification.wav", "enabled": true},
    "urgent": {"file": "sounds/urgent.wav", "enabled": true}
  }
}
```

---

## 测试验证

### 1. 后端API测试

```bash
# 测试普通通知
curl -X POST http://localhost:5000/api/remote_notify/send \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"text":"测试通知","type":"normal"}'

# 测试积分变化通知
curl -X POST http://localhost:5000/api/remote_notify/score_change \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"student_name":"张三","score_change":5,"reason":"课堂表现优秀"}'
```

### 2. 客户端测试

```bash
# 启动客户端
cd remote_notify
python mqtt_listener.py

# 观察日志输出
# - 积分窗口是否显示
# - 横幅通知是否正确显示
# - 声音是否正常播放
```

---

## 兼容性说明

### 向后兼容
- ✅ 旧版客户端仍然可以接收普通通知
- ✅ 新增的 `type` 字段为可选，默认为 `normal`
- ✅ 积分变化通知格式兼容旧版解析逻辑

### 版本要求
- **后端：** Flask 2.0+
- **前端：** React 18+
- **客户端：** Python 3.8+
- **MQTT：** paho-mqtt 1.6+

---

## 常见问题

### Q1: 积分变化通知没有显示？
**A:** 检查以下几点：
1. 客户端是否启动 `score_window.py`
2. MQTT消息格式是否正确（包含 `type: "score_change"`）
3. 消息格式是否符合：`学生:xxx, +5分, 原因:xxx, 课程:xxx`

### Q2: 上课时间检测不准确？
**A:** 检查 `class_schedule.json` 配置：
1. 时间格式是否为 `HH:MM`
2. 是否正确设置了工作日/周末课程表
3. 是否添加了节假日

### Q3: 横幅通知不显示？
**A:** 检查：
1. 当前时间是否在上课时间段
2. 通知策略配置是否正确
3. 客户端是否加载了 `class_schedule.py`

---

## 更新日志

### v1.0 (2026-06-18)
- ✅ 添加 `type` 字段支持通知类型
- ✅ 新增积分变化专用API
- ✅ 客户端智能通知分发
- ✅ 上课时间检测集成
- ✅ 声音管理器集成
- ✅ 横幅通知实现

---

## 后续计划

- [ ] 上课时间配置管理API
- [ ] 声音配置管理API
- [ ] 客户端状态监控API
- [ ] 批量积分变化通知
- [ ] 通知历史记录