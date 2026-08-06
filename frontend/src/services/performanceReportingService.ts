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
  private readonly MAX_QUEUE_SIZE = 50;
  private readonly FLUSH_INTERVAL_MS = 5000;
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
    const path = window.location.pathname;
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

    if (this.isDev) {
      console.debug('[Performance] Reported:', fullMetric);
    }
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

      if (this.isDev) {
        const status = resp ? resp.status : 'network';
        if (resp && resp.ok) {
          console.debug('[Performance] Flushed:', metricsToSend.length, 'metrics');
        } else {
          // 仅 debug 级输出，避免控制台红色错误干扰用户
          console.debug(`[Performance] Flushed status: ${status} (${metricsToSend.length} metrics, silently ignored)`);
        }
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
