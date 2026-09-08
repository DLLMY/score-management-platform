"""P1-4 补齐：FastNLPParser 契约测试（此前零覆盖）。

services/nlp_fast_parser.py 是 /api/nlp/parse 的快速路径，349 行实现在
全测试套件中此前无任何引用。本文件固化其对外契约：

- 解析成功时字段齐备且 parser_type 恒为 'fast'
- 「分数」只抽取数字幅度，加减方向由 intent 承载；无显式分数时按意图补 ±1.0
- 空串 / 超长文本(>50) 主动放弃快速路径（success=False），交由完整解析器
- can_handle 必须与 parse 的 is_simple 判定一致，否则路由层会误判
- lru_cache 生效（重复文本命中缓存）
- 复合句按分句拆分、**逐子句独立解析**：顶层字段取首个子句（语义自洽），
  `results` 给出全部子句；「、」枚举顿号不参与切分
"""

import pytest

from services.nlp_fast_parser import FastNLPParser, get_fast_parser


@pytest.fixture
def parser():
    """每个用例一个全新实例：parse 带 lru_cache，隔离缓存统计。"""
    p = FastNLPParser()
    p.clear_cache()
    return p


def test_parse_result_contract(parser):
    """解析成功必须齐备全部契约字段，parser_type 标识为 fast。"""
    result = parser.parse("张三迟到扣2分")
    assert result["success"] is True
    assert result["parser_type"] == "fast"
    assert result["is_simple"] is True
    for key in (
        "intent",
        "name",
        "extracted_name",
        "score",
        "description",
        "confidence",
        # 复句拆分扩展字段（见 test_compound_sentence_is_split_into_clauses）
        "is_compound",
        "clause_count",
        "results",
    ):
        assert key in result, key


def test_parse_deduct_sentence(parser):
    """扣分句：intent=deduct，姓名与分数幅度正确。"""
    result = parser.parse("张三迟到扣2分")
    assert result["intent"] == "deduct"
    assert result["name"] == "张三"
    assert float(result["score"]) == pytest.approx(2.0)


def test_parse_add_sentence(parser):
    """加分句：intent=add，姓名与分数幅度正确。"""
    result = parser.parse("李四积极回答加3分")
    assert result["success"] is True
    assert result["intent"] == "add"
    assert result["name"] == "李四"
    assert float(result["score"]) == pytest.approx(3.0)


def test_score_defaults_when_absent(parser):
    """无显式分数时按意图补默认值：add → +1.0，deduct → -1.0。

    注意快路径下「分数」是带符号的默认值，而显式分数只取幅度（正负由 intent 承载），
    两种语义并存，调用方必须结合 intent 判向。
    """
    add = parser.parse("王五积极发言")
    assert add["intent"] == "add"
    assert float(add["score"]) == pytest.approx(1.0)

    deduct = parser.parse("赵六迟到早退")
    assert deduct["intent"] == "deduct"
    assert float(deduct["score"]) == pytest.approx(-1.0)


def test_empty_text_rejected(parser):
    """空/纯空白文本 → success=False 且 confidence=0.0，不得伪造结果。"""
    result = parser.parse("   ")
    assert result["success"] is False
    assert result["confidence"] == 0.0
    assert result["is_simple"] is False


def test_overlong_text_not_simple(parser):
    """超过 50 字 → 判为非简单文本，快速路径放弃，交由完整解析器处理。"""
    long_text = "张三非常积极认真地完成了老师布置的各项学习任务并且还主动帮助了其他同学共同进步" * 2
    assert len(long_text) > 50
    result = parser.parse(long_text)
    assert result["is_simple"] is False
    assert result["success"] is False


def test_can_handle_consistent_with_is_simple(parser):
    """can_handle 必须与 parse 的 is_simple 一致，避免路由层误判走错路径。"""
    for text in ("张三迟到扣2分", "李四积极回答加3分", "今天天气不错"):
        assert parser.can_handle(text) == parser.parse(text)["is_simple"]


