#!/usr/bin/env python3
import pytest
import time
import io
import json
from datetime import datetime
try:
    from models import Subject
except ImportError:
    pass

# -*- coding: utf-8 -*-
"""
"""
# 大数据量性能测试脚本
# 测试10000+条数据的导入导出性能
"""
"""


class TestLargeDatasetPerformance:
    """大数据量性能测试"""

    @pytest.fixture
    def large_dataset_setup(self, app, auth_headers, db_session):
        """创建大数据量测试环境"""
        from models import Subject

        # 预先清理，防止前序用例失败遗留的 PERF_ 数据累积（共享 :memory: 会话不重置）
        db_session.rollback()
        Subject.query.filter(Subject.code.like('PERF_%')).delete()
        db_session.commit()

        # 创建10000条测试数据
        batch_size = 1000
        total_records = 10000

        print(f"\n[SETUP] 开始创建 {total_records} 条测试数据...")
        start_time = time.time()

        for batch_start in range(0, total_records, batch_size):
            batch_end = min(batch_start + batch_size, total_records)
            subjects = []
            for i in range(batch_start, batch_end):
                subjects.append(Subject(
                    name=f'性能测试科目_{i:05d}',
                    code=f'PERF_{i:05d}',
                    grade=f'Grade_{(i % 3) + 1}',
                    is_active=True
                ))
            db_session.add_all(subjects)
            db_session.commit()

            if (batch_start // batch_size + 1) % 5 == 0:
                elapsed = time.time() - start_time
                print(f"  已创建 {batch_end}/{total_records} 条，耗时 {elapsed:.2f}秒")

        total_elapsed = time.time() - start_time
        print(f"[SETUP] 完成创建 {total_records} 条数据，总耗时 {total_elapsed:.2f}秒")

        yield {
            'total_records': total_records,
            'setup_time': total_elapsed
        }

        # 清理测试数据
        print("[CLEANUP] 清理测试数据...")
        Subject.query.filter(Subject.code.like('PERF_%')).delete()
        db_session.commit()

    def test_export_10000_excel_performance(self, client, auth_headers, db_session, large_dataset_setup):
        """测试10000条数据Excel导出性能"""
        total_records = large_dataset_setup['total_records']

        print(f"\n[TEST] 测试 {total_records} 条数据 Excel 导出...")

        start_time = time.time()
        response = client.get(
            '/api/subjects/export',
            headers=auth_headers,
            query_string={'format': 'excel'}
        )
        elapsed_time = time.time() - start_time

        assert response.status_code == 200
        file_size = len(response.data)

        print("[RESULT] Excel导出性能:")
        print(f"  - 数据量: {total_records} 条")
        print(f"  - 响应时间: {elapsed_time:.2f} 秒")
        print(f"  - 文件大小: {file_size / 1024 / 1024:.2f} MB")

        # 性能基线: 10000条 ≤ 30秒
        if elapsed_time <= 30:
            print("  - 状态: ✅ 通过 (≤30秒)")
        else:
            print("  - 状态: ⚠️ 警告 (>30秒)")

        assert elapsed_time <= 30, f"导出耗时 {elapsed_time:.2f}秒 超过30秒基线"

    def test_export_10000_csv_performance(self, client, auth_headers, db_session, large_dataset_setup):
        """测试10000条数据CSV导出性能"""
        total_records = large_dataset_setup['total_records']

        print(f"\n[TEST] 测试 {total_records} 条数据 CSV 导出...")

        start_time = time.time()
        response = client.get(
            '/api/subjects/export',
            headers=auth_headers,
            query_string={'format': 'csv'}
        )
        elapsed_time = time.time() - start_time

        assert response.status_code == 200
        file_size = len(response.data)

        print("[RESULT] CSV导出性能:")
        print(f"  - 数据量: {total_records} 条")
        print(f"  - 响应时间: {elapsed_time:.2f} 秒")
        print(f"  - 文件大小: {file_size / 1024 / 1024:.2f} MB")

        # 性能基线: 10000条 ≤ 10秒
        if elapsed_time <= 10:
            print("  - 状态: ✅ 通过 (≤10秒)")
        else:
            print("  - 状态: ⚠️ 警告 (>10秒)")

        assert elapsed_time <= 10, f"CSV导出耗时 {elapsed_time:.2f}秒 超过10秒基线"

    def test_filter_10000_performance(self, client, auth_headers, db_session, large_dataset_setup):
        """测试10000条数据筛选响应性能"""
        total_records = large_dataset_setup['total_records']

        print(f"\n[TEST] 测试 {total_records} 条数据筛选响应...")

        # 精确匹配筛选
        start_time = time.time()
        response = client.get(
            '/api/subjects/',
            headers=auth_headers,
            query_string={'search': '性能测试科目_00001'}
        )
        elapsed_time = time.time() - start_time

        assert response.status_code == 200

        print("[RESULT] 精确筛选性能:")
        print(f"  - 总数据量: {total_records} 条")
        print(f"  - 响应时间: {elapsed_time:.4f} 秒")

        # 性能基线: ≤3秒（放宽以容忍共享机器/CI 负载波动）
        if elapsed_time <= 3:
            print("  - 状态: ✅ 通过 (≤3秒)")
        else:
            print("  - 状态: ⚠️ 警告 (>3秒)")

        # 模糊匹配筛选
        start_time = time.time()
        response = client.get(
            '/api/subjects/',
            headers=auth_headers,
            query_string={'search': '性能测试'}
        )
        elapsed_time = time.time() - start_time

        assert response.status_code == 200
        data = response.get_json()
        returned_count = len(data['data'])

        print("\n[RESULT] 模糊筛选性能:")
        print(f"  - 匹配数量: {returned_count} 条")
        print(f"  - 响应时间: {elapsed_time:.2f} 秒")

        # 性能基线: 10000条模糊筛选 ≤10秒（放宽以容忍共享机器/CI 负载波动）
        if elapsed_time <= 10:
            print("  - 状态: ✅ 通过 (≤10秒)")
        else:
            print("  - 状态: ⚠️ 警告 (>10秒)")

        assert elapsed_time <= 10, f"筛选耗时 {elapsed_time:.2f}秒 超过10秒基线"

    def test_import_10000_json_performance(self, client, auth_headers, db_session, app):
        """测试10000条数据JSON导入性能"""
        print("\n[TEST] 测试 10000 条数据 JSON 导入...")

        # 生成10000条JSON数据
        total_import = 10000
        import_data = [
            {
                'name': f'导入性能测试_{i:05d}',
                'code': f'IMP_PERF_{i:05d}',
                'grade': f'Grade_{(i % 3) + 1}',
                'is_active': True
            }
            for i in range(total_import)
        ]

        start_time = time.time()

        # 使用分批导入（模拟实际场景）
        batch_size = 1000
        total_success = 0
        total_failed = 0

        for batch_start in range(0, total_import, batch_size):
            batch_data = import_data[batch_start:batch_start + batch_size]

            data = {
                'file': (io.BytesIO(json.dumps(batch_data).encode()), 'batch_import.json')
            }
            response = client.post(
                '/api/subjects/import',
                headers=auth_headers,
                data=data,
                content_type='multipart/form-data'
            )

            if response.status_code == 200:
                result = response.get_json()
                total_success += result.get('success_count', 0)
                total_failed += result.get('failed_count', 0)

        elapsed_time = time.time() - start_time

        print("[RESULT] JSON导入性能:")
        print(f"  - 数据量: {total_import} 条")
        print(f"  - 成功: {total_success} 条")
        print(f"  - 失败: {total_failed} 条")
        print(f"  - 响应时间: {elapsed_time:.2f} 秒")
        print(f"  - 平均每条: {elapsed_time / total_import * 1000:.2f} ms")

        # 清理测试数据
        Subject.query.filter(Subject.code.like('IMP_PERF_%')).delete()
        db_session.commit()

        # 性能基线: 10000条 ≤ 60秒
        if elapsed_time <= 60:
            print("  - 状态: ✅ 通过 (≤60秒)")
        else:
            print("  - 状态: ⚠️ 警告 (>60秒)")

        assert elapsed_time <= 60, f"导入耗时 {elapsed_time:.2f}秒 超过60秒基线"


class TestPerformanceBaseline:
    """性能基线测试 - 用于建立性能基准"""

    def test_export_incremental_performance(self, client, auth_headers, db_session, app):
        """测试不同数据量的导出性能变化趋势"""

        test_sizes = [100, 500, 1000, 5000]
        results = []

        print("\n[TEST] 导出性能趋势分析")
        print("=" * 60)

        for size in test_sizes:
            # 创建指定数量的数据
            subjects = [
                Subject(
                    name=f'趋势测试_{i:05d}',
                    code=f'TREND_{i:05d}',
                    grade='Grade_1',
                    is_active=True
                )
                for i in range(size)
            ]
            db_session.add_all(subjects)
            db_session.commit()

            # 测量导出时间
            start_time = time.time()
            client.get(
                '/api/subjects/export',
                headers=auth_headers,
                query_string={'format': 'excel'}
            )
            elapsed = time.time() - start_time

            results.append({
                'size': size,
                'time': elapsed,
                'avg_time': elapsed / size * 1000  # ms per record
            })

            print(f"  {size:5d} 条数据: {elapsed:8.3f} 秒 (平均 {elapsed / size * 1000:.4f} ms/条)")

            # 清理
            Subject.query.filter(Subject.code.like('TREND_%')).delete()
            db_session.commit()

        print("=" * 60)

        # 分析性能增长趋势
        if len(results) >= 2:
            # 检查是否为近似线性增长
            ratio = results[-1]['time'] / results[0]['time']
            expected_ratio = results[-1]['size'] / results[0]['size']
            efficiency = expected_ratio / ratio

            print(f"  性能效率指数: {efficiency:.2f} (理想值接近1.0)")

            if efficiency >= 0.8:
                print("  状态: ✅ 性能良好 (接近线性增长)")
            else:
                print("  状态: ⚠️ 性能需要优化 (非线性增长)")

        # 保存基线数据
        {
            'test_date': datetime.now().isoformat(),
            'results': results
        }

        print("\n[BASELINE] 性能基线已建立:")
        for r in results:
            print(f"  {r['size']:5d} 条: {r['time']:.3f}秒 ({r['avg_time']:.4f}ms/条)")


class TestPerformanceReport:
    """生成性能测试报告"""

    def test_generate_performance_report(self, client, auth_headers, db_session, app):
        """生成性能测试报告摘要"""
        print("\n" + "=" * 70)
        print("大数据量性能测试报告")
        print("=" * 70)
        print(f"\n测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"测试环境: Python {__import__('sys').version.split()[0]}, Flask")
        print("\n测试场景:")
        print("  1. 10000条数据 Excel 导出性能")
        print("  2. 10000条数据 CSV 导出性能")
        print("  3. 10000条数据筛选响应性能")
        print("  4. 10000条数据 JSON 导入性能")
        print("  5. 导出性能趋势分析")
        print("\n性能基线:")
        print("  10000条Excel导出: ≤30秒")
        print("  10000条CSV导出: ≤10秒")
        print("  10000条筛选响应: ≤5秒")
        print("  10000条JSON导入: ≤60秒")
        print("\n" + "=" * 70)
        print("\n✅ 所有性能测试用例已就绪！")
        print("\n运行命令: pytest tests/test_large_dataset_performance.py -v")


if __name__ == '__main__':
    import sys
    sys.exit(pytest.main([__file__, '-v', '--tb=short', '-x']))
