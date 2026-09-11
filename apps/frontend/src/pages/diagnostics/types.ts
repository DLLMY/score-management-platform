// 健康检查接口
export interface HealthCheck {
  name: string;
  status: HealthStatusType;
  message?: string;
}

export type HealthStatusType =
  | 'healthy'
  | 'degraded'
  | 'unhealthy'
  | 'warning'
  | 'critical'
  | 'unknown';

// 健康数据接口
export interface HealthData {
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
export interface PerformanceData {
  total_requests: number;
  avg_duration: number;
  slow_request_count: number;
  total_time: number;
  slow_requests: SlowRequest[];
}

// 慢请求接口
export interface SlowRequest {
  timestamp: string;
  method: string;
  endpoint: string;
  status_code: number;
  duration: number;
}

// 错误数据接口
export interface ErrorData {
  recent_errors: SystemError[];
}

// 系统错误接口
export interface SystemError {
  type: string;
  message: string;
  timestamp: string;
  traceback?: string;
}

// 系统数据接口
export interface SystemData {
  system: SystemInfo;
  process: ProcessInfo;
}

// 系统信息接口
export interface SystemInfo {
  platform: string;
  platform_version: string;
  python_version: string;
  cpu_count: number;
}

// 进程信息接口
export interface ProcessInfo {
  pid: number;
  status: string;
  threads: number;
  create_time?: string;
}

// 指标卡片属性接口
export interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  trend?: number;
  icon: import('lucide-react').LucideIcon;
  color?: 'blue' | 'green' | 'orange' | 'purple';
}

// 健康检查卡片属性接口
export interface HealthCardProps {
  title: string;
  icon: import('lucide-react').LucideIcon;
  checks: HealthCheck[];
}

// 视图 props
export interface DiagnosticsViewProps {
  healthData: HealthData | null;
  performanceData: PerformanceData | null;
  errorData: ErrorData | null;
  systemData: SystemData | null;
  isRefreshing: boolean;
  loadError: boolean;
  refreshAll: () => Promise<void>;
}
