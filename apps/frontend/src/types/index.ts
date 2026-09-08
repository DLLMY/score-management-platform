/**
 * 核心类型定义
 * 统一管理所有TypeScript类型
 */

// ============================================
// 基础类型
// ============================================

export type ID = number | string;

export type Gender = 'male' | 'female' | 'other';

export type Status = 'active' | 'inactive' | 'pending' | 'approved' | 'rejected';

export type ThemeMode = 'light' | 'dark' | 'system';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export type DeviceStatus = 'online' | 'offline' | 'error' | 'maintenance';

export type UserRole =
  | 'admin'
  | 'super_admin'
  | 'teacher'
  | 'subject_teacher'
  | 'head_teacher'
  | 'dashboard'
  | 'dashboard_viewer'
  | 'viewer'
  | 'student'
  | 'parent'
  | 'guest';

// ============================================
// 用户相关类型
// ============================================

export interface User {
  id: ID;
  name: string;
  gender?: string;
  class_name?: string;
  phone?: string;
  card_id: string;
  current_score: number;
  is_blacklisted: boolean;
  blacklist_reason?: string;
  blacklist_until?: Date | string;
  daily_unlock_limit: number;
  today_unlock_count: number;
  last_unlock_date?: Date | string;
  is_active: boolean;
  risk_score?: number;
  last_risk_updated?: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
  role?: string;
  parent_info?: string;
  father_name?: string;
  father_phone?: string;
  mother_name?: string;
  mother_phone?: string;
  guardian_name?: string;
  guardian_phone?: string;
  guardian_relation?: string;
}

export interface UserCreateInput {
  name: string;
  gender?: string;
  class_name?: string;
  phone?: string;
  card_id: string;
  current_score?: number;
  parent_info?: string;
  father_name?: string;
  father_phone?: string;
  mother_name?: string;
  mother_phone?: string;
}

export interface UserUpdateInput {
  name?: string;
  gender?: string;
  class_name?: string;
  phone?: string;
  current_score?: number;
  is_blacklisted?: boolean;
  blacklist_reason?: string;
  blacklist_until?: Date | string;
}

// ============================================
// 积分相关类型
// ============================================

export interface ScoreCategory {
  id: ID;
  name: string;
  description?: string;
  color: string;
  is_active: boolean;
  created_at: Date | string;
}

export interface ScoreRule {
  id: ID;
  name: string;
  description?: string;
  category_id: ID;
  score: number;
  is_active: boolean;
  daily_limit: number;
  min_interval: number;
  start_time?: Date | string;
  end_time?: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
  category?: ScoreCategory;
}

export interface ScoreRecord {
  id: ID;
  user_id: ID;
  rule_id: ID;
  score_change: number;
  description?: string;
  operator?: string;
  created_at: Date | string;
  user?: User;
  rule?: ScoreRule;
}

export interface ScoreRankRule {
  id: ID;
  name: string;
  min_score: number;
  max_score?: number;
  color: string;
  icon: string;
  description?: string;
  is_active: boolean;
  unlock_min_score?: number;
  weekly_unlock_limit?: number;
  created_at: Date | string;
  updated_at: Date | string;
}

// ============================================
// 设备相关类型
// ============================================

export interface Device {
  id: ID;
  device_id: string;
  name: string;
  device_name?: string;
  is_online: boolean;
  wifi_signal: number | null;
  uptime: number | null;
  last_heartbeat: string | null;
  box_a_status: 'opened' | 'closed' | null;
  box_b_status: 'opened' | 'closed' | null;
  system_state: number;
  class_name: string | null;
  class_info_id: number | null;
  admin_id: number | null;
  admin_name: string | null;
  alert_enabled: boolean;
  heartbeat_timeout: number;
  location?: string;
  status?: string;
  firmware_version?: string;
  type?: string;
  created_at?: Date | string;
  updated_at?: Date | string;
  config?: DeviceConfig;
  signalInfo?: {
    text: string;
    color: string;
    level: string;
  };
}

