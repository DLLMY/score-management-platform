import React from 'react';
import type { NLPDeps } from './types';

export function StatisticsTab({ deps }: { deps: NLPDeps }): React.ReactElement {
  const { statistics, modelEvaluation } = deps;

  return (
    <div className='space-y-6'>
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
        {statistics && (
          <>
            <div className='bg-white rounded-xl shadow-sm p-6'>
              <p className='text-sm text-gray-500 mb-1'>规则总数</p>
              <p className='text-2xl font-bold text-gray-800'>{statistics.total_rules}</p>
            </div>
            <div className='bg-white rounded-xl shadow-sm p-6'>
              <p className='text-sm text-gray-500 mb-1'>加分规则</p>
              <p className='text-2xl font-bold text-green-600'>{statistics.add_rules}</p>
            </div>
            <div className='bg-white rounded-xl shadow-sm p-6'>
              <p className='text-sm text-gray-500 mb-1'>扣分规则</p>
              <p className='text-2xl font-bold text-red-600'>{statistics.deduct_rules}</p>
            </div>
            <div className='bg-white rounded-xl shadow-sm p-6'>
              <p className='text-sm text-gray-500 mb-1'>总使用次数</p>
              <p className='text-2xl font-bold text-blue-600'>{statistics.total_usage}</p>
            </div>
          </>
        )}
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
        <div className='bg-white rounded-xl shadow-sm p-6'>
          <h3 className='text-sm font-medium text-gray-600 mb-4'>高频规则</h3>
          <div className='space-y-3'>
            {statistics?.high_usage_rules.map((rule) => (
              <div
                key={rule.id}
                className='flex items-center justify-between p-3 bg-gray-50 rounded-lg'
              >
                <div>
                  <p className='font-medium text-gray-800'>{rule.behavior_description}</p>
                  <p className='text-sm text-gray-500'>关键词: {rule.behavior_keyword}</p>
                </div>
                <div className='text-right'>
                  <p className='text-sm text-gray-500'>使用次数</p>
                  <p className='text-xl font-bold text-blue-600'>{rule.usage_count}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className='bg-white rounded-xl shadow-sm p-6'>
          <h3 className='text-sm font-medium text-gray-600 mb-4'>模型性能指标</h3>
          {modelEvaluation && (
            <div className='space-y-4'>
              <div>
                <div className='flex justify-between text-sm mb-1'>
                  <span className='text-gray-600'>准确率</span>
                  <span className='font-medium'>
                    {(modelEvaluation.accuracy_rate * 100).toFixed(1)}%
                  </span>
                </div>
                <div className='w-full bg-gray-200 rounded-full h-2'>
                  <div
                    className='bg-blue-500 h-2 rounded-full'
                    style={{ width: `${modelEvaluation.accuracy_rate * 100}%` }}
                  />
                </div>
              </div>
              <div>
                <div className='flex justify-between text-sm mb-1'>
                  <span className='text-gray-600'>精确率</span>
                  <span className='font-medium'>
                    {(modelEvaluation.precision * 100).toFixed(1)}%
                  </span>
                </div>
                <div className='w-full bg-gray-200 rounded-full h-2'>
                  <div
                    className='bg-green-500 h-2 rounded-full'
                    style={{ width: `${modelEvaluation.precision * 100}%` }}
                  />
                </div>
              </div>
              <div>
                <div className='flex justify-between text-sm mb-1'>
                  <span className='text-gray-600'>召回率</span>
                  <span className='font-medium'>
                    {(modelEvaluation.recall * 100).toFixed(1)}%
                  </span>
                </div>
                <div className='w-full bg-gray-200 rounded-full h-2'>
                  <div
                    className='bg-yellow-500 h-2 rounded-full'
                    style={{ width: `${modelEvaluation.recall * 100}%` }}
                  />
                </div>
              </div>
              <div>
                <div className='flex justify-between text-sm mb-1'>
                  <span className='text-gray-600'>F1分数</span>
                  <span className='font-medium'>
                    {(modelEvaluation.f1_score * 100).toFixed(1)}%
                  </span>
                </div>
                <div className='w-full bg-gray-200 rounded-full h-2'>
                  <div
                    className='bg-purple-500 h-2 rounded-full'
                    style={{ width: `${modelEvaluation.f1_score * 100}%` }}
                  />
                </div>
              </div>
              <div className='pt-4 border-t border-gray-100'>
                <p className='text-sm text-gray-500'>
                  样本总数: {modelEvaluation.total_samples} | 正确:{' '}
                  {modelEvaluation.correct_count} | 错误: {modelEvaluation.incorrect_count}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
