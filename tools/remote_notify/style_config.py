# -*- coding: utf-8 -*-
"""
统一样式配置模块

功能：
- 颜色方案定义
- 字体配置
- 间距配置
- 动画配置
- 窗口配置

作者：开发团队
日期：2026-06-18
"""

import json
import os
from typing import Dict, Any


class Colors:
    """颜色配置类"""
    
    # ===== 主色调 =====
    PRIMARY = '#3498db'           # 蓝色
    PRIMARY_DARK = '#2980b9'     # 深蓝
    PRIMARY_LIGHT = '#5dade2'    # 浅蓝
    PRIMARY_LIGHTER = '#85c1e9'  # 更浅蓝
    
    # ===== 功能色 =====
    SUCCESS = '#27ae60'          # 绿色
    SUCCESS_DARK = '#1e8449'    # 深绿
    SUCCESS_LIGHT = '#58d68d'   # 浅绿
    
    WARNING = '#f39c12'          # 橙色
    WARNING_DARK = '#d68910'     # 深橙
    WARNING_LIGHT = '#f7dc6f'    # 浅橙
    
    DANGER = '#e74c3c'           # 红色
    DANGER_DARK = '#c0392b'      # 深红
    DANGER_LIGHT = '#ec7063'      # 浅红
    
    INFO = '#3498db'             # 蓝色（信息）
    INFO_DARK = '#2471a3'        # 深蓝
    INFO_LIGHT = '#7fb3d5'       # 浅蓝
    
    # ===== 中性色 =====
    WHITE = '#ffffff'
    BLACK = '#000000'
    
    GRAY_50 = '#f8f9fa'
    GRAY_100 = '#f1f3f5'
    GRAY_200 = '#e9ecef'
    GRAY_300 = '#dee2e6'
    GRAY_400 = '#ced4da'
    GRAY_500 = '#adb5bd'
    GRAY_600 = '#6c757d'
    GRAY_700 = '#495057'
    GRAY_800 = '#343a40'
    GRAY_900 = '#212529'
    
    # ===== 背景色 =====
    BG_PRIMARY = '#ecf0f1'
    BG_SECONDARY = '#d5dbdb'
    BG_DARK = '#2c3e50'
    BG_DARKER = '#1a252f'
    
    # ===== 文字色 =====
    TEXT_PRIMARY = '#2c3e50'
    TEXT_SECONDARY = '#7f8c8d'
    TEXT_MUTED = '#bdc3c7'
    TEXT_LIGHT = '#ecf0f1'
    
    # ===== 边框色 =====
    BORDER_LIGHT = '#dce1e3'
    BORDER_MEDIUM = '#bdc3c7'
    BORDER_DARK = '#95a5a6'
    
    # ===== 积分颜色 =====
    SCORE_POSITIVE = '#27ae60'   # 加分（绿色）
    SCORE_NEGATIVE = '#e74c3c'   # 扣分（红色）
    SCORE_NEUTRAL = '#3498db'    # 中性（蓝色）
    
    # ===== 通知配色 =====
    NOTIFY_BG = '#2c3e50'
    NOTIFY_TEXT = '#ecf0f1'
    NOTIFY_URGENT_BG = '#c0392b'
    NOTIFY_URGENT_TEXT = '#ffffff'
    
    # ===== 按钮配色 =====
    BTN_PRIMARY_BG = '#3498db'
    BTN_PRIMARY_HOVER = '#2980b9'
    BTN_SUCCESS_BG = '#27ae60'
    BTN_SUCCESS_HOVER = '#1e8449'
    BTN_DANGER_BG = '#e74c3c'
    BTN_DANGER_HOVER = '#c0392b'
    BTN_WARNING_BG = '#f39c12'
    BTN_WARNING_HOVER = '#d68910'


class Fonts:
    """字体配置类"""
    
    # 字体族
    SANS_SERIF = '微软雅黑'
    SERIF = '宋体'
    MONOSPACE = 'Consolas'
    
    # 标题字体
    TITLE_LARGE = (SANS_SERIF, 24, 'bold')
    TITLE_MEDIUM = (SANS_SERIF, 20, 'bold')
    TITLE_SMALL = (SANS_SERIF, 16, 'bold')
    
    # 正文字体
    BODY_LARGE = (SANS_SERIF, 14)
    BODY_MEDIUM = (SANS_SERIF, 12)
    BODY_SMALL = (SANS_SERIF, 10)
    
    # 数字字体
    NUMBER_LARGE = (MONOSPACE, 24, 'bold')
    NUMBER_MEDIUM = (MONOSPACE, 16, 'bold')
    NUMBER_SMALL = (MONOSPACE, 12)
    
    # 等宽字体
    CODE = (MONOSPACE, 10)


