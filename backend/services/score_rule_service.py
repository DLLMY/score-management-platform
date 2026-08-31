"""积分规则薄服务层（F17 防腐层迁移：把 rules_routes 内的 db.session 写入/事务收口到 service）。

仅迁移写入/事务路径（create/update/delete/import/apply_template）。只读查询（GET 列表/详情/
导出/统计/模板）仍留在路由内，按评估排期"只读 db.session.query 可暂缓"。

事务边界统一在此收口；方法返回结构保持与原路由一致，便于路由原样映射为 APIResponse，
不改变对外契约。缓存失效与操作日志仍由路由负责（与 categories/rank 等子域一致）。
"""

from datetime import datetime
import logging

from models import db, ScoreRule, ScoreCategory, ScoreRecord, get_by_id

logger = logging.getLogger(__name__)


def create_rule(data):
    """创建规则。data 已由路由完成请求级校验（名称/分数/分类存在性等）。返回 rule 对象。"""
    rule = ScoreRule(
        name=data.get("name").strip(),
        description=data.get("description"),
        category_id=data.get("category_id"),
        score=float(data.get("score")),
        is_active=data.get("is_active", True),
        daily_limit=int(data.get("daily_limit", data.get("max_per_day", 0))),
        min_interval=int(data.get("min_interval", 0)),
    )
    db.session.add(rule)
    db.session.commit()
    return rule


def update_rule(rule, data):
    """更新已有规则（rule 由路由经 get_or_404 取得，保留 404 语义）。"""
    rule.name = data.get("name", rule.name)
    rule.description = data.get("description", rule.description)
    rule.category_id = data.get("category_id", rule.category_id)
    rule.score = data.get("score", rule.score)
    rule.is_active = data.get("is_active", rule.is_active)
    rule.daily_limit = data.get("daily_limit", data.get("max_per_day", rule.daily_limit))
    rule.min_interval = data.get("min_interval", rule.min_interval)
    rule.updated_at = datetime.now()
    db.session.commit()
    return None


def delete_rule(rule):
    """删除规则；先解除历史流水引用（R7 修复：原直接删 → 有流水的规则删除即 IntegrityError）。"""
    try:
        ScoreRecord.query.filter_by(rule_id=rule.id).update({ScoreRecord.rule_id: None})
    except Exception as e:
        # 解除引用失败（如该规则本无流水）不应阻断删除，仅留痕（T9 日志化）。
        logger.warning(f"解除规则历史流水引用失败（跳过）rule_id={rule.id}: {e}")
    db.session.delete(rule)
    db.session.commit()
    return None


