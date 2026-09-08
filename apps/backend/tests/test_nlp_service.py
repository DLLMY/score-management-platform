from services.nlp_service import NLPParserType, get_nlp_service, init_nlp_service


class TestNLPService:

    def setup_class(self):
        init_nlp_service("enhanced")
        self.service = get_nlp_service()

    def test_parse_add_score(self):
        result = self.service.parse("给张三加5分")
        assert "success" in result
        assert "intent" in result

    def test_parse_deduct_score(self):
        result = self.service.parse("李四迟到扣2分")
        assert "success" in result
        assert "intent" in result

    def test_parse_query_score(self):
        result = self.service.parse("查询王五的分数")
        assert "success" in result
        assert "intent" in result

    def test_parse_batch(self):
        texts = ["给张三加5分", "李四迟到扣2分", "查询王五"]
        results = self.service.parse_batch(texts)
        assert len(results) == 3
        for r in results:
            assert "intent" in r

    def test_parse_with_different_parsers(self):
        result_rule = self.service.parse("给张三加5分", NLPParserType.RULE_BASED)
        assert "success" in result_rule

    def test_get_stats(self):
        stats = self.service.get_stats()
        assert isinstance(stats, dict)

    def test_warmup(self):
        self.service.warmup()

    def test_parse_complex_sentence(self):
        result = self.service.parse("今天小明主动帮助同学加3分")
        assert "success" in result
        assert "intent" in result

    def test_parse_unknown_intent(self):
        result = self.service.parse("这是一条普通消息")
        assert "intent" in result

    def test_service_singleton(self):
        service1 = get_nlp_service()
        service2 = get_nlp_service()
        assert service1 is service2
