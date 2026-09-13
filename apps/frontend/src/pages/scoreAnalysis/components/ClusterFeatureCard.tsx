// T12-2 拆分（2026-09-12）：自 ScoreAnalysisView「分群特征分析」卡片原样搬出，行为逐字节等价。
import { GitBranch } from 'lucide-react';
import { Card } from '../../../components';
import { CLUSTER_COLORS } from '../constants';

/** 分群特征分析卡片（各分群人数 + 特征描述与干预建议） */
export function ClusterFeatureCard({
  clusterSummary,
}: {
  clusterSummary: { label: string; count: number }[];
}) {
  return (
    <Card className='rounded-xl'>
      <div className='p-3 border-b border-gray-100'>
        <h3 className='font-medium text-gray-800 flex items-center gap-2'>
          <GitBranch className='w-4 h-4 text-purple-500' />
          分群特征分析
        </h3>
      </div>
      <div className='p-3'>
        <div className='space-y-1.5'>
          {clusterSummary.map((cluster, index) => {
            const colors = CLUSTER_COLORS[cluster.label];
            const features: Record<string, { desc: string; suggestion: string }> = {
              全面优秀型: {
                desc: '行为规范，学业优秀',
                suggestion: '保持状态，引领同学',
              },
              遵纪但学业吃力型: {
                desc: '遵守纪律，学习待提高',
                suggestion: '加强学习辅导',
              },
              聪明但散漫型: {
                desc: '学习能力强，行为需改进',
                suggestion: '加强纪律教育',
              },
              双困型: { desc: '行为和学业需关注', suggestion: '制定个性化方案' },
            };
            const feature = features[cluster.label] || { desc: '-', suggestion: '-' };

            return (
              <div
                key={index}
                className={`p-2 rounded-lg ${colors?.light} border ${colors?.border}`}
              >
                <div className='flex items-center justify-between mb-0.5'>
                  <div className='flex items-center gap-1'>
                    <div className={`w-1.5 h-1.5 rounded-full ${colors?.bg}`} />
                    <span className='text-[10px] font-semibold text-gray-800'>{cluster.label}</span>
                  </div>
                  <span className='text-xs font-bold text-gray-900'>{cluster.count}人</span>
                </div>
                <p className='text-[9px] text-gray-600'>{feature.desc}</p>
                <p className='text-[9px] text-gray-500 mt-0.5'>{feature.suggestion}</p>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
