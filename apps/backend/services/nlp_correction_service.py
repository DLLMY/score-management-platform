"""NLP 纠正记录写入/事务路径薄封装（F17 防腐层：从 api/nlp/nlp_routes 收口）。

逐字节复刻原路由内联落库行为，供路由调用；路由保留 get_or_404 / 请求校验 /
跨切面副作用（清解析器 _parse_cache 解析缓存）/ 响应构造。

迁移范围（原 db.session 写路径）：
- NLPFeedbackRecord.post 内联 NLPCorrection 建模 + 批量 add + commit（自学习纠正落库）
- NLPCorrectionDetail.put 更新纠正状态（approved→confidence_after=1.0）+ commit
- NLPCorrectionDetail.delete 删除纠正记录 + commit

不迁移：NLPModelEvaluate.get 的 db.session.execute(SELECT 聚合) 属只读 query，按 F17 铁律暂缓。
"""

from models import db, NLPCorrection


def record_corrections(corrections, user_id, input_text, confidence):
    """复刻 NLPFeedbackRecord.post 内联 NLPCorrection 建模 + 批量 add + commit。

    corrections: 由路由根据字段差异构造的纠正 dict 列表，每项含
        field_type / original_value / corrected_value。
    返回保存的纠正记录数。解析缓存失效（清 _parse_cache）由路由层负责。
    """
    saved = 0
    for corr in corrections:
        nlp_correction = NLPCorrection(
            input_text=input_text,
            original_text=input_text,
            field_type=corr["field_type"],
            original_value=corr["original_value"],
            corrected_value=corr["corrected_value"],
            corrected_by=user_id,
            status="approved",
            confidence_after=confidence,
        )
        db.session.add(nlp_correction)
        saved += 1
    db.session.commit()
    return saved


def update_correction_status(correction, status):
    """复刻 NLPCorrectionDetail.put 内联字段赋值 + commit。

    路由负责 get_or_404(correction_id) 与 status 合法性校验（["approved","rejected","learned"]）。
    """
    correction.status = status
    if status == "approved":
        correction.confidence_after = 1.0
    db.session.commit()
    return correction


def delete_correction(correction):
    """复刻 NLPCorrectionDetail.delete 内联 delete + commit。"""
    db.session.delete(correction)
    db.session.commit()
