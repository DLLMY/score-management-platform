import threading
import tkinter as tk
import pyttsx3
import os

# ---------- 全局模块导入 ----------
# 声音管理器
try:
    from sound_manager import SoundManager, SoundType
    sound_manager = SoundManager()
    print("[声音] 声音管理器已初始化")
except ImportError as e:
    sound_manager = None
    print(f"[声音] 声音管理器未加载: {e}")

# 上课时间管理器
try:
    from class_schedule import ClassScheduleManager
    class_manager = ClassScheduleManager()
    print("[上课时间] 日程管理器已初始化")
except ImportError as e:
    class_manager = None
    print(f"[上课时间] 日程管理器未加载: {e}")

# 积分窗口
try:
    from score_window import ScoreChangeWindow, get_instance as get_score_window
    score_window = get_score_window()
    print("[积分] 积分窗口已初始化")
except ImportError as e:
    score_window = None
    print(f"[积分] 积分窗口未加载: {e}")

# ---------- 1. 音量控制 (跨平台) ----------
def set_volume(level: float) -> bool:
    """
    设置系统主音量 (0.0 ~ 1.0)
    支持 Windows 和 Linux/macOS
    """
    try:
        if os.name == 'nt':
            import subprocess
            volume_percent = int(max(0, min(100, level * 100)))
            ps_script = f"(New-Object -ComObject WScript.Shell).SendKeys('{{{{VOLUME_UP}}}}' * {volume_percent})"
            subprocess.run(['powershell', '-Command', ps_script], capture_output=True)
            return True
        else:
            import subprocess
            volume_percent = int(max(0, min(100, level * 100)))
            
            if os.uname().sysname == 'Darwin':
                subprocess.run(['osascript', '-e', f'set volume output volume {volume_percent}'])
            else:
                subprocess.run(['amixer', '-D', 'pulse', 'sset', 'Master', f'{volume_percent}%'])
        
        return True
    except Exception as e:
        print(f"[音量] 设置失败: {e}")
        return False

# ---------- 2. TTS 引擎（全局单例） ----------
_tts_engine = None

def get_tts_engine():
    global _tts_engine
    if _tts_engine is None:
        print("[语音] 初始化TTS引擎...")
        try:
            _tts_engine = pyttsx3.init()
            print("[语音] TTS引擎初始化成功")
            
            voices = _tts_engine.getProperty('voices')
            print(f"[语音] 可用语音数量: {len(voices)}")
            
            # 尝试设置为中文语音
            for voice in voices:
                # 获取语音信息（兼容不同版本的pyttsx3）
                voice_name = getattr(voice, 'name', 'Unknown')
                # 安全获取语言信息，避免空列表导致IndexError
                languages = getattr(voice, 'languages', [])
                voice_lang = getattr(voice, 'language', languages[0] if languages else 'unknown')
                voice_id = getattr(voice, 'id', 'unknown')
                
                print(f"[语音] 语音: name={voice_name}, lang={voice_lang}, id={voice_id}")
                
                # 检查是否为中文语音
                is_chinese = False
                if 'chinese' in voice_name.lower():
                    is_chinese = True
                elif isinstance(voice_lang, str) and ('zh' in voice_lang.lower() or 'chinese' in voice_lang.lower()):
                    is_chinese = True
                elif isinstance(voice_lang, list) and any('zh' in l.lower() or 'chinese' in l.lower() for l in voice_lang):
                    is_chinese = True
                
                if is_chinese:
                    _tts_engine.setProperty('voice', voice_id)
                    print(f"[语音] 使用中文语音: {voice_name}")
                    break
            
            _tts_engine.setProperty('rate', 150)
            _tts_engine.setProperty('volume', 1.0)
        except Exception as e:
            print(f"[语音] TTS引擎初始化失败: {e}")
            import traceback
            traceback.print_exc()
            raise
    
    return _tts_engine

def speak_text(text: str):
    """在新线程中播放语音"""
    def _speak():
        print(f"[语音] 开始播放: {text}")
        try:
            engine = get_tts_engine()
            engine.say(text)
            print("[语音] 调用runAndWait...")
            engine.runAndWait()
            print("[语音] 播放完成")
        except Exception as e:
            print(f"[语音] 播放失败: {e}")
            import traceback
            traceback.print_exc()
            
            global _tts_engine
            _tts_engine = None
            print("[语音] 尝试重新初始化引擎...")
            
            try:
                engine = get_tts_engine()
                engine.say(text)
                engine.runAndWait()
                print("[语音] 重试播放成功")
            except Exception as retry_e:
                print(f"[语音] 重试播放也失败: {retry_e}")
                import traceback
                traceback.print_exc()
    
    threading.Thread(target=_speak, daemon=True).start()

