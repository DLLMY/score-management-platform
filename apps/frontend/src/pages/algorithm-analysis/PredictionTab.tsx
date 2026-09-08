import React from 'react';
import {
  TrendingUp,
  Minus,
  Target,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  LineChart,
} from 'lucide-react';
import { DataTable } from '../../components';
import type { PredictionResult } from '../../types';
import type { AlgorithmAnalysisDeps } from './types';

export function PredictionTab({ deps }: { deps: AlgorithmAnalysisDeps }): React.ReactElement {
  const {
    predictionData,
    riskStudents,
    predictionDays,
    filteredPredictions,
    filteredRiskStudents,
    predictionDetailColumns,
  } = deps;

  if (!predictionData) {
    return (
      <div className='text-center py-12 text-gray-500 dark:text-slate-400'>
        <TrendingUp className='w-12 h-12 mx-auto mb-3 text-gray-400' />
        <p>暂无积分预测数据</p>
        <p className='text-sm mt-1'>请确保已有足够的积分记录数据</p>
      </div>
    );
  }

  const { summary } = predictionData;
  const improvementCount = summary?.improvement_count ?? 0;
  const stableCount = summary?.stable_count ?? 0;
  const declineCount = summary?.decline_count ?? 0;

  return (
    <div className='space-y-6'>
      {/* 趋势统计 */}
      <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
        <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
          <div className='flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-2'>
            <TrendingUp className='w-4 h-4 text-green-500' />
            上升趋势
          </div>
          <div className='text-3xl font-bold text-green-600'>{improvementCount}</div>
          <div className='text-xs text-gray-400 mt-1'>预计积分增加</div>
        </div>
        <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
          <div className='flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-2'>
            <Minus className='w-4 h-4 text-gray-400' />
            稳定
          </div>
          <div className='text-3xl font-bold text-gray-600'>{stableCount}</div>
          <div className='text-xs text-gray-400 mt-1'>积分无明显变化</div>
        </div>
        <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
          <div className='flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-2'>
            <TrendingUp className='w-4 h-4 text-red-500' />
            下降趋势
          </div>
          <div className='text-3xl font-bold text-red-600'>{declineCount}</div>
          <div className='text-xs text-gray-400 mt-1'>预计积分减少</div>
        </div>
        <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
          <div className='flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-2'>
            <Target className='w-4 h-4 text-blue-500' />
            风险学生
          </div>
          <div className='text-3xl font-bold text-orange-600'>{(riskStudents || []).length}</div>
          <div className='text-xs text-gray-400 mt-1'>需要关注</div>
        </div>
      </div>

      {/* 风险学生列表 */}
      {riskStudents.length > 0 && (
        <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
          <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
            <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
              <AlertTriangle className='w-5 h-5 text-orange-500' />
              需要关注的学生
            </h3>
            <p className='text-sm text-gray-500 dark:text-slate-400 mt-1'>
              预测未来{predictionDays}天积分呈下降趋势的学生
            </p>
          </div>
          <div className='p-6'>
            <div className='space-y-3'>
              {filteredRiskStudents.map((student) => (
                <div
                  key={student.user_id}
                  className='flex items-center justify-between p-4 bg-orange-50/50 dark:bg-orange-500/5 rounded-lg border border-orange-200/50 dark:border-orange-500/20'
                >
                  <div className='flex items-center gap-3'>
                    <div
                      className={`w-2 h-2 rounded-full ${
                        student.risk_level === 'high' ? 'bg-red-500' : 'bg-yellow-500'
                      }`}
                    />
                    <div>
                      <div className='font-medium text-gray-800 dark:text-white'>{student.name}</div>
                      <div className='text-sm text-gray-500 dark:text-slate-400'>
                        {student.class_name}
                      </div>
                    </div>
                  </div>
                  <div className='text-right'>
                    <div
                      className={`flex items-center gap-1 font-medium ${
                        (student.predicted_change || 0) < 0 ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {(student.predicted_change || 0) < 0 ? (
                        <ArrowDown className='w-4 h-4' />
                      ) : (
                        <ArrowUp className='w-4 h-4' />
                      )}
                      {Math.abs(student.predicted_change || 0).toFixed(1)}分
                    </div>
                    <div className='text-xs text-gray-400'>
                      置信度: {((student.confidence || 0) * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 预测详情 */}
      <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
        <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
          <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
            <LineChart className='w-5 h-5 text-blue-500' />
            积分预测详情
          </h3>
        </div>
        <div className='p-6'>
          <DataTable<PredictionResult>
            columns={predictionDetailColumns}
            dataSource={filteredPredictions.slice(0, 10)}
            rowKey={(item) => `${item.user_id ?? item.name ?? ''}-${item.name ?? ''}`}
            empty={{ title: '暂无预测数据', description: '当前筛选条件下暂无积分预测记录' }}
            scroll={{ x: 700 }}
          />
        </div>
      </div>
    </div>
  );
}
