import logger from '../utils/logger';
/**
 * 系统诊断页面组件
 * 提供系统健康检查、性能监控和错误追踪功能
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Cpu,
  Database,
  Heart,
  HelpCircle,
  MemoryStick,
  Network,
  RefreshCw,
  Server,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react';
import { PermissionButton } from '../components';
import { getAuthHeaders } from '../services/api';

// 健康检查接口
interface HealthCheck {
  name: string;
  status: HealthStatusType;
  message?: string;
}

type HealthStatusType = 'healthy' | 'degraded' | 'unhealthy' | 'warning' | 'critical' | 'unknown';

// 健康数据接口
interface HealthData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  components?: {
    database?: { status: string; message?: string };
    redis?: { status: string; message?: string };
    mqtt?: { status: string; message?: string };
    cpu?: { status: string; message?: string };
    memory?: { status: string; message?: string };
    disk?: { status: string; message?: string };
  };
}

// 性能数据接口
interface PerformanceData {
  total_requests: number;
  avg_duration: number;
  slow_request_count: number;
  total_time: number;
  slow_requests: SlowRequest[];
}

// 慢请求接口
interface SlowRequest {
  timestamp: string;
  method: string;
  endpoint: string;
  status_code: number;
  duration: number;
}

// 错误数据接口
interface ErrorData {
  recent_errors: SystemError[];
}

// 系统错误接口
interface SystemError {
  type: string;
  message: string;
  timestamp: string;
  traceback?: string;
}

// 系统数据接口
interface SystemData {
  system: SystemInfo;
  process: ProcessInfo;
}

// 系统信息接口
interface SystemInfo {
  platform: string;
  platform_version: string;
  python_version: string;
  cpu_count: number;
}

// 进程信息接口
interface ProcessInfo {
  pid: number;
  status: string;
  threads: number;
  create_time?: string;
}

// 指标卡片属性接口
interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  trend?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  color?: 'blue' | 'green' | 'orange' | 'purple';
}

// 健康状态指示器组件
const HealthStatus: React.FC<{
  status: string;
  message?: string;
}> = ({ status, message }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
    healthy: { color: 'bg-green-100 text-green-600', icon: CheckCircle, label: '健康' },
    degraded: { color: 'bg-yellow-100 text-yellow-600', icon: AlertTriangle, label: '降级' },
    unhealthy: { color: 'bg-red-100 text-red-600', icon: XCircle, label: '异常' },
    warning: { color: 'bg-orange-100 text-orange-600', icon: AlertTriangle, label: '警告' },
    critical: { color: 'bg-red-100 text-red-600', icon: XCircle, label: '严重' },
    unknown: { color: 'bg-gray-100 text-gray-600', icon: HelpCircle, label: '未知' },
  };

  const config = statusConfig[status] || statusConfig.unknown;
  const StatusIcon = config.icon;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${config.color}`}
    >
      <StatusIcon size={16} />
      <span>{config.label}</span>
      {message && <span className='text-xs opacity-75'>| {message}</span>}
    </div>
  );
};

// 健康检查卡片组件
const HealthCard: React.FC<{
  title: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  checks: HealthCheck[];
}> = ({ title, icon: Icon, checks }) => {
  const hasIssues = checks.some((c) => c.status !== 'healthy');

  return (
    <div
      className={`bg-white rounded-xl p-4 border transition-all ${
        hasIssues ? 'border-red-100 shadow-sm' : 'border-gray-100'
      }`}
    >
      <div className='flex items-center gap-3 mb-3'>
        <div className={`p-2 rounded-lg ${hasIssues ? 'bg-red-50' : 'bg-blue-50'}`}>
          <Icon size={20} className={hasIssues ? 'text-red-500' : 'text-blue-500'} />
        </div>
        <h3 className='font-semibold text-gray-800'>{title}</h3>
      </div>

      <div className='space-y-2'>
        {checks.map((check, index) => (
          <div key={index} className='flex items-center justify-between'>
            <span className='text-sm text-gray-600'>{check.name}</span>
            <HealthStatus status={check.status} message={check.message} />
          </div>
        ))}
      </div>
    </div>
  );
};

// 性能指标卡片组件
const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  trend,
  icon: Icon,
  color = 'blue',
}) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  const TrendIcon = trend !== undefined && trend >= 0 ? TrendingUp : TrendingDown;
  const trendColor = trend !== undefined && trend >= 0 ? 'text-green-500' : 'text-red-500';

  return (
    <div className='bg-white rounded-xl p-4 border border-gray-100'>
      <div className='flex items-center justify-between mb-2'>
        <span className='text-sm text-gray-500'>{title}</span>
        <div className={`p-1.5 rounded-lg ${colorClasses[color]}`}>
          <Icon size={16} />
        </div>
      </div>
      <div className='flex items-baseline gap-1'>
        <span className='text-2xl font-bold text-gray-800'>{value}</span>
        {unit && <span className='text-sm text-gray-500'>{unit}</span>}
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-1 text-xs ${trendColor}`}>
          <TrendIcon size={12} />
          <span>{Math.abs(trend)}%</span>
        </div>
      )}
    </div>
  );
};

// 慢请求表格组件
const SlowRequestsTable: React.FC<{ requests: SlowRequest[] }> = ({ requests }) => {
  return (
    <div className='bg-white rounded-xl border border-gray-100 overflow-hidden'>
      <div className='px-4 py-3 border-b border-gray-100 bg-gray-50'>
        <h3 className='font-semibold text-gray-800 flex items-center gap-2'>
          <Clock size={16} />
          慢请求记录
        </h3>
      </div>
      <div className='overflow-x-auto'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='bg-gray-50'>
              <th className='px-4 py-2 text-left font-medium text-gray-600'>时间</th>
              <th className='px-4 py-2 text-left font-medium text-gray-600'>方法</th>
              <th className='px-4 py-2 text-left font-medium text-gray-600'>端点</th>
              <th className='px-4 py-2 text-left font-medium text-gray-600'>状态</th>
              <th className='px-4 py-2 text-left font-medium text-gray-600'>耗时</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr>
                <td colSpan={5} className='px-4 py-8 text-center text-gray-500'>
                  暂无慢请求记录
                </td>
              </tr>
            ) : (
              requests.map((req, index) => (
                <tr key={index} className='border-t border-gray-50 hover:bg-gray-50'>
                  <td className='px-4 py-2 text-gray-600'>
                    {/* L1: timestamp 空/非法时避免渲染 Invalid Date */}
                    {req.timestamp ? new Date(req.timestamp).toLocaleTimeString() : '-'}
                  </td>
                  <td className='px-4 py-2'>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        req.method === 'GET'
                          ? 'bg-blue-100 text-blue-600'
                          : req.method === 'POST'
                          ? 'bg-green-100 text-green-600'
                          : req.method === 'PUT'
                          ? 'bg-yellow-100 text-yellow-600'
                          : 'bg-red-100 text-red-600'
                      }`}
                    >
                      {req.method}
                    </span>
                  </td>
                  <td className='px-4 py-2 text-gray-700'>{req.endpoint}</td>
                  <td className='px-4 py-2'>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        req.status_code >= 200 && req.status_code < 300
                          ? 'bg-green-100 text-green-600'
                          : req.status_code >= 400 && req.status_code < 500
                          ? 'bg-yellow-100 text-yellow-600'
                          : 'bg-red-100 text-red-600'
                      }`}
                    >
                      {req.status_code}
                    </span>
                  </td>
                  <td className='px-4 py-2'>
                    <span className='text-red-600 font-medium'>{req.duration.toFixed(2)}s</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// 错误列表组件