def import_rules(rules_data):
    """批量导入规则，单事务提交。返回与原路由一致的汇总 dict。

    rules_data: 规则数据列表（已确认非空）。逐行校验失败计入 errors/messages 并跳过该行，
    不阻断其他行；全部合法行 add 后统一 commit。
    """
    imported_count = 0
    error_count = 0
    errors = []
    messages = []
    existing_names = set(r.name for r in ScoreRule.query.all())
    for idx, rule_data in enumerate(rules_data):
        try:
            row_errors = []
            row_data = rule_data.copy()
            name = rule_data.get("name")
            if not name:
                row_errors.append({"field": "name", "message": "规则名称不能为空"})
            elif not isinstance(name, str) or len(str(name).strip()) == 0:
                row_errors.append(
                    {"field": "name", "message": "规则名称格式无效，必须为非空字符串"}
                )
            elif len(str(name).strip()) > 100:
                row_errors.append(
                    {"field": "name", "message": "规则名称长度超过限制（最大100字符）"}
                )
            if name:
                name_str = str(name).strip()
                if name_str in existing_names:
                    row_errors.append({"field": "name", "message": f'规则名称"{name_str}"已存在'})
            score = rule_data.get("score")
            if score is None:
                row_errors.append({"field": "score", "message": "分数不能为空"})
            else:
                try:
                    score_float = float(score)
                except (ValueError, TypeError):
                    row_errors.append({"field": "score", "message": f'分数"{score}"不是有效的数值'})
            category_id = rule_data.get("category_id")
            if category_id is not None:
                try:
                    category_id_int = int(category_id)
                    if category_id_int > 0:
                        category = get_by_id(ScoreCategory, category_id_int)
                        if not category:
                            row_errors.append(
                                {
                                    "field": "category_id",
                                    "message": f'分类ID"{category_id_int}"不存在',
                                }
                            )
                except (ValueError, TypeError):
                    row_errors.append(
                        {"field": "category_id", "message": f'分类ID"{category_id}"不是有效的整数'}
                    )
            daily_limit = rule_data.get("daily_limit", 0)
            try:
                daily_limit_int = int(daily_limit)
                if daily_limit_int < 0:
                    row_errors.append({"field": "daily_limit", "message": "每日上限不能为负数"})
            except (ValueError, TypeError):
                row_errors.append(
                    {"field": "daily_limit", "message": f'每日上限"{daily_limit}"不是有效的整数'}
                )
            min_interval = rule_data.get("min_interval", 0)
            try:
                min_interval_int = int(min_interval)
                if min_interval_int < 0:
                    row_errors.append({"field": "min_interval", "message": "最小间隔不能为负数"})
            except (ValueError, TypeError):
                row_errors.append(
                    {"field": "min_interval", "message": f'最小间隔"{min_interval}"不是有效的整数'}
                )
            if row_errors:
                error_count += 1
                error_msg = "; ".join([f'{err["field"]}: {err["message"]}' for err in row_errors])
                errors.append(
                    {
                        "row": idx + 1,
                        "message": error_msg,
                        "row_data": row_data,
                        "error_fields": [err["field"] for err in row_errors],
                    }
                )
                messages.append(
                    {
                        "name": str(name) if name else "未知",
                        "action": "failed",
                        "message": error_msg,
                        "row_data": row_data,
                        "error_fields": [err["field"] for err in row_errors],
                    }
                )
                continue
            name_str = str(name).strip()
            score_float = float(score)
            category_id_int = int(category_id) if category_id is not None else None
            daily_limit_int = int(daily_limit)
            min_interval_int = int(min_interval)
            rule = ScoreRule(
                name=name_str,
                description=str(rule_data.get("description", "")).strip(),
                category_id=category_id_int,
                score=score_float,
                is_active=bool(rule_data.get("is_active", True)),
                daily_limit=daily_limit_int,
                min_interval=min_interval_int,
            )
            db.session.add(rule)
            imported_count += 1
            existing_names.add(name_str)
            messages.append(
                {"name": name_str, "action": "created", "message": f'规则"{name_str}"导入成功'}
            )
        except Exception as e:
            error_count += 1
            error_msg = str(e)
            errors.append(
                {
                    "row": idx + 1,
                    "message": error_msg,
                    "row_data": rule_data,
                    "error_fields": ["system"],
                }
            )
            messages.append(
                {
                    "name": rule_data.get("name", "未知"),
                    "action": "failed",
                    "message": error_msg,
                    "row_data": rule_data,
                    "error_fields": ["system"],
                }
            )
    db.session.commit()
    return {
        "total": len(rules_data),
        "success_count": imported_count,
        "failed_count": error_count,
        "errors": errors,
        "messages": messages,
    }


def apply_rule_template(template, category_id):
    """应用预设模板批量创建规则，单事务（含 flush 取新分类 id、失败 rollback）。

    返回 (result_dict, None)；若指定的 category_id 对应分类不存在返回 (None, '指定的分类不存在')。
    """
    # 如果没有指定分类ID，创建新分类
    if not category_id:
        category = ScoreCategory.query.filter_by(name=template["name"]).first()
        if not category:
            category = ScoreCategory(
                name=template["name"], description=template["description"], color="#4A90D9"
            )
            db.session.add(category)
            db.session.flush()
        category_id = category.id
    else:
        category = get_by_id(ScoreCategory, category_id)
        if not category:
            return None, "指定的分类不存在"
        category_id = category.id
    created_rules = []
    try:
        for rule_data in template["rules"]:
            # 检查规则是否已存在（同名同分类）
            existing = ScoreRule.query.filter_by(
                name=rule_data["name"], category_id=category_id
            ).first()
            if not existing:
                rule = ScoreRule(
                    name=rule_data["name"],
                    description=rule_data["description"],
                    category_id=category_id,
                    score=rule_data["score"],
                    is_active=True,
                    daily_limit=rule_data.get("daily_limit", 0),
                    min_interval=rule_data.get("min_interval", 0),
                )
                db.session.add(rule)
                created_rules.append(rule_data["name"])
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return (
        {
            "created_count": len(created_rules),
            "created_rules": created_rules,
            "category_id": category_id,
        },
        None,
    )
