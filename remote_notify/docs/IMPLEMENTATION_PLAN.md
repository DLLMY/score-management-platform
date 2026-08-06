# Remote Notify 客户端优化计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 对 remote_notify 桌面客户端进行三大优化：积分变化小窗口、紧急通知优化、美化设计

**Architecture:** 采用模块化设计，将通知窗口、积分窗口、上课时间检测分离为独立模块，通过事件驱动实现解耦

**Tech Stack:** Python tkinter, paho-mqtt, pyttsx3, SQLite

---

## 文件结构

```
remote_notify/
├── notifier.py           # 核心通知模块（修改）
├── mqtt_listener.py      # MQTT监听器（修改）
├── score_window.py       # 新增：积分变化小窗口
├── class_schedule.py     # 新增：上课时间管理
├── settings_manager.py    # 新增：设置管理器
├── style_config.py       # 新增：样式配置
├── sound_manager.py      # 新增：声音管理器
├── tests/                # 测试目录
│   ├── test_score_window.py
│   ├── test_class_schedule.py
│   └── test_sound_manager.py
└── docs/                 # 文档目录
    └── IMPLEMENTATION.md  # 实现文档
```

---

## 第一部分：积分变化小窗口

### Task 1: 创建积分窗口基础类

**Files:**
- Create: `remote_notify/score_window.py`
- Modify: `remote_notify/mqtt_listener.py:1-10`

- [ ] **Step 1: 创建 score_window.py 基础框架**

```python
import tkinter as tk
from tkinter import ttk
from datetime import datetime
import threading

class ScoreChangeWindow:
    """积分变化小窗口类"""
    
    def __init__(self, width=300, height=400):
        self.width = width
        self.height = height
        self.root = None
        self.records = []  # 积分记录列表
        self.is_minimized = False
        
    def create_window(self):
        """创建窗口"""
        self.root = tk.Tk()
        self.root.title("积分变化")
        self.root.geometry(f"{self.width}x{self.height}")
        self.root.attributes('-topmost', True)
        # 窗口置顶在右上角
        self._position_top_right()
        
    def _position_top_right(self):
        """将窗口定位到右上角"""
        screen_width = self.root.winfo_screenwidth()
        x = screen_width - self.width - 10
        y = 10
        self.root.geometry(f"{self.width}x{self.height}+{x}+{y}")
        
    def add_record(self, student_name, score_change, reason, course=""):
        """添加积分记录"""
        record = {
            'time': datetime.now().strftime("%H:%M:%S"),
            'student': student_name,
            'change': score_change,
            'reason': reason,
            'course': course
        }
        self.records.append(record)
        self._update_display()
        
    def _update_display(self):
        """更新显示"""
        pass  # TODO: 实现显示逻辑
        
    def show(self):
        """显示窗口"""
        if self.root:
            self.root.deiconify()
            self.is_minimized = False
            
    def hide_to_tray(self):
        """最小化到托盘"""
        if self.root:
            self.root.withdraw()
            self.is_minimized = True
            
    def run(self):
        """运行窗口"""
        self.create_window()
        self.root.mainloop()
```

- [ ] **Step 2: 在 mqtt_listener.py 中导入模块**

```python
# 在 mqtt_listener.py 顶部添加
try:
    from score_window import ScoreChangeWindow
    HAS_SCORE_WINDOW = True
except ImportError:
    HAS_SCORE_WINDOW = False
    print("[警告] 积分窗口模块未加载")
```

- [ ] **Step 3: 运行测试**

Run: `python -c "from score_window import ScoreChangeWindow; print('Import OK')"`
Expected: Import OK

---

### Task 2: 实现积分窗口UI和滚动显示

**Files:**
- Modify: `remote_notify/score_window.py`

- [ ] **Step 1: 添加 Canvas + Scrollbar 实现滚动**

