from datetime import datetime
from models import User, StudentCluster, Score, db
from .algorithm_service import AlgorithmService, CACHE_PREFIX, CACHE_TTL
from .redis_cache_service import get_cache_service
from utils.db_session import db_session_scope
import numpy as np

"""
学生分群服务模块
基于K-Means算法实现学生群体聚类分析
支持Redis缓存策略，提升响应速度
"""


class ClusterService:
    """学生分群服务类"""

    @staticmethod
    def perform_clustering(class_name=None, n_clusters=4):
        """
        执行学生分群（执行后会清除缓存）
        Args:
            class_name (str): 班级名称（可选，为空则全部分群）
            n_clusters (int): 聚类数量，默认4
        Returns:
            dict: 分群结果
        """
        # 获取学生数据
        df = AlgorithmService.get_student_data_for_analysis(class_name)
        if df.empty:
            return {
                "algorithm": "KMeans",
                "n_clusters": n_clusters,
                "students": [],
                "cluster_summary": [],
                "message": "没有足够的数据进行分群",
            }
        # 准备特征数据
        features = df[["behavior_score", "academic_score"]].values
        # 标准化数据
        scaler = AlgorithmService.standardize_data
        behavior_std = scaler(features[:, 0])
        academic_std = scaler(features[:, 1])
        features_std = np.column_stack([behavior_std, academic_std])
        # 执行K-Means聚类
        labels, centroids = AlgorithmService.kmeans_cluster(features_std, n_clusters)
        # 确定类别名称
        cluster_names = AlgorithmService.determine_cluster_names(centroids)
        # 保存分群结果到数据库
        ClusterService._save_cluster_results(df, labels, cluster_names, features_std)
        # 清除相关缓存
        ClusterService._invalidate_cache(class_name)
        # 构建返回结果
        students_result = []
        cluster_summary = {}
        for i, (_, row) in enumerate(df.iterrows()):
            label = labels[i]
            cluster_name = cluster_names[label]
            students_result.append(
                {
                    "user_id": row["user_id"],
                    "name": row["name"],
                    "class_name": row["class_name"],
                    "cluster": int(label),
                    "cluster_name": cluster_name,
                    "behavior_score": row["behavior_score"],
                    "academic_score": row["academic_score"],
                }
            )
            if cluster_name not in cluster_summary:
                cluster_summary[cluster_name] = {
                    "count": 0,
                    "avg_behavior": 0,
                    "avg_score": 0,
                    "cluster_label": label,
                }
            cluster_summary[cluster_name]["count"] += 1
            cluster_summary[cluster_name]["avg_behavior"] += row["behavior_score"]
            cluster_summary[cluster_name]["avg_score"] += row["academic_score"]
        # 计算平均值
        for name, stats in cluster_summary.items():
            stats["avg_behavior"] = round(stats["avg_behavior"] / stats["count"], 2)
            stats["avg_score"] = round(stats["avg_score"] / stats["count"], 2)
        result = {  # noqa: F841
            "algorithm": "KMeans",
            "n_clusters": n_clusters,
            "students": students_result,
            "cluster_summary": list(cluster_summary.values()),
            "updated_at": datetime.now().isoformat(),
        }
        # 缓存新结果
        cache_svc = get_cache_service()
        if cache_svc:
            cache_svc.set(
                f'{CACHE_PREFIX}cluster:{class_name or "all"}',
                result,
                ttl=CACHE_TTL["cluster"],
            )
        return result

    @staticmethod
    def _invalidate_cache(class_name=None):
        """
        清除分群相关缓存
        Args:
            class_name (str): 班级名称（可选）
        """
        cache_svc = get_cache_service()
        if cache_svc:
            if class_name:
                cache_svc.delete(f"{CACHE_PREFIX}cluster:{class_name}")
            else:
                # 清除所有分群缓存
                cache_svc.flush("cluster:*")
            # 同时清除算法统计缓存
            cache_svc.flush("algorithm:*")

    @staticmethod
    def _save_cluster_results(df, labels, cluster_names, features_std):
        """
        保存分群结果到数据库
        Args:
            df (pd.DataFrame): 学生数据
            labels (np.ndarray): 聚类标签
            cluster_names (dict): 类别名称映射
            features_std (np.ndarray): 标准化特征
        """
        # 清除旧的分群结果
        for _, row in df.iterrows():
            StudentCluster.query.filter_by(user_id=row["user_id"]).delete()
        # 保存新结果
        with db_session_scope():
            for i, (_, row) in enumerate(df.iterrows()):
                label = labels[i]
                cluster = StudentCluster(
                    user_id=row["user_id"],
                    cluster_label=cluster_names[label],
                    cluster_score=float(row.get("academic_score", 0)),
                    features={
                        "behavior_score": float(features_std[i][0]) if len(features_std[i]) > 0 else 0,
                        "academic_score": float(features_std[i][1]) if len(features_std[i]) > 1 else 0,
                        "cluster_name": cluster_names[label],
                    },
                    updated_at=datetime.now(),
                )
                db.session.add(cluster)

    @staticmethod
    def get_cluster_results(class_name=None):
        """
        获取分群结果（带缓存）
        Args:
            class_name (str): 班级名称（可选）
        Returns:
            dict: 分群结果
        """
        # 尝试从缓存获取
        cache_key = f'{CACHE_PREFIX}cluster:{class_name or "all"}'
        cache_svc = get_cache_service()
        cached_result = cache_svc.get(cache_key) if cache_svc else None
        if cached_result is not None:
            return cached_result
        query = StudentCluster.query.join(
            User, StudentCluster.user_id == User.id
        ).filter(User.is_active)
        if class_name:
            query = query.filter(User.class_name == class_name)
        clusters = query.all()
        if not clusters:
            return {
                "algorithm": "KMeans",
                "n_clusters": 4,
                "students": [],
                "cluster_summary": [],
                "message": "暂无分群数据，请先执行分群",
            }
        # 构建结果
        students_result = []
        cluster_summary = {}
        for cluster in clusters:
            cluster_name = (
                cluster.features.get("cluster_name", cluster.cluster_label)
                if cluster.features
                else cluster.cluster_label
            )
            students_result.append(
                {
                    "user_id": cluster.user_id,
                    "name": cluster.user.name,
                    "class_name": cluster.user.class_name,
                    "cluster": cluster.cluster_label,
                    "cluster_name": cluster_name,
                    "behavior_score": cluster.user.current_score,
                    "academic_score": ClusterService._get_student_avg_score(cluster.user_id),
                }
            )
            if cluster_name not in cluster_summary:
                cluster_summary[cluster_name] = {
                    "count": 0,
                    "avg_behavior": 0,
                    "avg_score": 0,
                    "cluster_label": cluster.cluster_label,
                }
            cluster_summary[cluster_name]["count"] += 1
            cluster_summary[cluster_name]["avg_behavior"] += cluster.user.current_score
            avg_score = ClusterService._get_student_avg_score(cluster.user_id)
            cluster_summary[cluster_name]["avg_score"] += avg_score if avg_score else 0
        # 计算平均值
        for name, stats in cluster_summary.items():
            stats["avg_behavior"] = round(stats["avg_behavior"] / stats["count"], 2)
            stats["avg_score"] = round(stats["avg_score"] / stats["count"], 2)
        result = {  # noqa: F841
            "algorithm": "KMeans",
            "n_clusters": len(cluster_summary),
            "students": students_result,
            "cluster_summary": list(cluster_summary.values()),
            "updated_at": (clusters[0].updated_at.isoformat() if clusters else None),
        }
        # 缓存结果
        if cache_svc:
            cache_svc.set(cache_key, result, ttl=CACHE_TTL["cluster"])
        return result

    @staticmethod
    def _get_student_avg_score(user_id):
        """
        获取学生平均成绩
        Args:
            user_id (int): 学生ID
        Returns:
            float: 平均成绩
        """
        scores = Score.query.filter_by(student_id=user_id).all()
        if scores:
            valid_scores = [s.score for s in scores if s.score is not None]
            return sum(valid_scores) / len(valid_scores) if valid_scores else None
        return None

    @staticmethod
    def get_cluster_by_user(user_id):
        """
        获取单个学生的分群信息
        Args:
            user_id (int): 学生ID
        Returns:
            dict or None: 分群信息
        """
        cluster = StudentCluster.query.filter_by(user_id=user_id).first()
        if not cluster:
            return None
        cluster_name = (
            cluster.features.get("cluster_name", cluster.cluster_label) if cluster.features else cluster.cluster_label
        )
        features = cluster.features or {}
        return {
            "user_id": cluster.user_id,
            "cluster": cluster.cluster_label,
            "cluster_name": cluster_name,
            "behavior_score": features.get("behavior_score", 0),
            "academic_score": features.get("academic_score", 0),
            "updated_at": cluster.updated_at.isoformat(),
        }

    @staticmethod
    def recalculate_clusters(class_name=None, n_clusters=4):
        """重新计算聚类（perform_clustering 的别名，供 algorithm_routes 调用）"""
        return ClusterService.perform_clustering(class_name, n_clusters)

    @staticmethod
    def get_clusters():
        """获取全部分群结果（供 /api/algorithm/all 聚合接口使用）"""
        return ClusterService.get_cluster_results()
