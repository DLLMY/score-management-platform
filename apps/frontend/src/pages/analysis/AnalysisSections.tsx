// D2 拆分（2026-09-08）：从 pages/Analysis.tsx 抽出的纯展示子组件。
// 逻辑层（state/effect/handler/useMemo）仍留在 Analysis.tsx，本文件仅接收 props 渲染，行为逐字节等价。
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import {
  Users,
  TrendingUp,
  Trophy,
  GitBranch,
  TrendingDown,
  AlertTriangle,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
} from 'lucide-react';
import { EmptyState } from '../../components';
import { AlgorithmStatistics, ClusterData, WarningData, User } from '../../types';

export interface UserWithCluster extends User {
  cluster?: { user_id: number; cluster: number; cluster_name: string; distance?: number } | null;
}

export interface AlgorithmData {
  statistics: AlgorithmStatistics | null;
  clusters: ClusterData | null;
  warnings: WarningData | null;
}

export interface ScoreDistributionItem {
  name: string;
  count: number;
  color: string;
}

export interface ClusterPieItem {
  name: string;
  value: number;
  color: string;
}

export interface WeeklyDataItem {
  week: string;
  avg: number;
  count: number;
}

export interface BasicStat {
  label: string;
  value: number | null;
  icon: typeof Users;
  bgColor: string;
  textColor: string;
}

export interface AlgorithmStat {
  label: string;
  value: string | number;
  icon: typeof TrendingUp;
  bgColor: string;
  textColor: string;
  trend?: string;
  description: string;
}

export const CLUSTER_COLORS: Record<
  string,
  { bg: string; text: string; light: string; border: string }
> = {
  全面优秀型: {
    bg: 'bg-blue-500',
    text: 'text-blue-600',
    light: 'bg-blue-50 dark:bg-blue-500/10',
    border: 'border-blue-200 dark:border-blue-500/30',
  },
  遵纪但学业吃力型: {
    bg: 'bg-yellow-500',
    text: 'text-yellow-600',
    light: 'bg-yellow-50 dark:bg-yellow-500/10',
    border: 'border-yellow-200 dark:border-yellow-500/30',
  },
  聪明但散漫型: {
    bg: 'bg-orange-500',
    text: 'text-orange-600',
    light: 'bg-orange-50 dark:bg-orange-500/10',
    border: 'border-orange-200 dark:border-orange-500/30',
  },
  双困型: {
    bg: 'bg-red-500',
    text: 'text-red-600',
    light: 'bg-red-50 dark:bg-red-500/10',
    border: 'border-red-200 dark:border-red-500/30',
  },
};

export const RISK_COLORS: Record<string, { bg: string; text: string; light: string }> = {
  high: { bg: 'bg-red-500', text: 'text-red-600', light: 'bg-red-50 dark:bg-red-500/10' },
  medium: {
    bg: 'bg-yellow-500',
    text: 'text-yellow-600',
    light: 'bg-yellow-50 dark:bg-yellow-500/10',
  },
  low: { bg: 'bg-green-500', text: 'text-green-600', light: 'bg-green-50 dark:bg-green-500/10' },
};

export const getClusterColor = (label: string): string => {
  const colorMap: Record<string, string> = {
    全面优秀型: '#3b82f6',
    遵纪但学业吃力型: '#eab308',
    聪明但散漫型: '#f97316',
    双困型: '#ef4444',
  };
  return colorMap[label] || '#6b7280';
};

