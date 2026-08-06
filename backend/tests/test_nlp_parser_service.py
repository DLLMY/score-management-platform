try:
    from models import db, User
except ImportError:
    pass

try:
    from services.nlp_parser_service import NLPParserService
except ImportError:
    pass

try:
    from models import NLPBehaviorKeyword
except ImportError:
    pass

try:
    from models import NLPScoringRule
except ImportError:
    pass



class TestNLPParserService:

    def test_extract_name_from_database(self, app):
        with app.app_context():
            from models import db, User
            from services.nlp_parser_service import NLPParserService

            user = User(
                name='测试学生',
                card_id='NLP001',
                class_name='测试班级',
                current_score=100
            )
            db.session.add(user)
            db.session.commit()

            parser = NLPParserService()
            name, user_id = parser.extract_name('测试学生迟到')

            assert name == '测试学生'
            assert user_id == user.id

            db.session.rollback()

    def test_extract_name_pattern_match(self, app):
        with app.app_context():

            parser = NLPParserService()
            name, user_id = parser.extract_name('张三同学加分')

            assert name == '张三'

    def test_extract_name_no_match(self, app):
        with app.app_context():

            parser = NLPParserService()
            name, user_id = parser.extract_name('今天天气不错')

            assert name is None
            assert user_id is None

    def test_extract_behavior_with_keywords(self, app):
        with app.app_context():
            from models import NLPBehaviorKeyword

            keyword = NLPBehaviorKeyword(
                keyword='迟到',
                keyword_type='纪律',
                score_type='deduct',
                default_score=-5,
                synonyms=['晚到']
            )
            db.session.add(keyword)
            db.session.commit()

            parser = NLPParserService()
            behavior = parser.extract_behavior('张三迟到了', '张三')

            assert len(behavior['keywords']) >= 1
            assert behavior['negative_count'] >= 1
            assert behavior['text'] == '迟到了'

            db.session.rollback()

    def test_extract_behavior_positive(self, app):
        with app.app_context():

            parser = NLPParserService()
            behavior = parser.extract_behavior('张三表现优秀')

            assert behavior['positive_count'] >= 1
            assert behavior['negative_count'] == 0

    def test_extract_behavior_negative(self, app):
        with app.app_context():

            parser = NLPParserService()
            behavior = parser.extract_behavior('李四上课睡觉')

            assert behavior['negative_count'] >= 1
            assert behavior['positive_count'] == 0

    def test_determine_intent_add(self, app):
        with app.app_context():

            parser = NLPParserService()
            behavior_result = {'positive_count': 2, 'negative_count': 0, 'keywords': [], 'text': '优秀'}

            intent = parser.determine_intent('给张三加分', behavior_result)

            assert intent == 'add'

    def test_determine_intent_deduct(self, app):
        with app.app_context():

            parser = NLPParserService()
            behavior_result = {'positive_count': 0, 'negative_count': 2, 'keywords': [], 'text': '迟到'}

            intent = parser.determine_intent('李四迟到扣5分', behavior_result)

            assert intent == 'deduct'

    def test_determine_intent_by_keywords(self, app):
        with app.app_context():

            parser = NLPParserService()
            behavior_result = {
                'positive_count': 1,
                'negative_count': 1,
                'keywords': [('迟到', '纪律', 'deduct', -5)],
                'text': '迟到'
            }

            intent = parser.determine_intent('张三迟到', behavior_result)

            assert intent == 'deduct'

    def test_determine_intent_unknown(self, app):
        with app.app_context():

            parser = NLPParserService()
            behavior_result = {'positive_count': 0, 'negative_count': 0, 'keywords': [], 'text': '天气'}

            intent = parser.determine_intent('今天天气不错', behavior_result)

            assert intent == 'unknown'

    def test_match_rule(self, app):
        with app.app_context():
            from models import NLPScoringRule, NLPBehaviorKeyword

            # 自包含：注入行为关键词，使 extract_behavior 能提取出“迟到”，
            # 否则 function 级隔离下无其它测试泄漏的关键词行，match_rule 查不到规则。
            kw = NLPBehaviorKeyword(
                keyword='迟到',
                keyword_type='纪律',
                score_type='deduct',
                default_score=-5,
            )
            db.session.add(kw)
            rule = NLPScoringRule(
                behavior_keyword='迟到',
                behavior_description='上课迟到',
                score_value=-5,
                score_type='deduct',
                is_active=True,
                priority=10
            )
            db.session.add(rule)
            db.session.commit()

            parser = NLPParserService()
            matched_rules = parser.match_rule('张三迟到', 'deduct', '张三')

            assert len(matched_rules) >= 1

            db.session.rollback()

    def test_parse_add(self, app):
        with app.app_context():

            user = User(
                name='张三',
                card_id='NLP002',
                class_name='测试班级',
                current_score=100
            )
            keyword = NLPBehaviorKeyword(
                keyword='加分',
                keyword_type='奖励',
                score_type='add',
                default_score=5
            )
            rule = NLPScoringRule(
                behavior_keyword='加分',
                behavior_description='表现优秀加分',
                score_value=5,
                score_type='add',
                is_active=True,
                priority=10
            )
            db.session.add_all([user, keyword, rule])
            db.session.commit()

            parser = NLPParserService()
            result = parser.parse('张三同学加分')

            assert result['success'] is True
            assert result['extracted_name'] == '张三'
            assert result['intent'] == 'add'
            assert result['confidence'] > 0.0

            db.session.rollback()

    def test_parse_deduct(self, app):
        with app.app_context():

            user = User(
                name='李四',
                card_id='NLP003',
                class_name='测试班级',
                current_score=100
            )

            existing_keyword = NLPBehaviorKeyword.query.filter_by(keyword='迟到').first()
            if not existing_keyword:
                keyword = NLPBehaviorKeyword(
                    keyword='迟到',
                    keyword_type='纪律',
                    score_type='deduct',
                    default_score=-5
                )
                db.session.add(keyword)

            rule = NLPScoringRule(
                behavior_keyword='迟到',
                behavior_description='上课迟到',
                score_value=-5,
                score_type='deduct',
                is_active=True,
                priority=10
            )
            db.session.add_all([user, rule])
            db.session.commit()

            parser = NLPParserService()
            result = parser.parse('李四同学迟到')

            assert result['success'] is True
            assert result['extracted_name'] == '李四'
            assert result['intent'] == 'deduct'

            db.session.rollback()

    def test_parse_unknown(self, app):
        with app.app_context():

            parser = NLPParserService()
            result = parser.parse('xyz123测试文本')

            assert result['success'] is False
            assert result['intent'] == 'unknown'
            assert 'suggestions' in result

    def test_calculate_confidence(self, app):
        with app.app_context():

            parser = NLPParserService()

            behavior_result = {'positive_count': 2, 'negative_count': 0, 'keywords': [], 'text': ''}

            confidence = parser._calculate_confidence(behavior_result, 'add', [])

            assert confidence >= 0.0
            assert confidence <= 1.0

    def test_generate_suggestions_positive(self, app):
        with app.app_context():

            parser = NLPParserService()
            behavior_result = {'positive_count': 2, 'negative_count': 0, 'keywords': [], 'text': '优秀'}

            suggestions = parser._generate_suggestions('张三表现优秀', behavior_result)

            assert len(suggestions) >= 1
            assert suggestions[0]['intent'] == 'add'

    def test_generate_suggestions_negative(self, app):
        with app.app_context():

            parser = NLPParserService()
            behavior_result = {'positive_count': 0, 'negative_count': 2, 'keywords': [], 'text': '迟到'}

            suggestions = parser._generate_suggestions('李四迟到', behavior_result)

            assert len(suggestions) >= 1
            assert suggestions[0]['intent'] == 'deduct'

    def test_batch_parse(self, app):
        with app.app_context():

            parser = NLPParserService()
            texts = ['张三加分', '李四迟到', '王五查询']

            results = parser.batch_parse(texts)

            assert len(results) == 3
            for result in results:
                assert 'success' in result
                assert 'intent' in result
