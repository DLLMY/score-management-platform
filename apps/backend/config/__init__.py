import importlib.util
import os
import sys

"""
配置模块初始化
统一从 config.py 导入配置项，保持向后兼容。

实现说明（2026-10-23 重构）：
此前本文件手工逐条 re-export config.py 的 ~40 个常量，新增常量必须同时在两处
登记，否则消费者 `from config import X` 会触发 ImportError 链式崩溃（celery 修复时
曾踩中 CELERY_TASK_DEFAULT_QUEUE）。现改为**程序化 re-export**：加载 config.py 后
动态暴露 Config 实例（及模块顶层）的全部 UPPER_CASE 配置属性，彻底消除漏登记隐患，
且消费者 import 路径零改动。
"""

_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)
_config_path = os.path.join(_backend_dir, "config.py")
_spec = importlib.util.spec_from_file_location("config_file", _config_path)
_config_module = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_config_module)
Config = _config_module.Config
config = Config()

# 程序化 re-export：动态暴露 Config 实例（及模块顶层）的全部 UPPER_CASE 配置属性，
# 消除手工逐条登记的漏登记隐患（消费者 `from config import X` 不再因遗漏而 ImportError）。
# 注：真实常量定义在 Config 类/实例上（`config.CELERY_BROKER_URL` 等），不在
# config.py 模块顶层，故主遍历 config 实例，再补充模块顶层常量。
_EXCLUDED = {
    "__builtins__",
    "__doc__",
    "__file__",
    "__name__",
    "__package__",
    "__loader__",
    "__spec__",
    "__annotations__",
}
__all__ = ["Config", "config"]
_seen = set()
for _src in (config, _config_module):
    for _name in dir(_src):
        if _name.startswith("_"):
            continue
        if _name in _EXCLUDED:
            continue
        if _name.isupper() and _name not in _seen:
            globals()[_name] = getattr(_src, _name)
            __all__.append(_name)
            _seen.add(_name)
__all__ = sorted(__all__)