```python
class ScoreChangeWindow:
    def __init__(self, width=300, height=400):
        # ... 现有代码 ...
        self._setup_ui()
        
    def _setup_ui(self):
        """设置UI组件"""
        # 标题栏
        title_frame = tk.Frame(self.root, bg='#3498db', height=40)
        title_frame.pack(fill='x')
        title_frame.pack_propagate(False)
        
        title_label = tk.Label(title_frame, text="积分变化记录",
                               font=('微软雅黑', 12, 'bold'),
                               bg='#3498db', fg='white')
        title_label.pack(side='left', padx=10)
        
        # 最小化按钮
        min_btn = tk.Button(title_frame, text="—", command=self.hide_to_tray,
                           bg='#3498db', fg='white', bd=0, font=('Arial', 12))
        min_btn.pack(side='right', padx=5)
        
        # 关闭按钮
        close_btn = tk.Button(title_frame, text="×", command=self.root.destroy,
                             bg='#e74c3c', fg='white', bd=0, font=('Arial', 12))
        close_btn.pack(side='right', padx=5)
        
        # 主内容区域 - Canvas + Scrollbar
        self.canvas = tk.Canvas(self.root, bg='#ecf0f1', highlightthickness=0)
        self.scrollbar = ttk.Scrollbar(self.root, orient='vertical',
                                        command=self.canvas.yview)
        self.content_frame = tk.Frame(self.canvas, bg='#ecf0f1')
        
        self.canvas.configure(yscrollcommand=self.scrollbar.set)
        self.scrollbar.pack(side='right', fill='y')
        self.canvas.pack(side='left', fill='both', expand=True)
        
        self.canvas_window = self.canvas.create_window((0, 0), 
                                                        window=self.content_frame,
                                                        anchor='nw')
        
        # 配置滚动区域
        self.content_frame.bind('<Configure>', self._on_frame_configure)
        self.canvas.bind('<Configure>', self._on_canvas_configure)
        
        # 半透明背景
        self.root.attributes('-alpha', 0.95)
        
    def _on_frame_configure(self, event=None):
        """更新滚动区域"""
        self.canvas.configure(scrollregion=self.canvas.bbox('all'))
        
    def _on_canvas_configure(self, event):
        """当Canvas大小改变时"""
        self.canvas.itemconfig(self.canvas_window, width=event.width)
        
    def _update_display(self):
        """更新积分记录显示"""
        # 清除现有显示
        for widget in self.content_frame.winfo_children():
            widget.destroy()
            
        # 显示今天的日期
        today = datetime.now().strftime("%Y年%m月%d日")
        date_label = tk.Label(self.content_frame, text=today,
                             font=('微软雅黑', 9),
                             bg='#ecf0f1', fg='#7f8c8d')
        date_label.pack(pady=(5, 10))
        
        # 逐条显示积分记录
        for record in self.records:
            self._create_record_card(record)
            
    def _create_record_card(self, record):
        """创建单条记录卡片"""
        card = tk.Frame(self.content_frame, bg='white', relief='raised', bd=1)
        card.pack(fill='x', padx=5, pady=3)
        
        # 时间
        time_label = tk.Label(card, text=record['time'],
                            font=('Arial', 9),
                            bg='white', fg='#95a5a6')
        time_label.pack(anchor='w', padx=8, pady=(5, 0))
        
        # 积分变化（带颜色）
        change_color = '#27ae60' if record['change'] > 0 else '#e74c3c'
        change_text = f"+{record['change']}" if record['change'] > 0 else str(record['change'])
        change_label = tk.Label(card, text=change_text,
                               font=('Arial', 16, 'bold'),
                               fg=change_color, bg='white')
        change_label.pack(anchor='w', padx=8)
        
        # 学生姓名
        name_label = tk.Label(card, text=record['student'],
                             font=('微软雅黑', 10, 'bold'),
                             bg='white', fg='#2c3e50')
        name_label.pack(anchor='w', padx=8)
        
        # 变动原因
        reason_label = tk.Label(card, text=record['reason'],
                              font=('微软雅黑', 9),
                              bg='white', fg='#34495e',
                              wraplength=250, justify='left')
        reason_label.pack(anchor='w', padx=8, pady=(0, 5))
        
        # 课程信息（如果有）
        if record.get('course'):
            course_label = tk.Label(card, text=f"📚 {record['course']}",
                                  font=('微软雅黑', 8),
                                  bg='#f8f9fa', fg='#6c757d')
            course_label.pack(anchor='w', padx=8, pady=(0, 5))
```