export interface DeviceConfig {
  unlock_timeout?: number;
  sound_enabled?: boolean;
  lcd_brightness?: number;
  heartbeat_interval?: number;
}

export interface DeviceStatusUpdate {
  device_id: string;
  status: DeviceStatus;
  timestamp: Date | string;
  details?: Record<string, unknown>;
}

// ============================================
// 审批相关类型
// ============================================

export interface Approval {
  id: ID;
  type: 'score_add' | 'score_sub' | 'unlock' | 'other';
  user_id: ID;
  user_name?: string;
  card_id?: string;
  score_change?: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  requester?: string;
  approver?: string;
  comment?: string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface ApprovalCreateInput {
  type: Approval['type'];
  user_id: ID;
  score_change?: number;
  reason?: string;
}

export interface ApprovalUpdateInput {
  status: 'approved' | 'rejected';
  comment?: string;
}

// ============================================
// 通知相关类型
// ============================================

export interface Notification {
  id: ID;
  type: 'system' | 'approval' | 'alert' | 'device' | 'score';
  title: string;
  message: string;
  content?: string;
  is_read: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  data?: Record<string, unknown>;
  created_at: Date | string;
}

export interface Toast {
  id: ID;
  message: string;
  type: ToastType;
  duration?: number;
}

// ============================================
// 管理员相关类型
// ============================================

export interface Admin {
  id: ID;
  username: string;
  name: string;
  real_name?: string;
  role: UserRole;
  role_type: string;
  email?: string;
  phone?: string;
  class_name?: string;
  class_count?: number;
  is_active: boolean;
  permissions?: string[];
  force_password_change?: boolean;
  created_at: Date | string;
  updated_at?: Date | string;
}

export interface AdminLoginInput {
  username: string;
  password: string;
}

export interface AdminLoginResponse {
  success: boolean;
  admin: Admin;
  token: string;
  message?: string;
}

// ============================================
// 操作日志类型
// ============================================

export interface OperationLog {
  id: ID;
  operation_type: string;
  target_type?: string;
  target_id?: ID;
  operator: string;
  description?: string;
  before_data?: string;
  after_data?: string;
  ip_address?: string;
  created_at: Date | string;
}

// ============================================
// 系统配置类型
// ============================================

export interface SystemConfig {
  id: ID;
  system_name: string;
  system_logo?: string;
  default_score: number;
  min_score: number;
  max_score: number;
  enable_notifications: boolean;
  notification_sound: boolean;
  auto_save: boolean;
  updated_at: Date | string;
}

export interface MQTTConfig {
  id: ID;
  broker: string;
  port: number;
  client_id: string;
  username: string;
  password: string;
  ssl: boolean;
  timeout: number;
  keepalive: number;
  updated_at: Date | string;
}

// ============================================
// 远程通知类型
// ============================================

export interface RemoteNotification {
  text: string;
  type?: 'normal' | 'score_change' | 'class_reminder';
  volume?: number;
  speak?: boolean;
  popup?: boolean;
  timeout_sec?: number;
  urgent?: boolean;
  timestamp?: Date | string;
}

export interface ScoreChangeNotify {
  student_name: string;
  score_change: number;
  reason: string;
  course?: string;
  device_id?: string;
}

// ============================================
// API响应类型
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface ListResponse<T> extends ApiResponse<T[]> {
  count: number;
}

export interface BackendPaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface DevicePaginatedResponse {
  devices: Device[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface UserPaginatedResponse {
  users: User[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface WOLDevice {
  id: number;
  name: string;
  mac_address: string;
  broadcast_ip?: string;
  port?: number;
  description?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface WOLDevicePaginatedResponse {
  devices: WOLDevice[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

// ============================================
// M9 P1 资源语义 key 分页信封
// 后端 service 在收到 page+per_page 时返回 data={<资源key>: T[], total, page, per_page, pages}，
// 前端经 unwrapEnvelope 取到的即为此内层对象。资源 key 与 P0 的 devices/users 一致（records/groups/...）。
// ============================================

/** 分页元数据（与后端信封一致：pages 非 total_pages） */
export interface PaginatedMeta {
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

/** 资源语义 key 分页信封：{ <K>: T[] } 交 PaginatedMeta。例：ResourceList<'groups', DutyGroup> → { groups: DutyGroup[]; total; page; per_page; pages } */
export type ResourceList<K extends string, T> = { [P in K]: T[] } & PaginatedMeta;

// ============================================
// WebSocket事件类型
// ============================================

export interface WebSocketEvent {
  type: 'notification' | 'device_status' | 'score_update' | 'alert' | 'system';
  data: Record<string, unknown>;
  timestamp: Date | string;
}

export interface ScoreUpdateEvent {
  user_id: ID;
  user_name: string;
  score_change: number;
  new_score: number;
  reason?: string;
  timestamp: Date | string;
}

// ============================================
// 组件Props类型
// ============================================

export interface BaseComponentProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export interface LoadingProps extends BaseComponentProps {
  isLoading: boolean;
  message?: string;
}

export interface ErrorProps extends BaseComponentProps {
  error: Error | string | null;
  onRetry?: () => void;
}

export interface ModalProps extends BaseComponentProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export interface TableProps<T> extends BaseComponentProps {
  data: T[];
  columns: ColumnDef<T>[];
  loading?: boolean;
  onRowClick?: (row: T) => void;
  pagination?: PaginationConfig;
}

export interface ColumnDef<T> {
  key: string;
  header: string;
  render?: (value: unknown, row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string | number;
}

export interface PaginationConfig {
  page: number;
  perPage: number;
  total: number;
  onChange: (page: number) => void;
}

// ============================================
// 表单类型
// ============================================

export interface FormFieldConfig {
  name: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'password' | 'select' | 'checkbox' | 'date' | 'textarea';
  required?: boolean;
  placeholder?: string;
  defaultValue?: unknown;
  options?: SelectOption[];
  validation?: ValidationRule[];
}

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface ValidationRule {
  type: 'required' | 'minLength' | 'maxLength' | 'min' | 'max' | 'pattern' | 'custom';
  value?: unknown;
  message: string;
}

// ============================================
// 统计数据类型
// ============================================

export interface DashboardStats {
  total_users: number;
  active_users: number;
  total_score_sum: number;
  average_score: number;
  today_operations: number;
  pending_approvals: number;
  online_devices: number;
  offline_devices: number;
}

export interface ScoreDistribution {
  range: string;
  count: number;
  percentage: number;
}

export interface RecentActivity {
  id: ID;
  type: string;
  description: string;
  user_name?: string;
  timestamp: Date | string;
}

// ============================================
// 导出所有类型
// ============================================

// ============================================
// 考试相关类型
// ============================================

export interface Exam {
  id: number;
  name: string;
  description?: string;
  subjects?: string[] | Subject[];
  subject_ids?: number[];
  subject_details?: Array<{
    id: number;
    name: string;
    full_score: number;
    order: number;
  }>;
  status: 'draft' | 'published' | 'closed' | 'archived';
  class_id?: number;
  class_name?: string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface Subject {
  id: number;
  name: string;
  description?: string;
  exam_id?: number;
  code: string | null;
  grade: string | null;
  color?: string;
  created_at: Date | string;
  updated_at?: Date | string;
  class_count?: number;
  is_active?: boolean;
}

export interface ExamFormData {
  name: string;
  description: string;
}

export interface SubjectFormData {
  name: string;
  description: string;
}

// ============================================
// 课程表相关类型
// ============================================

export interface CourseSchedule {
  id: number;
  class_info_id: number;
  class_name: string;
  subject_id: number;
  subject_name: string;
  subject_color: string;
  day_of_week: number;
  day_of_week_text: string;
  period_number: number;
  period_name: string;
  period_time: string;
  teacher_id?: number;
  teacher_name: string;
  classroom?: string;
  description?: string;
  color: string;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface CourseScheduleFormData {
  class_info_id: number;
  subject_id: number;
  day_of_week: number;
  period_number: number;
  teacher_id?: number;
  teacher_name?: string;
  classroom?: string;
  description?: string;
  color?: string;
  is_active?: boolean;
}

// ============================================
// 成绩相关类型
// ============================================

export interface Score {
  id: number;
  exam_id: number;
  exam_name?: string;
  student_id: number;
  student_name?: string;
  subject_id?: number;
  subject: string;
  score: number;
  full_score: number;
  rank?: number;
  status: 'pending' | 'confirmed' | 'rejected';
  remark?: string;
  entered_by?: number;
  entered_at: Date | string;
  updated_at: Date | string;
}

// ============================================
// 算法分析相关类型
// ============================================

export interface ClusterSummary {
  label: string;
  count: number;
  average_score?: number;
}

export interface ClusterStudent {
  user_id: number;
  cluster: number;
  cluster_name: string;
  distance?: number;
}

export interface ClusterData {
  n_clusters: number;
  cluster_summary: ClusterSummary[];
  students?: ClusterStudent[];
}

export interface CompositeScoreRanking {
  user_id: number;
  name: string;
  card_id?: string;
  total_score?: number;
  behavior_score?: number;
  academic_score?: number;
  attendance_score?: number;
  rank?: number;
}

export interface CompositeScoreData {
  weights: {
    behavior?: number;
    academic?: number;
    attendance?: number;
  };
  rankings: CompositeScoreRanking[];
}

export interface RiskStudent {
  user_id: number;
  name: string;
  card_id?: string;
  class_name?: string;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high';
  warning_count: number;
  predicted_change?: number;
  confidence?: number;
}

export interface WarningData {
  total_risk_count: number;
  risk_students: RiskStudent[];
}

export interface AlgorithmStatistics {
  student_count: number;
  avg_behavior_score?: number;
  avg_academic_score?: number;
  avg_attendance_score?: number;
  avg_total_score?: number;
  high_risk_count?: number;
  medium_risk_count?: number;
  low_risk_count?: number;
  cluster_count?: number;
  correlation?: number;
  updated_at?: Date | string;
}

export interface WarningConfig {
  [key: string]: string | number;
}

export interface AlgorithmData {
  statistics: AlgorithmStatistics | null;
  clusters: ClusterData | null;
  warnings: WarningData | null;
}

export interface PredictionResult {
  user_id?: number;
  name: string;
  current_score: number;
  predicted_score: number;
  trend: 'up' | 'down' | 'stable';
  confidence: number;
  confidence_interval?: [number, number];
}

export interface BatchPredictionData {
  summary: {
    avg_current_score: number;
    avg_predicted_score: number;
    improvement_count: number;
    decline_count: number;
    stable_count: number;
  };
  predictions: PredictionResult[];
}

export interface AnomalyResult {
  name: string;
  anomaly_type: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  score_change: number;
  detected_at: string;
}

export interface BatchAnomalyData {
  summary: {
    total_anomalies: number;
    high_severity_count: number;
    medium_severity_count: number;
    low_severity_count: number;
  };
  anomalies: AnomalyResult[];
}

export interface RuleRecommendResult {
  rule_id: number;
  rule_name: string;
  description: string;
  estimated_impact: number;
  confidence: number;
  category: string;
}

export interface RuleRecommendData {
  recommendations: RuleRecommendResult[];
  summary: {
    total_recommendations: number;
    avg_confidence: number;
    estimated_total_impact: number;
  };
}

export interface ScorePredictResult {
  name: string;
  subject: string;
  current_score: number;
  predicted_score: number;
  trend: 'up' | 'down' | 'stable';
  confidence: number;
  confidence_interval?: [number, number];
}

export interface BatchScorePredictData {
  summary: {
    avg_current_score: number;
    avg_predicted_score: number;
    subjects: string[];
  };
  predictions: ScorePredictResult[];
}

export interface RiskSubRisk {
  key: 'academic' | 'behavior' | 'attendance';
  name: string;
  level: 'high' | 'medium' | 'low';
  score: number;
  factors: string[];
}

export interface EngagementFactor {
  name: string;
  value: number;
  weight: number;
  contribution: number;
}

export interface EngagementResult {
  user_id: number;
  days: number;
  engagement_score: number;
  level: 'high' | 'medium' | 'low';
  factors: EngagementFactor[];
  components: {
    attendance_rate: number | null;
    homework_rate: number | null;
    activity_rate: number;
    leave_days: number;
  };
  description: string;
  has_data: boolean;
}

export interface RiskPredictResult {
  name: string;
  risk_level: 'high' | 'medium' | 'low';
  risk_score: number;
  contributing_factors: string[];
  recommended_actions: string[];
  sub_risks?: RiskSubRisk[];
}

export interface BatchRiskPredictData {
  summary: {
    high_risk_count: number;
    medium_risk_count: number;
    low_risk_count: number;
    avg_risk_score: number;
  };
  risks: RiskPredictResult[];
}

export interface ScoreAttributionFactor {
  key: string;
  name: string;
  contribution: number;
  direction: 'positive' | 'negative' | 'neutral';
  delta: number;
  detail: string;
}

export interface ScoreAttributionResult {
  user_id?: number;
  name: string;
  class_name?: string;
  has_data: boolean;
  total_change: number;
  score_before: number;
  score_after: number;
  confidence: number;
  factors: ScoreAttributionFactor[];
  summary: string;
}

export interface BatchAttributionStudent {
  user_id?: number;
  name: string;
  class_name?: string;
  has_data: boolean;
  total_change: number;
  score_before: number;
  score_after: number;
  confidence: number;
  factors: ScoreAttributionFactor[];
  summary: string;
  error?: string;
}

export interface BatchAttributionResult {
  class_name: string;
  days: number;
  total: number;
  analyzed: number;
  with_data: number;
  failed: number;
  students: BatchAttributionStudent[];
  failed_students: Array<{ user_id: number; name: string; class_name?: string; error: string }>;
}

export interface EngagementStudentRank {
  user_id: number;
  name: string;
  class_name?: string;
  rank: number | null;
  engagement_score: number;
  level: 'high' | 'medium' | 'low';
  has_data: boolean;
  error?: string;
  components?: {
    attendance_rate: number | null;
    homework_rate: number | null;
    activity_rate: number | null;
    leave_days: number;
  };
}

export interface EngagementRankResult {
  class_name: string;
  days: number;
  total: number;
  with_data: number;
  failed: number;
  students: EngagementStudentRank[];
  failed_students: Array<{ user_id: number; name: string; class_name?: string; error: string }>;
}

export interface EngagementTrendPoint {
  week_index: number;
  week_label: string;
  week_end: string;
  engagement_score: number;
  level: 'high' | 'medium' | 'low';
  has_data: boolean;
  attendance_rate: number | null;
  homework_rate: number | null;
  activity_rate: number | null;
  leave_days: number;
}

export interface EngagementTrendResult {
  user_id: number;
  weeks: number;
  trend: 'up' | 'down' | 'stable';
  series: EngagementTrendPoint[];
}

export interface ModelTrainingResult {
  status: string;
  message: string;
  accuracy?: number;
  trained_at?: string;
}

export interface ModelEvaluationResult {
  accuracy: number;
  precision?: number;
  recall?: number;
  f1_score?: number;
  metrics?: Record<string, number>;
}

// ============================================
// 成绩分析相关类型
// ============================================

export interface SubjectStats {
  count: number;
  average: number;
  max: number;
  min: number;
  pass_rate: number;
  scores?: number[];
  avg?: string;
}

export interface ExamAnalysis {
  overall: {
    total_students: number;
    overall_average: number;
    highest_score: number;
    lowest_score: number;
    std_deviation: number;
    excellent_count: number;
    excellent_rate: number;
    pass_rate: number;
  };
  subject_stats: Record<string, SubjectStats>;
}

export interface ClassAnalysis {
  className: string;
  avgScore: string;
  subjectStats: Record<string, { avg: string; max: number; min: number; count: number }>;
  studentCount: number;
}

export interface StudentScoreAnalysis {
  exam_scores: Record<string, ExamWithScores>;
}

export interface ExamScore {
  score?: number;
  subject?: string;
  rank?: number;
}

export interface ExamWithScores {
  exam_name: string;
  exam_time?: string;
  scores: Record<string, ExamScore>;
}

// ============================================
// 班级分配相关类型
// ============================================

export interface TeacherClass {
  class_id: number;
  class_name: string;
}

// ============================================
// 仪表盘相关类型
// ============================================

export interface DashboardStatistics {
  totalUsers: number;
  totalRecords: number;
  totalScore: number;
  activeDevices: number;
}

export interface DashboardState {
  users: User[];
  records: unknown[];
  devices: Device[];
  notifications: Notification[];
  statistics: DashboardStatistics;
  algorithmData: AlgorithmData;
  loading: boolean;
  isRefreshing: boolean;
  lastUpdateTime: Date | null;
  showUpdateIndicator: boolean;
}

export type DashboardAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_REFRESHING'; payload: boolean }
  | { type: 'SET_USERS'; payload: User[] }
  | { type: 'SET_RECORDS'; payload: unknown[] }
  | { type: 'SET_DEVICES'; payload: Device[] }
  | { type: 'SET_NOTIFICATIONS'; payload: Notification[] }
  | { type: 'SET_STATISTICS'; payload: Partial<DashboardStatistics> }
  | { type: 'SET_ALGORITHM_DATA'; payload: AlgorithmData }
  | { type: 'SET_LAST_UPDATE'; payload: Date }
  | { type: 'SET_UPDATE_INDICATOR'; payload: boolean };

// ============================================
// 组件Props类型补充
// ============================================

export interface StatCardProps {
  icon?: React.ElementType;
  label?: string;
  title?: string;
  value: number | string;
  color?: string;
  trend?: number;
  children?: React.ReactNode;
}

export interface StatisticsPanelProps<T> {
  data: T | null;
}

// ============================================
// 导出所有类型
// ============================================

// ============================================
// 座次表类型
// ============================================
export interface SeatingChart {
  id: number;
  class_id: number;
  name: string;
  rows: number;
  columns: number;
  strategy: string;
  is_active: boolean;
  version?: number;
  seats: SeatingSeat[];
}

export interface SeatingSeat {
  row: number;
  col: number;
  student_id: number | null;
  is_aisle: boolean;
  is_student_seat?: boolean;
}

export interface SeatingChartCreateInput {
  class_id: number;
  name: string;
  rows?: number;
  columns?: number;
  strategy?: string;
}

export interface SeatingAutoArrangeInput {
  strategy: string;
  class_id: number;
}

// ============================================
// 值日生表类型
// ============================================
export interface DutyGroup {
  id: number;
  class_id: number;
  name: string;
  day_of_week?: string;
  area?: string;
  is_active: boolean;
}

export interface DutyAssignment {
  id: number;
  group_id: number;
  student_id: number;
  student_name?: string;
  date: string;
  task?: string;
  is_completed: boolean;
  completed_at?: string;
}

export interface DutyGroupCreateInput {
  class_id: number;
  name: string;
  day_of_week?: string;
  area?: string;
}

export interface DutyAssignmentCreateInput {
  group_id: number;
  student_id: number;
  date: string;
  task?: string;
}

// ============================================
// 班委名单类型
// ============================================
export interface ClassCommittee {
  id: number;
  class_id: number;
  position: string;
  student_id: number;
  student_name?: string;
  responsibilities?: string;
  rating?: number;
  term_start?: string;
  term_end?: string;
  is_active: boolean;
}

export interface CommitteeTerm {
  id: number;
  class_id: number;
  term_name: string;
  start_date?: string;
  end_date?: string;
  is_current: boolean;
}

export interface CommitteeTermCreateInput {
  class_id: number;
  term_name: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
}

export interface CommitteeCreateInput {
  class_id: number;
  position: string;
  student_id: number;
  responsibilities?: string;
  term_start?: string;
  term_end?: string;
}

// ============================================
// 家长联系类型
// ============================================
export interface ParentContact {
  id: number;
  student_id: number;
  student_name?: string;
  father_name?: string;
  father_phone?: string;
  mother_name?: string;
  mother_phone?: string;
  address?: string;
  email?: string;
  created_at?: string;
}

export interface ContactLog {
  id: number;
  parent_id: number;
  contact_type: string;
  content?: string;
  contact_time: string;
  follow_up_needed: boolean;
  is_resolved: boolean;
}

export interface ParentContactCreateInput {
  student_id: number;
  father_name?: string;
  father_phone?: string;
  mother_name?: string;
  mother_phone?: string;
  address?: string;
  email?: string;
}

export interface ContactLogCreateInput {
  parent_id: number;
  contact_type: string;
  content?: string;
}

// ============================================
// 作业检查类型
// ============================================
export interface HomeworkAssignment {
  id: number;
  class_id: number;
  /** 班级名称（展示派生，后端 names.klass 输出） */
  class_name?: string;
  subject_id?: number;
  title: string;
  description?: string;
  assigned_date: string;
  due_date: string;
  is_completed: boolean;
  submissions?: HomeworkSubmission[];
  total_students?: number;
  submitted_count?: number;
  unsubmitted_count?: number;
}

export interface HomeworkSubmission {
  id: number;
  assignment_id: number;
  student_id: number;
  is_submitted: boolean;
  submitted_at?: string;
  is_late: boolean;
  notes?: string;
}

export interface HomeworkCreateInput {
  class_id: number;
  subject_id?: number;
  title: string;
  description?: string;
  assigned_date?: string;
  due_date: string;
}

// ============================================
// 考勤管理类型
// ============================================
export interface Attendance {
  id: number;
  class_id: number;
  class_name?: string;
  student_id: number;
  student_name?: string;
  date: string;
  period: string;
  status: 'present' | 'absent' | 'late' | 'leave';
  arrive_time?: string;
  leave_time?: string;
  notes?: string;
}

export interface LeaveApplication {
  id: number;
  student_id: number;
  student_name?: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_at?: string;
}

export interface AttendanceStats {
  total: number;
  present: number;
  absent: number;
  late: number;
  leave: number;
  attendance_rate: number;
}

export interface AttendanceRecordInput {
  class_id: number;
  student_id: number;
  date?: string;
  period?: string;
  status?: string;
  arrive_time?: string;
  leave_time?: string;
  notes?: string;
}

export interface LeaveApplyInput {
  student_id: number;
  leave_type?: string;
  start_date: string;
  end_date: string;
  reason?: string;
}

// ============================================
// 学习小组类型
// ============================================
export interface StudyGroup {
  id: number;
  class_id: number;
  class_name?: string;
  name: string;
  leader_id?: number;
  leader_name?: string;
  description?: string;
  score: number;
  is_active: boolean;
  member_count?: number;
  members?: StudyGroupMember[];
}

export interface StudyGroupMember {
  id: number;
  group_id: number;
  student_id: number;
  student_name?: string;
  joined_at: string;
}

export interface StudyGroupScore {
  id: number;
  group_id: number;
  score_change: number;
  reason?: string;
  created_at: string;
}

export interface StudyGroupCreateInput {
  class_id: number;
  name: string;
  leader_id?: number;
  description?: string;
  member_ids?: number[];
}

// ============================================
// 心理健康类型
// ============================================
export interface MentalHealthRecord {
  id: number;
  student_id: number;
  student_name?: string;
  mood_level?: number;
  stress_level?: number;
  sleep_hours?: number;
  notes?: string;
  created_at: string;
}

// ============================================
// 班主任评语
// ============================================
export interface TeacherComment {
  id: number;
  student_id: number;
  student_name?: string;
  term?: string;
  comment_type?: string;
  rating?: number;
  content: string;
  created_at?: string;
  updated_at?: string;
}

export interface TeacherCommentCreateInput {
  student_id: number;
  term?: string;
  comment_type?: string;
  rating?: number;
  content: string;
}

export interface MentalHealthAlert {
  id: number;
  student_id: number;
  student_name?: string;
  alert_type: string;
  severity: number;
  message: string;
  is_resolved: boolean;
  resolved_at?: string;
  created_at: string;
}

export interface MentalHealthRecordCreateInput {
  student_id: number;
  mood_level?: number;
  stress_level?: number;
  sleep_hours?: number;
  notes?: string;
}

// ============================================
// 文体活动类型
// ============================================
export interface Activity {
  id: number;
  class_id: number;
  class_name?: string;
  title: string;
  description?: string;
  activity_type?: string;
  start_date?: string;
  end_date?: string;
  location?: string;
  organizer?: string;
  is_published: boolean;
  registration_count?: number;
}

export interface ActivityRegistration {
  id: number;
  activity_id: number;
  student_id: number;
  status: 'registered' | 'attended' | 'cancelled';
  registered_at: string;
}

export interface ActivityCreateInput {
  class_id: number;
  title: string;
  description?: string;
  activity_type?: string;
  start_date?: string;
  end_date?: string;
  location?: string;
  organizer?: string;
}

// ============================================
// 班级文化类型
// ============================================
export interface CultureRecord {
  id: number;
  class_id: number;
  class_name?: string;
  category?: string;
  title?: string;
  content?: string;
  image_url?: string;
  display_order: number;
  is_active: boolean;
}

export interface CultureItem {
  id: number;
  record_id: number;
  item_type: string;
  content?: string;
}

export interface CultureCreateInput {
  class_id: number;
  category?: string;
  title?: string;
  content?: string;
  image_url?: string;
  display_order?: number;
}

// ============================================
// 学法指导类型
// ============================================
export interface StudyGuide {
  id: number;
  class_id: number;
  title: string;
  guide_type?: string;
  content?: string;
  target_audience?: string;
  is_published: boolean;
}

export interface ImprovementPlan {
  id: number;
  student_id: number;
  student_name?: string;
  plan_type?: string;
  subject_id?: number;
  target_score?: number;
  current_score?: number;
  plan_content?: string;
  progress: number;
  is_completed: boolean;
  start_date?: string;
  end_date?: string;
}

export interface StudyGuideCreateInput {
  class_id: number;
  title: string;
  guide_type?: string;
  content?: string;
  target_audience?: string;
}

export interface ImprovementPlanCreateInput {
  student_id: number;
  plan_type?: string;
  subject_id?: number;
  target_score?: number;
  current_score?: number;
  plan_content?: string;
  start_date?: string;
  end_date?: string;
}

export type AllTypes = {
  User: User;
  ScoreCategory: ScoreCategory;
  ScoreRule: ScoreRule;
  ScoreRecord: ScoreRecord;
  Device: Device;
  Approval: Approval;
  Notification: Notification;
  Admin: Admin;
  OperationLog: OperationLog;
  SystemConfig: SystemConfig;
  Exam: Exam;
  Subject: Subject;
  ClusterData: ClusterData;
  AlgorithmData: AlgorithmData;
  AlgorithmStatistics: AlgorithmStatistics;
  SeatingChart: SeatingChart;
  DutyGroup: DutyGroup;
  ClassCommittee: ClassCommittee;
  ParentContact: ParentContact;
  HomeworkAssignment: HomeworkAssignment;
  Attendance: Attendance;
  StudyGroup: StudyGroup;
  MentalHealthRecord: MentalHealthRecord;
  Activity: Activity;
  CultureRecord: CultureRecord;
  StudyGuide: StudyGuide;
};
