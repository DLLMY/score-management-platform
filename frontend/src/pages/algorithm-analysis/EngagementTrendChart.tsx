import React from 'react';
import type { EngagementTrendResult } from '../../types';

// 参与度周趋势 SVG 折线图
export function EngagementTrendChart({
  trend,
}: {
  trend: EngagementTrendResult;
}): React.ReactElement {
  const series = (trend.series || []).filter((p) => p.has_data);
  if (series.length === 0) {
    return (
      <div className='text-center py-8 text-gray-500 dark:text-slate-400'>
        该学生近 {trend.weeks} 周暂无参与度数据
      </div>
    );
  }
  const W = 720;
  const H = 240;
  const padL = 40;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const scores = series.map((p) => p.engagement_score);
  const maxS = Math.max(100, ...scores);
  const minS = Math.min(0, ...scores);
  const span = maxS - minS || 1;
  const stepX = series.length > 1 ? innerW / (series.length - 1) : 0;
  const yOf = (v: number) => padT + innerH - ((v - minS) / span) * innerH;
  const xOf = (i: number) => padL + stepX * i;
  const pts = series.map((p, i) => `${xOf(i)},${yOf(p.engagement_score)}`).join(' ');
  const trendColor =
    trend.trend === 'up' ? '#16a34a' : trend.trend === 'down' ? '#dc2626' : '#8b5cf6';
  const areaPts = `${padL},${padT + innerH} ${pts} ${xOf(series.length - 1)},${padT + innerH}`;
  return (
    <div>
      <div className='flex items-center justify-between mb-3'>
        <div className='text-sm text-gray-600 dark:text-slate-300'>
          趋势：
          <span className='font-medium' style={{ color: trendColor }}>
            {trend.trend === 'up' ? '↑ 上升' : trend.trend === 'down' ? '↓ 下降' : '→ 平稳'}
          </span>
        </div>
        <div className='text-xs text-gray-400'>共 {series.length} 周有效数据</div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className='w-full h-auto'
        preserveAspectRatio='xMidYMid meet'
      >
        {/* 网格线 */}
        {[0, 25, 50, 75, 100].map((g) => {
          const y = yOf(g);
          return (
            <g key={g}>
              <line
                x1={padL}
                y1={y}
                x2={W - padR}
                y2={y}
                stroke='#e5e7eb'
                strokeWidth={1}
                strokeDasharray='3 3'
              />
              <text x={padL - 6} y={y + 4} textAnchor='end' fontSize={10} fill='#9ca3af'>
                {g}
              </text>
            </g>
          );
        })}
        {/* 面积 */}
        <polygon points={areaPts} fill={trendColor} fillOpacity={0.08} />
        {/* 折线 */}
        <polyline
          points={pts}
          fill='none'
          stroke={trendColor}
          strokeWidth={2.5}
          strokeLinejoin='round'
          strokeLinecap='round'
        />
        {/* 数据点 */}
        {series.map((p, i) => (
          <g key={p.week_index}>
            <circle cx={xOf(i)} cy={yOf(p.engagement_score)} r={3.5} fill={trendColor} />
            <text x={xOf(i)} y={H - 10} textAnchor='middle' fontSize={9} fill='#9ca3af'>
              {p.week_label.replace(/^\d{4}-/, '')}
            </text>
            <text
              x={xOf(i)}
              y={yOf(p.engagement_score) - 8}
              textAnchor='middle'
              fontSize={9}
              fill='#4b5563'
            >
              {p.engagement_score.toFixed(0)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