# ---------- 3. 全屏弹窗 ----------
def fullscreen_popup(message: str, timeout_sec: int = 8, is_urgent: bool = False):
    def _popup():
        root = tk.Tk()
        root.attributes('-fullscreen', True)
        root.attributes('-topmost', True)
        
        bg_color = 'black' if is_urgent else '#2c3e50'
        title_color = '#ff0000' if is_urgent else '#f39c12'
        text_color = '#ff4444' if is_urgent else '#ecf0f1'
        
        root.configure(bg=bg_color)
        root.bind('<Escape>', lambda e: root.destroy())
        
        frame = tk.Frame(root, bg=bg_color)
        frame.place(relx=0.5, rely=0.5, anchor='center')
        
        title_text = '🚨 紧急通知' if is_urgent else '📢 通知'
        title_label = tk.Label(frame, text=title_text,
                         font=('微软雅黑', 24, 'bold'),
                         fg=title_color, bg=bg_color)
        title_label.pack(pady=(0, 30))
        
        label = tk.Label(frame, text=message,
                         font=('微软雅黑', 48, 'bold'),
                         fg=text_color, bg=bg_color,
                         wraplength=800,
                         justify='center')
        label.pack(padx=30, pady=30)
        
        btn_bg = '#ff4444' if is_urgent else '#3498db'
        btn = tk.Button(frame, text='立即关闭', font=('微软雅黑', 24),
                        command=root.destroy, 
                        bg=btn_bg, fg='white',
                        padx=40, pady=15,
                        relief='raised', borderwidth=3)
        btn.pack(pady=20)
        
        countdown_label = tk.Label(frame, text=f'将在 {timeout_sec} 秒后自动关闭',
                                   font=('微软雅黑', 18),
                                   fg='gray', bg=bg_color)
        countdown_label.pack(pady=10)
        
        def update_countdown(remaining):
            if remaining > 0:
                countdown_label.config(text=f'将在 {remaining} 秒后自动关闭')
                root.after(1000, update_countdown, remaining - 1)
        
        update_countdown(timeout_sec)
        root.after(timeout_sec * 1000, root.destroy)
        
        root.mainloop()
    
    threading.Thread(target=_popup, daemon=True).start()


# ---------- 4. 横幅通知（上课时间使用） ----------
def banner_popup(message: str, timeout_sec: int = 8, is_urgent: bool = False):
    """
    横幅通知 - 适合上课时间显示，不遮挡内容
    
    Args:
        message: 通知内容
        timeout_sec: 自动关闭时间（秒）
        is_urgent: 是否紧急通知
    """
    def _banner():
        root = tk.Tk()
        
        # 获取屏幕信息
        screen_width = root.winfo_screenwidth()
        screen_height = root.winfo_screenheight()
        
        # 横幅尺寸
        banner_width = int(screen_width * 0.85)  # 85% 屏幕宽度
        banner_height = 70
        banner_x = int((screen_width - banner_width) / 2)
        
        # 窗口设置
        root.overrideredirect(True)  # 无边框
        root.attributes('-topmost', True)
        root.geometry(f"{banner_width}x{banner_height}+{banner_x}+0")
        
        # 配色方案
        bg_color = '#c0392b' if is_urgent else '#e74c3c'  # 深红/红色
        text_color = 'white'
        
        root.configure(bg=bg_color)
        
        # 主容器
        main_frame = tk.Frame(root, bg=bg_color)
        main_frame.pack(fill='both', expand=True, padx=15, pady=8)
        
        # 左侧：警告图标和标题
        left_frame = tk.Frame(main_frame, bg=bg_color)
        left_frame.pack(side='left', padx=(0, 15))
        
        icon_text = '🚨' if is_urgent else '📢'
        icon_label = tk.Label(left_frame, text=icon_text,
                            font=('Arial', 22),
                            bg=bg_color, fg=text_color)
        icon_label.pack(side='left', padx=(0, 5))
        
        title_text = '紧急通知' if is_urgent else '通知'
        title_label = tk.Label(left_frame, text=title_text,
                              font=('微软雅黑', 14, 'bold'),
                              bg=bg_color, fg=text_color)
        title_label.pack(side='left')
        
        # 中间：滚动文本
        text_frame = tk.Frame(main_frame, bg=bg_color)
        text_frame.pack(side='left', fill='both', expand=True)
        
        # 计算文本区域宽度
        text_width = banner_width - 180  # 减去左右区域
        
        canvas = tk.Canvas(text_frame, bg=bg_color, highlightthickness=0,
                         width=text_width, height=54)
        canvas.pack(expand=True, fill='both')
        
        # 创建文本
        text_item = canvas.create_text(0, 27, text=message,
                                      font=('微软雅黑', 18, 'bold'),
                                      fill=text_color, anchor='w')
        
        # 滚动动画参数
        scroll_speed = 40  # 字符/秒
        char_width = 10    # 每字符宽度估算
        
        def scroll_text():
            try:
                if not root.winfo_exists():
                    return
                    
                bbox = canvas.bbox(text_item)
                if bbox is None:
                    return
                    
                current_x = bbox[0]
                text_width_pixels = bbox[2] - bbox[0]
                
                # 如果文本完全滚出左侧，重置到右侧
                if current_x < -text_width_pixels:
                    canvas.move(text_item, text_width + text_width, 0)
                else:
                    # 每帧移动的像素
                    pixels_per_frame = (char_width * scroll_speed) / 60
                    canvas.move(text_item, -pixels_per_frame, 0)
                    
                root.after(16, scroll_text)  # ~60fps
            except Exception:
                pass
                
        scroll_text()
        
        # 右侧：关闭按钮和倒计时
        right_frame = tk.Frame(main_frame, bg=bg_color)
        right_frame.pack(side='right', padx=(10, 0))
        
        # 关闭按钮
        close_btn = tk.Button(right_frame, text='×',
                            command=root.destroy,
                            bg=bg_color, fg=text_color,
                            font=('Arial', 22, 'bold'),
                            bd=0, padx=8, pady=0,
                            cursor='hand2',
                            activebackground='#a93226',
                            activeforeground='white')
        close_btn.pack(side='top', pady=(0, 2))
        
        # 倒计时
        countdown_label = tk.Label(right_frame, text=f'{timeout_sec}s',
                                  font=('Arial', 10),
                                  bg=bg_color, fg='#ffcccc')
        countdown_label.pack(side='top')
        
        remaining = [timeout_sec]
        def update_countdown():
            if remaining[0] > 0 and root.winfo_exists():
                countdown_label.config(text=f'{remaining[0]}s')
                remaining[0] -= 1
                root.after(1000, update_countdown)
            elif root.winfo_exists():
                root.destroy()
                
        update_countdown()
        
        # 添加悬停效果
        def on_enter(e):
            root.attributes('-alpha', 0.8)
        def on_leave(e):
            root.attributes('-alpha', 1.0)
            
        root.bind('<Enter>', on_enter)
        root.bind('<Leave>', on_leave)
        
        root.mainloop()
        
    threading.Thread(target=_banner, daemon=True).start()


