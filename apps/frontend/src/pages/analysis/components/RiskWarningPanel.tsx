// T12-1 拆分（2026-09-12）：自 AnalysisSections.tsx 原样搬出，行为逐字节等价。
import { AlertTriangle } from 'lucide-react';
import type { WarningData } from '../../../types';
import { RISK_COLORS } from '../constants';

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