class Spacing:
    """间距配置类"""
    
    XS = 4    # 极小间距
    SM = 8    # 小间距
    MD = 16   # 中等间距
    LG = 24   # 大间距
    XL = 32   # 极大间距
    XXL = 48  # 超大间距


class BorderRadius:
    """圆角配置"""
    
    NONE = 0
    SM = 2
    MD = 4
    LG = 8
    XL = 12
    ROUND = 999


class Animation:
    """动画配置"""
    
    # 过渡时长（毫秒）
    FAST = 100
    NORMAL = 200
    SLOW = 400
    
    # 滚动速度（字符/秒）
    SCROLL_SLOW = 30
    SCROLL_NORMAL = 40
    SCROLL_FAST = 50
    
    # 悬停延时（毫秒）
    HOVER_DELAY = 150


class WindowConfig:
    """窗口配置类"""
    
    # ===== 积分窗口 =====
    SCORE_WINDOW_WIDTH = 300
    SCORE_WINDOW_HEIGHT = 400
    SCORE_WINDOW_ALPHA = 0.95
    SCORE_WINDOW_MIN_WIDTH = 280
    SCORE_WINDOW_MAX_WIDTH = 320
    SCORE_WINDOW_MIN_HEIGHT = 350
    SCORE_WINDOW_MAX_HEIGHT = 450
    
    # ===== 横幅通知 =====
    BANNER_WIDTH_RATIO = 0.85  # 屏幕宽度的85%
    BANNER_HEIGHT = 70
    BANNER_TIMEOUT = 8  # 默认8秒
    
    # ===== 全屏通知 =====
    FULLSCREEN_TIMEOUT = 8
    FULLSCREEN_BG = Colors.BG_PRIMARY
    FULLSCREEN_TEXT_SIZE = 48
    
    # ===== 托盘 =====
    TRAY_ICON_SIZE = 64


