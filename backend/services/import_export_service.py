"""数据导入（Excel/CSV）批量写入事务（F17 防腐层：从 api/data/import_export_routes 全量收口）。

逐字节复刻原路由的写入事务边界：
- ImportUsers._do_import_users：逐行校验 + create_user_row(add) + TransactionRetry(db.session.commit)
  + 提交失败 rollback 并抛 ImportCommitError；其余异常 rollback 后上抛。
- ImportRules / ImportCategories：逐行校验 + create_*_row(add) + db.session.commit()（末尾统一提交）；
  提交失败或其余异常 rollback 后上抛。

#629 收口说明：上一轮 F17 仅下沉行级建模（create_*_row 的 add 不提交），刻意将 commit/rollback
保留在路由。本轮 #629「全量收口」将提交/回滚事务边界一并下沉到本 service，路由退化为薄壳
（文件解析 + 模板校验 + 响应构造），路由层不再出现任何 db.session 调用。仍复用全局 db.session
（与 create_*_row 一致），不引入 db_session_scope，以免请求链 service 触发 DetachedInstanceError。
"""

import logging
import re

from models import db, User, ScoreRule, ScoreCategory, ClassInfo
from utils.validation import validate_name, validate_student_id
from utils.transaction_retry import TransactionRetry

logger = logging.getLogger(__name__)


class ImportCommitError(Exception):
    """批量导入在「提交」阶段失败（已 rollback）。携带回滚前的计数，供路由构造响应。"""

    def __init__(self, message, imported_count=0, failed_count=0):
        super().__init__(message)
        self.imported_count = imported_count
        self.failed_count = failed_count


def create_user_row(name, gender, class_name, phone, card_id):
    """复刻 ImportUsers 行级 User 建模 + add（不提交，由 bulk_import_users 统一提交/回滚）。"""
    new_user = User(
        name=name,
        gender=gender,
        class_name=class_name,
        phone=phone,
        card_id=card_id,
        current_score=0,
    )
    db.session.add(new_user)
    return new_user


def create_score_rule_row(
    name, description, category_id, score, is_active, daily_limit, min_interval
):
    """复刻 ImportRules 行级 ScoreRule 建模 + add（不提交）。"""
    new_rule = ScoreRule(
        name=name,
        description=description,
        category_id=category_id,
        score=score,
        is_active=is_active,
        daily_limit=daily_limit,
        min_interval=min_interval,
    )
    db.session.add(new_rule)
    return new_rule


def create_score_category_row(name, description, color):
    """复刻 ImportCategories 行级 ScoreCategory 建模 + add（不提交）。"""
    new_category = ScoreCategory(name=name, description=description, color=color)
    db.session.add(new_category)
    return new_category


def bulk_import_users(rows):
    """复刻 ImportUsers 写入事务：逐行校验 + 建模 + add，末尾统一提交（带重试）。

    失败时（提交失败抛 ImportCommitError；其余异常）先 rollback 再上抛，路由层无需自行回滚。
    """
    imported_count = 0
    failed_count = 0
    errors = []
    messages = []

    try:
        for row_idx, row in enumerate(rows, start=2):
            try:
                row_errors = []
                row_data = {}

                name = str(row[0]).strip() if row[0] else ""
                gender = str(row[1]).strip() if row[1] else ""
                class_name = str(row[2]).strip() if row[2] else ""
                phone = str(row[3]).strip() if row[3] else ""
                card_id = str(row[4]).strip() if row[4] else ""
                str(row[5]).strip() if row[5] else ""  # 与原路由一致：保留第6列占位（无副作用）

                # 验证姓名
                if not name:
                    row_errors.append({"field": "name", "message": "姓名不能为空"})
                else:
                    is_valid, msg = validate_name(name)
                    if not is_valid:
                        row_errors.append({"field": "name", "message": msg})

                # 验证性别
                if gender and gender not in ["男", "女", "male", "female", "m", "f"]:
                    row_errors.append({"field": "gender", "message": "性别值无效"})

                # 验证班级是否存在
                if class_name:
                    class_info = ClassInfo.query.filter_by(name=class_name).first()
                    if not class_info:
                        row_errors.append(
                            {
                                "field": "class_name",
                                "message": f'班级 "{class_name}" 在系统中不存在',
                            }
                        )

                # 验证手机号
                if phone:
                    if not re.match(r"^1[3-9]\d{9}$", phone):
                        row_errors.append(
                            {"field": "phone", "message": "手机号格式无效，应为11位数字"}
                        )

                # 验证学号/饭卡号
                if not card_id:
                    row_errors.append({"field": "card_id", "message": "学号不能为空"})
                else:
                    is_valid, msg = validate_student_id(card_id)
                    if not is_valid:
                        row_errors.append({"field": "card_id", "message": msg})
                    elif User.query.filter_by(card_id=card_id).first():
                        row_errors.append(
                            {"field": "card_id", "message": f"学号 {card_id} 已存在"}
                        )

                if row_errors:
                    failed_count += 1
                    error_msg = "; ".join(
                        [f'{err["field"]}: {err["message"]}' for err in row_errors]
                    )
                    errors.append(
                        {
                            "row": row_idx,
                            "message": error_msg,
                            "row_data": row_data,
                            "error_fields": [err["field"] for err in row_errors],
                        }
                    )
                    messages.append(
                        {
                            "name": name or "未知",
                            "action": "failed",
                            "message": error_msg,
                            "row_data": row_data,
                            "error_fields": [err["field"] for err in row_errors],
                        }
                    )
                    continue

                create_user_row(name, gender, class_name, phone, card_id)
                imported_count += 1
                messages.append(
                    {"name": name, "action": "created", "message": f"学生 {name} 导入成功"}
                )

            except Exception as e:
                failed_count += 1
                error_msg = str(e)
                errors.append(
                    {
                        "row": row_idx,
                        "message": error_msg,
                        "row_data": {},
                        "error_fields": ["system"],
                    }
                )
                messages.append(
                    {
                        "name": name if name else "未知",
                        "action": "failed",
                        "message": error_msg,
                        "row_data": {},
                        "error_fields": ["system"],
                    }
                )

        if imported_count > 0:
            retry = TransactionRetry(max_retries=5, base_delay=0.1)
            try:
                retry.execute(db.session.commit)
            except Exception as e:
                db.session.rollback()
                logger.error(f"数据提交失败（已重试{retry.retry_count}次）: {str(e)}")
                raise ImportCommitError(str(e), imported_count, failed_count)

    except ImportCommitError:
        raise
    except Exception as e:
        db.session.rollback()
        logger.error("批量导入用户失败（已回滚）: %s", e)
        raise

    return {
        "imported_count": imported_count,
        "failed_count": failed_count,
        "errors": errors,
        "messages": messages,
    }


