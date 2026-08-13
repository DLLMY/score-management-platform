import { config, getApiUrl } from '../config';

const API_BASE_URL = getApiUrl();

interface PerformanceMetric {
  type: string;
  name: string;
  value: number;
  unit?: string;
  page?: string;
  timestamp?: string;
  user_agent?: string;
  screen_width?: number;
  screen_height?: number;
  data?: Record<string, unknown>;
}

interface ErrorReport {
  type: string;
  message: string;
  stack?: string;
  file?: string;
  line?: number;
  column?: number;
  page?: string;
  url?: string;
  method?: string;
  status?: number;
  timestamp?: string;
  user_agent?: string;
  data?: Record<string, unknown>;
}

class PerformanceReportingService {
  private queue: PerformanceMetric[] = [];
  private errorQueue: ErrorReport[] = [];
  private isFlushing = false;
  private flushInterval: number | null = null;
  // 收到 429 后暂停上报（避免持续打限流 + 日志刷屏），期间新指标保留在队列
  private rateLimitedUntil: number | null = null;
  private readonly MAX_QUEUE_SIZE = 50;
  private readonly FLUSH_INTERVAL_MS = 5000;
  private readonly RATE_LIMIT_BACKOFF_MS = 60000;
  private readonly isDev = config.app.isDevelopment;

  constructor() {
    this.startFlushInterval();
    this.setupBeforeUnload();
  }

  private startFlushInterval(): void {
    this.flushInterval = window.setInterval(() => {
      this.flush();
    }, this.FLUSH_INTERVAL_MS);
  }

  private stopFlushInterval(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  private setupBeforeUnload(): void {
    const handleBeforeUnload = (): void => {
      this.stopFlushInterval();
      if (this.queue.length > 0 || this.errorQueue.length > 0) {
        try {
          const metricsPayload = this.queue.length > 0 
            ? JSON.stringify({ metrics: this.queue }) 
            : null;
          const errorsPayload = this.errorQueue.map(e => JSON.stringify(e));
          
          if (metricsPayload) {
            navigator.sendBeacon(`${API_BASE_URL}/api/system/frontend-performance/batch`, metricsPayload);
          }
          
          errorsPayload.forEach(payload => {
            navigator.sendBeacon(`${API_BASE_URL}/api/system/frontend-error`, payload);
          });
        } catch {
          // 静默失败，不影响页面卸载
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
  }

  private getCurrentPage(): string {
    // HashRouter：路径在 hash 中（#/devices），pathname 恒为 '/' —— 须从 hash 解析
    const hash = window.location.hash.replace(/^#/, '') || '/';
    const path = hash.split('?')[0];
    if (path.startsWith('/dashboard')) return 'dashboard';
    if (path.startsWith('/users')) return 'users';
    if (path.startsWith('/rules')) return 'rules';
    if (path.startsWith('/devices')) return 'devices';
    if (path.startsWith('/analysis')) return 'analysis';
    if (path.startsWith('/exams')) return 'exams';
    if (path.startsWith('/login')) return 'login';
    return path || 'unknown';
  }

  private getEnvironmentInfo(): {
    user_agent: string;
    screen_width: number;
    screen_height: number;
  } {
    return {
      user_agent: navigator.userAgent,
      screen_width: window.screen.width,
      screen_height: window.screen.height,
    };
  }

  reportMetric(metric: Omit<PerformanceMetric, 'timestamp' | 'user_agent' | 'screen_width' | 'screen_height'>): void {
    const fullMetric: PerformanceMetric = {
      ...metric,
      timestamp: new Date().toISOString(),
      page: this.getCurrentPage(),
      ...this.getEnvironmentInfo(),
    };

    this.queue.push(fullMetric);

    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      this.flush();
    }
    // 注：不打印每条指标（高频轮询下会刷屏）；flush 结果在 flush() 中按需 debug 输出
  }

  reportError(error: Omit<ErrorReport, 'timestamp' | 'user_agent'>): void {
    const fullError: ErrorReport = {
      ...error,
      timestamp: new Date().toISOString(),
      page: this.getCurrentPage(),
      user_agent: navigator.userAgent,
    };

    this.errorQueue.push(fullError);

    if (this.errorQueue.length >= this.MAX_QUEUE_SIZE) {
      this.flushErrors();
    }

    if (this.isDev) {
      console.debug('[Error] Reported:', fullError);
    }
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    try {
      const accessToken = localStorage.getItem('access_token');
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }
    } catch {
      // 静默失败（localStorage 不可用时不抛错）
    }
    return headers;
  }

  async flush(): Promise<void> {
    if (this.isFlushing || this.queue.length === 0) {
      return;
    }
    // 429 退避窗口内：保留队列但不请求，避免持续打限流
    if (this.rateLimitedUntil && Date.now() < this.rateLimitedUntil) {
      return;
    }

    this.isFlushing = true;

    try {
      const metricsToSend = [...this.queue];
      this.queue = [];
      const headers = this.getAuthHeaders();

      let resp: Response | null = null;
      if (metricsToSend.length === 1) {
        resp = await fetch(`${API_BASE_URL}/api/system/frontend-performance`, {
          method: 'POST',
          headers,
          body: JSON.stringify(metricsToSend[0]),
          // 静默失败：上报失败不应影响用户使用
        }).catch(() => null);
      } else {
        resp = await fetch(`${API_BASE_URL}/api/system/frontend-performance/batch`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ metrics: metricsToSend }),
        }).catch(() => null);
      }

      if (resp && resp.status === 429) {
        // 触发限流：暂停上报 60s（性能数据非关键，丢弃本批不再重试，避免队列堆积死循环）
        this.rateLimitedUntil = Date.now() + this.RATE_LIMIT_BACKOFF_MS;
        if (this.isDev) {
          console.debug(`[Performance] 429 限流，暂停上报 ${this.RATE_LIMIT_BACKOFF_MS / 1000}s`);
        }
        return;
      }

      if (this.isDev && (!resp || !resp.ok)) {
        // 仅失败（网络/5xx）时 debug 输出；成功静默，避免高频轮询刷屏
        console.debug(`[Performance] Flush 失败: ${resp ? resp.status : 'network'} (${metricsToSend.length} metrics, silently ignored)`);
      }
    } catch {
      // 完全静默：任何异常都不抛到控制台
    } finally {
      this.isFlushing = false;
    }
  }