- [ ] **Step 2: 测试滚动功能**

```bash
# 启动测试
python -c "
from score_window import ScoreChangeWindow
from datetime import datetime
import threading

window = ScoreChangeWindow()

# 添加测试数据
for i in range(20):
    window.add_record(
        student_name=f'学生{i+1}',
        score_change=5 if i % 2 == 0 else -3,
        reason='课堂表现优秀' if i % 2 == 0 else '迟到',
        course='数学'
    )

# 在新线程中运行
threading.Thread(target=window.run, daemon=True).start()
input('按回车结束...')
"
```

---

### Task 3: 系统托盘集成

**Files:**
- Modify: `remote_notify/score_window.py`

- [ ] **Step 1: 添加系统托盘支持**

```python
# 需要安装 pystray 和 Pillow
# pip install pystray Pillow

from pystray import Icon, Menu, MenuItem
from PIL import Image, ImageDraw

class ScoreChangeWindow:
    def __init__(self, width=300, height=400):
        # ... 现有代码 ...
        self.tray_icon = None
        
    def _create_tray_icon(self):
        """创建托盘图标"""
        # 创建图标图像
        width, height = 64, 64
        image = Image.new('RGB', (width, height), color='#3498db')
        draw = ImageDraw.Draw(image)
        draw.ellipse([8, 8, 56, 56], fill='white')
        draw.text((20, 20), '📊', fill='#3498db')
        
        menu = Menu(
            MenuItem('显示窗口', lambda: self.show()),
            MenuItem('清空记录', lambda: self.clear_records()),
            MenuItem('退出', lambda: self.quit_app())
        )
        
        self.tray_icon = Icon('score_tracker', image, '积分追踪', menu)
        
    def hide_to_tray(self):
        """最小化到托盘"""
        self.root.withdraw()
        self.is_minimized = True
        if not self.tray_icon:
            self._create_tray_icon()
        # 在新线程中运行托盘图标
        threading.Thread(target=self.tray_icon.run, daemon=True).start()
        
    def show(self):
        """从托盘恢复窗口"""
        if self.tray_icon and self.tray_icon.visible:
            self.tray_icon.stop()
        self.root.deiconify()
        self.is_minimized = False
        
    def clear_records(self):
        """清空记录"""
        self.records = []
        self._update_display()
        
    def quit_app(self):
        """退出应用"""
        if self.tray_icon:
            self.tray_icon.stop()
        self.root.quit()
```

---

## 第二部分：紧急通知优化

### Task 4: 上课时间检测模块

**Files:**
- Create: `remote_notify/class_schedule.py`
- Modify: `remote_notify/mqtt_listener.py`

- [ ] **Step 1: 创建上课时间管理类**

```python
import json
import os
from datetime import datetime, time

class ClassScheduleManager:
    """上课时间管理器"""
    
    def __init__(self, config_path='class_schedule.json'):
        self.config_path = config_path
        self.schedule = self._load_schedule()
        self.is_class_time = False
        self.current_class = None
        
    def _load_schedule(self):
        """加载日程配置"""
        default_schedule = {
            'schedule_type': 'weekday',  # weekday, custom
            'class_periods': [
                {'name': '第一节', 'start': '08:00', 'end': '08:45'},
                {'name': '第二节', 'start': '08:55', 'end': '09:40'},
                {'name': '第三节', 'start': '10:00', 'end': '10:45'},
                {'name': '第四节', 'start': '10:55', 'end': '11:40'},
                {'name': '午休', 'start': '11:40', 'end': '14:00'},
                {'name': '第五节', 'start': '14:00', 'end': '14:45'},
                {'name': '第六节', 'start': '14:55', 'end': '15:40'},
                {'name': '第七节', 'start': '16:00', 'end': '16:45'},
                {'name': '第八节', 'start': '16:55', 'end': '17:40'},
            ],
            'weekends': {'saturday': [], 'sunday': []},
            'holidays': []  # 节假日列表
        }
        
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                pass
        return default_schedule
        
    def save_schedule(self):
        """保存日程配置"""
        with open(self.config_path, 'w', encoding='utf-8') as f:
            json.dump(self.schedule, f, ensure_ascii=False, indent=2)
            
    def is_now_class_time(self):
        """检查当前是否处于上课时间"""
        now = datetime.now()
        
        # 检查是否周末
        if now.weekday() >= 5:
            return False
            
        # 检查是否节假日
        today_str = now.strftime('%Y-%m-%d')
        if today_str in self.schedule.get('holidays', []):
            return False
            
        # 检查是否上课时间
        current_time = now.time()
        for period in self.schedule.get('class_periods', []):
            try:
                start = datetime.strptime(period['start'], '%H:%M').time()
                end = datetime.strptime(period['end'], '%H:%M').time()
                if start <= current_time <= end:
                    self.current_class = period['name']
                    self.is_class_time = True
                    return True
            except:
                continue
                
        self.is_class_time = False
        self.current_class = None
        return False
        
    def get_current_period(self):
        """获取当前课程节次"""
        if self.is_now_class_time():
            return self.current_class
        return None
```

