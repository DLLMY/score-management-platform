/**
 * 仪表盘视图层（纯展示 + 列/卡片渲染）。
 * T12-10a 拆分（2026-09-12）：原 DashboardView.tsx 中的 5 个 memo 组件、4 个纯函数/常量 helper、
 * DashboardViewProps 接口已外提至 ./components、./helpers、./constants、./types；本文件仅保留主壳 JSX。
 */
import type { DashboardState } from './useDashboardLogic';
import type { User } from '../../types';

export interface DashboardViewProps {
  state: DashboardState;
  selectedClass: string;
  setSelectedClass: (value: string) => void;
  classes: string[];
  isConnected: boolean;
  handleRefresh: () => void;
  dashboardError: boolean;
  filteredUsers: User[];
  classGroups: Array<{ class_name: string; students: User[] }>;
}
