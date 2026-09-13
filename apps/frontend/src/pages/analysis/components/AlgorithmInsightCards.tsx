// T12-1 拆分（2026-09-12）：自 AnalysisSections.tsx 原样搬出，行为逐字节等价。
import { Sparkles, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { WarningData } from '../../../types';
import type { AlgorithmStat } from '../types';

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
