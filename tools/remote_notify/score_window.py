# -*- coding: utf-8 -*-
"""
积分变化小窗口模块

功能：
- 在桌面右上角显示积分变化记录
- 支持滚动显示当天所有积分变化
- 半透明背景，不影响正常操作
- 支持最小化到系统托盘

作者：开发团队
日期：2026-06-18
"""

import tkinter as tk
from tkinter import ttk
from datetime import datetime
import threading
import os

# 尝试导入托盘支持
try:
    from pystray import Icon, Menu, MenuItem as PyMenuItem
    from PIL import Image, ImageDraw
    HAS_TRAY = True
except ImportError:
    HAS_TRAY = False
    print("[积分窗口] pystray未安装，托盘功能将不可用")


class ScoreChangeWindow:
    """积分变化小窗口类"""
    
    # 去重时间窗口（秒）- 在此时间内相同记录视为重复
    DEDUP_WINDOW_SECONDS = 30
    
    def __init__(self, width=300, height=400):
        """
        初始化积分窗口
        
        Args:
            width: 窗口宽度，默认300px
            height: 窗口高度，默认400px
        """
        self.width = min(max(width, 280), 320)  # 限制在280-320之间
        self.height = min(max(height, 350), 450)  # 限制在350-450之间
        self.root = None
        self.records = []  # 积分记录列表
        self.record_id = 0  # 递增ID用于排序
        self.is_minimized = False
        self.tray_icon = None
        self._setup_done = False
        self._last_message_hash = None  # 记录上一条消息的哈希值，用于快速去重
        
    def _create_window(self):
        """创建窗口"""
        self.root = tk.Tk()
        self.root.title("积分变化")
        self.root.geometry(f"{self.width}x{self.height}")
        self.root.attributes('-topmost', True)
        self.root.attributes('-alpha', 0.95)  # 半透明背景
        
        # 窗口置顶在右上角
        self._position_top_right()
        
        # 设置关闭按钮行为
        self.root.protocol('WM_DELETE_WINDOW', self.hide_to_tray)
        
        self._setup_done = True
        
    def _position_top_right(self):
        """将窗口定位到右上角"""
        if self.root:
            screen_width = self.root.winfo_screenwidth()
            screen_height = self.root.winfo_screenheight()
            x = screen_width - self.width - 10
            y = 10  # 距离顶部10像素
            self.root.geometry(f"{self.width}x{self.height}+{x}+{y}")
            
    def add_record(self, student_name, score_change, reason, course=""):
        """
        添加积分记录
        
        Args:
            student_name: 学生姓名
            score_change: 积分变动数值（正数加分，负数扣分）
            reason: 变动原因
            course: 课程名称（可选）
            
        Returns:
            bool: True表示添加成功，False表示是重复记录被忽略
        """
        now = datetime.now()
        now_timestamp = now.timestamp()
        
        # 生成消息哈希用于快速去重
        msg_hash = hash((student_name, score_change, reason, course))
        
        # 检查是否是重复消息（与上一条完全相同）
        if msg_hash == self._last_message_hash:
            print(f"[积分窗口] 忽略重复消息: {student_name} {score_change:+d}分")
            return False
        
        # 检查是否存在时间窗口内的相同记录
        for r in self.records:
            if (r['student'] == student_name and 
                r['change'] == score_change and 
                r['reason'] == reason and
                (now_timestamp - r['timestamp']) < self.DEDUP_WINDOW_SECONDS):
                print(f"[积分窗口] 忽略{self.DEDUP_WINDOW_SECONDS}秒内的重复记录: {student_name} {score_change:+d}分")
                return False
        
        self._last_message_hash = msg_hash
        self.record_id += 1  # 递增ID
        
        record = {
            'id': self.record_id,  # 唯一ID
            'time': now.strftime("%H:%M:%S"),
            'student': student_name,
            'change': score_change,
            'reason': reason,
            'course': course,
            'timestamp': now_timestamp  # 用于排序
        }
        self.records.append(record)
        
        # 按时间排序（最新的在前面）- 使用ID作为次要排序确保稳定性
        self.records.sort(key=lambda x: (x['timestamp'], x['id']), reverse=True)
        
        # 只保留当天的记录
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).timestamp()
        self.records = [r for r in self.records if r['timestamp'] >= today_start]
        
        self._update_display()
        print(f"[积分窗口] 添加记录: {student_name} {score_change:+d}分 (原因:{reason})")
        return True
        
    def _setup_ui(self):
        """设置UI组件"""
        if not self.root:
            return
            
        # 清空现有内容
        for widget in self.root.winfo_children():
            widget.destroy()
            
        # ===== 标题栏 =====
        title_frame = tk.Frame(self.root, bg='#3498db', height=40)
        title_frame.pack(fill='x')
        title_frame.pack_propagate(False)
        
        # 标题标签
        title_label = tk.Label(title_frame, text="📊 积分变化记录",
                             font=('微软雅黑', 12, 'bold'),
                             bg='#3498db', fg='white')
        title_label.pack(side='left', padx=10, pady=8)
        
        # 右侧按钮容器
        btn_frame = tk.Frame(title_frame, bg='#3498db')
        btn_frame.pack(side='right')
        
        # 最小化按钮
        min_btn = tk.Button(btn_frame, text="—", command=self.hide_to_tray,
                           bg='#3498db', fg='white', bd=0, font=('Arial', 12, 'bold'),
                           width=3, height=1, cursor='hand2')
        min_btn.pack(side='left', padx=2)
        
        # 清空按钮
        clear_btn = tk.Button(btn_frame, text="🗑", command=self.clear_records,
                             bg='#3498db', fg='white', bd=0, font=('Arial', 11),
                             width=3, height=1, cursor='hand2')
        clear_btn.pack(side='left', padx=2)
        
        # 关闭按钮
        close_btn = tk.Button(btn_frame, text="×", command=self.hide_to_tray,
                             bg='#e74c3c', fg='white', bd=0, font=('Arial', 14, 'bold'),
                             width=3, height=1, cursor='hand2')
        close_btn.pack(side='left', padx=2)
        
        # ===== 主内容区域 - Canvas + Scrollbar =====
        content_frame = tk.Frame(self.root, bg='#ecf0f1')
        content_frame.pack(fill='both', expand=True)
        
        # Canvas
        self.canvas = tk.Canvas(content_frame, bg='#ecf0f1', highlightthickness=0)
        self.scrollbar = ttk.Scrollbar(content_frame, orient='vertical',
                                        command=self.canvas.yview)
        
        # 滚动内容Frame
        self.scroll_frame = tk.Frame(self.canvas, bg='#ecf0f1')
        self.scroll_frame.bind('<Configure>', 
                              lambda e: self.canvas.configure(scrollregion=self.canvas.bbox('all')))
        
        self.canvas.configure(yscrollcommand=self.scrollbar.set)
        self.scrollbar.pack(side='right', fill='y')
        self.canvas.pack(side='left', fill='both', expand=True)
        
        # 创建Canvas窗口
        self.canvas_window = self.canvas.create_window((0, 0), 
                                                        window=self.scroll_frame,
                                                        anchor='nw')
        
        # 绑定鼠标滚轮事件
        self.canvas.bind('<MouseWheel>', self._on_mousewheel)
        self.scroll_frame.bind('<MouseWheel>', self._on_mousewheel)
        
        # 绑定Canvas大小改变事件
        self.canvas.bind('<Configure>', self._on_canvas_resize)
        
        # 初始化显示
        self._update_display()
        
    def _on_mousewheel(self, event):
        """鼠标滚轮滚动"""
        self.canvas.yview_scroll(int(-1 * (event.delta / 120)), 'units')
        
    def _on_canvas_resize(self, event):
        """当Canvas大小改变时，调整内部窗口宽度"""
        if hasattr(self, 'canvas_window'):
            self.canvas.itemconfig(self.canvas_window, width=event.width)
            
    def _update_display(self):
        """更新积分记录显示"""
        if not self._setup_done:
            return
            
        if not hasattr(self, 'scroll_frame'):
            return
            
        # 清除现有显示
        for widget in self.scroll_frame.winfo_children():
            widget.destroy()
            
        # 显示今天的日期
        today = datetime.now().strftime("%Y年%m月%d日")
        date_label = tk.Label(self.scroll_frame, text=today,
                             font=('微软雅黑', 10),
                             bg='#ecf0f1', fg='#7f8c8d')
        date_label.pack(pady=(8, 5))
        
        # 记录数量
        count_label = tk.Label(self.scroll_frame, 
                              text=f"共 {len(self.records)} 条记录",
                              font=('微软雅黑', 9),
                              bg='#ecf0f1', fg='#95a5a6')
        count_label.pack(pady=(0, 8))
        
        # 逐条显示积分记录
        if not self.records:
            # 无记录提示
            empty_label = tk.Label(self.scroll_frame,
                                 text="暂无积分变化记录",
                                 font=('微软雅黑', 11),
                                 bg='#ecf0f1', fg='#bdc3c7')
            empty_label.pack(pady=50)
        else:
            for record in self.records:
                self._create_record_card(record)
                
        # 更新滚动区域
        self.scroll_frame.update_idletasks()
        self.canvas.configure(scrollregion=self.canvas.bbox('all'))
        
    def _create_record_card(self, record):
        """创建单条记录卡片"""
        card = tk.Frame(self.scroll_frame, bg='white', relief='raised', bd=1)
        card.pack(fill='x', padx=8, pady=4)
        
        # 顶部行：时间和积分变化
        top_frame = tk.Frame(card, bg='white')
        top_frame.pack(fill='x', padx=8, pady=(6, 0))
        
        # 时间
        time_label = tk.Label(top_frame, text=record['time'],
                            font=('Arial', 9),
                            bg='white', fg='#95a5a6')
        time_label.pack(side='left')
        
        # 积分变化（带颜色，右对齐）
        change_color = '#27ae60' if record['change'] > 0 else '#e74c3c'
        change_text = f"+{record['change']}" if record['change'] > 0 else str(record['change'])
        change_label = tk.Label(top_frame, text=change_text,
                               font=('Arial', 16, 'bold'),
                               fg=change_color, bg='white')
        change_label.pack(side='right')
        
        # 学生姓名
        name_label = tk.Label(card, text=record['student'],
                             font=('微软雅黑', 11, 'bold'),
                             bg='white', fg='#2c3e50')
        name_label.pack(anchor='w', padx=8, pady=(2, 0))
        
        # 变动原因
        reason_label = tk.Label(card, text=record['reason'],
                              font=('微软雅黑', 9),
                              bg='white', fg='#34495e',
                              wraplength=self.width - 30, justify='left')
        reason_label.pack(anchor='w', padx=8, pady=(2, 4))
        
        # 课程信息（如果有）
        if record.get('course'):
            course_label = tk.Label(card, text=f"📚 {record['course']}",
                                  font=('微软雅黑', 8),
                                  bg='#f8f9fa', fg='#6c757d')
            course_label.pack(anchor='w', padx=8, pady=(0, 6))
        
    def _create_tray_icon(self):
        """创建托盘图标"""
        if not HAS_TRAY:
            return None
            
        # 创建图标图像
        width, height = 64, 64
        image = Image.new('RGB', (width, height), color='#3498db')
        draw = ImageDraw.Draw(image)
        
        # 画圆形背景
        draw.ellipse([4, 4, 60, 60], fill='#2980b9')
        
        # 画数字图标
        draw.text((20, 18), 'P', fill='white')
        
        def show_window(icon=None, item=None):
            self.show()
            
        def clear_records(icon=None, item=None):
            self.clear_records()
            
        def quit_app(icon=None, item=None):
            self.quit()
            
        menu = Menu(
            PyMenuItem('显示窗口', show_window),
            PyMenuItem('清空记录', clear_records),
            PyMenuItem('退出', quit_app)
        )
        
        self.tray_icon = Icon('score_tracker', image, '积分追踪', menu)
        return self.tray_icon
        
    def show(self):
        """显示窗口"""
        if self.root:
            self.root.deiconify()
            self.root.lift()
            self.root.focus_force()
            self.is_minimized = False
            
    def hide_to_tray(self):
        """最小化到托盘"""
        if not self.root:
            return
            
        if HAS_TRAY:
            self.root.withdraw()
            self.is_minimized = True
            
            if not self.tray_icon:
                tray = self._create_tray_icon()
                if tray:
                    threading.Thread(target=tray.run, daemon=True).start()
        else:
            # 如果没有托盘支持，则隐藏窗口
            self.root.withdraw()
            self.is_minimized = True
            
    def clear_records(self):
        """清空记录"""
        self.records = []
        self._update_display()
        
    def quit(self):
        """退出应用"""
        if self.tray_icon:
            try:
                self.tray_icon.stop()
            except:
                pass
        if self.root:
            self.root.quit()
            self.root.destroy()
            
    def run(self):
        """运行窗口"""
        self._create_window()
        self._setup_ui()
        self.root.mainloop()


# 单例模式
_instance = None
_lock = threading.Lock()

def get_instance():
    """获取积分窗口单例"""
    global _instance
    if _instance is None:
        with _lock:
            if _instance is None:
                _instance = ScoreChangeWindow()
    return _instance


# 测试代码
if __name__ == '__main__':
    print("测试积分变化窗口...")
    
    window = ScoreChangeWindow()
    
    # 添加一些测试数据
    test_records = [
        ('张三', 5, '课堂表现优秀，积极回答问题', '数学'),
        ('李四', -2, '上课迟到', '语文'),
        ('王五', 10, '帮助同学解决问题', '英语'),
        ('赵六', -3, '课堂作业未完成', '数学'),
        ('孙七', 8, '考试成绩优异', '物理'),
    ]
    
    for name, change, reason, course in test_records:
        window.add_record(name, change, reason, course)
    
    # 在新线程中运行
    print("启动窗口...")
    window.run()
