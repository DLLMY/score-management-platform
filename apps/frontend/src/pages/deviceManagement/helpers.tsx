import { XCircle, AlertTriangle, CheckCircle } from 'lucide-react';

export const getSystemStateText = (state: number | undefined): string => {
  const states: Record<number, string> = {
    0: '空闲',
    1: 'A箱解锁中',
    2: 'B箱解锁中',
    3: '错误',
    4: '显示卡号',
  };
  return states[state || 0] || `未知(${state})`;
};

/** 信号强度档位（与 signalDistribution 的四个计数字段一一对应） */
export type SignalLevel = 'excellent' | 'good' | 'fair' | 'poor';

export const getSignalStrength = (
  signal: number | null
): { text: string; color: string; level: SignalLevel } => {
  if (!signal) return { text: '-', color: 'bg-gray-500', level: 'poor' };
  if (signal >= -50) return { text: '强', color: 'bg-green-500', level: 'excellent' };
  if (signal >= -70) return { text: '中', color: 'bg-yellow-500', level: 'good' };
  return { text: '弱', color: 'bg-red-500', level: 'fair' };
};

export const getSeverityIcon = (severity: string) => {
  switch (severity) {
    case 'critical':
      return <XCircle className='w-4 h-4 text-purple-600' />;
    case 'error':
      return <AlertTriangle className='w-4 h-4 text-red-600' />;
    case 'warning':
      return <AlertTriangle className='w-4 h-4 text-yellow-600' />;
    default:
      return <CheckCircle className='w-4 h-4 text-blue-600' />;
  }
};
