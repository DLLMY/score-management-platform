// T12-2 拆分（2026-09-12）：自 ScoreAnalysisSections.tsx 原样搬出，行为逐字节等价。
import React from 'react';
import { formatNumber } from '../../utils/format';
import type { SubjectStats } from './types';

export const renderScoreDistribution = (scores: number[]): React.ReactElement | null => {
  if (!scores || scores.length === 0) return null;

  const bins = [0, 60, 70, 80, 90, 101];
  const counts = [0, 0, 0, 0, 0];

  scores.forEach((score) => {
    for (let i = 0; i < bins.length - 1; i++) {
      if (score >= bins[i] && score < bins[i + 1]) {
        counts[i]++;
        break;
      }
    }
  });

  const maxCount = Math.max(...counts, 1);
  const labels = ['0-59', '60-69', '70-79', '80-89', '90-100'];
  const gradients = [
    'from-red-500 to-red-600',
    'from-amber-400 to-amber-500',
    'from-lime-500 to-lime-600',
    'from-emerald-500 to-emerald-600',
    'from-cyan-500 to-cyan-600',
  ];

  return (
    <div className='flex items-end justify-around h-40 gap-2'>
      {counts.map((count, index) => {
        const height = maxCount > 0 ? `${(count / maxCount) * 100}%` : '0%';
        return (
          <div key={index} className='flex flex-col items-center flex-1'>
            <div className='text-xs font-medium text-gray-600 mb-1.5'>{count}</div>
            <div
              className={`w-full rounded-t-md bg-gradient-to-t ${gradients[index]} transition-all duration-700 hover:opacity-80 relative`}
              style={{
                height: height,
                minHeight: count > 0 ? '12px' : '0',
              }}
            >
              {count > 0 && <div className='absolute inset-0 rounded-t-md bg-white/20' />}
            </div>
            <div className='text-xs text-gray-500 mt-1.5'>{labels[index]}</div>
          </div>
        );
      })}
    </div>
  );
};

export const renderSubjectBarChart = (
  stats: Record<string, SubjectStats>
): React.ReactElement | null => {
  if (!stats) return null;

  const subjects = Object.keys(stats);
  const maxAvg =
    subjects.length > 0 ? Math.max(...subjects.map((s) => stats[s].average || 0), 1) : 100;

  const barColors = [
    'from-blue-500 to-blue-600',
    'from-purple-500 to-purple-600',
    'from-pink-500 to-pink-600',
    'from-green-500 to-green-600',
    'from-amber-500 to-amber-600',
    'from-cyan-500 to-cyan-600',
    'from-orange-500 to-orange-600',
    'from-indigo-500 to-indigo-600',
  ];

  return (
    <div className='flex items-end justify-around h-36 gap-2'>
      {subjects.map((subject, index) => {
        const avg = stats[subject].average || 0;
        const height = maxAvg > 0 ? `${(avg / maxAvg) * 100}%` : '0%';
        const colorIndex = index % barColors.length;

        return (
          <div key={subject} className='flex flex-col items-center flex-1'>
            <div className={`text-sm font-bold text-gray-700 mb-1.5`}>{formatNumber(avg, 1)}</div>
            <div
              className={`w-full rounded-t-md bg-gradient-to-t ${barColors[colorIndex]} transition-all duration-700 hover:opacity-80 relative shadow-sm`}
              style={{
                height: height,
                minHeight: avg > 0 ? '10px' : '0',
              }}
            >
              {avg > 0 && <div className='absolute inset-0 rounded-t-md bg-white/20' />}
            </div>
            <div className='text-xs text-gray-500 mt-1.5 truncate max-w-full px-1'>{subject}</div>
          </div>
        );
      })}
    </div>
  );
};
