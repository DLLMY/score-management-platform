// T12-1 拆分（2026-09-12）：原 OpsCenterView.tsx 顶部的类型定义搬迁至此。
// 所有 interface 保持 export，供 ./components/* 与 ../../OpsCenter 引用。
export interface HealthComponent {
  status?: string;
  message?: string;
  usage_percent?: number;
  hit_rate?: string | number;
  operations?: number;
  available?: number;
  free?: number;
}

export interface HealthData {
  status?: string;
  timestamp?: string;
  components?: {
    database?: HealthComponent;
    redis?: HealthComponent;
    mqtt?: HealthComponent;
    cpu?: HealthComponent;
    memory?: HealthComponent;
    disk?: HealthComponent;
  };
}

export interface PerfSystem {
  cpu?: { percent?: number; count?: number };
  memory?: { total?: number; available?: number; used?: number; percent?: number };
  disk?: { total?: number; used?: number; free?: number; percent?: number };
  process?: { pid?: number; memory_rss?: number; threads?: number; cpu_percent?: number };
}

export interface ApiPerformance {
  uptime?: string;
  total_requests?: number;
  total_queries?: number;
  overall?: Record<string, unknown>;
  request_stats?: Record<string, unknown>;
}

export interface SlowRequest {
  timestamp?: string;
  method?: string;
  endpoint?: string;
  status_code?: number;
  duration?: number;
}

export interface PerformanceData {
  timestamp?: string;
  system?: PerfSystem;
  api_performance?: ApiPerformance;
  slow_requests?: SlowRequest[];
}

export interface MqttStatus {
  connected?: boolean;
  subscribed_topics?: string[];
}

export interface DeviceStats {
  total_devices?: number;
  online_devices?: number;
  offline_devices?: number;
  error_devices?: number;
  unresolved_alerts?: number;
  critical_alerts?: number;
}

export interface SystemStats {
  timestamp?: string;
  users?: number;
  records?: number;
  rules?: number;
  categories?: number;
  devices?: number;
  admins?: number;
}

export interface OperationLog {
  id?: number;
  operation_type?: string;
  target_type?: string;
  description?: string;
  operator?: string;
  ip_address?: string;
  created_at?: string;
}

export type StatusType = 'healthy' | 'degraded' | 'unhealthy' | 'warning' | 'critical' | 'unknown';
