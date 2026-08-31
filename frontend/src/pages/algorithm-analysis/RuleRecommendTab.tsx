import React from 'react';
import { Lightbulb, Sparkles, Zap, Target, CheckCircle } from 'lucide-react';
import type { RuleRecommendData } from '../../types';
import type { AlgorithmAnalysisDeps } from './types';

export function RuleRecommendTab({ deps }: { deps: AlgorithmAnalysisDeps }): React.ReactElement {
  const { ruleRecommendData, searchKeyword } = deps;

  if (!ruleRecommendData) {
    return (
      <div className='text-center py-12 text-gray-500 dark:text-slate-400'>
        <Lightbulb className='w-12 h-12 mx-auto mb-3 text-gray-400' />
        <p>暂无规则推荐数据</p>
        <p className='text-sm mt-1'>请确保已有足够的积分记录数据</p>
      </div>
    );
  }

  const { summary, recommendations } = ruleRecommendData;
  const safeSummary = summary ?? {
    total_recommendations: 0,
    avg_confidence: 0,
    estimated_total_impact: 0,
  };
  const safeRecommendations: NonNullable<RuleRecommendData['recommendations']> = Array.isArray(
    recommendations
  )
    ? recommendations
    : [];
  const filteredRecommendations = searchKeyword
    ? safeRecommendations.filter((r) =>
        String(r?.rule_name ?? '')
          .toLowerCase()
          .includes(searchKeyword.toLowerCase())
      )
    : safeRecommendations;

  return (
    <div className='space-y-6'>
      {/* 推荐统计 */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
          <div className='flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-2'>
            <Sparkles className='w-4 h-4 text-purple-500' />
            总推荐数
          </div>
          <div className='text-3xl font-bold text-purple-600'>{safeSummary.total_recommendations}</div>
          <div className='text-xs text-gray-400 mt-1'>智能推荐</div>
        </div>
        <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
          <div className='flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-2'>
            <Zap className='w-4 h-4 text-yellow-500' />
            平均置信度
          </div>
          <div className='text-3xl font-bold text-yellow-600'>
            {((safeSummary.avg_confidence || 0) * 100).toFixed(0)}%
          </div>
          <div className='text-xs text-gray-400 mt-1'>推荐可信度</div>
        </div>
        <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
          <div className='flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-2'>
            <Target className='w-4 h-4 text-blue-500' />
            预计影响
          </div>
          <div className='text-3xl font-bold text-blue-600'>{safeSummary.estimated_total_impact}</div>
          <div className='text-xs text-gray-400 mt-1'>积分变化</div>
        </div>
      </div>

      {/* 规则推荐列表 */}
      {filteredRecommendations.length > 0 ? (
        <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
          <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
            <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
              <Lightbulb className='w-5 h-5 text-green-500' />
              规则推荐列表
            </h3>
            <p className='text-sm text-gray-500 dark:text-slate-400 mt-1'>
              根据数据分析推荐的规则调整建议
            </p>
          </div>
          <div className='p-6'>
            <div className='space-y-4'>
              {filteredRecommendations.map((rule, idx) => {
                const ruleId = rule?.rule_id ?? `idx-${idx}`;
                const ruleName = rule?.rule_name ?? '未命名规则';
                const ruleCategory = rule?.category ?? '未分类';
                const ruleDesc = rule?.description ?? '';
                const ruleConfidence =
                  typeof rule?.confidence === 'number' && Number.isFinite(rule.confidence)
                    ? rule.confidence
                    : 0;
                const ruleImpact =
                  typeof rule?.estimated_impact === 'number' &&
                  Number.isFinite(rule.estimated_impact)
                    ? rule.estimated_impact
                    : 0;
                return (
                  <div
                    key={ruleId}
                    className='p-4 bg-green-50/50 dark:bg-green-500/5 rounded-lg border border-green-200/50 dark:border-green-500/20'
                  >
                    <div className='flex items-center justify-between mb-2'>
                      <div>
                        <div className='font-medium text-gray-800 dark:text-white'>{ruleName}</div>
                        <div className='text-sm text-gray-500 dark:text-slate-400'>
                          {ruleCategory}
                        </div>
                      </div>
                      <span className='px-2 py-1 rounded text-xs font-medium bg-green-100 dark:bg-green-500/20 text-green-600'>
                        置信度: {(ruleConfidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-3'>
                      <div>
                        <div className='text-gray-500 dark:text-slate-400'>预计影响</div>
                        <div
                          className={`font-medium ${
                            ruleImpact > 0
                              ? 'text-green-600'
                              : ruleImpact < 0
                              ? 'text-red-600'
                              : 'text-gray-600'
                          }`}
                        >
                          {ruleImpact > 0 ? '+' : ''}
                          {ruleImpact}分
                        </div>
                      </div>
                    </div>
                    <div className='text-sm text-gray-600 dark:text-slate-300'>{ruleDesc}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className='text-center py-12 text-gray-500 dark:text-slate-400'>
          <CheckCircle className='w-12 h-12 mx-auto mb-3 text-green-500' />
          <p>暂无规则推荐建议</p>
          <p className='text-sm mt-1'>当前规则体系运行良好</p>
        </div>
      )}
    </div>
  );
}
