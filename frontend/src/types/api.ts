/**
 * API类型定义
 */

import {
  User,
  ScoreCategory,
  ScoreRule,
  ScoreRecord,
  Device,
  Approval,
  Admin,
  OperationLog,
  MQTTConfig,
  DashboardStats,
  ApiResponse,
  ListResponse,
  RemoteNotification,
  ScoreChangeNotify,
  ID,
} from './index';

// ============================================
// API端点类型
// ============================================

export type ApiEndpoint =
  | '/users'
  | '/users/:id'
  | '/rules'
  | '/rules/:id'
  | '/categories'
  | '/categories/:id'
  | '/records'
  | '/records/:id'
  | '/devices'
  | '/devices/:id'
  | '/approvals'
  | '/approvals/:id'
  | '/notifications'
  | '/notifications/:id'
  | '/auth/login'
  | '/auth/logout'
  | '/auth/verify'
  | '/dashboard/stats'
  | '/mqtt/config'
  | '/mqtt/publish'
  | '/system/config'
  | '/remote_notify/send'
  | '/remote_notify/broadcast';

// ============================================
// API请求类型
// ============================================

export interface ApiRequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: ApiEndpoint | string;
  data?: unknown;
  params?: Record<string, string | number>;
  headers?: Record<string, string>;
  timeout?: number;
}

// ============================================
// 用户API类型
// ============================================

export interface UserApi {
  getList: () => Promise<ListResponse<User>>;
  getDetail: (id: ID) => Promise<ApiResponse<User>>;
  create: (data: UserCreateRequest) => Promise<ApiResponse<User>>;
  update: (id: ID, data: UserUpdateRequest) => Promise<ApiResponse<User>>;
  delete: (id: ID) => Promise<ApiResponse>;
  search: (query: string) => Promise<ListResponse<User>>;
  getByCardId: (cardId: string) => Promise<ApiResponse<User>>;
}

export interface UserCreateRequest {
  name: string;
  gender?: string;
  class_name?: string;
  phone?: string;
  card_id: string;
  current_score?: number;
  parent_info?: string;
}

export interface UserUpdateRequest {
  name?: string;
  gender?: string;
  class_name?: string;
  phone?: string;
  current_score?: number;
  is_blacklisted?: boolean;
  blacklist_reason?: string;
}

// ============================================
// 积分API类型
// ============================================

export interface ScoreApi {
  getRules: () => Promise<ListResponse<ScoreRule>>;
  getRuleDetail: (id: ID) => Promise<ApiResponse<ScoreRule>>;
  createRule: (data: ScoreRuleCreateRequest) => Promise<ApiResponse<ScoreRule>>;
  updateRule: (id: ID, data: ScoreRuleUpdateRequest) => Promise<ApiResponse<ScoreRule>>;
  deleteRule: (id: ID) => Promise<ApiResponse>;

  getCategories: () => Promise<ListResponse<ScoreCategory>>;
  createCategory: (data: ScoreCategoryCreateRequest) => Promise<ApiResponse<ScoreCategory>>;
  updateCategory: (id: ID, data: ScoreCategoryUpdateRequest) => Promise<ApiResponse<ScoreCategory>>;
  deleteCategory: (id: ID) => Promise<ApiResponse>;

  getRecords: (userId?: ID) => Promise<ListResponse<ScoreRecord>>;
  addScore: (userId: ID, ruleId: ID, description?: string) => Promise<ApiResponse<ScoreRecord>>;
  subtractScore: (
    userId: ID,
    ruleId: ID,
    description?: string
  ) => Promise<ApiResponse<ScoreRecord>>;
}

export interface ScoreRuleCreateRequest {
  name: string;
  description?: string;
  category_id: ID;
  score: number;
  daily_limit?: number;
  min_interval?: number;
}

export interface ScoreRuleUpdateRequest {
  name?: string;
  description?: string;
  score?: number;
  is_active?: boolean;
  daily_limit?: number;
}

export interface ScoreCategoryCreateRequest {
  name: string;
  description?: string;
  color?: string;
}

export interface ScoreCategoryUpdateRequest {
  name?: string;
  description?: string;
  color?: string;
  is_active?: boolean;
}

// ============================================
// 设备API类型
// ============================================

export interface DeviceApi {
  getList: () => Promise<ListResponse<Device>>;
  getDetail: (id: ID) => Promise<ApiResponse<Device>>;
  create: (data: DeviceCreateRequest) => Promise<ApiResponse<Device>>;
  update: (id: ID, data: DeviceUpdateRequest) => Promise<ApiResponse<Device>>;
  delete: (id: ID) => Promise<ApiResponse>;
  getStatus: (deviceId: string) => Promise<ApiResponse<DeviceStatusResponse>>;
  sendCommand: (deviceId: string, command: DeviceCommand) => Promise<ApiResponse>;
}

export interface DeviceCreateRequest {
  name: string;
  device_id: string;
  type: string;
  location?: string;
}

