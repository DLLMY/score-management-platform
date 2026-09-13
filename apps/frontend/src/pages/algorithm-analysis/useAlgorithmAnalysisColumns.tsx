import { useMemo } from 'react';
import type { ColumnType } from '../../components';
import type {
  PredictionResult,
  ScorePredictResult,
  EngagementStudentRank,
  BatchAttributionStudent,
} from '../../types';
import { ANALYSIS_CONFIG } from './constants';
import { getTrendIcon, getTrendColor, engagementLevelBadge, topFactors } from './helpers';
import type { AlgorithmAnalysisDeps } from './types';

export interface AlgorithmAnalysisColumns {
  predictionDetailColumns: ColumnType<PredictionResult>[];
  scorePredictColumns: ColumnType<ScorePredictResult>[];
  attributionColumns: ColumnType<BatchAttributionStudent>[];
  engagementColumns: ColumnType<EngagementStudentRank>[];
}

/**
 * 从主壳外提的 4 个列定义 useMemo（predictionDetail / scorePredict / attribution / engagement）。
 * 函数体逐字原搬自 AlgorithmAnalysisShell.tsx，deps 与原闭包完全一致（engagement 依赖 setEngagementTrendUserId）。
 */
export function useAlgorithmAnalysisColumns(
  setEngagementTrendUserId: AlgorithmAnalysisDeps['setEngagementTrendUserId']
): AlgorithmAnalysisColumns {
  // 积分预测详情列
  const predictionDetailColumns = useMemo<ColumnType<PredictionResult>[]>(
    () => [
      {
        title: '学生',
        key: 'name',
        dataIndex: 'name',
        render: (value) => (
          <div className='font-medium text-gray-800 dark:text-white'>
            {String(value ?? '') || '未知学生'}
          </div>
        ),
      },
      {
        title: '当前积分',
        key: 'current_score',
        dataIndex: 'current_score',
        render: (value) => {
          const current = typeof value === 'number' ? value : 0;
          return (
            <span className='font-medium text-gray-800 dark:text-white'>{current.toFixed(1)}</span>
          );
        },
      },
      {
        title: '趋势',
        key: 'trend',
        dataIndex: 'trend',
        render: (value) => {
          const hasTrend = !!value;
          const trend = String(value || 'stable');
          return (
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getTrendColor(
                trend
              )}`}
            >
              {getTrendIcon(trend)}
              {hasTrend ? (trend === 'up' ? '上升' : trend === 'down' ? '下降' : '稳定') : '--'}
            </span>
          );
        },
      },
      {
        title: '预测变化',
        key: 'predicted_change',
        render: (_, item) => {
          const current = typeof item.current_score === 'number' ? item.current_score : 0;
          const predicted =
            typeof item.predicted_score === 'number' ? item.predicted_score : current;
          const diff = predicted - current;
          return (
            <span
              className={`font-medium ${
                diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-gray-600'
              }`}
            >
              {diff.toFixed(1)}分
            </span>
          );
        },
      },
      {
        title: '置信度',
        key: 'confidence',
        dataIndex: 'confidence',
        render: (value) => {
          const confidence = typeof value === 'number' ? value : 0;
          return (
            <div>
              <div className='w-20 bg-gray-200 dark:bg-slate-600 rounded-full h-2'>
                <div
                  className='bg-blue-500 h-2 rounded-full'
                  style={{ width: `${confidence * 100}%` }}
                />
              </div>
              <div className='text-xs text-gray-400 mt-1'>{(confidence * 100).toFixed(0)}%</div>
            </div>
          );
        },
      },
    ],
    []
  );

  // 学生成绩预测详情列
  const scorePredictColumns = useMemo<ColumnType<ScorePredictResult>[]>(
    () => [
      {
        title: '学生',
        key: 'name',
        dataIndex: 'name',
        render: (value) => (
          <div className='font-medium text-gray-800 dark:text-white'>{String(value ?? '')}</div>
        ),
      },
      {
        title: '科目',
        key: 'subject',
        dataIndex: 'subject',
        render: (value) => (
          <div className='font-medium text-gray-800 dark:text-white'>
            {String(value ?? '') || '综合'}
          </div>
        ),
      },
      {
        title: '当前分数',
        key: 'current_score',
        dataIndex: 'current_score',
        render: (value) => {
          const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
          return <span className='text-lg font-medium text-gray-600'>{n.toFixed(1)}</span>;
        },
      },
      {
        title: '预测分数',
        key: 'predicted_score',
        dataIndex: 'predicted_score',
        render: (value) => {
          const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
          return (
            <span
              className={`text-xl font-bold ${
                n >= ANALYSIS_CONFIG.scoreColorThresholds.excellent
                  ? 'text-green-600'
                  : n >= ANALYSIS_CONFIG.scoreColorThresholds.good
                  ? 'text-blue-600'
                  : 'text-red-600'
              }`}
            >
              {n.toFixed(1)}
            </span>
          );
        },
      },
      {
        title: '趋势',
        key: 'trend',
        dataIndex: 'trend',
        render: (value) => {
          const t: 'up' | 'down' | 'stable' = value === 'up' || value === 'down' ? value : 'stable';
          return (
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getTrendColor(
                t
              )}`}
            >
              {getTrendIcon(t)}
              {t === 'up' ? '上升' : t === 'down' ? '下降' : '稳定'}
            </span>
          );
        },
      },
      {
        title: '置信度',
        key: 'confidence',
        dataIndex: 'confidence',
        render: (value) => {
          const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
          return (
            <div>
              <div className='w-16 bg-gray-200 dark:bg-slate-600 rounded-full h-2'>
                <div className='bg-blue-500 h-2 rounded-full' style={{ width: `${n * 100}%` }} />
              </div>
              <div className='text-xs text-gray-400 mt-1'>{(n * 100).toFixed(0)}%</div>
            </div>
          );
        },
      },
    ],
    []
  );

  // 全班成绩波动归因列
  const attributionColumns = useMemo<ColumnType<BatchAttributionStudent>[]>(
    () => [
      {
        title: '学生',
        key: 'name',
        dataIndex: 'name',
        render: (_, s) => (
          <div>
            <div className='font-medium text-gray-800 dark:text-white'>{s.name}</div>
            {s.error && <div className='text-xs text-red-500'>{s.error}</div>}
          </div>
        ),
      },
      {
        title: '成绩变化',
        key: 'total_change',
        dataIndex: 'total_change',
        render: (_, s) =>
          s.has_data ? (
            <span
              className={`font-medium ${
                (s.total_change || 0) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {(s.total_change || 0) >= 0 ? '+' : ''}
              {(s.total_change || 0).toFixed(1)}
            </span>
          ) : (
            <span className='text-gray-400'>—</span>
          ),
      },
      {
        title: '主要归因',
        key: 'factors',
        render: (_, s) => (
          <span className='text-gray-600 dark:text-slate-300'>
            {s.has_data ? topFactors(s) : '数据不足'}
          </span>
        ),
      },
      {
        title: '置信度',
        key: 'confidence',
        dataIndex: 'confidence',
        render: (_, s) =>
          s.has_data ? (
            <div className='w-20 bg-gray-200 dark:bg-slate-600 rounded-full h-2'>
              <div
                className='bg-purple-500 h-2 rounded-full'
                style={{ width: `${Math.min(100, (s.confidence || 0) * 100)}%` }}
              />
            </div>
          ) : (
            <span className='text-gray-400'>—</span>
          ),
      },
      {
        title: '状态',
        key: 'has_data',
        render: (_, s) => (
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              s.has_data
                ? 'bg-green-100 dark:bg-green-500/20 text-green-600'
                : 'bg-gray-100 dark:bg-gray-500/20 text-gray-500'
            }`}
          >
            {s.has_data ? '已归因' : '缺数据'}
          </span>
        ),
      },
    ],
    []
  );

  // 全班参与度排名榜列
  const engagementColumns = useMemo<ColumnType<EngagementStudentRank>[]>(
    () => [
      {
        title: '排名',
        key: 'rank',
        dataIndex: 'rank',
        render: (_, s) => (
          <span
            className={`font-bold ${s.rank && s.rank <= 3 ? 'text-purple-600' : 'text-gray-500'}`}
          >
            {s.rank ? `#${s.rank}` : '—'}
          </span>
        ),
      },
      {
        title: '学生',
        key: 'name',
        dataIndex: 'name',
        render: (_, s) => (
          <div>
            <div className='font-medium text-gray-800 dark:text-white'>{s.name}</div>
            {s.error && <div className='text-xs text-red-500'>{s.error}</div>}
          </div>
        ),
      },
      {
        title: '参与度',
        key: 'engagement_score',
        dataIndex: 'engagement_score',
        render: (_, s) =>
          s.has_data ? (
            <span
              className={`font-medium ${
                (s.engagement_score || 0) >= ANALYSIS_CONFIG.engagementScoreThresholds.high
                  ? 'text-green-600'
                  : (s.engagement_score || 0) >= ANALYSIS_CONFIG.engagementScoreThresholds.medium
                  ? 'text-yellow-600'
                  : 'text-red-600'
              }`}
            >
              {(s.engagement_score || 0).toFixed(1)}
            </span>
          ) : (
            <span className='text-gray-400'>—</span>
          ),
      },
      {
        title: '等级',
        key: 'level',
        dataIndex: 'level',
        render: (_, s) => (
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${engagementLevelBadge(
              s.level
            )}`}
          >
            {s.level === 'high' ? '高' : s.level === 'medium' ? '中' : '低'}
          </span>
        ),
      },
      {
        title: '出勤率',
        key: 'attendance_rate',
        render: (_, s) => (
          <span className='text-gray-600 dark:text-slate-300'>
            {s.components?.attendance_rate != null
              ? `${(s.components.attendance_rate * 100).toFixed(0)}%`
              : '—'}
          </span>
        ),
      },
      {
        title: '作业率',
        key: 'homework_rate',
        render: (_, s) => (
          <span className='text-gray-600 dark:text-slate-300'>
            {s.components?.homework_rate != null
              ? `${(s.components.homework_rate * 100).toFixed(0)}%`
              : '—'}
          </span>
        ),
      },
      {
        title: '活跃度',
        key: 'activity_rate',
        render: (_, s) => (
          <span className='text-gray-600 dark:text-slate-300'>
            {s.components?.activity_rate != null
              ? `${(s.components.activity_rate * 100).toFixed(0)}%`
              : '—'}
          </span>
        ),
      },
      {
        title: '请假(天)',
        key: 'leave_days',
        render: (_, s) => (
          <span className='text-gray-600 dark:text-slate-300'>{s.components?.leave_days ?? 0}</span>
        ),
      },
      {
        title: '周趋势',
        key: 'trend_action',
        width: 90,
        render: (_, s) => (
          <button
            type='button'
            disabled={!s.has_data}
            onClick={(e) => {
              e.stopPropagation();
              setEngagementTrendUserId(s.user_id);
            }}
            className={`text-xs px-2 py-1 rounded ${
              s.has_data
                ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 hover:bg-purple-200'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            查看
          </button>
        ),
      },
    ],
    [setEngagementTrendUserId]
  );

  return {
    predictionDetailColumns,
    scorePredictColumns,
    attributionColumns,
    engagementColumns,
  };
}
