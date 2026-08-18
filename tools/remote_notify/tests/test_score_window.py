# -*- coding: utf-8 -*-
"""
积分窗口测试模块
"""

import sys
import os

# 添加父目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from score_window import ScoreChangeWindow


def test_add_record():
    """测试添加积分记录"""
    window = ScoreChangeWindow()
    initial_count = len(window.records)
    
    window.add_record(
        student_name='测试学生',
        score_change=5,
        reason='测试原因',
        course='测试课程'
    )
    
    assert len(window.records) == initial_count + 1, "记录数量应增加1"
    assert window.records[-1]['student'] == '测试学生', "学生姓名应匹配"
    assert window.records[-1]['change'] == 5, "积分变化应为5"
    print("[PASS] test_add_record")


def test_negative_score():
    """测试负积分"""
    window = ScoreChangeWindow()
    
    window.add_record('学生1', -3, '迟到')
    
    assert window.records[-1]['change'] == -3, "负积分应正确保存"
    print("[PASS] test_negative_score")


def test_clear_records():
    """测试清空记录"""
    window = ScoreChangeWindow()
    window.add_record('学生1', 5, '原因1')
    window.add_record('学生2', -3, '原因2')
    
    assert len(window.records) == 2, "应有2条记录"
    
    window.clear_records()
    assert len(window.records) == 0, "清空后应为0条记录"
    print("[PASS]test_clear_records 通过")


def test_record_sorting():
    """测试记录排序（最新的在前）"""
    window = ScoreChangeWindow()
    
    window.add_record('学生1', 5, '原因1')
    window.add_record('学生2', 10, '原因2')
    window.add_record('学生3', 3, '原因3')
    
    # 最新添加的应在最前面
    assert window.records[0]['student'] == '学生3', "最新记录应在最前面"
    print("[PASS]test_record_sorting 通过")


def test_window_dimensions():
    """测试窗口尺寸限制"""
    # 测试最小尺寸
    window1 = ScoreChangeWindow(width=100, height=100)
    assert window1.width == 280, "宽度应限制在280"
    assert window1.height == 350, "高度应限制在350"
    
    # 测试最大尺寸
    window2 = ScoreChangeWindow(width=500, height=600)
    assert window2.width == 320, "宽度应限制在320"
    assert window2.height == 450, "高度应限制在450"
    
    print("[PASS]test_window_dimensions 通过")


def test_get_instance():
    """测试单例模式"""
    from score_window import get_instance
    
    instance1 = get_instance()
    instance2 = get_instance()
    
    assert instance1 is instance2, "应返回同一个实例"
    print("[PASS]test_get_instance 通过")


if __name__ == '__main__':
    print("=" * 50)
    print("积分窗口测试")
    print("=" * 50)
    
    test_add_record()
    test_negative_score()
    test_clear_records()
    test_record_sorting()
    test_window_dimensions()
    test_get_instance()
    
    print("=" * 50)
    print("所有测试通过！")
    print("=" * 50)
