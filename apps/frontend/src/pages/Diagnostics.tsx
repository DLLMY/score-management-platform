import logger from '../utils/logger';
/**
 * 系统诊断页面组件
 * 提供系统健康检查、性能监控和错误追踪功能
 */

import { useState, useEffect, useCallback } from 'react';
import { getAuthHeaders, parseEnvelopeSafe } from '../services/api';
import DiagnosticsView from './diagnostics/DiagnosticsView';
import type { HealthData, PerformanceData, ErrorData, SystemData } from './diagnostics/types';

// 主诊断页面组件（逻辑层）
const DiagnosticsPage = () => {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [errorData, setErrorData] = useState<ErrorData | null>(null);
  const [systemData, setSystemData] = useState<SystemData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<boolean>(false);

  const fetchHealthData = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/system/health', {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      // 5xx/错误信封：不检查 response.ok 会把错误数据渲染成"系统严重问题"
      if (!response.ok) throw new Error('HTTP ' + response.status);
      // 剥 APIResponse 信封: {success, code, message, data:{...}} → 真实数据
      const envelope = await response.json();
      // 统一信封解析（单一真相源：services/api.ts 的 parseEnvelopeSafe）；业务失败时返回 null 而非信封对象，避免假数据渲染
      const data = parseEnvelopeSafe<HealthData>(envelope);
      setHealthData(data);
      setLoadError(false);
    } catch (error) {
      logger.warn('Failed to fetch health data:', error);
      setLoadError(true);
    }
  }, []);

  const fetchPerformanceData = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/diagnostics/performance', {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const envelope = await response.json();
      const data = parseEnvelopeSafe<PerformanceData>(envelope);
      setPerformanceData(data);
      setLoadError(false);
    } catch (error) {
      logger.warn('Failed to fetch performance data:', error);
      setLoadError(true);
    }
  }, []);

  const fetchErrorData = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/diagnostics/errors', {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const envelope = await response.json();
      const data = parseEnvelopeSafe<ErrorData>(envelope);
      setErrorData(data);
      setLoadError(false);
    } catch (error) {
      logger.warn('Failed to fetch error data:', error);
      setLoadError(true);
    }
  }, []);

  const fetchSystemData = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/diagnostics/system', {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const envelope = await response.json();
      const data = parseEnvelopeSafe<SystemData>(envelope);
      setSystemData(data);
      setLoadError(false);
    } catch (error) {
      logger.warn('Failed to fetch system data:', error);
      setLoadError(true);
    }
  }, []);

  const refreshAll = useCallback(async (): Promise<void> => {
    setIsRefreshing(true);
    await Promise.all([
      fetchHealthData(),
      fetchPerformanceData(),
      fetchErrorData(),
      fetchSystemData(),
    ]);
    setIsRefreshing(false);
  }, [fetchHealthData, fetchPerformanceData, fetchErrorData, fetchSystemData]);

  useEffect(() => {
    refreshAll();

    const interval = setInterval(refreshAll, 30000);
    return () => clearInterval(interval);
  }, [refreshAll]);

  return (
    <DiagnosticsView
      healthData={healthData}
      performanceData={performanceData}
      errorData={errorData}
      systemData={systemData}
      isRefreshing={isRefreshing}
      loadError={loadError}
      refreshAll={refreshAll}
    />
  );
};

export default DiagnosticsPage;