- [ ] **Step 2: 在 mqtt_listener 中集成**

```python
# mqtt_listener.py 添加
try:
    from class_schedule import ClassScheduleManager
    class_manager = ClassScheduleManager()
    print("[上课时间] 日程管理器已初始化")
except ImportError:
    class_manager = None
    print("[警告] 上课时间模块未加载")

def on_message(client, userdata, msg):
    # ... 现有代码 ...
    
    is_class_time = False
    if class_manager:
        is_class_time = class_manager.is_now_class_time()
        if is_class_time:
            print(f"[上课时间] 当前处于{class_manager.get_current_period()}")
    
    # 紧急通知且上课时间 -> 不全屏显示
    if is_urgent and is_class_time:
        banner_popup(text, timeout_sec)
    elif popup:
        fullscreen_popup(text, timeout_sec, is_urgent)
```

---

### Task 5: 横幅通知实现

**Files:**
- Modify: `remote_notify/notifier.py`

- [ ] **Step 1: 添加横幅通知函数**

```python
def banner_popup(message: str, timeout_sec: int = 8):
    """上课时间的横幅通知（不上全屏）"""
    def _banner():
        root = tk.Tk()
        
        # 获取屏幕宽度
        screen_width = root.winfo_screenwidth()
        banner_width = int(screen_width * 0.85)  # 85% 宽度
        banner_height = 70
        
        # 窗口置顶无边框
        root.overrideredirect(True)
        root.attributes('-topmost', True)
        root.geometry(f"{banner_width}x{banner_height}+{int((screen_width-banner_width)/2)}+0")
        
        # 紧急通知配色
        bg_color = '#e74c3c'
        text_color = 'white'
        
        root.configure(bg=bg_color)
        
        # 主容器
        main_frame = tk.Frame(root, bg=bg_color)
        main_frame.pack(fill='both', expand=True, padx=15, pady=10)
        
        # 警告图标
        icon_label = tk.Label(main_frame, text='🚨',
                             font=('Arial', 20),
                             bg=bg_color, fg=text_color)
        icon_label.pack(side='left', padx=(0, 10))
        
        # 滚动文本框
        text_frame = tk.Frame(main_frame, bg=bg_color)
        text_frame.pack(side='left', fill='both', expand=True)
        
        canvas = tk.Canvas(text_frame, bg=bg_color, highlightthickness=0,
                         width=banner_width - 100, height=50)
        canvas.pack()
        
        text_item = canvas.create_text(0, 25, text=message,
                                      font=('微软雅黑', 18, 'bold'),
                                      fill=text_color, anchor='w')
        
        # 滚动动画
        scroll_speed = 40  # 字符/秒
        char_width = 12  # 每字符宽度估算
        
        def scroll_text():
            current_pos = canvas.coords(text_item)[0]
            text_width = canvas.bbox(text_item)[2]
            
            if current_pos < -text_width:
                canvas.move(text_item, banner_width, 0)
            else:
                pixels_per_frame = (char_width * scroll_speed) / 60  # 60fps
                canvas.move(text_item, -pixels_per_frame, 0)
                
            root.after(16, scroll_text)  # ~60fps
            
        scroll_text()
        
        # 关闭按钮
        close_btn = tk.Button(main_frame, text='×',
                            command=root.destroy,
                            bg=bg_color, fg=text_color,
                            font=('Arial', 20, 'bold'),
                            bd=0, padx=10)
        close_btn.pack(side='right')
        
        # 自动关闭
        root.after(timeout_sec * 1000, root.destroy)
        root.mainloop()
        
    threading.Thread(target=_banner, daemon=True).start()
```

