// T12-2 拆分（2026-09-12）：自 ScoreAnalysisView「风险预警分布」卡片原样搬出，行为逐字节等价。
import { AlertTriangle } from 'lucide-react';
import { Card } from '../../../components';
import type { RiskStudent } from '../types';

/** 风险预警分布（高中低风险条形 + 环形占比图） */
export function RiskDistributionCard({
  riskStats,
  riskStudents,
}: {
  riskStats: { high: number; medium: number; low: number; total: number };
  riskStudents: RiskStudent[];
}) {
  return (
    <Card className='rounded-xl'>
      <div className='p-3 border-b border-gray-100'>
        <h3 className='font-medium text-gray-800 flex items-center gap-2'>
          <AlertTriangle className='w-4 h-4 text-orange-500' />
          风险预警分布
        </h3>
      </div>
      <div className='p-3'>
        <div className='flex items-center justify-between mb-3'>
          <div className='flex-1 space-y-2.5'>
            {[
              { label: '高风险', count: riskStats.high, color: 'bg-red-500' },
              { label: '中风险', count: riskStats.medium, color: 'bg-yellow-500' },
              { label: '低风险', count: riskStats.low, color: 'bg-green-500' },
            ].map((item, index) => (
              <div key={index} className='flex items-center gap-1.5'>
                <div className={`w-1.5 h-1.5 rounded-full ${item.color}`} />
                <span className='text-[10px] text-gray-600 w-10'>{item.label}</span>
                <div className='flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden'>
                  <div
                    className={`h-full ${item.color}`}
                    style={{
                      width: `${
                        riskStudents.length > 0 ? (item.count / riskStudents.length) * 100 : 0
                      }%`,
                    }}
                  />
                </div>
                <span className='text-[10px] font-semibold text-gray-800 w-6 text-right'>
                  {item.count}
                </span>
              </div>
            ))}
          </div>
          <div className='relative w-18 h-18 ml-3'>
            <svg className='w-full h-full transform -rotate-90'>
              <circle cx='36' cy='36' r='30' stroke='#e5e7eb' strokeWidth='5' fill='none' />
              <circle
                cx='36'
                cy='36'
                r='30'
                stroke='#ef4444'
                strokeWidth='5'
                fill='none'
                strokeDasharray={`${
                  riskStudents.length
                    ? (riskStudents.filter((r) => r.risk_level === 'high').length /
                        riskStudents.length) *
                      188
                    : 0
                } 188`}
              />
              <circle
                cx='36'
                cy='36'
                r='30'
                stroke='#eab308'
                strokeWidth='5'
                fill='none'
                strokeDasharray={`${
                  riskStudents.length
                    ? (riskStudents.filter((r) => r.risk_level === 'medium').length /
                        riskStudents.length) *
                      188
                    : 0
                } 188`}
                transform='rotate(180 36 36)'
              />
            </svg>
            <div className='absolute inset-0 flex flex-col items-center justify-center'>
              <span className='text-base font-bold text-gray-800'>{riskStudents.length}</span>
              <span className='text-[8px] text-gray-500'>预警人数</span>
            </div>
          </div>
        </div>
        <div className='bg-blue-50 rounded-lg p-2'>
          <p className='text-[10px] text-gray-600'>
            <strong>预警说明：</strong>基于行为数据和学业表现综合评估
          </p>
        </div>
      </div>
    </Card>
  );
}
