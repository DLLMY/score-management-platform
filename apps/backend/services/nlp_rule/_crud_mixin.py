"""规则 CRUD 与批量导入：列表/详情/创建/更新/删除/用量查询/批量导入。"""

from datetime import datetime

from models import (
    NLPBehaviorKeyword,
    NLPMatchResult,
    NLPModelTraining,
    NLPRuleUsage,
    NLPScoringRule,
    db,
    get_by_id,
)
from utils.db_session import db_session_scope


class _CrudMixin:
    def get_rules(
        self,
        page=1,
        per_page=20,
        keyword=None,
        score_type=None,
        sort_by="created_at",
        sort_order="desc",
    ):
        """获取规则列表"""
        valid_sort_fields = [
            "id",
            "behavior_keyword",
            "behavior_description",
            "score_value",
            "score_type",
            "priority",
            "usage_count",
            "accuracy_rate",
            "created_at",
            "updated_at",
            "last_used_at",
        ]
        if sort_by not in valid_sort_fields:
            sort_by = "created_at"

        query = NLPScoringRule.query.filter(NLPScoringRule.is_active)

        if keyword:
            query = query.filter(
                NLPScoringRule.behavior_keyword.like(f"%{keyword}%")
                | NLPScoringRule.behavior_description.like(f"%{keyword}%")
            )

        if score_type:
            query = query.filter(NLPScoringRule.score_type == score_type)

        sort_column = getattr(NLPScoringRule, sort_by)
        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())

        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        return {
            "items": [self._rule_to_dict(rule) for rule in pagination.items],
            "total": pagination.total,
            "page": page,
            "per_page": per_page,
            "pages": pagination.pages,
        }

    def get_rule(self, rule_id):
        """获取单个规则"""
        rule = get_by_id(NLPScoringRule, rule_id)
        if not rule:
            return None
        return self._rule_to_dict(rule)

    def create_rule(self, data):
        """创建规则"""
        existing_rule = NLPScoringRule.query.filter(
            NLPScoringRule.behavior_keyword == data["behavior_keyword"],
            NLPScoringRule.score_type == data["score_type"],
        ).first()

        if existing_rule:
            return {
                "success": False,
                "message": "规则已存在",
                "rule_id": existing_rule.id,
            }

        rule = NLPScoringRule(
            behavior_keyword=data["behavior_keyword"],
            behavior_description=data.get("behavior_description", ""),
            score_value=data["score_value"],
            score_type=data["score_type"],
            behavior_tags=data.get("behavior_tags", []),
            match_pattern=data.get("match_pattern", ""),
            priority=data.get("priority", 0),
            created_by=data.get("created_by"),
            # P1-4 修复：is_active 列无 DB 默认值，不显式赋值会落 NULL，而
            # get_rules/get_rule_statistics/suggest_similar_rules 全部
            # filter(is_active) → 新规则创建"成功"却在列表/统计/推荐中查不到。
            # 与 batch_import_rules（已显式 is_active=True）保持一致。
            is_active=True,
        )

        with db_session_scope(detach=False):
            from models import db

            db.session.add(rule)

        self._update_keyword(data["behavior_keyword"], data["score_type"], data["score_value"])

        return {
            "success": True,
            "message": "规则创建成功",
            "rule": self._rule_to_dict(rule),
        }

    def update_rule(self, rule_id, data):
        """更新规则"""
        rule = get_by_id(NLPScoringRule, rule_id)
        if not rule:
            return {"success": False, "message": "规则不存在"}

        if "behavior_keyword" in data:
            rule.behavior_keyword = data["behavior_keyword"]
        if "behavior_description" in data:
            rule.behavior_description = data["behavior_description"]
        if "score_value" in data:
            rule.score_value = data["score_value"]
        if "score_type" in data:
            rule.score_type = data["score_type"]
        if "behavior_tags" in data:
            rule.behavior_tags = data["behavior_tags"]
        if "match_pattern" in data:
            rule.match_pattern = data["match_pattern"]
        if "priority" in data:
            rule.priority = data["priority"]
        if "is_active" in data:
            rule.is_active = data["is_active"]

        rule.updated_at = datetime.now()
        with db_session_scope(detach=False):
            pass

        return {
            "success": True,
            "message": "规则更新成功",
            "rule": self._rule_to_dict(rule),
        }

    def delete_rule(self, rule_id):
        """删除规则"""
        rule = get_by_id(NLPScoringRule, rule_id)
        if not rule:
            return {"success": False, "message": "规则不存在"}

        rule.is_active = False
        rule.updated_at = datetime.now()
        with db_session_scope(detach=False):
            pass

        return {"success": True, "message": "规则已删除"}

    def get_rule_usage(self, rule_id, page=1, per_page=20):
        """获取规则使用记录"""
        query = NLPRuleUsage.query.filter(NLPRuleUsage.rule_id == rule_id)
        pagination = query.order_by(NLPRuleUsage.created_at.desc(), NLPRuleUsage.id.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        return {
            "items": [self._usage_to_dict(usage) for usage in pagination.items],
            "total": pagination.total,
            "page": page,
            "per_page": per_page,
        }

    def batch_import_rules(self, rules_data):
        """批量导入规则"""
        imported_count = 0
        skipped_count = 0

        with db_session_scope(detach=False):
            for rule_data in rules_data:
                existing_rule = NLPScoringRule.query.filter(
                    NLPScoringRule.behavior_keyword == rule_data["behavior_keyword"],
                ).first()

                if existing_rule:
                    skipped_count += 1
                    continue

                rule = NLPScoringRule(
                    behavior_keyword=rule_data["behavior_keyword"],
                    behavior_description=rule_data.get("behavior_description", ""),
                    score_value=rule_data["score_value"],
                    score_type=rule_data["score_type"],
                    behavior_tags=rule_data.get("behavior_tags", []),
                    match_pattern=rule_data.get("match_pattern", ""),
                    priority=rule_data.get("priority", 0),
                    is_active=True,
                    usage_count=rule_data.get("usage_count", 0),
                    accuracy_rate=rule_data.get("accuracy_rate", 0.0),
                )

                db.session.add(rule)
                imported_count += 1

        return {
            "success": True,
            "imported_count": imported_count,
            "skipped_count": skipped_count,
            "message": f"成功导入 {imported_count} 条规则，跳过 {skipped_count} 条重复规则",
        }