def test_batch_parse_aligned(parser):
    """batch_parse 结果与输入一一对应，逐条独立判定成功/失败。"""
    texts = ["张三迟到扣2分", "李四积极回答加3分", ""]
    results = parser.batch_parse(texts)
    assert len(results) == len(texts)
    assert results[0]["success"] is True
    assert results[1]["success"] is True
    assert results[2]["success"] is False


def test_parse_cache_hit(parser):
    """重复解析同一文本应命中 lru_cache（cache_hits +1），避免重复计算。"""
    parser.parse("张三迟到扣2分")
    before = parser.get_stats()["cache_hits"]
    parser.parse("张三迟到扣2分")
    assert parser.get_stats()["cache_hits"] == before + 1


def test_get_stats_shape(parser):
    """get_stats 返回固定字段，供 /performance/* 观测快路径缓存。"""
    stats = parser.get_stats()
    assert stats["parser_type"] == "fast"
    for key in (
        "cache_size",
        "cache_hits",
        "cache_misses",
        "intent_patterns_count",
        "name_patterns_count",
        "score_patterns_count",
    ):
        assert key in stats, key


def test_get_fast_parser_returns_singleton():
    """get_fast_parser() 返回模块级单例，避免重复编译正则。"""
    assert get_fast_parser() is get_fast_parser()


def test_compound_sentence_is_split_into_clauses(parser):
    """复句按分句分隔符拆分、逐子句独立解析（P1-4 复句错分修复）。

    修复前：整句统一抽一次意图/姓名/分数，得到「张三 + **add** + 2.0」——
    姓名取自文本位置最靠前者，意图却按 _quick_intent_keywords 字典序命中，
    于是「前半句的姓名 + 后半句的意图」错配，加减方向相反、李四被静默丢弃，
    而 confidence=1.0 让上层（nlp_service.py 的 >= 0.6 门槛）直接采信，
    完整解析器根本不参与，全程无失败信号。

    修复后：拆成子句各自解析 —— 顶层取首个子句（语义自洽），
    results 给出全部子句，不再丢人。
    """
    result = parser.parse("张三迟到扣2分，李四积极回答加3分")
    assert result["success"] is True
    assert result["is_compound"] is True
    assert result["clause_count"] == 2

    # 顶层取自第一个子句，方向正确（修复前此处是 add）
    assert result["name"] == "张三"
    assert result["intent"] == "deduct"
    assert float(result["score"]) == pytest.approx(2.0)

    first, second = result["results"]
    assert (first["name"], first["intent"]) == ("张三", "deduct")
    assert float(first["score"]) == pytest.approx(2.0)
    # 第二个子句不再被静默丢弃
    assert (second["name"], second["intent"]) == ("李四", "add")
    assert float(second["score"]) == pytest.approx(3.0)


def test_compound_sentence_split_on_full_stop(parser):
    """句号等句末标点同样作为分句分隔符。"""
    result = parser.parse("张三迟到扣2分。李四积极回答加3分")
    assert result["is_compound"] is True
    assert result["clause_count"] == 2
    assert [r["name"] for r in result["results"]] == ["张三", "李四"]


def test_enumeration_comma_not_split(parser):
    """「、」是枚举顿号（共享谓语结构），不参与分句切分。

    若把「张三、李四迟到扣2分」按顿号拆开，前半句「张三」会失去谓语而解析失败。
    """
    result = parser.parse("张三、李四迟到扣2分")
    assert result["is_compound"] is False
    assert result["clause_count"] == 1


def test_single_sentence_unchanged_by_split(parser):
    """单句路径不受拆分改造影响（回归护栏）：结果与改造前完全一致。"""
    result = parser.parse("张三迟到扣2分")
    assert result["is_compound"] is False
    assert result["clause_count"] == 1
    assert len(result["results"]) == 1
    assert result["results"][0]["name"] == "张三"
    assert result["results"][0]["intent"] == "deduct"