---

## 第三部分：美化设计

### Task 6: 声音管理器

**Files:**
- Create: `remote_notify/sound_manager.py`
- Modify: `remote_notify/notifier.py`

- [ ] **Step 1: 创建声音管理器**

```python
import json
import os
import winsound
from enum import Enum

class SoundType(Enum):
    """声音类型枚举"""
    NOTIFICATION = "notification"      # 通知音
    URGENT = "urgent"                  # 紧急音
    SUCCESS = "success"                # 成功音
    WARNING = "warning"                # 警告音
    REMINDER = "reminder"              # 提醒音

class SoundManager:
    """声音管理器"""
    
    def __init__(self, config_path='sound_config.json'):
        self.config_path = config_path
        self.config = self._load_config()
        self.volume = self.config.get('volume', 70)  # 默认70%
        
    def _load_config(self):
        """加载声音配置"""
        default_config = {
            'volume': 70,
            'sounds': {
                SoundType.NOTIFICATION.value: {
                    'file': 'sounds/notification.wav',
                    'enabled': True
                },
                SoundType.URGENT.value: {
                    'file': 'sounds/urgent.wav',
                    'enabled': True
                },
                SoundType.SUCCESS.value: {
                    'file': 'sounds/success.wav',
                    'enabled': True
                },
                SoundType.WARNING.value: {
                    'file': 'sounds/warning.wav',
                    'enabled': True
                },
                SoundType.REMINDER.value: {
                    'file': 'sounds/reminder.wav',
                    'enabled': True
                }
            },
            'tts_enabled': True,
            'custom_sounds': []
        }
        
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                pass
        return default_config
        
    def save_config(self):
        """保存声音配置"""
        with open(self.config_path, 'w', encoding='utf-8') as f:
            json.dump(self.config, f, ensure_ascii=False, indent=2)
            
    def set_volume(self, level: int):
        """
        设置音量 (0-100)
        """
        self.volume = max(0, min(100, level))
        self.config['volume'] = self.volume
        self.save_config()
        
    def play_sound(self, sound_type: SoundType):
        """播放指定类型的声音"""
        if not self.config['sounds'].get(sound_type.value, {}).get('enabled', True):
            return
            
        sound_file = self.config['sounds'][sound_type.value]['file']
        
        if not os.path.exists(sound_file):
            # 使用系统默认音效
            self._play_system_sound(sound_type)
            return
            
        # 使用 winsound 播放 WAV 文件
        try:
            winsound.PlaySound(sound_file, winsound.SND_FILENAME)
        except Exception as e:
            print(f"[声音] 播放失败: {e}")
            self._play_system_sound(sound_type)
            
    def _play_system_sound(self, sound_type: SoundType):
        """播放系统默认音效"""
        sound_map = {
            SoundType.NOTIFICATION: winsound.MB_ICONASTERISK,
            SoundType.URGENT: winsound.MB_ICONHAND,
            SoundType.SUCCESS: winsound.MB_ICONASTERISK,
            SoundType.WARNING: winsound.MB_ICONEXCLAMATION,
            SoundType.REMINDER: winsound.MB_ICONASTERISK
        }
        
        flags = sound_map.get(sound_type, winsound.MB_OK)
        winsound.MessageBeep(flags)
        
    def add_custom_sound(self, name: str, file_path: str):
        """添加自定义音效"""
        if os.path.exists(file_path):
            self.config['custom_sounds'].append({
                'name': name,
                'file': file_path
            })
            self.save_config()
            
    def get_volume(self) -> int:
        """获取当前音量"""
        return self.volume
```

- [ ] **Step 2: 集成到 notifier.py**

