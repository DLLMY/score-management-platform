// T12-1 拆分（2026-09-12）：自 AnalysisSections.tsx 原样搬出，行为逐字节等价。
import { GitBranch } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { ClusterData } from '../../../types';
import { CLUSTER_COLORS, getClusterColor } from '../constants';
import type { ClusterPieItem } from '../types';

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
