// T12-2 拆分（2026-09-12）：自 ScoreAnalysisView「风险预警提醒」区块原样搬出，行为逐字节等价。
import { AlertTriangle } from 'lucide-react';
import { Card } from '../../../components';

/** 风险预警提醒横幅（riskStats.total > 0 时由 View 条件渲染） */
export function RiskAlertBanner({
  riskStats,
}: {
  riskStats: { high: number; medium: number; low: number; total: number };
}) {
  return (
    <Card className='bg-gradient-to-r from-red-500/10 via-orange-500/10 to-yellow-500/10 border border-red-500/30 rounded-xl'>
      <div className='p-4'>
        <div className='flex items-center gap-3'>
          <div className='flex-shrink-0 w-10 h-10 bg-gradient-to-br from-red-500 to-rose-500 rounded-lg flex items-center justify-center shadow-md shadow-red-500/30'>
            <AlertTriangle className='w-5 h-5 text-white' />
          </div>
          <div className='flex-1'>
            <h3 className='font-semibold text-gray-900 mb-0.5'>风险预警提醒</h3>
            <p className='text-sm text-gray-600'>
              当前有 <span className='font-semibold text-red-600'>{riskStats.total}</span>{' '}
              名学生处于风险状态（高风险: {riskStats.high}人，中风险: {riskStats.medium}
              人），建议结合成绩分析及时关注并采取干预措施。
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