const ErrorList: React.FC<{ errors: SystemError[] }> = ({ errors }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  return (
    <div className='bg-white rounded-xl border border-gray-100 overflow-hidden'>
      <div className='px-4 py-3 border-b border-gray-100 bg-gray-50'>
        <h3 className='font-semibold text-gray-800 flex items-center gap-2'>
          <AlertTriangle size={16} className='text-red-500' />
          最近错误
          <span className='ml-auto text-sm font-normal text-gray-500'>{errors.length} 条</span>
        </h3>
      </div>
      <div className='divide-y divide-gray-100'>
        {errors.length === 0 ? (
          <div className='px-4 py-8 text-center text-gray-500'>暂无错误记录</div>
        ) : (
          errors.map((error, index) => (
            <div key={index} className='px-4 py-3 hover:bg-gray-50'>
              <div
                className='flex items-start gap-3 cursor-pointer'
                onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
              >
                <div className='p-1.5 bg-red-100 rounded-lg flex-shrink-0'>
                  <XCircle size={16} className='text-red-500' />
                </div>
                <div className='flex-1 min-w-0'>
                  <div className='flex items-center justify-between'>
                    <span className='font-medium text-gray-800'>{error.type}</span>
                    <span className='text-xs text-gray-500'>
                      {new Date(error.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className='text-sm text-gray-600 mt-1 truncate'>{error.message}</p>
                </div>
              </div>
              {expandedIndex === index && error.traceback && (
                <div className='mt-3 p-3 bg-gray-900 rounded-lg text-xs text-gray-300 font-mono overflow-x-auto'>
                  {error.traceback}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// 系统信息组件
const SystemInfoComponent: React.FC<{ system: SystemInfo; processInfo: ProcessInfo }> = ({
  system,
  processInfo,
}) => {
  return (
    <div className='grid grid-cols-2 gap-4'>
      <div className='bg-white rounded-xl p-4 border border-gray-100'>
        <h3 className='font-semibold text-gray-800 mb-3 flex items-center gap-2'>
          <Server size={16} className='text-blue-500' />
          系统信息
        </h3>
        <div className='space-y-2 text-sm'>
          <div className='flex justify-between'>
            <span className='text-gray-500'>平台</span>
            <span className='text-gray-800'>{system.platform}</span>
          </div>
          <div className='flex justify-between'>
            <span className='text-gray-500'>版本</span>
            <span className='text-gray-800'>{system.platform_version}</span>
          </div>
          <div className='flex justify-between'>
            <span className='text-gray-500'>Python</span>
            <span className='text-gray-800'>{system.python_version}</span>
          </div>
          <div className='flex justify-between'>
            <span className='text-gray-500'>CPU核心</span>
            <span className='text-gray-800'>{system.cpu_count}</span>
          </div>
        </div>
      </div>

      <div className='bg-white rounded-xl p-4 border border-gray-100'>
        <h3 className='font-semibold text-gray-800 mb-3 flex items-center gap-2'>
          <Activity size={16} className='text-green-500' />
          进程信息
        </h3>
        <div className='space-y-2 text-sm'>
          <div className='flex justify-between'>
            <span className='text-gray-500'>PID</span>
            <span className='text-gray-800'>{processInfo?.pid}</span>
          </div>
          <div className='flex justify-between'>
            <span className='text-gray-500'>状态</span>
            <span className='text-gray-800'>{processInfo?.status}</span>
          </div>
          <div className='flex justify-between'>
            <span className='text-gray-500'>线程数</span>
            <span className='text-gray-800'>{processInfo?.threads}</span>
          </div>
          <div className='flex justify-between'>
            <span className='text-gray-500'>运行时间</span>
            <span className='text-gray-800'>{processInfo?.create_time ? '已运行' : '-'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// 主诊断页面组件
export const DiagnosticsPage: React.FC = () => {
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
      const data: HealthData = envelope?.data ?? envelope;
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
      const data: PerformanceData = envelope?.data ?? envelope;
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
      const data: ErrorData = envelope?.data ?? envelope;
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
      const data: SystemData = envelope?.data ?? envelope;
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
    <div className='space-y-6'>
      {/* 页面头部 */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-xl font-bold text-gray-800'>系统诊断</h1>
          <p className='text-sm text-gray-500 mt-1'>监控系统健康状态和性能指标</p>
        </div>
        <PermissionButton
          permission='system.logs'
          onClick={refreshAll}
          disabled={isRefreshing}
          className='flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50'
        >
          <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          刷新
        </PermissionButton>
      </div>

      {/* M9: 首次加载反馈 */}
      {isRefreshing && healthData === null && (
        <div className='animate-pulse text-sm text-gray-400 flex items-center gap-2'>
          <RefreshCw size={14} className='animate-spin' />
          正在加载诊断数据...
        </div>
      )}

      {loadError && (
        <div
          role='alert'
          className='flex items-center gap-2 px-4 py-3 mt-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700'
        >
          <AlertTriangle size={16} className='flex-shrink-0' />
          部分诊断数据加载失败，下方指标可能不完整，请点击「刷新」重试
        </div>
      )}

      {/* 整体健康状态 */}
      {healthData && (
        <div
          className={`p-4 rounded-xl border ${
            healthData.status === 'healthy'
              ? 'bg-green-50 border-green-200'
              : healthData.status === 'degraded'
              ? 'bg-yellow-50 border-yellow-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <div className='flex items-center gap-3'>
            <Heart
              size={32}
              className={
                healthData.status === 'healthy'
                  ? 'text-green-500'
                  : healthData.status === 'degraded'
                  ? 'text-yellow-500'
                  : 'text-red-500'
              }
            />
            <div>
              <span
                className={`text-lg font-bold ${
                  healthData.status === 'healthy'
                    ? 'text-green-700'
                    : healthData.status === 'degraded'
                    ? 'text-yellow-700'
                    : 'text-red-700'
                }`}
              >
                {healthData.status === 'healthy'
                  ? '系统运行正常'
                  : healthData.status === 'degraded'
                  ? '系统部分降级'
                  : '系统存在严重问题'}
              </span>
              <p className='text-sm text-gray-600 mt-0.5'>
                检查时间: {new Date(healthData.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 健康检查卡片 */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
        <HealthCard
          title='数据库'
          icon={Database}
          checks={[
            {
              name: '主数据库',
              status: (healthData?.components?.database?.status as HealthStatusType) || 'unknown',
              message: healthData?.components?.database?.message,
            },
            {
              name: '连接池',
              status: 'unknown' as HealthStatusType,
              message: '未检测（暂无连接池监控数据）',
            },
          ]}
        />
        <HealthCard
          title='缓存服务'
          icon={MemoryStick}
          checks={[
            {
              name: 'Redis',
              status: (healthData?.components?.redis?.status as HealthStatusType) || 'unknown',
              message: healthData?.components?.redis?.message,
            },
          ]}
        />
        <HealthCard
          title='消息队列'
          icon={Network}
          checks={[
            {
              name: 'MQTT Broker',
              status: (healthData?.components?.mqtt?.status as HealthStatusType) || 'unknown',
              message: healthData?.components?.mqtt?.message,
            },
          ]}
        />
        <HealthCard
          title='系统资源'
          icon={Cpu}
          checks={[
            {
              name: 'CPU',
              status: (healthData?.components?.cpu?.status as HealthStatusType) || 'unknown',
              message: healthData?.components?.cpu?.message,
            },
            {
              name: '内存',
              status: (healthData?.components?.memory?.status as HealthStatusType) || 'unknown',
              message: healthData?.components?.memory?.message,
            },
            {
              name: '磁盘',
              status: (healthData?.components?.disk?.status as HealthStatusType) || 'unknown',
              message: healthData?.components?.disk?.message,
            },
          ]}
        />
      </div>

      {/* 性能指标 */}
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
        <MetricCard
          title='总请求数'
          value={performanceData ? performanceData.total_requests : '—'}
          unit={performanceData ? '次' : undefined}
          icon={Zap}
          color='blue'
        />
        <MetricCard
          title='平均响应时间'
          value={performanceData ? (performanceData.avg_duration || 0).toFixed(3) : '—'}
          unit={performanceData ? 's' : undefined}
          icon={Clock}
          color='green'
        />
        <MetricCard
          title='慢请求数'
          value={performanceData ? performanceData.slow_request_count : '—'}
          unit={performanceData ? '个' : undefined}
          icon={AlertTriangle}
          color='orange'
        />
        <MetricCard
          title='总处理时间'
          value={performanceData ? (performanceData.total_time || 0).toFixed(2) : '—'}
          unit={performanceData ? 's' : undefined}
          icon={Activity}
          color='purple'
        />
      </div>

      {/* 系统信息 */}
      {systemData && (
        <SystemInfoComponent
          system={systemData.system || {}}
          processInfo={systemData.process || {}}
        />
      )}

      {/* 慢请求记录 */}
      {performanceData && <SlowRequestsTable requests={performanceData.slow_requests || []} />}

      {/* 错误列表 */}
      {errorData && <ErrorList errors={errorData.recent_errors || []} />}
    </div>
  );
};

export default DiagnosticsPage;