export interface DeviceUpdateRequest {
  name?: string;
  location?: string;
  config?: Record<string, unknown>;
}

export interface DeviceStatusResponse {
  device_id: string;
  status: string;
  last_heartbeat: string | null;
  firmware_version?: string;
}

export interface DeviceCommand {
  command: 'unlock' | 'lock' | 'restart' | 'update' | 'config';
  params?: Record<string, unknown>;
}

// ============================================
// 审批API类型
// ============================================

export interface ApprovalApi {
  getList: (status?: string) => Promise<ListResponse<Approval>>;
  getDetail: (id: ID) => Promise<ApiResponse<Approval>>;
  create: (data: ApprovalCreateRequest) => Promise<ApiResponse<Approval>>;
  approve: (id: ID, comment?: string) => Promise<ApiResponse<Approval>>;
  reject: (id: ID, comment?: string) => Promise<ApiResponse<Approval>>;
  getPending: () => Promise<ListResponse<Approval>>;
}

export interface ApprovalCreateRequest {
  type: 'score_add' | 'score_sub' | 'unlock' | 'other';
  user_id: ID;
  score_change?: number;
  reason?: string;
}

// ============================================
// MQTT API类型
// ============================================

export interface MqttApi {
  getConfig: () => Promise<ApiResponse<MQTTConfig>>;
  updateConfig: (data: MQTTConfigUpdateRequest) => Promise<ApiResponse<MQTTConfig>>;
  publish: (topic: string, message: unknown) => Promise<ApiResponse>;
  subscribe: (topic: string) => Promise<ApiResponse>;
  unsubscribe: (topic: string) => Promise<ApiResponse>;
  getStatus: () => Promise<ApiResponse<MQTTStatusResponse>>;
}

export interface MQTTConfigUpdateRequest {
  broker?: string;
  port?: number;
  username?: string;
  password?: string;
  ssl?: boolean;
}

export interface MQTTStatusResponse {
  connected: boolean;
  broker: string;
  subscribed_topics: string[];
  last_message_time?: string;
}

// ============================================
// 远程通知API类型
// ============================================

export interface RemoteNotifyApi {
  send: (data: RemoteNotification) => Promise<ApiResponse>;
  broadcast: (data: RemoteNotification) => Promise<ApiResponse>;
  test: () => Promise<ApiResponse>;
  scoreChange: (data: ScoreChangeNotify) => Promise<ApiResponse>;
}

// ============================================
// 认证API类型
// ============================================

export interface AuthApi {
  login: (username: string, password: string) => Promise<ApiResponse<Admin>>;
  logout: () => Promise<ApiResponse>;
  verify: (token: string) => Promise<ApiResponse<Admin>>;
  refreshToken: () => Promise<ApiResponse<{ token: string }>>;
}

// ============================================
// 仪表盘API类型
// ============================================

export interface DashboardApi {
  getStats: () => Promise<ApiResponse<DashboardStats>>;
  getRecentActivity: (limit?: number) => Promise<ApiResponse<OperationLog[]>>;
  getScoreDistribution: () => Promise<ApiResponse<ScoreDistributionResponse[]>>;
}

export interface ScoreDistributionResponse {
  range: string;
  count: number;
  percentage: number;
}

// ============================================
// 导出API类型
// ============================================

export interface ExportApi {
  exportUsers: (format: 'xlsx' | 'csv' | 'json') => Promise<ApiResponse<{ url: string }>>;
  exportRecords: (
    format: 'xlsx' | 'csv' | 'json',
    userId?: ID
  ) => Promise<ApiResponse<{ url: string }>>;
  importUsers: (file: File) => Promise<ApiResponse<{ imported: number; errors: string[] }>>;
  importRecords: (file: File) => Promise<ApiResponse<{ imported: number; errors: string[] }>>;
}

// ============================================
// API服务类型
// ============================================

export interface ApiService {
  user: UserApi;
  score: ScoreApi;
  device: DeviceApi;
  approval: ApprovalApi;
  mqtt: MqttApi;
  remoteNotify: RemoteNotifyApi;
  auth: AuthApi;
  dashboard: DashboardApi;
  export: ExportApi;
}

// ============================================
// 请求拦截器类型
// ============================================

export type RequestInterceptor = (
  config: ApiRequestConfig
) => ApiRequestConfig | Promise<ApiRequestConfig>;

export type ResponseInterceptor<T = unknown> = (
  response: ApiResponse<T>
) => ApiResponse<T> | Promise<ApiResponse<T>>;

export type ErrorInterceptor = (error: Error) => void | Promise<void>;

// ============================================
// API客户端配置
// ============================================

export interface ApiClientConfig {
  baseURL: string;
  timeout: number;
  headers: Record<string, string>;
  requestInterceptors: RequestInterceptor[];
  responseInterceptors: ResponseInterceptor[];
  errorInterceptors: ErrorInterceptor[];
}
