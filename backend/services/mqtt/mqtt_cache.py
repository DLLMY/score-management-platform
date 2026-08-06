from .mqtt_interface import IMQTTCache
import time
import threading


class MQTTCache(IMQTTCache):

    def __init__(self):
        self._user_cache = {}
        self._cache_lock = threading.Lock()
        self._cache_ttl = 60

    def get_cached_user(self, card_id):
        with self._cache_lock:
            if card_id in self._user_cache:
                cached = self._user_cache[card_id]
                if time.time() - cached["timestamp"] < self._cache_ttl:
                    return cached["user"]
                else:
                    del self._user_cache[card_id]
        return None

    def set_cached_user(self, card_id, user):
        with self._cache_lock:
            self._user_cache[card_id] = {
                "user": user,
                "timestamp": time.time(),
            }

    def clear_cache(self):
        with self._cache_lock:
            self._user_cache.clear()

    def get_cache_stats(self):
        with self._cache_lock:
            return {
                "cache_size": len(self._user_cache),
                "ttl": self._cache_ttl,
            }
