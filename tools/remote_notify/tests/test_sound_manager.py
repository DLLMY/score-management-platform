# -*- coding: utf-8 -*-
"""
声音管理器测试模块
"""

import sys
import os

# 添加父目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sound_manager import SoundManager, SoundType


def test_volume_control():
    """测试音量控制"""
    manager = SoundManager()
    
    # 测试正常范围
    result = manager.set_volume(50)
    assert result is True, "设置音量应返回True"
    assert manager.get_volume() == 50, "获取音量应返回50"
    
    # 测试超出上限
    manager.set_volume(150)
    assert manager.get_volume() == 100, "超出上限应限制为100"
    
    # 测试超出下限
    manager.set_volume(-10)
    assert manager.get_volume() == 0, "超出下限应限制为0"
    
    print("[PASS]test_volume_control 通过")


def test_sound_enabled():
    """测试声音启用状态"""
    manager = SoundManager()
    
    # 测试默认启用
    assert manager.is_sound_enabled(SoundType.NOTIFICATION) is True, "通知音应默认启用"
    
    # 测试禁用
    result = manager.set_sound_enabled(SoundType.NOTIFICATION, False)
    assert result is True, "设置启用状态应返回True"
    assert manager.is_sound_enabled(SoundType.NOTIFICATION) is False, "通知音应被禁用"
    
    # 恢复启用
    manager.set_sound_enabled(SoundType.NOTIFICATION, True)
    
    print("[PASS]test_sound_enabled 通过")


def test_get_all_sounds():
    """测试获取所有声音配置"""
    manager = SoundManager()
    
    all_sounds = manager.get_all_sounds()
    
    assert 'built_in' in all_sounds, "应有built_in字段"
    assert 'custom' in all_sounds, "应有custom字段"
    assert 'volume' in all_sounds, "应有volume字段"
    assert 'tts_enabled' in all_sounds, "应有tts_enabled字段"
    
    print("[PASS]test_get_all_sounds 通过")


def test_tts_enabled():
    """测试TTS启用状态"""
    manager = SoundManager()
    
    # 测试默认启用
    assert manager.is_tts_enabled() is True, "TTS应默认启用"
    
    # 测试禁用
    result = manager.set_tts_enabled(False)
    assert result is True, "设置TTS应返回True"
    assert manager.is_tts_enabled() is False, "TTS应被禁用"
    
    # 恢复启用
    manager.set_tts_enabled(True)
    
    print("[PASS]test_tts_enabled 通过")


def test_tts_rate():
    """测试TTS语速"""
    manager = SoundManager()
    
    # 测试正常范围
    result = manager.set_tts_rate(180)
    assert result is True, "设置语速应返回True"
    
    # 测试超出上限
    manager.set_tts_rate(500)
    assert manager.config.get('tts_rate', 0) <= 300, "语速应限制在300"
    
    # 测试超出下限
    manager.set_tts_rate(10)
    assert manager.config.get('tts_rate', 0) >= 50, "语速应限制在50"
    
    print("[PASS]test_tts_rate 通过")


def test_tts_volume():
    """测试TTS音量"""
    manager = SoundManager()
    
    # 测试正常范围
    result = manager.set_tts_volume(0.8)
    assert result is True, "设置TTS音量应返回True"
    assert manager.config.get('tts_volume', 0) == 0.8, "TTS音量应为0.8"
    
    # 测试超出上限
    manager.set_tts_volume(1.5)
    assert manager.config.get('tts_volume', 0) <= 1.0, "TTS音量应限制在1.0"
    
    # 测试超出下限
    manager.set_tts_volume(-0.5)
    assert manager.config.get('tts_volume', 0) >= 0.0, "TTS音量应限制在0.0"
    
    print("[PASS]test_tts_volume 通过")


def test_custom_sounds():
    """测试自定义音效"""
    manager = SoundManager()
    
    # 获取自定义音效列表
    custom = manager.get_custom_sounds()
    assert isinstance(custom, list), "自定义音效应为列表"
    
    # 测试添加自定义音效（使用不存在的文件，应失败）
    result = manager.add_custom_sound('测试音效', 'nonexistent.wav')
    assert result is False, "不存在的文件应返回False"
    
    print("[PASS]test_custom_sounds 通过")


def test_sound_types():
    """测试声音类型枚举"""
    assert SoundType.NOTIFICATION.value == "notification", "通知音类型应正确"
    assert SoundType.URGENT.value == "urgent", "紧急音类型应正确"
    assert SoundType.SUCCESS.value == "success", "成功音类型应正确"
    assert SoundType.WARNING.value == "warning", "警告音类型应正确"
    assert SoundType.REMINDER.value == "reminder", "提醒音类型应正确"
    assert SoundType.SCORE_INCREASE.value == "score_increase", "积分增加音类型应正确"
    assert SoundType.SCORE_DECREASE.value == "score_decrease", "积分减少音类型应正确"
    
    print("[PASS]test_sound_types 通过")


def test_get_instance():
    """测试单例模式"""
    from sound_manager import get_instance
    
    instance1 = get_instance()
    instance2 = get_instance()
    
    assert instance1 is instance2, "应返回同一个实例"
    print("[PASS]test_get_instance 通过")


if __name__ == '__main__':
    print("=" * 50)
    print("声音管理器测试")
    print("=" * 50)
    
    test_volume_control()
    test_sound_enabled()
    test_get_all_sounds()
    test_tts_enabled()
    test_tts_rate()
    test_tts_volume()
    test_custom_sounds()
    test_sound_types()
    test_get_instance()
    
    print("=" * 50)
    print("所有测试通过！")
    print("=" * 50)
