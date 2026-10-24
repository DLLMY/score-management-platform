"""NLP 规则管理服务（组合层；原单体 539 行按领域拆分至 services/nlp_rule/ 包）。

拆分结构（零行为变更）：
- _base_mixin.py：__init__ + 序列化助手
- _crud_mixin.py：规则 CRUD 与批量导入
- _stats_mixin.py：统计与推荐
- _training_mixin.py：模型训练与评分助手

本类仅作多继承组合，__module__ 不变；消费者 from services.nlp_rule_service import NLPRuleManagementService 的导入面保持不变。
"""

from services.nlp_rule._base_mixin import _BaseMixin
from services.nlp_rule._crud_mixin import _CrudMixin
from services.nlp_rule._stats_mixin import _StatsMixin
from services.nlp_rule._training_mixin import _TrainingMixin

__all__ = ["NLPRuleManagementService"]


class NLPRuleManagementService(_BaseMixin, _CrudMixin, _StatsMixin, _TrainingMixin):
    """规则管理服务

    原单体类（539 行，20 方法）按领域拆分为 services/nlp_rule/ 下的 mixin 子模块，
    本类仅作多继承组合，行为与拆分前完全一致。
    """