```python
# notifier.py 顶部添加
try:
    from sound_manager import SoundManager, SoundType
    sound_manager = SoundManager()
except ImportError:
    sound_manager = None

def fullscreen_popup(message: str, timeout_sec: int = 8, is_urgent: bool = False):
    # ... 现有代码 ...
    
    # 播放对应音效
    if sound_manager:
        if is_urgent:
            sound_manager.play_sound(SoundType.URGENT)
        else:
            sound_manager.play_sound(SoundType.NOTIFICATION)
```

---

### Task 7: 样式配置统一管理

**Files:**
- Create: `remote_notify/style_config.py`

- [ ] **Step 1: 创建样式配置**

```python
"""
统一样式配置
"""

# 颜色方案
class Colors:
    # 主色调
    PRIMARY = '#3498db'           # 蓝色
    PRIMARY_DARK = '#2980b9'     # 深蓝
    PRIMARY_LIGHT = '#5dade2'    # 浅蓝
    
    # 功能色
    SUCCESS = '#27ae60'          # 绿色
    WARNING = '#f39c12'          # 橙色
    DANGER = '#e74c3c'           # 红色
    INFO = '#3498db'             # 蓝色
    
    # 中性色
    WHITE = '#ffffff'
    BLACK = '#000000'
    GRAY_100 = '#f8f9fa'
    GRAY_200 = '#e9ecef'
    GRAY_300 = '#dee2e6'
    GRAY_400 = '#ced4da'
    GRAY_500 = '#adb5bd'
    GRAY_600 = '#6c757d'
    GRAY_700 = '#495057'
    GRAY_800 = '#343a40'
    GRAY_900 = '#212529'
    
    # 背景色
    BG_LIGHT = '#ecf0f1'
    BG_DARK = '#2c3e50'
    
    # 文字色
    TEXT_PRIMARY = '#2c3e50'
    TEXT_SECONDARY = '#7f8c8d'
    TEXT_LIGHT = '#ecf0f1'

# 字体配置
class Fonts:
    TITLE = ('微软雅黑', 24, 'bold')
    SUBTITLE = ('微软雅黑', 18, 'bold')
    BODY = ('微软雅黑', 12)
    BODY_BOLD = ('微软雅黑', 12, 'bold')
    SMALL = ('微软雅黑', 10)
    MONO = ('Consolas', 10)

# 间距配置
class Spacing:
    XS = 4
    SM = 8
    MD = 16
    LG = 24
    XL = 32

# 动画配置
class Animation:
    FADE_DURATION = 200  # 毫秒
    SCROLL_SPEED = 40    # 字符/秒
    HOVER_DURATION = 150  # 毫秒

# 窗口配置
class WindowConfig:
    # 积分窗口
    SCORE_WINDOW_WIDTH = 300
    SCORE_WINDOW_HEIGHT = 400
    SCORE_WINDOW_ALPHA = 0.95
    
    # 横幅通知
    BANNER_WIDTH_RATIO = 0.85  # 屏幕宽度的85%
    BANNER_HEIGHT = 70
    
    # 全屏通知
    FULLSCREEN_TIMEOUT = 8
    FULLSCREEN_BG = '#2c3e50'
    FULLSCREEN_TEXT_SIZE = 48

# 快捷样式字典
BUTTON_STYLE = {
    'font': Fonts.BODY_BOLD,
    'relief': 'raised',
    'borderwidth': 2,
    'cursor': 'hand2',
    'padx': 15,
    'pady': 8
}

CARD_STYLE = {
    'relief': 'raised',
    'borderwidth': 1,
    'bg': Colors.WHITE
}
```

---

## 测试计划

### Task 8: 单元测试

**Files:**
- Create: `remote_notify/tests/test_score_window.py`
- Create: `remote_notify/tests/test_class_schedule.py`
- Create: `remote_notify/tests/test_sound_manager.py`

- [ ] **Step 1: 测试积分窗口**

