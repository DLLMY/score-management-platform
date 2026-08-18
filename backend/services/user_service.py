"""users 域写入/事务路径薄封装（F17 防腐层渐进重构）。

按 F17 范式：仅将写入/事务路径的 db.session 内联逻辑收口到此模块，路由层保留
get_or_404（404 语义）、请求级校验、缓存失效、操作日志、跨切面副作用（FTS 索引）
与响应构造。只读 db.session.query 路径暂缓不动。逐字节复刻原响应体/状态码/错误。

本文件为 users 域 service 承载：
- 子批1（students CRUD）：create_user / update_user / delete_user
- 子批2（import / batch / toggle）：bulk_create_users / bulk_delete_users /
  bulk_score_update / apply_csv_import / toggle_active
"""

from datetime import datetime

from models import db, User, get_by_id, cascade_delete_user_related_records
from utils.db_session import db_session_scope


class UserService:
    # ------------------------------------------------------------------
    # 子批1：students CRUD
    # ------------------------------------------------------------------

    def create_user(self, data):
        """创建学生（写入路径）。请求级校验由路由层完成，此处仅做 ORM 落库。

        返回新建用户 id；跨切面副作用（FTS 索引/操作日志/缓存失效）留在路由层。
        """
        user = User(
            name=data.get("name").strip(),
            gender=data.get("gender"),
            class_name=data.get("class_name"),
            phone=data.get("phone"),
            father_name=data.get("father_name"),
            father_phone=data.get("father_phone"),
            mother_name=data.get("mother_name"),
            mother_phone=data.get("mother_phone"),
            guardian_name=data.get("guardian_name"),
            guardian_phone=data.get("guardian_phone"),
            guardian_relation=data.get("guardian_relation"),
            card_id=data.get("card_id"),
            current_score=int(data.get("current_score", 0)),
        )
        with db_session_scope():
            db.session.add(user)
            db.session.flush()
            return user.id

    def update_user(self, user_id, data):
        """更新学生信息（写入路径）。404 语义由路由层 get_or_404 保证。

        仅更新请求体中提供的字段（与原文 `data.get(key, user.key)` 行为逐字节一致）；
        updated_at 由此处统一置位。返回用户 id（不存在返回 None，路由据此 404）。
        """
        with db_session_scope():
            user = db.session.get(User, user_id)
            if user is None:
                return None
            user.name = data.get("name", user.name)
            user.gender = data.get("gender", user.gender)
            user.class_name = data.get("class_name", user.class_name)
            user.phone = data.get("phone", user.phone)
            user.father_name = data.get("father_name", user.father_name)
            user.father_phone = data.get("father_phone", user.father_phone)
            user.mother_name = data.get("mother_name", user.mother_name)
            user.mother_phone = data.get("mother_phone", user.mother_phone)
            user.guardian_name = data.get("guardian_name", user.guardian_name)
            user.guardian_phone = data.get("guardian_phone", user.guardian_phone)
            user.guardian_relation = data.get("guardian_relation", user.guardian_relation)
            user.card_id = data.get("card_id", user.card_id)
            user.current_score = data.get("current_score", user.current_score)
            user.updated_at = datetime.now()
            db.session.flush()
            return user.id

    def delete_user(self, user_id):
        """删除学生（写入路径，含关联子表级联清理）。404 语义由路由层 get_or_404 保证。

        cascade_delete_user_related_records 与 user 删除同处一个事务；返回用户 id。
        """
        with db_session_scope():
            cascade_delete_user_related_records(user_id)
            user = db.session.get(User, user_id)
            if user is not None:
                db.session.delete(user)
            return user_id

    # ------------------------------------------------------------------
    # 子批2：import / batch / toggle
    # ------------------------------------------------------------------

    def bulk_create_users(self, users):
        """批量新建学生（写入路径）。users 为路由层已通过校验的 User 实例列表。

        整批同处一个事务：add_all + flush + commit；冲突由 db_session_scope 回滚并上抛，
        路由据此返回『导入失败...已回滚』。返回新建条数。
        """
        if not users:
            return 0
        with db_session_scope():
            db.session.add_all(users)
            db.session.flush()
        return len(users)

    def bulk_delete_users(self, user_ids):
        """批量删除学生（写入路径，含级联清理）。user_ids 为路由层已做 _can_access_user
        过滤的列表。同处一个事务；返回删除条数。
        """
        if not user_ids:
            return 0
        with db_session_scope():
            for user_id in user_ids:
                cascade_delete_user_related_records(user_id)
                user = db.session.get(User, user_id)
                if user is not None:
                    db.session.delete(user)
        return len(user_ids)

    def bulk_score_update(self, allowed_ids, score_change, description):
        """批量调整学生积分（写入路径）。allowed_ids 为路由层已做 _can_access_user 过滤的列表。

        同处一个事务：批量 update User.current_score + 批量插入 ScoreRecord；返回受影响行数。
        """
        from sqlalchemy import update
        from models import ScoreRecord

        if not allowed_ids:
            return 0
        with db_session_scope():
            stmt = (
                update(User)
                .where(User.id.in_(allowed_ids))
                .values(current_score=User.current_score + score_change, updated_at=datetime.now())
            )
            result = db.session.execute(stmt)
            updated_count = result.rowcount
            records = [
                ScoreRecord(
                    student_id=user_id,
                    score_change=score_change,
                    description=description,
                    operator="batch_operation",
                )
                for user_id in allowed_ids
            ]
            if records:
                db.session.add_all(records)
        return updated_count

    def apply_csv_import(self, pending_users, pending_updates):
        """CSV 导入落库（写入路径）。pending_users 为新建 User 实例列表；pending_updates 为
        [(user_id, {field: value, ...}), ...] 存量更新列表（仅含非空新值）。

        同处一个事务：add_all + 逐条 setattr + updated_at 置位。
        """
        if not pending_users and not pending_updates:
            return
        with db_session_scope():
            if pending_users:
                db.session.add_all(pending_users)
            for user_id, updates in pending_updates:
                user = db.session.get(User, user_id)
                if user is not None:
                    for field, value in updates.items():
                        setattr(user, field, value)
                    user.updated_at = datetime.now()

    def toggle_active(self, user_id):
        """切换用户启用状态（写入路径）。返回切换后的 is_active；不存在返回 None。"""
        with db_session_scope():
            user = db.session.get(User, user_id)
            if user is None:
                return None
            user.is_active = not user.is_active
            user.updated_at = datetime.now()
            db.session.flush()
            return user.is_active


user_service = UserService()
