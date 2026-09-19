from datetime import datetime
from models import db


class NLPScoringRule(db.Model):
    """NLP评分规则"""

    __tablename__ = "nlp_scoring_rules"

    id = db.Column(db.Integer, primary_key=True)
    behavior_keyword = db.Column(db.String(200), index=True)
    behavior_description = db.Column(db.String(500))
    score_value = db.Column(db.Float)
    score_type = db.Column(db.String(20))
    _behavior_tags = db.Column("behavior_tags", db.JSON)
    match_pattern = db.Column(db.String(500))
    priority = db.Column(db.Integer)
    usage_count = db.Column(db.Integer)
    accuracy_rate = db.Column(db.Float)
    is_active = db.Column(db.Boolean)
    created_by = db.Column(db.Integer)
    created_at = db.Column(db.DateTime)
    updated_at = db.Column(db.DateTime)
    last_used_at = db.Column(db.String(50))
    rule_name = db.Column(db.String(200))
    rule_type = db.Column(db.String(50))
    condition = db.Column(db.Text)
    # P1-2 统一：行为分变动统一 Float（迁移 migrate_nlp_score_change_float.py 同步 DB 列 REAL）
    score_change = db.Column(db.Float)

    @property
    def behavior_tags(self):
        import json

        if not self._behavior_tags:
            return []
        if isinstance(self._behavior_tags, list):
            return self._behavior_tags
        try:
            return json.loads(self._behavior_tags)
        except (json.JSONDecodeError, TypeError):
            return [str(self._behavior_tags)]

    @behavior_tags.setter
    def behavior_tags(self, value):
        import json

        if isinstance(value, list):
            self._behavior_tags = json.dumps(value, ensure_ascii=False)
        else:
            self._behavior_tags = value



    def to_dict(self, fields=None):
        data = {
            "id": self.id,
            "behavior_keyword": self.behavior_keyword,
            "behavior_description": self.behavior_description,
            "score_value": self.score_value,
            "score_type": self.score_type,
            "_behavior_tags": self._behavior_tags,
            "match_pattern": self.match_pattern,
            "priority": self.priority,
            "usage_count": self.usage_count,
            "accuracy_rate": self.accuracy_rate,
            "is_active": self.is_active,
            "created_by": self.created_by,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "last_used_at": self.last_used_at,
            "rule_name": self.rule_name,
            "rule_type": self.rule_type,
            "condition": self.condition,
            "score_change": self.score_change,
        }
        if fields:
            return {k: v for k, v in data.items() if k in fields}
        return data
class NLPBehaviorKeyword(db.Model):
    """NLP行为关键词"""

    __tablename__ = "nlp_behavior_keywords"

    id = db.Column(db.Integer, primary_key=True)
    keyword = db.Column(db.String(50))
    keyword_type = db.Column(db.String(20))
    score_weight = db.Column(db.Float)
    description = db.Column(db.String(200))
    is_active = db.Column(db.Boolean)
    created_at = db.Column(db.DateTime)
    score_type = db.Column(db.Text)
    default_score = db.Column(db.Integer)
    _synonyms = db.Column("synonyms", db.Text)
    behavior_type = db.Column(db.Text)
    category = db.Column(db.Text)
    weight = db.Column(db.Integer)

    @property
    def synonyms(self):
        import json

        if not self._synonyms:
            return []
        try:
            return json.loads(self._synonyms)
        except (json.JSONDecodeError, TypeError):
            return [s.strip() for s in str(self._synonyms).split(",") if s.strip()]

    @synonyms.setter
    def synonyms(self, value):
        import json

        if value is None:
            self._synonyms = None
        elif isinstance(value, (list, tuple)):
            self._synonyms = json.dumps(list(value), ensure_ascii=False)
        else:
            self._synonyms = str(value)



    def to_dict(self, fields=None):
        data = {
            "id": self.id,
            "keyword": self.keyword,
            "keyword_type": self.keyword_type,
            "score_weight": self.score_weight,
            "description": self.description,
            "is_active": self.is_active,
            "created_at": self.created_at,
            "score_type": self.score_type,
            "default_score": self.default_score,
            "_synonyms": self._synonyms,
            "behavior_type": self.behavior_type,
            "category": self.category,
            "weight": self.weight,
        }
        if fields:
            return {k: v for k, v in data.items() if k in fields}
        return data