# ---------- 5. 智能通知分发 ----------
def show_notification(message: str, timeout_sec: int = 8, is_urgent: bool = False,
                      notification_type: str = 'normal'):
    """
    智能通知分发 - 根据当前状态选择最佳显示方式
    
    Args:
        message: 通知内容
        timeout_sec: 自动关闭时间
        is_urgent: 是否紧急通知
        notification_type: 通知类型 (normal, score_change, class_reminder, etc.)
    """
    # 处理积分变化通知
    if notification_type == 'score_change' and score_window:
        # 从消息中提取积分变化信息
        # 格式: "学生:张三, +5分, 原因:课堂表现优秀, 课程:数学"
        try:
            parts = message.split(',')
            student = reason = course = ''
            change = 0
            
            for part in parts:
                part = part.strip()
                if '学生:' in part:
                    student = part.split('学生:')[1]
                elif '分' in part and ('+' in part or '-' in part):
                    change_str = part.replace('+', '').replace('-', '').replace('分', '').strip()
                    try:
                        change = int(change_str) if '-' not in part else -int(change_str)
                    except:
                        pass
                elif '原因:' in part:
                    reason = part.split('原因:')[1]
                elif '课程:' in part:
                    course = part.split('课程:')[1]
                    
            if student and change != 0:
                score_window.add_record(student, change, reason, course)
                return  # 积分窗口已处理，不需要弹窗
        except Exception as e:
            print(f"[通知] 处理积分变化失败: {e}")
            
    # 紧急通知且上课时间 -> 使用横幅
    if is_urgent and class_manager:
        if class_manager.should_silent_urgent():
            # 上课时间紧急通知，静音且使用横幅
            print(f"[通知] 上课时间紧急通知（静音横幅）: {message[:50]}...")
            banner_popup(message, timeout_sec, is_urgent=True)
            return
        elif class_manager.is_now_class_time():
            # 上课时间紧急通知，使用横幅
            print(f"[通知] 上课时间紧急通知（横幅）: {message[:50]}...")
            banner_popup(message, timeout_sec, is_urgent=True)
            
            # 播放紧急音
            if sound_manager:
                sound_manager.play_sound(SoundType.URGENT)
            return
            
    # 根据上课时间选择显示方式
    display_mode = 'fullscreen'
    if class_manager:
        display_mode = class_manager.get_display_mode()
        
    if display_mode == 'banner':
        # 使用横幅
        print(f"[通知] 显示横幅: {message[:50]}...")
        banner_popup(message, timeout_sec, is_urgent)
        
        # 播放提示音
        if sound_manager:
            sound_manager.play_sound(SoundType.NOTIFICATION)
    else:
        # 使用全屏弹窗
        print(f"[通知] 显示全屏: {message[:50]}...")
        fullscreen_popup(message, timeout_sec, is_urgent)
        
        # 播放提示音
        if sound_manager:
            sound_manager.play_sound(SoundType.NOTIFICATION if not is_urgent else SoundType.URGENT)