```python
# tests/test_score_window.py
import pytest
import sys
sys.path.insert(0, '..')
from score_window import ScoreChangeWindow

def test_add_record():
    window = ScoreChangeWindow()
    initial_count = len(window.records)
    
    window.add_record(
        student_name='测试学生',
        score_change=5,
        reason='测试原因',
        course='测试课程'
    )
    
    assert len(window.records) == initial_count + 1
    assert window.records[-1]['student'] == '测试学生'
    assert window.records[-1]['change'] == 5

def test_clear_records():
    window = ScoreChangeWindow()
    window.add_record('学生1', 5, '原因1')
    window.add_record('学生2', -3, '原因2')
    
    window.clear_records()
    assert len(window.records) == 0
```

- [ ] **Step 2: 测试上课时间检测**

```python
# tests/test_class_schedule.py
import pytest
import sys
sys.path.insert(0, '..')
from class_schedule import ClassScheduleManager
from datetime import datetime

def test_load_schedule():
    manager = ClassScheduleManager()
    assert manager.schedule is not None
    assert 'class_periods' in manager.schedule

def test_is_class_time():
    manager = ClassScheduleManager()
    # 测试当前时间是否在上课时间段内
    result = manager.is_now_class_time()
    assert isinstance(result, bool)
```

- [ ] **Step 3: 测试声音管理器**

```python
# tests/test_sound_manager.py
import pytest
import sys
sys.path.insert(0, '..')
from sound_manager import SoundManager, SoundType

def test_volume_control():
    manager = SoundManager()
    
    manager.set_volume(50)
    assert manager.get_volume() == 50
    
    manager.set_volume(150)  # 超出范围
    assert manager.get_volume() == 100
    
    manager.set_volume(-10)   # 超出范围
    assert manager.get_volume() == 0
```

---

## 实现文档

### Task 9: 编写实现文档

**Files:**
- Create: `remote_notify/docs/IMPLEMENTATION.md`

```markdown
# Remote Notify 客户端优化实现文档

## 概述
本文档描述 remote_notify 桌面客户端的三大优化功能。

## 1. 积分变化小窗口

### 功能特性
- 窗口尺寸：300x400px
- 窗口位置：桌面右上角置顶
- 背景：半透明（95%不透明度）
- 滚动显示当天所有积分变化记录

### 数据结构
```python
{
    'time': 'HH:MM:SS',
    'student': '学生姓名',
    'change': 5,  # 正数加分，负数扣分
    'reason': '变动原因',
    'course': '课程名称'
}
```

### 系统托盘
- 最小化时显示托盘图标
- 托盘菜单：显示窗口、清空记录、退出

## 2. 紧急通知横幅

### 触发条件
- 通知标记为紧急（urgent=true）
- 且当前处于上课时间

### 显示规则
- 全屏弹窗 → 横幅通知
- 无声音提示
- 通知内容滚动显示

### 滚动速度
- 默认40字符/秒
- 可在配置中调整

## 3. 美化设计

### 声音管理
- 音量控制：0-100%
- 声音类型：通知、紧急、成功、警告、提醒
- 自定义音效支持

### 视觉风格
- 统一颜色方案
- 微软雅黑字体
- 过渡动画支持

## 配置说明

### 文件列表
- `class_schedule.json` - 上课时间表
- `sound_config.json` - 声音配置

### 环境变量
- `MQTT_BROKER` - MQTT服务器地址
- `MQTT_PORT` - MQTT端口
- `MQTT_SSL` - 是否启用SSL

## 兼容性测试

### Windows 版本
- Windows 10 1903+
- Windows 11

### 分辨率测试
- 1920x1080 ✓
- 1366x768 ✓
- 2560x1440 ✓
```

---

## 自查清单

- [ ] 第一部分：积分窗口基础功能完成
- [ ] 第一部分：滚动显示实现
- [ ] 第一部分：系统托盘集成
- [ ] 第二部分：上课时间检测完成
- [ ] 第二部分：横幅通知实现
- [ ] 第三部分：声音管理器完成
- [ ] 第三部分：样式配置统一
- [ ] 测试：单元测试覆盖关键功能
- [ ] 文档：实现文档完整
- [ ] 兼容性：不同分辨率测试通过
```

**Plan complete and saved to `docs/superpowers/plans/YYYY-MM-DD-remote-notify-optimization.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
