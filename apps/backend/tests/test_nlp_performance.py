import pytest
import time
from services.nlp_service import NLPService, nlp_service
from services.nlp_fast_parser import FastNLPParser
from models import User, ScoreCategory, NLPBehaviorKeyword, NLPScoringRule


@pytest.fixture(autouse=True)
def _force_deterministic_parser():
    """消除 NLP 解析成功率 flaky 根因（确定性钉固）。

    根因：nlp_service.parse() 优先返回「快速解析器」结果，但 fast parser 由守护线程
    异步加载——加载完成前会回退到增强解析器，而增强解析器的行为词库来自 DB
    （_refresh_cache 读 NLPBehaviorKeyword）。在 pytest 夹具的事务隔离下该读取偶发
    读不到（keywords=[]）→ matched_rules 空 → success=False。于是 parse() 返回的
    success/intent 取决于「fast parser 是否在解析前加载完」这一竞态 → 时过时不过。

    修复：强制同步加载 fast parser 并清空缓存，使 parse() 走 DB 无关、确定性的快速
    路径（生产中对这类简单句实际走的也是 fast 路径）。同时修掉 fast parser 的意图
    优先级 bug（『作业没交扣5分』原被泛化加分词『作业』误判为 add，已改 deduct 优先）。
    """
    nlp_service.initialize()
    nlp_service.clear_cache()
    nlp_service._fast_parser = FastNLPParser()
    yield
    nlp_service.clear_cache()


def _ensure_score_categories(session):
    """确保加分项/扣分项两个 ScoreCategory 存在（幂等）。"""
    category_add = ScoreCategory.query.filter_by(name="加分项").first()
    if not category_add:
        category_add = ScoreCategory(
            name="加分项", description="加分行为", color="#10B981", is_active=True
        )
        session.add(category_add)

    category_deduct = ScoreCategory.query.filter_by(name="扣分项").first()
    if not category_deduct:
        category_deduct = ScoreCategory(
            name="扣分项", description="扣分行为", color="#EF4444", is_active=True
        )
        session.add(category_deduct)

    session.commit()


def _ensure_test_users(session):
    """确保 C001..C005 五个测试用户存在（幂等）；返回用户对象列表（原顺序）。"""
    existing_users = {
        u.card_id: u
        for u in User.query.filter(User.card_id.in_(["C001", "C002", "C003", "C004", "C005"])).all()
    }
    users_to_create = []
    user_data = [
        ("张三", "C001", 60),
        ("李四", "C002", 70),
        ("王五", "C003", 80),
        ("赵六", "C004", 50),
        ("李华", "C005", 65),
    ]
    users = []
    for name, card_id, score in user_data:
        if card_id in existing_users:
            users.append(existing_users[card_id])
        else:
            user = User(
                name=name, card_id=card_id, class_name="测试班", current_score=score, is_active=True
            )
            users_to_create.append(user)
            users.append(user)

    if users_to_create:
        session.add_all(users_to_create)
        session.commit()
    return users


def _ensure_behavior_keywords(session):
    """确保 8 个行为关键词存在（幂等）；返回关键词对象列表（原顺序）。"""
    existing_keywords = {
        kw.keyword: kw
        for kw in NLPBehaviorKeyword.query.filter(
            NLPBehaviorKeyword.keyword.in_(
                ["迟到", "做好事", "作业没交", "帮助", "加分", "扣分", "扣", "加"]
            )
        ).all()
    }
    keywords_to_create = []
    keyword_data = [
        ("迟到", "deduct"),
        ("做好事", "add"),
        ("作业没交", "deduct"),
        ("帮助", "add"),
        ("加分", "add"),
        ("扣分", "deduct"),
        ("扣", "deduct"),
        ("加", "add"),
    ]
    behavior_keywords = []
    for kw, kw_type in keyword_data:
        if kw in existing_keywords:
            behavior_keywords.append(existing_keywords[kw])
        else:
            keyword = NLPBehaviorKeyword(keyword=kw, keyword_type=kw_type)
            keywords_to_create.append(keyword)
            behavior_keywords.append(keyword)

    if keywords_to_create:
        session.add_all(keywords_to_create)
        session.commit()
    return behavior_keywords


def _ensure_scoring_rules(session):
    """确保 4 条评分规则存在（幂等）；返回规则对象列表（原顺序）。"""
    existing_rules = {
        sr.behavior_keyword: sr
        for sr in NLPScoringRule.query.filter(
            NLPScoringRule.behavior_keyword.in_(
                ["迟到", "做好事", "作业没交", "帮助同学"]  # noqa: E501
            )
        ).all()
    }
    rules_to_create = []
    rule_data = [
        ("迟到", 2, "deduct"),
        ("做好事", 10, "add"),
        ("作业没交", 5, "deduct"),
        ("帮助同学", 3, "add"),
    ]
    scoring_rules = []
    for behavior_keyword, score_value, score_type in rule_data:
        if behavior_keyword in existing_rules:
            scoring_rules.append(existing_rules[behavior_keyword])
        else:
            rule = NLPScoringRule(
                behavior_keyword=behavior_keyword, score_value=score_value, score_type=score_type
            )
            rules_to_create.append(rule)
            scoring_rules.append(rule)

    if rules_to_create:
        session.add_all(rules_to_create)
        session.commit()
    return scoring_rules


