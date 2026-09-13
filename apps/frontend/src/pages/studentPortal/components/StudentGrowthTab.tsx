/**
 * 学生自助中心 —— 我的成长标签页（参与度指数 / 周趋势 SVG / 风险预警 / 积分变动）。
 * T12-10b 拆分（2026-09-12）：原 StudentPortalView.tsx 的 growth 区块外提为独立组件。
 */
import { TrendingUp, ShieldAlert, Target } from 'lucide-react';
import { formatNumber } from '../../../utils/format';
import type { StudentPortalViewProps } from '../types';

export function StudentGrowthTab({
  insights,
  growthLoading,
}: {
  insights: StudentPortalViewProps['insights'];
  growthLoading: boolean;
}) {
  return (
    <div className='space-y-4'>
      {/* 参与度指数卡片 */}
      <div className='bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 rounded-2xl p-6 text-white shadow-lg'>
        <div className='flex items-center gap-2 text-white/80 text-sm'>
          <TrendingUp className='w-4 h-4' /> 我的参与度指数
        </div>
        <div className='flex items-end gap-3 mt-2'>
          <div className='text-4xl font-bold'>
            {growthLoading
              ? '...'
              : insights?.engagement?.error
              ? '!'
              : insights?.engagement?.has_data
              ? insights.engagement.engagement_score
              : '—'}
          </div>
          <span className='text-white/80 text-sm mb-1'>
            {insights?.engagement?.error
              ? '加载失败'
              : insights?.engagement?.level === 'high'
              ? '高参与'
              : insights?.engagement?.level === 'medium'
              ? '中参与'
              : insights?.engagement?.level === 'low'
              ? '低参与'
              : '暂无数据'}
          </span>
        </div>
        <div className='text-white/70 text-xs mt-1'>
          {insights?.engagement?.error
            ? '参与度计算失败，请稍后刷新重试'
            : insights?.engagement?.description || '综合出勤、作业提交与积分活跃度评估'}
        </div>
      </div>

      {insights?.engagement?.has_data && (
        <div className='bg-white dark:bg-slate-800 rounded-2xl p-4 shadow'>
          <div className='text-sm font-semibold text-gray-800 dark:text-white mb-3'>参与度构成</div>
          <div className='space-y-3'>
            {(insights.engagement.components?.attendance_rate != null ||
              insights.engagement.components?.homework_rate != null ||
              insights.engagement.components?.activity_rate != null) && (
              <>
                {insights.engagement.components?.attendance_rate != null && (
                  <div>
                    <div className='flex justify-between text-xs text-gray-500 dark:text-slate-400 mb-1'>
                      <span>出勤率</span>
                      <span>
                        {Math.round(insights.engagement.components.attendance_rate * 100)}%
                      </span>
                    </div>
                    <div className='h-2 rounded-full bg-gray-100 dark:bg-slate-700'>
                      <div
                        className='h-2 rounded-full bg-purple-500'
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(0, insights.engagement.components.attendance_rate * 100)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
                {insights.engagement.components?.homework_rate != null && (
                  <div>
                    <div className='flex justify-between text-xs text-gray-500 dark:text-slate-400 mb-1'>
                      <span>作业提交率</span>
                      <span>{Math.round(insights.engagement.components.homework_rate * 100)}%</span>
                    </div>
                    <div className='h-2 rounded-full bg-gray-100 dark:bg-slate-700'>
                      <div
                        className='h-2 rounded-full bg-blue-500'
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(0, insights.engagement.components.homework_rate * 100)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
                {insights.engagement.components?.activity_rate != null && (
                  <div>
                    <div className='flex justify-between text-xs text-gray-500 dark:text-slate-400 mb-1'>
                      <span>积分活跃度</span>
                      <span>{Math.round(insights.engagement.components.activity_rate * 100)}%</span>
                    </div>
                    <div className='h-2 rounded-full bg-gray-100 dark:bg-slate-700'>
                      <div
                        className='h-2 rounded-full bg-emerald-500'
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(0, insights.engagement.components.activity_rate * 100)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* 参与度周趋势（SVG 折线） */}
      {insights?.participation_trend?.error ? (
        <div className='bg-white dark:bg-slate-800 rounded-2xl p-4 shadow'>
          <div className='flex items-center gap-2 font-semibold text-gray-800 dark:text-white mb-1'>
            <TrendingUp className='w-4 h-4' /> 参与度周趋势
            <span className='text-xs px-2 py-0.5 rounded-full font-medium bg-gray-400 text-white'>
              加载失败
            </span>
          </div>
          <p className='text-xs text-gray-500 dark:text-slate-400'>趋势计算失败，请稍后刷新重试</p>
        </div>
      ) : insights?.participation_trend?.series?.length ? (
        <div className='bg-white dark:bg-slate-800 rounded-2xl p-4 shadow'>
          <div className='flex items-center gap-2 font-semibold text-gray-800 dark:text-white mb-3'>
            <TrendingUp className='w-4 h-4' /> 参与度周趋势
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                insights.participation_trend.trend === 'up'
                  ? 'bg-emerald-500 text-white'
                  : insights.participation_trend.trend === 'down'
                  ? 'bg-red-500 text-white'
                  : 'bg-violet-500 text-white'
              }`}
            >
              {insights.participation_trend.trend === 'up'
                ? '上升'
                : insights.participation_trend.trend === 'down'
                ? '下降'
                : '平稳'}
            </span>
          </div>
          {(() => {
            const series = insights.participation_trend.series;
            const valid = series.filter((p) => p.has_data !== false);
            if (!valid.length) {
              return <p className='text-sm text-gray-400 py-6 text-center'>暂无参与度趋势数据</p>;
            }
            const W = 340;
            const H = 140;
            const PAD = 16;
            const min = Math.min(0, ...valid.map((p) => p.engagement_score));
            const max = Math.max(100, ...valid.map((p) => p.engagement_score));
            const span = Math.max(1, max - min);
            const x = (i: number) => PAD + (i * (W - PAD * 2)) / Math.max(1, series.length - 1);
            const y = (v: number) => H - PAD - ((v - min) / span) * (H - PAD * 2);
            const pts = series.map(
              (p, i) => `${formatNumber(x(i), 1)},${formatNumber(y(p.engagement_score), 1)}`
            );
            const color =
              insights.participation_trend.trend === 'up'
                ? '#10b981'
                : insights.participation_trend.trend === 'down'
                ? '#ef4444'
                : '#8b5cf6';
            return (
              <svg
                viewBox={`0 0 ${W} ${H}`}
                className='w-full h-auto'
                role='img'
                aria-label='参与度周趋势'
              >
                {[0, 25, 50, 75, 100].map((g) => (
                  <g key={g}>
                    <line
                      x1={PAD}
                      x2={W - PAD}
                      y1={y(g)}
                      y2={y(g)}
                      stroke='#e5e7eb'
                      strokeWidth='1'
                      strokeDasharray={g === 0 || g === 100 ? '0' : '4 4'}
                    />
                    <text x={2} y={y(g) + 3} fontSize='8' fill='#9ca3af'>
                      {g}
                    </text>
                  </g>
                ))}
                <polygon
                  points={`${PAD},${y(min)} ${pts.join(' ')} ${x(series.length - 1)},${y(min)}`}
                  fill={color}
                  opacity='0.12'
                />
                <polyline
                  points={pts.join(' ')}
                  fill='none'
                  stroke={color}
                  strokeWidth='2.5'
                  strokeLinejoin='round'
                  strokeLinecap='round'
                />
                {series.map((p, i) => (
                  <circle
                    key={i}
                    cx={x(i)}
                    cy={y(p.engagement_score)}
                    r={p.has_data === false ? 2.5 : 3.5}
                    fill={color}
                  />
                ))}
                {series.map((p, i) => (
                  <text
                    key={`l${i}`}
                    x={x(i)}
                    y={H - 2}
                    fontSize='8'
                    fill='#9ca3af'
                    textAnchor='middle'
                  >
                    {p.week_label || `W${p.week_index + 1}`}
                  </text>
                ))}
              </svg>
            );
          })()}
        </div>
      ) : null}

      {/* 风险预警卡片 */}
      <div
        className={`rounded-2xl p-4 shadow ${
          insights?.risk?.error
            ? 'bg-gray-50 dark:bg-slate-800'
            : insights?.risk?.overall_risk_level === 'high'
            ? 'bg-red-50 dark:bg-red-500/10'
            : insights?.risk?.overall_risk_level === 'medium'
            ? 'bg-amber-50 dark:bg-amber-500/10'
            : 'bg-emerald-50 dark:bg-emerald-500/10'
        }`}
      >
        <div className='flex items-center gap-2 font-semibold mb-2 text-gray-800 dark:text-white'>
          <ShieldAlert className='w-4 h-4' /> 风险预警
          {insights?.risk?.error ? (
            <span className='text-xs px-2 py-0.5 rounded-full font-medium bg-gray-400 text-white'>
              加载失败
            </span>
          ) : (
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                insights?.risk?.overall_risk_level === 'high'
                  ? 'bg-red-500 text-white'
                  : insights?.risk?.overall_risk_level === 'medium'
                  ? 'bg-amber-500 text-white'
                  : 'bg-emerald-500 text-white'
              }`}
            >
              {insights?.risk?.overall_risk_level === 'high'
                ? '高风险'
                : insights?.risk?.overall_risk_level === 'medium'
                ? '中风险'
                : '低风险'}
            </span>
          )}
        </div>
        {insights?.risk?.error ? (
          <p className='text-xs text-gray-500 dark:text-slate-400'>风险评估失败，请稍后刷新重试</p>
        ) : insights?.risk?.intervention_suggestions?.length ? (
          <ul className='space-y-1'>
            {insights.risk.intervention_suggestions.slice(0, 3).map((s, i) => (
              <li
                key={i}
                className='text-xs text-gray-600 dark:text-slate-300 flex items-start gap-1.5'
              >
                <span className='text-gray-400'>·</span>
                {s}
              </li>
            ))}
          </ul>
        ) : (
          <p className='text-xs text-gray-400'>暂无风险因素，表现良好</p>
        )}
      </div>

      {/* 近周积分趋势 */}
      <div className='bg-white dark:bg-slate-800 rounded-2xl p-4 shadow'>
        <div className='flex items-center gap-2 font-semibold text-gray-800 dark:text-white mb-3'>
          <Target className='w-4 h-4' /> 近 8 周积分变动
        </div>
        {growthLoading ? (
          <p className='text-sm text-gray-400 py-6 text-center'>加载中...</p>
        ) : !insights?.score_trend?.length ? (
          <p className='text-sm text-gray-400 py-6 text-center'>暂无积分趋势数据</p>
        ) : (
          <div className='flex items-end justify-between gap-1 h-28 px-1'>
            {insights.score_trend.map((pt) => {
              const maxAbs = Math.max(
                1,
                ...insights.score_trend.map((p) => Math.abs(p.score_change || 0))
              );
              const h = Math.max(4, (Math.abs(pt.score_change || 0) / maxAbs) * 96);
              const positive = (pt.score_change || 0) >= 0;
              return (
                <div
                  key={pt.week_index}
                  className='flex flex-col items-center justify-end flex-1 gap-1'
                >
                  <span className='text-[10px] text-gray-400 font-medium'>
                    {(pt.score_change || 0) >= 0 ? '+' : ''}
                    {pt.score_change ?? 0}
                  </span>
                  <div
                    className={`w-full max-w-[18px] rounded-t ${
                      positive ? 'bg-emerald-400' : 'bg-red-400'
                    }`}
                    style={{ height: `${h}px` }}
                    title={`第${pt.week_index}周 ${pt.score_change ?? 0}`}
                  />
                  <span className='text-[10px] text-gray-400'>W{pt.week_index}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
