// T12-2 拆分（2026-09-12）：自 ScoreAnalysisView「考试分析统计卡片」区块原样搬出，行为逐字节等价。
// 原区块的条件渲染 `examAnalysis && examAnalysis.overall && (...)` 收敛为组件内早退 null（等价）。
import { Users, TrendingUp, Award, BarChart3 } from 'lucide-react';
import { Card } from '../../../components';
import type { ExamAnalysis } from '../types';

/** 考试分析统计卡片（参考人数 / 平均成绩 / 优秀率 / 及格率） */
export function ExamOverviewCards({ examAnalysis }: { examAnalysis: ExamAnalysis | null }) {
  if (!(examAnalysis && examAnalysis.overall)) return null;
  return (
    <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
      <Card className='rounded-xl'>
        <div className='p-3'>
          <div className='flex items-center gap-2'>
            <div className='p-1.5 bg-blue-100 rounded-md'>
              <Users className='w-4 h-4 text-blue-600' />
            </div>
            <div>
              <div className='text-[10px] text-gray-500'>参考人数</div>
              <div className='text-lg font-bold text-gray-900'>
                {examAnalysis.overall.total_students != null
                  ? examAnalysis.overall.total_students
                  : '--'}
              </div>
            </div>
          </div>
        </div>
      </Card>
      <Card className='rounded-xl'>
        <div className='p-3'>
          <div className='flex items-center gap-2'>
            <div className='p-1.5 bg-green-100 rounded-md'>
              <TrendingUp className='w-4 h-4 text-green-600' />
            </div>
            <div>
              <div className='text-[10px] text-gray-500'>平均成绩</div>
              <div className='text-lg font-bold text-gray-900'>
                {examAnalysis.overall.overall_average != null
                  ? examAnalysis.overall.overall_average
                  : '--'}
              </div>
            </div>
          </div>
        </div>
      </Card>
      <Card className='rounded-xl'>
        <div className='p-3'>
          <div className='flex items-center gap-2'>
            <div className='p-1.5 bg-yellow-100 rounded-md'>
              <Award className='w-4 h-4 text-yellow-600' />
            </div>
            <div>
              <div className='text-[10px] text-gray-500'>优秀率</div>
              <div className='text-lg font-bold text-gray-900'>
                {examAnalysis.overall.excellent_rate != null
                  ? `${examAnalysis.overall.excellent_rate}%`
                  : '--'}
              </div>
            </div>
          </div>
        </div>
      </Card>
      <Card className='rounded-xl'>
        <div className='p-3'>
          <div className='flex items-center gap-2'>
            <div className='p-1.5 bg-purple-100 rounded-md'>
              <BarChart3 className='w-4 h-4 text-purple-600' />
            </div>
            <div>
              <div className='text-[10px] text-gray-500'>及格率</div>
              <div className='text-lg font-bold text-gray-900'>
                {examAnalysis.overall.pass_rate != null
                  ? `${examAnalysis.overall.pass_rate}%`
                  : '--'}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
