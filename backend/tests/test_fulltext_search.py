from models import db, User, ClassInfo
from utils.fulltext_search import get_search_engine, FullTextSearch


class TestFullTextSearch:
    """FTS 全文搜索服务测试

    回归防护：
    1. fulltext_search.py 原生 SQL 曾用复数表名（FROM users / JOIN users），实际表名
       为单数（user）→ FTS 索引从未填充、搜索永远静默回退 LIKE；
    2. FTS5 porter tokenizer 不支持中文分词——含 CJK 关键词须回退 LIKE，
       否则中文搜索恒 0 结果（修复前 MATCH 不命中也不回退）。
    """

    @staticmethod
    def _seed(app):
        with app.app_context():
            ci = ClassInfo(id=1, name="测试班1")
            db.session.add(ci)
            for i in range(1, 4):
                db.session.add(
                    User(
                        id=i,
                        name="测试搜索生%d" % i,
                        card_id="CARD_FTS_%d" % i,
                        class_info_id=1,
                        class_name="测试班1",
                        is_active=True,
                    )
                )
            db.session.commit()

    def test_fts_index_built_and_english_token_searchable(self, app):
        """表名修复后索引重建填充成功：英文 token（CARD_FTS_1 分词出 FTS）可被 FTS MATCH 命中"""
        self._seed(app)
        with app.app_context():
            engine = get_search_engine(app)
            engine.init_app(app)  # 创建 FTS 表 + 重建索引
            assert engine._fts_enabled, "FTS 应初始化成功（表名修复后不应回退）"
            result = engine.search("FTS")
            assert result["total"] >= 1, "FTS 英文 token 搜索应命中已建索引的用户"
            assert any("测试搜索生" in u["name"] for u in result["users"])

    def test_cjk_keyword_falls_back_to_like(self, app):
        """含中文关键词：直接走 LIKE 回退并命中（porter 不支持中文分词，MATCH 会 0 结果）"""
        self._seed(app)
        with app.app_context():
            engine = get_search_engine(app)
            engine.init_app(app)
            result = engine.search("搜索生1")
            assert result["total"] >= 1, "中文关键词应经 LIKE 回退命中"
            assert any("搜索生1" in u["name"] for u in result["users"])

    def test_fts_no_match_returns_empty(self, app):
        """英文无匹配关键词：FTS 返回空结果而非崩溃"""
        self._seed(app)
        with app.app_context():
            engine = get_search_engine(app)
            engine.init_app(app)
            result = engine.search("nonexistentkeywordxyz")
            assert result["total"] == 0
            assert result["users"] == []

    def test_fts_disabled_when_rebuild_fails(self, app):
        """重建失败必须回退禁用：否则空/损坏索引被当成"已启用" → search 静默返回
        0 结果伪装无数据（此前 _fts_enabled 在重建前就被置 True，重建失败从不回退）"""
        self._seed(app)
        with app.app_context():
            engine = FullTextSearch(app)
            # 模拟重建失败（如索引损坏 / DB 连接异常）
            engine._rebuild_index = lambda conn: False
            engine.init_app(app)  # 创建/复用 FTS 表后重建索引（此处重建失败）
            assert not engine._fts_enabled, "重建失败须将 _fts_enabled 置 False"
            # 真实搜索应回退到 LIKE 仍能命中，而非依赖空 FTS 索引返回 0
            result = engine.search("搜索生1")
            assert result["total"] >= 1, "重建失败后须回退 LIKE 仍能搜到用户"
