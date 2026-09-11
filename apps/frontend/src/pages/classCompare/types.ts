import type { ClassInfo } from '../../services/api';

export interface ClassColor {
  bg: string;
  text: string;
  border: string;
  light: string;
}
export type Period = '7d' | '30d' | '90d';

export interface ClassCompareData {
  class_name: string;
  student_count: number;
  total_score: number;
  avg_score: number;
  max_score: number;
  min_score: number;
  period_records: number;
  period_total_change: number;
  period_total_add: number;
  period_total_subtract: number;
  period_active_students: number;
  unlock_count: number;
  unlock_cost: number;
  avg_daily_records: number;
  daily_trend: { date: string; record_count: number; score_change: number }[];
  top_students: { id: number; name: string; current_score: number }[];
}

export const CLASS_COLORS: ClassColor[] = [
  { bg: 'bg-blue-500', text: 'text-blue-500', border: 'border-blue-500', light: 'bg-blue-50' },
  { bg: 'bg-green-500', text: 'text-green-500', border: 'border-green-500', light: 'bg-green-50' },
  {
    bg: 'bg-purple-500',
    text: 'text-purple-500',
    border: 'border-purple-500',
    light: 'bg-purple-50',
  },
  {
    bg: 'bg-orange-500',
    text: 'text-orange-500',
    border: 'border-orange-500',
    light: 'bg-orange-50',
  },
  { bg: 'bg-pink-500', text: 'text-pink-500', border: 'border-pink-500', light: 'bg-pink-50' },
  { bg: 'bg-cyan-500', text: 'text-cyan-500', border: 'border-cyan-500', light: 'bg-cyan-50' },
];

export interface ClassCompareViewProps {
  loadError: boolean;
  fetchCompareData: () => Promise<void>;
  isLoading: boolean;
  classes: ClassInfo[];
  toggleClass: (className: string) => void;
  selectedClasses: string[];
  period: Period;
  setPeriod: (p: Period) => void;
  compareData: ClassCompareData[];
  getClassColor: (index: number) => ClassColor;
  barChartData: Array<Record<string, number | string>>;
  lineChartData: Array<Record<string, number | string>>;
}
