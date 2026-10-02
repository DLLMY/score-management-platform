import logging

from flask_restx import Namespace

logger = logging.getLogger(__name__)

"""
算法分析API路由模块
提供统计分析、学生分群、综合评分、风险预警等功能
"""
ns_algorithm = Namespace("algorithm", description="算法分析相关操作")

# 62 个端点类按域拆分到 _alg_partN.py，保持 ns_algorithm 单一定义与注册
import api.algorithm._alg_part1
import api.algorithm._alg_part2
import api.algorithm._alg_part3
import api.algorithm._alg_part4
import api.algorithm._alg_part5
import api.algorithm._alg_part6

