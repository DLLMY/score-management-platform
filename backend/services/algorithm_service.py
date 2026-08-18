from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from scipy.stats import pearsonr
from functools import wraps
from models import User, Score
from services.redis_cache_service import get_cache_service
from config.config_loader import config_loader
import numpy as np

import pandas as pd

"""
算法核心服务模块
提供统计分析、数据预处理等基础功能
支持Redis缓存策略，提升响应速度
"""
CACHE_PREFIX = "algorithm:"
CACHE_TTL = config_loader.get_config("CACHE_TTL", 3600)


def algorithm_cache(key_func, ttl=3600):
    """
    算法结果缓存装饰器
    Args:
        key_func: 生成缓存键的函数
        ttl: 缓存过期时间（秒）
    """

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # 生成缓存键
            cache_key = CACHE_PREFIX + key_func(*args, **kwargs)
            # 获取缓存服务
            cache = get_cache_service()
            # 尝试从缓存获取
            cached_result = cache.get(cache_key) if cache else None
            if cached_result is not None:
                return cached_result
            # 执行实际计算
            result = func(*args, **kwargs)  # noqa: F841
            # 缓存结果
            if cache:
                cache.set(cache_key, result, expire=ttl)
            return result

        return wrapper

    return decorator


class AlgorithmService:
    """算法核心服务类"""

    def get_statistics(self, class_name=None):
        """获取综合统计分析（实例方法，供 algorithm_routes 调用）"""
        return self.calculate_statistics(class_name)

    def run_analysis(self, class_name=None):
        """运行算法分析（实例方法，供 algorithm_routes 调用）"""
        return self.calculate_statistics(class_name)

    @staticmethod
    def calculate_correlation(x, y):
        """
        计算两个变量的Pearson相关系数
        Args:
            x (list): 第一个变量
            y (list): 第二个变量
        Returns:
            tuple: (correlation_coefficient, p_value)
        """
        if len(x) < 2 or len(y) < 2:
            return (0.0, 1.0)
        x_array = np.array(x)
        y_array = np.array(y)
        # 去除NaN值
        mask = ~np.isnan(x_array) & ~np.isnan(y_array)
        x_clean = x_array[mask]
        y_clean = y_array[mask]
        if len(x_clean) < 2:
            return (0.0, 1.0)
        return pearsonr(x_clean, y_clean)

    @staticmethod
    def standardize_data(data):
        """
        标准化数据（Z-score标准化）
        Args:
            data (list or np.ndarray): 输入数据
        Returns:
            np.ndarray: 标准化后的数据
        """
        scaler = StandardScaler()
        return scaler.fit_transform(np.array(data).reshape(-1, 1)).flatten()

    @staticmethod
    def normalize_data(data, min_val=None, max_val=None):
        """
        归一化数据到[0, 1]区间
        Args:
            data (list or np.ndarray): 输入数据
            min_val (float): 最小值（可选）
            max_val (float): 最大值（可选）
        Returns:
            np.ndarray: 归一化后的数据
        """
        data_array = np.array(data)
        if min_val is None:
            min_val = np.min(data_array)
        if max_val is None:
            max_val = np.max(data_array)
        range_val = max_val - min_val
        if range_val == 0:
            return np.zeros_like(data_array)
        return (data_array - min_val) / range_val

    @staticmethod
    def entropy_weight(data_matrix):
        """
        熵权法计算权重
        Args:
            data_matrix (np.ndarray): n行m列的数据矩阵（n个样本，m个指标）
        Returns:
            np.ndarray: 各指标权重
        """
        # 数据标准化（正向化处理）
        data = np.array(data_matrix, dtype=float)
        n, m = data.shape
        # 归一化处理（列极差为 0 时退化为均匀值，避免除零）
        col_min = data.min(axis=0)
        col_range = data.max(axis=0) - col_min
        col_range = np.where(col_range == 0, 1.0, col_range)
        normalized_data = (data - col_min) / col_range
        # 逐列计算熵权，对全零/零方差列做鲁棒处理
        weights = np.zeros(m)
        col_sum = normalized_data.sum(axis=0)
        for j in range(m):
            if col_sum[j] == 0 or np.isclose(col_sum[j], 0):
                # 退化列：所有样本取值相同，信息量为 0，赋予基准差异系数 1
                p = np.full(n, 1.0 / n)
            else:
                p = normalized_data[:, j] / col_sum[j]
            p = np.where(p <= 0, 1e-10, p)  # 避免 log(0)
            entropy = -np.sum(p * np.log(p)) / np.log(n)
            weights[j] = 1 - entropy  # 差异系数
        # 归一化权重；若全部差异系数为 0（极端退化），回退为等权
        wsum = weights.sum()
        if wsum == 0 or np.isclose(wsum, 0):
            weights = np.full(m, 1.0 / m)
        else:
            weights = weights / wsum
        # 兜底：任何残留 NaN/inf 替换为等权
        if not np.all(np.isfinite(weights)):
            weights = np.full(m, 1.0 / m)
        return weights

    @staticmethod
    def kmeans_cluster(data, n_clusters=4):
        """
        K-Means聚类
        Args:
            data (np.ndarray): n行m列的数据矩阵
            n_clusters (int): 聚类数量
        Returns:
            tuple: (labels, centroids)
        """
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = kmeans.fit_predict(data)
        centroids = kmeans.cluster_centers_
        return labels, centroids

    @staticmethod
    def get_cluster_label_name(label):
        """
        根据聚类标签返回群体名称
        Args:
            label (int): 聚类标签
        Returns:
            str: 群体名称
        """
        label_names = {
            0: "全面优秀型",
            1: "遵纪但学业吃力型",
            2: "聪明但散漫型",
            3: "双困型",
        }
        return label_names.get(label, f"未知类型_{label}")

    @staticmethod
    def determine_cluster_names(centroids):
        """
        根据聚类中心确定每个类别的名称
        Args:
            centroids (np.ndarray): 聚类中心矩阵
        Returns:
            dict: {label: name} 映射
        """
        # 假设第一列为行为得分，第二列为学业得分
        result = {}  # noqa: F841
        for i, centroid in enumerate(centroids):
            behavior_score, academic_score = centroid[0], centroid[1]
            if behavior_score > 0.5 and academic_score > 0.5:
                result[i] = "全面优秀型"
            elif behavior_score > 0.5 and academic_score <= 0.5:
                result[i] = "遵纪但学业吃力型"
            elif behavior_score <= 0.5 and academic_score > 0.5:
                result[i] = "聪明但散漫型"
            else:
                result[i] = "双困型"
        return result

    @staticmethod
    def get_student_data_for_analysis(class_name=None):
        """
        获取学生数据用于分析
        Args:
            class_name (str): 班级名称（可选）
        Returns:
            pd.DataFrame: 包含行为积分和成绩的DataFrame
        """
        query = User.query.filter(User.is_active)
        if class_name:
            query = query.filter(User.class_name == class_name)
        users = query.all()
        data = []
        for user in users:
            # 获取行为积分
            behavior_score = user.current_score
            # 获取平均成绩
            scores = Score.query.filter_by(student_id=user.id).all()
            if scores:
                avg_score = np.mean([s.score for s in scores if s.score is not None])
            else:
                avg_score = None
            data.append(
                {
                    "user_id": user.id,
                    "name": user.name,
                    "class_name": user.class_name,
                    "behavior_score": behavior_score,
                    "academic_score": avg_score,
                }
            )
        df = pd.DataFrame(data)
        if df.empty:
            return df
        return df.dropna(subset=["behavior_score", "academic_score"])

    @staticmethod
    @algorithm_cache(
        key_func=lambda *args, **kwargs: f'statistics:{kwargs.get("class_name") or args[0] if args else "all"}',
        ttl=CACHE_TTL["statistics"],
    )
    def calculate_statistics(class_name=None):
        """
        计算统计分析指标（带缓存）
        Args:
            class_name (str): 班级名称（可选）
        Returns:
            dict: 统计结果
        """
        df = AlgorithmService.get_student_data_for_analysis(class_name)
        if df.empty:
            return {
                "avg_behavior_score": 0.0,
                "avg_academic_score": 0.0,
                "std_behavior_score": 0.0,
                "std_academic_score": 0.0,
                "correlation": 0.0,
                "pass_rate": 0.0,
                "student_count": 0,
                "group_comparison": [],
            }
        # 基本统计
        stats = {
            "avg_behavior_score": round(df["behavior_score"].mean(), 2),
            "avg_academic_score": round(df["academic_score"].mean(), 2),
            "std_behavior_score": round(df["behavior_score"].std(), 2),
            "std_academic_score": round(df["academic_score"].std(), 2),
            "student_count": len(df),
        }
        # 相关性分析
        corr, _ = AlgorithmService.calculate_correlation(
            df["behavior_score"].tolist(), df["academic_score"].tolist()
        )
        stats["correlation"] = round(corr, 2)
        # 及格率（假设60分为及格线）
        pass_count = len(df[df["academic_score"] >= 60])
        stats["pass_rate"] = round(pass_count / len(df), 2)
        # 分组对比
        df["behavior_group"] = pd.qcut(
            df["behavior_score"], 3, labels=["低分组", "中分组", "高分组"]
        )
        group_stats = (
            df.groupby("behavior_group")
            .agg(
                {
                    "behavior_score": "mean",
                    "academic_score": "mean",
                    "user_id": "count",
                }
            )
            .reset_index()
        )
        stats["group_comparison"] = [
            {
                "group": row["behavior_group"],
                "avg_behavior": round(row["behavior_score"], 2),
                "avg_score": round(row["academic_score"], 2),
                "count": row["user_id"],
            }
            for _, row in group_stats.iterrows()
        ]
        return stats
