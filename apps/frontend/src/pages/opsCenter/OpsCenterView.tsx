// T12-1 拆分（2026-09-12）：原 618 行巨型 View 已按区块拆至 ./components，
// 类型定义迁至 ./types。本文件退化为**布局编排**（只做结构拼装与 props 透传）。
//
// 本文件同时继续作为类型出口：../../OpsCenter 从本文件导入 6 个类型，路径零改动。
import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { PermissionButton } from '../../components';
import {
  MqttDeviceSection,
  OperationLogsSection,
  OverallHealthBanner,
  PerformanceSection,
  SystemHealthSection,
  SystemStatsSection,
} from './components';
import type {
  DeviceStats,
  HealthData,
  MqttStatus,
  OperationLog,
  PerformanceData,
  SystemStats,
} from './types';

export type { DeviceStats, HealthData, MqttStatus, OperationLog, PerformanceData, SystemStats };

interface OpsCenterViewProps {
  health: HealthData | null;
  perf: PerformanceData | null;
  mqtt: MqttStatus | null;
  deviceStats: DeviceStats | null;
  sysStats: SystemStats | null;
  logs: OperationLog[];
  isRefreshing: boolean;
  partialError: boolean;
  onRefresh: () => void;
}

const OpsCenterView: React.FC<OpsCenterViewProps> = ({
  health,
  perf,
  mqtt,
  deviceStats,
  sysStats,
  logs,
  isRefreshing,
  partialError,
  onRefresh,
}) => {
  return (
    <div className='space-y-6'>
      {/* 头部 */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-xl font-bold text-gray-800 dark:text-slate-100'>运维中心</h1>
          <p className='text-sm text-gray-500 dark:text-slate-400 mt-1'>
            系统健康、性能、连接与日志一站式总览
          </p>
        </div>
        <PermissionButton
          permission='ops_center.view'
          onClick={onRefresh}
          disabled={isRefreshing}
          className='flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50'
        >
          <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          刷新
        </PermissionButton>
      </div>

      {/* M9: 首次加载反馈 */}
      {isRefreshing && health === null && (
        <div className='animate-pulse text-sm text-gray-400 dark:text-slate-400 flex items-center gap-2'>
          <RefreshCw size={14} className='animate-spin' />
          正在加载系统状态...
        </div>
      )}

      {partialError && (
        <div
          role='alert'
          className='flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300'
        >
          <AlertTriangle size={16} className='flex-shrink-0' />
          <span>部分运维数据加载失败，下方指标可能不完整</span>
          <button
            type='button'
            onClick={onRefresh}
            className='ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 text-white text-xs hover:bg-amber-700 transition-colors'
          >
            <RefreshCw size={14} />
            重试
          </button>
        </div>
      )}

      {/* 整体健康 */}
      <OverallHealthBanner health={health} />

      {/* 系统健康组件 */}
      <SystemHealthSection health={health} />

      {/* 资源性能 + API 性能 */}
      <PerformanceSection perf={perf} />

      {/* MQTT + 设备概览 */}
      <MqttDeviceSection mqtt={mqtt} deviceStats={deviceStats} />

      {/* 系统统计 */}
      <SystemStatsSection sysStats={sysStats} />

      {/* 最近操作日志 */}
      <OperationLogsSection logs={logs} />
    </div>
  );
};

export default OpsCenterView;
