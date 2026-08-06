import pytest
try:
    from services.nlp_enhanced_service import EnhancedNLPParserService
except ImportError:
    pass

try:
    HAS_JIEBA = True
except ImportError:
    HAS_JIEBA = False


class TestNLPServiceBasic:

    @pytest.mark.skipif(not HAS_JIEBA, reason="jieba not installed")
    def test_nlp_parse_basic(self, app):
        with app.app_context():
            from services.nlp_enhanced_service import EnhancedNLPParserService
            parser = EnhancedNLPParserService()
            result = parser.parse('给张三加5分')
            assert result is not None
            assert 'intent' in result
            assert 'extracted_name' in result

    @pytest.mark.skipif(not HAS_JIEBA, reason="jieba not installed")
    def test_nlp_parse_query(self, app):
        with app.app_context():
            parser = EnhancedNLPParserService()
            result = parser.parse('查询李四的分数')
            assert result is not None
            assert 'query' in result.get('intent', '') or '查询' in result.get('intent', '')

    @pytest.mark.skipif(not HAS_JIEBA, reason="jieba not installed")
    def test_nlp_parse_invalid(self, app):
        with app.app_context():
            parser = EnhancedNLPParserService()
            result = parser.parse('这是一段无效的文本')
            assert result is not None

    @pytest.mark.skipif(not HAS_JIEBA, reason="jieba not installed")
    def test_nlp_extract_name(self, app):
        with app.app_context():
            parser = EnhancedNLPParserService()
            name, user_id = parser.extract_name('给张三加5分')
            assert name == '张三'

    @pytest.mark.skipif(not HAS_JIEBA, reason="jieba not installed")
    def test_nlp_extract_behavior(self, app):
        with app.app_context():
            parser = EnhancedNLPParserService()
            result = parser.extract_behavior('张三上课积极回答问题', '张三')
            assert result is not None
            assert 'text' in result
