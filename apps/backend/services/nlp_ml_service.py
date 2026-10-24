"""NLP ML 训练服务（组合层；原单体 1897 行按领域拆分至 services/nlp_ml/ 包）。

拆分结构（零行为变更）：
- _shared.py：可选依赖探测 + flag + MODEL_DIR（单一来源）
- _types.py：MLAlgorithmType / HyperparameterConfig
- _feature_engineering.py：FeatureEngineeringService
- _model_wrappers.py：_SklearnTextCNNWrapper / _SklearnBertWrapper
- _base/_models/_fusion/_training/_prediction/_orchestration_mixin.py：37 个方法按领域收容

本类仅作多继承组合，__module__ 不变；消费者 from services.nlp_ml_service import NLPMLTrainingService / MLAlgorithmType / HyperparameterConfig / FeatureEngineeringService / _SklearnTextCNNWrapper / _SklearnBertWrapper 的导入面保持不变。
"""

from services.nlp_ml._base_mixin import _BaseMixin
from services.nlp_ml._feature_engineering import FeatureEngineeringService
from services.nlp_ml._fusion_mixin import _FusionMixin
from services.nlp_ml._model_wrappers import _SklearnBertWrapper, _SklearnTextCNNWrapper
from services.nlp_ml._models_mixin import _ModelsMixin
from services.nlp_ml._orchestration_mixin import _OrchestrationMixin
from services.nlp_ml._prediction_mixin import _PredictionMixin
from services.nlp_ml._training_mixin import _TrainingMixin
from services.nlp_ml._types import HyperparameterConfig, MLAlgorithmType

__all__ = [
    "FeatureEngineeringService",
    "HyperparameterConfig",
    "MLAlgorithmType",
    "NLPMLTrainingService",
    "_SklearnBertWrapper",
    "_SklearnTextCNNWrapper",
]


class NLPMLTrainingService(
    _BaseMixin,
    _ModelsMixin,
    _FusionMixin,
    _TrainingMixin,
    _PredictionMixin,
    _OrchestrationMixin,
):
    """NLP ML 训练服务（模型装配 / 训练 / 预测 / 评估全链路）。

    原单体类（约 1237 行，37 方法）按领域拆分为 services/nlp_ml/ 下的 mixin 子模块，
    本类仅作多继承组合，行为与拆分前完全一致。
    """
