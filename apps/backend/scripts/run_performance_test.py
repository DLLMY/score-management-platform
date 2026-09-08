from datetime import datetime
from typing import Dict, List, Any
from app import create_app
import os
import sys
import time
import json
import statistics

"""
性能基准测试脚本
测试关键API端点的响应时间、吞吐量和稳定性
"""
"""
"""
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


class PerformanceBenchmark:
    """性能基准测试"""

    def __init__(self):
        self.app = create_app()
        self.client = self.app.test_client()
        self.results: Dict[str, Dict[str, Any]] = {}
        self.start_time = None

    def run_benchmark(
        self,
        endpoint: str,
        method: str = "GET",
        iterations: int = 100,
        data: Dict = None,
        headers: Dict = None,
    ) -> Dict[str, Any]:
        """运行单个端点的基准测试"""
        results = []
        for i in range(iterations):
            start = time.perf_counter()
            try:
                if method == "GET":
                    response = self.client.get(endpoint, headers=headers)
                elif method == "POST":
                    response = self.client.post(endpoint, json=data, headers=headers)
                elif method == "PUT":
                    response = self.client.put(endpoint, json=data, headers=headers)
                elif method == "DELETE":
                    response = self.client.delete(endpoint, headers=headers)
                else:
                    raise ValueError(f"Unsupported method: {method}")
                elapsed = (time.perf_counter() - start) * 1000
                results.append(
                    {
                        "response_time": elapsed,
                        "status_code": response.status_code,
                        "success": response.status_code == 200,
                    }
                )
            except Exception as e:
                elapsed = (time.perf_counter() - start) * 1000
                results.append(
                    {"response_time": elapsed, "status_code": 0, "success": False, "error": str(e)}
                )
        return self._analyze_results(endpoint, method, iterations, results)

    def _analyze_results(
        self, endpoint: str, method: str, iterations: int, results: List[Dict]
    ) -> Dict[str, Any]:
        """分析测试结果"""
        response_times = [r["response_time"] for r in results]
        successes = [r for r in results if r["success"]]
        failures = [r for r in results if not r["success"]]
        if response_times:
            avg_time = statistics.mean(response_times)
            min_time = min(response_times)
            max_time = max(response_times)
            p95_time = self._calculate_percentile(response_times, 95)
            p99_time = self._calculate_percentile(response_times, 99)
            std_dev = statistics.stdev(response_times) if len(response_times) > 1 else 0
        else:
            avg_time = min_time = max_time = p95_time = p99_time = std_dev = 0
        throughput = iterations / (sum(response_times) / 1000) if sum(response_times) > 0 else 0
        return {
            "endpoint": endpoint,
            "method": method,
            "iterations": iterations,
            "success_rate": (len(successes) / iterations) * 100,
            "avg_response_time": round(avg_time, 2),
            "min_response_time": round(min_time, 2),
            "max_response_time": round(max_time, 2),
            "p95_response_time": round(p95_time, 2),
            "p99_response_time": round(p99_time, 2),
            "std_dev": round(std_dev, 2),
            "throughput": round(throughput, 2),
            "failures": len(failures),
            "total_time": round(sum(response_times), 2),
        }

    def _calculate_percentile(self, values: List[float], percentile: int) -> float:
        """计算百分位数"""
        if not values:
            return 0
        sorted_values = sorted(values)
        index = int(len(sorted_values) * percentile / 100)
        index = max(0, min(index, len(sorted_values) - 1))
        return sorted_values[index]

    def run_all_benchmarks(self) -> Dict[str, Dict[str, Any]]:
        """运行所有基准测试"""
        print("=" * 70)
        print("🎯 开始性能基准测试")
        print("=" * 70)
        self.start_time = datetime.now()
        endpoints = [
            {"endpoint": "/api/dashboard", "method": "GET", "iterations": 50},
            {"endpoint": "/api/users?page=1&page_size=20", "method": "GET", "iterations": 50},
            {"endpoint": "/api/classes", "method": "GET", "iterations": 50},
            {"endpoint": "/api/subjects", "method": "GET", "iterations": 50},
            {"endpoint": "/api/rules", "method": "GET", "iterations": 50},
            {"endpoint": "/api/score-categories", "method": "GET", "iterations": 30},
            {"endpoint": "/api/system/config", "method": "GET", "iterations": 30},
            {"endpoint": "/api/system/health", "method": "GET", "iterations": 100},
            {"endpoint": "/api/admins/csrf-token", "method": "GET", "iterations": 50},
        ]
        for endpoint_config in endpoints:
            print(f"\n📊 测试: {endpoint_config['method']} {endpoint_config['endpoint']}")
            result = self.run_benchmark(**endpoint_config)  # noqa: F841
            self.results[endpoint_config["endpoint"]] = result
            self._print_result(result)
        return self.results

    def _print_result(self, result: Dict[str, Any]):
        """打印测试结果"""
        print(f"   成功率: {result['success_rate']:.1f}%")
        print(f"   平均响应时间: {result['avg_response_time']:.2f}ms")
        print(f"   P95响应时间: {result['p95_response_time']:.2f}ms")
        print(f"   P99响应时间: {result['p99_response_time']:.2f}ms")
        print(f"   吞吐量: {result['throughput']:.2f} req/s")
        print(f"   失败次数: {result['failures']}")

    def generate_report(self, output_file: str = None) -> str:
        """生成性能报告"""
        end_time = datetime.now()
        duration = (end_time - self.start_time).total_seconds()
        report = {
            "test_info": {
                "start_time": self.start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "duration": round(duration, 2),
                "total_endpoints": len(self.results),
            },
            "results": self.results,
            "summary": self._generate_summary(),
        }
        report_str = self._format_report(report)
        if output_file:
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(report, f, ensure_ascii=False, indent=2)
            print(f"\n📄 报告已保存到: {output_file}")
        return report_str

    def _generate_summary(self) -> Dict[str, Any]:
        """生成摘要统计"""
        all_results = list(self.results.values())
        if not all_results:
            return {}
        avg_times = [r["avg_response_time"] for r in all_results]
        p95_times = [r["p95_response_time"] for r in all_results]
        throughputs = [r["throughput"] for r in all_results]
        success_rates = [r["success_rate"] for r in all_results]
        return {
            "overall_avg_response_time": round(statistics.mean(avg_times), 2),
            "overall_p95_response_time": round(statistics.mean(p95_times), 2),
            "overall_max_response_time": max(r["max_response_time"] for r in all_results),
            "overall_throughput": round(sum(throughputs), 2),
            "overall_success_rate": round(statistics.mean(success_rates), 2),
            "fastest_endpoint": min(all_results, key=lambda x: x["avg_response_time"])["endpoint"],
            "slowest_endpoint": max(all_results, key=lambda x: x["avg_response_time"])["endpoint"],
            "best_throughput": max(all_results, key=lambda x: x["throughput"])["endpoint"],
            "worst_throughput": min(all_results, key=lambda x: x["throughput"])["endpoint"],
        }

    def _format_report(self, report: Dict) -> str:
        """格式化报告输出"""
        lines = []
        lines.append("=" * 70)
        lines.append("📈 性能基准测试报告")
        lines.append("=" * 70)
        info = report["test_info"]
        lines.append(f"\n📅 测试时间: {info['start_time']}")
        lines.append(f"⏱️  测试时长: {info['duration']:.2f}秒")
        lines.append(f"📊 测试端点: {info['total_endpoints']}个")
        lines.append("\n" + "=" * 70)
        lines.append("📋 详细结果")
        lines.append("=" * 70)
        for endpoint, result in report["results"].items():
            lines.append(f"\n📍 {result['method']} {endpoint}")
            lines.append(f"   ├─ 成功率: {result['success_rate']:.1f}%")
            lines.append(f"   ├─ 平均响应: {result['avg_response_time']:.2f}ms")
            lines.append(f"   ├─ P95响应: {result['p95_response_time']:.2f}ms")
            lines.append(f"   ├─ P99响应: {result['p99_response_time']:.2f}ms")
            lines.append(f"   ├─ 吞吐量: {result['throughput']:.2f} req/s")
            lines.append(f"   └─ 失败次数: {result['failures']}")
        summary = report["summary"]
        lines.append("\n" + "=" * 70)
        lines.append("🎯 综合分析")
        lines.append("=" * 70)
        lines.append(f"\n📊 整体平均响应时间: {summary.get('overall_avg_response_time', 0):.2f}ms")
        lines.append(f"📊 整体P95响应时间: {summary.get('overall_p95_response_time', 0):.2f}ms")
        lines.append(f"📊 整体最大响应时间: {summary.get('overall_max_response_time', 0):.2f}ms")
        lines.append(f"📊 整体吞吐量: {summary.get('overall_throughput', 0):.2f} req/s")
        lines.append(f"📊 整体成功率: {summary.get('overall_success_rate', 0):.1f}%")
        if summary.get("fastest_endpoint"):
            lines.append(f"\n⚡ 最快端点: {summary['fastest_endpoint']}")
            lines.append(f"🐌 最慢端点: {summary['slowest_endpoint']}")
        lines.append("\n" + "=" * 70)
        lines.append("✅ 测试完成")
        lines.append("=" * 70)
        return "\n".join(lines)


if __name__ == "__main__":
    benchmark = PerformanceBenchmark()
    benchmark.run_all_benchmarks()
    report = benchmark.generate_report("performance_report.json")
    print(report)
