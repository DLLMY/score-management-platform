"""基础：__init__（vectorizer/models/feature_service 初始化 + _init_models 装配入口）。"""

from services.nlp_ml._feature_engineering import FeatureEngineeringService


class _BaseMixin:
    def __init__(self):
        self.vectorizer = None
        self.models = {}
        self.feature_service = FeatureEngineeringService()
        self._init_models()
