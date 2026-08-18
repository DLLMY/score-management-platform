# -*- coding: utf-8 -*-
"""
声音管理器模块

功能：
- 音量分级控制 (0-100%)
- 声音类型分类管理（通知音、提示音、紧急音等）
- 自定义音效上传功能
- TTS语音播报

作者：开发团队
日期：2026-06-18
"""

import json
import os
import winsound
import threading
from enum import Enum
from typing import Optional, Dict, List

# TTS引擎
try:
    import pyttsx3
    HAS_TTS = True
except ImportError:
    HAS_TTS = False
    print("[声音] pyttsx3未安装，语音播报功能将不可用")


class SoundType(Enum):
    """声音类型枚举"""
    NOTIFICATION = "notification"      # 通知音
    URGENT = "urgent"                  # 紧急音
    SUCCESS = "success"                # 成功音
    WARNING = "warning"                # 警告音
    REMINDER = "reminder"              # 提醒音
    SCORE_INCREASE = "score_increase"  # 积分增加
    SCORE_DECREASE = "score_decrease"  # 积分减少


class SoundManager:
    """声音管理器"""
    
    def __init__(self, config_path: str = 'sound_config.json'):
        """
        初始化声音管理器
        
        Args:
            config_path: 配置文件路径
        """
        self.config_path = config_path
        self.config = self._load_config()
        self.volume = self.config.get('volume', 70)  # 默认70%
        self._tts_engine = None
        self._tts_lock = threading.Lock()
        
    def _load_config(self) -> Dict:
        """加载声音配置"""
        default_config = {
            'version': '1.0',
            'volume': 70,
            'tts_enabled': True,
            'tts_rate': 150,
            'tts_volume': 1.0,
            'sounds': {
                SoundType.NOTIFICATION.value: {
                    'file': 'sounds/notification.wav',
                    'enabled': True,
                    'name': '通知音'
                },
                SoundType.URGENT.value: {
                    'file': 'sounds/urgent.wav',
                    'enabled': True,
                    'name': '紧急音'
                },
                SoundType.SUCCESS.value: {
                    'file': 'sounds/success.wav',
                    'enabled': True,
                    'name': '成功音'
                },
                SoundType.WARNING.value: {
                    'file': 'sounds/warning.wav',
                    'enabled': True,
                    'name': '警告音'
                },
                SoundType.REMINDER.value: {
                    'file': 'sounds/reminder.wav',
                    'enabled': True,
                    'name': '提醒音'
                },
                SoundType.SCORE_INCREASE.value: {
                    'file': 'sounds/score_up.wav',
                    'enabled': True,
                    'name': '积分增加音'
                },
                SoundType.SCORE_DECREASE.value: {
                    'file': 'sounds/score_down.wav',
                    'enabled': True,
                    'name': '积分减少音'
                }
            },
            'custom_sounds': [],
            'play_system_sound_fallback': True  # 文件不存在时播放系统声音
        }
        
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    loaded = json.load(f)
                    # 合并默认配置
                    for key in default_config:
                        if key not in loaded:
                            loaded[key] = default_config[key]
                    return loaded
            except Exception as e:
                print(f"[声音] 加载配置失败: {e}")
                return default_config
        else:
            self._save_config(default_config)
            return default_config
            
    def _save_config(self, config: Dict = None):
        """保存声音配置"""
        data = config if config is not None else self.config
        try:
            with open(self.config_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"[声音] 保存配置失败: {e}")
            return False
            
    def set_volume(self, level: int) -> bool:
        """
        设置音量 (0-100)
        
        Args:
            level: 音量级别 (0-100)
            
        Returns:
            bool: 是否设置成功
        """
        self.volume = max(0, min(100, level))
        self.config['volume'] = self.volume
        return self._save_config()
        
    def get_volume(self) -> int:
        """获取当前音量"""
        return self.volume
        
    def is_sound_enabled(self, sound_type: SoundType) -> bool:
        """检查指定声音是否启用"""
        return self.config.get('sounds', {}).get(sound_type.value, {}).get('enabled', True)
        
    def set_sound_enabled(self, sound_type: SoundType, enabled: bool) -> bool:
        """设置声音启用状态"""
        if sound_type.value in self.config.get('sounds', {}):
            self.config['sounds'][sound_type.value]['enabled'] = enabled
            return self._save_config()
        return False
        
    def play_sound(self, sound_type: SoundType):
        """播放指定类型的声音"""
        if not self.is_sound_enabled(sound_type):
            print(f"[声音] {sound_type.value} 已禁用")
            return
            
        sound_config = self.config['sounds'].get(sound_type.value, {})
        sound_file = sound_config.get('file', '')
        
        # 确保sounds目录存在
        if sound_file:
            sound_dir = os.path.dirname(sound_file)
            if sound_dir and not os.path.exists(sound_dir):
                os.makedirs(sound_dir, exist_ok=True)
                
        if sound_file and os.path.exists(sound_file):
            self._play_wav_file(sound_file)
        else:
            # 使用系统默认音效
            self._play_system_sound(sound_type)
            
    def _play_wav_file(self, file_path: str):
        """播放WAV文件"""
        try:
            # 考虑音量
            volume_factor = self.volume / 100.0
            
            def _play():
                try:
                    winsound.PlaySound(file_path, winsound.SND_FILENAME)
                except Exception as e:
                    print(f"[声音] 播放文件失败: {e}")
                    
            threading.Thread(target=_play, daemon=True).start()
        except Exception as e:
            print(f"[声音] 播放失败: {e}")
            
    def _play_system_sound(self, sound_type: SoundType):
        """播放系统默认音效"""
        if not self.config.get('play_system_sound_fallback', True):
            return
            
        sound_map = {
            SoundType.NOTIFICATION: winsound.MB_ICONASTERISK,
            SoundType.URGENT: winsound.MB_ICONHAND,
            SoundType.SUCCESS: winsound.MB_ICONASTERISK,
            SoundType.WARNING: winsound.MB_ICONEXCLAMATION,
            SoundType.REMINDER: winsound.MB_ICONASTERISK,
            SoundType.SCORE_INCREASE: winsound.MB_ICONASTERISK,
            SoundType.SCORE_DECREASE: winsound.MB_ICONQUESTION
        }
        
        flags = sound_map.get(sound_type, winsound.MB_OK)
        
        def _play():
            try:
                winsound.MessageBeep(flags)
            except Exception as e:
                print(f"[声音] 系统声音播放失败: {e}")
                
        threading.Thread(target=_play, daemon=True).start()
        
    def add_custom_sound(self, name: str, file_path: str) -> bool:
        """
        添加自定义音效
        
        Args:
            name: 音效名称
            file_path: 音效文件路径
            
        Returns:
            bool: 是否添加成功
        """
        if not os.path.exists(file_path):
            print(f"[声音] 文件不存在: {file_path}")
            return False
            
        # 复制到sounds目录
        sounds_dir = 'sounds'
        if not os.path.exists(sounds_dir):
            os.makedirs(sounds_dir, exist_ok=True)
            
        import shutil
        dest_path = os.path.join(sounds_dir, os.path.basename(file_path))
        
        try:
            shutil.copy2(file_path, dest_path)
            
            custom_sound = {
                'name': name,
                'file': dest_path,
                'type': 'custom'
            }
            
            if 'custom_sounds' not in self.config:
                self.config['custom_sounds'] = []
            self.config['custom_sounds'].append(custom_sound)
            
            return self._save_config()
        except Exception as e:
            print(f"[声音] 添加自定义音效失败: {e}")
            return False
            
    def remove_custom_sound(self, name: str) -> bool:
        """移除自定义音效"""
        custom_sounds = self.config.get('custom_sounds', [])
        self.config['custom_sounds'] = [s for s in custom_sounds if s.get('name') != name]
        return self._save_config()
        
    def get_custom_sounds(self) -> List[Dict]:
        """获取自定义音效列表"""
        return self.config.get('custom_sounds', [])
        
    def get_all_sounds(self) -> Dict:
        """获取所有声音配置"""
        return {
            'built_in': self.config.get('sounds', {}),
            'custom': self.get_custom_sounds(),
            'volume': self.volume,
            'tts_enabled': self.config.get('tts_enabled', True)
        }
        
    # ===== TTS语音功能 =====
    def _get_tts_engine(self):
        """获取TTS引擎单例"""
        if not HAS_TTS:
            return None
            
        if self._tts_engine is None:
            with self._tts_lock:
                if self._tts_engine is None:
                    try:
                        engine = pyttsx3.init()
                        
                        # 设置为中文语音
                        voices = engine.getProperty('voices')
                        for voice in voices:
                            voice_name = getattr(voice, 'name', '')
                            languages = getattr(voice, 'languages', [])
                            
                            # 检查是否为中文语音
                            is_chinese = (
                                'chinese' in voice_name.lower() or
                                any('zh' in str(l).lower() for l in languages)
                            )
                            
                            if is_chinese:
                                engine.setProperty('voice', getattr(voice, 'id', ''))
                                print(f"[语音] 使用中文语音: {voice_name}")
                                break
                                
                        engine.setProperty('rate', self.config.get('tts_rate', 150))
                        engine.setProperty('volume', self.config.get('tts_volume', 1.0))
                        self._tts_engine = engine
                        print("[语音] TTS引擎初始化成功")
                    except Exception as e:
                        print(f"[语音] TTS引擎初始化失败: {e}")
                        return None
                        
        return self._tts_engine
        
    def speak(self, text: str):
        """语音播报文本"""
        if not self.config.get('tts_enabled', True):
            print(f"[语音] TTS已禁用，播报内容: {text}")
            return
            
        if not HAS_TTS:
            print(f"[语音] TTS不可用，播报内容: {text}")
            return
            
        def _speak():
            try:
                engine = self._get_tts_engine()
                if engine:
                    engine.say(text)
                    engine.runAndWait()
                else:
                    print(f"[语音] 播报内容: {text}")
            except Exception as e:
                print(f"[语音] 播报失败: {e}")
                # 重置引擎
                self._tts_engine = None
                
        threading.Thread(target=_speak, daemon=True).start()
        
    def set_tts_enabled(self, enabled: bool) -> bool:
        """设置TTS启用状态"""
        self.config['tts_enabled'] = enabled
        return self._save_config()
        
    def is_tts_enabled(self) -> bool:
        """检查TTS是否启用"""
        return self.config.get('tts_enabled', True)
        
    def set_tts_rate(self, rate: int) -> bool:
        """设置TTS语速"""
        self.config['tts_rate'] = max(50, min(300, rate))
        if self._tts_engine:
            self._tts_engine.setProperty('rate', self.config['tts_rate'])
        return self._save_config()
        
    def set_tts_volume(self, volume: float) -> bool:
        """设置TTS音量"""
        self.config['tts_volume'] = max(0.0, min(1.0, volume))
        if self._tts_engine:
            self._tts_engine.setProperty('volume', self.config['tts_volume'])
        return self._save_config()


# 单例模式
_instance = None
_lock = threading.Lock()

def get_instance() -> SoundManager:
    """获取声音管理器单例"""
    global _instance
    if _instance is None:
        with _lock:
            if _instance is None:
                _instance = SoundManager()
    return _instance


# 测试代码
if __name__ == '__main__':
    print("测试声音管理器...")
    
    manager = SoundManager()
    
    # 测试音量控制
    print(f"当前音量: {manager.get_volume()}")
    manager.set_volume(50)
    print(f"设置后音量: {manager.get_volume()}")
    
    # 测试声音播放
    print("\n测试播放各种声音...")
    for sound_type in SoundType:
        print(f"播放: {sound_type.value}")
        manager.play_sound(sound_type)
        import time
        time.sleep(0.5)
        
    # 测试TTS
    print("\n测试TTS语音...")
    manager.speak("这是一条测试语音，您好！")
    
    print("\n声音管理器测试完成")
