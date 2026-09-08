import React from 'react';
import { BarChart3, RefreshCw, Zap, Train, History } from 'lucide-react';
import { PermissionButton, DataTable } from '../../components';
import type { NLPDeps, MLAlgorithmResult } from './types';

export function TrainingTab({ deps }: { deps: NLPDeps }): React.ReactElement {
  const {
    handleEvaluateAllModels,
    isEvaluatingAll,
    handleTrainAllModels,
    isTraining,
    handleTrainModel,
    selectedAlgorithm,
    setSelectedAlgorithm,
    algorithms,
    useCrossValidation,
    setUseCrossValidation,
    modelEvaluation,
    trainingResult,
    trainAllResult,
    evaluationAllResult,
    trainingResultColumns,
    trainingHistory,
  } = deps;

  return (
    <div className='space-y-6'>
      <div className='bg-white rounded-xl shadow-sm p-6'>
        <div className='flex items-center justify-between mb-6'>
          <h2 className='text-lg font-semibold text-gray-800'>模型训练</h2>
          <div className='flex gap-3'>
            <PermissionButton
              permission='algorithm.manage'
              onClick={handleEvaluateAllModels}
              disabled={isEvaluatingAll}
              className='px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 disabled:opacity-50'
            >
              {isEvaluatingAll ? (
                <>
                  <RefreshCw className='w-4 h-4 animate-spin' />
                  评估中...
                </>
              ) : (
                <>
                  <BarChart3 className='w-4 h-4' />
                  评估所有算法
                </>
              )}
            </PermissionButton>
            <PermissionButton
              permission='algorithm.manage'
              onClick={handleTrainAllModels}
              disabled={isTraining}
              className='px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2 disabled:opacity-50'
            >
              {isTraining ? (
                <>
                  <RefreshCw className='w-4 h-4 animate-spin' />
                  训练中...
                </>
              ) : (
                <>
                  <Zap className='w-4 h-4' />
                  自动选择最佳算法
                </>
              )}
            </PermissionButton>
            <PermissionButton
              permission='algorithm.manage'
              onClick={handleTrainModel}
              disabled={isTraining}
              className='px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-2 disabled:opacity-50'
            >
              {isTraining ? (
                <>
                  <RefreshCw className='w-4 h-4 animate-spin' />
                  训练中...
                </>
              ) : (
                <>
                  <Train className='w-4 h-4' />
                  开始训练
                </>
              )}
            </PermissionButton>
          </div>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mb-6'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>选择算法</label>
            <select
              value={selectedAlgorithm}
              onChange={(e) => setSelectedAlgorithm(e.target.value)}
              className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent'
            >
              <option value=''>自动选择</option>
              {algorithms.map((algo) => (
                <option key={algo.value} value={algo.value}>
                  {algo.label}
                </option>
              ))}
            </select>
          </div>
          <div className='flex items-end'>
            <label className='flex items-center gap-2 cursor-pointer'>
              <input
                type='checkbox'
                checked={useCrossValidation}
                onChange={(e) => setUseCrossValidation(e.target.checked)}
                className='w-4 h-4 text-purple-600 rounded'
              />
              <span className='text-sm text-gray-700'>使用交叉验证</span>
            </label>
          </div>
        </div>

        {modelEvaluation && (
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-6'>
            <div className='p-4 bg-blue-50 rounded-lg'>
              <p className='text-sm text-blue-600 mb-1'>准确率</p>
              <p className='text-2xl font-bold text-blue-700'>
                {modelEvaluation.accuracy_rate != null
                  ? `${(modelEvaluation.accuracy_rate * 100).toFixed(1)}%`
                  : '--'}
              </p>
            </div>
            <div className='p-4 bg-green-50 rounded-lg'>
              <p className='text-sm text-green-600 mb-1'>精确率</p>
              <p className='text-2xl font-bold text-green-700'>
                {modelEvaluation.precision != null
                  ? `${(modelEvaluation.precision * 100).toFixed(1)}%`
                  : '--'}
              </p>
            </div>
            <div className='p-4 bg-yellow-50 rounded-lg'>
              <p className='text-sm text-yellow-600 mb-1'>召回率</p>
              <p className='text-2xl font-bold text-yellow-700'>
                {modelEvaluation.recall != null
                  ? `${(modelEvaluation.recall * 100).toFixed(1)}%`
                  : '--'}
              </p>
            </div>
            <div className='p-4 bg-purple-50 rounded-lg'>
              <p className='text-sm text-purple-600 mb-1'>F1分数</p>
              <p className='text-2xl font-bold text-purple-700'>
                {modelEvaluation.f1_score != null
                  ? `${(modelEvaluation.f1_score * 100).toFixed(1)}%`
                  : '--'}
              </p>
            </div>
          </div>
        )}

        {trainingResult && (
          <div className='mb-6 p-4 bg-green-50 rounded-lg'>
            <h3 className='text-sm font-medium text-green-700 mb-2'>训练结果</h3>
            <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
              <div>
                <p className='text-sm text-gray-600'>算法</p>
                <p className='font-medium text-gray-800'>{trainingResult.algorithm_name}</p>
              </div>
              <div>
                <p className='text-sm text-gray-600'>训练数据量</p>
                <p className='font-medium text-gray-800'>{trainingResult.training_data_count}</p>
              </div>
              <div>
                <p className='text-sm text-gray-600'>准确率</p>
                <p className='font-medium text-blue-600'>
                  {(trainingResult.evaluation.accuracy * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className='text-sm text-gray-600'>F1分数</p>
                <p className='font-medium text-purple-600'>
                  {(trainingResult.evaluation.f1_score * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        )}

        {(trainAllResult || evaluationAllResult) && (
          <div className='mb-6'>
            <h3 className='text-sm font-medium text-gray-700 mb-3'>算法对比</h3>
            <DataTable<MLAlgorithmResult>
              columns={trainingResultColumns}
              dataSource={trainAllResult?.results || evaluationAllResult?.results || []}
              rowKey='algorithm'
              rowClassName={(result) =>
                trainAllResult?.best_algorithm === result.algorithm ? 'bg-green-50' : ''
              }
              empty={{ icon: 'data', title: '暂无对比数据', description: '训练或评估后即可查看算法对比' }}
            />
          </div>
        )}

        <h3 className='text-sm font-medium text-gray-600 mb-3 flex items-center gap-2'>
          <History className='w-4 h-4' />
          训练历史
        </h3>
        <div className='space-y-3'>
          {trainingHistory.map((record) => (
            <div key={record.id} className='p-4 bg-gray-50 rounded-lg'>
              <div className='flex items-center justify-between mb-2'>
                <span className='font-medium text-gray-800'>{record.training_version}</span>
                <div className='flex items-center gap-2'>
                  {record.algorithm_type && (
                    <span className='px-2 py-1 bg-blue-100 text-blue-600 text-xs rounded'>
                      {record.algorithm_type.startsWith('auto_')
                        ? record.algorithm_type.replace('auto_', '')
                        : record.algorithm_type}
                    </span>
                  )}
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      record.training_status === 'completed'
                        ? 'bg-green-100 text-green-600'
                        : record.training_status === 'failed'
                          ? 'bg-red-100 text-red-600'
                          : record.training_status
                            ? 'bg-yellow-100 text-yellow-600'
                            : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {record.training_status === 'completed'
                      ? '已完成'
                      : record.training_status === 'failed'
                        ? '失败'
                        : record.training_status
                          ? '进行中'
                          : '未知'}
                  </span>
                </div>
              </div>
              <div className='flex gap-4 text-sm text-gray-600'>
                <span>数据量: {record.training_data_size ?? '--'}</span>
                <span>
                  准确率:{' '}
                  {record.accuracy != null ? `${(record.accuracy * 100).toFixed(1)}%` : 'N/A'}
                </span>
                <span>
                  F1:{' '}
                  {record.f1_score != null ? (record.f1_score * 100).toFixed(1) + '%' : 'N/A'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
