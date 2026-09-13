// T12-2 拆分（2026-09-12）：自 ScoreAnalysisView「算法洞察统计卡片」区块原样搬出，行为逐字节等价。
import {
  Users,
  TrendingUp,
  Target,
  BarChart3,
  Award,
  TrendingDown as TrendingDownIcon,
} from 'lucide-react';
import { Card } from '../../../components';
import type { ClusterResult, ExamAnalysis } from '../types';

/** 算法洞察统计卡片（学生总数 / 平均积分 / 最高 / 最低 / 标准差 / 优秀人数） */
export function AlgorithmOverviewCards({
  clusters,
  examAnalysis,
}: {
  clusters: ClusterResult | null;
  examAnalysis: ExamAnalysis | null;
}) {
  return (
    <div className='grid grid-cols-2 md:grid-cols-6 gap-3'>
      <Card className='border-l-3 border-l-blue-500 bg-gradient-to-r from-blue-50/60 to-transparent'>
        <div className='p-3'>
          <div className='flex items-center gap-2'>
            <div className='p-1.5 bg-blue-100 rounded-md'>
              <Users className='w-4 h-4 text-blue-600' />
            </div>
            <div>
              <div className='text-[10px] text-gray-500'>学生总数</div>
              <div className='text-lg font-bold text-gray-900'>
                {clusters?.students?.length || '—'}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className='border-l-3 border-l-green-500 bg-gradient-to-r from-green-50/60 to-transparent'>
        <div className='p-3'>
          <div className='flex items-center gap-2'>
            <div className='p-1.5 bg-green-100 rounded-md'>
              <TrendingUp className='w-4 h-4 text-green-600' />
            </div>
            <div>
              <div className='text-[10px] text-gray-500'>平均积分</div>
              <div className='text-lg font-bold text-gray-900'>
                {examAnalysis?.overall?.overall_average || '—'}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className='border-l-3 border-l-purple-500 bg-gradient-to-r from-purple-50/60 to-transparent'>
        <div className='p-3'>
          <div className='flex items-center gap-2'>
            <div className='p-1.5 bg-purple-100 rounded-md'>
              <Target className='w-4 h-4 text-purple-600' />
            </div>
            <div>
              <div className='text-[10px] text-gray-500'>最高积分</div>
              <div className='text-lg font-bold text-gray-900'>
                {examAnalysis?.overall?.highest_score || '—'}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className='border-l-3 border-l-red-500 bg-gradient-to-r from-red-50/60 to-transparent'>
        <div className='p-3'>
          <div className='flex items-center gap-2'>
            <div className='p-1.5 bg-red-100 rounded-md'>
              <TrendingDownIcon className='w-4 h-4 text-red-600' />
            </div>
            <div>
              <div className='text-[10px] text-gray-500'>最低积分</div>
              <div className='text-lg font-bold text-gray-900'>
                {examAnalysis?.overall?.lowest_score || '—'}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className='border-l-3 border-l-cyan-500 bg-gradient-to-r from-cyan-50/60 to-transparent'>
        <div className='p-3'>
          <div className='flex items-center gap-2'>
            <div className='p-1.5 bg-cyan-100 rounded-md'>
              <BarChart3 className='w-4 h-4 text-cyan-600' />
            </div>
            <div>
              <div className='text-[10px] text-gray-500'>标准差</div>
              <div className='text-lg font-bold text-gray-900'>
                {examAnalysis?.overall?.std_deviation || '—'}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className='border-l-3 border-l-amber-500 bg-gradient-to-r from-amber-50/60 to-transparent'>
        <div className='p-3'>
          <div className='flex items-center gap-2'>
            <div className='p-1.5 bg-amber-100 rounded-md'>
              <Award className='w-4 h-4 text-amber-600' />
            </div>
            <div>
              <div className='text-[10px] text-gray-500'>优秀人数</div>
              <div className='text-lg font-bold text-gray-900'>
                {examAnalysis?.overall?.excellent_count || '—'}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
