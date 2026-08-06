from datetime import datetime
from celery_app import celery_app
from services.cluster_service import ClusterService
from services.composite_score_service import CompositeScoreService
from services.warning_service import WarningService
from services.algorithm_service import AlgorithmService
import os
import sys

"""
算法异步任务模块
用于处理耗时的算法计算任务，如学生分群、综合评分、风险评估等
"""
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@celery_app.task(bind=True, name="tasks.algorithm_tasks.perform_clustering", priority=10)
def perform_clustering(self, class_name=None, n_clusters=4):
    """
    异步执行学生分群任务
    Args:
        class_name: 班级名称（可选）
        n_clusters: 聚类数量，默认4
    Returns:
        dict: 分群结果
    """
    task_id = self.request.id
    start_time = datetime.now()
    try:
        # 更新任务状态
        self.update_state(
            state="PROGRESS",
            meta={
                "status": "正在执行K-Means聚类...",
                "progress": 25,
                "start_time": start_time.isoformat(),
                "task_id": task_id,
            },
        )
        # 执行分群计算
        result = ClusterService.perform_clustering(class_name, n_clusters)  # noqa: F841
        # 更新任务状态
        self.update_state(
            state="PROGRESS",
            meta={
                "status": "分群完成，正在保存结果...",
                "progress": 75,
                "start_time": start_time.isoformat(),
                "task_id": task_id,
            },
        )
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        return {
            "status": "SUCCESS",
            "result": result,
            "task_id": task_id,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "duration_seconds": round(duration, 2),
        }
    except Exception as e:
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        return {
            "status": "FAILED",
            "error": str(e),
            "task_id": task_id,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "duration_seconds": round(duration, 2),
        }


@celery_app.task(bind=True, name="tasks.algorithm_tasks.calculate_composite_scores", priority=10)
def calculate_composite_scores(self, class_name=None):
    """
    异步计算综合评分任务
    Args:
        class_name: 班级名称（可选）
    Returns:
        dict: 综合评分结果
    """
    task_id = self.request.id
    start_time = datetime.now()
    try:
        # 更新任务状态
        self.update_state(
            state="PROGRESS",
            meta={
                "status": "正在收集学生数据...",
                "progress": 10,
                "start_time": start_time.isoformat(),
                "task_id": task_id,
            },
        )
        # 执行综合评分计算
        result = CompositeScoreService.calculate_composite_score(class_name)  # noqa: F841
        # 更新任务状态
        self.update_state(
            state="PROGRESS",
            meta={
                "status": "评分计算完成，正在保存结果...",
                "progress": 80,
                "start_time": start_time.isoformat(),
                "task_id": task_id,
            },
        )
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        return {
            "status": "SUCCESS",
            "result": result,
            "task_id": task_id,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "duration_seconds": round(duration, 2),
        }
    except Exception as e:
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        return {
            "status": "FAILED",
            "error": str(e),
            "task_id": task_id,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "duration_seconds": round(duration, 2),
        }


@celery_app.task(bind=True, name="tasks.algorithm_tasks.evaluate_risk", priority=15)
def evaluate_risk(self, class_name=None):
    """
    异步执行风险评估任务
    Args:
        class_name: 班级名称（可选）
    Returns:
        dict: 风险评估结果
    """
    task_id = self.request.id
    start_time = datetime.now()
    try:
        # 更新任务状态
        self.update_state(
            state="PROGRESS",
            meta={
                "status": "正在评估学生风险...",
                "progress": 30,
                "start_time": start_time.isoformat(),
                "task_id": task_id,
            },
        )
        # 执行风险评估
        result = WarningService.evaluate_risk(class_name)  # noqa: F841
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        return {
            "status": "SUCCESS",
            "result": result,
            "task_id": task_id,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "duration_seconds": round(duration, 2),
        }
    except Exception as e:
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        return {
            "status": "FAILED",
            "error": str(e),
            "task_id": task_id,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "duration_seconds": round(duration, 2),
        }


@celery_app.task(bind=True, name="tasks.algorithm_tasks.calculate_statistics", priority=5)
def calculate_statistics(self, class_name=None):
    """
    异步计算统计分析任务
    Args:
        class_name: 班级名称（可选）
    Returns:
        dict: 统计分析结果
    """
    task_id = self.request.id
    start_time = datetime.now()
    try:
        # 更新任务状态
        self.update_state(
            state="PROGRESS",
            meta={
                "status": "正在计算统计数据...",
                "progress": 50,
                "start_time": start_time.isoformat(),
                "task_id": task_id,
            },
        )
        # 执行统计计算
        result = AlgorithmService.calculate_statistics(class_name)  # noqa: F841
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        return {
            "status": "SUCCESS",
            "result": result,
            "task_id": task_id,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "duration_seconds": round(duration, 2),
        }
    except Exception as e:
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        return {
            "status": "FAILED",
            "error": str(e),
            "task_id": task_id,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "duration_seconds": round(duration, 2),
        }


@celery_app.task(name="tasks.algorithm_tasks.get_task_status")
def get_task_status(task_id):
    """
    获取任务状态
    Args:
        task_id: 任务ID
    Returns:
        dict: 任务状态信息
    """
    result = celery_app.AsyncResult(task_id)  # noqa: F841
    if result.state == "PENDING":
        return {"task_id": task_id, "status": "PENDING", "message": "任务等待执行"}
    elif result.state == "PROGRESS":
        return {"task_id": task_id, "status": "PROGRESS", "meta": result.info}
    elif result.state == "SUCCESS":
        return {"task_id": task_id, "status": "SUCCESS", "result": result.result}
    elif result.state == "FAILURE":
        return {"task_id": task_id, "status": "FAILURE", "error": str(result.info) if result.info else "未知错误"}
    else:
        return {"task_id": task_id, "status": result.state, "meta": result.info}
