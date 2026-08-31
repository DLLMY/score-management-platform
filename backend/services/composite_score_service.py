"""综合评分服务模块

基于熵权法实现多维度综合评分计算。
"""

from datetime import datetime
from models import db, User, Score, ScoreRecord, CompositeScore, get_by_id
from utils.db_session import db_session_scope
from .algorithm_service import AlgorithmService
from sqlalchemy import func
import numpy as np

_computation_progress = {
    "status": "idle",
    "progress": 0,
    "message": "",
    "total_students": 0,
    "completed_students": 0,
    "start_time": None,
    "end_time": None,
}


class CompositeScoreService:
    """综合评分服务类"""

    @staticmethod
    def calculate_composite_score(class_name=None):
        """计算综合评分

        Args:
            class_name (str): 班级名称（可选）

        Returns:
            dict: 综合评分结果
        """
        global _computation_progress
        _computation_progress = {
            "status": "running",
            "progress": 0,
            "message": "开始计算综合评分...",
            "total_students": 0,
            "completed_students": 0,
            "start_time": datetime.now().isoformat(),
            "end_time": None,
        }

        from sqlalchemy import func

        query = User.query.filter(User.is_active)
        if class_name:
            query = query.filter(User.class_name == class_name)
        users = query.all()
        _computation_progress["total_students"] = len(users)

        if not users:
            _computation_progress["status"] = "completed"
            _computation_progress["progress"] = 100
            _computation_progress["message"] = "没有找到学生数据"
            _computation_progress["end_time"] = datetime.now().isoformat()
            return {
                "method": "entropy_weight",
                "weights": {},
                "rankings": [],
                "message": "没有找到学生数据",
            }

        user_ids = [user.id for user in users]
        _computation_progress["progress"] = 15
        _computation_progress["message"] = "正在获取学业成绩数据..."

        academic_map = {}
        score_stats = (
            db.session.query(
                Score.student_id,
                func.avg(Score.score).label("avg_score"),
            )
            .filter(
                Score.student_id.in_(user_ids),
                Score.score > 0,
            )
            .group_by(Score.student_id)
            .all()
        )
        for stat in score_stats:
            academic_map[stat.student_id] = float(stat.avg_score) if stat.avg_score else 0

        _computation_progress["progress"] = 30
        _computation_progress["message"] = "正在获取开锁记录数据..."

        unlock_map = {}
        unlock_counts = (
            db.session.query(
                ScoreRecord.student_id,
                func.count(ScoreRecord.id).label("count"),
            )
            .filter(
                ScoreRecord.description.like("%开锁%"),
            )
            .group_by(ScoreRecord.student_id)
            .all()
        )
        for count in unlock_counts:
            unlock_map[count.student_id] = count.count

        data = []
        for user in users:
            behavior_score = user.current_score or 0
            academic_score = academic_map.get(user.id, 0)
            unlock_count = unlock_map.get(user.id, 0)
            data.append(
                {
                    "user_id": user.id,
                    "name": user.name,
                    "class_name": user.class_name,
                    "behavior": behavior_score,
                    "academic": academic_score,
                    "unlock_count": unlock_count,
                }
            )

        if not data:
            return {
                "method": "entropy_weight",
                "weights": {},
                "rankings": [],
                "message": "没有足够的数据进行评分",
            }

        _computation_progress["progress"] = 50
        _computation_progress["message"] = "正在进行数据预处理..."
        processed_data = CompositeScoreService._preprocess_data(data)

        _computation_progress["progress"] = 65
        _computation_progress["message"] = "正在计算熵权..."
        features = np.array(
            [[d["behavior_norm"], d["academic_norm"], d["compliance_norm"]] for d in processed_data]
        )
        weights = AlgorithmService.entropy_weight(features)

        _computation_progress["progress"] = 80
        _computation_progress["message"] = "正在计算综合得分..."
        results = CompositeScoreService._calculate_scores(processed_data, weights)

        _computation_progress["progress"] = 90
        _computation_progress["message"] = "正在保存结果到数据库..."
        CompositeScoreService._save_results(results, weights)

        _computation_progress["status"] = "completed"
        _computation_progress["progress"] = 100
        _computation_progress["message"] = "计算完成"
        _computation_progress["end_time"] = datetime.now().isoformat()

        return {
            "method": "entropy_weight",
            "weights": {
                "behavior": round(float(weights[0]), 4),
                "academic": round(float(weights[1]), 4),
                "compliance": round(float(weights[2]), 4),
            },
            "rankings": results,
            "message": "计算完成",
        }

    @staticmethod
    def _preprocess_data(data):
        """数据预处理：正向化和归一化

        Args:
            data (list): 原始数据

        Returns:
            list: 预处理后的数据
        """
        behaviors = [d["behavior"] for d in data]
        academics = [d["academic"] for d in data]
        unlock_counts = [d["unlock_count"] for d in data]

        behavior_norm = AlgorithmService.normalize_data(behaviors).tolist()
        academic_norm = AlgorithmService.normalize_data(academics).tolist()
        max_unlock = max(unlock_counts) if unlock_counts else 1
        compliance_forward = [max_unlock - u + 1 for u in unlock_counts]
        compliance_norm = AlgorithmService.normalize_data(compliance_forward).tolist()

        for i, d in enumerate(data):
            d["behavior_norm"] = behavior_norm[i]
            d["academic_norm"] = academic_norm[i]
            d["compliance_norm"] = compliance_norm[i]

        return data

    @staticmethod
    def _calculate_scores(data, weights):
        """计算综合得分

        Args:
            data (list): 预处理后的数据
            weights (np.ndarray): 各维度权重

        Returns:
            list: 包含综合得分的结果
        """
        results = []
        for d in data:
            weighted_score = (
                d["behavior_norm"] * weights[0]
                + d["academic_norm"] * weights[1]
                + d["compliance_norm"] * weights[2]
            )
            composite_score = round(float(weighted_score * 100), 2)
            results.append(
                {
                    "user_id": d["user_id"],
                    "name": d["name"],
                    "class_name": d["class_name"],
                    "behavior_score": d["behavior"],
                    "academic_score": round(d["academic"], 2),
                    "unlock_count": d["unlock_count"],
                    "social_score": round(float(d["compliance_norm"] * 100), 2),
                    "composite_score": composite_score,
                }
            )

        results.sort(key=lambda x: x["composite_score"], reverse=True)
        for i, r in enumerate(results):
            r["ranking"] = i + 1
        return results

    @staticmethod
    def _save_results(results, weights):
        """保存结果到数据库

        Args:
            results (list): 评分结果
            weights (np.ndarray): 权重
        """
        # #198-A 修复：必须按本次重算的学生集合精准删除，不能无条件 delete() 全表——
        # 否则带 class_name 的部分重算会清空其他班级的综合评分（数据丢失高危 bug）。
        result_user_ids = [r["user_id"] for r in results]
        if result_user_ids:
            CompositeScore.query.filter(
                CompositeScore.student_id.in_(result_user_ids)
            ).delete(synchronize_session=False)
        with db_session_scope():
            for r in results:
                composite = CompositeScore(
                    student_id=r["user_id"],
                    behavior_score=r["behavior_score"],
                    academic_score=r["academic_score"],
                    composite_score=r["composite_score"],
                    social_score=r["social_score"],
                    weights={
                        "behavior": float(weights[0]),
                        "academic": float(weights[1]),
                        "social": float(weights[2]),
                    },
                )
                db.session.add(composite)

    @staticmethod
    def get_composite_scores(class_name=None):
        """获取综合评分结果

        Args:
            class_name (str): 班级名称（可选）

        Returns:
            dict: 综合评分结果
        """
        query = CompositeScore.query.join(User, CompositeScore.student_id == User.id).filter(
            User.is_active
        )
        if class_name:
            query = query.filter(User.class_name == class_name)
        composites = query.order_by(CompositeScore.composite_score.desc()).all()

        if not composites:
            return {
                "method": "entropy_weight",
                "weights": {},
                "rankings": [],
                "message": "暂无综合评分数据，请先计算",
            }

        first = composites[0]
        w = first.weights or {}
        weights = {
            "behavior": w.get("behavior", 0),
            "academic": w.get("academic", 0),
            "social": w.get("social", 0),
        }

        user_ids = [c.student_id for c in composites]
        academic_map = {}
        if user_ids:
            score_stats = (
                db.session.query(
                    Score.student_id,
                    func.avg(Score.score).label("avg_score"),
                )
                .filter(
                    Score.student_id.in_(user_ids),
                    Score.score > 0,
                )
                .group_by(Score.student_id)
                .all()
            )
            for stat in score_stats:
                academic_map[stat.student_id] = (
                    round(float(stat.avg_score), 2) if stat.avg_score else None
                )

        user_map = (
            {u.id: u for u in User.query.filter(User.id.in_(user_ids)).all()} if user_ids else {}
        )
        rankings = []
        for i, composite in enumerate(composites):
            u = user_map.get(composite.student_id)
            rankings.append(
                {
                    "user_id": composite.student_id,
                    "name": u.name if u else None,
                    "class_name": u.class_name if u else None,
                    "behavior_score": (
                        composite.behavior_score
                        if composite.behavior_score is not None
                        else (u.current_score if u else None)
                    ),  # R7: 与写入归一化语义一致（原被 current_score 覆盖）
                    "academic_score": academic_map.get(composite.student_id),
                    "composite_score": composite.composite_score,
                    "ranking": i + 1,
                }
            )

        return {
            "method": "entropy_weight",
            "weights": weights,
            "rankings": rankings,
            "updated_at": (
                composites[0].computed_at.isoformat() if composites[0].computed_at else None
            ),
        }

    @staticmethod
    def _get_student_avg_score(user_id):
        """获取学生平均成绩

        Args:
            user_id (int): 学生ID

        Returns:
            float: 平均成绩
        """
        scores = Score.query.filter_by(student_id=user_id).all()
        if scores:
            valid_scores = [s.score for s in scores if s.score is not None]
            return round(sum(valid_scores) / len(valid_scores), 2) if valid_scores else None
        return None

    @staticmethod
    def get_student_composite_score(user_id):
        """获取单个学生的综合评分

        Args:
            user_id (int): 学生ID

        Returns:
            dict or None: 综合评分信息
        """
        composite = CompositeScore.query.filter_by(student_id=user_id).first()
        if not composite:
            return None
        rank = (
            CompositeScore.query.filter(
                CompositeScore.composite_score > composite.composite_score
            ).count()
            + 1
            if composite.composite_score is not None
            else None
        )
        w = composite.weights or {}
        return {
            "user_id": composite.student_id,
            "composite_score": composite.composite_score,
            "social_score": composite.social_score,
            "ranking": rank,
            "weights": {
                "behavior": w.get("behavior", 0),
                "academic": w.get("academic", 0),
                "social": w.get("social", 0),
            },
            "updated_at": composite.computed_at.isoformat() if composite.computed_at else None,
        }

    @staticmethod
    def recalculate_user_score(user_id):
        """增量更新单个学生的综合评分

        使用已有的权重配置，重新计算单个学生的综合评分，并更新排名。
        优化：使用聚合查询批量获取数据，避免N+1查询。

        Args:
            user_id (int): 学生ID

        Returns:
            dict or None: 更新后的综合评分信息，None表示没有找到评分记录
        """
        first_composite = CompositeScore.query.first()
        if not first_composite:
            print("[CompositeScore] 没有找到综合评分记录，需要先进行全量计算")
            return None

        fw = first_composite.weights or {}
        weights = np.array(
            [
                fw.get("behavior", 0),
                fw.get("academic", 0),
                fw.get("social", 0),
            ]
        )

        user = get_by_id(User, user_id)
        if not user or not user.is_active:
            print(f"[CompositeScore] 学生不存在或已停用: user_id={user_id}")
            return None

        # R1-R9 复核补漏（原 P2-8）: 基数统一为全量活跃学生（与全量计算一致，原取 composite 表用户 → 结果不可比）
        active_user_ids = [u.id for u in User.query.filter(User.is_active).all()]
        if not active_user_ids:
            print("[CompositeScore] 没有活跃学生的综合评分记录")
            return None
        # 学生无综合评分记录（首次积分变动即触发 recalc）→ 返回 None，由全量计算生成；
        # 原实现直接 index() 抛 ValueError → 崩
        if user_id not in active_user_ids:
            print(f"[CompositeScore] 学生 {user_id} 无综合评分记录，跳过增量重算（首次需全量计算）")
            return None

        behavior_map = {
            u.id: u.current_score or 0
            for u in User.query.filter(User.id.in_(active_user_ids)).all()
        }

        academic_map = {}
        academic_stats = (
            db.session.query(
                Score.student_id,
                func.avg(Score.score).label("avg_score"),
            )
            .filter(
                Score.student_id.in_(active_user_ids),
                Score.score > 0,
            )
            .group_by(Score.student_id)
            .all()
        )
        for stat in academic_stats:
            academic_map[stat.student_id] = float(stat.avg_score) if stat.avg_score else 0

        unlock_map = {}
        unlock_stats = (
            db.session.query(
                ScoreRecord.student_id,
                func.count(ScoreRecord.id).label("count"),
            )
            .filter(
                ScoreRecord.description.like("%开锁%"),
            )
            .group_by(ScoreRecord.student_id)
            .all()
        )
        for stat in unlock_stats:
            unlock_map[stat.student_id] = stat.count

        # #198-B 修复：归一化口径与全量计算（无 class_name 时 data=全量活跃）一致——
        # 用全量活跃学生的开锁次数取 max，而非全局 unlock_map（含已停用学生），
        # 避免增量重算后该生 composite 与同学的归一化 scale 不一致、结果不可比。
        max_unlock = max((unlock_map.get(uid, 0) for uid in active_user_ids), default=1)
        behavior_scores = [behavior_map.get(uid, 0) for uid in active_user_ids]
        academic_scores = [academic_map.get(uid, 0) for uid in active_user_ids]
        compliance_forward = [max_unlock - unlock_map.get(uid, 0) + 1 for uid in active_user_ids]

        behavior_norm = AlgorithmService.normalize_data(behavior_scores)
        academic_norm = AlgorithmService.normalize_data(academic_scores)
        compliance_norm = AlgorithmService.normalize_data(compliance_forward)

        user_index = active_user_ids.index(user_id)
        behavior_norm_value = float(behavior_norm[user_index])
        academic_norm_value = float(academic_norm[user_index])
        compliance_norm_value = float(compliance_norm[user_index])

        weighted_score = (
            behavior_norm_value * weights[0]
            + academic_norm_value * weights[1]
            + compliance_norm_value * weights[2]
        )
        composite_score = round(float(weighted_score * 100), 2)

        composite = CompositeScore.query.filter_by(student_id=user_id).first()
        if composite:
            old_score = composite.composite_score
            composite.behavior_score = behavior_norm_value
            composite.academic_score = academic_norm_value
            composite.social_score = compliance_norm_value
            composite.composite_score = composite_score
            composite.computed_at = datetime.now()
            # P2-6 修复: 原 `db_session_scope(): pass` 空提交 → 真实持久化增量更新
            # 注意：不得用 db_session_scope 包裹 —— 其 finally 会 session.remove() 销毁
            # 请求级 session，导致调用方（records/approvals 等路由）后续访问已提交的
            # ORM 对象（如 record.id）抛 DetachedInstanceError → 500（线上实测复现）。
            # composite 本就绑定当前请求 session，直接改属性 + commit 即可持久化。
            db.session.merge(composite)
            db.session.commit()
            print(
                f"[CompositeScore] 增量更新成功: user_id={user_id}, "
                f"old_score={old_score}, new_score={composite_score}"
            )
            return CompositeScoreService.get_student_composite_score(user_id)
        else:
            print(f"[CompositeScore] 学生没有综合评分记录，需要先进行全量计算: user_id={user_id}")
            return None

    # P2-6 修复: 移除 _update_rankings 空操作（无 rank 列 + 空提交 + 虚假"排名已更新"日志；
    # 排名由 get_student_composite_score 动态 COUNT 计算，无需落库）

    @staticmethod
    def get_computation_progress():
        """获取综合评分计算进度

        Returns:
            dict: 计算进度信息，包含状态、进度百分比、消息等
        """
        return _computation_progress.copy()

    @staticmethod
    def recalculate_all():
        """重新计算所有学生的综合评分（calculate_composite_score 的别名）"""
        return CompositeScoreService.calculate_composite_score()
