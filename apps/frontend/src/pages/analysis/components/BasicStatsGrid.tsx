// T12-1 拆分（2026-09-12）：自 AnalysisSections.tsx 原样搬出，行为逐字节等价。
import type { BasicStat } from '../types';

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
