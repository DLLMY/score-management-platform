import React from 'react';
import { BookOpen, BarChart3, LineChart, TrendingUp, Award } from 'lucide-react';
import { DataTable } from '../../components';
import type { ScorePredictResult } from '../../types';
import type { AlgorithmAnalysisDeps } from './types';
import { ANALYSIS_CONFIG } from './constants';

export function ScorePredictTab({ deps }: { deps: AlgorithmAnalysisDeps }): React.ReactElement {
  const { scorePredictData, searchKeyword, scorePredictColumns } = deps;

  if (!scorePredictData) {
    return (
      <div className='text-center py-12 text-gray-500 dark:text-slate-400'>
        <BookOpen className='w-12 h-12 mx-auto mb-3 text-gray-400' />
        <p>暂无成绩预测数据</p>
        <p className='text-sm mt-1'>请确保已有足够的积分记录和考试数据</p>
      </div>
    );
  }

  const { summary, predictions } = scorePredictData;
  const filteredPredictions = searchKeyword
    ? predictions.filter((p) => p.name.toLowerCase().includes(searchKeyword.toLowerCase()))
    : predictions;

  return (
    <div className='space-y-6'>
      {/* 预测统计 */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
          <div className='flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-2'>
            <BookOpen className='w-4 h-4 text-blue-500' />
            当前平均分
          </div>
          <div className='text-3xl font-bold text-blue-600'>
            {(summary.avg_current_score ?? null) != null
              ? summary.avg_current_score.toFixed(1)
              : '—'}
          </div>
          <div className='text-xs text-gray-400 mt-1'>现有成绩</div>
        </div>
        <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
          <div className='flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-2'>
            <TrendingUp className='w-4 h-4 text-green-500' />
            平均分预测
          </div>
          <div className='text-3xl font-bold text-green-600'>
            {(summary.avg_predicted_score ?? null) != null
              ? summary.avg_predicted_score.toFixed(1)
              : '—'}
          </div>
          <div className='text-xs text-gray-400 mt-1'>预计考试分数</div>
        </div>
        <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
          <div className='flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-2'>
            <Award className='w-4 h-4 text-purple-500' />
            涉及科目
          </div>
          <div className='text-3xl font-bold text-purple-600'>
            {summary.subjects && summary.subjects.length > 0 ? summary.subjects.length : '综合'}
          </div>
          <div className='text-xs text-gray-400 mt-1'>
            {summary.subjects && summary.subjects.length > 0
              ? summary.subjects.join(', ')
              : '综合评分'}
          </div>
        </div>
      </div>

      {/* 成绩分布 */}
      <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
        <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
          <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
            <BarChart3 className='w-5 h-5 text-blue-500' />
            成绩分布预测
          </h3>
        </div>
        <div className='p-6'>
          <div className='space-y-3'>
            {ANALYSIS_CONFIG.scoreBands.map((item, idx) => {
              const count = predictions.filter(
                (p) =>
                  (p.predicted_score ?? 0) >= item.min &&
                  (item.max === undefined || (p.predicted_score ?? 0) < item.max)
              ).length;
              const percent = predictions.length > 0 ? (count / predictions.length) * 100 : 0;
              return (
                <div key={idx}>
                  <div className='flex items-center justify-between text-sm mb-1'>
                    <span className='text-gray-600 dark:text-slate-300'>{item.label}</span>
                    <span className='text-gray-500 dark:text-slate-400'>
                      {count}人 ({percent.toFixed(1)}%)
                    </span>
                  </div>
                  <div className='w-full bg-gray-200 dark:bg-slate-600 rounded-full h-3'>
                    <div
                      className={`${item.color} h-3 rounded-full transition-all`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 预测详情 */}
      <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
        <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
          <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
            <LineChart className='w-5 h-5 text-blue-500' />
            学生成绩预测详情
          </h3>
        </div>
        <div className='p-6'>
          <DataTable<ScorePredictResult>
            columns={scorePredictColumns}
            dataSource={filteredPredictions.slice(0, 15)}
            rowKey={(_, idx) => idx}
            empty={{ title: '暂无成绩预测数据', description: '当前筛选条件下暂无成绩预测记录' }}
            scroll={{ x: 760 }}
          />
        </div>
      </div>
    </div>
  );
}
