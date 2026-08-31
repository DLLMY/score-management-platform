from datetime import datetime
import os
import time
import json
import threading


import importlib


class ConfigLoader:
    _instance = None  # noqa: F841
    _lock = threading.Lock()  # noqa: F841

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._config_cache = {}
        self._config_mtime = {}
        self._config_dir = os.path.dirname(__file__)
        self._backend_dir = os.path.dirname(self._config_dir)
        self._config_module = None
        self._config_instance = None
        self._config_module_mtime = None
        self._watch_thread = None
        self._watch_interval = 30

    def _load_config_module(self):
        if self._config_module is not None:
            return self._config_module

        config_path = os.path.join(self._backend_dir, "config.py")
        if not os.path.exists(config_path):
            return None

        try:
            spec = importlib.util.spec_from_file_location("config_file", config_path)
            self._config_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(self._config_module)
            return self._config_module
        except Exception as e:
            print(f"[ConfigLoader] 加载config.py失败: {e}")
            return None

    def _get_config_instance(self):
        if self._config_instance is not None:
            return self._config_instance

        module = self._load_config_module()
        if module is None:
            return None

        try:
            self._config_instance = module.Config()
            return self._config_instance
        except Exception as e:
            print(f"[ConfigLoader] 创建Config实例失败: {e}")
            return None

    def get_config(self, key, default=None):
        config = self._get_config_instance()
        if config is None:
            return default
        return getattr(config, key, default)

    def get_mqtt_config(self):
        return {
            "broker": self.get_config("MQTT_BROKER"),
            "port": self.get_config("MQTT_PORT"),
            "client_id": self.get_config("MQTT_CLIENT_ID"),
            "username": self.get_config("MQTT_USERNAME"),
            "password": self.get_config("MQTT_PASSWORD"),
            "ssl": self.get_config("MQTT_SSL", True),
            "timeout": self.get_config("MQTT_TIMEOUT", 10),
            "keepalive": self.get_config("MQTT_KEEPALIVE", 60),
            "topic_prefix": self.get_config("MQTT_TOPIC_PREFIX", "phonebox"),
        }

    def get_redis_config(self):
        return {
            "host": self.get_config("REDIS_HOST", "localhost"),
            "port": self.get_config("REDIS_PORT", 6379),
            "db": self.get_config("REDIS_DB", 0),
            "password": self.get_config("REDIS_PASSWORD"),
        }

    def get_database_config(self):
        return {
            "uri": self.get_config("DATABASE_URI"),
            "track_modifications": self.get_config("SQLALCHEMY_TRACK_MODIFICATIONS", False),
            "engine_options": self.get_config("SQLALCHEMY_ENGINE_OPTIONS", {}),
        }

    def get_flask_config(self):
        return {
            "secret_key": self.get_config("FLASK_SECRET_KEY"),
            "debug": self.get_config("FLASK_DEBUG", False),
            "host": self.get_config("FLASK_HOST", "127.0.0.1"),
            "port": self.get_config("FLASK_PORT", 5000),
        }

    def get_jwt_config(self):
        return {
            "secret_key": self.get_config("JWT_SECRET_KEY"),
            "access_token_expires": self.get_config("JWT_ACCESS_TOKEN_EXPIRES"),
            "refresh_token_expires": self.get_config("JWT_REFRESH_TOKEN_EXPIRES"),
            "algorithm": self.get_config("JWT_ALGORITHM", "HS256"),
        }

    def get_celery_config(self):
        return {
            "broker_url": self.get_config("CELERY_BROKER_URL"),
            "result_backend": self.get_config("CELERY_RESULT_BACKEND"),
            "task_serializer": self.get_config("CELERY_TASK_SERIALIZER", "json"),
            "result_serializer": self.get_config("CELERY_RESULT_SERIALIZER", "json"),
            "accept_content": self.get_config("CELERY_ACCEPT_CONTENT", ["json"]),
            "timezone": self.get_config("CELERY_TIMEZONE", "Asia/Shanghai"),
            "enable_utc": self.get_config("CELERY_ENABLE_UTC", False),
            "worker_concurrency": self.get_config("CELERY_WORKER_CONCURRENCY", 4),
            "task_routes": self.get_config("CELERY_TASK_ROUTES", {}),
        }

    def _load_json(self, filename):
        path = os.path.join(self._config_dir, filename)
        if not os.path.exists(path):
            return None

        current_mtime = os.path.getmtime(path)

        if path in self._config_cache and path in self._config_mtime:
            if self._config_mtime[path] == current_mtime:
                return self._config_cache[path]

        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                self._config_cache[path] = data
                self._config_mtime[path] = current_mtime
                return data
        except Exception as e:
            print(f"[ConfigLoader] 加载配置文件失败 {filename}: {e}")
            if path in self._config_cache:
                return self._config_cache[path]
            return None

    def get_nlp_keywords(self):
        return self._load_json("nlp_keywords.json") or {}

    def get_intent_words(self):
        keywords = self.get_nlp_keywords()
        return keywords.get("intent_words", {})

    def get_keywords(self):
        keywords = self.get_nlp_keywords()
        return keywords.get("keywords", {})

    def get_invalid_names(self):
        keywords = self.get_nlp_keywords()
        return set(keywords.get("invalid_names", []))

    def get_name_patterns(self):
        keywords = self.get_nlp_keywords()
        return keywords.get("name_patterns", [])

    def get_name_prefix_words(self):
        keywords = self.get_nlp_keywords()
        return set(keywords.get("name_prefix_words", []))

    def get_name_suffix_words(self):
        keywords = self.get_nlp_keywords()
        return set(keywords.get("name_suffix_words", []))

    def get_behavior_patterns(self):
        keywords = self.get_nlp_keywords()
        return keywords.get("behavior_patterns", {})

    def get_synonym_expansion(self):
        keywords = self.get_nlp_keywords()
        return keywords.get("synonym_expansion", {})

    def get_antonym_pairs(self):
        keywords = self.get_nlp_keywords()
        return keywords.get("antonym_pairs", {})

    def get_referral_words(self):
        keywords = self.get_nlp_keywords()
        return keywords.get("referral_words", {})

    def get_position_weights(self):
        keywords = self.get_nlp_keywords()
        return keywords.get("position_weights", {})

    def get_keyword_importance(self):
        keywords = self.get_nlp_keywords()
        return keywords.get("keyword_importance", {})

    def reload_config(self):
        self._config_cache.clear()
        self._config_mtime.clear()
        self._config_module = None
        self._config_instance = None
        self._config_module_mtime = None
        print("[ConfigLoader] 配置已重新加载")

    def get_config_info(self):
        info = {}
        for path, mtime in self._config_mtime.items():
            info[os.path.basename(path)] = {
                "loaded_at": datetime.fromtimestamp(mtime).isoformat(),
                "size": os.path.getsize(path),
            }
        return info

    def _check_config_module_changes(self):
        config_path = os.path.join(self._backend_dir, "config.py")
        if not os.path.exists(config_path):
            return False

        try:
            current_mtime = os.path.getmtime(config_path)
            if self._config_module_mtime is None:
                self._config_module_mtime = current_mtime
                return False

            if current_mtime > self._config_module_mtime:
                print("[ConfigLoader] 检测到config.py变更，自动重新加载")
                self._config_module = None
                self._config_instance = None
                self._config_module_mtime = current_mtime
                return True
        except Exception as e:
            print(f"[ConfigLoader] 检查配置文件变更失败: {e}")

        return False

    def _config_watcher(self):
        while True:
            try:
                if self._check_config_module_changes():
                    print("[ConfigLoader] 配置热更新完成")
            except Exception as e:
                print(f"[ConfigLoader] 配置监控线程异常: {e}")
            time.sleep(self._watch_interval)

    def start_config_watcher(self, interval=None):
        if interval:
            self._watch_interval = interval

        if self._watch_thread is None or not self._watch_thread.is_alive():
            self._watch_thread = threading.Thread(
                target=self._config_watcher, daemon=True, name="config-watcher"
            )
            self._watch_thread.start()
            print(f"[ConfigLoader] 配置监控线程已启动，检查间隔: {self._watch_interval}秒")

    def stop_config_watcher(self):
        if self._watch_thread is not None:
            self._watch_thread = None
            print("[ConfigLoader] 配置监控线程已停止")

    def get_notification_config(self):
        return {
            "wechat_appid": self.get_config("WECHAT_APPID"),
            "wechat_secret": self.get_config("WECHAT_SECRET"),
            "wechat_template_unlock_success": self.get_config("WECHAT_TEMPLATE_UNLOCK_SUCCESS"),
            "wechat_template_unlock_failure": self.get_config("WECHAT_TEMPLATE_UNLOCK_FAILURE"),
            "wechat_template_score_change": self.get_config("WECHAT_TEMPLATE_SCORE_CHANGE"),
            "sms_provider": self.get_config("SMS_PROVIDER"),
            "sms_access_key_id": self.get_config("SMS_ACCESS_KEY_ID"),
            "sms_access_key_secret": self.get_config("SMS_ACCESS_KEY_SECRET"),
            "sms_sign_name": self.get_config("SMS_SIGN_NAME"),
            "sms_template_code": self.get_config("SMS_TEMPLATE_CODE"),
            "enable_wechat": self.get_config("ENABLE_WECHAT_NOTIFICATION", True),
            "enable_sms": self.get_config("ENABLE_SMS_NOTIFICATION", False),
        }

    def get_rate_limit_config(self):
        return {
            "default_limit": self.get_config("RATE_LIMIT_DEFAULT", "5000 per hour"),
            "strict_limit": self.get_config("RATE_LIMIT_STRICT", "1000 per hour"),
            "burst_limit": self.get_config("RATE_LIMIT_BURST", "100 per minute"),
            "storage_uri": self.get_config("RATE_LIMIT_STORAGE_URI"),
        }

    def get_logging_config(self):
        return {
            "level": self.get_config("LOG_LEVEL", "INFO"),
            "format": self.get_config(
                "LOG_FORMAT", "%(asctime)s %(levelname)s %(name)s: %(message)s"
            ),
            "file_path": self.get_config("LOG_FILE_PATH", "logs/app.log"),
            "max_size": self.get_config("LOG_MAX_SIZE", 10 * 1024 * 1024),
            "backup_count": self.get_config("LOG_BACKUP_COUNT", 5),
        }


config_loader = ConfigLoader()
