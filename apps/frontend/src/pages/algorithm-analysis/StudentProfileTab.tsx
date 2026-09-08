import React from 'react';
import {
  UserCircle,
  TrendingUp,
  BookOpen,
  ShieldCheck,
  Activity,
  AlertCircle,
  LineChart,
  Loader2,
} from 'lucide-react';
import type { AnomalyResult, EngagementResult, ScoreAttributionResult } from '../../types';
import type { AlgorithmAnalysisDeps } from './types';
import { getTrendIcon, getTrendColor } from './helpers';
import { SEVERITY_COLORS } from './constants';

const renderScoreCard = (
  title: string,
  icon: React.ReactNode,
  current: number | undefined,
  predicted: number | undefined,
  trend: string | undefined,
  confidence: number | undefined,
  interval?: [number, number]
): React.ReactElement => {
  const cur = typeof current === 'number' ? current : 0;
  const pred = typeof predicted === 'number' ? predicted : cur;
  const conf = typeof confidence === 'number' ? confidence : 0;
  const t = trend || 'stable';
  const hasTrend = !!trend; // 趋势缺失显示 '--'，不冒充"稳定"
  return (
    <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
      <div className='flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-3'>
        {icon}
        {title}
      </div>
      <div className='flex items-end gap-2'>
        <div className='text-3xl font-bold text-gray-800 dark:text-white'>{cur.toFixed(1)}</div>
        <div
          className={`flex items-center gap-1 text-sm font-medium ${
            pred - cur >= 0 ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {getTrendIcon(t)}
          {pred >= cur ? '+' : ''}
          {(pred - cur).toFixed(1)}
        </div>
      </div>
      <div className='flex items-center justify-between mt-3 text-xs text-gray-400'>
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full font-medium ${getTrendColor(
            t
          )}`}
        >
          {hasTrend ? (t === 'up' ? '上升' : t === 'down' ? '下降' : '稳定') : '--'}
        </span>
        <span>置信度 {(conf * 100).toFixed(0)}%</span>
      </div>
      {interval && interval.length === 2 && (
        <div className='mt-3'>
          <div className='flex items-center justify-between text-[11px] text-gray-400 mb-1'>
            <span>95% 预测区间</span>
            <span>
              {interval[0].toFixed(1)} ~ {interval[1].toFixed(1)}
            </span>
          </div>
          <div className='relative h-2 rounded-full bg-gray-100 dark:bg-slate-700'>
            {(() => {
              const lo = Math.min(interval[0], interval[1], pred);
              const hi = Math.max(interval[0], interval[1], pred);
              const span = hi - lo || 1;
              const bandL = ((Math.min(interval[0], interval[1]) - lo) / span) * 100;
              const bandW = (Math.abs(interval[1] - interval[0]) / span) * 100;
              const dotL = ((pred - lo) / span) * 100;
              return (
                <>
                  <div
                    className='absolute top-0 h-2 rounded-full bg-blue-200 dark:bg-blue-500/30'
                    style={{ left: `${bandL}%`, width: `${bandW}%` }}
                  />
                  <div
                    className='absolute -top-0.5 h-3 w-3 rounded-full bg-blue-500 border-2 border-white dark:border-slate-800'
                    style={{ left: `calc(${dotL}% - 6px)` }}
                  />
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

const renderAnomalyCard = (label: string, a?: AnomalyResult): React.ReactElement => {
  // 数据缺失（接口未返回该维度）≠ 无异常：显示"数据缺失"而非 fail-open 的绿色"正常"
  const missing = !a;
  const noAnomaly = !missing && !a!.description && a!.score_change === 0 && a!.severity === 'low';
  const sev = a?.severity || 'low';
  const sevStyle = SEVERITY_COLORS[sev] || SEVERITY_COLORS.low;
  return (
    <div className='bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-slate-700'>
      <div className='flex items-center justify-between mb-2'>
        <span className='text-sm font-medium text-gray-800 dark:text-white'>{label}</span>
        {missing ? (
          <span className='px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'>
            数据缺失
          </span>
        ) : noAnomaly ? (
          <span className='px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-600 dark:bg-green-500/10'>
            正常
          </span>
        ) : (
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${sevStyle.light} ${sevStyle.text}`}
          >
            {sev === 'high' ? '高' : sev === 'medium' ? '中' : '低'}
          </span>
        )}
      </div>
      {missing ? (
        <p className='text-sm text-gray-400'>该维度暂无检测数据</p>
      ) : noAnomaly ? (
        <p className='text-sm text-gray-400'>未检测到异常</p>
      ) : (
        <div className='space-y-1'>
          <p className='text-sm text-gray-600 dark:text-slate-300'>{a!.description || '—'}</p>
          {a && a.score_change !== 0 && (
            <p
              className={`text-xs font-medium ${
                a.score_change > 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              积分变化 {a.score_change > 0 ? '+' : ''}
              {a.score_change.toFixed(1)}
            </p>
          )}
          {a?.detected_at && <p className='text-xs text-gray-400'>检测时间 {a.detected_at}</p>}
        </div>
      )}
    </div>
  );
};

export function StudentProfileTab({ deps }: { deps: AlgorithmAnalysisDeps }): React.ReactElement {
  const {
    students,
    selectedProfileUserId,
    setSelectedProfileUserId,
    studentProfile,
    setStudentProfile,
    loadStudentProfile,
    profileLoading,
    profileError,
  } = deps;

  const selectedStudent = students.find((s) => s.id === selectedProfileUserId) || null;

  return (
    <div className='space-y-6'>
      {/* 学生选择器 */}
      <div className='bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center gap-4'>
        <div className='flex items-center gap-2'>
          <UserCircle className='w-5 h-5 text-primary-500' />
          <span className='text-sm text-gray-700 dark:text-slate-300'>选择学生:</span>
        </div>
        <select
          value={selectedProfileUserId ?? ''}
          onChange={(e) => {
            const id = e.target.value ? parseInt(e.target.value, 10) : null;
            setSelectedProfileUserId(id);
            setStudentProfile(null);
            if (id !== null) loadStudentProfile(id);
          }}
          className='flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500'
        >
          <option value=''>请选择学生...</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.class_name ? `（${s.class_name}）` : ''}
            </option>
          ))}
        </select>
      </div>

      {profileError && (
        <div className='bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg p-4 text-red-600 dark:text-red-400'>
          {profileError}
        </div>
      )}

      {!selectedProfileUserId && (
        <div className='text-center py-12 text-gray-500 dark:text-slate-400'>
          <UserCircle className='w-12 h-12 mx-auto mb-3 text-gray-400' />
          <p>请选择一名学生查看其算法画像</p>
          <p className='text-sm mt-1'>集成预测 / 成绩 / 风险 / 异常检测四大单用户算法</p>
        </div>
      )}

      {profileLoading && selectedProfileUserId && (
        <div className='text-center py-12 text-gray-500 dark:text-slate-400'>
          <Loader2 className='w-8 h-8 mx-auto mb-3 animate-spin text-primary-500' />
          <p>加载学生画像中...</p>
        </div>
      )}

      {selectedStudent && studentProfile && !profileLoading && (
        <div className='space-y-6'>
          {/* 标题 */}
          <div className='flex items-center gap-3'>
            <UserCircle className='w-8 h-8 text-primary-500' />
            <div>
              <h3 className='text-xl font-bold text-gray-800 dark:text-white'>
                {selectedStudent.name}
              </h3>
              <p className='text-sm text-gray-500 dark:text-slate-400'>
                {selectedStudent.class_name || '未分配班级'}
              </p>
            </div>
          </div>

          {/* 积分预测 + 成绩预测 */}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            {renderScoreCard(
              '积分预测',
              <TrendingUp className='w-4 h-4 text-blue-500' />,
              studentProfile.prediction?.current_score,
              studentProfile.prediction?.predicted_score,
              studentProfile.prediction?.trend,
              studentProfile.prediction?.confidence,
              studentProfile.prediction?.confidence_interval
            )}
            {renderScoreCard(
              '成绩预测',
              <BookOpen className='w-4 h-4 text-indigo-500' />,
              studentProfile.scorePredict?.current_score,
              studentProfile.scorePredict?.predicted_score,
              studentProfile.scorePredict?.trend,
              studentProfile.scorePredict?.confidence,
              studentProfile.scorePredict?.confidence_interval
            )}
          </div>

          {/* 风险评估 */}
          <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
            <h4 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-4'>
              <ShieldCheck className='w-5 h-5 text-red-500' />
              风险评估
            </h4>
            {studentProfile.riskPredict ? (
              <div className='space-y-4'>
                <div className='flex items-center gap-4'>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      studentProfile.riskPredict.risk_level === 'high'
                        ? 'bg-red-50 text-red-600 dark:bg-red-500/10'
                        : studentProfile.riskPredict.risk_level === 'medium'
                        ? 'bg-yellow-50 text-yellow-600 dark:bg-yellow-500/10'
                        : 'bg-blue-50 text-blue-600 dark:bg-blue-500/10'
                    }`}
                  >
                    {studentProfile.riskPredict.risk_level === 'high'
                      ? '高风险'
                      : studentProfile.riskPredict.risk_level === 'medium'
                      ? '中风险'
                      : '低风险'}
                  </span>
                  <span className='text-sm text-gray-500 dark:text-slate-400'>
                    风险分 {studentProfile.riskPredict.risk_score.toFixed(1)}
                  </span>
                </div>
                {studentProfile.riskPredict.sub_risks &&
                  studentProfile.riskPredict.sub_risks.length > 0 && (
                    <div>
                      <div className='text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>
                        多维风险分
                      </div>
                      <div className='space-y-2'>
                        {studentProfile.riskPredict.sub_risks.map((s) => {
                          const barColor =
                            s.level === 'high'
                              ? 'bg-red-500'
                              : s.level === 'medium'
                              ? 'bg-yellow-500'
                              : 'bg-blue-500';
                          const labelColor =
                            s.level === 'high'
                              ? 'text-red-600 dark:text-red-400'
                              : s.level === 'medium'
                              ? 'text-yellow-600 dark:text-yellow-400'
                              : 'text-blue-600 dark:text-blue-400';
                          const pct = Math.max(4, Math.min(100, Math.round(s.score * 100)));
                          return (
                            <div key={s.key}>
                              <div className='flex items-center justify-between text-xs mb-1'>
                                <span className='text-gray-600 dark:text-slate-300'>{s.name}</span>
                                <span className={`font-medium ${labelColor}`}>
                                  {s.level === 'high' ? '高' : s.level === 'medium' ? '中' : '低'}{' '}
                                  · {s.score.toFixed(2)}
                                </span>
                              </div>
                              <div className='h-2 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden'>
                                <div
                                  className={`h-full ${barColor}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                {studentProfile.riskPredict.contributing_factors.length > 0 && (
                  <div>
                    <div className='text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>
                      风险因子
                    </div>
                    <div className='flex flex-wrap gap-2'>
                      {studentProfile.riskPredict.contributing_factors.map((f, i) => (
                        <span
                          key={i}
                          className='px-2 py-1 rounded bg-gray-100 dark:bg-slate-700 text-xs text-gray-600 dark:text-slate-300'
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {studentProfile.riskPredict.recommended_actions.length > 0 && (
                  <div>
                    <div className='text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>
                      建议措施
                    </div>
                    <ul className='list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-slate-300'>
                      {studentProfile.riskPredict.recommended_actions.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className='text-sm text-gray-400'>暂无风险评估数据</p>
            )}
          </div>

          {/* 参与度指数 */}
          <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
            <h4 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-4'>
              <Activity className='w-5 h-5 text-emerald-500' />
              参与度指数
            </h4>
            {studentProfile.engagement ? (
              (() => {
                const eng: EngagementResult = studentProfile.engagement!;
                if (!eng.has_data) {
                  return (
                    <p className='text-sm text-gray-400'>{eng.description || '暂无参与度数据'}</p>
                  );
                }
                const comps: Array<{ label: string; rate: number | null }> = [
                  { label: '出勤率', rate: eng.components.attendance_rate },
                  { label: '作业提交率', rate: eng.components.homework_rate },
                  { label: '积分活跃度', rate: eng.components.activity_rate },
                ];
                return (
                  <div className='space-y-4'>
                    <div className='flex items-center gap-4 flex-wrap'>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          eng.level === 'high'
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10'
                            : eng.level === 'medium'
                            ? 'bg-yellow-50 text-yellow-600 dark:bg-yellow-500/10'
                            : 'bg-blue-50 text-blue-600 dark:bg-blue-500/10'
                        }`}
                      >
                        {eng.level === 'high'
                          ? '高参与度'
                          : eng.level === 'medium'
                          ? '中参与度'
                          : '低参与度'}
                      </span>
                      <span className='text-sm text-gray-500 dark:text-slate-400'>
                        参与度分 {eng.engagement_score.toFixed(1)}
                      </span>
                      {eng.components.leave_days > 0 && (
                        <span className='text-xs text-gray-400'>
                          近 {eng.days} 天请假 {eng.components.leave_days} 天
                        </span>
                      )}
                    </div>
                    <div className='space-y-2'>
                      {comps
                        .filter((c) => c.rate !== null)
                        .map((c) => {
                          const pct = Math.max(
                            2,
                            Math.min(100, Math.round((c.rate as number) * 100))
                          );
                          return (
                            <div key={c.label}>
                              <div className='flex items-center justify-between text-xs mb-1'>
                                <span className='text-gray-600 dark:text-slate-300'>{c.label}</span>
                                <span className='font-medium text-gray-600 dark:text-slate-300'>
                                  {Math.round((c.rate as number) * 100)}%
                                </span>
                              </div>
                              <div className='h-2 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden'>
                                <div
                                  className='h-full bg-emerald-500'
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                    {eng.description && (
                      <p className='text-xs text-gray-400'>{eng.description}</p>
                    )}
                  </div>
                );
              })()
            ) : (
              <p className='text-sm text-gray-400'>暂无参与度数据</p>
            )}
          </div>

          {/* 异常检测 */}
          <div>
            <h4 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-3'>
              <AlertCircle className='w-5 h-5 text-orange-500' />
              异常检测
            </h4>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              {renderAnomalyCard('综合异常', studentProfile.anomaly)}
              {renderAnomalyCard('突变检测', studentProfile.sudden)}
              {renderAnomalyCard('趋势异常', studentProfile.trend)}
              {renderAnomalyCard('群体偏离', studentProfile.group)}
            </div>
          </div>

          {/* 成绩波动归因 */}
          {(() => {
            const attr: ScoreAttributionResult | undefined = studentProfile.attribution;
            if (!attr || !attr.has_data) {
              return (
                <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
                  <h4 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-2'>
                    <LineChart className='w-5 h-5 text-purple-500' />
                    成绩波动归因
                  </h4>
                  <p className='text-sm text-gray-400'>{attr?.summary || '暂无归因数据'}</p>
                </div>
              );
            }
            const maxAbs = Math.max(1, ...attr.factors.map((f) => Math.abs(f.contribution)));
            return (
              <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
                <h4 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-4'>
                  <LineChart className='w-5 h-5 text-purple-500' />
                  成绩波动归因
                </h4>
                <p className='text-sm text-gray-600 dark:text-slate-300'>{attr.summary}</p>
                <div className='flex flex-wrap items-center gap-x-6 gap-y-2 text-sm mt-2'>
                  <span className='text-gray-500 dark:text-slate-400'>
                    前期{' '}
                    <b className='text-gray-800 dark:text-white'>{attr.score_before.toFixed(1)}</b>
                    {' → '}近期{' '}
                    <b className='text-gray-800 dark:text-white'>{attr.score_after.toFixed(1)}</b>
                  </span>
                  <span
                    className={`font-medium ${
                      attr.total_change >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    净变化 {attr.total_change >= 0 ? '+' : ''}
                    {attr.total_change.toFixed(1)}
                  </span>
                  <span className='text-gray-400'>置信度 {(attr.confidence * 100).toFixed(0)}%</span>
                </div>
                <div className='space-y-3 mt-4'>
                  {attr.factors.map((f) => {
                    const widthPct = Math.min(100, (Math.abs(f.contribution) / maxAbs) * 100);
                    const color =
                      f.direction === 'positive'
                        ? 'bg-green-500'
                        : f.direction === 'negative'
                        ? 'bg-red-500'
                        : 'bg-gray-400';
                    return (
                      <div key={f.key}>
                        <div className='flex items-center justify-between text-sm mb-1'>
                          <span className='font-medium text-gray-700 dark:text-slate-300'>
                            {f.name}
                          </span>
                          <span
                            className={`font-medium ${
                              f.direction === 'positive'
                                ? 'text-green-600'
                                : f.direction === 'negative'
                                ? 'text-red-600'
                                : 'text-gray-500'
                            }`}
                          >
                            {f.contribution >= 0 ? '+' : ''}
                            {f.contribution.toFixed(1)} 分
                          </span>
                        </div>
                        <div className='w-full bg-gray-200 dark:bg-slate-600 rounded-full h-2'>
                          <div
                            className={`${color} h-2 rounded-full`}
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                        {f.detail && <p className='text-xs text-gray-400 mt-1'>{f.detail}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
