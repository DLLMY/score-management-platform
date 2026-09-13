// T12-2 拆分（2026-09-12）：自 ScoreAnalysisView「算法洞察区域」区块原样搬出，行为逐字节等价。
import { GitBranch, Sparkles, ShieldAlert } from 'lucide-react';
import { Card } from '../../../components';
import type { ClusterResult, CompositeScoreResult, RiskStudent, WarningResult } from '../types';

/** 算法洞察区域（学生分群 / 综合评分学生 / 风险预警学生三卡） */
export function AlgorithmInsightSection({
  clusters,
  compositeScores,
  warnings,
  riskStudents,
}: {
  clusters: ClusterResult | null;
  compositeScores: CompositeScoreResult | null;
  warnings: WarningResult | null;
  riskStudents: RiskStudent[];
}) {
  return (
    <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
      <Card className='border-l-3 border-l-purple-500 bg-gradient-to-r from-purple-50/50 to-transparent'>
        <div className='p-4'>
          <div className='flex items-center gap-3'>
            <div className='p-2 bg-purple-100 rounded-lg'>
              <GitBranch className='w-5 h-5 text-purple-600' />
            </div>
            <div>
              <div className='text-xs text-gray-500'>学生分群</div>
              <div className='text-xl font-bold text-gray-900'>
                {clusters?.n_clusters || '—'}
                <span className='text-xs font-normal text-gray-500 ml-1'>个群</span>
              </div>
            </div>
          </div>
          <p className='text-xs text-gray-500 mt-2'>
            {clusters && clusters.students ? `${clusters.students.length}名学生已分群` : '—'}
          </p>
        </div>
      </Card>

      <Card className='border-l-3 border-l-blue-500 bg-gradient-to-r from-blue-50/50 to-transparent'>
        <div className='p-4'>
          <div className='flex items-center gap-3'>
            <div className='p-2 bg-blue-100 rounded-lg'>
              <Sparkles className='w-5 h-5 text-blue-600' />
            </div>
            <div>
              <div className='text-xs text-gray-500'>综合评分学生</div>
              <div className='text-xl font-bold text-gray-900'>
                {compositeScores?.scores?.length || '—'}
                <span className='text-xs font-normal text-gray-500 ml-1'>人</span>
              </div>
            </div>
          </div>
          <p className='text-xs text-gray-500 mt-2'>基于熵权法计算综合评分</p>
        </div>
      </Card>

      <Card
        className={`border-l-3 ${
          warnings === null
            ? 'border-l-gray-300'
            : riskStudents.length > 0
            ? 'border-l-red-500'
            : 'border-l-green-500'
        } bg-gradient-to-r ${
          warnings === null
            ? 'from-gray-50'
            : riskStudents.length > 0
            ? 'from-red-50/50'
            : 'from-green-50/50'
        } to-transparent`}
      >
        <div className='p-4'>
          <div className='flex items-center gap-3'>
            <div
              className={`p-2 rounded-lg ${
                warnings === null
                  ? 'bg-gray-100'
                  : riskStudents.length > 0
                  ? 'bg-red-100'
                  : 'bg-green-100'
              }`}
            >
              <ShieldAlert
                className={`w-5 h-5 ${
                  warnings === null
                    ? 'text-gray-400'
                    : riskStudents.length > 0
                    ? 'text-red-600'
                    : 'text-green-600'
                }`}
              />
            </div>
            <div>
              <div className='text-xs text-gray-500'>风险预警学生</div>
              {warnings === null ? (
                <div className='text-sm font-bold text-gray-400'>无法获取</div>
              ) : (
                <div
                  className={`text-xl font-bold ${
                    riskStudents.length > 0 ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {riskStudents.length}
                  <span className='text-xs font-normal text-gray-500 ml-1'>人</span>
                </div>
              )}
            </div>
          </div>
          <p className='text-xs text-gray-500 mt-2'>
            {warnings === null
              ? '预警接口加载失败，请稍后重试'
              : `高风险: ${riskStudents.filter((s) => s.risk_level === 'high').length}人`}
          </p>
        </div>
      </Card>
    </div>
  );
}
