import unittest
from unittest.mock import MagicMock, patch

import pandas as pd
import numpy as np

from services.cluster_service import ClusterService


class TestClusterService(unittest.TestCase):

    def test_perform_clustering_empty_data(self):
        """测试空数据分群"""
        with patch('services.cluster_service.AlgorithmService.get_student_data_for_analysis',
                return_value=pd.DataFrame()):
            result = ClusterService.perform_clustering()

            assert result["message"] == "没有足够的数据进行分群"
            assert result["students"] == []

    def test_perform_clustering_with_data(self):
        """测试正常分群"""
        mock_df = pd.DataFrame({
            "user_id": [1, 2, 3, 4],
            "name": ["Alice", "Bob", "Charlie", "David"],
            "class_name": ["Class A", "Class A", "Class B", "Class B"],
            "behavior_score": [80, 60, 70, 50],
            "academic_score": [85, 55, 75, 45],
        })

        mock_labels = np.array([0, 1, 0, 1])
        mock_centroids = np.array([[0.5, 0.5], [-0.5, -0.5]])
        mock_cluster_names = {0: "优秀群", 1: "待提升群"}

        with patch('services.cluster_service.AlgorithmService.get_student_data_for_analysis', return_value=mock_df), \
                          patch('services.cluster_service.AlgorithmService.standardize_data'
             , return_value=np.array([1.0, -1.0, 0.5, -0.5])), \
                          patch('services.cluster_service.AlgorithmService.kmeans_cluster'
             , return_value=(mock_labels, mock_centroids)), \
                          patch('services.cluster_service.AlgorithmService.determine_cluster_names'
             , return_value=mock_cluster_names), \
             patch('services.cluster_service.ClusterService._save_cluster_results'), \
             patch('services.cluster_service.ClusterService._invalidate_cache'), \
             patch('services.cluster_service.get_cache_service') as mock_cache:

            mock_cache_instance = MagicMock()
            mock_cache.return_value = mock_cache_instance

            result = ClusterService.perform_clustering(class_name="Class A", n_clusters=2)

            assert result["algorithm"] == "KMeans"
            assert result["n_clusters"] == 2
            assert len(result["students"]) == 4
            assert len(result["cluster_summary"]) == 2
            mock_cache_instance.set.assert_called_once()

    def test_invalidate_cache_with_class(self):
        """测试清除指定班级缓存"""
        with patch('services.cluster_service.get_cache_service') as mock_cache:
            mock_cache_instance = MagicMock()
            mock_cache.return_value = mock_cache_instance

            ClusterService._invalidate_cache(class_name="Class A")

            mock_cache_instance.delete.assert_called_once_with("algorithm:cluster:Class A")

    def test_invalidate_cache_all(self):
        """测试清除所有缓存"""
        with patch('services.cluster_service.get_cache_service') as mock_cache:
            mock_cache_instance = MagicMock()
            mock_cache.return_value = mock_cache_instance

            ClusterService._invalidate_cache()

            mock_cache_instance.flush.assert_any_call("cluster:*")
            mock_cache_instance.flush.assert_any_call("algorithm:*")

    def test_get_cluster_results_from_cache(self):
        """测试从缓存获取分群结果"""
        mock_cache_result = {
            "algorithm": "KMeans",
            "n_clusters": 4,
            "students": [],
            "cluster_summary": [],
        }

        with patch('services.cluster_service.get_cache_service') as mock_cache:
            mock_cache_instance = MagicMock()
            mock_cache.return_value = mock_cache_instance
            mock_cache_instance.get.return_value = mock_cache_result

            result = ClusterService.get_cluster_results(class_name="Class A")

            assert result == mock_cache_result

    def test_get_cluster_results_no_data(self):
        """测试无分群数据"""
        with patch('services.cluster_service.get_cache_service') as mock_cache, \
             patch('services.cluster_service.StudentCluster') as mock_cluster:

            mock_cache_instance = MagicMock()
            mock_cache.return_value = mock_cache_instance
            mock_cache_instance.get.return_value = None
            mock_cluster.query.join.return_value.filter.return_value.all.return_value = []

            result = ClusterService.get_cluster_results()

            assert result["message"] == "暂无分群数据，请先执行分群"

    def test_get_cluster_by_user_not_found(self):
        """测试获取不存在的学生分群"""
        with patch('services.cluster_service.StudentCluster') as mock_cluster:
            mock_cluster.query.filter_by.return_value.first.return_value = None

            result = ClusterService.get_cluster_by_user(999)

            assert result is None

    def test_get_cluster_by_user_found(self):
        """测试获取学生分群信息"""
        mock_cluster = MagicMock()
        mock_cluster.student_id = 1
        mock_cluster.cluster_label = 0
        mock_cluster.features = {
            "cluster_name": "优秀群",
            "behavior_score": 0.8,
            "academic_score": 0.9,
        }
        mock_cluster.updated_at.isoformat.return_value = "2024-01-01T00:00:00"

        with patch('services.cluster_service.StudentCluster') as mock_cluster_class:
            mock_cluster_class.query.filter_by.return_value.first.return_value = mock_cluster

            result = ClusterService.get_cluster_by_user(1)

            assert result["user_id"] == 1
            assert result["cluster_name"] == "优秀群"
            assert result["behavior_score"] == 0.8

    def test_get_student_avg_score_with_scores(self):
        """测试获取学生平均成绩（有成绩）"""
        mock_score1 = MagicMock()
        mock_score1.score = 80
        mock_score2 = MagicMock()
        mock_score2.score = 90

        with patch('services.cluster_service.Score') as mock_score:
            mock_score.query.filter_by.return_value.all.return_value = [mock_score1, mock_score2]

            result = ClusterService._get_student_avg_score(1)

            assert result == 85.0

    def test_get_student_avg_score_no_scores(self):
        """测试获取学生平均成绩（无成绩）"""
        with patch('services.cluster_service.Score') as mock_score:
            mock_score.query.filter_by.return_value.all.return_value = []

            result = ClusterService._get_student_avg_score(1)

            assert result is None

    def test_get_student_avg_score_with_none(self):
        """测试获取学生平均成绩（含None值）"""
        mock_score1 = MagicMock()
        mock_score1.score = 80
        mock_score2 = MagicMock()
        mock_score2.score = None

        with patch('services.cluster_service.Score') as mock_score:
            mock_score.query.filter_by.return_value.all.return_value = [mock_score1, mock_score2]

            result = ClusterService._get_student_avg_score(1)

            assert result == 80.0


if __name__ == '__main__':
    unittest.main()
