import React from 'react';
import { RefreshCw, Zap, AlertTriangle } from 'lucide-react';
import { DataTable } from '../../components';
import type { IntentBreakdownItem, NLPDeps } from './types';

export function AnalysisTab({ deps }: { deps: NLPDeps }): React.ReactElement {
  const {
    isLoadingAnalysis,
    fetchAnalysisData,
    runBenchmark,
    isBenchmarking,
    resetAnalysisMetrics,
    intentAnalysis,
    performanceAnalysis,
    updateOptimizationStrategy,
    selectedStrategy,
    optimizerConfig,
    benchmarkResults,
    optimizationSuggestions,
    performanceColumns,
  } = deps;

  return (
    <div className='space-y-6'>
      {isLoadingAnalysis ? (
        <div className='flex items-center justify-center py-12'>
          <RefreshCw className='w-8 h-8 text-blue-500 animate-spin' />
        </div>
      ) : (
        <>
          {/* 操作按钮 */}
          <div className='flex gap-3 flex-wrap'>
            <button
              onClick={fetchAnalysisData}
              className='flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600'
            >
              <RefreshCw className='w-4 h-4' />
              刷新数据
            </button>
            <button
              onClick={runBenchmark}
              disabled={isBenchmarking}
              className='flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50'
            >
              <Zap className='w-4 h-4' />
              {isBenchmarking ? '测试中...' : '运行基准测试'}
            </button>
            <button
              onClick={resetAnalysisMetrics}
              className='flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600'
            >
              <RefreshCw className='w-4 h-4' />
              重置指标
            </button>
          </div>

          {/* 性能概览 */}
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
            <div className='bg-white rounded-xl shadow-sm p-6'>
              <p className='text-sm text-gray-500 mb-1'>意图识别准确率</p>
              <p
                className={`text-2xl font-bold ${
                  intentAnalysis?.summary?.accuracy == null
                    ? 'text-gray-400'
                    : intentAnalysis.summary.accuracy >= 0.9
                      ? 'text-green-600'
                      : 'text-yellow-600'
                }`}
              >
                {intentAnalysis?.summary?.accuracy != null
                  ? `${(intentAnalysis.summary.accuracy * 100).toFixed(1)}%`
                  : '--'}
              </p>
            </div>
            <div className='bg-white rounded-xl shadow-sm p-6'>
              <p className='text-sm text-gray-500 mb-1'>缓存命中率</p>
              <p
                className={`text-2xl font-bold ${
                  performanceAnalysis?.summary?.cache_hit_rate == null
                    ? 'text-gray-400'
                    : performanceAnalysis.summary.cache_hit_rate >= 0.6
                      ? 'text-green-600'
                      : 'text-yellow-600'
                }`}
              >
                {performanceAnalysis?.summary?.cache_hit_rate != null
                  ? `${(performanceAnalysis.summary.cache_hit_rate * 100).toFixed(1)}%`
                  : '--'}
              </p>
            </div>
            <div className='bg-white rounded-xl shadow-sm p-6'>
              <p className='text-sm text-gray-500 mb-1'>总请求数</p>
              <p className='text-2xl font-bold text-blue-600'>
                {performanceAnalysis?.summary?.total_requests ?? '--'}
              </p>
            </div>
            <div className='bg-white rounded-xl shadow-sm p-6'>
              <p className='text-sm text-gray-500 mb-1'>平均响应时间</p>
              <p className='text-2xl font-bold text-purple-600'>
                {performanceAnalysis?.summary?.avg_processing_time != null
                  ? `${performanceAnalysis.summary.avg_processing_time.toFixed(2)}ms`
                  : '--'}
              </p>
            </div>
          </div>

          {/* 优化策略配置 */}
          <div className='bg-white rounded-xl shadow-sm p-6'>
            <h3 className='text-sm font-medium text-gray-600 mb-4'>优化策略</h3>
            <div className='flex gap-3 flex-wrap'>
              {[
                {
                  value: 'accuracy_first',
                  label: '准确性优先',
                  desc: '适合对准确性要求高的场景',
                },
                { value: 'balanced', label: '平衡模式', desc: '准确性和速度兼顾' },
                { value: 'speed_first', label: '速度优先', desc: '适合高并发场景' },
              ].map((strategy) => (
                <button
                  key={strategy.value}
                  onClick={() => updateOptimizationStrategy(strategy.value)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    selectedStrategy === strategy.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <p className='font-medium text-gray-800'>{strategy.label}</p>
                  <p className='text-sm text-gray-500'>{strategy.desc}</p>
                </button>
              ))}
            </div>
            {optimizerConfig && (
              <div className='mt-4 p-3 bg-gray-50 rounded-lg'>
                <p className='text-sm text-gray-600'>
                  当前配置: TF-IDF特征数={optimizerConfig.intent_classifier?.tfidf_max_features}
                  , N-gram范围=(1,{' '}
                  {optimizerConfig.intent_classifier?.tfidf_ngram_range?.[1] || 4}), 缓存TTL=
                  {optimizerConfig.performance?.cache_ttl}s
                </p>
              </div>
            )}
          </div>

          {/* 意图识别分析 */}
          <div className='bg-white rounded-xl shadow-sm p-6'>
            <h3 className='text-sm font-medium text-gray-600 mb-4'>意图识别分析</h3>
            <div className='space-y-4'>
              {intentAnalysis?.intent_breakdown &&
                Object.entries(intentAnalysis.intent_breakdown).map(
                  ([intent, stats]: [string, IntentBreakdownItem]) => (
                    <div key={intent} className='p-4 bg-gray-50 rounded-lg'>
                      <div className='flex items-center justify-between mb-2'>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            intent === 'add'
                              ? 'bg-green-100 text-green-600'
                              : intent === 'deduct'
                                ? 'bg-red-100 text-red-600'
                                : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {intent === 'add'
                            ? '加分'
                            : intent === 'deduct'
                              ? '扣分'
                              : intent === 'query'
                                ? '查询'
                                : intent === 'reset'
                                  ? '重置'
                                  : '未知'}
                        </span>
                        <span className='text-sm text-gray-500'>
                          准确率:{' '}
                          {stats.accuracy != null
                            ? `${(stats.accuracy * 100).toFixed(1)}%`
                            : '--'}{' '}
                          ({stats.correct ?? '--'}/{stats.total ?? '--'})
                        </span>
                      </div>
                      <div className='w-full bg-gray-200 rounded-full h-2'>
                        <div
                          className={`h-2 rounded-full ${
                            stats.accuracy == null
                              ? 'bg-gray-300'
                              : stats.accuracy >= 0.9
                                ? 'bg-green-500'
                                : stats.accuracy >= 0.7
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500'
                          }`}
                          style={{
                            width:
                              stats.accuracy != null
                                ? `${Math.min(stats.accuracy * 100, 100)}%`
                                : '0%',
                          }}
                        />
                      </div>
                    </div>
                  )
                )}
            </div>
          </div>

          {/* 组件性能分析 */}
          <div className='bg-white rounded-xl shadow-sm p-6'>
            <h3 className='text-sm font-medium text-gray-600 mb-4'>组件性能</h3>
            <DataTable
              columns={performanceColumns}
              dataSource={
                performanceAnalysis?.components
                  ? Object.entries(performanceAnalysis.components).map(
                      ([name, stats]) => ({ name, stats })
                    )
                  : []
              }
              rowKey='name'
              empty={{ icon: 'data', title: '暂无组件数据', description: '暂无组件性能统计数据' }}
            />
          </div>

          {/* 基准测试结果 */}
          {benchmarkResults && (
            <div className='bg-white rounded-xl shadow-sm p-6'>
              <h3 className='text-sm font-medium text-gray-600 mb-4'>基准测试结果</h3>
              <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                <div className='p-4 bg-blue-50 rounded-lg'>
                  <p className='text-sm text-blue-600 mb-1'>平均延迟</p>
                  <p className='text-xl font-bold text-blue-700'>
                    {benchmarkResults.avg_latency?.toFixed(2)}ms
                  </p>
                </div>
                <div className='p-4 bg-green-50 rounded-lg'>
                  <p className='text-sm text-green-600 mb-1'>P95延迟</p>
                  <p className='text-xl font-bold text-green-700'>
                    {benchmarkResults.p95_latency?.toFixed(2)}ms
                  </p>
                </div>
                <div className='p-4 bg-purple-50 rounded-lg'>
                  <p className='text-sm text-purple-600 mb-1'>平均准确率</p>
                  <p className='text-xl font-bold text-purple-700'>
                    {(benchmarkResults.avg_accuracy * 100).toFixed(1)}%
                  </p>
                </div>
                <div className='p-4 bg-yellow-50 rounded-lg'>
                  <p className='text-sm text-yellow-600 mb-1'>吞吐量</p>
                  <p className='text-xl font-bold text-yellow-700'>
                    {benchmarkResults.throughput?.toFixed(1)}/s
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 优化建议 */}
          {optimizationSuggestions.length > 0 && (
            <div className='bg-white rounded-xl shadow-sm p-6'>
              <h3 className='text-sm font-medium text-gray-600 mb-4'>优化建议</h3>
              <div className='space-y-3'>
                {optimizationSuggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border-l-4 ${
                      suggestion.priority === 'high'
                        ? 'bg-red-50 border-red-500'
                        : suggestion.priority === 'medium'
                          ? 'bg-yellow-50 border-yellow-500'
                          : 'bg-blue-50 border-blue-500'
                    }`}
                  >
                    <div className='flex items-start gap-3'>
                      <AlertTriangle
                        className={`w-5 h-5 mt-0.5 ${
                          suggestion.priority === 'high'
                            ? 'text-red-500'
                            : suggestion.priority === 'medium'
                              ? 'text-yellow-500'
                              : 'text-blue-500'
                        }`}
                      />
                      <div>
                        <p className='font-medium text-gray-800'>{suggestion.issue}</p>
                        <ul className='mt-2 space-y-1 text-sm text-gray-600'>
                          {suggestion.suggestions.map((s: string, i: number) => (
                            <li key={i} className='flex items-start gap-2'>
                              <span className='text-gray-400'>•</span>
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 慢请求记录 */}
          {performanceAnalysis?.slow_requests?.length > 0 && (
            <div className='bg-white rounded-xl shadow-sm p-6'>
              <h3 className='text-sm font-medium text-gray-600 mb-4'>最近慢请求</h3>
              <div className='space-y-2'>
                {performanceAnalysis.slow_requests
                  .slice(0, 5)
                  .map((req: { timestamp: string; processing_time: number }, index: number) => (
                    <div
                      key={index}
                      className='flex items-center justify-between p-3 bg-gray-50 rounded-lg'
                    >
                      <span className='text-sm text-gray-600'>{req.timestamp}</span>
                      <span className='text-sm font-medium text-red-600'>
                        {(req.processing_time * 1000).toFixed(2)}ms
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
