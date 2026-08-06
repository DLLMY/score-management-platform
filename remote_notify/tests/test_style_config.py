# -*- coding: utf-8 -*-
"""
样式配置测试模块
"""

import sys
import os

# 添加父目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from style_config import (
    Colors, Fonts, Spacing, Animation, WindowConfig, 
    StyleConfig, BUTTON_STYLES, get_color, get_font
)


def test_colors():
    """测试颜色配置"""
    assert Colors.PRIMARY == '#3498db', "主色调应为#3498db"
    assert Colors.SUCCESS == '#27ae60', "成功色应为#27ae60"
    assert Colors.WARNING == '#f39c12', "警告色应为#f39c12"
    assert Colors.DANGER == '#e74c3c', "危险色应为#e74c3c"
    print("[PASS]test_colors 通过")


def test_fonts():
    """测试字体配置"""
    assert Fonts.SANS_SERIF == '微软雅黑', "无衬线字体应为微软雅黑"
    assert Fonts.TITLE_MEDIUM == ('微软雅黑', 20, 'bold'), "标题字体配置应正确"
    assert Fonts.BODY_MEDIUM == ('微软雅黑', 12), "正文字体配置应正确"
    print("[PASS]test_fonts 通过")


def test_spacing():
    """测试间距配置"""
    assert Spacing.XS == 4, "XS间距应为4"
    assert Spacing.SM == 8, "SM间距应为8"
    assert Spacing.MD == 16, "MD间距应为16"
    assert Spacing.LG == 24, "LG间距应为24"
    assert Spacing.XL == 32, "XL间距应为32"
    print("[PASS]test_spacing 通过")


def test_animation():
    """测试动画配置"""
    assert Animation.FAST == 100, "快速动画应为100ms"
    assert Animation.NORMAL == 200, "正常动画应为200ms"
    assert Animation.SLOW == 400, "慢速动画应为400ms"
    assert Animation.SCROLL_NORMAL == 40, "正常滚动速度应为40字符/秒"
    print("[PASS]test_animation 通过")


def test_window_config():
    """测试窗口配置"""
    assert WindowConfig.SCORE_WINDOW_WIDTH == 300, "积分窗口宽度应为300"
    assert WindowConfig.SCORE_WINDOW_HEIGHT == 400, "积分窗口高度应为400"
    assert WindowConfig.BANNER_WIDTH_RATIO == 0.85, "横幅宽度比例应为0.85"
    assert WindowConfig.BANNER_HEIGHT == 70, "横幅高度应为70"
    print("[PASS]test_window_config 通过")


def test_style_config():
    """测试样式配置类"""
    config = StyleConfig()
    
    # 测试获取颜色
    color = config.get_color('primary')
    assert color == Colors.PRIMARY, "获取主色应正确"
    
    # 测试获取字体
    font = config.get_font('title')
    assert font == Fonts.TITLE_MEDIUM, "获取标题字体应正确"
    
    # 测试获取滚动速度
    speed = config.get_scroll_speed()
    assert speed == Animation.SCROLL_NORMAL, "滚动速度应正确"
    
    print("[PASS]test_style_config 通过")


def test_button_styles():
    """测试按钮样式预定义"""
    assert 'primary' in BUTTON_STYLES, "应有primary按钮样式"
    assert 'success' in BUTTON_STYLES, "应有success按钮样式"
    assert 'danger' in BUTTON_STYLES, "应有danger按钮样式"
    assert 'warning' in BUTTON_STYLES, "应有warning按钮样式"
    assert 'outline' in BUTTON_STYLES, "应有outline按钮样式"
    
    # 验证primary样式结构
    primary = BUTTON_STYLES['primary']
    assert 'bg' in primary, "primary样式应有bg字段"
    assert 'hover' in primary, "primary样式应有hover字段"
    assert 'fg' in primary, "primary样式应有fg字段"
    assert 'font' in primary, "primary样式应有font字段"
    
    print("[PASS]test_button_styles 通过")


def test_get_color_function():
    """测试快捷函数"""
    color = get_color('primary')
    assert color == Colors.PRIMARY, "get_color应返回主色"
    
    # 测试默认值
    color = get_color('nonexistent', '#000000')
    assert color == '#000000', "不存在的颜色应返回默认值"
    
    print("[PASS]test_get_color_function 通过")


def test_get_font_function():
    """测试获取字体函数"""
    font = get_font('title')
    assert font == Fonts.TITLE_MEDIUM, "get_font应返回标题字体"
    
    font = get_font('body')
    assert font == Fonts.BODY_MEDIUM, "get_font应返回正文字体"
    
    print("[PASS]test_get_font_function 通过")


def test_score_colors():
    """测试积分专用颜色"""
    assert Colors.SCORE_POSITIVE == '#27ae60', "加分色应为绿色"
    assert Colors.SCORE_NEGATIVE == '#e74c3c', "扣分色应为红色"
    assert Colors.SCORE_NEUTRAL == '#3498db', "中性积分色应为蓝色"
    print("[PASS]test_score_colors 通过")


def test_notify_colors():
    """测试通知专用颜色"""
    assert Colors.NOTIFY_BG == '#2c3e50', "通知背景色应正确"
    assert Colors.NOTIFY_TEXT == '#ecf0f1', "通知文字色应正确"
    assert Colors.NOTIFY_URGENT_BG == '#c0392b', "紧急通知背景色应正确"
    print("[PASS]test_notify_colors 通过")


if __name__ == '__main__':
    print("=" * 50)
    print("样式配置测试")
    print("=" * 50)
    
    test_colors()
    test_fonts()
    test_spacing()
    test_animation()
    test_window_config()
    test_style_config()
    test_button_styles()
    test_get_color_function()
    test_get_font_function()
    test_score_colors()
    test_notify_colors()
    
    print("=" * 50)
    print("所有测试通过！")
    print("=" * 50)