/** 基础统计卡片网格（学生总数 / 平均 / 最高 / 最低 / 标准差 / 优秀人数） */
export function BasicStatsGrid({ stats }: { stats: BasicStat[] }) {
  return (
    <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5'>
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div key={index} className='stats-card' style={{ padding: '0.5rem 0.75rem' }}>
            <div className='flex items-start justify-between'>
              <div>
                <p className='text-[10px] text-gray-500 mb-0.5'>{stat.label}</p>
                <p className='text-xl font-bold text-gray-800'>
                  {stat.value !== null ? stat.value : '—'}
                </p>
              </div>
              <div
                className={`${stat.bgColor} ${stat.textColor} stats-icon`}
                style={{ width: '2rem', height: '2rem', borderRadius: '0.375rem' }}
              >
                <Icon className='w-4 h-4' />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 算法洞察卡片（行为-学业相关性 / 学生分群 / 风险预警） */
export function AlgorithmInsightCards({
  stats,
  riskStudents,
  correlation,
}: {
  stats: AlgorithmStat[];
  riskStudents: WarningData['risk_students'];
  correlation: number;
}) {
  return (
    <div className='mb-3'>
      <div className='flex items-center gap-1.5 mb-2'>
        <Sparkles className='w-3.5 h-3.5 text-purple-500' />
        <h3 className='text-sm font-semibold text-gray-800'>算法洞察</h3>
        <span className='text-[9px] text-gray-500 px-1 py-0.25 bg-purple-50 dark:bg-purple-500/10 rounded-full'>
          基于行为与学业数据
        </span>
      </div>
      <div className='grid grid-cols-1 md:grid-cols-3 gap-2'>
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className='stats-card border-l-2 border-l-purple-500 bg-gradient-to-r from-purple-50/50 to-transparent dark:from-purple-500/5'
              style={{ padding: '0.5rem 0.75rem' }}
            >
              <div className='flex items-start justify-between'>
                <div>
                  <p className='text-[9px] text-gray-500 mb-0.5'>{stat.label}</p>
                  <p className={`text-lg font-bold ${stat.textColor}`}>{stat.value}</p>
                  <p className='text-[8px] text-gray-400 mt-0.5'>{stat.description}</p>
                  {stat.trend && (
                    <span
                      className={`inline-flex items-center gap-0.5 text-[9px] font-medium mt-1 ${
                        stat.label === '风险预警' && riskStudents.length > 0
                          ? 'text-red-500'
                          : 'text-gray-500'
                      }`}
                    >
                      {stat.label === '行为-学业相关性' &&
                        (correlation > 0.5 ? (
                          <ArrowUpRight className='w-2 h-2' />
                        ) : correlation > 0 ? (
                          <ArrowDownRight className='w-2 h-2' />
                        ) : null)}
                      {stat.trend}
                    </span>
                  )}
                </div>
                <div
                  className={`${stat.bgColor} ${stat.textColor} stats-icon`}
                  style={{ width: '1.5rem', height: '1.5rem', borderRadius: '0.25rem' }}
                >
                  <Icon className='w-3 h-3' />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 积分分布柱状图 */
export function ScoreDistributionPanel({ data }: { data: ScoreDistributionItem[] }) {
  return (
    <div className='card'>
      <div className='card-header' style={{ padding: '0.5rem 0.75rem' }}>
        <div className='flex items-center gap-1.5'>
          <div className='w-6 h-6 bg-primary-100 rounded-md flex items-center justify-center'>
            <BarChart3 className='w-3 h-3 text-primary-600' />
          </div>
          <div>
            <h3 className='text-sm font-semibold text-gray-800'>积分分布</h3>
            <p className='text-[9px] text-gray-500'>各分数段学生人数统计</p>
          </div>
        </div>
      </div>
      <div className='card-body' style={{ padding: '0.5rem 0.75rem' }}>
        <ResponsiveContainer width='100%' height={160}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray='3 3' stroke='#f1f5f9' />
            <XAxis
              dataKey='name'
              tick={{ fontSize: 8, fill: '#64748b', fontWeight: 500 }}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis tick={{ fontSize: 8, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} />
            <Tooltip
              formatter={(value: unknown) => [`${value} 人`, '人数']}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '10px',
              }}
            />
            <Bar dataKey='count' radius={[4, 4, 0, 0]} barSize={30}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** 学生分群分布饼图 + 图例 */
export function ClusterDistributionPanel({
  summary,
  pieData,
}: {
  summary: NonNullable<ClusterData['cluster_summary']>;
  pieData: ClusterPieItem[];
}) {
  return (
    <div className='card'>
      <div className='card-header' style={{ padding: '0.5rem 0.75rem' }}>
        <div className='flex items-center gap-1.5'>
          <div className='w-6 h-6 bg-purple-100 rounded-md flex items-center justify-center'>
            <GitBranch className='w-3 h-3 text-purple-600' />
          </div>
          <div>
            <h3 className='text-sm font-semibold text-gray-800'>学生分群分布</h3>
            <p className='text-[9px] text-gray-500'>基于行为与学业聚类分析</p>
          </div>
        </div>
      </div>
      <div className='card-body' style={{ padding: '0.5rem 0.75rem' }}>
        {summary.length > 0 ? (
          <div className='flex items-center gap-3'>
            <ResponsiveContainer width='50%' height={120}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx='50%'
                  cy='50%'
                  innerRadius={24}
                  outerRadius={45}
                  paddingAngle={2}
                  dataKey='value'
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getClusterColor(entry.name)} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: unknown) => [`${value} 人`, '人数']}
                  contentStyle={{ fontSize: '10px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className='flex-1 space-y-1'>
              {summary.map((cluster) => {
                const colors = CLUSTER_COLORS[cluster.label] || CLUSTER_COLORS['双困型'];
                return (
                  <div key={cluster.label} className='flex items-center justify-between'>
                    <div className='flex items-center gap-1'>
                      <div className={`w-2 h-2 rounded-full ${colors.bg}`} />
                      <span className='text-[9px] text-gray-700 dark:text-slate-300'>
                        {cluster.label}
                      </span>
                    </div>
                    <span className={`text-[9px] font-semibold ${colors.text}`}>
                      {cluster.count}人
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className='flex flex-col items-center justify-center h-[150px] text-center'>
            <GitBranch className='w-8 h-8 text-gray-300 mb-2' />
            <p className='text-[10px] text-gray-500'>暂无分群数据</p>
            <p className='text-[9px] text-gray-400 mt-0.5'>前往「算法分析」页面</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** 风险预警面板（高/中/低风险计数 + 学生列表） */
export function RiskWarningPanel({
  riskStudents,
  highRiskCount,
  mediumRiskCount,
  lowRiskCount,
}: {
  riskStudents: WarningData['risk_students'];
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
}) {
  return (
    <div className='card mb-3 border-l-3 border-l-red-400'>
      <div className='card-header' style={{ padding: '0.5rem 0.75rem' }}>
        <div className='flex items-center gap-1.5'>
          <div className='w-6 h-6 bg-red-100 rounded-md flex items-center justify-center'>
            <AlertTriangle className='w-3 h-3 text-red-600' />
          </div>
          <div>
            <h3 className='text-sm font-semibold text-gray-800'>风险预警</h3>
            <p className='text-[9px] text-gray-500'>需要关注的学生</p>
          </div>
        </div>
      </div>
      <div className='card-body' style={{ padding: '0.5rem 0.75rem' }}>
        <div className='grid grid-cols-3 gap-1.5 mb-2'>
          <div className='text-center p-1.5 bg-red-50 dark:bg-red-500/10 rounded-md'>
            <p className='text-lg font-bold text-red-600'>{highRiskCount}</p>
            <p className='text-[9px] text-red-600 font-medium'>高风险</p>
          </div>
          <div className='text-center p-1.5 bg-yellow-50 dark:bg-yellow-500/10 rounded-md'>
            <p className='text-lg font-bold text-yellow-600'>{mediumRiskCount}</p>
            <p className='text-[9px] text-yellow-600 font-medium'>中风险</p>
          </div>
          <div className='text-center p-1.5 bg-green-50 dark:bg-green-500/10 rounded-md'>
            <p className='text-lg font-bold text-green-600'>{lowRiskCount}</p>
            <p className='text-[9px] text-green-600 font-medium'>低风险</p>
          </div>
        </div>
        <div className='space-y-1'>
          {riskStudents.slice(0, 4).map((student) => {
            const colors = RISK_COLORS[student.risk_level] || RISK_COLORS.low;
            return (
              <div
                key={student.user_id}
                className={`flex items-center justify-between p-1.5 rounded-md ${colors.light}`}
              >
                <div className='flex items-center gap-1.5'>
                  <AlertTriangle className={`w-3 h-3 ${colors.text}`} />
                  <div>
                    <p className='font-medium text-gray-800 dark:text-slate-200 text-xs'>
                      {student.name}
                    </p>
                    <p className='text-[9px] text-gray-500'>{student.class_name}</p>
                  </div>
                </div>
                <div className='text-right'>
                  <span
                    className={`inline-block px-1 py-0.25 rounded text-[9px] font-medium ${colors.light} ${colors.text}`}
                  >
                    {student.risk_level === 'high'
                      ? '高'
                      : student.risk_level === 'medium'
                      ? '中'
                      : '低'}
                  </span>
                </div>
              </div>
            );
          })}
          {riskStudents.length > 4 && (
            <p className='text-center text-[9px] text-gray-500 py-1'>
              还有 {riskStudents.length - 4} 名预警学生...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** 积分排行榜（Top 10） */
export function TopUsersRanking({ users }: { users: UserWithCluster[] }) {
  return (
    <div className='card'>
      <div className='card-header' style={{ padding: '0.75rem 1rem' }}>
        <div className='flex items-center gap-2'>
          <div className='w-8 h-8 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-lg flex items-center justify-center shadow-md shadow-yellow-500/30'>
            <Trophy className='w-4 h-4 text-white' />
          </div>
          <h3 className='text-base font-semibold text-gray-800'>积分排行榜</h3>
        </div>
      </div>
      <div className='card-body' style={{ padding: '0.75rem 1rem' }}>
        <div className='space-y-2'>
          {users.map((user, index) => {
            const clusterColors = user.cluster ? CLUSTER_COLORS[user.cluster.cluster_name] : null;
            const isTopThree = index < 3;
            const getRankColor = (idx: number) => {
              if (idx === 0) return 'from-yellow-400 to-amber-500';
              if (idx === 1) return 'from-gray-300 to-gray-500';
              if (idx === 2) return 'from-amber-600 to-orange-600';
              return 'from-gray-400 to-gray-500';
            };
            const getScoreColor = (score: number) => {
              if (score >= 80) return 'text-green-600';
              if (score >= 60) return 'text-blue-600';
              return 'text-red-600';
            };
            return (
              <div
                key={user.id}
                className={`relative p-2.5 rounded-lg transition-all duration-200 group ${
                  isTopThree
                    ? 'bg-gradient-to-r from-yellow-50 via-amber-50 to-orange-50 border border-yellow-100'
                    : 'bg-white border border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                }`}
              >
                {isTopThree && (
                  <div className='absolute -top-1 -left-1 w-4 h-4 rounded-full bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500 flex items-center justify-center shadow-sm shadow-yellow-500/30'>
                    <span className='text-[8px]'>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                    </span>
                  </div>
                )}

                <div className='flex items-center gap-2'>
                  <div
                    className={`relative w-8 h-8 rounded-full bg-gradient-to-br ${getRankColor(
                      index
                    )} flex items-center justify-center shadow-sm transition-all duration-200`}
                  >
                    {isTopThree ? (
                      <span className='text-[11px]'>
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                      </span>
                    ) : (
                      <span className='text-[10px] font-bold text-white'>{index + 1}</span>
                    )}
                  </div>

                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-1.5'>
                        <p className='font-semibold text-gray-900 text-xs whitespace-nowrap'>
                          {user.name}
                        </p>
                        {clusterColors && (
                          <span
                            className={`text-[9px] px-1.5 py-0.25 rounded-full ${clusterColors.light} ${clusterColors.text} font-medium whitespace-nowrap`}
                          >
                            {user.cluster?.cluster_name}
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-base font-bold ${
                          user.current_score != null
                            ? getScoreColor(user.current_score)
                            : 'text-gray-400'
                        } flex items-center gap-0.5`}
                      >
                        {user.current_score != null ? user.current_score : '--'}
                        <span className='text-[9px] text-gray-500'>分</span>
                      </span>
                    </div>
                    <p className='text-[9px] text-gray-500 truncate'>{user.class_name}</p>
                  </div>
                </div>
              </div>
            );
          })}
          {users.length === 0 && (
            <EmptyState icon='users' title='暂无数据' description='当前筛选条件下没有学生数据' />
          )}
        </div>
      </div>
    </div>
  );
}

/** 积分趋势（当前无真实周级数据，显示诚实空态） */
export function ScoreTrendPanel({ weeklyData }: { weeklyData: WeeklyDataItem[] }) {
  return (
    <div className='card'>
      <div className='card-header' style={{ padding: '0.75rem 1rem' }}>
        <div className='flex items-center gap-2'>
          <div className='w-8 h-8 bg-success-100 rounded-lg flex items-center justify-center'>
            <TrendingUp className='w-4 h-4 text-success-600' />
          </div>
          <div>
            <h3 className='text-base font-semibold text-gray-800'>积分趋势</h3>
            <p className='text-[10px] text-gray-500'>近8周平均积分变化</p>
          </div>
        </div>
      </div>
      <div className='card-body' style={{ padding: '0.75rem 1rem' }}>
        {weeklyData.length > 0 ? (
          <ResponsiveContainer width='100%' height={220}>
            <AreaChart data={weeklyData}>
              <CartesianGrid strokeDasharray='3 3' stroke='#f1f5f9' />
              <XAxis
                dataKey='week'
                tick={{ fontSize: 9, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                tick={{ fontSize: 9, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                domain={[60, 100]}
              />
              <Tooltip
                formatter={(value: unknown) => [`${value}分`, '平均分']}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '11px',
                }}
              />
              <defs>
                <linearGradient id='colorAvg' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='5%' stopColor='#22c55e' stopOpacity={0.3} />
                  <stop offset='95%' stopColor='#22c55e' stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type='monotone'
                dataKey='avg'
                stroke='#22c55e'
                strokeWidth={2}
                fillOpacity={1}
                fill='url(#colorAvg)'
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className='flex flex-col items-center justify-center h-[220px] text-gray-400'>
            <TrendingUp className='w-6 h-6 mb-2 text-gray-300' />
            <p className='text-xs'>暂无趋势数据</p>
            <p className='text-[10px] mt-1'>需连续多周积分记录后生成周均趋势</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** 相关性分析（Pearson 相关系数） */
export function CorrelationPanel({ statistics }: { statistics: AlgorithmStatistics | null }) {
  return (
    <div className='card'>
      <div className='card-header' style={{ padding: '0.75rem 1rem' }}>
        <div className='flex items-center gap-2'>
          <div className='w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center'>
            <Sparkles className='w-4 h-4 text-purple-600' />
          </div>
          <div>
            <h3 className='text-base font-semibold text-gray-800'>相关性分析</h3>
            <p className='text-[10px] text-gray-500'>行为与学业关联度</p>
          </div>
        </div>
      </div>
      <div className='card-body' style={{ padding: '0.75rem 1rem' }}>
        {statistics ? (
          (() => {
            const corr = statistics.correlation;
            const hasCorr = corr !== null && corr !== undefined && !Number.isNaN(corr);
            if (!hasCorr) {
              // correlation 无有效值（如仅有积分无成绩记录）→ 诚实显示"暂无"，不误判负相关
              return (
                <div className='flex flex-col items-center justify-center h-[160px] text-center'>
                  <Sparkles className='w-8 h-8 text-gray-300 mb-2' />
                  <p className='text-[10px] text-gray-500'>暂无关联数据</p>
                  <p className='text-[10px] text-gray-400 mt-1'>需同时存在积分与成绩记录</p>
                </div>
              );
            }
            return (
              <div className='flex flex-col items-center justify-center h-[160px]'>
                <div
                  className={`text-4xl font-bold ${
                    corr > 0.5 ? 'text-green-600' : corr > 0 ? 'text-yellow-600' : 'text-red-600'
                  }`}
                >
                  {corr.toFixed(2)}
                </div>
                <p className='text-[10px] text-gray-500 mt-2'>Pearson相关系数</p>
                <div className='mt-3 flex items-center gap-2'>
                  {corr > 0.5 ? (
                    <>
                      <TrendingUp className='w-4 h-4 text-green-500' />
                      <span className='text-xs text-green-600 font-medium'>强正相关</span>
                    </>
                  ) : corr > 0 ? (
                    <>
                      <TrendingUp className='w-4 h-4 text-yellow-500' />
                      <span className='text-xs text-yellow-600 font-medium'>弱正相关</span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className='w-4 h-4 text-red-500' />
                      <span className='text-xs text-red-600 font-medium'>负相关</span>
                    </>
                  )}
                </div>
                <div className='mt-3 p-2.5 bg-gray-50 dark:bg-slate-700/50 rounded-lg w-full'>
                  <p className='text-[10px] text-gray-500 text-center'>
                    积分与成绩呈
                    {corr > 0.5 ? '强正向关联' : corr > 0 ? '一定正向关联' : '负向关联'}
                  </p>
                </div>
              </div>
            );
          })()
        ) : (
          <div className='flex flex-col items-center justify-center h-[160px] text-center'>
            <TrendingUp className='w-8 h-8 text-gray-300 mb-2' />
            <p className='text-[10px] text-gray-500'>暂无相关数据</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** 需关注学生（积分 < 60）网格 */
export function NeedAttentionPanel({
  users,
  usersWithCluster,
}: {
  users: User[];
  usersWithCluster: UserWithCluster[];
}) {
  return (
    <div className='card mt-4 border-l-4 border-l-amber-400'>
      <div className='card-header' style={{ padding: '0.75rem 1rem' }}>
        <div className='flex items-center gap-2'>
          <div className='w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center'>
            <AlertTriangle className='w-4 h-4 text-amber-600' />
          </div>
          <div>
            <h3 className='text-base font-semibold text-gray-800'>需关注学生</h3>
            <p className='text-[10px] text-gray-500'>积分低于60分的学生</p>
          </div>
        </div>
      </div>
      <div className='card-body' style={{ padding: '0.75rem 1rem' }}>
        <div className='grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2'>
          {users.slice(0, 12).map((user) => {
            const userCluster = usersWithCluster.find((u) => u.id === user.id)?.cluster;
            const clusterColors = userCluster ? CLUSTER_COLORS[userCluster.cluster_name] : null;
            return (
              <div
                key={user.id}
                className='p-2 bg-red-50 dark:bg-red-500/10 rounded-lg text-center'
              >
                <p className='font-semibold text-gray-800 dark:text-slate-200 truncate text-sm'>
                  {user.name}
                </p>
                <p className='text-[10px] text-gray-500'>{user.class_name}</p>
                <p className='text-base font-bold text-red-600'>{user.current_score}</p>
                {clusterColors && (
                  <span
                    className={`inline-block mt-0.5 px-1 py-0.5 rounded text-[10px] ${clusterColors.light} ${clusterColors.text}`}
                  >
                    {userCluster?.cluster_name}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {users.length > 12 && (
          <p className='text-center text-[10px] text-gray-500 mt-2'>
            还有 {users.length - 12} 名学生积分低于60分...
          </p>
        )}
      </div>
    </div>
  );
}
