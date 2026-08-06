from abc import ABC, abstractmethod
from typing import Optional, Callable


class IMQTTClient(ABC):

    @abstractmethod
    def connect(self, config: Optional[dict] = None) -> bool:
        pass

    @abstractmethod
    def disconnect(self) -> None:
        pass

    @abstractmethod
    def publish(self, topic: str, payload: str, qos: int = 1) -> bool:
        pass

    @abstractmethod
    def subscribe(self, topic: str, qos: int = 1) -> bool:
        pass

    @abstractmethod
    def unsubscribe(self, topic: str) -> bool:
        pass

    @abstractmethod
    def add_message_callback(self, callback: Callable) -> None:
        pass

    @abstractmethod
    def remove_message_callback(self, callback: Callable) -> None:
        pass

    @abstractmethod
    def get_status(self) -> dict:
        pass

    @property
    @abstractmethod
    def is_connected(self) -> bool:
        pass

    @property
    @abstractmethod
    def subscribed_topics(self) -> list:
        pass


class IMQTTCache(ABC):

    @abstractmethod
    def get_cached_user(self, card_id: str) -> Optional[dict]:
        pass

    @abstractmethod
    def set_cached_user(self, card_id: str, user: dict) -> None:
        pass

    @abstractmethod
    def clear_cache(self) -> None:
        pass


class IMQTTMessageProcessor(ABC):

    @abstractmethod
    def process_messages_batch(self, messages: list) -> None:
        pass

    @abstractmethod
    def process_critical_message(self, topic: str, message: str, callbacks: Optional[list] = None) -> None:
        pass


class IMQTTManager(ABC):

    @abstractmethod
    def connect(self, config: Optional[dict] = None) -> bool:
        pass

    @abstractmethod
    def disconnect(self) -> None:
        pass

    @abstractmethod
    def publish(self, topic: str, payload: str, qos: int = 1) -> bool:
        pass

    @abstractmethod
    def subscribe(self, topic: str, qos: int = 1) -> bool:
        pass

    @abstractmethod
    def unsubscribe(self, topic: str) -> bool:
        pass

    @abstractmethod
    def get_status(self) -> dict:
        pass

    @abstractmethod
    def get_cached_user(self, card_id: str) -> Optional[dict]:
        pass

    @abstractmethod
    def set_cached_user(self, card_id: str, user: dict) -> None:
        pass

    @abstractmethod
    def clear_cache(self) -> None:
        pass

    @property
    @abstractmethod
    def is_connected(self) -> bool:
        pass

    @property
    @abstractmethod
    def subscribed_topics(self) -> list:
        pass
