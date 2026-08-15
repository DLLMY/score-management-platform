import logger from './logger';
interface BenchmarkResult {
  name: string;
  iterations: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  p95Time: number;
  p99Time: number;
  stdDev: number;
  successRate: number;
  failures: number;
}

interface BenchmarkReport {
  timestamp: string;
  duration: number;
  results: BenchmarkResult[];
  summary: {
    overallAvgTime: number;
    overallP95Time: number;
    overallSuccessRate: number;
    fastestTest: string;
    slowestTest: string;
  };
}

class PerformanceBenchmark {
  private results: BenchmarkResult[] = [];
  private startTime: number = 0;

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(Math.floor(sorted.length * percentile / 100), sorted.length - 1);
    return sorted[index];
  }

  private calculateStdDev(values: number[], mean: number): number {
    if (values.length < 2) return 0;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (values.length - 1);
    return Math.sqrt(variance);
  }

  async runAsyncBenchmark(
    name: string,
    fn: () => Promise<unknown>,
    iterations: number = 50
  ): Promise<BenchmarkResult> {
    const times: number[] = [];
    let failures = 0;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      try {
        await fn();
        times.push(performance.now() - start);
      } catch {
        failures++;
        times.push(performance.now() - start);
      }
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const p95Time = this.calculatePercentile(times, 95);
    const p99Time = this.calculatePercentile(times, 99);
    const stdDev = this.calculateStdDev(times, avgTime);
    const successRate = ((iterations - failures) / iterations) * 100;

    const result: BenchmarkResult = {
      name,
      iterations,
      avgTime: Math.round(avgTime * 100) / 100,
      minTime: Math.round(minTime * 100) / 100,
      maxTime: Math.round(maxTime * 100) / 100,
      p95Time: Math.round(p95Time * 100) / 100,
      p99Time: Math.round(p99Time * 100) / 100,
      stdDev: Math.round(stdDev * 100) / 100,
      successRate: Math.round(successRate * 100) / 100,
      failures,
    };

    this.results.push(result);
    return result;
  }

  runSyncBenchmark(
    name: string,
    fn: () => unknown,
    iterations: number = 1000
  ): BenchmarkResult {
    const times: number[] = [];
    let failures = 0;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      try {
        fn();
        times.push(performance.now() - start);
      } catch {
        failures++;
        times.push(performance.now() - start);
      }
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const p95Time = this.calculatePercentile(times, 95);
    const p99Time = this.calculatePercentile(times, 99);
    const stdDev = this.calculateStdDev(times, avgTime);
    const successRate = ((iterations - failures) / iterations) * 100;

    const result: BenchmarkResult = {
      name,
      iterations,
      avgTime: Math.round(avgTime * 100) / 100,
      minTime: Math.round(minTime * 100) / 100,
      maxTime: Math.round(maxTime * 100) / 100,
      p95Time: Math.round(p95Time * 100) / 100,
      p99Time: Math.round(p99Time * 100) / 100,
      stdDev: Math.round(stdDev * 100) / 100,
      successRate: Math.round(successRate * 100) / 100,
      failures,
    };

    this.results.push(result);
    return result;
  }

  generateReport(): BenchmarkReport {
    const endTime = performance.now();
    const duration = Math.round((endTime - this.startTime) * 100) / 100;

    const avgTimes = this.results.map(r => r.avgTime);
    const p95Times = this.results.map(r => r.p95Time);
    const successRates = this.results.map(r => r.successRate);

    const summary = {
      overallAvgTime: Math.round(avgTimes.reduce((a, b) => a + b, 0) / avgTimes.length * 100) / 100,
      overallP95Time: Math.round(p95Times.reduce((a, b) => a + b, 0) / p95Times.length * 100) / 100,
      overallSuccessRate: Math.round(successRates.reduce((a, b) => a + b, 0) / successRates.length * 100) / 100,
      fastestTest: this.results.length > 0 ? this.results.reduce((a, b) => a.avgTime < b.avgTime ? a : b).name : '',
      slowestTest: this.results.length > 0 ? this.results.reduce((a, b) => a.avgTime > b.avgTime ? a : b).name : '',
    };

    return {
      timestamp: new Date().toISOString(),
      duration,
      results: this.results,
      summary,
    };
  }

  formatReport(report: BenchmarkReport): string {
    const lines: string[] = [];
    lines.push('='.repeat(70));
    lines.push('📈 前端性能基准测试报告');
    lines.push('='.repeat(70));
    lines.push(`\n📅 测试时间: ${report.timestamp}`);
    lines.push(`⏱️  测试时长: ${report.duration}ms`);
    lines.push(`📊 测试用例: ${report.results.length}个`);

    lines.push('\n' + '='.repeat(70));
    lines.push('📋 详细结果');
    lines.push('='.repeat(70));

    report.results.forEach(result => {
      lines.push(`\n📍 ${result.name}`);
      lines.push(`   ├─ 迭代次数: ${result.iterations}`);
      lines.push(`   ├─ 成功率: ${result.successRate}%`);
      lines.push(`   ├─ 平均耗时: ${result.avgTime}ms`);
      lines.push(`   ├─ P95耗时: ${result.p95Time}ms`);
      lines.push(`   ├─ P99耗时: ${result.p99Time}ms`);
      lines.push(`   ├─ 标准差: ${result.stdDev}ms`);
      lines.push(`   └─ 失败次数: ${result.failures}`);
    });

    lines.push('\n' + '='.repeat(70));
    lines.push('🎯 综合分析');
    lines.push('='.repeat(70));
    lines.push(`\n📊 整体平均耗时: ${report.summary.overallAvgTime}ms`);
    lines.push(`📊 整体P95耗时: ${report.summary.overallP95Time}ms`);
    lines.push(`📊 整体成功率: ${report.summary.overallSuccessRate}%`);
    
    if (report.summary.fastestTest) {
      lines.push(`\n⚡ 最快测试: ${report.summary.fastestTest}`);
      lines.push(`🐌 最慢测试: ${report.summary.slowestTest}`);
    }

    lines.push('\n' + '='.repeat(70));
    lines.push('✅ 测试完成');
    lines.push('='.repeat(70));

    return lines.join('\n');
  }

  async runFullBenchmark(): Promise<BenchmarkReport> {
    this.startTime = performance.now();
    this.results = [];

    logger.log('='.repeat(70));
    logger.log('🎯 开始前端性能基准测试');
    logger.log('='.repeat(70));

    await this.runSyncBenchmark('JSON序列化/反序列化', () => {
      const data = { a: 1, b: 'test', c: [1, 2, 3], d: { e: true } };
      return JSON.parse(JSON.stringify(data));
    }, 10000);

    await this.runSyncBenchmark('数组过滤操作', () => {
      const arr = Array.from({ length: 1000 }, (_, i) => ({ id: i, value: Math.random() }));
      return arr.filter(item => item.value > 0.5);
    }, 1000);

    await this.runSyncBenchmark('数组排序操作', () => {
      const arr = Array.from({ length: 1000 }, () => Math.random());
      return arr.sort((a, b) => a - b);
    }, 500);

    await this.runSyncBenchmark('字符串处理', () => {
      const str = 'test string repeat '.repeat(100);
      return str.split(' ').map(s => s.toUpperCase()).join('-');
    }, 1000);

    logger.log('\n' + '='.repeat(70));
    logger.log('✅ 前端性能基准测试完成');
    logger.log('='.repeat(70));

    const report = this.generateReport();
    logger.log(this.formatReport(report));
    return report;
  }

  clear(): void {
    this.results = [];
    this.startTime = 0;
  }
}

export const performanceBenchmark = new PerformanceBenchmark();
export type { BenchmarkResult, BenchmarkReport };