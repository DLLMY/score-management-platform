import React from 'react';
import {
  Zap,
  Target,
  RefreshCw,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  Award,
  Sparkles,
  Loader2,
  TrendingUp,
  TrendingDown,
  Activity,
} from 'lucide-react';
import { PermissionButton } from '../../components';
import type { AlgorithmAnalysisDeps } from './types';
import { ANALYSIS_CONFIG } from './constants';

export function RuleApplicationTab({ deps }: { deps: AlgorithmAnalysisDeps }): React.ReactElement {
  const {
    ruleApplicationData,
    selectedUserId,
    selectedBehaviorType,
    handleAdjustDistribution,
    handleApplyRule,
    setSelectedUserId,
    setSelectedBehaviorType,
  } = deps;

  const stats = ruleApplicationData.scoreDistributionStats as {
    success?: boolean;
    total_students?: number;
    distribution?: { excellent: number; good: number; medium: number; low: number };
    counts?: { excellent: number; good: number; medium: number; low: number };
    statistics?: { avg: number; std: number; min: number; max: number };
  };

  const earningRules = Array.isArray(ruleApplicationData.earningRules)
    ? (ruleApplicationData.earningRules as Array<{
        behavior_type: string;
        base_score: number;
        variance: number;
        description: string;
      }>)
    : [];

  const spendingRules = Array.isArray(ruleApplicationData.spendingRules)
    ? (ruleApplicationData.spendingRules as Array<{
        spending_type: string;
        base_cost: number;
        min_score: number;
        description: string;
      }>)
    : [];

  const rewardTypes = Array.isArray(ruleApplicationData.rewardTypes)
    ? (ruleApplicationData.rewardTypes as Array<{
        type: string;
        name: string;
        cost: number;
        min_rank: number;
        description: string;
      }>)
    : [];

  const students = ruleApplicationData.students || [];

  return (
    <div className='space-y-6'>
      <div className='bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-500/10 dark:to-blue-500/10 rounded-xl p-6 border border-purple-200/50 dark:border-purple-500/20'>
        <div className='flex items-start gap-4'>
          <Zap className='w-6 h-6 text-purple-500 mt-1' />
          <div>
            <h3 className='text-lg font-semibold text-gray-800 dark:text-white mb-2'>
              智能规则自动应用中心
            </h3>
            <p className='text-sm text-gray-600 dark:text-slate-300'>
              基于规则推荐模型的智能应用，自动匹配并执行积分规则，控制评分分布，构建完整的积分生态闭环。
            </p>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
          <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between'>
            <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
              <Target className='w-5 h-5 text-blue-500' />
              评分分布统计
            </h3>
            <PermissionButton
              permission='algorithm.manage'
              onClick={handleAdjustDistribution}
              className='px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm transition-colors flex items-center gap-2'
            >
              <RefreshCw className='w-4 h-4' />
              调整分布
            </PermissionButton>
          </div>
          <div className='p-6'>
            {stats && (stats as { success?: boolean }).success ? (
              <>
                <div className='grid grid-cols-2 gap-4 mb-4'>
                  <div className='bg-green-50 dark:bg-green-500/10 rounded-lg p-4'>
                    <div className='text-sm text-gray-500 dark:text-slate-400'>学生总数</div>
                    <div className='text-2xl font-bold text-green-600 dark:text-green-400'>
                      {stats.total_students}
                    </div>
                  </div>
                  <div className='bg-blue-50 dark:bg-blue-500/10 rounded-lg p-4'>
                    <div className='text-sm text-gray-500 dark:text-slate-400'>平均分</div>
                    <div className='text-2xl font-bold text-blue-600 dark:text-blue-400'>
                      {stats.statistics?.avg || 0}
                    </div>
                  </div>
                </div>
                <div className='space-y-3'>
                  {ANALYSIS_CONFIG.scoreDistributionTargets.map((t) => {
                    const cnt = (stats.counts?.[t.key] as number) || 0;
                    const pct = ((stats.distribution?.[t.key] as number) || 0) * 100;
                    return (
                      <div key={t.key}>
                        <div className='flex justify-between text-sm mb-1'>
                          <span className='text-gray-600 dark:text-slate-400'>
                            {t.label} (目标{t.targetPct}%)
                          </span>
                          <span className='text-gray-800 dark:text-white'>
                            {cnt}人 ({pct.toFixed(1)}%)
                          </span>
                        </div>
                        <div className='w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2'>
                          <div
                            className={`${t.color} h-2 rounded-full`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className='text-center py-8 text-gray-500 dark:text-slate-400'>
                <Target className='w-12 h-12 mx-auto mb-3 text-gray-400' />
                <p>暂无评分分布数据</p>
                <p className='text-xs mt-1 text-gray-400 dark:text-slate-500'>
                  需学生已有积分/成绩记录；可在右侧「规则应用控制」选择学生执行规则，或点击「调整分布」生成
                </p>
              </div>
            )}
          </div>
        </div>

        <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
          <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
            <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
              <Zap className='w-5 h-5 text-purple-500' />
              规则应用控制
            </h3>
          </div>
          <div className='p-6 space-y-4'>
            <>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>
                  选择学生
                </label>
                <select
                  value={selectedUserId || ''}
                  onChange={(e) =>
                    setSelectedUserId(e.target.value ? Number(e.target.value) : null)
                  }
                  className='w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500'
                >
                  <option value=''>请选择学生</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.class_name})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>
                  行为类型
                </label>
                <select
                  value={selectedBehaviorType}
                  onChange={(e) => setSelectedBehaviorType(e.target.value)}
                  className='w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500'
                >
                  {earningRules.map((rule) => (
                    <option key={rule.behavior_type} value={rule.behavior_type}>
                      {rule.description} (+{rule.base_score}分)
                    </option>
                  ))}
                </select>
              </div>
              <PermissionButton
                permission='algorithm.manage'
                onClick={handleApplyRule}
                disabled={!selectedUserId || ruleApplicationData.applyingRule}
                className='w-full py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-purple-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2'
              >
                {ruleApplicationData.applyingRule ? (
                  <>
                    <Loader2 className='w-4 h-4 animate-spin' />
                    应用中...
                  </>
                ) : (
                  <>
                    <Zap className='w-4 h-4' />
                    应用规则
                  </>
                )}
              </PermissionButton>
              {ruleApplicationData.applyingResult && (
                <div className='bg-purple-50/50 dark:bg-purple-500/10 rounded-lg p-4 border border-purple-200/50 dark:border-purple-500/20'>
                  <div className='flex items-center gap-2 mb-2'>
                    <CheckCircle className='w-5 h-5 text-green-500' />
                    <span className='font-medium text-gray-800 dark:text-white'>应用结果</span>
                  </div>
                  <pre className='text-sm text-gray-600 dark:text-slate-300 overflow-auto'>
                    {JSON.stringify(ruleApplicationData.applyingResult, null, 2)}
                  </pre>
                </div>
              )}
            </>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
          <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
            <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
              <ArrowUp className='w-5 h-5 text-green-500' />
              积分获取途径 ({earningRules.length})
            </h3>
          </div>
          <div className='p-6'>
            <div className='space-y-3'>
              {earningRules.map((rule) => (
                <div
                  key={rule.behavior_type}
                  className='bg-green-50/50 dark:bg-green-500/10 rounded-lg p-3'
                >
                  <div className='flex justify-between items-center'>
                    <span className='font-medium text-gray-800 dark:text-white'>
                      {rule.description}
                    </span>
                    <span className='text-green-600 dark:text-green-400 font-bold'>
                      +{rule.base_score}
                    </span>
                  </div>
                  <div className='text-xs text-gray-500 dark:text-slate-400 mt-1'>
                    波动范围: ±{rule.variance}分
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
          <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
            <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
              <ArrowDown className='w-5 h-5 text-red-500' />
              积分消费渠道 ({spendingRules.length})
            </h3>
          </div>
          <div className='p-6'>
            <div className='space-y-3'>
              {spendingRules.map((rule) => (
                <div
                  key={rule.spending_type}
                  className='bg-red-50/50 dark:bg-red-500/10 rounded-lg p-3'
                >
                  <div className='flex justify-between items-center'>
                    <span className='font-medium text-gray-800 dark:text-white'>
                      {rule.description}
                    </span>
                    <span className='text-red-600 dark:text-red-400 font-bold'>
                      -{rule.base_cost}
                    </span>
                  </div>
                  <div className='text-xs text-gray-500 dark:text-slate-400 mt-1'>
                    最低积分: {rule.min_score}分
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
          <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
            <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
              <Award className='w-5 h-5 text-yellow-500' />
              奖励类型 ({rewardTypes.length})
            </h3>
          </div>
          <div className='p-6'>
            <div className='space-y-3'>
              {rewardTypes.map((reward) => (
                <div
                  key={reward.type}
                  className='bg-yellow-50/50 dark:bg-yellow-500/10 rounded-lg p-3'
                >
                  <div className='flex justify-between items-center'>
                    <span className='font-medium text-gray-800 dark:text-white'>
                      {reward.name}
                    </span>
                    <span className='text-yellow-600 dark:text-yellow-400 font-bold'>
                      {reward.cost}分
                    </span>
                  </div>
                  <div className='text-xs text-gray-500 dark:text-slate-400 mt-1'>
                    {reward.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
        <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
          <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
            <Sparkles className='w-5 h-5 text-orange-500' />
            特殊场景处理 - 手机拿取奖励
          </h3>
        </div>
        <div className='p-6'>
          <div className='bg-orange-50 dark:bg-orange-500/10 rounded-lg p-4 mb-4'>
            <p className='text-sm text-gray-600 dark:text-slate-300'>
              手机拿取行为是一种特殊奖励行为，学生可以通过排名获得相应奖励，使用该奖励后自动扣取积分。
              单次扣取幅度控制在总分的5%-15%范围内，确保形成明显的分数下降效果，激励学生通过后续良好表现增加积分。
            </p>
          </div>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <div className='flex items-center gap-3 p-4 bg-gray-50 dark:bg-slate-700 rounded-lg'>
              <div className='w-10 h-10 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center'>
                <TrendingUp className='w-5 h-5 text-green-600 dark:text-green-400' />
              </div>
              <div>
                <div className='text-sm font-medium text-gray-800 dark:text-white'>正向激励</div>
                <div className='text-xs text-gray-500 dark:text-slate-400'>
                  模型运行良好时分数正常提升
                </div>
              </div>
            </div>
            <div className='flex items-center gap-3 p-4 bg-gray-50 dark:bg-slate-700 rounded-lg'>
              <div className='w-10 h-10 bg-red-100 dark:bg-red-500/20 rounded-full flex items-center justify-center'>
                <TrendingDown className='w-5 h-5 text-red-600 dark:text-red-400' />
              </div>
              <div>
                <div className='text-sm font-medium text-gray-800 dark:text-white'>
                  手机拿取扣分
                </div>
                <div className='text-xs text-gray-500 dark:text-slate-400'>
                  单次扣5%-15%，效果明显
                </div>
              </div>
            </div>
            <div className='flex items-center gap-3 p-4 bg-gray-50 dark:bg-slate-700 rounded-lg'>
              <div className='w-10 h-10 bg-blue-100 dark:bg-blue-500/20 rounded-full flex items-center justify-center'>
                <Activity className='w-5 h-5 text-blue-600 dark:text-blue-400' />
              </div>
              <div>
                <div className='text-sm font-medium text-gray-800 dark:text-white'>波动控制</div>
                <div className='text-xs text-gray-500 dark:text-slate-400'>
                  波动幅度控制在±20%以内
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