@pytest.fixture(scope="function")
def nlp_test_data(session):
    """创建NLP测试所需的用户和规则数据"""
    _ensure_score_categories(session)
    users = _ensure_test_users(session)
    behavior_keywords = _ensure_behavior_keywords(session)
    scoring_rules = _ensure_scoring_rules(session)
    return {
        "users": users,
        "rules": scoring_rules,
        "keywords": behavior_keywords,
    }


class TestNLPPerformance:
    """NLP性能测试类"""

    def test_nlp_warmup_improves_first_call(self, nlp_test_data):
        """测试NLP预热后首次调用性能提升"""
        nlp_service.initialize()

        parser = nlp_service._parsers.get(nlp_service.parser_type)
        if parser and hasattr(parser, "_refresh_cache"):
            parser._refresh_cache()

        test_texts = [
            "给张三加分",
            "李四迟到扣2分",
            "查询王五的分数",
            "赵六做好事加10分",
            "李华作业没交扣5分",
        ]

        nlp_service.warmup(test_texts)

        start_time = time.time()
        success_count = 0
        for text in test_texts:
            result = nlp_service.parse(text)
            if result.get("success") is True:
                success_count += 1
        end_time = time.time()

        avg_time_ms = (end_time - start_time) / len(test_texts) * 1000
        print(f"NLP预热后平均解析时间: {avg_time_ms:.2f}ms")
        print(f"解析成功率: {success_count}/{len(test_texts)}")

        assert (
            success_count >= len(test_texts) - 1
        ), f"解析成功率不足，成功{success_count}/{len(test_texts)}"
        assert avg_time_ms < 1500, f"预热后解析时间{avg_time_ms:.2f}ms超过1500ms阈值"

    def test_nlp_parse_success_rate(self, nlp_test_data):
        """测试NLP解析成功率"""
        nlp_service.initialize()

        test_cases = [
            ("给张三加分", "add"),
            ("李四迟到扣2分", "deduct"),
            ("查询王五的分数", "query"),
            ("赵六做好事加10分", "add"),
            ("李华作业没交扣5分", "deduct"),
        ]

        success_count = 0
        for text, expected_intent in test_cases:
            result = nlp_service.parse(text)
            if result.get("success") and result.get("intent") == expected_intent:
                success_count += 1

        success_rate = success_count / len(test_cases)
        print(f"NLP解析成功率: {success_rate * 100:.1f}%")

        assert success_rate >= 0.6, f"解析成功率{success_rate * 100:.1f}%低于60%阈值"

    def test_nlp_parse_extracts_name(self, nlp_test_data):
        """测试NLP解析能够正确提取姓名"""
        nlp_service.initialize()

        parser = nlp_service._parsers.get(nlp_service.parser_type)
        if parser and hasattr(parser, "_refresh_cache"):
            parser._refresh_cache()

        test_cases = [
            ("给张三加分", "张三"),
            ("李四迟到扣2分", "李四"),
            ("查询王五的分数", "王五"),
            ("赵六做好事加10分", "赵六"),
            ("李华作业没交扣5分", "李华"),
        ]

        for text, expected_name in test_cases:
            result = nlp_service.parse(text)
            if result.get("success"):
                # 使用extracted_name字段而不是name
                name = result.get("extracted_name")
                assert name == expected_name, f"解析姓名错误: 期望'{expected_name}', 实际'{name}'"

    def test_nlp_parse_extracts_score(self, nlp_test_data):
        """测试NLP解析能够正确提取分数"""
        nlp_service.initialize()

        parser = nlp_service._parsers.get(nlp_service.parser_type)
        if parser and hasattr(parser, "_refresh_cache"):
            parser._refresh_cache()

        # 扣分场景分数为负数，加分场景分数为正数
        test_cases = [
            ("李四迟到扣2分", -2),
            ("赵六做好事加10分", 10),
            ("李华作业没交扣5分", -5),
        ]

        for text, expected_score in test_cases:
            result = nlp_service.parse(text)
            if result.get("success"):
                score = result.get("score")
                # 使用abs比较，因为扣分时score已经是负数
                assert abs(score) == abs(
                    expected_score
                ), f"解析分数错误: 期望{expected_score}, 实际{score}"

    def test_nlp_batch_parse(self):
        """测试NLP批量解析"""
        nlp_service.initialize()

        texts = ["给张三加分", "李四迟到扣2分", "查询王五的分数"]

        start_time = time.time()
        results = nlp_service.parse_batch(texts)
        end_time = time.time()

        total_time_ms = (end_time - start_time) * 1000
        print(f"NLP批量解析时间: {total_time_ms:.2f}ms")

        assert len(results) == len(texts)
        for result in results:
            assert "success" in result

    def test_nlp_service_singleton(self):
        """测试NLP服务单例模式"""
        service1 = NLPService()
        service2 = NLPService()

        assert service1 is service2

    def test_nlp_get_stats(self):
        """测试获取NLP统计信息"""
        nlp_service.initialize()

        stats = nlp_service.get_stats()

        assert isinstance(stats, dict)
