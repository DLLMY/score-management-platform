import logger from '../utils/logger';
import { request } from '../services/api';

interface CacheWarmupConfig {
  /** 是否启用缓存预热 */
  enabled: boolean;
  /** 预热延迟时间（毫秒） */
  delay: number;
  /** 预热的API列表 */
  endpoints: {
    key: string;
    url: string;
    priority: 'high' | 'medium' | 'low';
  }[];
}

const defaultConfig: CacheWarmupConfig = {
  enabled: true,
  delay: 300,
  endpoints: [
    // 高优先级 - 首页加载和核心数据
    { key: 'dashboard', url: '/api/dashboard/data', priority: 'high' },
    { key: 'classes', url: '/api/classes', priority: 'high' },
    { key: 'score_rules', url: '/api/rules', priority: 'high' },
    { key: 'categories', url: '/api/score-categories', priority: 'high' },
    { key: 'subjects', url: '/api/subjects', priority: 'high' },

    // 中优先级 - 常用数据
    { key: 'class_periods', url: '/api/class-periods', priority: 'medium' },
    { key: 'time_rules', url: '/api/time-rules', priority: 'medium' },
    { key: 'users', url: '/api/users?page=1&per_page=20', priority: 'medium' },

    // 低优先级 - 配置数据
    { key: 'system_config', url: '/api/system/config', priority: 'low' },
    { key: 'rank_rules', url: '/api/rank-rules', priority: 'low' },
    { key: 'devices', url: '/api/devices', priority: 'low' },
  ],
};

class CacheWarmupService {
  private config: CacheWarmupConfig;
  private warmupPromise: Promise<void> | null = null;
  private isWarmedUp: boolean = false;
  private static instance: CacheWarmupService | null = null;

  constructor(customConfig?: Partial<CacheWarmupConfig>) {
    this.config = { ...defaultConfig, ...customConfig };
  }

  /**
   * 获取单例实例
   */
  static getInstance(): CacheWarmupService {
    if (!CacheWarmupService.instance) {
      CacheWarmupService.instance = new CacheWarmupService();
    }
    return CacheWarmupService.instance;
  }

  /**
   * 执行缓存预热
   */
  async warmup(): Promise<void> {
    if (!this.config.enabled) {
      logger.debug('[CacheWarmup] 缓存预热已禁用');
      return;
    }

    if (this.isWarmedUp) {
      logger.debug('[CacheWarmup] 缓存已预热，跳过');
      return;
    }

    // 如果已经在预热中，返回现有Promise
    if (this.warmupPromise) {
      return this.warmupPromise;
    }

    // 仅登录后预热：预热列表中的接口均需鉴权，未登录时预热必然 401 且毫无意义
    const hasAuthToken =
      typeof localStorage !== 'undefined' && !!localStorage.getItem('access_token');
    if (!hasAuthToken) {
      logger.debug('[CacheWarmup] 未检测到登录令牌，跳过缓存预热');
      return;
    }

    logger.log('[CacheWarmup] 开始缓存预热...');
    const startTime = performance.now();

    this.warmupPromise = this.performWarmup();

    try {
      await this.warmupPromise;
      const duration = performance.now() - startTime;
      logger.log(`[CacheWarmup] 缓存预热完成，耗时: ${duration.toFixed(2)}ms`);
      this.isWarmedUp = true;
    } catch (error) {
      logger.error('[CacheWarmup] 缓存预热失败:', error);
    } finally {
      this.warmupPromise = null;
    }
  }

  /**
   * 执行具体的预热逻辑
   */
  private async performWarmup(): Promise<void> {
    const { endpoints, delay } = this.config;

    const grouped = this.groupByPriority(endpoints);

    await this.delay(delay);

    // 高优先级：串行请求（避免内存激增）
    for (const endpoint of grouped.high) {
      await this.fetchEndpoint(endpoint);
      await this.delay(100);
    }

    // 中优先级：串行请求，避免过多并发
    for (const endpoint of grouped.medium) {
      await this.fetchEndpoint(endpoint);
      await this.delay(100);
    }

    // 低优先级：逐个请求
    for (const endpoint of grouped.low) {
      await this.fetchEndpoint(endpoint);
      await this.delay(100);
    }
  }

  /**
   * 按优先级分组
   */
  private groupByPriority(
    endpoints: CacheWarmupConfig['endpoints']
  ): Record<string, typeof endpoints> {
    return endpoints.reduce((acc, endpoint) => {
      if (!acc[endpoint.priority]) {
        acc[endpoint.priority] = [];
      }
      acc[endpoint.priority].push(endpoint);
      return acc;
    }, {} as Record<string, typeof endpoints>);
  }

  /**
   * 批量获取端点
   */
  private async fetchEndpoints(endpoints: CacheWarmupConfig['endpoints']): Promise<void> {
    if (!endpoints || endpoints.length === 0) return;

    await Promise.all(endpoints.map((endpoint) => this.fetchEndpoint(endpoint)));
  }

  /**
   * 获取单个端点
   */
  private async fetchEndpoint(endpoint: CacheWarmupConfig['endpoints'][0]): Promise<void> {
    try {
      const startTime = performance.now();
      // 带登录令牌预热：预热列表中的接口均需鉴权，不带 token 必然 401。
      // 与页面组件的同 URL 请求会被 requestCoalescing 合并为一次带 token 的网络请求。
      await request(endpoint.url, { skipCache: false, skipAuth: false });
      const duration = performance.now() - startTime;
      logger.debug(`[CacheWarmup] 预热成功: ${endpoint.key} (${duration.toFixed(2)}ms)`);
    } catch (error) {
      const apiError = error as { status?: number };
      if (apiError.status === 401 || apiError.status === 403) {
        logger.debug(`[CacheWarmup] 跳过需要登录的接口: ${endpoint.key}`);
      } else {
        logger.debug(`[CacheWarmup] 预热失败: ${endpoint.key}`, error);
      }
    }
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 检查是否已预热
   */
  isReady(): boolean {
    return this.isWarmedUp;
  }

  /**
   * 重置预热状态（用于测试或手动刷新）
   */
  reset(): void {
    this.isWarmedUp = false;
    this.warmupPromise = null;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<CacheWarmupConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

export const cacheWarmupService = CacheWarmupService.getInstance();
export default cacheWarmupService;
