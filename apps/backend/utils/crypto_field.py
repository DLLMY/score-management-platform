"""敏感字段静态加密（at-rest encryption）。

为 ``MQTTConfig.password`` / ``Device.device_secret`` 等凭据列提供透明的落库加密：
- 写入（``process_bind_param``）自动用 Fernet（AES-128-CBC + HMAC-SHA256）加密；
- 读取（``process_result_value``）自动解密还原明文；
- 所有调用点（赋值 / 读取 / 验签）零改动。

密钥派生：Flask ``SECRET_KEY``（config.py 缺省回退生成，始终存在；config_validator
强制生产 ≥32 字节且拒绝默认值）经 SHA-256 派生为 Fernet 所需的 32 字节密钥。
不引入独立密钥管理面，复用既有的主密钥源，避免新增运维负担。

向后兼容：密文以 ``enc:`` 哨兵前缀标记；既有明文行（无前缀）读取时原样返回，
并在下次写入时自然转密（迁移零停机、无需一次性脚本）。
"""
import base64
import hashlib

from cryptography.fernet import Fernet
from flask import current_app
from sqlalchemy.types import String, TypeDecorator

_PREFIX = "enc:"
_KEY_CACHE = {}


def _get_fernet():
    """从当前 app 的 SECRET_KEY 派生并缓存 Fernet 实例。"""
    secret_key = current_app.config.get("SECRET_KEY")
    if not secret_key:
        raise RuntimeError("SECRET_KEY 未配置，无法对敏感字段加解密")
    if isinstance(secret_key, str):
        secret_key = secret_key.encode("utf-8")
    derived = hashlib.sha256(secret_key).digest()
    fernet = _KEY_CACHE.get(derived)
    if fernet is None:
        fernet = Fernet(base64.urlsafe_b64encode(derived))
        _KEY_CACHE[derived] = fernet
    return fernet


def encrypt_value(value):
    """加密字段值；None 透传；已是 ``enc:`` 密文则不重复加密（幂等）。"""
    if value is None:
        return None
    if isinstance(value, str) and value.startswith(_PREFIX):
        return value
    token = _get_fernet().encrypt(value.encode("utf-8")).decode("utf-8")
    return _PREFIX + token


def decrypt_value(value):
    """解密字段值；None 透传；无 ``enc:`` 前缀视为既有明文（向后兼容）。"""
    if value is None:
        return None
    if isinstance(value, str) and value.startswith(_PREFIX):
        try:
            return _get_fernet().decrypt(value[len(_PREFIX) :].encode("utf-8")).decode("utf-8")
        except Exception:
            # 密钥轮换等极端情况下解密失败，返回裸值避免崩溃（不泄露明文到日志）。
            return value[len(_PREFIX) :]
    return value


class EncryptedString(TypeDecorator):
    """透明静态加密字符串列。DDL 等同 String，仅在读写边界加/解密。"""

    impl = String
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return encrypt_value(value)

    def process_result_value(self, value, dialect):
        return decrypt_value(value)
