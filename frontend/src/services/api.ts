import logger from '../utils/logger';
import { downloadBlob } from '../utils/download';
// 导入持久化缓存工具
import { deleteCacheByPattern } from '../utils/cacheDB';
import { coalesceRequest, invalidateRequestCache } from '../utils/requestCoalescing';
import { performanceMonitor } from '../utils/performanceMonitor';
import { errorMonitor } from '../utils/errorMonitor';
import { performanceReportingService } from '../services/performanceReportingService';
import {
  Admin,
  Device,
  DevicePaginatedResponse,
  User,
  UserCreateInput,
  UserUpdateInput,
  UserPaginatedResponse,
  Notification,
  AlgorithmStatistics,
  ClusterData,
  WarningData,
  AlgorithmData,
  BatchPredictionData,
  BatchAnomalyData,
  RuleRecommendData,
  BatchScorePredictData,
  BatchRiskPredictData,
  ModelTrainingResult,
  ModelEvaluationResult,
  RiskStudent,
  PredictionResult,
  AnomalyResult,
  ScorePredictResult,
  RiskPredictResult,
  RiskSubRisk,
  ScoreAttributionResult,
  EngagementResult,
  EngagementRankResult,
  EngagementTrendResult,
  EngagementFactor,
  BatchAttributionResult,
  ExamAnalysis,
  ClassAnalysis,
  StudentScoreAnalysis,
  SeatingChart,
  SeatingChartCreateInput,
  DutyGroup,
  DutyGroupCreateInput,
  DutyAssignment,
  CommitteeCreateInput,
  ClassCommittee,
  CommitteeTerm,
  CommitteeTermCreateInput,
  ParentContact,
  ParentContactCreateInput,
  ContactLog,
  HomeworkAssignment,
  HomeworkCreateInput,
  Attendance,
  AttendanceRecordInput,
  AttendanceStats,
  LeaveApplyInput,
  LeaveApplication,
  StudyGroup,
  StudyGroupCreateInput,
  MentalHealthRecord,
  MentalHealthRecordCreateInput,
  MentalHealthAlert,
  Activity,
  ActivityCreateInput,
  CultureRecord,
  CultureCreateInput,
  StudyGuide,
  StudyGuideCreateInput,
  ImprovementPlan,
  ImprovementPlanCreateInput,
  TeacherComment,
  TeacherCommentCreateInput,
} from '../types';
import { config, getApiUrl, getCacheTtlByUrl } from '../config';

// 从统一配置模块读取API基础路径
const API_BASE_URL = getApiUrl();
const isDev = config.app.isDevelopment;

// T5: 后端信封/算法接口返回的原始 JSON（结构在运行时校验）。用于替代 any，
// 配合各 normalize* 函数的运行时兜底，既收敛类型又避免 any 扩散导致的静默错误。
type RawJson = Record<string, unknown>;

/** 统一响应信封 {success, code, data} 的最小结构（unwrapEnvelope 运行时判定用） */
interface EnvelopeShape {
  success?: boolean;
  code?: number;
  data?: unknown;
  message?: string;
}

/**
 * 算法/归一化函数读取的后端原始 JSON 形状。具名字段带具体类型（与运行时兜底配合），
 * 未知字段经索引签名为 unknown，避免 any 扩散。各 normalize* 以 RawAlg 读取后做运行时归一化。
 */
interface RawAlg {
  [key: string]: unknown;
  predicted_scores?: unknown[];
  current_score?: number;
  score?: number;
  trend?: string;
  confidence?: number;
  confidence_interval?: unknown;
  user_id?: number | string;
  name?: string;
  class_name?: string;
  features?: RawAlg;
  has_data?: boolean;
  total_change?: number;
  score_before?: number;
  score_after?: number;
  factors?: unknown[];
  summary?: string;
  error?: string;
  students?: unknown[];
  failed_students?: unknown[];
  rank?: number | null;
  level?: string;
  series?: unknown[];
  components?: RawAlg;
  weeks?: number;
  risk_factors?: unknown[];
  overall_risk_level?: string;
  overall_risk_score?: number;
  recommended_actions?: string[];
  intervention_suggestions?: string[];
  risk_details?: RawAlg;
  description?: string;
  anomalies?: unknown[];
  severity?: string;
  type?: string;
  anomaly_type_label?: string;
  details?: string;
  score_change?: number;
  date?: string;
  has_anomaly?: boolean;
  rule_name?: string;
  total?: number;
  predicted_score?: number;
  contribution?: number;
  direction?: string;
  delta?: number;
  factor?: string;
  key?: string;
  detail?: string;
  week_label?: string;
  week_end?: string;
  engagement_score?: number;
  attendance_rate?: number | null;
  homework_rate?: number | null;
  activity_rate?: number | null;
  leave_days?: number;
  subject?: string;
}

// ============================================
// 请求取消机制 - AbortController 管理
// ============================================
type AbortCallback = () => void;

// 使用 Map 存储多个 AbortController，支持并发请求
const abortControllers = new Map<string, AbortController>();
let currentAbortCallback: AbortCallback | null = null;

/**
 * 创建一个新的 AbortController
 * 每个请求使用独立的控制器，不再自动取消其他请求
 */
export const createAbortController = (): AbortController => {
  const controller = new AbortController();
  return controller;
};

/**
 * 注册请求的 AbortController，用于路由切换时取消
 */
export const registerAbortController = (key: string, controller: AbortController): void => {
  abortControllers.set(key, controller);
};

/**
 * 移除已完成或已取消的请求控制器
 */
export const removeAbortController = (key: string): void => {
  abortControllers.delete(key);
};

/**
 * 注册取消回调函数
 * 用于在路由切换时取消未完成的请求
 */
export const registerAbortCallback = (callback: AbortCallback): void => {
  currentAbortCallback = callback;
};

/**
 * 取消所有未完成的请求
 */
export const abortAllRequests = (): void => {
  abortControllers.forEach((controller) => {
    controller.abort();
  });
  abortControllers.clear();
  if (currentAbortCallback) {
    currentAbortCallback();
  }
};

/**
 * 获取当前是否已取消请求
 */
export const isRequestAborted = (): boolean => {
  return Array.from(abortControllers.values()).some((c) => c.signal.aborted);
};

interface CachedData {
  data: unknown;
  timestamp: number;
  etag?: string;
}

interface ErrorInfo {
  message: string;
  type: string;
  url: string;
  method: string;
  timestamp: number;
}

interface EtagEntry {
  etag: string;
  timestamp: number;
  ttl: number;
}

const ETAG_STORAGE_KEY = 'api_etag_cache';

const loadEtagCache = (): Map<string, EtagEntry> => {
  try {
    const stored = localStorage.getItem(ETAG_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const map = new Map<string, EtagEntry>();
      Object.entries(parsed).forEach(([key, value]) => {
        map.set(key, value as EtagEntry);
      });
      return map;
    }
  } catch (error) {
    logger.warn('加载ETag缓存失败:', error);
  }
  return new Map<string, EtagEntry>();
};

const saveEtagCache = (cache: Map<string, EtagEntry>): void => {
  try {
    const obj = Object.fromEntries(cache.entries());
    localStorage.setItem(ETAG_STORAGE_KEY, JSON.stringify(obj));
  } catch (error) {
    logger.warn('保存ETag缓存失败:', error);
  }
};

const etagCache = loadEtagCache();

const cleanupExpiredEtags = (): void => {
  const now = Date.now();
  let cleaned = false;
  etagCache.forEach((entry, key) => {
    if (now - entry.timestamp > entry.ttl) {
      etagCache.delete(key);
      cleaned = true;
    }
  });
  if (cleaned) {
    saveEtagCache(etagCache);
  }
};

setInterval(cleanupExpiredEtags, 60000);

const extractAndCacheEtag = (cacheKey: string, response: Response): void => {
  const etag = response.headers.get('ETag');
  if (etag) {
    const ttl = getCacheTTL(cacheKey.split(':')[1]) * 2;
    etagCache.set(cacheKey, {
      etag,
      timestamp: Date.now(),
      ttl,
    });
    saveEtagCache(etagCache);
  }
};

const getCachedEtag = (cacheKey: string): string | undefined => {
  cleanupExpiredEtags();
  const entry = etagCache.get(cacheKey);
  if (entry) {
    const now = Date.now();
    if (now - entry.timestamp <= entry.ttl) {
      return entry.etag;
    }
    etagCache.delete(cacheKey);
    saveEtagCache(etagCache);
  }
  return undefined;
};

const clearEtagCache = (url: string): void => {
  const baseUrl = url.split('?')[0];
  let cleared = false;
  etagCache.forEach((_, key) => {
    if (key.includes(baseUrl)) {
      etagCache.delete(key);
      cleared = true;
    }
  });
  if (cleared) {
    saveEtagCache(etagCache);
  }
};

export const clearAllEtagCache = (): void => {
  etagCache.clear();
  localStorage.removeItem(ETAG_STORAGE_KEY);
};

interface RequestOptions extends RequestInit {
  skipCache?: boolean;
  skipAuth?: boolean;
  skipDataExtract?: boolean;
}

interface ApiError extends Error {
  status?: number;
  errorData?: unknown;
  type?: string;
}

const setCurrentAdmin = (admin: Admin | null): void => {
  if (admin) {
    localStorage.setItem('admin', JSON.stringify(admin));
  } else {
    localStorage.removeItem('admin');
  }
};

const getCsrfToken = (): string | null => {
  const getCookie = (name: string): string | null => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
  };
  return getCookie('csrf_token');
};

export const getAuthHeaders = (extra: Record<string, string> = {}): Record<string, string> => {
  const headers: Record<string, string> = { ...extra };
  // 十评 P2-1 完全 cookie 化：token 走 HttpOnly cookie（credentials: include 自动携带），
  // 不再注入 Authorization 头（localStorage 不再存凭证，防 XSS 窃取）
  const csrfToken = getCsrfToken();
  if (csrfToken && !headers['X-CSRFToken']) {
    headers['X-CSRFToken'] = csrfToken;
  }
  return headers;
};

