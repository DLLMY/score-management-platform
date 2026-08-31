import React from 'react';
import {
  Brain,
  Lightbulb,
  Zap,
  Loader2,
  TrendingUp,
  BookOpen,
  ShieldCheck,
  CheckCircle,
} from 'lucide-react';
import { PermissionButton } from '../../components';
import type { AlgorithmAnalysisDeps } from './types';

export function ModelManagerTab({ deps }: { deps: AlgorithmAnalysisDeps }): React.ReactElement {
  const {
    modelTrainingData,
    modelEvaluationData,
    trainingModel,
    evaluatingModel,
    trainRuleModel,
    evaluateRuleModel,
    trainScoreModel,
    evaluateScoreModel,
    trainRiskModel,
    evaluateRiskModel,
  } = deps;

  return (
    <div className='space-y-6'>
      {/* 模型管理说明 */}
      <div className='bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-500/10 dark:to-purple-500/10 rounded-xl p-6 border border-blue-200/50 dark:border-blue-500/20'>
        <div className='flex items-start gap-4'>
          <Brain className='w-6 h-6 text-blue-500 mt-1' />
          <div>
            <h3 className='text-lg font-semibold text-gray-800 dark:text-white mb-2'>
              模型管理中心
            </h3>
            <p className='text-sm text-gray-600 dark:text-slate-300'>
              在这里可以训练和评估智能分析系统的机器学习模型。建议在以下情况重新训练模型：
            </p>
            <ul className='mt-2 text-sm text-gray-600 dark:text-slate-300 space-y-1'>
              <li>• 系统首次部署后</li>
              <li>• 数据分布发生显著变化时（如学期初、学期末）</li>
              <li>• 模型预测效果下降时</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 规则推荐模型 */}
      <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
        <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
          <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
            <Lightbulb className='w-5 h-5 text-purple-500' />
            规则推荐模型
          </h3>
        </div>
        <div className='p-6 space-y-4'>
          <div className='flex flex-col sm:flex-row sm:items-end gap-4'>
            <div className='flex-1'>
              <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>
                训练数据天数
              </label>
              <select
                className='w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500'
                defaultValue='90'
              >
                <option value='30'>30天</option>
                <option value='60'>60天</option>
                <option value='90'>90天</option>
                <option value='180'>180天</option>
              </select>
            </div>
            <div className='flex flex-wrap gap-2'>
              <PermissionButton
                permission='algorithm.manage'
                onClick={() => trainRuleModel(90)}
                disabled={trainingModel === 'ruleRecommend'}
                className='px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-purple-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2'
              >
                {trainingModel === 'ruleRecommend' ? (
                  <>
                    <Loader2 className='w-4 h-4 animate-spin' />
                    训练中...
                  </>
                ) : (
                  <>
                    <Zap className='w-4 h-4' />
                    训练模型
                  </>
                )}
              </PermissionButton>
              <PermissionButton
                permission='algorithm.manage'
                onClick={() => evaluateRuleModel(30)}
                disabled={evaluatingModel === 'ruleRecommend'}
                className='px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2'
              >
                {evaluatingModel === 'ruleRecommend' ? (
                  <>
                    <Loader2 className='w-4 h-4 animate-spin' />
                    评估中...
                  </>
                ) : (
                  <>
                    <TrendingUp className='w-4 h-4' />
                    评估模型
                  </>
                )}
              </PermissionButton>
            </div>
          </div>

          {/* 训练结果 */}
          {modelTrainingData.ruleRecommend && (
            <div className='bg-purple-50/50 dark:bg-purple-500/10 rounded-lg p-4 border border-purple-200/50 dark:border-purple-500/20'>
              <div className='flex items-center gap-2 mb-2'>
                <CheckCircle className='w-5 h-5 text-green-500' />
                <span className='font-medium text-gray-800 dark:text-white'>训练完成</span>
              </div>
              <pre className='text-sm text-gray-600 dark:text-slate-300 overflow-auto'>
                {JSON.stringify(modelTrainingData.ruleRecommend, null, 2)}
              </pre>
            </div>
          )}

          {/* 评估结果 */}
          {modelEvaluationData.ruleRecommend && (
            <div className='bg-blue-50/50 dark:bg-blue-500/10 rounded-lg p-4 border border-blue-200/50 dark:border-blue-500/20'>
              <div className='flex items-center gap-2 mb-2'>
                <TrendingUp className='w-5 h-5 text-blue-500' />
                <span className='font-medium text-gray-800 dark:text-white'>评估结果</span>
              </div>
              <pre className='text-sm text-gray-600 dark:text-slate-300 overflow-auto'>
                {JSON.stringify(modelEvaluationData.ruleRecommend, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* 成绩预测模型 */}
      <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
        <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
          <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
            <BookOpen className='w-5 h-5 text-blue-500' />
            成绩预测模型
          </h3>
        </div>
        <div className='p-6 space-y-4'>
          <div className='flex flex-col sm:flex-row sm:items-end gap-4'>
            <div className='flex-1'>
              <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>
                训练数据天数
              </label>
              <select
                className='w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
                defaultValue='90'
              >
                <option value='30'>30天</option>
                <option value='60'>60天</option>
                <option value='90'>90天</option>
                <option value='180'>180天</option>
              </select>
            </div>
            <div className='flex flex-wrap gap-2'>
              <PermissionButton
                permission='algorithm.manage'
                onClick={() => trainScoreModel(90)}
                disabled={trainingModel === 'scorePredict'}
                className='px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2'
              >
                {trainingModel === 'scorePredict' ? (
                  <>
                    <Loader2 className='w-4 h-4 animate-spin' />
                    训练中...
                  </>
                ) : (
                  <>
                    <Zap className='w-4 h-4' />
                    训练模型
                  </>
                )}
              </PermissionButton>
              <PermissionButton
                permission='algorithm.manage'
                onClick={() => evaluateScoreModel(30)}
                disabled={evaluatingModel === 'scorePredict'}
                className='px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-green-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2'
              >
                {evaluatingModel === 'scorePredict' ? (
                  <>
                    <Loader2 className='w-4 h-4 animate-spin' />
                    评估中...
                  </>
                ) : (
                  <>
                    <TrendingUp className='w-4 h-4' />
                    评估模型
                  </>
                )}
              </PermissionButton>
            </div>
          </div>

          {/* 训练结果 */}
          {modelTrainingData.scorePredict && (
            <div className='bg-blue-50/50 dark:bg-blue-500/10 rounded-lg p-4 border border-blue-200/50 dark:border-blue-500/20'>
              <div className='flex items-center gap-2 mb-2'>
                <CheckCircle className='w-5 h-5 text-green-500' />
                <span className='font-medium text-gray-800 dark:text-white'>训练完成</span>
              </div>
              <pre className='text-sm text-gray-600 dark:text-slate-300 overflow-auto'>
                {JSON.stringify(modelTrainingData.scorePredict, null, 2)}
              </pre>
            </div>
          )}

          {/* 评估结果 */}
          {modelEvaluationData.scorePredict && (
            <div className='bg-green-50/50 dark:bg-green-500/10 rounded-lg p-4 border border-green-200/50 dark:border-green-500/20'>
              <div className='flex items-center gap-2 mb-2'>
                <TrendingUp className='w-5 h-5 text-green-500' />
                <span className='font-medium text-gray-800 dark:text-white'>评估结果</span>
              </div>
              <pre className='text-sm text-gray-600 dark:text-slate-300 overflow-auto'>
                {JSON.stringify(modelEvaluationData.scorePredict, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* 风险预测模型 */}
      <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
        <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
          <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
            <ShieldCheck className='w-5 h-5 text-red-500' />
            风险预测模型
          </h3>
        </div>
        <div className='p-6 space-y-4'>
          <div className='flex items-center gap-4'>
            <div className='flex-1'>
              <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>
                训练数据天数
              </label>
              <select
                className='w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500'
                defaultValue='90'
              >
                <option value='30'>30天</option>
                <option value='60'>60天</option>
                <option value='90'>90天</option>
                <option value='180'>180天</option>
              </select>
            </div>
            <div className='flex gap-2'>
              <PermissionButton
                permission='algorithm.manage'
                onClick={() => trainRiskModel(90)}
                disabled={trainingModel === 'riskPredict'}
                className='px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-red-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2'
              >
                {trainingModel === 'riskPredict' ? (
                  <>
                    <Loader2 className='w-4 h-4 animate-spin' />
                    训练中...
                  </>
                ) : (
                  <>
                    <Zap className='w-4 h-4' />
                    训练模型
                  </>
                )}
              </PermissionButton>
              <PermissionButton
                permission='algorithm.manage'
                onClick={() => evaluateRiskModel(30)}
                disabled={evaluatingModel === 'riskPredict'}
                className='px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-orange-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2'
              >
                {evaluatingModel === 'riskPredict' ? (
                  <>
                    <Loader2 className='w-4 h-4 animate-spin' />
                    评估中...
                  </>
                ) : (
                  <>
                    <TrendingUp className='w-4 h-4' />
                    评估模型
                  </>
                )}
              </PermissionButton>
            </div>
          </div>

          {/* 训练结果 */}
          {modelTrainingData.riskPredict && (
            <div className='bg-red-50/50 dark:bg-red-500/10 rounded-lg p-4 border border-red-200/50 dark:border-red-500/20'>
              <div className='flex items-center gap-2 mb-2'>
                <CheckCircle className='w-5 h-5 text-green-500' />
                <span className='font-medium text-gray-800 dark:text-white'>训练完成</span>
              </div>
              <pre className='text-sm text-gray-600 dark:text-slate-300 overflow-auto'>
                {JSON.stringify(modelTrainingData.riskPredict, null, 2)}
              </pre>
            </div>
          )}

          {/* 评估结果 */}
          {modelEvaluationData.riskPredict && (
            <div className='bg-orange-50/50 dark:bg-orange-500/10 rounded-lg p-4 border border-orange-200/50 dark:border-orange-500/20'>
              <div className='flex items-center gap-2 mb-2'>
                <TrendingUp className='w-5 h-5 text-orange-500' />
                <span className='font-medium text-gray-800 dark:text-white'>评估结果</span>
              </div>
              <pre className='text-sm text-gray-600 dark:text-slate-300 overflow-auto'>
                {JSON.stringify(modelEvaluationData.riskPredict, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
