import logging
import threading
import time

# -*- coding: utf-8 -*-
from models import User, db

"""
全文搜索优化模块
使用SQLite FTS5实现高性能模糊搜索
解决10K+数据模糊筛选超时问题
"""

logger = logging.getLogger(__name__)


def _contains_cjk(text: str) -> bool:
    """判断关键词是否含中日韩字符（FTS5 porter tokenizer 不支持中文分词）"""
    import re

    return bool(re.search(r"[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]", text or ""))


class FullTextSearch:
    """基于SQLite FTS5的全文搜索引擎"""

    def __init__(self, app=None):
        self.app = app
        self._fts_enabled = False
        self._fts_table = None
        self._cache = {}
        self._cache_ttl = 300  # 缓存5分钟
        self._lock = threading.Lock()

    def init_app(self, app):
        """初始化FTS"""
        self.app = app
        self._ensure_fts_table()

    def _ensure_fts_table(self):
        """确保FTS5虚拟表存在（需在应用上下文中调用）"""
        from models import db
        from flask import has_app_context

        if not has_app_context():
            logger.warning("[FullTextSearch] 需在应用上下文中初始化，跳过")
            return

        try:
            with db.engine.connect() as conn:
                # 检查FTS表是否存在
                result = conn.execute(  # noqa: F841
                    db.text("SELECT name FROM sqlite_master WHERE type='table' AND name='user_search_idx'")
                )
                if result.fetchone():
                    self._fts_enabled = True
                    logger.info("[FullTextSearch] FTS5索引已存在")
                    # 启动时重建一次索引：历史上因表名错误（users→user）索引从未填充，启动重建保证自愈
                    self._rebuild_index(conn)
                    return

                # 创建FTS5虚拟表
                conn.execute(db.text("""
                    CREATE VIRTUAL TABLE user_search_idx
                    USING fts5(name, card_id, phone, class_name, tokenize='porter')
                """))
                conn.commit()
                self._fts_enabled = True
                logger.info("[FullTextSearch] FTS5索引创建成功")

                # 填充初始数据
                self._rebuild_index(conn)

        except Exception as e:
            logger.warning(f"[FullTextSearch] FTS5初始化失败: {e}")
            self._fts_enabled = False

    def _rebuild_index(self, conn):
        """重建FTS索引（需在应用上下文中调用）"""

        try:
            # 使用原生SQL查询避免ORM上下文问题
            result = conn.execute(
                db.text("SELECT id, name, card_id, phone, class_name FROM user WHERE is_active = 1")  # noqa: F841
            )
            rows = result.fetchall()
            count = 0
            for row in rows:
                conn.execute(
                    db.text("""
                        INSERT OR REPLACE INTO user_search_idx(rowid, name, card_id, phone, class_name)
                        VALUES (:id, :name, :card_id, :phone, :class_name)
                    """),
                    {
                        "id": row[0],
                        "name": row[1] or "",
                        "card_id": row[2] or "",
                        "phone": row[3] or "",
                        "class_name": row[4] or "",
                    },
                )
                count += 1
            conn.commit()
            logger.info(f"[FullTextSearch] 索引重建完成，共 {count} 条记录")
        except Exception as e:
            logger.error(f"[FullTextSearch] 索引重建失败: {e}")

    def add_to_index(self, user_id, name, card_id, phone, class_name):
        """添加用户到搜索索引"""
        if not self._fts_enabled:
            return

        try:
            with db.engine.connect() as conn:
                conn.execute(
                    db.text("""
                        INSERT OR REPLACE INTO user_search_idx(rowid, name, card_id, phone, class_name)
                        VALUES (:id, :name, :card_id, :phone, :class_name)
                    """),
                    {
                        "id": user_id,
                        "name": name or "",
                        "card_id": card_id or "",
                        "phone": phone or "",
                        "class_name": class_name or "",
                    },
                )
                conn.commit()
            self._invalidate_cache()
        except Exception as e:
            logger.warning(f"[FullTextSearch] 更新索引失败: {e}")

    def remove_from_index(self, user_id):
        """从搜索索引移除用户"""
        if not self._fts_enabled:
            return

        try:
            with db.engine.connect() as conn:
                conn.execute(db.text("DELETE FROM user_search_idx WHERE rowid = :id"), {"id": user_id})
                conn.commit()
            self._invalidate_cache()
        except Exception as e:
            logger.warning(f"[FullTextSearch] 移除索引失败: {e}")

    def search(self, keyword, page=1, per_page=20, class_filter=None):
        """
        执行全文搜索

        Args:
            keyword: 搜索关键词
            page: 页码
            per_page: 每页数量
            class_filter: 班级过滤

        Returns:
            搜索结果
        """
        cache_key = f"search:{keyword}:{page}:{per_page}:{class_filter}"

        # 检查缓存
        cached = self._get_cache(cache_key)
        if cached:
            return cached

        if self._fts_enabled and not _contains_cjk(keyword):
            # FTS5 porter tokenizer 仅支持英文词干，对中文（无空格分词）MATCH 永远 0 结果——
            # 含 CJK 的关键词直接走 LIKE 回退，避免"搜不到"（此前中文搜索恒 0 结果且不回退）
            result = self._fts_search(keyword, page, per_page, class_filter)  # noqa: F841
        else:
            result = self._fallback_search(keyword, page, per_page, class_filter)  # noqa: F841

        # 缓存结果
        self._set_cache(cache_key, result)
        return result

    def _fts_search(self, keyword, page, per_page, class_filter):
        """使用FTS5搜索"""

        try:
            # 使用FTS5全文搜索
            with db.engine.connect() as conn:
                # 构建FTS查询
                # 构建FTS查询（显式列名，避免 SELECT u.* 依赖表列顺序的位置映射）
                fts_query = """
                    SELECT u.id, u.name, u.gender, u.class_name, u.phone, u.card_id, u.current_score
                    FROM user_search_idx fts
                    JOIN user u ON u.id = fts.rowid
                    WHERE user_search_idx MATCH :keyword
                """
                params = {"keyword": f"{keyword}*"}

                if class_filter:
                    fts_query += " AND u.class_name = :class_filter"
                    params["class_filter"] = class_filter

                fts_query += " ORDER BY rank"

                # 获取总数
                count_query = """
                    SELECT COUNT(*) FROM user_search_idx fts
                    JOIN user u ON u.id = fts.rowid
                    WHERE user_search_idx MATCH :keyword
                """
                count_params = {"keyword": f"{keyword}*"}
                if class_filter:
                    count_query += " AND u.class_name = :class_filter"
                    count_params["class_filter"] = class_filter

                total = conn.execute(db.text(count_query), count_params).scalar()

                # 分页获取结果
                offset = (page - 1) * per_page
                fts_query += " LIMIT :limit OFFSET :offset"
                params["limit"] = per_page
                params["offset"] = offset

                rows = conn.execute(db.text(fts_query), params).fetchall()

                users = []
                for row in rows:
                    users.append(
                        {
                            "id": row[0],
                            "name": row[1],
                            "gender": row[2],
                            "class_name": row[3],
                            "phone": row[4],
                            "card_id": row[5],
                            "current_score": row[6],
                        }
                    )

                return {
                    "users": users,
                    "total": total,
                    "page": page,
                    "per_page": per_page,
                    "pages": (total + per_page - 1) // per_page if total > 0 else 0,
                }

        except Exception as e:
            logger.warning(f"[FullTextSearch] FTS搜索失败，回退到普通搜索: {e}")
            return self._fallback_search(keyword, page, per_page, class_filter)

    def _fallback_search(self, keyword, page, per_page, class_filter):
        """回退到普通LIKE搜索"""

        query = User.query
        if class_filter:
            query = query.filter(User.class_name == class_filter)

        if keyword:
            search_pattern = f"%{keyword}%"
            query = query.filter(
                db.or_(
                    User.name.like(search_pattern),
                    User.card_id.like(search_pattern),
                    User.phone.like(search_pattern),
                )
            )

        pagination = query.order_by(User.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)

        return {
            "users": [
                {
                    "id": u.id,
                    "name": u.name,
                    "gender": u.gender,
                    "class_name": u.class_name,
                    "phone": u.phone,
                    "card_id": u.card_id,
                    "current_score": u.current_score,
                }
                for u in pagination.items
            ],
            "total": pagination.total,
            "page": page,
            "per_page": per_page,
            "pages": pagination.pages,
        }

    def _get_cache(self, key):
        """获取缓存"""
        with self._lock:
            if key in self._cache:
                value, timestamp = self._cache[key]
                if time.time() - timestamp < self._cache_ttl:
                    return value
                else:
                    del self._cache[key]
        return None

    def _set_cache(self, key, value):
        """设置缓存"""
        with self._lock:
            self._cache[key] = (value, time.time())
            # 限制缓存大小
            if len(self._cache) > 1000:
                oldest_keys = sorted(self._cache.items(), key=lambda x: x[1][1])[:500]
                for k, _ in oldest_keys:
                    del self._cache[k]

    def _invalidate_cache(self):
        """失效所有缓存"""
        with self._lock:
            self._cache.clear()

    def get_stats(self):
        """获取搜索统计"""
        return {
            "fts_enabled": self._fts_enabled,
            "cache_size": len(self._cache),
            "cache_ttl": self._cache_ttl,
        }


# 全局实例


_search_engine = None


def get_search_engine(app=None):
    """获取全局搜索引擎实例"""
    global _search_engine
    if _search_engine is None:
        _search_engine = FullTextSearch(app)  # noqa: F841
    return _search_engine