const fetchCsrfToken = async (): Promise<string | null> => {
  const token = getCsrfToken();
  if (token) {
    return token;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/admins/csrf-token`, {
      credentials: 'include',
    });
    if (response.ok) {
      const data = await response.json();
      if (data.csrf_token) {
        return data.csrf_token;
      }
    }
  } catch (error) {
    logger.warn('获取CSRF token失败:', error);
  }
  return null;
};

const clearStudentAuth = (): void => {
  localStorage.removeItem('student_token');
  localStorage.removeItem('student');
};

const clearAuthData = (): void => {
  localStorage.removeItem('admin');
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('subaccount');
  clearStudentAuth();
};

const cache = new Map<string, CachedData>();
let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;
let lastRefreshFailTime = 0;
const REFRESH_FAIL_COOLDOWN = 5000;

// ==================== 缓存一致性（系统性根治"幽灵资源"） ====================
// 幽灵资源根因：持久化缓存（indexedDB api-cache-db）残留已删除资源项，跨标签页/跨刷新
// 持续命中旧数据 → 列表显示已删项 → 反复操作反复 404。三层根治：
//  1) 启动时一次性清空遗留持久化缓存库（此后 GET 只写内存缓存，刷新即净）
//  2) 写请求成功后 localStorage 广播失效信号，所有标签页监听并同步清内存缓存（跨标签页一致）
//  3) 后端 cached_api 60s 缓存 + skip_cache=true BYPASS 已另案保证（见 MEMORY.md 缓存一致性铁律）
const CACHE_INVALIDATION_KEY = '__wb_api_cache_bust__';

/** 写请求成功后广播：所有标签页（含本页）清空内存缓存 */
const broadcastCacheInvalidation = (): void => {
  try {
    localStorage.setItem(CACHE_INVALIDATION_KEY, String(Date.now()));
  } catch {
    /* localStorage 不可用时静默 */
  }
};

/** 清空内存缓存 + ETag 缓存（跨标签页失效信号到达时） */
const clearAllMemoryCaches = (): void => {
  cache.clear();
  etagCache.forEach((_, key) => etagCache.delete(key));
  try {
    saveEtagCache(etagCache);
  } catch {
    /* 静默 */
  }
};

/** 一次性清空遗留持久化缓存库（indexedDB api-cache-db），幂等，失败静默 */
const purgeLegacyPersistentCache = (): void => {
  try {
    if (typeof indexedDB === 'undefined') return;
    const req = indexedDB.deleteDatabase('api-cache-db');
    req.onsuccess = () => {
      if (isDev) logger.log('[Cache] 遗留持久化缓存已清空（api-cache-db）');
    };
    req.onerror = () => {
      /* 删除失败静默（下次启动重试） */
    };
    req.onblocked = () => {
      /* 其他连接占用时静默等待 */
    };
  } catch {
    /* 静默 */
  }
};

if (typeof window !== 'undefined') {
  // 跨标签页失效信号监听：任一标签页写操作后，全部标签页清内存缓存
  window.addEventListener('storage', (event) => {
    if (event.key === CACHE_INVALIDATION_KEY) {
      clearAllMemoryCaches();
    }
  });
  // 启动清理遗留持久化缓存（幂等）
  purgeLegacyPersistentCache();
}
// ==================== 缓存一致性 END ====================

const AUTH_ENDPOINTS = [
  '/login',
  '/refresh-token',
  '/logout',
  '/csrf-token',
  '/register',
  '/reset-password',
];

const isAuthEndpoint = (url: string): boolean => {
  return AUTH_ENDPOINTS.some((ep) => url.includes(ep));
};

const getCacheKey = (url: string, method: string): string => {
  return `${method}:${url}`;
};

// 使用统一配置模块中的缓存TTL函数
const getCacheTTL = (url: string): number => {
  return getCacheTtlByUrl(url);
};

// 缓存依赖映射：写操作后清除相关列表缓存
const cacheDependencyMap: Record<string, string[]> = {
  '/api/exams': ['/api/exams'],
  '/api/users': ['/api/users'],
  '/api/rules': ['/api/rules'],
  '/api/rank': ['/api/rank'],
  '/api/admin-classes': ['/api/admin-classes', '/api/academics/classes', '/api/classes'],
  '/api/classes': ['/api/classes'],
  '/api/course-schedules': ['/api/course-schedules'],
  '/api/subjects': ['/api/subjects'],
  '/api/score-categories': ['/api/score-categories'],
  '/api/rank-rules': ['/api/rank-rules'],
  '/api/admins': ['/api/admins'],
  '/api/roles': ['/api/roles'],
  '/api/time-rules': ['/api/time-rules'],
  '/api/class-periods': ['/api/class-periods'],
  '/api/algorithm': ['/api/algorithm'],
  '/api/scores': ['/api/scores'],
  '/api/study-guide': ['/api/study-guide/guides', '/api/study-guide/plans'],
  '/api/attendance': ['/api/attendance/records'],
  '/api/duty': ['/api/duty/groups', '/api/duty/assignments'],
  '/api/committee': ['/api/committee/members'],
  '/api/records': ['/api/records'],
  // 写子路径 + 读集合路径组合（缺条目会致编辑/删除后 refetch 命中旧缓存显示旧数据）
  '/api/notify_templates': ['/api/notify_templates'],
  '/api/scheduled_notify': ['/api/scheduled_notify'],
  '/api/study-group': ['/api/study-group'],
  '/api/seating/charts': ['/api/seating/charts'],
  '/api/parent/contacts': ['/api/parent/contacts'],
  '/api/parent/logs': ['/api/parent/logs'],
  '/api/homework/assignments': ['/api/homework/assignments'],
  '/api/mental-health/records': ['/api/mental-health/records'],
  '/api/activity': ['/api/activity'],
  '/api/culture/records': ['/api/culture/records'],
  '/api/wol/devices': ['/api/wol/devices'],
  '/api/firmware': ['/api/firmware'],
  '/api/phonebox-policy': ['/api/phonebox-policy'],
};

const clearRelatedCache = async (url: string): Promise<void> => {
  const baseUrl = url.split('?')[0];

  const relatedPatterns = new Set<string>([baseUrl]);

  for (const [pattern, dependencies] of Object.entries(cacheDependencyMap)) {
    if (baseUrl.includes(pattern)) {
      dependencies.forEach((dep) => relatedPatterns.add(dep));
    }
  }

  const patternsArray = Array.from(relatedPatterns);

  // 清除内存缓存
  const keysToDelete: string[] = [];
  for (const key of cache.keys()) {
    if (patternsArray.some((pattern) => key.includes(pattern))) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach((key) => cache.delete(key));

  // 清除ETag缓存
  clearEtagCache(baseUrl);

  // 清除持久化缓存
  for (const pattern of patternsArray) {
    await deleteCacheByPattern(pattern);
  }
};

const errorMessages: Record<number, string> = {
  400: '请求参数错误，请检查输入内容',
  401: '未授权，请登录',
  403: '您没有权限执行此操作',
  404: '请求的资源不存在',
  422: '数据验证失败，请检查输入内容',
  429: '请求过于频繁，请稍后再试',
  500: '服务器内部错误，请稍后重试',
  502: '服务器暂时不可用，请稍后重试',
  503: '服务维护中，请稍后重试',
  504: '请求超时，请检查网络或稍后重试',
};

// M2：按 error_code 查友好文案（后端已约定统一信封的 error_code 字段）。
// 优先级高于后端 message——业务码文案保证稳定可预期。
const errorCodeMessages: Record<string, string> = {
  BAD_REQUEST: '请求参数错误，请检查输入内容',
  VALIDATION_ERROR: '数据校验失败，请检查输入内容',
  NOT_FOUND: '请求的资源不存在',
  UNAUTHORIZED: '未授权，请登录',
  FORBIDDEN: '您没有权限执行此操作',
  INSUFFICIENT_PERMISSION: '您没有权限执行此操作',
  INTERNAL_ERROR: '服务器内部错误，请稍后重试',
  UNCAUGHT_EXCEPTION: '服务器内部错误，请稍后重试',
  DATABASE_ERROR: '数据操作失败，请稍后重试',
  BUSINESS_ERROR: '操作失败，请稍后重试',
  RATE_LIMITED: '请求过于频繁，请稍后再试',
  METHOD_NOT_ALLOWED: '请求方法不被允许',
  CSRF_ERROR: '安全校验失败，请刷新页面后重试',
  TOKEN_EXPIRED: '登录状态已过期，请重新登录',
  TOKEN_INVALID: '登录状态已失效，请重新登录',
  FILE_TOO_LARGE: '文件过大，无法上传',
  FILE_TYPE_UNSUPPORTED: '不支持的文件类型',
  DUPLICATE_RECORD: '记录已存在，请勿重复提交',
};

// M2：识别"技术性/内部错误"文案——Python 异常、SQL、文件路径、调试信息等。
// 命中即不透传给用户（技术详情仅进控制台日志），用 HTTP 状态兜底文案。
const TECHNICAL_ERROR_PATTERNS: RegExp[] = [
  /Traceback/i,
  /(IntegrityError|OperationalError|SQLAlchemyError|ProgrammingError|DataError|DatabaseError)/i,
  /(sqlite|sqlalchemy|psycopg|pymysql|mysql)/i,
  /(no such table|no such column|unknown column|table .* does not exist|unable to open database)/i,
  /(KeyError|TypeError|ValueError|AttributeError|NameError|IndexError|ZeroDivisionError|RuntimeError|OverflowError)/i,
  /\.py[:\s]+line\s+\d+/i,
  /\bFile\s+"[^"]+"\s*,\s*line\s+\d+/i,
  /^<class\s+'[^']+'/i,
  /^(Error|Exception|Traceback):/i,
  /(\d{1,3}\.){3}\d{1,3}(:\d+)?/,
];

const looksLikeTechnicalError = (message: string): boolean =>
  TECHNICAL_ERROR_PATTERNS.some((pattern) => pattern.test(message));

export const getErrorMessage = (status: number, errorData: unknown): string => {
  const error = errorData as
    | { message?: string; error?: string; error_code?: string }
    | null;
  // 1) error_code 命中友好文案表 → 直接展示（最高优先级）
  if (error?.error_code && errorCodeMessages[error.error_code]) {
    return errorCodeMessages[error.error_code];
  }
  // 2) 后端 message 存在且不像技术报错 → 透传业务文案
  const rawMessage = error?.message || error?.error;
  if (rawMessage && !looksLikeTechnicalError(rawMessage)) {
    return rawMessage;
  }
  if (rawMessage && looksLikeTechnicalError(rawMessage)) {
    // 技术详情只进日志，不直吐用户
    logger.warn(`[API] 技术性错误已屏蔽: ${rawMessage}`);
  }
  // 3) 兜底：HTTP 状态码友好文案
  return errorMessages[status] || `请求失败 (${status})`;
};

const handleApiError = (error: Error, url: string, method: string): ErrorInfo => {
  // API 错误是业务常态（超时/4xx/网络），用 warn 记录而非 error——
  // 避免 errorMonitor 的 console.error 钩子把每个轮询周期失败都当作
  // 前端错误上报（真实故障已由 errorMonitor.reportApiError 单独上报）。
  logger.warn(`API Error [${method}] ${url}:`, error);

  const errorInfo: ErrorInfo = {
    message: error.message,
    type: 'api_error',
    url,
    method,
    timestamp: Date.now(),
  };

  return errorInfo;
};

export { abortControllers };

const refreshToken = async (): Promise<void> => {
  const now = Date.now();
  if (now - lastRefreshFailTime < REFRESH_FAIL_COOLDOWN) {
    throw new Error('登录状态已失效，请重新登录');
  }

  if (isRefreshing && refreshPromise) {
    await refreshPromise;
    return;
  }

  const adminStr = localStorage.getItem('admin');
  // 十评 P2-1：凭 HttpOnly refresh_token cookie 刷新（admin 信息仅作登录态 marker，非凭证）
  if (!adminStr) {
    lastRefreshFailTime = Date.now();
    clearAuthData();
    throw new Error('登录状态已失效，请重新登录');
  }

  isRefreshing = true;

  refreshPromise = new Promise(async (resolve, reject) => {
    try {
      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        headers['X-CSRFToken'] = csrfToken;
      }

      // refresh_token 由后端从 HttpOnly cookie 读取（admins_routes 已 cookie 优先）
      const fetchOptions: RequestInit = {
        method: 'POST',
        headers,
        credentials: 'include',
      };

      const response = await fetch(`${API_BASE_URL}/api/admins/refresh-token`, fetchOptions);

      if (!response.ok) {
        lastRefreshFailTime = Date.now();
        const errorData = await response.json().catch(() => ({}));
        throw new Error((errorData as { message?: string }).message || '刷新令牌失败');
      }

      // 新 token 由后端 Set-Cookie 自动写入 HttpOnly cookie，前端无需存储
      resolve('');
    } catch (error) {
      lastRefreshFailTime = Date.now();
      clearAuthData();
      reject(error);
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  });

  await refreshPromise;
};

const fetchWithTimeout = async (
  url: string,
  options: RequestInit = {},
  timeout = 30000,
  signal?: AbortSignal
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    // 如果传入了外部 signal，监听其 abort 事件
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    // 检查是否是主动取消的请求（路由切换等原因）
    if ((error as Error).name === 'AbortError') {
      // 如果是超时导致的取消，抛出超时错误
      if (signal?.aborted) {
        const timeoutError = new Error('请求被取消（可能是页面切换）') as ApiError;
        timeoutError.type = 'cancelled';
        throw timeoutError;
      }
      // 否则抛出取消错误
      const cancelledError = new Error('请求超时，请检查网络或稍后重试') as ApiError;
      cancelledError.status = 504;
      throw cancelledError;
    }
    throw error;
  }
};

/**
 * 从统一响应信封 {success, code, data} 中取出业务数据。
 * 逻辑与历史三处内联实现保持一致，抽出为单一函数以避免重复并集中维护：
 *   - skipDataExtract：原样返回（调用方自行判断 success）
 *   - success === false（HTTP 2xx 但业务失败）：抛 ApiError，避免调用方把失败当成功
 *   - success/data 均存在：返回 data
 *   - 其他：原样返回
 * 注：部分接口（如导入）返回 200 + success:false + data 错误明细，此类调用方
 * 应使用 skipDataExtract: true 拿到完整信封自行处理；默认路径按业务失败抛错。
 */
/**
 * 从统一响应信封 {success, code, data} 中取出业务数据（**单一真相源**，全前端共用）。
 * 逻辑与历史三处内联实现保持一致，抽出为单一函数以避免重复并集中维护：
 *   - skipDataExtract：原样返回（调用方自行判断 success）
 *   - success === false（HTTP 2xx 但业务失败）：抛 ApiError，避免调用方把失败当成功
 *   - success/data 均存在：返回 data
 *   - 其他：原样返回
 * 注：部分接口（如导入）返回 200 + success:false + data 错误明细，此类调用方
 * 应使用 skipDataExtract: true 拿到完整信封自行处理；默认路径按业务失败抛错。
 */
export const unwrapEnvelope = (rawData: unknown, skipDataExtract?: boolean): unknown => {
  if (skipDataExtract) {
    return rawData;
  }
  const env = rawData as EnvelopeShape;
  if (env && env.success === false) {
    const apiError = new Error(env.message || '操作失败') as ApiError;
    apiError.status = 200;
    apiError.type = 'business';
    apiError.errorData = rawData;
    throw apiError;
  }
  if (env && env.success !== undefined && env.data !== undefined) {
    return env.data;
  }
  return rawData;
};

/**
 * 非抛出版本：解析信封，业务失败（success:false）或解析异常时返回 null。
 * 供只读/展示型页面（OpsCenter / SecurityAudit / SystemMetrics / Diagnostics /
 * FrontendTelemetry 等）复用同一信封契约，消除各页重复实现导致的"假成功"漂移。
 * 与 unwrapEnvelope 语义一致：成功取 data，失败/异常归 null，无 success 字段的
 * 直出对象原样返回。
 */
export const parseEnvelopeSafe = <T = unknown>(rawData: unknown): T | null => {
  try {
    return (unwrapEnvelope(rawData) ?? null) as T | null;
  } catch {
    return null;
  }
};

const executeRequest = async (
  url: string,
  options: RequestOptions,
  retryCount: number,
  cacheKey: string,
  abortController: AbortController
): Promise<unknown> => {
  const startTime = performance.now();
  const method = options.method || 'GET';
  const perfId = performanceMonitor.start(`${method} ${url}`, 'api');
  let responseStatus = 0;

  try {
    const isFormData = options.body instanceof FormData;
    const headers: Record<string, string> = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers as Record<string, string>),
    };

    if (!options.skipAuth) {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        headers['X-CSRFToken'] = csrfToken;
      }

      // token 走 HttpOnly cookie（credentials: include），此处不再注入 Authorization
    }

    if (method === 'GET' && !options.skipCache) {
      const cachedEtag = getCachedEtag(cacheKey);
      if (cachedEtag) {
        headers['If-None-Match'] = cachedEtag;
      }
    }

    const fullUrl = url.startsWith('/') ? `${API_BASE_URL}${url}` : url;

    const response = await fetchWithTimeout(
      fullUrl,
      {
        ...options,
        headers,
        credentials: 'include',
      },
      config.api.timeout,
      abortController.signal
    );

    if (response.status === 304) {
      const cached = cache.get(cacheKey);
      if (cached) {
        if (isDev) {
          logger.log(`[API] ${method} ${url} - 304 Not Modified (使用缓存)`);
        }
        return cached.data;
      }
      const persistentCache = null; // 持久化缓存已废弃（幽灵数据根源），304 仅依赖内存缓存
      if (persistentCache) {
        if (isDev) {
          logger.log(`[API] ${method} ${url} - 304 Not Modified (使用持久化缓存)`);
        }
        return persistentCache.data;
      }
      throw new Error('304响应但没有缓存数据');
    }

    if (!response.ok) {
      if (response.status === 401 && retryCount < 1 && !isAuthEndpoint(url) && !options.skipAuth) {
        const adminStr = localStorage.getItem('admin');
        // 十评 P2-1：凭证在 HttpOnly cookie，admin 仅作登录态 marker
        if (!adminStr) {
          const studentStr = localStorage.getItem('student');
          if (studentStr) {
            clearStudentAuth();
            const apiError = new Error('登录状态已失效，请重新登录') as ApiError;
            apiError.status = 401;
            setTimeout(() => {
              // S2: HashRouter 下必须带 #，否则整页加载服务器路径落到 404
              window.location.hash = '#/student/login';
            }, 50);
            throw apiError;
          }
          clearAuthData();
          const apiError = new Error('登录状态已失效，请重新登录') as ApiError;
          apiError.status = 401;
          setTimeout(() => {
            // S4 修复: HashRouter 下必须带 #，否则整页落到服务器 /login → 404
            window.location.hash = '#/login';
          }, 50);
          throw apiError;
        }
        try {
          await refreshToken();
          // 刷新后新 token 已在 HttpOnly cookie，重试请求凭 credentials: include 携带
          const retryResponse = await fetchWithTimeout(
            fullUrl,
            {
              ...options,
              headers,
              credentials: 'include',
            },
            config.api.timeout,
            abortController.signal
          );

          if (!retryResponse.ok) {
            const error = await retryResponse.json().catch(() => ({}));
            const errorMsg = getErrorMessage(retryResponse.status, error);
            const apiError = new Error(errorMsg) as ApiError;
            apiError.status = retryResponse.status;
            throw apiError;
          }

          const rawData = await retryResponse.json();
          const data = unwrapEnvelope(rawData, options.skipDataExtract);

          if (method === 'GET') {
            cache.set(cacheKey, { data, timestamp: Date.now() });
          } else {
            await clearRelatedCache(url);
            invalidateRequestCache(url);
            broadcastCacheInvalidation();
          }

          return data;
        } catch (refreshError) {
          const studentStr = localStorage.getItem('student');
          if (studentStr) {
            clearStudentAuth();
            setTimeout(() => {
              // S2: HashRouter 下必须带 #，否则整页加载服务器路径且 hash 丢失 → 卡空白页
              window.location.hash = '#/student/login';
            }, 100);
          } else {
            clearAuthData();
            setTimeout(() => {
              window.location.hash = '#/login';
            }, 100);
          }
          const apiError = new Error('登录状态已失效，请重新登录') as ApiError;
          apiError.status = 401;
          throw apiError;
        }
      }

      const error = await response.json().catch(() => ({}));

      if (
        (response.status === 400 || response.status === 419) &&
        ((error as { message?: string }).message?.includes('CSRF') ||
          (error as { message?: string }).message?.includes('csrf') ||
          (error as { message?: string }).message?.includes('token'))
      ) {
        if (retryCount < 1 && !isAuthEndpoint(url)) {
          await fetchCsrfToken();
          const newCsrfToken = getCsrfToken();
          if (newCsrfToken) {
            headers['X-CSRFToken'] = newCsrfToken;
            const retryResponse = await fetchWithTimeout(
              fullUrl,
              {
                ...options,
                headers,
              },
              config.api.timeout,
              abortController.signal
            );

            if (!retryResponse.ok) {
              const retryError = await retryResponse.json().catch(() => ({}));
              const errorMsg = getErrorMessage(retryResponse.status, retryError);
              const apiError = new Error(errorMsg) as ApiError;
              apiError.status = retryResponse.status;
              throw apiError;
            }

            const rawData = await retryResponse.json();
            const data = unwrapEnvelope(rawData, options.skipDataExtract);

            if (method === 'GET') {
              cache.set(cacheKey, { data, timestamp: Date.now() });
            } else {
              await clearRelatedCache(url);
              invalidateRequestCache(url);
              broadcastCacheInvalidation();
            }

            return data;
          }
        }
      }

      const errorMsg = getErrorMessage(response.status, error);
      // 404 资源不存在（如 DELETE 已删除的科目）→ 清理相关缓存，清除残留的"幽灵"资源项
      // （否则列表缓存持续包含已删除项，用户反复删反复 404）
      if (method !== 'GET' && response.status === 404) {
        await clearRelatedCache(url);
        invalidateRequestCache(url);
        broadcastCacheInvalidation();
      }
      const apiError = new Error(errorMsg) as ApiError;
      apiError.status = response.status;
      apiError.errorData = error;
      throw apiError;
    }

    responseStatus = response.status;
    const responseTime = performance.now() - startTime;
    performanceReportingService.reportApiRequest(url, method, responseTime, responseStatus);

    if (isDev) {
      logger.log(`[API] ${method} ${url} - ${responseTime.toFixed(2)}ms`);
    }

    const rawData = await response.json();

    const data = unwrapEnvelope(rawData, options.skipDataExtract);

    if (method === 'GET') {
      extractAndCacheEtag(cacheKey, response);

      // 只写内存缓存（不再写持久化 cacheDB——其残留项是"幽灵资源"反复 404 的根源；
      // 刷新即净，配合后端 cached_api 60s + skip_cache BYPASS 保证一致性）
      cache.set(cacheKey, { data, timestamp: Date.now() });
    } else {
      await clearRelatedCache(url);
      invalidateRequestCache(url);
      broadcastCacheInvalidation();
    }

    return data;
  } catch (error) {
    const apiError = error as ApiError;
    if (apiError.type === 'cancelled') {
      logger.debug(`[API] 请求已取消: ${method} ${url}`);
      if (method === 'GET') {
        const cached = cache.get(cacheKey);
        if (cached) {
          return cached.data;
        }
      }
      return null;
    }

    if ((error as Error).name === 'TypeError' && (error as Error).message === 'Failed to fetch') {
      const networkError = new Error('网络连接失败，请检查网络或服务器是否可用') as ApiError;
      networkError.type = 'network';
      throw networkError;
    }
    if (
      (error as Error).message.includes('NetworkError') ||
      (error as Error).message.includes('net::ERR')
    ) {
      const networkError = new Error('网络错误，请检查服务器连接') as ApiError;
      networkError.type = 'network';
      throw networkError;
    }

    handleApiError(error as Error, url, method);
    performanceMonitor.recordError(`${method} ${url}`);

    const errorToReport = error as ApiError;
    if (errorToReport.type !== 'cancelled') {
      errorMonitor.reportApiError(url, method, errorToReport.status || 0, errorToReport.message);
    }

    throw error;
  } finally {
    performanceMonitor.end(perfId);
    removeAbortController(cacheKey);
  }
};

const request = async (
  url: string,
  options: RequestOptions = {},
  retryCount = 0
): Promise<unknown> => {
  const method = options.method || 'GET';
  const cacheKey = getCacheKey(url, method);

  const abortController = createAbortController();
  registerAbortController(cacheKey, abortController);

  const isAuth = isAuthEndpoint(url);

  if (method === 'GET' && !options.skipCache && !isAuth) {
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < getCacheTTL(url)) {
        return cached.data;
      }
      cache.delete(cacheKey);
    }
  }

  const fetcher = () => executeRequest(url, options, retryCount, cacheKey, abortController);

  if (method === 'GET' && !options.skipCache && !isAuth) {
    return coalesceRequest({ url, method }, fetcher, getCacheTTL(url));
  }

  return fetcher();
};

interface UserParams {
  page?: number;
  per_page?: number;
  search?: string;
  class_name?: string;
  class_id?: number;
  skipCache?: boolean;
  keyword?: string;
  min_score?: number;
  max_score?: number;
  sort_by?: string;
  sort_order?: string;
}

interface RulesParams {
  page?: number;
  per_page?: number;
  category_id?: number;
  is_active?: boolean | null;
}

interface ScoreRecordParams {
  page?: number;
  per_page?: number;
}

export interface TimeRule {
  id: number;
  name: string;
  description: string;
  day_of_week: number;
  start_hour: number;
  start_minute: number;
  end_hour: number;
  end_minute: number;
  is_active: boolean;
  allow_unlock: boolean;
}

/** 手机箱预设允许时段（与后端 services/phonebox_policy._now_in_windows 对应） */
export interface UnlockWindow {
  day: number; // -1=每天，0~6=周一~周日
  start_hour: number;
  start_minute: number;
  end_hour: number;
  end_minute: number;
}

/** 班主任手机箱开箱策略（api/phonebox/phonebox_policy_routes.py 返回结构） */
export interface PhoneBoxPolicy {
  class_info_id: number;
  exists: boolean;
  allow_self_unlock: boolean;
  unlock_windows: UnlockWindow[];
  override_until: string | null;
  override_active: boolean;
  updated_by: number | null;
  updated_at: string | null;
}

export interface ClassPeriod {
  id: number;
  name: string;
  period_number: number;
  start_hour: number;
  start_minute: number;
  end_hour: number;
  end_minute: number;
  duration: number;
  description: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

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
  classroom: string;
  description: string;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** GET /api/course-schedules/now 返回的班级实时上课状态 */
export interface ClassNowStatus {
  /** 是否处于全局 TimeRule 限制时段（全校级） */
  is_during_class_time: boolean;
  /** 命中的全局时间规则（未命中为 null） */
  global_rule: {
    id?: number;
    name?: string;
    start?: string;
    end?: string;
    allow_unlock?: boolean;
  } | null;
  /** 当前所处节次（不在任何节次时间窗内为 null） */
  period: { period_number: number; name: string; start: string; end: string } | null;
  /** 指定班级此刻是否在上课（含自习） */
  in_session: boolean;
  /** 是否有任意班级此刻在上课——广播类下发的拦截依据 */
  any_in_session: boolean;
  class_info_id: number | null;
  class_name: string;
  subject_name: string;
  now: string;
}

interface TimeRuleData {
  name: string;
  description: string;
  day_of_week: number;
  start_hour: number;
  start_minute: number;
  end_hour: number;
  end_minute: number;
  is_active: boolean;
  allow_unlock: boolean;
}

export interface Category {
  id: number;
  name: string;
  description: string;
  color: string;
  is_active: boolean;
}

export interface ClassInfo {
  id: number;
  name: string;
  grade: string;
  description: string;
  head_teacher_id: number | null;
  head_teacher_name: string | null;
  student_count: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ClassListResponse {
  classes: ClassInfo[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    pages: number;
  };
}

export interface Subject {
  id: number;
  name: string;
  code: string | null;
  grade: string | null;
  description: string;
  color: string;
  class_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubjectClassLink {
  id: number;
  class_info_id: number;
  class_name: string;
  class_grade: string;
  grade?: string;
  teacher_id: number | null;
  teacher_name: string | null;
  created_at: string;
}

export interface ClassCreateData {
  name: string;
  grade: string;
  description: string;
  is_active?: boolean;
}

export interface PermissionLog {
  id: number;
  action: string;
  target_type: string;
  description: string;
  ip_address: string;
  created_at: string;
}

interface Rule {
  id: number;
  name: string;
  description: string;
  category_id: number | null;
  score: number;
  is_active: boolean;
  max_per_day: number;
  min_interval: number;
  daily_limit?: number;
  score_min?: number;
  score_max?: number;
}

export interface RankRule {
  id: number;
  name: string;
  min_score: number;
  max_score: number;
  rank: number;
  description: string;
  color: string;
  icon: string;
  is_active: boolean;
  unlock_min_score: number | null;
  weekly_unlock_limit: number | null;
}

export interface ScoreRecordItem {
  id: number;
  user_id: number;
  rule_id?: number;
  score?: number;
  score_change?: number;
  description: string;
  created_at: string;
  admin_id?: number;
  operator?: string;
}

/** 学生自助端登录后返回的学生信息 */
export interface StudentInfo {
  id: number;
  name: string;
  card_id: string;
  gender?: string | null;
  class_info_id?: number | null;
  class_name?: string | null;
  current_score: number;
  is_active: boolean;
}

/** 学生收到的通知 */
export interface NotificationItem {
  id: number;
  title: string | null;
  content: string | null;
  type: string | null;
  status: string | null;
  created_at: string | null;
}

/** 学生请假申请 */
export interface LeaveItem {
  id: number;
  student_id: number;
  leave_type: string | null;
  start_date: string | null;
  end_date: string | null;
  reason: string | null;
  status: string | null;
  approved_at: string | null;
  created_at: string | null;
}

/** 手机箱自助开箱申请结果 */
export interface PhoneboxUnlockResult {
  allowed: boolean;
  decision: string;
  reason: string | null;
  override_until: string | null;
  dispatched: boolean;
}

/** 学生积分排行榜单项 */
export interface StudentRankItem {
  user_id: number;
  name: string;
  class_name: string | null;
  current_score: number;
  unlock_count_30d: number;
  daily_unlock_limit: number;
  remaining_unlock: number;
}

/** 班级积分排行榜单项 */
export interface ClassRankItem {
  class_name: string;
  student_count: number;
  total_score: number;
  avg_score: number;
  unlock_count_30d: number;
  unlock_cost_30d: number;
}

/** 学生自助端：本人班级排名结果 */
export interface MyRankResult {
  class_name: string | null;
  my_rank: number | null;
  my_score: number;
  total_students: number;
  ranking: StudentRankItem[];
}

/* ===== 学生自助端：算法洞察聚合（我的成长） ===== */
export interface StudentEngagementInsight {
  has_data: boolean;
  engagement_score: number;
  level: 'low' | 'medium' | 'high';
  error?: string;
  factors?: Array<{ name: string; value: number; weight: number; contribution: number }>;
  components?: {
    attendance_rate?: number | null;
    homework_rate?: number | null;
    activity_rate?: number | null;
    leave_days?: number;
  };
  description?: string;
}
export interface StudentRiskInsight {
  overall_risk_level?: 'low' | 'medium' | 'high';
  overall_risk_score?: number;
  overall_risk_name?: string;
  error?: string;
  risk_factors?: Array<{ factor: string; description: string }>;
  intervention_suggestions?: string[];
  recommended_actions?: string[];
}
export interface StudentScoreTrendPoint {
  week_index: number;
  score_change: number;
}
export interface StudentParticipationTrendPoint {
  week_index: number;
  week_label?: string;
  week_end?: string;
  engagement_score: number;
  level?: 'low' | 'medium' | 'high';
  has_data?: boolean;
}
export interface StudentParticipationTrend {
  user_id: number;
  weeks: number;
  trend: 'up' | 'down' | 'stable';
  error?: string;
  series: StudentParticipationTrendPoint[];
}
export interface StudentInsight {
  student: StudentInfo;
  engagement: StudentEngagementInsight;
  risk: StudentRiskInsight;
  score_trend: StudentScoreTrendPoint[];
  participation_trend?: StudentParticipationTrend;
  days: number;
  weeks: number;
}

/** 教师效率：批量录分单项 */
export interface BatchScoreItem {
  student_id?: number;
  card_id?: string;
  subject: string;
  score: number | string;
  full_score?: number;
  remark?: string;
}

/** 教师效率：批量录分结果 */
export interface BatchScoreResult {
  created: number;
  errors: Array<{ index: number; message: string }>;
  total: number;
}

/** 教师效率：群发通知结果 */
export interface BatchNotifyResult {
  sent: number;
  errors: Array<{ user_id: number; message: string }>;
  total: number;
}

interface Role {
  id: number;
  name: string;
  permissions: string[];
}

interface MQTTConfig {
  broker: string;
  port: number;
  client_id?: string;
  username?: string;
  password?: string;
  ssl: boolean;
  timeout?: number;
  keepalive?: number;
}

interface MQTTStatus {
  connected: boolean;
  broker: string;
  uptime: number;
  subscribed_topics?: string[];
}

interface MQTTLog {
  id: number;
  level: string;
  message: string;
  timestamp: string;
  topic?: string;
  direction?: string;
}

export interface SystemConfig {
  system_name?: string;
  system_logo?: string;
  default_score?: number;
  min_score?: number;
  max_score?: number;
  enable_notifications?: boolean;
  notification_sound?: boolean;
  auto_save?: boolean;
  theme?: string;
  language?: string;
  max_score_per_day?: number;
  min_interval_seconds?: number;
  enable_auto_backup?: boolean;
  backup_retention_days?: number;
}

export interface BackupInfo {
  filename: string;
  size: number;
  created_at: string;
  modified?: string;
}

interface OperationLog {
  id: number;
  operation_type: string;
  target_type: string;
  description: string;
  operator: string;
  ip_address: string;
  created_at: string;
}

export interface OperationLogListResponse {
  data: OperationLog[];
  total: number;
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

export interface NotifyTemplate {
  id: number;
  name: string;
  text: string;
  volume?: number;
  speak?: boolean;
  popup?: boolean;
  timeout_sec?: number;
  urgent?: boolean;
  bg_color?: string;
  text_color?: string;
  font_size?: number;
  language?: string;
  category?: string;
  tags?: string[];
  usage_count?: number;
  created_at?: string;
}

export interface AdminNotification {
  id: number;
  admin_id?: number;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  priority: 'high' | 'medium' | 'low';
  is_read: boolean;
  extra_data?: Record<string, unknown>;
  created_at: string;
  read_at?: string;
}

export interface ScheduledNotify {
  id: number;
  text: string;
  volume?: number;
  speak?: boolean;
  popup?: boolean;
  timeout_sec?: number;
  urgent?: boolean;
  send_mode?: string;
  device_id?: string;
  scheduled_at: string;
  repeat_type?: string;
  repeat_interval?: number;
  repeat_day_of_week?: number[];
  repeat_end_at?: string;
  status?: string;
  last_sent_at?: string;
  next_send_at?: string;
  created_at?: string;
}

export interface NotifyHistory {
  id: number;
  text: string;
  volume?: number;
  speak?: boolean;
  popup?: boolean;
  timeout_sec?: number;
  urgent?: boolean;
  send_mode?: string;
  device_id?: string;
  topic?: string;
  status?: string;
  sent_by?: number;
  created_at?: string;
}

/** 发送前预览名单中的单个设备（最近活跃设备采样） */
export interface RemoteNotifyPreviewSample {
  device_id: string;
  class_name: string | null;
  last_seen: string | null;
}

/** GET /api/remote_notify/preview 返回的在线预览（发送前防误发） */
export interface RemoteNotifyPreview {
  total_devices: number;
  online_count: number;
  online_sample: RemoteNotifyPreviewSample[];
  cutoff_minutes: number;
}

export interface Firmware {
  id: number;
  version: string;
  file_path?: string;
  file_size?: number;
  md5?: string;
  description?: string;
  min_compatible_version?: string;
  is_mandatory: boolean;
  is_active: boolean;
  created_at: string;
}

export interface FirmwareRecord {
  id: number;
  device_id: string;
  device_name?: string;
  from_version?: string;
  to_version: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
  error_message?: string;
}

export interface OTAStatus {
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

export interface Exam {
  id: number;
  name: string;
  date: string;
  class_name: string;
  subject: string;
  description?: string;
  created_at: string;
  status?: 'draft' | 'published' | 'closed';
  start_time?: string;
  end_time?: string;
  subjects?: string | string[];
  subject_ids?: number[];
  subject_details?: Array<{
    id: number;
    name: string;
    full_score: number;
    order: number;
  }>;
}

interface Approval {
  id: number;
  user_id: number;
  user_name?: string;
  title: string;
  description: string;
  type: 'score_adjust' | 'special_reward' | 'other';
  score_change?: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  approve_time?: string;
  comment?: string;
}

/** 批量审批返回的逐条结果与汇总 */
export interface BatchApprovalResult {
  results: Array<{ id: number; success: boolean; message: string }>;
  success_count: number;
  failed_count: number;
}

export interface Alert {
  id: number;
  device_id: string;
  device_name: string | null;
  alert_type?: string;
  message: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  is_resolved?: boolean;
  is_read?: boolean;
  source?: string;
  created_at: string;
  resolved_at?: string;
}

export interface Heartbeat {
  id?: number;
  device_id: string;
  timestamp: string;
  status: 'online' | 'offline' | string;
  battery_level?: number;
  signal_strength?: number;
}

export interface DeviceGroup {
  id: number;
  name: string;
  description: string;
  location: string;
  icon: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  device_count: number;
  created_at: string;
  updated_at: string;
}

export interface DeviceInGroup {
  id: number;
  device_id: string;
  device: {
    id: number;
    device_id: string;
    name: string;
    status: string;
    is_online?: boolean;
  } | null;
  added_at: string;
}

export interface DeviceGroupDetail extends DeviceGroup {
  devices: DeviceInGroup[];
}

export interface DeviceGroupStats {
  group_id: number;
  group_name: string;
  location: string;
  total_devices: number;
  online_devices: number;
  offline_devices: number;
}

export interface DashboardData {
  total_users: number;
  total_admins: number;
  total_rules: number;
  total_devices: number;
  online_devices: number;
  today_records: number;
  weekly_records: number;
  avg_score: number;
  top_users: { id: number; name: string; class_name: string; current_score: number }[];
  category_stats: { rule_id: number; total_score: number }[];
}

export interface FieldMapping {
  source_field: string;
  target_field: string;
  field_type: string;
  required: boolean;
  relation?: string;
  default_value?: unknown;
}

export interface ValidationRule {
  field: string;
  rule_type: string;
  params?: Record<string, unknown>;
  message?: string;
}

export interface ImportConfig {
  id: number;
  module_name: string;
  config_name: string;
  field_mappings: FieldMapping[];
  validation_rules: ValidationRule[];
  conflict_strategy: string;
  default_values: Record<string, unknown>;
  is_active: boolean;
  is_default: boolean;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface ImportConfigInput {
  config_name: string;
  module_name: string;
  field_mappings: FieldMapping[];
  validation_rules: ValidationRule[];
  conflict_strategy: string;
  default_values?: Record<string, unknown>;
  is_active?: boolean;
  description?: string;
}

export interface Api {
  dashboard: {
    getData: () => Promise<DashboardData>;
  };
  users: {
    getAll: (params?: UserParams) => Promise<UserPaginatedResponse>;
    getById: (id: number) => Promise<User>;
    create: (data: UserCreateInput) => Promise<User>;
    update: (id: number, data: UserUpdateInput) => Promise<User>;
    delete: (id: number) => Promise<void>;
    getByCard: (cardId: string) => Promise<User>;
    toggleActive: (id: number) => Promise<{ is_active: boolean }>;
    import: (data: unknown[]) => Promise<{ imported: number }>;
    batchDelete: (ids: number[]) => Promise<void>;
    batchUpdateScore: (ids: number[], scoreChange: number, description: string) => Promise<void>;
    downloadTemplate: () => string;
  };
  scoreCategories: {
    getAll: () => Promise<Category[]>;
    create: (data: Partial<Category>) => Promise<Category>;
    update: (id: number, data: Partial<Category>) => Promise<Category>;
    delete: (id: number) => Promise<void>;
  };
  rules: {
    getAll: (
      params?: RulesParams
    ) => Promise<{ rules: Rule[]; total: number; pages: number } | Rule[]>;
    create: (data: Partial<Rule>) => Promise<Rule>;
    update: (id: number, data: Partial<Rule>) => Promise<Rule>;
    delete: (id: number) => Promise<void>;
    export: () => Promise<string>;
    import: (data: Partial<Rule>[]) => Promise<{ imported: number }>;
    downloadTemplate: () => string;
  };
  rankRules: {
    getAll: () => Promise<RankRule[]>;
    create: (data: Partial<RankRule>) => Promise<RankRule>;
    update: (id: number, data: Partial<RankRule>) => Promise<RankRule>;
    delete: (id: number) => Promise<void>;
    getByScore: (score: number) => Promise<RankRule>;
  };
  records: {
    create: (data: Partial<ScoreRecordItem>) => Promise<ScoreRecordItem>;
    getByUser: (userId: number, params?: ScoreRecordParams) => Promise<ScoreRecordItem[]>;
    getAll: (params?: ScoreRecordParams) => Promise<ScoreRecordItem[]>;
    getStatistics: (params?: ScoreRecordParams) => Promise<unknown>;
  };
  auth: {
    login: (data: {
      username: string;
      password: string;
    }) => Promise<{ access_token: string; refresh_token: string; user: Admin }>;
    getCsrfToken: () => Promise<{ csrf_token: string }>;
  };
  admins: {
    login: (data: {
      username: string;
      password: string;
    }) => Promise<{ access_token: string; refresh_token: string; admin: Admin }>;
    getCsrfToken: () => Promise<{ csrf_token: string }>;
    getAll: () => Promise<Admin[]>;
    getById: (id: number) => Promise<Admin>;
    create: (data: Partial<Admin>) => Promise<Admin>;
    update: (id: number, data: Partial<Admin>) => Promise<Admin>;
    delete: (id: number) => Promise<void>;
    changePassword: (
      id: number,
      data: { old_password: string; new_password: string }
    ) => Promise<void>;
  };
  roles: {
    getAll: () => Promise<Role[]>;
    create: (data: Partial<Role>) => Promise<Role>;
    update: (id: number, data: Partial<Role>) => Promise<Role>;
    delete: (id: number) => Promise<void>;
  };
  export: {
    users: (format?: 'excel' | 'pdf') => string;
    records: (userId?: number, format?: 'excel' | 'pdf') => string;
    rules: (format?: 'excel' | 'pdf') => string;
    devices: (format?: 'excel' | 'pdf') => string;
    summary: () => string;
    errors: (
      errors: Array<{
        row?: number;
        error_fields: string[];
        message: string;
        row_data?: Record<string, unknown>;
      }>,
      module: string
    ) => void;
  };
  analysis: {
    getUserAnalysis: (userId: number) => Promise<unknown>;
    getClassAnalysis: (className: string) => Promise<unknown>;
    getClassCompare: (classNames: string[], period: '7d' | '30d' | '90d') => Promise<unknown[]>;
  };
  timeRules: {
    getAll: () => Promise<TimeRule[]>;
    getById: (id: number) => Promise<TimeRule>;
    create: (data: TimeRuleData) => Promise<TimeRule>;
    update: (id: number, data: Partial<TimeRuleData>) => Promise<TimeRule>;
    delete: (id: number) => Promise<void>;
    check: (data: {
      card_id: string;
      device_id: string;
    }) => Promise<{ allowed: boolean; rule?: TimeRule }>;
  };
  classPeriods: {
    getAll: () => Promise<{ periods: ClassPeriod[]; total: number }>;
    getActive: () => Promise<{ periods: ClassPeriod[]; total: number }>;
    getById: (id: number) => Promise<ClassPeriod>;
    create: (
      data: Omit<ClassPeriod, 'id' | 'created_at' | 'updated_at' | 'duration'>
    ) => Promise<ClassPeriod>;
    update: (
      id: number,
      data: Partial<Omit<ClassPeriod, 'id' | 'created_at' | 'updated_at' | 'duration'>>
    ) => Promise<ClassPeriod>;
    delete: (id: number) => Promise<void>;
    batchUpdate: (periods: Partial<ClassPeriod>[]) => Promise<void>;
    reset: () => Promise<void>;
  };
  courseSchedules: {
    getAll: (params?: {
      class_info_id?: number;
      day_of_week?: number;
      period_number?: number;
      is_active?: boolean;
      teacher_name?: string;
      classroom?: string;
      skipCache?: boolean;
    }) => Promise<CourseSchedule[]>;
    getById: (id: number) => Promise<CourseSchedule>;
    create: (data: {
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
    }) => Promise<CourseSchedule>;
    update: (
      id: number,
      data: Partial<{
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
      }>
    ) => Promise<CourseSchedule>;
    delete: (id: number) => Promise<void>;
    checkConflict: (params: {
      class_info_id?: number;
      teacher_name?: string;
      classroom?: string;
      day_of_week?: number;
      period_number?: number;
      exclude_id?: number;
    }) => Promise<{
      has_conflict: boolean;
      conflicts: Array<{
        type: string;
        message: string;
        schedule_id?: number;
        conflicting_class_name?: string;
        conflicting_subject_name?: string;
        conflicting_teacher_name?: string;
        conflicting_classroom?: string;
      }>;
    }>;
    export: (classInfoId?: number, format?: 'json' | 'excel') => Promise<void>;
    import: (
      data: FormData,
      customUrl?: string
    ) => Promise<{
      success: boolean;
      total: number;
      success_count: number;
      failed_count: number;
      messages: Array<{
        class_name: string;
        subject_name: string;
        action: string;
        message: string;
      }>;
    }>;
    /** 查询当前时刻的上课状态（用于下发页「班级实时状态」徽章，恒不走缓存）。deviceId 会按设备反查班级 */
    getNow: (classInfoId?: number, deviceId?: string) => Promise<ClassNowStatus>;
  };
  importConfig: {
    list: (params?: { module_name?: string; is_active?: boolean }) => Promise<ImportConfig[]>;
    get: (id: number) => Promise<ImportConfig>;
    create: (data: ImportConfigInput) => Promise<ImportConfig>;
    update: (id: number, data: ImportConfigInput) => Promise<ImportConfig>;
    delete: (id: number) => Promise<unknown>;
    setDefault: (id: number) => Promise<unknown>;
    downloadTemplate: (templateType: string) => string;
  };
  box: {
    verify: (data: { card_id: string }) => Promise<{ verified: boolean; user?: User }>;
  };
  phoneBoxPolicy: {
    /** 获取本班（班主任）或指定班级（admin）的手机箱开箱策略 */
    get: (classInfoId?: number) => Promise<PhoneBoxPolicy>;
    /** 更新总开关 / 预设时段（班主任仅本班，admin 可指定班级） */
    update: (
      data: { allow_self_unlock?: boolean; unlock_windows?: UnlockWindow[] },
      classInfoId?: number
    ) => Promise<PhoneBoxPolicy>;
    /** 一键临时放行本班开箱 minutes 分钟（含上课期间） */
    override: (minutes: number, classInfoId?: number) => Promise<PhoneBoxPolicy>;
    /** 取消一键临时放行 */
    cancelOverride: (classInfoId?: number) => Promise<PhoneBoxPolicy>;
  };
  mqtt: {
    getConfig: () => Promise<MQTTConfig>;
    updateConfig: (data: Partial<MQTTConfig>) => Promise<MQTTConfig>;
    getStatus: () => Promise<MQTTStatus>;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    publish: (data: {
      topic: string;
      message?: string;
      payload?: string;
      qos?: number;
    }) => Promise<void>;
    subscribe: (data: { topic: string; qos?: number }) => Promise<void>;
    unsubscribe: (data: { topic: string }) => Promise<void>;
    getLogs: (limit?: number) => Promise<MQTTLog[]>;
    unlock: (data: {
      device_id: string;
      box_id?: string;
      response?: Record<string, unknown>;
    }) => Promise<void>;
  };
  system: {
    backup: () => Promise<{ filename: string }>;
    restore: (filename: string) => Promise<void>;
    listBackups: () => Promise<BackupInfo[]>;
    clearCache: () => Promise<void>;
    getConfig: () => Promise<SystemConfig>;
    updateConfig: (data: Partial<SystemConfig>) => Promise<SystemConfig>;
  };
  operationLogs: {
    getAll: (params?: ScoreRecordParams) => Promise<OperationLogListResponse>;
    getStats: (params?: ScoreRecordParams) => Promise<unknown>;
    getSummary: () => Promise<unknown>;
  };
  notifications: {
    getAll: (params?: ScoreRecordParams) => Promise<Notification[]>;
    getUnread: () => Promise<Notification[]>;
    markAsRead: (id: number) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    create: (data: Partial<Notification>) => Promise<Notification>;
    delete: (id: number) => Promise<void>;
    batchSend: (data: {
      user_ids?: number[];
      class_id?: number;
      title: string;
      content: string;
      type?: string;
      force_send?: boolean;
    }) => Promise<BatchNotifyResult>;
  };
  classes: {
    getAll: (params?: {
      page?: number;
      per_page?: number;
      keyword?: string;
      skipCache?: boolean;
    }) => Promise<ClassListResponse>;
    getStudents: (className: string) => Promise<User[]>;
    create: (data: ClassCreateData) => Promise<ClassInfo>;
    update: (id: number, data: ClassCreateData) => Promise<ClassInfo>;
    delete: (id: number) => Promise<void>;
    export: (keyword?: string, format?: 'json' | 'excel') => Promise<void>;
    import: (
      data: FormData,
      customUrl?: string
    ) => Promise<{
      success: boolean;
      total: number;
      success_count: number;
      failed_count: number;
      messages: Array<{ name: string; action: string; message: string }>;
    }>;
  };
  adminClasses: {
    getByAdmin: (adminId: number) => Promise<unknown>;
    assign: (adminId: number, class_id: number, isPrimary?: boolean) => Promise<unknown>;
    remove: (adminId: number, class_id: number) => Promise<unknown>;
  };
  permissionLogs: {
    getAll: (params?: { page?: number; per_page?: number }) => Promise<{
      logs: PermissionLog[];
      pagination: { page: number; per_page: number; total: number; pages: number };
    }>;
  };
  scoreAnalysis: {
    getExamAnalysis: (examId: string) => Promise<ExamAnalysis>;
    getClassAnalysis: (className: string) => Promise<ClassAnalysis>;
    getStudentAnalysis: (student_id: string) => Promise<StudentScoreAnalysis>;
  };
  scores: {
    getAll: (params?: { exam_id?: string; class_name?: string }) => Promise<unknown>;
    create: (data: {
      exam_id: number;
      student_id: number;
      subject: string;
      subject_id?: number;
      score: number;
    }) => Promise<unknown>;
    update: (id: number, data: { score: number }) => Promise<unknown>;
    delete: (id: number) => Promise<void>;
    importScores: (formData: FormData) => Promise<unknown>;
    confirmAll: (examId: string) => Promise<void>;
    batchCreate: (data: { exam_id: number; scores: BatchScoreItem[] }) => Promise<BatchScoreResult>;
  };
  reports: {
    exportClassSemester: (class_id: number, format?: 'excel' | 'csv') => Promise<void>;
  };
  remoteNotify: {
    /** 发送前在线预览（设备总数 / 在线数 / 最近活跃前 20 台），失败不阻塞发送 */
    preview: () => Promise<RemoteNotifyPreview>;
    send: (data: {
      text: string;
      volume?: number;
      speak?: boolean;
      popup?: boolean;
      timeout_sec?: number;
      urgent?: boolean;
      force_send?: boolean;
    }) => Promise<unknown>;
    broadcast: (data: {
      text: string;
      volume?: number;
      speak?: boolean;
      popup?: boolean;
      timeout_sec?: number;
      urgent?: boolean;
      force_send?: boolean;
    }) => Promise<unknown>;
    sendToDevice: (
      deviceId: string,
      data: {
        text: string;
        volume?: number;
        speak?: boolean;
        popup?: boolean;
        timeout_sec?: number;
        urgent?: boolean;
        force_send?: boolean;
      }
    ) => Promise<unknown>;
    test: (data?: { force_send?: boolean }) => Promise<unknown>;
    scoreChange: (data: {
      student_name: string;
      score_change: number;
      reason: string;
      course?: string;
      device_id?: string;
      force_send?: boolean;
    }) => Promise<unknown>;
  };
  notifyTemplates: {
    getAll: () => Promise<NotifyTemplate[]>;
    getById: (id: number) => Promise<NotifyTemplate>;
    create: (data: Partial<NotifyTemplate>) => Promise<NotifyTemplate>;
    update: (id: number, data: Partial<NotifyTemplate>) => Promise<NotifyTemplate>;
    delete: (id: number) => Promise<{ success: boolean; message: string }>;
    use: (
      id: number,
      data?: { send_mode?: string; device_id?: string; force_send?: boolean }
    ) => Promise<{ success: boolean; message: string; template_id: number; topics: string[] }>;
    getCategories: () => Promise<string[]>;
  };
  scheduledNotify: {
    getAll: (params?: { page?: number; per_page?: number }) => Promise<{
      items: ScheduledNotify[];
      total: number;
      page: number;
      per_page: number;
      pages: number;
    }>;
    getById: (id: number) => Promise<ScheduledNotify>;
    create: (
      data: Partial<ScheduledNotify>
    ) => Promise<{ success: boolean; message: string; id: number }>;
    update: (
      id: number,
      data: Partial<ScheduledNotify>
    ) => Promise<{ success: boolean; message: string }>;
    delete: (id: number) => Promise<{ success: boolean; message: string }>;
    cancel: (id: number) => Promise<{ success: boolean; message: string }>;
    trigger: (
      id: number,
      data?: { force_send?: boolean }
    ) => Promise<{ success: boolean; message: string }>;
  };
  notifyHistory: {
    getAll: (params?: {
      page?: number;
      per_page?: number;
      status?: string;
      days?: number;
    }) => Promise<{
      data: NotifyHistory[];
      total: number;
      page: number;
      per_page: number;
      pages: number;
    }>;
    getById: (id: number) => Promise<NotifyHistory>;
    getStats: () => Promise<{
      total_count: number;
      today_count: number;
      week_count: number;
      month_count: number;
      success_count: number;
      fail_count: number;
      success_rate: number;
    }>;
    clean: (days?: number) => Promise<{ success: boolean; message: string; deleted_count: number }>;
  };
  adminNotifications: {
    getAll: (params?: {
      admin_id?: number;
      page?: number;
      per_page?: number;
      is_read?: string;
      type?: string;
      priority?: string;
    }) => Promise<{
      notifications: AdminNotification[];
      total: number;
      page: number;
      per_page: number;
      pages: number;
    }>;
    getRecent: (params?: { admin_id?: number; limit?: number }) => Promise<AdminNotification[]>;
    getCount: (admin_id?: number) => Promise<{ unread_count: number; total_count: number }>;
    markRead: (id: number) => Promise<{ success: boolean; message: string }>;
    markAllRead: (
      admin_id?: number
    ) => Promise<{ success: boolean; message: string; count: number }>;
    create: (data: {
      admin_id?: number;
      title: string;
      message: string;
      type?: string;
      priority?: string;
      extra_data?: Record<string, unknown>;
    }) => Promise<{ success: boolean; message: string; notification: AdminNotification }>;
    delete: (id: number) => Promise<{ success: boolean; message: string }>;
  };
  wakeOnLan: {
    wake: (data: {
      mac_address: string;
      broadcast_ip?: string;
      port?: number;
      force_send?: boolean;
    }) => Promise<{ success: boolean; message: string; mac_address: string }>;
    wakeBatch: (data: {
      mac_addresses: string[];
      broadcast_ip?: string;
      port?: number;
      force_send?: boolean;
    }) => Promise<{
      success: boolean;
      total: number;
      success_count: number;
      results: Record<string, { success: boolean; message: string }>;
    }>;
    validateMac: (
      mac: string
    ) => Promise<{ mac_address: string; valid: boolean; normalized: string | null }>;
    getDevices: () => Promise<WOLDevice[]>;
    addDevice: (data: {
      name: string;
      mac_address: string;
      broadcast_ip?: string;
      port?: number;
      description?: string;
    }) => Promise<WOLDevice>;
    updateDevice: (id: number, data: Partial<WOLDevice>) => Promise<WOLDevice>;
    deleteDevice: (id: number) => Promise<{ success: boolean; message: string }>;
  };
  devices: {
    getAll: (params?: { page?: number; per_page?: number }) => Promise<DevicePaginatedResponse>;
    getById: (id: number) => Promise<Device>;
    create: (data: Partial<Device>) => Promise<Device>;
    update: (id: number, data: Partial<Device>) => Promise<Device>;
    delete: (id: string | number) => Promise<void>;
    getAlerts: (resolved?: string) => Promise<{ alerts: Alert[] }>;
    getHeartbeats: (deviceId: string) => Promise<{ heartbeats: Heartbeat[] }>;
    bindClass: (deviceId: string | number, data: { class_id: string | null }) => Promise<void>;
    bindAdmin: (deviceId: string | number, data: { admin_id: string | null }) => Promise<void>;
    remoteControl: (deviceId: string | number, action: string) => Promise<void>;
    otaUpgrade: (
      deviceId: string | number,
      data: { firmware_url: string; version: string; force?: boolean }
    ) => Promise<void>;
    bulkOTAUpgrade: (data: {
      firmware_url: string;
      version: string;
      force?: boolean;
    }) => Promise<void>;
    resolveAlert: (deviceId: string, alertId: number) => Promise<void>;
    updateSettings: (deviceId: string | number, settings: Record<string, unknown>) => Promise<void>;
    getStats: () => Promise<{
      total_devices: number;
      online_devices: number;
      offline_devices: number;
      error_devices?: number;
      today_heartbeats?: number;
      recent_activity?: unknown[];
    }>;
    getAdvancedStats: () => Promise<{
      total_devices: number;
      online_devices: number;
      offline_devices: number;
      error_devices?: number;
      online_rate?: number;
      avg_signal_strength?: number;
      signal_distribution?: Record<string, number>;
      today_heartbeats?: number;
      unresolved_alerts?: number;
      critical_alerts?: number;
    }>;
    import: (formData: FormData) => Promise<{
      success: boolean;
      total: number;
      success_count: number;
      failed_count: number;
      messages: Array<{ action: string; message: string }>;
    }>;
  };
  firmware: {
    getAll: () => Promise<Firmware[]>;
    getVersions: (params?: { page?: number; per_page?: number }) => Promise<{
      versions: Firmware[];
      total: number;
      page: number;
      per_page: number;
      pages: number;
    }>;
    getUpgradeRecords: () => Promise<{ records: FirmwareRecord[] }>;
    upload: (data: FormData) => Promise<Firmware>;
    update: (id: number, data: Partial<Firmware>) => Promise<Firmware>;
    updateVersion: (id: number, data: { is_active: boolean }) => Promise<Firmware>;
    delete: (id: number) => Promise<void>;
    deleteVersion: (id: number) => Promise<void>;
    download: (id: number) => string;
    getOTAStatus: () => Promise<OTAStatus>;
    otaUpgrade: (firmwareId: number, deviceIds: string[]) => Promise<void>;
  };
  exams: {
    getAll: (params?: ScoreRecordParams & { skipCache?: boolean }) => Promise<Exam[]>;
    getById: (id: number) => Promise<Exam>;
    create: (data: Partial<Exam>) => Promise<Exam>;
    update: (id: number, data: Partial<Exam>) => Promise<Exam>;
    delete: (id: number) => Promise<void>;
    import: (
      data: FormData,
      url?: string
    ) => Promise<{
      success: boolean;
      total: number;
      success_count: number;
      failed_count: number;
      messages: Array<{ action: string; message: string }>;
    }>;
    publish: (id: number) => Promise<Exam>;
    close: (id: number) => Promise<Exam>;
  };
  subjects: {
    getAll: (params?: { include_inactive?: boolean; skipCache?: boolean }) => Promise<Subject[]>;
    create: (data: {
      name: string;
      code?: string;
      grade?: string;
      description?: string;
      color?: string;
    }) => Promise<Subject>;
    update: (
      id: number,
      data: {
        name: string;
        code?: string;
        grade?: string;
        description?: string;
        color?: string;
        is_active?: boolean;
      }
    ) => Promise<Subject>;
    delete: (id: number) => Promise<void>;
    toggle: (id: number) => Promise<Subject>;
    getClasses: (id: number) => Promise<{ classes: SubjectClassLink[] }>;
    assignClass: (
      id: number,
      data: { class_info_id: number; teacher_id?: number }
    ) => Promise<SubjectClassLink>;
    updateClassTeacher: (
      subjectId: number,
      class_id: number,
      data: { teacher_id?: number }
    ) => Promise<SubjectClassLink>;
    removeClass: (subjectId: number, class_id: number) => Promise<void>;
    import: (
      data: FormData,
      customUrl?: string
    ) => Promise<{
      success: boolean;
      total: number;
      success_count: number;
      failed_count: number;
      messages: Array<{ name: string; action: string; message: string }>;
    }>;
    updateOrder: (data: Array<{ id: number; order: number }>) => Promise<void>;
  };
  approvals: {
    getAll: (params?: ScoreRecordParams) => Promise<{
      approvals: Approval[];
      pagination: { page: number; per_page: number; total: number; pages: number };
    }>;
    getById: (id: number) => Promise<Approval>;
    create: (data: Partial<Approval>) => Promise<Approval>;
    approve: (id: number, data: { comment?: string }) => Promise<Approval>;
    reject: (id: number, data: { comment: string }) => Promise<Approval>;
    batchApprove: (ids: number[], comment?: string) => Promise<BatchApprovalResult>;
    batchReject: (ids: number[], comment?: string) => Promise<BatchApprovalResult>;
    delete: (id: number) => Promise<void>;
  };
  algorithm: {
    // 预测相关
    // 注：api.ts::request() 已剥 envelope，签名应反映内层 data，不要再 .data
    getPrediction: (userId: number, days?: number) => Promise<PredictionResult>;
    getBatchPrediction: (className?: string, days?: number) => Promise<BatchPredictionData>;
    getRiskStudents: (days?: number) => Promise<RiskStudent[]>;

    // 异常检测相关
    getUserAnomaly: (userId: number, days?: number) => Promise<AnomalyResult>;
    getBatchAnomaly: (className?: string, days?: number) => Promise<BatchAnomalyData>;
    getSuddenChange: (userId: number, days?: number) => Promise<AnomalyResult>;
    getTrendAnomaly: (userId: number, days?: number) => Promise<AnomalyResult>;
    getGroupAnomaly: (userId: number, days?: number) => Promise<AnomalyResult>;

    // 智能推荐积分规则
    getRuleRecommend: (className?: string, days?: number) => Promise<RuleRecommendData>;
    getNewRuleRecommend: (className?: string, days?: number) => Promise<RuleRecommendData>;
    getRuleOptimization: (className?: string, days?: number) => Promise<RuleRecommendData>;
    getRuleCombination: (className?: string, days?: number) => Promise<RuleRecommendData>;
    getRuleStatistics: (days?: number) => Promise<unknown>;
    trainRuleRecommendModel: (days?: number) => Promise<ModelTrainingResult>;
    evaluateRuleRecommendModel: (days?: number) => Promise<ModelEvaluationResult>;

    // 成绩预测分析
    getScorePredict: (userId: number, days?: number) => Promise<ScorePredictResult>;
    getBatchScorePredict: (className?: string, days?: number) => Promise<BatchScorePredictData>;
    getScoreDistribution: (className?: string) => Promise<unknown>;
    trainScorePredictModel: (days?: number) => Promise<ModelTrainingResult>;
    evaluateScorePredictModel: (days?: number) => Promise<ModelEvaluationResult>;

    // 风险预警系统增强
    getRiskPredict: (userId: number, days?: number) => Promise<RiskPredictResult>;
    getScoreAttribution: (userId: number, days?: number) => Promise<ScoreAttributionResult>;
    getEngagement: (userId: number, days?: number) => Promise<EngagementResult>;
    getBatchAttribution: (className?: string, days?: number) => Promise<BatchAttributionResult>;
    getEngagementRank: (className?: string, days?: number) => Promise<EngagementRankResult>;
    exportExcel: (
      tab: 'engagement' | 'attribution' | 'risk',
      className?: string,
      days?: number
    ) => Promise<void>;
    getEngagementTrend: (userId: number, weeks?: number) => Promise<EngagementTrendResult>;
    getBatchRiskPredict: (className?: string, days?: number) => Promise<BatchRiskPredictData>;
    getHighRiskStudents: (days?: number) => Promise<RiskStudent[]>;
    trainRiskPredictModel: (days?: number) => Promise<ModelTrainingResult>;
    evaluateRiskPredictModel: (days?: number) => Promise<ModelEvaluationResult>;

    // 智能规则自动应用
    executeRuleEngine: (modelOutput: unknown, userContext: unknown) => Promise<unknown>;
    applyRuleByBehavior: (
      userId: number,
      behaviorType: string,
      context?: unknown
    ) => Promise<unknown>;

    // 评分分布控制
    // 注意：后端返回 success(data={...})，request 剥信封后直接返回内层对象（含 success 字段）
    getScoreDistributionStats: (className?: string) => Promise<unknown>;
    adjustScoreDistribution: (className?: string) => Promise<{ data: unknown }>;
    validateScoreDistribution: (scores: number[]) => Promise<{ data: unknown }>;
    detectOutliers: (scores: number[]) => Promise<{ data: unknown }>;
    validateAndCorrectScores: (scores: number[]) => Promise<{ data: unknown }>;

    // 积分生态系统
    earnScore: (userId: number, behaviorType: string, context?: unknown) => Promise<unknown>;
    spendScore: (userId: number, spendingType: string, amount?: number) => Promise<unknown>;
    getEarningRules: () => Promise<{ data: unknown }>;
    getSpendingRules: () => Promise<{ data: unknown }>;
    getUserBalance: (userId: number) => Promise<{ data: unknown }>;

    // 奖励体系
    handlePhoneAccess: (userId: number, accessCount?: number) => Promise<unknown>;
    getRewardTypes: () => Promise<{ data: unknown }>;
    getEligibleRewards: (userId: number) => Promise<{ data: unknown }>;
    redeemReward: (userId: number, rewardType: string) => Promise<unknown>;
    getDailyRewardUsage: (userId: number) => Promise<{ data: unknown }>;

    // 统计分析
    getStatistics: (params?: { class_name?: string }) => Promise<AlgorithmStatistics>;
    // 分群分析
    getClusters: (params?: { class_name?: string }) => Promise<ClusterData>;
    // 综合评分
    getCompositeScores: (params?: { class_name?: string }) => Promise<{ data: unknown }>;
    // 风险预警
    getWarnings: (params?: { class_name?: string }) => Promise<WarningData>;
    getAll: () => Promise<AlgorithmData>;
    runAnalysis: () => Promise<AlgorithmData>;
    getWarningConfig: () => Promise<{ data: unknown }>;
    recalculateClusters: () => Promise<{ data: unknown }>;
    recalculateCompositeScores: () => Promise<{ data: unknown }>;
    runWarningEvaluation: () => Promise<{ data: unknown }>;
    resolveWarning: (warningId: number) => Promise<{ data: unknown }>;
    updateWarningConfig: (data: {
      config_key: string;
      config_value: string;
    }) => Promise<{ data: unknown }>;
    getCompositeScoreProgress: () => Promise<{
      status: string;
      progress: number;
      message: string;
      total_students: number;
      completed_students: number;
      start_time: string | null;
      end_time: string | null;
    }>;
  };
  deviceGroup: {
    getAll: (params?: { is_active?: boolean }) => Promise<DeviceGroup[]>;
    getById: (id: number) => Promise<DeviceGroupDetail>;
    create: (data: Partial<DeviceGroup>) => Promise<DeviceGroup>;
    update: (id: number, data: Partial<DeviceGroup>) => Promise<DeviceGroup>;
    delete: (id: number) => Promise<void>;
    getDevices: (groupId: number) => Promise<DeviceInGroup[]>;
    addDevices: (
      groupId: number,
      deviceIds: string[]
    ) => Promise<{ added_count: number; skipped: { device_id: string; reason: string }[] }>;
    removeDevices: (groupId: number, deviceIds: string[]) => Promise<{ removed_count: number }>;
    getByDevice: (deviceId: string) => Promise<DeviceGroup[]>;
    getStats: () => Promise<DeviceGroupStats[]>;
  };
  nlp: NLP;
  // 座次表
  seating: {
    getAll: (class_id?: number) => Promise<SeatingChart[]>;
    getById: (id: number) => Promise<SeatingChart>;
    create: (data: SeatingChartCreateInput) => Promise<SeatingChart>;
    update: (id: number, data: Partial<SeatingChartCreateInput>) => Promise<SeatingChart>;
    delete: (id: number) => Promise<void>;
    autoArrange: (chartId: number, strategy: string, class_id: number) => Promise<SeatingChart>;
    updateSeat: (chartId: number, row: number, col: number, student_id: number) => Promise<void>;
  };
  // 值日生表
  duty: {
    getAll: (class_id?: number) => Promise<DutyGroup[]>;
    createGroup: (data: DutyGroupCreateInput) => Promise<DutyGroup>;
    deleteGroup: (id: number) => Promise<void>;
    getAssignments: (group_id?: number) => Promise<DutyAssignment[]>;
    assignDuty: (data: DutyAssignment) => Promise<DutyAssignment>;
    markComplete: (assignmentId: number) => Promise<void>;
    rotate: (class_id: number, period?: string) => Promise<{ rotated_count: number }>;
  };
  // 班委名单
  committee: {
    getAll: (class_id?: number) => Promise<ClassCommittee[]>;
    create: (data: CommitteeCreateInput) => Promise<ClassCommittee>;
    update: (id: number, data: Partial<CommitteeCreateInput>) => Promise<ClassCommittee>;
    delete: (id: number) => Promise<void>;
    getTerms: (class_id?: number) => Promise<CommitteeTerm[]>;
    createTerm: (data: CommitteeTermCreateInput) => Promise<CommitteeTerm>;
  };
  // 家长联系
  parent: {
    getAll: (student_id?: number, class_id?: number) => Promise<ParentContact[]>;
    create: (data: ParentContactCreateInput) => Promise<ParentContact>;
    update: (id: number, data: Partial<ParentContactCreateInput>) => Promise<ParentContact>;
    delete: (id: number) => Promise<void>;
    getContactLogs: (parentId: number) => Promise<ContactLog[]>;
    addContactLog: (
      parentId: number,
      data: { contact_type: string; content?: string }
    ) => Promise<ContactLog>;
    resolveLog: (logId: number) => Promise<void>;
  };
  // 作业检查
  homework: {
    getAll: (class_id?: number, subjectId?: number) => Promise<HomeworkAssignment[]>;
    getById: (id: number) => Promise<HomeworkAssignment>;
    create: (data: HomeworkCreateInput) => Promise<HomeworkAssignment>;
    update: (id: number, data: HomeworkCreateInput) => Promise<HomeworkAssignment>;
    delete: (id: number) => Promise<void>;
    markSubmitted: (assignmentId: number, student_id: number) => Promise<void>;
    markChecked: (assignmentId: number, student_id: number, notes?: string) => Promise<void>;
  };
  // 考勤管理
  attendance: {
    getAll: (class_id?: number, student_id?: number, date?: string) => Promise<Attendance[]>;
    record: (data: AttendanceRecordInput) => Promise<Attendance>;
    batchRecord: (records: AttendanceRecordInput[]) => Promise<{ count: number }>;
    getStats: (class_id: number, startDate?: string, endDate?: string) => Promise<AttendanceStats>;
    getLeaves: (student_id?: number, status?: string) => Promise<LeaveApplication[]>;
    applyLeave: (data: LeaveApplyInput) => Promise<LeaveApplication>;
    approveLeave: (leaveId: number, approve?: boolean) => Promise<void>;
  };
  // 学习小组
  studyGroup: {
    getAll: (class_id?: number) => Promise<StudyGroup[]>;
    getById: (id: number) => Promise<StudyGroup>;
    create: (data: StudyGroupCreateInput) => Promise<StudyGroup>;
    update: (id: number, data: Partial<StudyGroupCreateInput>) => Promise<StudyGroup>;
    delete: (id: number) => Promise<void>;
    addMember: (groupId: number, student_id: number) => Promise<void>;
    removeMember: (groupId: number, student_id: number) => Promise<void>;
    addScore: (groupId: number, scoreChange: number, reason?: string) => Promise<void>;
  };
  // 心理健康
  mentalHealth: {
    getRecords: (student_id?: number, class_id?: number) => Promise<MentalHealthRecord[]>;
    createRecord: (data: MentalHealthRecordCreateInput) => Promise<MentalHealthRecord>;
    getAlerts: (student_id?: number, isResolved?: boolean, class_id?: number) => Promise<MentalHealthAlert[]>;
    resolveAlert: (alertId: number) => Promise<void>;
  };
  // 班主任评语
  teacherComment: {
    getAll: (class_id?: number, student_id?: number, term?: string) => Promise<TeacherComment[]>;
    create: (data: TeacherCommentCreateInput) => Promise<TeacherComment>;
    update: (id: number, data: Partial<TeacherCommentCreateInput>) => Promise<TeacherComment>;
    delete: (id: number) => Promise<void>;
  };
  // 文体活动
  activity: {
    getAll: (class_id?: number, isPublished?: boolean) => Promise<Activity[]>;
    getById: (id: number) => Promise<Activity>;
    create: (data: ActivityCreateInput) => Promise<Activity>;
    update: (id: number, data: Partial<ActivityCreateInput>) => Promise<Activity>;
    delete: (id: number) => Promise<void>;
    registerStudent: (activityId: number, student_id: number) => Promise<void>;
    cancelRegistration: (activityId: number, student_id: number) => Promise<void>;
  };
  // 班级文化
  culture: {
    getAll: (class_id?: number, category?: string) => Promise<CultureRecord[]>;
    create: (data: CultureCreateInput) => Promise<CultureRecord>;
    update: (id: number, data: Partial<CultureCreateInput>) => Promise<CultureRecord>;
    delete: (id: number) => Promise<void>;
  };
  // 学法指导
  studyGuide: {
    getGuides: (class_id?: number, guideType?: string) => Promise<StudyGuide[]>;
    createGuide: (data: StudyGuideCreateInput) => Promise<StudyGuide>;
    updateGuide: (id: number, data: StudyGuideCreateInput) => Promise<StudyGuide>;
    deleteGuide: (id: number) => Promise<void>;
    getPlans: (student_id?: number) => Promise<ImprovementPlan[]>;
    createPlan: (data: ImprovementPlanCreateInput) => Promise<ImprovementPlan>;
    updatePlan: (id: number, data: ImprovementPlanCreateInput) => Promise<ImprovementPlan>;
    deletePlan: (id: number) => Promise<void>;
    updatePlanProgress: (planId: number, progress: number) => Promise<void>;
  };
  student: {
    login: (data: {
      card_id: string;
      name: string;
    }) => Promise<{ access_token: string; expires_in: number; student: StudentInfo }>;
    getMe: () => Promise<StudentInfo>;
    getScore: () => Promise<{ current_score: number; name: string; card_id: string }>;
    getRecords: (params?: { page?: number; per_page?: number }) => Promise<{
      data: ScoreRecordItem[];
      pagination: { page: number; per_page: number; total: number; pages: number };
    }>;
    getNotifications: (params?: { page?: number; per_page?: number }) => Promise<{
      data: NotificationItem[];
      pagination: { page: number; per_page: number; total: number; pages: number };
    }>;
    getLeaves: () => Promise<LeaveItem[]>;
    applyLeave: (data: {
      leave_type?: string;
      start_date: string;
      end_date: string;
      reason?: string;
    }) => Promise<LeaveItem>;
    requestPhoneboxUnlock: () => Promise<PhoneboxUnlockResult>;
    getMyRank: () => Promise<MyRankResult>;
    getInsights: (days?: number, weeks?: number) => Promise<StudentInsight>;
  };
  rank: {
    getStudentRanking: (params?: {
      class_name?: string;
      sort_by?: string;
      order?: string;
      limit?: number;
    }) => Promise<{
      ranking: StudentRankItem[];
      total_students: number;
      class_name: string;
    }>;
    getClassRanking: (params?: { sort_by?: string; order?: string; limit?: number }) => Promise<{
      ranking: ClassRankItem[];
      total_classes: number;
    }>;
  };
  cache: {
    clearByUrl: (url: string) => void;
  };
}

export interface NLPScoringRuleInput {
  behavior_keyword: string;
  behavior_description?: string;
  score_value: number;
  score_type: string;
  behavior_tags?: string[];
  match_pattern?: string;
  priority?: number;
  is_active?: boolean;
}

export interface NLPScoringRule {
  id: number;
  rule_id?: number;
  behavior_keyword: string;
  behavior_description: string;
  score_value: number;
  score_type: string;
  behavior_tags: string[];
  match_pattern: string;
  priority: number;
  is_active: boolean;
  usage_count: number;
  accuracy_rate: number;
  created_at: string;
  updated_at: string;
}

export interface NLPParsedResult {
  success: boolean;
  input_text: string;
  extracted_name: string | null;
  user_id: number | null;
  behavior: string;
  intent: string;
  confidence: number;
  matched_rules: {
    rule_id: number | null;
    behavior_keyword: string;
    behavior_description: string;
    score_value: number;
    score_type: string;
    behavior_tags: string[];
    match_pattern: string;
    priority: number;
    usage_count: number;
    accuracy_rate: number;
  }[];
  suggestions: {
    intent: string;
    score_value: number;
    description: string;
    /** 相似规则 id（后端命中相似规则时附带），可用于一键应用 */
    rule_id?: number;
    /** 与相似规则的相似度（0-1） */
    similarity?: number;
  }[];
}

export interface NLPStatistics {
  total_rules: number;
  add_rules: number;
  deduct_rules: number;
  total_usage: number;
  manual_corrections: number;
  accuracy_rate: number;
  high_usage_rules: NLPScoringRule[];
  total_keywords?: number;
  total_matches?: number;
  avg_confidence?: number;
  usage_trend?: { date: string; count: number }[];
  intent_distribution?: { intent: string; count: number; percentage: number }[];
}

export interface NLPTrainingRecord {
  id: number;
  training_version: string;
  training_data_count: number;
  accuracy_before: number;
  accuracy_after: number;
  training_status: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  training_start_at: string;
  training_end_at: string;
  trained_by: number;
}

export interface NLPEvaluationResult {
  accuracy_rate: number;
  precision: number;
  recall: number;
  f1_score: number;
  total_samples: number;
  correct_count: number;
  incorrect_count: number;
  accuracy?: number;
  correct_matches?: number;
  last_updated?: string;
}

export interface NLPAlgorithm {
  value: string;
  label: string;
}

export interface NLPMLModelEvaluation {
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
}

export interface NLPMLCrossValidation {
  mean_f1: number;
  std_f1: number;
  min_f1: number;
  max_f1: number;
}

export interface NLPMLTrainingResult {
  success: boolean;
  algorithm: string;
  algorithm_name: string;
  training_data_count: number;
  evaluation: NLPMLModelEvaluation;
  cross_validation?: NLPMLCrossValidation;
  model_saved: boolean;
  message: string;
}

export interface NLPMLAlgorithmResult {
  algorithm: string;
  algorithm_name: string;
  evaluation: NLPMLModelEvaluation;
  cross_validation: NLPMLCrossValidation;
  error?: string;
}

export interface NLPMLTrainAllResult {
  success: boolean;
  results: NLPMLAlgorithmResult[];
  best_algorithm: string | null;
  best_algorithm_name: string | null;
  best_f1: number;
  training_data_count: number;
  message: string;
}

export interface NLPMLEvaluationAllResult {
  success: boolean;
  results: NLPMLAlgorithmResult[];
  total_data_count: number;
}

export interface NLPPredictResult {
  rule_id: number;
  confidence: number;
  algorithm: string;
}

export interface NLPBackendResponse<T = unknown> {
  success: boolean;
  code: number;
  message: string;
  data: T;
}

interface BackendPaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface NLPCorrection {
  id: number;
  original_text: string;
  field_type: string;
  original_value: string | null;
  corrected_value: string | null;
  corrected_by: number | null;
  status: string;
  confidence_after: number | null;
  learn_count: number;
  last_learned_at: string | null;
  created_at: string;
  verified_at: string | null;
}

interface NLP {
  parse: (text: string) => Promise<NLPParsedResult>;
  execute: (data: {
    text: string;
    manual_correction?: unknown;
  }) => Promise<unknown>;
  batchParse: (texts: string[]) => Promise<unknown>;
  sentiment: (text: string) => Promise<unknown>;
  getRules: (params?: {
    page?: number;
    per_page?: number;
    keyword?: string;
    score_type?: string;
    sort_by?: string;
    sort_order?: string;
  }) => Promise<BackendPaginatedResult<NLPScoringRule>>;
  createRule: (data: NLPScoringRuleInput) => Promise<NLPScoringRule>;
  updateRule: (
    id: number,
    data: Partial<NLPScoringRuleInput>
  ) => Promise<NLPScoringRule>;
  deleteRule: (id: number) => Promise<unknown>;
  suggestRules: (keyword: string) => Promise<NLPScoringRule[]>;
  getRuleStatistics: () => Promise<NLPStatistics>;
  getRuleUsage: (ruleId: number) => Promise<unknown>;
  batchImportRules: (rules: unknown[]) => Promise<{
    success: boolean;
    imported_count: number;
    skipped_count: number;
    message: string;
  }>;
  trainModel: (data: {
    trained_by?: number;
    algorithm?: string;
    use_cross_validation?: boolean;
  }) => Promise<NLPMLTrainingResult>;
  trainAllModels: (data: {
    trained_by?: number;
  }) => Promise<NLPMLTrainAllResult>;
  getAlgorithms: () => Promise<NLPAlgorithm[]>;
  evaluateAllModels: () => Promise<NLPMLEvaluationAllResult>;
  predictRule: (data: {
    text: string;
    algorithm?: string;
  }) => Promise<NLPPredictResult>;
  getTrainingHistory: (params?: {
    page?: number;
    per_page?: number;
  }) => Promise<BackendPaginatedResult<NLPTrainingRecord>>;
  evaluateModel: () => Promise<NLPEvaluationResult>;
  // 自学习反馈相关
  recordFeedback: (data: {
    text: string;
    predicted_intent: string;
    true_intent?: string;
    confidence?: number;
    processing_time?: number;
    corrected_name?: string;
    corrected_intent?: string;
    corrected_score?: number;
    original_name?: string;
    original_score?: number;
    cache_hit?: boolean;
  }) => Promise<{ message: string; corrections_saved?: number }>;
  getCorrections: (params?: {
    page?: number;
    per_page?: number;
    status?: string;
  }) => Promise<BackendPaginatedResult<NLPCorrection>>;
  updateCorrection: (id: number, data: { status: string }) => Promise<unknown>;
  deleteCorrection: (id: number) => Promise<unknown>;
  // 算法分析相关
  getAnalysisComprehensive: () => Promise<unknown>;
  getAnalysisIntent: () => Promise<{ code: number; data: unknown }>;
  getAnalysisPerformance: () => Promise<{ code: number; data: unknown }>;
  getAnalysisSuggestions: () => Promise<{ code: number; data: unknown }>;
  resetAnalysis: () => Promise<{ code: number; data: unknown }>;
  benchmarkIntentClassifier: (params?: {
    iterations?: number;
  }) => Promise<unknown>;
  getOptimizationConfig: () => Promise<{ code: number; data: unknown }>;
  setOptimizationConfig: (data: { strategy?: string }) => Promise<unknown>;
  autoTuneOptimization: (data?: { target_metric?: string }) => Promise<unknown>;
}

/**
 * 后端 /api/algorithm/prediction/batch 的原始响应形状。
 * 与前端 BatchPredictionData 的字段名/嵌套结构不一致，需经 normalizeBatchPrediction 转换。
 *
 * 字段差异：
 *   predictions[].prediction.current_score    -> predictions[].current_score
 *   predictions[].prediction.predicted_scores[last] -> predictions[].predicted_score
 *   predictions[].prediction.trend             -> predictions[].trend （rising→up，falling→down）
 *   predictions[].prediction.confidence        -> predictions[].confidence
 *   summary.rising_count                       -> summary.improvement_count
 *   summary.falling_count                      -> summary.decline_count
 *   后端仅返回 summary.{rising,stable,falling}_count，前端需要的
 *   avg_current_score / avg_predicted_score 由前端按现有 predictions 自行计算。
 */
interface RawBatchPrediction {
  total_students?: number;
  predictions?: Array<{
    user_id?: number;
    name?: string;
    class_name?: string;
    prediction?: {
      current_score?: number;
      predicted_scores?: number[];
      trend?: string;
      slope?: number;
      confidence?: number;
      confidence_interval?: [number, number];
      message?: string;
    };
  }>;
  summary?: {
    rising_count?: number;
    stable_count?: number;
    falling_count?: number;
  };
}

const TREND_MAP: Record<string, 'up' | 'down' | 'stable'> = {
  rising: 'up',
  falling: 'down',
  stable: 'stable',
  insufficient_data: 'stable',
};

/**
 * 单用户预测接口的返回结构与前端 PredictionResult / ScorePredictResult /
 * RiskPredictResult / AnomalyResult 不一致（后端用 predicted_scores 数组、
 * overall_risk_level、anomalies[] 等不同命名），且原先直接 `as` 断言无兜底，
 * 一旦被调用会读到 undefined。这里补一组单对象 normalize，与 batch 的兜底逻辑对齐。
 */
const toNumSafe = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

const normalizeUserPrediction = (raw?: RawAlg): PredictionResult => {
  const list = Array.isArray(raw?.predicted_scores) ? raw!.predicted_scores! : [];
  const predicted_score =
    list.length > 0 ? toNumSafe(list[list.length - 1]) : toNumSafe(raw?.current_score);
  const trendKey = typeof raw?.trend === 'string' ? raw.trend : 'stable';
  const ci = raw?.confidence_interval;
  const confidence_interval: [number, number] | undefined =
    Array.isArray(ci) && ci.length === 2
      ? ([toNumSafe(ci[0]), toNumSafe(ci[1])] as [number, number])
      : undefined;
  return {
    name:
      typeof raw?.user_id === 'number' || typeof raw?.user_id === 'string'
        ? String(raw.user_id)
        : '未知学生',
    current_score: toNumSafe(raw?.current_score),
    predicted_score,
    trend: TREND_MAP[trendKey] ?? 'stable',
    confidence: toNumSafe(raw?.confidence),
    confidence_interval,
  };
};

const normalizeUserScorePredict = (raw?: RawAlg): ScorePredictResult => {
  const features = raw?.features ?? {};
  const ci = raw?.confidence_interval;
  const confidence_interval: [number, number] | undefined =
    Array.isArray(ci) && ci.length === 2
      ? ([toNumSafe(ci[0]), toNumSafe(ci[1])] as [number, number])
      : undefined;
  return {
    name: raw?.name ?? '未知学生',
    subject: raw?.class_name ?? '',
    current_score: toNumSafe(features?.current_score),
    predicted_score: toNumSafe(raw?.predicted_score),
    trend: 'stable',
    confidence: toNumSafe(raw?.confidence),
    confidence_interval,
  };
};

const normalizeScoreAttribution = (raw?: RawAlg): ScoreAttributionResult => ({
  user_id: raw?.user_id as number,
  name: raw?.name ?? '',
  class_name: raw?.class_name ?? '',
  has_data: !!raw?.has_data,
  total_change: toNumSafe(raw?.total_change),
  score_before: toNumSafe(raw?.score_before),
  score_after: toNumSafe(raw?.score_after),
  confidence: toNumSafe(raw?.confidence),
  factors: Array.isArray(raw?.factors)
    ? (raw.factors as RawJson[]).map((f: RawAlg) => ({
        key: f?.key ?? '',
        name: f?.name ?? '',
        contribution: toNumSafe(f?.contribution),
        direction:
          f?.direction === 'positive' || f?.direction === 'negative' ? f.direction : 'neutral',
        delta: toNumSafe(f?.delta),
        detail: f?.detail ?? '',
      }))
    : [],
  summary: raw?.summary ?? '',
});

const normalizeBatchAttribution = (raw?: RawAlg): BatchAttributionResult => ({
  class_name: raw?.class_name ?? '',
  days: toNumSafe(raw?.days) || 30,
  total: toNumSafe(raw?.total) || 0,
  analyzed: toNumSafe(raw?.analyzed) || 0,
  with_data: toNumSafe(raw?.with_data) || 0,
  failed: toNumSafe(raw?.failed) || 0,
  students: Array.isArray(raw?.students)
    ? (raw.students as RawJson[]).map((s: RawAlg) => ({
        user_id: s?.user_id as number,
        name: s?.name ?? '未知学生',
        class_name: s?.class_name ?? '',
        has_data: !!s?.has_data,
        total_change: toNumSafe(s?.total_change),
        score_before: toNumSafe(s?.score_before),
        score_after: toNumSafe(s?.score_after),
        confidence: toNumSafe(s?.confidence),
        factors: Array.isArray(s?.factors)
          ? (s.factors as RawJson[]).map((f: RawAlg) => ({
              key: f?.key ?? '',
              name: f?.name ?? '',
              contribution: toNumSafe(f?.contribution),
              direction:
                f?.direction === 'positive' || f?.direction === 'negative'
                  ? f.direction
                  : 'neutral',
              delta: toNumSafe(f?.delta),
              detail: f?.detail ?? '',
            }))
          : [],
        summary: s?.summary ?? '',
        error: s?.error,
      }))
    : [],
  failed_students: Array.isArray(raw?.failed_students)
    ? (raw.failed_students as RawJson[]).map((f: RawAlg) => ({
        user_id: toNumSafe(f?.user_id) || 0,
        name: f?.name ?? '',
        class_name: f?.class_name ?? '',
        error: f?.error ?? '',
      }))
    : [],
});

const normalizeEngagementRank = (raw?: RawAlg): EngagementRankResult => {
  const normLevel = (lv: unknown): 'high' | 'medium' | 'low' =>
    lv === 'high' || lv === 'medium' || lv === 'low' ? (lv as 'high' | 'medium' | 'low') : 'low';
  return {
    class_name: raw?.class_name ?? '',
    days: toNumSafe(raw?.days) || 30,
    total: toNumSafe(raw?.total) || 0,
    with_data: toNumSafe(raw?.with_data) || 0,
    failed: toNumSafe(raw?.failed) || 0,
    students: Array.isArray(raw?.students)
      ? (raw.students as RawJson[]).map((s: RawAlg) => ({
          user_id: toNumSafe(s?.user_id) || 0,
          name: s?.name ?? '未知学生',
          class_name: s?.class_name ?? '',
          rank: s?.rank ?? null,
          engagement_score: toNumSafe(s?.engagement_score) || 0,
          level: normLevel(s?.level),
          has_data: !!s?.has_data,
          components: {
            attendance_rate: s?.components?.attendance_rate ?? null,
            homework_rate: s?.components?.homework_rate ?? null,
            activity_rate: s?.components?.activity_rate ?? null,
            leave_days: toNumSafe(s?.components?.leave_days) || 0,
          },
        }))
      : [],
  failed_students: Array.isArray(raw?.failed_students)
    ? (raw.failed_students as RawJson[]).map((f: RawAlg) => ({
        user_id: toNumSafe(f?.user_id) || 0,
        name: f?.name ?? '',
        class_name: f?.class_name ?? '',
        error: f?.error ?? '',
      }))
    : [],
  };
};

const normalizeEngagementTrend = (raw?: RawAlg): EngagementTrendResult => {
  const normLevel = (lv: unknown): 'high' | 'medium' | 'low' =>
    lv === 'high' || lv === 'medium' || lv === 'low' ? (lv as 'high' | 'medium' | 'low') : 'low';
  return {
    user_id: toNumSafe(raw?.user_id) || 0,
    weeks: toNumSafe(raw?.weeks) || 8,
    trend: raw?.trend === 'up' || raw?.trend === 'down' ? raw.trend : 'stable',
    series: Array.isArray(raw?.series)
      ? (raw.series as RawJson[]).map((s: RawAlg) => ({
          week_index: toNumSafe(s?.week_index) || 0,
          week_label: s?.week_label ?? '',
          week_end: s?.week_end ?? '',
          engagement_score: toNumSafe(s?.engagement_score) || 0,
          level: normLevel(s?.level),
          has_data: !!s?.has_data,
          attendance_rate: s?.attendance_rate ?? null,
          homework_rate: s?.homework_rate ?? null,
          activity_rate: s?.activity_rate ?? null,
          leave_days: toNumSafe(s?.leave_days) || 0,
        }))
      : [],
  };
};

const normalizeUserRiskPredict = (raw?: RawAlg): RiskPredictResult => {
  const factors = Array.isArray(raw?.risk_factors) ? (raw!.risk_factors as RawJson[]) : [];
  const contributing_factors = factors
    .map((f: RawAlg) => (f && (f.name || f.description)) || '')
    .filter((s: string) => !!s);
  const recommended_actions = Array.isArray(raw?.recommended_actions)
    ? raw!.recommended_actions!
    : Array.isArray(raw?.intervention_suggestions)
    ? raw!.intervention_suggestions!
    : [];
  const sev = (raw?.overall_risk_level ?? 'low') as 'high' | 'medium' | 'low';

  // 多维风险分：后端 risk_details 含 academic/behavior/attendance 三维，按固定顺序映射
  const SUB_RISK_ORDER: Array<'academic' | 'behavior' | 'attendance'> = [
    'academic',
    'behavior',
    'attendance',
  ];
  const details =
    raw && raw.risk_details && typeof raw.risk_details === 'object'
      ? (raw.risk_details as RawAlg)
      : null;
  const sub_risks: RiskSubRisk[] = details
    ? SUB_RISK_ORDER.filter((k) => details[k] && typeof details[k] === 'object').map((k) => {
        const d = details[k] as RawAlg;
        const lvl = (d.risk_level ?? 'low') as 'high' | 'medium' | 'low';
        const rawFactors = Array.isArray(d.factors) ? (d.factors as RawJson[]) : [];
        const factorStrs = rawFactors
          .map((f: RawAlg) => (f && (f.description || f.factor || f.name)) || '')
          .filter((s: string) => !!s);
        return {
          key: k,
          name: d.name ?? k,
          level: lvl === 'high' || lvl === 'medium' ? lvl : 'low',
          score: toNumSafe(d.risk_score),
          factors: factorStrs,
        };
      })
    : [];

  return {
    name: raw?.name ?? '未知学生',
    risk_level: sev === 'high' || sev === 'medium' ? sev : 'low',
    risk_score: toNumSafe(raw?.overall_risk_score),
    contributing_factors,
    recommended_actions,
    sub_risks,
  };
};

const normalizeUserEngagement = (raw?: RawAlg): EngagementResult => {
  const rawFactors = Array.isArray(raw?.factors) ? (raw!.factors as RawJson[]) : [];
  const factors: EngagementFactor[] = rawFactors.map((f: RawAlg) => ({
    name: f?.name ?? '',
    value: toNumSafe(f?.value),
    weight: toNumSafe(f?.weight),
    contribution: toNumSafe(f?.contribution),
  }));
  const comp = raw && raw.components && typeof raw.components === 'object' ? (raw.components as RawAlg) : {};
  const levelRaw = (raw?.level ?? 'low') as string;
  const level: 'high' | 'medium' | 'low' =
    levelRaw === 'high' || levelRaw === 'medium' || levelRaw === 'low' ? levelRaw : 'low';
  return {
    user_id: toNumSafe(raw?.user_id),
    days: toNumSafe(raw?.days),
    engagement_score: toNumSafe(raw?.engagement_score),
    level,
    factors,
    components: {
      attendance_rate:
        comp.attendance_rate === undefined || comp.attendance_rate === null
          ? null
          : toNumSafe(comp.attendance_rate),
      homework_rate:
        comp.homework_rate === undefined || comp.homework_rate === null
          ? null
          : toNumSafe(comp.homework_rate),
      activity_rate: toNumSafe(comp.activity_rate),
      leave_days: toNumSafe(comp.leave_days),
    },
    description: raw?.description ?? '',
    has_data: !!raw?.has_data,
  };
};

const normalizeUserAnomaly = (raw?: RawAlg): AnomalyResult => {
  const list = Array.isArray(raw?.anomalies) ? (raw!.anomalies as RawJson[]) : [];
  const a: RawAlg = list[0] ?? {};
  const sevRaw = (a?.severity ?? 'low') as string;
  const severity: 'high' | 'medium' | 'low' =
    sevRaw === 'high' || sevRaw === 'medium' || sevRaw === 'low' ? sevRaw : 'low';
  return {
    name: a?.name ?? '未知学生',
    anomaly_type: a?.type || a?.anomaly_type_label || '异常',
    severity,
    description: a?.details ?? '',
    score_change: toNumSafe(a?.score_change),
    detected_at: a?.date ?? '',
  };
};

const normalizeSuddenChange = (raw?: RawAlg): AnomalyResult => {
  const list = Array.isArray(raw) ? (raw as RawJson[]) : [];
  const item: RawAlg = list[0] ?? {};
  return {
    name: '',
    anomaly_type: 'sudden_change',
    severity: 'medium',
    description: item?.rule_name ?? '',
    score_change: toNumSafe(item?.score_change),
    detected_at: item?.date ?? '',
  };
};

const normalizeTrendAnomaly = (raw?: RawAlg): AnomalyResult => {
  const has = !!raw?.has_anomaly;
  return {
    name: '',
    anomaly_type: 'trend_anomaly',
    severity: has ? 'high' : 'low',
    description: raw?.description ?? '',
    score_change: toNumSafe(raw?.total_change),
    detected_at: '',
  };
};

const normalizeGroupAnomaly = (raw?: RawAlg): AnomalyResult => {
  const has = !!raw?.has_anomaly;
  return {
    name: '',
    anomaly_type: 'group_anomaly',
    severity: has ? 'high' : 'low',
    description: raw?.description ?? '',
    score_change: 0,
    detected_at: '',
  };
};

const normalizeBatchPrediction = (raw?: RawBatchPrediction | null): BatchPredictionData => {
  const list = Array.isArray(raw?.predictions) ? raw!.predictions! : [];
  const toNum = (v: unknown, fallback = 0): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;

  const predictions: PredictionResult[] = list.map((p) => {
    const inner = (p && p.prediction) || {};
    const predictedRaw = Array.isArray(inner.predicted_scores) ? inner.predicted_scores : [];
    const predicted_score =
      predictedRaw.length > 0
        ? toNum(predictedRaw[predictedRaw.length - 1])
        : toNum(inner.current_score);
    const trendKey = typeof inner.trend === 'string' ? inner.trend : 'stable';
    return {
      name: (p && p.name) || '未知学生',
      current_score: toNum(inner.current_score),
      predicted_score,
      trend: TREND_MAP[trendKey] ?? 'stable',
      confidence: toNum(inner.confidence),
    };
  });

  // 后端不再直接给 avg_*_score，统一基于归一化后的 predictions 重新计算，
  // 避免前端读取到 undefined 导致 NaN.toFixed 这类崩溃。
  const total = predictions.length;
  const sumCurrent = predictions.reduce(
    (s, x) => s + (Number.isFinite(x.current_score) ? x.current_score : 0),
    0
  );
  const sumPredicted = predictions.reduce(
    (s, x) => s + (Number.isFinite(x.predicted_score) ? x.predicted_score : 0),
    0
  );

  return {
    summary: {
      avg_current_score: total > 0 ? round2(sumCurrent / total) : 0,
      avg_predicted_score: total > 0 ? round2(sumPredicted / total) : 0,
      improvement_count: toNum(raw?.summary?.rising_count),
      decline_count: toNum(raw?.summary?.falling_count),
      stable_count: toNum(raw?.summary?.stable_count),
    },
    predictions,
  };
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * 后端 /api/algorithm/risk-predict/batch 的原始响应形状。
 * 与前端 BatchRiskPredictData 的字段名不一致，需经 normalizeBatchRiskPredict 转换。
 */
interface RawBatchRiskPredict {
  class_name?: string | null;
  period_days?: number;
  summary?: {
    total_students?: number;
    high_risk?: number;
    medium_risk?: number;
    low_risk?: number;
    avg_risk_score?: number;
  };
  results?: Array<{
    user_id?: number;
    name?: string;
    class_name?: string;
    overall_risk_level?: 'high' | 'medium' | 'low';
    overall_risk_score?: number;
    risk_factors?: Array<{ factor?: string; score?: number; description?: string }>;
    recommended_actions?: string[];
    intervention_suggestions?: string[];
  }>;
}

/**
 * 将后端批量风险预测响应归一化为前端 BatchRiskPredictData。
 *
 * 字段映射：
 *   results               -> risks
 *   overall_risk_level    -> risk_level
 *   overall_risk_score    -> risk_score
 *   risk_factors[].description -> contributing_factors[]
 *   summary.high_risk     -> summary.high_risk_count（medium/low 同理）
 *
 * 所有字段均带默认值，后端缺字段时退化为安全空值而非 undefined，
 * 避免调用方出现 `undefined.filter` / `undefined.toFixed` 之类的运行时崩溃。
 */
const normalizeBatchRiskPredict = (raw?: RawBatchRiskPredict): BatchRiskPredictData => {
  const summary = raw?.summary ?? {};
  const results = Array.isArray(raw?.results) ? raw!.results! : [];

  return {
    summary: {
      high_risk_count: summary.high_risk ?? 0,
      medium_risk_count: summary.medium_risk ?? 0,
      low_risk_count: summary.low_risk ?? 0,
      avg_risk_score: summary.avg_risk_score ?? 0,
    },
    risks: results.map((r) => ({
      name: r?.name ?? '未知学生',
      risk_level: r?.overall_risk_level ?? 'low',
      risk_score: typeof r?.overall_risk_score === 'number' ? r.overall_risk_score : 0,
      contributing_factors: Array.isArray(r?.risk_factors)
        ? r.risk_factors
            .map((f) => f?.description ?? f?.factor ?? '')
            .filter((d): d is string => Boolean(d))
        : [],
      recommended_actions: Array.isArray(r?.recommended_actions)
        ? r.recommended_actions
        : Array.isArray(r?.intervention_suggestions)
        ? r.intervention_suggestions
        : [],
    })),
  };
};

/**
 * 后端 /api/algorithm/score-predict/batch 的原始响应形状。
 * 与前端 BatchScorePredictData 的字段名/嵌套结构不一致，需经 normalizeBatchScorePrediction 转换。
 *
 * 字段差异：
 *   predictions[].features.current_score    -> predictions[].current_score （嵌套 features 提升到顶层）
 *   predictions[].subject                   -> 后端没给，默认 '综合'
 *   predictions[].trend                     -> 后端没给，默认 'stable'
 *   summary.avg_current_score / subjects    -> 后端没给，前端按归一化后 predictions 自行计算；subjects 留空数组
 *   summary.high_performance / medium / low -> 不进前端 summary，但 raw 保留以备排查
 */
interface RawBatchScorePredict {
  period_days?: number;
  summary?: {
    total_students?: number;
    avg_predicted_score?: number;
    high_performance?: number;
    medium_performance?: number;
    low_performance?: number;
  };
  predictions?: Array<{
    user_id?: number;
    name?: string;
    class_name?: string | null;
    subject?: string;
    predicted_score?: number;
    confidence_interval?: [number, number];
    confidence?: number;
    features?: {
      current_score?: number;
      score_trend?: number;
      recent_trend?: string;
    };
    feature_importance?: Record<string, number>;
    suggestions?: string[];
  }>;
}

const normalizeBatchScorePrediction = (
  raw?: RawBatchScorePredict | null
): BatchScorePredictData => {
  const list = Array.isArray(raw?.predictions) ? raw!.predictions! : [];
  const toNum = (v: unknown, fallback = 0): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;

  const predictions: ScorePredictResult[] = list.map((p) => {
    const feats = (p && p.features) || {};
    // 把 features.current_score 提升到顶层；后端没 current_score 时给 0
    const current_score = toNum(p && (p as RawJson).current_score, toNum(feats.current_score));
    const predicted_score = toNum(p && (p as RawJson).predicted_score);
    // 推断 trend：features.recent_trend='rising/falling/stable' 或 features.score_trend>0 up / <0 down
    const rt = typeof feats.recent_trend === 'string' ? feats.recent_trend : '';
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (rt === 'rising' || rt === 'up') trend = 'up';
    else if (rt === 'falling' || rt === 'down') trend = 'down';
    else if (typeof feats.score_trend === 'number') {
      if (feats.score_trend > 0.05) trend = 'up';
      else if (feats.score_trend < -0.05) trend = 'down';
    }
    return {
      name: (p && p.name) || '未知学生',
      subject: (p && p.subject) || '综合',
      current_score,
      predicted_score,
      trend,
      confidence: toNum(p && (p as RawJson).confidence),
    };
  });

  const total = predictions.length;
  const sumCurrent = predictions.reduce(
    (s, x) => s + (Number.isFinite(x.current_score) ? x.current_score : 0),
    0
  );
  const sumPredicted = predictions.reduce(
    (s, x) => s + (Number.isFinite(x.predicted_score) ? x.predicted_score : 0),
    0
  );

  return {
    summary: {
      avg_current_score: total > 0 ? round2(sumCurrent / total) : 0,
      avg_predicted_score:
        total > 0 ? round2(sumPredicted / total) : round2(toNum(raw?.summary?.avg_predicted_score)),
      subjects: [],
    },
    predictions,
  };
};

/**
 * 后端 /api/algorithm/anomaly/batch 的原始响应形状。
 * 与前端 BatchAnomalyData 的字段名/嵌套结构不一致，需经 normalizeBatchAnomaly 转换。
 *
 * 字段映射（修复 renderAnomaly 阶段 undefined 崩溃）：
 *   顶层 anomalies[]/summary{...} -> BatchAnomalyData.anomalies / .summary
 *   summary.{high_severity/medium_severity/low_severity}_count / total_anomalies 统一 0 兜底
 *   anomalies[].anomaly_type      -> anomaly_type   （前端用 anomaly_type，已对齐）
 *   anomalies[].anomaly_type_label -> name（前端表格标题用学生名，anomaly_type_label 保留）
 *   anomalies[].severity          -> severity      （已对齐）
 *   anomalies[].description       -> description   （已对齐）
 *   anomalies[].score_change      -> score_change  （已对齐）
 *   anomalies[].detected_at       -> detected_at   （已对齐）
 */
interface RawBatchAnomaly {
  total_students?: number;
  students_with_anomaly?: number;
  anomalies_by_type?: Record<string, number>;
  summary?: {
    total_anomalies?: number;
    high_severity_count?: number;
    medium_severity_count?: number;
    low_severity_count?: number;
  };
  // 兼容旧 shape（早期返回 students 聚合，不在这里用，但保留类型防止 ts 报错）
  students?: Array<Record<string, unknown>>;
  anomalies?: Array<{
    user_id?: number;
    name?: string;
    class_name?: string | null;
    current_score?: number;
    anomaly_type?: string;
    anomaly_type_label?: string;
    severity?: 'high' | 'medium' | 'low' | string;
    description?: string;
    score_change?: number;
    detected_at?: string;
  }>;
}

const normalizeBatchAnomaly = (raw?: RawBatchAnomaly | null): BatchAnomalyData => {
  const list = Array.isArray(raw?.anomalies) ? raw!.anomalies! : [];
  const s = raw?.summary ?? {};
  return {
    summary: {
      total_anomalies: typeof s.total_anomalies === 'number' ? s.total_anomalies : 0,
      high_severity_count: typeof s.high_severity_count === 'number' ? s.high_severity_count : 0,
      medium_severity_count:
        typeof s.medium_severity_count === 'number' ? s.medium_severity_count : 0,
      low_severity_count: typeof s.low_severity_count === 'number' ? s.low_severity_count : 0,
    },
    anomalies: list.map((a) => {
      const sevRaw = (a?.severity ?? 'low') as string;
      const sev: 'high' | 'medium' | 'low' =
        sevRaw === 'high' || sevRaw === 'medium' || sevRaw === 'low' ? sevRaw : 'low';
      const scoreNum =
        typeof a?.score_change === 'number' && Number.isFinite(a.score_change) ? a.score_change : 0;
      return {
        name: a?.name ?? '未知学生',
        anomaly_type: a?.anomaly_type_label || a?.anomaly_type || '异常',
        severity: sev,
        description: a?.description ?? '',
        score_change: scoreNum,
        detected_at: a?.detected_at ?? '',
      };
    }),
  };
};

/**
 * 后端 /api/algorithm/rule-recommend 的原始响应形状。
 * 与前端 RuleRecommendData 期望的扁平 recommendations[] 不一致：
 *   - 后端原响应把数据拆成 new_rules / optimizations / combinations 三组，**没有顶层 recommendations**
 *   - summary 里没有 avg_confidence / estimated_total_impact
 * 需要 normalizeBatchRuleRecommend 把三组合并并补齐前端字段。
 */
interface RawBatchRuleRecommend {
  class_name?: string | null;
  period_days?: number;
  summary?: {
    new_rule_count?: number;
    optimization_count?: number;
    combination_count?: number;
    total_recommendations?: number;
    avg_confidence?: number;
    estimated_total_impact?: number;
  };
  new_rules?: Array<{
    category?: string;
    usage_count?: number;
    avg_score_change?: number;
    confidence?: number;
    suggested_score?: number;
    description?: string;
    suggestion?: string;
  }>;
  optimizations?: Array<{
    rule_id?: number;
    rule_name?: string;
    rule_category?: string;
    effectiveness?: number;
    suggestions?: Array<{
      type?: string;
      message?: string;
      current_score?: number;
      suggested_score?: number;
    }>;
  }>;
  combinations?: Array<{
    rules?: Array<{ id?: number; name?: string }>;
    frequency?: number;
    confidence?: number;
    description?: string;
    suggestion?: string;
  }>;
  recommendations?: Array<{
    rule_id?: number | null;
    rule_name?: string;
    category?: string;
    description?: string;
    confidence?: number;
    estimated_impact?: number;
    source_type?: 'new_rule' | 'optimization' | 'combination' | string;
  }>;
}

const normalizeBatchRuleRecommend = (raw?: RawBatchRuleRecommend | null): RuleRecommendData => {
  const summary = raw?.summary ?? {};

  // 优先用后端已经展平的 recommendations[]（2026-08-06 svc 改造后提供）；
  // 若后端未提供，则从前端组合构造（兜底）。
  let unified: RuleRecommendData['recommendations'];
  if (Array.isArray(raw?.recommendations) && raw!.recommendations!.length > 0) {
    unified = raw!.recommendations!.map((r) => ({
      rule_id: r?.rule_id ?? null,
      rule_name: r?.rule_name ?? '未命名规则',
      category: r?.category ?? '未分类',
      description: r?.description ?? '',
      confidence:
        typeof r?.confidence === 'number' && Number.isFinite(r.confidence) ? r.confidence : 0,
      estimated_impact:
        typeof r?.estimated_impact === 'number' && Number.isFinite(r.estimated_impact)
          ? r.estimated_impact
          : 0,
    }));
  } else {
    unified = [];
    for (const r of raw?.new_rules ?? []) {
      const impact = typeof r?.suggested_score === 'number' ? r.suggested_score : 0;
      unified.push({
        rule_id: null,
        rule_name: r?.category ?? '未分类',
        category: r?.category ?? '未分类',
        description: r?.description ?? r?.suggestion ?? '',
        confidence: typeof r?.confidence === 'number' ? r.confidence : 0,
        estimated_impact: impact,
      });
    }
    for (const r of raw?.optimizations ?? []) {
      let impact = 0;
      const sugs = r?.suggestions ?? [];
      for (const s of sugs) {
        if (s?.type === 'low_impact' || s?.type === 'high_effectiveness') {
          const cur = typeof s?.current_score === 'number' ? s.current_score : 0;
          const sug = typeof s?.suggested_score === 'number' ? s.suggested_score : 0;
          impact = round2(sug - cur);
          break;
        }
      }
      unified.push({
        rule_id: r?.rule_id ?? null,
        rule_name: r?.rule_name ?? '未命名规则',
        category: r?.rule_category ?? '未分类',
        description: sugs[0]?.message ?? '',
        confidence: typeof r?.effectiveness === 'number' ? r.effectiveness : 0,
        estimated_impact: impact,
      });
    }
    for (const r of raw?.combinations ?? []) {
      const rules = r?.rules ?? [];
      const ruleText = rules.map((rt) => rt?.name ?? `规则${rt?.id ?? ''}`).join(' + ');
      unified.push({
        rule_id: null,
        rule_name: ruleText ? `组合:${ruleText}` : '组合推荐',
        category: '规则组合',
        description: r?.description ?? r?.suggestion ?? '',
        confidence: typeof r?.confidence === 'number' ? r.confidence : 0,
        estimated_impact: 0,
      });
    }
  }

  // summary 兜底：avg_confidence / estimated_total_impact 缺失则由 unified 重算
  const total = unified.length;
  const avgConfidence =
    typeof summary.avg_confidence === 'number'
      ? summary.avg_confidence
      : total > 0
      ? round2(unified.reduce((a, b) => a + b.confidence, 0) / total)
      : 0;
  const estimatedImpact =
    typeof summary.estimated_total_impact === 'number'
      ? summary.estimated_total_impact
      : round2(unified.reduce((a, b) => a + b.estimated_impact, 0));

  return {
    summary: {
      total_recommendations:
        typeof summary.total_recommendations === 'number' ? summary.total_recommendations : total,
      avg_confidence: avgConfidence,
      estimated_total_impact: estimatedImpact,
    },
    recommendations: unified,
  };
};

const api: Api = {
  dashboard: {
    getData: () => request('/api/dashboard/data') as Promise<DashboardData>,
  },
  users: {
    getAll: (params = {}) => {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.per_page) queryParams.append('per_page', params.per_page.toString());
      if (params.search) queryParams.append('search', params.search);
      if (params.class_name) queryParams.append('class_name', params.class_name);
      if (params.skipCache) queryParams.append('skip_cache', 'true');
      // 高级筛选参数
      if (params.keyword) queryParams.append('keyword', params.keyword);
      if (params.min_score !== undefined && params.min_score !== null)
        queryParams.append('min_score', params.min_score.toString());
      if (params.max_score !== undefined && params.max_score !== null)
        queryParams.append('max_score', params.max_score.toString());
      if (params.sort_by) queryParams.append('sort_by', params.sort_by);
      if (params.sort_order) queryParams.append('sort_order', params.sort_order);
      const query = queryParams.toString();
      const options: RequestOptions = {};
      if (params.skipCache) options.skipCache = true;
      return request(
        `/api/users${query ? '?' + query : ''}`,
        options
      ) as Promise<UserPaginatedResponse>;
    },
    getById: (id) => request(`/api/users/${id}`) as Promise<User>,
    create: (data) =>
      request('/api/users', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<User>,
    update: (id, data) =>
      request(`/api/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<User>,
    delete: (id) => request(`/api/users/${id}`, { method: 'DELETE' }) as Promise<void>,
    getByCard: (cardId) => request(`/api/users/by-card/${cardId}`) as Promise<User>,
    // 切换用户启用状态（后端 user-management 命名空间；PUT /users/{id} 不处理 is_active）
    toggleActive: (id) =>
      request(`/api/user-management/user/${id}/toggle-active`, {
        method: 'POST',
      }) as Promise<{ is_active: boolean }>,
    import: (data) =>
      request('/api/users/import', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<{ imported: number }>,
    batchDelete: (ids) =>
      request('/api/users/batch-delete', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }) as Promise<void>,
    batchUpdateScore: (ids, scoreChange, description) =>
      request('/api/users/batch-score', {
        method: 'POST',
        body: JSON.stringify({ ids, score_change: scoreChange, description }),
      }) as Promise<void>,
    downloadTemplate: () => '/api/users/template/download',
  },
  scoreCategories: {
    getAll: async () => {
      const response = await request('/api/score-categories');
      return (response as { categories: Category[] }).categories || [];
    },
    create: (data) =>
      request('/api/score-categories', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<Category>,
    update: (id, data) =>
      request(`/api/score-categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<Category>,
    delete: (id) => request(`/api/score-categories/${id}`, { method: 'DELETE' }) as Promise<void>,
  },
  rules: {
    getAll: async (params = {}) => {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.per_page) queryParams.append('per_page', params.per_page.toString());
      if (params.category_id) queryParams.append('category_id', params.category_id.toString());
      if (params.is_active !== undefined && params.is_active !== null)
        queryParams.append('is_active', String(params.is_active));
      const query = queryParams.toString();
      const result = (await request(`/api/rules${query ? '?' + query : ''}`)) as
        | { rules: Array<Record<string, unknown>>; total: number; pages: number }
        | Array<Record<string, unknown>>;
      const rawRules = Array.isArray(result) ? result : result.rules || [];
      const mappedRules = rawRules.map((r: Record<string, unknown>) => ({
        ...r,
        max_per_day: r.max_per_day ?? r.daily_limit ?? 0,
        score_min: r.score_min ?? r.min_score,
        score_max: r.score_max ?? r.max_score,
      })) as Rule[];
      if (Array.isArray(result)) return mappedRules;
      return { rules: mappedRules, total: result.total, pages: result.pages };
    },
    create: (data) =>
      request('/api/rules', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<Rule>,
    update: (id, data) =>
      request(`/api/rules/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<Rule>,
    delete: (id) => request(`/api/rules/${id}`, { method: 'DELETE' }) as Promise<void>,
    export: () => request('/api/rules/export') as Promise<string>,
    import: (data) =>
      request('/api/rules/import', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<{ imported: number }>,
    downloadTemplate: () => '/api/rules/template/download',
  },
  rankRules: {
    getAll: async () => {
      const response = await request('/api/rank-rules');
      return (response as { rules: RankRule[] }).rules || [];
    },
    create: (data) =>
      request('/api/rank-rules', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<RankRule>,
    update: (id, data) =>
      request(`/api/rank-rules/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<RankRule>,
    delete: (id) => request(`/api/rank-rules/${id}`, { method: 'DELETE' }) as Promise<void>,
    getByScore: (score) => request(`/api/rank-rules/get-rank/${score}`) as Promise<RankRule>,
  },
  records: {
    create: (data) =>
      request('/api/records', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<ScoreRecordItem>,
    getByUser: (userId, params = {}) => {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.per_page) queryParams.append('per_page', params.per_page.toString());
      const query = queryParams.toString();
      return request(`/api/records/user/${userId}${query ? '?' + query : ''}`) as Promise<
        ScoreRecordItem[]
      >;
    },
    getAll: (params = {}) => {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, String(value));
      });
      return request(`/api/records?${queryParams.toString()}`) as Promise<ScoreRecordItem[]>;
    },
    getStatistics: (params = {}) => {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, String(value));
      });
      return request(`/api/records/statistics?${queryParams.toString()}`) as Promise<unknown>;
    },
  },
  auth: {
    login: async (data) => {
      const result = (await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
        skipAuth: true,
        skipDataExtract: true,
      })) as {
        access_token: string;
        refresh_token: string;
        user: Admin;
        data?: { admin?: Admin; user?: Admin };
      };
      const user = result.user || result.data?.admin || result.data?.user;
      // 十评 P2-1：token 由后端 Set-Cookie HttpOnly 写入，前端不再存储
      if (user) {
        const adminWithRoleType = {
          ...user,
          role_type: user.role_type || user.role || 'admin',
          name: user.name || user.real_name || user.username,
          is_active: user.is_active !== undefined ? user.is_active : true,
          created_at: user.created_at || new Date().toISOString(),
        };
        setCurrentAdmin(adminWithRoleType as Admin);
      }
      return {
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        user: user as Admin,
      };
    },
    getCsrfToken: () => request('/api/admins/csrf-token') as Promise<{ csrf_token: string }>,
  },
  admins: {
    login: async (data) => {
      const result = (await request('/api/admins/login', {
        method: 'POST',
        body: JSON.stringify(data),
        skipAuth: true,
        skipDataExtract: true,
      })) as {
        access_token: string;
        refresh_token: string;
        admin: Admin;
        data?: { admin?: Admin };
      };
      setCurrentAdmin(result.admin || result.data?.admin);
      return { ...result, admin: result.admin || result.data?.admin };
    },
    getCsrfToken: () => request('/api/admins/csrf-token') as Promise<{ csrf_token: string }>,
    getAll: async () => {
      const result = (await request('/api/admins')) as
        | { admins: Array<Record<string, unknown>> }
        | Array<Record<string, unknown>>;
      const rawList = Array.isArray(result) ? result : result.admins || [];
      return rawList.map((a: Record<string, unknown>) => ({
        ...a,
        name: a.name || a.real_name || a.username || '',
        role_type: a.role_type || a.role || 'admin',
      })) as Admin[];
    },
    getById: (id) => request(`/api/admins/${id}`) as Promise<Admin>,
    create: (data) =>
      request('/api/admins', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<Admin>,
    update: (id, data) =>
      request(`/api/admins/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<Admin>,
    delete: (id) => request(`/api/admins/${id}`, { method: 'DELETE' }) as Promise<void>,
    changePassword: (id, data) =>
      request(`/api/admins/${id}/change-password`, {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<void>,
  },
  roles: {
    getAll: async () => {
      const result = (await request('/api/roles')) as { roles: Role[] } | Role[];
      return Array.isArray(result) ? result : result.roles || [];
    },
    create: (data) =>
      request('/api/roles', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<Role>,
    update: (id, data) =>
      request(`/api/roles/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<Role>,
    delete: (id) =>
      request(`/api/roles/${id}`, {
        method: 'DELETE',
      }) as Promise<void>,
  },
  export: {
    users: (format: 'excel' | 'pdf' = 'excel') => `/api/export/users?format=${format}`,
    records: (userId?: number, format: 'excel' | 'pdf' = 'excel') => {
      const baseUrl = `/api/export/records?format=${format}`;
      return userId ? `${baseUrl}&user_id=${userId}` : baseUrl;
    },
    rules: (format: 'excel' | 'pdf' = 'excel') => `/api/export/rules?format=${format}`,
    devices: (format: 'excel' | 'pdf' = 'excel') => `/api/export/devices?format=${format}`,
    summary: () => '/api/export/summary',
    errors: (
      errors: Array<{
        row?: number;
        error_fields: string[];
        message: string;
        row_data?: Record<string, unknown>;
      }>,
      module: string
    ) => {
      fetch('/api/export/errors', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ errors, module }),
      })
        .then((response) => {
          if (!response.ok) throw new Error(`导出错误明细失败(${response.status})`);
          return response.blob();
        })
        .then((blob) => {
          downloadBlob(blob, `import_errors_${module}_${Date.now()}.xlsx`);
        })
        .catch((err) => {
          // 避免 unhandled rejection；调用方为"导出错误数据"按钮，失败时给出可观测日志
          logger.error('导出错误明细失败:', err);
        });
    },
  },
  analysis: {
    getUserAnalysis: (userId) => request(`/api/analysis/user/${userId}`) as Promise<unknown>,
    getClassAnalysis: (className) =>
      request(`/api/analysis/class/${className}`) as Promise<unknown>,
    getClassCompare: (classNames: string[], period: '7d' | '30d' | '90d') => {
      const url = `/api/analysis/class-compare?class_names=${classNames.join(
        ','
      )}&period=${period}`;
      // 后端返回 APIResponse.success(data=[...])，request 默认剥信封 → 直接返回数组
      return request(url) as Promise<unknown[]>;
    },
  },
  timeRules: {
    getAll: async () => {
      const response = await request('/api/time-rules');
      return (response as { rules: TimeRule[] }).rules || [];
    },
    getById: (id) => request(`/api/time-rules/${id}`) as Promise<TimeRule>,
    create: (data) =>
      request('/api/time-rules', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<TimeRule>,
    update: (id, data) =>
      request(`/api/time-rules/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<TimeRule>,
    delete: (id) => request(`/api/time-rules/${id}`, { method: 'DELETE' }) as Promise<void>,
    check: (data) =>
      request('/api/time-rules/check', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<{ allowed: boolean; rule?: TimeRule }>,
  },
  classPeriods: {
    getAll: async () => {
      const response = await request('/api/class-periods');
      return (response as { periods: ClassPeriod[]; total: number }) || { periods: [], total: 0 };
    },
    getActive: async () => {
      const response = await request('/api/class-periods/active');
      return (response as { periods: ClassPeriod[]; total: number }) || { periods: [], total: 0 };
    },
    getById: (id: number) => request(`/api/class-periods/${id}`) as Promise<ClassPeriod>,
    create: (data: Omit<ClassPeriod, 'id' | 'created_at' | 'updated_at' | 'duration'>) =>
      request('/api/class-periods', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<ClassPeriod>,
    update: (
      id: number,
      data: Partial<Omit<ClassPeriod, 'id' | 'created_at' | 'updated_at' | 'duration'>>
    ) =>
      request(`/api/class-periods/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<ClassPeriod>,
    delete: (id: number) =>
      request(`/api/class-periods/${id}`, { method: 'DELETE' }) as Promise<void>,
    batchUpdate: (periods: Partial<ClassPeriod>[]) =>
      request('/api/class-periods/batch', {
        method: 'PUT',
        body: JSON.stringify({ periods }),
      }) as Promise<void>,
    reset: () =>
      request('/api/class-periods/reset', {
        method: 'POST',
      }) as Promise<void>,
  },
  box: {
    verify: (data) =>
      request('/api/box/verify', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<{ verified: boolean; user?: User }>,
  },
  phoneBoxPolicy: {
    get: (classInfoId?: number) =>
      request(
        classInfoId ? `/api/phonebox-policy?class_info_id=${classInfoId}` : '/api/phonebox-policy'
      ) as Promise<PhoneBoxPolicy>,
    update: (
      data: { allow_self_unlock?: boolean; unlock_windows?: UnlockWindow[] },
      classInfoId?: number
    ) =>
      request(
        classInfoId ? `/api/phonebox-policy?class_info_id=${classInfoId}` : '/api/phonebox-policy',
        { method: 'PUT', body: JSON.stringify(data) }
      ) as Promise<PhoneBoxPolicy>,
    override: (minutes: number, classInfoId?: number) =>
      request(
        classInfoId
          ? `/api/phonebox-policy/override?class_info_id=${classInfoId}`
          : '/api/phonebox-policy/override',
        { method: 'POST', body: JSON.stringify({ minutes }) }
      ) as Promise<PhoneBoxPolicy>,
    cancelOverride: (classInfoId?: number) =>
      request(
        classInfoId
          ? `/api/phonebox-policy/cancel-override?class_info_id=${classInfoId}`
          : '/api/phonebox-policy/cancel-override',
        { method: 'POST' }
      ) as Promise<PhoneBoxPolicy>,
  },
  mqtt: {
    getConfig: () => request('/api/mqtt/config') as Promise<MQTTConfig>,
    updateConfig: (data) =>
      request('/api/mqtt/config', {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<MQTTConfig>,
    getStatus: () =>
      request(`/api/mqtt/status?_=${Date.now()}`, { skipCache: true }) as Promise<MQTTStatus>,
    connect: () =>
      request('/api/mqtt/connect', {
        method: 'POST',
      }) as Promise<void>,
    disconnect: () =>
      request('/api/mqtt/disconnect', {
        method: 'POST',
      }) as Promise<void>,
    publish: (data) =>
      request('/api/mqtt/publish', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<void>,
    subscribe: (data) =>
      request('/api/mqtt/subscribe', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<void>,
    unsubscribe: (data) =>
      request('/api/mqtt/unsubscribe', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<void>,
    getLogs: (limit = 100) =>
      request(`/api/mqtt/logs?limit=${limit}&_=${Date.now()}`, { skipCache: true }) as Promise<
        MQTTLog[]
      >,
    unlock: (data) =>
      request('/api/mqtt/unlock', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<void>,
  },
  system: {
    backup: () =>
      request('/api/system/backup', {
        method: 'POST',
      }) as Promise<{ filename: string }>,
    restore: (filename) =>
      request('/api/system/restore', {
        method: 'POST',
        body: JSON.stringify({ filename }),
      }) as Promise<void>,
    listBackups: () => request('/api/system/backups') as Promise<BackupInfo[]>,
    clearCache: () => {
      cache.clear();
      return request('/api/system/clear-cache', {
        method: 'POST',
      }) as Promise<void>;
    },
    getConfig: () => request('/api/system/config') as Promise<SystemConfig>,
    updateConfig: (data) =>
      request('/api/system/config', {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<SystemConfig>,
  },
  algorithm: {
    getPrediction: async (userId: number, days = 7) => {
      const raw = (await request(`/api/algorithm/prediction/${userId}?days=${days}`)) as RawJson;
      return normalizeUserPrediction(raw);
    },
    getBatchPrediction: async (className?: string, days = 7) => {
      const params = new URLSearchParams();
      if (className) params.append('class_name', className);
      params.append('days', String(days));
      const raw = (await request(
        `/api/algorithm/prediction/batch?${params.toString()}`
      )) as RawBatchPrediction | null;
      // 后端字段在 prediction 子对象里，且 summary 命名也不同；统一归一化避免页面读到 undefined 崩溃。
      return normalizeBatchPrediction(raw);
    },
    getRiskStudents: (days = 7) =>
      request(`/api/algorithm/prediction/risk?days=${days}`) as Promise<RiskStudent[]>,

    getUserAnomaly: async (userId: number, days = 30) => {
      const raw = (await request(`/api/algorithm/anomaly/${userId}?days=${days}`)) as RawJson;
      return normalizeUserAnomaly(raw);
    },
    getBatchAnomaly: async (className?: string, days = 30) => {
      const params = new URLSearchParams();
      if (className) params.append('class_name', className);
      params.append('days', String(days));
      // 后端返回顶层字段名/嵌套结构与前端 BatchAnomalyData 不一致，
      // 必须经 normalizeBatchAnomaly 归一化，否则 renderAnomaly 读 summary.total_anomalies 会崩。
      const raw = (await request(
        `/api/algorithm/anomaly/batch?${params.toString()}`
      )) as RawBatchAnomaly;
      return normalizeBatchAnomaly(raw);
    },
    getSuddenChange: async (userId: number, days = 30) => {
      const raw = (await request(`/api/algorithm/anomaly/sudden/${userId}?days=${days}`)) as RawJson;
      return normalizeSuddenChange(raw);
    },
    getTrendAnomaly: async (userId: number, days = 30) => {
      const raw = (await request(`/api/algorithm/anomaly/trend/${userId}?days=${days}`)) as RawJson;
      return normalizeTrendAnomaly(raw);
    },
    getGroupAnomaly: async (userId: number, days = 30) => {
      const raw = (await request(`/api/algorithm/anomaly/group/${userId}?days=${days}`)) as RawJson;
      return normalizeGroupAnomaly(raw);
    },

    getRuleRecommend: async (className?: string, days = 30) => {
      const params = new URLSearchParams();
      if (className) params.append('class_name', className);
      params.append('days', String(days));
      const raw = (await request(
        `/api/algorithm/rule-recommend?${params.toString()}`
      )) as RawBatchRuleRecommend | null;
      return normalizeBatchRuleRecommend(raw);
    },
    getNewRuleRecommend: (className?: string, days = 30) => {
      const params = new URLSearchParams();
      if (className) params.append('class_name', className);
      params.append('days', String(days));
      return request(
        `/api/algorithm/rule-recommend/new?${params.toString()}`
      ) as Promise<RuleRecommendData>;
    },
    getRuleOptimization: (className?: string, days = 30) => {
      const params = new URLSearchParams();
      if (className) params.append('class_name', className);
      params.append('days', String(days));
      return request(
        `/api/algorithm/rule-recommend/optimization?${params.toString()}`
      ) as Promise<RuleRecommendData>;
    },
    getRuleCombination: (className?: string, days = 30) => {
      const params = new URLSearchParams();
      if (className) params.append('class_name', className);
      params.append('days', String(days));
      return request(
        `/api/algorithm/rule-recommend/combination?${params.toString()}`
      ) as Promise<RuleRecommendData>;
    },
    getRuleStatistics: (days = 30) =>
      request(
        `/api/algorithm/rule-recommend/statistics?days=${days}`
      ) as Promise<RuleRecommendData>,
    trainRuleRecommendModel: (days = 90) =>
      request(`/api/algorithm/rule-recommend/train?days=${days}`, {
        method: 'POST',
      }) as Promise<ModelTrainingResult>,
    evaluateRuleRecommendModel: (days = 30) =>
      request(
        `/api/algorithm/rule-recommend/evaluate?days=${days}`
      ) as Promise<ModelEvaluationResult>,

    getScorePredict: async (userId: number, days = 30) => {
      const raw = (await request(`/api/algorithm/score-predict/${userId}?days=${days}`)) as RawJson;
      return normalizeUserScorePredict(raw);
    },
    getBatchScorePredict: async (className?: string, days = 30) => {
      const params = new URLSearchParams();
      if (className) params.append('class_name', className);
      params.append('days', String(days));
      const raw = (await request(
        `/api/algorithm/score-predict/batch?${params.toString()}`
      )) as RawBatchScorePredict | null;
      // 后端 current_score 嵌在 features 里，且 subject/trend 缺字段；统一归一化避免页面读到 undefined 崩溃。
      return normalizeBatchScorePrediction(raw);
    },
    getScoreDistribution: (className?: string) => {
      const params = new URLSearchParams();
      if (className) params.append('class_name', className);
      return request(
        `/api/algorithm/score-predict/distribution${
          params.toString() ? '?' + params.toString() : ''
        }`
      ) as Promise<unknown>;
    },
    trainScorePredictModel: (days = 90) =>
      request(`/api/algorithm/score-predict/train?days=${days}`, {
        method: 'POST',
      }) as Promise<ModelTrainingResult>,
    evaluateScorePredictModel: (days = 30) =>
      request(
        `/api/algorithm/score-predict/evaluate?days=${days}`
      ) as Promise<ModelEvaluationResult>,

    getRiskPredict: async (userId: number, days = 30) => {
      const raw = (await request(`/api/algorithm/risk-predict/${userId}?days=${days}`)) as RawJson;
      return normalizeUserRiskPredict(raw);
    },
    getScoreAttribution: async (userId: number, days = 30) => {
      const raw = (await request(`/api/algorithm/attribution/${userId}?days=${days}`)) as RawJson;
      return normalizeScoreAttribution(raw);
    },
    getBatchAttribution: async (className?: string, days = 30) => {
      const params = className
        ? `?class_name=${encodeURIComponent(className)}&days=${days}`
        : `?days=${days}`;
      const raw = (await request(`/api/algorithm/attribution/batch${params}`)) as RawJson;
      return normalizeBatchAttribution(raw);
    },
    getEngagementRank: async (className?: string, days = 30) => {
      const params = className
        ? `?class_name=${encodeURIComponent(className)}&days=${days}`
        : `?days=${days}`;
      const raw = (await request(`/api/algorithm/engagement/batch${params}`)) as RawJson;
      return normalizeEngagementRank(raw);
    },
    getEngagementTrend: async (userId: number, weeks = 8) => {
      const raw = (await request(
        `/api/algorithm/engagement/${userId}/weekly-trend?weeks=${weeks}`
      )) as RawJson;
      return normalizeEngagementTrend(raw);
    },
    getEngagement: async (userId: number, days = 30) => {
      const raw = (await request(`/api/algorithm/engagement/${userId}?days=${days}`)) as RawJson;
      return normalizeUserEngagement(raw);
    },
    exportExcel: (tab: 'engagement' | 'attribution' | 'risk', className?: string, days = 30) => {
      const params = new URLSearchParams();
      params.append('tab', tab);
      if (className) params.append('class_name', className);
      params.append('days', String(days));
      // 十评 P2-1：token 走 cookie，fetch 显式携带 credentials
      return fetch(`${API_BASE_URL}/api/algorithm/export?${params.toString()}`, {
        credentials: 'include',
      })
        .then((res) => {
          if (!res.ok) throw new Error(`导出失败：HTTP ${res.status}`);
          return res.blob();
        })
        .then((blob) => {
          downloadBlob(blob, `算法${tab}_${className || '全部'}.xlsx`);
        });
    },
    getBatchRiskPredict: async (className?: string, days = 30) => {
      const params = new URLSearchParams();
      if (className) params.append('class_name', className);
      params.append('days', String(days));
      // request() 已剥 envelope，res 本身就是后端 raw batch 对象
      const res = (await request(
        `/api/algorithm/risk-predict/batch?${params.toString()}`
      )) as RawBatchRiskPredict;
      // 后端 RiskPredictService.predict_batch 的字段名与前端 BatchRiskPredictData 不一致
      // （results/overall_risk_level/overall_risk_score/risk_factors/summary.high_risk），
      // 此处做一次归一化，避免页面直接读到 undefined 而崩溃。
      return normalizeBatchRiskPredict(res);
    },
    getHighRiskStudents: (days = 30) =>
      request(`/api/algorithm/risk-predict/high-risk?days=${days}`) as Promise<RiskStudent[]>,
    trainRiskPredictModel: (days = 90) =>
      request(`/api/algorithm/risk-predict/train?days=${days}`, {
        method: 'POST',
      }) as Promise<ModelTrainingResult>,
    evaluateRiskPredictModel: (days = 30) =>
      request(
        `/api/algorithm/risk-predict/evaluate?days=${days}`
      ) as Promise<ModelEvaluationResult>,

    // 智能规则自动应用
    executeRuleEngine: (modelOutput: unknown, userContext: unknown) =>
      request('/api/algorithm/rule-engine/execute', {
        method: 'POST',
        body: JSON.stringify({ model_output: modelOutput, user_context: userContext }),
      }) as Promise<unknown>,
    applyRuleByBehavior: (userId: number, behaviorType: string, context?: unknown) =>
      request('/api/algorithm/rule-engine/apply-by-behavior', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, behavior_type: behaviorType, context }),
      }) as Promise<unknown>,

    getScoreDistributionStats: (className?: string) => {
      const params = new URLSearchParams();
      if (className) params.append('class_name', className);
      return request(
        `/api/algorithm/score-distribution/statistics${
          params.toString() ? '?' + params.toString() : ''
        }`
      ) as Promise<unknown>;
    },
    adjustScoreDistribution: (className?: string) => {
      const params = new URLSearchParams();
      if (className) params.append('class_name', className);
      return request(
        `/api/algorithm/score-distribution/adjust${
          params.toString() ? '?' + params.toString() : ''
        }`,
        { method: 'POST' }
      ) as Promise<{ data: unknown }>;
    },
    validateScoreDistribution: (scores: number[]) =>
      request('/api/algorithm/score-distribution/validate', {
        method: 'POST',
        body: JSON.stringify({ scores }),
      }) as Promise<{ data: unknown }>,
    detectOutliers: (scores: number[]) =>
      request('/api/algorithm/score-validator/detect-outliers', {
        method: 'POST',
        body: JSON.stringify({ scores }),
      }) as Promise<{ data: unknown }>,
    validateAndCorrectScores: (scores: number[]) =>
      request('/api/algorithm/score-validator/validate-and-correct', {
        method: 'POST',
        body: JSON.stringify({ scores }),
      }) as Promise<{ data: unknown }>,

    earnScore: (userId: number, behaviorType: string, context?: unknown) =>
      request('/api/algorithm/score-ecosystem/earn', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, behavior_type: behaviorType, context }),
      }) as Promise<unknown>,
    spendScore: (userId: number, spendingType: string, amount = 1) =>
      request('/api/algorithm/score-ecosystem/spend', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, spending_type: spendingType, amount }),
      }) as Promise<unknown>,
    getEarningRules: () =>
      request('/api/algorithm/score-ecosystem/earning-rules') as Promise<{ data: unknown }>,
    getSpendingRules: () =>
      request('/api/algorithm/score-ecosystem/spending-rules') as Promise<{ data: unknown }>,
    getUserBalance: (userId: number) =>
      request(`/api/algorithm/score-ecosystem/balance/${userId}`) as Promise<{ data: unknown }>,

    handlePhoneAccess: (userId: number, accessCount = 1) =>
      request('/api/algorithm/reward/phone-access', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, access_count: accessCount }),
      }) as Promise<unknown>,
    getRewardTypes: () => request('/api/algorithm/reward/types') as Promise<{ data: unknown }>,
    getEligibleRewards: (userId: number) =>
      request(`/api/algorithm/reward/eligible/${userId}`) as Promise<{ data: unknown }>,
    redeemReward: (userId: number, rewardType: string) =>
      request('/api/algorithm/reward/redeem', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, reward_type: rewardType }),
      }) as Promise<unknown>,
    getDailyRewardUsage: (userId: number) =>
      request(`/api/algorithm/reward/daily-usage/${userId}`) as Promise<{ data: unknown }>,

    getStatistics: (params?: { class_name?: string }) => {
      const queryParams = new URLSearchParams();
      if (params?.class_name) queryParams.append('class_name', params.class_name);
      const query = queryParams.toString();
      return request(
        `/api/algorithm/statistics${query ? '?' + query : ''}`
      ) as Promise<AlgorithmStatistics>;
    },

    getClusters: (params?: { class_name?: string }) => {
      const queryParams = new URLSearchParams();
      if (params?.class_name) queryParams.append('class_name', params.class_name);
      const query = queryParams.toString();
      return request(`/api/algorithm/cluster${query ? '?' + query : ''}`) as Promise<ClusterData>;
    },

    getCompositeScores: (params?: { class_name?: string }) => {
      const queryParams = new URLSearchParams();
      if (params?.class_name) queryParams.append('class_name', params.class_name);
      const query = queryParams.toString();
      return request(`/api/algorithm/composite-score${query ? '?' + query : ''}`) as Promise<{
        data: unknown;
      }>;
    },

    getWarnings: (params?: { class_name?: string }) => {
      const queryParams = new URLSearchParams();
      if (params?.class_name) queryParams.append('class_name', params.class_name);
      const query = queryParams.toString();
      return request(`/api/algorithm/warning${query ? '?' + query : ''}`) as Promise<WarningData>;
    },
    getAll: () => request('/api/algorithm/all') as Promise<AlgorithmData>,
    runAnalysis: () => request('/api/algorithm/run', { method: 'POST' }) as Promise<AlgorithmData>,
    getWarningConfig: () => request('/api/algorithm/warning/config') as Promise<{ data: unknown }>,
    recalculateClusters: () =>
      request('/api/algorithm/cluster/recalculate', { method: 'POST' }) as Promise<{
        data: unknown;
      }>,
    recalculateCompositeScores: () =>
      request('/api/algorithm/composite-score/recalculate', { method: 'POST' }) as Promise<{
        data: unknown;
      }>,
    runWarningEvaluation: () =>
      request('/api/algorithm/warning/evaluate', { method: 'POST' }) as Promise<{ data: unknown }>,
    resolveWarning: (warningId: number) =>
      request(`/api/algorithm/warning/${warningId}/resolve`, { method: 'POST' }) as Promise<{
        data: unknown;
      }>,
    updateWarningConfig: (data: { config_key: string; config_value: string }) =>
      request('/api/algorithm/warning/config', {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<{ data: unknown }>,
    getCompositeScoreProgress: () =>
      request('/api/algorithm/composite-score/progress') as Promise<{
        status: string;
        progress: number;
        message: string;
        total_students: number;
        completed_students: number;
        start_time: string | null;
        end_time: string | null;
      }>,
  },
  operationLogs: {
    getAll: (params = {}) => {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, String(value));
      });
      return request(
        `/api/operation-logs?${queryParams.toString()}`
      ) as Promise<OperationLogListResponse>;
    },
    getStats: (params = {}) => {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, String(value));
      });
      return request(`/api/operation-logs/stats?${queryParams.toString()}`) as Promise<unknown>;
    },
    getSummary: () => request('/api/operation-logs/summary') as Promise<unknown>,
  },
  notifications: {
    getAll: (params = {}) => {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, String(value));
      });
      return request(`/api/notifications?${queryParams.toString()}`) as Promise<Notification[]>;
    },
    getUnread: async () => {
      const result = (await request('/api/notifications?status=unread')) as
        | { notifications: Notification[] }
        | Notification[];
      return Array.isArray(result) ? result : result.notifications || [];
    },
    markAsRead: (id) =>
      request(`/api/notifications/${id}/read`, { method: 'POST' }) as Promise<void>,
    markAllAsRead: () =>
      request('/api/notifications/read-all', { method: 'POST' }) as Promise<void>,
    create: (data) =>
      request('/api/notifications', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<Notification>,
    delete: (id) => request(`/api/notifications/${id}`, { method: 'DELETE' }) as Promise<void>,
    batchSend: (data) =>
      request('/api/notifications/batch', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<BatchNotifyResult>,
  },
  classes: {
    getAll: async (params?: {
      page?: number;
      per_page?: number;
      keyword?: string;
      skipCache?: boolean;
    }) => {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.per_page) queryParams.append('per_page', params.per_page.toString());
      if (params?.keyword) queryParams.append('keyword', params.keyword);
      const query = queryParams.toString();
      const url = query ? `/api/classes/?${query}` : '/api/classes/';
      const result = (await request(url, { skipCache: params?.skipCache })) as ClassListResponse;
      return result;
    },
    getStudents: (className, params?: { page?: number; per_page?: number }) => {
      const qp = new URLSearchParams();
      if (params?.page) qp.append('page', String(params.page));
      qp.append('per_page', String(params?.per_page ?? 500));
      const qs = qp.toString();
      return request(
        `/api/classes/${encodeURIComponent(className)}/students?${qs}`
      ) as Promise<User[]>;
    },
    create: (data) =>
      request('/api/classes', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<ClassInfo>,
    update: (id, data) =>
      request(`/api/classes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<ClassInfo>,
    delete: (id) => request(`/api/classes/${id}`, { method: 'DELETE' }) as Promise<void>,
    export: (keyword?: string, format?: 'json' | 'excel') => {
      const queryParams = new URLSearchParams();
      if (keyword) queryParams.append('keyword', keyword);
      if (format) queryParams.append('format', format);
      const query = queryParams.toString();
      const url = `/api/classes/export${query ? '?' + query : ''}`;
      // fetch blob + 下载（cookie 鉴权、可校验），替代 window.open
      return fetch(`${API_BASE_URL}${url}`, {
        credentials: 'include',
      })
        .then((res) => {
          if (!res.ok) throw new Error(`导出失败：HTTP ${res.status}`);
          return res.blob();
        })
        .then((blob) => {
          downloadBlob(blob, `班级列表_${keyword || '全部'}.${format === 'json' ? 'json' : 'xlsx'}`);
        });
    },
    import: (data: FormData, customUrl?: string) =>
      request(customUrl || '/api/classes/import', {
        method: 'POST',
        body: data,
      }) as Promise<{
        success: boolean;
        total: number;
        success_count: number;
        failed_count: number;
        messages: Array<{ name: string; action: string; message: string }>;
      }>,
  },
  adminClasses: {
    getByAdmin: (adminId: number) => request(`/api/admin-classes/${adminId}`) as Promise<unknown>,
    assign: (adminId: number, class_id: number, isPrimary?: boolean) =>
      request(`/api/admin-classes/${adminId}/assign-class`, {
        method: 'POST',
        body: JSON.stringify({ class_id: class_id, is_primary: isPrimary || false }),
      }) as Promise<unknown>,
    remove: (adminId: number, class_id: number) =>
      request(`/api/admin-classes/${adminId}/remove-class/${class_id}`, {
        method: 'POST',
        body: JSON.stringify({}),
      }) as Promise<unknown>,
  },
  permissionLogs: {
    getAll: (params: { page?: number; per_page?: number } = {}) => {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.per_page) queryParams.append('per_page', params.per_page.toString());
      const query = queryParams.toString();
      return request(
        `/api/permission-logs${query ? '?' + query : ''}`
      ) as Promise<{
        logs: PermissionLog[];
        pagination: { page: number; per_page: number; total: number; pages: number };
      }>;
    },
  },
  scoreAnalysis: {
    getExamAnalysis: (examId) =>
      request(`/api/score-analysis/exam/${examId}`) as Promise<ExamAnalysis>,
    getClassAnalysis: (className) =>
      request(
        `/api/score-analysis/class/${encodeURIComponent(className)}`
      ) as Promise<ClassAnalysis>,
    getStudentAnalysis: (student_id) =>
      request(`/api/score-analysis/student/${student_id}`) as Promise<StudentScoreAnalysis>,
  },
  scores: {
    getAll: (params: { exam_id?: string | number; class_name?: string } = {}) => {
      const queryParams = new URLSearchParams();
      if (params.exam_id) queryParams.append('exam_id', String(params.exam_id));
      if (params.class_name) queryParams.append('class_name', params.class_name);
      // 成绩录入回显需某次考试全量成绩，后端 GET /api/scores 已服务端分页（默认20条）；
      // 显式拉满 M9 上限（200），避免录入页回显被截断。
      queryParams.append('per_page', '200');
      const query = queryParams.toString();
      return request(`/api/scores${query ? '?' + query : ''}`) as Promise<unknown>;
    },
    create: (data) =>
      request('/api/scores', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<unknown>,
    update: (id, data) =>
      request(`/api/scores/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<unknown>,
    delete: (id) => request(`/api/scores/${id}`, { method: 'DELETE' }) as Promise<void>,
    // P0-3 修复：后端无 /api/scores/import；成绩导入实际在 /api/exam-import/execute（FormData: file+exam_id，返回 success_count/errors 与前端期望一致）
    importScores: (formData) =>
      request('/api/exam-import/execute', {
        method: 'POST',
        body: formData,
        // 注意：勿手动设 Content-Type——FormData 需浏览器自动附带 boundary，手动指定会丢 boundary 致 Flask 解析失败
      }) as Promise<unknown>,
    confirmAll: (examId) =>
      request(`/api/scores/confirm-all`, {
        method: 'POST',
        body: JSON.stringify({ exam_id: examId }),
      }) as Promise<void>,
    batchCreate: (data) =>
      request('/api/scores/batch', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<BatchScoreResult>,
  },
  reports: {
    exportClassSemester: (class_id: number, format: 'excel' | 'csv' = 'excel') => {
      const params = new URLSearchParams();
      params.append('class_id', class_id.toString());
      params.append('format', format);
      return fetch(`${API_BASE_URL}/api/reports/class-semester?${params.toString()}`, {
        credentials: 'include',
      })
        .then((res) => {
          if (!res.ok) throw new Error(`导出失败：HTTP ${res.status}`);
          return res.blob();
        })
        .then((blob) => {
          downloadBlob(blob, `班级学期报告_${class_id}.${format === 'csv' ? 'csv' : 'xlsx'}`);
        });
    },
  },
  remoteNotify: {
    preview: () =>
      request('/api/remote_notify/preview', {
        method: 'GET',
        skipCache: true,
      }) as Promise<RemoteNotifyPreview>,
    send: (data) =>
      request('/api/remote_notify/send', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<unknown>,
    broadcast: (data) =>
      request('/api/remote_notify/broadcast', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<unknown>,
    sendToDevice: (deviceId, data) =>
      request(`/api/remote_notify/send_to_device/${deviceId}`, {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<unknown>,
    test: (data) =>
      request('/api/remote_notify/test', {
        method: 'POST',
        body: JSON.stringify(data || {}),
      }) as Promise<{ code: number; data: unknown }>,
    scoreChange: (data) =>
      request('/api/remote_notify/score_change', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<unknown>,
  },
  notifyTemplates: {
    getAll: () => request('/api/notify_templates/', { method: 'GET' }) as Promise<NotifyTemplate[]>,
    getById: (id) =>
      request(`/api/notify_templates/${id}`, { method: 'GET' }) as Promise<NotifyTemplate>,
    create: (data) =>
      request('/api/notify_templates/', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<NotifyTemplate>,
    update: (id, data) =>
      request(`/api/notify_templates/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<NotifyTemplate>,
    delete: (id) =>
      request(`/api/notify_templates/${id}`, { method: 'DELETE' }) as Promise<{
        success: boolean;
        message: string;
      }>,
    use: (id, data) =>
      request(`/api/notify_templates/${id}/use`, {
        method: 'POST',
        body: JSON.stringify(data || {}),
      }) as Promise<{ success: boolean; message: string; template_id: number; topics: string[] }>,
    getCategories: () =>
      request('/api/notify_templates/categories', { method: 'GET' }) as Promise<string[]>,
  },
  scheduledNotify: {
    getAll: (params: { page?: number; per_page?: number } = {}) => {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.per_page) queryParams.append('per_page', params.per_page.toString());
      const query = queryParams.toString();
      return request(
        `/api/scheduled_notify${query ? '?' + query : ''}`
      ) as Promise<{
        items: ScheduledNotify[];
        total: number;
        page: number;
        per_page: number;
        pages: number;
      }>;
    },
    getById: (id) =>
      request(`/api/scheduled_notify/${id}`, { method: 'GET' }) as Promise<ScheduledNotify>,
    create: (data) =>
      request('/api/scheduled_notify/', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<{ success: boolean; message: string; id: number }>,
    update: (id, data) =>
      request(`/api/scheduled_notify/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<{ success: boolean; message: string }>,
    delete: (id) =>
      request(`/api/scheduled_notify/${id}`, { method: 'DELETE' }) as Promise<{
        success: boolean;
        message: string;
      }>,
    cancel: (id) =>
      request(`/api/scheduled_notify/${id}/cancel`, { method: 'POST' }) as Promise<{
        success: boolean;
        message: string;
      }>,
    trigger: (id, data) =>
      request(`/api/scheduled_notify/${id}/trigger`, {
        method: 'POST',
        body: JSON.stringify(data || {}),
      }) as Promise<{ success: boolean; message: string }>,
  },
  notifyHistory: {
    getAll: (params) => {
      const query = new URLSearchParams();
      if (params?.page) query.set('page', params.page.toString());
      if (params?.per_page) query.set('per_page', params.per_page.toString());
      if (params?.status) query.set('status', params.status);
      if (params?.days) query.set('days', params.days.toString());
      return request(`/api/notify_history/?${query.toString()}`, { method: 'GET' }) as Promise<{
        data: NotifyHistory[];
        total: number;
        page: number;
        per_page: number;
        pages: number;
      }>;
    },
    getById: (id) =>
      request(`/api/notify_history/${id}`, { method: 'GET' }) as Promise<NotifyHistory>,
    getStats: () =>
      request('/api/notify_history/stats', { method: 'GET' }) as Promise<{
        total_count: number;
        today_count: number;
        week_count: number;
        month_count: number;
        success_count: number;
        fail_count: number;
        success_rate: number;
      }>,
    clean: (days) => {
      const query = days ? `?days=${days}` : '';
      return request(`/api/notify_history/clean${query}`, { method: 'DELETE' }) as Promise<{
        success: boolean;
        message: string;
        deleted_count: number;
      }>;
    },
  },
  adminNotifications: {
    getAll: (params) => {
      const query = new URLSearchParams();
      if (params?.admin_id) query.set('admin_id', params.admin_id.toString());
      if (params?.page) query.set('page', params.page.toString());
      if (params?.per_page) query.set('per_page', params.per_page.toString());
      if (params?.is_read !== undefined) query.set('is_read', params.is_read);
      if (params?.type) query.set('type', params.type);
      if (params?.priority) query.set('priority', params.priority);
      return request(`/api/admin_notifications/?${query.toString()}`, {
        method: 'GET',
      }) as Promise<{
        notifications: AdminNotification[];
        total: number;
        page: number;
        per_page: number;
        pages: number;
      }>;
    },
    getRecent: (params) => {
      const query = new URLSearchParams();
      if (params?.admin_id) query.set('admin_id', params.admin_id.toString());
      if (params?.limit) query.set('limit', params.limit.toString());
      return request(`/api/admin_notifications/recent?${query.toString()}`, {
        method: 'GET',
      }) as Promise<AdminNotification[]>;
    },
    getCount: (admin_id) => {
      const query = admin_id ? `?admin_id=${admin_id}` : '';
      return request(`/api/admin_notifications/count${query}`, { method: 'GET' }) as Promise<{
        unread_count: number;
        total_count: number;
      }>;
    },
    markRead: (id) =>
      request(`/api/admin_notifications/${id}/read`, { method: 'POST' }) as Promise<{
        success: boolean;
        message: string;
      }>,
    markAllRead: (admin_id) => {
      const query = admin_id ? `?admin_id=${admin_id}` : '';
      return request(`/api/admin_notifications/read_all${query}`, { method: 'POST' }) as Promise<{
        success: boolean;
        message: string;
        count: number;
      }>;
    },
    create: (data) =>
      request('/api/admin_notifications/', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<{ success: boolean; message: string; notification: AdminNotification }>,
    delete: (id) =>
      request(`/api/admin_notifications/${id}`, { method: 'DELETE' }) as Promise<{
        success: boolean;
        message: string;
      }>,
  },
  wakeOnLan: {
    wake: (data: {
      mac_address: string;
      broadcast_ip?: string;
      port?: number;
      force_send?: boolean;
    }) =>
      request('/api/wol/wake', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<{ success: boolean; message: string; mac_address: string }>,
    wakeBatch: (data: {
      mac_addresses: string[];
      broadcast_ip?: string;
      port?: number;
      force_send?: boolean;
    }) =>
      request('/api/wol/wake/batch', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<{
        success: boolean;
        total: number;
        success_count: number;
        results: Record<string, { success: boolean; message: string }>;
      }>,
    validateMac: (mac: string) =>
      request(`/api/wol/validate?mac=${encodeURIComponent(mac)}`) as Promise<{
        mac_address: string;
        valid: boolean;
        normalized: string | null;
      }>,
    getDevices: () => request('/api/wol/devices') as Promise<WOLDevice[]>,
    addDevice: (data: {
      name: string;
      mac_address: string;
      broadcast_ip?: string;
      port?: number;
      description?: string;
    }) =>
      request('/api/wol/devices', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<WOLDevice>,
    updateDevice: (id: number, data: Partial<WOLDevice>) =>
      request(`/api/wol/devices/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<WOLDevice>,
    deleteDevice: (id: number) =>
      request(`/api/wol/devices/${id}`, { method: 'DELETE' }) as Promise<{
        success: boolean;
        message: string;
      }>,
  },
  devices: {
    getAll: (params: { page?: number; per_page?: number } = {}) => {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page.toString());
      // 设备管理页为轮询+客户端筛选模式，需全量设备；后端 GET /api/devices 分页默认20条，
      // 显式拉满 M9 上限（200）避免设备列表被截断。
      queryParams.append('per_page', params.per_page ? params.per_page.toString() : '200');
      const qs = queryParams.toString();
      return request(`/api/devices${qs ? '?' + qs : ''}`) as Promise<DevicePaginatedResponse>;
    },
    getById: (id) => request(`/api/devices/${id}`) as Promise<Device>,
    create: (data) =>
      request('/api/devices', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<Device>,
    update: (id, data) =>
      request(`/api/devices/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<Device>,
    delete: (id) => request(`/api/devices/${id}`, { method: 'DELETE' }) as Promise<void>,
    getAlerts: (resolved) => {
      const query = resolved ? `?resolved=${resolved}` : '';
      return request(`/api/devices/alerts${query}`) as Promise<{ alerts: Alert[] }>;
    },
    getHeartbeats: (deviceId) =>
      request(`/api/devices/${deviceId}/heartbeats`) as Promise<{ heartbeats: Heartbeat[] }>,
    bindClass: (deviceId, data) =>
      request(`/api/devices/${deviceId}/bind-class`, {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<void>,
    bindAdmin: (deviceId, data) =>
      request(`/api/devices/${deviceId}/bind-admin`, {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<void>,
    remoteControl: (deviceId, action) =>
      request(`/api/devices/${deviceId}/remote-control`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      }) as Promise<void>,
    otaUpgrade: (deviceId, data) =>
      request(`/api/devices/${deviceId}/ota-upgrade`, {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<void>,
    bulkOTAUpgrade: (data) =>
      request('/api/devices/bulk-ota-upgrade', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<void>,
    resolveAlert: (deviceId, alertId) =>
      request(`/api/devices/${deviceId}/alerts/${alertId}/resolve`, {
        method: 'POST',
      }) as Promise<void>,
    updateSettings: (deviceId, settings) =>
      request(`/api/devices/${deviceId}/settings`, {
        method: 'PUT',
        body: JSON.stringify(settings),
      }) as Promise<void>,
    getStats: () =>
      request('/api/devices/stats') as Promise<{
        total_devices: number;
        online_devices: number;
        offline_devices: number;
        error_devices?: number;
        today_heartbeats?: number;
        recent_activity?: unknown[];
      }>,
    getAdvancedStats: () =>
      request('/api/devices/advanced-stats') as Promise<{
        total_devices: number;
        online_devices: number;
        offline_devices: number;
        error_devices?: number;
        online_rate?: number;
        avg_signal_strength?: number;
        signal_distribution?: Record<string, number>;
        today_heartbeats?: number;
        unresolved_alerts?: number;
        critical_alerts?: number;
      }>,
    import: (formData: FormData) =>
      request('/api/devices/import', {
        method: 'POST',
        body: formData,
      }) as Promise<{
        success: boolean;
        total: number;
        success_count: number;
        failed_count: number;
        messages: Array<{ action: string; message: string }>;
      }>,
  },
  firmware: {
    getAll: async () => {
      const result = (await request('/api/firmware/versions')) as
        | { versions: Firmware[] }
        | Firmware[];
      return Array.isArray(result) ? result : result.versions || [];
    },
    getVersions: (params: { page?: number; per_page?: number } = {}) => {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.per_page) queryParams.append('per_page', params.per_page.toString());
      const query = queryParams.toString();
      return request(
        `/api/firmware/versions${query ? '?' + query : ''}`
      ) as Promise<{
        versions: Firmware[];
        total: number;
        page: number;
        per_page: number;
        pages: number;
      }>;
    },
    getUpgradeRecords: () =>
      request('/api/firmware/upgrade-records') as Promise<{ records: FirmwareRecord[] }>,
    upload: (data) =>
      request('/api/firmware/upload', {
        method: 'POST',
        body: data,
      }) as Promise<Firmware>,
    update: (id, data) =>
      request(`/api/firmware/versions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<Firmware>,
    updateVersion: (id: number, data: { is_active: boolean }) =>
      request(`/api/firmware/versions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<Firmware>,
    deleteVersion: (id: number) =>
      request(`/api/firmware/versions/${id}`, { method: 'DELETE' }) as Promise<void>,
    delete: (id) => request(`/api/firmware/versions/${id}`, { method: 'DELETE' }) as Promise<void>,
    download: (id) => `/api/firmware/download/${id}`,
    getOTAStatus: () => request('/api/firmware/ota-status') as Promise<OTAStatus>,
    otaUpgrade: (firmwareId, deviceIds) =>
      request(`/api/firmware/${firmwareId}/ota-upgrade`, {
        method: 'POST',
        body: JSON.stringify({ device_ids: deviceIds }),
      }) as Promise<void>,
  },
  exams: {
    getAll: (params: ScoreRecordParams & { skipCache?: boolean } = {}) => {
      const { skipCache, ...rest } = params;
      const queryParams = new URLSearchParams();
      // 考试为小表引用数据，后端 GET /api/exams 已服务端分页（默认20条）；
      // 前端全量拉取，避免考试下拉/列表被截断。
      if (rest.per_page === undefined) queryParams.append('per_page', '200');
      Object.entries(rest).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, String(value));
      });
      const qs = queryParams.toString();
      const url = qs ? `/api/exams?${qs}` : '/api/exams';
      return request(url, skipCache ? { skipCache: true } : undefined) as Promise<Exam[]>;
    },
    getById: (id) => request(`/api/exams/${id}`) as Promise<Exam>,
    create: (data) =>
      request('/api/exams', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<Exam>,
    update: (id, data) =>
      request(`/api/exams/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<Exam>,
    delete: (id) => request(`/api/exams/${id}`, { method: 'DELETE' }) as Promise<void>,
    import: (data: FormData, url?: string) =>
      request(url || '/api/exams/import', {
        method: 'POST',
        body: data,
      }) as Promise<{
        success: boolean;
        total: number;
        success_count: number;
        failed_count: number;
        messages: Array<{ action: string; message: string }>;
      }>,
    // P3-2: 删除 uploadScores（后端无 /api/exams/{id}/scores 路由，且零调用；成绩导入走 importScores → /api/exam-import/execute）
    publish: (id) =>
      request(`/api/exams/${id}/publish`, {
        method: 'POST',
      }) as Promise<Exam>,
    close: (id) =>
      request(`/api/exams/${id}/close`, {
        method: 'POST',
      }) as Promise<Exam>,
  },
  subjects: {
    getAll: async (params: { include_inactive?: boolean; skipCache?: boolean } = {}) => {
      const queryParams = new URLSearchParams();
      if (params.include_inactive) queryParams.append('include_inactive', 'true');
      // 科目为引用型小表，后端 GET /api/subjects 已服务端分页（默认20条）；
      // 前端全量拉取，避免下拉框/列表页被截断。
      queryParams.append('per_page', '200');
      const query = queryParams.toString();
      const result = await request(`/api/subjects${query ? '?' + query : ''}`, {
        skipCache: params.skipCache,
      });
      return Array.isArray(result) ? result : [];
    },
    create: (data) =>
      request('/api/subjects', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<Subject>,
    update: (id, data) =>
      request(`/api/subjects/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<Subject>,
    delete: (id) => request(`/api/subjects/${id}`, { method: 'DELETE' }) as Promise<void>,
    toggle: (id) => request(`/api/subjects/${id}/toggle`) as Promise<Subject>,
    getClasses: (id) =>
      request(`/api/subjects/${id}/classes`) as Promise<{ classes: SubjectClassLink[] }>,
    assignClass: (id, data) =>
      request(`/api/subjects/${id}/classes`, {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<SubjectClassLink>,
    updateClassTeacher: (subjectId, class_id, data) =>
      request(`/api/subjects/${subjectId}/classes/${class_id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<SubjectClassLink>,
    removeClass: (subjectId, class_id) =>
      request(`/api/subjects/${subjectId}/classes/${class_id}`, {
        method: 'DELETE',
      }) as Promise<void>,
    import: (data: FormData, customUrl?: string) =>
      request(customUrl || '/api/subjects/import', {
        method: 'POST',
        body: data,
      }) as Promise<{
        success: boolean;
        total: number;
        success_count: number;
        failed_count: number;
        messages: Array<{ name: string; action: string; message: string }>;
      }>,
    updateOrder: (data: Array<{ id: number; order: number }>) =>
      request('/api/subjects/order', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<void>,
  },
  approvals: {
    getAll: (params = {}) => {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, String(value));
      });
      return request(`/api/approvals?${queryParams.toString()}`) as Promise<{
        approvals: Approval[];
        pagination: { page: number; per_page: number; total: number; pages: number };
      }>;
    },
    getById: (id) => request(`/api/approvals/${id}`) as Promise<Approval>,
    create: (data) =>
      request('/api/approvals', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<Approval>,
    approve: (id, data) =>
      request(`/api/approvals/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<Approval>,
    reject: (id, data) =>
      request(`/api/approvals/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<Approval>,
    batchApprove: (ids, comment) =>
      request('/api/approvals/batch-approve', {
        method: 'POST',
        body: JSON.stringify({ ids, ...(comment ? { comment } : {}) }),
      }) as Promise<BatchApprovalResult>,
    batchReject: (ids, comment) =>
      request('/api/approvals/batch-reject', {
        method: 'POST',
        body: JSON.stringify({ ids, ...(comment ? { comment } : {}) }),
      }) as Promise<BatchApprovalResult>,
    delete: (id) => request(`/api/approvals/${id}`, { method: 'DELETE' }) as Promise<void>,
  },
  deviceGroup: {
    getAll: (params?: { is_active?: boolean }) => {
      const queryParams = new URLSearchParams();
      if (params?.is_active !== undefined)
        queryParams.append('is_active', String(params.is_active));
      const query = queryParams.toString();
      return request(`/api/device-group/${query ? '?' + query : ''}`) as Promise<DeviceGroup[]>;
    },
    getById: (id: number) => request(`/api/device-group/${id}`) as Promise<DeviceGroupDetail>,
    create: (data: Partial<DeviceGroup>) =>
      request('/api/device-group/', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<DeviceGroup>,
    update: (id: number, data: Partial<DeviceGroup>) =>
      request(`/api/device-group/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<DeviceGroup>,
    delete: (id: number) =>
      request(`/api/device-group/${id}`, { method: 'DELETE' }) as Promise<void>,
    getDevices: (groupId: number) =>
      request(`/api/device-group/${groupId}/devices`) as Promise<DeviceInGroup[]>,
    addDevices: (groupId: number, deviceIds: string[]) =>
      request(`/api/device-group/${groupId}/devices`, {
        method: 'POST',
        body: JSON.stringify({ device_ids: deviceIds }),
      }) as Promise<{ added_count: number; skipped: { device_id: string; reason: string }[] }>,
    removeDevices: (groupId: number, deviceIds: string[]) =>
      request(`/api/device-group/${groupId}/devices`, {
        method: 'DELETE',
        body: JSON.stringify({ device_ids: deviceIds }),
      }) as Promise<{ removed_count: number }>,
    // P3-2: 删除 getUngroupedDevices（后端无此路由且零调用）；修正 getByDevice 路径为后端真实 /device/<id>/groups
    getByDevice: (deviceId: string) =>
      request(`/api/device-group/device/${deviceId}/groups`) as Promise<DeviceGroup[]>,
    getStats: async () => {
      const raw = (await request('/api/device-group/stats')) as unknown;
      // 后端实际返回 {total_groups, active_groups, total_mappings, groups: [...]}
      // 前端需要扁平 DeviceGroupStats[] 列表。兼容裸数组、裸对象两种 shape。
      const list: RawJson[] = Array.isArray(raw)
        ? (raw as RawJson[])
        : raw && Array.isArray((raw as RawJson).groups)
        ? ((raw as RawJson).groups as RawJson[])
        : [];
      return list.map((g) => {
        const id =
          typeof g?.id === 'number' ? g.id : typeof g?.group_id === 'number' ? g.group_id : 0;
        return {
          group_id: id,
          group_name: g?.name ?? g?.group_name ?? '未命名',
          location: g?.location ?? g?.description ?? '',
          total_devices:
            typeof g?.total_devices === 'number'
              ? g.total_devices
              : typeof g?.actual_device_count === 'number'
              ? g.actual_device_count
              : 0,
          online_devices: typeof g?.online_devices === 'number' ? g.online_devices : 0,
          offline_devices: typeof g?.offline_devices === 'number' ? g.offline_devices : 0,
        } as DeviceGroupStats;
      });
    },
  },
  courseSchedules: {
    getAll: async (
      params: {
        class_info_id?: number;
        day_of_week?: number;
        period_number?: number;
        is_active?: boolean;
        teacher_name?: string;
        classroom?: string;
        skipCache?: boolean;
      } = {}
    ) => {
      const queryParams = new URLSearchParams();
      if (params.class_info_id)
        queryParams.append('class_info_id', params.class_info_id.toString());
      if (params.day_of_week !== undefined)
        queryParams.append('day_of_week', params.day_of_week.toString());
      if (params.period_number !== undefined)
        queryParams.append('period_number', params.period_number.toString());
      if (params.is_active !== undefined) queryParams.append('is_active', String(params.is_active));
      if (params.teacher_name) queryParams.append('teacher_name', params.teacher_name);
      if (params.classroom) queryParams.append('classroom', params.classroom);
      // 课表为小表引用数据，后端 GET /api/course-schedules 已服务端分页（默认20条）；
      // 前端全量拉取，避免按班级渲染的课表被截断。
      queryParams.append('per_page', '200');
      const query = queryParams.toString();
      const result = (await request(`/api/course-schedules${query ? '?' + query : ''}`, {
        skipCache: params.skipCache,
      })) as { schedules: CourseSchedule[] };
      return result.schedules || [];
    },
    getById: (id) => request(`/api/course-schedules/${id}`) as Promise<CourseSchedule>,
    create: (data) =>
      request('/api/course-schedules', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<CourseSchedule>,
    update: async (id, data) => {
      const result = (await request(`/api/course-schedules/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })) as { success: boolean; message: string };
      if (!result.success) throw new Error(result.message);
      return (await request(`/api/course-schedules/${id}`)) as CourseSchedule;
    },
    delete: (id) => request(`/api/course-schedules/${id}`, { method: 'DELETE' }) as Promise<void>,
    checkConflict: async (params: {
      class_info_id?: number;
      teacher_name?: string;
      classroom?: string;
      day_of_week?: number;
      period_number?: number;
      exclude_id?: number;
    }) => {
      const queryParams = new URLSearchParams();
      if (params.class_info_id)
        queryParams.append('class_info_id', params.class_info_id.toString());
      if (params.teacher_name) queryParams.append('teacher_name', params.teacher_name);
      if (params.classroom) queryParams.append('classroom', params.classroom);
      if (params.day_of_week !== undefined)
        queryParams.append('day_of_week', params.day_of_week.toString());
      if (params.period_number !== undefined)
        queryParams.append('period_number', params.period_number.toString());
      if (params.exclude_id) queryParams.append('exclude_id', params.exclude_id.toString());
      const query = queryParams.toString();
      return request(`/api/course-schedules/check-conflict${query ? '?' + query : ''}`) as Promise<{
        has_conflict: boolean;
        conflicts: Array<{
          type: string;
          message: string;
          schedule_id?: number;
          conflicting_class_name?: string;
          conflicting_subject_name?: string;
          conflicting_teacher_name?: string;
          conflicting_classroom?: string;
        }>;
      }>;
    },
    export: (classInfoId?: number, format?: 'json' | 'excel') => {
      const queryParams = new URLSearchParams();
      if (classInfoId) queryParams.append('class_info_id', classInfoId.toString());
      if (format) queryParams.append('format', format);
      const query = queryParams.toString();
      const url = `/api/course-schedules/export${query ? '?' + query : ''}`;
      // 走 fetch blob + 下载（cookie 鉴权、可校验结果），替代 window.open
      return fetch(`${API_BASE_URL}${url}`, {
        credentials: 'include',
      })
        .then((res) => {
          if (!res.ok) throw new Error(`导出失败：HTTP ${res.status}`);
          return res.blob();
        })
        .then((blob) => {
          downloadBlob(blob, `课程表_${classInfoId || '全部'}.${format === 'json' ? 'json' : 'xlsx'}`);
        });
    },
    import: (data: FormData, customUrl?: string) =>
      request(customUrl || '/api/course-schedules/import', {
        method: 'POST',
        body: data,
      }) as Promise<{
        success: boolean;
        total: number;
        success_count: number;
        failed_count: number;
        messages: Array<{
          class_name: string;
          subject_name: string;
          action: string;
          message: string;
        }>;
      }>,
    // 实时状态必须反映"改课表立即生效"，因此强制 skipCache
    getNow: (classInfoId?: number, deviceId?: string) => {
      const qs = new URLSearchParams();
      if (classInfoId) qs.append('class_info_id', String(classInfoId));
      else if (deviceId) qs.append('device_id', deviceId);
      const query = qs.toString();
      return request(`/api/course-schedules/now${query ? `?${query}` : ''}`, {
        skipCache: true,
      }) as Promise<ClassNowStatus>;
    },
  },
  importConfig: {
    list: (params?: { module_name?: string; is_active?: boolean }) => {
      const queryParams = new URLSearchParams();
      if (params?.module_name) queryParams.append('module_name', params.module_name);
      if (params?.is_active !== undefined)
        queryParams.append('is_active', params.is_active.toString());
      const query = queryParams.toString();
      return request(`/api/import/configs${query ? '?' + query : ''}`) as Promise<ImportConfig[]>;
    },
    get: (id: number) => request(`/api/import/configs/${id}`) as Promise<ImportConfig>,
    create: (data: ImportConfigInput) =>
      request('/api/import/configs', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<ImportConfig>,
    update: (id: number, data: ImportConfigInput) =>
      request(`/api/import/configs/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<ImportConfig>,
    delete: (id: number) =>
      request(`/api/import/configs/${id}`, {
        method: 'DELETE',
      }) as Promise<unknown>,
    // P1-2 修复：后端路径为 /configs/set-default/<id>（原 ${id}/set-default 顺序反 → 404）
    setDefault: (id: number) =>
      request(`/api/import/configs/set-default/${id}`, {
        method: 'POST',
      }) as Promise<unknown>,
    downloadTemplate: (templateType: string) =>
      `${API_BASE_URL}/api/import/template/${templateType}`,
  },
  nlp: {
    parse: (text) =>
      request('/api/nlp/parse', {
        method: 'POST',
        body: JSON.stringify({ text }),
      }) as Promise<NLPParsedResult>,
    execute: (data) =>
      request('/api/nlp/execute', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<unknown>,
    batchParse: (texts) =>
      request('/api/nlp/batch-parse', {
        method: 'POST',
        body: JSON.stringify({ texts }),
      }) as Promise<unknown>,
    getRules: (params = {}) => {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.per_page) queryParams.append('per_page', params.per_page.toString());
      if (params.keyword) queryParams.append('keyword', params.keyword);
      if (params.score_type) queryParams.append('score_type', params.score_type);
      if (params.sort_by) queryParams.append('sort_by', params.sort_by);
      if (params.sort_order) queryParams.append('sort_order', params.sort_order);
      const query = queryParams.toString();
      return request(`/api/nlp/rules${query ? '?' + query : ''}`) as Promise<
        BackendPaginatedResult<NLPScoringRule>
      >;
    },
    createRule: (data) =>
      request('/api/nlp/rules', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<NLPScoringRule>,
    updateRule: (id, data) =>
      request(`/api/nlp/rules/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<NLPScoringRule>,
    deleteRule: (id) =>
      request(`/api/nlp/rules/${id}`, {
        method: 'DELETE',
      }) as Promise<unknown>,
    suggestRules: (keyword) =>
      request(`/api/nlp/rules/suggest?keyword=${encodeURIComponent(keyword)}`) as Promise<
        NLPScoringRule[]>,
    getRuleStatistics: () =>
      request('/api/nlp/rules/statistics') as Promise<NLPStatistics>,
    getRuleUsage: (ruleId) =>
      request(`/api/nlp/rules/${ruleId}/usage`) as Promise<unknown>,
    batchImportRules: (rules) =>
      request('/api/nlp/rules/batch-import', {
        method: 'POST',
        body: JSON.stringify({ rules }),
      }) as Promise<
        {
          success: boolean;
          imported_count: number;
          skipped_count: number;
          message: string;
        }>,
    trainModel: async (data) => {
      // #912 实机修复：单算法训练 + 调参/交叉验证同样分钟级，30s fetch 必超时。
      // 后端已异步化（POST 返回 task_id），此处提交后轮询 /model/train/status。
      const started = (await request('/api/nlp/model/train', {
        method: 'POST',
        body: JSON.stringify(data),
      })) as { task_id?: string; status: string };
      if (started.status === 'already_running') {
        throw new Error('已有训练任务正在进行中，请稍后再试');
      }
      if (!started.task_id) return started as unknown as NLPMLTrainingResult;
      const taskId = started.task_id;
      // 全量训练（train_all）在万级样本 + 深度学习算法下可能超过 10 分钟，
      // 上限放宽到 30 分钟；即便超时，后台线程仍在继续训练，结果会落入训练历史。
      const deadline = Date.now() + 30 * 60 * 1000;
      for (;;) {
        const st = (await request(
          `/api/nlp/model/train/status?task_id=${encodeURIComponent(taskId)}`,
        )) as {
          status: 'running' | 'done' | 'error';
          result?: NLPMLTrainingResult | null;
          error?: string | null;
        };
        if (st.status === 'done' && st.result) return st.result;
        if (st.status === 'error') throw new Error(st.error || '模型训练失败');
        if (Date.now() > deadline) {
          throw new Error('训练仍在后台进行（已超过 30 分钟），可稍后到「训练历史」查看结果');
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    },
    trainAllModels: async (data) => {
      // #912 实机修复：train-all 为分钟级同步训练，30s fetch 必超时。
      // 后端已改异步（POST 返回 task_id），此处提交后轮询状态端点直至 done/error。
      const started = (await request('/api/nlp/model/train-all', {
        method: 'POST',
        body: JSON.stringify(data),
      })) as { task_id?: string; status: string };
      if (started.status === 'already_running') {
        throw new Error('已有训练任务正在进行中，请稍后再试');
      }
      // 兼容旧同步语义：若后端直接返回训练结果（无 task_id），原样返回
      if (!started.task_id) return started as unknown as NLPMLTrainAllResult;
      const taskId = started.task_id;
      const deadline = Date.now() + 30 * 60 * 1000; // 全量训练可能超 10 分钟，放宽到 30 分钟
      for (;;) {
        const st = (await request(
          `/api/nlp/model/train-all/status?task_id=${encodeURIComponent(taskId)}`,
        )) as {
          status: 'running' | 'done' | 'error';
          result?: NLPMLTrainAllResult | null;
          error?: string | null;
        };
        if (st.status === 'done' && st.result) return st.result;
        if (st.status === 'error') throw new Error(st.error || '模型训练失败');
        if (Date.now() > deadline) {
          throw new Error('训练仍在后台进行（已超过 30 分钟），可稍后到「训练历史」查看结果');
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    },
    getAlgorithms: () =>
      request('/api/nlp/model/algorithms') as Promise<NLPAlgorithm[]>,
    evaluateAllModels: () =>
      request('/api/nlp/model/evaluate-all') as Promise<
        NLPMLEvaluationAllResult>,
    predictRule: (data) =>
      request('/api/nlp/model/predict', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<NLPPredictResult>,
    getTrainingHistory: (params = {}) => {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.per_page) queryParams.append('per_page', params.per_page.toString());
      const query = queryParams.toString();
      return request(`/api/nlp/model/training-history${query ? '?' + query : ''}`) as Promise<
        BackendPaginatedResult<NLPTrainingRecord>
      >;
    },
    evaluateModel: () =>
      request('/api/nlp/model/evaluate') as Promise<NLPEvaluationResult>,
    // 算法分析相关
    getAnalysisComprehensive: () =>
      request('/api/nlp/analysis/comprehensive') as Promise<unknown>,
    getAnalysisIntent: () =>
      request('/api/nlp/analysis/intent') as Promise<{ code: number; data: unknown }>,
    getAnalysisPerformance: () =>
      request('/api/nlp/analysis/performance') as Promise<{ code: number; data: unknown }>,
    getAnalysisSuggestions: () =>
      request('/api/nlp/analysis/suggestions') as Promise<{ code: number; data: unknown }>,
    resetAnalysis: () =>
      request('/api/nlp/analysis/reset', { method: 'POST' }) as Promise<{ code: number; data: unknown }>,
    benchmarkIntentClassifier: (params) =>
      request('/api/nlp/benchmark/intent-classifier', {
        method: 'POST',
        body: JSON.stringify(params || {}),
      }) as Promise<unknown>,
    getOptimizationConfig: () =>
      request('/api/nlp/optimization/config') as Promise<{ code: number; data: unknown }>,
    setOptimizationConfig: (data) =>
      request('/api/nlp/optimization/config', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<unknown>,
    autoTuneOptimization: (data) =>
      request('/api/nlp/optimization/auto-tune', {
        method: 'POST',
        body: JSON.stringify(data || {}),
      }) as Promise<unknown>,
    // 自学习反馈相关
    sentiment: (text) =>
      request('/api/nlp/sentiment', {
        method: 'POST',
        body: JSON.stringify({ text }),
      }) as Promise<unknown>,
    recordFeedback: (data) =>
      request('/api/nlp/feedback/record', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<{ message: string; corrections_saved?: number }>,
    getCorrections: (params = {}) => {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.per_page) queryParams.append('per_page', params.per_page.toString());
      if (params.status) queryParams.append('status', params.status);
      const query = queryParams.toString();
      return request(`/api/nlp/corrections${query ? '?' + query : ''}`) as Promise<
        BackendPaginatedResult<NLPCorrection>
      >;
    },
    updateCorrection: (id, data) =>
      request(`/api/nlp/corrections/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<unknown>,
    deleteCorrection: (id) =>
      request(`/api/nlp/corrections/${id}`, {
        method: 'DELETE',
      }) as Promise<unknown>,
  },
  seating: {
    getAll: (class_id?: number) => {
      const params = new URLSearchParams();
      if (class_id) params.append('class_id', String(class_id));
      return request(`/api/seating/charts?${params.toString()}`) as Promise<SeatingChart[]>;
    },
    getById: (id) => request(`/api/seating/charts/${id}`) as Promise<SeatingChart>,
    create: (data) =>
      request('/api/seating/charts', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<SeatingChart>,
    update: (id, data) =>
      request(`/api/seating/charts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<SeatingChart>,
    delete: (id) => request(`/api/seating/charts/${id}`, { method: 'DELETE' }) as Promise<void>,
    autoArrange: (chartId, strategy, class_id) =>
      request(`/api/seating/charts/${chartId}/auto-arrange`, {
        method: 'POST',
        body: JSON.stringify({ strategy, class_id: class_id }),
      }) as Promise<SeatingChart>,
    updateSeat: (chartId, row, col, student_id) =>
      request(`/api/seating/charts/${chartId}/seats`, {
        method: 'PUT',
        body: JSON.stringify({ row, col, student_id: student_id }),
      }) as Promise<void>,
  },
  duty: {
    getAll: (class_id?: number) => {
      const params = new URLSearchParams();
      if (class_id) params.append('class_id', String(class_id));
      return request(`/api/duty/groups?${params.toString()}`) as Promise<DutyGroup[]>;
    },
    createGroup: (data) =>
      request('/api/duty/groups', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<DutyGroup>,
    deleteGroup: (id) => request(`/api/duty/groups/${id}`, { method: 'DELETE' }) as Promise<void>,
    // S3: 拉取值日任务（支持按组过滤），DutyRoster 首屏数据源
    getAssignments: (group_id?: number) => {
      const params = new URLSearchParams();
      if (group_id) params.append('group_id', String(group_id));
      return request(`/api/duty/assignments?${params.toString()}`) as Promise<DutyAssignment[]>;
    },
    assignDuty: (data) =>
      request('/api/duty/assignments', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<DutyAssignment>,
    markComplete: (assignmentId) =>
      request(`/api/duty/assignments/${assignmentId}/complete`, {
        method: 'POST',
      }) as Promise<void>,
    // P1 修复：值日轮转（后端 /api/duty/rotate 已存在，此前页面未接线）
    rotate: (class_id, period = 'weekly') =>
      request('/api/duty/rotate', {
        method: 'POST',
        body: JSON.stringify({ class_id: class_id, period }),
      }) as Promise<{ rotated_count: number }>,
  },
  committee: {
    getAll: (class_id?: number) => {
      const params = new URLSearchParams();
      if (class_id) params.append('class_id', String(class_id));
      return request(`/api/committee/members?${params.toString()}`) as Promise<ClassCommittee[]>;
    },
    // P1 修复：班委任期（后端 /api/committee/terms 已存在，此前页面未接线）
    getTerms: (class_id?: number) => {
      const params = new URLSearchParams();
      if (class_id) params.append('class_id', String(class_id));
      return request(`/api/committee/terms?${params.toString()}`) as Promise<CommitteeTerm[]>;
    },
    createTerm: (data) =>
      request('/api/committee/terms', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<CommitteeTerm>,
    create: (data) =>
      request('/api/committee/members', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<ClassCommittee>,
    update: (id, data) =>
      request(`/api/committee/members/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<ClassCommittee>,
    delete: (id) => request(`/api/committee/members/${id}`, { method: 'DELETE' }) as Promise<void>,
  },
  parent: {
    getAll: (student_id?: number, class_id?: number) => {
      const params = new URLSearchParams();
      if (student_id) params.append('student_id', String(student_id));
      if (class_id) params.append('class_id', String(class_id));
      return request(`/api/parent/contacts?${params.toString()}`) as Promise<ParentContact[]>;
    },
    create: (data) =>
      request('/api/parent/contacts', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<ParentContact>,
    update: (id, data) =>
      request(`/api/parent/contacts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<ParentContact>,
    delete: (id) => request(`/api/parent/contacts/${id}`, { method: 'DELETE' }) as Promise<void>,
    getContactLogs: (parentId) =>
      request(`/api/parent/logs?parent_id=${parentId}`) as Promise<ContactLog[]>,
    addContactLog: (parentId, data) =>
      request('/api/parent/logs', {
        method: 'POST',
        body: JSON.stringify({ parent_id: parentId, ...data }),
      }) as Promise<ContactLog>,
    resolveLog: (logId) =>
      request(`/api/parent/logs/${logId}/resolve`, {
        method: 'POST',
      }) as Promise<void>,
  },
  homework: {
    getAll: (class_id?: number, subjectId?: number) => {
      const params = new URLSearchParams();
      if (class_id) params.append('class_id', String(class_id));
      if (subjectId) params.append('subject_id', String(subjectId));
      return request(`/api/homework/assignments?${params.toString()}`) as Promise<
        HomeworkAssignment[]
      >;
    },
    getById: (id) => request(`/api/homework/assignments/${id}`) as Promise<HomeworkAssignment>,
    create: (data) =>
      request('/api/homework/assignments', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<HomeworkAssignment>,
    update: (id, data) =>
      request(`/api/homework/assignments/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<HomeworkAssignment>,
    delete: (id) =>
      request(`/api/homework/assignments/${id}`, { method: 'DELETE' }) as Promise<void>,
    markSubmitted: (assignmentId, student_id) =>
      request(`/api/homework/assignments/${assignmentId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ student_id: student_id }),
      }) as Promise<void>,
    markChecked: (assignmentId, student_id, notes) =>
      request(`/api/homework/assignments/${assignmentId}/check`, {
        method: 'POST',
        body: JSON.stringify({ student_id: student_id, notes: notes || '' }),
      }) as Promise<void>,
  },
  attendance: {
    getAll: (class_id?, student_id?, date?) => {
      const params = new URLSearchParams();
      if (class_id) params.append('class_id', String(class_id));
      if (student_id) params.append('student_id', String(student_id));
      if (date) params.append('date', date);
      return request(`/api/attendance/records?${params.toString()}`) as Promise<Attendance[]>;
    },
    record: (data) =>
      request('/api/attendance/records', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<Attendance>,
    batchRecord: (records) =>
      request('/api/attendance/batch', {
        method: 'POST',
        body: JSON.stringify({ records }),
      }) as Promise<{ count: number }>,
    getStats: (class_id, startDate?, endDate?) => {
      const params = new URLSearchParams();
      params.append('class_id', String(class_id));
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      return request(`/api/attendance/stats?${params.toString()}`) as Promise<AttendanceStats>;
    },
    getLeaves: (student_id?, status?) => {
      const params = new URLSearchParams();
      if (student_id) params.append('student_id', String(student_id));
      if (status) params.append('status', status);
      return request(`/api/attendance/leaves?${params.toString()}`) as Promise<LeaveApplication[]>;
    },
    applyLeave: (data) =>
      request('/api/attendance/leaves', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<LeaveApplication>,
    approveLeave: (leaveId, approve = true) =>
      request(`/api/attendance/leaves/${leaveId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ approve }),
      }) as Promise<void>,
  },
  studyGroup: {
    getAll: (class_id?) => {
      const params = new URLSearchParams();
      if (class_id) params.append('class_id', String(class_id));
      return request(`/api/study-group/groups?${params.toString()}`) as Promise<StudyGroup[]>;
    },
    getById: (id) => request(`/api/study-group/groups/${id}`) as Promise<StudyGroup>,
    create: (data) =>
      request('/api/study-group/groups', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<StudyGroup>,
    update: (id, data) =>
      request(`/api/study-group/groups/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<StudyGroup>,
    delete: (id) => request(`/api/study-group/groups/${id}`, { method: 'DELETE' }) as Promise<void>,
    addMember: (groupId, student_id) =>
      request(`/api/study-group/groups/${groupId}/members`, {
        method: 'POST',
        body: JSON.stringify({ student_id: student_id }),
      }) as Promise<void>,
    removeMember: (groupId, student_id) =>
      request(`/api/study-group/groups/${groupId}/members`, {
        method: 'DELETE',
        body: JSON.stringify({ student_id: student_id }),
      }) as Promise<void>,
    addScore: (groupId, scoreChange, reason?) =>
      request(`/api/study-group/groups/${groupId}/score`, {
        method: 'POST',
        body: JSON.stringify({ score_change: scoreChange, reason: reason || '' }),
      }) as Promise<void>,
  },
  mentalHealth: {
    getRecords: (student_id?, class_id?) => {
      const params = new URLSearchParams();
      if (student_id) params.append('student_id', String(student_id));
      if (class_id) params.append('class_id', String(class_id));
      return request(`/api/mental-health/records?${params.toString()}`) as Promise<
        MentalHealthRecord[]
      >;
    },
    createRecord: (data) =>
      request('/api/mental-health/records', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<MentalHealthRecord>,
    getAlerts: (student_id?, isResolved?, class_id?) => {
      const params = new URLSearchParams();
      if (student_id) params.append('student_id', String(student_id));
      if (isResolved !== undefined) params.append('is_resolved', String(isResolved));
      if (class_id) params.append('class_id', String(class_id));
      return request(`/api/mental-health/alerts?${params.toString()}`) as Promise<
        MentalHealthAlert[]
      >;
    },
    resolveAlert: (alertId) =>
      request(`/api/mental-health/alerts/${alertId}/resolve`, {
        method: 'POST',
      }) as Promise<void>,
  },
  teacherComment: {
    getAll: (class_id?, student_id?, term?) => {
      const params = new URLSearchParams();
      if (class_id) params.append('class_id', String(class_id));
      if (student_id) params.append('student_id', String(student_id));
      if (term) params.append('term', term);
      return request(`/api/teacher-comments?${params.toString()}`) as Promise<TeacherComment[]>;
    },
    create: (data) =>
      request('/api/teacher-comments', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<TeacherComment>,
    update: (id, data) =>
      request(`/api/teacher-comments/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<TeacherComment>,
    delete: (id) =>
      request(`/api/teacher-comments/${id}`, { method: 'DELETE' }) as Promise<void>,
  },
  activity: {
    getAll: (class_id?, isPublished?) => {
      const params = new URLSearchParams();
      if (class_id) params.append('class_id', String(class_id));
      if (isPublished !== undefined) params.append('is_published', String(isPublished));
      return request(`/api/activity?${params.toString()}`) as Promise<Activity[]>;
    },
    getById: (id) => request(`/api/activity/${id}`) as Promise<Activity>,
    create: (data) =>
      request('/api/activity', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<Activity>,
    update: (id, data) =>
      request(`/api/activity/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<Activity>,
    delete: (id) => request(`/api/activity/${id}`, { method: 'DELETE' }) as Promise<void>,
    registerStudent: (activityId, student_id) =>
      request(`/api/activity/${activityId}/register`, {
        method: 'POST',
        body: JSON.stringify({ student_id: student_id }),
      }) as Promise<void>,
    cancelRegistration: (activityId, student_id) =>
      request(`/api/activity/${activityId}/register`, {
        method: 'DELETE',
        body: JSON.stringify({ student_id: student_id }),
      }) as Promise<void>,
  },
  culture: {
    getAll: (class_id?, category?) => {
      const params = new URLSearchParams();
      if (class_id) params.append('class_id', String(class_id));
      if (category) params.append('category', category);
      return request(`/api/culture/records?${params.toString()}`) as Promise<CultureRecord[]>;
    },
    create: (data) =>
      request('/api/culture/records', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<CultureRecord>,
    update: (id, data) =>
      request(`/api/culture/records/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<CultureRecord>,
    delete: (id) => request(`/api/culture/records/${id}`, { method: 'DELETE' }) as Promise<void>,
  },
  studyGuide: {
    getGuides: (class_id?, guideType?) => {
      const params = new URLSearchParams();
      if (class_id) params.append('class_id', String(class_id));
      if (guideType) params.append('guide_type', guideType);
      return request(`/api/study-guide/guides?${params.toString()}`) as Promise<StudyGuide[]>;
    },
    createGuide: (data) =>
      request('/api/study-guide/guides', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<StudyGuide>,
    updateGuide: (id, data) =>
      request(`/api/study-guide/guides/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<StudyGuide>,
    deleteGuide: (id) =>
      request(`/api/study-guide/guides/${id}`, { method: 'DELETE' }) as Promise<void>,
    getPlans: (student_id?) => {
      const params = new URLSearchParams();
      if (student_id) params.append('student_id', String(student_id));
      return request(`/api/study-guide/plans?${params.toString()}`) as Promise<ImprovementPlan[]>;
    },
    createPlan: (data) =>
      request('/api/study-guide/plans', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<ImprovementPlan>,
    updatePlan: (id, data) =>
      request(`/api/study-guide/plans/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<ImprovementPlan>,
    deletePlan: (id) =>
      request(`/api/study-guide/plans/${id}`, { method: 'DELETE' }) as Promise<void>,
    updatePlanProgress: (planId, progress) =>
      request(`/api/study-guide/plans/${planId}/progress`, {
        method: 'PUT',
        body: JSON.stringify({ progress }),
      }) as Promise<void>,
  },
  student: {
    login: (data: { card_id: string; name: string }) =>
      request('/api/student/login', {
        method: 'POST',
        body: JSON.stringify(data),
        skipAuth: true,
      }) as Promise<{ access_token: string; expires_in: number; student: StudentInfo }>,
    getMe: () => request('/api/student/me') as Promise<StudentInfo>,
    getScore: () =>
      request('/api/student/score') as Promise<{
        current_score: number;
        name: string;
        card_id: string;
      }>,
    getRecords: (params: { page?: number; per_page?: number } = {}) => {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.per_page) queryParams.append('per_page', params.per_page.toString());
      const query = queryParams.toString();
      return request(`/api/student/records${query ? '?' + query : ''}`) as Promise<{
        data: ScoreRecordItem[];
        pagination: { page: number; per_page: number; total: number; pages: number };
      }>;
    },
    getNotifications: (params: { page?: number; per_page?: number } = {}) => {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.per_page) queryParams.append('per_page', params.per_page.toString());
      const query = queryParams.toString();
      return request(`/api/student/notifications${query ? '?' + query : ''}`) as Promise<{
        data: NotificationItem[];
        pagination: { page: number; per_page: number; total: number; pages: number };
      }>;
    },
    getLeaves: () => request('/api/student/leaves') as Promise<LeaveItem[]>,
    applyLeave: (data: {
      leave_type?: string;
      start_date: string;
      end_date: string;
      reason?: string;
    }) =>
      request('/api/student/leaves', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<LeaveItem>,
    requestPhoneboxUnlock: () =>
      request('/api/student/phonebox/unlock', { method: 'POST' }) as Promise<PhoneboxUnlockResult>,
    getMyRank: () => request('/api/student/rank') as Promise<MyRankResult>,
    getInsights: (days = 30, weeks = 8) => {
      const queryParams = new URLSearchParams();
      queryParams.append('days', String(days));
      queryParams.append('weeks', String(weeks));
      return request(`/api/student/insights?${queryParams.toString()}`) as Promise<StudentInsight>;
    },
  },
  rank: {
    getStudentRanking: (
      params: { class_name?: string; sort_by?: string; order?: string; limit?: number } = {}
    ) => {
      const queryParams = new URLSearchParams();
      if (params.class_name) queryParams.append('class_name', params.class_name);
      if (params.sort_by) queryParams.append('sort_by', params.sort_by);
      if (params.order) queryParams.append('order', params.order);
      if (params.limit) queryParams.append('limit', params.limit.toString());
      const query = queryParams.toString();
      return request(`/api/rank/student${query ? '?' + query : ''}`) as Promise<{
        ranking: StudentRankItem[];
        total_students: number;
        class_name: string;
      }>;
    },
    getClassRanking: (params: { sort_by?: string; order?: string; limit?: number } = {}) => {
      const queryParams = new URLSearchParams();
      if (params.sort_by) queryParams.append('sort_by', params.sort_by);
      if (params.order) queryParams.append('order', params.order);
      if (params.limit) queryParams.append('limit', params.limit.toString());
      const query = queryParams.toString();
      return request(`/api/rank/class${query ? '?' + query : ''}`) as Promise<{
        ranking: ClassRankItem[];
        total_classes: number;
      }>;
    },
  },
  cache: {
    clearByUrl: (url: string) => deleteCacheByPattern(url),
  },
};

export { getCsrfToken, fetchCsrfToken, request };
export default api;
