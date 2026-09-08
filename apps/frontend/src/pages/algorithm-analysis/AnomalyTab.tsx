import React from 'react';
import { Activity, AlertCircle, CheckCircle } from 'lucide-react';
import type { AlgorithmAnalysisDeps } from './types';
import { SEVERITY_COLORS } from './constants';

export function AnomalyTab({ deps }: { deps: AlgorithmAnalysisDeps }): React.ReactElement {
  const { anomalyData, searchKeyword } = deps;

  if (!anomalyData) {
    return (
      <div className='text-center py-12 text-gray-500 dark:text-slate-400'>
        <Activity className='w-12 h-12 mx-auto mb-3 text-gray-400' />
        <p>暂无异常检测数据</p>
        <p className='text-sm mt-1'>请确保已有足够的积分记录数据</p>
      </div>
    );
  }

  const { summary, anomalies } = anomalyData;
  const safeSummary = summary || {
    total_anomalies: 0,
    high_severity_count: 0,
    medium_severity_count: 0,
    low_severity_count: 0,
  };
  const safeList = Array.isArray(anomalies) ? anomalies : [];
  const filteredAnomalies = searchKeyword
    ? safeList.filter((a) => (a?.name ?? '').toLowerCase().includes(searchKeyword.toLowerCase()))
    : safeList;

  return (
    <div className='space-y-6'>
      {/* 异常统计 */}
      <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
        <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
          <div className='text-sm text-gray-500 dark:text-slate-400'>异常总数</div>
          <div className='text-3xl font-bold text-red-600 mt-1'>
            {safeSummary.total_anomalies ?? 0}
          </div>
        </div>
        <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
          <div className='text-sm text-gray-500 dark:text-slate-400'>高严重度</div>
          <div className='text-3xl font-bold text-red-600 mt-1'>
            {safeSummary.high_severity_count ?? 0}
          </div>
        </div>
        <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
          <div className='text-sm text-gray-500 dark:text-slate-400'>中严重度</div>
          <div className='text-3xl font-bold text-yellow-600 mt-1'>
            {safeSummary.medium_severity_count ?? 0}
          </div>
        </div>
        <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
          <div className='text-sm text-gray-500 dark:text-slate-400'>低严重度</div>
          <div className='text-3xl font-bold text-green-600 mt-1'>
            {safeSummary.low_severity_count ?? 0}
          </div>
        </div>
      </div>

      {/* 异常列表 */}
      <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
        <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
          <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
            <AlertCircle className='w-5 h-5 text-red-500' />
            异常记录列表
          </h3>
        </div>
        <div className='p-6'>
          {filteredAnomalies.length === 0 ? (
            <div className='text-center py-12 text-gray-500 dark:text-slate-400'>
              <CheckCircle className='w-12 h-12 mx-auto mb-3 text-green-500' />
              <p>{searchKeyword ? '未找到匹配的记录' : '未检测到异常'}</p>
            </div>
          ) : (
            <div className='space-y-4'>
              {filteredAnomalies.map((anomaly, idx) => {
                const aName = anomaly?.name ?? '未知学生';
                const aType = anomaly?.anomaly_type ?? '异常';
                const aSev = (anomaly?.severity ?? 'low') as 'high' | 'medium' | 'low';
                const aColor = SEVERITY_COLORS[aSev] || { bg: '', text: '', light: '' };
                const aDesc = anomaly?.description ?? '';
                const aScoreNum =
                  typeof anomaly?.score_change === 'number' &&
                  Number.isFinite(anomaly.score_change)
                    ? anomaly.score_change
                    : 0;
                const aDetected = anomaly?.detected_at ?? '';
                return (
                  <div
                    key={`${aName}-${idx}`}
                    className='p-4 bg-red-50/50 dark:bg-red-500/5 rounded-lg border border-red-200/50 dark:border-red-500/20'
                  >
                    <div className='flex items-center justify-between mb-3'>
                      <div className='flex items-center gap-3'>
                        <div className='w-8 h-8 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center'>
                          <AlertCircle className='w-4 h-4 text-red-600' />
                        </div>
                        <div>
                          <div className='font-medium text-gray-800 dark:text-white'>{aName}</div>
                          <div className='text-sm text-gray-500 dark:text-slate-400'>{aType}</div>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          aColor.light ?? ''
                        } ${aColor.text ?? ''}`}
                      >
                        {aSev === 'high'
                          ? '高严重度'
                          : aSev === 'medium'
                          ? '中严重度'
                          : '低严重度'}
                      </span>
                    </div>

                    <div className='text-sm text-gray-600 dark:text-slate-300 mb-2'>{aDesc}</div>
                    <div className='flex items-center gap-4 text-xs text-gray-400'>
                      <span>
                        积分变化: {aScoreNum > 0 ? '+' : ''}
                        {aScoreNum}
                      </span>
                      <span>检测时间: {aDetected}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