def bulk_import_rules(rows):
    """复刻 ImportRules 写入事务：逐行校验 + 建模 + add，末尾统一提交。

    失败时先 rollback 再上抛，路由层无需自行回滚。
    """
    imported_count = 0
    failed_count = 0
    errors = []

    try:
        for row_idx, row in enumerate(rows, start=2):
            try:
                name = str(row[0]).strip() if row[0] else ""
                description = str(row[1]).strip() if row[1] else ""
                category_name = str(row[2]).strip() if row[2] else ""
                score = int(row[3]) if row[3] else 0
                is_active = str(row[4]).strip() == "是" if row[4] else True
                daily_limit = int(row[5]) if row[5] else 0
                min_interval = int(row[6]) if row[6] else 0

                if not name:
                    errors.append(f"第{row_idx}行：规则名称不能为空")
                    failed_count += 1
                    continue

                # 查找分类
                category = ScoreCategory.query.filter_by(name=category_name).first()
                if not category:
                    errors.append(f'第{row_idx}行：分类 "{category_name}" 不存在')
                    failed_count += 1
                    continue

                # 检查规则名称是否已存在
                if ScoreRule.query.filter_by(name=name).first():
                    errors.append(f'第{row_idx}行：规则名称 "{name}" 已存在')
                    failed_count += 1
                    continue

                create_score_rule_row(
                    name, description, category.id, score, is_active, daily_limit, min_interval
                )
                imported_count += 1

            except Exception:
                errors.append(f"第{row_idx}行导入失败")
                failed_count += 1

        if imported_count > 0:
            db.session.commit()

    except Exception as e:
        db.session.rollback()
        logger.error("批量导入规则失败（已回滚）: %s", e)
        raise

    return {
        "imported_count": imported_count,
        "failed_count": failed_count,
        "errors": errors,
    }


def bulk_import_categories(rows):
    """复刻 ImportCategories 写入事务：逐行校验 + 建模 + add，末尾统一提交。

    失败时先 rollback 再上抛，路由层无需自行回滚。
    """
    imported_count = 0
    failed_count = 0
    errors = []

    try:
        for row_idx, row in enumerate(rows, start=2):
            try:
                name = str(row[0]).strip() if row[0] else ""
                description = str(row[1]).strip() if row[1] else ""
                color = str(row[2]).strip() if row[2] else "#3B82F6"

                if not name:
                    errors.append(f"第{row_idx}行：分类名称不能为空")
                    failed_count += 1
                    continue

                # 检查分类名称是否已存在
                if ScoreCategory.query.filter_by(name=name).first():
                    errors.append(f'第{row_idx}行：分类名称 "{name}" 已存在')
                    failed_count += 1
                    continue

                create_score_category_row(name, description, color)
                imported_count += 1

            except Exception:
                errors.append(f"第{row_idx}行导入失败")
                failed_count += 1

        if imported_count > 0:
            db.session.commit()

    except Exception as e:
        db.session.rollback()
        logger.error("批量导入分类失败（已回滚）: %s", e)
        raise

    return {
        "imported_count": imported_count,
        "failed_count": failed_count,
        "errors": errors,
    }
