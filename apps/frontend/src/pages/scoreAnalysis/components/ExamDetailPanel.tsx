// T12-2 拆分（2026-09-12）：自 ScoreAnalysisView「主内容区域·左列」原样搬出，行为逐字节等价。
// 含三张卡片：各科平均分对比 / 成绩分布 / 各科详细统计。
import { BarChart3, TrendingUp } from 'lucide-react';
import { Card } from '../../../components';
import { formatNumber } from '../../../utils/format';
import type { ExamAnalysis } from '../types';
import { renderScoreDistribution, renderSubjectBarChart } from '../helpers';

/** 考试分析左列（lg:col-span-2，examAnalysis 为 null 时整体不渲染，与原条件渲染等价） */
export function ExamDetailPanel({ examAnalysis }: { examAnalysis: ExamAnalysis | null }) {
  if (!examAnalysis) return null;
  return (
    <div className='lg:col-span-2 space-y-4'>
      {/* 各科平均分对比 */}
      {examAnalysis.subject_stats && (
        <Card className='rounded-xl'>
          <div className='p-3 border-b border-gray-100'>
            <h3 className='font-medium text-gray-800 flex items-center gap-2'>
              <BarChart3 className='w-4 h-4 text-gray-600' />
              各科平均分对比
            </h3>
          </div>
          <div className='p-3'>{renderSubjectBarChart(examAnalysis.subject_stats)}</div>
        </Card>
      )}

      {/* 成绩分布 */}
      {examAnalysis && (
        <Card className='rounded-xl'>
          <div className='p-3 border-b border-gray-100'>
            <h3 className='font-medium text-gray-800 flex items-center gap-2'>
              <BarChart3 className='w-4 h-4 text-gray-600' />
              成绩分布
            </h3>
          </div>
          <div className='p-3'>
            {renderScoreDistribution(
              examAnalysis.subject_stats
                ? Object.values(examAnalysis.subject_stats).flatMap((s) => s.scores || [])
                : []
            )}
            <div className='flex justify-around mt-3 text-xs text-gray-500'>
              <span>不及格</span>
              <span>及格</span>
              <span>中等</span>
              <span>良好</span>
              <span>优秀</span>
            </div>
          </div>
        </Card>
      )}

      {/* 各科详细统计 */}
      {examAnalysis.subject_stats && (
        <Card className='rounded-xl'>
          <div className='p-3 border-b border-gray-100'>
            <h3 className='font-medium text-gray-800 flex items-center gap-2'>
              <TrendingUp className='w-4 h-4 text-gray-600' />
              各科详细统计
            </h3>
          </div>
          <div className='p-3'>
            <div className='space-y-2'>
              {Object.entries(examAnalysis.subject_stats).map(([subject, data]) => (
                <div
                  key={subject}
                  className='flex flex-wrap items-center justify-between gap-2 p-2.5 bg-gray-50/80 rounded-lg'
                >
                  {/* 窄屏换行，防横向溢出 */}
                  <div className='flex items-center gap-2'>
                    <span className='px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary-100 text-primary-700 whitespace-nowrap'>
                      {subject}
                    </span>
                    <div>
                      <div className='text-[10px] text-gray-500'>
                        参考 {data.count != null ? data.count : '--'} 人
                      </div>
                    </div>
                  </div>
                  <div className='flex items-center gap-4'>
                    <div className='text-center min-w-[50px]'>
                      <div className='text-[9px] text-gray-500'>平均分</div>
                      <div className='text-sm font-bold text-gray-900'>
                        {formatNumber(data.average, 1)}
                      </div>
                    </div>
                    <div className='text-center min-w-[50px]'>
                      <div className='text-[9px] text-gray-500'>最高分</div>
                      <div className='text-sm font-bold text-green-600'>
                        {data.max != null ? data.max : '--'}
                      </div>
                    </div>
                    <div className='text-center min-w-[50px]'>
                      <div className='text-[9px] text-gray-500'>最低分</div>
                      <div className='text-sm font-bold text-red-600'>
                        {data.min != null ? data.min : '--'}
                      </div>
                    </div>
                    <div className='text-center min-w-[50px]'>
                      <div className='text-[9px] text-gray-500'>及格率</div>
                      <div className='text-sm font-bold text-purple-600'>
                        {data.pass_rate != null ? `${data.pass_rate}%` : '--'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