class NLPMatchResult(db.Model):
    """NLP匹配结果"""

    __tablename__ = "nlp_match_results"

    id = db.Column(db.Integer, primary_key=True)
    input_text = db.Column(db.String(500), nullable=False)
    matched_rule_id = db.Column(db.Integer, index=True)
    matched_keyword = db.Column(db.String(100))
    intent = db.Column(db.String(20))
    confidence = db.Column(db.Float)
    student_id = db.Column(db.Integer, db.ForeignKey("user.id"), index=True)
    behavior_description = db.Column(db.String(500))
    score_change = db.Column(db.Float, default=0)
    is_manual_correction = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)



    def to_dict(self, fields=None):
        data = {
            "id": self.id,
            "input_text": self.input_text,
            "matched_rule_id": self.matched_rule_id,
            "matched_keyword": self.matched_keyword,
            "intent": self.intent,
            "confidence": self.confidence,
            "student_id": self.student_id,
            "behavior_description": self.behavior_description,
            "score_change": self.score_change,
            "is_manual_correction": self.is_manual_correction,
            "created_at": self.created_at,
        }
        if fields:
            return {k: v for k, v in data.items() if k in fields}
        return data
class NLPRuleUsage(db.Model):
    """NLP规则使用记录"""

    __tablename__ = "nlp_rule_usages"

    id = db.Column(db.Integer, primary_key=True)
    rule_id = db.Column(db.Integer, index=True)
    # P0-1 统一：学生标识列名 student_id（曾为 user_id，迁移脚本 migrate_nlp_rule_usage_student_id.py 同步 DB）
    student_id = db.Column(db.Integer, index=True)
    input_text = db.Column(db.Text)
    matched_keyword = db.Column(db.String(200))
    # P1-2 统一：行为分变动统一 Float（迁移 migrate_nlp_score_change_float.py 同步 DB 列 REAL）
    score_change = db.Column(db.Float)
    is_manual_correction = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)



    def to_dict(self, fields=None):
        data = {
            "id": self.id,
            "rule_id": self.rule_id,
            "student_id": self.student_id,
            "input_text": self.input_text,
            "matched_keyword": self.matched_keyword,
            "score_change": self.score_change,
            "is_manual_correction": self.is_manual_correction,
            "created_at": self.created_at,
        }
        if fields:
            return {k: v for k, v in data.items() if k in fields}
        return data
class NLPModelTraining(db.Model):
    """NLP模型训练记录"""

    __tablename__ = "nlp_model_trainings"

    id = db.Column(db.Integer, primary_key=True)
    model_name = db.Column(db.String(200), nullable=False, index=True)
    status = db.Column(db.String(20), default="pending", index=True)
    algorithm_type = db.Column(db.String(50), index=True)
    training_data_size = db.Column(db.Integer, default=0)
    accuracy = db.Column(db.Float)
    f1_score = db.Column(db.Float)
    precision = db.Column(db.Float)
    recall = db.Column(db.Float)
    results = db.Column(db.JSON)
    trained_by = db.Column(db.Integer)
    error_message = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)
    trained_at = db.Column(db.DateTime, default=datetime.now)


class NLPCorrection(db.Model):
    """NLP纠错记录"""

    __tablename__ = "nlp_corrections"

    id = db.Column(db.Integer, primary_key=True)
    input_text = db.Column(db.String(500), nullable=False)
    original_result = db.Column(db.JSON)
    corrected_result = db.Column(db.JSON)
    corrected_by = db.Column(db.Integer)
    is_validated = db.Column(db.Boolean, default=False)
    validated_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)

    # 自学习纠错相关字段（与 api/nlp_routes.py、services/nlp_enhanced_service.py 对齐）
    original_text = db.Column(db.String(1000), nullable=True)  # 被纠正的原始输入文本
    field_type = db.Column(db.String(50), nullable=True)  # name / intent / score
    original_value = db.Column(db.String(500), nullable=True)  # 原预测值
    corrected_value = db.Column(db.String(500), nullable=True)  # 用户纠正后的值
    status = db.Column(db.String(50), default="pending")  # pending / approved / learned / rejected
    confidence_after = db.Column(db.Float, nullable=True)  # 纠正后置信度
    learn_count = db.Column(db.Integer, default=0)  # 被归纳学习引用的次数
    last_learned_at = db.Column(db.DateTime, nullable=True)  # 最近一次被归纳学习的时间
    verified_at = db.Column(db.DateTime, nullable=True)  # 审核/确认时间


    def to_dict(self, fields=None):
        data = {
            "id": self.id,
            "input_text": self.input_text,
            "original_result": self.original_result,
            "corrected_result": self.corrected_result,
            "corrected_by": self.corrected_by,
            "is_validated": self.is_validated,
            "validated_at": self.validated_at,
            "created_at": self.created_at,
            "original_text": self.original_text,
            "field_type": self.field_type,
            "original_value": self.original_value,
            "corrected_value": self.corrected_value,
            "status": self.status,
            "confidence_after": self.confidence_after,
            "learn_count": self.learn_count,
            "last_learned_at": self.last_learned_at,
            "verified_at": self.verified_at,
        }
        if fields:
            return {k: v for k, v in data.items() if k in fields}
        return data