class StyleConfig:
    """完整样式配置类"""
    
    def __init__(self, config_path: str = 'style_config.json'):
        self.config_path = config_path
        self.config = self._load_config()
        
    def _load_config(self) -> Dict[str, Any]:
        """加载配置文件"""
        default_config = {
            'version': '1.0',
            'colors': {
                'primary': Colors.PRIMARY,
                'success': Colors.SUCCESS,
                'warning': Colors.WARNING,
                'danger': Colors.DANGER,
                'info': Colors.INFO,
                'background': Colors.BG_PRIMARY,
                'text_primary': Colors.TEXT_PRIMARY,
                'text_secondary': Colors.TEXT_SECONDARY,
                'score_positive': Colors.SCORE_POSITIVE,
                'score_negative': Colors.SCORE_NEGATIVE
            },
            'fonts': {
                'title': '微软雅黑',
                'body': '微软雅黑',
                'code': 'Consolas'
            },
            'animation': {
                'scroll_speed': Animation.SCROLL_NORMAL,
                'transition_duration': Animation.NORMAL
            },
            'window': {
                'score_width': WindowConfig.SCORE_WINDOW_WIDTH,
                'score_height': WindowConfig.SCORE_WINDOW_HEIGHT,
                'banner_height': WindowConfig.BANNER_HEIGHT
            }
        }
        
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                pass
        else:
            self._save_config(default_config)
            
        return default_config
        
    def _save_config(self, config: Dict = None):
        """保存配置文件"""
        data = config if config is not None else self.config
        try:
            with open(self.config_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except:
            pass
            
    def get_color(self, key: str, default: str = None) -> str:
        """获取颜色值"""
        return self.config.get('colors', {}).get(key, default or Colors.PRIMARY)
        
    def get_font(self, key: str) -> tuple:
        """获取字体配置"""
        fonts = {
            'title': Fonts.TITLE_MEDIUM,
            'body': Fonts.BODY_MEDIUM,
            'code': Fonts.CODE
        }
        return fonts.get(key, Fonts.BODY_MEDIUM)
        
    def get_scroll_speed(self) -> int:
        """获取滚动速度"""
        return self.config.get('animation', {}).get('scroll_speed', Animation.SCROLL_NORMAL)


# 快捷函数
def get_color(key: str, default: str = None) -> str:
    """获取颜色值"""
    config = StyleConfig()
    return config.get_color(key, default)


def get_font(key: str) -> tuple:
    """获取字体"""
    config = StyleConfig()
    return config.get_font(key)


# 按钮样式预定义
BUTTON_STYLES = {
    'primary': {
        'bg': Colors.BTN_PRIMARY_BG,
        'hover': Colors.BTN_PRIMARY_HOVER,
        'fg': Colors.WHITE,
        'relief': 'raised',
        'borderwidth': 0,
        'cursor': 'hand2',
        'padx': 20,
        'pady': 10,
        'font': Fonts.BODY_MEDIUM
    },
    'success': {
        'bg': Colors.BTN_SUCCESS_BG,
        'hover': Colors.BTN_SUCCESS_HOVER,
        'fg': Colors.WHITE,
        'relief': 'raised',
        'borderwidth': 0,
        'cursor': 'hand2',
        'padx': 20,
        'pady': 10,
        'font': Fonts.BODY_MEDIUM
    },
    'danger': {
        'bg': Colors.BTN_DANGER_BG,
        'hover': Colors.BTN_DANGER_HOVER,
        'fg': Colors.WHITE,
        'relief': 'raised',
        'borderwidth': 0,
        'cursor': 'hand2',
        'padx': 20,
        'pady': 10,
        'font': Fonts.BODY_MEDIUM
    },
    'warning': {
        'bg': Colors.BTN_WARNING_BG,
        'hover': Colors.BTN_WARNING_HOVER,
        'fg': Colors.WHITE,
        'relief': 'raised',
        'borderwidth': 0,
        'cursor': 'hand2',
        'padx': 20,
        'pady': 10,
        'font': Fonts.BODY_MEDIUM
    },
    'outline': {
        'bg': Colors.WHITE,
        'hover': Colors.GRAY_100,
        'fg': Colors.PRIMARY,
        'relief': 'solid',
        'borderwidth': 2,
        'bordercolor': Colors.PRIMARY,
        'cursor': 'hand2',
        'padx': 20,
        'pady': 10,
        'font': Fonts.BODY_MEDIUM
    }
}


def apply_button_style(button, style_name: str = 'primary'):
    """应用按钮样式"""
    style = BUTTON_STYLES.get(style_name, BUTTON_STYLES['primary'])
    
    button.configure(
        bg=style['bg'],
        fg=style['fg'],
        relief=style['relief'],
        borderwidth=style.get('borderwidth', 0),
        cursor=style['cursor'],
        padx=style['padx'],
        pady=style['pady'],
        font=style['font']
    )
    
    # 如果有边框颜色设置
    if 'bordercolor' in style:
        button.configure(highlightbackground=style['bordercolor'])
        
    # 添加悬停效果
    hover_color = style['hover']
    normal_color = style['bg']
    
    def on_enter(e):
        button.configure(bg=hover_color)
        
    def on_leave(e):
        button.configure(bg=normal_color)
        
    button.bind('<Enter>', on_enter)
    button.bind('<Leave>', on_leave)


# 测试代码
if __name__ == '__main__':
    print("测试样式配置...")
    
    # 测试颜色
    print(f"主色调: {Colors.PRIMARY}")
    print(f"成功色: {Colors.SUCCESS}")
    print(f"警告色: {Colors.WARNING}")
    print(f"危险色: {Colors.DANGER}")
    
    # 测试间距
    print(f"\n间距: XS={Spacing.XS}, SM={Spacing.SM}, MD={Spacing.MD}, LG={Spacing.LG}")
    
    # 测试窗口配置
    print(f"\n积分窗口尺寸: {WindowConfig.SCORE_WINDOW_WIDTH}x{WindowConfig.SCORE_WINDOW_HEIGHT}")
    print(f"横幅高度: {WindowConfig.BANNER_HEIGHT}")
    
    print("\n样式配置测试完成")
