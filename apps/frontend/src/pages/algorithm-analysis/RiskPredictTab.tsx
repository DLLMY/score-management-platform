import React from 'react';
import { ShieldCheck, AlertTriangle, Bell, CheckCircle, Download, BarChart3 } from 'lucide-react';
import type { AlgorithmAnalysisDeps } from './types';

export function RiskPredictTab({ deps }: { deps: AlgorithmAnalysisDeps }): React.ReactElement {
  const { riskPredictData, searchKeyword, handleExport, exporting } = deps;

  if (!riskPredictData) {
    return (
      <div className='text-center py-12 text-gray-500 dark:text-slate-400'>
        <ShieldCheck className='w-12 h-12 mx-auto mb-3 text-gray-400' />
        <p>暂无风险评估数据</p>
        <p className='text-sm mt-1'>请确保已有足够的积分记录数据</p>
      </div>
    );
  }

  // 后端字段名与前端类型不一致，已在 api.getBatchRiskPredict 中归一化；
  // 此处仍做一层兜底，防止后端形状再次变动时整页崩溃。
  const summary = riskPredictData.summary ?? {
    high_risk_count: 0,
    medium_risk_count: 0,
    low_risk_count: 0,
    avg_risk_score: 0,
  };
  const risks = Array.isArray(riskPredictData.risks) ? riskPredictData.risks : [];
  const filteredResults = searchKeyword
    ? risks.filter((r) => (r.name ?? '').toLowerCase().includes(searchKeyword.toLowerCase()))
    : risks;
  const totalStudents =
    summary.high_risk_count + summary.medium_risk_count + summary.low_risk_count;

  return (
    <div className='space-y-6'>
      {/* 导出 */}
      <div className='flex items-center justify-between'>
        <p className='text-sm text-gray-500 dark:text-slate-400'>
          基于多维度综合评估（积分趋势 / 行为 / 出勤）
        </p>
        <button
          onClick={() => handleExport('risk', 30)}
          disabled={exporting !== null}
          className='px-4 py-2 rounded-lg border border-red-400 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50 transition-colors flex items-center gap-1.5'
        >
          <Download className='w-4 h-4' />
          {exporting === 'risk' ? '导出中...' : '导出 Excel'}
        </button>
      </div>
      {/* 风险统计 */}
      <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
        <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
          <div className='flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-2'>
            <ShieldCheck className='w-4 h-4 text-blue-500' />
            评估学生数
          </div>
          <div className='text-3xl font-bold text-blue-600'>{totalStudents}</div>
          <div className='text-xs text-gray-400 mt-1'>参与风险评估</div>
        </div>
        <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
          <div className='flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-2'>
            <AlertTriangle className='w-4 h-4 text-red-500' />
            高风险
          </div>
          <div className='text-3xl font-bold text-red-600'>{summary.high_risk_count}</div>
          <div className='text-xs text-gray-400 mt-1'>需要立即干预</div>
        </div>
        <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
          <div className='flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-2'>
            <Bell className='w-4 h-4 text-yellow-500' />
            中风险
          </div>
          <div className='text-3xl font-bold text-yellow-600'>{summary.medium_risk_count}</div>
          <div className='text-xs text-gray-400 mt-1'>需要关注</div>
        </div>
        <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
          <div className='flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-2'>
            <CheckCircle className='w-4 h-4 text-green-500' />
            低风险
          </div>
          <div className='text-3xl font-bold text-green-600'>{summary.low_risk_count}</div>
          <div className='text-xs text-gray-400 mt-1'>正常关注</div>
        </div>
      </div>

      {/* 风险学生列表 */}
      <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
        <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
          <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
            <AlertTriangle className='w-5 h-5 text-red-500' />
            风险学生评估结果
          </h3>
          <p className='text-sm text-gray-500 dark:text-slate-400 mt-1'>
            基于多维度综合评估，识别需要关注的学生
          </p>
        </div>
        <div className='p-6'>
          {filteredResults.length === 0 ? (
            <div className='text-center py-12 text-gray-500 dark:text-slate-400'>
              <CheckCircle className='w-12 h-12 mx-auto mb-3 text-green-500' />
              <p>{searchKeyword ? '未找到匹配的学生' : '暂无风险学生'}</p>
            </div>
          ) : (
            <div className='space-y-4'>
              {filteredResults.map((student, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border ${
                    student.risk_level === 'high'
                      ? 'bg-red-50/50 dark:bg-red-500/5 border-red-200/50 dark:border-red-500/20'
                      : student.risk_level === 'medium'
                      ? 'bg-yellow-50/50 dark:bg-yellow-500/5 border-yellow-200/50 dark:border-yellow-500/20'
                      : 'bg-green-50/50 dark:bg-green-500/5 border-green-200/50 dark:border-green-500/20'
                  }`}
                >
                  <div className='flex items-center justify-between mb-3'>
                    <div className='flex items-center gap-3'>
                      <div
                        className={`w-2 h-2 rounded-full ${
                          student.risk_level === 'high'
                            ? 'bg-red-500'
                            : student.risk_level === 'medium'
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        }`}
                      />
                      <div>
                        <div className='font-medium text-gray-800 dark:text-white'>
                          {student.name}
                        </div>
                        <div className='text-sm text-gray-500 dark:text-slate-400'>
                          风险评分:{' '}
                          {student.risk_score != null ? student.risk_score.toFixed(1) : '—'}
                        </div>
                      </div>
                    </div>
                    <div className='text-right'>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          student.risk_level === 'high'
                            ? 'bg-red-100 dark:bg-red-500/20 text-red-600'
                            : student.risk_level === 'medium'
                            ? 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600'
                            : 'bg-green-100 dark:bg-green-500/20 text-green-600'
                        }`}
                      >
                        {student.risk_level === 'high'
                          ? '高风险'
                          : student.risk_level === 'medium'
                          ? '中风险'
                          : '低风险'}
                      </span>
                    </div>
                  </div>

                  {/* 风险因素 */}
                  {(student.contributing_factors?.length ?? 0) > 0 && (
                    <div className='mb-3'>
                      <div className='text-xs font-medium text-gray-500 dark:text-slate-400 mb-2'>
                        风险因素
                      </div>
                      <div className='flex flex-wrap gap-2'>
                        {(student.contributing_factors ?? []).slice(0, 3).map((factor, fIdx) => (
                          <span
                            key={fIdx}
                            className='px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                          >
                            {factor}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 推荐行动 */}
                  {(student.recommended_actions?.length ?? 0) > 0 && (
                    <div className='pt-3 border-t border-gray-200/50 dark:border-gray-700/50'>
                      <div className='text-xs font-medium text-gray-500 dark:text-slate-400 mb-2'>
                        推荐行动
                      </div>
                      <div className='flex flex-wrap gap-2'>
                        {(student.recommended_actions ?? []).map((action, aIdx) => (
                          <span
                            key={aIdx}
                            className='px-2 py-1 rounded text-xs bg-blue-100 dark:bg-blue-500/20 text-blue-600'
                          >
                            {action}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 风险分布 */}
      <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
        <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
          <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
            <BarChart3 className='w-5 h-5 text-blue-500' />
            风险分布
          </h3>
        </div>
        <div className='p-6'>
          <div className='flex items-center justify-center gap-8'>
            {[
              {
                level: '高风险',
                count: summary.high_risk_count,
                color: 'bg-red-500',
                light: 'bg-red-100 dark:bg-red-500/20',
              },
              {
                level: '中风险',
                count: summary.medium_risk_count,
                color: 'bg-yellow-500',
                light: 'bg-yellow-100 dark:bg-yellow-500/20',
              },
              {
                level: '低风险',
                count: summary.low_risk_count,
                color: 'bg-green-500',
                light: 'bg-green-100 dark:bg-green-500/20',
              },
            ].map((item, idx) => {
              const percent = totalStudents > 0 ? (item.count / totalStudents) * 100 : 0;
              return (
                <div key={idx} className='text-center'>
                  <div
                    className={`w-20 h-20 rounded-full ${item.color} flex items-center justify-center mx-auto mb-2`}
                  >
                    <span className='text-white font-bold text-lg'>{item.count}</span>
                  </div>
                  <div
                    className={`px-3 py-1 rounded-full text-sm font-medium ${item.light} ${
                      item.level === '高风险'
                        ? 'text-red-600'
                        : item.level === '中风险'
                        ? 'text-yellow-600'
                        : 'text-green-600'
                    }`}
                  >
                    {item.level}
                  </div>
                  <div className='text-xs text-gray-400 mt-1'>{percent.toFixed(1)}%</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
