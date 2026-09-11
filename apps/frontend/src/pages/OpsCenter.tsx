/**
 * 运维中心 - 聚合仪表盘
 * 聚合系统健康、资源/API 性能、MQTT 连接、设备概览、系统统计与最近操作日志，
 * 为管理员/运维角色提供一站式运维总览。纯前端聚合，零后端改动（复用现有 /api/system/*、/api/mqtt/* 等端点）。
 */

import React, { useState, useEffect, useCallback } from 'react';
import { fetchJson } from '../hooks';
import OpsCenterView, {
  type HealthData,
  type PerformanceData,
  type MqttStatus,
  type DeviceStats,
  type SystemStats,
  type OperationLog,
} from './opsCenter/OpsCenterView';

// 通用 fetch 封装已收敛至 src/hooks/useApiFetch.ts（fetchJson<T>），本页不再保留抄本。

export const OpsCenter: React.FC = () => {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [perf, setPerf] = useState<PerformanceData | null>(null);
  const [mqtt, setMqtt] = useState<MqttStatus | null>(null);
  const [deviceStats, setDeviceStats] = useState<DeviceStats | null>(null);
  const [sysStats, setSysStats] = useState<SystemStats | null>(null);
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [partialError, setPartialError] = useState(false);

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    const results = await Promise.all([
      fetchJson<HealthData>('/api/system/health'),
      fetchJson<PerformanceData>('/api/system/performance'),
      fetchJson<MqttStatus>('/api/mqtt/status'),
      fetchJson<DeviceStats>('/api/devices/stats'),
      fetchJson<SystemStats>('/api/system/stats'),
      (async () => {
        const payload = await fetchJson<OperationLog[] | { items?: OperationLog[] }>(
          '/api/operation-logs?page=1&per_page=8'
        );
        if (!payload) return [];
        const items = Array.isArray(payload) ? payload : payload.items ?? [];
        return items;
      })(),
    ]);
    const [h, p, m, ds, ss, ol] = results;
    setHealth(h);
    setPerf(p);
    setMqtt(m);
    setDeviceStats(ds);
    setSysStats(ss);
    setLogs(ol || []);
    setPartialError(results.some((r) => r === null));
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, 30000);
    return () => clearInterval(interval);
  }, [refreshAll]);

  return (
    <OpsCenterView
      health={health}
      perf={perf}
      mqtt={mqtt}
      deviceStats={deviceStats}
      sysStats={sysStats}
      logs={logs}
      isRefreshing={isRefreshing}
      partialError={partialError}
      onRefresh={refreshAll}
    />
  );
};

export default OpsCenter;