  async flushErrors(): Promise<void> {
    if (this.errorQueue.length === 0) {
      return;
    }

    try {
      const errorsToSend = [...this.errorQueue];
      this.errorQueue = [];
      const headers = this.getAuthHeaders();
      let okCount = 0;

      for (const error of errorsToSend) {
        const resp = await fetch(`${API_BASE_URL}/api/system/frontend-error`, {
          method: 'POST',
          headers,
          body: JSON.stringify(error),
        }).catch(() => null);
        if (resp && resp.ok) okCount++;
      }

      if (this.isDev) {
        console.debug(`[Error] Flushed: ${okCount}/${errorsToSend.length} errors (silently handled)`);
      }
    } catch {
      // 完全静默：任何异常都不抛到控制台
    }
  }

  reportWebVital(name: string, value: number, data?: Record<string, unknown>): void {
    this.reportMetric({
      type: 'web_vital',
      name,
      value,
      unit: 'ms',
      data,
    });
  }

  reportApiRequest(url: string, method: string, duration: number, status: number): void {
    this.reportMetric({
      type: 'api_request',
      name: `${method} ${url}`,
      value: duration,
      unit: 'ms',
      data: { url, method, status },
    });
  }

  reportComponentRender(componentName: string, duration: number): void {
    this.reportMetric({
      type: 'component_render',
      name: componentName,
      value: duration,
      unit: 'ms',
    });
  }

  reportMemoryUsage(usedJSHeapSize: number, totalJSHeapSize: number): void {
    this.reportMetric({
      type: 'memory',
      name: 'used_heap_size',
      value: usedJSHeapSize,
      unit: 'bytes',
      data: { totalJSHeapSize },
    });
  }

  reportJavaScriptError(error: Error, url?: string, line?: number, column?: number): void {
    this.reportError({
      type: 'javascript_error',
      message: error.message,
      stack: error.stack,
      file: url,
      line,
      column,
    });
  }

  reportApiError(url: string, method: string, status: number, message: string): void {
    this.reportError({
      type: 'api_error',
      message,
      url,
      method,
      status,
    });
  }

  reportResourceLoad(resourceType: string, name: string, duration: number, size: number): void {
    this.reportMetric({
      type: 'resource_load',
      name: `${resourceType}: ${name}`,
      value: duration,
      unit: 'ms',
      data: { resourceType, name, size },
    });
  }

  destroy(): void {
    this.stopFlushInterval();
    this.flush();
    this.flushErrors();
  }
}

export const performanceReportingService = new PerformanceReportingService();

export type { PerformanceMetric, ErrorReport };
