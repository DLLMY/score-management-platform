export interface DeviceStats {
  total: number;
  online: number;
  offline: number;
  today_heartbeats?: number;
}

export interface AdvancedStats {
  total: number;
  online: number;
  offline: number;
  by_firmware: Record<string, number>;
  online_rate?: number;
  avg_signal_strength?: number;
  error_devices?: number;
  critical_alerts?: number;
}

export interface NewDeviceForm {
  device_id: string;
  name: string;
  [key: string]: unknown;
}

export interface BindForm {
  class_id: string;
  admin_id: string;
  [key: string]: unknown;
}

export interface DeviceSettings {
  alert_enabled: boolean;
  heartbeat_timeout: number;
  name: string;
  [key: string]: unknown;
}

export interface OTAForm {
  firmware_url: string;
  version: string;
  force: boolean;
  [key: string]: unknown;
}

export interface OTAProgressData {
  in_progress: Array<{
    id: string;
    device_id: string;
    device_name: string | null;
    from_version: string | null;
    to_version: string;
    started_at: string;
  }>;
  summary: {
    in_progress_count: number;
    completed_count: number;
    failed_count: number;
  };
}

export interface ClassItem {
  id: number;
  name: string;
}

export interface AdminItem {
  id: number;
  real_name: string;
  username: string;
}

export interface DeviceImportResult {
  success: boolean;
  total?: number;
  success_count?: number;
  failed_count?: number;
  messages?: Array<{
    action: string;
    message: string;
    row_data?: Record<string, unknown>;
    error_fields?: string[];
  }>;
}
